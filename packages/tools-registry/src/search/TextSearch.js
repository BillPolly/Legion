/**
 * TextSearch - Text-based search functionality for tools
 * 
 * Provides text search capabilities using MongoDB text indexes
 * Supports full-text search, field-specific search, and filtered search
 * 
 * No mocks, no fallbacks - real implementation only
 */

import { TextSearchError } from '../errors/index.js';
import { Logger } from '../utils/Logger.js';

export class TextSearch {
  constructor(options = {}) {
    this.options = {
      indexName: 'tool_text_index',
      verbose: false,
      ...options
    };
    
    this.databaseStorage = options.databaseStorage;
    this.logger = Logger.create('TextSearch', { verbose: this.options.verbose });
    
    if (!this.databaseStorage) {
      throw new TextSearchError(
        'DatabaseStorage is required',
        'INIT_ERROR'
      );
    }
  }
  
  /**
   * Initialize text search by creating necessary indexes
   */
  async initialize() {
    try {
      // Check if database is connected
      if (!this.databaseStorage.isConnected) {
        throw new TextSearchError(
          'Database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      const collection = this.databaseStorage.getCollection('tools');
      
      // Try to check for existing indexes - if collection doesn't exist, skip gracefully
      let textIndexExists = false;
      let existingTextIndexName = null;
      try {
        const indexes = await collection.indexes();
        // Check for ANY text index, not just one with our preferred name
        const textIndex = indexes.find(idx => idx.key && idx.key._fts === 'text');
        if (textIndex) {
          textIndexExists = true;
          existingTextIndexName = textIndex.name;
          // Update our index name to use the existing one
          this.options.indexName = existingTextIndexName;
          this.logger.verbose(`Using existing text index: ${existingTextIndexName}`);
        }
      } catch (error) {
        if (error.code === 26 || error.message.includes('ns does not exist')) {
          this.logger.verbose('Collection does not exist yet, index will be created when data is added');
          return; // Skip index creation for non-existent collection
        } else {
          throw error;
        }
      }
      
      if (!textIndexExists) {
        try {
          // Create text index on name and description fields
          await collection.createIndex(
            { name: 'text', description: 'text' },
            { 
              name: this.options.indexName,
              weights: {
                name: 10,  // Give more weight to name matches
                description: 5
              }
            }
          );
          
          this.logger.verbose(`Created text index: ${this.options.indexName}`);
        } catch (indexError) {
          // If collection doesn't exist yet, that's fine - index will be created when needed
          if (indexError.code === 26 || indexError.message.includes('ns does not exist')) {
            this.logger.verbose('Collection does not exist yet, index will be created when data is added');
          } else {
            throw indexError;
          }
        }
      }
    } catch (error) {
      throw new TextSearchError(
        `Failed to initialize text search: ${error.message}`,
        'INIT_ERROR',
        { originalError: error }
      );
    }
  }
  
  /**
   * Search tools using text query
   * @param {string} query - Text query to search for
   * @param {Object} options - Search options
   * @returns {Array} Array of matching tools
   */
  async search(query, options = {}) {
    try {
      // Check if database is connected
      if (!this.databaseStorage.isConnected) {
        throw new TextSearchError(
          'Database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      const collection = this.databaseStorage.getCollection('tools');
      
      // Check if we have any data and need to create index
      await this._ensureTextIndex(collection);
      
      // Build text search query
      let searchQuery = { $text: { $search: query } };
      
      // Build options
      let findOptions = {};
      
      if (options.sortByScore) {
        // Include text score in projection and sort by it
        findOptions.projection = { 
          score: { $meta: 'textScore' },
          name: 1,
          description: 1,
          moduleName: 1,
          inputSchema: 1,
          outputSchema: 1
        };
        
        // Create cursor with sort
        const cursor = collection.find(searchQuery, findOptions)
          .sort({ score: { $meta: 'textScore' } });
        
        if (options.limit) {
          cursor.limit(options.limit);
        }
        
        return await cursor.toArray();
      }
      
      // Regular search without scoring
      let cursor = collection.find(searchQuery);
      
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }
      
      const results = await cursor.toArray();
      return results;
      
    } catch (error) {
      if (error instanceof TextSearchError) {
        throw error;
      }
      
      throw new TextSearchError(
        `Search failed: ${error.message}`,
        'SEARCH_ERROR',
        { query, options, originalError: error }
      );
    }
  }
  
  /**
   * Search by specific field
   * @param {string} field - Field to search in
   * @param {string|RegExp} value - Value to search for
   * @param {Object} options - Search options
   * @returns {Array} Array of matching tools
   */
  async searchByField(field, value, options = {}) {
    try {
      // Check if database is connected
      if (!this.databaseStorage.isConnected) {
        throw new TextSearchError(
          'Database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      const collection = this.databaseStorage.getCollection('tools');
      
      // Build field search query
      let searchQuery = {};
      
      if (value instanceof RegExp) {
        searchQuery[field] = value;
      } else {
        // Use case-insensitive regex for string values
        searchQuery[field] = { $regex: value, $options: 'i' };
      }
      
      let cursor = collection.find(searchQuery);
      
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }
      
      const results = await cursor.toArray();
      return results;
      
    } catch (error) {
      if (error instanceof TextSearchError) {
        throw error;
      }
      
      throw new TextSearchError(
        `Field search failed: ${error.message}`,
        'SEARCH_ERROR',
        { field, value, options, originalError: error }
      );
    }
  }
  
  /**
   * Search with additional filters
   * @param {string} query - Text query to search for
   * @param {Object} filters - Additional filters to apply
   * @param {Object} options - Search options
   * @returns {Array} Array of matching tools
   */
  async searchWithFilters(query, filters = {}, options = {}) {
    try {
      // Check if database is connected
      if (!this.databaseStorage.isConnected) {
        throw new TextSearchError(
          'Database not connected',
          'CONNECTION_ERROR'
        );
      }
      
      const collection = this.databaseStorage.getCollection('tools');
      
      // Combine text search with filters
      let searchQuery = {
        $text: { $search: query },
        ...filters
      };
      
      let cursor = collection.find(searchQuery);
      
      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }
      
      if (options.sortByScore) {
        cursor = cursor.sort({ score: { $meta: 'textScore' } });
      }
      
      const results = await cursor.toArray();
      return results;
      
    } catch (error) {
      if (error instanceof TextSearchError) {
        throw error;
      }
      
      throw new TextSearchError(
        `Filtered search failed: ${error.message}`,
        'SEARCH_ERROR',
        { query, filters, options, originalError: error }
      );
    }
  }
  
  /**
   * Rebuild text index
   */
  async rebuildIndex() {
    try {
      const collection = this.databaseStorage.getCollection('tools');
      
      // Drop existing index
      try {
        await collection.dropIndex(this.options.indexName);
      } catch (error) {
        // Index might not exist, ignore error
      }
      
      // Create new index
      await collection.createIndex(
        { name: 'text', description: 'text' },
        { 
          name: this.options.indexName,
          weights: {
            name: 10,
            description: 5
          }
        }
      );
      
      this.logger.verbose(`Rebuilt text index: ${this.options.indexName}`);
      
    } catch (error) {
      throw new TextSearchError(
        `Failed to rebuild index: ${error.message}`,
        'INDEX_ERROR',
        { originalError: error }
      );
    }
  }
  
  /**
   * Ensure text index exists when data is present
   * @private
   * @param {Collection} collection - MongoDB collection
   */
  async _ensureTextIndex(collection) {
    try {
      // Check if collection has documents
      const docCount = await collection.countDocuments({}, { limit: 1 });
      if (docCount === 0) {
        return; // No data, no need for index yet
      }

      // Check if index exists
      const indexes = await collection.indexes();
      const indexExists = indexes.some(idx => idx.name === this.options.indexName);
      
      if (!indexExists) {
        // Create the index now that we have data
        await collection.createIndex(
          { name: 'text', description: 'text' },
          { 
            name: this.options.indexName,
            weights: {
              name: 10,
              description: 5
            }
          }
        );
        
        this.logger.verbose(`Created text index on-demand: ${this.options.indexName}`);
      }
    } catch (error) {
      // If index creation fails, log warning but don't fail the search
      this.logger.warn(`Failed to ensure text index: ${error.message}`);
    }
  }

  /**
   * Get index information
   * @returns {Object} Index information
   */
  async getIndexInfo() {
    try {
      const collection = this.databaseStorage.getCollection('tools');
      const indexes = await collection.indexes();
      
      const textIndex = indexes.find(idx => idx.name === this.options.indexName);
      
      if (textIndex) {
        return {
          exists: true,
          name: textIndex.name,
          fields: Object.keys(textIndex.key || {}),
          weights: textIndex.weights
        };
      }
      
      return {
        exists: false,
        fields: []
      };
      
    } catch (error) {
      throw new TextSearchError(
        `Failed to get index info: ${error.message}`,
        'INDEX_ERROR',
        { originalError: error }
      );
    }
  }
}