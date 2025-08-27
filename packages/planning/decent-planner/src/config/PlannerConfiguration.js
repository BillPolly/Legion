/**
 * PlannerConfiguration - Configuration management for DecentPlanner
 * Following Clean Architecture - separates configuration from business logic
 */

export class PlannerConfiguration {
  constructor(options = {}) {
    // Handle null options
    options = options || {};
    
    // Decomposition settings
    this.decomposition = {
      maxDepth: options.maxDepth !== undefined ? options.maxDepth : 5,
      minSubtasks: options.minSubtasks !== undefined ? options.minSubtasks : 2,
      maxSubtasks: options.maxSubtasks !== undefined ? options.maxSubtasks : 10,
      ...(options.decomposition || {})
    };
    
    // Tool discovery settings
    this.toolDiscovery = {
      confidenceThreshold: options.confidenceThreshold !== undefined ? options.confidenceThreshold : 0.7,
      maxToolsPerTask: options.maxToolsPerTask !== undefined ? options.maxToolsPerTask : 10,
      semanticSearchEnabled: options.semanticSearchEnabled !== false,
      ...(options.toolDiscovery || {})
    };
    
    // Formal planning settings
    this.formalPlanning = {
      enabled: options.enableFormalPlanning !== false,
      validateBehaviorTrees: options.validateBehaviorTrees !== false,
      ...(options.formalPlanning || {})
    };
    
    // Logging settings
    this.logging = {
      level: options.logLevel || 'info',
      prefix: options.logPrefix || '[DecentPlanner]',
      enableTimestamp: options.enableTimestamp !== false,
      ...(options.logging || {})
    };
    
    // Validation settings
    this.validation = {
      strictMode: options.strictValidation !== false,
      maxWarnings: options.maxWarnings !== undefined ? options.maxWarnings : 10,
      ...(options.validation || {})
    };
    
    // Performance settings
    this.performance = {
      timeout: options.timeout !== undefined ? options.timeout : 300000, // 5 minutes
      parallelExecution: options.parallelExecution !== false,
      cacheEnabled: options.cacheEnabled !== false,
      ...(options.performance || {})
    };
    
    this.validate();
  }
  
  validate() {
    // Validate decomposition settings
    if (this.decomposition.maxDepth < 1 || this.decomposition.maxDepth > 20) {
      throw new Error(`maxDepth must be between 1 and 20, got ${this.decomposition.maxDepth}`);
    }
    
    if (this.decomposition.minSubtasks < 1) {
      throw new Error('minSubtasks must be at least 1');
    }
    
    if (this.decomposition.maxSubtasks < this.decomposition.minSubtasks) {
      throw new Error('maxSubtasks must be >= minSubtasks');
    }
    
    // Validate tool discovery settings
    if (this.toolDiscovery.confidenceThreshold < 0 || this.toolDiscovery.confidenceThreshold > 1) {
      throw new Error('confidenceThreshold must be between 0 and 1');
    }
    
    if (this.toolDiscovery.maxToolsPerTask < 1) {
      throw new Error('maxToolsPerTask must be at least 1');
    }
    
    // Validate logging settings
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(this.logging.level)) {
      throw new Error(`Invalid log level: ${this.logging.level}`);
    }
    
    // Validate performance settings
    if (this.performance.timeout < 1000) {
      throw new Error('timeout must be at least 1000ms');
    }
  }
  
  toJSON() {
    return {
      decomposition: this.decomposition,
      toolDiscovery: this.toolDiscovery,
      formalPlanning: this.formalPlanning,
      logging: this.logging,
      validation: this.validation,
      performance: this.performance
    };
  }
  
  static fromJSON(json) {
    return new PlannerConfiguration(json);
  }
  
  static defaults() {
    return new PlannerConfiguration();
  }
}