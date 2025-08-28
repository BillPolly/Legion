/**
 * Configuration Management System for Cerebrate
 * Handles nested configuration with validation and environment variable support
 */
export class Configuration {
  constructor(initialConfig = {}) {
    this.data = this.createDefaults();
    this.frozen = false;
    this.snapshots = [];
    
    // Merge initial configuration
    if (Object.keys(initialConfig).length > 0) {
      this.merge(initialConfig);
    }
    
    // Validate the configuration
    this.validate();
  }
  
  /**
   * Create default configuration values
   * @returns {Object} - Default configuration
   * @private
   */
  createDefaults() {
    return {
      server: {
        port: 9222,
        host: 'localhost',
        maxConnections: 100,
        heartbeatInterval: 30000
      },
      extension: {
        debug: false,
        logLevel: 'info',
        panelTitle: 'Cerebrate',
        autoConnect: true
      },
      agent: {
        model: 'claude-3-sonnet',
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 30000
      },
      websocket: {
        reconnectDelay: 1000,
        maxReconnectAttempts: 5,
        messageTimeout: 10000
      },
      logging: {
        level: 'info',
        format: 'json',
        enableConsole: true,
        enableFile: false
      },
      security: {
        allowedOrigins: ['chrome-extension://'],
        maxPayloadSize: 1048576, // 1MB
        enableCors: true
      }
    };
  }
  
  /**
   * Get configuration value by path
   * @param {string} path - Dot-notation path
   * @param {*} defaultValue - Default value if path doesn't exist
   * @returns {*} - Configuration value
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = this.data;
    
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return this.resolveValue(defaultValue);
      }
      
      current = current[key];
    }
    
    return this.resolveValue(current !== undefined ? current : defaultValue);
  }
  
  /**
   * Set configuration value by path
   * @param {string} path - Dot-notation path
   * @param {*} value - Value to set
   */
  set(path, value) {
    if (this.frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }
    
    // Validate the value
    this.validateValue(path, value);
    
    const keys = path.split('.');
    let current = this.data;
    
    // Navigate to the parent object
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      
      current = current[key];
    }
    
    // Set the final value
    const finalKey = keys[keys.length - 1];
    current[finalKey] = this.resolveValue(value);
  }
  
  /**
   * Merge configuration object deeply
   * @param {Object} config - Configuration to merge
   */
  merge(config) {
    if (this.frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }
    
    this.data = this.deepMerge(this.data, config);
  }
  
  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} - Merged object
   * @private
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (this.isObject(result[key]) && this.isObject(source[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check if value is an object
   * @param {*} value - Value to check
   * @returns {boolean} - Is object
   * @private
   */
  isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  
  /**
   * Resolve environment variables in value
   * @param {*} value - Value to resolve
   * @returns {*} - Resolved value
   * @private
   */
  resolveValue(value) {
    if (typeof value === 'string' && value.includes('${')) {
      return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return process.env[varName] || match;
      });
    }
    
    return value;
  }
  
  /**
   * Validate configuration value
   * @param {string} path - Configuration path
   * @param {*} value - Value to validate
   * @private
   */
  validateValue(path, value) {
    const validationRules = {
      'server.port': (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0 && num <= 65535;
      },
      'server.host': (val) => typeof val === 'string' && val.length > 0,
      'server.maxConnections': (val) => Number.isInteger(val) && val > 0,
      'agent.maxTokens': (val) => Number.isInteger(val) && val > 0,
      'agent.temperature': (val) => typeof val === 'number' && val >= 0 && val <= 2,
      'websocket.reconnectDelay': (val) => Number.isInteger(val) && val >= 0,
      'websocket.maxReconnectAttempts': (val) => Number.isInteger(val) && val >= 0,
      'security.maxPayloadSize': (val) => Number.isInteger(val) && val > 0
    };
    
    const rule = validationRules[path];
    if (rule && !rule(value)) {
      const expectedTypes = {
        'server.port': 'must be a number between 0 and 65535',
        'server.host': 'must be a non-empty string',
        'server.maxConnections': 'must be a positive integer',
        'agent.maxTokens': 'must be a positive integer',
        'agent.temperature': 'must be a number between 0 and 2',
        'websocket.reconnectDelay': 'must be a non-negative integer',
        'websocket.maxReconnectAttempts': 'must be a non-negative integer',
        'security.maxPayloadSize': 'must be a positive integer'
      };
      
      throw new Error(`Invalid value for ${path}: ${expectedTypes[path] || 'invalid value'}`);
    }
  }
  
  /**
   * Validate entire configuration
   * @private
   */
  validate() {
    // Required fields validation
    const required = [
      'server.port',
      'server.host',
      'agent.model'
    ];
    
    for (const path of required) {
      const value = this.get(path);
      if (value === undefined || value === null || value === '') {
        throw new Error(`Invalid configuration: ${path} is required`);
      }
    }
    
    // Type validation
    if (typeof this.get('server.port') !== 'number' || this.get('server.port') < 0) {
      throw new Error('Invalid configuration: server.port must be >= 0');
    }
    
    if (typeof this.get('server.host') !== 'string' || this.get('server.host') === '') {
      throw new Error('Invalid configuration: server.host cannot be empty');
    }
  }
  
  /**
   * Freeze configuration to prevent modifications
   */
  freeze() {
    this.frozen = true;
    Object.freeze(this.data);
  }
  
  /**
   * Check if configuration is frozen
   * @returns {boolean} - Is frozen
   */
  isFrozen() {
    return this.frozen;
  }
  
  /**
   * Export configuration as plain object
   * @returns {Object} - Configuration object
   */
  export() {
    return JSON.parse(JSON.stringify(this.data));
  }
  
  /**
   * Create configuration snapshot
   * @returns {string} - Snapshot ID
   */
  createSnapshot() {
    const snapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: this.export(),
      timestamp: new Date().toISOString()
    };
    
    this.snapshots.push(snapshot);
    return snapshot.id;
  }
  
  /**
   * Restore configuration from snapshot
   * @param {string} snapshotId - Snapshot ID
   */
  restoreSnapshot(snapshotId) {
    if (this.frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }
    
    const snapshot = this.snapshots.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }
    
    this.data = snapshot.data;
  }
  
  /**
   * Get configuration summary
   * @returns {Object} - Configuration summary
   */
  getSummary() {
    const flatKeys = this.getFlatKeys(this.data);
    const sections = new Set();
    
    flatKeys.forEach(key => {
      const section = key.split('.')[0];
      sections.add(section);
    });
    
    return {
      totalKeys: flatKeys.length,
      sections: Array.from(sections),
      environment: process.env.NODE_ENV || 'development',
      frozen: this.frozen,
      snapshots: this.snapshots.length
    };
  }
  
  /**
   * Get flat list of all configuration keys
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Key prefix
   * @returns {Array} - Flat keys
   * @private
   */
  getFlatKeys(obj, prefix = '') {
    let keys = [];
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (this.isObject(obj[key])) {
          keys = keys.concat(this.getFlatKeys(obj[key], fullKey));
        } else {
          keys.push(fullKey);
        }
      }
    }
    
    return keys;
  }
  
  /**
   * Get all configuration keys matching pattern
   * @param {RegExp|string} pattern - Pattern to match
   * @returns {Array} - Matching keys
   */
  getKeys(pattern) {
    const allKeys = this.getFlatKeys(this.data);
    
    if (typeof pattern === 'string') {
      return allKeys.filter(key => key.includes(pattern));
    }
    
    if (pattern instanceof RegExp) {
      return allKeys.filter(key => pattern.test(key));
    }
    
    return allKeys;
  }
  
  /**
   * Check if configuration has key
   * @param {string} path - Configuration path
   * @returns {boolean} - Has key
   */
  has(path) {
    return this.get(path) !== undefined;
  }
  
  /**
   * Delete configuration key
   * @param {string} path - Configuration path
   */
  delete(path) {
    if (this.frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }
    
    const keys = path.split('.');
    let current = this.data;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      
      if (!current[key] || typeof current[key] !== 'object') {
        return; // Path doesn't exist
      }
      
      current = current[key];
    }
    
    const finalKey = keys[keys.length - 1];
    delete current[finalKey];
  }
  
  /**
   * Clear all configuration
   */
  clear() {
    if (this.frozen) {
      throw new Error('Configuration is frozen and cannot be modified');
    }
    
    this.data = this.createDefaults();
  }
}