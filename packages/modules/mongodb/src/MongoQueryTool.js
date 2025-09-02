/**
 * MongoDB Query Tool - Flexible MongoDB operations tool
 * Metadata comes from tools-metadata.json, tool contains pure logic only
 */

import { Tool } from '@legion/tools-registry';

/**
 * Tool for performing MongoDB operations (query, update, admin)
 * Supports all major MongoDB operations via a single flexible interface
 */
export default class MongoQueryTool extends Tool {
  constructor(module, toolName) {
    super(module, toolName);
    this.mongoModule = null;
  }

  /**
   * Pure business logic - no metadata, no validation
   * Base Tool class handles all validation using metadata
   */
  async _execute(params) {
    if (!this.mongoModule) {
      throw new Error('MongoDB module not provided to MongoQueryTool');
    }

    const { database, collection, command, params: operationParams = {} } = params;
    
    if (!collection) {
      throw new Error('Collection name is required');
    }
    
    if (!command) {
      throw new Error('Command is required');
    }

    this.progress(`Executing ${command} on ${collection}`, 25, {
      database: database || 'default',
      collection,
      command
    });

    try {
      // Get collection instance
      const coll = this.mongoModule.getCollection(collection, database);
      
      this.progress(`Connected to collection ${collection}`, 50, {
        operation: command,
        collection
      });

      // Execute the operation
      const result = await this.mongoModule.executeOperation(coll, command, operationParams);
      
      this.progress(`Operation ${command} completed`, 100, {
        operation: command,
        collection,
        resultType: Array.isArray(result) ? 'array' : typeof result
      });

      this.info(`MongoDB operation completed successfully`, {
        command,
        collection,
        database: database || 'default',
        resultCount: Array.isArray(result) ? result.length : 
                    (result && typeof result === 'object' && result.insertedCount !== undefined) ? result.insertedCount :
                    (result && typeof result === 'object' && result.modifiedCount !== undefined) ? result.modifiedCount :
                    (result && typeof result === 'object' && result.deletedCount !== undefined) ? result.deletedCount : 1
      });

      // Format result for consistent output
      return this._formatResult(command, result, collection, database);

    } catch (error) {
      this.error(`MongoDB operation failed: ${error.message}`, {
        command,
        collection,
        database: database || 'default',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Format operation result consistently
   */
  _formatResult(command, result, collection, database) {
    const baseResult = {
      command,
      collection,
      database: database || 'default',
      timestamp: new Date().toISOString()
    };

    switch (command.toLowerCase()) {
      case 'find':
      case 'aggregate':
        return {
          ...baseResult,
          documents: result || [],
          count: Array.isArray(result) ? result.length : 0
        };

      case 'findone':
        return {
          ...baseResult,
          document: result || null,
          found: !!result
        };

      case 'countdocuments':
        return {
          ...baseResult,
          count: result || 0
        };

      case 'distinct':
        return {
          ...baseResult,
          values: result || [],
          count: Array.isArray(result) ? result.length : 0
        };

      case 'insertone':
        return {
          ...baseResult,
          insertedId: result?.insertedId || null,
          acknowledged: result?.acknowledged || false
        };

      case 'insertmany':
        return {
          ...baseResult,
          insertedIds: result?.insertedIds || [],
          insertedCount: result?.insertedCount || 0,
          acknowledged: result?.acknowledged || false
        };

      case 'updateone':
      case 'updatemany':
        return {
          ...baseResult,
          matchedCount: result?.matchedCount || 0,
          modifiedCount: result?.modifiedCount || 0,
          upsertedCount: result?.upsertedCount || 0,
          upsertedId: result?.upsertedId || null,
          acknowledged: result?.acknowledged || false
        };

      case 'deleteone':
      case 'deletemany':
        return {
          ...baseResult,
          deletedCount: result?.deletedCount || 0,
          acknowledged: result?.acknowledged || false
        };

      case 'createindex':
        return {
          ...baseResult,
          indexName: result || null,
          created: !!result
        };

      case 'dropcollection':
        return {
          ...baseResult,
          dropped: result === true
        };

      case 'listcollections':
        return {
          ...baseResult,
          collections: result || [],
          count: Array.isArray(result) ? result.length : 0
        };

      default:
        // Generic result format for unknown commands
        return {
          ...baseResult,
          result: result,
          resultType: Array.isArray(result) ? 'array' : typeof result
        };
    }
  }

  /**
   * Helper method to validate operation parameters
   */
  _validateOperationParams(command, params) {
    const requiredParams = {
      distinct: ['field'],
      insertone: ['document'],
      insertmany: ['documents'],
      updateone: ['update'],
      updatemany: ['update'],
      createindex: ['keys']
    };

    const required = requiredParams[command.toLowerCase()];
    if (required) {
      for (const param of required) {
        if (!params.hasOwnProperty(param)) {
          throw new Error(`Operation ${command} requires parameter: ${param}`);
        }
      }
    }

    return true;
  }
}