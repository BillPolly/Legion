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

  async _execute(args) {
    const moduleLoader = this.config.moduleLoader;
    if (!moduleLoader) {
      throw new Error('ModuleLoader not available');
    }

    if (!args.name) {
      throw new Error('Module name is required');
    }

    // Don't allow unloading the system module
    if (args.name === 'system') {
      throw new Error('Cannot unload the system module');
    }

    // Check if module is loaded
    const loadedModules = moduleLoader.getLoadedModuleNames();
    if (!loadedModules.includes(args.name)) {
      throw new Error(`Module '${args.name}' is not loaded`);
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
      message: `Module '${args.name}' unloaded successfully`,
      toolsRemoved: toolsRemoved,
      remainingModules: moduleLoader.getLoadedModuleNames()
    };
  }
}