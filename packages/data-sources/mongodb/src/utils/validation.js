/**
 * Validation utilities for MongoDB DataSource
 */

/**
 * Validate that an object implements the DataSource interface
 * @param {Object} instance - Instance to validate
 * @param {string} className - Name of the class for error messages
 */
export function validateDataSourceInterface(instance, className) {
  const requiredMethods = [
    'query',
    'subscribe',
    'getSchema',
    'queryBuilder'
  ];
  
  for (const method of requiredMethods) {
    if (typeof instance[method] !== 'function') {
      throw new Error(`${className} must implement ${method}() method`);
    }
  }
  
  // Optional methods that should be functions if they exist
  const optionalMethods = ['update', 'validate'];
  
  for (const method of optionalMethods) {
    if (instance[method] && typeof instance[method] !== 'function') {
      throw new Error(`${className}.${method} must be a function if implemented`);
    }
  }
}