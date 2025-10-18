/**
 * SemanticInventoryIndexer - Index WordNet synsets into specialized Qdrant collections
 *
 * Creates 4 specialized Qdrant collections for semantic inventory:
 * - wordnet_entity_types: Categorized noun synsets (82K points)
 * - wordnet_roles: Predefined semantic roles (~14 points)
 * - wordnet_predicates: All adjectives + nouns + verbs (114K points)
 * - wordnet_relations: Categorized adverb synsets (3.6K points)
 *
 * Total: ~200K vectors with full WordNet coverage
 */

import { EntityTypeCategorizer } from './categorization/EntityTypeCategorizer.js';
import { RelationCategorizer } from './categorization/RelationCategorizer.js';

export class SemanticInventoryIndexer {
  /**
   * Create a new SemanticInventoryIndexer
   * @param {ResourceManager} resourceManager - The ResourceManager instance
   */
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.mongoClient = null;
    this.semanticSearch = null;
    this.initialized = false;
    this.categorizer = new EntityTypeCategorizer();
    this.relationCategorizer = new RelationCategorizer();
  }

  /**
   * Initialize the indexer by getting resources from ResourceManager
   * @throws {Error} If resources are not available (FAIL FAST)
   */
  async initialize() {
    // Get MongoDB client
    const { MongoClient } = await import('mongodb');
    const mongoUri = this.resourceManager.get('env.MONGODB_URI') || 'mongodb://localhost:27017';
    this.mongoClient = new MongoClient(mongoUri);
    await this.mongoClient.connect();

    // Get semantic search provider (REAL, NO MOCK)
    this.semanticSearch = await this.resourceManager.get('semanticSearch');
    if (!this.semanticSearch) {
      throw new Error('Semantic search provider not available from ResourceManager');
    }

    this.initialized = true;
  }

  /**
   * Check if indexer is initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get statistics about indexed collections
   * @param {Object} options - Stats options
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   * @returns {Promise<Object>} Collection counts
   * @throws {Error} If not initialized
   */
  async getStats(options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryIndexer not initialized. Call initialize() first.');
    }

    const { collectionPrefix = '' } = options;

    // Get counts for all 4 collections
    const entity_types = await this.semanticSearch.count(`${collectionPrefix}wordnet_entity_types`);
    const roles = await this.semanticSearch.count(`${collectionPrefix}wordnet_roles`);
    const predicates = await this.semanticSearch.count(`${collectionPrefix}wordnet_predicates`);
    const relations = await this.semanticSearch.count(`${collectionPrefix}wordnet_relations`);

    const total = entity_types + roles + predicates + relations;

    return {
      entity_types,
      roles,
      predicates,
      relations,
      total
    };
  }

  /**
   * Index all noun synsets with entity type categorization
   * @param {Object} options - Indexing options
   * @param {boolean} options.testMode - If true, load from test-synsets instead of MongoDB
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   * @throws {Error} If not initialized or indexing fails
   */
  async indexEntityTypes(options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryIndexer not initialized. Call initialize() first.');
    }

    const { testMode = false, collectionPrefix = '' } = options;
    const collectionName = `${collectionPrefix}wordnet_entity_types`;

    console.log(`\nIndexing entity types ${testMode ? 'from TEST DATA' : 'from MongoDB'} to collection: ${collectionName}...`);

    let synsets;

    if (testMode) {
      // Load synsets from test data file
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const testDataPath = join(__dirname, '../data/test-synsets/entity-types.json');

      const testDataJson = await readFile(testDataPath, 'utf-8');
      synsets = JSON.parse(testDataJson);

      console.log(`Loaded ${synsets.length} test synsets from ${testDataPath}`);
    } else {
      // Query MongoDB for ALL noun synsets (production mode)
      const db = this.mongoClient.db('wordnet');
      const collection = db.collection('synsets');

      synsets = await collection.find({ pos: 'n' }).toArray();
      console.log(`Found ${synsets.length} noun synsets from MongoDB`);

      if (synsets.length === 0) {
        throw new Error('No noun synsets found in MongoDB. WordNet data may not be loaded.');
      }
    }

    // Categorize and build documents for ALL nouns
    const documents = [];
    for (const synset of synsets) {
      const entityType = this.categorizer.categorizeEntityType(synset);

      documents.push({
        id: `${synset.synsetOffset}_${synset.pos}_${entityType}`,
        synsetOffset: synset.synsetOffset,
        pos: synset.pos,
        label: entityType,
        synonyms: synset.synonyms || [],
        definition: synset.definition || '',
        examples: synset.examples || [],
        lexicalFile: synset.lexicalFile || '',
        entityType: entityType,
        searchText: this._buildSearchText(synset)
      });
    }

    console.log(`Categorized ${documents.length} nouns into entity types`);

    // Insert into Qdrant with embeddings (batched for performance)
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.semanticSearch.insert(collectionName, batch);
      indexed += batch.length;
      console.log(`  Indexed ${indexed}/${documents.length} entity types`);
    }

    console.log(`Completed entity types indexing: ${indexed} synsets to collection: ${collectionName}`);
    return indexed;
  }

  /**
   * Index semantic roles (predefined event participant labels)
   * @param {Object} options - Indexing options
   * @param {boolean} options.testMode - If true, load from test-synsets instead of production data
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   * @throws {Error} If not initialized or indexing fails
   */
  async indexRoles(options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryIndexer not initialized. Call initialize() first.');
    }

    const { testMode = false, collectionPrefix = '' } = options;
    const collectionName = `${collectionPrefix}wordnet_roles`;

    console.log(`\nIndexing semantic roles ${testMode ? 'from TEST DATA' : 'from production data'} to collection: ${collectionName}...`);

    let roles;

    if (testMode) {
      // Load roles from test data file
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const testDataPath = join(__dirname, '../data/test-synsets/semantic-roles.json');

      const testDataJson = await readFile(testDataPath, 'utf-8');
      roles = JSON.parse(testDataJson);

      console.log(`Loaded ${roles.length} test roles from ${testDataPath}`);
    } else {
      // Load from production data file (data/semantic-roles.json)
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const prodDataPath = join(__dirname, '../data/semantic-roles.json');

      const prodDataJson = await readFile(prodDataPath, 'utf-8');
      roles = JSON.parse(prodDataJson);

      console.log(`Loaded ${roles.length} roles from ${prodDataPath}`);
    }

    // Build documents for ALL roles
    const documents = [];
    for (const role of roles) {
      documents.push({
        id: role.id,
        label: role.label,
        definition: role.definition,
        examples: role.examples || [],
        verbnetClass: role.verbnetClass || '',
        roleType: role.roleType,
        searchText: this._buildRoleSearchText(role)
      });
    }

    console.log(`Prepared ${documents.length} semantic roles for indexing`);

    // Insert into Qdrant with embeddings
    await this.semanticSearch.insert(collectionName, documents);

    console.log(`Completed semantic roles indexing: ${documents.length} roles to collection: ${collectionName}`);
    return documents.length;
  }

  /**
   * Index predicates (adjectives + nouns + verbs) for relation type discovery
   * @param {Object} options - Indexing options
   * @param {boolean} options.testMode - If true, load from test-synsets instead of MongoDB
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   * @throws {Error} If not initialized or indexing fails
   */
  async indexPredicates(options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryIndexer not initialized. Call initialize() first.');
    }

    const { testMode = false, collectionPrefix = '' } = options;
    const collectionName = `${collectionPrefix}wordnet_predicates`;

    console.log(`\nIndexing predicates ${testMode ? 'from TEST DATA' : 'from MongoDB'} to collection: ${collectionName}...`);

    let synsets;

    if (testMode) {
      // Load synsets from test data file
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const testDataPath = join(__dirname, '../data/test-synsets/predicates.json');

      const testDataJson = await readFile(testDataPath, 'utf-8');
      synsets = JSON.parse(testDataJson);

      console.log(`Loaded ${synsets.length} test synsets from ${testDataPath}`);
    } else {
      // Query MongoDB for ALL adjectives, nouns, and verbs (production mode)
      const db = this.mongoClient.db('wordnet');
      const collection = db.collection('synsets');

      synsets = await collection.find({
        pos: { $in: ['a', 'n', 'v'] }
      }).toArray();
      console.log(`Found ${synsets.length} predicate synsets from MongoDB`);

      if (synsets.length === 0) {
        throw new Error('No predicate synsets found in MongoDB. WordNet data may not be loaded.');
      }
    }

    // Build documents for ALL predicates
    const documents = [];
    for (const synset of synsets) {
      documents.push({
        id: `${synset.synsetOffset}_${synset.pos}`,
        synsetOffset: synset.synsetOffset,
        pos: synset.pos,
        synonyms: synset.synonyms || [],
        definition: synset.definition || '',
        examples: synset.examples || [],
        lexicalFile: synset.lexicalFile || '',
        searchText: this._buildSearchText(synset)
      });
    }

    console.log(`Prepared ${documents.length} predicates for indexing`);

    // Insert into Qdrant with embeddings (batched for performance)
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.semanticSearch.insert(collectionName, batch);
      indexed += batch.length;
      console.log(`  Indexed ${indexed}/${documents.length} predicates`);
    }

    console.log(`Completed predicates indexing: ${indexed} synsets to collection: ${collectionName}`);
    return indexed;
  }

  /**
   * Index adverbs as binary relations (spatial, temporal, logical)
   * @param {Object} options - Indexing options
   * @param {boolean} options.testMode - If true, load from test-synsets instead of MongoDB
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   * @throws {Error} If not initialized or indexing fails
   */
  async indexRelations(options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryIndexer not initialized. Call initialize() first.');
    }

    const { testMode = false, collectionPrefix = '' } = options;
    const collectionName = `${collectionPrefix}wordnet_relations`;

    console.log(`\nIndexing relations ${testMode ? 'from TEST DATA' : 'from MongoDB'} to collection: ${collectionName}...`);

    let synsets;

    if (testMode) {
      // Load synsets from test data file
      const { readFile } = await import('fs/promises');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const testDataPath = join(__dirname, '../data/test-synsets/relations.json');

      const testDataJson = await readFile(testDataPath, 'utf-8');
      synsets = JSON.parse(testDataJson);

      console.log(`Loaded ${synsets.length} test synsets from ${testDataPath}`);
    } else {
      // Query MongoDB for ALL adverb synsets (production mode)
      const db = this.mongoClient.db('wordnet');
      const collection = db.collection('synsets');

      synsets = await collection.find({ pos: 'r' }).toArray();
      console.log(`Found ${synsets.length} adverb synsets from MongoDB`);

      if (synsets.length === 0) {
        throw new Error('No adverb synsets found in MongoDB. WordNet data may not be loaded.');
      }
    }

    // Categorize and build documents for ALL adverbs
    const documents = [];
    for (const synset of synsets) {
      const relationType = this.relationCategorizer.categorizeRelationType(synset);

      documents.push({
        id: `${synset.synsetOffset}_${synset.pos}_${relationType}`,
        synsetOffset: synset.synsetOffset,
        pos: synset.pos,
        synonyms: synset.synonyms || [],
        definition: synset.definition || '',
        examples: synset.examples || [],
        lexicalFile: synset.lexicalFile || '',
        relationType: relationType,
        searchText: this._buildSearchText(synset)
      });
    }

    console.log(`Categorized ${documents.length} adverbs into relation types`);

    // Insert into Qdrant with embeddings (batched for performance)
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.semanticSearch.insert(collectionName, batch);
      indexed += batch.length;
      console.log(`  Indexed ${indexed}/${documents.length} relations`);
    }

    console.log(`Completed relations indexing: ${indexed} synsets to collection: ${collectionName}`);
    return indexed;
  }

  /**
   * Build searchable text from synset fields
   * Combines synonyms, definition, and examples for rich semantic representation
   * @private
   * @param {Object} synset - Synset document from MongoDB
   * @returns {string} Combined search text
   */
  _buildSearchText(synset) {
    const parts = [
      ...(synset.synonyms || []),
      synset.definition || '',
      ...(synset.examples || [])
    ];
    return parts.filter(p => p).join('. ');
  }

  /**
   * Build searchable text from role definition
   * @private
   * @param {Object} role - Role object
   * @returns {string} Combined search text
   */
  _buildRoleSearchText(role) {
    const parts = [
      role.label,
      role.definition || '',
      ...(role.examples || [])
    ];
    return parts.filter(p => p).join('. ');
  }

  /**
   * Index all collections (entity types, roles, predicates, relations)
   * Orchestrates the complete indexing workflow
   *
   * @param {Object} options - Indexing options
   * @param {boolean} options.testMode - If true, load from test-synsets instead of MongoDB/production data
   * @param {string} options.collectionPrefix - Collection name prefix (e.g., 'test_' for test collections)
   * @returns {Promise<Object>} Statistics about indexed collections
   * @throws {Error} If not initialized or indexing fails
   */
  async indexAll(options = {}) {
    if (!this.initialized) {
      throw new Error('SemanticInventoryIndexer not initialized. Call initialize() first.');
    }

    const { testMode = false, collectionPrefix = '' } = options;

    console.log(`\n=== INDEXING ALL SEMANTIC INVENTORY COLLECTIONS ===`);
    console.log(`Mode: ${testMode ? 'TEST' : 'PRODUCTION'}`);
    console.log(`Collection prefix: ${collectionPrefix || '(none)'}\n`);

    const startTime = Date.now();

    // Index all 4 collections sequentially
    await this.indexEntityTypes(options);
    await this.indexRoles(options);
    await this.indexPredicates(options);
    await this.indexRelations(options);

    const duration = Date.now() - startTime;

    // Get final statistics
    const stats = await this.getStats(options);

    console.log(`\n=== INDEXING COMPLETE ===`);
    console.log(`Total time: ${duration}ms`);
    console.log(`Entity types: ${stats.entity_types}`);
    console.log(`Roles: ${stats.roles}`);
    console.log(`Predicates: ${stats.predicates}`);
    console.log(`Relations: ${stats.relations}`);
    console.log(`Total vectors: ${stats.total}\n`);

    return stats;
  }

  /**
   * Close MongoDB connection
   */
  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }
}
