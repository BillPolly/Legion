/**
 * SearchContentTool - Tool for semantic search over indexed content
 * Metadata comes from tools-metadata.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';
import SemanticSearchEngine from '../search/SemanticSearchEngine.js';
import DatabaseSchema from '../database/DatabaseSchema.js';
import { MongoClient } from 'mongodb';

export default class SearchContentTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.semanticSearchModule = null;
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    if (!this.semanticSearchModule) {
      throw new Error('Semantic search module not provided to SearchContentTool');
    }

    const { query, options = {} } = params;
    
    this.progress(`Searching for: ${query}`, 10, {
      query,
      options
    });

    const startTime = Date.now();
    let mongoClient = null;

    try {
      // Initialize database connection
      const mongoUrl = this.semanticSearchModule.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      mongoClient = new MongoClient(mongoUrl);
      await mongoClient.connect();
      
      const config = this.semanticSearchModule.config;
      const db = mongoClient.db(config.mongodb.database);

      // Set up database schema
      const databaseSchema = new DatabaseSchema(db, config.mongodb);

      this.progress(`Initializing search engine`, 20);

      // Create search engine
      const searchEngine = new SemanticSearchEngine({
        databaseSchema,
        resourceManager: this.semanticSearchModule.resourceManager,
        options: {
          qdrantCollection: config.qdrant.collection,
          defaultLimit: options.limit || 10,
          defaultThreshold: options.threshold || 0.3
        }
      });

      this.progress(`Executing semantic search`, 50);

      // Execute search
      const searchResults = await searchEngine.search(query, {
        limit: options.limit,
        threshold: options.threshold,
        sourceFilter: options.sourceFilter,
        contentTypeFilter: options.contentTypeFilter,
        includeContext: options.includeContext,
        includeRelevanceScore: true
      });

      this.progress(`Processing search results`, 80);

      // Format results according to output schema
      const formattedResults = searchResults.map(result => ({
        content: result.content,
        similarity: result.similarity,
        source: result.source,
        title: result.title,
        chunkIndex: result.chunkIndex,
        context: result.context || {},
        metadata: {
          contentType: result.metadata.contentType,
          lastModified: result.metadata.lastModified,
          headings: result.metadata.headings || [],
          charStart: result.metadata.charStart,
          charEnd: result.metadata.charEnd
        }
      }));

      const searchTime = Date.now() - startTime;

      this.progress('Search completed successfully', 100, {
        resultCount: formattedResults.length,
        searchTime
      });

      this.info(`Found ${formattedResults.length} results for query: "${query}"`, {
        query,
        resultCount: formattedResults.length,
        searchTime,
        avgSimilarity: formattedResults.length > 0 ? 
          formattedResults.reduce((sum, r) => sum + r.similarity, 0) / formattedResults.length : 0
      });

      return {
        query,
        results: formattedResults,
        totalResults: formattedResults.length,
        searchTime
      };

    } catch (error) {
      this.error(`Search failed: ${error.message}`, {
        query,
        options,
        error: error.message
      });

      throw error;
    } finally {
      if (mongoClient) {
        await mongoClient.close();
      }
    }
  }
}