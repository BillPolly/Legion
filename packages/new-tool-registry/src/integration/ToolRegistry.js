/**
 * ToolRegistry - Main integration point for the tool registry system
 * 
 * Provides a unified interface for tool discovery, loading, searching,
 * and management with caching, perspectives, and semantic search
 */

import { ModuleLoader } from '../core/ModuleLoader.js';
import { ModuleDiscovery } from '../core/ModuleDiscovery.js';
import { ModuleRegistry } from '../core/ModuleRegistry.js';
import { DatabaseStorage } from '../core/DatabaseStorage.js';
import { TextSearch } from '../search/TextSearch.js';
import { Perspectives } from '../search/Perspectives.js';
import { VectorStore } from '../search/VectorStore.js';
import { LLMClient } from '@legion/llm';
import { EmbeddingService } from '../search/EmbeddingService.js';
import { LRUCache } from '../utils/LRUCache.js';
import { ConnectionPool } from '../utils/ConnectionPool.js';

export class ToolRegistry {
  constructor({ resourceManager, options = {} }) {
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.resourceManager = resourceManager;
    this.options = {
      cacheSize: options.cacheSize || 1000,
      cacheTTL: options.cacheTTL || 3600000, // 1 hour
      enablePerspectives: options.enablePerspectives === true, // Default to false
      enableVectorSearch: options.enableVectorSearch === true, // Default to false
      searchPaths: options.searchPaths || [],
      ...options
    };

    // Core components
    this.moduleLoader = null;
    this.moduleDiscovery = null;
    this.moduleRegistry = null;
    this.databaseStorage = null;
    this.textSearch = null;
    this.perspectives = null;
    this.vectorStore = null;
    this.llmClient = null;
    this.embeddingService = null;

    // Caching
    this.cache = null;
    this.moduleCache = new Map();
    
    // Connection management
    this.connectionPool = null;
    
    // State
    this.initialized = false;
  }

  /**
   * Initialize all components
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize connection pool
      this.connectionPool = new ConnectionPool({
        resourceManager: this.resourceManager,
        maxConnections: this.options.maxConnections || 10
      });
      await this.connectionPool.initialize();

      // Initialize database storage
      this.databaseStorage = new DatabaseStorage({
        resourceManager: this.resourceManager,
        connectionPool: this.connectionPool
      });
      await this.databaseStorage.initialize();

      // Initialize core components
      this.moduleLoader = new ModuleLoader({
        resourceManager: this.resourceManager
      });

      this.moduleRegistry = new ModuleRegistry({
        databaseStorage: this.databaseStorage
      });
      await this.moduleRegistry.initialize();

      this.moduleDiscovery = new ModuleDiscovery({
        resourceManager: this.resourceManager,
        searchPaths: this.options.searchPaths
      });

      // Initialize search components
      this.textSearch = new TextSearch({
        databaseStorage: this.databaseStorage
      });
      await this.textSearch.initialize();

      // Initialize LLM and embedding clients if enabled
      if (this.options.enablePerspectives) {
        this.llmClient = new LLMClient({
          resourceManager: this.resourceManager
        });

        this.perspectives = new Perspectives({
          databaseStorage: this.databaseStorage,
          llmClient: this.llmClient
        });
      }

      if (this.options.enableVectorSearch) {
        this.embeddingService = new EmbeddingService({
          resourceManager: this.resourceManager
        });
        await this.embeddingService.initialize();

        this.vectorStore = new VectorStore({
          embeddingClient: this.embeddingService,
          vectorDatabase: await this._getVectorDatabase()
        });
        await this.vectorStore.initialize();
      }

      // Initialize cache
      this.cache = new LRUCache({
        maxSize: this.options.cacheSize,
        ttl: this.options.cacheTTL
      });

      this.initialized = true;
    } catch (error) {
      await this.cleanup();
      throw new Error(`Failed to initialize ToolRegistry: ${error.message}`);
    }
  }

  /**
   * Discover and register modules from filesystem
   */
  async discoverModules(paths) {
    if (!this.initialized) await this.initialize();

    const searchPaths = paths || this.options.searchPaths;
    if (!searchPaths.length) {
      throw new Error('No search paths provided');
    }

    const discovered = await this.moduleDiscovery.discoverModules(searchPaths);
    await this.moduleDiscovery.saveToRegistry(discovered);
    
    return {
      discovered: discovered.length,
      modules: discovered.map(m => ({
        name: m.name,
        path: m.path,
        type: m.type
      }))
    };
  }

  /**
   * Load a specific module
   */
  async loadModule(moduleName, moduleConfig) {
    if (!this.initialized) await this.initialize();

    // Check cache first
    if (this.moduleCache.has(moduleName)) {
      return { success: true, cached: true };
    }

    try {
      // Load module - extract path from moduleConfig
      const modulePath = moduleConfig.path || moduleConfig;
      const module = await this.moduleLoader.loadModule(modulePath);
      
      // Validate module
      this.moduleLoader.validateModuleStructure(module);

      // Cache module instance
      this.moduleCache.set(moduleName, module);

      // Register tools in database
      const tools = module.getTools();
      for (const tool of tools) {
        await this.databaseStorage.saveTool(tool, moduleName);
      }

      // Generate perspectives if enabled
      if (this.options.enablePerspectives && this.perspectives) {
        await this.perspectives.generateForModule(moduleName);
      }

      // Index for vector search if enabled
      if (this.options.enableVectorSearch && this.vectorStore) {
        await this.vectorStore.indexModule(moduleName);
      }

      return { success: true, toolCount: tools.length };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Load all registered modules
   */
  async loadAllModules() {
    if (!this.initialized) await this.initialize();

    const modules = await this.moduleRegistry.listModules();
    let loaded = 0;
    let failed = 0;
    const errors = [];

    for (const moduleConfig of modules) {
      const result = await this.loadModule(moduleConfig.name, moduleConfig);
      if (result.success) {
        loaded++;
      } else {
        failed++;
        errors.push({
          module: moduleConfig.name,
          error: result.error
        });
      }
    }

    return { loaded, failed, errors };
  }

  /**
   * Get a tool by name
   */
  async getTool(toolName) {
    if (!this.initialized) await this.initialize();

    // Check cache first
    const cached = this.cache.get(toolName);
    if (cached) {
      return cached;
    }

    // Get tool metadata from database
    const toolMeta = await this.databaseStorage.getTool(toolName);
    if (!toolMeta) {
      return null;
    }

    // Get module instance
    let module = this.moduleCache.get(toolMeta.moduleName);
    if (!module) {
      // Try to get module from registry (this returns an instance if cached)
      module = await this.moduleRegistry.getModule(toolMeta.moduleName);
      if (!module) {
        return null;
      }

      // Cache the module instance
      this.moduleCache.set(toolMeta.moduleName, module);
    }

    // Get tool from module
    const tools = module.getTools();
    const tool = tools.find(t => t.name === toolName);

    if (tool) {
      // Enhance with metadata
      const enhancedTool = {
        ...tool,
        ...toolMeta,
        execute: tool.execute.bind(module)
      };

      // Cache the tool
      this.cache.set(toolName, enhancedTool);
      
      return enhancedTool;
    }

    return null;
  }

  /**
   * List all available tools
   */
  async listTools(options = {}) {
    if (!this.initialized) await this.initialize();

    return this.databaseStorage.listTools(options);
  }

  /**
   * Search for tools by text
   */
  async searchTools(query, options = {}) {
    if (!this.initialized) await this.initialize();

    // Try vector search first if available
    if (this.options.enableVectorSearch && this.vectorStore) {
      try {
        const vectorResults = await this.vectorStore.search(query, options);
        if (vectorResults.length > 0) {
          return vectorResults;
        }
      } catch (error) {
        console.warn('Vector search failed, falling back to text search:', error.message);
      }
    }

    // Fall back to text search
    return this.textSearch.search(query, options);
  }

  /**
   * Get tool with perspectives
   */
  async getToolWithPerspectives(toolName) {
    if (!this.initialized) await this.initialize();

    const tool = await this.getTool(toolName);
    if (!tool) return null;

    if (this.perspectives) {
      const perspective = await this.perspectives.getPerspective(toolName);
      return {
        ...tool,
        perspective
      };
    }

    return tool;
  }

  /**
   * Get related tools
   */
  async getRelatedTools(toolName, options = {}) {
    if (!this.initialized) await this.initialize();

    if (this.vectorStore) {
      return this.vectorStore.findSimilarTools(toolName, options);
    }

    if (this.perspectives) {
      return this.perspectives.getRelatedTools(toolName);
    }

    // Fallback to text search
    const tool = await this.getTool(toolName);
    if (tool) {
      return this.searchTools(tool.description, { limit: 5 });
    }

    return [];
  }

  /**
   * Clear a specific module and its tools
   */
  async clearModule(moduleName) {
    if (!this.initialized) await this.initialize();

    // Remove from caches
    this.moduleCache.delete(moduleName);
    
    // Clear tools from cache
    const tools = await this.databaseStorage.listTools({ moduleName });
    for (const tool of tools) {
      this.cache.delete(tool.name);
    }

    // Remove from database
    await this.moduleRegistry.removeModule(moduleName);
    await this.databaseStorage.clearModule(moduleName);

    // Clear perspectives
    if (this.perspectives) {
      await this.perspectives.clearModule(moduleName);
    }

    // Clear from vector store
    if (this.vectorStore) {
      await this.vectorStore.clearModule(moduleName);
    }
  }

  /**
   * Clear all modules and tools
   */
  async clearAll() {
    if (!this.initialized) await this.initialize();

    // Clear caches
    this.moduleCache.clear();
    this.cache.clear();

    // Clear database
    await this.moduleRegistry.clearAll();
    await this.databaseStorage.clearAll();

    // Clear perspectives
    if (this.perspectives) {
      await this.perspectives.clearAll();
    }

    // Clear vector store
    if (this.vectorStore) {
      await this.vectorStore.clearAll();
    }
  }

  /**
   * Get system statistics
   */
  async getStatistics() {
    if (!this.initialized) await this.initialize();

    const stats = {
      modules: await this.moduleRegistry.countModules(),
      tools: await this.databaseStorage.countTools(),
      cachedTools: this.cache.size,
      cachedModules: this.moduleCache.size,
      perspectives: 0,
      vectors: 0
    };

    if (this.perspectives) {
      const perspectiveStats = await this.perspectives.getStatistics();
      stats.perspectives = perspectiveStats.total;
    }

    if (this.vectorStore) {
      stats.vectors = await this.vectorStore.countVectors();
    }

    return stats;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const health = {
      initialized: this.initialized,
      database: false,
      cache: false,
      perspectives: false,
      vectorStore: false
    };

    if (!this.initialized) {
      return health;
    }

    try {
      // Check database
      await this.databaseStorage.healthCheck();
      health.database = true;

      // Check cache
      health.cache = this.cache.size >= 0;

      // Check perspectives
      if (this.perspectives) {
        await this.perspectives.getStatistics();
        health.perspectives = true;
      }

      // Check vector store
      if (this.vectorStore) {
        await this.vectorStore.countVectors();
        health.vectorStore = true;
      }
    } catch (error) {
      console.error('Health check error:', error.message);
    }

    return health;
  }

  /**
   * Get vector database connection
   */
  async _getVectorDatabase() {
    const qdrantUrl = this.resourceManager.get('env.QDRANT_URL');
    if (qdrantUrl) {
      const { QdrantClient } = await import('@qdrant/js-client-rest');
      return new QdrantClient({
        url: qdrantUrl,
        apiKey: this.resourceManager.get('env.QDRANT_API_KEY')
      });
    }

    // Return mock vector database for development
    return {
      isConnected: false,
      hasCollection: async () => false,
      createCollection: async () => true,
      insert: async () => ({ id: Math.random().toString(36) }),
      insertBatch: async (collection, docs) => docs.map(() => ({ id: Math.random().toString(36) })),
      search: async () => [],
      delete: async () => true,
      deleteCollection: async () => true
    };
  }

  /**
   * Cleanup all resources
   */
  async cleanup() {
    try {
      // Clear caches
      if (this.cache) {
        this.cache.clear();
      }
      this.moduleCache.clear();

      // Cleanup components
      if (this.llmClient) {
        await this.llmClient.cleanup();
      }

      if (this.embeddingService) {
        await this.embeddingService.shutdown();
      }

      if (this.vectorStore) {
        await this.vectorStore.cleanup();
      }

      if (this.databaseStorage) {
        await this.databaseStorage.cleanup();
      }

      if (this.connectionPool) {
        await this.connectionPool.cleanup();
      }

      this.initialized = false;
    } catch (error) {
      console.error('Cleanup error:', error.message);
    }
  }
}