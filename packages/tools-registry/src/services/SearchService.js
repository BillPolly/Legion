/**
 * SearchService - Single Responsibility for Search Operations
 * 
 * Handles only search-related operations:
 * - Text search for tools
 * - Semantic/vector search
 * - Similar tool finding
 * - Perspective generation and embedding
 * 
 * Clean Architecture: Application Layer Service
 * Depends only on abstractions, not concretions
 */

export class SearchService {
  constructor(dependencies) {
    // Dependency Inversion: Depend on abstractions
    this.textSearch = dependencies.textSearch;
    this.semanticSearch = dependencies.semanticSearch;
    this.perspectiveService = dependencies.perspectiveService;
    this.embeddingService = dependencies.embeddingService;
    this.vectorStore = dependencies.vectorStore;
    this.toolRepository = dependencies.toolRepository;
    this.eventBus = dependencies.eventBus;
  }

  /**
   * Search tools using text search
   * Single responsibility: Text-based tool search
   */
  async searchTools(query, options = {}) {
    if (!query?.trim()) {
      return [];
    }

    const searchResults = await this.textSearch.search(query, {
      ...options,
      fields: ['name', 'description', 'keywords'],
      boost: { name: 2.0, description: 1.0, keywords: 1.5 }
    });

    this.eventBus.emit('search:text-performed', {
      query,
      resultCount: searchResults.length
    });

    return searchResults.map(result => ({
      name: result.name,
      description: result.description,
      moduleName: result.moduleName,
      score: result.score,
      matchedFields: result.matchedFields
    }));
  }

  /**
   * Search tools using semantic/vector search
   * Single responsibility: Semantic tool search
   */
  async semanticSearch(query, options = {}) {
    if (!query?.trim()) {
      return [];
    }

    const { threshold = 0.7, limit = 10 } = options;

    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const vectorResults = await this.vectorStore.similaritySearch(
        queryEmbedding,
        { threshold, limit }
      );

      const enrichedResults = await Promise.all(
        vectorResults.map(async (result) => {
          const toolData = await this.toolRepository.findById(result.id);
          return {
            ...toolData,
            similarity: result.similarity,
            perspective: result.metadata?.perspective
          };
        })
      );

      this.eventBus.emit('search:semantic-performed', {
        query,
        resultCount: enrichedResults.length,
        averageSimilarity: enrichedResults.reduce((sum, r) => sum + r.similarity, 0) / enrichedResults.length
      });

      return enrichedResults;
    } catch (error) {
      this.eventBus.emit('search:semantic-failed', {
        query,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Find similar tools to a given tool
   * Single responsibility: Tool similarity discovery
   */
  async findSimilarTools(toolName, options = {}) {
    const { limit = 5, threshold = 0.8 } = options;

    const targetTool = await this.toolRepository.findByName(toolName);
    if (!targetTool.embedding) {
      throw new Error(`Tool ${toolName} has no embedding for similarity search`);
    }

    const similarTools = await this.vectorStore.similaritySearch(
      targetTool.embedding,
      { threshold, limit: limit + 1 } // +1 to exclude self
    );

    // Filter out the original tool
    const filtered = similarTools.filter(tool => tool.id !== targetTool.id);

    this.eventBus.emit('search:similar-tools-found', {
      toolName,
      similarCount: filtered.length
    });

    return filtered.map(result => ({
      name: result.name,
      description: result.description,
      moduleName: result.moduleName,
      similarity: result.similarity
    }));
  }

  /**
   * Generate perspectives for tools
   * Single responsibility: Perspective generation coordination
   */
  async generatePerspectives(options = {}) {
    const { moduleFilter, forceRegenerate = false } = options;
    
    const tools = await this.toolRepository.listAll({ module: moduleFilter });
    const results = {
      processed: 0,
      generated: 0,
      skipped: 0,
      errors: []
    };

    for (const tool of tools) {
      try {
        results.processed++;

        if (!forceRegenerate && tool.perspectives?.length > 0) {
          results.skipped++;
          continue;
        }

        const perspectives = await this.perspectiveService.generatePerspectives({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema
        });

        await this.toolRepository.updateToolPerspectives(tool.id, perspectives);
        results.generated++;

        this.eventBus.emit('perspectives:generated', {
          toolName: tool.name,
          perspectiveCount: perspectives.length
        });

      } catch (error) {
        results.errors.push({
          toolName: tool.name,
          error: error.message
        });
      }
    }

    this.eventBus.emit('perspectives:batch-generated', results);
    return results;
  }

  /**
   * Generate embeddings for perspectives
   * Single responsibility: Embedding generation coordination
   */
  async generateEmbeddings(options = {}) {
    const { batchSize = 10, filters = {} } = options;
    
    const perspectivesQuery = {
      ...filters,
      hasEmbedding: false
    };
    
    const perspectives = await this.toolRepository.getPerspectivesWithoutEmbeddings(perspectivesQuery);
    const results = {
      processed: 0,
      embedded: 0,
      errors: []
    };

    for (let i = 0; i < perspectives.length; i += batchSize) {
      const batch = perspectives.slice(i, i + batchSize);
      
      for (const perspective of batch) {
        try {
          results.processed++;

          const embedding = await this.embeddingService.generateEmbedding(
            perspective.description
          );

          await this.toolRepository.updatePerspectiveEmbedding(
            perspective.id,
            embedding
          );

          results.embedded++;

        } catch (error) {
          results.errors.push({
            perspectiveId: perspective.id,
            toolName: perspective.toolName,
            error: error.message
          });
        }
      }

      this.eventBus.emit('embeddings:batch-processed', {
        batchNumber: Math.floor(i / batchSize) + 1,
        processed: results.processed,
        total: perspectives.length
      });
    }

    this.eventBus.emit('embeddings:generation-complete', results);
    return results;
  }

  /**
   * Index vectors in vector store
   * Single responsibility: Vector indexing coordination
   */
  async indexVectors(options = {}) {
    const { batchSize = 100 } = options;
    
    const perspectivesWithEmbeddings = await this.toolRepository.getPerspectivesWithEmbeddings();
    const results = {
      indexed: 0,
      errors: []
    };

    for (let i = 0; i < perspectivesWithEmbeddings.length; i += batchSize) {
      const batch = perspectivesWithEmbeddings.slice(i, i + batchSize);
      
      try {
        await this.vectorStore.indexBatch(batch.map(p => ({
          id: p.id,
          vector: p.embedding,
          metadata: {
            toolName: p.toolName,
            perspective: p.perspective,
            moduleName: p.moduleName
          }
        })));

        results.indexed += batch.length;

        this.eventBus.emit('vectors:batch-indexed', {
          batchNumber: Math.floor(i / batchSize) + 1,
          indexed: results.indexed,
          total: perspectivesWithEmbeddings.length
        });

      } catch (error) {
        results.errors.push({
          batchStart: i,
          batchSize: batch.length,
          error: error.message
        });
      }
    }

    this.eventBus.emit('vectors:indexing-complete', results);
    return results;
  }

  /**
   * Get search statistics
   * Single responsibility: Search metrics
   */
  async getSearchStatistics() {
    try {
      // Fallback implementation until proper repository pattern is implemented
      return {
        vectorsIndexed: 0,
        perspectivesGenerated: 0,
        perspectivesWithEmbeddings: 0,
        averageEmbeddingDimensions: 384 // Default for all-MiniLM-L6-v2
      };
    } catch (error) {
      return {
        vectorsIndexed: 0,
        perspectivesGenerated: 0,
        perspectivesWithEmbeddings: 0,
        averageEmbeddingDimensions: 384
      };
    }
  }

  /**
   * Test semantic search functionality
   * Single responsibility: Search system validation
   */
  async testSemanticSearch(queries = null, options = {}) {
    const testQueries = queries || [
      'file operations',
      'data processing',
      'network communication',
      'user interface'
    ];

    const results = {
      totalQueries: testQueries.length,
      successfulQueries: 0,
      results: [],
      errors: []
    };

    for (const query of testQueries) {
      try {
        const searchResults = await this.semanticSearch(query, {
          limit: 3,
          threshold: 0.5
        });

        results.results.push({
          query,
          resultCount: searchResults.length,
          topResult: searchResults[0] || null
        });

        if (searchResults.length > 0) {
          results.successfulQueries++;
        }

      } catch (error) {
        results.errors.push({
          query,
          error: error.message
        });
      }
    }

    this.eventBus.emit('search:test-complete', results);
    return results;
  }
}