/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

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
      inputSchema: {
        type: 'object',
        properties: {
          filter: {
            type: 'string',
            description: 'Filter modules by name'
          }
        }
      },
      outputSchema: {
        type: 'object',
        properties: {
          loaded: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                toolCount: { type: 'integer' },
                tools: { 
                  type: 'array',
                  items: { type: 'string' }
                }
              }
            },
            description: 'List of loaded modules'
          },
          available: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of available modules'
          },
          summary: {
            type: 'object',
            properties: {
              loadedCount: { type: 'integer' },
              availableCount: { type: 'integer' },
              totalTools: { type: 'integer' }
            }
          }
        },
        required: ['loaded', 'available', 'summary']
      }
    });
    this.config = dependencies;
  }

  async _execute(args) {
    const moduleLoader = this.config.moduleLoader;
    if (!moduleLoader) {
      throw new Error('ModuleLoader not available');
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