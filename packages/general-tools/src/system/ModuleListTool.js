import { Tool } from '@legion/tool-system';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ModuleListTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_list',
      description: 'List all loaded and available modules',
      inputSchema: z.object({
        filter: z.string().optional().describe('Filter modules by name')
      })
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