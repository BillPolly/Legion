/**
 * MongoQueryTool - Direct MongoDB query execution tool
 */

import { Tool } from '@legion/tools-registry';
import { z } from 'zod';

export class MongoQueryTool extends Tool {
  constructor(dependencies = {}) {
    // Define Zod schema for input validation
    const inputSchema = z.object({
      database: z.string().optional()
        .describe('MongoDB database name (optional, defaults to .env)'),
      collection: z.string()
        .describe('Collection name to operate on'),
      command: z.enum([
        'find', 'findOne', 'insertOne', 'insertMany',
        'updateOne', 'updateMany', 'deleteOne', 'deleteMany',
        'aggregate', 'countDocuments', 'distinct',
        'createIndex', 'dropCollection', 'listCollections'
      ]).describe('MongoDB command to execute'),
      params: z.object({}).passthrough()
        .describe('Command parameters in MongoDB JSON format')
    });

    super({
      name: 'mongo_query',
      description: 'Execute MongoDB database operations with native JSON syntax',
      inputSchema
    });
    
    // Validate dependencies
    if (!dependencies.mongoProvider) {
      throw new Error('MongoDBProvider is required');
    }
    
    this.mongoProvider = dependencies.mongoProvider;
    
    // Override _execute to implement our logic
    this._execute = async (args) => this.executeQuery(args);
  }

  async executeQuery(args) {
    const { database, collection, command, params } = args;
    
    // Emit progress
    this.progress(`Executing ${command} on ${collection}`, 0);
    
    // Handle database switching by reconnecting if needed
    let needsReconnect = false;
    const originalDb = this.mongoProvider.databaseName;
    
    if (database && database !== originalDb) {
      // We need to create a new connection with different database
      needsReconnect = true;
      await this.mongoProvider.disconnect();
      this.mongoProvider.databaseName = database;
      this.mongoProvider.db = null;
      await this.mongoProvider.connect();
    }
    
    try {
      const result = await this.executeCommand(collection, command, params);
      
      // Emit success info
      this.info(`Command ${command} completed successfully`);
      
      return {
        database: database || originalDb,
        collection,
        command,
        result
      };
    } catch (error) {
      // Emit error
      this.error(`Command ${command} failed: ${error.message}`);
      throw error;
    } finally {
      // Restore original database if changed
      if (needsReconnect) {
        await this.mongoProvider.disconnect();
        this.mongoProvider.databaseName = originalDb;
        this.mongoProvider.db = null;
        await this.mongoProvider.connect();
      }
    }
  }

  async executeCommand(collection, command, params) {
    switch (command) {
      // Query operations
      case 'find':
        return await this.mongoProvider.find(
          collection,
          params.query || {},
          params.options || {}
        );
      
      case 'findOne':
        return await this.mongoProvider.findOne(
          collection,
          params.query || {},
          params.options || {}
        );
      
      case 'countDocuments':
        return await this.mongoProvider.count(
          collection,
          params.query || {}
        );
      
      case 'distinct':
        // MongoDB doesn't have a direct distinct method, use aggregation
        const distinctPipeline = [
          ...(params.query ? [{ $match: params.query }] : []),
          { $group: { _id: `$${params.field}` } },
          { $project: { _id: 0, value: '$_id' } }
        ];
        const distinctResult = await this.mongoProvider.aggregate(collection, distinctPipeline);
        return distinctResult.map(doc => doc.value).filter(v => v != null);
      
      case 'aggregate':
        return await this.mongoProvider.aggregate(
          collection,
          params.pipeline || []
        );
      
      // Write operations
      case 'insertOne':
        if (!params.document) {
          throw new Error('Document is required for insertOne operation');
        }
        return await this.mongoProvider.insert(
          collection,
          params.document
        );
      
      case 'insertMany':
        if (!params.documents || !Array.isArray(params.documents)) {
          throw new Error('Documents array is required for insertMany operation');
        }
        return await this.mongoProvider.insert(
          collection,
          params.documents
        );
      
      case 'updateOne':
        return await this.mongoProvider.update(
          collection,
          params.filter,
          params.update,
          { ...params.options, multi: false }
        );
      
      case 'updateMany':
        return await this.mongoProvider.update(
          collection,
          params.filter,
          params.update,
          { ...params.options, multi: true }
        );
      
      case 'deleteOne':
        return await this.mongoProvider.delete(
          collection,
          params.filter,
          { multi: false }
        );
      
      case 'deleteMany':
        return await this.mongoProvider.delete(
          collection,
          params.filter || {},
          { multi: true }
        );
      
      // Admin operations
      case 'createIndex':
        return await this.mongoProvider.createIndex(
          collection,
          params.keys,
          params.options || {}
        );
      
      case 'dropCollection':
        return await this.mongoProvider.dropCollection(collection);
      
      case 'listCollections':
        return await this.mongoProvider.listCollections();
      
      default:
        throw new Error(`Unsupported command: ${command}`);
    }
  }
}