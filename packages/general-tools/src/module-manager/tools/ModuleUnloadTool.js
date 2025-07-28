import Tool from '@legion/module-loader/src/tool/Tool.js';
import ToolResult from '@legion/module-loader/src/tool/ToolResult.js';
import { z } from 'zod';

/**
 * ModuleUnloadTool - Unload a loaded module
 */
export default class ModuleUnloadTool extends Tool {
  constructor(moduleManager) {
    super();
    this.moduleManager = moduleManager;
    this.name = 'module_unload';
    this.description = 'Unload a loaded module';
  }

  get inputSchema() {
    return z.object({
      module: z.string().describe('Module name to unload'),
      force: z.boolean().optional().default(false).describe('Force unload even if cleanup fails')
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
              description: 'Module name to unload'
            },
            force: { 
              type: 'boolean', 
              description: 'Force unload even if cleanup fails'
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
      const { module: moduleName, force } = params;

      // Check if module is loaded
      if (!this.moduleManager.isModuleLoaded(moduleName)) {
        return ToolResult.success({
          message: `Module '${moduleName}' is not loaded`,
          unloaded: false,
          wasLoaded: false
        });
      }

      // Get module info before unloading
      const info = this.moduleManager.getModuleInfo(moduleName);

      try {
        // Attempt to unload
        const unloaded = await this.moduleManager.unloadModule(moduleName);

        if (unloaded) {
          return ToolResult.success({
            message: `Module '${moduleName}' unloaded successfully`,
            unloaded: true,
            wasLoaded: true,
            module: info
          });
        } else {
          return ToolResult.error(`Failed to unload module '${moduleName}'`);
        }

      } catch (error) {
        if (force) {
          // Force unload by removing from registry
          const registry = this.moduleManager.getRegistry();
          const removed = registry.unregister(moduleName);
          
          if (removed) {
            return ToolResult.success({
              message: `Module '${moduleName}' force unloaded (cleanup failed: ${error.message})`,
              unloaded: true,
              wasLoaded: true,
              forced: true,
              cleanupError: error.message
            });
          }
        }
        throw error;
      }

    } catch (error) {
      return ToolResult.error(`Failed to unload module: ${error.message}`);
    }
  }
}