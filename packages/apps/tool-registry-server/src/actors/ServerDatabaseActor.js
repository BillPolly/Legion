/**
 * ServerDatabaseActor
 * Server-side actor for database operations
 * Uses singleton ToolRegistry's provider
 */

export class ServerDatabaseActor {
  constructor(registryService) {
    this.registryService = registryService;
    this.remoteActor = null;
  }

  setRemoteActor(remoteActor) {
    this.remoteActor = null;
  }

  async receive(message) {
    const { type, data } = message;
    
    try {
      switch (type) {
        case 'db:query':
          await this.query(data.collection, data.query, data.options);
          break;
          
        case 'db:insert':
          await this.insert(data.collection, data.documents);
          break;
          
        case 'db:update':
          await this.update(data.collection, data.query, data.update, data.options);
          break;
          
        case 'db:delete':
          await this.delete(data.collection, data.query);
          break;
          
        case 'db:count':
          await this.count(data.collection, data.query);
          break;
          
        case 'db:aggregate':
          await this.aggregate(data.collection, data.pipeline);
          break;
          
        case 'db:collections':
          await this.listCollections();
          break;
          
        case 'db:stats':
          await this.getDatabaseStats();
          break;
          
        default:
          console.log('Unknown database message:', type);
      }
    } catch (error) {
      console.error('Database operation error:', error);
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:error',
          data: { 
            error: error.message,
            operation: type,
            originalData: data
          }
        });
      }
    }
  }

  /**
   * Get the database connection from provider
   */
  getDatabase() {
    const provider = this.registryService.getProvider();
    if (!provider || !provider.db) {
      throw new Error('Database not available from provider');
    }
    return provider.db;
  }

  async query(collection, query = {}, options = {}) {
    try {
      console.log(`Querying ${collection}:`, query);
      
      const db = this.getDatabase();
      const cursor = db.collection(collection).find(query);
      
      // Apply options
      if (options.limit) cursor.limit(options.limit);
      if (options.skip) cursor.skip(options.skip);
      if (options.sort) cursor.sort(options.sort);
      
      const results = await cursor.toArray();
      
      console.log(`Found ${results.length} documents`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:queryResult',
          data: {
            collection,
            results,
            count: results.length
          }
        });
      }
    } catch (error) {
      console.error(`Query failed for ${collection}:`, error);
      throw error;
    }
  }

  async insert(collection, documents) {
    try {
      console.log(`Inserting ${documents.length} documents into ${collection}`);
      
      const db = this.getDatabase();
      const result = await db.collection(collection).insertMany(
        Array.isArray(documents) ? documents : [documents]
      );
      
      console.log(`Inserted ${result.insertedCount} documents`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:insertResult',
          data: {
            collection,
            insertedCount: result.insertedCount,
            insertedIds: result.insertedIds
          }
        });
      }
    } catch (error) {
      console.error(`Insert failed for ${collection}:`, error);
      throw error;
    }
  }

  async update(collection, query, update, options = {}) {
    try {
      console.log(`Updating ${collection}:`, { query, update });
      
      const db = this.getDatabase();
      const result = options.multi
        ? await db.collection(collection).updateMany(query, update, options)
        : await db.collection(collection).updateOne(query, update, options);
      
      console.log(`Updated ${result.modifiedCount} documents`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:updateResult',
          data: {
            collection,
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
          }
        });
      }
    } catch (error) {
      console.error(`Update failed for ${collection}:`, error);
      throw error;
    }
  }

  async delete(collection, query) {
    try {
      console.log(`Deleting from ${collection}:`, query);
      
      const db = this.getDatabase();
      const result = await db.collection(collection).deleteMany(query);
      
      console.log(`Deleted ${result.deletedCount} documents`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:deleteResult',
          data: {
            collection,
            deletedCount: result.deletedCount
          }
        });
      }
    } catch (error) {
      console.error(`Delete failed for ${collection}:`, error);
      throw error;
    }
  }

  async count(collection, query = {}) {
    try {
      console.log(`Counting documents in ${collection}:`, query);
      
      const db = this.getDatabase();
      const count = await db.collection(collection).countDocuments(query);
      
      console.log(`Count: ${count}`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:countResult',
          data: {
            collection,
            count
          }
        });
      }
    } catch (error) {
      console.error(`Count failed for ${collection}:`, error);
      throw error;
    }
  }

  async aggregate(collection, pipeline) {
    try {
      console.log(`Running aggregation on ${collection}`);
      
      const db = this.getDatabase();
      const results = await db.collection(collection)
        .aggregate(pipeline)
        .toArray();
      
      console.log(`Aggregation returned ${results.length} results`);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:aggregateResult',
          data: {
            collection,
            results
          }
        });
      }
    } catch (error) {
      console.error(`Aggregation failed for ${collection}:`, error);
      throw error;
    }
  }

  async listCollections() {
    try {
      console.log('Listing database collections');
      
      const db = this.getDatabase();
      const collections = await db.listCollections().toArray();
      
      const collectionNames = collections.map(c => c.name);
      console.log(`Found ${collectionNames.length} collections:`, collectionNames);
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:collections',
          data: {
            collections: collectionNames
          }
        });
      }
    } catch (error) {
      console.error('Failed to list collections:', error);
      throw error;
    }
  }

  async getDatabaseStats() {
    try {
      console.log('Getting database statistics');
      
      const db = this.getDatabase();
      
      // Get stats for main collections
      const collections = ['modules', 'tools', 'tool_perspectives'];
      const stats = {};
      
      for (const collection of collections) {
        try {
          const count = await db.collection(collection).countDocuments();
          const collStats = await db.collection(collection).stats();
          
          stats[collection] = {
            count,
            size: collStats.size,
            avgObjSize: collStats.avgObjSize,
            storageSize: collStats.storageSize,
            indexes: collStats.nindexes
          };
        } catch (error) {
          console.error(`Failed to get stats for ${collection}:`, error);
          stats[collection] = { error: error.message };
        }
      }
      
      // Get database-wide stats
      const dbStats = await db.stats();
      
      const fullStats = {
        database: db.databaseName,
        collections: stats,
        totals: {
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          collections: dbStats.collections
        },
        timestamp: new Date().toISOString()
      };
      
      console.log('Database stats collected');
      
      if (this.remoteActor) {
        this.remoteActor.receive({
          type: 'db:stats',
          data: fullStats
        });
      }
    } catch (error) {
      console.error('Failed to get database stats:', error);
      throw error;
    }
  }
}