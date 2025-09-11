/**
 * Service for managing agent configuration and settings
 * @class AgentConfigurationService
 */
export class AgentConfigurationService {
  /**
   * @param {Object} options - Configuration options
   * @param {number} [options.validateSchema=true] - Whether to validate against schema
   */
  constructor(options = {}) {
    this.config = new Map();
    this.validateSchema = options.validateSchema ?? true;
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key
   * @param {any} value - Configuration value
   * @throws {Error} If key is invalid
   */
  setConfig(key, value) {
    if (!key || typeof key !== 'string') {
      throw new Error('Configuration key must be a non-empty string');
    }
    this.config.set(key, value);
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key
   * @param {any} [defaultValue] - Default value if key not found
   * @returns {any} Configuration value or default
   */
  getConfig(key, defaultValue = undefined) {
    return this.config.has(key) ? this.config.get(key) : defaultValue;
  }

  /**
   * Load multiple configuration values
   * @param {Object} configObject - Configuration object
   * @throws {Error} If configObject is invalid
   */
  loadConfiguration(configObject) {
    if (!configObject || typeof configObject !== 'object') {
      throw new Error('Configuration must be an object');
    }

    if (this.validateSchema && !this.validateConfigSchema(configObject)) {
      throw new Error('Invalid configuration schema');
    }

    Object.entries(configObject).forEach(([key, value]) => {
      this.setConfig(key, value);
    });
  }

  /**
   * Get all configuration as an object
   * @returns {Object} All configuration
   */
  getAllConfig() {
    return Object.fromEntries(this.config);
  }

  /**
   * Validate configuration schema
   * @private
   * @param {Object} config - Configuration to validate
   * @returns {boolean} Whether configuration is valid
   */
  validateConfigSchema(config) {
    // Add schema validation logic here
    return true;
  }
}
