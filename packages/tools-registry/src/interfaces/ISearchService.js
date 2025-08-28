/**
 * ISearchService - Interface for Search Operations
 * 
 * Clean Architecture: Application Layer Interface
 * Defines contract for text and semantic search without implementation details
 */

export class ISearchService {
  /**
   * Search tools using text search
   * @param {string} query - Search query
   * @param {Object} options - Search options (filters, limits)
   * @returns {Promise<Array>} Array of matching tools
   */
  async searchTools(query, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Search tools using semantic/vector search
   * @param {string} query - Search query
   * @param {Object} options - Search options (similarity threshold, limit)
   * @returns {Promise<Array>} Array of matching tools with similarity scores
   */
  async semanticSearch(query, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Find similar tools to a given tool
   * @param {string} toolName - Name of tool to find similar tools for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of similar tools
   */
  async findSimilarTools(toolName, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Generate perspectives for tools
   * @param {Object} options - Generation options (module filter, force regenerate)
   * @returns {Promise<Object>} Generation result with counts and errors
   */
  async generatePerspectives(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Generate embeddings for perspectives
   * @param {Object} options - Generation options (batch size, filters)
   * @returns {Promise<Object>} Generation result with counts and errors
   */
  async generateEmbeddings(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Index vectors in vector store
   * @param {Object} options - Indexing options
   * @returns {Promise<Object>} Indexing result
   */
  async indexVectors(options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Get search statistics
   * @returns {Promise<Object>} Search statistics
   */
  async getSearchStatistics() {
    throw new Error('Method must be implemented by concrete class');
  }

  /**
   * Test semantic search functionality
   * @param {Array} queries - Test queries (optional)
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async testSemanticSearch(queries = null, options = {}) {
    throw new Error('Method must be implemented by concrete class');
  }
}