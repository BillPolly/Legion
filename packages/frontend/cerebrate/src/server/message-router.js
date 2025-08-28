import { MessageProtocol } from '../shared/protocol/MessageProtocol.js';
import { WebSocketProtocol } from '../shared/protocol/WebSocketProtocol.js';

/**
 * Message Router for Cerebrate WebSocket Server
 * Routes messages between clients, agents, and internal systems
 */
export class MessageRouter {

  constructor(options = {}) {
    this.config = {
      maxQueueSize: options.maxQueueSize || 100,
      enableRetry: options.enableRetry || false,
      maxRetries: options.maxRetries || 3,
      retryDelayMs: options.retryDelayMs || 1000,
      maxMessageSize: options.maxMessageSize || 1024 * 1024, // 1MB
      ...options
    };

    this.agentController = options.agentController;
    this.connectionManager = options.connectionManager;

    // Message queue for when agent is busy
    this.messageQueue = [];
    this.isProcessingQueue = false;

    // Custom command handlers
    this.customHandlers = new Map();

    // Middleware stack
    this.middleware = [];

    // Statistics tracking
    this.statistics = {
      total_messages_routed: 0,
      total_commands_processed: 0,
      total_responses_sent: 0,
      total_events_broadcast: 0,
      total_errors: 0,
      total_processing_time: 0,
      average_processing_time: 0
    };
  }

  /**
   * Route incoming message based on type
   * @param {Object} message - Message to route
   * @param {string} sessionId - Source session ID
   */
  async routeMessage(message, sessionId) {
    const startTime = Date.now();
    this.statistics.total_messages_routed++;

    try {
      // Validate message
      if (!this.validateMessage(message)) {
        await this.sendErrorResponse(sessionId, 'INVALID_MESSAGE', 'Invalid message structure');
        this.statistics.total_errors++;
        return;
      }

      // Apply middleware
      const processedMessage = await this.applyMiddleware(message);

      // Route based on message type
      if (this.isCommandMessage(processedMessage)) {
        await this.routeCommand(processedMessage, sessionId);
      } else if (this.isResponseMessage(processedMessage)) {
        this.routeResponse(processedMessage);
      } else if (this.isEventMessage(processedMessage)) {
        this.routeEvent(processedMessage, sessionId);
      } else {
        await this.sendErrorResponse(sessionId, 'UNSUPPORTED_MESSAGE_TYPE', 'Unsupported message type');
        this.statistics.total_errors++;
      }

    } catch (error) {
      console.error('Error routing message:', error);
      try {
        await this.sendErrorResponse(sessionId, 'ROUTING_ERROR', error.message);
      } catch (sendError) {
        // Ignore send errors during error handling
      }
      this.statistics.total_errors++;
    } finally {
      // Update timing statistics
      const processingTime = Date.now() - startTime;
      this.statistics.total_processing_time += processingTime;
      
      // Only update average if we have routed messages (avoid division by zero)
      if (this.statistics.total_messages_routed > 0) {
        this.statistics.average_processing_time = 
          this.statistics.total_processing_time / this.statistics.total_messages_routed;
      }
    }
  }

  /**
   * Route command message to agent
   * @param {Object} message - Command message
   * @param {string} sessionId - Source session ID
   * @private
   */
  async routeCommand(message, sessionId) {
    // Validate command structure
    if (!message.payload || !message.payload.command) {
      await this.sendErrorResponse(sessionId, 'INVALID_COMMAND_MESSAGE', 'Missing command field');
      this.statistics.total_errors++;
      return;
    }

    const { command, parameters } = message.payload;

    // Check for custom handler
    if (this.customHandlers.has(command)) {
      try {
        const result = await this.customHandlers.get(command)(parameters, { sessionId });
        await this.sendSuccessResponse(sessionId, message.id, command, result);
        this.statistics.total_commands_processed++;
        return;
      } catch (error) {
        await this.sendErrorResponse(sessionId, 'CUSTOM_HANDLER_ERROR', error.message);
        this.statistics.total_errors++;
        return;
      }
    }

    // Check if agent is available
    if (!this.agentController.isAvailable()) {
      const status = this.agentController.getStatus();
      if (status.status === 'offline') {
        await this.sendErrorResponse(sessionId, 'AGENT_UNAVAILABLE', 'Agent is not available');
        this.statistics.total_errors++;
        return;
      }

      // Queue message if agent is busy
      if (this.messageQueue.length >= this.config.maxQueueSize) {
        await this.sendErrorResponse(sessionId, 'QUEUE_FULL', 'Command queue is full');
        this.statistics.total_errors++;
        return;
      }

      this.messageQueue.push({ message, sessionId });
      return;
    }

    // Execute command through agent
    await this.executeCommand(message, sessionId);
  }

  /**
   * Execute command through agent controller
   * @param {Object} message - Command message
   * @param {string} sessionId - Source session ID
   * @private
   */
  async executeCommand(message, sessionId) {
    const { command, parameters } = message.payload;

    try {
      const retries = this.config.enableRetry ? this.config.maxRetries : 1;
      let lastError = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await this.agentController.executeCommand(
            command,
            parameters || null,
            { sessionId }
          );

          await this.sendSuccessResponse(sessionId, message.id, command, result.data, result);
          this.statistics.total_commands_processed++;
          return;

        } catch (error) {
          lastError = error;
          if (attempt < retries - 1) {
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, this.config.retryDelayMs));
          }
        }
      }

      // All retries failed
      await this.sendErrorResponse(sessionId, 'AGENT_EXECUTION_ERROR', lastError.message);
      this.statistics.total_errors++;

    } catch (error) {
      await this.sendErrorResponse(sessionId, 'AGENT_EXECUTION_ERROR', error.message);
      this.statistics.total_errors++;
    }
  }

  /**
   * Route response message to client
   * @param {Object} message - Response message
   */
  routeResponse(message) {
    const sessionId = message.session;
    if (!sessionId) {
      console.warn('Response message missing session ID');
      return;
    }

    const connection = this.connectionManager.getConnectionBySession(sessionId);
    if (!connection) {
      console.warn(`No active connection found for session: ${sessionId}`);
      return;
    }

    this.connectionManager.sendToSession(sessionId, message);
    this.statistics.total_responses_sent++;
  }

  /**
   * Route event message
   * @param {Object} message - Event message
   * @param {string} sessionId - Target session ID (optional for broadcast)
   */
  routeEvent(message, sessionId = null) {
    // Validate event message
    if (!message.payload || !message.payload.event_type) {
      console.error('Invalid event message: missing event_type');
      return;
    }

    if (sessionId && sessionId !== 'broadcast') {
      this.connectionManager.sendToSession(sessionId, message);
    } else {
      this.broadcastEvent(message);
    }
    
    this.statistics.total_events_broadcast++;
  }

  /**
   * Broadcast event to all connections
   * @param {Object} message - Event message to broadcast
   */
  broadcastEvent(message) {
    this.connectionManager.broadcast(message);
    this.statistics.total_events_broadcast++;
  }

  /**
   * Process queued messages when agent becomes available
   */
  async processQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.messageQueue.length > 0 && this.agentController.isAvailable()) {
      const { message, sessionId } = this.messageQueue.shift();
      await this.executeCommand(message, sessionId);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Validate message structure and size
   * @param {Object} message - Message to validate
   * @returns {boolean} - True if valid
   */
  validateMessage(message) {
    // Check basic structure using MessageProtocol
    if (!MessageProtocol.validateMessage(message)) {
      return false;
    }

    // Check message size
    const messageSize = JSON.stringify(message).length;
    if (messageSize > this.config.maxMessageSize) {
      return false;
    }

    return true;
  }

  /**
   * Check if message is a command
   * @param {Object} message - Message to check
   * @returns {boolean} - True if command message
   */
  isCommandMessage(message) {
    return message.type === 'command';
  }

  /**
   * Check if message is a response
   * @param {Object} message - Message to check
   * @returns {boolean} - True if response message
   */
  isResponseMessage(message) {
    return message.type === 'response';
  }

  /**
   * Check if message is an event
   * @param {Object} message - Message to check
   * @returns {boolean} - True if event message
   */
  isEventMessage(message) {
    return message.type === 'event';
  }

  /**
   * Send success response to session
   * @param {string} sessionId - Target session
   * @param {string} messageId - Original message ID
   * @param {string} command - Command name
   * @param {*} data - Response data
   * @param {Object} metadata - Additional metadata
   * @private
   */
  async sendSuccessResponse(sessionId, messageId, command, data, metadata = {}) {
    const response = WebSocketProtocol.formatSuccessResponse(
      messageId,
      command,
      data,
      metadata,
      sessionId
    );

    this.connectionManager.sendToSession(sessionId, response);
    this.statistics.total_responses_sent++;
  }

  /**
   * Send error response to session
   * @param {string} sessionId - Target session
   * @param {string} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @private
   */
  async sendErrorResponse(sessionId, errorCode, errorMessage) {
    const errorResponse = WebSocketProtocol.formatErrorResponse(
      null,
      errorCode,
      errorMessage,
      sessionId
    );

    this.connectionManager.sendToSession(sessionId, errorResponse);
    this.statistics.total_responses_sent++;
  }

  /**
   * Register custom command handler
   * @param {string} command - Command name
   * @param {Function} handler - Handler function
   */
  registerCommandHandler(command, handler) {
    this.customHandlers.set(command, handler);
  }

  /**
   * Unregister custom command handler
   * @param {string} command - Command name
   */
  unregisterCommandHandler(command) {
    this.customHandlers.delete(command);
  }

  /**
   * Add middleware to processing pipeline
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Apply middleware to message
   * @param {Object} message - Message to process
   * @returns {Object} - Processed message
   * @private
   */
  async applyMiddleware(message) {
    let processedMessage = message;

    for (const middleware of this.middleware) {
      processedMessage = await new Promise((resolve) => {
        const next = (msg) => resolve(msg);
        middleware(processedMessage, next);
      });
    }

    return processedMessage;
  }

  /**
   * Get current queue length
   * @returns {number} - Queue length
   */
  getQueueLength() {
    return this.messageQueue.length;
  }

  /**
   * Get queue status information
   * @returns {Object} - Queue status
   */
  getQueueStatus() {
    return {
      length: this.messageQueue.length,
      maxSize: this.config.maxQueueSize,
      processing: this.isProcessingQueue
    };
  }

  /**
   * Get routing statistics
   * @returns {Object} - Routing statistics
   */
  getRoutingStatistics() {
    return { ...this.statistics };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.statistics = {
      total_messages_routed: 0,
      total_commands_processed: 0,
      total_responses_sent: 0,
      total_events_broadcast: 0,
      total_errors: 0,
      total_processing_time: 0,
      average_processing_time: 0
    };
  }

  /**
   * Clear message queue
   */
  clearQueue() {
    this.messageQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Destroy message router and cleanup resources
   */
  destroy() {
    this.clearQueue();
    this.customHandlers.clear();
    this.middleware = [];
    this.resetStatistics();
  }
}