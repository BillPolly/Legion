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
          resourceManager: this.resourceManager
        });
      }

      if (this.options.enableVectorSearch) {
        // Check if we have LLM client for embeddings
        const hasLLMClient = this.resourceManager.get('env.ANTHROPIC_API_KEY');
        
        if (hasLLMClient && this.options.enablePerspectives) {
          // Use LLM-based EmbeddingService when available
          this.embeddingService = new EmbeddingService({
            resourceManager: this.resourceManager,
            options: { dimensions: 768 }
          });
          await this.embeddingService.initialize();
        } else {
          // Fall back to Nomic embeddings when no LLM client
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
        }

        this.vectorStore = new VectorStore({
          embeddingClient: this.embeddingService,
          vectorDatabase: await this._getVectorDatabase(),
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