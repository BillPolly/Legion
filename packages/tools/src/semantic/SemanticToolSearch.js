/**
 * Semantic Tool Search
 * 
 * Integrates semantic search capabilities with the Tool Registry.
 * Provides natural language tool discovery, similarity search,
 * and intelligent tool recommendations.
 */

import { SemanticSearchProvider } from '@legion/semantic-search';

export class SemanticToolSearch {
  /**
   * Private constructor - use create() factory method
   */
  constructor(dependencies) {
    if (!dependencies?._factoryCall) {
      throw new Error('SemanticToolSearch must be created using create() factory method');
    }

    this.resourceManager = dependencies.resourceManager;
    this.semanticSearch = dependencies.semanticSearch;
    this.provider = dependencies.provider;
    this.initialized = false;
    
    // Configuration
    this.config = {
      embeddingBatchSize: 50,
      similarityThreshold: 0.7,
      maxResults: 20,
      enableCaching: true,
      ...dependencies.config
    };
    
    // Collections in semantic search
    this.TOOLS_COLLECTION = 'tools';
    this.MODULES_COLLECTION = 'modules';
  }

  /**
   * Async factory method
   */
  static async create(resourceManager, provider, options = {}) {
    if (!resourceManager?.initialized) {
      throw new Error('SemanticToolSearch requires initialized ResourceManager');
    }

    if (!provider) {
      throw new Error('SemanticToolSearch requires a tool registry provider');
    }

    console.log('🔍 Creating Semantic Tool Search...');

    // Initialize semantic search provider
    let semanticSearch = null;
    try {
      semanticSearch = await SemanticSearchProvider.create(resourceManager);
      await semanticSearch.connect();
    } catch (error) {
      console.warn('⚠️  Semantic search not available:', error.message);
      throw error;
    }

    const search = new SemanticToolSearch({
      _factoryCall: true,
      resourceManager,
      semanticSearch,
      provider,
      config: options
    });

    await search.initialize();
    return search;
  }

  /**
   * Initialize semantic search integration
   */
  async initialize() {
    if (this.initialized) return;

    console.log('📋 Initializing Semantic Tool Search...');

    try {
      // Ensure semantic search collections exist
      await this.ensureCollections();

      // Index existing tools if needed
      await this.indexExistingTools();

      this.initialized = true;
      console.log('✅ Semantic Tool Search initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Semantic Tool Search:', error);
      throw error;
    }
  }

  /**
   * Ensure semantic search collections exist
   */
  async ensureCollections() {
    try {
      // Get embedding dimensions from the semantic search provider
      const metadata = this.semanticSearch.getMetadata();
      const dimensions = metadata.embeddingDimensions || 1536; // fallback to OpenAI default
      
      console.log(`📐 Using ${dimensions}-dimensional vectors for ${metadata.embeddingService} embeddings`);
      
      // Create tools collection if it doesn't exist
      await this.semanticSearch.createCollection(this.TOOLS_COLLECTION, {
        description: 'Tool definitions with semantic embeddings',
        dimension: dimensions
      });

      // Create modules collection if it doesn't exist
      await this.semanticSearch.createCollection(this.MODULES_COLLECTION, {
        description: 'Module definitions with semantic embeddings',
        dimension: dimensions
      });

    } catch (error) {
      console.warn('Collections might already exist:', error.message);
    }
  }

  /**
   * Index existing tools from provider
   */
  async indexExistingTools() {
    console.log('📝 Indexing existing tools for semantic search...');

    try {
      // Get tools without embeddings from provider
      let toolsToIndex = [];
      
      if (this.provider.hasCapability?.('semantic_search')) {
        toolsToIndex = await this.provider.getToolsWithoutEmbeddings();
      } else {
        // For providers without semantic search capability, get all tools
        toolsToIndex = await this.provider.listTools();
      }

      if (toolsToIndex.length === 0) {
        console.log('✅ All tools already indexed');
        return;
      }

      console.log(`📝 Indexing ${toolsToIndex.length} tools...`);

      // Index tools in batches
      const batchSize = this.config.embeddingBatchSize;
      for (let i = 0; i < toolsToIndex.length; i += batchSize) {
        const batch = toolsToIndex.slice(i, i + batchSize);
        await this.indexToolsBatch(batch);
        
        // Small delay to avoid overwhelming the API
        if (i + batchSize < toolsToIndex.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log('✅ Tool indexing complete');

    } catch (error) {
      console.warn('Tool indexing failed:', error.message);
    }
  }

  /**
   * Index a batch of tools
   */
  async indexToolsBatch(tools) {
    const documents = [];

    for (const tool of tools) {
      try {
        // Create searchable text
        const searchText = this.createToolSearchText(tool);

        // Create document for semantic search
        const document = {
          id: tool._id?.toString() || `${tool.moduleName}.${tool.name}`,
          content: searchText,
          metadata: {
            toolName: tool.name,
            moduleName: tool.moduleName,
            category: tool.category,
            tags: tool.tags || [],
            description: tool.description,
            summary: tool.summary
          }
        };

        documents.push(document);

      } catch (error) {
        console.warn(`Failed to prepare tool ${tool.name} for indexing:`, error.message);
      }
    }

    if (documents.length > 0) {
      // Insert into semantic search
      await this.semanticSearch.insert(this.TOOLS_COLLECTION, documents);

      // Update provider with embeddings if supported
      if (this.provider.hasCapability?.('semantic_search')) {
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          const tool = tools[i];
          
          try {
            // Get the embedding that was generated during insert
            const results = await this.semanticSearch.semanticSearch(
              this.TOOLS_COLLECTION,
              doc.content,
              { limit: 1, filters: { id: doc.id } }
            );

            if (results.length > 0 && results[0]._vector) {
              await this.provider.updateToolEmbedding(
                tool._id,
                results[0]._vector,
                'text-embedding-3-small'
              );
            }
          } catch (error) {
            console.warn(`Failed to update embedding for tool ${tool.name}:`, error.message);
          }
        }
      }
    }
  }

  /**
   * Create searchable text from tool metadata
   */
  createToolSearchText(tool) {
    const parts = [
      tool.name,
      tool.description || '',
      tool.summary || '',
      tool.category || '',
      ...(tool.tags || []),
      tool.moduleName || '',
      
      // Include schema information if available
      tool.inputSchema ? `Input: ${this.schemaToText(tool.inputSchema)}` : '',
      tool.outputSchema ? `Output: ${this.schemaToText(tool.outputSchema)}` : '',
      
      // Include examples if available
      ...(tool.examples || []).map(ex => `Example: ${ex.title || ''} ${ex.description || ''}`)
    ];

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Convert schema object to searchable text
   */
  schemaToText(schema) {
    if (typeof schema === 'string') return schema;
    if (!schema || typeof schema !== 'object') return '';

    try {
      // Extract meaningful text from JSON schema
      const parts = [];
      
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          parts.push(key);
          if (prop.description) parts.push(prop.description);
          if (prop.type) parts.push(prop.type);
        }
      }
      
      if (schema.description) parts.push(schema.description);
      
      return parts.join(' ');
    } catch (error) {
      return JSON.stringify(schema);
    }
  }

  // ============================================================================
  // SEMANTIC SEARCH METHODS
  // ============================================================================

  /**
   * Search tools using natural language
   */
  async searchTools(query, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticToolSearch not initialized');
    }

    const searchOptions = {
      limit: options.limit || this.config.maxResults,
      threshold: options.threshold || this.config.similarityThreshold,
      ...options
    };

    console.log(`🔍 Semantic search for tools: "${query}"`);

    try {
      // Perform semantic search
      const results = await this.semanticSearch.semanticSearch(
        this.TOOLS_COLLECTION,
        query,
        searchOptions
      );

      console.log(`📊 Found ${results.length} semantically similar tools`);

      // Convert results to tool format
      const tools = [];
      for (const result of results) {
        try {
          // Get full tool data from provider
          const toolData = await this.provider.getTool(
            result.metadata.toolName,
            result.metadata.moduleName
          );

          if (toolData) {
            tools.push({
              ...toolData,
              _similarity: result._similarity || result.score,
              _searchRank: tools.length + 1
            });
          }
        } catch (error) {
          console.warn(`Failed to get tool data for ${result.metadata.toolName}:`, error.message);
        }
      }

      return tools;

    } catch (error) {
      console.error('Semantic tool search failed:', error);
      throw error;
    }
  }

  /**
   * Find similar tools to a given tool
   */
  async findSimilarTools(toolName, moduleName, options = {}) {
    const searchOptions = {
      limit: options.limit || 10,
      threshold: options.threshold || 0.6,
      ...options
    };

    // Get the reference tool
    const referenceTool = await this.provider.getTool(toolName, moduleName);
    if (!referenceTool) {
      throw new Error(`Tool not found: ${moduleName}.${toolName}`);
    }

    // Create search text from the reference tool
    const searchText = this.createToolSearchText(referenceTool);

    // Search for similar tools
    const results = await this.searchTools(searchText, searchOptions);

    // Filter out the reference tool itself
    return results.filter(tool => 
      !(tool.name === toolName && tool.moduleName === moduleName)
    );
  }

  /**
   * Get tool recommendations for a task description
   */
  async recommendToolsForTask(taskDescription, options = {}) {
    const searchOptions = {
      limit: options.limit || 15,
      threshold: options.threshold || 0.6,
      ...options
    };

    console.log(`🎯 Getting tool recommendations for: "${taskDescription}"`);

    // Enhance the task description with common tool patterns
    const enhancedQuery = this.enhanceTaskQuery(taskDescription);

    // Search for relevant tools
    const tools = await this.searchTools(enhancedQuery, searchOptions);

    // Group by category and add reasoning
    const recommendations = this.groupAndRankRecommendations(tools, taskDescription);

    return {
      taskDescription,
      totalRecommendations: recommendations.length,
      recommendations,
      searchQuery: enhancedQuery
    };
  }

  /**
   * Enhance task query with common patterns
   */
  enhanceTaskQuery(taskDescription) {
    const enhancements = [];
    const desc = taskDescription.toLowerCase();

    // Add operation keywords
    if (desc.includes('read') || desc.includes('load') || desc.includes('get')) {
      enhancements.push('read get fetch load');
    }
    if (desc.includes('write') || desc.includes('save') || desc.includes('create')) {
      enhancements.push('write save create store');
    }
    if (desc.includes('delete') || desc.includes('remove')) {
      enhancements.push('delete remove unlink');
    }
    if (desc.includes('search') || desc.includes('find')) {
      enhancements.push('search find query lookup');
    }
    if (desc.includes('file')) {
      enhancements.push('file filesystem directory path');
    }
    if (desc.includes('api') || desc.includes('http')) {
      enhancements.push('http api request response');
    }
    if (desc.includes('json') || desc.includes('data')) {
      enhancements.push('json data parse stringify');
    }

    return [taskDescription, ...enhancements].join(' ');
  }

  /**
   * Group and rank recommendations
   */
  groupAndRankRecommendations(tools, taskDescription) {
    const groups = new Map();

    // Group by category
    for (const tool of tools) {
      const category = tool.category || 'other';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category).push(tool);
    }

    // Create recommendations with reasoning
    const recommendations = [];
    
    for (const [category, categoryTools] of groups) {
      // Sort by similarity within category
      categoryTools.sort((a, b) => (b._similarity || 0) - (a._similarity || 0));

      for (const tool of categoryTools.slice(0, 3)) { // Top 3 per category
        recommendations.push({
          tool: {
            name: tool.name,
            moduleName: tool.moduleName,
            description: tool.description,
            category: tool.category,
            tags: tool.tags
          },
          similarity: tool._similarity || 0,
          category,
          reasoning: this.generateRecommendationReasoning(tool, taskDescription),
          rank: recommendations.length + 1
        });
      }
    }

    // Final sort by similarity
    recommendations.sort((a, b) => b.similarity - a.similarity);

    return recommendations.slice(0, 10); // Top 10 overall
  }

  /**
   * Generate reasoning for why a tool was recommended
   */
  generateRecommendationReasoning(tool, taskDescription) {
    const reasons = [];
    const desc = taskDescription.toLowerCase();
    const toolDesc = tool.description?.toLowerCase() || '';
    const toolName = tool.name.toLowerCase();

    // Check for direct matches
    if (toolName.includes(desc) || desc.includes(toolName)) {
      reasons.push('Tool name matches task description');
    }

    // Check for operation matches
    const operations = ['read', 'write', 'create', 'delete', 'search', 'find', 'get', 'set'];
    for (const op of operations) {
      if (desc.includes(op) && (toolName.includes(op) || toolDesc.includes(op))) {
        reasons.push(`Supports ${op} operations`);
        break;
      }
    }

    // Check for domain matches
    if (desc.includes('file') && (toolName.includes('file') || toolDesc.includes('file'))) {
      reasons.push('File system operations');
    }
    if (desc.includes('json') && (toolName.includes('json') || toolDesc.includes('json'))) {
      reasons.push('JSON data handling');
    }
    if (desc.includes('http') || desc.includes('api')) {
      if (toolName.includes('http') || toolDesc.includes('http') || toolDesc.includes('api')) {
        reasons.push('HTTP/API operations');
      }
    }

    // Check tags
    if (tool.tags) {
      for (const tag of tool.tags) {
        if (desc.includes(tag.toLowerCase())) {
          reasons.push(`Tagged for ${tag}`);
        }
      }
    }

    // Default reasoning
    if (reasons.length === 0) {
      reasons.push(`High semantic similarity (${Math.round((tool._similarity || 0) * 100)}%)`);
    }

    return reasons.join(', ');
  }

  // ============================================================================
  // INDEXING METHODS
  // ============================================================================

  /**
   * Index a new tool
   */
  async indexTool(tool) {
    if (!this.initialized) return;

    try {
      const searchText = this.createToolSearchText(tool);
      const document = {
        id: tool._id?.toString() || `${tool.moduleName}.${tool.name}`,
        content: searchText,
        metadata: {
          toolName: tool.name,
          moduleName: tool.moduleName,
          category: tool.category,
          tags: tool.tags || [],
          description: tool.description,
          summary: tool.summary
        }
      };

      await this.semanticSearch.insert(this.TOOLS_COLLECTION, [document]);
      console.log(`✅ Indexed tool: ${tool.moduleName}.${tool.name}`);

    } catch (error) {
      console.warn(`Failed to index tool ${tool.name}:`, error.message);
    }
  }

  /**
   * Remove tool from index
   */
  async removeToolFromIndex(toolName, moduleName) {
    if (!this.initialized) return;

    try {
      const toolId = `${moduleName}.${toolName}`;
      await this.semanticSearch.delete(this.TOOLS_COLLECTION, { id: toolId });
      console.log(`✅ Removed from index: ${toolId}`);

    } catch (error) {
      console.warn(`Failed to remove tool from index: ${toolName}`, error.message);
    }
  }

  /**
   * Reindex all tools
   */
  async reindexAllTools() {
    if (!this.initialized) {
      throw new Error('SemanticToolSearch not initialized');
    }

    console.log('🔄 Reindexing all tools...');

    try {
      // Clear existing index
      await this.semanticSearch.delete(this.TOOLS_COLLECTION, {});

      // Get all tools from provider
      const allTools = await this.provider.listTools();

      // Index in batches
      await this.indexToolsBatch(allTools);

      console.log(`✅ Reindexed ${allTools.length} tools`);

    } catch (error) {
      console.error('Failed to reindex tools:', error);
      throw error;
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get search statistics
   */
  async getSearchStats() {
    if (!this.initialized) {
      return { error: 'Not initialized' };
    }

    try {
      const toolsCount = await this.semanticSearch.count(this.TOOLS_COLLECTION);
      const modulesCount = await this.semanticSearch.count(this.MODULES_COLLECTION);

      return {
        toolsIndexed: toolsCount,
        modulesIndexed: modulesCount,
        collections: [this.TOOLS_COLLECTION, this.MODULES_COLLECTION],
        config: {
          threshold: this.config.similarityThreshold,
          maxResults: this.config.maxResults,
          batchSize: this.config.embeddingBatchSize
        }
      };

    } catch (error) {
      return {
        error: error.message,
        toolsIndexed: 0,
        modulesIndexed: 0
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const isConnected = this.semanticSearch?.connected || false;
      const stats = await this.getSearchStats();

      return {
        status: isConnected && this.initialized ? 'healthy' : 'degraded',
        initialized: this.initialized,
        connected: isConnected,
        stats
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        initialized: this.initialized,
        connected: false
      };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('🧹 Cleaning up Semantic Tool Search...');
    
    if (this.semanticSearch) {
      await this.semanticSearch.disconnect();
    }

    this.initialized = false;
    console.log('✅ Semantic Tool Search cleanup complete');
  }
}