/**
 * BrowserMonitorActor - Handles browser monitoring events
 * Receives events from browser page agents and processes them
 */

import { Actor } from '@legion/shared/actors/src/Actor.js';

export class BrowserMonitorActor extends Actor {
  constructor(dependencies = {}) {
    super();
    
    this.logManager = dependencies.logManager;
    this.correlationActor = dependencies.correlationActor;
    this.sessionId = dependencies.sessionId;
    
    // Track connected page agents
    this.pageAgents = new Map(); // pageId -> RemoteActor
    this.pageStats = new Map();  // pageId -> stats
    
    console.log('[BrowserMonitorActor] Initialized');
  }
  
  /**
   * Add a page agent connection
   */
  addPageAgent(pageId, remotePageAgent) {
    this.pageAgents.set(pageId, remotePageAgent);
    this.pageStats.set(pageId, {
      consoleMessages: 0,
      networkRequests: 0,
      errors: 0,
      connectedAt: new Date()
    });
    
    console.log(`[BrowserMonitorActor] Added page agent: ${pageId}`);
  }
  
  /**
   * Remove a page agent connection
   */
  removePageAgent(pageId) {
    this.pageAgents.delete(pageId);
    const stats = this.pageStats.get(pageId);
    if (stats) {
      console.log(`[BrowserMonitorActor] Page ${pageId} stats:`, stats);
      this.pageStats.delete(pageId);
    }
  }
  
  /**
   * Receive messages from agents or other actors
   */
  async receive(payload, envelope) {
    const { type, data, pageId, timestamp } = payload;
    
    switch (type) {
      case 'console':
        await this.handleConsoleMessage(data, pageId, timestamp);
        break;
        
      case 'network-request':
        await this.handleNetworkRequest(data, pageId, timestamp);
        break;
        
      case 'network-response':
        await this.handleNetworkResponse(data, pageId, timestamp);
        break;
        
      case 'page-error':
        await this.handlePageError(data, pageId, timestamp);
        break;
        
      case 'dom-event':
        await this.handleDOMEvent(data, pageId, timestamp);
        break;
        
      case 'get-stats':
        return this.getStats();
        
      case 'clear-stats':
        this.pageStats.clear();
        return { cleared: true };
        
      default:
        console.warn(`[BrowserMonitorActor] Unknown message type: ${type}`);
    }
  }
  
  /**
   * Handle console messages from browser
   */
  async handleConsoleMessage(data, pageId, timestamp) {
    const { level, message, args } = data;
    
    // Update stats
    if (this.pageStats.has(pageId)) {
      const stats = this.pageStats.get(pageId);
      stats.consoleMessages++;
    }
    
    // Forward to LogManagerActor
    if (this.logManager) {
      await this.logManager.receive({
        type: 'log',
        source: 'browser',
        pageId,
        data: {
          level: level || 'info',
          message,
          args,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
    
    // Check for correlations
    if (this.correlationActor && message) {
      await this.correlationActor.receive({
        type: 'check-correlation',
        source: 'browser',
        message,
        pageId,
        timestamp
      });
    }
  }
  
  /**
   * Handle network requests
   */
  async handleNetworkRequest(data, pageId, timestamp) {
    const { requestId, url, method, headers } = data;
    
    // Update stats
    if (this.pageStats.has(pageId)) {
      const stats = this.pageStats.get(pageId);
      stats.networkRequests++;
    }
    
    // Log the request
    if (this.logManager) {
      await this.logManager.receive({
        type: 'log',
        source: 'browser-network',
        pageId,
        data: {
          level: 'debug',
          message: `${method} ${url}`,
          requestId,
          headers,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
    
    // Check for correlation headers
    if (this.correlationActor && headers) {
      const correlationId = headers['x-correlation-id'] || headers['x-request-id'];
      if (correlationId) {
        await this.correlationActor.receive({
          type: 'register-correlation',
          source: 'browser',
          correlationId,
          requestId,
          url,
          method,
          pageId,
          timestamp
        });
      }
    }
  }
  
  /**
   * Handle network responses
   */
  async handleNetworkResponse(data, pageId, timestamp) {
    const { requestId, status, statusText, headers, duration } = data;
    
    // Log the response
    if (this.logManager) {
      await this.logManager.receive({
        type: 'log',
        source: 'browser-network',
        pageId,
        data: {
          level: status >= 400 ? 'error' : 'debug',
          message: `Response ${status} ${statusText} (${duration}ms)`,
          requestId,
          status,
          headers,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Handle page errors
   */
  async handlePageError(data, pageId, timestamp) {
    const { message, stack, source } = data;
    
    // Update stats
    if (this.pageStats.has(pageId)) {
      const stats = this.pageStats.get(pageId);
      stats.errors++;
    }
    
    // Log the error
    if (this.logManager) {
      await this.logManager.receive({
        type: 'log',
        source: 'browser-error',
        pageId,
        data: {
          level: 'error',
          message: `Page error: ${message}`,
          stack,
          source,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Handle DOM events
   */
  async handleDOMEvent(data, pageId, timestamp) {
    const { eventType, selector, details } = data;
    
    // Log DOM interactions
    if (this.logManager) {
      await this.logManager.receive({
        type: 'log',
        source: 'browser-dom',
        pageId,
        data: {
          level: 'debug',
          message: `DOM ${eventType} on ${selector}`,
          details,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Get statistics for all pages
   */
  getStats() {
    const stats = {
      totalPages: this.pageAgents.size,
      pages: []
    };
    
    this.pageStats.forEach((pageStats, pageId) => {
      stats.pages.push({
        pageId,
        ...pageStats
      });
    });
    
    return stats;
  }
  
  /**
   * Send command to a specific page agent
   */
  async sendToPage(pageId, command) {
    const pageAgent = this.pageAgents.get(pageId);
    if (pageAgent) {
      return await pageAgent.receive(command);
    } else {
      throw new Error(`No page agent found for pageId: ${pageId}`);
    }
  }
  
  /**
   * Broadcast command to all page agents
   */
  async broadcastToPages(command) {
    const results = [];
    for (const [pageId, pageAgent] of this.pageAgents) {
      try {
        const result = await pageAgent.receive(command);
        results.push({ pageId, result });
      } catch (error) {
        results.push({ pageId, error: error.message });
      }
    }
    return results;
  }
}