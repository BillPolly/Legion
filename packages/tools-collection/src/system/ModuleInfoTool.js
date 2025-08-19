import { Tool } from '@legion/tools-registry';

export class ModuleInfoTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_info',
      description: 'Get detailed information about a module',
      schema: {
        input: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Module name'
            }
          },
          required: ['name']
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the operation was successful'
            },
            module: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Module name'
                },
                description: {
                  type: 'string',
                  description: 'Module description'
                },
                toolCount: {
                  type: 'number',
                  description: 'Number of tools in the module'
                },
                tools: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Tool name'
                      },
                      description: {
                        type: 'string',
                        description: 'Tool description'
                      }
                    }
                  },
                  description: 'List of tools in the module'
                }
              },
              description: 'Module information'
            },
            error: {
              type: 'string',
              description: 'Error message if operation failed'
            }
          },
          required: ['success']
        }
      },
      execute: async (args) => this.getModuleInfo(args)
    });

    this.config = dependencies;
  }

  async getModuleInfo(args) {
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