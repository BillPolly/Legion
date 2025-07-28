import Tool from '@legion/module-loader/src/tool/Tool.js';
import ToolResult from '@legion/module-loader/src/tool/ToolResult.js';
import { z } from 'zod';

/**
 * ModuleListTool - List available and loaded modules
 */
export default class ModuleListTool extends Tool {
  constructor(moduleManager) {
    super();
    this.moduleManager = moduleManager;
    this.name = 'module_list';
    this.description = 'List all available and loaded modules';
  }

  get inputSchema() {
    return z.object({
      filter: z.enum(['all', 'loaded', 'available']).optional().default('all'),
      includeTools: z.boolean().optional().default(false),
      format: z.enum(['simple', 'detailed']).optional().default('simple')
    });
  }

  getToolDescription() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            filter: { 
              type: 'string', 
              enum: ['all', 'loaded', 'available'],
              description: 'Filter modules by status'
            },
            includeTools: { 
              type: 'boolean', 
              description: 'Include tool details in output'
            },
            format: { 
              type: 'string', 
              enum: ['simple', 'detailed'],
              description: 'Output format'
            }
          }
        }
      }
    };
  }

  async invoke(toolCall) {
    const args = JSON.parse(toolCall.function.arguments || '{}');
    return this.execute(args);
  }

  async execute(params) {
    try {
      const { filter, includeTools, format } = params;
      let modules = [];

      switch (filter) {
        case 'loaded':
          modules = this.moduleManager.getLoadedModules();
          break;
        case 'available':
          modules = this.moduleManager.getAvailableModules()
            .filter(m => m.status === 'available');
          break;
        default:
          modules = this.moduleManager.getAvailableModules();
      }

      // Format the output
      let result;
      if (format === 'detailed') {
        result = modules.map(module => {
          const info = {
            name: module.name,
            status: module.status || (module.instance ? 'loaded' : 'available'),
            type: module.type || 'unknown',
            path: module.path,
            dependencies: module.dependencies || []
          };

          if (includeTools && module.instance?.getTools) {
            info.tools = module.instance.getTools().map(tool => ({
              name: tool.name || tool.constructor.name,
              description: tool.description || 'No description'
            }));
          }

          return info;
        });
      } else {
        // Simple format
        result = modules.reduce((acc, module) => {
          const status = module.status || (module.instance ? 'loaded' : 'available');
          if (!acc[status]) acc[status] = [];
          acc[status].push(module.name);
          return acc;
        }, {});
      }

      return ToolResult.success({
        count: modules.length,
        modules: result,
        stats: this.moduleManager.getStats()
      });

    } catch (error) {
      return ToolResult.error(`Failed to list modules: ${error.message}`);
    }
  }
}