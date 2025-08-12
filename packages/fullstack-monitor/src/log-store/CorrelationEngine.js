/**
 * CorrelationEngine - Native correlation tracking for dual-agent architecture
 * Designed to efficiently correlate logs between Sidewinder (backend) and Browser (frontend) agents
 * Completely silent operation to prevent infinite recursion loops
 */

import { EventEmitter } from 'events';

export class CorrelationEngine extends EventEmitter {
  constructor() {
    super();
    this.correlations = new Map(); // correlationId -> correlation data
    this.stats = {
      totalCorrelations: 0,
      activeCorrelations: 0,
      backendEvents: 0,
      frontendEvents: 0
    };
  }

  /**
   * Track correlation data from either agent
   */
  trackCorrelation(correlationId, source, data) {
    if (!correlationId) {
      return null;
    }

    let correlation = this.correlations.get(correlationId);
    
    if (!correlation) {
      // Create new correlation
      correlation = {
        id: correlationId,
        firstSeen: new Date(),
        lastSeen: new Date(),
        backend: [],
        frontend: [],
        network: [],
        status: 'active'
      };
      this.correlations.set(correlationId, correlation);
      this.stats.totalCorrelations++;
      this.stats.activeCorrelations++;
    } else {
      // Update existing correlation
      correlation.lastSeen = new Date();
    }

    // Add data based on source
    const entry = {
      timestamp: new Date(),
      source,
      data,
      ...data
    };

    switch (source) {
      case 'sidewinder':
      case 'backend':
        correlation.backend.push(entry);
        this.stats.backendEvents++;
        break;
      
      case 'browser':
      case 'frontend':
        correlation.frontend.push(entry);
        this.stats.frontendEvents++;
        break;
        
      case 'network':
        correlation.network.push(entry);
        break;
        
      default:
        // Add to appropriate array based on data type
        if (data.type === 'network' || data.subtype) {
          correlation.network.push(entry);
        } else if (data.pageId || data.userAgent) {
          correlation.frontend.push(entry);
          this.stats.frontendEvents++;
        } else {
          correlation.backend.push(entry);
          this.stats.backendEvents++;
        }
    }

    // Emit correlation update event (no console logging)
    this.emit('correlation-updated', {
      correlationId,
      source,
      entryCount: correlation.backend.length + correlation.frontend.length + correlation.network.length
    });

    return correlation;
  }

  /**
   * Get correlation data by ID
   */
  getCorrelation(correlationId) {
    return this.correlations.get(correlationId);
  }

  /**
   * Get all correlations
   */
  getAllCorrelations() {
    return Array.from(this.correlations.values());
  }

  /**
   * Get correlations that match criteria
   */
  findCorrelations(criteria = {}) {
    const correlations = Array.from(this.correlations.values());
    
    return correlations.filter(correlation => {
      if (criteria.hasBackend && correlation.backend.length === 0) {
        return false;
      }
      if (criteria.hasFrontend && correlation.frontend.length === 0) {
        return false;
      }
      if (criteria.hasNetwork && correlation.network.length === 0) {
        return false;
      }
      if (criteria.minEvents && 
          (correlation.backend.length + correlation.frontend.length) < criteria.minEvents) {
        return false;
      }
      if (criteria.since && correlation.firstSeen < criteria.since) {
        return false;
      }
      return true;
    });
  }

  /**
   * Extract correlation ID from message content
   * Handles both explicit correlation headers and embedded IDs
   */
  extractCorrelationId(message) {
    // Check explicit correlation fields
    if (message.correlationId) {
      return message.correlationId;
    }

    if (message.headers && message.headers['x-correlation-id']) {
      return message.headers['x-correlation-id'];
    }

    if (message.metadata && message.metadata.correlationId) {
      return message.metadata.correlationId;
    }

    // Extract from message content using regex
    if (message.message && typeof message.message === 'string') {
      // Look for correlation ID patterns
      const patterns = [
        /correlation[_-]id[:\s=]+([a-f0-9\-]{20,40})/i,
        /corr[_-]id[:\s=]+([a-f0-9\-]{20,40})/i,
        /req[_-]id[:\s=]+([a-f0-9\-]{20,40})/i,
        /trace[_-]id[:\s=]+([a-f0-9\-]{20,40})/i,
        /["\']([a-f0-9\-]{8}-[a-f0-9\-]{4}-[a-f0-9\-]{4}-[a-f0-9\-]{4}-[a-f0-9\-]{12})["\']/ // UUID
      ];

      for (const pattern of patterns) {
        const match = message.message.match(pattern);
        if (match) {
          return match[1];
        }
      }
    }

    return null;
  }

  /**
   * Get correlation statistics
   */
  getStats() {
    const now = new Date();
    const recentThreshold = new Date(now - 5 * 60 * 1000); // 5 minutes ago
    
    const recentCorrelations = Array.from(this.correlations.values())
      .filter(c => c.lastSeen > recentThreshold);

    return {
      ...this.stats,
      recentCorrelations: recentCorrelations.length,
      correlationsWithBoth: this.findCorrelations({ 
        hasBackend: true, 
        hasFrontend: true 
      }).length,
      averageEventsPerCorrelation: this.stats.totalCorrelations > 0 ?
        (this.stats.backendEvents + this.stats.frontendEvents) / this.stats.totalCorrelations : 0
    };
  }

  /**
   * Clean up old correlations to prevent memory leaks
   */
  cleanup(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const cutoff = new Date(Date.now() - maxAge);
    let removedCount = 0;

    for (const [correlationId, correlation] of this.correlations.entries()) {
      if (correlation.lastSeen < cutoff) {
        this.correlations.delete(correlationId);
        removedCount++;
        this.stats.activeCorrelations--;
      }
    }

    if (removedCount > 0) {
      this.emit('correlations-cleaned', { removedCount });
    }

    return removedCount;
  }

  /**
   * Clear all correlations
   */
  clear() {
    const count = this.correlations.size;
    this.correlations.clear();
    this.stats = {
      totalCorrelations: 0,
      activeCorrelations: 0,
      backendEvents: 0,
      frontendEvents: 0
    };
    return count;
  }
}