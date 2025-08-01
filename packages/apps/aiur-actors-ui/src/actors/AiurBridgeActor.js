/**
 * AiurBridgeActor - Bridge between UI and Aiur server
 * Handles communication with module loader, tool registry, and session management
 */
export class AiurBridgeActor {
  constructor(dependencies = {}) {
    this.isActor = true;
    this.moduleLoader = dependencies.moduleLoader;
    this.toolRegistry = dependencies.toolRegistry;
    this.channel = dependencies.channel;
    
    // Session management
    this.sessions = new Map();
    this.activeSessionId = null;
    
    // Message handlers
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
    
    // Request tracking for async operations
    this.pendingRequests = new Map();
  }

  /**
   * Setup message handlers for different message types
   */
  setupMessageHandlers() {
    // Tool-related handlers
    this.messageHandlers.set('tools.list', this.handleToolsList.bind(this));
    this.messageHandlers.set('tool.execute', this.handleToolExecute.bind(this));
    this.messageHandlers.set('tool.cancel', this.handleToolCancel.bind(this));
    
    // Module-related handlers
    this.messageHandlers.set('modules.list', this.handleModulesList.bind(this));
    this.messageHandlers.set('module.load', this.handleModuleLoad.bind(this));
    this.messageHandlers.set('module.reload', this.handleModuleReload.bind(this));
    this.messageHandlers.set('module.unload', this.handleModuleUnload.bind(this));
    
    // Session-related handlers
    this.messageHandlers.set('session.create', this.handleSessionCreate.bind(this));
    this.messageHandlers.set('session.switch', this.handleSessionSwitch.bind(this));
    this.messageHandlers.set('session.delete', this.handleSessionDelete.bind(this));
    this.messageHandlers.set('sessions.list', this.handleSessionsList.bind(this));
    
    // Variable-related handlers
    this.messageHandlers.set('variables.get', this.handleVariablesGet.bind(this));
    this.messageHandlers.set('variables.set', this.handleVariablesSet.bind(this));
    this.messageHandlers.set('variables.delete', this.handleVariablesDelete.bind(this));
    this.messageHandlers.set('variables.bulk', this.handleVariablesBulk.bind(this));
    
    // System handlers
    this.messageHandlers.set('system.info', this.handleSystemInfo.bind(this));
    this.messageHandlers.set('system.health', this.handleSystemHealth.bind(this));
  }

  /**
   * Receive and process messages
   * @param {Object} message - Incoming message
   * @returns {Object|Promise<Object>} Response message
   */
  receive(message) {
    // Validate message
    const validation = this.validateMessage(message);
    if (!validation.valid) {
      return this.createErrorResponse(message, validation.error);
    }
    
    // Get handler for message type
    const handler = this.messageHandlers.get(message.type);
    if (!handler) {
      console.warn(`Unhandled message type: ${message.type}`);
      return this.createErrorResponse(message, `Unknown message type: ${message.type}`);
    }
    
    // Execute handler with error handling
    try {
      const result = handler(message);
      
      // Handle async results
      if (result instanceof Promise) {
        return result.catch(error => 
          this.createErrorResponse(message, error.message)
        );
      }
      
      return result;
    } catch (error) {
      console.error(`Error handling message ${message.type}:`, error);
      return this.createErrorResponse(message, error.message);
    }
  }

  // Tool Handlers

  async handleToolsList(message) {
    if (!this.toolRegistry) {
      return this.createErrorResponse(message, 'Tool registry not available');
    }
    
    const tools = await this.toolRegistry.getAllTools();
    
    return {
      type: 'tools.list.response',
      requestId: message.requestId,
      tools: tools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        category: tool.category,
        parameters: tool.parameters || []
      }))
    };
  }

  async handleToolExecute(message) {
    if (!this.toolRegistry) {
      return this.createErrorResponse(message, 'Tool registry not available');
    }
    
    const { toolId, params = {}, context = {} } = message;
    
    // Add session context
    const enhancedContext = {
      ...context,
      sessionId: this.activeSessionId,
      session: this.getActiveSession(),
      requestId: message.requestId,
      onProgress: (progress) => {
        this.broadcast({
          type: 'tool.progress',
          requestId: message.requestId,
          toolId,
          progress
        });
      },
      onPartialResult: (result) => {
        this.broadcast({
          type: 'tool.partial',
          requestId: message.requestId,
          toolId,
          result
        });
      }
    };
    
    try {
      // Store pending request
      this.pendingRequests.set(message.requestId, {
        type: 'tool.execute',
        toolId,
        startTime: Date.now()
      });
      
      const result = await this.toolRegistry.executeTool(toolId, params, enhancedContext);
      
      // Remove from pending
      this.pendingRequests.delete(message.requestId);
      
      return {
        type: 'tool.execute.response',
        requestId: message.requestId,
        success: true,
        result,
        duration: Date.now() - enhancedContext.startTime
      };
    } catch (error) {
      this.pendingRequests.delete(message.requestId);
      
      return {
        type: 'tool.execute.response',
        requestId: message.requestId,
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }

  async handleToolCancel(message) {
    const { requestId } = message;
    const pending = this.pendingRequests.get(requestId);
    
    if (!pending || pending.type !== 'tool.execute') {
      return {
        type: 'tool.cancel.response',
        requestId: message.requestId,
        success: false,
        error: 'No pending tool execution found'
      };
    }
    
    // Attempt to cancel through registry
    if (this.toolRegistry && this.toolRegistry.cancelExecution) {
      const cancelled = await this.toolRegistry.cancelExecution(requestId);
      
      if (cancelled) {
        this.pendingRequests.delete(requestId);
      }
      
      return {
        type: 'tool.cancel.response',
        requestId: message.requestId,
        success: cancelled
      };
    }
    
    return {
      type: 'tool.cancel.response',
      requestId: message.requestId,
      success: false,
      error: 'Tool cancellation not supported'
    };
  }

  // Module Handlers

  async handleModulesList(message) {
    if (!this.moduleLoader) {
      return this.createErrorResponse(message, 'Module loader not available');
    }
    
    const modules = await this.moduleLoader.getLoadedModules();
    
    return {
      type: 'modules.list.response',
      requestId: message.requestId,
      modules: modules.map(module => ({
        name: module.name,
        path: module.path,
        version: module.version,
        tools: module.tools || [],
        loaded: module.loaded !== false
      }))
    };
  }

  async handleModuleLoad(message) {
    if (!this.moduleLoader) {
      return this.createErrorResponse(message, 'Module loader not available');
    }
    
    const { modulePath, options = {} } = message;
    
    try {
      const module = await this.moduleLoader.loadModule(modulePath, options);
      
      // Broadcast module loaded event
      this.broadcast({
        type: 'module.loaded',
        module: {
          name: module.name,
          path: modulePath,
          tools: module.tools || []
        }
      });
      
      return {
        type: 'module.load.response',
        requestId: message.requestId,
        success: true,
        module
      };
    } catch (error) {
      return {
        type: 'module.load.response',
        requestId: message.requestId,
        success: false,
        error: error.message
      };
    }
  }

  async handleModuleReload(message) {
    if (!this.moduleLoader) {
      return this.createErrorResponse(message, 'Module loader not available');
    }
    
    const { moduleName } = message;
    
    try {
      await this.moduleLoader.reloadModule(moduleName);
      
      return {
        type: 'module.reload.response',
        requestId: message.requestId,
        success: true
      };
    } catch (error) {
      return {
        type: 'module.reload.response',
        requestId: message.requestId,
        success: false,
        error: error.message
      };
    }
  }

  async handleModuleUnload(message) {
    if (!this.moduleLoader) {
      return this.createErrorResponse(message, 'Module loader not available');
    }
    
    const { moduleName } = message;
    
    try {
      await this.moduleLoader.unloadModule(moduleName);
      
      // Broadcast module unloaded event
      this.broadcast({
        type: 'module.unloaded',
        moduleName
      });
      
      return {
        type: 'module.unload.response',
        requestId: message.requestId,
        success: true
      };
    } catch (error) {
      return {
        type: 'module.unload.response',
        requestId: message.requestId,
        success: false,
        error: error.message
      };
    }
  }

  // Session Handlers

  handleSessionCreate(message) {
    const { name, options = {} } = message;
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      id: sessionId,
      name: name || `Session ${this.sessions.size + 1}`,
      variables: new Map(),
      history: [],
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      commandCount: 0,
      ...options
    };
    
    this.sessions.set(sessionId, session);
    
    // Auto-activate first session
    if (this.sessions.size === 1) {
      this.activeSessionId = sessionId;
    }
    
    // Broadcast session created event
    this.broadcast({
      type: 'session.created',
      session: this.serializeSession(session)
    });
    
    return {
      type: 'session.create.response',
      requestId: message.requestId,
      session: this.serializeSession(session)
    };
  }

  handleSessionSwitch(message) {
    const { sessionId } = message;
    
    if (!this.sessions.has(sessionId)) {
      return {
        type: 'session.switch.response',
        requestId: message.requestId,
        success: false,
        error: 'Session not found'
      };
    }
    
    this.activeSessionId = sessionId;
    const session = this.sessions.get(sessionId);
    session.lastActivity = new Date().toISOString();
    
    // Broadcast session switched event
    this.broadcast({
      type: 'session.switched',
      sessionId,
      session: this.serializeSession(session)
    });
    
    return {
      type: 'session.switch.response',
      requestId: message.requestId,
      success: true,
      sessionId,
      session: this.serializeSession(session)
    };
  }

  handleSessionDelete(message) {
    const { sessionId } = message;
    
    if (!this.sessions.has(sessionId)) {
      return {
        type: 'session.delete.response',
        requestId: message.requestId,
        success: false,
        error: 'Session not found'
      };
    }
    
    this.sessions.delete(sessionId);
    
    // Clear active session if deleted
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
      
      // Auto-activate another session if available
      if (this.sessions.size > 0) {
        this.activeSessionId = this.sessions.keys().next().value;
      }
    }
    
    // Broadcast session deleted event
    this.broadcast({
      type: 'session.deleted',
      sessionId
    });
    
    return {
      type: 'session.delete.response',
      requestId: message.requestId,
      success: true
    };
  }

  handleSessionsList(message) {
    const sessions = Array.from(this.sessions.values()).map(session => 
      this.serializeSession(session)
    );
    
    return {
      type: 'sessions.list.response',
      requestId: message.requestId,
      sessions,
      activeSessionId: this.activeSessionId
    };
  }

  // Variable Handlers

  handleVariablesGet(message) {
    const session = this.getActiveSession();
    
    if (!session) {
      return {
        type: 'variables.get.response',
        requestId: message.requestId,
        variables: {}
      };
    }
    
    return {
      type: 'variables.get.response',
      requestId: message.requestId,
      variables: Object.fromEntries(session.variables)
    };
  }

  handleVariablesSet(message) {
    const session = this.getActiveSession();
    
    if (!session) {
      return {
        type: 'variables.set.response',
        requestId: message.requestId,
        success: false,
        error: 'No active session'
      };
    }
    
    const { name, value, type = 'string' } = message;
    
    // Validate and coerce type
    const coercedValue = this.coerceVariableType(value, type);
    
    session.variables.set(name, {
      value: coercedValue,
      type,
      updatedAt: new Date().toISOString()
    });
    
    // Broadcast variable updated event
    this.broadcast({
      type: 'variable.updated',
      sessionId: this.activeSessionId,
      name,
      value: coercedValue,
      type
    });
    
    return {
      type: 'variables.set.response',
      requestId: message.requestId,
      success: true
    };
  }

  handleVariablesDelete(message) {
    const session = this.getActiveSession();
    
    if (!session) {
      return {
        type: 'variables.delete.response',
        requestId: message.requestId,
        success: false,
        error: 'No active session'
      };
    }
    
    const { name } = message;
    const deleted = session.variables.delete(name);
    
    if (deleted) {
      // Broadcast variable deleted event
      this.broadcast({
        type: 'variable.deleted',
        sessionId: this.activeSessionId,
        name
      });
    }
    
    return {
      type: 'variables.delete.response',
      requestId: message.requestId,
      success: deleted
    };
  }

  handleVariablesBulk(message) {
    const session = this.getActiveSession();
    
    if (!session) {
      return {
        type: 'variables.bulk.response',
        requestId: message.requestId,
        success: false,
        error: 'No active session'
      };
    }
    
    const { operation, variables } = message;
    
    switch (operation) {
      case 'set':
        for (const [name, data] of Object.entries(variables)) {
          const value = typeof data === 'object' ? data.value : data;
          const type = typeof data === 'object' ? data.type : 'string';
          
          session.variables.set(name, {
            value: this.coerceVariableType(value, type),
            type,
            updatedAt: new Date().toISOString()
          });
        }
        break;
        
      case 'delete':
        for (const name of variables) {
          session.variables.delete(name);
        }
        break;
        
      case 'clear':
        session.variables.clear();
        break;
        
      default:
        return {
          type: 'variables.bulk.response',
          requestId: message.requestId,
          success: false,
          error: `Unknown operation: ${operation}`
        };
    }
    
    return {
      type: 'variables.bulk.response',
      requestId: message.requestId,
      success: true
    };
  }

  // System Handlers

  handleSystemInfo(message) {
    return {
      type: 'system.info.response',
      requestId: message.requestId,
      info: {
        version: '1.0.0',
        sessions: this.sessions.size,
        activeSession: this.activeSessionId,
        pendingRequests: this.pendingRequests.size,
        moduleLoaderAvailable: !!this.moduleLoader,
        toolRegistryAvailable: !!this.toolRegistry
      }
    };
  }

  handleSystemHealth(message) {
    const health = {
      status: 'healthy',
      checks: {
        sessions: this.sessions.size > 0 ? 'ok' : 'warning',
        moduleLoader: this.moduleLoader ? 'ok' : 'error',
        toolRegistry: this.toolRegistry ? 'ok' : 'error',
        channel: this.channel ? 'ok' : 'warning'
      }
    };
    
    // Determine overall status
    const hasError = Object.values(health.checks).includes('error');
    const hasWarning = Object.values(health.checks).includes('warning');
    
    if (hasError) {
      health.status = 'unhealthy';
    } else if (hasWarning) {
      health.status = 'degraded';
    }
    
    return {
      type: 'system.health.response',
      requestId: message.requestId,
      health
    };
  }

  // Helper Methods

  /**
   * Get the active session
   * @returns {Object|null} Active session or null
   */
  getActiveSession() {
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * Serialize session for transmission
   * @param {Object} session - Session to serialize
   * @returns {Object} Serialized session
   */
  serializeSession(session) {
    return {
      id: session.id,
      name: session.name,
      variables: session.variables ? Object.fromEntries(
        Array.from(session.variables.entries()).map(([key, value]) => [
          key,
          typeof value === 'object' ? value : { value, type: 'string' }
        ])
      ) : {},
      history: session.history || [],
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      commandCount: session.commandCount || 0
    };
  }

  /**
   * Validate incoming message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Invalid message format' };
    }
    
    if (!message.type) {
      return { valid: false, error: 'Message type required' };
    }
    
    if (!message.requestId) {
      return { valid: false, error: 'Request ID required' };
    }
    
    return { valid: true };
  }

  /**
   * Create error response
   * @param {Object} message - Original message
   * @param {string} error - Error message
   * @returns {Object} Error response
   */
  createErrorResponse(message, error) {
    return {
      type: `${message?.type || 'unknown'}.error`,
      requestId: message?.requestId || 'unknown',
      error,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Broadcast message through channel
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    if (this.channel && this.channel.send) {
      try {
        this.channel.send(message);
      } catch (error) {
        console.error('Failed to broadcast message:', error);
      }
    }
  }

  /**
   * Coerce variable value to specified type
   * @param {*} value - Value to coerce
   * @param {string} type - Target type
   * @returns {*} Coerced value
   */
  coerceVariableType(value, type) {
    switch (type) {
      case 'string':
        return String(value);
        
      case 'number':
        return Number(value);
        
      case 'boolean':
        return value === 'true' || value === true;
        
      case 'array':
        if (Array.isArray(value)) return value;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return [value];
          }
        }
        return [value];
        
      case 'object':
        if (typeof value === 'object' && value !== null) return value;
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return { value };
          }
        }
        return { value };
        
      default:
        return value;
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Clear sessions
    this.sessions.clear();
    this.activeSessionId = null;
    
    // Clear handlers
    this.messageHandlers.clear();
    
    // Close channel if needed
    if (this.channel && this.channel.close) {
      this.channel.close();
    }
  }
}