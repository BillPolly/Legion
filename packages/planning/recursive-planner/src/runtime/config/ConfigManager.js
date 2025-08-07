/**
 * Configuration Manager - Centralized configuration handling
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_CONFIG, REQUIRED_ENV_VARS, ENV_TYPE_CONVERSIONS } from './defaults.js';
import { ConfigurationError } from '../../foundation/types/errors/errors.js';

/**
 * Configuration Manager class - Singleton pattern
 */
export class ConfigManager {
  static _instance = null;
  
  constructor() {
    if (ConfigManager._instance) {
      return ConfigManager._instance;
    }
    
    this._config = null;
    this._loaded = false;
    this._envVars = {};
    
    ConfigManager._instance = this;
  }
  
  /**
   * Get singleton instance
   * @returns {ConfigManager} ConfigManager instance
   */
  static getInstance() {
    if (!ConfigManager._instance) {
      ConfigManager._instance = new ConfigManager();
    }
    return ConfigManager._instance;
  }
  
  /**
   * Load configuration from environment
   * @param {string} envPath - Path to .env file (optional)
   * @returns {ConfigManager} Self for chaining
   */
  load(envPath = null) {
    if (this._loaded) {
      return this;
    }
    
    // Load environment variables
    this._loadEnvironmentVariables(envPath);
    
    // Build configuration
    this._config = this._buildConfiguration();
    
    // Validate configuration
    this._validateConfiguration();
    
    this._loaded = true;
    return this;
  }
  
  /**
   * Get configuration value
   * @param {string} path - Dot notation path (e.g., 'llm.provider')
   * @param {any} defaultValue - Default value if not found
   * @returns {any} Configuration value
   */
  get(path, defaultValue = undefined) {
    if (!this._loaded) {
      this.load();
    }
    
    return this._getNestedValue(this._config, path, defaultValue);
  }
  
  /**
   * Get full configuration object
   * @returns {Object} Complete configuration
   */
  getConfig() {
    if (!this._loaded) {
      this.load();
    }
    
    return { ...this._config };
  }
  
  /**
   * Check if a feature is available based on required environment variables
   * @param {string} feature - Feature name (e.g., 'llm.anthropic')
   * @returns {boolean} True if feature is available
   */
  isFeatureAvailable(feature) {
    const parts = feature.split('.');
    let requiredVars = REQUIRED_ENV_VARS;
    
    for (const part of parts) {
      if (requiredVars && requiredVars[part]) {
        requiredVars = requiredVars[part];
      } else {
        return false;
      }
    }
    
    if (Array.isArray(requiredVars)) {
      return requiredVars.every(varName => this._envVars[varName]);
    }
    
    return false;
  }
  
  /**
   * Get available LLM providers
   * @returns {Array<string>} List of available providers
   */
  getAvailableLLMProviders() {
    const providers = [];
    
    if (this.isFeatureAvailable('llm.anthropic')) {
      providers.push('anthropic');
    }
    
    if (this.isFeatureAvailable('llm.openai')) {
      providers.push('openai');
    }
    
    return providers;
  }
  
  /**
   * Find the project root directory by looking for package.json
   * @param {string} startPath - Starting path to search from
   * @returns {string} Path to project root
   */
  _findProjectRoot(startPath = null) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    let currentPath = startPath || __dirname;
    
    // Search up the directory tree for package.json with name "recursive-planner"
    while (currentPath !== '/' && currentPath !== '.') {
      const packageJsonPath = join(currentPath, 'package.json');
      
      if (existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
          if (packageJson.name === 'recursive-planner') {
            return currentPath;
          }
        } catch (error) {
          // Not a valid package.json, continue searching
        }
      }
      
      // Check if RecursivePlanner is in the path (fallback)
      if (currentPath.includes('RecursivePlanner')) {
        const parts = currentPath.split('/');
        const index = parts.findIndex(part => part === 'RecursivePlanner');
        if (index >= 0) {
          return parts.slice(0, index + 1).join('/');
        }
      }
      
      currentPath = dirname(currentPath);
    }
    
    // Fallback to process.cwd() if not found
    return process.cwd();
  }
  
  /**
   * Load environment variables from .env file and process.env
   * @param {string} envPath - Path to .env file
   */
  _loadEnvironmentVariables(envPath = null) {
    // Start with process.env
    this._envVars = { ...process.env };
    
    // Try to load .env file from project root
    const projectRoot = this._findProjectRoot();
    const envFilePath = envPath || resolve(projectRoot, '.env');
    
    try {
      const envContent = readFileSync(envFilePath, 'utf-8');
      const envLines = envContent.split('\n');
      
      for (const line of envLines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // Parse KEY=VALUE format
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex).trim();
          const value = trimmedLine.substring(equalIndex + 1).trim();
          
          // Only set if not already in process.env (process.env takes precedence)
          if (!this._envVars[key]) {
            this._envVars[key] = value;
          }
        }
      }
    } catch (error) {
      // .env file is optional, just use process.env
      if (process.env.NODE_ENV !== 'test') {
        console.warn('Could not load .env file:', error.message);
      }
    }
    
    // Debug logging for tests
    if (process.env.NODE_ENV === 'test' && process.env.DEBUG_CONFIG) {
      console.log('ConfigManager: Project root:', projectRoot);
      console.log('ConfigManager: .env path:', envFilePath);
      console.log('ConfigManager: .env exists:', existsSync(envFilePath));
      console.log('ConfigManager: ANTHROPIC_API_KEY loaded:', !!this._envVars.ANTHROPIC_API_KEY);
    }
  }
  
  /**
   * Build configuration object from defaults and environment variables
   * @returns {Object} Configuration object
   */
  _buildConfiguration() {
    // Start with deep copy of defaults
    const config = this._deepClone(DEFAULT_CONFIG);
    
    // Override with environment variables
    config.environment = this._envVars.NODE_ENV || config.environment;
    
    // LLM Configuration
    if (this._envVars.LLM_PROVIDER) {
      config.llm.provider = this._envVars.LLM_PROVIDER;
    }
    
    // Anthropic configuration
    if (this._envVars.ANTHROPIC_API_KEY) {
      config.llm.anthropic.apiKey = this._envVars.ANTHROPIC_API_KEY;
    }
    if (this._envVars.ANTHROPIC_MODEL) {
      config.llm.anthropic.model = this._envVars.ANTHROPIC_MODEL;
    }
    
    // OpenAI configuration
    if (this._envVars.OPENAI_API_KEY) {
      config.llm.openai.apiKey = this._envVars.OPENAI_API_KEY;
    }
    if (this._envVars.OPENAI_MODEL) {
      config.llm.openai.model = this._envVars.OPENAI_MODEL;
    }
    
    // Database configuration
    if (this._envVars.QDRANT_HOST) {
      config.database.qdrant.host = this._envVars.QDRANT_HOST;
    }
    if (this._envVars.QDRANT_PORT) {
      config.database.qdrant.port = this._convertType(this._envVars.QDRANT_PORT, 'number');
    }
    
    if (this._envVars.MONGODB_URL) {
      config.database.mongodb.url = this._envVars.MONGODB_URL;
    }
    if (this._envVars.MONGODB_DATABASE) {
      config.database.mongodb.database = this._envVars.MONGODB_DATABASE;
    }
    
    // API Keys
    if (this._envVars.SERPER_API_KEY) {
      config.apis.serper.apiKey = this._envVars.SERPER_API_KEY;
    }
    if (this._envVars.GITHUB_PAT) {
      config.apis.github.token = this._envVars.GITHUB_PAT;
    }
    if (this._envVars.GITHUB_ORG) {
      config.apis.github.org = this._envVars.GITHUB_ORG;
    }
    if (this._envVars.GITHUB_USER) {
      config.apis.github.user = this._envVars.GITHUB_USER;
    }
    if (this._envVars.GITHUB_AGENT_ORG) {
      config.apis.github.agentOrg = this._envVars.GITHUB_AGENT_ORG;
    }
    
    // Server configuration
    if (this._envVars.STORAGE_ACTOR_PORT) {
      config.server.storageActor.port = this._convertType(this._envVars.STORAGE_ACTOR_PORT, 'number');
    }
    if (this._envVars.STORAGE_ACTOR_PATH) {
      config.server.storageActor.path = this._envVars.STORAGE_ACTOR_PATH;
    }
    if (this._envVars.STORAGE_BROWSER_PORT) {
      config.server.storageBrowser.port = this._convertType(this._envVars.STORAGE_BROWSER_PORT, 'number');
    }
    
    // Storage configuration
    if (this._envVars.STORAGE_PROVIDER) {
      config.storage.provider = this._envVars.STORAGE_PROVIDER;
    }
    
    // Railway deployment
    if (this._envVars.RAILWAY) {
      config.deployment = config.deployment || {};
      config.deployment.railway = {
        projectId: this._envVars.RAILWAY,
        apiToken: this._envVars.RAILWAY_API_TOKEN
      };
    }
    
    // Apply type conversions for any additional env vars
    this._applyTypeConversions(config);
    
    return config;
  }
  
  /**
   * Apply type conversions to environment variables
   * @param {Object} config - Configuration object to modify
   */
  _applyTypeConversions(config) {
    for (const [envVar, type] of Object.entries(ENV_TYPE_CONVERSIONS)) {
      if (this._envVars[envVar]) {
        const value = this._convertType(this._envVars[envVar], type);
        
        // Apply the converted value to the appropriate config path
        // This is a simplified mapping - could be made more sophisticated
        const configPath = this._mapEnvVarToConfigPath(envVar);
        if (configPath) {
          this._setNestedValue(config, configPath, value);
        }
      }
    }
  }
  
  /**
   * Convert string value to specified type
   * @param {string} value - String value to convert
   * @param {string} type - Target type
   * @returns {any} Converted value
   */
  _convertType(value, type) {
    switch (type) {
      case 'number':
        const num = Number(value);
        return isNaN(num) ? 0 : num;
      
      case 'boolean':
        return value.toLowerCase() === 'true' || value === '1';
      
      case 'string':
      default:
        return value;
    }
  }
  
  /**
   * Map environment variable name to config path
   * @param {string} envVar - Environment variable name
   * @returns {string|null} Config path or null
   */
  _mapEnvVarToConfigPath(envVar) {
    // Simple mapping - could be made more sophisticated with a lookup table
    const mappings = {
      'LLM_MAX_TOKENS': 'llm.anthropic.maxTokens', // Default to anthropic, could be smarter
      'LLM_TEMPERATURE': 'llm.anthropic.temperature',
      'LLM_TIMEOUT': 'llm.anthropic.timeout',
      'FRAMEWORK_AGENT_MAX_RETRIES': 'framework.agent.maxRetries',
      'FRAMEWORK_AGENT_DEBUG_MODE': 'framework.agent.debugMode'
    };
    
    return mappings[envVar] || null;
  }
  
  /**
   * Validate configuration
   * @throws {ConfigurationError} If configuration is invalid
   */
  _validateConfiguration() {
    const errors = [];
    
    // Validate LLM configuration
    if (this._config.llm.provider) {
      const provider = this._config.llm.provider;
      const available = this.getAvailableLLMProviders();
      
      if (!available.includes(provider)) {
        errors.push(`LLM provider '${provider}' is configured but API key not available. Available providers: ${available.join(', ')}`);
      }
    }
    
    // Validate port numbers
    const ports = [
      this._config.database.qdrant.port,
      this._config.server.storageActor.port,
      this._config.server.storageBrowser.port
    ];
    
    for (const port of ports) {
      if (port && (port < 1 || port > 65535)) {
        errors.push(`Invalid port number: ${port}`);
      }
    }
    
    if (errors.length > 0) {
      throw new ConfigurationError(
        `Configuration validation failed: ${errors.join('; ')}`,
        'validation',
        errors
      );
    }
  }
  
  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to search
   * @param {string} path - Dot notation path
   * @param {any} defaultValue - Default value
   * @returns {any} Found value or default
   */
  _getNestedValue(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }
  
  /**
   * Set nested value in object using dot notation
   * @param {Object} obj - Object to modify
   * @param {string} path - Dot notation path
   * @param {any} value - Value to set
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  /**
   * Deep clone an object
   * @param {any} obj - Object to clone
   * @returns {any} Deep cloned object
   */
  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this._deepClone(item));
    }
    
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this._deepClone(obj[key]);
      }
    }
    
    return cloned;
  }
  
  /**
   * Reset the singleton instance (mainly for testing)
   */
  static reset() {
    ConfigManager._instance = null;
  }
}