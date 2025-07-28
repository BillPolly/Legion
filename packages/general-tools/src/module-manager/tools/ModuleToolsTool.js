import Tool from '@legion/module-loader/src/tool/Tool.js';
import ToolResult from '@legion/module-loader/src/tool/ToolResult.js';
import { z } from 'zod';

/**
 * ModuleToolsTool - List tools available in a specific module
 */
export default class ModuleToolsTool extends Tool {
  constructor(moduleManager) {
    super();
    this.moduleManager = moduleManager;
    this.name = 'module_tools';
    this.description = 'List tools available in a specific module (loaded or not)';
  }

  get inputSchema() {
    return z.object({
      module: z.string().describe('Module name to list tools for'),
      format: z.enum(['simple', 'detailed']).optional().default('simple')
        .describe('Output format - simple shows names, detailed shows full info'),
      includeSchema: z.boolean().optional().default(false)
        .describe('Include input schema information for each tool')
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
              description: 'Module name to list tools for'
            },
            format: { 
              type: 'string', 
              enum: ['simple', 'detailed'],
              description: 'Output format - simple shows names, detailed shows full info'
            },
            includeSchema: { 
              type: 'boolean', 
              description: 'Include input schema information for each tool'
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
      const { module: moduleName, format, includeSchema } = params;

      // First check if module is loaded
      let moduleInstance = null;
      let moduleInfo = null;
      let isLoaded = false;

      if (this.moduleManager.isModuleLoaded(moduleName)) {
        moduleInfo = this.moduleManager.getModuleInfo(moduleName);
        const registry = this.moduleManager.getRegistry();
        moduleInstance = registry.getInstance(moduleName);
        isLoaded = true;
      } else {
        // Try to find in available modules
        const availableModules = this.moduleManager.getAvailableModules();
        moduleInfo = availableModules.find(m => m.name === moduleName);
        
        if (!moduleInfo) {
          return ToolResult.failure(`Module '${moduleName}' not found. Use module_discover to find available modules.`);
        }

        // Try to load the module temporarily to get its tools
        try {
          moduleInstance = await this.moduleManager.loadModule(moduleName);
          isLoaded = false; // We just loaded it for inspection
        } catch (error) {
          return ToolResult.failure(`Failed to load module '${moduleName}' to inspect tools: ${error.message}`);
        }
      }

      if (!moduleInstance || !moduleInstance.getTools) {
        return ToolResult.failure(`Module '${moduleName}' does not expose any tools`);
      }

      const tools = moduleInstance.getTools();
      const result = {
        module: moduleName,
        status: isLoaded ? 'loaded' : 'available',
        toolCount: tools.length,
        tools: []
      };

      if (format === 'detailed') {
        result.tools = tools.map(tool => {
          const toolInfo = {
            name: tool.name || tool.constructor.name,
            description: tool.description || 'No description'
          };

          // Get tool description in MCP format
          if (tool.getToolDescription) {
            const desc = tool.getToolDescription();
            toolInfo.name = desc.function.name;
            toolInfo.description = desc.function.description;
            
            if (includeSchema && desc.function.parameters) {
              toolInfo.inputSchema = desc.function.parameters;
            }
          } else if (tool.getAllToolDescriptions) {
            // Multi-function tool
            const allDescs = tool.getAllToolDescriptions();
            toolInfo.functions = allDescs.map(desc => ({
              name: desc.function.name,
              description: desc.function.description,
              ...(includeSchema && desc.function.parameters ? { inputSchema: desc.function.parameters } : {})
            }));
          }

          return toolInfo;
        });
      } else {
        // Simple format - just tool names
        result.tools = [];
        tools.forEach(tool => {
          if (tool.getToolDescription) {
            const desc = tool.getToolDescription();
            result.tools.push(desc.function.name);
          } else if (tool.getAllToolDescriptions) {
            const allDescs = tool.getAllToolDescriptions();
            result.tools.push(...allDescs.map(desc => desc.function.name));
          } else {
            result.tools.push(tool.name || tool.constructor.name);
          }
        });
      }

      // If we loaded the module just for inspection and it wasn't already loaded, unload it
      if (!isLoaded && !this.moduleManager.isModuleLoaded(moduleName)) {
        try {
          await this.moduleManager.unloadModule(moduleName);
        } catch (error) {
          // Ignore unload errors - this was just for inspection
          console.warn(`Failed to unload temporary module ${moduleName}:`, error.message);
        }
      }

      return ToolResult.success(result);

    } catch (error) {
      return ToolResult.failure(`Failed to list module tools: ${error.message}`);
    }
  }
}