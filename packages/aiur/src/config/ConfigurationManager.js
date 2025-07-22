/**
 * Configuration Manager
 * 
 * Manages configuration loading, validation, environment variable substitution,
 * hot reloading, encryption, and hierarchical configuration merging
 */

import { EventEmitter } from 'events';
import { readFile, writeFile, access } from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';

export class ConfigurationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      environment: options.environment || 'development',
      configPath: options.configPath || './config',
      validateOnLoad: options.validateOnLoad !== false,
      encryptionKey: options.encryptionKey || this._generateEncryptionKey(),
      ...options
    };

    // Configuration state
    this.config = {};
    this.baseConfig = {};
    this.schema = null;
    this.sources = [];
    this.watchers = [];

    // Change tracking
    this.changeListeners = [];
  }

  /**
   * Load configuration from multiple sources
   */
  async loadFromSources(sources) {
    this.sources = sources;
    let mergedConfig = {};

    for (const source of sources) {
      try {
        const sourceConfig = await this._loadFromSource(source);
        mergedConfig = this._deepMerge(mergedConfig, sourceConfig);
      } catch (error) {
        this.emit('source-load-error', { source, error });
        if (source.required !== false) {
          throw error;
        }
      }
    }

    // Resolve environment variables
    const resolvedConfig = this.resolveEnvironmentVariables(mergedConfig);

    // Validate if schema is set
    if (this.schema && this.options.validateOnLoad) {
      this.validateConfig(resolvedConfig);
    }

    this.config = resolvedConfig;
    this.emit('config-loaded', this.config);

    return this.config;
  }

  /**
   * Set configuration schema for validation
   */
  setSchema(schema) {
    this.schema = schema;
  }

  /**
   * Validate configuration against schema
   */
  validateConfig(config) {
    if (!this.schema) {
      throw new Error('No schema defined for validation');
    }

    const errors = this._validateAgainstSchema(config, this.schema, '');
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Update configuration and notify listeners
   */
  async updateConfig(updates) {
    const oldConfig = { ...this.config };
    this.config = this._deepMerge(this.config, updates);

    // Validate updated config
    if (this.schema) {
      try {
        this.validateConfig(this.config);
      } catch (error) {
        // Rollback on validation failure
        this.config = oldConfig;
        throw error;
      }
    }

    this.emit('config-changed', {
      oldConfig,
      newConfig: this.config,
      changes: updates
    });

    // Notify change listeners
    for (const listener of this.changeListeners) {
      try {
        await listener(this.config, oldConfig);
      } catch (error) {
        this.emit('change-listener-error', { listener, error });
      }
    }

    return this.config;
  }

  /**
   * Register configuration change listener
   */
  onConfigChange(listener) {
    this.changeListeners.push(listener);
  }

  /**
   * Resolve environment variables in configuration
   */
  resolveEnvironmentVariables(config) {
    return this._deepResolve(config, (value) => {
      if (typeof value === 'string' && value.includes('${')) {
        return value.replace(/\${([^}]+)}/g, (match, varName) => {
          return process.env[varName] || match;
        });
      }
      return value;
    });
  }

  /**
   * Set base configuration
   */
  setBaseConfig(baseConfig) {
    this.baseConfig = baseConfig;
  }

  /**
   * Merge configuration with current config
   */
  mergeConfig(configToMerge) {
    this.config = this._deepMerge(this.baseConfig, this.config, configToMerge);
    this.emit('config-merged', this.config);
    return this.config;
  }

  /**
   * Get configuration value
   */
  get(path, defaultValue = undefined) {
    return this._getNestedValue(this.config, path, defaultValue);
  }

  /**
   * Set configuration value
   */
  set(path, value) {
    this._setNestedValue(this.config, path, value);
    this.emit('config-value-changed', { path, value });
  }

  /**
   * Get entire configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Set entire configuration
   */
  setConfig(config) {
    this.config = { ...config };
    this.emit('config-set', this.config);
  }

  /**
   * Encrypt sensitive configuration values
   */
  async encryptSensitiveValues(config, sensitiveKeys = ['password', 'secret', 'key', 'token']) {
    return this._deepTransform(config, (key, value) => {
      if (typeof value === 'string' && this._isSensitiveKey(key, sensitiveKeys)) {
        return this._encrypt(value);
      }
      return value;
    });
  }

  /**
   * Decrypt sensitive configuration values
   */
  async decryptSensitiveValues(config) {
    return this._deepTransform(config, (key, value) => {
      if (typeof value === 'string' && this._isEncrypted(value)) {
        try {
          return this._decrypt(value);
        } catch (error) {
          this.emit('decryption-error', { key, error });
          return value;
        }
      }
      return value;
    });
  }

  /**
   * Load configuration from a single source
   * @private
   */
  async _loadFromSource(source) {
    switch (source.type) {
      case 'env':
        return this._loadFromEnvironment(source.prefix || '');
        
      case 'file':
        return this._loadFromFile(source.path);
        
      case 'object':
        return source.data || {};
        
      case 'url':
        return this._loadFromUrl(source.url);
        
      default:
        throw new Error(`Unknown configuration source type: ${source.type}`);
    }
  }

  /**
   * Load configuration from environment variables
   * @private
   */
  _loadFromEnvironment(prefix) {
    const config = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        // Convert nested keys (AIUR_DB_HOST -> db.host)
        const nestedKey = configKey.replace(/_/g, '.');
        this._setNestedValue(config, nestedKey, this._parseValue(value));
      }
    }

    return config;
  }

  /**
   * Load configuration from file
   * @private
   */
  async _loadFromFile(filePath) {
    try {
      await access(filePath);
      const content = await readFile(filePath, 'utf8');
      
      if (filePath.endsWith('.json')) {
        return JSON.parse(content);
      } else if (filePath.endsWith('.js')) {
        // Dynamic import for ES modules
        const module = await import(filePath);
        return module.default || module;
      }
      
      throw new Error(`Unsupported file format: ${filePath}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {}; // File doesn't exist, return empty config
      }
      throw error;
    }
  }

  /**
   * Load configuration from URL
   * @private
   */
  async _loadFromUrl(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch config from ${url}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      throw new Error(`Failed to load configuration from URL: ${error.message}`);
    }
  }

  /**
   * Deep merge multiple objects
   * @private
   */
  _deepMerge(...objects) {
    const result = {};
    
    for (const obj of objects) {
      for (const [key, value] of Object.entries(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = this._deepMerge(result[key] || {}, value);
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Deep resolve values using a resolver function
   * @private
   */
  _deepResolve(obj, resolver) {
    if (obj === null || typeof obj !== 'object') {
      return resolver(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this._deepResolve(item, resolver));
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this._deepResolve(value, resolver);
    }

    return result;
  }

  /**
   * Deep transform values using a transformer function
   * @private
   */
  _deepTransform(obj, transformer, parentKey = '') {
    if (obj === null || typeof obj !== 'object') {
      return transformer(parentKey, obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item, index) => 
        this._deepTransform(item, transformer, `${parentKey}[${index}]`)
      );
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = parentKey ? `${parentKey}.${key}` : key;
      result[key] = this._deepTransform(value, transformer, fullKey);
    }

    return result;
  }

  /**
   * Get nested value from object using dot notation
   * @private
   */
  _getNestedValue(obj, path, defaultValue = undefined) {
    if (!path) return obj;
    
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return defaultValue;
      }
      current = current[key];
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation
   * @private
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
   * Parse string value to appropriate type
   * @private
   */
  _parseValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (!isNaN(value) && !isNaN(parseFloat(value))) return parseFloat(value);
    return value;
  }

  /**
   * Simple schema validation
   * @private
   */
  _validateAgainstSchema(value, schema, path) {
    const errors = [];
    
    if (schema.type && typeof value !== schema.type) {
      errors.push(`${path}: expected ${schema.type}, got ${typeof value}`);
      return errors;
    }
    
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path}: value must be one of ${schema.enum.join(', ')}`);
    }
    
    if (schema.minLength && typeof value === 'string' && value.length < schema.minLength) {
      errors.push(`${path}: string must be at least ${schema.minLength} characters`);
    }
    
    if (schema.minimum && typeof value === 'number' && value < schema.minimum) {
      errors.push(`${path}: value must be at least ${schema.minimum}`);
    }
    
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in value)) {
          errors.push(`${path}: missing required field '${field}'`);
        }
      }
    }
    
    if (schema.properties && typeof value === 'object') {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          const fieldPath = path ? `${path}.${key}` : key;
          errors.push(...this._validateAgainstSchema(value[key], subSchema, fieldPath));
        }
      }
    }
    
    return errors;
  }

  /**
   * Check if key is sensitive
   * @private
   */
  _isSensitiveKey(key, sensitiveKeys) {
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey.toLowerCase())
    );
  }

  /**
   * Encrypt value
   * @private
   */
  _encrypt(value) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.options.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `encrypted:${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt value
   * @private
   */
  _decrypt(encryptedValue) {
    if (!this._isEncrypted(encryptedValue)) {
      return encryptedValue;
    }

    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const [prefix, ivHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const key = crypto.scryptSync(this.options.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Check if value is encrypted
   * @private
   */
  _isEncrypted(value) {
    return typeof value === 'string' && value.startsWith('encrypted:');
  }

  /**
   * Generate encryption key
   * @private
   */
  _generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }
}