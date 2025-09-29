/**
 * ConfigHandle - Handle implementation for configuration and environment variables
 * 
 * Provides Handle interface for accessing and manipulating configuration values
 * from environment variables, ResourceManager settings, and other configuration sources.
 * 
 * URI Examples:
 * - legion://local/env/ANTHROPIC_API_KEY
 * - legion://local/env/DATABASE_URL
 * - legion://server/config/settings.json
 */

export class ConfigHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for ConfigHandle');
    }
    
    if (!parsed) {
      throw new Error('Parsed URI components are required for ConfigHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;
    
    // Configuration-specific properties
    this.configKey = parsed.path;
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;
    
    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || (typeof prop === 'string' && prop.startsWith('_')) || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }
        
        // For configuration access, delegate to getValue
        if (typeof prop === 'string') {
          return target.getValue(prop);
        }
        
        return Reflect.get(target, prop, receiver);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if ((typeof prop === 'string' && prop.startsWith('_')) || prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // For configuration, delegate to setValue
        if (typeof prop === 'string') {
          target.setValue(prop, value);
          return true;
        }
        
        return Reflect.set(target, prop, value);
      },
      
      has(target, prop) {
        // Check if it's a ConfigHandle property/method
        if (prop in target) {
          return true;
        }
        
        // Check if configuration key exists
        return target.hasConfigKey(prop);
      }
    });
  }

  /**
   * Get configuration value by key
   * @param {string} key - Configuration key (optional, uses parsed path if not provided)
   * @returns {*} Configuration value
   */
  getValue(key = null) {
    this._checkDestroyed();
    
    const queryKey = key || this.configKey;
    const results = this.dataSource.query({ find: queryKey });
    
    if (results.length > 0) {
      return results[0].value;
    }
    
    return undefined;
  }

  /**
   * Set configuration value
   * @param {string} key - Configuration key (or value if key is omitted)
   * @param {*} value - Configuration value (optional if key contains value)
   * @returns {Object} Update result
   */
  setValue(key, value = undefined) {
    this._checkDestroyed();
    
    let updateKey, updateValue;
    
    if (value === undefined && arguments.length === 1) {
      // setValue(value) - set value for this handle's key
      updateKey = this.configKey;
      updateValue = key;
    } else {
      // setValue(key, value) - set specific key/value
      updateKey = key;
      updateValue = value;
    }
    
    return this.dataSource.update({
      set: { [updateKey]: updateValue }
    });
  }

  /**
   * Check if configuration key exists
   * @param {string} key - Configuration key
   * @returns {boolean} True if key exists
   */
  hasConfigKey(key) {
    this._checkDestroyed();
    
    const results = this.dataSource.query({ find: key });
    return results.length > 0;
  }

  /**
   * Get all configuration keys matching pattern
   * @param {string|RegExp} pattern - Key pattern to match
   * @returns {Array} Array of matching configuration entries
   */
  findKeys(pattern) {
    this._checkDestroyed();
    
    return this.dataSource.query({
      where: { keyPattern: pattern }
    });
  }

  /**
   * Get configuration metadata
   * @returns {Object} Configuration metadata
   */
  getMetadata() {
    this._checkDestroyed();
    return this.dataSource.getMetadata();
  }

  /**
   * Get configuration schema
   * @returns {Object} Configuration schema
   */
  getSchema() {
    this._checkDestroyed();
    return this.dataSource.getSchema();
  }

  /**
   * Subscribe to configuration changes
   * @param {Function} callback - Change notification callback
   * @param {Object} options - Subscription options
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(callback, options = {}) {
    this._checkDestroyed();
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    // Subscribe to changes for this configuration key or all keys
    const querySpec = options.watchAll 
      ? { find: 'all' }
      : { find: this.configKey };
      
    return this.dataSource.subscribe(querySpec, callback);
  }

  /**
   * Validate configuration value
   * @param {*} value - Value to validate (optional, validates current value if not provided)
   * @returns {boolean} True if valid
   */
  validate(value = undefined) {
    this._checkDestroyed();
    
    const valueToValidate = value !== undefined ? value : this.getValue();
    
    return this.dataSource.validate({
      key: this.configKey,
      value: valueToValidate
    });
  }

  /**
   * Create query builder for configuration
   * @returns {Object} Configuration query builder
   */
  query() {
    this._checkDestroyed();
    return this.dataSource.queryBuilder(this);
  }

  /**
   * Get URI for this configuration
   * @returns {string} Legion URI
   */
  toURI() {
    return `legion://${this.server}/${this.resourceType}/${this.configKey}`;
  }

  /**
   * Create child Handle for nested configuration
   * @param {string} subKey - Sub-configuration key
   * @returns {ConfigHandle} Child configuration Handle
   */
  child(subKey) {
    this._checkDestroyed();
    
    const childPath = this.configKey ? `${this.configKey}.${subKey}` : subKey;
    const childParsed = {
      ...this.parsed,
      path: childPath
    };
    
    return new ConfigHandle(this.dataSource, childParsed);
  }

  /**
   * Get parent Handle (if this is a nested configuration)
   * @returns {ConfigHandle|null} Parent Handle or null if at root
   */
  parent() {
    this._checkDestroyed();
    
    if (!this.configKey || !this.configKey.includes('.')) {
      return null;
    }
    
    const parts = this.configKey.split('.');
    parts.pop(); // Remove last part
    const parentPath = parts.join('.');
    
    const parentParsed = {
      ...this.parsed,
      path: parentPath
    };
    
    return new ConfigHandle(this.dataSource, parentParsed);
  }

  /**
   * Export configuration as object
   * @param {Object} options - Export options
   * @returns {Object} Configuration object
   */
  export(options = {}) {
    this._checkDestroyed();
    
    const results = this.dataSource.query({ find: 'all' });
    const config = {};
    
    for (const result of results) {
      if (options.includeSecrets || !result.type.includes('secret')) {
        config[result.key] = result.value;
      }
    }
    
    return config;
  }

  /**
   * Clone this Handle
   * @returns {ConfigHandle} Cloned Handle
   */
  clone() {
    this._checkDestroyed();
    return new ConfigHandle(this.dataSource, { ...this.parsed });
  }

  /**
   * Check if Handle is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._destroyed;
  }

  /**
   * Destroy this Handle and cleanup resources
   */
  destroy() {
    if (this._destroyed) return;
    
    // Cleanup any subscriptions or resources
    this._destroyed = true;
    this.dataSource = null;
    this.parsed = null;
  }

  /**
   * String representation
   * @returns {string} String representation
   */
  toString() {
    if (this._destroyed) {
      return '[ConfigHandle (destroyed)]';
    }
    
    return `[ConfigHandle: ${this.toURI()}]`;
  }

  /**
   * JSON representation
   * @returns {Object} JSON-serializable object
   */
  toJSON() {
    if (this._destroyed) {
      return { destroyed: true };
    }
    
    return {
      type: 'ConfigHandle',
      uri: this.toURI(),
      configKey: this.configKey,
      server: this.server,
      hasValue: this.getValue() !== undefined
    };
  }

  // Private helper methods

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('ConfigHandle has been destroyed');
    }
  }
}

export default ConfigHandle;