/**
 * ValidationUtils - Argument validation and type conversion utilities
 */

export class ValidationUtils {
  /**
   * Validate required parameters
   * @param {object} args - Arguments to validate
   * @param {string[]} required - Required parameter names
   * @throws {Error} If required parameters are missing
   */
  validateRequired(args, required) {
    const missing = [];
    
    for (const param of required) {
      if (!(param in args)) {
        missing.push(param);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Validate parameter types
   * @param {object} args - Arguments to validate
   * @param {object} schema - Parameter schema
   * @returns {object} Validation result
   */
  validateTypes(args, schema) {
    const errors = [];
    
    if (!schema || !schema.properties) {
      return { valid: true, errors };
    }
    
    for (const [key, value] of Object.entries(args)) {
      const propSchema = schema.properties[key];
      if (!propSchema) continue;
      
      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (propSchema.type && actualType !== propSchema.type) {
        errors.push(`Parameter '${key}' must be of type ${propSchema.type}, got ${actualType}`);
      }
      
      // Check enum values
      if (propSchema.enum && !propSchema.enum.includes(value)) {
        errors.push(`Parameter '${key}' must be one of: ${propSchema.enum.join(', ')}`);
      }
      
      // Check min/max for numbers
      if (propSchema.type === 'number') {
        if (propSchema.minimum !== undefined && value < propSchema.minimum) {
          errors.push(`Parameter '${key}' must be >= ${propSchema.minimum}`);
        }
        if (propSchema.maximum !== undefined && value > propSchema.maximum) {
          errors.push(`Parameter '${key}' must be <= ${propSchema.maximum}`);
        }
      }
      
      // Check string patterns
      if (propSchema.type === 'string' && propSchema.pattern) {
        const regex = new RegExp(propSchema.pattern);
        if (!regex.test(value)) {
          errors.push(`Parameter '${key}' must match pattern: ${propSchema.pattern}`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * Convert string to specified type
   * @param {string} value - Value to convert
   * @param {string} type - Target type
   * @returns {any} Converted value
   */
  convertType(value, type) {
    switch (type) {
      case 'number':
        return this.toNumber(value);
      case 'boolean':
        return this.toBoolean(value);
      case 'array':
        return this.toArray(value);
      case 'object':
        return this.toObject(value);
      default:
        return value;
    }
  }

  /**
   * Convert to number
   * @param {any} value - Value to convert
   * @returns {number} Converted value
   */
  toNumber(value) {
    if (typeof value === 'number') return value;
    
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Cannot convert '${value}' to number`);
    }
    
    return num;
  }

  /**
   * Convert to boolean
   * @param {any} value - Value to convert
   * @returns {boolean} Converted value
   */
  toBoolean(value) {
    if (typeof value === 'boolean') return value;
    
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
        return false;
      }
    }
    
    return Boolean(value);
  }

  /**
   * Convert to array
   * @param {any} value - Value to convert
   * @returns {array} Converted value
   */
  toArray(value) {
    if (Array.isArray(value)) return value;
    
    if (typeof value === 'string') {
      // Try JSON parse first
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        // Not JSON, try comma-separated
        return value.split(',').map(v => v.trim());
      }
    }
    
    return [value];
  }

  /**
   * Convert to object
   * @param {any} value - Value to convert
   * @returns {object} Converted value
   */
  toObject(value) {
    if (typeof value === 'object' && value !== null) return value;
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error(`Cannot parse '${value}' as JSON object`);
      }
    }
    
    return { value };
  }

  /**
   * Validate email format
   * @param {string} email - Email to validate
   * @returns {boolean} True if valid
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate file path
   * @param {string} path - Path to validate
   * @returns {boolean} True if valid
   */
  isValidPath(path) {
    // Basic path validation - can be enhanced
    return typeof path === 'string' && path.length > 0 && !path.includes('\0');
  }
}

export default ValidationUtils;