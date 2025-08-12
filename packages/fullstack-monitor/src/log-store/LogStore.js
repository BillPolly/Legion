/**
 * LogStore - Main log storage component optimized for FullStackMonitor
 * Provides a clean API specifically designed for dual-agent architecture
 * Completely silent operation to prevent infinite recursion loops
 */

import { EventEmitter } from 'events';
import { SessionStore } from './SessionStore.js';
import { CorrelationEngine } from './CorrelationEngine.js';
import { LogSearchEngine } from './LogSearchEngine.js';

export class LogStore extends EventEmitter {
  /**
   * Private constructor - use static create method
   */
  constructor(dependencies) {
    super();
    
    const { resourceManager, storageProvider } = dependencies;
    
    this.resourceManager = resourceManager;
    this.storageProvider = storageProvider;
    
    // Initialize components
    this.sessionStore = new SessionStore(storageProvider);
    this.correlationEngine = new CorrelationEngine();
    this.searchEngine = new LogSearchEngine(storageProvider);
    
    // Statistics
    this.stats = {
      sidewinderMessages: 0,
      browserMessages: 0,
      totalLogs: 0,
      correlationsTracked: 0,
      searchesPerformed: 0,
      startTime: new Date()
    };
    
    this.setupEventHandlers();
  }

  /**
   * Async factory method for creating LogStore
   */
  static async create(resourceManager) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }
    
    // Get storage provider from ResourceManager
    const storageProvider = resourceManager.get('StorageProvider');
    if (!storageProvider) {
      throw new Error('StorageProvider not found in ResourceManager');
    }
    
    const logStore = new LogStore({
      resourceManager,
      storageProvider
    });
    
    return logStore;
  }

  /**
   * Setup event forwarding between components
   */
  setupEventHandlers() {
    // Forward session events
    this.sessionStore.on('session-created', (session) => {
      this.emit('session-created', session);
    });
    
    this.sessionStore.on('session-ended', (session) => {
      this.emit('session-ended', session);
    });
    
    this.sessionStore.on('process-started', (process) => {
      this.emit('process-started', process);
    });
    
    this.sessionStore.on('process-completed', (process) => {
      this.emit('process-completed', process);
    });
    
    // Forward correlation events
    this.correlationEngine.on('correlation-updated', (data) => {
      this.stats.correlationsTracked++;
      this.emit('correlation-updated', data);
    });
    
    // Forward search events
    this.searchEngine.on('search-completed', (data) => {
      this.stats.searchesPerformed++;
      this.emit('search-completed', data);
    });
    
    // Forward error events from all components
    ['sessionStore', 'correlationEngine', 'searchEngine'].forEach(component => {
      this[component].on('error', (error) => {
        this.emit('component-error', { component, error });
      });
    });
  }

  // ===== SESSION MANAGEMENT =====

  /**
   * Create a new monitoring session
   */
  async createSession(name = 'fullstack-monitoring', metadata = {}) {
    return await this.sessionStore.createSession(name, metadata);
  }

  /**
   * Get current session
   */
  getCurrentSession() {
    return this.sessionStore.getCurrentSession();
  }

  /**
   * End current session
   */
  async endSession() {
    return await this.sessionStore.endSession();
  }

  // ===== DUAL-AGENT LOGGING =====

  /**
   * Log message from Sidewinder (backend) agent
   */
  async logSidewinderMessage(message, clientId = null) {
    try {
      const logEntry = this._createLogEntry(message, 'sidewinder', clientId);
      
      // Store in storage provider
      await this._storeLogEntry(logEntry);
      
      // Track correlation if present
      const correlationId = this.correlationEngine.extractCorrelationId(message);
      if (correlationId) {
        this.correlationEngine.trackCorrelation(correlationId, 'sidewinder', message);
      }
      
      this.stats.sidewinderMessages++;
      this.stats.totalLogs++;
      
      // No log event emission to prevent infinite loops
      
      return { success: true, logId: logEntry.logId };
      
    } catch (error) {
      this.emit('log-error', { 
        agentType: 'sidewinder',
        clientId,
        error: error.message 
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Log message from Browser (frontend) agent
   */
  async logBrowserMessage(message, clientId = null) {
    try {
      const logEntry = this._createLogEntry(message, 'browser', clientId);
      
      // Store in storage provider
      await this._storeLogEntry(logEntry);
      
      // Track correlation if present
      const correlationId = this.correlationEngine.extractCorrelationId(message);
      if (correlationId) {
        this.correlationEngine.trackCorrelation(correlationId, 'browser', message);
      }
      
      this.stats.browserMessages++;
      this.stats.totalLogs++;
      
      // No log event emission to prevent infinite loops
      
      return { success: true, logId: logEntry.logId };
      
    } catch (error) {
      this.emit('log-error', { 
        agentType: 'browser',
        clientId,
        error: error.message 
      });
      
      return { success: false, error: error.message };
    }
  }

  // ===== PROCESS LIFECYCLE =====

  /**
   * Track a new process
   */
  async trackProcess(processInfo) {
    return await this.sessionStore.trackProcess(processInfo);
  }

  /**
   * Mark process as completed
   */
  async completeProcess(processId, exitInfo = {}) {
    return await this.sessionStore.completeProcess(processId, exitInfo);
  }

  // ===== CORRELATION TRACKING =====

  /**
   * Track correlation manually
   */
  trackCorrelation(correlationId, source, data) {
    return this.correlationEngine.trackCorrelation(correlationId, source, data);
  }

  /**
   * Get correlation data by ID
   */
  getCorrelation(correlationId) {
    return this.correlationEngine.getCorrelation(correlationId);
  }

  /**
   * Get all correlations
   */
  getAllCorrelations() {
    return this.correlationEngine.getAllCorrelations();
  }

  // ===== SEARCH OPERATIONS =====

  /**
   * Search agent logs
   */
  async searchAgentLogs(agentType, query, options = {}) {
    const session = this.getCurrentSession();
    if (session && !options.sessionId) {
      options.sessionId = session.id;
    }
    
    return await this.searchEngine.searchAgentLogs(agentType, query, options);
  }

  /**
   * Search for logs related to correlation ID
   */
  async searchCorrelated(correlationId, options = {}) {
    return await this.searchEngine.searchCorrelated(correlationId, options);
  }

  /**
   * Search with advanced filters
   */
  async searchWithFilters(filters = {}) {
    return await this.searchEngine.searchWithFilters(filters);
  }

  /**
   * Get recent logs from specific agent
   */
  async getRecentAgentLogs(agentType, count = 50) {
    const session = this.getCurrentSession();
    const sessionId = session ? session.id : null;
    return await this.searchEngine.getRecentAgentLogs(agentType, count, sessionId);
  }

  // ===== LEGACY COMPATIBILITY (for easy migration) =====

  /**
   * Legacy method: Log message (auto-detects agent type)
   */
  async logMessage(logMessage) {
    // Determine agent type from message properties
    const agentType = this._detectAgentType(logMessage);
    
    if (agentType === 'browser') {
      return await this.logBrowserMessage(logMessage);
    } else {
      return await this.logSidewinderMessage(logMessage);
    }
  }

  /**
   * Legacy method: Search logs (delegates to advanced search)
   */
  async searchLogs(options = {}) {
    return await this.searchWithFilters(options);
  }

  /**
   * Legacy method: Add process to session
   */
  async addProcessToSession(sessionId, processInfo) {
    // Ensure we're working with current session
    const currentSession = this.getCurrentSession();
    if (!currentSession || currentSession.id !== sessionId) {
      throw new Error(`Session ${sessionId} is not the current active session`);
    }
    
    return await this.trackProcess(processInfo);
  }

  // ===== STATISTICS =====

  /**
   * Get comprehensive statistics
   */
  async getStatistics() {
    const sessionStats = this.sessionStore.getSessionStats();
    const correlationStats = this.correlationEngine.getStats();
    const searchStats = this.searchEngine.getSearchStats();
    
    return {
      // Main stats
      ...this.stats,
      
      // Session stats
      session: sessionStats,
      
      // Correlation stats
      correlations: correlationStats.totalCorrelations,
      activeCorrelations: correlationStats.activeCorrelations,
      correlationsWithBoth: correlationStats.correlationsWithBoth,
      
      // Search stats
      searches: searchStats.totalSearches,
      averageSearchTime: searchStats.averageSearchTime,
      
      // Component stats
      components: {
        session: sessionStats,
        correlations: correlationStats,
        search: searchStats
      }
    };
  }

  // ===== CLEANUP =====

  /**
   * Cleanup all resources
   */
  async cleanup() {
    // Clean up components
    await this.sessionStore.cleanup();
    this.correlationEngine.clear();
    this.searchEngine.clearStats();
    
    // Remove all listeners
    this.removeAllListeners();
  }

  // ===== PRIVATE METHODS =====

  /**
   * Create standardized log entry
   */
  _createLogEntry(message, agentType, clientId) {
    const session = this.getCurrentSession();
    
    return {
      logId: `${agentType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: message.sessionId || (session ? session.id : 'no-session'),
      agentType: agentType,
      clientId: clientId,
      processId: message.processId || message.pid,
      source: message.source || agentType,
      level: this._normalizeLogLevel(message),
      message: this._extractMessage(message),
      timestamp: message.timestamp || new Date(),
      metadata: {
        // Preserve all original message properties as metadata
        ...message,
        // Flatten nested objects (like summary) for easier access
        ...(message.summary || {}),
        ...(message.target || {}),
        ...(message.error || {}),
        // Add any existing metadata
        ...message.metadata,
        // Add framework metadata
        agentType: agentType,
        clientId: clientId,
        // Keep full original message for debugging
        originalMessage: message
      }
    };
  }

  /**
   * Store log entry in storage provider
   */
  async _storeLogEntry(logEntry) {
    if (this.storageProvider && this.storageProvider.store) {
      await this.storageProvider.store(logEntry);
    }
  }

  /**
   * Normalize log level from different agent message formats
   */
  _normalizeLogLevel(message) {
    // Explicit level
    if (message.level) return message.level;
    
    // Browser console methods
    if (message.method) {
      const method = message.method.toLowerCase();
      if (method === 'error') return 'error';
      if (method === 'warn') return 'warn';
      if (method === 'info') return 'info';
      if (method === 'debug') return 'debug';
      return 'info';
    }
    
    // Source-specific log levels
    if (message.source) {
      switch (message.source) {
        case 'browser-error':
        case 'browser-rejection':
        case 'sidewinder-uncaughtException':
        case 'sidewinder-error':
          return 'error';
        
        case 'browser-dom':
          return 'debug';
        
        case 'browser-network':
          if (message.subtype === 'error') return 'error';
          return 'info';
        
        case 'sidewinder-server':
          if (message.event === 'error') return 'error';
          return 'info';
        
        default:
          break;
      }
    }
    
    // Message type fallbacks
    if (message.type) {
      const type = message.type.toLowerCase();
      if (type.includes('error') || type === 'unhandledrejection') return 'error';
      if (type.includes('warn')) return 'warn';
      if (type === 'dom-mutation') return 'debug';
      return 'info';
    }
    
    return 'info';
  }

  /**
   * Extract message content from different formats
   */
  _extractMessage(message) {
    // Explicit message string
    if (typeof message.message === 'string') {
      return message.message;
    }
    
    // Console messages - join args
    if (message.args && Array.isArray(message.args)) {
      return message.args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
          try {
            return JSON.stringify(arg);
          } catch (error) {
            // Handle circular references
            return '[Circular Object]';
          }
        }
        return String(arg);
      }).join(' ');
    }
    
    // Browser-specific message types
    if (message.source && message.source.startsWith('browser-')) {
      return this._createBrowserMessage(message);
    }
    
    // Sidewinder-specific message types
    if (message.source && message.source.startsWith('sidewinder-')) {
      return this._createSidewinderMessage(message);
    }
    
    // Error messages
    if (message.error) {
      return `Error: ${message.error}`;
    }
    
    // Fallback to type-based message
    if (message.type) {
      return `${message.type}: ${JSON.stringify(message)}`;
    }
    
    return JSON.stringify(message);
  }

  /**
   * Create browser-specific log messages
   */
  _createBrowserMessage(message) {
    switch (message.source) {
      case 'browser-agent':
        return `Browser agent connected from ${message.pageUrl || 'unknown page'}`;
      
      case 'browser-console':
        if (message.args && Array.isArray(message.args)) {
          return message.args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg);
              } catch (error) {
                return '[Circular Object]';
              }
            }
            return String(arg);
          }).join(' ');
        }
        return 'Console message';
      
      case 'browser-network':
        const { subtype, url, method, status, duration } = message;
        if (subtype === 'request') {
          return `Network request: ${method || 'GET'} ${url}`;
        } else if (subtype === 'response') {
          return `Network response: ${status} ${url} (${duration || 0}ms)`;
        } else if (subtype === 'error') {
          return `Network error: ${url} - ${message.error}`;
        }
        return `Network ${subtype || 'event'}: ${url}`;
      
      case 'browser-error':
        return message.message || 'JavaScript error';
      
      case 'browser-rejection':
        const reason = message.reason;
        if (typeof reason === 'string') {
          return `Unhandled rejection: ${reason}`;
        } else if (reason && reason.message) {
          return `Unhandled rejection: ${reason.message}`;
        }
        return 'Unhandled promise rejection';
      
      case 'browser-dom':
        const { summary } = message;
        if (summary) {
          const { additions = 0, removals = 0 } = summary;
          return `DOM mutation: +${additions} -${removals}`;
        }
        return 'DOM mutation detected';
      
      case 'browser-interaction':
        const { event, target } = message;
        if (target && target.tagName) {
          const id = target.id ? ` ${target.id}` : '';
          return `User ${event}: ${target.tagName}${id}`;
        }
        return `User ${event || 'interaction'}`;
      
      default:
        return `${message.type}: ${JSON.stringify(message)}`;
    }
  }

  /**
   * Create sidewinder-specific log messages
   */
  _createSidewinderMessage(message) {
    switch (message.source) {
      case 'sidewinder-console':
        if (message.args && Array.isArray(message.args)) {
          return message.args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg);
              } catch (error) {
                return '[Circular Object]';
              }
            }
            return String(arg);
          }).join(' ');
        }
        return 'Console message';
      
      case 'sidewinder-uncaughtException':
        if (message.error && message.error.message) {
          return `Uncaught Exception: ${message.error.message}`;
        }
        return 'Uncaught exception occurred';
      
      case 'sidewinder-server':
        const { event } = message;
        if (event === 'listening') {
          return `Server listening on port ${message.port || 'unknown'}`;
        } else if (event === 'error') {
          return `Server error: ${message.error?.message || 'unknown error'}`;
        }
        return `Server ${event || 'event'}`;
      
      default:
        return `${message.type}: ${JSON.stringify(message)}`;
    }
  }

  /**
   * Detect agent type from message properties
   */
  _detectAgentType(message) {
    // Explicit agent type
    if (message.agentType) {
      return message.agentType;
    }
    
    // Browser-specific properties
    if (message.pageId || message.pageUrl || message.userAgent) {
      return 'browser';
    }
    
    // Browser message types
    if (message.type && ['network', 'dom-mutation', 'user-interaction'].includes(message.type)) {
      return 'browser';
    }
    
    // Sidewinder-specific properties
    if (message.pid || message.argv || message.cwd) {
      return 'sidewinder';
    }
    
    // Sidewinder message types
    if (message.type && ['processStart', 'processExit', 'server-lifecycle'].includes(message.type)) {
      return 'sidewinder';
    }
    
    // Default to sidewinder
    return 'sidewinder';
  }
}