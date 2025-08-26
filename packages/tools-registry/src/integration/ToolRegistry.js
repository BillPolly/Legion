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
  static _instance = null;
  static _isInitialized = false;

  /**
   * Get the singleton instance of ToolRegistry
   * @returns {Promise<ToolRegistry>} The initialized ToolRegistry singleton
   */
  static async getInstance() {
    if (!ToolRegistry._instance) {
      const { ResourceManager } = await import('@legion/resource-manager');
      const resourceManager = await ResourceManager.getResourceManager();
      ToolRegistry._instance = new ToolRegistry({ 
        resourceManager,
        enablePerspectives: true,
        enableVectorSearch: true
      });
      await ToolRegistry._instance.initialize();
      ToolRegistry._isInitialized = true;
    }
    return ToolRegistry._instance;
  }

  /**
   * Reset the singleton (mainly for testing)
   */
  static reset() {
    if (ToolRegistry._instance) {
      // Cleanup will be handled when new instance is created
      ToolRegistry._instance = null;
      ToolRegistry._isInitialized = false;
    }
  }

  constructor({ resourceManager, ...options }) {
    // Prevent direct instantiation except for singleton
    if (ToolRegistry._instance) {
      throw new Error('ToolRegistry is a singleton. Use ToolRegistry.getInstance() instead.');
    }

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
      
      // Store DatabaseStorage in ResourceManager for other components
      this.resourceManager.set('databaseStorage', this.databaseStorage);

      // Initialize core components
      this.moduleLoader = new ModuleLoader({
        resourceManager: this.resourceManager
      });

      this.moduleRegistry = new ModuleRegistry({
        databaseStorage: this.databaseStorage,
        moduleLoader: this.moduleLoader
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
        // Use ResourceManager's createLLMClient method which stores the client
        this.llmClient = await this.resourceManager.createLLMClient();

        this.perspectives = new Perspectives({
          resourceManager: this.resourceManager
        });
        await this.perspectives.initialize();
      }

      if (this.options.enableVectorSearch) {
        // Always use Nomic embeddings for vector search
        const { NomicEmbeddings } = await import('@legion/nomic');
        const nomicService = new NomicEmbeddings();
        await nomicService.initialize();
        
        // Create adapter for VectorStore compatibility
        this.embeddingService = {
          generateEmbedding: async (text) => {
            return await nomicService.embed(text);
          },
          generateEmbeddings: async (texts) => {
            return await nomicService.embedBatch(texts);
          },
          generateBatch: async (texts) => {
            return await nomicService.embedBatch(texts);
          },
          // Store reference to actual service for cleanup
          _nomicService: nomicService
        };

        this.vectorStore = new VectorStore({
          embeddingClient: this.embeddingService,
          vectorDatabase: await this._getVectorDatabase(),
          collectionName: 'tool_perspectives',  // Fixed: Use correct collection name
          dimensions: 768  // Use 768 dimensions for Nomic embeddings
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
   * Get initialization status
   */
  get isInitialized() {
    return this.initialized;
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
      // If tool is an instance with methods like subscribe, preserve it
      // Just add metadata properties directly to the tool instance
      if (tool.constructor && tool.constructor.name !== 'Object') {
        // It's a class instance, enhance it in place
        Object.assign(tool, {
          moduleName: toolMeta.moduleName,
          moduleId: toolMeta.moduleId,
          description: tool.description || toolMeta.description,
          inputSchema: tool.inputSchema || toolMeta.inputSchema,
          outputSchema: tool.outputSchema || toolMeta.outputSchema
        });
        
        // Cache the tool instance
        this.cache.set(toolName, tool);
        return tool;
      } else {
        // It's a plain object, create enhanced version
        const enhancedTool = {
          ...toolMeta,
          ...tool,
          execute: tool.execute.bind(tool),  // Bind to tool, not module
          _execute: tool._execute  // Preserve _execute if it exists
        };

        // Cache the tool
        this.cache.set(toolName, enhancedTool);
        return enhancedTool;
      }
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
          // Aggregate perspective results into unique tools with confidence scores
          return await this._aggregateSearchResults(vectorResults, options);
        }
      } catch (error) {
        console.warn('Vector search failed, falling back to text search:', error.message);
      }
    }

    // Fall back to text search
    const textResults = await this.textSearch.search(query, options);
    return this._formatTextSearchResults(textResults);
  }

  /**
   * Aggregate vector search results (which contain perspectives) into unique tools
   * with calculated confidence scores
   */
  async _aggregateSearchResults(vectorResults, options = {}) {
    const toolMap = new Map();
    
    // Group results by tool name and collect confidence scores
    for (const result of vectorResults) {
      // Try different ways to get the tool name
      const toolName = result.payload?.toolName || result.toolName || result.tool_name || result.name;
      if (!toolName) {
        console.warn('Vector result missing tool name:', result);
        continue;
      }
      
      if (toolMap.has(toolName)) {
        const existing = toolMap.get(toolName);
        existing.scores.push(result.score);
        existing.perspectives.push({
          context: result.payload?.context || result.context || '',
          perspective: result.payload?.perspective || result.perspective || '',
          score: result.score
        });
      } else {
        toolMap.set(toolName, {
          toolName,
          scores: [result.score],
          perspectives: [{
            context: result.payload?.context || result.context || '',
            perspective: result.payload?.perspective || result.perspective || '',
            score: result.score
          }]
        });
      }
    }
    
    // Get tool metadata from database for all unique tools
    const toolNames = Array.from(toolMap.keys());
    const collection = this.databaseStorage.getCollection('tools');
    const toolsFromDB = await collection.find({
      name: { $in: toolNames }
    }).toArray();
    
    // Create lookup map
    const toolDBMap = new Map(toolsFromDB.map(tool => [tool.name, tool]));
    
    // Calculate confidence and create tool results
    const results = [];
    for (const [toolName, aggregated] of toolMap) {
      try {
        // Get tool metadata from database
        const toolFromDB = toolDBMap.get(toolName);
        if (!toolFromDB) {
          console.warn(`Tool ${toolName} not found in database`);
          continue;
        }
        
        // Calculate confidence score (max score among perspectives)
        const maxScore = Math.max(...aggregated.scores);
        const avgScore = aggregated.scores.reduce((a, b) => a + b, 0) / aggregated.scores.length;
        
        // Use max score but adjust based on number of matching perspectives
        const perspectiveBonus = Math.min(0.1, aggregated.perspectives.length * 0.02);
        const confidence = Math.min(1.0, maxScore + perspectiveBonus);
        
        // Create enhanced tool result with database info and confidence
        const tool = {
          ...toolFromDB,
          confidence,
          maxScore,
          avgScore,
          perspectiveCount: aggregated.perspectives.length,
          perspectives: aggregated.perspectives.sort((a, b) => b.score - a.score)
        };
        
        results.push(tool);
      } catch (error) {
        console.warn(`Failed to process tool ${toolName}:`, error.message);
      }
    }
    
    // Apply confidence threshold filtering if specified
    let filteredResults = results;
    if (options.threshold !== undefined && options.threshold !== null) {
      filteredResults = results.filter(tool => tool.confidence >= options.threshold);
      console.log(`[ToolRegistry] Filtered by confidence threshold ${options.threshold}: ${results.length} -> ${filteredResults.length} tools`);
    }
    
    // Sort by confidence score descending
    filteredResults.sort((a, b) => b.confidence - a.confidence);
    
    // Apply limit
    const limit = options.limit || 20;
    return filteredResults.slice(0, limit);
  }

  /**
   * Format text search results to match the semantic search format
   */
  _formatTextSearchResults(textResults) {
    return textResults.map(tool => ({
      ...tool,
      confidence: 0.5, // Default confidence for text search
      maxScore: 0.5,
      avgScore: 0.5,
      perspectiveCount: 0,
      perspectives: []
    }));
  }

  /**
   * Get tool with perspectives
   */
  async getToolWithPerspectives(toolName) {
    if (!this.initialized) await this.initialize();

    const tool = await this.getTool(toolName);
    if (!tool) return null;

    if (this.perspectives) {
      const perspectives = await this.perspectives.getToolPerspectives(toolName);
      return {
        ...tool,
        perspectives
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
      await this.perspectives.clearModulePerspectives(moduleName);
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
      const vectorStats = await this.vectorStore.getStatistics();
      stats.vectors = vectorStats.vectors_count;
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
        const vectorStats = await this.vectorStore.getStatistics();
        vectorStats.vectors_count;
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
      const { QdrantVectorDatabase } = await import('../search/QdrantVectorDatabase.js');
      
      const qdrantClient = new QdrantClient({
        url: qdrantUrl
        // No API key needed for local Qdrant
      });
      
      return new QdrantVectorDatabase(qdrantClient, {
        dimensions: 768  // Use 768 dimensions for Nomic embeddings
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
      deleteCollection: async () => true,
      clear: async () => ({ deletedCount: 0 }),
      getStatistics: async () => ({ vectors_count: 0, dimensions: 768 })
    };
  }

  /**
   * Verify metadata for a specific module and its tools alignment
   * @param {string} moduleName - Name of module to verify
   * @returns {Object} Verification result with detailed metadata analysis
   */
  async verifyModuleMetadata(moduleName) {
    if (!this.initialized) await this.initialize();

    const verification = {
      moduleName,
      valid: true,
      errors: [],
      warnings: [],
      metadata: {},
      collections: {},
      moduleToolAlignment: {}
    };

    try {
      // Check module-registry collection
      const registryCollection = this.databaseStorage.getCollection('module-registry');
      const registryDoc = await registryCollection.findOne({ name: moduleName });
      
      verification.collections.registry = {
        exists: !!registryDoc,
        status: registryDoc?.status || null,
        path: registryDoc?.path || null,
        packageName: registryDoc?.packageName || null,
        lastUpdated: registryDoc?.lastUpdated || null,
        discoveredAt: registryDoc?.discoveredAt || null
      };

      if (!registryDoc) {
        verification.errors.push(`Module '${moduleName}' not found in module-registry`);
        verification.valid = false;
      }

      // Check modules collection
      const modulesCollection = this.databaseStorage.getCollection('modules');
      const moduleDoc = await modulesCollection.findOne({ _id: moduleName });
      
      verification.collections.modules = {
        exists: !!moduleDoc,
        status: moduleDoc?.status || null,
        loaded: moduleDoc?.loaded || false,
        loadedAt: moduleDoc?.loadedAt || null,
        savedAt: moduleDoc?.savedAt || null,
        version: moduleDoc?.version || null,
        description: moduleDoc?.description || null,
        author: moduleDoc?.author || null,
        keywords: moduleDoc?.keywords || null,
        dependencies: moduleDoc?.dependencies || null,
        path: moduleDoc?.path || null,
        packageName: moduleDoc?.packageName || null
      };

      if (!moduleDoc) {
        verification.errors.push(`Module '${moduleName}' not found in modules collection`);
        verification.valid = false;
      } else {
        // Verify required metadata fields
        if (!moduleDoc.name) {
          verification.errors.push('Module missing required name field');
          verification.valid = false;
        }
        
        if (!moduleDoc.loadedAt) {
          verification.warnings.push('Module missing loadedAt timestamp');
        }
        
        if (!moduleDoc.savedAt) {
          verification.warnings.push('Module missing savedAt timestamp');
        }

        if (moduleDoc.status !== 'loaded') {
          verification.warnings.push(`Module status is '${moduleDoc.status}', expected 'loaded'`);
        }

        // Verify complete metadata preservation
        const expectedMetadataFields = ['name', 'version', 'description', 'path', 'packageName'];
        for (const field of expectedMetadataFields) {
          if (moduleDoc[field] === undefined || moduleDoc[field] === null) {
            verification.warnings.push(`Module missing optional metadata field: ${field}`);
          }
        }
      }

      // Check tools collection and verify alignment
      const toolsCollection = this.databaseStorage.getCollection('tools');
      const tools = await toolsCollection.find({ moduleName }).toArray();
      
      verification.collections.tools = {
        count: tools.length,
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          hasDescription: !!tool.description,
          hasInputSchema: !!tool.inputSchema,
          hasOutputSchema: !!tool.outputSchema,
          hasCategory: !!tool.category,
          hasTags: !!tool.tags && tool.tags.length > 0,
          hasExamples: !!tool.examples && tool.examples.length > 0,
          moduleReference: tool.moduleName,
          id: tool._id,
          savedAt: tool.savedAt,
          inputSchemaProperties: tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties) : [],
          outputSchemaProperties: tool.outputSchema?.properties ? Object.keys(tool.outputSchema.properties) : [],
          category: tool.category,
          tags: tool.tags || []
        }))
      };

      // Load actual module instance to verify tool alignment
      let actualModuleTools = [];
      try {
        if (registryDoc?.path || moduleDoc?.path) {
          const modulePath = moduleDoc?.path || registryDoc?.path;
          const moduleInstance = await this.moduleLoader.loadModule(modulePath);
          actualModuleTools = await this.moduleLoader.getTools(moduleInstance);
          
          verification.moduleToolAlignment = {
            actualToolsCount: actualModuleTools.length,
            databaseToolsCount: tools.length,
            aligned: actualModuleTools.length === tools.length,
            missingInDatabase: [],
            extraInDatabase: [],
            metadataMismatches: []
          };

          // Check if all actual tools are in database
          const dbToolNames = new Set(tools.map(t => t.name));
          for (const actualTool of actualModuleTools) {
            if (!dbToolNames.has(actualTool.name)) {
              verification.moduleToolAlignment.missingInDatabase.push(actualTool.name);
              verification.moduleToolAlignment.aligned = false; // Set aligned to false when tools are missing
              verification.errors.push(`Tool '${actualTool.name}' exists in module but missing from database`);
              verification.valid = false;
            }
          }

          // Check if database has extra tools
          const actualToolNames = new Set(actualModuleTools.map(t => t.name));
          for (const dbTool of tools) {
            if (!actualToolNames.has(dbTool.name)) {
              verification.moduleToolAlignment.extraInDatabase.push(dbTool.name);
              verification.moduleToolAlignment.aligned = false; // Set aligned to false when there are extra tools
              verification.errors.push(`Tool '${dbTool.name}' exists in database but missing from module`);
              verification.valid = false;
            }
          }

          // Verify metadata alignment for matching tools
          for (const actualTool of actualModuleTools) {
            const dbTool = tools.find(t => t.name === actualTool.name);
            if (dbTool) {
              const mismatches = [];
              
              // Check description
              if (actualTool.description !== dbTool.description) {
                mismatches.push({
                  field: 'description',
                  actual: actualTool.description,
                  database: dbTool.description
                });
              }

              // Check input schema (deep comparison, normalizing null/undefined)
              const actualInputSchema = actualTool.inputSchema || null;
              const dbInputSchema = dbTool.inputSchema || null;
              if (JSON.stringify(actualInputSchema) !== JSON.stringify(dbInputSchema)) {
                mismatches.push({
                  field: 'inputSchema',
                  actual: actualInputSchema,
                  database: dbInputSchema
                });
              }

              // Check output schema (deep comparison, normalizing null/undefined)
              const actualOutputSchema = actualTool.outputSchema || null;
              const dbOutputSchema = dbTool.outputSchema || null;
              if (JSON.stringify(actualOutputSchema) !== JSON.stringify(dbOutputSchema)) {
                mismatches.push({
                  field: 'outputSchema',
                  actual: actualOutputSchema,
                  database: dbOutputSchema
                });
              }

              // Check category (normalizing null/undefined)
              const actualCategory = actualTool.category || null;
              const dbCategory = dbTool.category || null;
              if (actualCategory !== dbCategory) {
                mismatches.push({
                  field: 'category',
                  actual: actualCategory,
                  database: dbCategory
                });
              }

              // Check tags (array comparison, normalizing null/undefined)
              const actualTags = actualTool.tags || null;
              const dbTags = dbTool.tags || null;
              const actualTagsJson = JSON.stringify(actualTags ? actualTags.sort() : null);
              const dbTagsJson = JSON.stringify(dbTags ? dbTags.sort() : null);
              if (actualTagsJson !== dbTagsJson) {
                mismatches.push({
                  field: 'tags',
                  actual: actualTags,
                  database: dbTags
                });
              }

              // Check examples (deep comparison, normalizing null/undefined)
              const actualExamples = actualTool.examples || null;
              const dbExamples = dbTool.examples || null;
              if (JSON.stringify(actualExamples) !== JSON.stringify(dbExamples)) {
                mismatches.push({
                  field: 'examples',
                  actual: actualExamples,
                  database: dbExamples
                });
              }

              if (mismatches.length > 0) {
                verification.moduleToolAlignment.metadataMismatches.push({
                  toolName: actualTool.name,
                  mismatches
                });
                verification.moduleToolAlignment.aligned = false; // Set aligned to false when metadata mismatches exist
                verification.errors.push(`Tool '${actualTool.name}' has metadata mismatches between module and database`);
                verification.valid = false;
              }
            }
          }
        } else {
          verification.warnings.push('Cannot verify tool alignment - no module path available');
        }
      } catch (error) {
        verification.warnings.push(`Could not load module for tool alignment check: ${error.message}`);
      }

      // Verify tool metadata completeness
      for (const tool of tools) {
        if (!tool.name) {
          verification.errors.push(`Tool missing name field in module '${moduleName}'`);
          verification.valid = false;
        }
        
        if (!tool.description) {
          verification.warnings.push(`Tool '${tool.name}' missing description`);
        }
        
        if (tool.moduleName !== moduleName) {
          verification.errors.push(`Tool '${tool.name}' has incorrect module reference: '${tool.moduleName}' should be '${moduleName}'`);
          verification.valid = false;
        }
        
        const expectedId = `${moduleName}:${tool.name}`;
        if (tool._id !== expectedId) {
          verification.errors.push(`Tool '${tool.name}' has incorrect _id: '${tool._id}' should be '${expectedId}'`);
          verification.valid = false;
        }

        // Security check: execute function should not be saved
        if (tool.execute !== undefined) {
          verification.errors.push(`Tool '${tool.name}' has execute function saved to database (security risk)`);
          verification.valid = false;
        }

        // Check for complete schema preservation
        if (tool.inputSchema) {
          if (!tool.inputSchema.type) {
            verification.warnings.push(`Tool '${tool.name}' inputSchema missing type field`);
          }
          if (!tool.inputSchema.properties && tool.inputSchema.type === 'object') {
            verification.warnings.push(`Tool '${tool.name}' inputSchema missing properties for object type`);
          }
        }

        if (tool.outputSchema) {
          if (!tool.outputSchema.type) {
            verification.warnings.push(`Tool '${tool.name}' outputSchema missing type field`);
          }
          if (!tool.outputSchema.properties && tool.outputSchema.type === 'object') {
            verification.warnings.push(`Tool '${tool.name}' outputSchema missing properties for object type`);
          }
        }
      }

      // Cross-collection consistency checks
      if (registryDoc && moduleDoc) {
        if (registryDoc.path !== moduleDoc.path) {
          verification.warnings.push('Path mismatch between registry and modules collections');
        }
        
        if (registryDoc.packageName !== moduleDoc.packageName) {
          verification.warnings.push('Package name mismatch between registry and modules collections');
        }

        // Check status progression
        if (registryDoc.status === 'discovered' && moduleDoc.status !== 'loaded') {
          verification.warnings.push(`Status inconsistency: registry shows '${registryDoc.status}' but modules shows '${moduleDoc.status}'`);
        }
      }

      verification.metadata = {
        registryStatus: registryDoc?.status,
        moduleStatus: moduleDoc?.status,
        toolCount: tools.length,
        hasVersion: !!moduleDoc?.version,
        hasDescription: !!moduleDoc?.description,
        hasAuthor: !!moduleDoc?.author,
        hasKeywords: !!moduleDoc?.keywords && moduleDoc.keywords.length > 0,
        hasDependencies: !!moduleDoc?.dependencies && moduleDoc.dependencies.length > 0,
        metadataCompleteness: {
          core: ['name', 'version', 'description'].filter(f => moduleDoc?.[f]).length / 3,
          extended: ['author', 'keywords', 'dependencies'].filter(f => moduleDoc?.[f]).length / 3,
          tools: tools.length > 0 ? tools.filter(t => t.description && (t.inputSchema || t.outputSchema)).length / tools.length : 0
        }
      };

    } catch (error) {
      verification.errors.push(`Verification failed: ${error.message}`);
      verification.valid = false;
    }

    return verification;
  }

  /**
   * Verify metadata for a specific tool and its module alignment
   * @param {string} toolName - Name of tool to verify
   * @returns {Object} Verification result with detailed tool metadata analysis
   */
  async verifyToolMetadata(toolName) {
    if (!this.initialized) await this.initialize();

    const verification = {
      toolName,
      valid: true,
      errors: [],
      warnings: [],
      metadata: {},
      moduleReference: null,
      moduleAlignment: {}
    };

    try {
      // Find tool in database
      const toolsCollection = this.databaseStorage.getCollection('tools');
      const tool = await toolsCollection.findOne({ name: toolName });

      if (!tool) {
        verification.errors.push(`Tool '${toolName}' not found in tools collection`);
        verification.valid = false;
        return verification;
      }

      verification.moduleReference = tool.moduleName;

      // Verify basic tool metadata
      const requiredFields = ['name', 'moduleName'];
      for (const field of requiredFields) {
        if (!tool[field]) {
          verification.errors.push(`Tool missing required field: ${field}`);
          verification.valid = false;
        }
      }

      // Check optional but important fields
      if (!tool.description) {
        verification.warnings.push('Tool missing description');
      }

      // Verify _id format
      const expectedId = `${tool.moduleName}:${tool.name}`;
      if (tool._id !== expectedId) {
        verification.errors.push(`Tool _id '${tool._id}' should be '${expectedId}'`);
        verification.valid = false;
      }

      // Security check
      if (tool.execute !== undefined) {
        verification.errors.push('Tool has execute function saved to database (security risk)');
        verification.valid = false;
      }

      // Verify module reference exists and get module info
      let referencedModule = null;
      if (tool.moduleName) {
        const modulesCollection = this.databaseStorage.getCollection('modules');
        referencedModule = await modulesCollection.findOne({ _id: tool.moduleName });
        
        if (!referencedModule) {
          verification.errors.push(`Tool references non-existent module: '${tool.moduleName}'`);
          verification.valid = false;
        } else {
          verification.moduleAlignment.moduleExists = true;
          verification.moduleAlignment.moduleName = referencedModule.name;
          verification.moduleAlignment.moduleStatus = referencedModule.status;
          verification.moduleAlignment.moduleLoaded = referencedModule.loaded;
        }
      }

      // Verify tool exists in actual module instance
      verification.moduleAlignment = {
        ...verification.moduleAlignment,
        toolExistsInModule: false,
        actualToolMetadata: null,
        metadataMatches: true,
        mismatches: []
      };

      try {
        if (referencedModule?.path) {
          const moduleInstance = await this.moduleLoader.loadModule(referencedModule.path);
          const actualTools = await this.moduleLoader.getTools(moduleInstance);
          const actualTool = actualTools.find(t => t.name === toolName);

          if (actualTool) {
            verification.moduleAlignment.toolExistsInModule = true;
            verification.moduleAlignment.actualToolMetadata = {
              name: actualTool.name,
              description: actualTool.description,
              hasInputSchema: !!actualTool.inputSchema,
              hasOutputSchema: !!actualTool.outputSchema,
              hasCategory: !!actualTool.category,
              hasTags: !!actualTool.tags,
              hasExamples: !!actualTool.examples
            };

            // Compare actual vs database metadata (with normalization)
            const mismatches = [];

            if (actualTool.description !== tool.description) {
              mismatches.push({
                field: 'description',
                actual: actualTool.description,
                database: tool.description
              });
            }

            // Check input schema (deep comparison, normalizing null/undefined)
            const actualInputSchema = actualTool.inputSchema || null;
            const dbInputSchema = tool.inputSchema || null;
            if (JSON.stringify(actualInputSchema) !== JSON.stringify(dbInputSchema)) {
              mismatches.push({
                field: 'inputSchema',
                actual: actualInputSchema,
                database: dbInputSchema
              });
            }

            // Check output schema (deep comparison, normalizing null/undefined)
            const actualOutputSchema = actualTool.outputSchema || null;
            const dbOutputSchema = tool.outputSchema || null;
            if (JSON.stringify(actualOutputSchema) !== JSON.stringify(dbOutputSchema)) {
              mismatches.push({
                field: 'outputSchema',
                actual: actualOutputSchema,
                database: dbOutputSchema
              });
            }

            // Check category (normalizing null/undefined)
            const actualCategory = actualTool.category || null;
            const dbCategory = tool.category || null;
            if (actualCategory !== dbCategory) {
              mismatches.push({
                field: 'category',
                actual: actualCategory,
                database: dbCategory
              });
            }

            // Check tags (array comparison, normalizing null/undefined)
            const actualTags = actualTool.tags || null;
            const dbTags = tool.tags || null;
            const actualTagsJson = JSON.stringify(actualTags ? actualTags.sort() : null);
            const dbTagsJson = JSON.stringify(dbTags ? dbTags.sort() : null);
            if (actualTagsJson !== dbTagsJson) {
              mismatches.push({
                field: 'tags',
                actual: actualTags,
                database: dbTags
              });
            }

            // Check examples (deep comparison, normalizing null/undefined)
            const actualExamples = actualTool.examples || null;
            const dbExamples = tool.examples || null;
            if (JSON.stringify(actualExamples) !== JSON.stringify(dbExamples)) {
              mismatches.push({
                field: 'examples',
                actual: actualExamples,
                database: dbExamples
              });
            }

            if (mismatches.length > 0) {
              verification.moduleAlignment.metadataMatches = false;
              verification.moduleAlignment.mismatches = mismatches;
              verification.errors.push(`Tool '${toolName}' has metadata mismatches between module and database`);
              verification.valid = false;
            }

            // Verify execute function exists in module but not in database
            if (typeof actualTool.execute !== 'function') {
              verification.errors.push(`Tool '${toolName}' missing execute function in module`);
              verification.valid = false;
            }
          } else {
            verification.errors.push(`Tool '${toolName}' exists in database but missing from module '${tool.moduleName}'`);
            verification.valid = false;
          }
        }
      } catch (error) {
        verification.warnings.push(`Could not verify tool in module: ${error.message}`);
      }

      // Comprehensive metadata analysis
      verification.metadata = {
        hasDescription: !!tool.description,
        hasInputSchema: !!tool.inputSchema,
        hasOutputSchema: !!tool.outputSchema,
        hasCategory: !!tool.category,
        hasTags: !!tool.tags && tool.tags.length > 0,
        hasExamples: !!tool.examples && tool.examples.length > 0,
        moduleReference: tool.moduleName,
        savedAt: tool.savedAt,
        schemaComplexity: {
          inputProperties: tool.inputSchema?.properties ? Object.keys(tool.inputSchema.properties).length : 0,
          outputProperties: tool.outputSchema?.properties ? Object.keys(tool.outputSchema.properties).length : 0,
          inputRequired: tool.inputSchema?.required?.length || 0,
          outputRequired: tool.outputSchema?.required?.length || 0
        },
        completenessScore: this._calculateToolCompletenessScore(tool)
      };

      // Additional schema validation
      if (tool.inputSchema) {
        this._validateSchema(tool.inputSchema, 'inputSchema', verification);
      }

      if (tool.outputSchema) {
        this._validateSchema(tool.outputSchema, 'outputSchema', verification);
      }

    } catch (error) {
      verification.errors.push(`Tool verification failed: ${error.message}`);
      verification.valid = false;
    }

    return verification;
  }

  /**
   * Calculate completeness score for a tool (0-100)
   * @param {Object} tool - Tool object
   * @returns {number} Completeness score
   */
  _calculateToolCompletenessScore(tool) {
    let score = 0;
    
    // Basic fields (40 points total)
    if (tool.name) score += 10;
    if (tool.description) score += 15;
    if (tool.moduleName) score += 15;
    
    // Schema fields (40 points total)
    if (tool.inputSchema) score += 20;
    if (tool.outputSchema) score += 20;
    
    // Extended fields (20 points total)
    if (tool.category) score += 5;
    if (tool.tags && tool.tags.length > 0) score += 5;
    if (tool.examples && tool.examples.length > 0) score += 10;
    
    return Math.min(100, score);
  }

  /**
   * Validate a schema structure
   * @param {Object} schema - Schema to validate
   * @param {string} schemaType - Type of schema (inputSchema/outputSchema)
   * @param {Object} verification - Verification object to add warnings to
   */
  _validateSchema(schema, schemaType, verification) {
    if (!schema.type) {
      verification.warnings.push(`${schemaType} missing type field`);
    }

    if (schema.type === 'object') {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        verification.warnings.push(`${schemaType} with object type should have properties`);
      }
    }

    if (schema.type === 'array') {
      if (!schema.items) {
        verification.warnings.push(`${schemaType} with array type should have items definition`);
      }
    }

    // Check for common schema patterns
    if (schema.properties) {
      for (const [propName, propDef] of Object.entries(schema.properties)) {
        if (!propDef.type && !propDef.$ref) {
          verification.warnings.push(`${schemaType}.properties.${propName} missing type or $ref`);
        }
      }
    }
  }

  /**
   * Verify system-wide integrity across all collections
   * @returns {Object} Comprehensive system integrity report
   */
  async verifySystemIntegrity() {
    if (!this.initialized) await this.initialize();

    const integrity = {
      valid: true,
      errors: [],
      warnings: [],
      collections: {},
      referentialIntegrity: {},
      summary: {}
    };

    try {
      // Get all collections
      const registryCollection = this.databaseStorage.getCollection('module-registry');
      const modulesCollection = this.databaseStorage.getCollection('modules');
      const toolsCollection = this.databaseStorage.getCollection('tools');

      // Get all documents
      const registryModules = await registryCollection.find({}).toArray();
      const loadedModules = await modulesCollection.find({}).toArray();
      const allTools = await toolsCollection.find({}).toArray();

      integrity.collections = {
        registry: {
          count: registryModules.length,
          modules: registryModules.map(m => ({ name: m.name, status: m.status, path: m.path }))
        },
        modules: {
          count: loadedModules.length,
          modules: loadedModules.map(m => ({ name: m.name, status: m.status, loaded: m.loaded }))
        },
        tools: {
          count: allTools.length,
          byModule: {}
        }
      };

      // Group tools by module
      for (const tool of allTools) {
        if (!integrity.collections.tools.byModule[tool.moduleName]) {
          integrity.collections.tools.byModule[tool.moduleName] = [];
        }
        integrity.collections.tools.byModule[tool.moduleName].push({
          name: tool.name,
          hasDescription: !!tool.description,
          hasSchemas: !!(tool.inputSchema || tool.outputSchema)
        });
      }

      // Check referential integrity
      integrity.referentialIntegrity = {
        orphanedTools: [],
        modulesWithoutTools: [],
        registryWithoutLoaded: [],
        loadedWithoutRegistry: []
      };

      // Find orphaned tools (tools without corresponding module)
      const loadedModuleNames = new Set(loadedModules.map(m => m.name));
      for (const tool of allTools) {
        if (!loadedModuleNames.has(tool.moduleName)) {
          integrity.referentialIntegrity.orphanedTools.push({
            toolName: tool.name,
            referencedModule: tool.moduleName
          });
          integrity.errors.push(`Orphaned tool '${tool.name}' references non-existent module '${tool.moduleName}'`);
          integrity.valid = false;
        }
      }

      // Find modules without tools
      for (const module of loadedModules) {
        const moduleTools = allTools.filter(t => t.moduleName === module.name);
        if (moduleTools.length === 0) {
          integrity.referentialIntegrity.modulesWithoutTools.push(module.name);
          integrity.warnings.push(`Module '${module.name}' has no tools`);
        }
      }

      // Find registry modules without corresponding loaded modules
      const registryModuleNames = new Set(registryModules.map(m => m.name));
      for (const registryModule of registryModules) {
        if (!loadedModuleNames.has(registryModule.name)) {
          integrity.referentialIntegrity.registryWithoutLoaded.push(registryModule.name);
          integrity.warnings.push(`Registry module '${registryModule.name}' is not loaded`);
        }
      }

      // Find loaded modules without registry entries
      for (const loadedModule of loadedModules) {
        if (!registryModuleNames.has(loadedModule.name)) {
          integrity.referentialIntegrity.loadedWithoutRegistry.push(loadedModule.name);
          integrity.warnings.push(`Loaded module '${loadedModule.name}' missing from registry`);
        }
      }

      // Summary statistics
      integrity.summary = {
        totalModulesInRegistry: registryModules.length,
        totalLoadedModules: loadedModules.length,
        totalTools: allTools.length,
        orphanedTools: integrity.referentialIntegrity.orphanedTools.length,
        modulesWithoutTools: integrity.referentialIntegrity.modulesWithoutTools.length,
        averageToolsPerModule: loadedModules.length > 0 ? Math.round(allTools.length / loadedModules.length * 100) / 100 : 0,
        integrityScore: this._calculateIntegrityScore(integrity)
      };

    } catch (error) {
      integrity.errors.push(`System integrity check failed: ${error.message}`);
      integrity.valid = false;
    }

    return integrity;
  }

  /**
   * Generate comprehensive metadata report
   * @param {string} moduleName - Optional module name for focused report
   * @returns {Object} Detailed metadata report for debugging
   */
  async getMetadataReport(moduleName = null) {
    if (!this.initialized) await this.initialize();

    const report = {
      timestamp: new Date().toISOString(),
      scope: moduleName ? `module:${moduleName}` : 'system-wide',
      modules: [],
      systemIntegrity: null
    };

    try {
      if (moduleName) {
        // Single module report
        const moduleVerification = await this.verifyModuleMetadata(moduleName);
        report.modules.push(moduleVerification);
      } else {
        // All modules report
        const modulesCollection = this.databaseStorage.getCollection('modules');
        const allModules = await modulesCollection.find({}).toArray();
        
        for (const module of allModules) {
          const moduleVerification = await this.verifyModuleMetadata(module.name);
          report.modules.push(moduleVerification);
        }
      }

      // Always include system integrity check
      report.systemIntegrity = await this.verifySystemIntegrity();

    } catch (error) {
      report.error = error.message;
    }

    return report;
  }

  /**
   * Calculate integrity score (0-100) based on verification results
   * @param {Object} integrity - Integrity verification result
   * @returns {number} Integrity score from 0 to 100
   */
  _calculateIntegrityScore(integrity) {
    let score = 100;
    
    // Deduct points for errors (major issues)
    score -= integrity.errors.length * 10;
    
    // Deduct points for warnings (minor issues)
    score -= integrity.warnings.length * 2;
    
    // Bonus points for good practices
    const totalModules = integrity.collections.modules.count;
    if (totalModules > 0) {
      const modulesWithTools = totalModules - integrity.referentialIntegrity.modulesWithoutTools.length;
      const toolCoverage = (modulesWithTools / totalModules) * 10;
      score += toolCoverage;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Get initialized VectorStore instance
   * @returns {VectorStore} VectorStore instance for semantic operations
   */
  async getVectorStore() {
    if (!this.initialized) await this.initialize();
    
    if (!this.vectorStore) {
      // Initialize VectorStore with EmbeddingService and vector database
      const { VectorStore } = await import('../search/VectorStore.js');
      const embeddingService = this.resourceManager.get('embeddingService');
      const vectorDatabase = await this._getVectorDatabase();
      
      if (!embeddingService) {
        throw new Error('EmbeddingService not available from ResourceManager');
      }
      
      this.vectorStore = new VectorStore({
        embeddingClient: embeddingService,
        vectorDatabase: vectorDatabase,
        collectionName: 'tool_perspectives',
        dimensions: 768  // Use 768 dimensions for Nomic embeddings
      });
      
      await this.vectorStore.initialize();
    }
    
    return this.vectorStore;
  }

  /**
   * Index tool perspectives with embeddings in Qdrant
   * @param {string} toolName - Name of tool to index
   * @param {Array} perspectives - Array of perspective objects
   * @returns {Object} Indexing result
   */
  async indexToolPerspectives(toolName, perspectives) {
    if (!this.initialized) await this.initialize();
    
    try {
      const vectorStore = await this.getVectorStore();
      const results = [];
      
      for (const perspective of perspectives) {
        const tool = {
          name: toolName,
          description: perspective.query,
          moduleName: perspective.moduleName || 'Unknown',
          perspective: perspective.context,
          perspectiveType: perspective.perspectiveType || 'usage'
        };
        
        const result = await vectorStore.indexTool(tool, {
          perspective: perspective.query,
          context: perspective.context,
          perspectiveType: perspective.perspectiveType || 'usage'
        });
        
        results.push(result);
      }
      
      return {
        success: true,
        toolName,
        indexed: results.length,
        results
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        toolName,
        indexed: 0
      };
    }
  }

  /**
   * Search for similar tools using semantic similarity
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of similar tools with scores
   */
  async searchSimilarTools(query, options = {}) {
    if (!this.initialized) await this.initialize();
    
    try {
      const vectorStore = await this.getVectorStore();
      const results = await vectorStore.search(query, {
        limit: options.limit || 10,
        minScore: options.minScore || 0.7,
        filter: options.filter || {}
      });
      
      // Transform results to include tool information
      return results.map(result => ({
        toolName: result.metadata.toolName || result.toolName,
        score: result.score,
        description: result.metadata.description,
        moduleName: result.metadata.moduleName,
        perspective: result.metadata.perspective,
        perspectiveType: result.metadata.perspectiveType,
        context: result.metadata.context
      }));
      
    } catch (error) {
      throw new Error(`Semantic search failed: ${error.message}`);
    }
  }

  /**
   * Remove tool vectors from Qdrant
   * @param {string} toolName - Name of tool to remove
   * @returns {boolean} Success status
   */
  async removeToolVectors(toolName) {
    if (!this.initialized) await this.initialize();
    
    try {
      const vectorStore = await this.getVectorStore();
      return await vectorStore.deleteTool(toolName);
      
    } catch (error) {
      throw new Error(`Failed to remove tool vectors: ${error.message}`);
    }
  }

  /**
   * Get vector store statistics
   * @returns {Object} Vector store statistics
   */
  async getVectorStats() {
    if (!this.initialized) await this.initialize();
    
    try {
      const vectorStore = await this.getVectorStore();
      return await vectorStore.getStatistics();
      
    } catch (error) {
      throw new Error(`Failed to get vector statistics: ${error.message}`);
    }
  }

  // ============================================
  // WRAPPER METHODS FOR SCRIPT OPERATIONS
  // ============================================

  /**
   * Get system status and statistics
   */
  async getSystemStatus(options = {}) {
    const { verbose = false } = options;
    const status = {
      mongodb: { connected: false },
      qdrant: { connected: false },
      summary: {},
      database: { connected: false },
      collections: {},
      statistics: {},
      health: {},
      recommendations: []
    };

    try {
      // Database connection status
      status.database.connected = this.databaseStorage && this.databaseStorage.db;
      
      if (status.database.connected) {
        const db = this.databaseStorage.db;
        
        // Collection counts
        status.collections.perspectiveTypes = await db.collection('perspective_types').countDocuments();
        status.collections.tools = await db.collection('tools').countDocuments();
        status.collections.toolPerspectives = await db.collection('tool_perspectives').countDocuments();
        status.collections.modules = await db.collection('modules').countDocuments();
        status.collections.moduleRegistry = await db.collection('module-registry').countDocuments();
        
        // Count perspectives with embeddings (must be an array with length > 0)
        status.collections.perspectivesWithEmbeddings = await db.collection('tool_perspectives').countDocuments({
          embedding: { $exists: true, $type: 'array', $ne: [] }
        });
        
        // Tools by module
        if (status.collections.tools > 0) {
          status.statistics.toolsByModule = await db.collection('tools').aggregate([
            { $group: { _id: '$moduleName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]).toArray();
        }
        
        // Coverage analysis
        if (status.collections.toolPerspectives > 0) {
          const toolsWithPerspectives = await db.collection('tool_perspectives').distinct('tool_name');
          status.statistics.coverage = {
            toolsWithPerspectives: toolsWithPerspectives.length,
            totalTools: status.collections.tools,
            percentage: (toolsWithPerspectives.length / status.collections.tools * 100).toFixed(1)
          };
        }
        
        // Perspective types breakdown
        if (status.collections.toolPerspectives > 0) {
          status.statistics.perspectivesByType = await db.collection('tool_perspectives').aggregate([
            { $group: { _id: '$perspective_type_name', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ]).toArray();
        }
        
        // Sample data if verbose
        if (verbose) {
          status.samples = {};
          
          // Sample tools
          status.samples.tools = await db.collection('tools').find({}).limit(5).toArray();
          
          // Sample perspectives
          status.samples.perspectives = await db.collection('tool_perspectives')
            .aggregate([{ $sample: { size: 2 } }])
            .toArray();
        }
      }
      
      // Check Qdrant vector store
      if (this.vectorStore) {
        try {
          const vectorStats = await this.vectorStore.getStatistics();
          status.qdrant.connected = true;
          status.qdrant.vectors = vectorStats.vectors_count || 0;
          status.qdrant.dimensions = vectorStats.dimensions || 768;
          
          // Try to get collection info for more details
          if (this.vectorStore.getCollectionInfo) {
            const collectionInfo = await this.vectorStore.getCollectionInfo();
            if (collectionInfo && collectionInfo.vectors_count !== undefined) {
              status.qdrant.vectors = collectionInfo.vectors_count;
            }
          }
        } catch (error) {
          status.qdrant.connected = false;
          status.qdrant.error = error.message;
        }
      }
      
      // System health
      status.health.database = status.database.connected;
      status.health.llmClient = !!this.resourceManager.get('llmClient');
      status.health.embeddingService = !!this.embeddingService;
      status.health.vectorStore = !!this.vectorStore;
      
      // Recommendations
      if (status.collections.tools === 0) {
        status.recommendations.push('No tools loaded. Run loadModules() or loadAllModules()');
      } else if (status.collections.toolPerspectives === 0) {
        status.recommendations.push('No perspectives generated. Run generatePerspectives()');
      } else if (status.statistics.coverage && 
                 status.statistics.coverage.toolsWithPerspectives < status.collections.tools) {
        const missing = status.collections.tools - status.statistics.coverage.toolsWithPerspectives;
        status.recommendations.push(`${missing} tools missing perspectives. Run generatePerspectives()`);
      } else {
        status.recommendations.push('System fully populated and ready!');
      }
      
    } catch (error) {
      status.error = error.message;
    }
    
    return status;
  }

  /**
   * Load modules from tools-collection
   */
  async loadModules(options = {}) {
    const { moduleName, clear = false, verbose = false } = options;
    
    if (clear) {
      await this.clearAllData();
    }
    
    const results = {
      modulesLoaded: 0,
      modulesFailed: 0,
      toolsLoaded: 0,
      errors: []
    };
    
    // Get modules from the module-registry instead of hardcoded list
    let modulesToLoad;
    if (moduleName) {
      modulesToLoad = [moduleName];
    } else {
      // Load ALL discovered modules from the registry
      const discoveredModules = await this.databaseStorage.findDiscoveredModules();
      modulesToLoad = discoveredModules.map(m => m.name);
      if (verbose) {
        console.log(`📦 Found ${modulesToLoad.length} modules in registry to load`);
      }
    }
    
    for (const modName of modulesToLoad) {
      try {
        const loadResult = await this.loadSingleModule(modName, { verbose });
        if (loadResult.success) {
          results.modulesLoaded++;
          results.toolsLoaded += loadResult.toolCount;
        } else {
          results.modulesFailed++;
          results.errors.push({ module: modName, error: loadResult.error });
        }
      } catch (error) {
        results.modulesFailed++;
        results.errors.push({ module: modName, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Load all modules from tools-collection
   */
  async loadAllModules(options = {}) {
    return this.loadModules({ ...options, moduleName: null });
  }

  /**
   * Load a single module
   */
  async loadSingleModule(moduleName, options = {}) {
    const { verbose = false } = options;
    
    try {
      // Get module info from registry
      const moduleInfo = await this.databaseStorage.findDiscoveredModule(moduleName);
      if (!moduleInfo) {
        throw new Error(`Module ${moduleName} not found in registry`);
      }
      
      if (verbose) {
        console.log(`  Loading ${moduleName} from ${moduleInfo.path}`);
      }
      
      // Load module dynamically using the path from registry
      const moduleFile = await import(moduleInfo.path);
      const ModuleClass = moduleFile.default;
      
      if (!ModuleClass) {
        throw new Error('No default export found');
      }
      
      // Instantiate module
      let moduleInstance;
      if (ModuleClass.create && typeof ModuleClass.create === 'function') {
        moduleInstance = await ModuleClass.create(this.resourceManager);
      } else {
        moduleInstance = new ModuleClass();
        if (moduleInstance.resourceManager === undefined) {
          moduleInstance.resourceManager = this.resourceManager;
        }
        if (moduleInstance.initialize && typeof moduleInstance.initialize === 'function') {
          await moduleInstance.initialize();
        }
      }
      
      // Get tools
      if (!moduleInstance.getTools || typeof moduleInstance.getTools !== 'function') {
        throw new Error('Module does not implement getTools() method');
      }
      
      const tools = moduleInstance.getTools();
      const toolCount = Array.isArray(tools) ? tools.length : 0;
      
      // Store module in modules collection
      const moduleDoc = {
        name: moduleName,
        path: moduleInfo.path,
        type: moduleInfo.type || 'unknown',
        toolCount: toolCount,
        tools: tools.map(t => t.name),
        loadedAt: new Date(),
        updatedAt: new Date()
      };
      
      await this.databaseStorage.db.collection('modules').replaceOne(
        { name: moduleName },
        moduleDoc,
        { upsert: true }
      );
      
      // Store tools in database
      for (const tool of tools) {
        await this.storeTool(tool, moduleName, moduleInstance);
      }
      
      if (verbose) {
        console.log(`✅ ${moduleName}: ${toolCount} tools loaded`);
      }
      
      return { success: true, toolCount };
      
    } catch (error) {
      if (verbose) {
        console.log(`❌ ${moduleName}: ${error.message}`);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Store a tool in the database
   */
  async storeTool(tool, moduleName, moduleInstance) {
    const toolDoc = {
      _id: `${moduleName.toLowerCase()}:${tool.name}`,
      name: tool.name,
      description: tool.description || '',
      moduleName: moduleName,
      inputSchema: tool.inputSchema || {},
      outputSchema: tool.outputSchema || {},
      category: tool.category || 'general',
      tags: tool.tags || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await this.databaseStorage.db.collection('tools').replaceOne(
      { _id: toolDoc._id },
      toolDoc,
      { upsert: true }
    );
    
    // Cache the tool instance with enhanced properties  
    const enhancedTool = {
      ...tool,
      execute: tool.execute.bind(moduleInstance),
      moduleName
    };
    this.cache.set(tool.name, enhancedTool);
  }

  /**
   * Generate perspectives for all tools (without embeddings by default)
   */
  async generatePerspectives(options = {}) {
    const { 
      toolName, 
      moduleName,
      forceRegenerate = false,
      verbose = false,
      dryRun = false,
      generateEmbeddings = false  // Default to false for separate step
    } = options;
    
    if (!this.perspectives) {
      throw new Error('Perspectives system not initialized. Ensure LLM client is configured.');
    }
    
    // Get tools based on filters
    let tools;
    if (toolName) {
      tools = await this.databaseStorage.db.collection('tools').find({ name: toolName }).toArray();
    } else if (moduleName) {
      tools = await this.databaseStorage.db.collection('tools').find({ moduleName }).toArray();
    } else {
      tools = await this.databaseStorage.listTools();
    }
    
    const results = {
      total: tools.length,
      generated: 0,
      skipped: 0,
      failed: 0,
      failures: []
    };
    
    for (const tool of tools) {
      try {
        // Check if perspectives exist and skip if not forcing
        if (!forceRegenerate) {
          const existing = await this.databaseStorage.db.collection('tool_perspectives')
            .findOne({ tool_name: tool.name });
          if (existing) {
            results.skipped++;
            if (verbose) {
              console.log(`⏭️  Skipping ${tool.name} - perspectives already exist`);
            }
            continue;
          }
        }
        
        if (dryRun) {
          console.log(`Would generate perspectives for ${tool.name}`);
          results.generated++;
          continue;
        }
        
        // Generate perspectives without embeddings by default
        await this.perspectives.generatePerspectivesForTool(tool.name, {
          generateEmbeddings: generateEmbeddings
        });
        
        results.generated++;
        if (verbose) {
          console.log(`✅ Generated perspectives for ${tool.name}`);
        }
      } catch (error) {
        results.failed++;
        results.failures.push({ 
          toolName: tool.name, 
          error: error.message 
        });
        if (verbose) {
          console.log(`❌ Failed to generate perspectives for ${tool.name}: ${error.message}`);
        }
      }
    }
    
    return results;
  }

  /**
   * Generate embeddings for existing perspectives (separate step)
   */
  async generateEmbeddings(options = {}) {
    const { 
      toolName, 
      moduleName,
      forceRegenerate = false,
      verbose = false,
      validate = false
    } = options;
    
    if (!this.perspectives) {
      throw new Error('Perspectives system not initialized. Ensure LLM client is configured.');
    }
    
    // Build base filter for perspectives (tool/module)
    let baseFilter = {};
    
    // Add tool/module filter if specified
    if (toolName) {
      baseFilter.tool_name = toolName;
    } else if (moduleName) {
      // Get tools for module first
      const tools = await this.databaseStorage.db.collection('tools')
        .find({ moduleName }).toArray();
      const toolNames = tools.map(t => t.name);
      baseFilter.tool_name = { $in: toolNames };
    }
    
    // Get ALL perspectives matching base filter
    const allPerspectives = await this.databaseStorage.db.collection('tool_perspectives')
      .find(baseFilter).toArray();
    
    // Separate perspectives by embedding status
    const withEmbeddings = [];
    const withoutEmbeddings = [];
    
    for (const perspective of allPerspectives) {
      if (perspective.embedding && Array.isArray(perspective.embedding) && perspective.embedding.length > 0) {
        withEmbeddings.push(perspective);
      } else {
        withoutEmbeddings.push(perspective);
      }
    }
    
    // Determine what to process
    let toProcess = [];
    if (forceRegenerate) {
      // Force mode: process ALL perspectives
      toProcess = allPerspectives;
    } else {
      // Normal mode: only process those without embeddings
      toProcess = withoutEmbeddings;
    }
    
    // Initialize results
    const results = {
      totalPerspectives: allPerspectives.length,
      generated: 0,
      skipped: forceRegenerate ? 0 : withEmbeddings.length,  // In force mode, nothing is skipped
      failed: 0,
      failures: []
    };
    
    if (toProcess.length === 0) {
      if (verbose) {
        console.log(`All ${allPerspectives.length} perspectives already have embeddings`);
      }
      return results;
    }
    
    if (verbose) {
      console.log(`Processing ${toProcess.length} perspectives...`);
      if (forceRegenerate) {
        console.log(`Force regenerating embeddings (${withEmbeddings.length} already had embeddings)`);
      }
    }
    
    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize);
      const batchNum = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(toProcess.length / batchSize);
      
      try {
        // Generate embeddings for batch
        await this.perspectives._generateEmbeddingsForPerspectives(batch);
        
        // Update perspectives in database
        let successCount = 0;
        for (const perspective of batch) {
          if (perspective.embedding && perspective.embedding.length > 0) {
            await this.databaseStorage.db.collection('tool_perspectives').updateOne(
              { _id: perspective._id },
              { $set: { embedding: perspective.embedding } }
            );
            successCount++;
          }
        }
        
        results.generated += successCount;
        
        if (verbose) {
          console.log(`✅ Generated embeddings for batch ${batchNum}/${totalBatches} (${successCount} perspectives)`);
        }
        
      } catch (error) {
        results.failed += batch.length;
        results.failures.push({
          batch: batchNum,
          count: batch.length,
          error: error.message
        });
        
        if (verbose) {
          console.error(`❌ Failed batch ${batchNum}/${totalBatches}: ${error.message}`);
        }
      }
    }
    
    // When force regenerating, update the skipped count to reflect what already had embeddings
    if (forceRegenerate) {
      results.skipped = withEmbeddings.length;
    }
    
    if (verbose) {
      console.log(`\n📊 Final results:`);
      console.log(`  Total: ${results.totalPerspectives}`);
      console.log(`  Generated: ${results.generated}`);
      console.log(`  Already had embeddings: ${results.skipped}`);
      console.log(`  Failed: ${results.failed}`);
    }
    
    return results;
  }

  /**
   * Validate embeddings for quality and correctness
   */
  async validateEmbeddings(options = {}) {
    const { toolName, moduleName, verbose = false } = options;
    
    // Build filter
    const filter = { 
      embedding: { $exists: true, $ne: null }
    };
    
    if (toolName) {
      filter.tool_name = toolName;
    } else if (moduleName) {
      const tools = await this.databaseStorage.db.collection('tools')
        .find({ moduleName }).toArray();
      const toolNames = tools.map(t => t.name);
      filter.tool_name = { $in: toolNames };
    }
    
    const perspectives = await this.databaseStorage.db.collection('tool_perspectives')
      .find(filter).toArray();
    
    const results = {
      total: perspectives.length,
      valid: 0,
      invalid: 0,
      empty: 0,
      invalidDetails: []
    };
    
    for (const perspective of perspectives) {
      // Check if embedding exists and is valid
      if (!perspective.embedding) {
        results.empty++;
        continue;
      }
      
      // Validate embedding structure (should be 768-dimensional for Nomic)
      if (!Array.isArray(perspective.embedding)) {
        results.invalid++;
        results.invalidDetails.push({
          id: perspective._id,
          reason: 'Embedding is not an array'
        });
      } else if (perspective.embedding.length === 0) {
        results.empty++;
      } else if (perspective.embedding.length !== 768) {
        results.invalid++;
        results.invalidDetails.push({
          id: perspective._id,
          reason: `Wrong dimension: ${perspective.embedding.length} (expected 768)`
        });
      } else if (perspective.embedding.some(v => typeof v !== 'number' || isNaN(v))) {
        results.invalid++;
        results.invalidDetails.push({
          id: perspective._id,
          reason: 'Contains non-numeric or NaN values'
        });
      } else {
        // Check if embedding is all zeros (invalid)
        const isAllZeros = perspective.embedding.every(v => v === 0);
        if (isAllZeros) {
          results.invalid++;
          results.invalidDetails.push({
            id: perspective._id,
            reason: 'All values are zero'
          });
        } else {
          results.valid++;
        }
      }
    }
    
    if (verbose) {
      console.log('\n📊 Embedding Validation Results:');
      console.log(`  Total: ${results.total}`);
      console.log(`  Valid: ${results.valid}`);
      console.log(`  Invalid: ${results.invalid}`);
      console.log(`  Empty: ${results.empty}`);
    }
    
    return results;
  }

  /**
   * Index tools in vector store
   */
  async indexVectors(options = {}) {
    const { clear = true, verbose = false } = options;
    
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }
    
    if (clear) {
      await this.vectorStore.clear();
    }
    
    // Get all perspectives
    const perspectives = await this.databaseStorage.db
      .collection('tool_perspectives')
      .find({})
      .toArray();
    
    const results = {
      total: perspectives.length,
      indexed: 0,
      failed: 0,
      errors: []
    };
    
    // Index in batches
    const batchSize = 10;
    for (let i = 0; i < perspectives.length; i += batchSize) {
      const batch = perspectives.slice(i, i + batchSize);
      
      try {
        const toolPerspectives = batch.map(p => ({
          name: p.tool_name,
          description: p.content,
          moduleName: p.module_name || 'Unknown',
          perspectiveType: p.perspective_type_name,
          metadata: {
            perspectiveId: p._id,
            toolName: p.tool_name,
            moduleName: p.module_name,
            perspectiveType: p.perspective_type_name,
            keywords: p.keywords || []
          }
        }));
        
        await this.vectorStore.indexTools(toolPerspectives);
        results.indexed += batch.length;
        
        if (verbose) {
          console.log(`📍 Indexed batch ${Math.floor(i/batchSize) + 1}: ${batch.length} perspectives`);
        }
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({ batch: Math.floor(i/batchSize) + 1, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Clear all data from database and vector store
   */
  async clearAllData(options = {}) {
    const { includeRegistry = false, verbose = false } = options;
    
    const results = {
      mongodb: {},
      vectorStore: false,
      cache: { cleared: 0 }
    };
    
    // Clear database collections and count deleted documents
    const collections = ['tools', 'modules', 'tool_perspectives', 'perspective_types'];
    
    // Add module-registry if includeRegistry is true
    if (includeRegistry) {
      collections.push('module-registry');
    }
    
    for (const collection of collections) {
      try {
        const deleteResult = await this.databaseStorage.db.collection(collection).deleteMany({});
        results.mongodb[collection] = deleteResult.deletedCount || 0;
        
        if (verbose) {
          console.log(`  Cleared ${collection}: ${deleteResult.deletedCount || 0} documents`);
        }
      } catch (error) {
        // Collection might not exist
        if (verbose) {
          console.log(`  Skipped ${collection}: ${error.message}`);
        }
      }
    }
    
    // Clear vector store if available
    if (this.vectorStore) {
      try {
        await this.vectorStore.clear();
        results.vectorStore = true;
      } catch (error) {
        // Vector store might not be initialized
      }
    }
    
    // Clear caches
    const cacheSize = this.cache.size + this.moduleCache.size;
    this.cache.clear();
    this.moduleCache.clear();
    results.cache.cleared = cacheSize;
    
    return results;
  }

  /**
   * Test semantic search
   */
  async testSemanticSearch(queries = null, options = {}) {
    const { limit = 3, verbose = false } = options;
    
    if (!this.vectorStore) {
      return {
        success: false,
        error: 'Vector store not initialized',
        queries: 0,
        results: []
      };
    }
    
    const defaultQueries = [
      'mathematical calculations and arithmetic',
      'read files from disk',
      'parse JSON data structures',
      'execute system commands'
    ];
    
    const testQueries = queries || defaultQueries;
    const results = [];
    
    for (const query of testQueries) {
      try {
        const searchResults = await this.vectorStore.search(query, { limit });
        results.push({
          query,
          success: true,
          count: searchResults.length,
          topResult: searchResults[0] ? {
            name: searchResults[0].toolName,
            score: searchResults[0].score
          } : null
        });
        
        if (verbose) {
          console.log(`🔍 "${query}": ${searchResults.length} results`);
          if (searchResults[0]) {
            console.log(`   Top: ${searchResults[0].toolName} (score: ${searchResults[0].score.toFixed(4)})`);
          }
        }
      } catch (error) {
        results.push({
          query,
          success: false,
          error: error.message
        });
        
        if (verbose) {
          console.log(`❌ "${query}": ${error.message}`);
        }
      }
    }
    
    return results;
  }

  /**
   * Run complete pipeline with separated embedding generation
   */
  async runCompletePipeline(options = {}) {
    const { 
      clear = false, 
      verify = false, 
      verbose = false,
      skipEmbeddings = false,
      skipVectors = false 
    } = options;
    const startTime = Date.now();
    
    const results = {
      modules: {},
      perspectives: {},
      embeddings: {},
      vectors: {},
      search: {},
      duration: 0,
      success: false
    };
    
    try {
      if (!verify) {
        // Phase 1: Load modules
        if (verbose) console.log('📦 Phase 1: Loading modules...');
        results.modules = await this.loadAllModules({ clear, verbose });
        
        // Phase 2: Generate perspectives (without embeddings)
        if (this.perspectives) {
          if (verbose) console.log('📝 Phase 2: Generating perspectives (without embeddings)...');
          results.perspectives = await this.generatePerspectives({ 
            verbose,
            generateEmbeddings: false  // Don't generate embeddings yet
          });
        }
        
        // Phase 3: Generate embeddings (separate step for better error visibility)
        if (this.perspectives && !skipEmbeddings) {
          if (verbose) console.log('🔮 Phase 3: Generating embeddings for perspectives...');
          results.embeddings = await this.generateEmbeddings({ 
            verbose,
            validate: true  // Validate after generation
          });
          
          if (results.embeddings.failed > 0 && verbose) {
            console.log(`⚠️  ${results.embeddings.failed} embeddings failed to generate`);
          }
        }
        
        // Phase 4: Index vectors in Qdrant
        if (this.vectorStore && !skipVectors) {
          if (verbose) console.log('🔍 Phase 4: Indexing vectors in Qdrant...');
          results.vectors = await this.indexVectors({ verbose });
        }
      }
      
      // Phase 5: Test search
      if (this.vectorStore) {
        if (verbose) console.log('🧪 Phase 5: Testing semantic search...');
        results.search = await this.testSemanticSearch(null, { verbose });
      }
      
      results.duration = Date.now() - startTime;
      results.success = true;
      
      // Enhanced results for the script
      results.modulesLoaded = results.modules.successful || 0;
      results.modulesFailed = results.modules.failed || 0;
      results.toolsLoaded = results.modules.tools || 0;
      results.perspectives = results.perspectives.generated || 0;
      results.vectors = results.vectors.indexed || 0;
      results.searchWorking = results.search.success || false;
      results.totalTime = results.duration;
      
    } catch (error) {
      results.error = error.message;
      results.duration = Date.now() - startTime;
      results.totalTime = results.duration;
    }
    
    return results;
  }

  // ============================================
  // Enhanced Wrapper Methods for Granular Control
  // ============================================

  /**
   * Discover available modules without loading them
   * @param {Object} options - Discovery options
   * @returns {Object} Discovery results
   */
  async discoverModules(options = {}) {
    const { path, pattern, save = false, verbose = false } = options;
    
    if (!this.moduleDiscovery) {
      const { ModuleDiscovery } = await import('../core/ModuleDiscovery.js');
      this.moduleDiscovery = new ModuleDiscovery({ 
        resourceManager: this.resourceManager 
      });
    }
    
    // Use discoverInMonorepo to search the entire packages directory
    let allModules = [];
    
    if (path) {
      // If a specific path is provided, use it
      if (verbose) console.log(`🔍 Searching in ${path}...`);
      const modules = await this.moduleDiscovery.discoverModules(path, { 
        pattern, 
        verbose 
      });
      allModules = modules;
      if (verbose) console.log(`  Found ${modules.length} modules in ${path}`);
    } else {
      // Otherwise, search the entire monorepo packages directory
      if (verbose) console.log(`🔍 Searching in entire monorepo packages directory...`);
      allModules = await this.moduleDiscovery.discoverInMonorepo();
      if (verbose) console.log(`  Found ${allModules.length} modules in monorepo`);
      
      // Apply pattern filter if provided
      if (pattern) {
        const regex = new RegExp(pattern);
        allModules = allModules.filter(m => regex.test(m.name));
        if (verbose) console.log(`  After pattern filter: ${allModules.length} modules`);
      }
    }
    
    // Remove duplicates based on module name
    const uniqueModules = Array.from(
      new Map(allModules.map(m => [m.name, m])).values()
    );
    
    const results = {
      discovered: uniqueModules.length,
      modules: uniqueModules.map(m => ({
        name: m.name,
        path: m.path,
        type: m.type,
        hasPackageJson: m.hasPackageJson
      }))
    };
    
    if (save) {
      results.saved = await this.saveDiscoveredModules(uniqueModules, { verbose });
    }
    
    if (verbose) {
      console.log(`\n📦 Total discovered ${uniqueModules.length} unique modules`);
      uniqueModules.forEach(m => {
        console.log(`  - ${m.name} (${m.type}) at ${m.path}`);
      });
    }
    
    return results;
  }

  /**
   * Save discovered modules to registry
   * @param {Array} modules - Modules to save
   * @param {Object} options - Save options
   * @returns {Number} Number of modules saved
   */
  async saveDiscoveredModules(modules, options = {}) {
    const { verbose = false } = options;
    let saved = 0;
    
    const registryCollection = this.databaseStorage.getCollection('module-registry');
    
    for (const module of modules) {
      try {
        await registryCollection.updateOne(
          { name: module.name },
          { 
            $set: {
              ...module,
              discovered: new Date(),
              status: 'discovered'
            }
          },
          { upsert: true }
        );
        saved++;
        
        if (verbose) {
          console.log(`  ✅ Saved ${module.name} to registry`);
        }
      } catch (error) {
        if (verbose) {
          console.log(`  ❌ Failed to save ${module.name}: ${error.message}`);
        }
      }
    }
    
    return saved;
  }


  /**
   * Index vectors in Qdrant with enhanced options
   * @param {Object} options - Indexing options
   * @returns {Object} Indexing results
   */
  async indexVectorsEnhanced(options = {}) {
    const { moduleName, rebuild = false, clear = true, verify = false, verbose = false } = options;
    
    if (!this.vectorStore) {
      return {
        indexed: 0,
        failed: 0,
        skipped: 0,
        errors: ['Vector store not initialized']
      };
    }
    
    if (rebuild) {
      if (verbose) console.log('🔄 Rebuilding vector collection...');
      await this.rebuildVectorCollection({ verbose });
    } else if (clear) {
      if (verbose) console.log('🧹 Clearing existing vectors...');
      await this.vectorStore.clear();
    }
    
    // Get perspectives with embeddings
    let query = { embedding: { $exists: true } };
    if (moduleName) {
      const tools = await this.databaseStorage.db
        .collection('tools')
        .find({ moduleName })
        .toArray();
      query.tool_name = { $in: tools.map(t => t.name) };
    }
    
    const perspectives = await this.databaseStorage.db
      .collection('tool_perspectives')
      .find(query)
      .toArray();
    
    const results = {
      total: perspectives.length,
      indexed: 0,
      failed: 0,
      errors: []
    };
    
    // Process in batches for better performance
    const batchSize = 50;
    for (let i = 0; i < perspectives.length; i += batchSize) {
      const batch = perspectives.slice(i, i + batchSize);
      
      try {
        // Check if VectorStore has the right method
        if (this.vectorStore.vectorDatabase && this.vectorStore.vectorDatabase.insertBatch) {
          // Use insertBatch method - store MongoDB ID in metadata
          const docs = batch.map(perspective => ({
            vector: perspective.embedding,
            metadata: {
              perspectiveId: perspective._id.toString(),
              toolId: perspective.tool_id?.toString(),
              toolName: perspective.tool_name,
              moduleName: perspective.module_name,
              perspectiveType: perspective.perspective_type_name,
              content: perspective.content,
              keywords: perspective.keywords || []
            }
          }));
          
          await this.vectorStore.vectorDatabase.insertBatch('tool_perspectives', docs);
          
          results.indexed += batch.length;
        } else {
          // Fallback to individual indexing
          for (const perspective of batch) {
            try {
              // Create a tool-like object for indexTool method
              const toolData = {
                name: perspective.tool_name,
                description: perspective.content,
                moduleName: perspective.module_name
              };
              
              const perspectiveData = {
                perspective: perspective.content,
                category: perspective.perspective_type_name
              };
              
              await this.vectorStore.indexTool(toolData, perspectiveData);
              results.indexed++;
            } catch (error) {
              results.failed++;
              results.errors.push({
                tool: perspective.tool_name,
                error: error.message
              });
            }
          }
        }
        
        if (verbose && results.indexed > 0) {
          console.log(`✅ Indexed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(perspectives.length/batchSize)} (${Math.min(batchSize, batch.length)} perspectives)`);
        }
        
      } catch (error) {
        // Batch failed, record all as failed
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i/batchSize) + 1,
          count: batch.length,
          error: error.message
        });
        
        if (verbose) {
          console.error(`❌ Failed batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        }
      }
    }
    
    if (verify) {
      results.verification = await this.verifyVectorIndex({ verbose });
    }
    
    if (verbose) {
      console.log(`✅ Indexed ${results.indexed}/${results.total} vectors`);
      if (results.failed > 0) {
        console.log(`❌ Failed: ${results.failed}`);
      }
    }
    
    return results;
  }

  /**
   * Rebuild vector collection in Qdrant
   * @param {Object} options - Rebuild options
   * @returns {Boolean} Success status
   */
  async rebuildVectorCollection(options = {}) {
    const { verbose = false } = options;
    
    if (!this.vectorStore) {
      return {
        collection: 'none',
        dimension: 0,
        metric: 'none',
        created: false,
        error: 'Vector store not initialized'
      };
    }
    
    try {
      // Delete and recreate collection
      await this.vectorStore.deleteCollection();
      await this.vectorStore.createCollection({
        dimensions: 768,
        distance: 'Cosine'
      });
      
      if (verbose) {
        console.log('✅ Vector collection rebuilt');
      }
      
      return {
        collection: 'tool_perspectives',
        dimension: 768,
        metric: 'Cosine',
        created: true
      };
    } catch (error) {
      if (verbose) {
        console.log(`❌ Failed to rebuild collection: ${error.message}`);
      }
      return {
        collection: 'tool_perspectives',
        dimension: 0,
        metric: 'none',
        created: false,
        error: error.message
      };
    }
  }

  /**
   * Verify vector index integrity
   * @param {Object} options - Verification options
   * @returns {Object} Verification results
   */
  async verifyVectorIndex(options = {}) {
    const { verbose = false } = options;
    
    if (!this.vectorStore) {
      return {
        valid: true,
        totalPoints: 0,
        validPoints: 0,
        missingEmbeddings: 0,
        issues: ['Vector store not initialized'],
        stats: {}
      };
    }
    
    const results = {
      valid: true,
      totalPoints: 0,
      validPoints: 0,
      missingEmbeddings: 0,
      issues: [],
      stats: {}
    };
    
    try {
      // Get collection info
      const collectionInfo = await this.vectorStore.getCollectionInfo();
      results.stats.vectorCount = collectionInfo.vectors_count || 0;
      results.stats.dimensions = collectionInfo.config?.params?.vectors?.size || 768;
      
      // Count perspectives with embeddings
      const perspectiveCount = await this.databaseStorage.db
        .collection('tool_perspectives')
        .countDocuments({ embedding: { $exists: true } });
      
      results.stats.perspectiveCount = perspectiveCount;
      
      // Check for mismatches
      if (results.stats.vectorCount !== results.stats.perspectiveCount) {
        results.valid = false;
        results.issues.push({
          type: 'count_mismatch',
          message: `Vector count (${results.stats.vectorCount}) doesn't match perspective count (${results.stats.perspectiveCount})`
        });
      }
      
      // CRUCIAL CHECK: Verify Qdrant metadata matches MongoDB records
      try {
        // Get a sample of vectors from Qdrant with their metadata
        // Use a dummy search to get sample vectors with their payload
        const dummyVector = new Array(this.options.dimensions || 768).fill(0.1);
        const sampleVectors = await this.vectorStore.vectorDatabase.search(
          'tool_perspectives',
          dummyVector,
          {
            limit: 10,
            withPayload: true
          }
        );
        
        if (sampleVectors && sampleVectors.length > 0) {
          let metadataMatchCount = 0;
          let metadataMismatchCount = 0;
          const { ObjectId } = await import('mongodb');
          
          for (const vector of sampleVectors) {
            if (vector.metadata && vector.metadata.perspectiveId) {
              // Check if this perspectiveId exists in MongoDB
              let perspectiveId;
              try {
                perspectiveId = ObjectId.isValid(vector.metadata.perspectiveId) 
                  ? new ObjectId(vector.metadata.perspectiveId)
                  : vector.metadata.perspectiveId;
              } catch {
                perspectiveId = vector.metadata.perspectiveId;
              }
              
              const dbRecord = await this.databaseStorage.db
                .collection('tool_perspectives')
                .findOne({ _id: perspectiveId });
              
              if (dbRecord) {
                // Verify metadata matches
                const metadataMatches = (
                  vector.metadata.toolName === dbRecord.tool_name &&
                  vector.metadata.moduleName === dbRecord.module_name &&
                  vector.metadata.perspectiveType === dbRecord.perspective_type_name
                );
                
                if (metadataMatches) {
                  metadataMatchCount++;
                } else {
                  metadataMismatchCount++;
                  if (verbose) {
                    console.log(`  ⚠️  Metadata mismatch for ${vector.metadata.perspectiveId}`);
                    console.log(`    Qdrant: ${vector.metadata.toolName}/${vector.metadata.moduleName}/${vector.metadata.perspectiveType}`);
                    console.log(`    MongoDB: ${dbRecord.tool_name}/${dbRecord.module_name}/${dbRecord.perspective_type_name}`);
                  }
                }
              } else {
                metadataMismatchCount++;
                if (verbose) {
                  console.log(`  ❌ Vector ${vector.metadata.perspectiveId} not found in MongoDB`);
                }
              }
            }
          }
          
          results.stats.sampleSize = sampleVectors.length;
          results.stats.metadataMatches = metadataMatchCount;
          results.stats.metadataMismatches = metadataMismatchCount;
          
          // Calculate valid points based on metadata verification
          if (sampleVectors.length > 0) {
            const validPercentage = metadataMatchCount / sampleVectors.length;
            results.validPoints = Math.round(results.stats.vectorCount * validPercentage);
          } else {
            // No vectors found for sampling, assume none are valid
            results.validPoints = 0;
          }
          
          if (metadataMismatchCount > 0) {
            results.valid = false;
            results.issues.push({
              type: 'metadata_mismatch',
              message: `${metadataMismatchCount}/${sampleVectors.length} vectors have metadata that doesn't match MongoDB records`
            });
          }
        }
      } catch (error) {
        results.valid = false;
        results.issues.push({
          type: 'metadata_verification_error',
          message: `Metadata verification failed: ${error.message}`
        });
      }
      
      // Test search
      try {
        const testResults = await this.vectorStore.search('test query', { limit: 1 });
        results.stats.searchWorking = true;
      } catch (error) {
        results.valid = false;
        results.issues.push({
          type: 'search_failure',
          message: `Search test failed: ${error.message}`
        });
      }
      
      if (verbose) {
        console.log('📊 Vector Index Stats:');
        console.log(`  Vectors: ${results.stats.vectorCount}`);
        console.log(`  Perspectives: ${results.stats.perspectiveCount}`);
        console.log(`  Metadata verification: ${results.stats.sampleSize || 0} samples checked`);
        console.log(`  Metadata matches: ${results.stats.metadataMatches || 0}`);
        console.log(`  Metadata mismatches: ${results.stats.metadataMismatches || 0}`);
        console.log(`  Search: ${results.stats.searchWorking ? '✅' : '❌'}`);
        console.log(`  Valid: ${results.valid ? '✅' : '❌'}`);
      }
      
    } catch (error) {
      results.valid = false;
      results.issues.push({
        type: 'verification_error',
        message: error.message
      });
    }
    
    return results;
  }

  /**
   * Verify modules integrity
   * @param {Object} options - Verification options
   * @returns {Object} Verification results
   */
  async verifyModules(options = {}) {
    const { fix = false, verbose = false } = options;
    
    const results = {
      valid: true,
      verified: 0,
      issues: 0,
      totalTools: 0,  // Add total tool count
      toolsWithoutExecute: 0,  // Tools missing execute function
      modules: {
        total: 0,
        valid: 0,
        issues: []
      }
    };
    
    const modules = await this.databaseStorage.db
      .collection('modules')
      .find({})
      .toArray();
    
    results.modules.total = modules.length;
    
    for (const module of modules) {
      const issues = [];
      
      // Check required fields
      if (!module.name) issues.push('missing_name');
      if (!module.path) issues.push('missing_path');
      
      // Check if module file exists
      try {
        const { existsSync } = await import('fs');
        if (!existsSync(module.path)) {
          issues.push('file_not_found');
        }
      } catch (error) {
        issues.push('cannot_verify_file');
      }
      
      // Check tools reference
      const toolCount = await this.databaseStorage.db
        .collection('tools')
        .countDocuments({ moduleName: module.name });
      
      if (toolCount === 0) {
        issues.push('no_tools');
      } else {
        // Verify each tool has an execute function
        try {
          const moduleInstance = await this.moduleRegistry.getModule(module.name);
          if (moduleInstance) {
            const tools = moduleInstance.getTools ? moduleInstance.getTools() : [];
            let toolsWithoutExecute = 0;
            
            for (const tool of tools) {
              if (typeof tool.execute !== 'function') {
                toolsWithoutExecute++;
                results.toolsWithoutExecute++;
                if (verbose) {
                  console.log(`  ⚠️  Tool '${tool.name}' in module '${module.name}' missing execute function`);
                }
              }
            }
            
            if (toolsWithoutExecute > 0) {
              issues.push(`${toolsWithoutExecute}_tools_without_execute`);
            }
          }
        } catch (error) {
          if (verbose) {
            console.log(`  ⚠️  Could not verify tools for module ${module.name}: ${error.message}`);
          }
        }
      }
      
      if (issues.length === 0) {
        results.modules.valid++;
        results.verified++;
      } else {
        results.valid = false;
        results.issues++;
        results.modules.issues.push({
          module: module.name,
          issues
        });
        
        if (fix) {
          // Attempt fixes
          if (issues.includes('no_tools')) {
            try {
              await this.loadSingleModule(module.name, { verbose });
              if (verbose) {
                console.log(`✅ Fixed: Loaded tools for ${module.name}`);
              }
            } catch (error) {
              if (verbose) {
                console.log(`❌ Could not fix ${module.name}: ${error.message}`);
              }
            }
          }
        }
      }
    }
    
    if (verbose) {
      console.log(`📦 Modules: ${results.modules.valid}/${results.modules.total} valid`);
      if (results.toolsWithoutExecute > 0) {
        console.log(`⚠️  Tools without execute function: ${results.toolsWithoutExecute}`);
      }
      if (results.modules.issues.length > 0) {
        console.log('Issues:');
        results.modules.issues.forEach(m => {
          console.log(`  - ${m.module}: ${m.issues.join(', ')}`);
        });
      }
    }
    
    // Count total tools across all modules
    results.totalTools = await this.databaseStorage.db
      .collection('tools')
      .countDocuments({});
    
    return results;
  }

  /**
   * Verify perspectives integrity
   * @param {Object} options - Verification options
   * @returns {Object} Verification results
   */
  async verifyPerspectives(options = {}) {
    const { verbose = false } = options;
    
    const results = {
      valid: true,
      perspectives: {
        total: 0,
        withEmbeddings: 0,
        issues: []
      },
      coverage: {}
    };
    
    // Get all perspectives
    const perspectives = await this.databaseStorage.db
      .collection('tool_perspectives')
      .find({})
      .toArray();
    
    results.perspectives.total = perspectives.length;
    results.perspectives.withEmbeddings = perspectives.filter(p => p.embedding).length;
    
    // Check coverage
    const tools = await this.databaseStorage.db
      .collection('tools')
      .find({})
      .toArray();
    
    const toolsWithPerspectives = new Set(perspectives.map(p => p.tool_name));
    
    results.coverage = {
      totalTools: tools.length,
      toolsWithPerspectives: toolsWithPerspectives.size,
      percentage: (toolsWithPerspectives.size / tools.length * 100).toFixed(1)
    };
    
    // Find tools without perspectives
    const toolsWithoutPerspectives = tools
      .filter(t => !toolsWithPerspectives.has(t.name))
      .map(t => t.name);
    
    if (toolsWithoutPerspectives.length > 0) {
      results.valid = false;
      results.perspectives.issues.push({
        type: 'missing_perspectives',
        tools: toolsWithoutPerspectives
      });
    }
    
    // Check for perspectives without embeddings
    const perspectivesWithoutEmbeddings = perspectives
      .filter(p => !p.embedding)
      .map(p => p.tool_name);
    
    if (perspectivesWithoutEmbeddings.length > 0) {
      results.perspectives.issues.push({
        type: 'missing_embeddings',
        count: perspectivesWithoutEmbeddings.length,
        tools: [...new Set(perspectivesWithoutEmbeddings)]
      });
    }
    
    if (verbose) {
      console.log('🧠 Perspectives:');
      console.log(`  Total: ${results.perspectives.total}`);
      console.log(`  With embeddings: ${results.perspectives.withEmbeddings}`);
      console.log(`  Coverage: ${results.coverage.percentage}%`);
      if (results.perspectives.issues.length > 0) {
        console.log('Issues:');
        results.perspectives.issues.forEach(issue => {
          if (issue.type === 'missing_perspectives') {
            console.log(`  - ${issue.tools.length} tools without perspectives`);
          } else if (issue.type === 'missing_embeddings') {
            console.log(`  - ${issue.count} perspectives without embeddings`);
          }
        });
      }
    }
    
    // Add expected properties at root level for test compatibility
    results.toolsWithPerspectives = results.coverage.toolsWithPerspectives;
    results.totalPerspectives = results.perspectives.total;
    results.missingPerspectives = results.perspectives.issues.length;
    
    return results;
  }

  /**
   * Verify complete pipeline
   * @param {Object} options - Verification options
   * @returns {Object} Complete verification results
   */
  async verifyPipeline(options = {}) {
    const { modules = true, perspectives = true, vectors = true, search = true, fix = false, verbose = false } = options;
    
    const results = {
      valid: true,
      timestamp: new Date(),
      checks: {}
    };
    
    if (modules) {
      if (verbose) console.log('\n📦 Verifying modules...');
      results.checks.modules = await this.verifyModules({ fix, verbose });
      if (!results.checks.modules.valid) results.valid = false;
    }
    
    if (perspectives) {
      if (verbose) console.log('\n🧠 Verifying perspectives...');
      results.checks.perspectives = await this.verifyPerspectives({ verbose });
      if (!results.checks.perspectives.valid) results.valid = false;
    }
    
    if (vectors) {
      if (verbose) console.log('\n🔍 Verifying vectors...');
      results.checks.vectors = await this.verifyVectorIndex({ verbose });
      if (!results.checks.vectors.valid) results.valid = false;
    }
    
    if (search) {
      if (verbose) console.log('\n🔎 Testing search...');
      const searchResults = await this.testSemanticSearch(null, { verbose });
      
      // Handle case where searchResults is an error object instead of array
      if (Array.isArray(searchResults)) {
        results.checks.search = {
          valid: searchResults.every(r => r.success),
          results: searchResults
        };
      } else {
        // searchResults is an error object
        results.checks.search = {
          valid: searchResults.success || false,
          error: searchResults.error,
          results: searchResults.results || []
        };
      }
      
      if (!results.checks.search.valid) results.valid = false;
    }
    
    if (verbose) {
      console.log('\n' + '='.repeat(50));
      console.log(`📊 Pipeline Status: ${results.valid ? '✅ VALID' : '❌ INVALID'}`);
    }
    
    // Add expected properties at root level for test compatibility
    results.mongodb = results.checks.modules || { valid: true };
    results.qdrant = results.checks.vectors || { valid: true };
    results.embeddings = results.checks.perspectives || { valid: true };
    results.health = {
      status: results.valid ? 'healthy' : 'degraded',
      timestamp: results.timestamp,
      overall: results.valid
    };
    
    return results;
  }

  /**
   * Load multiple specific modules
   * @param {Array} moduleNames - Array of module names to load
   * @param {Object} options - Loading options
   * @returns {Object} Loading results
   */
  async loadMultipleModules(moduleNames, options = {}) {
    const { skipValidation = false, updateOnly = false, verbose = false } = options;
    
    const results = {
      requested: moduleNames.length,
      loaded: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
    
    for (const moduleName of moduleNames) {
      try {
        if (updateOnly) {
          // Check if module exists
          const exists = await this.databaseStorage.db
            .collection('modules')
            .findOne({ name: moduleName });
          
          if (!exists) {
            if (verbose) {
              console.log(`⏭️  Skipping ${moduleName} (not in database)`);
            }
            continue;
          }
        }
        
        await this.loadSingleModule(moduleName, { skipValidation, verbose });
        
        if (updateOnly) {
          results.updated++;
        } else {
          results.loaded++;
        }
        
        if (verbose) {
          console.log(`✅ ${updateOnly ? 'Updated' : 'Loaded'} ${moduleName}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push({
          module: moduleName,
          error: error.message
        });
        
        if (verbose) {
          console.log(`❌ Failed ${moduleName}: ${error.message}`);
        }
      }
    }
    
    return results;
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
        // Handle both EmbeddingService and Nomic adapter
        if (typeof this.embeddingService.shutdown === 'function') {
          await this.embeddingService.shutdown();
        } else if (this.embeddingService._nomicService && typeof this.embeddingService._nomicService.close === 'function') {
          await this.embeddingService._nomicService.close();
        }
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