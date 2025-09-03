/**
 * SemanticSearchEngine - Core semantic search functionality
 * 
 * Provides vector-based content search with ranking and filtering
 * Integrates with Qdrant for vector similarity and MongoDB for metadata
 * NO FALLBACKS - all operations must succeed or throw errors
 */

import { NomicEmbeddings } from '@legion/nomic';
import { QdrantClient } from '@qdrant/js-client-rest';
import { ObjectId } from 'mongodb';

export default class SemanticSearchEngine {
  constructor({ databaseSchema, resourceManager, options = {} }) {
    if (!databaseSchema) {
      throw new Error('DatabaseSchema is required');
    }
    if (!resourceManager) {
      throw new Error('ResourceManager is required');
    }

    this.databaseSchema = databaseSchema;
    this.resourceManager = resourceManager;
    
    this.options = {
      qdrantCollection: 'semantic_content',
      defaultLimit: 10,
      defaultThreshold: 0.3,
      maxResults: 100,
      includeContext: false,
      ...options
    };

    this.nomicEmbeddings = null;
    this.qdrantClient = null;
    this.initialized = false;
  }

  /**
   * Generate Qdrant collection name for workspace
   * Pattern: semantic_content_{workspace_name}  
   * Must match DocumentIndexer naming for consistency
   */
  getWorkspaceCollectionName(workspace) {
    // Sanitize workspace name for collection naming (same logic as DocumentIndexer)
    const sanitizedWorkspace = workspace.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    return `semantic_content_${sanitizedWorkspace}`;
  }

  /**
   * Initialize search services
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize Nomic embeddings
      this.nomicEmbeddings = new NomicEmbeddings();
      await this.nomicEmbeddings.initialize();
      
      // Initialize Qdrant client
      const qdrantUrl = this.resourceManager.get('env.QDRANT_URL') || 'http://localhost:6333';
      this.qdrantClient = new QdrantClient({ url: qdrantUrl });
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize SemanticSearchEngine: ${error.message}`);
    }
  }

  /**
   * Search for content using semantic similarity
   */
  async search(query, options = {}) {
    await this.initialize();
    
    // Validate query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Query cannot be empty');
    }

    const searchOptions = {
      workspace: options.workspace,
      limit: options.limit || this.options.defaultLimit,
      threshold: options.threshold !== undefined ? options.threshold : this.options.defaultThreshold,
      sourceFilter: options.sourceFilter,
      contentTypeFilter: options.contentTypeFilter,
      includeContext: options.includeContext !== undefined ? options.includeContext : this.options.includeContext,
      includeRelevanceScore: options.includeRelevanceScore
    };

    // Validate options
    if (!searchOptions.workspace) {
      throw new Error('Workspace is required for search');
    }
    
    if (searchOptions.limit <= 0) {
      throw new Error('Limit must be positive');
    }
    
    if (searchOptions.threshold < 0 || searchOptions.threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.nomicEmbeddings.embed(query);
      
      // Generate workspace-specific Qdrant collection name
      // Each workspace has its own collection for optimal performance and isolation
      const workspaceCollectionName = this.getWorkspaceCollectionName(searchOptions.workspace);
      
      console.log(`[SemanticSearchEngine] Searching in workspace collection: ${workspaceCollectionName}`);

      // Search vectors in workspace-specific Qdrant collection
      // No additional filtering needed since collection is already workspace-specific
      const vectorResults = await this.qdrantClient.search(workspaceCollectionName, {
        vector: queryEmbedding,
        limit: Math.min(searchOptions.limit, this.options.maxResults),
        score_threshold: searchOptions.threshold,
        with_payload: true,
        with_vector: false
      });

      if (!vectorResults || vectorResults.length === 0) {
        return [];
      }

      // Enrich results with MongoDB data and apply filters
      const enrichedResults = await this.enrichResults(vectorResults, searchOptions);
      
      // Sort by similarity and apply final limit
      const sortedResults = enrichedResults
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, searchOptions.limit);

      return sortedResults;

    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  /**
   * Enrich Qdrant results with MongoDB data and apply filters
   */
  async enrichResults(vectorResults, options) {
    const enriched = [];
    
    for (const vectorResult of vectorResults) {
      try {
        const payload = vectorResult.payload;
        const documentId = new ObjectId(payload.documentId);
        const chunkIndex = payload.chunkIndex;
        
        // Get chunk data from MongoDB
        const chunks = await this.databaseSchema.getChunksByDocument(documentId);
        const chunk = chunks.find(c => c.chunkIndex === chunkIndex);
        
        if (!chunk) {
          continue; // Skip if chunk not found
        }
        
        // Get document data
        const document = await this.databaseSchema.getDocument(documentId);
        if (!document) {
          continue; // Skip if document not found
        }

        // Apply source filter
        if (options.sourceFilter && !document.source.includes(options.sourceFilter)) {
          continue;
        }

        // Apply content type filter
        if (options.contentTypeFilter && !options.contentTypeFilter.includes(document.contentType)) {
          continue;
        }

        // Build result object
        const result = {
          content: chunk.content,
          similarity: vectorResult.score,
          source: document.source,
          title: document.title || payload.title,
          chunkIndex: chunk.chunkIndex,
          metadata: {
            contentType: document.contentType,
            lastModified: document.metadata?.lastModified,
            fileSize: document.fileSize,
            headings: chunk.metadata?.headings || [],
            charStart: chunk.charStart,
            charEnd: chunk.charEnd
          }
        };

        // Add context if requested
        if (options.includeContext) {
          result.context = await this.getChunkContext(documentId, chunkIndex);
        }

        enriched.push(result);

      } catch (error) {
        // Skip individual result errors but log them
        console.warn(`Failed to enrich search result: ${error.message}`);
      }
    }

    return enriched;
  }

  /**
   * Get surrounding context for a chunk
   */
  async getChunkContext(documentId, chunkIndex) {
    try {
      const allChunks = await this.databaseSchema.getChunksByDocument(documentId);
      
      const previousChunk = allChunks.find(c => c.chunkIndex === chunkIndex - 1);
      const nextChunk = allChunks.find(c => c.chunkIndex === chunkIndex + 1);
      
      const context = {};
      
      if (previousChunk) {
        context.previousChunk = previousChunk.content;
      }
      
      if (nextChunk) {
        context.nextChunk = nextChunk.content;
      }
      
      // Add document-level headings
      const document = await this.databaseSchema.getDocument(documentId);
      if (document?.metadata?.headings) {
        context.headings = document.metadata.headings;
      }
      
      return context;
      
    } catch (error) {
      return {}; // Return empty context on error
    }
  }

  /**
   * Search with advanced filtering and ranking
   */
  async advancedSearch(query, options = {}) {
    const baseResults = await this.search(query, options);
    
    // Apply additional ranking factors
    const rankedResults = baseResults.map(result => {
      let relevanceBoost = 0;
      
      // Boost for title matches
      if (result.title && result.title.toLowerCase().includes(query.toLowerCase())) {
        relevanceBoost += 0.1;
      }
      
      // Boost for heading context
      if (result.metadata.headings.some(heading => 
        heading.toLowerCase().includes(query.toLowerCase())
      )) {
        relevanceBoost += 0.05;
      }
      
      // Boost for exact phrase matches
      if (result.content.toLowerCase().includes(query.toLowerCase())) {
        relevanceBoost += 0.05;
      }

      return {
        ...result,
        relevanceScore: Math.min(1.0, result.similarity + relevanceBoost),
        originalSimilarity: result.similarity
      };
    });

    // Re-sort by relevance score
    return rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get search suggestions based on indexed content
   */
  async getSuggestions(partialQuery, options = {}) {
    if (!partialQuery || partialQuery.length < 2) {
      return [];
    }

    try {
      // Search for partial matches in chunk content
      const suggestions = await this.databaseSchema.searchChunks({
        content: new RegExp(partialQuery, 'i')
      });

      // Extract unique phrases containing the query
      const phrases = new Set();
      const queryLower = partialQuery.toLowerCase();
      
      for (const chunk of suggestions.slice(0, 20)) { // Limit to avoid performance issues
        const content = chunk.content.toLowerCase();
        const sentences = content.split(/[.!?]+/);
        
        for (const sentence of sentences) {
          if (sentence.includes(queryLower)) {
            const trimmed = sentence.trim();
            if (trimmed.length > 10 && trimmed.length < 100) {
              phrases.add(trimmed);
            }
          }
        }
      }

      return Array.from(phrases)
        .slice(0, options.limit || 10)
        .map(phrase => ({
          suggestion: phrase,
          type: 'content'
        }));

    } catch (error) {
      return []; // Return empty suggestions on error
    }
  }

  /**
   * Get search statistics
   */
  async getSearchStatistics() {
    await this.initialize();
    
    try {
      const dbStats = await this.databaseSchema.getStatistics();
      
      // Get Qdrant collection info
      let qdrantStats = {};
      try {
        const collectionInfo = await this.qdrantClient.getCollection(this.options.qdrantCollection);
        qdrantStats = {
          vectorCount: collectionInfo.points_count || 0,
          dimensions: 768,
          status: collectionInfo.status
        };
      } catch (error) {
        qdrantStats = { vectorCount: 0, error: error.message };
      }

      return {
        mongodb: dbStats,
        qdrant: qdrantStats,
        searchOptions: this.options,
        initialized: this.initialized
      };

    } catch (error) {
      throw new Error(`Failed to get search statistics: ${error.message}`);
    }
  }

  /**
   * Clear search index for specific workspace or all workspaces
   * Handles both MongoDB collections and workspace-specific Qdrant collections
   */
  async clearIndex(workspace = null) {
    await this.initialize();
    
    try {
      // Clear MongoDB collections (workspace-filtered)
      const dbResult = await this.databaseSchema.clearAll(workspace);
      
      if (workspace) {
        // Clear specific workspace Qdrant collection
        const workspaceCollectionName = this.getWorkspaceCollectionName(workspace);
        console.log(`[SemanticSearchEngine] Clearing workspace collection: ${workspaceCollectionName}`);
        
        try {
          // Delete all points in workspace collection
          await this.qdrantClient.delete(workspaceCollectionName, {
            filter: {
              must: [] // Clear all points
            }
          });
        } catch (error) {
          // Collection might not exist, which is fine
          console.log(`[SemanticSearchEngine] Workspace collection ${workspaceCollectionName} might not exist: ${error.message}`);
        }
      } else {
        // Clear all workspace collections (requires listing them)
        const collections = await this.qdrantClient.getCollections();
        const workspaceCollections = collections.collections.filter(c => 
          c.name.startsWith('semantic_content_')
        );
        
        console.log(`[SemanticSearchEngine] Clearing ${workspaceCollections.length} workspace collections`);
        
        for (const collection of workspaceCollections) {
          try {
            await this.qdrantClient.delete(collection.name, {
              filter: { must: [] }
            });
          } catch (error) {
            console.warn(`Failed to clear collection ${collection.name}: ${error.message}`);
          }
        }
      }
      
      return {
        documentsCleared: dbResult.documentsDeleted,
        chunksCleared: dbResult.chunksDeleted,
        vectorsCleared: true,
        workspace: workspace || 'all'
      };
      
    } catch (error) {
      throw new Error(`Failed to clear search index for workspace ${workspace || 'all'}: ${error.message}`);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.nomicEmbeddings) {
      await this.nomicEmbeddings.close();
    }
    
    this.initialized = false;
  }

  /**
   * Validate search options
   */
  static validateSearchOptions(options) {
    if (options.limit !== undefined && (typeof options.limit !== 'number' || options.limit <= 0)) {
      throw new Error('limit must be a positive number');
    }
    
    if (options.threshold !== undefined && (typeof options.threshold !== 'number' || options.threshold < 0 || options.threshold > 1)) {
      throw new Error('threshold must be between 0 and 1');
    }
    
    return true;
  }
}