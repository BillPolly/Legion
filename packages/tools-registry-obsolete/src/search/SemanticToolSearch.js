/**
 * SemanticToolSearch - Simple semantic search for tools
 * 
 * Takes a query, searches stored tool embeddings, returns relevant tools.
 */

export class SemanticToolSearch {
  constructor(dependencies = {}) {
    this.semanticSearchProvider = dependencies.semanticSearchProvider;
    this.mongoProvider = dependencies.mongoProvider;
    this.collectionName = dependencies.collectionName || 'legion_tools';
  }

  /**
   * Create SemanticToolSearch with local Nomic embeddings
   */
  static async createForTools(resourceManager, options = {}) {
    console.log('🔧 Creating SemanticToolSearch with Nomic embeddings');
    
    // Import local services
    const { LocalEmbeddingService } = await import('./LocalEmbeddingService.js');
    const { QdrantVectorStore } = await import('./QdrantVectorStore.js');
    
    // Create embedding service
    const embeddingService = new LocalEmbeddingService();
    await embeddingService.initialize();
    
    // Create vector store
    const vectorStore = new QdrantVectorStore({
      url: resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333',
      apiKey: resourceManager.get('env.QDRANT_API_KEY')
    }, resourceManager);
    
    // Get MongoDB provider
    const { StorageProvider } = await import('@legion/storage');
    const storageProvider = await StorageProvider.create(resourceManager);
    const mongoProvider = storageProvider.getProvider('mongodb');
    
    // Create simple search provider
    const semanticSearchProvider = {
      embeddingService,
      vectorStore,
      
      async semanticSearch(collection, query, options = {}) {
        // Generate embedding for the query
        const queryEmbedding = await embeddingService.embed(query);
        
        // Search using the vector store
        return await vectorStore.search(collection, queryEmbedding, {
          limit: options.limit || 20,
          threshold: options.threshold || 0,
          filter: options.filter,
          includeVectors: options.includeMetadata
        });
      }
    };
    
    return new SemanticToolSearch({
      semanticSearchProvider,
      mongoProvider,
      collectionName: options.collectionName || 'legion_tools'
    });
  }

  /**
   * Find relevant tools for a query
   */
  async findRelevantTools(query, options = {}) {
    const {
      limit = 20,
      minScore = 0,
      categories = null
    } = options;

    // Search vector store
    const searchResults = await this.semanticSearchProvider.semanticSearch(
      this.collectionName,
      query,
      {
        limit,
        threshold: minScore,
        filter: this.buildSearchFilter(categories)
      }
    );

    // Process and enrich results
    const tools = await this.processSearchResults(searchResults, query);
    
    return {
      tools: tools.slice(0, limit),
      metadata: {
        totalFound: tools.length,
        searchQuery: query
      }
    };
  }

  /**
   * Process search results and get full tool data from MongoDB
   */
  async processSearchResults(searchResults) {
    const toolGroups = new Map();
    
    // Group results by tool ID
    for (const result of searchResults) {
      const payload = result.document || result.payload || result;
      const toolName = payload.toolName;
      const similarity = result._similarity || result.score || 0;
      
      if (!toolName) continue;
      
      if (!toolGroups.has(toolName)) {
        toolGroups.set(toolName, []);
      }
      
      toolGroups.get(toolName).push({ similarity, result });
    }
    
    // Get full tool data for each group
    const tools = [];
    for (const [toolName, results] of toolGroups) {
      try {
        // Get best similarity score
        const bestScore = Math.max(...results.map(r => r.similarity));
        
        // Get full tool data from MongoDB
        const fullTool = await this.mongoProvider.findOne('tools', { name: toolName });
        if (!fullTool) continue;
        
        tools.push({
          name: fullTool.name,
          description: fullTool.description,
          category: fullTool.category || 'general',
          tags: fullTool.tags || [],
          relevanceScore: bestScore,
          metadata: fullTool
        });
      } catch (error) {
        console.warn(`Error processing tool ${toolName}:`, error.message);
      }
    }
    
    // Sort by relevance
    tools.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    return tools;
  }

  /**
   * Build search filter (currently minimal)
   */
  buildSearchFilter(categories) {
    return {}; // No filtering for now since Qdrant filter is complex
  }
}