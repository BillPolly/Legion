/**
 * SemanticInventoryService - Query API for semantic symbol selection
 *
 * Provides semantic search over specialized Qdrant collections to retrieve
 * closed symbol inventories for DRS (Discourse Representation Structure) pipeline.
 *
 * Collections:
 * - wordnet_entity_types: Entity categories (PERSON, LOCATION, etc.)
 * - wordnet_roles: Semantic roles (Agent, Theme, etc.)
 * - wordnet_predicates: Unary predicates (properties, types)
 * - wordnet_relations: Binary relations (spatial, temporal, logical)
 */

export class SemanticInventoryService {
  /**
   * Create a new SemanticInventoryService
   * @param {ResourceManager} resourceManager - Legion ResourceManager instance
   * @param {Object} options - Service options
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   */
  constructor(resourceManager, options = {}) {
    this.resourceManager = resourceManager;
    this.semanticSearch = null;
    this.initialized = false;
    this.collectionPrefix = options.collectionPrefix || '';
  }

  /**
   * Initialize the service by getting semantic search provider
   * @throws {Error} If semantic search not available (FAIL FAST)
   */
  async initialize() {
    // Get semantic search provider (REAL, NO MOCK)
    this.semanticSearch = await this.resourceManager.get('semanticSearch');
    if (!this.semanticSearch) {
      throw new Error('Semantic search provider not available from ResourceManager');
    }

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
   * Search for entity type labels relevant to input text
   *
   * Queries wordnet_entity_types collection with semantic search.
   * Returns entity type labels ranked by semantic similarity.
   *
   * @param {string} text - Input text (sentence or phrase)
   * @param {Object} options - Search options
   * @param {number} options.limit - Maximum number of results to return (default: 20)
   * @param {number} options.threshold - Minimum similarity score (default: 0.3)
   * @returns {Promise<string[]>} Entity type labels (e.g., ["PERSON", "LOCATION", ...])
   * @throws {Error} If not initialized
   *
   * @example
   * const types = await service.semanticSearchEntityTypes("the professor walked to the building");
   * // Returns: ["PERSON", "LOCATION", "ARTIFACT", "THING"]
   */
  async semanticSearchEntityTypes(text, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const { limit = 20, threshold = 0.3 } = options;
    const collectionName = `${this.collectionPrefix}wordnet_entity_types`;

    // Query wordnet_entity_types collection
    const results = await this.semanticSearch.semanticSearch(
      collectionName,
      text,
      { limit, threshold }
    );

    // Extract unique entity type labels, ranked by score
    const seen = new Set();
    const labels = [];

    for (const result of results) {
      const label = result.document.label;
      if (!seen.has(label)) {
        seen.add(label);
        labels.push(label);
      }
    }

    return labels;
  }

  /**
   * Look up a specific entity type string and return its WordNet synset object
   *
   * Searches wordnet_entity_types collection for synsets matching the type string.
   * Returns the best-matching synset with full WordNet data.
   *
   * @param {string} typeString - Entity type string from LLM (e.g., "company", "professor", "fruit")
   * @param {Object} options - Search options
   * @param {number} options.limit - Max results to consider (default: 5)
   * @param {number} options.threshold - Minimum similarity score (default: 0.5)
   * @returns {Promise<Object|null>} Synset object with full WordNet data, or null if not found
   * @throws {Error} If not initialized
   *
   * @example
   * const synset = await service.lookupEntityTypeSynset("company");
   * // Returns: {
   * //   label: "company.n.01",
   * //   synonyms: ["company", "companionship"],
   * //   definition: "an institution created to conduct business",
   * //   examples: ["he started the company in his garage"],
   * //   pos: "n",
   * //   entityType: "ORGANIZATION"
   * // }
   */
  async lookupEntityTypeSynset(typeString, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const { limit = 5, threshold = 0.5 } = options;
    const collectionName = `${this.collectionPrefix}wordnet_entity_types`;

    // Query wordnet_entity_types collection
    const results = await this.semanticSearch.semanticSearch(
      collectionName,
      typeString,
      { limit, threshold }
    );

    // Return best match (highest score), or null if no results
    if (results.length === 0) {
      return null;
    }

    return results[0].document;
  }

  /**
   * Look up an event lemma string and return its WordNet synset object
   *
   * Searches wordnet_predicates collection for synsets matching the lemma string.
   * Event lemmas are typically verbs (e.g., "read", "walk", "be").
   * Returns the best-matching synset with full WordNet data.
   *
   * @param {string} lemmaString - Event lemma string from LLM (e.g., "read", "walk", "be")
   * @param {Object} options - Search options
   * @param {number} options.limit - Max results to consider (default: 5)
   * @param {number} options.threshold - Minimum similarity score (default: 0.5)
   * @returns {Promise<Object|null>} Synset object with full WordNet data, or null if not found
   * @throws {Error} If not initialized
   *
   * @example
   * const synset = await service.lookupEventLemmaSynset("read");
   * // Returns: {
   * //   label: "read.v.01",
   * //   synonyms: ["read", "peruse", "study"],
   * //   definition: "interpret something that is written or printed",
   * //   examples: ["read the advertisement"],
   * //   pos: "v"
   * // }
   */
  async lookupEventLemmaSynset(lemmaString, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const { limit = 5, threshold = 0.5 } = options;
    const collectionName = `${this.collectionPrefix}wordnet_predicates`;

    // Query wordnet_predicates collection
    const results = await this.semanticSearch.semanticSearch(
      collectionName,
      lemmaString,
      { limit, threshold }
    );

    // Return best match (highest score), or null if no results
    if (results.length === 0) {
      return null;
    }

    return results[0].document;
  }

  /**
   * Search for relation types (roles, predicates, relations) relevant to input text
   *
   * Queries three collections in parallel:
   * - wordnet_roles: semantic roles
   * - wordnet_predicates: unary predicates
   * - wordnet_relations: binary relations
   *
   * Returns FULL synset objects from WordNet, preserving all semantic information:
   * - label: canonical synset ID (e.g., "read.v.01")
   * - synonyms: all synonyms in synset (e.g., ["read", "study", "scan", "peruse"])
   * - definition: WordNet definition
   * - examples: usage examples
   * - pos: part of speech
   *
   * @param {string} text - Input text (sentence or phrase)
   * @param {Object} options - Search options
   * @param {number} options.rolesLimit - Max roles to return (default: 30)
   * @param {number} options.predicatesLimit - Max predicates to return (default: 50)
   * @param {number} options.relationsLimit - Max relations to return (default: 30)
   * @param {number} options.threshold - Minimum similarity score (default: 0.3)
   * @returns {Promise<RelationInventory>} Object with synset arrays (NOT strings!)
   * @throws {Error} If not initialized
   *
   * @example
   * const inventory = await service.semanticSearchRelationTypes("John gave Mary a heavy book");
   * // Returns: {
   * //   roles: [{label: "Agent", synonyms: [...], definition: "..."}],
   * //   unaryPredicates: [{label: "give.v.01", synonyms: ["give", "grant"], ...}],
   * //   binaryRelations: [{label: "to.r.01", synonyms: ["to", "toward"], ...}]
   * // }
   */
  async semanticSearchRelationTypes(text, options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryService not initialized. Call initialize() first.');
    }

    const {
      rolesLimit = 30,
      predicatesLimit = 50,
      relationsLimit = 30,
      threshold = 0.3
    } = options;

    // Query all three collections in parallel
    const [roleResults, predicateResults, relationResults] = await Promise.all([
      this.semanticSearch.semanticSearch(
        `${this.collectionPrefix}wordnet_roles`,
        text,
        { limit: rolesLimit, threshold }
      ),
      this.semanticSearch.semanticSearch(
        `${this.collectionPrefix}wordnet_predicates`,
        text,
        { limit: predicatesLimit, threshold }
      ),
      this.semanticSearch.semanticSearch(
        `${this.collectionPrefix}wordnet_relations`,
        text,
        { limit: relationsLimit, threshold }
      )
    ]);

    return {
      roles: roleResults.map(r => r.document),
      unaryPredicates: predicateResults.map(r => r.document),
      binaryRelations: relationResults.map(r => r.document)
    };
  }
}

/**
 * @typedef {Object} RelationInventory
 * @property {Object[]} roles - Semantic role synset objects from WordNet
 * @property {Object[]} unaryPredicates - Unary predicate synset objects from WordNet
 * @property {Object[]} binaryRelations - Binary relation synset objects from WordNet
 */
