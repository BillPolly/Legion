/**
 * MongoDB connection management for the Absolute Minimal Capability Model
 */

import { MongoClient, Db, Collection } from 'mongodb';
import { StorageConfig } from './ICapabilityStorage';

export class MongoConnection {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Connect to MongoDB
   */
  async connect(): Promise<void> {
    if (this.client) {
      return; // Already connected
    }

    try {
      this.client = new MongoClient(this.config.connectionString, {
        maxPoolSize: this.config.options?.maxPoolSize || 10,
        serverSelectionTimeoutMS: this.config.options?.serverSelectionTimeoutMS || 5000,
        socketTimeoutMS: this.config.options?.socketTimeoutMS || 45000,
      });

      await this.client.connect();
      this.db = this.client.db(this.config.database);
      
      console.log(`Connected to MongoDB: ${this.config.database}`);
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      console.log('Disconnected from MongoDB');
    }
  }

  /**
   * Get the database instance
   */
  getDatabase(): Db {
    if (!this.db) {
      throw new Error('Not connected to MongoDB. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Get the capabilities collection
   */
  getCollection(): Collection {
    const db = this.getDatabase();
    return db.collection(this.config.collection);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): {
    connected: boolean;
    database: string;
    collection: string;
  } {
    return {
      connected: this.isConnected(),
      database: this.config.database,
      collection: this.config.collection,
    };
  }

  /**
   * Test the connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.db) {
        return false;
      }
      
      // Simple ping to test connection
      await this.db.admin().ping();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<any> {
    const db = this.getDatabase();
    return await db.stats();
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<any> {
    const db = this.getDatabase();
    const collectionName = this.config.collection;
    return await db.collection(collectionName).aggregate([{ $collStats: { storageStats: {} } }]).toArray();
  }
}

/**
 * Default configuration factory
 */
export function createDefaultConfig(overrides: Partial<StorageConfig> = {}): StorageConfig {
  return {
    connectionString: process.env.MONGODB_URL || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'kg_new',
    collection: 'capabilities',
    options: {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    },
    ...overrides,
  };
}
