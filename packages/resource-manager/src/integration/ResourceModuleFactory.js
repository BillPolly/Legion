import { ModuleFactory } from '@legion/tool-core';
import ProcessResource from '../process/ProcessResource.js';
import AgentResource from '../agent/AgentResource.js';
import ProcessOrchestrator from '../process/ProcessOrchestrator.js';
import ResourceTool from './ResourceTool.js';

/**
 * ResourceModuleFactory extends ModuleFactory to support resource management
 * Handles creation of process resources, agent resources, and resource-based tools
 */
class ResourceModuleFactory extends ModuleFactory {
  constructor(resourceManager) {
    super(resourceManager);
    
    this.processOrchestrator = new ProcessOrchestrator();
    this.processResources = new Map();
    this.agentResources = new Map();
    
    // Extend resource manager with resource collections
    if (!resourceManager.processResources) {
      resourceManager.processResources = this.processResources;
    }
    if (!resourceManager.agentResources) {
      resourceManager.agentResources = this.agentResources;
    }
    if (!resourceManager.serviceModules) {
      resourceManager.serviceModules = new Map();
    }
  }

  /**
   * Create a module with support for resources
   * @param {Object} config - Module configuration
   * @returns {Promise<Object>} Created module with resources
   */
  async createModule(config) {
    // Create the base module first
    const module = await super.createModule(config);
    
    // Initialize process resources
    if (config.processResources) {
      await this.createProcessResources(config.processResources);
    }
    
    // Initialize service modules (regular JSON modules)
    if (config.serviceModules) {
      await this.createServiceModules(config.serviceModules);
    }
    
    // Initialize agent resources (after service modules are available)
    if (config.agentResources) {
      await this.createAgentResources(config.agentResources);
    }
    
    // Create resource-based tools
    const resourceTools = this.createResourceTools(config.tools || []);
    
    // Add resource tools to the module
    module.tools = [...(module.tools || []), ...resourceTools];
    
    return module;
  }

  /**
   * Create process resources from configuration
   * @private
   */
  async createProcessResources(processConfigs) {
    const dependencies = this.extractProcessDependencies(processConfigs);
    
    // Create all process resources first
    for (const [name, processConfig] of Object.entries(processConfigs)) {
      try {
        const resolvedDependencies = this.resolveResourceDependencies(processConfig);
        const processResource = new ProcessResource(name, processConfig, resolvedDependencies);
        
        this.processResources.set(name, processResource);
        this.processOrchestrator.registerProcess(name, processResource, processConfig.dependencies || []);
        
        console.log(`Created process resource '${name}'`);
        
      } catch (error) {
        console.error(`Failed to create process resource '${name}':`, error);
        throw error;
      }
    }
    
    // Start processes in dependency order if autoStart is enabled
    const autoStartProcesses = Object.entries(processConfigs)
      .filter(([, config]) => config.autoStart !== false)
      .map(([name]) => name);
    
    if (autoStartProcesses.length > 0) {
      console.log(`Auto-starting processes: [${autoStartProcesses.join(', ')}]`);
      
      try {
        await this.processOrchestrator.startAll({
          parallel: true,
          stopOnError: false
        });
      } catch (error) {
        console.error('Failed to auto-start some processes:', error);
        // Don't throw - allow partial startup
      }
    }
  }

  /**
   * Create service modules from configuration
   * @private
   */
  async createServiceModules(serviceConfigs) {
    for (const [name, serviceConfig] of Object.entries(serviceConfigs)) {
      try {
        // Create using the existing JSON module system
        const serviceModule = await super.createJsonModule(`${name}.json`);
        this.resourceManager.serviceModules.set(name, serviceModule);
        
        console.log(`Created service module '${name}'`);
        
      } catch (error) {
        // If JSON file doesn't exist, create from inline config
        try {
          const resolvedDependencies = this.resolveResourceDependencies(serviceConfig);
          const serviceModule = await this.createInlineServiceModule(serviceConfig, resolvedDependencies);
          this.resourceManager.serviceModules.set(name, serviceModule);
          
          console.log(`Created inline service module '${name}'`);
          
        } catch (inlineError) {
          console.error(`Failed to create service module '${name}':`, inlineError);
          throw inlineError;
        }
      }
    }
  }

  /**
   * Create agent resources from configuration
   * @private
   */
  async createAgentResources(agentConfigs) {
    for (const [name, agentConfig] of Object.entries(agentConfigs)) {
      try {
        const resolvedDependencies = this.resolveAgentDependencies(agentConfig);
        const agentResource = new AgentResource(name, agentConfig, resolvedDependencies);
        
        await agentResource.initialize();
        this.agentResources.set(name, agentResource);
        
        console.log(`Created agent resource '${name}'`);
        
      } catch (error) {
        console.error(`Failed to create agent resource '${name}':`, error);
        throw error;
      }
    }
  }

  /**
   * Create an inline service module from configuration
   * @private
   */
  async createInlineServiceModule(config, dependencies) {
    // This is a simplified implementation
    // In a real system, you'd use the existing GenericModule
    const { GenericModule } = await import('@legion/module-loader');
    return new GenericModule(config, dependencies);
  }

  /**
   * Create resource-based tools
   * @private
   */
  createResourceTools(toolConfigs) {
    const tools = [];
    
    for (const toolConfig of toolConfigs) {
      if (toolConfig.resource && toolConfig.method) {
        try {
          const tool = new ResourceTool(toolConfig, this.resourceManager);
          tools.push(tool);
        } catch (error) {
          console.error(`Failed to create resource tool '${toolConfig.name}':`, error);
        }
      }
    }
    
    return tools;
  }

  /**
   * Extract process dependencies for ordering
   * @private
   */
  extractProcessDependencies(processConfigs) {
    const dependencies = {};
    
    for (const [name, config] of Object.entries(processConfigs)) {
      dependencies[name] = config.dependencies || [];
    }
    
    return dependencies;
  }

  /**
   * Resolve dependencies for process resources
   * @private
   */
  resolveResourceDependencies(config) {
    const resolved = {};
    
    if (config.dependencies) {
      for (const [key, depConfig] of Object.entries(config.dependencies)) {
        if (typeof depConfig === 'string') {
          // Simple dependency name
          resolved[key] = this.resourceManager.get(depConfig);
        } else if (depConfig.type) {
          // Dependency with type specification
          try {
            resolved[key] = this.resourceManager.get(depConfig.name || key);
          } catch (error) {
            if (depConfig.required !== false) {
              throw error;
            }
            resolved[key] = depConfig.default || null;
          }
        }
      }
    }
    
    return resolved;
  }

  /**
   * Resolve dependencies for agent resources
   * @private
   */
  resolveAgentDependencies(config) {
    return {
      serviceModules: this.resourceManager.serviceModules,
      processResources: this.processResources,
      ...this.resolveResourceDependencies(config)
    };
  }

  /**
   * Start all managed resources
   */
  async startAllResources() {
    console.log('Starting all managed resources...');
    
    // Start processes
    if (this.processResources.size > 0) {
      await this.processOrchestrator.startAll({
        parallel: true,
        stopOnError: false
      });
    }
    
    // Agent resources are initialized during creation
    console.log('All resources started');
  }

  /**
   * Stop all managed resources
   */
  async stopAllResources() {
    console.log('Stopping all managed resources...');
    
    // Stop agent resources
    for (const [name, agent] of this.agentResources) {
      try {
        await agent.cleanup();
        console.log(`Stopped agent resource '${name}'`);
      } catch (error) {
        console.error(`Failed to stop agent resource '${name}':`, error);
      }
    }
    
    // Stop process resources
    if (this.processResources.size > 0) {
      await this.processOrchestrator.stopAll({
        timeout: 30000
      });
    }
    
    console.log('All resources stopped');
  }

  /**
   * Get status of all resources
   */
  getResourcesStatus() {
    return {
      processes: this.processOrchestrator.getStatus(),
      agents: Object.fromEntries(
        Array.from(this.agentResources.entries()).map(([name, agent]) => [
          name,
          agent.getStatistics()
        ])
      ),
      serviceModules: Array.from(this.resourceManager.serviceModules.keys())
    };
  }

  /**
   * Get process orchestrator for advanced process management
   */
  getProcessOrchestrator() {
    return this.processOrchestrator;
  }

  /**
   * Create a resource tool for an existing resource
   * @param {string} resourceName - Resource name
   * @param {string} methodName - Method name
   * @param {Object} options - Tool options
   * @returns {ResourceTool} Resource tool instance
   */
  createResourceTool(resourceName, methodName, options = {}) {
    return ResourceTool.forResourceMethod(resourceName, methodName, this.resourceManager, options);
  }

  /**
   * Create tools for all methods of a resource
   * @param {string} resourceName - Resource name
   * @param {Object} options - Tool options
   * @returns {ResourceTool[]} Array of resource tools
   */
  createResourceTools(resourceName, options = {}) {
    return ResourceTool.forAllResourceMethods(resourceName, this.resourceManager, options);
  }

  /**
   * Cleanup factory resources
   */
  async cleanup() {
    await this.stopAllResources();
    
    this.processResources.clear();
    this.agentResources.clear();
    this.resourceManager.serviceModules.clear();
  }
}

export default ResourceModuleFactory;