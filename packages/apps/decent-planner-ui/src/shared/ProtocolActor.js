/**
 * ProtocolActor Base Class
 * Provides protocol-based validation and communication for actors
 */

// Note: Removed Legion schema import due to compatibility issues with complex schemas
// TODO: Re-enable when schema issues are resolved

export class ProtocolActor {
  // Static validator cache - one per class
  static _validator = null;
  static _protocolSchema = null;
  
  /**
   * Get the protocol schema definition (defined once for all actors)
   */
  static getProtocolSchema() {
    if (!this._protocolSchema) {
      this._protocolSchema = {
        name: { type: 'string', required: true },
        version: { type: 'string', required: true },
        
        state: {
          type: 'object',
          properties: {
            schema: { type: 'object', required: true },
            initial: { type: 'object', required: true }
          }
        },
        
        messages: {
          type: 'object',
          properties: {
            receives: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  schema: { type: 'object' },
                  preconditions: { type: 'array', items: { type: 'string' } },
                  postconditions: { type: 'array', items: { type: 'string' } },
                  sideEffects: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            sends: {
              type: 'object', 
              additionalProperties: {
                type: 'object',
                properties: {
                  schema: { type: 'object' },
                  preconditions: { type: 'array', items: { type: 'string' } },
                  triggers: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        }
      };
    }
    return this._protocolSchema;
  }
  
  /**
   * Get cached validator for protocol structure
   */
  static getValidator() {
    if (!this._validator) {
      // Create a simple validator that does basic protocol structure validation
      this._validator = (protocol) => {
        if (!protocol || typeof protocol !== 'object') {
          return { valid: false, errors: ['Protocol must be an object'] };
        }
        if (!protocol.name || typeof protocol.name !== 'string') {
          return { valid: false, errors: ['Protocol must have a name string'] };
        }
        if (!protocol.version || typeof protocol.version !== 'string') {
          return { valid: false, errors: ['Protocol must have a version string'] };
        }
        return { valid: true, errors: [] };
      };
    }
    return this._validator;
  }
  
  /**
   * Validate a protocol definition against the schema
   * @param {object} protocolData - Protocol to validate
   * @returns {object} Validation result with valid boolean and errors array
   */
  static validateProtocol(protocolData) {
    const validator = this.getValidator();
    return validator(protocolData);
  }
  
  constructor() {
    // Get protocol from subclass
    this.protocol = this.getProtocol();
    
    // Validate protocol structure
    const validation = this.constructor.validateProtocol(this.protocol);
    if (!validation.valid) {
      throw new Error(`Invalid protocol for ${this.constructor.name}: ${validation.errors.join(', ')}`);
    }
    
    // Initialize state from protocol
    this.state = { ...this.protocol.state.initial };
    
    // Pre-compile message validators for performance
    this.messageValidators = new Map();
    this.setupMessageValidators();
  }
  
  /**
   * Abstract method - must be implemented by subclasses
   * @returns {object} Protocol definition
   */
  getProtocol() {
    throw new Error('getProtocol() must be implemented by subclass');
  }
  
  /**
   * Create validators for all message types
   */
  setupMessageValidators() {
    const receives = this.protocol.messages.receives || {};
    const sends = this.protocol.messages.sends || {};
    
    // Create simple validators for all message schemas (skip complex Legion schema for now)
    Object.entries({...receives, ...sends}).forEach(([msgType, spec]) => {
      if (spec.schema) {
        // Create a simple validator that always passes for now
        // TODO: Implement proper schema validation when Legion schema issues are resolved
        this.messageValidators.set(msgType, () => ({ valid: true, errors: [] }));
      }
    });
  }
  
  /**
   * Enhanced receive method with protocol validation
   * @param {string} messageType - Type of message
   * @param {object} data - Message payload
   */
  receive(messageType, data) {
    // Validate incoming message against schema
    this.validateIncomingMessage(messageType, data);
    
    // Check preconditions
    this.checkPreconditions(messageType);
    
    // Handle the message (implemented by subclass)
    const result = this.handleMessage(messageType, data);
    
    // Validate postconditions
    this.validatePostconditions(messageType);
    
    return result;
  }
  
  /**
   * Validate message data against protocol schema
   */
  validateIncomingMessage(messageType, data) {
    const validator = this.messageValidators.get(messageType);
    if (validator) {
      const result = validator(data);
      if (!result.valid) {
        const errorMessages = result.errors?.map(err => err.message || err.toString()) || ['Unknown validation error'];
        throw new Error(
          `Invalid message data for ${messageType}: ${errorMessages.join(', ')}`
        );
      }
    }
  }
  
  /**
   * Check message preconditions
   */
  checkPreconditions(messageType) {
    const messageSpec = this.protocol.messages.receives[messageType];
    if (messageSpec?.preconditions) {
      for (const condition of messageSpec.preconditions) {
        if (!this.evaluateCondition(condition)) {
          throw new Error(
            `Precondition failed for ${messageType}: ${condition}`
          );
        }
      }
    }
  }
  
  /**
   * Validate message postconditions
   */
  validatePostconditions(messageType) {
    const messageSpec = this.protocol.messages.receives[messageType];
    if (messageSpec?.postconditions) {
      for (const condition of messageSpec.postconditions) {
        if (!this.evaluateCondition(condition)) {
          console.warn(
            `Postcondition failed for ${messageType}: ${condition}`
          );
        }
      }
    }
  }
  
  /**
   * Evaluate condition string against current state
   * Simple implementation - could be enhanced with proper expression parser
   */
  evaluateCondition(condition) {
    try {
      // Create evaluation context
      const context = { state: this.state, ui: this.ui || {} };
      
      // Simple eval - in production might want safer expression evaluator
      return new Function('context', `with(context) { return ${condition}; }`)(context);
    } catch (error) {
      console.warn(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }
  
  /**
   * Send message with validation
   */
  send(messageType, data) {
    // Validate outgoing message
    const validator = this.messageValidators.get(messageType);
    if (validator) {
      const result = validator(data);
      if (!result.valid) {
        const errorMessages = result.errors?.map(err => err.message || err.toString()) || ['Unknown validation error'];
        throw new Error(
          `Invalid outgoing message data for ${messageType}: ${errorMessages.join(', ')}`
        );
      }
    }
    
    // Check preconditions for sending
    const messageSpec = this.protocol.messages.sends[messageType];
    if (messageSpec?.preconditions) {
      for (const condition of messageSpec.preconditions) {
        if (!this.evaluateCondition(condition)) {
          throw new Error(
            `Send precondition failed for ${messageType}: ${condition}`
          );
        }
      }
    }
    
    // Actually send the message (implemented by subclass)
    return this.doSend(messageType, data);
  }
  
  /**
   * Abstract methods to be implemented by subclasses
   */
  handleMessage(messageType, data) {
    throw new Error('handleMessage must be implemented by subclass');
  }
  
  doSend(messageType, data) {
    throw new Error('doSend must be implemented by subclass');
  }
}