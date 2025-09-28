/**
 * MongoDB Triple Store Adapter
 * Wraps MongoDB storage provider to provide triple store interface
 */

import { StorageProvider } from '@legion/storage';
import { ResourceManager } from '@legion/resource-manager';

export class MongoDBTripleStore {
  constructor(config = {}) {
    this.config = {
      uri: config.uri || process.env.MONGODB_URL || 'mongodb://localhost:27017',
      database: config.database || 'wordnet_ontology',
      collection: config.collection || 'triples',
      ...config
    };
    this.storageProvider = null;
    this.mongoProvider = null;
    this.db = null;
    this.triplesCollection = null;
  }

  async connect() {
    try {
      // Get ResourceManager singleton
      const resourceManager = await ResourceManager.getInstance();
      
      // Create storage provider with MongoDB configuration
      this.storageProvider = await StorageProvider.create(resourceManager, {
        provider: 'mongodb',
        connectionString: this.config.uri,
        database: this.config.database
      });
      
      // Get the MongoDB provider
      this.mongoProvider = this.storageProvider.getProvider('mongodb');
      
      // Access the database and collection directly
      this.db = this.mongoProvider.db;
      this.triplesCollection = this.db.collection(this.config.collection);
      
      // Create indices for efficient querying
      await this.createIndices();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.mongoProvider) {
      await this.mongoProvider.disconnect();
    }
    return true;
  }

  async createIndices() {
    if (!this.triplesCollection) return;
    
    try {
      await this.triplesCollection.createIndex({ subject: 1, predicate: 1, object: 1 });
      await this.triplesCollection.createIndex({ subject: 1 });
      await this.triplesCollection.createIndex({ predicate: 1 });
      await this.triplesCollection.createIndex({ object: 1 });
    } catch (error) {
      console.warn('Index creation warning:', error.message);
    }
  }

  async addTriple(triple) {
    if (!this.triplesCollection) {
      throw new Error('Not connected to database');
    }
    
    // Ensure triple has all required fields
    if (!triple || !triple.subject || !triple.predicate || !triple.object) {
      throw new Error('Triple must have subject, predicate, and object');
    }
    
    try {
      // Check if triple already exists
      const existing = await this.triplesCollection.findOne({
        subject: triple.subject,
        predicate: triple.predicate,
        object: triple.object
      });
      
      if (!existing) {
        await this.triplesCollection.insertOne({
          subject: triple.subject,
          predicate: triple.predicate,
          object: triple.object,
          metadata: triple.metadata || {},
          timestamp: new Date()
        });
      }
      
      return true;
    } catch (error) {
      console.error('Failed to add triple:', error);
      throw error;
    }
  }

  async findTriples(subject = null, predicate = null, object = null) {
    if (!this.triplesCollection) {
      throw new Error('Not connected to database');
    }
    
    const query = {};
    if (subject !== null) query.subject = subject;
    if (predicate !== null) query.predicate = predicate;
    if (object !== null) query.object = object;
    
    try {
      const results = await this.triplesCollection.find(query).toArray();
      return results.map(doc => ({
        subject: doc.subject,
        predicate: doc.predicate,
        object: doc.object,
        metadata: doc.metadata || {}
      }));
    } catch (error) {
      console.error('Failed to find triples:', error);
      throw error;
    }
  }

  async size() {
    if (!this.triplesCollection) {
      throw new Error('Not connected to database');
    }
    
    try {
      return await this.triplesCollection.countDocuments();
    } catch (error) {
      console.error('Failed to count triples:', error);
      throw error;
    }
  }

  async clear() {
    if (!this.triplesCollection) {
      throw new Error('Not connected to database');
    }
    
    try {
      await this.triplesCollection.deleteMany({});
      return true;
    } catch (error) {
      console.error('Failed to clear triples:', error);
      throw error;
    }
  }
}

// Export default instance factory
export function createMongoDBTripleStore(config) {
  return new MongoDBTripleStore(config);
}