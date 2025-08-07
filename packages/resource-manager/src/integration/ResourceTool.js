import { Tool, ToolResult } from '@legion/tool-system';

/**
 * ResourceTool provides a Tool interface for invoking methods on managed resources
 * Bridges the gap between the jsEnvoy tool system and the resource management system
 */
class ResourceTool extends Tool {
  /**
   * Create a ResourceTool
   * @param {Object} config - Tool configuration
   * @param {Object} resourceManager - Resource manager instance
   */
  constructor(config, resourceManager) {
    super();
    
    if (!config.name) {
      throw new Error('ResourceTool requires a name');
    }
    
    if (!config.resource) {
      throw new Error('ResourceTool requires a resource name');
    }
    
    if (!config.method) {
      throw new Error('ResourceTool requires a method name');
    }
    
    this.name = config.name;
    this.description = config.description || `Invoke ${config.method} on ${config.resource}`;
    this.config = config;
    this.resourceManager = resourceManager;
  }

  /**
   * Get tool description in OpenAI function calling format
   */
  getToolDescription() {
    const { parameters, output } = this.config;
    
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: parameters || {
          type: 'object',
          properties: {},
          required: []
        },
        output: output || {
          success: {
            type: 'object',
            properties: {
              result: { type: 'any', description: 'Method result' }
            }
          },
          failure: {
            type: 'object',
            properties: {
              error: { type: 'string', description: 'Error message' },
              details: { type: 'object', description: 'Error details' }
            }
          }
        }
      }
    };
  }

  /**
   * Execute the tool
   */
  async execute(args) {
    try {
      // Handle toolCall format if provided
      if (args.function && args.function.arguments) {
        try {
          args = this.parseArguments(args.function.arguments);
        } catch (error) {
          return ToolResult.failure(`Invalid JSON arguments: ${error.message}`, {
            arguments: args.function.arguments
          });
        }
      }
      
      // Get the resource
      const resource = this.getResource();
      if (!resource) {
        return ToolResult.failure(`Resource '${this.config.resource}' not found`, {
          resource: this.config.resource,
          method: this.config.method
        });
      }
      
      // Check if resource is operational
      if (!this.isResourceOperational(resource)) {
        return ToolResult.failure(
          `Resource '${this.config.resource}' is not operational (status: ${resource.status})`,
          {
            resource: this.config.resource,
            status: resource.status,
            method: this.config.method
          }
        );
      }
      
      // Invoke the method on the resource
      const result = await resource.invoke(this.config.method, args);
      
      // Return success result
      return ToolResult.success({ result });
      
    } catch (error) {
      // Return failure result with error details
      return ToolResult.failure(error.message, {
        resource: this.config.resource,
        method: this.config.method,
        errorType: error.constructor.name,
        stack: error.stack
      });
    }
  }

  /**
   * Get the target resource
   * @private
   */
  getResource() {
    // Try different resource types
    if (this.resourceManager.processResources?.has(this.config.resource)) {
      return this.resourceManager.processResources.get(this.config.resource);
    }
    
    if (this.resourceManager.agentResources?.has(this.config.resource)) {
      return this.resourceManager.agentResources.get(this.config.resource);
    }
    
    // Try generic resources (for backward compatibility)
    if (this.resourceManager.get && this.resourceManager.has(this.config.resource)) {
      const resource = this.resourceManager.get(this.config.resource);
      
      // Check if it has the invoke method (duck typing)
      if (resource && typeof resource.invoke === 'function') {
        return resource;
      }
    }
    
    return null;
  }

  /**
   * Check if resource is operational
   * @private
   */
  isResourceOperational(resource) {
    if (!resource.status) {
      return true; // Assume operational if no status
    }
    
    // Resource is operational if it's running or ready
    const operationalStates = ['running', 'ready'];
    return operationalStates.includes(resource.status);
  }

  /**
   * Get resource status for debugging
   */
  getResourceStatus() {
    const resource = this.getResource();
    
    if (!resource) {
      return {
        found: false,
        resource: this.config.resource
      };
    }
    
    return {
      found: true,
      resource: this.config.resource,
      status: resource.status,
      operational: this.isResourceOperational(resource),
      details: resource.getStatus ? resource.getStatus() : null
    };
  }

  /**
   * Validate tool configuration
   */
  validate() {
    const errors = [];
    
    // Check required fields
    if (!this.config.resource) {
      errors.push('resource is required');
    }
    
    if (!this.config.method) {
      errors.push('method is required');
    }
    
    // Check if resource exists
    const resource = this.getResource();
    if (!resource) {
      errors.push(`resource '${this.config.resource}' not found`);
    } else {
      // Check if method exists (if resource has a way to list methods)
      if (resource.getSupportedMethods) {
        const supportedMethods = resource.getSupportedMethods();
        if (!supportedMethods.includes(this.config.method)) {
          errors.push(`method '${this.config.method}' not supported by resource '${this.config.resource}'`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create multiple ResourceTools from configuration
   * @param {Object} toolsConfig - Tools configuration
   * @param {Object} resourceManager - Resource manager instance
   * @returns {ResourceTool[]} Array of ResourceTool instances
   */
  static createFromConfig(toolsConfig, resourceManager) {
    const tools = [];
    
    for (const toolConfig of toolsConfig) {
      if (toolConfig.resource && toolConfig.method) {
        try {
          const tool = new ResourceTool(toolConfig, resourceManager);
          tools.push(tool);
        } catch (error) {
          console.error(`Failed to create ResourceTool '${toolConfig.name}':`, error);
        }
      }
    }
    
    return tools;
  }

  /**
   * Create a ResourceTool for a specific resource method
   * @param {string} resourceName - Resource name
   * @param {string} methodName - Method name
   * @param {Object} resourceManager - Resource manager instance
   * @param {Object} options - Additional options
   * @returns {ResourceTool} ResourceTool instance
   */
  static forResourceMethod(resourceName, methodName, resourceManager, options = {}) {
    const config = {
      name: options.name || `${resourceName}_${methodName}`,
      description: options.description || `Invoke ${methodName} on ${resourceName}`,
      resource: resourceName,
      method: methodName,
      parameters: options.parameters,
      output: options.output
    };
    
    return new ResourceTool(config, resourceManager);
  }

  /**
   * Create ResourceTools for all methods of a resource
   * @param {string} resourceName - Resource name
   * @param {Object} resourceManager - Resource manager instance
   * @param {Object} options - Options for tool creation
   * @returns {ResourceTool[]} Array of ResourceTool instances
   */
  static forAllResourceMethods(resourceName, resourceManager, options = {}) {
    const tools = [];
    const resource = resourceManager.processResources?.get(resourceName) || 
                    resourceManager.agentResources?.get(resourceName);
    
    if (!resource) {
      console.warn(`Resource '${resourceName}' not found`);
      return tools;
    }
    
    // Get supported methods if available
    let methods = [];
    if (resource.getSupportedMethods) {
      methods = resource.getSupportedMethods();
    } else {
      // Default methods based on resource type
      if (resource.constructor.name === 'ProcessResource') {
        methods = ['status', 'restart', 'stop', 'logs', 'signal'];
      } else if (resource.constructor.name === 'AgentResource') {
        methods = ['chat', 'single_shot', 'create_session', 'get_session', 'delete_session', 'list_sessions'];
      }
    }
    
    for (const method of methods) {
      try {
        const tool = ResourceTool.forResourceMethod(
          resourceName, 
          method, 
          resourceManager,
          {
            name: options.namePrefix ? `${options.namePrefix}_${method}` : `${resourceName}_${method}`,
            ...options
          }
        );
        tools.push(tool);
      } catch (error) {
        console.error(`Failed to create ResourceTool for ${resourceName}.${method}:`, error);
      }
    }
    
    return tools;
  }
}

export default ResourceTool;