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

    // Extract workspace as first parameter for clean API
    const { workspace, action, options = {} } = params;
    
    if (!workspace) {
      throw new Error('Workspace parameter is required');
    }
    
    this.progress(`Executing index management action: ${action} for workspace: ${workspace}`, 10, {
      workspace,
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

      // Execute workspace-specific management operations
      switch (action) {
        case 'status':
          result = await this._getIndexStatus(databaseSchema, config, workspace, options);
          break;
        case 'list':
          result = await this._listDocuments(databaseSchema, workspace, options);
          break;
        case 'clear':
          result = await this._clearIndex(databaseSchema, config, workspace, options);
          break;
        case 'update':
          result = await this._updateIndex(databaseSchema, workspace, options);
          break;
        default:
          throw new Error(`Unknown management action: ${action}`);
      }

      // Get workspace-specific statistics if requested
      if (options.includeStats !== false) {
        statistics = await this._getStatistics(databaseSchema, config, workspace);
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
   * Get comprehensive index status for specific workspace
   * Shows both MongoDB and workspace-specific Qdrant collection status
   */
  async _getIndexStatus(databaseSchema, config, workspace, options) {
    // Get workspace-specific statistics from MongoDB
    const stats = await databaseSchema.getStatistics(workspace);
    
    // Generate workspace-specific Qdrant collection name
    const sanitizedWorkspace = workspace.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const workspaceCollectionName = `semantic_content_${sanitizedWorkspace}`;
    
    return {
      workspace: workspace,
      indexHealth: 'healthy',
      collections: {
        documents: {
          name: config.mongodb.collections.documents,
          count: stats.totalDocuments,
          workspace: workspace,
          initialized: stats.collectionsInitialized
        },
        chunks: {
          name: config.mongodb.collections.chunks,
          count: stats.totalChunks,
          workspace: workspace,
          initialized: stats.collectionsInitialized
        }
      },
      qdrant: {
        collection: workspaceCollectionName,  // Workspace-specific collection name
        status: 'connected',
        workspace: workspace
      },
      summary: `Workspace '${workspace}': ${stats.totalDocuments} documents with ${stats.totalChunks} chunks indexed`
    };
  }

  /**
   * List indexed documents in specific workspace
   */
  async _listDocuments(databaseSchema, workspace, options) {
    const filter = {};
    
    if (options.sourceFilter) {
      filter.source = new RegExp(options.sourceFilter, 'i');
    }
    
    if (options.contentTypeFilter) {
      filter.contentType = { $in: options.contentTypeFilter };
    }

    // Search documents within specific workspace
    const documents = await databaseSchema.searchDocuments(filter, workspace);
    
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
      workspace: workspace,
      filter: options.sourceFilter || options.contentTypeFilter ? filter : null
    };
  }

  /**
   * Clear index for specific workspace with optional filtering
   * Clears both MongoDB data and workspace-specific Qdrant collection
   */
  async _clearIndex(databaseSchema, config, workspace, options) {
    if (options.sourceFilter) {
      // Clear by source filter within workspace (MongoDB only - Qdrant cleared separately)
      const clearResult = await databaseSchema.clearBySource(
        new RegExp(options.sourceFilter, 'i')
      );
      return {
        workspace: workspace,
        cleared: 'filtered',
        documentsRemoved: clearResult.documentsDeleted,
        chunksRemoved: clearResult.chunksDeleted,
        filter: options.sourceFilter
      };
    } else {
      // Clear entire workspace (both MongoDB and Qdrant)
      const clearResult = await databaseSchema.clearAll(workspace);
      return {
        workspace: workspace,
        cleared: 'workspace',
        documentsRemoved: clearResult.documentsDeleted,
        chunksRemoved: clearResult.chunksDeleted
      };
    }
  }

  /**
   * Update index (placeholder for incremental updates)
   */
  async _updateIndex(databaseSchema, workspace, options) {
    return {
      workspace: workspace,
      updated: 'incremental updates not yet implemented',
      message: 'Use clear and re-index workflow for now'
    };
  }

  /**
   * Get comprehensive statistics for specific workspace
   */
  async _getStatistics(databaseSchema, config, workspace) {
    // Get workspace-specific statistics
    const dbStats = await databaseSchema.getStatistics(workspace);
    
    // Generate workspace-specific Qdrant collection name for reference
    const sanitizedWorkspace = workspace.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const workspaceCollectionName = `semantic_content_${sanitizedWorkspace}`;
    
    return {
      workspace: workspace,
      totalDocuments: dbStats.totalDocuments,
      totalChunks: dbStats.totalChunks,
      vectorCount: dbStats.totalChunks, // Assuming 1:1 chunk to vector mapping
      indexSize: dbStats.totalChunks * 768 * 4, // Rough size estimate (768 dimensions * 4 bytes per float)
      collections: dbStats.collections,
      qdrantCollection: workspaceCollectionName  // Workspace-specific collection name
    };
  }
}