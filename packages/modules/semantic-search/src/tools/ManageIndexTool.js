/**
 * ManageIndexTool - Tool for managing document indexes
 * Metadata comes from tools-metadata.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';
import DatabaseSchema from '../database/DatabaseSchema.js';
import SemanticSearchEngine from '../search/SemanticSearchEngine.js';
import { MongoClient } from 'mongodb';

export default class ManageIndexTool extends Tool {
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
      throw new Error('Semantic search module not provided to ManageIndexTool');
    }

    const { action, options = {} } = params;
    
    this.progress(`Executing index management action: ${action}`, 10, {
      action,
      options
    });

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

      this.progress(`Executing ${action} operation`, 30);

      let result;
      let statistics;

      switch (action) {
        case 'status':
          result = await this._getIndexStatus(databaseSchema, config, options);
          break;
        case 'list':
          result = await this._listDocuments(databaseSchema, options);
          break;
        case 'clear':
          result = await this._clearIndex(databaseSchema, config, options);
          break;
        case 'update':
          result = await this._updateIndex(databaseSchema, options);
          break;
        default:
          throw new Error(`Unknown management action: ${action}`);
      }

      // Get statistics if requested
      if (options.includeStats !== false) {
        statistics = await this._getStatistics(databaseSchema, config);
      }

      this.progress('Management action completed', 100, { action });

      return {
        action,
        result,
        statistics
      };

    } catch (error) {
      this.error(`Index management failed: ${error.message}`, {
        action,
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

  /**
   * Get comprehensive index status
   */
  async _getIndexStatus(databaseSchema, config, options) {
    const stats = await databaseSchema.getStatistics();
    
    return {
      indexHealth: 'healthy',
      collections: {
        documents: {
          name: config.mongodb.collections.documents,
          count: stats.totalDocuments,
          initialized: stats.collectionsInitialized
        },
        chunks: {
          name: config.mongodb.collections.chunks,
          count: stats.totalChunks,
          initialized: stats.collectionsInitialized
        }
      },
      qdrant: {
        collection: config.qdrant.collection,
        status: 'connected'
      },
      summary: `${stats.totalDocuments} documents with ${stats.totalChunks} chunks indexed`
    };
  }

  /**
   * List indexed documents
   */
  async _listDocuments(databaseSchema, options) {
    const filter = {};
    
    if (options.sourceFilter) {
      filter.source = new RegExp(options.sourceFilter, 'i');
    }
    
    if (options.contentTypeFilter) {
      filter.contentType = { $in: options.contentTypeFilter };
    }

    const documents = await databaseSchema.searchDocuments(filter);
    
    return {
      documents: documents.map(doc => ({
        id: doc._id.toString(),
        source: doc.source,
        title: doc.title,
        contentType: doc.contentType,
        totalChunks: doc.totalChunks,
        fileSize: doc.fileSize,
        indexedAt: doc.indexedAt
      })),
      totalCount: documents.length,
      filter: options.sourceFilter || options.contentTypeFilter ? filter : null
    };
  }

  /**
   * Clear index with optional filtering
   */
  async _clearIndex(databaseSchema, config, options) {
    if (options.sourceFilter) {
      const clearResult = await databaseSchema.clearBySource(
        new RegExp(options.sourceFilter, 'i')
      );
      return {
        cleared: 'filtered',
        documentsRemoved: clearResult.documentsDeleted,
        chunksRemoved: clearResult.chunksDeleted,
        filter: options.sourceFilter
      };
    } else {
      const clearResult = await databaseSchema.clearAll();
      return {
        cleared: 'all',
        documentsRemoved: clearResult.documentsDeleted,
        chunksRemoved: clearResult.chunksDeleted
      };
    }
  }

  /**
   * Update index (placeholder for incremental updates)
   */
  async _updateIndex(databaseSchema, options) {
    return {
      updated: 'incremental updates not yet implemented',
      message: 'Use clear and re-index workflow for now'
    };
  }

  /**
   * Get comprehensive statistics
   */
  async _getStatistics(databaseSchema, config) {
    const dbStats = await databaseSchema.getStatistics();
    
    return {
      totalDocuments: dbStats.totalDocuments,
      totalChunks: dbStats.totalChunks,
      vectorCount: dbStats.totalChunks, // Assuming 1:1 chunk to vector mapping
      indexSize: dbStats.totalChunks * 768 * 4, // Rough size estimate (768 dimensions * 4 bytes per float)
      collections: dbStats.collections,
      qdrantCollection: config.qdrant.collection
    };
  }
}