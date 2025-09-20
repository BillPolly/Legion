/**
 * ExecutionContext - Provides clean dependency injection for task execution
 * 
 * This class acts as a service locator that strategies can use to access
 * agent-specific services without creating tight coupling between the
 * framework and specific agent implementations.
 */

export default class ExecutionContext {
  constructor(services = {}) {
    // Core services that strategies typically need
    this.llmClient = services.llmClient || null;
    this.taskClassifier = services.taskClassifier || null;
    this.toolDiscovery = services.toolDiscovery || null;
    this.sessionLogger = services.sessionLogger || null;
    this.promptBuilder = services.promptBuilder || null;
    
    // Validators for response processing
    this.simpleTaskValidator = services.simpleTaskValidator || null;
    this.decompositionValidator = services.decompositionValidator || null;
    this.parentEvaluationValidator = services.parentEvaluationValidator || null;
    this.completionEvaluationValidator = services.completionEvaluationValidator || null;
    
    // Environment and configuration
    this.workspaceDir = services.workspaceDir || process.cwd();
    this.testMode = services.testMode || false;
    this.fastToolDiscovery = services.fastToolDiscovery || false;
    
    // Agent reference for compatibility
    this.agent = services.agent || null;
    
    // Task manager reference (for subtask creation)
    this.taskManager = services.taskManager || null;
    
    // Store any additional services provided
    this.additionalServices = {};
    for (const [key, value] of Object.entries(services)) {
      if (!this.hasOwnProperty(key)) {
        this.additionalServices[key] = value;
      }
    }
  }

  /**
   * Get a service by name
   * Allows strategies to access services dynamically
   */
  getService(name) {
    if (this.hasOwnProperty(name)) {
      return this[name];
    }
    return this.additionalServices[name] || null;
  }

  /**
   * Check if a service is available
   */
  hasService(name) {
    return this.hasOwnProperty(name) || this.additionalServices.hasOwnProperty(name);
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
   * Useful for subtasks that need modified contexts
   */
  createChildContext(overrides = {}) {
    const allServices = {
      // Current services
      llmClient: this.llmClient,
      taskClassifier: this.taskClassifier,
      toolDiscovery: this.toolDiscovery,
      sessionLogger: this.sessionLogger,
      promptBuilder: this.promptBuilder,
      simpleTaskValidator: this.simpleTaskValidator,
      decompositionValidator: this.decompositionValidator,
      parentEvaluationValidator: this.parentEvaluationValidator,
      completionEvaluationValidator: this.completionEvaluationValidator,
      workspaceDir: this.workspaceDir,
      testMode: this.testMode,
      fastToolDiscovery: this.fastToolDiscovery,
      agent: this.agent,
      taskManager: this.taskManager,
      ...this.additionalServices,
      // Override with new services
      ...overrides
    };

    return new ExecutionContext(allServices);
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
   */
  getServiceSummary() {
    const services = {
      llmClient: !!this.llmClient,
      taskClassifier: !!this.taskClassifier,
      toolDiscovery: !!this.toolDiscovery,
      sessionLogger: !!this.sessionLogger,
      promptBuilder: !!this.promptBuilder,
      simpleTaskValidator: !!this.simpleTaskValidator,
      decompositionValidator: !!this.decompositionValidator,
      parentEvaluationValidator: !!this.parentEvaluationValidator,
      completionEvaluationValidator: !!this.completionEvaluationValidator,
      agent: !!this.agent,
      taskManager: !!this.taskManager,
      workspaceDir: this.workspaceDir,
      testMode: this.testMode,
      fastToolDiscovery: this.fastToolDiscovery
    };

    // Add additional services
    for (const [key, value] of Object.entries(this.additionalServices)) {
      services[key] = !!value;
    }

    return services;
  }
}