/**
 * Clean ToolRegistry - MongoDB-focused with simple public API
 * 
 * Public API:
 * - getTool(name) - Get executable tool
 * - listTools(options) - List available tools
 * - searchTools(query) - Search for tools
 */

import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '../ResourceManager.js';

export class ToolRegistry {
  constructor(options = {}) {
    // Default to MongoDB provider if none specified
    this.provider = options.provider || null;
    this.resourceManager = options.resourceManager || null;
    
    // Caching
    this.toolCache = new Map();
    this.moduleCache = new Map();
    
    // State
    this.initialized = false;
    this.usageStats = new Map();
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.initialized) return;
    
    // Create default ResourceManager if not provided
    if (!this.resourceManager) {
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();
    }
    
    // Create default MongoDB provider if not provided
    if (!this.provider) {
      this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    this.initialized = true;
  }

  // ============================================================================
  // PUBLIC API - Only these 3 methods should be exposed
  // ============================================================================

  /**
   * Get executable tool by name
   */
  async getTool(name) {
    await this.#ensureInitialized();
    
    if (!name || typeof name !== 'string') {
      return null;
    }
    
    // 1. Check cache first
    if (this.toolCache.has(name)) {
      this.#trackUsage(name);
      return this.toolCache.get(name);
    }
    
    // 2. Get executable tool from MongoDB
    const executableTool = await this.#getExecutableToolFromMongoDB(name);
    
    // 3. Cache and return
    if (executableTool) {
      this.toolCache.set(name, executableTool);
      this.#trackUsage(name);
    }
    
    return executableTool;
  }

  /**
   * List available tools
   */
  async listTools(options = {}) {
    await this.#ensureInitialized();
    
    return await this.provider.listTools(options);
  }

  /**
   * Search for tools
   */
  async searchTools(query, options = {}) {
    await this.#ensureInitialized();
    
    if (this.provider.searchTools) {
      return await this.provider.searchTools(query, options);
    }
    
    // Fallback: search in tool names/descriptions
    const allTools = await this.provider.listTools();
    const queryLower = query.toLowerCase();
    
    return allTools.filter(tool => 
      tool.name.toLowerCase().includes(queryLower) ||
      (tool.description && tool.description.toLowerCase().includes(queryLower))
    );
  }

  // ============================================================================
  // PRIVATE IMPLEMENTATION - All MongoDB-specific logic
  // ============================================================================

  /**
   * Ensure registry is initialized
   */
  async #ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get executable tool from MongoDB
   */
  async #getExecutableToolFromMongoDB(name) {
    try {
      // 1. Get tool metadata from database
      let toolMetadata;
      if (name.includes('.')) {
        const [moduleName, toolName] = name.split('.');
        toolMetadata = await this.provider.getTool(toolName, moduleName);
      } else {
        toolMetadata = await this.provider.getTool(name);
      }

      if (!toolMetadata) {
        return null;
      }

      // 2. Get module name from tool metadata
      const moduleName = toolMetadata.moduleName || toolMetadata.module;
      if (!moduleName) {
        console.warn(`Tool ${name} has no module reference in database`);
        return null;
      }

      // 3. Load module instance
      const moduleInstance = await this.#loadModuleFromMongoDB(moduleName);
      if (!moduleInstance) {
        console.warn(`Could not load module ${moduleName} for tool ${name}`);
        return null;
      }

      // 4. Get executable tool from module
      const executableTool = this.#extractToolFromModule(moduleInstance, toolMetadata.name);
      
      if (!executableTool) {
        console.warn(`Failed to get tool ${toolMetadata.name} from module ${moduleName}`);
        return null;
      }

      return executableTool;
      
    } catch (error) {
      console.warn(`Failed to get tool ${name} from database:`, error.message);
      return null;
    }
  }

  /**
   * Load module from MongoDB metadata
   */
  async #loadModuleFromMongoDB(moduleName) {
    try {
      console.log(`[DEBUG] Loading module '${moduleName}' from MongoDB`);
      
      // Check module cache first
      if (this.moduleCache.has(moduleName)) {
        console.log(`[DEBUG] Module '${moduleName}' found in cache`);
        return this.moduleCache.get(moduleName);
      }

      // Get module metadata from database
      const moduleMetadata = await this.provider.getModule(moduleName);
      if (!moduleMetadata) {
        console.warn(`Module ${moduleName} not found in database`);
        return null;
      }
      
      console.log(`[DEBUG] Module metadata found: type=${moduleMetadata.type}, path=${moduleMetadata.path}`);

      // Load module using hardcoded mappings (for reliability)
      const moduleInstance = await this.#loadModuleByName(moduleName);
      
      if (moduleInstance) {
        console.log(`[DEBUG] Module '${moduleName}' loaded successfully`);
        console.log(`[DEBUG] Module instance type: ${typeof moduleInstance}`);
        console.log(`[DEBUG] Module instance constructor: ${moduleInstance?.constructor?.name}`);
        this.moduleCache.set(moduleName, moduleInstance);
        return moduleInstance;
      }

      console.log(`[DEBUG] Module '${moduleName}' failed to load`);
      return null;
      
    } catch (error) {
      console.warn(`Failed to load module ${moduleName} from database:`, error.message);
      return null;
    }
  }

  /**
   * Load module by name using the ModuleLoader system
   */
  async #loadModuleByName(moduleName) {
    try {
      // Get module metadata from database
      const moduleMetadata = await this.provider.getModule(moduleName);
      if (!moduleMetadata) {
        console.warn(`Module metadata not found for: ${moduleName}`);
        return null;
      }

      // Handle JSON modules
      if (moduleMetadata.type === 'json') {
        return await this.#loadJsonModule(moduleName, moduleMetadata);
      }

      // Handle class modules - use ModuleLoader approach
      const { ModuleLoader } = await import('../loading/ModuleLoader.js');
      const loader = new ModuleLoader({ 
        verbose: false,
        resourceManager: this.resourceManager 
      });
      await loader.initialize();
      
      // Load single module by creating a temporary registry entry
      const moduleConfig = {
        name: moduleMetadata.name,
        type: moduleMetadata.type,
        path: moduleMetadata.path,
        className: moduleMetadata.className,
        description: moduleMetadata.description
      };

      // Use the module loader to load this specific module
      const moduleInstance = await loader.loadModule(moduleConfig);
      if (moduleInstance) {
        return moduleInstance;
      }

      // Fallback: direct loading based on known module locations
      const fallbackInstance = await this.#loadModuleDirectly(moduleMetadata);
      return fallbackInstance;

    } catch (error) {
      console.warn(`Failed to load module ${moduleName}:`, error.message);
      return null;
    }
  }

  /**
   * Load module directly from filesystem
   */
  async #loadModuleDirectly(moduleMetadata) {
    try {
      const path = await import('path');
      const fs = await import('fs');

      // Build the module path from Legion root
      let modulePath;
      const basePath = moduleMetadata.path;
      
      // Determine the actual file path
      if (basePath.includes('tools-collection')) {
        // Tools collection modules
        modulePath = path.resolve('../../' + basePath + '/index.js');
      } else {
        // Package modules  
        modulePath = path.resolve('../../' + basePath + '/index.js');
      }

      // Check if the file exists
      if (!fs.existsSync(modulePath)) {
        console.warn(`Module file not found: ${modulePath}`);
        return null;
      }

      // Import and instantiate the module
      const ModuleClass = await import(modulePath);
      const ActualClass = ModuleClass.default || ModuleClass[moduleMetadata.className];
      
      if (!ActualClass) {
        console.warn(`Module class ${moduleMetadata.className} not found in ${modulePath}`);
        return null;
      }

      // Try factory pattern first
      if (ActualClass.create && typeof ActualClass.create === 'function') {
        return await ActualClass.create(this.resourceManager);
      }

      // Direct instantiation
      return new ActualClass();

    } catch (error) {
      console.warn(`Direct module loading failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Load a JSON-based dynamic module
   */
  async #loadJsonModule(moduleName, moduleMetadata) {
    try {
      // For JSON modules, we need to load the module.json file and create a dynamic wrapper
      const { DynamicJsonModule } = await import('../loading/DynamicJsonModule.js');
      
      // The moduleMetadata should contain the JSON definition
      // For now, we'll create a simple wrapper that can execute the inline functions
      const moduleInstance = new DynamicJsonModule(moduleName, moduleMetadata);
      await moduleInstance.initialize();
      
      return moduleInstance;
    } catch (error) {
      console.warn(`Failed to load JSON module ${moduleName}:`, error.message);
      return null;
    }
  }

  /**
   * Extract tool from module instance
   * Enforces that modules MUST use dictionary pattern for tools storage
   */
  #extractToolFromModule(moduleInstance, toolName) {
    try {
      // Verify module has tools property and it's a dictionary
      if (!moduleInstance.tools) {
        throw new Error(`Module does not have a 'tools' property. Modules must store tools in a dictionary.`);
      }
      
      if (Array.isArray(moduleInstance.tools)) {
        throw new Error(`Module stores tools as an array. Modules MUST store tools as a dictionary/object keyed by tool name.`);
      }
      
      if (typeof moduleInstance.tools !== 'object') {
        throw new Error(`Module 'tools' property is not an object. Expected dictionary/object, got ${typeof moduleInstance.tools}`);
      }
      
      // Use the base Module class's getTool method (which looks up this.tools[name])
      if (moduleInstance.getTool && typeof moduleInstance.getTool === 'function') {
        try {
          const tool = moduleInstance.getTool(toolName);
          if (tool) {
            return tool;
          }
        } catch (getToolError) {
          // Tool not found in dictionary
          console.warn(`Tool '${toolName}' not found in module. Error: ${getToolError.message}`);
        }
      }
      
      // Direct dictionary lookup as fallback
      const tool = moduleInstance.tools[toolName];
      if (tool) {
        return tool;
      }
      
      // Tool not found - list available tools for debugging
      const availableTools = Object.keys(moduleInstance.tools);
      console.warn(`Tool '${toolName}' not found in module. Available tools: [${availableTools.join(', ')}]`);
      return null;
      
    } catch (error) {
      console.error(`Failed to extract tool ${toolName} from module:`, error.message);
      throw error; // Re-throw to enforce the contract
    }
  }

  /**
   * Track tool usage
   */
  #trackUsage(toolName) {
    const count = this.usageStats.get(toolName) || 0;
    this.usageStats.set(toolName, count + 1);
  }

  /**
   * Get usage statistics
   */
  getUsageStats() {
    return Object.fromEntries(this.usageStats);
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.toolCache.clear();
    this.moduleCache.clear();
    this.usageStats.clear();
  }

  /**
   * Populate database (convenience method)
   */
  async populateDatabase(options = {}) {
    await this.#ensureInitialized();
    
    const { ComprehensiveToolDiscovery } = await import('../discovery/ComprehensiveToolDiscovery.js');
    const discovery = new ComprehensiveToolDiscovery();
    
    return await discovery.populateDatabase({
      mode: options.mode || 'clear',
      verbose: options.verbose || false,
      includeEmbeddings: false
    });
  }
}