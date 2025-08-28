import { MessageProtocol } from './MessageProtocol.js';

/**
 * WebSocket Protocol handler for Cerebrate
 * Manages message serialization, validation, and formatting for WebSocket communication
 */
export class WebSocketProtocol {
  
  // Protocol configuration constants
  static PROTOCOL_VERSION = '1.0.0';
  static MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
  static SUPPORTED_MESSAGE_TYPES = ['command', 'response', 'event', 'error'];

  /**
   * Serialize message object to JSON string for WebSocket transmission
   * @param {Object} message - Message object to serialize
   * @returns {string} - JSON string representation
   * @throws {Error} - If serialization fails
   */
  static serializeMessage(message) {
    try {
      return JSON.stringify(message);
    } catch (error) {
      throw new Error(`Message serialization failed: ${error.message}`);
    }
  }

  /**
   * Deserialize JSON string to message object
   * @param {string} messageString - JSON string to deserialize
   * @returns {Object} - Parsed message object
   * @throws {Error} - If deserialization fails
   */
  static deserializeMessage(messageString) {
    try {
      return JSON.parse(messageString);
    } catch (error) {
      throw new Error(`Message deserialization failed: ${error.message}`);
    }
  }

  /**
   * Validate command message structure
   * @param {Object} message - Command message to validate
   * @returns {boolean} - True if valid command message
   */
  static validateCommandMessage(message) {
    // First validate base message structure
    if (!MessageProtocol.validateMessage(message)) {
      return false;
    }

    // Check message type is command
    if (message.type !== MessageProtocol.MESSAGE_TYPES.COMMAND) {
      return false;
    }

    // Validate command payload
    return MessageProtocol.validateCommandPayload(message.payload);
  }

  /**
   * Validate error message structure
   * @param {Object} message - Error message to validate
   * @returns {boolean} - True if valid error message
   */
  static validateErrorMessage(message) {
    // First validate base message structure
    if (!MessageProtocol.validateMessage(message)) {
      return false;
    }

    // Check message type is error
    if (message.type !== MessageProtocol.MESSAGE_TYPES.ERROR) {
      return false;
    }

    // Validate error payload
    return MessageProtocol.validateErrorPayload(message.payload);
  }

  /**
   * Format success response message
   * @param {string} commandId - Original command ID
   * @param {string} command - Original command name
   * @param {Object} data - Response data
   * @param {Object} metadata - Response metadata
   * @param {string} session - Session ID
   * @returns {Object} - Formatted response message
   */
  static formatSuccessResponse(commandId, command, data, metadata, session) {
    const payload = {
      status: 'success',
      command: command
    };

    if (data) {
      payload.data = data;
    }

    if (metadata) {
      payload.metadata = metadata;
    }

    const response = MessageProtocol.createMessage(
      MessageProtocol.MESSAGE_TYPES.RESPONSE,
      payload,
      session
    );

    // Use the original command ID for correlation
    response.id = commandId;
    
    return response;
  }

  /**
   * Format error response message
   * @param {string} commandId - Original command ID
   * @param {string} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @param {Object} details - Error details
   * @param {Array} suggestions - Error suggestions
   * @param {string} session - Session ID
   * @returns {Object} - Formatted error message
   */
  static formatErrorResponse(commandId, errorCode, errorMessage, details, suggestions, session) {
    const payload = {
      error_code: errorCode,
      error_message: errorMessage
    };

    if (details) {
      payload.details = details;
    }

    if (suggestions) {
      payload.suggestions = suggestions;
    }

    const errorResponse = MessageProtocol.createMessage(
      MessageProtocol.MESSAGE_TYPES.ERROR,
      payload,
      session
    );

    // Use the original command ID for correlation
    errorResponse.id = commandId;

    return errorResponse;
  }

  /**
   * Format progress event message
   * @param {Object} progressData - Progress data with command_id and progress info
   * @param {string} session - Session ID
   * @returns {Object} - Formatted progress event message
   */
  static formatProgressEvent(progressData, session) {
    const payload = {
      event_type: 'progress_update',
      command_id: progressData.command_id,
      progress: progressData.progress
    };

    return MessageProtocol.createMessage(
      MessageProtocol.MESSAGE_TYPES.EVENT,
      payload,
      session
    );
  }

  /**
   * Format agent suggestion event message
   * @param {Object} suggestion - Suggestion data
   * @param {string} session - Session ID
   * @returns {Object} - Formatted suggestion event message
   */
  static formatSuggestionEvent(suggestion, session) {
    const payload = {
      event_type: 'agent_suggestion',
      suggestion: suggestion
    };

    return MessageProtocol.createMessage(
      MessageProtocol.MESSAGE_TYPES.EVENT,
      payload,
      session
    );
  }

  /**
   * Calculate message size in bytes
   * @param {Object} message - Message to calculate size for
   * @returns {number} - Message size in bytes
   */
  static calculateMessageSize(message) {
    return JSON.stringify(message).length;
  }

  /**
   * Validate message size is within limits
   * @param {Object} message - Message to validate size
   * @returns {boolean} - True if within size limits
   */
  static validateMessageSize(message) {
    const size = this.calculateMessageSize(message);
    return size <= this.MAX_MESSAGE_SIZE;
  }

  /**
   * Create a properly formatted command message
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {string} session - Session ID
   * @returns {Object} - Formatted command message
   */
  static createCommandMessage(command, parameters, session) {
    return MessageProtocol.createCommandMessage(command, parameters, session);
  }

  /**
   * Create a ping command message for keep-alive
   * @param {string} session - Session ID
   * @returns {Object} - Ping command message
   */
  static createPingMessage(session) {
    return this.createCommandMessage('ping', null, session);
  }

  /**
   * Create a pong response message
   * @param {string} commandId - Original ping command ID
   * @param {string} session - Session ID
   * @returns {Object} - Pong response message
   */
  static createPongMessage(commandId, session) {
    const serverTime = MessageProtocol.generateTimestamp();
    return this.formatSuccessResponse(
      commandId,
      'ping',
      { status: 'pong', server_time: serverTime },
      { execution_time: 0 },
      session
    );
  }

  /**
   * Validate complete WebSocket message for transmission
   * @param {Object} message - Message to validate
   * @returns {Object} - Validation result with isValid and errors
   */
  static validateWebSocketMessage(message) {
    const result = {
      isValid: true,
      errors: []
    };

    // Check base message structure
    if (!MessageProtocol.validateMessage(message)) {
      result.isValid = false;
      result.errors.push('Invalid base message structure');
    }

    // Check message size
    if (!this.validateMessageSize(message)) {
      result.isValid = false;
      result.errors.push(`Message size exceeds limit of ${this.MAX_MESSAGE_SIZE} bytes`);
    }

    // Check message type specific validation
    switch (message.type) {
      case MessageProtocol.MESSAGE_TYPES.COMMAND:
        if (!this.validateCommandMessage(message)) {
          result.isValid = false;
          result.errors.push('Invalid command message structure');
        }
        break;
      
      case MessageProtocol.MESSAGE_TYPES.ERROR:
        if (!this.validateErrorMessage(message)) {
          result.isValid = false;
          result.errors.push('Invalid error message structure');
        }
        break;
      
      case MessageProtocol.MESSAGE_TYPES.RESPONSE:
        if (!MessageProtocol.validateResponsePayload(message.payload)) {
          result.isValid = false;
          result.errors.push('Invalid response message structure');
        }
        break;
      
      case MessageProtocol.MESSAGE_TYPES.EVENT:
        if (!MessageProtocol.validateEventPayload(message.payload)) {
          result.isValid = false;
          result.errors.push('Invalid event message structure');
        }
        break;
    }

    return result;
  }

  /**
   * Sanitize message for safe transmission
   * @param {Object} message - Message to sanitize
   * @returns {Object} - Sanitized message
   */
  static sanitizeMessage(message) {
    // Create a deep copy to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(message));

    // Remove any potentially dangerous properties
    delete sanitized.__proto__;
    delete sanitized.constructor;

    // Ensure required fields are strings where expected
    if (sanitized.id && typeof sanitized.id !== 'string') {
      sanitized.id = String(sanitized.id);
    }

    if (sanitized.type && typeof sanitized.type !== 'string') {
      sanitized.type = String(sanitized.type);
    }

    if (sanitized.session && typeof sanitized.session !== 'string') {
      sanitized.session = String(sanitized.session);
    }

    return sanitized;
  }
}