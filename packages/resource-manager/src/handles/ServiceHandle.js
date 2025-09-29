/**
 * ServiceHandle - Handle implementation for service endpoints and APIs
 * 
 * Provides Handle interface for accessing and interacting with service endpoints,
 * API connections, and service configurations.
 * 
 * URI Examples:
 * - legion://local/service/api/users
 * - legion://remote/service/database/connection
 * - legion://cluster/service/auth/token
 */

export class ServiceHandle {
  constructor(dataSource, parsed) {
    if (!dataSource) {
      throw new Error('DataSource is required for ServiceHandle');
    }
    
    if (!parsed) {
      throw new Error('Parsed URI components are required for ServiceHandle');
    }

    this.dataSource = dataSource;
    this.parsed = parsed;
    this._destroyed = false;
    
    // Service-specific properties
    this.servicePath = parsed.path;
    this.server = parsed.server;
    this.resourceType = parsed.resourceType;
    
    // Create proxy for transparent property access
    return new Proxy(this, {
      get(target, prop, receiver) {
        // Handle methods and private properties directly
        if (prop in target || prop.startsWith('_') || typeof target[prop] === 'function') {
          return Reflect.get(target, prop, receiver);
        }
        
        // For service access, delegate to getService
        if (typeof prop === 'string') {
          return target.getService(prop);
        }
        
        return Reflect.get(target, prop, receiver);
      },
      
      set(target, prop, value) {
        // Don't allow setting private properties or methods
        if (prop.startsWith('_') || prop in target) {
          return Reflect.set(target, prop, value);
        }
        
        // For service configuration, delegate to setService
        if (typeof prop === 'string') {
          target.setService(prop, value);
          return true;
        }
        
        return Reflect.set(target, prop, value);
      },
      
      has(target, prop) {
        // Check if it's a ServiceHandle property/method
        if (prop in target) {
          return true;
        }
        
        // Check if service exists
        return target.hasService(prop);
      }
    });
  }

  /**
   * Get service information
   * @param {string} serviceName - Service name (optional, uses parsed path if not provided)
   * @returns {*} Service information
   */
  getService(serviceName = null) {
    this._checkDestroyed();
    
    const queryService = serviceName || this.servicePath;
    const results = this.dataSource.query({ find: queryService });
    
    if (results.length > 0) {
      return results[0].value;
    }
    
    return undefined;
  }

  /**
   * Set service configuration
   * @param {string} serviceName - Service name (or value if serviceName is omitted)
   * @param {*} value - Service configuration (optional if serviceName contains value)
   * @returns {Object} Update result
   */
  setService(serviceName, value = undefined) {
    this._checkDestroyed();
    
    let updateService, updateValue;
    
    if (value === undefined && arguments.length === 1) {
      // setService(value) - set value for this handle's service
      updateService = this.servicePath;
      updateValue = serviceName;
    } else {
      // setService(serviceName, value) - set specific service/value
      updateService = serviceName;
      updateValue = value;
    }
    
    return this.dataSource.update({
      set: { [updateService]: updateValue }
    });
  }

  /**
   * Check if service exists
   * @param {string} serviceName - Service name
   * @returns {boolean} True if service exists
   */
  hasService(serviceName) {
    this._checkDestroyed();
    
    const results = this.dataSource.query({ find: serviceName });
    return results.length > 0;
  }

  /**
   * Get all services matching pattern
   * @param {string|RegExp} pattern - Service pattern to match
   * @returns {Array} Array of matching service entries
   */
  findServices(pattern) {
    this._checkDestroyed();
    
    return this.dataSource.query({
      where: { servicePattern: pattern }
    });
  }

  /**
   * Get service metadata
   * @returns {Object} Service metadata
   */
  getMetadata() {
    this._checkDestroyed();
    return this.dataSource.getMetadata();
  }

  /**
   * Get service schema
   * @returns {Object} Service schema
   */
  getSchema() {
    this._checkDestroyed();
    return this.dataSource.getSchema();
  }

  /**
   * Subscribe to service changes
   * @param {Function} callback - Change notification callback
   * @param {Object} options - Subscription options
   * @returns {Object} Subscription object with unsubscribe method
   */
  subscribe(callback, options = {}) {
    this._checkDestroyed();
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Callback function is required');
    }

    // Subscribe to changes for this service or all services
    const querySpec = options.watchAll 
      ? { find: 'all' }
      : { find: this.servicePath };
      
    return this.dataSource.subscribe(querySpec, callback);
  }

  /**
   * Validate service configuration
   * @param {*} value - Value to validate (optional, validates current value if not provided)
   * @returns {boolean} True if valid
   */
  validate(value = undefined) {
    this._checkDestroyed();
    
    const valueToValidate = value !== undefined ? value : this.getService();
    
    return this.dataSource.validate({
      service: this.servicePath,
      value: valueToValidate
    });
  }

  /**
   * Create query builder for services
   * @returns {Object} Service query builder
   */
  query() {
    this._checkDestroyed();
    return this.dataSource.queryBuilder(this);
  }

  /**
   * Get URI for this service
   * @returns {string} Legion URI
   */
  toURI() {
    return `legion://${this.server}/${this.resourceType}/${this.servicePath}`;
  }

  /**
   * Create child Handle for nested service
   * @param {string} subService - Sub-service name
   * @returns {ServiceHandle} Child service Handle
   */
  child(subService) {
    this._checkDestroyed();
    
    const childPath = this.servicePath ? `${this.servicePath}/${subService}` : subService;
    const childParsed = {
      ...this.parsed,
      path: childPath
    };
    
    return new ServiceHandle(this.dataSource, childParsed);
  }

  /**
   * Get parent Handle (if this is a nested service)
   * @returns {ServiceHandle|null} Parent Handle or null if at root
   */
  parent() {
    this._checkDestroyed();
    
    if (!this.servicePath || !this.servicePath.includes('/')) {
      return null;
    }
    
    const parts = this.servicePath.split('/');
    parts.pop(); // Remove last part
    const parentPath = parts.join('/');
    
    const parentParsed = {
      ...this.parsed,
      path: parentPath
    };
    
    return new ServiceHandle(this.dataSource, parentParsed);
  }

  /**
   * Export service configuration as object
   * @param {Object} options - Export options
   * @returns {Object} Service configuration object
   */
  export(options = {}) {
    this._checkDestroyed();
    
    const results = this.dataSource.query({ find: 'all' });
    const services = {};
    
    for (const result of results) {
      services[result.key] = result.value;
    }
    
    return services;
  }

  /**
   * Clone this Handle
   * @returns {ServiceHandle} Cloned Handle
   */
  clone() {
    this._checkDestroyed();
    return new ServiceHandle(this.dataSource, { ...this.parsed });
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
      return '[ServiceHandle (destroyed)]';
    }
    
    return `[ServiceHandle: ${this.toURI()}]`;
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
      type: 'ServiceHandle',
      uri: this.toURI(),
      servicePath: this.servicePath,
      server: this.server,
      hasService: this.getService() !== undefined
    };
  }

  // Private helper methods

  /**
   * Check if Handle is destroyed and throw if so
   * @private
   */
  _checkDestroyed() {
    if (this._destroyed) {
      throw new Error('ServiceHandle has been destroyed');
    }
  }
}

export default ServiceHandle;