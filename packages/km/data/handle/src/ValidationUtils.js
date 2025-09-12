/**
 * ValidationUtils - Universal validation utilities for Handle infrastructure
 * 
 * Extracted from data-proxy implementations to provide consistent validation
 * patterns across all Handle types. These utilities are resource-agnostic and 
 * work with any ResourceManager implementation.
 * 
 * CRITICAL: All validation is synchronous - NO await, NO promises!
 */

export class ValidationUtils {
  /**
   * Validate query specification structure
   * Works with DataScript, SQL, or other query formats
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} querySpec - Query specification to validate
   * @param {string} context - Context for error messages
   * @throws {Error} If query specification is invalid
   */
  static validateQuerySpec(querySpec, context = 'Query') {
    // Determine appropriate context for different error types
    const isSpecContext = context.includes('specification');
    const requiredContext = isSpecContext ? context : `${context} specification`;
    const structuralContext = isSpecContext ? context : context;
    
    if (!querySpec) {
      throw new Error(`${requiredContext} is required`);
    }
    
    if (typeof querySpec !== 'object') {
      throw new Error(`${requiredContext} must be an object`);
    }
    
    // Basic structure validation - adapted for universal use
    if (!querySpec.find && !querySpec.where && !querySpec.query && !querySpec.select) {
      throw new Error(`${structuralContext} must have find, where, query, or select clause`);
    }
    
    // DataScript-specific validation
    if (querySpec.find || querySpec.where) {
      if (!querySpec.find || (Array.isArray(querySpec.find) && querySpec.find.length === 0)) {
        throw new Error(`${structuralContext} must have find clause`);
      }
      
      if (!querySpec.where) {
        throw new Error(`${structuralContext} must have where clause`);
      }
      
      if (!Array.isArray(querySpec.where)) {
        throw new Error('Where clause must be an array');
      }
    }
    
    // SQL-like validation
    if (querySpec.select && typeof querySpec.select !== 'string' && !Array.isArray(querySpec.select)) {
      throw new Error('Select clause must be string or array');
    }
    
    // Generic query validation
    if (querySpec.query !== undefined) {
      const queryType = typeof querySpec.query;
      if (queryType !== 'string' && (queryType !== 'object' || Array.isArray(querySpec.query))) {
        throw new Error('Query clause must be string or object');
      }
    }
  }
  
  /**
   * Validate callback function
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Function} callback - Callback function to validate
   * @param {string} context - Context for error messages
   * @throws {Error} If callback is invalid
   */
  static validateCallback(callback, context = 'Callback') {
    if (!callback || typeof callback !== 'function') {
      throw new Error(`${context} function is required`);
    }
  }
  
  /**
   * Validate entity ID with flexible type support
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {*} entityId - Entity ID to validate
   * @param {string} context - Context for error messages
   * @param {Object} options - Validation options
   * @throws {Error} If entity ID is invalid
   */
  static validateEntityId(entityId, context = 'Entity ID', options = {}) {
    const {
      allowNull = false,
      allowStrings = false,
      allowNumbers = true,
      allowObjects = false,
      requirePositive = true
    } = options;
    
    if (entityId === null || entityId === undefined) {
      if (!allowNull) {
        throw new Error(`${context} is required`);
      }
      return; // Valid if null is allowed
    }
    
    const type = typeof entityId;
    
    if (type === 'string' && !allowStrings) {
      throw new Error(`${context} cannot be a string`);
    }
    
    if (type === 'number' && !allowNumbers) {
      throw new Error(`${context} cannot be a number`);
    }
    
    if (type === 'object' && !allowObjects) {
      throw new Error(`${context} cannot be an object`);
    }
    
    // Type-specific validation
    if (type === 'string' && allowStrings && entityId.trim() === '') {
      throw new Error(`${context} cannot be empty string`);
    }
    
    if (type === 'number' && allowNumbers) {
      if (isNaN(entityId) || !isFinite(entityId)) {
        throw new Error(`${context} must be a valid number`);
      }
      
      if (requirePositive && entityId <= 0) {
        throw new Error(`${context} must be positive`);
      }
    }
  }
  
  /**
   * Validate update data with flexible attribute validation
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} updateData - Update data to validate
   * @param {string} context - Context for error messages
   * @param {Object} options - Validation options
   * @throws {Error} If update data is invalid
   */
  static validateUpdateData(updateData, context = 'Update data', options = {}) {
    const {
      requireDataScriptFormat = false,
      allowEmptyObject = false,
      requiredAttributes = [],
      forbiddenAttributes = []
    } = options;
    
    if (!updateData) {
      throw new Error(`${context} is required`);
    }
    
    if (typeof updateData !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    const attributes = Object.keys(updateData);
    if (attributes.length === 0 && !allowEmptyObject) {
      throw new Error(`${context} cannot be empty`);
    }
    
    // DataScript-specific validation (attributes must start with ':')
    if (requireDataScriptFormat) {
      for (const attr of attributes) {
        if (!attr.startsWith(':')) {
          throw new Error(`Attributes must start with ':'. Found: ${attr}`);
        }
      }
    }
    
    // Required attributes validation
    for (const requiredAttr of requiredAttributes) {
      if (!attributes.includes(requiredAttr)) {
        throw new Error(`${context} must include required attribute: ${requiredAttr}`);
      }
    }
    
    // Forbidden attributes validation
    for (const attr of attributes) {
      if (forbiddenAttributes.includes(attr)) {
        throw new Error(`${context} cannot include forbidden attribute: ${attr}`);
      }
    }
  }
  
  /**
   * Validate attribute name with format flexibility
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} attributeName - Attribute name to validate
   * @param {string} context - Context for error messages
   * @param {Object} options - Validation options
   * @throws {Error} If attribute name is invalid
   */
  static validateAttributeName(attributeName, context = 'Attribute name', options = {}) {
    const {
      requireDataScriptFormat = false,
      allowEmptyString = false,
      maxLength = null,
      allowedCharacters = null
    } = options;
    
    if (attributeName === undefined || attributeName === null) {
      throw new Error(`${context} is required`);
    }
    
    if (typeof attributeName !== 'string') {
      throw new Error(`${context} must be a string`);
    }
    
    if (attributeName === '' && !allowEmptyString) {
      throw new Error(`${context} cannot be empty`);
    }
    
    // DataScript format validation
    if (requireDataScriptFormat && !attributeName.startsWith(':')) {
      throw new Error(`${context} must start with ':'`);
    }
    
    // Length validation
    if (maxLength && attributeName.length > maxLength) {
      throw new Error(`${context} cannot exceed ${maxLength} characters`);
    }
    
    // Character validation
    if (allowedCharacters && !allowedCharacters.test(attributeName)) {
      throw new Error(`${context} contains invalid characters`);
    }
  }
  
  /**
   * Validate ResourceManager interface compliance
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} resourceManager - ResourceManager to validate
   * @param {string} context - Context for error messages
   * @param {Array} requiredMethods - Required methods to check
   * @throws {Error} If ResourceManager is invalid
   */
  static validateResourceManagerInterface(resourceManager, context = 'ResourceManager', requiredMethods = ['query', 'subscribe']) {
    if (!resourceManager) {
      throw new Error(`${context} is required`);
    }
    
    if (typeof resourceManager !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    // Check required methods
    for (const method of requiredMethods) {
      if (typeof resourceManager[method] !== 'function') {
        throw new Error(`${context} must implement ${method}() method`);
      }
    }
  }
  
  /**
   * Validate subscription object
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} subscription - Subscription object to validate
   * @param {string} context - Context for error messages
   * @throws {Error} If subscription is invalid
   */
  static validateSubscription(subscription, context = 'Subscription') {
    if (!subscription) {
      throw new Error(`${context} is required`);
    }
    
    if (typeof subscription !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    if (typeof subscription.unsubscribe !== 'function') {
      throw new Error(`${context} must have unsubscribe() method`);
    }
    
    // ID is optional but if present should be valid
    if (subscription.id !== undefined && 
        typeof subscription.id !== 'string' && 
        typeof subscription.id !== 'number') {
      throw new Error(`${context} ID must be string or number if provided`);
    }
  }
  
  /**
   * Validate array with flexible element validation
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Array} array - Array to validate
   * @param {string} context - Context for error messages
   * @param {Object} options - Validation options
   * @throws {Error} If array is invalid
   */
  static validateArray(array, context = 'Array', options = {}) {
    const {
      minLength = 0,
      maxLength = null,
      allowEmpty = true,
      elementValidator = null
    } = options;
    
    if (!Array.isArray(array)) {
      throw new Error(`${context} must be an array`);
    }
    
    if (array.length < minLength) {
      throw new Error(`${context} must have at least ${minLength} elements`);
    }
    
    if (maxLength !== null && array.length > maxLength) {
      throw new Error(`${context} cannot have more than ${maxLength} elements`);
    }
    
    if (!allowEmpty && array.length === 0) {
      throw new Error(`${context} cannot be empty`);
    }
    
    // Validate each element if validator provided
    if (elementValidator && typeof elementValidator === 'function') {
      array.forEach((element, index) => {
        try {
          elementValidator(element, `${context}[${index}]`);
        } catch (error) {
          throw new Error(`${context}[${index}]: ${error.message}`);
        }
      });
    }
  }
  
  /**
   * Validate cache key generation input
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {string} type - Cache type
   * @param {*} identifier - Cache identifier
   * @param {string} context - Context for error messages
   * @throws {Error} If cache key inputs are invalid
   */
  static validateCacheKey(type, identifier, context = 'Cache key') {
    if (!type || typeof type !== 'string') {
      throw new Error(`${context} type must be a non-empty string`);
    }
    
    if (identifier === undefined) {
      throw new Error(`${context} identifier cannot be undefined`);
    }
    
    // null identifier is allowed for some use cases
    if (identifier !== null) {
      const identifierType = typeof identifier;
      if (identifierType !== 'string' && 
          identifierType !== 'number' && 
          identifierType !== 'object') {
        throw new Error(`${context} identifier must be string, number, or object`);
      }
    }
  }
  
  /**
   * Validate bulk operation parameters
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Array} items - Items to process
   * @param {Function} operationFn - Operation function
   * @param {string} context - Context for error messages
   * @throws {Error} If bulk operation parameters are invalid
   */
  static validateBulkOperation(items, operationFn, context = 'Bulk operation') {
    if (!Array.isArray(items)) {
      throw new Error(`${context} items must be an array`);
    }
    
    if (typeof operationFn !== 'function') {
      throw new Error(`${context} operation function is required`);
    }
    
    if (items.length === 0) {
      throw new Error(`${context} items array cannot be empty`);
    }
  }
  
  /**
   * Validate configuration options object
   * CRITICAL: Must be synchronous - no await!
   * 
   * @param {Object} options - Options object to validate
   * @param {Object} schema - Expected schema for options
   * @param {string} context - Context for error messages
   * @throws {Error} If options are invalid
   */
  static validateOptions(options, schema, context = 'Options') {
    if (!options) {
      options = {}; // Default to empty object
    }
    
    if (typeof options !== 'object') {
      throw new Error(`${context} must be an object`);
    }
    
    if (!schema || typeof schema !== 'object') {
      return; // No schema validation
    }
    
    // Validate each option against schema
    for (const [key, expectedConfig] of Object.entries(schema)) {
      const value = options[key];
      
      // Check required options
      if (expectedConfig.required && (value === undefined || value === null)) {
        throw new Error(`${context}.${key} is required`);
      }
      
      // Type validation
      if (value !== undefined && expectedConfig.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (actualType !== expectedConfig.type) {
          throw new Error(`${context}.${key} must be ${expectedConfig.type}, got ${actualType}`);
        }
      }
      
      // Range validation for numbers
      if (typeof value === 'number' && expectedConfig.min !== undefined) {
        if (value < expectedConfig.min) {
          throw new Error(`${context}.${key} must be at least ${expectedConfig.min}`);
        }
      }
      
      if (typeof value === 'number' && expectedConfig.max !== undefined) {
        if (value > expectedConfig.max) {
          throw new Error(`${context}.${key} cannot exceed ${expectedConfig.max}`);
        }
      }
      
      // Enum validation
      if (value !== undefined && expectedConfig.enum) {
        if (!expectedConfig.enum.includes(value)) {
          throw new Error(`${context}.${key} must be one of: ${expectedConfig.enum.join(', ')}`);
        }
      }
    }
  }
}

/**
 * Convenience validation functions for common patterns
 */

/**
 * Quick entity ID validation for DataScript (positive number)
 */
export const validateDataScriptEntityId = (entityId, context = 'Entity ID') => {
  ValidationUtils.validateEntityId(entityId, context, {
    allowNumbers: true,
    allowStrings: false,
    requirePositive: true
  });
};

/**
 * Quick query spec validation for DataScript format
 */
export const validateDataScriptQuery = (querySpec, context = 'Query specification') => {
  // First check basic query spec
  if (!querySpec) {
    throw new Error(`${context} is required`);
  }
  
  if (typeof querySpec !== 'object') {
    throw new Error(`${context} must be an object`);
  }
  
  // DataScript-specific validation - must have both find and where
  if (!querySpec.find || !querySpec.where) {
    throw new Error(`DataScript ${context} must have both find and where clauses`);
  }
  
  // Then validate with general validator
  ValidationUtils.validateQuerySpec(querySpec, context);
};

/**
 * Quick update data validation for DataScript format
 */
export const validateDataScriptUpdateData = (updateData, context = 'Update data') => {
  ValidationUtils.validateUpdateData(updateData, context, {
    requireDataScriptFormat: true,
    allowEmptyObject: false
  });
};

/**
 * Quick attribute name validation for DataScript format
 */
export const validateDataScriptAttributeName = (attributeName, context = 'Attribute name') => {
  ValidationUtils.validateAttributeName(attributeName, context, {
    requireDataScriptFormat: true
  });
};

/**
 * Standard ResourceManager interface validation
 */
export const validateStandardResourceManagerInterface = (resourceManager, context = 'ResourceManager') => {
  ValidationUtils.validateResourceManagerInterface(resourceManager, context, [
    'query', 'subscribe', 'getSchema'
  ]);
};