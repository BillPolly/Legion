import { Tool } from '@legion/tools-registry';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ModuleListTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_list',
      description: 'List all loaded and available modules',
      schema: {
        input: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              description: 'Filter modules by name'
            }
          }
        },
        output: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the operation was successful'
            },
            modules: {
              type: 'object',
              properties: {
                loaded: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'List of loaded module names'
                },
                available: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'List of available but not loaded module names'
                },
                total: {
                  type: 'number',
                  description: 'Total number of modules'
                },
                details: {
                  type: 'object',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                        description: 'Module name'
                      },
                      loaded: {
                        type: 'boolean',
                        description: 'Whether the module is loaded'
                      },
                      toolCount: {
                        type: 'number',
                        description: 'Number of tools in the module'
                      }
                    }
                  },
                  description: 'Detailed information about loaded modules'
                }
              },
              description: 'Module listing information'
            },
            totalTools: {
              type: 'number',
              description: 'Total number of tools across all modules'
            },
            error: {
              type: 'string',
              description: 'Error message if operation failed'
            }
          },
          required: ['success']
        }
      },
      execute: async (args) => this.listModules(args)
    });

    this.config = dependencies;
  }

  async listModules(args) {
    const moduleLoader = this.config.moduleLoader;
    if (!moduleLoader) {
      return {
        success: false,
        error: 'ModuleLoader not available'
      };
    }

    // Get loaded modules
    const loadedModules = moduleLoader.getLoadedModuleNames();
    const allTools = await moduleLoader.getAllTools();
    
    // Get available modules from registry
    let availableModules = [];
    try {
      const registryPath = resolve(__dirname, '../../../module-loader/src/ModuleRegistry.json');
      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      availableModules = Object.keys(registry.modules);
    } catch (error) {
      console.error('Failed to load module registry:', error);
      // Continue without available modules list
    }
    
    // Build module details for loaded modules
    const moduleDetails = {};
    for (const moduleName of loadedModules) {
      const module = moduleLoader.getModule(moduleName);
      let toolCount = 0;
      if (module && module.getTools) {
        const tools = await module.getTools();
        toolCount = Array.isArray(tools) ? tools.length : 0;
      }
      moduleDetails[moduleName] = {
        name: moduleName,
        loaded: true,
        toolCount: toolCount
      };
    }
    
    // Separate loaded and available modules
    const notLoadedModules = availableModules.filter(name => !loadedModules.includes(name));
    
    // Apply filter if provided
    let filteredLoaded = loadedModules;
    let filteredAvailable = notLoadedModules;
    
    if (args.filter) {
      const regex = new RegExp(args.filter, 'i');
      filteredLoaded = loadedModules.filter(name => regex.test(name));
      filteredAvailable = notLoadedModules.filter(name => regex.test(name));
    }
    
    return {
      success: true,
      modules: {
        loaded: filteredLoaded,
        available: filteredAvailable,
        total: filteredLoaded.length + filteredAvailable.length,
        details: Object.fromEntries(
          Object.entries(moduleDetails).filter(([name]) => 
            filteredLoaded.includes(name)
          )
        )
      },
      totalTools: allTools.length
    };
  }
}