/**
 * Configuration validation service for Gemini Compatible Agent
 */
class ConfigValidationService {
  constructor() {
    this.validationRules = new Map();
  }

  /**
   * Validates configuration against defined rules
   * @param {Object} config - Configuration object to validate
   * @returns {boolean} - Validation result
   */
  validateConfig(config) {
    if (!config || typeof config !== 'object') {
      return false;
    }
    
    for (const [key, rule] of this.validationRules) {
      if (!rule(config[key])) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Adds a new validation rule
   * @param {string} key - Configuration key to validate
   * @param {Function} validationFn - Validation function
   */
  addValidationRule(key, validationFn) {
    this.validationRules.set(key, validationFn);
  }
}

export default ConfigValidationService;
