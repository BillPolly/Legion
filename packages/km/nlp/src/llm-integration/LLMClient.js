/**
 * LLMClient - Abstract base class for LLM interactions
 * 
 * Provides standardized interface for LLM interactions across the system.
 * All LLM providers must implement this interface.
 */
export class LLMClient {
  constructor(options = {}) {
    this.options = {
      timeout: 30000, // 30 seconds default timeout
      retries: 3,
      ...options
    };
  }

  /**
   * Extract entities from text with schema guidance
   * @param {string} text - Input text to process
   * @param {Object} schema - Entity schema for guidance
   * @param {Object} context - Processing context
   * @returns {Promise<Object>} - Entity extraction result
   */
  async extractEntities(text, schema, context) {
    throw new Error('extractEntities must be implemented by subclass');
  }

  /**
   * Extract relationships between entities with ontological constraints
   * @param {string} text - Input text to process
   * @param {Array} entities - Previously identified entities
   * @param {Array} relationshipTypes - Available relationship types
   * @returns {Promise<Object>} - Relationship extraction result
   */
  async extractRelationships(text, entities, relationshipTypes) {
    throw new Error('extractRelationships must be implemented by subclass');
  }

  /**
   * Assess quality of extraction results
   * @param {string} original - Original text
   * @param {Array} extracted - Extracted KG triples
   * @param {string} paraphrase - Generated paraphrase
   * @returns {Promise<Object>} - Quality assessment result
   */
  async assessQuality(original, extracted, paraphrase) {
    throw new Error('assessQuality must be implemented by subclass');
  }

  /**
   * Compare semantic similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {Promise<Object>} - Similarity comparison result
   */
  async compareSemantics(text1, text2) {
    throw new Error('compareSemantics must be implemented by subclass');
  }

  /**
   * Disambiguate entity references using context
   * @param {string} entity - Entity mention to disambiguate
   * @param {Object} context - Disambiguation context
   * @param {Array} candidates - Candidate entities
   * @returns {Promise<Object>} - Disambiguation result
   */
  async disambiguate(entity, context, candidates) {
    throw new Error('disambiguate must be implemented by subclass');
  }

  /**
   * Validate input parameters for LLM calls
   * @param {string} text - Input text
   * @param {string} method - Method name for error reporting
   */
  validateInput(text, method) {
    if (typeof text !== 'string') {
      throw new Error(`${method}: text must be a string`);
    }
  }

  /**
   * Handle errors with retry logic
   * @param {Function} operation - Operation to retry
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise<any>} - Operation result
   */
  async withRetry(operation, maxRetries = this.options.retries) {
    let lastError;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry on validation errors
        if (error.message.includes('must be a string') || 
            error.message.includes('must be implemented')) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Apply timeout to async operations
   * @param {Promise} promise - Promise to timeout
   * @param {number} timeoutMs - Timeout in milliseconds
   * @returns {Promise<any>} - Promise with timeout
   */
  async withTimeout(promise, timeoutMs = this.options.timeout) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
}
