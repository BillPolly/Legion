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

/**
 * Simple ToolProvider that manages tool definitions and execution per session
 */
class SessionToolProvider {
  constructor(sessionManager, session) {
    this.sessionManager = sessionManager;
    this.session = session; // Reference to specific session for isolated module storage
  }

  async getAllToolDefinitions() {
    try {
      const definitions = [];
      console.log('[SessionToolProvider] getAllToolDefinitions called');
      console.log('[SessionToolProvider] sessionManager exists:', !!this.sessionManager);
      console.log('[SessionToolProvider] server exists:', !!this.sessionManager?.server);
      console.log('[SessionToolProvider] moduleLoader exists:', !!this.sessionManager?.server?.moduleLoader);
      
      // Add module management tools that the UI needs
      definitions.push(
        {
          name: 'module_list',
          description: 'List available and loaded modules',
          inputSchema: {
            type: 'object',
            properties: {
              filter: { type: 'string', description: 'Filter modules by name' }
            }
          }
        },
        {
          name: 'module_load',
          description: 'Load a module to make its tools available',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the module to load' }
            },
            required: ['name']
          }
        },
        {
          name: 'module_unload', 
          description: 'Unload a module and remove its tools',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name of the module to unload' }
            },
            required: ['name']
          }
        },
        {
          name: 'module_tools',
          description: 'List tools available in a specific module',
          inputSchema: {
            type: 'object',
            properties: {
              module: { type: 'string', description: 'Name of the module to inspect' }
            },
            required: ['module']
          }
        }
      );
      console.log('[SessionToolProvider] Added', definitions.length, 'module management tools');
      
      // Add context management tools if session exists
      if (this.session && this.session.context) {
        try {
          const contextTools = this.session.context.getToolDefinitions();
          definitions.push(...contextTools);
          console.log('[SessionToolProvider] Added', contextTools.length, 'context management tools');
        } catch (error) {
          console.error('[SessionToolProvider] Error adding context tools:', error);
        }
      }
      
      // Add tools from session-specific loaded modules
      if (this.session && this.session.modules) {
        try {
          console.log('[SessionToolProvider] Loading tools from session modules, count:', this.session.modules.size);
          
          // Iterate through session-specific modules
          for (const [moduleName, moduleInstance] of this.session.modules) {
            console.log('[SessionToolProvider] Processing module:', moduleName);
            
            if (moduleInstance && typeof moduleInstance.getTools === 'function') {
              const tools = await moduleInstance.getTools();
              
              for (const tool of tools) {
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
                }
              }
            }
          }
        } catch (toolLoadError) {
          console.error('Error loading tools from session modules:', toolLoadError);
        }
      }
      
      console.log('[SessionToolProvider] Returning total', definitions.length, 'tool definitions');
      return definitions;
    } catch (error) {
      console.error('Error getting tool definitions:', error);
      return [];
    }
  }
  
  async toolExists(toolName) {
    const definitions = await this.getAllToolDefinitions();
    return definitions.some(def => def.name === toolName);
  }
  
  async getToolType(toolName) {
    return await this.toolExists(toolName) ? 'module' : 'unknown';
  }
  
  async executeTool(toolName, args) {
    try {
      // Handle module management tools first
      if (toolName === 'module_load') {
        if (!args.name) {
          return {
            success: false,
            error: "Module name is required"
          };
        }
        
        try {
          // Try to load the module using the ModuleLoader
          let loadedModule;
          
          // Import the specific module classes directly
          // This is simpler than trying to use generic module loading
          let ModuleClass;
          
          switch(args.name) {
            case 'file':
              const { default: FileModule } = await import('../../../general-tools/src/file/FileModule.js');
              ModuleClass = FileModule;
              break;
            case 'calculator':
              const { default: CalculatorModule } = await import('../../../general-tools/src/calculator/CalculatorModule.js');
              ModuleClass = CalculatorModule;
              break;
            case 'serper':
              const { default: SerperModule } = await import('../../../general-tools/src/serper/SerperModule.js');
              ModuleClass = SerperModule;
              break;
            case 'github':
              const { default: GitHubModule } = await import('../../../general-tools/src/github/GitHubModule.js');
              ModuleClass = GitHubModule;
              break;
            case 'json':
              const { default: JSONModule } = await import('../../../general-tools/src/json/JsonModule.js');
              ModuleClass = JSONModule;
              break;
            default:
              throw new Error(`Unknown module: ${args.name}`);
          }
          
          // Create module instance
          try {
            // Check if module has a static create method (async resource manager pattern)
            if (typeof ModuleClass.create === 'function') {
              const resourceManager = this.sessionManager.server.moduleLoader.resourceManager;
              loadedModule = await ModuleClass.create(resourceManager);
            } else {
              // Fall back to using module factory
              const factory = this.sessionManager.server.moduleLoader.moduleFactory;
              loadedModule = await factory.createModule(ModuleClass);
            }
          } catch (error) {
            console.error(`[module_load] Failed to create module ${args.name}:`, error);
            throw error;
          }
          
          // Store the loaded module in session-specific storage
          this.session.modules.set(args.name, loadedModule);
          
          console.log('[SessionToolProvider] Module stored in session:', args.name, 'Session ID:', this.session.id);
          
          // Get the tools from the loaded module
          const tools = loadedModule.getTools ? (await loadedModule.getTools()) : [];
          const toolDefinitions = [];
          
          for (const tool of tools) {
            if (tool.getAllToolDescriptions) {
              const allDescs = tool.getAllToolDescriptions();
              if (Array.isArray(allDescs)) {
                for (const desc of allDescs) {
                  toolDefinitions.push({
                    name: desc.function.name,
                    description: desc.function.description,
                    inputSchema: desc.function.parameters
                  });
                }
              }
            } else if (tool.getToolDescription) {
              const desc = tool.getToolDescription();
              if (desc && desc.function) {
                toolDefinitions.push({
                  name: desc.function.name,
                  description: desc.function.description,
                  inputSchema: desc.function.parameters
                });
              }
            }
          }
          
          const result = {
            success: true,
            message: `Module ${args.name} loaded successfully`,
            module: args.name,
            toolsLoaded: toolDefinitions,  // Now sending full definitions, not just names
            toolCount: toolDefinitions.length
          };
          
          return result;
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
      
      if (toolName === 'module_list') {
        const loadedModules = Array.from(this.session.modules.keys());
        console.log('[SessionToolProvider] Session loaded modules:', loadedModules);
        
        const result = {
          success: true,
          modules: {
            loaded: loadedModules, // Session-specific loaded modules
            available: ['file', 'serper', 'calculator', 'github', 'json'] // available modules
          }
        };
        
        return result;
      }
      
      if (toolName === 'module_unload') {
        if (!args.name) {
          return {
            success: false,
            error: "Module name is required"
          };
        }
        
        // Remove module from session storage
        const wasLoaded = this.session.modules.has(args.name);
        if (wasLoaded) {
          this.session.modules.delete(args.name);
          console.log('[SessionToolProvider] Module unloaded from session:', args.name, 'Session ID:', this.session.id);
          
          const result = {
            success: true,
            message: `Module ${args.name} unloaded successfully`,
            module: args.name
          };
          
          return result;
        } else {
          return {
            success: false,
            error: `Module ${args.name} was not loaded in this session`
          };
        }
      }
      
      if (toolName === 'module_tools') {
        if (!args.module) {
          return {
            success: false,
            error: "Module name is required"
          };
        }
        
        try {
          // Get tools from the specific module in session storage
          const moduleTools = [];
          
          console.log('[SessionToolProvider] Looking for tools in module:', args.module);
          console.log('[SessionToolProvider] Session modules available:', Array.from(this.session.modules.keys()));
          
          // Check if the requested module is loaded in this session
          const moduleInstance = this.session.modules.get(args.module);
          if (moduleInstance && typeof moduleInstance.getTools === 'function') {
            const tools = await moduleInstance.getTools();
            
            for (const tool of tools) {
              if (tool.getAllToolDescriptions) {
                const allDescs = tool.getAllToolDescriptions();
                if (Array.isArray(allDescs)) {
                  for (const desc of allDescs) {
                    moduleTools.push({
                      name: desc.function.name,
                      description: desc.function.description,
                      parameters: desc.function.parameters
                    });
                  }
                }
              } else if (tool.getToolDescription) {
                const desc = tool.getToolDescription();
                if (desc && desc.function) {
                  moduleTools.push({
                    name: desc.function.name,
                    description: desc.function.description,
                    parameters: desc.function.parameters
                  });
                }
              }
            }
          } else {
            return {
              success: false,
              error: `Module ${args.module} is not loaded in this session`
            };
          }
          
          const result = {
            success: true,
            module: args.module,
            tools: moduleTools,
            count: moduleTools.length
          };
          
          return result;
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      }
      
      // Handle context management tools
      if (this.session && this.session.context) {
        const contextToolNames = ['context_add', 'context_get', 'context_list'];
        if (contextToolNames.includes(toolName)) {
          console.log('[SessionToolProvider] Executing context tool:', toolName);
          try {
            // Execute the context tool directly
            const result = await this.session.context.executeContextTool(toolName, args);
            return {
              success: true,
              result: result
            };
          } catch (error) {
            console.error('[SessionToolProvider] Context tool execution failed:', error);
            return {
              success: false,
              error: error.message
            };
          }
        }
      }
      
      // Handle regular module tools from session-specific modules
      if (!this.session || !this.session.modules) {
        return {
          success: false,
          error: "Session modules not available"
        };
      }
      
      console.log('[SessionToolProvider] Looking for tool:', toolName, 'in session modules:', this.session.modules.size);
      
      // Find the tool that provides this function in session-specific modules
      for (const [moduleName, moduleInstance] of this.session.modules) {
        if (moduleInstance && typeof moduleInstance.getTools === 'function') {
          const tools = await moduleInstance.getTools();
          
          for (const tool of tools) {
            let canExecute = false;
            
            // Check multi-function tools
            if (tool.getAllToolDescriptions) {
              const allDescs = tool.getAllToolDescriptions();
              if (Array.isArray(allDescs)) {
                canExecute = allDescs.some(desc => desc.function.name === toolName);
              }
            } else if (tool.getToolDescription) {
              const desc = tool.getToolDescription();
              canExecute = desc && desc.function && desc.function.name === toolName;
            }
            
            if (canExecute) {
              console.log('[SessionToolProvider] Found tool', toolName, 'in module', moduleName);
              
              // Execute using Legion tool format
              // Multi-function tools like FileOperationsTool need invoke() with toolCall format
              // Single-function tools need run() or execute() with parsed args
              let result;
              
              if (typeof tool.invoke === 'function') {
                // Multi-function tool - use invoke with proper toolCall format
                const toolCall = {
                  id: `aiur-${Date.now()}`,
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: JSON.stringify(args)
                  }
                };
                result = await tool.invoke(toolCall);
              } else if (typeof tool.run === 'function') {
                // Single-function tool with run method - pass args directly
                result = await tool.run(args);
              } else if (typeof tool.execute === 'function') {
                // Single-function tool with execute method - pass args directly
                result = await tool.execute(args);
              } else {
                throw new Error(`Tool ${toolName} does not have invoke(), run() or execute() method`);
              }
              
              // Return raw result - UI will handle formatting
              return result;
            }
          }
        }
      }
      
      // Tool not found
      return {
        success: false,
        error: `Tool not found: ${toolName}`
      };
      
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
    this.server = config.server; // Parent reference to AiurServer
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
    
    // Create session-specific context manager (sessions need their own context)
    const contextManager = new ContextManager(handleRegistry, handleResolver);
    
    // Create session-specific module storage
    const sessionModules = new Map(); // Map of moduleName -> module instance
    
    // Create session object first (needed for circular reference with toolProvider)
    const session = {
      id: sessionId,
      created: now,
      lastAccessed: now,
      handles: handleRegistry,
      handleResolver: handleResolver,
      context: contextManager,
      toolProvider: null, // Will be set after creation
      toolRegistry: toolRegistry,
      modules: sessionModules, // Session-specific module storage
      metadata: {
        requestCount: 0,
        toolCalls: 0,
        errors: 0
      }
    };
    
    // Create tool provider with reference to SessionManager and specific session
    const toolProvider = new SessionToolProvider(this, session);
    session.toolProvider = toolProvider;
    
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
    
    // Clear session modules
    if (session.modules) {
      session.modules.clear();
    }
    
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