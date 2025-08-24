/**
 * ServerDatabaseActor - Server-side actor for database operations
 * 
 * Hybrid approach: Uses ToolRegistry for tool-related data,
 * direct MongoDB for UI-specific database administration
 */

export class ServerDatabaseActor {
  constructor(toolRegistry, mongoProvider) {
    this.toolRegistry = toolRegistry;
    this.mongoProvider = mongoProvider;
    this.remoteActor = null;
    this.mongoDb = null;
    
    // Get MongoDB database instance for direct operations
    if (mongoProvider?.databaseService?.mongoProvider?.db) {
      this.mongoDb = mongoProvider.databaseService.mongoProvider.db;
    }
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = remoteActor;
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'collections:load':
          await this.loadCollections();
          break;
          
        case 'collection:get-data':
          await this.getCollectionData(data.collectionName, data);
          break;
          
        case 'collection:query':
          await this.queryCollection(data.collectionName, data.query);
          break;
          
        case 'collection:get-stats':
          await this.getCollectionStats(data.collectionName);
          break;
          
        default:
          console.log('Unknown database message:', type);
      }
    } catch (error) {
      console.error('Error handling database message:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'error',
          data: { error: error.message }
        });
      }
    }
  }

  async loadCollections() {
    try {
      if (!this.mongoDb) {
        throw new Error('MongoDB not connected');
      }
      
      // Get all collections
      const collectionsList = await this.mongoDb.listCollections().toArray();
      
      // Get document counts for each collection
      const collections = await Promise.all(
        collectionsList.map(async (col) => {
          const count = await this.mongoDb.collection(col.name).countDocuments();
          return {
            name: col.name,
            count,
            type: col.type || 'collection'
          };
        })
      );
      
      // Send collections to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'collections:list',
          data: { collections }
        });
      }
    } catch (error) {
      console.error('Failed to load collections:', error);
      throw error;
    }
  }

  async getCollectionData(collectionName, options = {}) {
    try {
      // Delegate tool-related collections to ToolRegistry
      if (this.isToolRelatedCollection(collectionName)) {
        await this.getToolCollectionData(collectionName, options);
        return;
      }
      
      if (!this.mongoDb) {
        throw new Error('MongoDB not connected');
      }
      
      const collection = this.mongoDb.collection(collectionName);
      
      // Get documents
      const documents = await collection
        .find(options.query || {})
        .limit(options.limit || 20)
        .skip(options.skip || 0)
        .toArray();
      
      // Get total count
      const count = await collection.countDocuments(options.query || {});
      
      // Try to get a sample document to infer schema
      const sampleDoc = documents[0];
      const schema = sampleDoc ? this.inferSchema(sampleDoc) : null;
      
      // Send data to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'collection:data',
          data: {
            collectionName,
            documents,
            count,
            schema
          }
        });
      }
    } catch (error) {
      console.error('Failed to get collection data:', error);
      throw error;
    }
  }

  async queryCollection(collectionName, query) {
    try {
      if (!this.mongoDb) {
        throw new Error('MongoDB not connected');
      }
      
      const collection = this.mongoDb.collection(collectionName);
      
      // Parse query if it's a string
      let queryObj = query;
      if (typeof query === 'string') {
        try {
          queryObj = JSON.parse(query);
        } catch {
          // If not valid JSON, treat as text search
          queryObj = { $text: { $search: query } };
        }
      }
      
      // Execute query
      const documents = await collection
        .find(queryObj)
        .limit(100)
        .toArray();
      
      const count = await collection.countDocuments(queryObj);
      
      // Send results to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'documents:list',
          data: {
            documents,
            count
          }
        });
      }
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  }

  async getCollectionStats(collectionName) {
    try {
      if (!this.mongoDb) {
        throw new Error('MongoDB not connected');
      }
      
      const collection = this.mongoDb.collection(collectionName);
      const stats = await collection.stats();
      
      // Send stats to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'collection:stats',
          data: {
            collectionName,
            count: stats.count,
            size: stats.size,
            avgObjSize: stats.avgObjSize,
            storageSize: stats.storageSize,
            indexes: stats.nindexes
          }
        });
      }
    } catch (error) {
      console.error('Failed to get collection stats:', error);
      throw error;
    }
  }

  inferSchema(document) {
    const schema = {};
    
    for (const [key, value] of Object.entries(document)) {
      if (value === null) {
        schema[key] = 'null';
      } else if (Array.isArray(value)) {
        schema[key] = 'array';
      } else if (value instanceof Date) {
        schema[key] = 'date';
      } else if (typeof value === 'object' && value._bsontype === 'ObjectID') {
        schema[key] = 'ObjectId';
      } else {
        schema[key] = typeof value;
      }
    }
    
    return schema;
  }

  /**
   * Check if collection name is tool-related and should be delegated to ToolRegistry
   */
  isToolRelatedCollection(collectionName) {
    return ['tools', 'modules', 'tool_perspectives'].includes(collectionName);
  }

  /**
   * Handle tool-related collection data using ToolRegistry
   */
  async getToolCollectionData(collectionName, options = {}) {
    try {
      let documents = [];
      let count = 0;
      let schema = null;

      switch (collectionName) {
        case 'tools':
          documents = await this.toolRegistry.listTools({
            limit: options.limit || 20,
            skip: options.skip || 0
          });
          // Get count from ToolRegistry statistics
          const stats = await this.toolRegistry.getStatistics();
          count = stats.tools || 0;
          schema = documents[0] ? this.inferSchema(documents[0]) : null;
          break;
          
        case 'modules':
          documents = await this.toolRegistry.listModules({
            limit: options.limit || 20,
            skip: options.skip || 0
          });
          const moduleStats = await this.toolRegistry.getStatistics();
          count = moduleStats.modules || 0;
          schema = documents[0] ? this.inferSchema(documents[0]) : null;
          break;
          
        case 'tool_perspectives':
          // For perspectives, we'll need to get them from individual tools
          const tools = await this.toolRegistry.listTools({ limit: 10 });
          documents = [];
          for (const tool of tools.slice(0, options.limit || 20)) {
            try {
              const toolWithPerspectives = await this.toolRegistry.getToolWithPerspectives(tool.name);
              if (toolWithPerspectives?.perspectives) {
                documents.push(...toolWithPerspectives.perspectives);
              }
            } catch (error) {
              // Skip tools without perspectives
            }
          }
          count = documents.length;
          schema = documents[0] ? this.inferSchema(documents[0]) : null;
          break;
      }

      // Send data to client
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'collection:data',
          data: {
            collectionName,
            documents,
            count,
            schema
          }
        });
      }
    } catch (error) {
      console.error('Failed to get tool collection data:', error);
      throw error;
    }
  }
}