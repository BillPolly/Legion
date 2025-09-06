import { InMemoryTripleStore } from './InMemoryTripleStore.js';
import { FileSystemTripleStore } from './FileSystemTripleStore.js';
import { GitHubTripleStore } from './GitHubTripleStore.js';
import { SQLTripleStore } from './SQLTripleStore.js';
import { MongoTripleStore } from './MongoTripleStore.js';
import { GraphDBTripleStore } from './GraphDBTripleStore.js';
import { RemoteTripleStore } from './RemoteTripleStore.js';
import { ValidationError } from './StorageError.js';

/**
 * Factory for creating storage providers based on configuration
 */
export class StorageConfig {
  /**
   * Create a storage provider based on configuration
   * @param {Object} config - Storage configuration
   * @returns {ITripleStore} - Storage provider instance
   */
  static createStore(config = {}) {
    // Default to in-memory storage
    if (!config || !config.type) {
      return new InMemoryTripleStore();
    }

    // Validate configuration
    this.validateConfig(config);

    switch (config.type) {
      case 'memory':
        return new InMemoryTripleStore();
      
      case 'file':
        return new FileSystemTripleStore(config.path, config);
      
      case 'github':
        return new GitHubTripleStore(config.repo, config.path, config);
      
      case 'sql':
        return new SQLTripleStore(config.connection, config);
      
      case 'mongo':
        return new MongoTripleStore(config.connection, config);
      
      case 'graphdb':
        return new GraphDBTripleStore(config.connection, config);
      
      case 'remote':
        return new RemoteTripleStore(config.endpoint, config);
      
      default:
        throw new ValidationError(`Unknown storage type: ${config.type}. Supported types: memory, file, github, sql, mongo, graphdb, remote`);
    }
  }

  /**
   * Validate storage configuration
   * @param {Object} config - Configuration to validate
   */
  static validateConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Configuration must be an object');
    }

    if (!config.type || typeof config.type !== 'string') {
      throw new ValidationError('Configuration must have a valid type string');
    }

    const supportedTypes = ['memory', 'file', 'github', 'sql', 'mongo', 'graphdb', 'remote'];
    if (!supportedTypes.includes(config.type)) {
      throw new ValidationError(`Unsupported storage type: ${config.type}. Supported types: ${supportedTypes.join(', ')}`);
    }

    // Type-specific validation
    switch (config.type) {
      case 'file':
        if (!config.path) {
          throw new ValidationError('File storage requires a "path" property');
        }
        if (config.format && !['json', 'turtle', 'ntriples'].includes(config.format)) {
          throw new ValidationError('File storage format must be one of: json, turtle, ntriples');
        }
        break;

      case 'github':
        if (!config.repo) {
          throw new ValidationError('GitHub storage requires a "repo" property');
        }
        if (!config.path) {
          throw new ValidationError('GitHub storage requires a "path" property');
        }
        if (!config.token) {
          throw new ValidationError('GitHub storage requires a "token" property');
        }
        break;

      case 'sql':
        if (!config.connection) {
          throw new ValidationError('SQL storage requires a "connection" property');
        }
        break;

      case 'mongo':
        if (!config.connection) {
          throw new ValidationError('MongoDB storage requires a "connection" property');
        }
        break;

      case 'graphdb':
        if (!config.connection) {
          throw new ValidationError('GraphDB storage requires a "connection" property');
        }
        if (!config.database || !['neo4j', 'arangodb'].includes(config.database)) {
          throw new ValidationError('GraphDB storage requires a "database" property (neo4j or arangodb)');
        }
        break;

      case 'remote':
        if (!config.endpoint) {
          throw new ValidationError('Remote storage requires an "endpoint" property');
        }
        break;
    }
  }

  /**
   * Get default configuration for a storage type
   * @param {string} type - Storage type
   * @returns {Object} - Default configuration
   */
  static getDefaultConfig(type) {
    switch (type) {
      case 'memory':
        return { type: 'memory' };

      case 'file':
        return {
          type: 'file',
          path: './data/knowledge-graph.json',
          format: 'json',
          autoSave: true,
          watchForChanges: false
        };

      case 'github':
        return {
          type: 'github',
          repo: 'username/knowledge-graph',
          path: 'data/kg.json',
          token: process.env.GITHUB_TOKEN,
          branch: 'main',
          conflictResolution: 'merge'
        };

      case 'sql':
        return {
          type: 'sql',
          connection: process.env.DATABASE_URL || 'sqlite::memory:',
          table: 'triples',
          poolSize: 10,
          enableTransactions: true
        };

      case 'mongo':
        return {
          type: 'mongo',
          connection: process.env.MONGODB_URL || 'mongodb://localhost:27017/kg',
          collection: 'triples',
          enableSharding: false
        };

      case 'graphdb':
        return {
          type: 'graphdb',
          database: 'neo4j',
          connection: process.env.NEO4J_URL || 'bolt://localhost:7687',
          username: process.env.NEO4J_USERNAME,
          password: process.env.NEO4J_PASSWORD
        };

      case 'remote':
        return {
          type: 'remote',
          endpoint: process.env.KG_API_ENDPOINT,
          apiKey: process.env.KG_API_KEY,
          timeout: 30000,
          retries: 3
        };

      default:
        throw new ValidationError(`Unknown storage type: ${type}`);
    }
  }

  /**
   * Create storage from environment variables
   * @returns {ITripleStore} - Storage provider instance
   */
  static createFromEnvironment() {
    const type = process.env.KG_STORAGE_TYPE || 'memory';
    const config = this.getDefaultConfig(type);
    
    // Override with environment-specific values
    switch (type) {
      case 'file':
        if (process.env.KG_FILE_PATH) config.path = process.env.KG_FILE_PATH;
        if (process.env.KG_FILE_FORMAT) config.format = process.env.KG_FILE_FORMAT;
        if (process.env.KG_AUTO_SAVE) config.autoSave = process.env.KG_AUTO_SAVE === 'true';
        break;

      case 'github':
        if (process.env.KG_GITHUB_REPO) config.repo = process.env.KG_GITHUB_REPO;
        if (process.env.KG_GITHUB_PATH) config.path = process.env.KG_GITHUB_PATH;
        if (process.env.KG_GITHUB_BRANCH) config.branch = process.env.KG_GITHUB_BRANCH;
        break;

      case 'sql':
        if (process.env.KG_SQL_TABLE) config.table = process.env.KG_SQL_TABLE;
        if (process.env.KG_SQL_POOL_SIZE) config.poolSize = parseInt(process.env.KG_SQL_POOL_SIZE);
        break;

      case 'mongo':
        if (process.env.KG_MONGO_COLLECTION) config.collection = process.env.KG_MONGO_COLLECTION;
        break;
    }

    return this.createStore(config);
  }
}
