/**
 * ServerDatabaseActor - Server-side actor for database operations
 */

export class ServerDatabaseActor {
  constructor(storageProvider, mongoProvider) {
    this.storageProvider = storageProvider;
    this.mongoProvider = mongoProvider;
    this.remoteActor = null;
    this.mongoDb = null;
    
    // Get MongoDB database instance
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
}