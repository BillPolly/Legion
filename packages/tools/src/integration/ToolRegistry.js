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
      // Check module cache first
      if (this.moduleCache.has(moduleName)) {
        return this.moduleCache.get(moduleName);
      }

      // Get module metadata from database
      const moduleMetadata = await this.provider.getModule(moduleName);
      if (!moduleMetadata) {
        console.warn(`Module ${moduleName} not found in database`);
        return null;
      }

      // Load module using hardcoded mappings (for reliability)
      const moduleInstance = await this.#loadModuleByName(moduleName);
      
      if (moduleInstance) {
        this.moduleCache.set(moduleName, moduleInstance);
        return moduleInstance;
      }

      return null;
      
    } catch (error) {
      console.warn(`Failed to load module ${moduleName} from database:`, error.message);
      return null;
    }
  }

  /**
   * Load module by name using known mappings
   */
  async #loadModuleByName(moduleName) {
    // First check if this is a JSON module by looking for module metadata with type 'json'
    const moduleMetadata = await this.provider.getModule(moduleName);
    if (moduleMetadata && moduleMetadata.type === 'json') {
      // This is a JSON-based dynamic module
      return await this.#loadJsonModule(moduleName, moduleMetadata);
    }

    // Map database module names to their actual file paths  
    const moduleMap = {
      'File': '../../../tools-collection/src/file/index.js',
      'Calculator': '../../../tools-collection/src/calculator/index.js', 
      'Json': '../../../tools-collection/src/json/index.js',
      'CommandExecutor': '../../../tools-collection/src/command-executor/index.js',
      'System': '../../../tools-collection/src/system/index.js',
      'AIGeneration': '../../../tools-collection/src/ai-generation/index.js',
      'Github': '../../../tools-collection/src/github/index.js',
      'Serper': '../../../tools-collection/src/serper/index.js'
    };

    const modulePath = moduleMap[moduleName];
    if (!modulePath) {
      console.warn(`No known path for module: ${moduleName}`);
      return null;
    }

    try {
      const ModuleClass = await import(modulePath);
      const moduleInstance = new (ModuleClass.default || ModuleClass)();
      return moduleInstance;
    } catch (error) {
      console.warn(`Failed to load module ${moduleName} from ${modulePath}:`, error.message);
      return null;
    }
  }

  /**
   * Load a JSON-based dynamic module
   */
  async #loadJsonModule(moduleName, moduleMetadata) {
    try {
      // For JSON modules, we need to load the module.json file and create a dynamic wrapper
      const { DynamicJsonModule } = await import('../modules/DynamicJsonModule.js');
      
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
   */
  #extractToolFromModule(moduleInstance, toolName) {
    try {
      // Try getTool method first
      if (moduleInstance.getTool && typeof moduleInstance.getTool === 'function') {
        const tool = moduleInstance.getTool(toolName);
        if (tool) return tool;
      }
      
      // Try getTools method
      if (moduleInstance.getTools && typeof moduleInstance.getTools === 'function') {
        const tools = moduleInstance.getTools();
        if (Array.isArray(tools)) {
          const tool = tools.find(t => t.name === toolName);
          if (tool) return tool;
        }
      }

      return null;
      
    } catch (error) {
      console.warn(`Failed to extract tool ${toolName} from module:`, error.message);
      return null;
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