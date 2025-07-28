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

      // Add built-in system modules that aren't tracked by ModuleManager
      const builtinModules = this._getBuiltinModules();
      if (filter === 'loaded' || filter === 'all') {
        modules.push(...builtinModules);
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

          if (includeTools) {
            if (module.instance?.getTools) {
              // For loaded modules, get fresh tool information
              info.tools = module.instance.getTools().map(tool => ({
                name: tool.name || tool.constructor.name,
                description: tool.description || 'No description'
              }));
              info.toolCount = info.tools.length;
            } else if (module.toolCount !== undefined) {
              // For unloaded modules, use cached tool count
              info.toolCount = module.toolCount;
            } else {
              // Try to get cached tool information from ModuleManager
              const tools = this.moduleManager.getModuleTools(module.name);
              info.toolCount = tools.length;
              if (tools.length > 0) {
                info.tools = tools.map(tool => ({
                  name: tool.name,
                  description: tool.description,
                  type: tool.type
                }));
              }
            }
          }

          return info;
        });
      } else {
        // Simple format with tool counts
        result = modules.reduce((acc, module) => {
          const status = module.status || (module.instance ? 'loaded' : 'available');
          if (!acc[status]) acc[status] = [];
          
          let displayName = module.name;
          
          // Add tool count to display name if available
          let toolCount = 0;
          if (module.instance?.getTools) {
            toolCount = module.instance.getTools().length;
          } else if (module.toolCount !== undefined) {
            toolCount = module.toolCount;
          } else {
            const tools = this.moduleManager.getModuleTools(module.name);
            toolCount = tools.length;
          }
          
          if (toolCount > 0) {
            displayName += ` (${toolCount} tools)`;
          }
          
          acc[status].push(displayName);
          return acc;
        }, {});
      }

      const stats = this.moduleManager.getStats();
      stats.totalLoaded += builtinModules.length; // Add builtin modules to count

      return ToolResult.success({
        count: modules.length,
        modules: result,
        stats: stats
      });

    } catch (error) {
      return ToolResult.failure(`Failed to list modules: ${error.message}`);
    }
  }

  /**
   * Get built-in system modules that aren't tracked by ModuleManager
   * @private
   */
  _getBuiltinModules() {
    return [
      {
        name: 'context',
        type: 'builtin',
        status: 'loaded',
        path: 'built-in',
        toolCount: 5, // context_add, context_get, context_list, context_remove, context_clear
        description: 'Context management and variable storage'
      },
      {
        name: 'planning',
        type: 'builtin', 
        status: 'loaded',
        path: 'built-in',
        toolCount: 4, // plan_create, plan_execute, plan_status, plan_validate
        description: 'Multi-step plan creation and execution'
      }
    ];
  }
}