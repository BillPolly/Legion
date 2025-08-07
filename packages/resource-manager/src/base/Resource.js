/**
 * Base class for all managed resources in the resource management system
 * Provides the fundamental interface for resource lifecycle management
 */
class Resource {
  /**
   * Create a new resource
   * @param {string} name - Resource name/identifier
   * @param {Object} config - Resource configuration
   * @param {Object} dependencies - Resolved dependencies
   */
  constructor(name, config, dependencies = {}) {
    if (!name || typeof name !== 'string') {
      throw new Error('Resource name is required and must be a string');
    }
    
    if (!config || typeof config !== 'object') {
      throw new Error('Resource config is required and must be an object');
    }

    this.name = name;
    this.config = config;
    this.config = dependencies;
    this.status = 'stopped';
    this.lastHealthCheck = null;
    this.metadata = {
      created: new Date(),
      lastActivity: null,
      initializationTime: null,
      cleanupTime: null
    };
  }

  /**
   * Initialize the resource (start processes, connect to services, etc.)
   * Must be implemented by subclasses
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Invoke a method on the resource
   * Must be implemented by subclasses
   * @param {string} method - Method name to invoke
   * @param {Object} args - Arguments for the method
   * @returns {Promise<*>} Method result
   */
  async invoke(method, args) {
    throw new Error('invoke() must be implemented by subclass');
  }

  /**
   * Clean up the resource (stop processes, close connections, etc.)
   * Must be implemented by subclasses
   * @returns {Promise<void>}
   */
  async cleanup() {
    throw new Error('cleanup() must be implemented by subclass');
  }

  /**
   * Perform a health check on the resource
   * Must be implemented by subclasses
   * @returns {Promise<boolean>} True if healthy, false otherwise
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented by subclass');
  }

  /**
   * Get the current status of the resource
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: this.name,
      status: this.status,
      lastHealthCheck: this.lastHealthCheck,
      metadata: this.metadata,
      uptime: this.calculateUptime()
    };
  }

  /**
   * Calculate resource uptime in milliseconds
   * @returns {number} Uptime in ms, or 0 if not running
   */
  calculateUptime() {
    if (!this.metadata.initializationTime || this.status !== 'running') {
      return 0;
    }
    return Date.now() - this.metadata.initializationTime.getTime();
  }

  /**
   * Resolve dependency references in configuration values
   * Supports template syntax like ${variableName}
   * @param {*} value - Value to resolve (string, object, array, etc.)
   * @returns {*} Resolved value
   */
  resolveDependencies(value) {
    if (typeof value === 'string' && value.includes('${')) {
      return this.resolveTemplateString(value);
    } else if (Array.isArray(value)) {
      return value.map(item => this.resolveDependencies(item));
    } else if (value && typeof value === 'object') {
      const resolved = {};
      for (const [key, val] of Object.entries(value)) {
        resolved[key] = this.resolveDependencies(val);
      }
      return resolved;
    }
    return value;
  }

  /**
   * Resolve template variables in a string
   * @param {string} template - Template string with ${variable} syntax
   * @returns {string} Resolved string
   */
  resolveTemplateString(template) {
    return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      // Check dependencies first
      if (this.config[varName] !== undefined) {
        return this.config[varName];
      }
      
      // Check environment variables with env. prefix
      if (varName.startsWith('env.')) {
        const envVar = varName.slice(4);
        return process.env[envVar] || '';
      }
      
      // Check config values
      if (this.config[varName] !== undefined) {
        return this.config[varName];
      }
      
      // Return original if not found
      console.warn(`Template variable '${varName}' not found in resource '${this.name}'`);
      return match;
    });
  }

  /**
   * Update the resource status with timestamp
   * @param {string} newStatus - New status value
   */
  updateStatus(newStatus) {
    this.status = newStatus;
    this.metadata.lastActivity = new Date();
    
    if (newStatus === 'running' && !this.metadata.initializationTime) {
      this.metadata.initializationTime = new Date();
    } else if (newStatus === 'stopped' && this.metadata.initializationTime) {
      this.metadata.cleanupTime = new Date();
    }
  }

  /**
   * Record a health check result
   * @param {boolean} healthy - Whether the health check passed
   * @param {string} details - Optional details about the health check
   */
  recordHealthCheck(healthy, details = null) {
    this.lastHealthCheck = {
      time: new Date(),
      healthy,
      details
    };
  }

  /**
   * Get dependencies required by this resource
   * @returns {string[]} Array of dependency names
   */
  getDependencies() {
    return this.config.dependencies || [];
  }

  /**
   * Check if resource has a specific dependency
   * @param {string} depName - Dependency name
   * @returns {boolean} True if dependency exists
   */
  hasDependency(depName) {
    return this.getDependencies().includes(depName);
  }
}

export default Resource;