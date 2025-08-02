/**
 * SessionManager - Manages per-session state for Aiur server
 * 
 * Each session maintains its own:
 * - HandleRegistry for persistent object references
 * - ContextManager for context data
 * - Session metadata and lifecycle
 * 
 * Tools are provided by the central ModuleLoader singleton
 */

import { HandleRegistry } from '../handles/HandleRegistry.js';
import { HandleResolver } from '../handles/HandleResolver.js';
import { ContextManager } from '../core/ContextManager.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';

/**
 * SessionToolProvider - Provides tools from the central ModuleLoader
 * No session-specific module storage - all modules are global
 */
class SessionToolProvider {
  constructor(moduleLoader, session) {
    this.moduleLoader = moduleLoader;  // The singleton ModuleLoader
    this.session = session;  // Session reference for context tools
  }

  async getAllToolDefinitions() {
    try {
      const definitions = [];
      
      // Add context management tools from session
      if (this.session && this.session.context) {
        try {
          const contextTools = this.session.context.getToolDefinitions();
          definitions.push(...contextTools);
        } catch (error) {
          console.error('[SessionToolProvider] Error adding context tools:', error);
        }
      }
      
      // Get all tools from the central ModuleLoader
      const allTools = await this.moduleLoader.getAllTools();
      
      for (const tool of allTools) {
        // Handle multi-function tools
        if (tool.getAllToolDescriptions) {
          const allDescs = tool.getAllToolDescriptions();
          if (Array.isArray(allDescs)) {
            for (const desc of allDescs) {
              definitions.push({
                name: desc.function.name,
                description: desc.function.description,
                inputSchema: desc.function.parameters
              });
            }
          }
        } else if (tool.getToolDescription) {
          // Single function tool
          const desc = tool.getToolDescription();
          if (desc && desc.function) {
            definitions.push({
              name: desc.function.name,
              description: desc.function.description,
              inputSchema: desc.function.parameters
            });
          }
        } else if (tool.toJSON) {
          // New Tool class with toJSON method
          definitions.push(tool.toJSON());
        } else if (tool.name && tool.description) {
          // Legacy simple tool format
          definitions.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || {}
          });
        }
      }
      
      console.log(`[SessionToolProvider] Returning ${definitions.length} tool definitions`);
      return definitions;
    } catch (error) {
      console.error('Error getting tool definitions:', error);
      return [];
    }
  }
  
  async toolExists(toolName) {
    // Check context tools
    if (this.session?.context) {
      const contextToolNames = ['context_add', 'context_get', 'context_list'];
      if (contextToolNames.includes(toolName)) {
        return true;
      }
    }
    
    // Check if tool exists in ModuleLoader
    return this.moduleLoader.hasTool(toolName);
  }
  
  async getToolType(toolName) {
    return await this.toolExists(toolName) ? 'module' : 'unknown';
  }
  
  async executeTool(toolName, args) {
    try {
      
      // Handle context management tools
      if (this.session?.context) {
        const contextToolNames = ['context_add', 'context_get', 'context_list'];
        if (contextToolNames.includes(toolName)) {
          try {
            const result = await this.session.context.executeContextTool(toolName, args);
            return {
              success: true,
              result: result
            };
          } catch (error) {
            return {
              success: false,
              error: error.message
            };
          }
        }
      }
      
      // Execute tool from ModuleLoader
      try {
        const result = await this.moduleLoader.executeTool(toolName, args);
        return result;
      } catch (error) {
        // If ModuleLoader can't find it, check if it's a multi-function tool
        const allTools = await this.moduleLoader.getAllTools();
        
        for (const tool of allTools) {
          if (tool.getAllToolDescriptions) {
            const allDescs = tool.getAllToolDescriptions();
            if (Array.isArray(allDescs)) {
              const hasFunction = allDescs.some(desc => desc.function.name === toolName);
              if (hasFunction) {
                // Execute multi-function tool
                if (typeof tool.invoke === 'function') {
                  const toolCall = {
                    id: `session-${Date.now()}`,
                    type: 'function',
                    function: {
                      name: toolName,
                      arguments: JSON.stringify(args)
                    }
                  };
                  return await tool.invoke(toolCall);
                } else if (typeof tool.execute === 'function') {
                  return await tool.execute({ function: { name: toolName, arguments: args }});
                }
              }
            }
          }
        }
        
        return {
          success: false,
          error: `Tool not found: ${toolName}`
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Tool execution error: ${error.message}`
      };
    }
  }
}

export class SessionManager {
  constructor(config) {
    this.config = config;
    this.moduleLoader = config.moduleLoader;  // The singleton ModuleLoader
    this.sessions = new Map();
    this.sessionTimeouts = new Map();
    this.logManager = config.logManager;
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
      sessionTimeout: this.config.sessionTimeout,
      loadedModules: this.moduleLoader.getLoadedModuleNames().length
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
    
    // Create session-specific context manager
    const contextManager = new ContextManager(handleRegistry, handleResolver);
    
    // Create session object
    const session = {
      id: sessionId,
      created: now,
      lastAccessed: now,
      handles: handleRegistry,
      handleResolver: handleResolver,
      context: contextManager,
      toolProvider: null, // Will be set after creation
      toolRegistry: toolRegistry,
      metadata: {
        requestCount: 0,
        toolCalls: 0,
        errors: 0
      }
    };
    
    // Create tool provider with central ModuleLoader
    const toolProvider = new SessionToolProvider(this.moduleLoader, session);
    session.toolProvider = toolProvider;
    
    // Store session
    this.sessions.set(sessionId, session);
    this._resetSessionTimeout(sessionId);
    
    await this.logManager.logInfo('Session created', {
      source: 'SessionManager',
      operation: 'create-session',
      sessionId,
      availableTools: this.moduleLoader.getToolNames().length
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
        planning: true,
        modules: this.moduleLoader.getLoadedModuleNames()
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