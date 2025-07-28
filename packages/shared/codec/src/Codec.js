/**
 * Codec - Main class for encoding and decoding messages with schema validation
 */

import { SchemaRegistry } from './schemas/index.js';
import { SchemaValidator } from './validators/SchemaValidator.js';

export class Codec {
  constructor(options = {}) {
    this.options = {
      strictValidation: true,
      injectMetadata: true,
      ...options
    };

    this.registry = new SchemaRegistry();
    this.validator = new SchemaValidator();
    
    // Register all base schemas with validator
    this.registerBaseSchemas();
  }

  /**
   * Register base schemas with the validator
   * @private
   */
  registerBaseSchemas() {
    const allSchemas = this.registry.getAll();
    for (const [id, schema] of Object.entries(allSchemas)) {
      this.validator.addSchema(id, schema);
      
      // Also register by message type if it has a const type property
      if (schema.properties && schema.properties.type && schema.properties.type.const) {
        const messageType = schema.properties.type.const;
        if (messageType !== id) {
          this.validator.addSchema(messageType, schema);
          // Also register in registry by message type
          this.registry.register({ ...schema, $id: messageType });
        }
      }
    }
  }

  /**
   * Register a custom message schema
   * @param {object} schema - JSON schema with $id property
   */
  registerSchema(schema) {
    if (!schema.$id) {
      throw new Error('Schema must have an $id property');
    }

    this.registry.register(schema);
    this.validator.addSchema(schema.$id, schema);
  }

  /**
   * Load schema definitions from another codec or schema definition message
   * @param {object} schemaDefinition - Schema definition object with schemas property
   * @param {boolean} replace - Whether to replace existing schemas
   */
  loadSchemaDefinition(schemaDefinition, replace = false) {
    if (!schemaDefinition.schemas || typeof schemaDefinition.schemas !== 'object') {
      throw new Error('Invalid schema definition: missing schemas property');
    }

    this.registry.loadSchemas(schemaDefinition.schemas, replace);
    
    // Re-register all schemas with validator
    if (replace) {
      this.validator.clear();
    }
    
    const allSchemas = this.registry.getAll();
    for (const [id, schema] of Object.entries(allSchemas)) {
      this.validator.addSchema(id, schema);
    }
  }

  /**
   * Encode a message with the given type
   * @param {string} messageType - Type/schema ID of the message
   * @param {object} data - Message data to encode
   * @returns {{ success: boolean, encoded?: string, error?: object }}
   */
  encode(messageType, data) {
    try {
      // Check if we have the schema
      if (!this.registry.has(messageType)) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${messageType}`,
            details: { messageType }
          }
        };
      }

      // Create message object with metadata injection
      const messageData = { ...data };
      
      if (this.options.injectMetadata) {
        messageData.type = messageType;
        
        if (!messageData.messageId) {
          messageData.messageId = this.generateMessageId();
        }
        
        if (!messageData.timestamp) {
          messageData.timestamp = new Date().toISOString();
        }
      }

      // Validate against schema if strict validation is enabled
      if (this.options.strictValidation) {
        const validationResult = this.validator.validate(messageType, messageData);
        
        if (!validationResult.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Message validation failed',
              details: {
                messageType,
                errors: validationResult.errors
              }
            }
          };
        }
      }

      // Encode to JSON
      const encoded = JSON.stringify(messageData);
      
      return {
        success: true,
        encoded
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ENCODING_ERROR',
          message: 'Failed to encode message',
          details: {
            messageType,
            originalError: error.message
          }
        }
      };
    }
  }

  /**
   * Decode a JSON message and validate it
   * @param {string} encodedMessage - JSON string to decode
   * @returns {{ success: boolean, decoded?: object, messageType?: string, error?: object }}
   */
  decode(encodedMessage) {
    try {
      // Parse JSON
      let messageData;
      try {
        messageData = JSON.parse(encodedMessage);
      } catch (parseError) {
        return {
          success: false,
          error: {
            code: 'DECODING_ERROR',
            message: 'Invalid JSON format',
            details: {
              originalError: parseError.message
            }
          }
        };
      }

      // Extract message type
      const messageType = messageData.type;
      
      if (!messageType) {
        return {
          success: false,
          error: {
            code: 'DECODING_ERROR',
            message: 'Message missing type field',
            details: { messageData }
          }
        };
      }

      // Check if we have the schema
      if (!this.registry.has(messageType)) {
        return {
          success: false,
          error: {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${messageType}`,
            details: { messageType }
          }
        };
      }

      // Validate against schema if strict validation is enabled
      if (this.options.strictValidation) {
        const validationResult = this.validator.validate(messageType, messageData);
        
        if (!validationResult.success) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Message validation failed',
              details: {
                messageType,
                errors: validationResult.errors
              }
            }
          };
        }
      }

      return {
        success: true,
        decoded: messageData,
        messageType
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DECODING_ERROR',
          message: 'Failed to decode message',
          details: {
            originalError: error.message
          }
        }
      };
    }
  }

  /**
   * Create a schema definition message
   * @returns {object} Schema definition message
   */
  createSchemaDefinitionMessage() {
    return this.registry.createSchemaDefinitionMessage();
  }

  /**
   * Create an error message
   * @param {string} code - Error code
   * @param {string} message - Error message
   * @param {object} details - Additional error details
   * @returns {object} Error message
   */
  createErrorMessage(code, message, details = {}) {
    return {
      type: 'error',
      code,
      message,
      details,
      messageId: this.generateMessageId(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an acknowledgment message
   * @param {string} originalMessageId - ID of message being acknowledged
   * @param {string} status - Ack status ('success' or 'error')
   * @returns {object} Acknowledgment message
   */
  createAckMessage(originalMessageId, status) {
    return {
      type: 'ack',
      messageId: this.generateMessageId(),
      originalMessageId,
      status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate a unique message ID
   * @returns {string} Unique message identifier
   */
  generateMessageId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `msg_${timestamp}_${random}`;
  }

  /**
   * Get available message types (schema IDs)
   * @returns {string[]} Array of message type names
   */
  getMessageTypes() {
    return this.registry.getSchemaIds();
  }

  /**
   * Check if a message type is registered
   * @param {string} messageType - Message type to check
   * @returns {boolean} True if message type is registered
   */
  hasMessageType(messageType) {
    return this.registry.has(messageType);
  }

  /**
   * Get schema for a message type
   * @param {string} messageType - Message type
   * @returns {object|null} Schema definition or null if not found
   */
  getSchema(messageType) {
    return this.registry.get(messageType);
  }
}