/**
 * ModuleLoader - Simple, single entry point for loading Legion modules
 * 
 * This is the ONE object that should be used to load modules.
 * No factories, no managers, no complex hierarchy - just load modules.
 */

import { ModuleFactory } from './module/ModuleFactory.js';
import ResourceManager from './resources/ResourceManager.js';
import { getResourceManager } from './resources/getResourceManager.js';
import path from 'path';
import os from 'os';

export class ModuleLoader {
  /**
   * Create a simple module loader
   * @param {ResourceManager} resourceManager - Optional resource manager (uses singleton if not provided)
   */
  constructor(resourceManager = null) {
    this.resourceManager = resourceManager; // Will be set in initialize() if null
    this.moduleFactory = null; // Will be created after getting resourceManager
    this.loadedModules = new Map();
    this.toolRegistry = new Map(); // Tool name -> Tool instance mapping
    this._initialized = false;
    
    // Storage for tool registry database
    this._storage = null;
    this._toolsCollection = null;
    this._modulesCollection = null;
    this._aliasesCollection = null;
    this._dbInitialized = false;
  }

  /**
   * Initialize the loader (loads environment if needed)
   */
  async initialize() {
    if (this._initialized) {
      return;
    }
    
    // Get the singleton ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = await getResourceManager();
    } else if (!this.resourceManager.initialized) {
      await this.resourceManager.initialize();
    }
    
    // Now create the module factory
    this.moduleFactory = new ModuleFactory(this.resourceManager);
    
    // Register the ModuleLoader itself as a dependency for modules that need it
    this.resourceManager.register('moduleLoader', this);
    
    // Initialize tool registry database
    await this._initializeToolRegistry();
    
    this._initialized = true;
  }

  /**
   * Load a module from a directory (looks for Module.js or module.json)
   * @param {string} modulePath - Path to module directory
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModule(modulePath) {
    // Check if already loaded
    if (this.loadedModules.has(modulePath)) {
      return this.loadedModules.get(modulePath);
    }

    // Use ModuleFactory to create the module
    const module = await this.moduleFactory.createModuleAuto(modulePath);
    
    // Store it
    this.loadedModules.set(modulePath, module);
    
    // Register tools from the module
    await this._registerModuleTools(module);
    
    return module;
  }

  /**
   * Load a module from module.json file
   * @param {string} jsonPath - Path to module.json file
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModuleFromJson(jsonPath) {
    // Check if already loaded
    if (this.loadedModules.has(jsonPath)) {
      return this.loadedModules.get(jsonPath);
    }

    // Use ModuleFactory to create the module
    const module = await this.moduleFactory.createJsonModule(jsonPath);
    
    // Store it
    this.loadedModules.set(jsonPath, module);
    
    // Register tools from the module
    await this._registerModuleTools(module);
    
    return module;
  }

  /**
   * Get all loaded modules
   * @returns {Array} Array of loaded modules
   */
  getLoadedModules() {
    return Array.from(this.loadedModules.values());
  }

  /**
   * Load all modules from the registry
   * @returns {Promise<Object>} Summary of loaded modules
   */
  async loadAllFromRegistry() {
    if (!this._initialized) {
      await this.initialize();
    }
    
    // Load the registry
    const { readFile } = await import('fs/promises');
    const { resolve, dirname, join } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const registryPath = resolve(__dirname, 'ModuleRegistry.json');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    
    const results = {
      successful: [],
      failed: []
    };
    
    // Load each module from the registry
    for (const [moduleName, moduleInfo] of Object.entries(registry.modules)) {
      try {
        console.log(`[ModuleLoader] Loading module from registry: ${moduleName}`);
        
        const projectRoot = resolve(__dirname, '../../..');
        const modulePath = resolve(projectRoot, moduleInfo.path);
        
        let module;
        if (moduleInfo.type === 'json') {
          module = await this.loadModuleFromJson(modulePath);
        } else if (moduleInfo.type === 'class') {
          // For class modules, import the file directly and instantiate
          try {
            const moduleExports = await import(modulePath);
            const ModuleClass = moduleExports.default || moduleExports[moduleInfo.className];
            
            if (!ModuleClass) {
              throw new Error(`Module class ${moduleInfo.className || 'default'} not found in ${modulePath}`);
            }
            
            // Use factory to create the module with proper dependencies
            module = await this.moduleFactory.createModule(ModuleClass);
          } catch (importError) {
            // Fallback to directory-based loading
            const moduleDir = dirname(modulePath);
            module = await this.loadModule(moduleDir);
          }
        }
        
        if (module) {
          // Store with the registry name as key
          this.loadedModules.set(moduleName, module);
          
          // Register tools with module ID
          await this._registerModuleTools(module, moduleName);
          
          // Register module in database if available
          if (this._dbInitialized) {
            await this._registerModuleInDb(moduleName, moduleInfo);
          }
          
          results.successful.push(moduleName);
        }
      } catch (error) {
        console.error(`[ModuleLoader] Failed to load module ${moduleName}:`, error.message);
        results.failed.push({ name: moduleName, error: error.message });
      }
    }
    
    console.log(`[ModuleLoader] Registry loading complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Get all tools from all loaded modules
   * @returns {Promise<Array>} Array of all tools
   */
  async getAllTools() {
    const allTools = [];
    
    for (const module of this.loadedModules.values()) {
      if (module.getTools) {
        const toolsResult = module.getTools();
        // Handle both sync and async getTools
        const tools = toolsResult && typeof toolsResult.then === 'function' 
          ? await toolsResult 
          : toolsResult;
        
        if (Array.isArray(tools)) {
          allTools.push(...tools);
        }
      }
    }
    
    return allTools;
  }

  /**
   * Get a specific tool by name
   * @param {string} toolName - Name of the tool to get
   * @returns {Object|null} Tool instance or null if not found
   */
  getTool(toolName) {
    return this.toolRegistry.get(toolName) || null;
  }

  /**
   * Execute a tool by name with arguments
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} args - Arguments for the tool
   * @returns {Promise<Object>} Tool execution result
   */
  async executeTool(toolName, args) {
    // Use getToolByNameOrAlias to support aliases
    const tool = await this.getToolByNameOrAlias(toolName);
    if (!tool) {
      // Try to provide helpful error message
      const suggestions = await this._findSimilarToolNames(toolName);
      const suggestionText = suggestions.length > 0 
        ? ` Did you mean: ${suggestions.join(', ')}?`
        : '';
      throw new Error(`Tool not found: ${toolName}${suggestionText}`);
    }
    
    // Execute based on tool type
    if (typeof tool.execute === 'function') {
      return await tool.execute(args);
    } else if (typeof tool.invoke === 'function') {
      // For multi-function tools that use invoke
      const toolCall = {
        id: `ml-${Date.now()}`,
        type: 'function',
        function: {
          name: tool.name, // Use canonical name
          arguments: JSON.stringify(args)
        }
      };
      return await tool.invoke(toolCall);
    } else if (typeof tool.run === 'function') {
      return await tool.run(args);
    } else {
      throw new Error(`Tool ${tool.name} has no execute/invoke/run method`);
    }
  }

  /**
   * Get multiple tools by name
   * @param {Array<string>} toolNames - Array of tool names to get
   * @returns {Promise<Array>} Array of tool instances (null for not found)
   */
  async getToolsByName(toolNames) {
    return toolNames.map(name => this.getTool(name));
  }

  /**
   * Get all tool names currently registered
   * @returns {Array<string>} Array of tool names
   */
  getToolNames() {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Check if a tool is registered
   * @param {string} toolName - Name of the tool to check
   * @returns {boolean} True if tool is registered
   */
  hasTool(toolName) {
    return this.toolRegistry.has(toolName);
  }

  /**
   * Load a module by name from the registry or with a provided class
   * @param {string} moduleName - Name/identifier of the module
   * @param {Function} ModuleClass - Optional module class to instantiate. If not provided, loads from registry
   * @returns {Promise<Object>} Loaded module instance
   */
  async loadModuleByName(moduleName, ModuleClass) {
    // Check if already loaded
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName);
    }

    let module;
    let moduleInfo = null;
    
    // If no ModuleClass provided, try to load from registry
    if (!ModuleClass) {
      // Load the registry to find the module definition
      const { readFile } = await import('fs/promises');
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const registryPath = resolve(__dirname, 'ModuleRegistry.json');
      const registryContent = await readFile(registryPath, 'utf-8');
      const registry = JSON.parse(registryContent);
      
      // Check if module exists in registry
      if (!registry.modules[moduleName]) {
        throw new Error(`Module '${moduleName}' not found in registry`);
      }
      
      moduleInfo = registry.modules[moduleName];
      const projectRoot = resolve(__dirname, '../../..');
      const modulePath = resolve(projectRoot, moduleInfo.path);
      
      // Load based on type
      if (moduleInfo.type === 'json') {
        module = await this.moduleFactory.createJsonModule(modulePath);
      } else if (moduleInfo.type === 'class') {
        // Import and create the class module
        const moduleExports = await import(modulePath);
        const LoadedModuleClass = moduleExports.default || moduleExports[moduleInfo.className];
        
        if (!LoadedModuleClass) {
          throw new Error(`Module class ${moduleInfo.className || 'default'} not found in ${modulePath}`);
        }
        
        module = await this.moduleFactory.createModule(LoadedModuleClass);
      } else {
        throw new Error(`Unknown module type: ${moduleInfo.type}`);
      }
    } else {
      // Use provided ModuleClass
      module = await this.moduleFactory.createModule(ModuleClass);
    }
    
    // Store it
    this.loadedModules.set(moduleName, module);
    
    // Register tools from the module
    await this._registerModuleTools(module, moduleName);
    
    // Register module in database if available
    if (this._dbInitialized && moduleInfo) {
      await this._registerModuleInDb(moduleName, moduleInfo);
    }
    
    return module;
  }

  /**
   * Register tools from a module into the tool registry
   * @private
   * @param {Object} module - Module instance
   */
  async _registerModuleTools(module, moduleId = null) {
    if (module.getTools && typeof module.getTools === 'function') {
      const toolsResult = module.getTools();
      // Handle both sync and async getTools
      const tools = toolsResult && typeof toolsResult.then === 'function' 
        ? await toolsResult 
        : toolsResult;
      
      if (Array.isArray(tools)) {
        for (const tool of tools) {
          if (tool && tool.name) {
            this.toolRegistry.set(tool.name, tool);
          }
        }
        
        // Register in database if available and moduleId provided
        if (this._dbInitialized && moduleId) {
          await this._registerToolsInDb(moduleId, tools);
        }
      }
    }
  }

  /**
   * Clear all loaded modules and tools
   */
  clear() {
    this.loadedModules.clear();
    this.toolRegistry.clear();
  }
  
  /**
   * Get a loaded module by name
   * @param {string} moduleName - Name of the module
   * @returns {Object|null} The module instance or null if not loaded
   */
  getModule(moduleName) {
    return this.loadedModules.get(moduleName) || null;
  }
  
  /**
   * Get names of all loaded modules
   * @returns {Array<string>} Array of loaded module names
   */
  getLoadedModuleNames() {
    return Array.from(this.loadedModules.keys());
  }
  
  /**
   * Check if a module is loaded
   * @param {string} moduleName - Name of the module
   * @returns {boolean} True if module is loaded
   */
  hasModule(moduleName) {
    return this.loadedModules.has(moduleName);
  }

  /**
   * Generate a comprehensive inventory of all loaded modules and their tools
   * @returns {Object} Inventory with modules and tools information
   */
  getModuleAndToolInventory() {
    const inventory = {
      generatedAt: new Date().toISOString(),
      moduleCount: this.loadedModules.size,
      toolCount: this.toolRegistry.size,
      modules: {},
      tools: {}
    };

    // Document each module
    for (const [moduleName, module] of this.loadedModules.entries()) {
      inventory.modules[moduleName] = {
        name: module.name || moduleName,
        description: module.description || 'No description available',
        toolCount: 0,
        tools: []
      };

      // Get tools from this module
      if (module.getTools && typeof module.getTools === 'function') {
        const toolsResult = module.getTools();
        const tools = Array.isArray(toolsResult) ? toolsResult : [];
        
        inventory.modules[moduleName].toolCount = tools.length;
        inventory.modules[moduleName].tools = tools.map(tool => tool.name || 'unnamed');
      }
    }

    // Document each tool
    for (const [toolName, tool] of this.toolRegistry.entries()) {
      inventory.tools[toolName] = {
        name: toolName,
        description: tool.description || 'No description available',
        hasExecute: typeof tool.execute === 'function',
        hasInvoke: typeof tool.invoke === 'function',
        inputSchema: tool.inputSchema ? 'defined' : 'not defined'
      };
    }

    return inventory;
  }

  /**
   * Initialize the tool registry database using storage package
   * @private
   */
  async _initializeToolRegistry() {
    if (this._dbInitialized) {
      return;
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { StorageProvider, SQLiteProvider } = await import('@legion/storage');
      
      // Create storage provider
      this._storage = await StorageProvider.create(this.resourceManager);
      
      // Create SQLite provider for tool registry
      const dbPath = path.join(os.homedir(), '.legion', 'tool-registry.db');
      const sqliteProvider = new SQLiteProvider({
        filename: dbPath,
        verbose: false
      });
      
      // Add provider to storage
      await this._storage.addProvider('tool-registry', sqliteProvider);
      
      // Get the provider to access collections directly
      this._dbProvider = this._storage.getProvider('tool-registry');
      
      // Create wrapper objects for collections to simplify access
      this._toolsCollection = {
        find: (query, opts) => this._dbProvider.find('tools', query, opts),
        findOne: (query, opts) => this._dbProvider.findOne('tools', query, opts),
        upsert: async (doc) => {
          const existing = await this._dbProvider.findOne('tools', { _id: doc._id });
          if (existing) {
            return this._dbProvider.update('tools', { _id: doc._id }, { $set: doc });
          } else {
            return this._dbProvider.insert('tools', doc);
          }
        }
      };
      
      this._modulesCollection = {
        find: (query, opts) => this._dbProvider.find('modules', query, opts),
        findOne: (query, opts) => this._dbProvider.findOne('modules', query, opts),
        upsert: async (doc) => {
          const existing = await this._dbProvider.findOne('modules', { _id: doc._id });
          if (existing) {
            return this._dbProvider.update('modules', { _id: doc._id }, { $set: doc });
          } else {
            return this._dbProvider.insert('modules', doc);
          }
        }
      };
      
      this._aliasesCollection = {
        find: (query, opts) => this._dbProvider.find('tool_aliases', query, opts),
        findOne: (query, opts) => this._dbProvider.findOne('tool_aliases', query, opts),
        upsert: async (doc) => {
          const existing = await this._dbProvider.findOne('tool_aliases', { _id: doc._id });
          if (existing) {
            return this._dbProvider.update('tool_aliases', { _id: doc._id }, { $set: doc });
          } else {
            return this._dbProvider.insert('tool_aliases', doc);
          }
        }
      };
      
      // Create indexes for performance
      await this._createIndexes();
      
      this._dbInitialized = true;
      console.log('[ModuleLoader] Tool registry database initialized');
    } catch (error) {
      console.warn('[ModuleLoader] Could not initialize tool registry database:', error.message);
      // Continue without database - in-memory only
      this._dbInitialized = false;
    }
  }

  /**
   * Create database indexes for performance
   * @private
   */
  async _createIndexes() {
    // The storage package handles indexes internally
    // This is a placeholder for any custom index needs
  }

  /**
   * Get known aliases for a tool name
   * @private
   */
  _getToolAliases(toolName) {
    const aliasMap = {
      'write_file': ['file_write', 'create_file'],
      'read_file': ['file_read'],
      'execute_command': ['node_run_command', 'run_command'],
      'create_directory': ['directory_create', 'mkdir'],
      'list_directory': ['directory_list', 'ls']
    };
    
    return aliasMap[toolName] || [];
  }

  /**
   * Register a module in the database
   * @private
   */
  async _registerModuleInDb(moduleId, moduleInfo) {
    if (!this._dbInitialized) return;
    
    try {
      await this._modulesCollection.upsert({
        _id: moduleId,
        name: moduleId,
        path: moduleInfo.path,
        type: moduleInfo.type,
        className: moduleInfo.className,
        loaded: true,
        lastLoaded: new Date()
      });
    } catch (error) {
      console.error(`[ModuleLoader] Failed to register module ${moduleId} in database:`, error.message);
    }
  }

  /**
   * Register tools in the database
   * @private
   */
  async _registerToolsInDb(moduleId, tools) {
    if (!this._dbInitialized) return;
    
    try {
      for (const tool of tools) {
        if (!tool || !tool.name) continue;
        
        // Prepare tool document
        const toolDoc = {
          _id: tool.name,
          name: tool.name,
          moduleId: moduleId,
          description: tool.description || '',
          inputSchema: tool.inputSchema ? JSON.stringify(tool.inputSchema) : null,
          aliases: this._getToolAliases(tool.name)
        };
        
        // Insert/update tool
        await this._toolsCollection.upsert(toolDoc);
        
        // Insert aliases
        const aliases = this._getToolAliases(tool.name);
        for (const alias of aliases) {
          await this._aliasesCollection.upsert({
            _id: alias,
            canonicalName: tool.name,
            moduleId: moduleId
          });
        }
      }
    } catch (error) {
      console.error(`[ModuleLoader] Failed to register tools for module ${moduleId}:`, error.message);
    }
  }

  /**
   * Get tool by name or alias
   * @param {string} nameOrAlias - Tool name or alias
   * @returns {Promise<Object|null>} Tool instance or null
   */
  async getToolByNameOrAlias(nameOrAlias) {
    // Try in-memory registry first
    let tool = this.toolRegistry.get(nameOrAlias);
    if (tool) return tool;
    
    // If DB initialized, check aliases
    if (this._dbInitialized) {
      try {
        // Check if it's an alias
        const alias = await this._aliasesCollection.findOne({ _id: nameOrAlias });
        if (alias) {
          tool = this.toolRegistry.get(alias.canonicalName);
          if (tool) return tool;
        }
        
        // Check if tool exists in DB but not loaded
        const toolDoc = await this._toolsCollection.findOne({ _id: nameOrAlias });
        if (toolDoc && !this.toolRegistry.has(toolDoc.name)) {
          console.log(`[ModuleLoader] Tool '${nameOrAlias}' found in database but module '${toolDoc.moduleId}' not loaded`);
          return null;
        }
      } catch (error) {
        console.error('[ModuleLoader] Database lookup error:', error.message);
      }
    }
    
    return null;
  }

  /**
   * Check if a tool exists by name or alias
   * @param {string} nameOrAlias - Tool name or alias
   * @returns {Promise<boolean>} True if tool exists
   */
  async hasToolByNameOrAlias(nameOrAlias) {
    const tool = await this.getToolByNameOrAlias(nameOrAlias);
    return tool !== null;
  }

  /**
   * Get all available tool names including aliases
   * @param {boolean} includeAliases - Include aliases in the list
   * @returns {Promise<Array<string>>} Array of tool names
   */
  async getAllToolNames(includeAliases = true) {
    const names = new Set(this.toolRegistry.keys());
    
    if (includeAliases && this._dbInitialized) {
      try {
        const aliases = await this._aliasesCollection.find({});
        for (const alias of aliases) {
          names.add(alias._id);
        }
      } catch (error) {
        console.error('[ModuleLoader] Failed to get aliases:', error.message);
      }
    }
    
    return Array.from(names);
  }

  /**
   * Get tool schema information
   * @param {string} toolName - Tool name
   * @returns {Promise<Object|null>} Tool schema or null
   */
  async getToolSchema(toolName) {
    const tool = await this.getToolByNameOrAlias(toolName);
    if (!tool) return null;
    
    return {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema
    };
  }

  /**
   * Get which module provides a tool
   * @param {string} toolName - Tool name
   * @returns {Promise<string|null>} Module ID or null
   */
  async getModuleIdForTool(toolName) {
    if (!this._dbInitialized) return null;
    
    try {
      // First check if it's an alias
      const alias = await this._aliasesCollection.findOne({ _id: toolName });
      if (alias && alias.moduleId) {
        return alias.moduleId;
      }
      
      // Then check the tools collection
      const toolDoc = await this._toolsCollection.findOne({ _id: toolName });
      if (toolDoc && toolDoc.moduleId) {
        return toolDoc.moduleId;
      }
    } catch (error) {
      console.error('[ModuleLoader] Failed to get module for tool:', error.message);
    }
    
    return null;
  }

  /**
   * Validate if all tools in a plan exist
   * @param {Object} plan - Plan object
   * @returns {Promise<Object>} Validation result
   */
  async validatePlanTools(plan) {
    const errors = [];
    const suggestions = {};
    
    if (!plan || !plan.steps) {
      return { valid: false, errors: ['Invalid plan: no steps'], suggestions };
    }
    
    for (const step of plan.steps) {
      if (!step.actions) continue;
      
      for (const action of step.actions) {
        const exists = await this.hasToolByNameOrAlias(action.type);
        if (!exists) {
          errors.push(`Unknown tool: ${action.type} (step: ${step.id || step.name})`);
          
          // Find similar tool names
          if (this._dbInitialized) {
            const similar = await this._findSimilarToolNames(action.type);
            if (similar.length > 0) {
              suggestions[action.type] = similar;
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      suggestions
    };
  }

  /**
   * Find similar tool names for suggestions
   * @private
   */
  async _findSimilarToolNames(toolName) {
    const suggestions = [];
    const lowerName = toolName.toLowerCase();
    
    // Check all tool names
    for (const name of this.toolRegistry.keys()) {
      if (name.toLowerCase().includes(lowerName) || lowerName.includes(name.toLowerCase())) {
        suggestions.push(name);
      }
    }
    
    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Get list of modules needed for a plan
   * @param {Object} plan - Plan object
   * @returns {Promise<Array<string>>} Module IDs required
   */
  async getRequiredModulesForPlan(plan) {
    const moduleIds = new Set();
    
    if (!plan || !plan.steps || !this._dbInitialized) {
      return [];
    }
    
    for (const step of plan.steps) {
      if (!step.actions) continue;
      
      for (const action of step.actions) {
        const moduleId = await this.getModuleIdForTool(action.type);
        if (moduleId) {
          moduleIds.add(moduleId);
        }
      }
    }
    
    return Array.from(moduleIds);
  }

  /**
   * Sync tool registry with all modules in registry
   * @returns {Promise<Object>} Sync results
   */
  async syncToolRegistry() {
    if (!this._initialized) {
      await this.initialize();
    }
    
    const results = {
      synced: [],
      failed: []
    };
    
    // Load module registry
    const { readFile } = await import('fs/promises');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const registryPath = resolve(__dirname, 'ModuleRegistry.json');
    const registryContent = await readFile(registryPath, 'utf-8');
    const registry = JSON.parse(registryContent);
    
    for (const [moduleId, moduleInfo] of Object.entries(registry.modules)) {
      try {
        // Check if module needs updating
        if (this._dbInitialized) {
          const existing = await this._modulesCollection.findOne({ _id: moduleId });
          if (existing && existing.path === moduleInfo.path && this.loadedModules.has(moduleId)) {
            // Module already up to date
            continue;
          }
        }
        
        // Load module to get tools
        await this.loadModuleByName(moduleId);
        results.synced.push(moduleId);
        console.log(`[ModuleLoader] Synced module: ${moduleId}`);
      } catch (error) {
        results.failed.push({ module: moduleId, error: error.message });
        console.error(`[ModuleLoader] Failed to sync module ${moduleId}:`, error.message);
      }
    }
    
    console.log(`[ModuleLoader] Registry sync complete: ${results.synced.length} synced, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Get tool statistics
   * @returns {Promise<Object>} Tool statistics
   */
  async getToolStats() {
    const stats = {
      totalTools: this.toolRegistry.size,
      totalModules: this.loadedModules.size,
      toolsByModule: {},
      aliases: 0
    };
    
    // Count tools by module
    for (const [moduleName, module] of this.loadedModules.entries()) {
      if (module.getTools && typeof module.getTools === 'function') {
        const tools = module.getTools();
        stats.toolsByModule[moduleName] = Array.isArray(tools) ? tools.length : 0;
      }
    }
    
    // Count aliases if DB available
    if (this._dbInitialized) {
      try {
        const aliases = await this._aliasesCollection.find({});
        stats.aliases = aliases.length;
      } catch (error) {
        console.error('[ModuleLoader] Failed to count aliases:', error.message);
      }
    }
    
    return stats;
  }
}

export default ModuleLoader;