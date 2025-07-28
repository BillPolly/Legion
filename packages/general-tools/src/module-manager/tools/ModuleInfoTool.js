import Tool from '@legion/module-loader/src/tool/Tool.js';
import ToolResult from '@legion/module-loader/src/tool/ToolResult.js';
import { z } from 'zod';

/**
 * ModuleInfoTool - Get detailed information about a module
 */
export default class ModuleInfoTool extends Tool {
  constructor(moduleManager) {
    super();
    this.moduleManager = moduleManager;
    this.name = 'module_info';
    this.description = 'Get detailed information about a module';
  }

  get inputSchema() {
    return z.object({
      module: z.string().describe('Module name to get info for'),
      includeTools: z.boolean().optional().default(true).describe('Include tool details'),
      includeSource: z.boolean().optional().default(false).describe('Include source code location')
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
              description: 'Module name to get info for'
            },
            includeTools: { 
              type: 'boolean', 
              description: 'Include tool details'
            },
            includeSource: { 
              type: 'boolean', 
              description: 'Include source code location'
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
      const { module: moduleName, includeTools, includeSource } = params;

      // Get module info
      const info = this.moduleManager.getModuleInfo(moduleName);
      
      if (!info) {
        return ToolResult.failure(`Module '${moduleName}' not found`);
      }

      const result = {
        name: info.name,
        status: info.status || 'unknown',
        type: info.type || 'unknown',
        loaded: this.moduleManager.isModuleLoaded(moduleName),
        metadata: {
          ...info,
          hasInstance: undefined // Remove internal property
        }
      };

      // Add source information if requested
      if (includeSource && info.path) {
        result.source = {
          path: info.path,
          directory: info.directory || require('path').dirname(info.path),
          type: info.type
        };
      }

      // Add tool information if loaded and requested
      if (includeTools && this.moduleManager.isModuleLoaded(moduleName)) {
        const registry = this.moduleManager.getRegistry();
        const instance = registry.getInstance(moduleName);
        
        if (instance && instance.getTools) {
          const tools = instance.getTools();
          result.tools = tools.map(tool => ({
            name: tool.name || tool.constructor.name,
            description: tool.description || 'No description',
            inputSchema: tool.inputSchema ? this._schemaToJson(tool.inputSchema) : null
          }));
          result.toolCount = tools.length;
        }
      }

      // Add dependencies
      if (info.dependencies && info.dependencies.length > 0) {
        result.dependencies = info.dependencies;
      }

      // Add timestamps if available
      if (info.registeredAt) {
        result.timestamps = {
          registered: info.registeredAt,
          lastUpdated: info.lastUpdated
        };
      }

      return ToolResult.success(result);

    } catch (error) {
      return ToolResult.failure(`Failed to get module info: ${error.message}`);
    }
  }

  _schemaToJson(schema) {
    // Convert Zod schema to simplified JSON representation
    if (schema._def) {
      // It's a Zod schema
      return {
        type: schema._def.typeName,
        description: schema._def.description
      };
    }
    return schema;
  }
}