/**
 * ResultMapper - Handles JSONPath-style result mapping and type coercion
 */
export class ResultMapper {
  /**
   * Map a result based on mapping configuration
   * @param {*} result - The result to map
   * @param {Object} mappingConfig - The mapping configuration
   * @returns {*} The mapped result
   */
  mapResult(result, mappingConfig) {
    if (!mappingConfig) {
      return result;
    }

    // Handle transform types
    if (mappingConfig.transform) {
      return this.applyTransform(result, mappingConfig);
    }

    // Handle success mapping
    if (mappingConfig.success) {
      return this.applyMapping(result, mappingConfig.success);
    }

    return result;
  }

  /**
   * Map an error based on mapping configuration
   * @param {*} error - The error to map
   * @param {Object} mappingConfig - The mapping configuration
   * @returns {*} The mapped error
   */
  mapError(error, mappingConfig) {
    if (!mappingConfig || !mappingConfig.failure) {
      return error;
    }

    return this.applyMapping(error, mappingConfig.failure);
  }

  /**
   * Apply a mapping to an object
   * @private
   */
  applyMapping(source, mapping) {
    const result = {};

    for (const [key, value] of Object.entries(mapping)) {
      if (typeof value === 'string') {
        // Simple JSONPath
        result[key] = this.extractPath(source, value);
      } else if (typeof value === 'object' && value !== null) {
        // Complex mapping with type coercion or custom transform
        if (value.transform === 'custom' && value.fn) {
          const extracted = value.path ? this.extractPath(source, value.path) : source;
          result[key] = value.fn(extracted);
        } else if (value.path && value.type) {
          // Type coercion
          const extracted = this.extractPath(source, value.path);
          result[key] = this.coerceType(extracted, value.type);
        } else if (value.path) {
          result[key] = this.extractPath(source, value.path);
        }
      } else {
        // Literal value
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Apply a transform to the result
   * @private
   */
  applyTransform(result, config) {
    switch (config.transform) {
      case 'instance':
        return { instance: result };
        
      case 'raw':
        return result;
        
      case 'stringify':
        return JSON.stringify(result);
        
      case 'array':
        if (config.path) {
          return this.extractPath(result, config.path);
        }
        return result;
        
      default:
        return result;
    }
  }

  /**
   * Extract value from object using JSONPath-like syntax
   * @private
   */
  extractPath(obj, path) {
    // Handle root object reference
    if (path === '$') {
      return obj;
    }
    
    if (!path.startsWith('$.')) {
      return path; // Not a path, return as literal
    }

    const parts = path.slice(2).split(/[\.\[\]]+/).filter(Boolean);
    let current = obj;

    for (const part of parts) {
      if (current == null) {
        return undefined;
      }

      // Handle numeric indices
      if (/^\d+$/.test(part)) {
        current = current[parseInt(part, 10)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Coerce a value to a specific type
   * @private
   */
  coerceType(value, type) {
    if (value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case 'number':
        return Number(value);
        
      case 'string':
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
        
      case 'boolean':
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          return lower === 'true' || lower === 'yes' || lower === '1';
        }
        return Boolean(value);
        
      case 'array':
        if (Array.isArray(value)) {
          return value;
        }
        return [value];
        
      case 'object':
        if (typeof value === 'string') {
          try {
            return JSON.parse(value);
          } catch {
            return { value };
          }
        }
        return value;
        
      default:
        return value;
    }
  }
}

export default ResultMapper;