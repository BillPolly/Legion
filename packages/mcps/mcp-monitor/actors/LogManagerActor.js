/**
 * LogManagerActor - Centralizes all log persistence
 * Interfaces with LegionLogManager for storing and retrieving logs
 */

import { Actor } from '@legion/shared/actors/src/Actor.js';

export class LogManagerActor extends Actor {
  constructor(dependencies = {}) {
    super();
    
    this.legionLogManager = dependencies.legionLogManager;
    this.sessionId = dependencies.sessionId;
    
    // Cache for recent logs
    this.recentLogs = [];
    this.maxRecentLogs = 1000;
    
    console.log('[LogManagerActor] Initialized');
  }
  
  /**
   * Receive messages from other actors
   */
  async receive(payload, envelope) {
    const { type, data, source } = payload;
    
    switch (type) {
      case 'log':
        return await this.handleLog(data, source);
        
      case 'create-session':
        return await this.createSession(data);
        
      case 'add-process':
        return await this.addProcess(data);
        
      case 'search-logs':
        return await this.searchLogs(data);
        
      case 'get-session-logs':
        return await this.getSessionLogs(data);
        
      case 'list-sessions':
        return await this.listSessions();
        
      case 'get-recent-logs':
        return this.getRecentLogs(data);
        
      case 'clear-recent-logs':
        this.recentLogs = [];
        return { cleared: true };
        
      default:
        console.warn(`[LogManagerActor] Unknown message type: ${type}`);
    }
  }
  
  /**
   * Handle incoming log message
   */
  async handleLog(data, source) {
    const { level, message, timestamp, pageId, processId, requestId, ...extra } = data;
    
    // Add to recent logs cache
    const logEntry = {
      timestamp: timestamp || new Date().toISOString(),
      level: level || 'info',
      message,
      source: source || 'unknown',
      pageId,
      processId,
      requestId,
      ...extra
    };
    
    this.recentLogs.push(logEntry);
    if (this.recentLogs.length > this.maxRecentLogs) {
      this.recentLogs.shift();
    }
    
    // Persist using LegionLogManager if available
    if (this.legionLogManager) {
      try {
        // Get or create session
        let sessionId = this.sessionId;
        if (!sessionId) {
          const session = await this.legionLogManager.createSession({
            name: 'monitor-session',
            type: 'fullstack'
          });
          sessionId = session.sessionId;
          this.sessionId = sessionId;
        }
        
        // Add process if needed
        const identifier = processId || pageId || 'default';
        if (!this.hasProcess(identifier)) {
          await this.legionLogManager.addProcessToSession(sessionId, {
            processId: identifier,
            name: source,
            type: source.includes('browser') ? 'frontend' : 'backend'
          });
          this.markProcessAdded(identifier);
        }
        
        // Log the message
        await this.legionLogManager.logMessage({
          sessionId,
          processId: identifier,
          level,
          message,
          timestamp: logEntry.timestamp,
          metadata: extra
        });
        
        return { success: true, logged: true };
      } catch (error) {
        console.error('[LogManagerActor] Failed to persist log:', error);
        return { success: false, error: error.message };
      }
    }
    
    return { success: true, cached: true };
  }
  
  /**
   * Create a new logging session
   */
  async createSession(data) {
    const { name, type, metadata } = data;
    
    if (!this.legionLogManager) {
      return { success: false, error: 'LegionLogManager not available' };
    }
    
    try {
      const session = await this.legionLogManager.createSession({
        name: name || 'monitor-session',
        type: type || 'fullstack',
        metadata
      });
      
      this.sessionId = session.sessionId;
      return { success: true, session };
    } catch (error) {
      console.error('[LogManagerActor] Failed to create session:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Add a process to the current session
   */
  async addProcess(data) {
    const { processId, name, type, script } = data;
    
    if (!this.legionLogManager || !this.sessionId) {
      return { success: false, error: 'No active session' };
    }
    
    try {
      await this.legionLogManager.addProcessToSession(this.sessionId, {
        processId,
        name,
        type,
        script
      });
      
      this.markProcessAdded(processId);
      return { success: true };
    } catch (error) {
      console.error('[LogManagerActor] Failed to add process:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Search logs
   */
  async searchLogs(data) {
    const { query, limit = 100 } = data;
    
    // Search in recent logs first
    const recentMatches = this.recentLogs.filter(log => {
      const searchText = `${log.message} ${log.level} ${log.source}`.toLowerCase();
      return searchText.includes(query.toLowerCase());
    }).slice(-limit);
    
    // Search in persisted logs if available
    if (this.legionLogManager) {
      try {
        const result = await this.legionLogManager.searchLogs({
          query,
          limit
        });
        
        if (result.success && result.matches) {
          return {
            success: true,
            logs: [...recentMatches, ...result.matches].slice(0, limit)
          };
        }
      } catch (error) {
        console.error('[LogManagerActor] Search failed:', error);
      }
    }
    
    return {
      success: true,
      logs: recentMatches
    };
  }
  
  /**
   * Get logs for current session
   */
  async getSessionLogs(data = {}) {
    const { limit = 100, level } = data;
    
    // Filter recent logs by level if specified
    let filtered = this.recentLogs;
    if (level) {
      filtered = this.recentLogs.filter(log => 
        this.matchesLogLevel(log.level, level)
      );
    }
    
    const recentLogs = filtered.slice(-limit);
    
    // Get persisted logs if available
    if (this.legionLogManager && this.sessionId) {
      try {
        const result = await this.legionLogManager.getSessionLogs(
          this.sessionId, 
          { limit }
        );
        
        if (result.success && result.logs) {
          let persistedLogs = result.logs;
          
          // Filter by level if specified
          if (level) {
            persistedLogs = persistedLogs.filter(log =>
              this.matchesLogLevel(log.level, level)
            );
          }
          
          return {
            success: true,
            logs: [...persistedLogs, ...recentLogs].slice(0, limit),
            sessionId: this.sessionId
          };
        }
      } catch (error) {
        console.error('[LogManagerActor] Failed to get session logs:', error);
      }
    }
    
    return {
      success: true,
      logs: recentLogs,
      sessionId: this.sessionId
    };
  }
  
  /**
   * List all sessions
   */
  async listSessions() {
    if (!this.legionLogManager) {
      return {
        success: true,
        sessions: this.sessionId ? [{
          sessionId: this.sessionId,
          name: 'Current Session',
          logCount: this.recentLogs.length
        }] : []
      };
    }
    
    try {
      const result = await this.legionLogManager.listSessions();
      return result;
    } catch (error) {
      console.error('[LogManagerActor] Failed to list sessions:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get recent logs from cache
   */
  getRecentLogs(data = {}) {
    const { limit = 100, level, source, since } = data;
    
    let filtered = [...this.recentLogs];
    
    // Apply filters
    if (level) {
      filtered = filtered.filter(log => 
        this.matchesLogLevel(log.level, level)
      );
    }
    
    if (source) {
      filtered = filtered.filter(log => 
        log.source && log.source.includes(source)
      );
    }
    
    if (since) {
      const cutoff = since instanceof Date ? since : new Date(since);
      filtered = filtered.filter(log => 
        new Date(log.timestamp) > cutoff
      );
    }
    
    return filtered.slice(-limit);
  }
  
  /**
   * Check if event level matches minimum level
   */
  matchesLogLevel(logLevel, minLevel) {
    const levels = ['error', 'warn', 'info', 'debug', 'trace'];
    const logIndex = levels.indexOf(logLevel.toLowerCase());
    const minIndex = levels.indexOf(minLevel.toLowerCase());
    return logIndex !== -1 && logIndex <= minIndex;
  }
  
  // Track which processes have been added
  _addedProcesses = new Set();
  
  hasProcess(processId) {
    return this._addedProcesses.has(processId);
  }
  
  markProcessAdded(processId) {
    this._addedProcesses.add(processId);
  }
}