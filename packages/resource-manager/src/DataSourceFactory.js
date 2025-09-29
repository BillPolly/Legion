/**
 * DataSourceFactory - Factory for creating DataSource instances
 * 
 * Manages creation and initialization of different DataSource types
 */

import { Neo4jDataSource } from './datasources/Neo4jDataSource.js';
import { NomicDataSource } from './datasources/NomicDataSource.js';
import { QdrantDataSource } from './datasources/QdrantDataSource.js';
import { MongoDataSource } from './datasources/MongoDataSource.js';

export class DataSourceFactory {
  /**
   * Create a DataSource instance
   * @param {string} type - Type of DataSource ('neo4j', 'mongodb', 'nomic', 'qdrant', etc.)
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<Object>} Initialized DataSource instance
   */
  static async create(type, resourceManager) {
    let dataSource;
    
    switch (type.toLowerCase()) {
      case 'neo4j':
      case 'graph':
        dataSource = new Neo4jDataSource(resourceManager);
        break;
        
      case 'mongodb':
      case 'document':
        dataSource = new MongoDataSource({ resourceManager });
        break;
        
      case 'qdrant':
      case 'vector':
        dataSource = new QdrantDataSource(resourceManager);
        break;
        
      case 'nomic':
      case 'embedding':
      case 'embeddings':
        dataSource = new NomicDataSource(resourceManager);
        break;
        
      default:
        throw new Error(`Unknown DataSource type: ${type}`);
    }
    
    // Initialize the DataSource
    await dataSource.initialize();
    
    return dataSource;
  }
  
  /**
   * Create Neo4j DataSource
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<Neo4jDataSource>} Initialized Neo4j DataSource
   */
  static async createNeo4j(resourceManager) {
    return this.create('neo4j', resourceManager);
  }
  
  /**
   * Create Nomic DataSource
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<NomicDataSource>} Initialized Nomic DataSource
   */
  static async createNomic(resourceManager) {
    return this.create('nomic', resourceManager);
  }
  
  /**
   * Create Qdrant DataSource
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<QdrantDataSource>} Initialized Qdrant DataSource
   */
  static async createQdrant(resourceManager) {
    return this.create('qdrant', resourceManager);
  }

  /**
   * Create MongoDB DataSource
   * @param {ResourceManager} resourceManager - ResourceManager instance
   * @returns {Promise<MongoDataSource>} Initialized MongoDB DataSource
   */
  static async createMongo(resourceManager) {
    return this.create('mongodb', resourceManager);
  }
}