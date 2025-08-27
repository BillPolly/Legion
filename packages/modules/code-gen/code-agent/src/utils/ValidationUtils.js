/**
 * ValidationUtils - Input validation and data sanitization
 * 
 * This class provides comprehensive validation and sanitization utilities
 * for input validation, schema validation, and data cleaning.
 */

class ValidationUtils {
  constructor(options = {}) {
    this.options = {
      cachingEnabled: options.cachingEnabled !== false,
      maxCacheSize: options.maxCacheSize || 1000,
      ...options
    };

    // Built-in validation rules
    this.rules = {
      string: (value) => typeof value === 'string',
      number: (value) => typeof value === 'number' && !isNaN(value),
      integer: (value) => Number.isInteger(value),
      boolean: (value) => typeof value === 'boolean',
      array: (value) => Array.isArray(value),
      object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
      'non-empty': (value) => typeof value === 'string' && value.trim().length > 0,
      alphanumeric: (value) => typeof value === 'string' && /^[a-zA-Z0-9]+$/.test(value),
      email: (value) => typeof value === 'string' && this._isValidEmail(value),
      ...options.customRules
    };

    // Built-in sanitizers
    this.sanitizers = {
      string: (value) => String(value).trim().replace(/\s+/g, ' '),
      identifier: (value) => this._sanitizeIdentifier(value),
      filePath: (value) => this._sanitizeFilePath(value),
      html: (value) => this._sanitizeHtml(value)
    };

    // Validation cache
    this.cache = new Map();

    // JavaScript reserved words
    this.reservedWords = new Set([
      'abstract', 'await', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
      'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do',
      'double', 'else', 'enum', 'export', 'extends', 'false', 'final',
      'finally', 'float', 'for', 'function', 'goto', 'if', 'implements',
      'import', 'in', 'instanceof', 'int', 'interface', 'let', 'long',
      'native', 'new', 'null', 'package', 'private', 'protected', 'public',
      'return', 'short', 'static', 'super', 'switch', 'synchronized', 'this',
      'throw', 'throws', 'transient', 'true', 'try', 'typeof', 'var', 'void',
      'volatile', 'while', 'with', 'yield'
    ]);

    // Valid project types
    this.validProjectTypes = new Set(['frontend', 'backend', 'fullstack']);

    // Valid file extensions
    this.validExtensions = new Set(['.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.html', '.md']);
  }

  // Basic type validation methods
  isString(value) {
    return typeof value === 'string';
  }

  isNumber(value) {
    return typeof value === 'number' && !isNaN(value);
  }

  isInteger(value) {
    return Number.isInteger(value);
  }

  isBoolean(value) {
    return typeof value === 'boolean';
  }

  isArray(value) {
    return Array.isArray(value);
  }

  isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  // String validation methods
  isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  hasValidLength(value, minLength, maxLength) {
    if (typeof value !== 'string') return false;
    const length = value.length;
    return length >= minLength && length <= maxLength;
  }

  isAlphanumeric(value) {
    if (typeof value !== 'string' || value.length === 0) return false;
    return /^[a-zA-Z0-9]+$/.test(value);
  }

  isValidIdentifier(value) {
    if (typeof value !== 'string' || value.length === 0) return false;
    if (this.reservedWords.has(value)) return false;
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value);
  }

  isValidEmail(value) {
    return this._isValidEmail(value);
  }

  // File path validation methods
  isValidFilePath(value) {
    if (typeof value !== 'string' || value.length === 0) return false;
    // Basic file path validation - no null bytes, reasonable length
    return !value.includes('\0') && value.length < 260;
  }

  hasValidExtension(filePath, allowedExtensions) {
    if (typeof filePath !== 'string') return false;
    const ext = this._getFileExtension(filePath);
    return allowedExtensions.includes(ext);
  }

  isValidDirectoryName(value) {
    if (typeof value !== 'string' || value.length === 0) return false;
    // No path separators, no spaces, reasonable characters
    return /^[a-zA-Z0-9_-]+$/.test(value);
  }

  isSafePath(filePath) {
    if (typeof filePath !== 'string') return false;
    
    // Check for directory traversal attempts
    const normalized = filePath.replace(/\\/g, '/');
    if (normalized.includes('../') || normalized.startsWith('/')) {
      return false;
    }
    
    // Check for dangerous patterns
    const dangerousPatterns = [
      /\.\.\//,
      /^\/+/,
      /^[a-zA-Z]:\//,  // Windows absolute paths
      /\0/  // Null bytes
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(normalized));
  }

  // Project configuration validation
  isValidProjectType(value) {
    return this.validProjectTypes.has(value);
  }

  isValidProjectName(value) {
    if (typeof value !== 'string' || value.length === 0) return false;
    // Project names should be URL-safe and npm-compatible
    return /^[a-zA-Z0-9_-]+$/.test(value);
  }

  isValidTaskConfig(config) {
    if (!this.isObject(config)) return false;
    
    const requiredFields = ['name', 'type'];
    for (const field of requiredFields) {
      if (!this.isNonEmptyString(config[field])) {
        return false;
      }
    }

    // Validate task type
    const validTaskTypes = ['generate', 'fix', 'test', 'analyze'];
    if (!validTaskTypes.includes(config.type)) {
      return false;
    }

    return true;
  }

  // Code generation validation
  isValidCodeTemplate(template) {
    if (!this.isObject(template)) return false;

    const requiredFields = ['name', 'language', 'content'];
    for (const field of requiredFields) {
      if (!this.isNonEmptyString(template[field])) {
        return false;
      }
    }

    // Validate language
    const validLanguages = ['javascript', 'typescript', 'html', 'css', 'json'];
    if (!validLanguages.includes(template.language)) {
      return false;
    }

    return true;
  }

  isValidVariableName(value) {
    if (!this.isValidIdentifier(value)) return false;
    // Variable names should start with lowercase or underscore
    return /^[a-z_$]/.test(value);
  }

  isValidFunctionName(value) {
    if (!this.isValidIdentifier(value)) return false;
    // Function names should start with lowercase
    return /^[a-z_$]/.test(value);
  }

  isValidClassName(value) {
    if (!this.isValidIdentifier(value)) return false;
    // Class names should start with uppercase
    return /^[A-Z]/.test(value);
  }

  // Data sanitization methods
  sanitizeString(value) {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
  }

  sanitizeFilePath(value) {
    return this._sanitizeFilePath(value);
  }

  sanitizeIdentifier(value) {
    return this._sanitizeIdentifier(value);
  }

  sanitizeHtml(value) {
    return this._sanitizeHtml(value);
  }

  // Schema validation
  validateSchema(data, schema) {
    try {
      return this._validateSchemaRecursive(data, schema, []);
    } catch (error) {
      return false;
    }
  }

  getSchemaErrors(data, schema) {
    const errors = [];
    this._validateSchemaRecursive(data, schema, [], errors);
    return errors;
  }

  // Custom rule management
  addRule(name, validator) {
    this.rules[name] = validator;
  }

  validate(value, ruleName) {
    const cacheKey = `${ruleName}:${JSON.stringify(value)}`;
    
    if (this.options.cachingEnabled && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const rule = this.rules[ruleName];
    if (!rule) {
      throw new Error(`Unknown validation rule: ${ruleName}`);
    }

    const result = rule(value);
    
    if (this.options.cachingEnabled) {
      this._addToCache(cacheKey, result);
    }

    return result;
  }

  validateMultiple(value, ruleNames) {
    const errors = [];
    let isValid = true;

    for (const ruleName of ruleNames) {
      try {
        if (!this.validate(value, ruleName)) {
          isValid = false;
          errors.push({
            rule: ruleName,
            value: value,
            message: `Value failed validation rule: ${ruleName}`
          });
        }
      } catch (error) {
        isValid = false;
        errors.push({
          rule: ruleName,
          value: value,
          message: error.message
        });
      }
    }

    return { isValid, errors };
  }

  validateArray(array, itemRule) {
    if (!this.isArray(array)) return false;
    
    return array.every(item => {
      try {
        return this.validate(item, itemRule);
      } catch (error) {
        return false;
      }
    });
  }

  // Private helper methods
  _isValidEmail(value) {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  _getFileExtension(filePath) {
    const lastDotIndex = filePath.lastIndexOf('.');
    return lastDotIndex === -1 ? '' : filePath.substring(lastDotIndex);
  }

  _sanitizeFilePath(value) {
    if (typeof value !== 'string') return '';
    
    // Normalize path separators
    let sanitized = value.replace(/\\/g, '/');
    
    // Remove double slashes
    sanitized = sanitized.replace(/\/+/g, '/');
    
    // Remove ./ and resolve ../ 
    const parts = sanitized.split('/').filter(part => part !== '.' && part !== '');
    const resolved = [];
    
    for (const part of parts) {
      if (part === '..') {
        if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
          resolved.pop();
        }
      } else {
        resolved.push(part);
      }
    }
    
    return resolved.join('/');
  }

  _sanitizeIdentifier(value) {
    if (typeof value !== 'string') return '';
    
    // Convert kebab-case and snake_case to camelCase
    let sanitized = value.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
    
    // Remove invalid characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9_$]/g, '');
    
    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(sanitized)) {
      sanitized = sanitized.replace(/^[0-9]+/, '') + sanitized.match(/^[0-9]+/)[0];
    }
    
    // Handle reserved words
    if (this.reservedWords.has(sanitized)) {
      sanitized += 'Name';
    }
    
    return sanitized || 'defaultName';
  }

  _sanitizeHtml(value) {
    if (typeof value !== 'string') return '';
    
    // Remove all HTML tags, including script tags and their content
    let sanitized = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .trim();
    
    return sanitized;
  }

  _validateSchemaRecursive(data, schema, path = [], errors = []) {
    if (!this.isObject(schema)) {
      return true;
    }

    for (const [field, rules] of Object.entries(schema)) {
      const fieldPath = [...path, field];
      const value = data?.[field];

      // Check if field is required
      if (rules.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
        if (errors) {
          errors.push({
            field: fieldPath.join('.'),
            message: `Field '${field}' is required`,
            value: value
          });
        }
        continue;
      }

      // Skip validation if field is not present and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Validate type
      if (rules.type && !this._validateType(value, rules.type)) {
        if (errors) {
          errors.push({
            field: fieldPath.join('.'),
            message: `Field '${field}' must be of type '${rules.type}'`,
            value: value
          });
        }
        if (!errors) return false;
      }

      // Validate min/max for numbers
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          if (errors) {
            errors.push({
              field: fieldPath.join('.'),
              message: `Field '${field}' must be at least ${rules.min}`,
              value: value
            });
          }
          if (!errors) return false;
        }
        if (rules.max !== undefined && value > rules.max) {
          if (errors) {
            errors.push({
              field: fieldPath.join('.'),
              message: `Field '${field}' must be at most ${rules.max}`,
              value: value
            });
          }
          if (!errors) return false;
        }
      }

      // Validate array items
      if (rules.type === 'array' && rules.itemType) {
        if (!this.isArray(value)) continue;
        
        for (let i = 0; i < value.length; i++) {
          if (!this._validateType(value[i], rules.itemType)) {
            if (errors) {
              errors.push({
                field: `${fieldPath.join('.')}[${i}]`,
                message: `Array item at index ${i} must be of type '${rules.itemType}'`,
                value: value[i]
              });
            }
            if (!errors) return false;
          }
        }
      }

      // Validate nested objects
      if (rules.type === 'object' && rules.schema) {
        if (!this._validateSchemaRecursive(value, rules.schema, fieldPath, errors)) {
          if (!errors) return false;
        }
      }
    }

    return errors ? errors.length === 0 : true;
  }

  _validateType(value, type) {
    switch (type) {
      case 'string':
        return this.isString(value);
      case 'number':
        return this.isNumber(value);
      case 'integer':
        return this.isInteger(value);
      case 'boolean':
        return this.isBoolean(value);
      case 'array':
        return this.isArray(value);
      case 'object':
        return this.isObject(value);
      case 'email':
        return this.isValidEmail(value);
      default:
        return true;
    }
  }

  _addToCache(key, value) {
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry (simple LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}

export { ValidationUtils };