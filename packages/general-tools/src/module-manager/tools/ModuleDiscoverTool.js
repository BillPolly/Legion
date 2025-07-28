import Tool from '@legion/module-loader/src/tool/Tool.js';
import ToolResult from '@legion/module-loader/src/tool/ToolResult.js';
import { z } from 'zod';

/**
 * ModuleDiscoverTool - Discover modules in directories
 */
export default class ModuleDiscoverTool extends Tool {
  constructor(moduleManager, defaultDirectories = []) {
    super();
    this.moduleManager = moduleManager;
    this.defaultDirectories = defaultDirectories;
    this.name = 'module_discover';
    this.description = 'Discover available modules in specified directories';
  }

  get inputSchema() {
    return z.object({
      directories: z.array(z.string()).optional()
        .describe('Directories to scan (uses defaults if not provided)'),
      depth: z.number().optional().default(3)
        .describe('Maximum directory depth to search'),
      autoLoad: z.boolean().optional().default(false)
        .describe('Automatically load discovered modules'),
      filter: z.string().optional()
        .describe('Filter pattern for module names')
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
            directories: { 
              type: 'array',
              items: { type: 'string' },
              description: 'Directories to scan (uses defaults if not provided)'
            },
            depth: { 
              type: 'number', 
              description: 'Maximum directory depth to search'
            },
            autoLoad: { 
              type: 'boolean', 
              description: 'Automatically load discovered modules'
            },
            filter: { 
              type: 'string', 
              description: 'Filter pattern for module names'
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
      const { 
        directories = this.defaultDirectories, 
        depth, 
        autoLoad,
        filter 
      } = params;

      if (!directories || directories.length === 0) {
        return ToolResult.error('No directories specified and no defaults configured');
      }

      // Discover modules
      const discovered = await this.moduleManager.discoverModules(directories, {
        searchDepth: depth
      });

      // Apply filter if provided
      let modules = Array.from(discovered.entries());
      if (filter) {
        const filterRegex = new RegExp(filter, 'i');
        modules = modules.filter(([name]) => filterRegex.test(name));
      }

      // Convert to result format
      const moduleList = modules.map(([name, info]) => ({
        name,
        type: info.type,
        path: info.path,
        directory: info.directory,
        dependencies: info.dependencies || [],
        status: this.moduleManager.isModuleLoaded(name) ? 'loaded' : 'available'
      }));

      // Auto-load if requested
      let loadedCount = 0;
      const loadErrors = [];
      
      if (autoLoad) {
        for (const [name, info] of modules) {
          if (!this.moduleManager.isModuleLoaded(name)) {
            try {
              await this.moduleManager.loadModule(name);
              loadedCount++;
            } catch (error) {
              loadErrors.push({
                module: name,
                error: error.message
              });
            }
          }
        }
      }

      // Prepare result
      const result = {
        discovered: moduleList.length,
        modules: moduleList,
        directories: directories,
        searchDepth: depth
      };

      if (autoLoad) {
        result.autoLoad = {
          attempted: modules.length,
          loaded: loadedCount,
          errors: loadErrors
        };
      }

      // Group by status
      result.byStatus = moduleList.reduce((acc, module) => {
        acc[module.status] = (acc[module.status] || 0) + 1;
        return acc;
      }, {});

      // Group by type
      result.byType = moduleList.reduce((acc, module) => {
        acc[module.type] = (acc[module.type] || 0) + 1;
        return acc;
      }, {});

      return ToolResult.success(result);

    } catch (error) {
      return ToolResult.error(`Failed to discover modules: ${error.message}`);
    }
  }
}