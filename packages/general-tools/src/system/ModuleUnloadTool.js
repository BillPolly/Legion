import { Tool } from '@legion/module-loader';
import { z } from 'zod';

export class ModuleUnloadTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_unload',
      description: 'Unload a module and remove its tools',
      inputSchema: z.object({
        name: z.string().describe('Name of the module to unload')
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

    if (!args.name) {
      return {
        success: false,
        error: 'Module name is required'
      };
    }

    // Don't allow unloading the system module
    if (args.name === 'system') {
      return {
        success: false,
        error: 'Cannot unload the system module'
      };
    }

    try {
      // Check if module is loaded
      const loadedModules = moduleLoader.getLoadedModuleNames();
      if (!loadedModules.includes(args.name)) {
        return {
          success: false,
          error: `Module '${args.name}' is not loaded`
        };
      }

      // Get tools before unloading for reporting
      const module = moduleLoader.getLoadedModule(args.name);
      let toolsRemoved = [];
      
      if (module) {
        const tools = module.getTools ? module.getTools() : [];
        toolsRemoved = tools.map(tool => tool.name || tool.constructor.name);
      }

      // Unload the module
      await moduleLoader.unloadModule(args.name);

      return {
        success: true,
        message: `Module '${args.name}' unloaded successfully`,
        toolsRemoved: toolsRemoved,
        remainingModules: moduleLoader.getLoadedModuleNames()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to unload module '${args.name}': ${error.message}`
      };
    }
  }
}