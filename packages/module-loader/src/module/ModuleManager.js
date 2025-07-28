import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { ModuleFactory } from './ModuleFactory.js';
import { ModuleRegistry } from './ModuleRegistry.js';
import { JsonModuleLoader } from './JsonModuleLoader.js';

/**
 * ModuleManager - Comprehensive module discovery, loading, and lifecycle management
 */
export class ModuleManager extends EventEmitter {
  /**
   * @param {ModuleFactory} moduleFactory - Factory for creating modules
   * @param {Object} options - Manager options
   */
  constructor(moduleFactory, options = {}) {
    super();
    
    if (!(moduleFactory instanceof ModuleFactory)) {
      throw new Error('ModuleFactory instance is required');
    }

    this.moduleFactory = moduleFactory;
    this.registry = new ModuleRegistry();
    this.jsonLoader = new JsonModuleLoader(options.jsonLoader);
    
    this.options = {
      searchDepth: 3,
      autoDiscover: true,
      moduleFilePatterns: ['Module.js', 'module.json', 'index.js'],
      ignoreDirs: ['node_modules', 'test', '__tests__', '.git'],
      ...options
    };

    // Track discovered but not loaded modules
    this.discoveredModules = new Map();
  }

  /**
   * Discover modules in specified directories
   * @param {string[]} directories - Directories to search
   * @param {Object} options - Discovery options
   * @returns {Promise<Map>} Map of discovered modules
   */
  async discoverModules(directories = [], options = {}) {
    const opts = { ...this.options, ...options };
    const discovered = new Map();

    for (const directory of directories) {
      try {
        const modules = await this.scanDirectory(directory, opts);
        modules.forEach((module, name) => {
          discovered.set(name, module);
          this.discoveredModules.set(name, module);
        });
      } catch (error) {
        this.emit('error', {
          type: 'discovery',
          directory,
          error: error.message
        });
      }
    }

    this.emit('discovered', {
      count: discovered.size,
      modules: Array.from(discovered.keys())
    });

    return discovered;
  }

  /**
   * Scan a directory for modules
   * @param {string} directory - Directory to scan
   * @param {Object} options - Scan options
   * @returns {Promise<Map>} Map of found modules
   */
  async scanDirectory(directory, options = {}) {
    const opts = { ...this.options, ...options };
    const modules = new Map();

    try {
      await this._scanDirectoryRecursive(directory, modules, opts, 0);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    return modules;
  }

  /**
   * Recursively scan directory for modules
   * @private
   */
  async _scanDirectoryRecursive(dir, modules, options, depth) {
    if (depth > options.searchDepth) {
      return;
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Check for module files in current directory
      for (const pattern of options.moduleFilePatterns) {
        const modulePath = path.join(dir, pattern);
        
        try {
          const stat = await fs.stat(modulePath);
          if (stat.isFile()) {
            const moduleInfo = await this._analyzeModuleFile(modulePath);
            if (moduleInfo) {
              modules.set(moduleInfo.name, moduleInfo);
              break; // Only one module per directory
            }
          }
        } catch (error) {
          // File doesn't exist, continue
        }
      }

      // Scan subdirectories
      for (const entry of entries) {
        if (entry.isDirectory() && 
            !options.ignoreDirs.includes(entry.name) && 
            !entry.name.startsWith('.')) {
          const subDir = path.join(dir, entry.name);
          await this._scanDirectoryRecursive(subDir, modules, options, depth + 1);
        }
      }
    } catch (error) {
      // Ignore permission errors
      if (error.code !== 'EACCES') {
        throw error;
      }
    }
  }

  /**
   * Analyze a module file and extract metadata
   * @private
   */
  async _analyzeModuleFile(filePath) {
    const ext = path.extname(filePath);
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, ext);

    try {
      if (filePath.endsWith('module.json')) {
        // JSON module
        const config = await this.jsonLoader.loadModuleConfig(filePath);
        const moduleInfo = {
          name: config.name || path.basename(dir),
          path: filePath,
          directory: dir,
          type: 'json',
          config: config,
          dependencies: config.dependencies || [],
          tools: []
        };
        
        // Extract tool information from JSON module config
        if (config.tools && Array.isArray(config.tools)) {
          moduleInfo.tools = config.tools.map(tool => ({
            name: tool.name,
            description: tool.description || 'No description',
            parameters: tool.parameters,
            type: 'json-defined',
            function: tool.function,
            instanceMethod: tool.instanceMethod,
            async: tool.async
          }));
          moduleInfo.toolCount = config.tools.length;
        } else {
          moduleInfo.toolCount = 0;
        }
        
        return moduleInfo;
      } else if (filePath.endsWith('.js')) {
        // JavaScript module
        // Try to import and check if it's a valid module
        const moduleExports = await import(`file://${filePath}`);
        const ModuleClass = moduleExports.default || moduleExports[Object.keys(moduleExports)[0]];
        
        if (ModuleClass && typeof ModuleClass === 'function') {
          // Extract name from class name or file
          const name = ModuleClass.name?.replace(/Module$/, '').toLowerCase() || 
                      baseName.replace(/Module$/, '').toLowerCase();
          
          const moduleInfo = {
            name,
            path: filePath,
            directory: dir,
            type: 'class',
            className: ModuleClass.name,
            dependencies: ModuleClass.dependencies || [],
            isAsyncFactory: typeof ModuleClass.create === 'function',
            tools: []
          };

          // Try to extract tool information without fully instantiating the module
          try {
            await this._cacheModuleTools(moduleInfo, ModuleClass);
          } catch (error) {
            // Log warning but don't fail discovery
            this.emit('warning', {
              type: 'tool-analysis',
              module: name,
              error: error.message
            });
          }
          
          return moduleInfo;
        }
      }
    } catch (error) {
      // Not a valid module file
      this.emit('warning', {
        type: 'analysis',
        file: filePath,
        error: error.message
      });
    }

    return null;
  }

  /**
   * Cache tool information for a module without fully loading it
   * @private
   */
  async _cacheModuleTools(moduleInfo, ModuleClass) {
    try {
      let toolsInfo = [];

      // Strategy 1: Check for module-info.json file with cached tool definitions
      const moduleInfoPath = path.join(moduleInfo.directory, 'module-info.json');
      try {
        const moduleInfoContent = await fs.readFile(moduleInfoPath, 'utf8');
        const moduleInfoData = JSON.parse(moduleInfoContent);
        if (moduleInfoData.tools && Array.isArray(moduleInfoData.tools)) {
          toolsInfo = moduleInfoData.tools.map(tool => ({
            name: tool.name,
            description: tool.description || 'No description',
            parameters: tool.parameters,
            type: 'cached',
            toolName: tool.toolName || 'unknown'
          }));
          moduleInfo.tools = toolsInfo;
          moduleInfo.toolCount = toolsInfo.length;
          return; // Successfully cached from module-info.json
        }
      } catch (error) {
        // module-info.json doesn't exist or is invalid - continue with other strategies
      }

      // Strategy 2: Check if module has static tool definitions
      if (ModuleClass.tools && Array.isArray(ModuleClass.tools)) {
        toolsInfo = ModuleClass.tools.map(tool => ({
          name: tool.name || 'unknown',
          description: tool.description || 'No description',
          type: 'static'
        }));
      }
      
      // Strategy 3: Try to temporarily instantiate if it's a simple constructor
      else if (!moduleInfo.isAsyncFactory) {
        try {
          // Create a minimal mock resource manager for instantiation
          const mockRM = {
            get: () => ({}),
            register: () => {},
            has: () => false
          };
          
          const tempInstance = new ModuleClass(mockRM);
          if (tempInstance && typeof tempInstance.getTools === 'function') {
            const tools = tempInstance.getTools();
            toolsInfo = [];
            
            // Extract individual functions from each tool
            tools.forEach(tool => {
              try {
                if (tool.getAllToolDescriptions) {
                  // Multi-function tool - extract all functions as separate entries
                  const allDescs = tool.getAllToolDescriptions();
                  allDescs.forEach(desc => {
                    toolsInfo.push({
                      name: desc.function.name,
                      description: desc.function.description,
                      parameters: desc.function.parameters,
                      type: 'function',
                      toolName: tool.name || tool.constructor.name
                    });
                  });
                } else if (tool.getToolDescription) {
                  // Single function tool
                  const desc = tool.getToolDescription();
                  toolsInfo.push({
                    name: desc.function.name,
                    description: desc.function.description,
                    parameters: desc.function.parameters,
                    type: 'function',
                    toolName: tool.name || tool.constructor.name
                  });
                } else {
                  // Fallback for tools without proper descriptions
                  toolsInfo.push({
                    name: tool.name || tool.constructor.name,
                    description: tool.description || 'No description',
                    type: 'tool-fallback',
                    toolName: tool.name || tool.constructor.name
                  });
                }
              } catch (err) {
                // If tool description fails, add basic info
                toolsInfo.push({
                  name: tool.name || tool.constructor.name,
                  description: `Tool inspection failed: ${err.message}`,
                  type: 'tool-error',
                  toolName: tool.name || tool.constructor.name,
                  error: err.message
                });
              }
            });
          }
          
          // Cleanup if possible
          if (tempInstance && typeof tempInstance.cleanup === 'function') {
            try {
              await tempInstance.cleanup();
            } catch (err) {
              // Ignore cleanup errors
            }
          }
        } catch (instantiationError) {
          // Instantiation failed - that's okay, we'll mark as unknown tools
          toolsInfo = [{
            name: 'unknown',
            description: 'Tools available but require module loading to inspect',
            type: 'requires-loading'
          }];
        }
      }
      
      // Strategy 4: For async factory modules, we can't easily inspect without full loading
      else {
        toolsInfo = [{
          name: 'unknown',
          description: 'Async factory module - tools available but require loading to inspect',
          type: 'async-factory'
        }];
      }
      
      moduleInfo.tools = toolsInfo;
      moduleInfo.toolCount = toolsInfo.length;
      
    } catch (error) {
      // If all strategies fail, mark as unknown
      moduleInfo.tools = [{
        name: 'unknown',
        description: 'Tool inspection failed - use module_load to access tools',
        type: 'inspection-failed',
        error: error.message
      }];
      moduleInfo.toolCount = 0;
    }
  }

  /**
   * Load a module by name or path
   * @param {string} moduleNameOrPath - Module name or path
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModule(moduleNameOrPath) {
    // Check if already loaded
    if (this.registry.isLoaded(moduleNameOrPath)) {
      return this.registry.getInstance(moduleNameOrPath);
    }

    let moduleInfo;

    // Check if it's a discovered module name
    if (this.discoveredModules.has(moduleNameOrPath)) {
      moduleInfo = this.discoveredModules.get(moduleNameOrPath);
    } else {
      // Try to analyze as a path
      moduleInfo = await this._analyzeModuleFile(moduleNameOrPath);
      if (!moduleInfo) {
        throw new Error(`Module '${moduleNameOrPath}' not found`);
      }
    }

    try {
      let instance;

      if (moduleInfo.type === 'json') {
        // Load JSON module
        instance = await this.moduleFactory.createJsonModule(moduleInfo.path);
      } else {
        // Load JavaScript module
        const moduleExports = await import(`file://${moduleInfo.path}`);
        const ModuleClass = moduleExports.default || moduleExports[Object.keys(moduleExports)[0]];

        if (moduleInfo.isAsyncFactory) {
          // Use async factory method
          instance = await ModuleClass.create(this.moduleFactory.resourceManager);
        } else {
          // Use ModuleFactory
          instance = this.moduleFactory.createModule(ModuleClass);
        }
      }

      // Register the loaded module
      this.registry.register(moduleInfo.name, moduleInfo, instance);

      this.emit('loaded', {
        name: moduleInfo.name,
        type: moduleInfo.type,
        path: moduleInfo.path
      });

      return instance;

    } catch (error) {
      this.emit('error', {
        type: 'load',
        module: moduleInfo.name,
        error: error.message
      });
      throw new Error(`Failed to load module '${moduleInfo.name}': ${error.message}`);
    }
  }

  /**
   * Load all modules from a directory
   * @param {string} directory - Directory to load from
   * @returns {Promise<Object>} Map of loaded modules
   */
  async loadAllModules(directory) {
    const discovered = await this.scanDirectory(directory);
    const loaded = new Map();

    for (const [name, moduleInfo] of discovered) {
      try {
        const instance = await this.loadModule(name);
        loaded.set(name, instance);
      } catch (error) {
        this.emit('warning', {
          type: 'load',
          module: name,
          error: error.message
        });
      }
    }

    return loaded;
  }

  /**
   * Unload a module
   * @param {string} moduleName - Module name
   * @returns {Promise<boolean>} True if module was unloaded
   */
  async unloadModule(moduleName) {
    const module = this.registry.get(moduleName);
    if (!module) {
      return false;
    }

    // Call cleanup if available
    if (module.instance && typeof module.instance.cleanup === 'function') {
      try {
        await module.instance.cleanup();
      } catch (error) {
        this.emit('warning', {
          type: 'cleanup',
          module: moduleName,
          error: error.message
        });
      }
    }

    // Remove from registry
    const unloaded = this.registry.unregister(moduleName);

    if (unloaded) {
      this.emit('unloaded', {
        name: moduleName
      });
    }

    return unloaded;
  }

  /**
   * Unload all modules
   * @returns {Promise<number>} Number of modules unloaded
   */
  async unloadAllModules() {
    const loaded = this.registry.getLoadedNames();
    let count = 0;

    for (const name of loaded) {
      if (await this.unloadModule(name)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Reload a module
   * @param {string} moduleName - Module name
   * @returns {Promise<Object>} Reloaded module instance
   */
  async reloadModule(moduleName) {
    const moduleInfo = this.registry.getMetadata(moduleName);
    if (!moduleInfo) {
      throw new Error(`Module '${moduleName}' not found`);
    }

    // Unload first
    await this.unloadModule(moduleName);

    // Clear module from require cache if it's a JS module
    if (moduleInfo.type === 'class') {
      const modulePath = moduleInfo.path;
      // Note: This won't work with ES modules, they can't be truly hot-reloaded
      // This is more for documentation/API consistency
    }

    // Reload
    return await this.loadModule(moduleName);
  }

  /**
   * Get loaded modules
   * @returns {Array} Array of loaded module entries
   */
  getLoadedModules() {
    return this.registry.getLoaded();
  }

  /**
   * Get available modules (discovered + loaded)
   * @returns {Array} Array of all known modules
   */
  getAvailableModules() {
    const available = [];
    
    // Add discovered modules
    for (const [name, info] of this.discoveredModules) {
      available.push({
        ...info,
        status: this.registry.isLoaded(name) ? 'loaded' : 'available'
      });
    }

    // Add any loaded modules not in discovered (edge case)
    for (const module of this.registry.getAll()) {
      if (!this.discoveredModules.has(module.name)) {
        available.push({
          name: module.name,
          ...module.metadata,
          status: 'loaded'
        });
      }
    }

    return available;
  }

  /**
   * Get module information
   * @param {string} moduleName - Module name
   * @returns {Object|null} Module information
   */
  getModuleInfo(moduleName) {
    const registered = this.registry.get(moduleName);
    if (registered) {
      // For loaded modules, get fresh tool information from the instance
      let tools = [];
      if (registered.instance?.getTools) {
        try {
          tools = registered.instance.getTools().flatMap(tool => {
            const info = {
              name: tool.name || tool.constructor.name,
              description: tool.description || 'No description',
              type: 'loaded'
            };
            
            // Try to get MCP description
            try {
              if (tool.getAllToolDescriptions) {
                // Multi-function tool - create separate entries for each function
                const allDescs = tool.getAllToolDescriptions();
                // Return expanded function list (flatMap will handle the array properly)
                return allDescs.map(desc => ({
                  name: desc.function.name,
                  description: desc.function.description,
                  parameters: desc.function.parameters,
                  type: 'loaded',
                  toolName: tool.name || tool.constructor.name
                }));
              } else if (tool.getToolDescription) {
                const desc = tool.getToolDescription();
                info.name = desc.function.name;
                info.description = desc.function.description;
                info.parameters = desc.function.parameters;
              }
            } catch (err) {
              // Use basic info if MCP description fails
            }
            
            return info;
          });
        } catch (error) {
          tools = [];
        }
      }
      
      return {
        ...registered.metadata,
        status: 'loaded',
        hasInstance: !!registered.instance,
        tools: tools,
        toolCount: tools.length
      };
    }

    const discovered = this.discoveredModules.get(moduleName);
    if (discovered) {
      return {
        ...discovered,
        status: 'available',
        hasInstance: false
      };
    }

    return null;
  }

  /**
   * Get cached tool information for a module (loaded or not)
   * @param {string} moduleName - Module name
   * @returns {Array} Array of tool information
   */
  getModuleTools(moduleName) {
    // First check if module is loaded and get fresh tools
    const registered = this.registry.get(moduleName);
    if (registered && registered.instance?.getTools) {
      try {
        const tools = registered.instance.getTools();
        const expandedTools = [];
        
        tools.forEach(tool => {
          try {
            if (tool.getAllToolDescriptions) {
              // Multi-function tool - create separate entries for each function
              const allDescs = tool.getAllToolDescriptions();
              allDescs.forEach(desc => {
                expandedTools.push({
                  name: desc.function.name,
                  description: desc.function.description,
                  parameters: desc.function.parameters,
                  type: 'loaded',
                  toolName: tool.name || tool.constructor.name
                });
              });
            } else if (tool.getToolDescription) {
              // Single function tool
              const desc = tool.getToolDescription();
              expandedTools.push({
                name: desc.function.name,
                description: desc.function.description,
                parameters: desc.function.parameters,
                type: 'loaded',
                toolName: tool.name || tool.constructor.name
              });
            } else {
              // Fallback for tools without proper descriptions
              expandedTools.push({
                name: tool.name || tool.constructor.name,
                description: tool.description || 'No description',
                type: 'loaded',
                toolName: tool.name || tool.constructor.name
              });
            }
          } catch (err) {
            // If tool description fails, add basic info
            expandedTools.push({
              name: tool.name || tool.constructor.name,
              description: `Tool inspection failed: ${err.message}`,
              type: 'loaded-error',
              toolName: tool.name || tool.constructor.name,
              error: err.message
            });
          }
        });
        
        return expandedTools;
      } catch (error) {
        // Fall through to cached tools
      }
    }

    // Use cached tool information from discovery
    const discovered = this.discoveredModules.get(moduleName);
    if (discovered && discovered.tools) {
      return discovered.tools;
    }

    return [];
  }

  /**
   * Check if module is loaded
   * @param {string} moduleName - Module name
   * @returns {boolean} True if module is loaded
   */
  isModuleLoaded(moduleName) {
    return this.registry.isLoaded(moduleName);
  }

  /**
   * Get registry instance
   * @returns {ModuleRegistry} The module registry
   */
  getRegistry() {
    return this.registry;
  }

  /**
   * Get statistics
   * @returns {Object} Manager statistics
   */
  getStats() {
    const registryStats = this.registry.getStats();
    return {
      ...registryStats,
      totalDiscovered: this.discoveredModules.size,
      totalAvailable: this.getAvailableModules().length
    };
  }
}

export default ModuleManager;