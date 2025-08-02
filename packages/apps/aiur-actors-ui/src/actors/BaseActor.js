/**
 * BaseActor - Base class for all actors in the system
 * 
 * Handles all protocol messages with default behaviors.
 * Subclasses can override specific message handlers as needed.
 */
export class BaseActor {
  constructor(name = 'BaseActor') {
    this.isActor = true;
    this.name = name;
    this._space = null;
    this._key = null;
    this._connected = false;
    this.messageHandlers = new Map();
    
    // Register default handlers for all protocol messages
    this.registerDefaultHandlers();
  }

  /**
   * Register default handlers for all protocol message types
   */
  registerDefaultHandlers() {
    // Connection-related messages
    this.registerHandler('connectionStateChanged', this.handleConnectionStateChanged.bind(this));
    this.registerHandler('serverConnected', this.handleServerConnected.bind(this));
    this.registerHandler('sessionCreated', this.handleSessionCreated.bind(this));
    
    // Data messages
    this.registerHandler('toolsList', this.handleToolsList.bind(this));
    this.registerHandler('toolResult', this.handleToolResult.bind(this));
    this.registerHandler('commandResult', this.handleCommandResult.bind(this));
    
    // Error messages
    this.registerHandler('toolError', this.handleToolError.bind(this));
    this.registerHandler('error', this.handleError.bind(this));
    
    // Module-related messages
    this.registerHandler('moduleLoaded', this.handleModuleLoaded.bind(this));
    
    // Generic messages
    this.registerHandler('unknown', this.handleUnknown.bind(this));
  }

  /**
   * Register a message handler
   * @param {string} messageType - Type of message to handle
   * @param {Function} handler - Handler function
   */
  registerHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }

  /**
   * Main receive method - routes messages to appropriate handlers
   * @param {Object} message - Incoming message
   */
  receive(message) {
    const { type, payload, requestId } = message;
    
    // Log receipt of message
    this.logMessage('received', type, payload);
    
    // Try to find a specific handler
    const handler = this.messageHandlers.get(type);
    if (handler) {
      try {
        handler(message);
      } catch (error) {
        console.error(`${this.name}: Error handling message type '${type}':`, error);
      }
    } else {
      // No specific handler - use default behavior
      this.handleDefault(message);
    }
  }

  /**
   * Log message activity
   * @protected
   */
  logMessage(action, type, payload) {
    const payloadInfo = payload ? 
      (typeof payload === 'object' ? 
        Object.keys(payload).join(', ') : 
        String(payload).substring(0, 50)) : 
      'no payload';
    
    console.log(`${this.name}: ${action} '${type}' [${payloadInfo}]`);
  }

  // Default message handlers - can be overridden by subclasses

  /**
   * Handle connection state changes
   * @protected
   */
  handleConnectionStateChanged(message) {
    this._connected = message.payload?.connected || false;
    console.log(`${this.name}: Connection ${this._connected ? 'established' : 'lost'}`);
    this.onConnectionStateChanged(this._connected);
  }

  /**
   * Handle server connected message
   * @protected
   */
  handleServerConnected(message) {
    const { version, capabilities } = message.payload || {};
    console.log(`${this.name}: Server connected - version ${version}, capabilities: ${capabilities?.join(', ')}`);
    this.onServerConnected(message.payload);
  }

  /**
   * Handle session created message
   * @protected
   */
  handleSessionCreated(message) {
    const { sessionId } = message.payload || {};
    console.log(`${this.name}: Session created - ${sessionId}`);
    this.onSessionCreated(sessionId, message.payload);
  }

  /**
   * Handle tools list message
   * @protected
   */
  handleToolsList(message) {
    const tools = message.payload?.tools || [];
    console.log(`${this.name}: Tools list received - ${tools.length} tools`);
    this.onToolsList(tools);
  }

  /**
   * Handle tool result message
   * @protected
   */
  handleToolResult(message) {
    console.log(`${this.name}: Tool result received`);
    this.onToolResult(message.payload?.result, message.requestId);
  }

  /**
   * Handle command result message
   * @protected
   */
  handleCommandResult(message) {
    console.log(`${this.name}: Command result received`);
    this.onCommandResult(message.payload?.result, message.requestId);
  }

  /**
   * Handle tool error message
   * @protected
   */
  handleToolError(message) {
    const error = message.payload?.error;
    console.error(`${this.name}: Tool error - ${error?.message || 'Unknown error'}`);
    this.onToolError(error, message.requestId);
  }

  /**
   * Handle general error message
   * @protected
   */
  handleError(message) {
    const error = message.payload?.error;
    console.error(`${this.name}: Error - ${error?.message || 'Unknown error'}`);
    this.onError(error, message.requestId);
  }

  /**
   * Handle module loaded message
   * @protected
   */
  handleModuleLoaded(message) {
    const { module } = message.payload || {};
    console.log(`${this.name}: Module loaded - ${module?.name || 'unknown'}`);
    this.onModuleLoaded(module);
  }

  /**
   * Handle unknown message type
   * @protected
   */
  handleUnknown(message) {
    console.log(`${this.name}: Unknown message type received`);
    this.onUnknownMessage(message);
  }

  /**
   * Handle default (unregistered) message types
   * @protected
   */
  handleDefault(message) {
    console.log(`${this.name}: No handler for message type '${message.type}'`);
    this.onDefaultMessage(message);
  }

  // Virtual methods for subclasses to override

  /**
   * Called when connection state changes
   * @param {boolean} connected - New connection state
   */
  onConnectionStateChanged(connected) {
    // Override in subclass if needed
  }

  /**
   * Called when server connects
   * @param {Object} serverInfo - Server information
   */
  onServerConnected(serverInfo) {
    // Override in subclass if needed
  }

  /**
   * Called when session is created
   * @param {string} sessionId - Session ID
   * @param {Object} sessionInfo - Full session information
   */
  onSessionCreated(sessionId, sessionInfo) {
    // Override in subclass if needed
  }

  /**
   * Called when tools list is received
   * @param {Array} tools - List of tools
   */
  onToolsList(tools) {
    // Override in subclass if needed
  }

  /**
   * Called when tool result is received
   * @param {*} result - Tool execution result
   * @param {string} requestId - Request ID
   */
  onToolResult(result, requestId) {
    // Override in subclass if needed
  }

  /**
   * Called when command result is received
   * @param {*} result - Command execution result
   * @param {string} requestId - Request ID
   */
  onCommandResult(result, requestId) {
    // Override in subclass if needed
  }

  /**
   * Called when tool error is received
   * @param {Object} error - Error object
   * @param {string} requestId - Request ID
   */
  onToolError(error, requestId) {
    // Override in subclass if needed
  }

  /**
   * Called when general error is received
   * @param {Object} error - Error object
   * @param {string} requestId - Request ID
   */
  onError(error, requestId) {
    // Override in subclass if needed
  }

  /**
   * Called when module is loaded
   * @param {Object} module - Module information
   */
  onModuleLoaded(module) {
    // Override in subclass if needed
  }

  /**
   * Called for unknown message types
   * @param {Object} message - The unknown message
   */
  onUnknownMessage(message) {
    // Override in subclass if needed
  }

  /**
   * Called for unhandled message types
   * @param {Object} message - The unhandled message
   */
  onDefaultMessage(message) {
    // Override in subclass if needed
  }

  // Utility methods

  /**
   * Send message to another actor
   * @param {string} actorKey - Target actor key
   * @param {Object} message - Message to send
   */
  sendToActor(actorKey, message) {
    if (this._space) {
      const actor = this._space.getActor(actorKey);
      if (actor) {
        actor.receive(message);
      } else {
        console.warn(`${this.name}: Target actor '${actorKey}' not found`);
      }
    }
  }

  /**
   * Broadcast message to all actors
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    if (this._space) {
      this._space.actors.forEach((actor, key) => {
        if (key !== this._key) { // Don't send to self
          actor.receive(message);
        }
      });
    }
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this._connected;
  }

  /**
   * Clean up actor
   */
  destroy() {
    this.messageHandlers.clear();
    // Subclasses should override to add their own cleanup
  }
}