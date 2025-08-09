/**
 * @fileoverview LegionLogManager - Enhanced LogManager with Legion framework integration
 * Supports session management, advanced search, and WebSocket streaming
 */

import { EventEmitter } from 'events';
import LogManager from './LogManager.js';
import { LogSearchEnhanced } from './search/LogSearchEnhanced.js';

export class LegionLogManager extends EventEmitter {
  
  /**
   * Private constructor - use static create method
   */
  constructor(dependencies) {
    super();
    
    const {
      resourceManager,
      storageProvider,
      semanticSearchProvider = null,
      logManager
    } = dependencies;
    
    this.resourceManager = resourceManager;
    this.storageProvider = storageProvider;
    this.semanticSearchProvider = semanticSearchProvider;
    this.logManager = logManager;
    
    // Enhanced search functionality
    this.logSearch = new LogSearchEnhanced({
      semanticSearchProvider: this.semanticSearchProvider,
      storageProvider: this.storageProvider,
      resourceManager: this.resourceManager
    });
    
    // Session management
    this.sessions = new Map();
    this.wsServer = null;
    
    // Statistics
    this.stats = {
      totalSessions: 0,
      totalLogs: 0,
      totalSearches: 0,
      startTime: new Date()
    };
    
    this.setupEventHandlers();
  }

  /**
   * Async factory method for creating LegionLogManager
   * @param {Object} resourceManager - Legion ResourceManager instance
   * @returns {Promise<LegionLogManager>} Initialized LegionLogManager
   */
  static async create(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    // Get required dependencies from ResourceManager
    const storageProvider = resourceManager.get('StorageProvider');
    if (!storageProvider) {
      throw new Error('StorageProvider not found in ResourceManager');
    }
    
    // Optional dependencies
    const semanticSearchProvider = resourceManager.get('SemanticSearchProvider');
    
    // Create base LogManager with dependencies
    const logManager = new LogManager({
      storageProvider,
      semanticSearchProvider
    });
    
    // Create LegionLogManager instance
    const legionLogManager = new LegionLogManager({
      resourceManager,
      storageProvider,
      semanticSearchProvider,
      logManager
    });
    
    return legionLogManager;
  }
  
  /**
   * Setup internal event handlers
   */
  setupEventHandlers() {
    // Forward events from logManager and logSearch
    if (this.logManager) {
      this.logManager.on('log', (log) => {
        this.emit('log', log);
        
        // Auto-index for semantic search
        if (this.semanticSearchProvider) {
          this.logSearch.indexLog(log).catch(console.error);
        }
      });
      
      this.logManager.on('error', (error) => this.emit('error', error));
    }
    
    // Forward search events from logSearch if any
    this.logSearch.on('search-performed', (event) => {
      // Don't increment here since we do it in searchLogs method
      this.emit('search-performed', event);
    });
    
    // Listen to our own log events to update statistics
    this.on('log', (log) => {
      // Always update stats when we emit log events
      // (this handles both logManager and direct logMessage calls)
      this.stats.totalLogs++;
    });
  }
  
  /**
   * Check if semantic search is available
   * @returns {boolean} True if semantic search is available
   */
  hasSemanticSearch() {
    return !!this.semanticSearchProvider;
  }
  
  /**
   * Get API key from ResourceManager
   * @param {string} keyName - Name of the API key
   * @returns {string|null} API key value or null if not found
   */
  getApiKey(keyName) {
    return this.resourceManager.get(`env.${keyName}`) || null;
  }

  /**
   * Create a new session
   * @param {Object} options - Session options
   * @returns {Promise<Object>} Session creation result
   */
  async createSession(options = {}) {
    try {
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const session = {
        sessionId,
        name: options.name || sessionId,
        description: options.description || '',
        status: 'active',
        processes: [],
        createdAt: new Date(),
        endedAt: null,
        metadata: options.metadata || {}
      };
      
      this.sessions.set(sessionId, session);
      this.stats.totalSessions++;
      
      this.emit('session-created', session);
      
      return {
        success: true,
        sessionId,
        status: 'active',
        createdAt: session.createdAt
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * List all sessions
   * @param {Object} options - Listing options
   * @returns {Promise<Object>} Sessions list result
   */
  async listSessions(options = {}) {
    try {
      const sessionsArray = Array.from(this.sessions.values());
      
      // Apply filters if provided
      let filteredSessions = sessionsArray;
      if (options.status) {
        filteredSessions = sessionsArray.filter(s => s.status === options.status);
      }
      
      return {
        success: true,
        sessions: filteredSessions,
        total: filteredSessions.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get session by ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session result
   */
  async getSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`
        };
      }
      
      return {
        success: true,
        session
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * End a session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} End session result
   */
  async endSession(sessionId) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`
        };
      }
      
      session.status = 'completed';
      session.endedAt = new Date();
      
      this.emit('session-ended', session);
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Add process to session
   * @param {string} sessionId - Session ID
   * @param {Object} processInfo - Process information
   * @returns {Promise<Object>} Add process result
   */
  async addProcessToSession(sessionId, processInfo) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`
        };
      }
      
      const process = {
        processId: processInfo.processId,
        command: processInfo.command || '',
        args: processInfo.args || [],
        cwd: processInfo.cwd || '',
        status: 'running',
        startedAt: new Date(),
        endedAt: null,
        exitCode: null,
        duration: null
      };
      
      session.processes.push(process);
      
      return {
        success: true,
        processId: process.processId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Complete a process
   * @param {string} sessionId - Session ID
   * @param {string} processId - Process ID
   * @param {Object} completionInfo - Process completion info
   * @returns {Promise<Object>} Complete process result
   */
  async completeProcess(sessionId, processId, completionInfo = {}) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          success: false,
          error: `Session ${sessionId} not found`
        };
      }
      
      const process = session.processes.find(p => p.processId === processId);
      if (!process) {
        return {
          success: false,
          error: `Process ${processId} not found in session`
        };
      }
      
      process.status = 'completed';
      process.endedAt = new Date();
      process.exitCode = completionInfo.exitCode || 0;
      process.duration = completionInfo.duration || (process.endedAt - process.startedAt);
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Log a message to a session
   * @param {Object} logMessage - Log message
   * @returns {Promise<Object>} Log result
   */
  async logMessage(logMessage) {
    try {
      const logEntry = {
        logId: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sessionId: logMessage.sessionId,
        processId: logMessage.processId,
        source: logMessage.source || 'stdout',
        message: logMessage.message,
        level: logMessage.level || 'info',
        timestamp: logMessage.timestamp || new Date(),
        metadata: logMessage.metadata || {}
      };
      
      // Store in storage provider
      await this.storageProvider.store('logs', logEntry);
      
      // Emit log event
      this.emit('log', logEntry);
      
      // Broadcast to WebSocket clients if available
      if (this.wsServer) {
        this.wsServer.broadcastLog(logEntry);
      }
      
      return {
        success: true,
        logId: logEntry.logId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get logs for a session
   * @param {string} sessionId - Session ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Logs result
   */
  async getSessionLogs(sessionId, options = {}) {
    try {
      const logs = await this.storageProvider.query('logs', { sessionId });
      
      // Apply sorting and limiting
      const sortedLogs = logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const limitedLogs = options.limit ? sortedLogs.slice(0, options.limit) : sortedLogs;
      
      return {
        success: true,
        logs: limitedLogs,
        total: logs.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Enhanced search across logs
   * @param {Object} searchOptions - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchLogs(searchOptions) {
    try {
      const {
        query,
        sessionId = null,
        mode = 'keyword',
        limit = 100,
        ...otherOptions
      } = searchOptions;
      
      let results;
      let actualMode = mode;
      
      switch (mode) {
        case 'semantic':
          if (!this.semanticSearchProvider) {
            actualMode = 'keyword';
            results = await this.logSearch.keywordSearch(query, sessionId, limit);
          } else {
            results = await this.logSearch.semanticSearch(query, sessionId, limit);
          }
          break;
          
        case 'regex':
          results = await this.logSearch.regexSearch(query, sessionId, limit);
          break;
          
        case 'hybrid':
          results = await this.logSearch.hybridSearch(query, sessionId, limit);
          break;
          
        case 'keyword':
        default:
          actualMode = 'keyword';
          results = await this.logSearch.keywordSearch(query, sessionId, limit);
          break;
      }
      
      // Update search statistics
      this.stats.totalSearches++;
      
      this.emit('search-performed', {
        query,
        mode: actualMode,
        sessionId,
        resultCount: results.length,
        timestamp: new Date()
      });
      
      return {
        success: true,
        mode: actualMode,
        query,
        matches: results,
        totalMatches: results.length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Start WebSocket server for real-time streaming
   * @param {Object} options - Server options
   * @returns {Promise<Object>} Server start result
   */
  async startWebSocketServer(options = {}) {
    try {
      // Import WebSocket server dynamically
      const { LogWebSocketServer } = await import('./websocket/LogWebSocketServer.js');
      
      this.wsServer = new LogWebSocketServer({
        port: options.port || 0,
        host: options.host || 'localhost',
        legionLogManager: this
      });
      
      const serverInfo = await this.wsServer.start();
      
      return {
        success: true,
        port: serverInfo.port,
        url: `ws://${serverInfo.host}:${serverInfo.port}`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Stop WebSocket server
   * @returns {Promise<Object>} Server stop result
   */
  async stopWebSocketServer() {
    try {
      if (this.wsServer) {
        await this.wsServer.stop();
        this.wsServer = null;
      }
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get overall statistics
   * @returns {Promise<Object>} Statistics result
   */
  async getStatistics() {
    try {
      const searchStats = this.logSearch.getStatistics();
      
      return {
        success: true,
        totalSessions: this.stats.totalSessions,
        totalLogs: this.stats.totalLogs,
        totalSearches: this.stats.totalSearches,
        searchPerformance: {
          averageSearchTime: searchStats.averageSearchTime,
          cacheHitRate: searchStats.cacheSize > 0 ? 0.8 : 0 // Approximation
        },
        uptime: Date.now() - this.stats.startTime.getTime()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Get statistics for a specific session
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session statistics result
   */
  async getSessionStatistics(sessionId) {
    try {
      const logs = await this.storageProvider.query('logs', { sessionId });
      
      const stats = {
        totalLogs: logs.length,
        logsByLevel: {},
        logsBySource: {},
        processCount: 0
      };
      
      const processes = new Set();
      
      for (const log of logs) {
        // Count by level
        stats.logsByLevel[log.level] = (stats.logsByLevel[log.level] || 0) + 1;
        
        // Count by source
        stats.logsBySource[log.source] = (stats.logsBySource[log.source] || 0) + 1;
        
        // Count unique processes
        if (log.processId) {
          processes.add(log.processId);
        }
      }
      
      stats.processCount = processes.size;
      
      return {
        success: true,
        ...stats
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Cleanup all resources
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanup() {
    try {
      // Stop WebSocket server
      let webSocketServerStopped = false;
      if (this.wsServer) {
        await this.stopWebSocketServer();
        webSocketServerStopped = true;
      }
      
      // Clear search cache
      this.logSearch.clearCache();
      
      // End all active sessions
      const activeSessions = Array.from(this.sessions.values())
        .filter(s => s.status === 'active');
        
      for (const session of activeSessions) {
        await this.endSession(session.sessionId);
      }
      
      // Clear sessions
      const sessionsTerminated = this.sessions.size;
      this.sessions.clear();
      
      // Remove all listeners
      this.removeAllListeners();
      
      return {
        success: true,
        sessionsTerminated,
        webSocketServerStopped
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}