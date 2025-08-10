/**
 * CorrelationActor - Manages correlation between browser and backend requests
 * Tracks request IDs across the full stack
 */

import { Actor } from '@legion/shared/actors/src/Actor.js';

export class CorrelationActor extends Actor {
  constructor(dependencies = {}) {
    super();
    
    this.correlations = new Map(); // correlationId -> correlation data
    this.pendingCorrelations = new Map(); // correlationId -> timeout
    this.correlationTimeout = 30000; // 30 seconds
    
    console.log('[CorrelationActor] Initialized');
  }
  
  /**
   * Receive messages from other actors
   */
  async receive(payload, envelope) {
    const { type, data } = payload;
    
    switch (type) {
      case 'register-correlation':
        return this.registerCorrelation(payload);
        
      case 'check-correlation':
        return this.checkCorrelation(payload);
        
      case 'get-correlation':
        return this.getCorrelation(data);
        
      case 'list-correlations':
        return this.listCorrelations();
        
      case 'clear-correlations':
        return this.clearCorrelations();
        
      default:
        console.warn(`[CorrelationActor] Unknown message type: ${type}`);
    }
  }
  
  /**
   * Register a new correlation
   */
  registerCorrelation(data) {
    const { correlationId, source, timestamp, ...extra } = data;
    
    if (!correlationId) {
      return { success: false, error: 'No correlation ID provided' };
    }
    
    // Get or create correlation entry
    let correlation = this.correlations.get(correlationId);
    if (!correlation) {
      correlation = {
        id: correlationId,
        createdAt: timestamp || new Date().toISOString(),
        sources: {},
        events: []
      };
      this.correlations.set(correlationId, correlation);
      
      // Set timeout to clean up old correlations
      const timeout = setTimeout(() => {
        this.correlations.delete(correlationId);
        this.pendingCorrelations.delete(correlationId);
      }, this.correlationTimeout);
      
      this.pendingCorrelations.set(correlationId, timeout);
    }
    
    // Add source data
    correlation.sources[source] = {
      timestamp: timestamp || new Date().toISOString(),
      ...extra
    };
    
    // Add to events timeline
    correlation.events.push({
      source,
      timestamp: timestamp || new Date().toISOString(),
      data: extra
    });
    
    // Check if we have both browser and backend
    if (correlation.sources.browser && correlation.sources.sidewinder) {
      correlation.isComplete = true;
      console.log(`[CorrelationActor] Complete correlation detected: ${correlationId}`);
    }
    
    return {
      success: true,
      correlation,
      isComplete: correlation.isComplete
    };
  }
  
  /**
   * Check if a message contains a correlation ID
   */
  checkCorrelation(data) {
    const { message, source } = data;
    
    if (!message) {
      return { hasCorrelation: false };
    }
    
    // Look for correlation patterns
    const patterns = [
      /x-correlation-id:\s*([a-zA-Z0-9-]+)/i,
      /x-request-id:\s*([a-zA-Z0-9-]+)/i,
      /correlation[_-]?id[:\s]+([a-zA-Z0-9-]+)/i,
      /request[_-]?id[:\s]+([a-zA-Z0-9-]+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        const correlationId = match[1];
        
        // Register this correlation
        this.registerCorrelation({
          correlationId,
          source,
          message,
          ...data
        });
        
        return {
          hasCorrelation: true,
          correlationId,
          pattern: pattern.source
        };
      }
    }
    
    return { hasCorrelation: false };
  }
  
  /**
   * Get correlation data
   */
  getCorrelation(data) {
    const { correlationId } = data;
    
    if (!correlationId) {
      return { success: false, error: 'No correlation ID provided' };
    }
    
    const correlation = this.correlations.get(correlationId);
    if (!correlation) {
      return { success: false, error: 'Correlation not found' };
    }
    
    return {
      success: true,
      correlation
    };
  }
  
  /**
   * List all correlations
   */
  listCorrelations() {
    const correlationList = [];
    
    this.correlations.forEach((correlation, id) => {
      correlationList.push({
        id,
        createdAt: correlation.createdAt,
        isComplete: correlation.isComplete,
        sources: Object.keys(correlation.sources),
        eventCount: correlation.events.length
      });
    });
    
    // Sort by creation time
    correlationList.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    
    return {
      success: true,
      correlations: correlationList,
      total: correlationList.length,
      complete: correlationList.filter(c => c.isComplete).length,
      pending: correlationList.filter(c => !c.isComplete).length
    };
  }
  
  /**
   * Clear all correlations
   */
  clearCorrelations() {
    // Clear timeouts
    this.pendingCorrelations.forEach(timeout => clearTimeout(timeout));
    this.pendingCorrelations.clear();
    
    // Clear correlations
    const count = this.correlations.size;
    this.correlations.clear();
    
    return {
      success: true,
      cleared: count
    };
  }
  
  /**
   * Get correlation statistics
   */
  getStats() {
    const stats = {
      total: this.correlations.size,
      complete: 0,
      pending: 0,
      sources: {}
    };
    
    this.correlations.forEach(correlation => {
      if (correlation.isComplete) {
        stats.complete++;
      } else {
        stats.pending++;
      }
      
      Object.keys(correlation.sources).forEach(source => {
        stats.sources[source] = (stats.sources[source] || 0) + 1;
      });
    });
    
    return stats;
  }
}