import { Tool } from '@legion/tool-system';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ModuleLoadTool extends Tool {
  constructor(dependencies = {}) {
    super({
      name: 'module_load',
      description: 'Load a module to make its tools available',
      inputSchema: z.object({
        name: z.string().describe('Name of the module to load')
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
    
    // Check if already loaded
    if (moduleLoader.hasModule(args.name)) {
      return {
        success: true,
        message: `Module '${args.name}' is already loaded`
      };
    }
    
    try {
      // Load the module registry
      const registryPath = resolve(__dirname, '../../../module-loader/src/ModuleRegistry.json');
      const registry = JSON.parse(readFileSync(registryPath, 'utf-8'));
      
      const moduleInfo = registry.modules[args.name];
      if (!moduleInfo) {
        return {
          success: false,
          error: `Module '${args.name}' not found in registry. Available modules: ${Object.keys(registry.modules).join(', ')}`
        };
      }
      
      // Load the module based on its type
      const projectRoot = resolve(__dirname, '../../../..');  // Go up to Legion root
      const modulePath = resolve(projectRoot, moduleInfo.path);
      
      let module;
      if (moduleInfo.type === 'json') {
        console.log(`[ModuleLoadTool] Loading JSON module from ${modulePath}`);
        module = await moduleLoader.loadModuleFromJson(modulePath);
        
        // Store it in the moduleLoader's loaded modules
        moduleLoader.loadedModules.set(args.name, module);
        
        // For GenericModule, wait for initialization to complete
        if (module._initPromise) {
          console.log(`[ModuleLoadTool] Waiting for module initialization...`);
          await module._initPromise;
        }
      } else if (moduleInfo.type === 'class') {
        // Import and load the class module
        const moduleExports = await import(modulePath);
        const ModuleClass = moduleExports.default || moduleExports[moduleInfo.className];
        
        if (!ModuleClass) {
          throw new Error(`Module class not found in ${modulePath}`);
        }
        
        module = await moduleLoader.loadModuleByName(args.name, ModuleClass);
      }
      
      if (!module) {
        throw new Error(`Failed to load module ${args.name}`);
      }
      
      // Get tool count - handle async getTools
      let tools = [];
      if (module.getTools) {
        const toolsResult = module.getTools();
        tools = toolsResult && typeof toolsResult.then === 'function' 
          ? await toolsResult 
          : toolsResult;
      }
      const toolCount = Array.isArray(tools) ? tools.length : 0;
      
      console.log(`[ModuleLoadTool] Module ${args.name} loaded with ${toolCount} tools`);
      
      // Register the tools with the ModuleLoader's tool registry
      if (tools && tools.length > 0) {
        for (const tool of tools) {
          if (tool.name) {
            moduleLoader.toolRegistry.set(tool.name, tool);
          }
        }
      }
      
      // Get tool definitions for UI registry
      const toolDefinitions = [];
      for (const tool of tools) {
        if (tool.toJSON) {
          toolDefinitions.push(tool.toJSON());
        } else if (tool.name) {
          // Fallback for tools without toJSON method
          toolDefinitions.push({
            name: tool.name,
            description: tool.description || 'No description',
            inputSchema: tool.inputSchema || {}
          });
        }
      }
      
      return {
        success: true,
        message: `Module '${args.name}' loaded successfully`,
        toolCount,
        tools: tools.map(t => t.name || 'unnamed'),
        toolDefinitions: toolDefinitions
      };
      
    } catch (error) {
      return {
        success: false,
        error: `Failed to load module '${args.name}': ${error.message}`
      };
    }
  }
}