/**
 * Abstract Protocol Base Class
 * 
 * Defines the interface that any WebSocket-Actor protocol must implement.
 * This allows different servers (Aiur, MCP, custom) to work with the same
 * actor-based UI components.
 */
export class Protocol {
  constructor(config = {}) {
    this.name = config.name || 'UnnamedProtocol';
    this.version = config.version || '1.0.0';
    this.messageTypes = {};
    this.schemas = {};
  }

  /**
   * Initialize the protocol (e.g., define message types)
   * Must be overridden by implementations
   */
  initialize() {
    throw new Error('Protocol.initialize() must be implemented');
  }

  /**
   * Encode a message for transmission
   * @param {Object} message - Message object
   * @returns {string} Encoded message
   */
  encode(message) {
    return JSON.stringify(message);
  }

  /**
   * Decode a received message
   * @param {string} data - Raw message data
   * @returns {Object} Decoded message
   */
  decode(data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to decode message: ${error.message}`);
    }
  }

  /**
   * Validate a message against the protocol schema
   * @param {Object} message - Message to validate
   * @returns {boolean} True if valid
   */
  validate(message) {
    if (!message.type) {
      return false;
    }
    
    // Check if message type is known
    if (!this.messageTypes[message.type]) {
      console.warn(`Unknown message type: ${message.type}`);
      return false;
    }
    
    // Additional validation can be added by implementations
    return true;
  }

  /**
   * Transform an actor message to protocol message
   * Must be overridden by implementations
   * @param {Object} actorMessage - Actor system message
   * @returns {Object} Protocol message
   */
  actorToProtocol(actorMessage) {
    throw new Error('Protocol.actorToProtocol() must be implemented');
  }

  /**
   * Transform a protocol message to actor message
   * Must be overridden by implementations
   * @param {Object} protocolMessage - Protocol message
   * @returns {Object} Actor system message
   */
  protocolToActor(protocolMessage) {
    throw new Error('Protocol.protocolToActor() must be implemented');
  }

  /**
   * Get handshake/initialization message
   * @returns {Object|null} Initial message to send on connection
   */
  getHandshakeMessage() {
    return null;
  }

  /**
   * Handle connection established
   * @param {Object} welcomeMessage - Welcome/handshake response
   * @returns {Array<Object>} Follow-up messages to send
   */
  handleConnectionEstablished(welcomeMessage) {
    return [];
  }

  /**
   * Check if a message is an error
   * @param {Object} message - Message to check
   * @returns {boolean} True if error message
   */
  isError(message) {
    return message.type === 'error' || message.error !== undefined;
  }

  /**
   * Extract error details from a message
   * @param {Object} message - Error message
   * @returns {Object} Error details
   */
  extractError(message) {
    return {
      code: message.error?.code || -1,
      message: message.error?.message || message.error || 'Unknown error',
      data: message.error?.data
    };
  }
}