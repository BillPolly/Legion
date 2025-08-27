/**
 * Configuration Loader for Cerebrate
 * Loads configuration from various sources (files, environment, etc.)
 */
import fs from 'fs';
import path from 'path';
import { Configuration } from './Configuration.js';

export class ConfigLoader {
  constructor(options = {}) {
    this.options = {
      encoding: options.encoding || 'utf8',
      throwOnMissing: options.throwOnMissing || false,
      ...options
    };
  }
  
  /**
   * Load configuration from file
   * @param {string} filePath - Path to configuration file
   * @returns {Configuration} - Configuration instance
   */
  loadFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      if (this.options.throwOnMissing) {
        throw new Error(`Configuration file not found: ${filePath}`);
      }
      
      // Return default configuration if file doesn't exist
      return new Configuration();
    }
    
    try {
      const content = fs.readFileSync(filePath, this.options.encoding);
      const format = this.detectFormat(filePath);
      const parsed = this.parseContent(content, format);
      
      return new Configuration(parsed);
    } catch (error) {
      throw new Error(`Failed to parse configuration file: ${filePath} - ${error.message}`);
    }
  }
  
  /**
   * Load configuration from multiple files
   * @param {Array<string>} filePaths - Array of file paths
   * @returns {Configuration} - Merged configuration
   */
  loadFromFiles(filePaths) {
    const config = new Configuration();
    
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        try {
          const fileConfig = this.loadFromFile(filePath);
          config.merge(fileConfig.export());
        } catch (error) {
          if (this.options.throwOnMissing) {
            throw error;
          }
          
          // Continue with other files if one fails
          console.warn(`Failed to load configuration file: ${filePath} - ${error.message}`);
        }
      }
    }
    
    return config;
  }
  
  /**
   * Load configuration from environment variables
   * @param {string} prefix - Environment variable prefix
   * @returns {Configuration} - Configuration with env values
   */
  loadFromEnvironment(prefix = '') {
    const config = new Configuration();
    const envVars = this.getEnvironmentVariables(prefix);
    
    for (const [key, value] of Object.entries(envVars)) {
      const configKey = this.transformEnvKey(key, prefix);
      config.set(configKey, value);
    }
    
    return config;
  }
  
  /**
   * Get environment variables with prefix
   * @param {string} prefix - Variable prefix
   * @returns {Object} - Environment variables
   * @private
   */
  getEnvironmentVariables(prefix) {
    const envVars = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        envVars[key] = value;
      }
    }
    
    return envVars;
  }
  
  /**
   * Transform environment variable key to config key
   * @param {string} envKey - Environment variable key
   * @param {string} prefix - Variable prefix
   * @returns {string} - Config key
   * @private
   */
  transformEnvKey(envKey, prefix) {
    // Remove prefix and convert to lowercase dot notation
    let key = envKey.slice(prefix.length);
    key = key.toLowerCase();
    key = key.replace(/_/g, '.');
    
    return key;
  }
  
  /**
   * Save configuration to file
   * @param {Configuration} config - Configuration to save
   * @param {string} filePath - Output file path
   */
  saveToFile(config, filePath) {
    const format = this.detectFormat(filePath);
    const content = this.serializeContent(config.export(), format);
    
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, content, this.options.encoding);
  }
  
  /**
   * Detect file format from extension
   * @param {string} filePath - File path
   * @returns {string} - Format (json, yaml, env)
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return 'json';
      case '.yaml':
      case '.yml':
        return 'yaml';
      case '.env':
        return 'env';
      default:
        return 'json';
    }
  }
  
  /**
   * Parse content based on format
   * @param {string} content - File content
   * @param {string} format - Content format
   * @returns {Object} - Parsed configuration
   * @private
   */
  parseContent(content, format) {
    switch (format) {
      case 'json':
        return JSON.parse(content);
        
      case 'yaml':
        // For now, just support JSON until YAML parser is added
        try {
          return JSON.parse(content);
        } catch {
          throw new Error('YAML parsing not implemented yet');
        }
        
      case 'env':
        return this.parseEnvContent(content);
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Parse .env file content
   * @param {string} content - Env file content
   * @returns {Object} - Parsed configuration
   * @private
   */
  parseEnvContent(content) {
    const config = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) {
        continue;
      }
      
      let key = trimmed.slice(0, equalIndex).trim();
      let value = trimmed.slice(equalIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Convert key to config path
      const configKey = this.transformEnvKey(key, '');
      this.setNestedValue(config, configKey, value);
    }
    
    return config;
  }
  
  /**
   * Set nested value in object
   * @param {Object} obj - Target object
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   * @private
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      
      current = current[key];
    }
    
    const finalKey = keys[keys.length - 1];
    current[finalKey] = this.convertValue(value);
  }
  
  /**
   * Convert string value to appropriate type
   * @param {string} value - String value
   * @returns {*} - Converted value
   * @private
   */
  convertValue(value) {
    // Try to convert to appropriate type
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    
    // Try number conversion
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return parseFloat(value);
    }
    
    // Try JSON parsing for objects/arrays
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        // Return as string if JSON parsing fails
      }
    }
    
    return value;
  }
  
  /**
   * Serialize content based on format
   * @param {Object} config - Configuration object
   * @param {string} format - Output format
   * @returns {string} - Serialized content
   * @private
   */
  serializeContent(config, format) {
    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);
        
      case 'yaml':
        // For now, just use JSON until YAML serializer is added
        return JSON.stringify(config, null, 2);
        
      case 'env':
        return this.serializeToEnv(config);
        
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  /**
   * Serialize configuration to .env format
   * @param {Object} config - Configuration object
   * @param {string} prefix - Key prefix
   * @returns {string} - Env format content
   * @private
   */
  serializeToEnv(config, prefix = '') {
    const lines = [];
    
    for (const [key, value] of Object.entries(config)) {
      const fullKey = prefix ? `${prefix}_${key.toUpperCase()}` : key.toUpperCase();
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively handle nested objects
        lines.push(...this.serializeToEnv(value, fullKey).split('\n').filter(Boolean));
      } else {
        // Convert value to string
        let stringValue = value;
        
        if (typeof value === 'string' && (value.includes(' ') || value.includes('\n'))) {
          stringValue = `"${value}"`;
        } else if (typeof value === 'object') {
          stringValue = JSON.stringify(value);
        }
        
        lines.push(`${fullKey}=${stringValue}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Load configuration with hierarchy
   * @param {Object} options - Loading options
   * @returns {Configuration} - Final configuration
   */
  loadWithHierarchy(options = {}) {
    const {
      baseFile = 'config.json',
      environmentFile = null,
      envPrefix = '',
      environment = process.env.NODE_ENV || 'development'
    } = options;
    
    const config = new Configuration();
    
    // Load base configuration
    if (baseFile && fs.existsSync(baseFile)) {
      const baseConfig = this.loadFromFile(baseFile);
      config.merge(baseConfig.export());
    }
    
    // Load environment-specific configuration
    const envFile = environmentFile || `config.${environment}.json`;
    if (fs.existsSync(envFile)) {
      const envConfig = this.loadFromFile(envFile);
      config.merge(envConfig.export());
    }
    
    // Load from environment variables
    if (envPrefix) {
      const envConfig = this.loadFromEnvironment(envPrefix);
      config.merge(envConfig.export());
    }
    
    return config;
  }
  
  /**
   * Validate configuration file exists and is readable
   * @param {string} filePath - File path to validate
   * @returns {boolean} - Is valid
   */
  validateFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }
      
      const stats = fs.statSync(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }
}