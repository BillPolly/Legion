/**
 * Environment Manager for Cerebrate
 * Manages environment detection, validation, and configuration
 */
export class EnvironmentManager {
  constructor() {
    this.environments = ['development', 'production', 'test', 'staging'];
    this.currentEnv = this.detectEnvironment();
  }
  
  /**
   * Detect current environment
   * @returns {string} - Current environment
   * @private
   */
  detectEnvironment() {
    return process.env.NODE_ENV || 'development';
  }
  
  /**
   * Get current environment
   * @returns {string} - Current environment
   */
  getCurrentEnvironment() {
    return this.currentEnv;
  }
  
  /**
   * Set current environment
   * @param {string} env - Environment name
   */
  setEnvironment(env) {
    if (!this.environments.includes(env)) {
      throw new Error(`Invalid environment: ${env}. Valid environments: ${this.environments.join(', ')}`);
    }
    
    this.currentEnv = env;
    process.env.NODE_ENV = env;
  }
  
  /**
   * Check if current environment is development
   * @returns {boolean} - Is development
   */
  isDevelopment() {
    return this.currentEnv === 'development';
  }
  
  /**
   * Check if current environment is production
   * @returns {boolean} - Is production
   */
  isProduction() {
    return this.currentEnv === 'production';
  }
  
  /**
   * Check if current environment is test
   * @returns {boolean} - Is test
   */
  isTest() {
    return this.currentEnv === 'test';
  }
  
  /**
   * Check if current environment is staging
   * @returns {boolean} - Is staging
   */
  isStaging() {
    return this.currentEnv === 'staging';
  }
  
  /**
   * Get environment-specific configuration
   * @param {Object} configs - Environment configurations
   * @param {string} environment - Target environment
   * @returns {Object} - Environment configuration
   */
  getEnvironmentConfig(configs, environment = null) {
    const targetEnv = environment || this.currentEnv;
    
    if (!configs[targetEnv]) {
      throw new Error(`No configuration found for environment: ${targetEnv}`);
    }
    
    return { ...configs[targetEnv] };
  }
  
  /**
   * Validate environment variables
   * @param {Object} requirements - Variable requirements
   * @returns {Object} - Validation result
   */
  validateEnvironment(requirements) {
    const result = {
      valid: true,
      errors: [],
      warnings: [],
      values: {}
    };
    
    for (const [varName, config] of Object.entries(requirements)) {
      const value = process.env[varName];
      
      // Check if required variable is present
      if (config.required && (value === undefined || value === '')) {
        result.valid = false;
        result.errors.push(`Missing required environment variable: ${varName}`);
        continue;
      }
      
      // Use default value if not present and not required
      const finalValue = value !== undefined ? value : config.default;
      
      if (finalValue !== undefined) {
        try {
          // Convert value to specified type
          const convertedValue = this.convertValue(finalValue, config.type || 'string');
          result.values[varName] = convertedValue;
          
          // Validate against custom validator if provided
          if (config.validator && !config.validator(convertedValue)) {
            result.valid = false;
            result.errors.push(`Invalid value for ${varName}: ${finalValue}`);
          }
        } catch (error) {
          result.valid = false;
          result.errors.push(`Failed to convert ${varName}: ${error.message}`);
        }
      }
      
      // Add warnings for deprecated variables
      if (config.deprecated) {
        result.warnings.push(`Environment variable ${varName} is deprecated: ${config.deprecated}`);
      }
    }
    
    return result;
  }
  
  /**
   * Convert value to specified type
   * @param {string} value - String value
   * @param {string} type - Target type
   * @returns {*} - Converted value
   */
  convertValue(value, type) {
    switch (type) {
      case 'string':
        return String(value);
        
      case 'number':
        const num = Number(value);
        if (isNaN(num)) {
          throw new Error(`Cannot convert "${value}" to number`);
        }
        return num;
        
      case 'integer':
        const int = parseInt(value, 10);
        if (isNaN(int)) {
          throw new Error(`Cannot convert "${value}" to integer`);
        }
        return int;
        
      case 'float':
        const float = parseFloat(value);
        if (isNaN(float)) {
          throw new Error(`Cannot convert "${value}" to float`);
        }
        return float;
        
      case 'boolean':
        if (typeof value === 'boolean') return value;
        const lowerValue = String(value).toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(lowerValue)) return true;
        if (['false', '0', 'no', 'off'].includes(lowerValue)) return false;
        throw new Error(`Cannot convert "${value}" to boolean`);
        
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          throw new Error(`Cannot parse "${value}" as JSON`);
        }
        
      case 'array':
        if (Array.isArray(value)) return value;
        return String(value).split(',').map(s => s.trim());
        
      default:
        return value;
    }
  }
  
  /**
   * Get environment information
   * @returns {Object} - Environment info
   */
  getEnvironmentInfo() {
    return {
      nodeEnv: this.currentEnv,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      versions: process.versions
    };
  }
  
  /**
   * Check if environment variable exists
   * @param {string} varName - Variable name
   * @returns {boolean} - Exists
   */
  hasEnvironmentVariable(varName) {
    return process.env.hasOwnProperty(varName);
  }
  
  /**
   * Get environment variable with type conversion
   * @param {string} varName - Variable name
   * @param {string} type - Type to convert to
   * @param {*} defaultValue - Default value
   * @returns {*} - Variable value
   */
  getEnvironmentVariable(varName, type = 'string', defaultValue = undefined) {
    const value = process.env[varName];
    
    if (value === undefined) {
      return defaultValue;
    }
    
    try {
      return this.convertValue(value, type);
    } catch (error) {
      console.warn(`Failed to convert environment variable ${varName}: ${error.message}`);
      return defaultValue;
    }
  }
  
  /**
   * Set environment variable
   * @param {string} varName - Variable name
   * @param {*} value - Variable value
   */
  setEnvironmentVariable(varName, value) {
    process.env[varName] = String(value);
  }
  
  /**
   * Remove environment variable
   * @param {string} varName - Variable name
   */
  removeEnvironmentVariable(varName) {
    delete process.env[varName];
  }
  
  /**
   * Get all environment variables with prefix
   * @param {string} prefix - Variable prefix
   * @returns {Object} - Environment variables
   */
  getEnvironmentVariables(prefix = '') {
    const variables = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        variables[key] = value;
      }
    }
    
    return variables;
  }
  
  /**
   * Create environment requirements template
   * @param {Array} variables - Variable names
   * @returns {Object} - Requirements template
   */
  createRequirementsTemplate(variables) {
    const template = {};
    
    for (const varName of variables) {
      template[varName] = {
        required: true,
        type: 'string',
        description: `Description for ${varName}`,
        default: undefined,
        validator: null
      };
    }
    
    return template;
  }
  
  /**
   * Validate common environment requirements
   * @returns {Object} - Validation result
   */
  validateCommonRequirements() {
    const commonRequirements = {
      'NODE_ENV': {
        required: false,
        type: 'string',
        default: 'development',
        validator: (value) => this.environments.includes(value)
      },
      'PORT': {
        required: false,
        type: 'integer',
        default: 3000,
        validator: (value) => value > 0 && value <= 65535
      }
    };
    
    return this.validateEnvironment(commonRequirements);
  }
  
  /**
   * Generate environment documentation
   * @param {Object} requirements - Variable requirements
   * @returns {string} - Documentation
   */
  generateDocumentation(requirements) {
    const lines = [];
    lines.push('# Environment Variables\n');
    
    for (const [varName, config] of Object.entries(requirements)) {
      lines.push(`## ${varName}`);
      
      if (config.description) {
        lines.push(`**Description:** ${config.description}`);
      }
      
      lines.push(`**Required:** ${config.required ? 'Yes' : 'No'}`);
      lines.push(`**Type:** ${config.type || 'string'}`);
      
      if (config.default !== undefined) {
        lines.push(`**Default:** ${config.default}`);
      }
      
      if (config.deprecated) {
        lines.push(`**Deprecated:** ${config.deprecated}`);
      }
      
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  /**
   * Export current environment state
   * @returns {Object} - Environment state
   */
  exportState() {
    return {
      environment: this.currentEnv,
      variables: this.getEnvironmentVariables(),
      info: this.getEnvironmentInfo(),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Import environment state
   * @param {Object} state - Environment state
   */
  importState(state) {
    if (state.environment) {
      this.setEnvironment(state.environment);
    }
    
    if (state.variables) {
      for (const [key, value] of Object.entries(state.variables)) {
        this.setEnvironmentVariable(key, value);
      }
    }
  }
}