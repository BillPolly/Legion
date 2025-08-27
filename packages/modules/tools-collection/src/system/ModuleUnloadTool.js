/**
 * NOTE: Validation has been removed from this tool.
 * All validation now happens at the invocation layer.
 * Tools only define schemas as plain JSON Schema objects.
 */

import { Tool } from '@legion/tools-registry';

// Input schema as plain JSON Schema
const moduleUnloadToolInputSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Name of the module to unload'
    }
  },
  required: ['name']
};

// Output schema as plain JSON Schema
const moduleUnloadToolOutputSchema = {
  type: 'object',
  properties: {
    success: {
      type: 'boolean',
      description: 'Whether the module was unloaded successfully'
    },
    message: {
      type: 'string',
      description: 'Success or status message'
    },
    module: {
      type: 'string',
      description: 'Name of the unloaded module'
    },
    error: {
      type: 'string',
      description: 'Error message if unloading failed'
    }
  },
  required: ['success']
};

export class ModuleUnloadTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_unload',
      description: 'Unload a module and remove its tools',
      inputSchema: moduleUnloadToolInputSchema,
      outputSchema: moduleUnloadToolOutputSchema
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