/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const moduleToolsToolInputSchema = {
  type: 'object',
  properties: {
    module: {
      type: 'string',
      description: 'Name of the module to inspect'
    }
  },
  required: ['module']
};

// Output schema as plain JSON Schema
const moduleToolsToolOutputSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the operation was successful'
    },
    module: {
      type: 'string',
      description: 'Module name'
    },
    tools: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' }
        }
      },
      description: 'Array of available tools'
    },
    error: {
      type: 'string',
      description: 'Error message if operation failed'
    }
  },
  required: ['success']
};

export class ModuleToolsTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_tools',
      description: 'List tools available in a specific module',
      inputSchema: moduleToolsToolInputSchema,
      outputSchema: moduleToolsToolOutputSchema
    });
    this.config = dependencies;
  }

  async execute(args) {
    const moduleLoader = this.config.moduleLoader;
    if (!moduleLoader) {
      return {
        success: false,
        error: 'ModuleLoader not available'
      };
    }

    if (!args.module) {
      return {
        success: false,
        error: 'Module name is required'
      };
    }
    
    const module = moduleLoader.getModule(args.module);
    if (!module) {
      return {
        success: false,
        error: `Module '${args.module}' not found`
      };
    }
    
    const moduleTools = [];
    if (module.getTools) {
      const tools = await module.getTools();
      
      for (const tool of tools) {
        if (tool.getAllToolDescriptions) {
          const allDescs = tool.getAllToolDescriptions();
          if (Array.isArray(allDescs)) {
            for (const desc of allDescs) {
              moduleTools.push({
                name: desc.function.name,
                description: desc.function.description,
                parameters: desc.function.parameters
              });
            }
          }
        } else if (tool.getToolDescription) {
          const desc = tool.getToolDescription();
          if (desc && desc.function) {
            moduleTools.push({
              name: desc.function.name,
              description: desc.function.description,
              parameters: desc.function.parameters
            });
          }
        } else if (tool.name) {
          moduleTools.push({
            name: tool.name,
            description: tool.description || 'No description',
            parameters: tool.inputSchema || {}
          });
        }
      }
    }
    
    return {
      success: true,
      module: args.module,
      tools: moduleTools,
      count: moduleTools.length
    };
  }
}