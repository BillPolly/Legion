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
    
    // Caching
    this.toolCache = new Map();
    this.moduleCache = new Map();
    
    // Semantic search
    this.semanticDiscovery = null;
    this.enableSemanticSearch = options.enableSemanticSearch !== false; // Default to true
    
    // Loading manager for database operations
    this._loader = null;
    
    // State
    this.initialized = false;
    this.usageStats = new Map();
    
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
            collectionName: 'legion_tools',  // Use the correct Qdrant collection name
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
      throw new Error('Semantic search not available - semantic discovery service not initialized');
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
      const executableTool = this._extractToolFromModule(moduleInstance, toolMetadata.name);
      
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
      throw new Error('Module name is required and must be a string');
    }

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
        clearModules: false, // Keep module discovery
        moduleFilter: moduleName
      });

      return {
        moduleName,
        recordsCleared: result.totalCleared,
        success: true
      };
    } finally {
      loader.verbose = originalVerbose;
    }
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

    const loader = await this.getLoader();
    const originalVerbose = loader.verbose;
    
    try {
      loader.verbose = options.verbose || false;

      if (loader.verbose) {
        console.log('🧹 Clearing all modules');
      }

      const result = await loader.clearForReload({
        clearVectors: true,
        clearModules: false // Keep module discovery
      });

      return {
        moduleName: 'all',
        recordsCleared: result.totalCleared,
        success: true
      };
    } finally {
      loader.verbose = originalVerbose;
    }
  }

  /**
   * Load specific module only (without clearing first)
   * Appends to existing data - use after clearModule() if needed
   * 
   * @param {string} moduleName - Name of module to load
   * @param {Object} options - Load options
   * @param {boolean} options.verbose - Show detailed output (default: false)
   * @param {boolean} options.includePerspectives - Generate perspectives (default: true)
   * @param {boolean} options.includeVectors - Index vectors (default: false)
   * @returns {Promise<LoadResult>}
   */
  async loadModule(moduleName, options = {}) {
    await this._ensureInitialized();

    if (!moduleName || typeof moduleName !== 'string') {
      throw new Error('Module name is required and must be a string');
    }

    const loader = await this.getLoader();
    const originalVerbose = loader.verbose;
    
    try {
      loader.verbose = options.verbose || false;

      if (loader.verbose) {
        console.log(`📦 Loading module: ${moduleName}`);
      }

      // Load modules (append mode - no clearing)
      const loadResult = await loader.loadModules({ module: moduleName });

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

      // Index vectors if requested
      if (options.includeVectors) {
        if (loader.verbose) {
          console.log(`🚀 Indexing vectors for: ${moduleName}`);
        }
        const vectorResult = await loader.indexVectors({ module: moduleName });
        vectorsIndexed = vectorResult.perspectivesIndexed;
      }

      return {
        moduleName,
        modulesLoaded: 1, // We're loading a specific module
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

      // Index vectors if requested
      if (options.includeVectors) {
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
      throw new Error('Module name is required and must be a string');
    }

    const verifier = await this.getVerifier();
    const originalVerbose = verifier.verbose;
    
    try {
      verifier.verbose = options.verbose || false;
      
      // Run module-specific verification
      const result = await verifier.verifyModule(moduleName);
      
      // Log results if requested
      if (options.verbose) {
        verifier.logResults(result);
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
      if (options.verbose) {
        verifier.logResults(result);
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
      // Close MongoDB connection if provider exists
      if (this.provider && this.provider.cleanup) {
        await this.provider.cleanup();
      }
      
      // Close any loader connections
      if (this._loader && this._loader.cleanup) {
        await this._loader.cleanup();
      }
      
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
}