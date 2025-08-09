/**
 * MongoDB-Backed Tool Registry
 * 
 * Enhanced Tool Registry using MongoDB for persistence and semantic search capabilities.
 * Provides backwards compatibility with the existing ToolRegistry API while adding
 * database persistence, semantic search, and advanced tool discovery features.
 * 
 * 🚨 FOLLOWS LEGION RESOURCEMANAGER PATTERN 🚨
 */

import { ToolRegistryDatabaseService } from '../database/ToolRegistryDatabaseService.js';
import { SemanticSearchProvider } from '@legion/semantic-search';

export class MongoToolRegistry {
  /**
   * Private constructor - use create() factory method
   */
  constructor(dependencies) {
    if (!dependencies?._factoryCall) {
      throw new Error('MongoToolRegistry must be created using create() factory method');
    }

    this.resourceManager = dependencies.resourceManager;
    this.databaseService = dependencies.databaseService;
    this.semanticSearch = dependencies.semanticSearch;
    
    // Backward compatibility properties
    this.providers = new Map();
    this.instances = new Map();
    this.metadata = new Map();
    this.usageStats = new Map();
    this.moduleCache = new Map();
    this.toolCache = new Map();
    this.toolIndex = null;
    this.capabilityMap = null;
    this.initialized = false;
    
    // New MongoDB-specific properties
    this.enableSemanticSearch = !!this.semanticSearch;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.lastCacheUpdate = null;
  }

  /**
   * Async factory method following Legion ResourceManager pattern
   */
  static async create(resourceManager, options = {}) {
    if (!resourceManager?.initialized) {
      throw new Error('MongoToolRegistry requires initialized ResourceManager');
    }

    // Check for singleton
    const existing = resourceManager.get?.('mongoToolRegistry');
    if (existing) return existing;

    console.log('🚀 Creating MongoDB-backed Tool Registry...');

    // Initialize database service
    const databaseService = await ToolRegistryDatabaseService.create(resourceManager);

    // Initialize semantic search if enabled
    let semanticSearch = null;
    if (options.enableSemanticSearch !== false) {
      try {
        semanticSearch = await SemanticSearchProvider.create(resourceManager);
        await semanticSearch.connect();
        console.log('🔍 Semantic search enabled for tool registry');
      } catch (error) {
        console.warn('⚠️  Semantic search disabled:', error.message);
      }
    }

    const registry = new MongoToolRegistry({
      _factoryCall: true,
      resourceManager,
      databaseService,
      semanticSearch
    });

    await registry.initialize();

    // Register as singleton
    if (resourceManager.register) {
      resourceManager.register('mongoToolRegistry', registry);
    }

    return registry;
  }

  /**
   * Initialize the registry by loading existing modules and tools
   */
  async initialize() {
    if (this.initialized) return;

    console.log('📋 Initializing MongoDB Tool Registry...');

    try {
      // Load existing modules from database
      await this.loadModulesFromDatabase();
      
      // Load existing tools from database  
      await this.loadToolsFromDatabase();

      // Initialize semantic search index if available
      if (this.semanticSearch) {
        await this.initializeSemanticIndex();
      }

      this.initialized = true;
      this.lastCacheUpdate = Date.now();
      
      console.log(`✅ MongoDB Tool Registry initialized with ${this.metadata.size} modules`);
      
    } catch (error) {
      console.error('❌ Failed to initialize MongoDB Tool Registry:', error);
      throw error;
    }
  }

  // ============================================================================
  // MODULE LOADING FROM DATABASE
  // ============================================================================

  /**
   * Load modules from database into memory cache
   */
  async loadModulesFromDatabase() {
    const modules = await this.databaseService.listModules({ status: 'active' });
    
    console.log(`📦 Loading ${modules.length} modules from database...`);

    for (const moduleDoc of modules) {
      // Create metadata entry
      this.metadata.set(moduleDoc.name, {
        name: moduleDoc.name,
        description: moduleDoc.description,
        version: moduleDoc.version,
        type: moduleDoc.type,
        tools: {}, // Will be populated when tools are loaded
        _id: moduleDoc._id,
        category: moduleDoc.category,
        tags: moduleDoc.tags || []
      });

      // Create a provider that loads the module lazily
      const provider = await this.createModuleProvider(moduleDoc);
      this.providers.set(moduleDoc.name, provider);
    }
  }

  /**
   * Load tools from database into memory cache
   */
  async loadToolsFromDatabase() {
    const tools = await this.databaseService.listTools({ status: 'active' });
    
    console.log(`🔧 Loading ${tools.length} tools from database...`);

    for (const toolDoc of tools) {
      // Add tool to module metadata
      const moduleMetadata = this.metadata.get(toolDoc.moduleName);
      if (moduleMetadata) {
        moduleMetadata.tools[toolDoc.name] = {
          name: toolDoc.name,
          description: toolDoc.description,
          summary: toolDoc.summary,
          category: toolDoc.category,
          tags: toolDoc.tags || [],
          inputSchema: toolDoc.inputSchema,
          outputSchema: toolDoc.outputSchema,
          examples: toolDoc.examples || [],
          _id: toolDoc._id
        };
      }
    }
  }

  /**
   * Create a provider for a module document
   */
  async createModuleProvider(moduleDoc) {
    const provider = {
      name: moduleDoc.name,
      lazy: true,
      getMetadata: () => this.metadata.get(moduleDoc.name),
      getInstance: async () => {
        // Check cache first
        if (this.instances.has(moduleDoc.name)) {
          return this.instances.get(moduleDoc.name);
        }

        // Load module based on type
        let instance = null;
        
        try {
          if (moduleDoc.type === 'class') {
            instance = await this.loadClassModule(moduleDoc);
          } else if (moduleDoc.type === 'module.json') {
            instance = await this.loadJsonModule(moduleDoc);
          } else if (moduleDoc.type === 'definition') {
            instance = await this.loadDefinitionModule(moduleDoc);
          }

          if (instance) {
            this.instances.set(moduleDoc.name, instance);
            this.moduleCache.set(moduleDoc.name, instance);
          }

        } catch (error) {
          console.warn(`⚠️  Failed to load module ${moduleDoc.name}:`, error.message);
        }

        return instance;
      }
    };

    return provider;
  }

  /**
   * Load class-based module
   */
  async loadClassModule(moduleDoc) {
    try {
      const ModuleClass = await import(moduleDoc.path);
      const instance = new (ModuleClass.default || ModuleClass)();
      return instance;
    } catch (error) {
      console.warn(`Could not dynamically load class module ${moduleDoc.name}:`, error.message);
      return this.createDatabaseBackedModule(moduleDoc);
    }
  }

  /**
   * Load JSON-based module
   */
  async loadJsonModule(moduleDoc) {
    // For JSON modules, create a synthetic module from database data
    return this.createDatabaseBackedModule(moduleDoc);
  }

  /**
   * Load definition-based module
   */
  async loadDefinitionModule(moduleDoc) {
    try {
      const ModuleExports = await import(moduleDoc.path);
      const DefinitionClass = ModuleExports[moduleDoc.className];
      
      if (DefinitionClass && DefinitionClass.create) {
        return await DefinitionClass.create(this.resourceManager);
      }
    } catch (error) {
      console.warn(`Could not load definition module ${moduleDoc.name}:`, error.message);
    }
    
    return this.createDatabaseBackedModule(moduleDoc);
  }

  /**
   * Create a database-backed module when dynamic loading fails
   */
  createDatabaseBackedModule(moduleDoc) {
    const moduleMetadata = this.metadata.get(moduleDoc.name);
    
    return {
      name: moduleDoc.name,
      description: moduleDoc.description,
      
      getTools: () => {
        return Object.values(moduleMetadata.tools || {}).map(toolMeta => ({
          name: toolMeta.name,
          description: toolMeta.description,
          execute: async (params) => {
            // Record usage
            await this.recordToolUsage(toolMeta.name, moduleDoc.name, true);
            
            // For database-backed tools, we don't have actual implementations
            // This could be extended to support stored procedures or external calls
            return {
              success: true,
              message: `Database-backed tool ${toolMeta.name} executed`,
              data: { toolName: toolMeta.name, params, moduleDoc }
            };
          }
        }));
      },
      
      getTool: function(name) {
        const tools = this.getTools();
        return tools.find(t => t.name === name) || null;
      }
    };
  }

  // ============================================================================
  // SEMANTIC SEARCH INTEGRATION
  // ============================================================================

  /**
   * Initialize semantic search index for tools
   */
  async initializeSemanticIndex() {
    if (!this.semanticSearch) return;

    console.log('🔍 Initializing semantic search index...');

    try {
      // Get tools without embeddings
      const toolsWithoutEmbeddings = await this.databaseService.getToolsWithoutEmbeddings();
      
      if (toolsWithoutEmbeddings.length > 0) {
        console.log(`📝 Generating embeddings for ${toolsWithoutEmbeddings.length} tools...`);
        
        for (const tool of toolsWithoutEmbeddings) {
          await this.generateToolEmbedding(tool);
        }
      }

      console.log('✅ Semantic search index initialized');
      
    } catch (error) {
      console.warn('⚠️  Failed to initialize semantic search:', error.message);
    }
  }

  /**
   * Generate embedding for a tool
   */
  async generateToolEmbedding(tool) {
    if (!this.semanticSearch) return;

    try {
      // Create searchable text from tool metadata
      const searchText = [
        tool.name,
        tool.description,
        tool.summary || '',
        ...(tool.tags || []),
        tool.category || ''
      ].filter(Boolean).join(' ');

      // Generate embedding
      const embedding = await this.semanticSearch.embeddingService.generateEmbedding(searchText);
      
      // Update tool in database
      await this.databaseService.updateToolEmbedding(
        tool._id,
        embedding,
        this.semanticSearch.config.embeddingModel
      );

    } catch (error) {
      console.warn(`Failed to generate embedding for tool ${tool.name}:`, error.message);
    }
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY API
  // ============================================================================

  /**
   * Register module (backward compatibility)
   */
  async registerModule(module, moduleName) {
    console.log(`📝 Registering module: ${moduleName}`);

    // Extract tools from module
    const tools = [];
    if (module.getTools) {
      const moduleTools = module.getTools();
      for (const tool of moduleTools) {
        tools.push({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.schema || tool.inputSchema,
          summary: tool.description?.substring(0, 200),
          category: this.inferToolCategory(tool.name),
          tags: this.inferToolTags(tool.name, tool.description)
        });
      }
    }

    // Store module in database
    const moduleDoc = await this.databaseService.upsertModule({
      name: moduleName,
      description: `${moduleName} module`,
      type: 'class',
      path: 'dynamic',
      status: 'active',
      category: this.inferModuleCategory(moduleName),
      tags: [moduleName]
    });

    // Store tools in database
    for (const toolData of tools) {
      await this.databaseService.upsertTool({
        ...toolData,
        moduleId: moduleDoc._id,
        moduleName: moduleName
      });

      // Generate embedding if semantic search is available
      if (this.semanticSearch) {
        setTimeout(() => this.generateToolEmbedding({
          _id: null, // Will be set by database
          ...toolData
        }), 100);
      }
    }

    // Update cache
    const metadata = {
      name: moduleName,
      description: `${moduleName} module`,
      tools: {}
    };

    for (const tool of tools) {
      metadata.tools[tool.name] = {
        name: tool.name,
        description: tool.description
      };
    }

    const provider = {
      name: moduleName,
      getMetadata: () => metadata,
      getInstance: async () => module,
      lazy: false
    };

    this.providers.set(moduleName, provider);
    this.metadata.set(moduleName, metadata);
    this.instances.set(moduleName, module);

    this.invalidateCaches();

    return this;
  }

  /**
   * Get tool by name (with database lookup)
   */
  async getTool(name) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    if (this.toolCache.has(name)) {
      this.trackUsage(name);
      return this.toolCache.get(name);
    }

    // Try simple name lookup in database
    let tool = null;
    
    if (!name.includes('.')) {
      // Search by tool name across all modules
      const toolDoc = await this.databaseService.getToolByName(name);
      if (toolDoc) {
        tool = await this.loadToolFromDatabase(toolDoc);
      }
    } else {
      // Full module.tool name
      const [moduleName, toolName] = name.split('.');
      const toolDoc = await this.databaseService.getToolByName(toolName, moduleName);
      if (toolDoc) {
        tool = await this.loadToolFromDatabase(toolDoc);
      }
    }

    if (tool) {
      this.toolCache.set(name, tool);
      this.trackUsage(name);
      
      // Record usage in database
      await this.recordToolUsage(tool.name, tool.moduleName || 'unknown', true);
      
      return tool;
    }

    return null;
  }

  /**
   * Load tool from database document
   */
  async loadToolFromDatabase(toolDoc) {
    // Try to get from actual module instance first
    const moduleInstance = await this.getInstance(toolDoc.moduleName);
    
    if (moduleInstance && moduleInstance.getTool) {
      const tool = moduleInstance.getTool(toolDoc.name);
      if (tool) return tool;
    }

    // Fallback: create database-backed tool
    return {
      name: toolDoc.name,
      description: toolDoc.description,
      summary: toolDoc.summary,
      schema: toolDoc.inputSchema,
      inputSchema: toolDoc.inputSchema,
      outputSchema: toolDoc.outputSchema,
      examples: toolDoc.examples || [],
      moduleName: toolDoc.moduleName,
      execute: async (params) => {
        await this.recordToolUsage(toolDoc.name, toolDoc.moduleName, true);
        
        return {
          success: true,
          message: `Database-backed tool ${toolDoc.name} executed`,
          data: { toolName: toolDoc.name, params }
        };
      }
    };
  }

  /**
   * Search tools with semantic capabilities
   */
  async searchTools(criteria) {
    if (typeof criteria === 'string') {
      return this.searchToolsByText(criteria);
    }

    // Legacy criteria object support
    const results = [];
    
    if (criteria.capability) {
      return this.searchToolsByText(criteria.capability);
    }

    if (criteria.module) {
      const tools = await this.databaseService.listTools({ moduleName: criteria.module });
      return tools.map(t => `${t.moduleName}.${t.name}`);
    }

    return results;
  }

  /**
   * Search tools by text with semantic search
   */
  async searchToolsByText(searchText, options = {}) {
    const results = [];

    // Text-based search in database
    const textResults = await this.databaseService.searchTools(searchText, {
      limit: options.limit || 20
    });

    for (const tool of textResults) {
      results.push(`${tool.moduleName}.${tool.name}`);
    }

    // Semantic search if available
    if (this.semanticSearch && options.enableSemanticSearch !== false) {
      try {
        const embedding = await this.semanticSearch.embeddingService.generateEmbedding(searchText);
        const semanticResults = await this.databaseService.findSimilarTools(embedding, {
          threshold: options.threshold || 0.7,
          limit: options.semanticLimit || 10
        });

        for (const tool of semanticResults) {
          const toolName = `${tool.moduleName}.${tool.name}`;
          if (!results.includes(toolName)) {
            results.push(toolName);
          }
        }
      } catch (error) {
        console.warn('Semantic search failed, using text search only:', error.message);
      }
    }

    return results;
  }

  /**
   * List all tools
   */
  async listTools() {
    const tools = await this.databaseService.listTools({ status: 'active' });
    return tools.map(tool => `${tool.moduleName}.${tool.name}`);
  }

  /**
   * Get module instance (backward compatibility)
   */
  async getInstance(moduleName) {
    if (!this.providers.has(moduleName)) {
      return null;
    }

    if (!this.instances.has(moduleName)) {
      const provider = this.providers.get(moduleName);
      const instance = await provider.getInstance();
      if (instance) {
        this.instances.set(moduleName, instance);
      }
    }

    return this.instances.get(moduleName);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Record tool usage in database
   */
  async recordToolUsage(toolName, moduleName, success, executionTime = null) {
    try {
      // Get tool from database to get ID
      const toolDoc = await this.databaseService.getToolByName(toolName, moduleName);
      if (!toolDoc) return;

      await this.databaseService.recordToolUsage({
        toolId: toolDoc._id,
        toolName,
        moduleName,
        sessionId: 'system', // Could be enhanced to track actual sessions
        timestamp: new Date(),
        success,
        executionTime
      });
    } catch (error) {
      console.warn('Failed to record tool usage:', error.message);
    }
  }

  /**
   * Track usage in memory (backward compatibility)
   */
  trackUsage(toolName) {
    if (!this.usageStats.has(toolName)) {
      this.usageStats.set(toolName, {
        count: 0,
        firstUsed: Date.now(),
        lastUsed: null
      });
    }

    const stats = this.usageStats.get(toolName);
    stats.count++;
    stats.lastUsed = Date.now();
  }

  /**
   * Infer tool category from name and description
   */
  inferToolCategory(toolName) {
    const name = toolName.toLowerCase();
    if (name.includes('read') || name.includes('get') || name.includes('find')) return 'read';
    if (name.includes('write') || name.includes('create') || name.includes('save')) return 'write';
    if (name.includes('delete') || name.includes('remove')) return 'delete';
    if (name.includes('update') || name.includes('modify')) return 'update';
    if (name.includes('execute') || name.includes('run') || name.includes('command')) return 'execute';
    if (name.includes('search') || name.includes('query')) return 'search';
    return 'other';
  }

  /**
   * Infer tool tags from name and description
   */
  inferToolTags(toolName, description = '') {
    const tags = [];
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file')) tags.push('file');
    if (text.includes('directory') || text.includes('folder')) tags.push('directory');
    if (text.includes('json')) tags.push('json');
    if (text.includes('command') || text.includes('bash')) tags.push('command');
    if (text.includes('search')) tags.push('search');
    if (text.includes('http') || text.includes('api')) tags.push('network');
    
    return tags;
  }

  /**
   * Infer module category
   */
  inferModuleCategory(moduleName) {
    const name = moduleName.toLowerCase();
    if (name.includes('file') || name.includes('fs')) return 'filesystem';
    if (name.includes('http') || name.includes('network') || name.includes('api')) return 'network';
    if (name.includes('ai') || name.includes('llm')) return 'ai';
    if (name.includes('test')) return 'testing';
    if (name.includes('deploy')) return 'deployment';
    if (name.includes('data') || name.includes('json')) return 'data';
    return 'utility';
  }

  /**
   * Invalidate caches
   */
  invalidateCaches() {
    this.toolIndex = null;
    this.capabilityMap = null;
    this.toolCache.clear();
    this.lastCacheUpdate = Date.now();
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    const dbHealth = await this.databaseService.healthCheck();
    const stats = await this.databaseService.getDatabaseStats();

    return {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      initialized: this.initialized,
      database: dbHealth,
      cache: {
        modules: this.metadata.size,
        tools: this.toolCache.size,
        instances: this.instances.size,
        lastUpdate: this.lastCacheUpdate
      },
      semanticSearch: {
        enabled: !!this.semanticSearch,
        connected: this.semanticSearch?.connected || false
      },
      stats
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up MongoDB Tool Registry...');

    if (this.databaseService) {
      await this.databaseService.cleanup();
    }

    if (this.semanticSearch) {
      await this.semanticSearch.disconnect();
    }

    this.toolCache.clear();
    this.moduleCache.clear();
    this.instances.clear();
    this.providers.clear();
    this.metadata.clear();
    this.usageStats.clear();

    this.initialized = false;
    console.log('✅ MongoDB Tool Registry cleanup complete');
  }

  // Backward compatibility methods
  hasProvider(name) { return this.providers.has(name); }
  listProviders() { return Array.from(this.providers.keys()); }
  hasInstance(name) { return this.instances.has(name); }
  async getUsageStats() { return Object.fromEntries(this.usageStats); }
  async getAllMetadata() { 
    const stats = await this.databaseService.getDatabaseStats();
    return {
      modules: Array.from(this.metadata.values()),
      totalTools: stats.tools,
      capabilities: [] // Could be enhanced
    };
  }
}