/**
 * Configuration helper utilities
 */

export class ConfigHelper {
  /**
   * Validates and merges configuration objects
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User provided configuration
   * @returns {Object} Merged configuration
   */
  static mergeConfig(defaultConfig, userConfig) {
    return {
      ...defaultConfig,
      ...userConfig
    };
  }

  /**
   * Ensures required configuration fields are present
   * @param {Object} config - Configuration to validate 
   * @param {Array<string>} requiredFields - List of required field names
   * @throws {Error} If required fields are missing
   */
  static validateRequired(config, requiredFields) {
    const missing = requiredFields.filter(field => !(field in config));
    if (missing.length > 0) {
      throw new Error(`Missing required config fields: ${missing.join(', ')}`);
    }
  }
}
