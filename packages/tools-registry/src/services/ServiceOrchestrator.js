/**
 * ServiceOrchestrator - Clean Architecture Service Orchestration
 * 
 * Maintains the existing ToolRegistry singleton public API while
 * internally delegating to focused, single-responsibility services.
 * 
 * This class acts as the Application Service Coordinator in Clean Architecture,
 * orchestrating multiple domain services to fulfill complex use cases.
 */

import { ModuleService } from './ModuleService.js';
import { ToolService } from './ToolService.js';
import { SearchService } from './SearchService.js';
import { CacheService } from './CacheService.js';
import { SystemService } from './SystemService.js';

export class ServiceOrchestrator {
  constructor(resourceManager, options = {}) {
    this.resourceManager = resourceManager;
    this.options = {
      cacheSize: options.cacheSize || 1000,
      cacheTTL: options.cacheTTL || 3600000,
      enablePerspectives: options.enablePerspectives === true,
      enableVectorSearch: options.enableVectorSearch === true,
      searchPaths: options.searchPaths || [],
      ...options
    };

    // Services will be initialized in initialize()
    this.moduleService = null;
    this.toolService = null;
    this.searchService = null;
    this.cacheService = null;
    this.systemService = null;
    
    this.isInitialized = false;
  }

  /**
   * Initialize all services with dependency injection
   * Clean Architecture: Dependency inversion at the composition root
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize infrastructure dependencies first
    const dependencies = await this._initializeDependencies();
    
    // Initialize application services with minimal dependencies
    this.cacheService = new CacheService({
      cache: dependencies.cache,
      eventBus: dependencies.eventBus,
      metrics: dependencies.metrics
    });

    this.moduleService = new ModuleService({
      moduleDiscovery: dependencies.moduleDiscovery,
      moduleLoader: dependencies.moduleLoader,
      moduleCache: this.cacheService,
      eventBus: dependencies.eventBus
    });

    this.toolService = new ToolService({
      toolCache: this.cacheService,
      moduleService: this.moduleService,
      eventBus: dependencies.eventBus
    });

    // Search service is optional - only initialize if needed
    this.searchService = this.options.enableVectorSearch ? new SearchService({
      textSearch: dependencies.textSearch,
      eventBus: dependencies.eventBus
    }) : null;

    this.systemService = new SystemService({
      moduleService: this.moduleService,
      toolService: this.toolService,
      searchService: this.searchService,
      cacheService: this.cacheService,
      databaseService: dependencies.databaseService,
      eventBus: dependencies.eventBus,
      resourceManager: this.resourceManager
    });

    // Initialize the system
    await this.systemService.initialize();
    this.isInitialized = true;
  }

  // === PUBLIC API METHODS (Preserved for backward compatibility) ===

  /**
   * Discover modules from filesystem paths
   * Delegates to ModuleService
   */
  async discoverModules(paths) {
    return await this.moduleService.discoverModules(paths);
  }

  /**
   * Load a single module
   * Delegates to ModuleService  
   */
  async loadModule(moduleName, moduleConfig) {
    return await this.moduleService.loadModule(moduleName, moduleConfig);
  }

  /**
   * Load all discovered modules
   * Delegates to ModuleService
   */
  async loadAllModules(options = {}) {
    return await this.moduleService.loadAllModules(options);
  }

  /**
   * Load multiple modules
   * Delegates to ModuleService
   */
  async loadMultipleModules(moduleNames, options = {}) {
    return await this.moduleService.loadMultipleModules(moduleNames, options);
  }

  /**
   * Get tool by database ID
   * Delegates to ToolService
   */
  async getToolById(toolId) {
    return await this.toolService.getToolById(toolId);
  }

  /**
   * Get tool by name
   * Delegates to ToolService
   */
  async getTool(toolName) {
    return await this.toolService.getTool(toolName);
  }

  /**
   * List all available tools
   * Delegates to ToolService
   */
  async listTools(options = {}) {
    return await this.toolService.listTools(options);
  }

  /**
   * Search tools using text and/or semantic search
   * Orchestrates SearchService methods
   */
  async searchTools(query, options = {}) {
    // If no search service available, fall back to listing tools and filtering
    if (!this.searchService) {
      const allTools = await this.listTools(options);
      const searchTerm = query.toLowerCase();
      
      return allTools.filter(tool => 
        tool.name.toLowerCase().includes(searchTerm) ||
        (tool.description && tool.description.toLowerCase().includes(searchTerm)) ||
        (tool.category && tool.category.toLowerCase().includes(searchTerm))
      );
    }

    const { useSemanticSearch = this.options.enableVectorSearch, textOnly = false } = options;

    if (textOnly || !useSemanticSearch) {
      return await this.searchService.searchTools(query, options);
    }

    // Hybrid search: both text and semantic
    const [textResults, semanticResults] = await Promise.all([
      this.searchService.searchTools(query, { ...options, limit: options.limit || 20 }),
      this.searchService.semanticSearch(query, { ...options, limit: options.limit || 20 })
    ]);

    // Merge and deduplicate results
    return this._mergeSearchResults(textResults, semanticResults, options);
  }

  /**
   * Get tool with its perspectives
   * Delegates to ToolService
   */
  async getToolWithPerspectives(toolName) {
    return await this.toolService.getToolWithPerspectives(toolName);
  }

  /**
   * Get related/similar tools
   * Delegates to SearchService
   */
  async getRelatedTools(toolName, options = {}) {
    return await this.searchService.findSimilarTools(toolName, options);
  }

  /**
   * Search similar tools (alias for getRelatedTools)
   * Delegates to SearchService  
   */
  async searchSimilarTools(query, options = {}) {
    return await this.searchService.semanticSearch(query, options);
  }

  /**
   * Clear a specific module
   * Orchestrates ModuleService and ToolService
   */
  async clearModule(moduleName) {
    const moduleResult = await this.moduleService.clearModule(moduleName);
    const toolsResult = await this.toolService.clearModuleTools(moduleName);
    
    return {
      success: moduleResult.success && toolsResult.success,
      moduleName,
      toolsCleared: toolsResult.clearedCount
    };
  }

  /**
   * Clear all data
   * Orchestrates SystemService
   */
  async clearAll() {
    return await this.cacheService.clear();
  }

  /**
   * Clear all system data
   * Orchestrates SystemService
   */
  async clearAllData(options = {}) {
    return await this.systemService.shutdown(options);
  }

  /**
   * Get system statistics
   * Delegates to SystemService
   */
  async getStatistics() {
    return await this.systemService.getSystemStatistics();
  }

  /**
   * Health check
   * Delegates to SystemService
   */
  async healthCheck() {
    return await this.systemService.checkHealth();
  }

  /**
   * Get system status with options
   * Delegates to SystemService  
   */
  async getSystemStatus(options = {}) {
    const health = await this.healthCheck();
    const stats = await this.getStatistics();
    const config = await this.systemService.getSystemConfiguration();
    
    return {
      healthy: health.healthy,
      ...health,
      statistics: stats,
      configuration: config,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate perspectives for tools
   * Delegates to SearchService
   */
  async generatePerspectives(options = {}) {
    return await this.searchService.generatePerspectives(options);
  }

  /**
   * Generate embeddings for perspectives
   * Delegates to SearchService
   */
  async generateEmbeddings(options = {}) {
    return await this.searchService.generateEmbeddings(options);
  }

  /**
   * Index vectors in vector store
   * Delegates to SearchService
   */
  async indexVectors(options = {}) {
    return await this.searchService.indexVectors(options);
  }

  /**
   * Test semantic search functionality
   * Delegates to SearchService
   */
  async testSemanticSearch(queries = null, options = {}) {
    return await this.searchService.testSemanticSearch(queries, options);
  }

  /**
   * Run complete initialization pipeline
   * Delegates to SystemService
   */
  async runCompletePipeline(options = {}) {
    return await this.systemService.executePipeline(options);
  }

  /**
   * Test entire system functionality
   * Delegates to SystemService
   */
  async verifySystemIntegrity() {
    return await this.systemService.testSystem();
  }

  /**
   * Cleanup resources
   * Delegates to SystemService
   */
  async cleanup() {
    return await this.systemService.shutdown();
  }

  // === LEGACY API ALIASES (for backward compatibility) ===

  async loadModules(options = {}) {
    return await this.loadAllModules(options);
  }

  async loadSingleModule(moduleName, options = {}) {
    return await this.loadModule(moduleName, options);
  }

  async verifyModules(options = {}) {
    const stats = await this.getStatistics();
    return { success: stats.modules.loaded > 0, ...stats.modules };
  }

  async verifyPerspectives(options = {}) {
    const stats = await this.getStatistics();
    return { success: stats.search.perspectivesGenerated > 0, ...stats.search };
  }

  async verifyPipeline(options = {}) {
    return await this.verifySystemIntegrity();
  }

  // === PRIVATE HELPER METHODS ===

  /**
   * Initialize all infrastructure dependencies
   * Clean Architecture: Composition root for dependency injection
   */
  async _initializeDependencies() {
    // Import infrastructure classes (keeping existing structure)
    const { ModuleLoader } = await import('../core/ModuleLoader.js');
    const { ModuleDiscovery } = await import('../core/ModuleDiscovery.js');
    const { DatabaseStorage } = await import('../core/DatabaseStorage.js');
    const { TextSearch } = await import('../search/TextSearch.js');
    const { Perspectives } = await import('../search/Perspectives.js');
    const { VectorStore } = await import('../search/VectorStore.js');
    const { EmbeddingService } = await import('../search/EmbeddingService.js');
    const { LRUCache } = await import('../utils/LRUCache.js');
    const { SimpleEmitter } = await import('../core/SimpleEmitter.js');

    // Create infrastructure instances
    const eventBus = new SimpleEmitter();
    const cache = new LRUCache(this.options.cacheSize);
    const databaseService = new DatabaseStorage({ resourceManager: this.resourceManager });
    const moduleLoader = new ModuleLoader({ resourceManager: this.resourceManager });
    const moduleDiscovery = new ModuleDiscovery({ resourceManager: this.resourceManager });
    const textSearch = new TextSearch({ databaseStorage: databaseService });
    const embeddingService = new EmbeddingService({ resourceManager: this.resourceManager });
    const vectorStore = this.options.enableVectorSearch 
      ? new VectorStore({ embeddingClient: embeddingService, vectorDatabase: await this._createVectorDatabase() }) 
      : null;
    const perspectiveService = new Perspectives({ resourceManager: this.resourceManager });

    return {
      eventBus,
      cache,
      databaseService,
      moduleLoader,
      moduleDiscovery,
      moduleRepository: databaseService, // DatabaseStorage acts as repository
      moduleValidator: null, // Not used in current implementation
      toolRepository: databaseService, // DatabaseStorage handles tools too
      toolBuilder: null, // Not used in current implementation
      toolValidator: null, // Not used in current implementation
      textSearch,
      semanticSearch: vectorStore,
      perspectiveService,
      embeddingService,
      vectorStore,
      metrics: null // Optional metrics service
    };
  }

  /**
   * Create vector database instance
   * Private helper for vector store initialization
   */
  async _createVectorDatabase() {
    const { QdrantVectorDatabase } = await import('../search/QdrantVectorDatabase.js');
    return new QdrantVectorDatabase({ 
      resourceManager: this.resourceManager,
      collectionName: 'tools'
    });
  }

  /**
   * Merge text and semantic search results
   * Private helper for hybrid search
   */
  _mergeSearchResults(textResults, semanticResults, options = {}) {
    const { limit = 10 } = options;
    const seen = new Set();
    const merged = [];

    // Add semantic results first (usually more relevant)
    for (const result of semanticResults) {
      if (!seen.has(result.name)) {
        seen.add(result.name);
        merged.push({
          ...result,
          searchType: 'semantic',
          combinedScore: (result.similarity || 0) * 1.2 // Boost semantic
        });
      }
    }

    // Add text results that weren't already included
    for (const result of textResults) {
      if (!seen.has(result.name)) {
        seen.add(result.name);
        merged.push({
          ...result,
          searchType: 'text',
          combinedScore: (result.score || 0) * 1.0
        });
      }
    }

    // Sort by combined score and limit
    return merged
      .sort((a, b) => (b.combinedScore || 0) - (a.combinedScore || 0))
      .slice(0, limit);
  }
}