/**
 * Codec - Main class for encoding/decoding typed messages
 */

import { SchemaValidator } from './validators/SchemaValidator.js';
import { SchemaRegistry } from './schemas/index.js';

export class Codec {
  constructor(options = {}) {
    this.registry = new SchemaRegistry();
    this.validator = new SchemaValidator(options.validatorOptions);
    this.messageIdCounter = 0;
    
    // Initialize validator with registry schemas
    this.syncSchemasToValidator();
    
    // Options
    this.options = {
      strictValidation: options.strictValidation !== false,
      includeMessageId: options.includeMessageId !== false,
      includeTiming: options.includeTiming !== false,
      ...options
    };
  }

  /**
   * Sync schemas from registry to validator
   * @private
   */
  syncSchemasToValidator() {
    const schemaIds = this.registry.getSchemaIds();
    for (const schemaId of schemaIds) {
      const schema = this.registry.get(schemaId);
      this.validator.addSchema(schemaId, schema);
    }
  }

  /**
   * Register a new schema
   * @param {object} schema - JSON schema with $id property
   */
  registerSchema(schema) {
    this.registry.register(schema);
    this.validator.addSchema(schema.$id, schema);
  }

  /**
   * Load schemas from schema definition message
   * @param {object} schemaDefinition - Schema definition message
   * @returns {{ success: boolean, errors: string[] }}
   */
  loadSchemaDefinition(schemaDefinition) {
    try {
      // Validate the schema definition message itself
      const validation = this.validator.validate('schema_definition', schemaDefinition);
      if (!validation.valid) {
        return {
          success: false,
          errors: [`Invalid schema definition: ${validation.errors.map(e => e.message).join(', ')}`]
        };
      }

      // Load the schemas
      this.registry.loadSchemas(schemaDefinition.schemas, true);
      this.syncSchemasToValidator();

      return { success: true, errors: [] };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to load schema definition: ${error.message}`]
      };
    }
  }

  /**
   * Encode a message for transmission
   * @param {string} messageType - Type of message (schema ID)
   * @param {object} data - Message data
   * @param {object} options - Encoding options
   * @returns {{ success: boolean, message: string|null, errors: string[] }}
   */
  encode(messageType, data, options = {}) {
    try {
      // Prepare the message object
      const message = {
        ...data,
        type: messageType
      };

      // Add message ID if enabled
      if (this.options.includeMessageId && !message.messageId) {
        message.messageId = this.generateMessageId();
      }

      // Add timestamp if enabled and not present
      if (this.options.includeTiming && !message.timestamp) {
        message.timestamp = new Date().toISOString();
      }

      // Validate against schema if strict validation is enabled
      if (this.options.strictValidation) {
        const validation = this.validator.validate(messageType, message);
        if (!validation.valid) {
          return {
            success: false,
            message: null,
            errors: [`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`]
          };
        }
      }

      // Serialize to JSON
      const serialized = JSON.stringify(message, null, options.pretty ? 2 : 0);
      
      return {
        success: true,
        message: serialized,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        message: null,
        errors: [`Encoding failed: ${error.message}`]
      };
    }
  }

  /**
   * Decode a received message
   * @param {string} rawMessage - Raw message string
   * @param {object} options - Decoding options
   * @returns {{ success: boolean, message: object|null, messageType: string|null, errors: string[] }}
   */
  decode(rawMessage, options = {}) {
    try {
      // Parse JSON
      let message;
      try {
        message = JSON.parse(rawMessage);
      } catch (parseError) {
        return {
          success: false,
          message: null,
          messageType: null,
          errors: [`JSON parsing failed: ${parseError.message}`]
        };
      }

      // Extract message type
      const messageType = message.type;
      if (!messageType) {
        return {
          success: false,
          message: null,
          messageType: null,
          errors: ['Message missing type property']
        };
      }

      // Validate against schema if strict validation is enabled
      if (this.options.strictValidation) {
        const validation = this.validator.validate(messageType, message);
        if (!validation.valid) {
          return {
            success: false,
            message,
            messageType,
            errors: [`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`]
          };
        }
      }

      return {
        success: true,
        message,
        messageType,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        message: null,
        messageType: null,
        errors: [`Decoding failed: ${error.message}`]
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
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an acknowledgment message
   * @param {string} messageId - ID of message being acknowledged
   * @param {string} status - Ack status ('success' or 'error')
   * @returns {object} Acknowledgment message
   */
  createAckMessage(messageId, status) {
    return {
      type: 'ack',
      messageId,
      status,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate a unique message ID
   * @returns {string} Message ID
   * @private
   */
  generateMessageId() {
    return `msg_${Date.now()}_${++this.messageIdCounter}`;
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