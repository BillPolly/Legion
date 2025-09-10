/**
 * Type checking utilities
 */

export class TypeChecker {
  /**
   * Checks if value is a plain object
   * @param {any} value - Value to check
   * @returns {boolean} True if plain object
   */
  static isPlainObject(value) {
    return value !== null && 
           typeof value === 'object' &&
           Object.getPrototypeOf(value) === Object.prototype;
  }

  /**
   * Checks if value is an array
   * @param {any} value - Value to check
   * @returns {boolean} True if array
   */
  static isArray(value) {
    return Array.isArray(value);
  }

  /**
   * Checks if value is a function
   * @param {any} value - Value to check
   * @returns {boolean} True if function
   */
  static isFunction(value) {
    return typeof value === 'function';
  }
}
