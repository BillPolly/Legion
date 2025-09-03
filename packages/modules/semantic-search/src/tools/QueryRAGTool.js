/**
 * QueryRAGTool - Tool for RAG queries combining search with LLM responses
 * Metadata comes from tools-metadata.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';
import SemanticSearchEngine from '../search/SemanticSearchEngine.js';
import RAGEngine from '../search/RAGEngine.js';
import DatabaseSchema from '../database/DatabaseSchema.js';
import { MongoClient } from 'mongodb';
import { LLMClient } from '@legion/llm';

export default class QueryRAGTool extends Tool {
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
      throw new Error('Semantic search module not provided to QueryRAGTool');
    }

    const { query, options = {} } = params;
    
    this.progress(`Processing RAG query: ${query}`, 5, {
      query,
      options
    });

    const startTime = Date.now();
    let mongoClient = null;
    let llmClient = null;

    try {
      // Initialize database connection
      const mongoUrl = this.semanticSearchModule.resourceManager.get('env.MONGODB_URL') || 'mongodb://localhost:27017';
      mongoClient = new MongoClient(mongoUrl);
      await mongoClient.connect();
      
      const config = this.semanticSearchModule.config;
      const db = mongoClient.db(config.mongodb.database);

      this.progress(`Setting up search and LLM services`, 15);

      // Set up database schema
      const databaseSchema = new DatabaseSchema(db, config.mongodb);

      // Create search engine
      const searchEngine = new SemanticSearchEngine({
        databaseSchema,
        resourceManager: this.semanticSearchModule.resourceManager,
        options: {
          qdrantCollection: config.qdrant.collection
        }
      });

      // Create LLM client
      const anthropicKey = this.semanticSearchModule.resourceManager.get('env.ANTHROPIC_API_KEY');
      if (!anthropicKey) {
        throw new Error('ANTHROPIC_API_KEY environment variable is required for RAG responses');
      }

      llmClient = new LLMClient({
        provider: 'anthropic',
        apiKey: anthropicKey,
        model: options.llmModel || 'claude-3-5-sonnet-20241022'
      });

      // Create RAG engine
      const ragEngine = new RAGEngine({
        searchEngine,
        llmClient,
        resourceManager: this.semanticSearchModule.resourceManager,
        options: {
          maxContextTokens: 4000,
          includeCitations: options.includeSourceCitations !== false,
          responseMaxLength: 2000
        }
      });

      this.progress(`Executing RAG query`, 30);

      // Execute RAG query
      const ragResult = await ragEngine.query(query, {
        searchLimit: options.searchLimit || 5,
        searchThreshold: options.searchThreshold || 0.3,
        responseStyle: options.responseStyle || 'detailed',
        includeSourceCitations: options.includeSourceCitations
      });

      this.progress(`Processing RAG response`, 80);

      const totalTime = Date.now() - startTime;

      this.progress('RAG query completed successfully', 100, {
        query,
        sourceCount: ragResult.sources.length,
        searchResults: ragResult.searchResults
      });

      this.info(`RAG query completed: "${query}"`, {
        query,
        responseLength: ragResult.response.length,
        sourceCount: ragResult.sources.length,
        searchResults: ragResult.searchResults,
        totalTime,
        llmTime: ragResult.llmMetadata.responseTime
      });

      return {
        query: ragResult.query,
        response: ragResult.response,
        sources: ragResult.sources,
        llmMetadata: {
          model: ragResult.llmMetadata.model,
          tokensUsed: ragResult.llmMetadata.tokensUsed,
          responseTime: ragResult.llmMetadata.responseTime
        },
        searchResults: ragResult.searchResults
      };

    } catch (error) {
      this.error(`RAG query failed: ${error.message}`, {
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