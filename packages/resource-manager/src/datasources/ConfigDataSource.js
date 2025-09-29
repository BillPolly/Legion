/**
 * ConfigDataSource - DataSource implementation for environment configuration
 * 
 * Provides access to environment variables and configuration stored in ResourceManager.
 * Supports querying configuration by key patterns, subscribing to changes,
 * and validation against configuration schemas.
 * 
 * URI Examples:
 * - legion://local/env/ANTHROPIC_API_KEY
 * - legion://local/env/DATABASE.*
 * - legion://server/env/MONGO_URL
 */

import { validateDataSourceInterface } from '@legion/handle/src/DataSource.js';

export class ConfigDataSource {
  constructor(context) {
    if (!context || !context.resourceManager) {
      throw new Error('Context with ResourceManager is required');
    }

    this.context = context;
    this.resourceManager = context.resourceManager;
    this.parsed = context.parsed;
    
    // Configuration access
    this._configPath = this.parsed.path;
    this._subscriptions = new Map();
    this._changeListeners = new Set();
    
    // Generate schema with caching
    this._schema = null;
    this._metadata = null;
    
    // Validate interface compliance
    validateDataSourceInterface(this, 'ConfigDataSource');
  }

  /**
   * Execute query against configuration - SYNCHRONOUS
   * @param {Object} querySpec - Query specification
   * @returns {Array} Configuration results
   */
  query(querySpec) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }

    const results = [];
    
    if (querySpec.find === 'all') {
      // Return all environment variables
      const envVars = this.resourceManager.get('env') || {};
      for (const [key, value] of Object.entries(envVars)) {
        results.push({ key, value, type: this._getConfigType(key) });
      }
    } else if (querySpec.find) {
      // Find specific configuration key
      const value = this._getConfigValue(querySpec.find);
      if (value !== undefined) {
        results.push({ 
          key: querySpec.find, 
          value, 
          type: this._getConfigType(querySpec.find) 
        });
      }
    } else if (querySpec.where) {
      // Filter configurations based on conditions
      const envVars = this.resourceManager.get('env') || {};
      
      for (const [key, value] of Object.entries(envVars)) {
        if (this._matchesCondition(key, value, querySpec.where)) {
          results.push({ key, value, type: 'env' });
        }
      }
    }

    return results;
  }

  /**
   * Set up subscription for configuration changes - SYNCHRONOUS
   * @param {Object} querySpec - Query specification to monitor
   * @param {Function} callback - Change notification callback
   * @returns {Object} Subscription object
   */
  subscribe(querySpec, callback) {
    if (!querySpec || typeof querySpec !== 'object') {
      throw new Error('Query specification must be an object');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    const subscriptionId = Date.now() + Math.random();
    const subscription = {
      id: subscriptionId,
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscriptionId);
        this._changeListeners.delete(callback);
      }
    };

    this._subscriptions.set(subscriptionId, subscription);
    this._changeListeners.add(callback);

    return subscription;
  }

  /**
   * Get configuration schema - SYNCHRONOUS
   * @returns {Object} Schema describing configuration structure
   */
  getSchema() {
    if (!this._schema) {
      this._schema = this._generateConfigSchema();
    }
    return this._schema;
  }

  /**
   * Update configuration values - SYNCHRONOUS
   * @param {Object} updateSpec - Update specification
   * @returns {Object} Update result
   */
  update(updateSpec) {
    if (!updateSpec || typeof updateSpec !== 'object') {
      throw new Error('Update specification must be an object');
    }

    const changes = [];
    
    if (updateSpec.set) {
      for (const [key, value] of Object.entries(updateSpec.set)) {
        const oldValue = this._getConfigValue(key);
        this.resourceManager.set(key, value);
        
        changes.push({
          type: 'update',
          key,
          oldValue,
          newValue: value,
          timestamp: Date.now()
        });
      }
    }

    // Notify subscribers
    this._notifySubscribers(changes);

    return {
      success: true,
      changes,
      metadata: {
        changedKeys: changes.map(c => c.key),
        timestamp: Date.now()
      }
    };
  }

  /**
   * Validate configuration data - SYNCHRONOUS
   * @param {*} data - Data to validate
   * @returns {boolean} True if valid
   */
  validate(data) {
    if (data === null || data === undefined) {
      return false;
    }

    // Basic validation against configuration schema
    const schema = this.getSchema();
    
    if (typeof data === 'object' && data.key && data.value !== undefined) {
      // Validate individual config entry
      return this._validateConfigEntry(data.key, data.value, schema);
    }

    return false;
  }

  /**
   * Get configuration metadata - SYNCHRONOUS
   * @returns {Object} Metadata about configuration
   */
  getMetadata() {
    if (!this._metadata) {
      const envVars = this.resourceManager.get('env') || {};
      
      this._metadata = {
        dataSourceType: 'ConfigDataSource',
        configPath: this._configPath,
        totalKeys: Object.keys(envVars).length,
        subscriptionCount: this._subscriptions.size,
        schema: this.getSchema(),
        capabilities: {
          query: true,
          subscribe: true,
          update: true,
          validate: true,
          queryBuilder: true
        },
        lastModified: Date.now()
      };
    }
    
    return this._metadata;
  }

  /**
   * Create query builder for configuration - SYNCHRONOUS
   * @param {Handle} sourceHandle - Source Handle
   * @returns {Object} Configuration query builder
   */
  queryBuilder(sourceHandle) {
    if (!sourceHandle) {
      throw new Error('Source Handle is required for query builder');
    }

    return new ConfigQueryBuilder(sourceHandle, this);
  }

  // Private helper methods

  /**
   * Get configuration value by key path
   * @param {string} keyPath - Configuration key path (supports dot notation)
   * @returns {*} Configuration value
   * @private
   */
  _getConfigValue(keyPath) {
    if (keyPath.startsWith('env.')) {
      return this.resourceManager.get(keyPath);
    }
    
    // For plain key names, check if they exist in the env object first
    const envVars = this.resourceManager.get('env') || {};
    if (envVars.hasOwnProperty(keyPath)) {
      return envVars[keyPath];
    }
    
    // Fall back to direct access to ResourceManager
    return this.resourceManager.get(keyPath);
  }

  /**
   * Get configuration type
   * @param {string} key - Configuration key
   * @returns {string} Configuration type
   * @private
   */
  _getConfigType(key) {
    if (key.startsWith('env.')) return 'environment';
    if (key.includes('URL') || key.includes('Uri')) return 'url';
    if (key.includes('KEY') || key.includes('Token')) return 'secret';
    if (key.includes('PORT')) return 'number';
    return 'string';
  }

  /**
   * Check if key/value matches query condition
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @param {Object} condition - Query condition
   * @returns {boolean} True if matches
   * @private
   */
  _matchesCondition(key, value, condition) {
    if (condition.keyPattern) {
      const pattern = new RegExp(condition.keyPattern);
      if (!pattern.test(key)) return false;
    }

    if (condition.valuePattern && typeof value === 'string') {
      const pattern = new RegExp(condition.valuePattern);
      if (!pattern.test(value)) return false;
    }

    if (condition.type) {
      const actualType = this._getConfigType(key);
      if (actualType !== condition.type) return false;
    }

    return true;
  }

  /**
   * Generate configuration schema
   * @returns {Object} Configuration schema
   * @private
   */
  _generateConfigSchema() {
    const envVars = this.resourceManager.get('env') || {};
    const attributes = {};

    for (const key of Object.keys(envVars)) {
      attributes[key] = {
        type: this._getConfigType(key),
        required: key.includes('API_KEY') || key.includes('URL'),
        description: this._generateKeyDescription(key)
      };
    }

    return {
      version: '1.0.0',
      type: 'configuration',
      attributes,
      relationships: {},
      constraints: {
        requiredKeys: Object.keys(attributes).filter(key => attributes[key].required)
      }
    };
  }

  /**
   * Generate description for configuration key
   * @param {string} key - Configuration key
   * @returns {string} Description
   * @private
   */
  _generateKeyDescription(key) {
    if (key.includes('API_KEY')) return `API key for ${key.replace('_API_KEY', '')} service`;
    if (key.includes('URL')) return `Connection URL for ${key.replace('_URL', '')} service`;
    if (key.includes('PORT')) return `Port number for ${key.replace('_PORT', '')} service`;
    if (key.includes('TOKEN')) return `Authentication token for ${key.replace('_TOKEN', '')} service`;
    return `Configuration value for ${key}`;
  }

  /**
   * Validate configuration entry against schema
   * @param {string} key - Configuration key
   * @param {*} value - Configuration value
   * @param {Object} schema - Configuration schema
   * @returns {boolean} True if valid
   * @private
   */
  _validateConfigEntry(key, value, schema) {
    const attribute = schema.attributes[key];
    if (!attribute) return true; // Unknown keys are allowed

    switch (attribute.type) {
      case 'number':
        return !isNaN(Number(value));
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'secret':
        return typeof value === 'string' && value.length > 0;
      default:
        return typeof value === 'string';
    }
  }

  /**
   * Notify subscribers of changes
   * @param {Array} changes - Array of change objects
   * @private
   */
  _notifySubscribers(changes) {
    for (const callback of this._changeListeners) {
      try {
        callback(changes);
      } catch (error) {
        console.warn('Configuration change notification failed:', error);
      }
    }
  }
}

/**
 * Configuration-specific query builder
 */
class ConfigQueryBuilder {
  constructor(sourceHandle, dataSource) {
    this._sourceHandle = sourceHandle;
    this._dataSource = dataSource;
    this._operations = [];
  }

  /**
   * Filter by key pattern
   * @param {string|RegExp} pattern - Key pattern to match
   * @returns {ConfigQueryBuilder} Query builder for chaining
   */
  whereKey(pattern) {
    this._operations.push({ type: 'whereKey', pattern });
    return this;
  }

  /**
   * Filter by value pattern
   * @param {string|RegExp} pattern - Value pattern to match
   * @returns {ConfigQueryBuilder} Query builder for chaining
   */
  whereValue(pattern) {
    this._operations.push({ type: 'whereValue', pattern });
    return this;
  }

  /**
   * Filter by configuration type
   * @param {string} type - Configuration type (environment, url, secret, etc.)
   * @returns {ConfigQueryBuilder} Query builder for chaining
   */
  whereType(type) {
    this._operations.push({ type: 'whereType', configType: type });
    return this;
  }

  /**
   * Filter by required status
   * @param {boolean} required - Whether configuration is required
   * @returns {ConfigQueryBuilder} Query builder for chaining
   */
  whereRequired(required = true) {
    this._operations.push({ type: 'whereRequired', required });
    return this;
  }

  /**
   * Get first matching configuration
   * @returns {Handle} Handle for first configuration entry
   */
  first() {
    const querySpec = this._buildQuerySpec();
    const results = this._dataSource.query(querySpec);
    
    if (results.length === 0) {
      return null;
    }

    // Create Handle for first result
    return this._createConfigHandle(results[0]);
  }

  /**
   * Get all matching configurations
   * @returns {Array<Handle>} Array of configuration Handles
   */
  toArray() {
    const querySpec = this._buildQuerySpec();
    const results = this._dataSource.query(querySpec);
    
    return results.map(result => this._createConfigHandle(result));
  }

  /**
   * Count matching configurations
   * @returns {number} Count of matching configurations
   */
  count() {
    const querySpec = this._buildQuerySpec();
    const results = this._dataSource.query(querySpec);
    return results.length;
  }

  /**
   * Build query specification from operations
   * @returns {Object} Query specification
   * @private
   */
  _buildQuerySpec() {
    if (this._operations.length === 0) {
      return { find: 'all' };
    }

    const conditions = {};
    
    for (const op of this._operations) {
      switch (op.type) {
        case 'whereKey':
          conditions.keyPattern = op.pattern instanceof RegExp ? op.pattern.source : op.pattern;
          break;
        case 'whereValue':
          conditions.valuePattern = op.pattern instanceof RegExp ? op.pattern.source : op.pattern;
          break;
        case 'whereType':
          conditions.type = op.configType;
          break;
        case 'whereRequired':
          conditions.required = op.required;
          break;
      }
    }

    return { where: conditions };
  }

  /**
   * Create Handle for configuration entry
   * @param {Object} configEntry - Configuration entry data
   * @returns {Handle} Configuration Handle
   * @private
   */
  _createConfigHandle(configEntry) {
    // This would typically create a ConfigHandle instance
    // For now, return a simple proxy object
    return {
      key: configEntry.key,
      value: configEntry.value,
      type: configEntry.type,
      uri: `legion://local/env/${configEntry.key}`,
      
      // Handle-like methods
      get() {
        return configEntry.value;
      },
      
      set(newValue) {
        return this._dataSource.update({
          set: { [configEntry.key]: newValue }
        });
      },
      
      toURI() {
        return `legion://local/env/${configEntry.key}`;
      }
    };
  }
}