import { Tool } from '@legion/tools';
import { z } from 'zod';

export class ModuleToolsTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_tools',
      description: 'List tools available in a specific module',
      inputSchema: z.object({
        module: z.string().describe('Name of the module to inspect')
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

    if (!args.module) {
      return {
        success: false,
        error: 'Module name is required'
      };
    }
    
    const module = moduleLoader.getModule(args.module);
    if (!module) {
      return {
        success: false,
        error: `Module '${args.module}' not found`
      };
    }
    
    const moduleTools = [];
    if (module.getTools) {
      const tools = await module.getTools();
      
      for (const tool of tools) {
        if (tool.getAllToolDescriptions) {
          const allDescs = tool.getAllToolDescriptions();
          if (Array.isArray(allDescs)) {
            for (const desc of allDescs) {
              moduleTools.push({
                name: desc.function.name,
                description: desc.function.description,
                parameters: desc.function.parameters
              });
            }
          }
        } else if (tool.getToolDescription) {
          const desc = tool.getToolDescription();
          if (desc && desc.function) {
            moduleTools.push({
              name: desc.function.name,
              description: desc.function.description,
              parameters: desc.function.parameters
            });
          }
        } else if (tool.name) {
          moduleTools.push({
            name: tool.name,
            description: tool.description || 'No description',
            parameters: tool.inputSchema || {}
          });
        }
      }
    }
    
    return {
      success: true,
      module: args.module,
      tools: moduleTools,
      count: moduleTools.length
    };
  }
}