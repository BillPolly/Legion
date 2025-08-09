/**
 * Provider-Based Tool Registry
 * 
 * Enhanced ToolRegistry that uses pluggable providers for data persistence.
 * Maintains backward compatibility while allowing different storage backends
 * (MongoDB, JSON files, memory, etc.) through the provider interface.
 * 
 * 🚨 FOLLOWS LEGION RESOURCEMANAGER PATTERN 🚨
 */

import { SemanticSearchProvider } from '@legion/semantic-search';

export class ProviderBasedToolRegistry {
  /**
   * Private constructor - use create() factory method
   */
  constructor(dependencies) {
    if (!dependencies?._factoryCall) {
      throw new Error('ProviderBasedToolRegistry must be created using create() factory method');
    }

    this.resourceManager = dependencies.resourceManager;
    this.provider = dependencies.provider;
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
    
    // Provider-aware properties
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.lastCacheUpdate = null;
    this.enableSemanticSearch = !!this.semanticSearch;
  }

  /**
   * Async factory method following Legion ResourceManager pattern
   */
  static async create(resourceManager, provider, options = {}) {
    if (!resourceManager?.initialized) {
      throw new Error('ProviderBasedToolRegistry requires initialized ResourceManager');
    }

    if (!provider) {
      throw new Error('ProviderBasedToolRegistry requires a provider instance');
    }

    console.log(`🚀 Creating Provider-Based Tool Registry with ${provider.constructor.name}...`);

    // Initialize semantic search if enabled and supported
    let semanticSearch = null;
    if (options.enableSemanticSearch !== false && provider.hasCapability?.('semantic_search')) {
      try {
        semanticSearch = await SemanticSearchProvider.create(resourceManager);
        await semanticSearch.connect();
        console.log('🔍 Semantic search enabled for tool registry');
      } catch (error) {
        console.warn('⚠️  Semantic search disabled:', error.message);
      }
    }

    const registry = new ProviderBasedToolRegistry({
      _factoryCall: true,
      resourceManager,
      provider,
      semanticSearch
    });

    await registry.initialize();
    return registry;
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.initialized) return;

    console.log('📋 Initializing Provider-Based Tool Registry...');

    try {
      // Ensure provider is connected
      if (!this.provider.connected) {
        await this.provider.connect();
      }

      // Load data from provider into cache
      await this.refreshCache();

      // Initialize semantic search integration
      if (this.semanticSearch && this.provider.hasCapability?.('semantic_search')) {
        await this.initializeSemanticSearch();
      }

      this.initialized = true;
      console.log(`✅ Provider-Based Tool Registry initialized with ${this.metadata.size} modules`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Provider-Based Tool Registry:', error);
      throw error;
    }
  }

  /**
   * Refresh cache from provider
   */
  async refreshCache() {
    console.log('🔄 Refreshing cache from provider...');

    // Clear existing cache
    this.metadata.clear();
    this.moduleCache.clear();
    this.toolCache.clear();
    this.providers.clear();
    this.instances.clear();

    // Load modules from provider
    const modules = await this.provider.listModules({ status: 'active' });
    console.log(`📦 Loading ${modules.length} modules from provider...`);

    for (const moduleDoc of modules) {
      // Create metadata entry
      const metadata = {
        name: moduleDoc.name,
        description: moduleDoc.description,
        version: moduleDoc.version,
        type: moduleDoc.type,
        path: moduleDoc.path,
        className: moduleDoc.className,
        tools: {},
        category: moduleDoc.category,
        tags: moduleDoc.tags || [],
        _id: moduleDoc._id
      };

      this.metadata.set(moduleDoc.name, metadata);

      // Create a provider-backed module provider
      const provider = this.createModuleProvider(moduleDoc);
      this.providers.set(moduleDoc.name, provider);
    }

    // Load tools and associate with modules
    const tools = await this.provider.listTools({ status: 'active' });
    console.log(`🔧 Loading ${tools.length} tools from provider...`);

    for (const toolDoc of tools) {
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

    this.lastCacheUpdate = Date.now();
    console.log('✅ Cache refreshed successfully');
  }

  /**
   * Initialize semantic search integration
   */
  async initializeSemanticSearch() {
    if (!this.semanticSearch || !this.provider.hasCapability?.('semantic_search')) {
      return;
    }

    console.log('🔍 Initializing semantic search integration...');

    try {
      // Get tools without embeddings
      const toolsWithoutEmbeddings = await this.provider.getToolsWithoutEmbeddings();
      
      if (toolsWithoutEmbeddings.length > 0) {
        console.log(`📝 Generating embeddings for ${toolsWithoutEmbeddings.length} tools...`);
        
        for (const tool of toolsWithoutEmbeddings) {
          await this.generateToolEmbedding(tool);
        }
      }

      console.log('✅ Semantic search integration initialized');
      
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
      
      // Update tool in provider
      await this.provider.updateToolEmbedding(
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

    // Save module to provider
    const moduleDoc = await this.provider.saveModule({
      name: moduleName,
      description: module.description || `${moduleName} module`,
      type: 'class',
      path: 'dynamic',
      status: 'active',
      category: this.inferModuleCategory(moduleName),
      tags: [moduleName]
    });

    // Save tools to provider
    for (const toolData of tools) {
      await this.provider.saveTool({
        ...toolData,
        moduleId: moduleDoc._id,
        moduleName: moduleName
      });

      // Generate embedding if semantic search is available
      if (this.semanticSearch && this.provider.hasCapability?.('semantic_search')) {
        setTimeout(() => this.generateToolEmbedding({
          _id: null,
          ...toolData
        }), 100);
      }
    }

    // Update cache
    const metadata = {
      name: moduleName,
      description: module.description || `${moduleName} module`,
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
   * Get tool by name (with provider lookup and caching)
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

    // Refresh cache if stale
    if (this.isCacheStale()) {
      await this.refreshCache();
    }

    let tool = null;
    
    if (!name.includes('.')) {
      // Search by tool name across all modules
      const toolDoc = await this.provider.getTool(name);
      if (toolDoc) {
        tool = await this.loadToolFromProvider(toolDoc);
      }
    } else {
      // Full module.tool name
      const [moduleName, toolName] = name.split('.');
      const toolDoc = await this.provider.getTool(toolName, moduleName);
      if (toolDoc) {
        tool = await this.loadToolFromProvider(toolDoc);
      }
    }

    if (tool) {
      this.toolCache.set(name, tool);
      this.trackUsage(name);
      
      // Record usage in provider if supported
      if (this.provider.hasCapability?.('usage_tracking')) {
        await this.provider.recordUsage({
          toolName: tool.name,
          moduleName: tool.moduleName,
          success: true,
          timestamp: new Date()
        });
      }
      
      return tool;
    }

    return null;
  }

  /**
   * Load tool from provider data
   */
  async loadToolFromProvider(toolDoc) {
    // Try to get from actual module instance first
    if (toolDoc.moduleName) {
      const moduleInstance = await this.getInstance(toolDoc.moduleName);
      
      if (moduleInstance && moduleInstance.getTool) {
        const tool = moduleInstance.getTool(toolDoc.name);
        if (tool) return tool;
      }
    }

    // Fallback: create provider-backed tool
    return {
      name: toolDoc.name,
      description: toolDoc.description,
      summary: toolDoc.summary,
      schema: toolDoc.inputSchema,
      inputSchema: toolDoc.inputSchema,
      outputSchema: toolDoc.outputSchema,
      examples: toolDoc.examples || [],
      moduleName: toolDoc.moduleName,
      category: toolDoc.category,
      tags: toolDoc.tags || [],
      execute: async (params) => {
        // Record usage
        if (this.provider.hasCapability?.('usage_tracking')) {
          await this.provider.recordUsage({
            toolName: toolDoc.name,
            moduleName: toolDoc.moduleName,
            success: true,
            timestamp: new Date(),
            context: { source: 'provider-backed' }
          });
        }
        
        return {
          success: true,
          message: `Provider-backed tool ${toolDoc.name} executed`,
          data: { toolName: toolDoc.name, params },
          source: 'provider'
        };
      }
    };
  }

  /**
   * Search tools with semantic capabilities
   */
  async searchTools(criteria) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (typeof criteria === 'string') {
      return this.searchToolsByText(criteria);
    }

    // Legacy criteria object support
    const results = [];
    
    if (criteria.capability) {
      return this.searchToolsByText(criteria.capability);
    }

    if (criteria.module) {
      const tools = await this.provider.listTools({ moduleName: criteria.module });
      return tools.map(t => `${t.moduleName}.${t.name}`);
    }

    return results;
  }

  /**
   * Search tools by text with semantic search
   */
  async searchToolsByText(searchText, options = {}) {
    const results = [];

    // Text-based search via provider
    const textResults = await this.provider.searchTools(searchText, {
      limit: options.limit || 20
    });

    for (const tool of textResults) {
      results.push(`${tool.moduleName}.${tool.name}`);
    }

    // Semantic search if available
    if (this.semanticSearch && this.provider.hasCapability?.('semantic_search') && options.enableSemanticSearch !== false) {
      try {
        const embedding = await this.semanticSearch.embeddingService.generateEmbedding(searchText);
        const semanticResults = await this.provider.findSimilarTools(embedding, {
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
    const tools = await this.provider.listTools({ status: 'active' });
    return tools.map(tool => `${tool.moduleName}.${tool.name}`);
  }

  /**
   * Get module instance
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
  // PROVIDER HELPER METHODS
  // ============================================================================

  /**
   * Create a module provider for provider data
   */
  createModuleProvider(moduleDoc) {
    return {
      name: moduleDoc.name,
      lazy: true,
      getMetadata: () => this.metadata.get(moduleDoc.name),
      getInstance: async () => {
        // Check cache first
        if (this.instances.has(moduleDoc.name)) {
          return this.instances.get(moduleDoc.name);
        }

        // Try to load actual module if possible
        let instance = null;
        
        try {
          if (moduleDoc.type === 'class' && moduleDoc.path !== 'dynamic') {
            instance = await this.loadClassModule(moduleDoc);
          } else {
            // Create provider-backed module
            instance = this.createProviderBackedModule(moduleDoc);
          }

          if (instance) {
            this.instances.set(moduleDoc.name, instance);
            this.moduleCache.set(moduleDoc.name, instance);
          }

        } catch (error) {
          console.warn(`⚠️  Failed to load module ${moduleDoc.name}:`, error.message);
          // Fallback to provider-backed module
          instance = this.createProviderBackedModule(moduleDoc);
        }

        return instance;
      }
    };
  }

  /**
   * Load class-based module
   */
  async loadClassModule(moduleDoc) {
    if (moduleDoc.path === 'dynamic') {
      return null; // Can't dynamically load
    }

    try {
      const ModuleClass = await import(moduleDoc.path);
      const instance = new (ModuleClass.default || ModuleClass)();
      return instance;
    } catch (error) {
      console.warn(`Could not dynamically load class module ${moduleDoc.name}:`, error.message);
      return null;
    }
  }

  /**
   * Create a provider-backed module when dynamic loading fails
   */
  createProviderBackedModule(moduleDoc) {
    const moduleMetadata = this.metadata.get(moduleDoc.name);
    
    return {
      name: moduleDoc.name,
      description: moduleDoc.description,
      
      getTools: () => {
        return Object.values(moduleMetadata.tools || {}).map(toolMeta => ({
          name: toolMeta.name,
          description: toolMeta.description,
          schema: toolMeta.inputSchema,
          inputSchema: toolMeta.inputSchema,
          execute: async (params) => {
            // Record usage in provider
            if (this.provider.hasCapability?.('usage_tracking')) {
              await this.provider.recordUsage({
                toolName: toolMeta.name,
                moduleName: moduleDoc.name,
                success: true,
                timestamp: new Date(),
                context: { source: 'provider-backed-module' }
              });
            }
            
            return {
              success: true,
              message: `Provider-backed tool ${toolMeta.name} executed`,
              data: { toolName: toolMeta.name, params },
              source: 'provider-module'
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
  // UTILITY METHODS
  // ============================================================================

  /**
   * Check if cache is stale
   */
  isCacheStale() {
    if (!this.lastCacheUpdate) return true;
    return (Date.now() - this.lastCacheUpdate) > this.cacheTimeout;
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
   * Invalidate caches
   */
  invalidateCaches() {
    this.toolIndex = null;
    this.capabilityMap = null;
    this.toolCache.clear();
    this.lastCacheUpdate = null;
  }

  /**
   * Get health status
   */
  async getHealthStatus() {
    const providerHealth = await this.provider.healthCheck();
    const providerStats = await this.provider.getStats();

    return {
      status: providerHealth.status || 'unknown',
      initialized: this.initialized,
      provider: {
        name: this.provider.constructor.name,
        capabilities: this.provider.getCapabilities?.() || [],
        health: providerHealth
      },
      cache: {
        modules: this.metadata.size,
        tools: this.toolCache.size,
        instances: this.instances.size,
        lastUpdate: this.lastCacheUpdate,
        isStale: this.isCacheStale()
      },
      semanticSearch: {
        enabled: !!this.semanticSearch,
        connected: this.semanticSearch?.connected || false
      },
      stats: providerStats
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up Provider-Based Tool Registry...');

    if (this.provider) {
      await this.provider.disconnect();
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
    console.log('✅ Provider-Based Tool Registry cleanup complete');
  }

  // ============================================================================
  // INFERENCE HELPERS (same as MongoDBToolRegistryProvider)
  // ============================================================================

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

  inferToolTags(toolName, description = '') {
    const tags = [];
    const text = `${toolName} ${description}`.toLowerCase();
    
    if (text.includes('file')) tags.push('file');
    if (text.includes('directory') || text.includes('folder')) tags.push('directory');
    if (text.includes('json')) tags.push('json');
    if (text.includes('command') || text.includes('bash')) tags.push('command');
    if (text.includes('search')) tags.push('search');
    if (text.includes('http') || text.includes('api')) tags.push('network');
    
    return [...new Set(tags)];
  }

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

  // Backward compatibility methods
  hasProvider(name) { return this.providers.has(name); }
  listProviders() { return Array.from(this.providers.keys()); }
  hasInstance(name) { return this.instances.has(name); }
  async getUsageStats() { return Object.fromEntries(this.usageStats); }
  async getAllMetadata() { 
    const stats = await this.provider.getStats();
    return {
      modules: Array.from(this.metadata.values()),
      totalTools: stats.tools || 0,
      capabilities: this.provider.getCapabilities?.() || []
    };
  }
}