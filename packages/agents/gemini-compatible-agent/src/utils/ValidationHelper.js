/**
 * Utility class for input/output validation
 * @class ValidationHelper
 */
export class ValidationHelper {
  /**
   * Validates tool input against a schema
   * @param {Object} input - Input to validate
   * @param {Object} schema - Validation schema
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  static validateToolInput(input, schema) {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid input format: must be an object');
    }

    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid schema format');
    }

    for (const [key, definition] of Object.entries(schema)) {
      if (definition.required && !(key in input)) {
        throw new Error(`Missing required field: ${key}`);
      }
      if (key in input && typeof input[key] !== definition.type) {
        throw new Error(`Invalid type for ${key}: expected ${definition.type}`);
      }
    }

    return true;
  }

  /**
   * Validates tool output against expected schema
   * @param {any} output - Output to validate
   * @param {Object} expectedSchema - Expected output schema
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  static validateToolOutput(output, expectedSchema) {
    if (output === undefined || output === null) {
      throw new Error('Tool output cannot be null or undefined');
    }

    if (!expectedSchema || typeof expectedSchema !== 'object') {
      throw new Error('Invalid output schema format');
    }

    const { type, format } = expectedSchema;
    
    if (type && typeof output !== type) {
      throw new Error(`Output type mismatch: expected ${type}`);
    }

    if (format === 'array' && !Array.isArray(output)) {
      throw new Error('Expected output to be an array');
    }

    return true;
  }

  /**
   * Validates primitive type
   * @param {any} value - Value to validate
   * @param {string} expectedType - Expected type
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  static validateType(value, expectedType) {
    if (typeof value !== expectedType) {
      throw new Error(`Type mismatch: expected ${expectedType}, got ${typeof value}`);
    }
    return true;
  }

  /**
   * Validates conversation format
   * @param {Object} conversation - Conversation to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  static validateConversation(conversation) {
    if (!conversation || typeof conversation !== 'object') {
      throw new Error('Invalid conversation format: must be an object');
    }

    if (!conversation.id || typeof conversation.id !== 'string') {
      throw new Error('Conversation must have a valid id string');
    }

    if (!Array.isArray(conversation.messages)) {
      throw new Error('Conversation messages must be an array');
    }

    for (const message of conversation.messages) {
      if (!message || typeof message !== 'object') {
        throw new Error('Each message must be an object');
      }
      if (!message.role || typeof message.role !== 'string') {
        throw new Error('Each message must have a role string');
      }
      if (!message.content || typeof message.content !== 'string') {
        throw new Error('Each message must have content string');
      }
    }

    if (conversation.metadata && typeof conversation.metadata !== 'object') {
      throw new Error('Conversation metadata must be an object if provided');
    }

    return true;
  }

  /**
   * Instance method for validating conversation format
   * @param {Object} conversation - Conversation to validate
   * @returns {boolean} True if valid
   * @throws {Error} If validation fails
   */
  validateConversation(conversation) {
    return ValidationHelper.validateConversation(conversation);
  }
}
