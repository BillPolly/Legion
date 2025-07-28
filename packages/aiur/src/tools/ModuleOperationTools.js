/**
 * ModuleOperationTools - Provides module management capabilities as tools
 * 
 * This replaces the removed module management tools by creating new tools
 * that work with the ModuleHandler to provide module operations.
 */

export class ModuleOperationTools {
  constructor(moduleHandler) {
    this.moduleHandler = moduleHandler;
  }

  /**
   * Get tool definitions for module operations
   */
  getToolDefinitions() {
    return [
      {
        name: 'module_list',
        description: 'List available and loaded modules',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter modules by name or description (regex)'
            }
          }
        }
      },
      {
        name: 'module_load',
        description: 'Load a module to make its tools available',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the module to load'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'module_unload',
        description: 'Unload a module and remove its tools',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the module to unload'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'module_info',
        description: 'Get detailed information about a module',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the module'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'module_tools',
        description: 'List tools provided by a specific module',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the module'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'module_discover',
        description: 'Discover modules in specified directories',
        inputSchema: {
          type: 'object',
          properties: {
            directories: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Directories to search for modules'
            }
          }
        }
      }
    ];
  }

  /**
   * Check if a tool is a module operation tool
   */
  isModuleTool(toolName) {
    const moduleTools = [
      'module_list', 'module_load', 'module_unload',
      'module_info', 'module_tools', 'module_discover'
    ];
    return moduleTools.includes(toolName);
  }

  /**
   * Execute a module operation tool
   */
  async executeModuleTool(toolName, args) {
    switch (toolName) {
      case 'module_list':
        return await this.moduleHandler.listModules(args.filter);
        
      case 'module_load':
        return await this.moduleHandler.loadModule(args.name);
        
      case 'module_unload':
        return await this.moduleHandler.unloadModule(args.name);
        
      case 'module_info':
        return await this.moduleHandler.getModuleInfo(args.name);
        
      case 'module_tools':
        return await this.moduleHandler.getModuleTools(args.name);
        
      case 'module_discover':
        return await this.moduleHandler.discoverModules(args.directories || []);
        
      default:
        throw new Error(`Unknown module tool: ${toolName}`);
    }
  }
}

export default ModuleOperationTools;