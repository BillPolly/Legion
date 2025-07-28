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

      // Get module information (loaded or cached from discovery)
      const moduleInfo = this.moduleManager.getModuleInfo(moduleName);
      if (!moduleInfo) {
        return ToolResult.failure(`Module '${moduleName}' not found. Use module_discover to find available modules.`);
      }

      // Get cached tool information (works for both loaded and unloaded modules)
      const tools = this.moduleManager.getModuleTools(moduleName);
      
      const result = {
        module: moduleName,
        status: moduleInfo.status,
        toolCount: tools.length,
        tools: []
      };

      if (tools.length === 0) {
        result.message = 'No tools found for this module';
        return ToolResult.success(result);
      }

      if (format === 'detailed') {
        result.tools = tools.map(tool => {
          const toolInfo = {
            name: tool.name,
            description: tool.description,
            type: tool.type
          };

          // Include schema if requested and available
          if (includeSchema && tool.parameters) {
            toolInfo.inputSchema = tool.parameters;
          }

          // Include tool name for context
          if (tool.toolName && tool.toolName !== tool.name) {
            toolInfo.toolName = tool.toolName;
          }

          // Include error information if tool inspection failed
          if (tool.error) {
            toolInfo.error = tool.error;
          }

          return toolInfo;
        });
      } else {
        // Simple format - just function names
        result.tools = tools.map(tool => tool.name);
      }

      // Add helpful messages based on tool types
      const toolTypes = [...new Set(tools.map(t => t.type))];
      if (toolTypes.includes('requires-loading') || toolTypes.includes('async-factory') || toolTypes.includes('inspection-failed')) {
        result.note = 'Some tools require module loading for full inspection. Use module_load to load the module first.';
      }

      return ToolResult.success(result);

    } catch (error) {
      return ToolResult.failure(`Failed to list module tools: ${error.message}`);
    }
  }
}