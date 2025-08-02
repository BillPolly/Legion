import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class ModuleListTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_list',
      description: 'List all loaded modules',
      inputSchema: z.object({
        filter: z.string().optional().describe('Filter modules by name')
      })
    });
    this.dependencies = dependencies;
  }

  async execute(args) {
    const moduleLoader = this.dependencies.moduleLoader;
    if (!moduleLoader) {
      return {
        success: false,
        error: 'ModuleLoader not available'
      };
    }

    const loadedModules = moduleLoader.getLoadedModuleNames();
    const allTools = await moduleLoader.getAllTools();
    
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
    
    // Apply filter if provided
    let filteredModules = loadedModules;
    if (args.filter) {
      const regex = new RegExp(args.filter, 'i');
      filteredModules = loadedModules.filter(name => regex.test(name));
    }
    
    return {
      success: true,
      modules: {
        loaded: filteredModules,
        total: filteredModules.length,
        details: Object.fromEntries(
          Object.entries(moduleDetails).filter(([name]) => 
            filteredModules.includes(name)
          )
        )
      },
      totalTools: allTools.length
    };
  }
}