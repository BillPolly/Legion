/**
 * ExecutionContext - Provides clean dependency injection for task execution
 * 
 * This class acts as a service locator for shared resources and task-specific
 * configuration. Strategy-specific tools should be owned by strategies themselves.
 * Supports hierarchical lookup through parent context chain.
 */

export default class ExecutionContext {
  constructor(services = {}) {
    // Shared resources (may be available in parent context)
    this.llmClient = services.llmClient || null;
    this.sessionLogger = services.sessionLogger || null;
    
    // Task-specific configuration and state
    this.workspaceDir = services.workspaceDir || process.cwd();
    this.testMode = services.testMode || false;
    this.fastToolDiscovery = services.fastToolDiscovery || false;
    this.maxDepth = services.maxDepth || 5;
    this.maxSubtasks = services.maxSubtasks || 10;
    this.executionTimeout = services.executionTimeout || 60000;
    
    // Agent reference for compatibility
    this.agent = services.agent || null;
    
    // Task manager reference (for subtask creation)
    this.taskManager = services.taskManager || null;
    
    // Parent context for hierarchical lookup
    this.parent = services.parent || null;
    
    // Store any additional services provided
    this.additionalServices = {};
    for (const [key, value] of Object.entries(services)) {
      if (!this.hasOwnProperty(key)) {
        this.additionalServices[key] = value;
      }
    }
  }

  /**
   * Hierarchical lookup - searches current context, then parent contexts
   * This is the primary method for accessing resources
   */
  lookup(name) {
    // First check direct properties
    if (this.hasOwnProperty(name) && this[name] !== null) {
      return this[name];
    }
    
    // Then check additional services
    if (this.additionalServices[name] !== undefined) {
      return this.additionalServices[name];
    }
    
    // Finally check parent context
    if (this.parent && this.parent.lookup) {
      return this.parent.lookup(name);
    }
    
    return null;
  }

  /**
   * Get a service by name (legacy method, uses hierarchical lookup)
   * Allows strategies to access services dynamically
   */
  getService(name) {
    return this.lookup(name);
  }

  /**
   * Check if a service is available (uses hierarchical lookup)
   */
  hasService(name) {
    return this.lookup(name) !== null;
  }

  /**
   * Add or update a service
   * Useful for dynamic service injection
   */
  setService(name, service) {
    if (this.hasOwnProperty(name)) {
      this[name] = service;
    } else {
      this.additionalServices[name] = service;
    }
  }

  /**
   * Create a child context with additional or overridden services
   * Child context will have this context as parent for hierarchical lookup
   */
  createChildContext(overrides = {}) {
    const childServices = {
      // Current services (only the ones that should be inherited)
      llmClient: this.llmClient,
      sessionLogger: this.sessionLogger,
      workspaceDir: this.workspaceDir,
      testMode: this.testMode,
      fastToolDiscovery: this.fastToolDiscovery,
      maxDepth: this.maxDepth,
      maxSubtasks: this.maxSubtasks,
      executionTimeout: this.executionTimeout,
      agent: this.agent,
      taskManager: this.taskManager,
      ...this.additionalServices,
      // Override with new services
      ...overrides,
      // Set this context as parent
      parent: this
    };

    return new ExecutionContext(childServices);
  }

  /**
   * Validate that required services are available
   * Strategies can call this to ensure they have what they need
   */
  validateRequiredServices(requiredServices) {
    const missing = [];
    
    for (const serviceName of requiredServices) {
      if (!this.hasService(serviceName) || this.getService(serviceName) === null) {
        missing.push(serviceName);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required services: ${missing.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Get a summary of available services (for debugging)
   * Shows both local and hierarchically available services
   */
  getServiceSummary() {
    const services = {
      // Direct properties
      llmClient: !!this.llmClient,
      sessionLogger: !!this.sessionLogger,
      agent: !!this.agent,
      taskManager: !!this.taskManager,
      workspaceDir: this.workspaceDir,
      testMode: this.testMode,
      fastToolDiscovery: this.fastToolDiscovery,
      maxDepth: this.maxDepth,
      maxSubtasks: this.maxSubtasks,
      executionTimeout: this.executionTimeout,
      hasParent: !!this.parent
    };

    // Add additional services
    for (const [key, value] of Object.entries(this.additionalServices)) {
      services[key] = !!value;
    }

    // If there's a parent, indicate hierarchical services available
    if (this.parent && this.parent.getServiceSummary) {
      services.inheritedServices = this.parent.getServiceSummary();
    }

    return services;
  }
}