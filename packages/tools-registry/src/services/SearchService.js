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
    this.semanticSearchEngine = dependencies.semanticSearch; // FIXED: Don't overwrite method name
    this.perspectiveService = dependencies.perspectiveService;
    this.embeddingService = dependencies.embeddingService;
    this.vectorStore = dependencies.vectorStore;
    this.toolRepository = dependencies.toolRepository;
    this.moduleService = dependencies.moduleService;
    this.toolService = dependencies.toolService; // Access to ToolService for getting Tool objects
    this.eventBus = dependencies.eventBus;
    this.logger = dependencies.logger || { verbose: () => {} }; // Add logger with fallback
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

    // Return result records with Tool objects
    const results = [];
    
    for (const result of searchResults) {
      if (result.name) {
        try {
          // Get the actual Tool object instance
          const tool = await this.toolService.getTool(result.name);
          
          if (tool) {
            // Create result record with Tool object
            results.push({
              tool: tool,
              score: result.score,
              matchedFields: result.matchedFields,
              name: tool.name
            });
          }
        } catch (error) {
          // Skip tools that can't be loaded
          console.warn(`Failed to load tool for ${result.name}:`, error.message);
        }
      }
    }
    
    return results;
  }

  /**
   * Search tools using semantic/vector search
   * Single responsibility: Semantic tool search
   * Returns only IDs and metadata - enrichment done at higher level
   */
  async semanticSearch(query, options = {}) {
    if (!query?.trim()) {
      return [];
    }

    const { threshold = 0.7, limit = null } = options;

    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const vectorResults = await this.vectorStore.search(
        queryEmbedding,
        { threshold, limit }
      );

      // Return result records with Tool objects
      const results = [];
      
      for (const result of vectorResults) {
        const toolId = result.metadata?.toolId;
        if (toolId) {
          try {
            // Extract tool name from toolId (format: "ModuleName:toolName")
            const [moduleName, toolName] = toolId.split(':');
            
            if (toolName) {
              // Get the actual Tool object instance
              const tool = await this.toolService.getTool(toolName);
              
              if (tool) {
                // Create result record with Tool object
                results.push({
                  tool: tool,
                  perspectiveId: result.id,
                  perspectiveText: result.metadata?.content || '',
                  perspectiveType: result.metadata?.perspectiveType || '',
                  confidence: result.score,
                  name: tool.name
                });
              }
            }
          } catch (error) {
            // Skip tools that can't be loaded
            console.warn(`Failed to load tool for ${toolId}:`, error.message);
          }
        }
      }

      this.eventBus.emit('search:semantic-performed', {
        query,
        resultCount: results.length,
        averageConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
      });

      return results;
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
    const { limit = null, threshold = 0.8 } = options;

    const targetTool = await this.toolRepository.findByName(toolName);
    if (!targetTool.embedding) {
      throw new Error(`Tool ${toolName} has no embedding for similarity search`);
    }

    const similarTools = await this.vectorStore.search(
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
    console.log('[SearchService] generatePerspectives called with options:', options);
    const { moduleFilter, forceRegenerate = false, dryRun = false } = options;
    
    console.log('[SearchService] toolRepository exists:', !!this.toolRepository);
    console.log('[SearchService] toolRepository type:', this.toolRepository?.constructor?.name);
    
    // WORKAROUND: Instead of getting tools from database (which is empty),
    // get tools from the loaded modules via the module service
    console.log('[SearchService] Attempting to get tools from loaded modules...');
    
    let tools = [];
    try {
      // Try database first (original approach)
      tools = await this.toolRepository.listTools({ module: moduleFilter });
      console.log('[SearchService] Got tools from database:', tools?.length || 0);
      
      if (!tools || tools.length === 0) {
        console.log('[SearchService] Database empty, trying in-memory registry...');
        
        // FALLBACK: Get tools from in-memory loaded modules
        // We need access to module service to get this
        if (this.moduleService) {
          const moduleStats = await this.moduleService.getModuleStatistics();
          console.log('[SearchService] Loaded modules:', moduleStats.loadedModules?.length || 0);
          
          tools = [];
          for (const moduleName of moduleStats.loadedModules || []) {
            try {
              const moduleInstance = await this.moduleService.getModule(moduleName);
              const moduleTools = moduleInstance.getTools();
              
              // Convert tool instances to tool metadata
              for (const tool of moduleTools) {
                tools.push({
                  name: tool.name,
                  description: tool.description,
                  inputSchema: tool.inputSchema,
                  outputSchema: tool.outputSchema,
                  category: tool.category,
                  tags: tool.tags,
                  moduleName: moduleName
                });
              }
            } catch (error) {
              console.log(`[SearchService] Error getting tools from ${moduleName}:`, error.message);
            }
          }
          
          console.log(`[SearchService] Got ${tools.length} tools from in-memory modules`);
        }
      }
    } catch (error) {
      console.log('[SearchService] Error accessing tools:', error.message);
      tools = [];
    }
    const results = {
      processed: 0,
      generated: 0,
      skipped: 0,
      errors: []
    };

    // Respect the limit parameter - only process specified number of tools
    const toolsToProcess = options.limit ? tools.slice(0, options.limit) : tools;
    console.log(`[SearchService] Processing ${toolsToProcess.length} tools (limit: ${options.limit || 'none'})`);

    for (const tool of toolsToProcess) {
      try {
        results.processed++;
        console.log(`[SearchService] Processing tool: ${tool.name}`);

        if (!forceRegenerate && tool.perspectives?.length > 0) {
          console.log(`[SearchService] Skipping ${tool.name} - already has perspectives`);
          results.skipped++;
          continue;
        }

        console.log(`[SearchService] Generating perspectives for: ${tool.name}`);
        
        // Skip actual generation in dry run mode
        let perspectives;
        if (dryRun) {
          console.log(`[SearchService] DRY RUN - Skipping actual perspective generation for ${tool.name}`);
          perspectives = []; // Simulate empty perspectives in dry run
        } else {
          perspectives = await this.perspectiveService.generatePerspectivesForTool(tool.name, {
            forceRegenerate: true
          });
        }
        
        console.log(`[SearchService] Generated ${perspectives?.length || 0} perspectives for ${tool.name}`);

        if (perspectives && perspectives.length > 0) {
          await this.toolRepository.saveToolPerspectives(perspectives);
          results.generated++;
          console.log(`[SearchService] Saved perspectives for ${tool.name}`);
        } else {
          console.log(`[SearchService] No perspectives generated for ${tool.name}`);
        }

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
    
    // Add success flag for dry run mode
    if (dryRun) {
      return { ...results, success: true, dryRun: true };
    }
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
   * Load vectors from perspectives into vector store (with clear option)
   * Single responsibility: Vector loading with clear-first behavior
   */
  async loadVectors(options = {}) {
    const { batchSize = 100, clearFirst = true, verbose = false } = options;
    
    const results = {
      loaded: 0,
      cleared: 0,
      failed: 0,
      errors: []
    };

    // Clear vector store first if requested (default behavior)
    if (clearFirst && this.vectorStore) {
      try {
        const clearedCount = await this.vectorStore.clear();
        results.cleared = clearedCount;
        if (verbose) {
          console.log(`🧹 Cleared ${clearedCount} existing vectors`);
        }
      } catch (error) {
        console.warn(`Warning: Failed to clear vector store: ${error.message}`);
      }
    }

    // Get perspectives with embeddings from MongoDB
    const perspectivesWithEmbeddings = await this.toolRepository.getPerspectivesWithEmbeddings();
    
    if (verbose) {
      console.log(`📊 Found ${perspectivesWithEmbeddings.length} perspectives with embeddings`);
    }

    // Load vectors in batches
    for (let i = 0; i < perspectivesWithEmbeddings.length; i += batchSize) {
      const batch = perspectivesWithEmbeddings.slice(i, i + batchSize);
      
      try {
        await this.vectorStore.indexBatch(batch.map((p, index) => ({
          id: i + index + 1, // Use numeric IDs starting from 1 (NOT ObjectId strings!)
          vector: p.embedding,
          metadata: {
            perspectiveId: p._id?.toString() || p.id, // Store ObjectId as metadata
            toolName: p.tool_name || p.toolName,
            toolId: p.tool_id,
            perspective: p.perspective_type_name || p.perspective,
            content: p.content,
            perspectiveType: p.perspective_type_name
          }
        })));
        
        results.loaded += batch.length;
        
        if (verbose) {
          console.log(`📥 Loaded batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(perspectivesWithEmbeddings.length/batchSize)} (${batch.length} vectors)`);
        }
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: error.message
        });
        
        if (verbose) {
          console.error(`❌ Failed to load batch ${Math.floor(i/batchSize) + 1}: ${error.message}`);
        }
      }
    }

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
        // Debug: Log what we're indexing
        if (batch.length > 0 && this.logger?.verbose) {
          this.logger.verbose(`Indexing batch with first perspective having tool_id: ${batch[0].tool_id}`);
        }
        
        await this.vectorStore.indexBatch(batch.map(p => ({
          id: p._id || p.id,  // Use MongoDB _id if available
          vector: p.embedding,
          metadata: {
            toolName: p.tool_name || p.toolName,  // Database uses tool_name
            toolId: p.tool_id, // Include tool ID for lookups
            perspective: p.perspective_type_name || p.perspective, // Database uses perspective_type_name  
            content: p.content, // Include perspective content
            perspectiveType: p.perspective_type_name
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
      // Get real statistics from database
      const perspectivesGenerated = await this.toolRepository.countToolPerspectives();
      const perspectivesWithEmbeddings = await this.toolRepository.countToolPerspectives({
        embedding: { $exists: true, $ne: null }
      });
      
      // For vectorsIndexed, we'll use perspectivesWithEmbeddings as a proxy since
      // each perspective with embedding should be indexed in vector store
      const vectorsIndexed = perspectivesWithEmbeddings;
      
      return {
        vectorsIndexed,
        perspectivesGenerated,
        perspectivesWithEmbeddings,
        averageEmbeddingDimensions: 768 // Nomic embeddings
      };
    } catch (error) {
      // If database query fails, return zeros with error logged
      console.error('[SearchService] Error getting search statistics:', error.message);
      return {
        vectorsIndexed: 0,
        perspectivesGenerated: 0,
        perspectivesWithEmbeddings: 0,
        averageEmbeddingDimensions: 768
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

  /**
   * Clear all vectors from the vector store
   * Single responsibility: Vector store cleanup
   */
  async clearVectors() {
    try {
      // Use VectorStore's clear method to clear all vectors
      const result = await this.vectorStore.clear();
      
      this.eventBus.emit('search:vectors-cleared', {
        clearedCount: result.deletedCount || 0,
        collection: this.vectorStore.options?.collectionName || 'tool_vectors'
      });
      
      return {
        success: true,
        clearedCount: result.deletedCount || 0,
        collection: this.vectorStore.options?.collectionName || 'tool_vectors'
      };
    } catch (error) {
      this.eventBus.emit('search:vectors-clear-failed', {
        error: error.message
      });
      
      throw new Error(`Failed to clear vectors: ${error.message}`);
    }
  }
}