/**
 * GlobalContext - Root context containing truly global resources
 * 
 * This serves as the root of the hierarchical context chain.
 * Contains shared resources that all tasks and strategies can access:
 * - ResourceManager singleton
 * - ToolRegistry singleton
 * - LLMClient from ResourceManager
 * - SessionLogger (if configured)
 * 
 * GlobalContext is typically created once per application and passed
 * as the parent to all ExecutionContexts.
 */

import { ResourceManager } from '@legion/resource-manager';

export default class GlobalContext {
  constructor(options = {}) {
    // Core global resources - will be initialized lazily
    this.resourceManager = null;
    this.toolRegistry = null;
    this.llmClient = null;
    this.sessionLogger = null;
    
    // Store any additional global services
    this.additionalGlobalServices = {};
    for (const [key, value] of Object.entries(options)) {
      if (!this.hasOwnProperty(key)) {
        this.additionalGlobalServices[key] = value;
      }
    }
    
    // Global context has no parent
    this.parent = null;
  }

  /**
   * Initialize global resources (lazy initialization)
   * This should be called once at application startup
   */
  async initialize() {
    if (!this.resourceManager) {
      console.log('🌍 Initializing GlobalContext...');
      
      // Get ResourceManager singleton
      this.resourceManager = await ResourceManager.getInstance();
      
      // Get LLMClient from ResourceManager
      this.llmClient = await this.resourceManager.get('llmClient');
      
      // Get ToolRegistry singleton if available
      try {
        const { ToolRegistry } = await import('@legion/tools-registry');
        this.toolRegistry = await ToolRegistry.getInstance();
      } catch (error) {
        console.warn('ToolRegistry not available:', error.message);
      }
      
      // Initialize SessionLogger if configured
      try {
        const { SessionLogger } = await import('@legion/session-logger');
        if (SessionLogger) {
          this.sessionLogger = new SessionLogger();
          await this.sessionLogger.initialize();
        }
      } catch (error) {
        console.warn('SessionLogger not available:', error.message);
      }
      
      console.log('✅ GlobalContext initialized with:');
      console.log(`  - ResourceManager: ${!!this.resourceManager}`);
      console.log(`  - LLMClient: ${!!this.llmClient}`);
      console.log(`  - ToolRegistry: ${!!this.toolRegistry}`);
      console.log(`  - SessionLogger: ${!!this.sessionLogger}`);
    }
  }

  /**
   * Hierarchical lookup - searches global services
   * This is the termination point of the hierarchy chain
   */
  lookup(name) {
    // Check direct properties first
    if (this.hasOwnProperty(name) && this[name] !== null) {
      return this[name];
    }
    
    // Check additional global services
    if (this.additionalGlobalServices[name] !== undefined) {
      return this.additionalGlobalServices[name];
    }
    
    // Global context is the root - no parent to check
    return null;
  }

  /**
   * Get a service by name (alias for lookup)
   */
  getService(name) {
    return this.lookup(name);
  }

  /**
   * Check if a service is available
   */
  hasService(name) {
    return this.lookup(name) !== null;
  }

  /**
   * Add or update a global service
   */
  setService(name, service) {
    if (this.hasOwnProperty(name)) {
      this[name] = service;
    } else {
      this.additionalGlobalServices[name] = service;
    }
  }

  /**
   * Create an ExecutionContext with this GlobalContext as parent
   * This is the typical way to create task-specific contexts
   */
  async createExecutionContext(services = {}) {
    const { ExecutionContext } = await import('@legion/shared-tasks');
    
    return new ExecutionContext({
      ...services,
      parent: this
    });
  }

  /**
   * Validate that required global services are available
   */
  validateRequiredServices(requiredServices) {
    const missing = [];
    
    for (const serviceName of requiredServices) {
      if (!this.hasService(serviceName) || this.getService(serviceName) === null) {
        missing.push(serviceName);
      }
    }
    
    if (missing.length > 0) {
      throw new Error(`Missing required global services: ${missing.join(', ')}`);
    }
    
    return true;
  }

  /**
   * Get summary of available global services (for debugging)
   */
  getServiceSummary() {
    const services = {
      // Core global services
      resourceManager: !!this.resourceManager,
      toolRegistry: !!this.toolRegistry,
      llmClient: !!this.llmClient,
      sessionLogger: !!this.sessionLogger,
      isGlobalContext: true,
      hasParent: false
    };

    // Add additional global services
    for (const [key, value] of Object.entries(this.additionalGlobalServices)) {
      services[key] = !!value;
    }

    return services;
  }

  /**
   * Get singleton instance (optional pattern for global contexts)
   * Some applications may want a single global context
   */
  static async getInstance() {
    if (!GlobalContext._instance) {
      GlobalContext._instance = new GlobalContext();
      await GlobalContext._instance.initialize();
    }
    return GlobalContext._instance;
  }

  /**
   * Reset singleton (useful for testing)
   */
  static resetInstance() {
    GlobalContext._instance = null;
  }
}

// Static instance for singleton pattern
GlobalContext._instance = null;