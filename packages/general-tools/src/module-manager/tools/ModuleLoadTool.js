import Tool from '@legion/module-loader/src/tool/Tool.js';
import ToolResult from '@legion/module-loader/src/tool/ToolResult.js';
import { z } from 'zod';

/**
 * ModuleLoadTool - Load a module dynamically
 */
export default class ModuleLoadTool extends Tool {
  constructor(moduleManager) {
    super();
    this.moduleManager = moduleManager;
    this.name = 'module_load';
    this.description = 'Load a module by name or path';
  }

  get inputSchema() {
    return z.object({
      module: z.string().describe('Module name or path to load'),
      reload: z.boolean().optional().default(false).describe('Force reload if already loaded')
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
            module: { 
              type: 'string', 
              description: 'Module name or path to load'
            },
            reload: { 
              type: 'boolean', 
              description: 'Force reload if already loaded'
            }
          },
          required: ['module']
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
      const { module: moduleName, reload } = params;

      // Check if already loaded
      if (this.moduleManager.isModuleLoaded(moduleName) && !reload) {
        return ToolResult.success({
          message: `Module '${moduleName}' is already loaded`,
          loaded: true,
          reloaded: false
        });
      }

      // Reload if requested
      if (reload && this.moduleManager.isModuleLoaded(moduleName)) {
        await this.moduleManager.reloadModule(moduleName);
        
        const info = this.moduleManager.getModuleInfo(moduleName);
        return ToolResult.success({
          message: `Module '${moduleName}' reloaded successfully`,
          loaded: true,
          reloaded: true,
          module: info
        });
      }

      // Load the module
      const instance = await this.moduleManager.loadModule(moduleName);
      const info = this.moduleManager.getModuleInfo(moduleName);

      // Get tools if available
      const tools = instance.getTools ? 
        instance.getTools().map(t => ({
          name: t.name || t.constructor.name,
          description: t.description || 'No description'
        })) : [];

      return ToolResult.success({
        message: `Module '${moduleName}' loaded successfully`,
        loaded: true,
        module: {
          ...info,
          tools: tools,
          toolCount: tools.length
        }
      });

    } catch (error) {
      return ToolResult.failure(`Failed to load module: ${error.message}`);
    }
  }
}