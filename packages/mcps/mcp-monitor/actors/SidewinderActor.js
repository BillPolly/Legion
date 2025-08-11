/**
 * SidewinderActor - Handles Node.js instrumentation events
 * Receives events from Sidewinder agents and processes them
 */

import { Actor } from '@legion/shared/actors/src/Actor.js';

export class SidewinderActor extends Actor {
  constructor(dependencies = {}) {
    super();
    
    this.logManager = dependencies.logManager;
    this.correlationActor = dependencies.correlationActor;
    this.sessionId = dependencies.sessionId;
    
    // Track connected Node agents
    this.nodeAgents = new Map(); // processId -> RemoteActor
    this.processStats = new Map(); // processId -> stats
    this.events = new Map(); // sessionId -> events array
    this.maxEventsPerSession = 10000;
    
    console.log('[SidewinderActor] Initialized');
  }
  
  /**
   * Add a Node agent connection
   */
  addNodeAgent(processId, remoteNodeAgent) {
    this.nodeAgents.set(processId, remoteNodeAgent);
    this.processStats.set(processId, {
      httpRequests: 0,
      consoleMessages: 0,
      errors: 0,
      asyncOperations: 0,
      connectedAt: new Date()
    });
    
    // Initialize event storage for this process
    if (!this.events.has(processId)) {
      this.events.set(processId, []);
    }
    
    console.log(`[SidewinderActor] Added Node agent: ${processId}`);
  }
  
  /**
   * Remove a Node agent connection
   */
  removeNodeAgent(processId) {
    this.nodeAgents.delete(processId);
    const stats = this.processStats.get(processId);
    if (stats) {
      console.log(`[SidewinderActor] Process ${processId} stats:`, stats);
      this.processStats.delete(processId);
    }
  }
  
  /**
   * Receive messages from agents or other actors
   */
  async receive(payload, envelope) {
    const { type, data, processId, sessionId, timestamp } = payload;
    
    switch (type) {
      case 'identify':
        await this.handleIdentification(data, processId);
        break;
        
      case 'http':
        await this.handleHttpEvent(data, processId, timestamp);
        break;
        
      case 'console':
        await this.handleConsoleEvent(data, processId, timestamp);
        break;
        
      case 'error':
        await this.handleErrorEvent(data, processId, timestamp);
        break;
        
      case 'async':
        await this.handleAsyncEvent(data, processId, timestamp);
        break;
        
      case 'get-events':
        return this.getEvents(processId || sessionId, data);
        
      case 'clear-events':
        this.clearEvents(processId || sessionId);
        return { cleared: true };
        
      case 'set-log-level':
        return await this.setLogLevel(data);
        
      case 'get-stats':
        return this.getStats();
        
      default:
        // Store as generic event
        if (processId || sessionId) {
          this.storeEvent(processId || sessionId, payload);
        }
    }
  }
  
  /**
   * Handle agent identification
   */
  async handleIdentification(data, processId) {
    const { pid, sessionId, name } = data;
    
    console.log(`[SidewinderActor] Process identified: ${name} (PID: ${pid}, Session: ${sessionId})`);
    
    // Send acknowledgment back
    const agent = this.nodeAgents.get(processId);
    if (agent) {
      await agent.receive({
        type: 'identified',
        sessionId: sessionId || this.sessionId
      });
    }
  }
  
  /**
   * Handle HTTP events
   */
  async handleHttpEvent(data, processId, timestamp) {
    const { subtype, request, response, requestId, context } = data;
    
    // Update stats
    if (this.processStats.has(processId)) {
      const stats = this.processStats.get(processId);
      stats.httpRequests++;
    }
    
    // Store event
    this.storeEvent(processId, {
      type: 'http',
      subtype,
      request,
      response,
      requestId,
      context,
      timestamp: timestamp || Date.now()
    });
    
    // Log based on subtype
    if (this.logManager) {
      if (subtype === 'requestStart' && request) {
        await this.logManager.receive({
          type: 'log',
          source: 'sidewinder-http',
          processId,
          data: {
            level: 'info',
            message: `HTTP ${request.method} ${request.host}${request.path}`,
            requestId,
            context,
            timestamp: timestamp || new Date().toISOString()
          }
        });
      } else if (subtype === 'response' && response) {
        await this.logManager.receive({
          type: 'log',
          source: 'sidewinder-http',
          processId,
          data: {
            level: response.statusCode >= 400 ? 'error' : 'info',
            message: `HTTP ${response.statusCode} [${response.duration}ms]`,
            requestId,
            context,
            timestamp: timestamp || new Date().toISOString()
          }
        });
      }
    }
    
    // Check for correlations
    if (this.correlationActor && requestId) {
      await this.correlationActor.receive({
        type: 'register-correlation',
        source: 'sidewinder',
        correlationId: requestId,
        processId,
        request,
        response,
        timestamp
      });
    }
  }
  
  /**
   * Handle console events
   */
  async handleConsoleEvent(data, processId, timestamp) {
    const { method, args } = data;
    
    // Update stats
    if (this.processStats.has(processId)) {
      const stats = this.processStats.get(processId);
      stats.consoleMessages++;
    }
    
    // Store event
    this.storeEvent(processId, {
      type: 'console',
      method,
      args,
      timestamp: timestamp || Date.now()
    });
    
    // Forward to LogManagerActor
    if (this.logManager) {
      const level = method === 'error' ? 'error' : 
                   method === 'warn' ? 'warn' : 
                   method === 'debug' ? 'debug' : 'info';
      
      await this.logManager.receive({
        type: 'log',
        source: 'sidewinder-console',
        processId,
        data: {
          level,
          message: `console.${method}: ${args.join(' ')}`,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Handle error events
   */
  async handleErrorEvent(data, processId, timestamp) {
    const { subtype, error, context } = data;
    
    // Update stats
    if (this.processStats.has(processId)) {
      const stats = this.processStats.get(processId);
      stats.errors++;
    }
    
    // Store event
    this.storeEvent(processId, {
      type: 'error',
      subtype,
      error,
      context,
      timestamp: timestamp || Date.now()
    });
    
    // Log the error
    if (this.logManager) {
      await this.logManager.receive({
        type: 'log',
        source: 'sidewinder-error',
        processId,
        data: {
          level: 'error',
          message: `${subtype}: ${error.message}`,
          stack: error.stack,
          context,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Handle async context events
   */
  async handleAsyncEvent(data, processId, timestamp) {
    const { subtype, requestId, method, url } = data;
    
    // Update stats
    if (this.processStats.has(processId)) {
      const stats = this.processStats.get(processId);
      stats.asyncOperations++;
    }
    
    // Store event
    this.storeEvent(processId, {
      type: 'async',
      subtype,
      requestId,
      method,
      url,
      timestamp: timestamp || Date.now()
    });
    
    // Log context creation
    if (this.logManager && subtype === 'contextCreated') {
      await this.logManager.receive({
        type: 'log',
        source: 'sidewinder-async',
        processId,
        data: {
          level: 'debug',
          message: `Request context: ${requestId} - ${method} ${url}`,
          timestamp: timestamp || new Date().toISOString()
        }
      });
    }
  }
  
  /**
   * Store event for a process
   */
  storeEvent(processId, event) {
    const events = this.events.get(processId) || [];
    
    // Add event with process context
    events.push({
      ...event,
      processId,
      receivedAt: Date.now()
    });
    
    // Limit stored events
    if (events.length > this.maxEventsPerSession) {
      events.shift(); // Remove oldest
    }
    
    this.events.set(processId, events);
  }
  
  /**
   * Get events for a process with optional filters
   */
  getEvents(processId, filters = {}) {
    const events = this.events.get(processId) || [];
    
    let filtered = [...events];
    
    // Apply filters
    if (filters.type) {
      filtered = filtered.filter(e => e.type === filters.type);
    }
    
    if (filters.requestId) {
      filtered = filtered.filter(e => 
        e.requestId === filters.requestId || 
        (e.context && e.context.requestId === filters.requestId)
      );
    }
    
    if (filters.since) {
      const cutoff = filters.since instanceof Date ? filters.since.getTime() : filters.since;
      filtered = filtered.filter(e => e.timestamp > cutoff);
    }
    
    if (filters.level) {
      filtered = filtered.filter(e => {
        const eventLevel = this.getEventLevel(e);
        return this.matchesLogLevel(eventLevel, filters.level);
      });
    }
    
    return filtered;
  }
  
  /**
   * Clear events for a process
   */
  clearEvents(processId) {
    this.events.delete(processId);
  }
  
  /**
   * Set log level for all connected agents
   */
  async setLogLevel(data) {
    const { level } = data;
    
    const results = [];
    for (const [processId, agent] of this.nodeAgents) {
      try {
        await agent.receive({
          type: 'setLogLevel',
          level
        });
        results.push({ processId, success: true });
      } catch (error) {
        results.push({ processId, error: error.message });
      }
    }
    
    return results;
  }
  
  /**
   * Get statistics for all processes
   */
  getStats() {
    const stats = {
      totalProcesses: this.nodeAgents.size,
      processes: []
    };
    
    this.processStats.forEach((processStats, processId) => {
      const eventCount = this.events.has(processId) ? 
        this.events.get(processId).length : 0;
      
      stats.processes.push({
        processId,
        eventCount,
        ...processStats
      });
    });
    
    return stats;
  }
  
  /**
   * Get log level for an event
   */
  getEventLevel(event) {
    if (event.type === 'error' || 
        (event.type === 'console' && event.method === 'error')) {
      return 'error';
    }
    
    if (event.type === 'warning' || 
        (event.type === 'console' && event.method === 'warn')) {
      return 'warn';
    }
    
    if (event.type === 'console' && 
        (event.method === 'debug' || event.method === 'trace')) {
      return 'debug';
    }
    
    return 'info';
  }
  
  /**
   * Check if event level matches minimum level
   */
  matchesLogLevel(eventLevel, minLevel) {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const eventIndex = levels.indexOf(eventLevel);
    const minIndex = levels.indexOf(minLevel);
    return eventIndex !== -1 && eventIndex <= minIndex;
  }
  
  /**
   * Send command to a specific Node agent
   */
  async sendToProcess(processId, command) {
    const agent = this.nodeAgents.get(processId);
    if (agent) {
      return await agent.receive(command);
    } else {
      throw new Error(`No Node agent found for processId: ${processId}`);
    }
  }
  
  /**
   * Broadcast command to all Node agents
   */
  async broadcastToProcesses(command) {
    const results = [];
    for (const [processId, agent] of this.nodeAgents) {
      try {
        const result = await agent.receive(command);
        results.push({ processId, result });
      } catch (error) {
        results.push({ processId, error: error.message });
      }
    }
    return results;
  }
}