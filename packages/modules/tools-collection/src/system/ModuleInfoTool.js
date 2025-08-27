/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const moduleInfoToolInputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Module name'
    }
  },
  required: ['name']
};

// Output schema as plain JSON Schema
const moduleInfoToolOutputSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the operation was successful'
    },
    name: {
      type: 'string',
      description: 'Module name'
    },
    tools: {
      type: 'array',
      items: { type: 'object' },
      description: 'Array of tool information'
    },
    metadata: {
      type: 'object',
      description: 'Module metadata'
    },
    error: {
      type: 'string',
      description: 'Error message if operation failed'
    }
  },
  required: ['success']
};

export class ModuleInfoTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_info',
      description: 'Get detailed information about a module',
      inputSchema: moduleInfoToolInputSchema,
      outputSchema: moduleInfoToolOutputSchema
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

    if (!args.name) {
      return {
        success: false,
        error: 'Module name is required'
      };
    }
    
    const module = moduleLoader.getModule(args.name);
    if (!module) {
      return {
        success: false,
        error: `Module '${args.name}' not found`
      };
    }
    
    let tools = [];
    if (module.getTools) {
      const toolsResult = await module.getTools();
      tools = Array.isArray(toolsResult) ? toolsResult : [];
    }
    
    return {
      success: true,
      module: {
        name: args.name,
        description: module.description || 'No description',
        toolCount: tools.length,
        tools: tools.map(t => ({
          name: t.name || 'unnamed',
          description: t.description || 'No description'
        }))
      }
    };
  }
}