/**
 * SemanticInventoryService - Query interface for DRS pipeline
 *
 * Provides semantic search methods to discover WordNet symbols:
 * - Entity types (PERSON, LOCATION, etc.)
 * - Semantic roles (Agent, Theme, etc.)
 * - Unary predicates (adjectives and nouns)
 * - Binary relations (in, on, before, etc.)
 *
 * Uses vector search on pre-indexed Qdrant collections.
 */

export class SemanticInventoryService {
  /**
   * Create a new SemanticInventoryService
   * @param {Object} resourceManager - The ResourceManager instance
   */
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.semanticSearch = null;
    this.initialized = false;
  }

  /**
   * Initialize the service by getting resources from ResourceManager
   * @throws {Error} If semantic search not available or collections not indexed (FAIL FAST)
   */
  async initialize() {
    // Get semantic search provider from ResourceManager
    this.semanticSearch = await this.resourceManager.get('semanticSearch');
    if (!this.semanticSearch) {
      throw new Error('Semantic search provider not available from ResourceManager');
    }

    // Ensure collections are indexed (FAIL FAST if not)
    await this._ensureCollectionsIndexed();

    this.initialized = true;
  }

  /**
   * Check if service is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Search for entity types based on input text
   * @param {string} text - Input text to search against
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results to return (default: 20)
   * @param {number} options.threshold - Similarity threshold 0-1 (default: 0.6)
   * @returns {Promise<string[]>} Array of entity type labels (e.g., ["PERSON", "LOCATION"])
   * @throws {Error} If not initialized
   */
  async semanticSearchEntityTypes(text, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const { limit = 20, threshold = 0.6 } = options;

    const results = await this.semanticSearch.semanticSearch(
      'wordnet_entity_types',
      text,
      { limit, threshold }
    );

    // Extract labels only
    return results.map(r => r.document.label);
  }

  /**
   * Search for relation types (roles, predicates, relations) based on input text
   * @param {string} text - Input text to search against
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum results per collection (default: 50)
   * @param {number} options.threshold - Similarity threshold 0-1 (default: 0.5)
   * @returns {Promise<Object>} RelationInventory with roles, unaryPredicates, binaryRelations
   * @throws {Error} If not initialized
   */
  async semanticSearchRelationTypes(text, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const { limit = 50, threshold = 0.5 } = options;

    // Query each collection in parallel
    // Note: wordnet_predicates collection may not exist (deferred in Phase 2), so handle gracefully
    const [roleResults, predicateResults, relationResults] = await Promise.all([
      this.semanticSearch.semanticSearch('wordnet_roles', text, { limit: 30, threshold }),
      this.semanticSearch.semanticSearch('wordnet_predicates', text, { limit: 50, threshold }).catch(() => []),
      this.semanticSearch.semanticSearch('wordnet_relations', text, { limit: 30, threshold })
    ]);

    return {
      roles: roleResults.map(r => r.document.label),
      unaryPredicates: predicateResults.map(r => r.document.label),
      binaryRelations: relationResults.map(r => r.document.label)
    };
  }

  /**
   * Get statistics about indexed collections
   * @returns {Promise<Object>} Collection counts
   * @throws {Error} If not initialized
   */
  async getStats() {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const [entityTypes, semanticRoles, unaryPredicates, binaryRelations] = await Promise.all([
      this.semanticSearch.count('wordnet_entity_types'),
      this.semanticSearch.count('wordnet_roles'),
      this.semanticSearch.count('wordnet_predicates'),
      this.semanticSearch.count('wordnet_relations')
    ]);

    return {
      entityTypes,
      semanticRoles,
      unaryPredicates,
      binaryRelations,
      total: entityTypes + semanticRoles + unaryPredicates + binaryRelations
    };
  }

  /**
   * Ensure all required collections are indexed
   * @private
   * @throws {Error} If any collection is empty (FAIL FAST)
   */
  async _ensureCollectionsIndexed() {
    const collections = [
      'wordnet_entity_types',
      'wordnet_roles',
      'wordnet_relations'
      // Note: wordnet_predicates is optional (deferred in Phase 2)
    ];

    for (const collection of collections) {
      const count = await this.semanticSearch.count(collection);
      if (count === 0) {
        throw new Error(
          `Collection ${collection} is not indexed. ` +
          `Run 'npm run index-semantic-search' to index collections first.`
        );
      }
    }
  }
}
