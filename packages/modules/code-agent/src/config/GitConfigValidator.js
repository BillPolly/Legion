/**
 * GitConfigValidator - Validates and manages Git integration configuration
 * 
 * Provides validation, defaults, and merging for Git configuration options
 * used throughout the code agent Git integration system.
 */

class GitConfigValidator {
  /**
   * Validate a Git configuration object
   * @param {Object} config - Configuration to validate
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateConfig(config) {
    const errors = [];
    
    if (config.enabled && typeof config.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }
    
    if (config.repositoryStrategy && !['new', 'existing', 'auto'].includes(config.repositoryStrategy)) {
      errors.push('repositoryStrategy must be one of: new, existing, auto');
    }
    
    if (config.branchStrategy && !['main', 'feature', 'timestamp', 'phase'].includes(config.branchStrategy)) {
      errors.push('branchStrategy must be one of: main, feature, timestamp, phase');
    }
    
    if (config.commitStrategy && !['manual', 'phase', 'auto'].includes(config.commitStrategy)) {
      errors.push('commitStrategy must be one of: manual, phase, auto');
    }
    
    if (config.pushStrategy && !['never', 'validation', 'always'].includes(config.pushStrategy)) {
      errors.push('pushStrategy must be one of: never, validation, always');
    }
    
    if (config.repositoryUrl && typeof config.repositoryUrl !== 'string') {
      errors.push('repositoryUrl must be a string');
    }
    
    if (config.organization && typeof config.organization !== 'string') {
      errors.push('organization must be a string');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get default Git configuration
   * @returns {Object} Default configuration object
   */
  static getDefaultConfig() {
    return {
      enabled: false,
      repositoryStrategy: 'auto',
      branchStrategy: 'feature',
      commitStrategy: 'phase',
      pushStrategy: 'validation',
      organization: 'AgentResults',
      repositoryUrl: null,
      commitMessage: {
        prefix: '[CodeAgent]',
        includePhase: true,
        includeTimestamp: false,
        includeSummary: true
      }
    };
  }
  
  /**
   * Merge user configuration with defaults
   * @param {Object} config - User configuration
   * @returns {Object} Merged configuration
   */
  static mergeWithDefaults(config) {
    const defaults = this.getDefaultConfig();
    return {
      ...defaults,
      ...config,
      commitMessage: {
        ...defaults.commitMessage,
        ...(config.commitMessage || {})
      }
    };
  }
  
  /**
   * Validate and merge configuration with defaults
   * @param {Object} config - User configuration
   * @param {boolean} throwOnError - Whether to throw on validation errors (default: true)
   * @returns {Object} { config: Object, errors: string[] }
   * @throws {Error} If configuration is invalid and throwOnError is true
   */
  static validateAndMerge(config, throwOnError = true) {
    const merged = this.mergeWithDefaults(config);
    const validation = this.validateConfig(merged);
    
    if (!validation.valid && throwOnError) {
      throw new Error(`Invalid Git configuration: ${validation.errors.join(', ')}`);
    }
    
    return {
      config: merged,
      errors: validation.errors || []
    };
  }
}

export default GitConfigValidator;