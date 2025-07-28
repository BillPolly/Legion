/**
 * SessionManager - Manages per-session state for Aiur server
 * 
 * Each session maintains its own:
 * - HandleRegistry for persistent object references
 * - ContextManager for context data
 * - ToolDefinitionProvider configured for the session
 * - Session metadata and lifecycle
 */

import { HandleRegistry } from '../handles/HandleRegistry.js';
import { HandleResolver } from '../handles/HandleResolver.js';
import { ContextManager } from '../core/ContextManager.js';
import { ToolDefinitionProvider } from '../core/ToolDefinitionProvider.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.sessions = new Map();
    this.sessionTimeouts = new Map();
    this.resourceManager = config.resourceManager;
    this.logManager = config.logManager;
    
    // We'll use Legion's ModuleManager directly - no shared loader needed
  }

  /**
   * Initialize the session manager
   */
  async initialize() {
    // Start session cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
    
    await this.logManager.logInfo('SessionManager initialized', {
      source: 'SessionManager',
      operation: 'initialize',
      sessionTimeout: this.config.sessionTimeout
    });
  }


  /**
   * Create a new session
   * @returns {Object} Session object with ID
   */
  async createSession() {
    const sessionId = this._generateSessionId();
    const now = new Date();
    
    // Create per-session components
    const handleRegistry = new HandleRegistry();
    const handleResolver = new HandleResolver(handleRegistry);
    const toolRegistry = new ToolRegistry(handleRegistry);
    
    // Create session-specific resource manager
    const { ResourceManager } = await import('@legion/module-loader');
    const sessionResourceManager = new ResourceManager();
    await sessionResourceManager.initialize();
    
    // Register session-specific resources
    sessionResourceManager.register('handleRegistry', handleRegistry);
    sessionResourceManager.register('handleResolver', handleResolver);
    sessionResourceManager.register('toolRegistry', toolRegistry);
    sessionResourceManager.register('logManager', this.logManager);
    sessionResourceManager.register('config', this.config);
    
    // Copy error broadcast service from main resource manager
    if (this.resourceManager.has('errorBroadcastService')) {
      sessionResourceManager.register('errorBroadcastService', 
        this.resourceManager.get('errorBroadcastService'));
    }
    
    // Create session-specific managers
    const contextManager = await ContextManager.create(sessionResourceManager);
    
    // Create tool definition provider with Legion ModuleManager
    const toolDefinitionProvider = await ToolDefinitionProvider.create(sessionResourceManager);
    
    // Initialize to load essential modules
    await toolDefinitionProvider.initialize();
    
    // Register the providers in resource manager for debug tools
    sessionResourceManager.register('contextManager', contextManager);
    sessionResourceManager.register('toolDefinitionProvider', toolDefinitionProvider);
    
    // Create session object
    const session = {
      id: sessionId,
      created: now,
      lastAccessed: now,
      handles: handleRegistry,
      handleResolver: handleResolver,
      context: contextManager,
      toolProvider: toolDefinitionProvider,
      toolRegistry: toolRegistry,
      resourceManager: sessionResourceManager,
      metadata: {
        requestCount: 0,
        toolCalls: 0,
        errors: 0
      }
    };
    
    // Store session
    this.sessions.set(sessionId, session);
    this._resetSessionTimeout(sessionId);
    
    await this.logManager.logInfo('Session created', {
      source: 'SessionManager',
      operation: 'create-session',
      sessionId
    });
    
    // Add current directory to session context
    try {
      await this._addCurrentDirectoryContext(session);
    } catch (error) {
      await this.logManager.logError(error, {
        source: 'SessionManager',
        operation: 'add-directory-context',
        sessionId,
        severity: 'warning'
      });
    }
    
    return {
      sessionId,
      created: now,
      capabilities: {
        tools: true,
        context: true,
        handles: true,
        planning: true
      }
    };
  }

  /**
   * Get an existing session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session object or null
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // Update last accessed time
      session.lastAccessed = new Date();
      this._resetSessionTimeout(sessionId);
      session.metadata.requestCount++;
    }
    
    return session;
  }

  /**
   * Get all active sessions
   * @returns {Array} Array of session info
   */
  getActiveSessions() {
    const sessions = [];
    
    for (const [id, session] of this.sessions) {
      sessions.push({
        id,
        created: session.created,
        lastAccessed: session.lastAccessed,
        handles: session.handles,
        metadata: session.metadata
      });
    }
    
    return sessions;
  }

  /**
   * Destroy a session
   * @param {string} sessionId - Session ID
   */
  async destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }
    
    // Clear timeout
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
    
    // Clear session data
    session.handles.clear();
    
    // Remove session
    this.sessions.delete(sessionId);
    
    await this.logManager.logInfo('Session destroyed', {
      source: 'SessionManager',
      operation: 'destroy-session',
      sessionId,
      lifetime: Date.now() - session.created.getTime(),
      metadata: session.metadata
    });
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    // Sessions are cleaned up by timeout, this is just a safety check
    const now = Date.now();
    const expired = [];
    
    for (const [sessionId, session] of this.sessions) {
      const age = now - session.lastAccessed.getTime();
      
      if (age > this.config.sessionTimeout * 2) {
        // Session is way past timeout, force cleanup
        expired.push(sessionId);
      }
    }
    
    for (const sessionId of expired) {
      this.destroySession(sessionId);
    }
    
    if (expired.length > 0) {
      this.logManager.logInfo('Cleaned up expired sessions', {
        source: 'SessionManager',
        operation: 'cleanup-expired',
        count: expired.length
      });
    }
  }

  /**
   * Shutdown the session manager
   */
  async shutdown() {
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clear all timeouts
    for (const timeout of this.sessionTimeouts.values()) {
      clearTimeout(timeout);
    }
    
    // Destroy all sessions
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }
    
    await this.logManager.logInfo('SessionManager shutdown complete', {
      source: 'SessionManager',
      operation: 'shutdown'
    });
  }

  /**
   * Reset session timeout
   * @private
   */
  _resetSessionTimeout(sessionId) {
    // Clear existing timeout
    const existingTimeout = this.sessionTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      this.destroySession(sessionId);
    }, this.config.sessionTimeout);
    
    this.sessionTimeouts.set(sessionId, timeout);
  }

  /**
   * Generate unique session ID
   * @private
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Add current directory to session context
   * @private
   */
  async _addCurrentDirectoryContext(session) {
    const currentDirectory = process.cwd();
    
    const result = await session.context.executeContextTool('context_add', {
      name: 'current_directory',
      data: {
        path: currentDirectory,
        addedAt: new Date().toISOString(),
        source: 'session_startup'
      },
      description: 'Current working directory where Aiur server is running'
    });
    
    if (result.success) {
      await this.logManager.logInfo('Added current directory to session context', {
        source: 'SessionManager',
        operation: 'add-directory-context',
        sessionId: session.id,
        directory: currentDirectory
      });
    }
  }
}

export default SessionManager;