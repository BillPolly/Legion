/**
 * ActorMessage - Standardized message format for actor communication
 */

export class ActorMessage {
  constructor(type, payload = {}, metadata = {}) {
    this.type = type;
    this.payload = payload;
    this.metadata = {
      messageId: this._generateMessageId(),
      timestamp: Date.now(),
      ...metadata
    };
    this._validationErrors = [];
  }

  /**
   * Create a new ActorMessage from data
   * @param {Object} data - Message data
   * @returns {ActorMessage} New message instance
   */
  static create(data) {
    if (data.type === undefined) {
      throw new Error('Message type is required');
    }

    // Check for circular references
    try {
      JSON.stringify(data);
    } catch (error) {
      if (error.message.includes('circular')) {
        throw new Error('Cannot serialize circular references');
      }
      throw error;
    }

    // Extract type and metadata
    const { type, timestamp, requestId, messageId, ...payload } = data;
    
    const metadata = {};
    if (timestamp !== undefined) metadata.timestamp = timestamp;
    if (requestId !== undefined) metadata.requestId = requestId;
    if (messageId !== undefined) metadata.messageId = messageId;

    return new ActorMessage(type, payload, metadata);
  }

  /**
   * Deserialize a message from JSON string
   * @param {string} jsonString - JSON string to deserialize
   * @returns {ActorMessage} Deserialized message
   */
  static deserialize(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (error) {
      throw new Error('Invalid JSON in message');
    }

    if (!data.type) {
      const message = new ActorMessage('__missing_type__', {}, {});
      message._validationErrors.push('type is required');
      return message;
    }

    return new ActorMessage(data.type, data.payload || {}, data.metadata || {});
  }

  /**
   * Check if a message type is valid
   * @param {string} type - Message type to validate
   * @returns {boolean} True if valid
   */
  static isValidType(type) {
    if (typeof type !== 'string' || type.trim() === '') {
      return false;
    }

    const validTypes = [
      // Command types
      'execute', 'autocomplete', 'executeTool', 'toolSelected',
      'sessionSelected', 'variableSelected',
      
      // Request types
      'getTools', 'getSessions', 'getVariables', 'createSession',
      'updateSession', 'deleteSession', 'duplicateSession', 'exportSession',
      'loadSession', 'createVariable', 'updateVariable', 'deleteVariable', 
      'duplicateVariable', 'importVariables',
      
      // Response types
      'toolsListResponse', 'toolsListError', 'sessionListResponse', 'sessionListError',
      'variablesListResponse', 'variablesListError', 'sessionCreated', 'sessionCreationError',
      'sessionUpdated', 'sessionUpdateError', 'sessionLoaded', 'sessionLoadError',
      'sessionDeleted', 'sessionDeleteError', 'sessionDuplicated', 'sessionExported',
      'variableCreated', 'variableCreationError', 'variableUpdated', 'variableUpdateError',
      'variableDeleted', 'variableDeleteError', 'variableDuplicated', 'variablesImported',
      'variablesImportError', 'commandResult', 'commandError', 'autocompleteResult',
      'toolExecutionError'
    ];

    return validTypes.includes(type);
  }

  /**
   * Generate a unique message ID
   * @private
   * @returns {string} Unique message ID
   */
  _generateMessageId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the message type
   * @returns {string} Message type
   */
  getType() {
    return this.type;
  }

  /**
   * Get the message payload
   * @returns {Object} Message payload
   */
  getPayload() {
    return this.payload;
  }

  /**
   * Get the message metadata
   * @returns {Object} Message metadata
   */
  getMetadata() {
    return this.metadata;
  }

  /**
   * Serialize the message to JSON string
   * @returns {string} JSON string
   */
  serialize() {
    return JSON.stringify({
      type: this.type,
      payload: this.payload,
      metadata: this.metadata
    });
  }

  /**
   * Validate the message
   * @returns {boolean} True if valid
   */
  isValid() {
    this._validationErrors = [];

    // Check for missing type first
    if (this.type === '__missing_type__') {
      this._validationErrors.push('type is required');
      return false;
    }

    // Check type validity
    if (!ActorMessage.isValidType(this.type)) {
      this._validationErrors.push(`Invalid message type: ${this.type}`);
      return false;
    }

    // Type-specific validation
    this._validateByType();

    return this._validationErrors.length === 0;
  }

  /**
   * Get validation errors
   * @returns {Array<string>} Array of validation error messages
   */
  getValidationErrors() {
    return [...this._validationErrors];
  }

  /**
   * Validate message based on its type
   * @private
   */
  _validateByType() {
    // Only validate payload requirements for messages that actually need them
    // This allows flexibility for basic messages and testing
    switch (this.type) {
      case 'execute':
        if (this.payload.command !== undefined && !this.payload.command) {
          this._validationErrors.push('command cannot be empty for execute messages');
        }
        break;

      case 'executeTool':
        if (this.payload.hasOwnProperty('toolId') && !this.payload.toolId) {
          this._validationErrors.push('toolId cannot be empty for executeTool messages');
        }
        break;

      case 'createSession':
        if (this.payload.hasOwnProperty('sessionData') && !this.payload.sessionData) {
          this._validationErrors.push('sessionData cannot be empty for createSession messages');
        }
        break;

      case 'updateSession':
      case 'deleteSession':
      case 'duplicateSession':
      case 'exportSession':
      case 'loadSession':
        if (this.payload.hasOwnProperty('sessionId') && !this.payload.sessionId) {
          this._validationErrors.push(`sessionId cannot be empty for ${this.type} messages`);
        }
        break;

      case 'createVariable':
        if (this.payload.variableData) {
          const { variableData } = this.payload;
          if (variableData.hasOwnProperty('name') && !variableData.name) {
            this._validationErrors.push('variableData.name cannot be empty');
          }
          if (variableData.hasOwnProperty('type') && !variableData.type) {
            this._validationErrors.push('variableData.type cannot be empty');
          }
        }
        break;

      case 'updateVariable':
      case 'deleteVariable':
      case 'duplicateVariable':
        if (this.payload.hasOwnProperty('variableId') && !this.payload.variableId) {
          this._validationErrors.push(`variableId cannot be empty for ${this.type} messages`);
        }
        break;

      case 'autocomplete':
        if (this.payload.hasOwnProperty('partial') && this.payload.partial === null) {
          this._validationErrors.push('partial cannot be null for autocomplete messages');
        }
        break;

      // Response validation - only check if error field exists
      case 'commandError':
      case 'toolExecutionError':
      case 'sessionCreationError':
      case 'sessionUpdateError':
      case 'sessionLoadError':
      case 'sessionDeleteError':
      case 'variableCreationError':
      case 'variableUpdateError':
      case 'variableDeleteError':
      case 'variablesImportError':
        if (this.payload.hasOwnProperty('error') && !this.payload.error) {
          this._validationErrors.push(`error cannot be empty for ${this.type} messages`);
        }
        break;

      // Most other message types are valid without specific payload requirements
      default:
        // No additional validation needed
        break;
    }
  }

  /**
   * Create a response message for this message
   * @param {string} responseType - Type of response
   * @param {Object} responsePayload - Response payload
   * @returns {ActorMessage} Response message
   */
  createResponse(responseType, responsePayload = {}) {
    const responseMetadata = {};
    
    // Copy request ID for correlation
    if (this.metadata.requestId) {
      responseMetadata.requestId = this.metadata.requestId;
    }
    
    // Add correlation ID
    responseMetadata.correlationId = this.metadata.messageId;

    return new ActorMessage(responseType, responsePayload, responseMetadata);
  }

  /**
   * Create an error response for this message
   * @param {string} errorMessage - Error message
   * @param {string} errorCode - Optional error code
   * @returns {ActorMessage} Error response message
   */
  createErrorResponse(errorMessage, errorCode) {
    const errorType = this._getErrorTypeForMessage();
    const errorPayload = { error: errorMessage };
    
    if (errorCode) {
      errorPayload.errorCode = errorCode;
    }

    return this.createResponse(errorType, errorPayload);
  }

  /**
   * Get appropriate error type for current message type
   * @private
   * @returns {string} Error type
   */
  _getErrorTypeForMessage() {
    const errorTypeMap = {
      'execute': 'commandError',
      'executeTool': 'toolExecutionError',
      'getTools': 'toolsListError',
      'getSessions': 'sessionListError',
      'getVariables': 'variablesListError',
      'createSession': 'sessionCreationError',
      'updateSession': 'sessionUpdateError',
      'loadSession': 'sessionLoadError',
      'deleteSession': 'sessionDeleteError',
      'createVariable': 'variableCreationError',
      'updateVariable': 'variableUpdateError',
      'deleteVariable': 'variableDeleteError',
      'importVariables': 'variablesImportError'
    };

    return errorTypeMap[this.type] || 'genericError';
  }

  /**
   * Clone the message
   * @returns {ActorMessage} Cloned message
   */
  clone() {
    return new ActorMessage(
      this.type,
      JSON.parse(JSON.stringify(this.payload)),
      JSON.parse(JSON.stringify(this.metadata))
    );
  }

  /**
   * Convert message to a plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      type: this.type,
      payload: this.payload,
      metadata: this.metadata
    };
  }

  /**
   * String representation of the message
   * @returns {string} String representation
   */
  toString() {
    return `ActorMessage(${this.type})[${this.metadata.messageId}]`;
  }
}