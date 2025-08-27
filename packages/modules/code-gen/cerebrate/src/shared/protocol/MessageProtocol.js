import { v4 as uuidv4 } from 'uuid';

/**
 * Message Protocol for Cerebrate WebSocket communication
 * Handles message validation, generation, and formatting
 */
export class MessageProtocol {
  
  // Valid message types
  static MESSAGE_TYPES = {
    COMMAND: 'command',
    RESPONSE: 'response', 
    EVENT: 'event',
    ERROR: 'error'
  };

  // Required fields for base message
  static REQUIRED_FIELDS = ['id', 'type', 'timestamp', 'session', 'payload'];

  /**
   * Validate complete message structure
   * @param {Object} message - Message to validate
   * @returns {boolean} - True if valid
   */
  static validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return false;
    }

    // Check all required fields exist
    for (const field of this.REQUIRED_FIELDS) {
      if (!(field in message)) {
        return false;
      }
    }

    // Validate message type
    if (!Object.values(this.MESSAGE_TYPES).includes(message.type)) {
      return false;
    }

    // Validate timestamp format
    if (!this.validateTimestamp(message.timestamp)) {
      return false;
    }

    // Validate payload is object
    if (!message.payload || typeof message.payload !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Generate unique message ID using UUID v4
   * @returns {string} - Unique message ID
   */
  static generateMessageId() {
    return uuidv4();
  }

  /**
   * Validate ISO 8601 timestamp format
   * @param {string} timestamp - Timestamp to validate
   * @returns {boolean} - True if valid
   */
  static validateTimestamp(timestamp) {
    if (typeof timestamp !== 'string') {
      return false;
    }

    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return isoRegex.test(timestamp) && !isNaN(Date.parse(timestamp));
  }

  /**
   * Generate current timestamp in ISO 8601 format
   * @returns {string} - Current timestamp
   */
  static generateTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Validate command payload structure
   * @param {Object} payload - Command payload to validate
   * @returns {boolean} - True if valid
   */
  static validateCommandPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Command field is required
    if (!payload.command || typeof payload.command !== 'string') {
      return false;
    }

    // Parameters field is optional but must be object if present
    if (payload.parameters && typeof payload.parameters !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Validate response payload structure
   * @param {Object} payload - Response payload to validate
   * @returns {boolean} - True if valid
   */
  static validateResponsePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Status field is required
    if (!payload.status || typeof payload.status !== 'string') {
      return false;
    }

    // Command field is required
    if (!payload.command || typeof payload.command !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Validate error payload structure
   * @param {Object} payload - Error payload to validate
   * @returns {boolean} - True if valid
   */
  static validateErrorPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Error code is required
    if (!payload.error_code || typeof payload.error_code !== 'string') {
      return false;
    }

    // Error message is required
    if (!payload.error_message || typeof payload.error_message !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Validate event payload structure
   * @param {Object} payload - Event payload to validate
   * @returns {boolean} - True if valid
   */
  static validateEventPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    // Event type is required
    if (!payload.event_type || typeof payload.event_type !== 'string') {
      return false;
    }

    return true;
  }

  /**
   * Create a properly formatted message
   * @param {string} type - Message type
   * @param {Object} payload - Message payload
   * @param {string} session - Session ID
   * @returns {Object} - Formatted message
   */
  static createMessage(type, payload, session) {
    return {
      id: this.generateMessageId(),
      type,
      timestamp: this.generateTimestamp(),
      session,
      payload
    };
  }

  /**
   * Create a command message
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {string} session - Session ID
   * @returns {Object} - Command message
   */
  static createCommandMessage(command, parameters, session) {
    const payload = { command };
    if (parameters) {
      payload.parameters = parameters;
    }

    return this.createMessage(this.MESSAGE_TYPES.COMMAND, payload, session);
  }

  /**
   * Create a response message
   * @param {string} status - Response status
   * @param {string} command - Original command
   * @param {Object} data - Response data
   * @param {Object} metadata - Response metadata
   * @param {string} session - Session ID
   * @returns {Object} - Response message
   */
  static createResponseMessage(status, command, data, metadata, session) {
    const payload = { status, command };
    
    if (data) {
      payload.data = data;
    }
    
    if (metadata) {
      payload.metadata = metadata;
    }

    return this.createMessage(this.MESSAGE_TYPES.RESPONSE, payload, session);
  }

  /**
   * Create an error message
   * @param {string} errorCode - Error code
   * @param {string} errorMessage - Error message
   * @param {Object} details - Error details
   * @param {Array} suggestions - Error suggestions
   * @param {string} session - Session ID
   * @returns {Object} - Error message
   */
  static createErrorMessage(errorCode, errorMessage, details, suggestions, session) {
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

    return this.createMessage(this.MESSAGE_TYPES.ERROR, payload, session);
  }

  /**
   * Create an event message
   * @param {string} eventType - Event type
   * @param {Object} eventData - Event data
   * @param {string} session - Session ID
   * @returns {Object} - Event message
   */
  static createEventMessage(eventType, eventData, session) {
    const payload = { event_type: eventType, ...eventData };
    return this.createMessage(this.MESSAGE_TYPES.EVENT, payload, session);
  }
}