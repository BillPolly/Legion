import { Tool } from '@legion/tool-system';
import { z } from 'zod';

export class ModuleInfoTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_info',
      description: 'Get detailed information about a module',
      inputSchema: z.object({
        name: z.string().describe('Module name')
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