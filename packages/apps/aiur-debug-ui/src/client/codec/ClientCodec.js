/**
 * Client-side Codec implementation
 * Simplified version for browser environment that can validate messages against schemas
 */

export class ClientCodec {
  constructor() {
    this.schemas = new Map();
    this.messageTypes = new Map();
    this.strictValidation = true;
  }

  /**
   * Register schemas from server
   * @param {Object} schemas - Schema definitions from server
   * @param {Array} messageTypes - Message type mappings
   */
  registerSchemas(schemas, messageTypes = []) {
    console.log('[ClientCodec] Registering schemas:', Object.keys(schemas).length);
    
    // Store schemas by their $id
    for (const [id, schema] of Object.entries(schemas)) {
      this.schemas.set(id, schema);
      console.log(`[ClientCodec] Registered schema: ${id}`);
    }
    
    // Store message type mappings
    messageTypes.forEach(type => {
      this.messageTypes.set(type, type);
    });
    
    console.log('[ClientCodec] Total schemas:', this.schemas.size);
    console.log('[ClientCodec] Message types:', Array.from(this.messageTypes.keys()));
  }

  /**
   * Validate a message against its schema
   * @param {string} messageType - Type of message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  validate(messageType, message) {
    try {
      const schema = this.schemas.get(messageType);
      
      if (!schema) {
        return {
          success: false,
          error: `No schema found for message type: ${messageType}`,
          validated: false
        };
      }

      // Basic validation - check required fields
      const validation = this._validateObject(message, schema);
      
      return {
        success: validation.valid,
        error: validation.valid ? null : validation.error,
        validated: true,
        schema: messageType
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Validation error: ${error.message}`,
        validated: false
      };
    }
  }

  /**
   * Encode a message (client-side just returns JSON)
   * @param {string} messageType - Type of message
   * @param {Object} message - Message to encode
   * @returns {Object} Encode result
   */
  encode(messageType, message) {
    try {
      // Add metadata
      const enhancedMessage = {
        ...message,
        messageId: message.messageId || this._generateMessageId(),
        timestamp: message.timestamp || new Date().toISOString()
      };

      // Validate before encoding
      const validation = this.validate(messageType, enhancedMessage);
      
      if (this.strictValidation && !validation.success) {
        return {
          success: false,
          error: `Validation failed: ${validation.error}`,
          encoded: null
        };
      }

      return {
        success: true,
        encoded: JSON.stringify(enhancedMessage),
        validated: validation.success
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Encoding error: ${error.message}`,
        encoded: null
      };
    }
  }

  /**
   * Decode and validate a message
   * @param {string} data - Raw message data
   * @returns {Object} Decode result
   */
  decode(data) {
    try {
      const message = JSON.parse(data);
      
      if (!message.type) {
        return {
          success: true, // Allow messages without type for backward compatibility
          decoded: message,
          validated: false
        };
      }

      const validation = this.validate(message.type, message);
      
      return {
        success: true,
        decoded: message,
        validated: validation.success,
        validationError: validation.success ? null : validation.error
      };
      
    } catch (error) {
      return {
        success: false,
        error: `JSON parse error: ${error.message}`,
        decoded: null
      };
    }
  }

  /**
   * Get registered message types
   * @returns {Array} Message types
   */
  getMessageTypes() {
    return Array.from(this.messageTypes.keys());
  }

  /**
   * Check if codec is ready
   * @returns {boolean} Ready status
   */
  isReady() {
    return this.schemas.size > 0;
  }

  /**
   * Basic object validation against schema
   * @private
   */
  _validateObject(obj, schema) {
    try {
      // Check required fields
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (!(field in obj)) {
            return {
              valid: false,
              error: `Missing required field: ${field}`
            };
          }
        }
      }

      // Check property types (basic validation)
      if (schema.properties) {
        for (const [prop, propSchema] of Object.entries(schema.properties)) {
          if (prop in obj) {
            const validation = this._validateProperty(obj[prop], propSchema, prop);
            if (!validation.valid) {
              return validation;
            }
          }
        }
      }

      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: `Schema validation error: ${error.message}`
      };
    }
  }

  /**
   * Basic property validation
   * @private
   */
  _validateProperty(value, propSchema, propName) {
    try {
      // Type checking
      if (propSchema.type) {
        const expectedType = propSchema.type;
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (expectedType === 'integer' && typeof value === 'number' && Number.isInteger(value)) {
          // Integer is valid
        } else if (expectedType !== actualType) {
          return {
            valid: false,
            error: `Property ${propName}: expected ${expectedType}, got ${actualType}`
          };
        }
      }

      // Const checking
      if (propSchema.const !== undefined && value !== propSchema.const) {
        return {
          valid: false,
          error: `Property ${propName}: expected const value ${propSchema.const}, got ${value}`
        };
      }

      // Pattern checking for strings
      if (propSchema.pattern && typeof value === 'string') {
        const regex = new RegExp(propSchema.pattern);
        if (!regex.test(value)) {
          return {
            valid: false,
            error: `Property ${propName}: does not match pattern ${propSchema.pattern}`
          };
        }
      }

      return { valid: true };
      
    } catch (error) {
      return {
        valid: false,
        error: `Property validation error: ${error.message}`
      };
    }
  }

  /**
   * Generate a unique message ID
   * @private
   */
  _generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}