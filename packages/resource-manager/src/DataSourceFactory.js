/**
 * DataSourceFactory - Factory for creating DataSource instances
 * 
 * Manages creation and initialization of different DataSource types
 */

import { Neo4jDataSource } from './datasources/Neo4jDataSource.js';

export class DataSourceFactory {
  /**
   * Create a DataSource instance
   * @param {string} type - Type of DataSource ('neo4j', 'mongodb', etc.)
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
        throw new Error('MongoDB DataSource not yet implemented');
        
      case 'qdrant':
      case 'vector':
        throw new Error('Qdrant DataSource not yet implemented');
        
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
}