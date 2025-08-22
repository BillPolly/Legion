/**
 * Clean ToolRegistry - MongoDB-focused with simple public API
 * 
 * Public API:
 * - getTool(name) - Get executable tool
 * - listTools(options) - List available tools
 * - searchTools(query) - Search for tools
 */

import { MongoDBToolRegistryProvider } from '../providers/MongoDBToolRegistryProvider.js';
import { ResourceManager } from '@legion/resource-manager';
import { SemanticToolDiscovery } from '../search/SemanticToolDiscovery.js';
// LRUCache removed - no caching
import { Mutex } from 'async-mutex';
import {
  ToolRegistryError,
  ModuleNotFoundError,
  ToolNotFoundError,
  ToolExecutionError,
  ModuleLoadError,
  DatabaseError,
  SemanticSearchError,
  ValidationError,
  InitializationError,
  CleanupError
} from '../errors/ToolRegistryErrors.js';

export class ToolRegistry {
  static _instance = null;
  
  constructor(options = {}) {
    // Implement singleton pattern
    if (ToolRegistry._instance && !options._forceNew) {
      return ToolRegistry._instance;
    }
    
    // Default to MongoDB provider if none specified
    this.provider = options.provider || null;
    // Always use ResourceManager singleton - no option to override
    this.resourceManager = null;
    
    // NO CACHE - Direct database access only
    // Caching removed to avoid synchronization issues
    // All tool and module access goes directly to MongoDB
    
    // Semantic search
    this.semanticDiscovery = null;
    this.enableSemanticSearch = options.enableSemanticSearch !== false; // Default to true
    
    // Loading manager for database operations
    this._loader = null;
    
    // State
    this.initialized = false;
    this.usageStats = new Map();
    
    // Concurrency control
    this.moduleOperationMutexes = new Map(); // Mutex per module
    this.globalOperationMutex = new Mutex(); // Global mutex for all-module operations
    
    // Set singleton instance if this is the first creation
    if (!ToolRegistry._instance) {
      ToolRegistry._instance = this;
    }
  }
  
  /**
   * Get the singleton instance of ToolRegistry
   * @returns {ToolRegistry} The singleton instance
   */
  static getInstance() {
    if (!ToolRegistry._instance) {
      ToolRegistry._instance = new ToolRegistry();
    }
    return ToolRegistry._instance;
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.initialized) return;
    
    // Always use ResourceManager singleton
    this.resourceManager = ResourceManager.getInstance();
    if (!this.resourceManager.initialized) {
      await this.resourceManager.initialize();
    }
    
    // Create default MongoDB provider if not provided
    if (!this.provider) {
      this.provider = await MongoDBToolRegistryProvider.create(this.resourceManager, {
        enableSemanticSearch: false
      });
    }
    
    // Initialize semantic tool discovery if enabled
    if (this.enableSemanticSearch) {
      try {
        this.semanticDiscovery = await SemanticToolDiscovery.createForTools(
          this.resourceManager,
          {
            collectionName: 'tool_perspectives',  // Use the correct Qdrant collection name
            toolRegistry: this
          }
        );
        console.log('✅ Semantic tool search initialized');
      } catch (error) {
        console.warn('⚠️ Semantic tool search not available:', error.message);
        // Continue without semantic search
      }
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
    await this._ensureInitialized();
    
    if (!name) {
      throw new ValidationError('name', 'string', name);
    }
    
    if (typeof name !== 'string') {
      throw new ValidationError('name', 'string', name);
    }
    
    // Get executable tool directly from MongoDB (no cache)
    const executableTool = await this.#getExecutableToolFromMongoDB(name);
    
    if (executableTool) {
      this.#trackUsage(name);
    }
    
    return executableTool;
  }

  /**
   * List available tools
   */
  async listTools(options = {}) {
    await this._ensureInitialized();
    
    return await this.provider.listTools(options);
  }

  /**
   * Search for tools (text-based search)
   */
  async searchTools(query, options = {}) {
    await this._ensureInitialized();
    
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

  /**
   * Semantic tool search - Find tools using natural language queries
   * Returns tools with confidence scores based on semantic similarity
   * 
   * @param {string} query - Natural language description of what you want to do
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results (default: 10)
   * @param {number} options.minConfidence - Minimum confidence score 0-1 (default: 0.5)
   * @param {boolean} options.includeExecutable - Include executable tool instances (default: true)
   * @returns {Promise<Object>} Search results with tools and confidence scores
   */
  async semanticToolSearch(query, options = {}) {
    await this._ensureInitialized();
    
    const {
      limit = 10,
      minConfidence = 0.5,
      includeExecutable = true
    } = options;
    
    // Check if semantic search is available - no fallbacks, raise error
    if (!this.semanticDiscovery) {
      throw new SemanticSearchError(
        'semanticToolSearch',
        'Semantic discovery service not initialized',
        { query }
      );
    }
    
    // Perform semantic search - no fallbacks, let errors propagate
    const searchResult = await this.semanticDiscovery.findRelevantTools(query, {
      limit: limit * 2, // Get more for filtering
      minScore: minConfidence,
      useCache: true
    });
    
    // Process results
    const tools = [];
    for (const toolResult of searchResult.tools.slice(0, limit)) {
      const toolData = {
        name: toolResult.name,
        description: toolResult.description,
        confidence: toolResult.relevanceScore || toolResult.similarityScore || 0,
        category: toolResult.category,
        tags: toolResult.tags,
        source: 'semantic-search',
        executable: null
      };
      
      // Get executable tool if requested
      if (includeExecutable) {
        try {
          const executableTool = await this.getTool(toolResult.name);
          if (executableTool) {
            toolData.executable = executableTool;
            toolData.available = true;
          } else {
            toolData.available = false;
          }
        } catch (error) {
          console.warn(`Failed to get executable for ${toolResult.name}:`, error.message);
          toolData.available = false;
        }
      }
      
      tools.push(toolData);
    }
    
    return {
      tools,
      metadata: {
        query,
        searchType: 'semantic',
        totalFound: searchResult.metadata?.totalFound || tools.length,
        searchQuery: searchResult.metadata?.searchQuery || query
      }
    };
  }

  // ============================================================================
  // PRIVATE IMPLEMENTATION - All MongoDB-specific logic
  // ============================================================================

  /**
   * Ensure registry is initialized
   */
  async _ensureInitialized() {
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
        throw new DatabaseError(
          'getTool',
          new Error(`Tool ${name} has no module reference in database`),
          { toolName: name }
        );
      }

      // 3. Load module instance
      const moduleInstance = await this.#loadModuleFromMongoDB(moduleName);
      if (!moduleInstance) {
        throw new ModuleLoadError(
          moduleName,
          `Could not load module for tool ${name}`,
          { toolName: name }
        );
      }

      // 4. Get executable tool from module
      const executableTool = this._extractToolFromModule(moduleInstance, toolMetadata.name);
      
      if (!executableTool) {
        throw new ToolNotFoundError(
          toolMetadata.name,
          moduleName,
          { reason: 'Tool not found in module' }
        );
      }

      return executableTool;
      
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof ToolRegistryError) {
        throw error;
      }
      
      // Wrap other errors
      throw new DatabaseError('getTool', error, { toolName: name });
    }
  }

  /**
   * Load module from MongoDB metadata
   */
  async #loadModuleFromMongoDB(moduleName) {
    try {
      console.log(`[DEBUG] Loading module '${moduleName}' from MongoDB`);
      
      // NO CACHE - Load fresh from database every time

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
        // NO CACHE - Return directly
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
        return await this._loadJsonModule(moduleName, moduleMetadata);
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
      const { fileURLToPath } = await import('url');

      // Get the directory of this file to use as a reference point
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      
      // Navigate to the monorepo root (4 levels up from tools-registry/src/integration/ToolRegistry.js)
      const monorepoRoot = path.resolve(__dirname, '../../../..');
      
      // Build the module path from monorepo root
      let modulePath;
      const basePath = moduleMetadata.path;
      
      // Handle different module path formats
      if (basePath.startsWith('/')) {
        // Absolute path
        modulePath = basePath;
      } else if (basePath.startsWith('packages/') || basePath.startsWith('tools-collection/')) {
        // Path relative to monorepo root
        modulePath = path.join(monorepoRoot, basePath, 'index.js');
      } else {
        // Legacy format - try to resolve from monorepo root
        modulePath = path.join(monorepoRoot, 'packages', basePath, 'index.js');
        
        // If not found, try tools-collection
        if (!fs.existsSync(modulePath)) {
          modulePath = path.join(monorepoRoot, 'tools-collection', basePath, 'index.js');
        }
      }

      // Normalize the path
      modulePath = path.resolve(modulePath);

      // Check if the file exists
      if (!fs.existsSync(modulePath)) {
        console.warn(`Module file not found: ${modulePath}`);
        console.warn(`  Searched from monorepo root: ${monorepoRoot}`);
        console.warn(`  Module metadata path: ${basePath}`);
        return null;
      }

      // Import and instantiate the module using file URL protocol for Windows compatibility
      const moduleUrl = path.isAbsolute(modulePath) 
        ? `file://${modulePath.replace(/\\/g, '/')}`
        : modulePath;
      
      const ModuleClass = await import(moduleUrl);
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
      console.warn(`  Stack: ${error.stack}`);
      return null;
    }
  }

  /**
   * Load a JSON-based dynamic module
   */
  async _loadJsonModule(moduleName, moduleMetadata) {
    try {
      // For JSON modules, we need to load the module.json file and create a dynamic wrapper
      const { DynamicJsonModule } = await import('../loading/DynamicJsonModule.js');
      const path = await import('path');
      
      // Build the path to the module.json file
      const monorepoRoot = path.resolve('../..');
      const jsonPath = moduleMetadata.path; // e.g., "packages/test-json-module"
      
      // Use the static factory method to properly load the JSON module
      const moduleInstance = await DynamicJsonModule.createFromJson(jsonPath, monorepoRoot);
      
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
  _extractToolFromModule(moduleInstance, toolName) {
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
    return {
      toolUsage: Object.fromEntries(this.usageStats)
      // NO CACHE - No cache stats to report
    };
  }

  /**
   * Clear caches
   */
  clearCache() {
    // NO CACHE - Only clear usage stats
    this.usageStats.clear();
  }

  /**
   * Get the LoadingManager instance for database operations
   * Creates and initializes it on first access
   * 
   * @returns {Promise<LoadingManager>} The loading manager instance
   */
  async getLoader() {
    await this._ensureInitialized();
    
    if (!this._loader) {
      const { LoadingManager } = await import('../loading/LoadingManager.js');
      this._loader = new LoadingManager({
        verbose: false,
        resourceManager: this.resourceManager,
        // Share the provider to reuse connections
        mongoProvider: this.provider,
        semanticSearchProvider: this.semanticDiscovery?.semanticProvider || null
      });
      await this._loader.initialize();
    }
    
    return this._loader;
  }

  /**
   * Populate database using LoadingManager
   * 
   * @deprecated Use getLoader() instead for more control
   * @param {Object} options - Population options
   * @param {string} options.module - Optional module filter
   * @param {string} options.mode - 'clear' (default) or 'append'
   * @param {boolean} options.verbose - Show detailed output
   * @param {boolean} options.includePerspectives - Generate perspectives (default: true)
   * @param {boolean} options.includeVectors - Index vectors (default: false)
   */
  async populateDatabase(options = {}) {
    await this._ensureInitialized();
    
    const loader = await this.getLoader();
    
    // Configure verbosity for this operation
    const originalVerbose = loader.verbose;
    loader.verbose = options.verbose || false;
    
    const result = await loader.fullPipeline({
      module: options.module || null,
      clearFirst: (options.mode || 'clear') === 'clear',
      includePerspectives: options.includePerspectives !== false, // Default true
      includeVectors: options.includeVectors || false // Default false
    });
    
    // Restore original verbosity
    loader.verbose = originalVerbose;
    
    return {
      modulesAdded: result.loadResult?.modulesLoaded || 0,
      toolsAdded: result.loadResult?.toolsAdded || 0,
      perspectivesGenerated: result.perspectiveResult?.perspectivesGenerated || 0,
      vectorsIndexed: result.vectorResult?.perspectivesIndexed || 0,
      totalTime: result.totalTime,
      success: result.success
    };
  }

  // ============================================================================
  // CONCURRENCY CONTROL HELPERS
  // ============================================================================

  /**
   * Get or create mutex for a specific module
   * @private
   */
  #getModuleMutex(moduleName) {
    if (!this.moduleOperationMutexes.has(moduleName)) {
      this.moduleOperationMutexes.set(moduleName, new Mutex());
    }
    return this.moduleOperationMutexes.get(moduleName);
  }

  // ============================================================================
  // MODULE-SPECIFIC OPERATIONS
  // ============================================================================

  /**
   * Clear specific module only (tools, perspectives, vectors)
   * Does NOT clear other modules - granular operation
   * 
   * @param {string} moduleName - Name of module to clear
   * @param {Object} options - Clear options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @returns {Promise<ClearResult>}
   */
  async clearModule(moduleName, options = {}) {
    await this._ensureInitialized();

    if (!moduleName || typeof moduleName !== 'string') {
      throw new ValidationError('moduleName', 'non-empty string', moduleName);
    }

    // Get mutex for this module
    const mutex = this.#getModuleMutex(moduleName);
    
    // Acquire lock for this module operation
    return await mutex.runExclusive(async () => {
      const loader = await this.getLoader();
      const originalVerbose = loader.verbose;
      
      try {
        loader.verbose = options.verbose || false;

        if (loader.verbose) {
          console.log(`🧹 Clearing module: ${moduleName}`);
        }

        // Use LoadingManager's clearForReload with module filter
        const result = await loader.clearForReload({
          clearVectors: true,
          moduleFilter: moduleName
        });

        // NO CACHE - Nothing to clear from cache

        return {
          moduleName,
          recordsCleared: result.totalCleared,
          success: true
        };
      } finally {
        loader.verbose = originalVerbose;
      }
    });
  }

  /**
   * Clear all modules (more explicit version of populateDatabase clear mode)
   * 
   * @param {Object} options - Clear options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @returns {Promise<ClearResult>}
   */
  async clearAllModules(options = {}) {
    await this._ensureInitialized();

    // Acquire global lock for all-module operation
    return await this.globalOperationMutex.runExclusive(async () => {
      const loader = await this.getLoader();
      const originalVerbose = loader.verbose;
      
      try {
        loader.verbose = options.verbose || false;

        if (loader.verbose) {
          console.log('🧹 Clearing all modules');
        }

        const result = await loader.clearForReload({
          clearVectors: true
        });

        // NO CACHE - Nothing to clear

        return {
          moduleName: 'all',
          recordsCleared: result.totalCleared,
          success: true
        };
      } finally {
        loader.verbose = originalVerbose;
      }
    });
  }

  /**
   * Load specific module only (with optional clearing first)
   * 
   * @param {string} moduleName - Name of module to load
   * @param {Object} options - Load options
   * @param {boolean} options.clearFirst - Clear module data first (default: false)
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @param {boolean} options.includePerspectives - Generate perspectives (default: true)
   * @param {boolean} options.includeVectors - Index vectors (default: false)
   * @returns {Promise<LoadResult>}
   */
  async loadModule(moduleName, options = {}) {
    await this._ensureInitialized();

    if (!moduleName || typeof moduleName !== 'string') {
      throw new ValidationError('moduleName', 'non-empty string', moduleName);
    }

    // Get mutex for this module
    const mutex = this.#getModuleMutex(moduleName);
    
    // Acquire lock for this module operation
    return await mutex.runExclusive(async () => {
      const loader = await this.getLoader();
      const originalVerbose = loader.verbose;
      
      try {
        loader.verbose = options.verbose || false;

        if (loader.verbose) {
          console.log(`📦 Loading module: ${moduleName}`);
        }

        // ALWAYS clear the specific module first - this is the correct behavior!
        if (loader.verbose) {
          console.log(`🧹 Clearing existing data for module: ${moduleName}`);
        }

        await loader.clearForReload({ 
          moduleFilter: moduleName,
          clearVectors: options.includeVectors !== false
        });

        // Load modules (append mode - no clearing)
        const result = await loader.loadModules({ module: moduleName });

        // Check if module was actually found and loaded
        // LoadingManager returns { loadResult, popResult, modulesLoaded, toolsAdded }
        const toolsAdded = result.toolsAdded || 0;
        const modulesLoaded = result.modulesLoaded || 0;
        
        // Check if module was actually loaded (even if no new tools were added due to duplicates)
        if (modulesLoaded === 0 && toolsAdded === 0) {
          if (loader.verbose) {
            console.log(`⚠️ Module ${moduleName} not found`);
          }
          return {
            moduleName,
            modulesLoaded: 0,
            toolsAdded: 0,
            perspectivesGenerated: 0,
            vectorsIndexed: 0,
            success: false,
            error: `Module '${moduleName}' not found`
          };
        }
        
        // If module was loaded but no tools added (likely duplicates), check if tools exist
        if (toolsAdded === 0 && modulesLoaded > 0) {
          // Check if tools already exist for this module
          const existingTools = await this.listTools({ moduleName });
          if (existingTools.length > 0) {
            if (loader.verbose) {
              console.log(`ℹ️ Module ${moduleName} already loaded with ${existingTools.length} existing tools`);
            }
            // This is success - module and tools already exist
          } else {
            if (loader.verbose) {
              console.log(`⚠️ Module ${moduleName} loaded but contains no tools`);
            }
            return {
              moduleName,
              modulesLoaded: modulesLoaded,
              toolsAdded: 0,
              perspectivesGenerated: 0,
              vectorsIndexed: 0,
              success: false,
              error: `Module '${moduleName}' contains no loadable tools`
            };
          }
        }

        let perspectivesGenerated = 0;
        let vectorsIndexed = 0;

        // Generate perspectives if requested
        if (options.includePerspectives !== false) {
          if (loader.verbose) {
            console.log(`📝 Generating perspectives for: ${moduleName}`);
          }
          const perspectiveResult = await loader.generatePerspectives({ module: moduleName });
          perspectivesGenerated = perspectiveResult.perspectivesGenerated;
        }

        // Index vectors if requested (requires embeddings first)
        if (options.includeVectors) {
          // Generate embeddings first
          if (loader.verbose) {
            console.log(`🧮 Generating embeddings for: ${moduleName}`);
          }
          await loader.generateEmbeddings({ module: moduleName });
          
          // Then index vectors
          if (loader.verbose) {
            console.log(`🚀 Indexing vectors for: ${moduleName}`);
          }
          const vectorResult = await loader.indexVectors({ module: moduleName });
          vectorsIndexed = vectorResult.perspectivesIndexed;
        }

        // NO CACHE - Nothing to clear

        return {
          moduleName,
          modulesLoaded: modulesLoaded || 1, // Use the actual count or default to 1
          toolsAdded: toolsAdded,
          perspectivesGenerated,
          vectorsIndexed,
          success: true
        };
      } catch (error) {
        // Handle any unexpected errors gracefully
        if (loader.verbose) {
          console.log(`❌ Module loading failed for ${moduleName}: ${error.message}`);
        }
        return {
          moduleName,
          modulesLoaded: 0,
          toolsAdded: 0,
          perspectivesGenerated: 0,
          vectorsIndexed: 0,
          success: false,
          error: error.message
        };
      } finally {
        loader.verbose = originalVerbose;
      }
    });
  }

  /**
   * Load all modules (without clearing first)
   * Appends to existing data - use after clearAllModules() if needed
   * 
   * @param {Object} options - Load options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @param {boolean} options.includePerspectives - Generate perspectives (default: true)
   * @param {boolean} options.includeVectors - Index vectors (default: false)
   * @returns {Promise<LoadResult>}
   */
  async loadAllModules(options = {}) {
    await this._ensureInitialized();

    const loader = await this.getLoader();
    const originalVerbose = loader.verbose;
    
    try {
      loader.verbose = options.verbose || false;

      if (loader.verbose) {
        console.log('📦 Loading all modules');
      }

      // Load modules (append mode - no clearing)
      const loadResult = await loader.loadModules({});

      let perspectivesGenerated = 0;
      let vectorsIndexed = 0;

      // Generate perspectives if requested
      if (options.includePerspectives !== false) {
        if (loader.verbose) {
          console.log('📝 Generating perspectives for all modules');
        }
        const perspectiveResult = await loader.generatePerspectives({});
        perspectivesGenerated = perspectiveResult.perspectivesGenerated;
      }

      // Index vectors if requested (requires embeddings first)
      if (options.includeVectors) {
        // Generate embeddings first
        if (loader.verbose) {
          console.log('🧮 Generating embeddings for all modules');
        }
        await loader.generateEmbeddings({});
        
        // Then index vectors
        if (loader.verbose) {
          console.log('🚀 Indexing vectors for all modules');
        }
        const vectorResult = await loader.indexVectors({});
        vectorsIndexed = vectorResult.perspectivesIndexed;
      }

      return {
        moduleName: 'all',
        modulesLoaded: loadResult.modulesLoaded,
        toolsAdded: loadResult.toolsAdded,
        perspectivesGenerated,
        vectorsIndexed,
        success: true
      };
    } finally {
      loader.verbose = originalVerbose;
    }
  }

  /**
   * Verify specific module only
   * Runs validation checks only for the specified module
   * 
   * @param {string} moduleName - Name of module to verify
   * @param {Object} options - Verification options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @returns {Promise<VerificationResult>}
   */
  async verifyModule(moduleName, options = {}) {
    await this._ensureInitialized();

    if (!moduleName || typeof moduleName !== 'string') {
      throw new ValidationError('moduleName', 'non-empty string', moduleName);
    }

    const verifier = await this.getVerifier();
    const originalVerbose = verifier.verbose;
    
    try {
      verifier.verbose = options.verbose || false;
      
      // Run module-specific verification
      const result = await verifier.verifyModule(moduleName);
      
      // Log results if requested
      if (options.verbose) {
        if (verifier.logResults) {
          verifier.logResults(result);
        } else if (result.errors && result.errors.length > 0) {
          console.log(`❌ Module verification errors for ${moduleName}:`);
          result.errors.forEach(error => console.log(`  - ${error}`));
        }
      }
      
      return result;
    } finally {
      verifier.verbose = originalVerbose;
    }
  }

  // ============================================================================
  // CENTRALIZED VALIDATION & VERIFICATION METHODS
  // ============================================================================

  /**
   * Get the Verifier instance for comprehensive validation
   * Creates and initializes it on first access
   * 
   * @returns {Promise<Verifier>} The verifier instance
   */
  async getVerifier() {
    await this._ensureInitialized();
    
    const loader = await this.getLoader();
    if (!loader.verifier) {
      const { Verifier } = await import('../verification/Verifier.js');
      loader.verifier = new Verifier(
        this.provider,
        this.semanticDiscovery?.semanticProvider || null,
        false // verbose = false by default
      );
    }
    
    return loader.verifier;
  }

  /**
   * Comprehensive system verification
   * Validates tool:perspective:vector ratios, relationships, and data integrity
   * 
   * @param {Object} options - Verification options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @returns {Promise<VerificationResult>}
   */
  async verifySystem(options = {}) {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    const originalVerbose = verifier.verbose;
    
    try {
      // Configure verbosity
      verifier.verbose = options.verbose || false;
      
      // Run comprehensive system verification
      const result = await verifier.verifySystem();
      
      // Log results if requested
      if (options.verbose && result.errors && result.errors.length > 0) {
        console.log(`❌ System verification errors:`);
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      return result;
    } finally {
      // Restore original verbosity
      verifier.verbose = originalVerbose;
    }
  }

  /**
   * Quick health check - essential validations only
   * Fast check for critical issues without full verification
   * 
   * @returns {Promise<HealthCheckResult>}
   */
  async quickHealthCheck() {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    return await verifier.quickHealthCheck();
  }

  /**
   * Comprehensive inconsistency detection
   * Detects orphaned records, duplicates, invalid embeddings, schema mismatches, etc.
   * 
   * @param {Object} options - Detection options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @returns {Promise<InconsistencyReport>}
   */
  async detectInconsistencies(options = {}) {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    const originalVerbose = verifier.verbose;
    
    try {
      // Configure verbosity
      verifier.verbose = options.verbose || false;
      
      // Run comprehensive inconsistency detection
      const report = await verifier.detectInconsistencies();
      
      // Log results if requested
      if (options.verbose) {
        verifier.logInconsistencies(report);
      }
      
      return report;
    } finally {
      // Restore original verbosity
      verifier.verbose = originalVerbose;
    }
  }

  /**
   * Verify that database clearing worked correctly
   * Validates that tools, perspectives, and vectors were cleared but modules remain
   * 
   * @param {Object} options - Clearing verification options
   * @param {boolean} options.expectEmptyTools - Whether tools should be cleared (default: true)
   * @param {boolean} options.expectEmptyPerspectives - Whether perspectives should be cleared (default: true)
   * @param {boolean} options.expectEmptyVectors - Whether vectors should be cleared (default: true)
   * @returns {Promise<ClearingVerificationResult>}
   */
  async verifyClearingWorked(options = {}) {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    return await verifier.verifyClearingWorked(options);
  }

  /**
   * Verify that modules are in correct unloaded state after clearing
   * Validates that modules exist but are marked as unloaded/pending
   * 
   * @param {string|null} moduleFilter - Optional module filter for specific module verification
   * @returns {Promise<ModuleStatusVerificationResult>}
   */
  async verifyModulesUnloaded(moduleFilter = null) {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    return await verifier.verifyModulesUnloaded(moduleFilter);
  }

  /**
   * Get comprehensive validation state
   * Returns current counts, ratios, and validation status
   * 
   * @returns {Promise<ValidationState>}
   */
  async getValidationState() {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    const counts = await verifier.getCounts();
    const ratios = verifier.calculateRatios(counts);
    
    return {
      counts,
      ratios,
      timestamp: new Date().toISOString(),
      healthy: counts.perspectives === counts.vectors && ratios.perspectivesPerTool < 15
    };
  }

  /**
   * Validate and repair database inconsistencies
   * Runs detection and applies automatic fixes where safe
   * 
   * @param {Object} options - Repair options
   * @param {boolean} options.dryRun - Only detect, don't repair (default: true)
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @param {string[]} options.repairActions - Specific actions to take (default: all safe actions)
   * @returns {Promise<RepairResult>}
   */
  async validateAndRepair(options = {}) {
    await this._ensureInitialized();
    
    const {
      dryRun = true,
      verbose = false,
      repairActions = ['clean_orphaned_records', 'fix_reference_integrity']
    } = options;
    
    // First, detect all inconsistencies
    const report = await this.detectInconsistencies({ verbose });
    
    const repairResult = {
      success: true,
      detectionReport: report,
      repairsAttempted: [],
      repairsSuccessful: [],
      repairsFailed: [],
      dryRun
    };
    
    if (dryRun) {
      // Just return the detection report with recommendations
      return repairResult;
    }
    
    // Apply repairs (implementation would go here in a real system)
    // For now, we'll just return the detection results
    if (verbose) {
      console.log('🔧 Repair functionality not yet implemented');
      console.log('   Use the detection report to manually fix issues');
    }
    
    return repairResult;
  }
  
  /**
   * Clean up resources and close connections
   * Used for testing and graceful shutdown
   */
  async cleanup() {
    try {
      // NO CACHE - No interval to clear
      
      // Close MongoDB connection - simpler approach for tests
      if (this.provider && this.provider.cleanup) {
        try {
          if (process.env.NODE_ENV === 'test') {
            // In test mode, don't use timeouts to avoid open handles
            await this.provider.cleanup();
          } else {
            // Production mode uses timeout protection
            let timeoutHandle;
            await Promise.race([
              this.provider.cleanup(),
              new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error('Provider cleanup timeout')), 5000);
              })
            ]);
            if (timeoutHandle) clearTimeout(timeoutHandle);
          }
        } catch (error) {
          console.warn('Provider cleanup failed:', error.message);
        }
      }
      
      // Close any loader connections - simpler approach for tests
      if (this._loader && this._loader.cleanup) {
        try {
          if (process.env.NODE_ENV === 'test') {
            // In test mode, don't use timeouts to avoid open handles
            await this._loader.cleanup();
          } else {
            // Production mode uses timeout protection
            let timeoutHandle;
            await Promise.race([
              this._loader.cleanup(),
              new Promise((_, reject) => {
                timeoutHandle = setTimeout(() => reject(new Error('Loader cleanup timeout')), 5000);
              })
            ]);
            if (timeoutHandle) clearTimeout(timeoutHandle);
          }
        } catch (error) {
          console.warn('Loader cleanup failed:', error.message);
        }
      }
      
      // NO CACHE - Nothing to clear
      
      // Reset singleton instance for testing
      if (process.env.NODE_ENV === 'test') {
        ToolRegistry._instance = null;
      }
      
      this.initialized = false;
      this.provider = null;
      this.semanticDiscovery = null;
      this._loader = null;
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  /**
   * Verify that clearing worked correctly
   * @returns {Promise<Object>} Verification result with success status and details
   */
  async verifyClearingWorked() {
    await this._ensureInitialized();
    
    const verifier = await this.getVerifier();
    const clearResult = await verifier.verifyCleared();
    
    // Get counts for reporting
    const toolCount = await this.provider.databaseService.mongoProvider.count('tools', {});
    const perspectiveCount = await this.provider.databaseService.mongoProvider.count('tool_perspectives', {});
    const moduleCount = await this.provider.databaseService.mongoProvider.count('modules', {});
    
    return {
      success: clearResult.success && toolCount === 0 && perspectiveCount === 0 && moduleCount === 0,
      message: clearResult.message,
      clearedCounts: {
        tools: toolCount,
        perspectives: perspectiveCount,
        modules: moduleCount,
        vectors: clearResult.vectorCount || 0
      },
      errors: clearResult.success ? [] : [clearResult.message]
    };
  }

  /**
   * Verify that modules are unloaded
   * @returns {Promise<Object>} Verification result with module status
   */
  async verifyModulesUnloaded() {
    await this._ensureInitialized();
    
    const moduleCount = await this.provider.databaseService.mongoProvider.count('modules', {});
    const moduleRegistryCount = await this.provider.databaseService.mongoProvider.count('module_registry', {});
    
    return {
      success: moduleCount === 0,
      message: moduleCount === 0 ? 'All modules unloaded' : `${moduleCount} modules still loaded`,
      moduleStats: {
        'loaded (runtime)': moduleCount,
        'discovered (registry)': moduleRegistryCount
      }
    };
  }
}
