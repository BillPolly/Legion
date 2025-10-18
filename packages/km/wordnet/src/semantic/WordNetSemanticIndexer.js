/**
 * WordNetSemanticIndexer - Build Qdrant vector indices from WordNet MongoDB data
 *
 * This class indexes WordNet synsets from MongoDB into Qdrant collections organized by part of speech.
 * Collections:
 * - wordnet_nouns: All noun synsets (~82K)
 * - wordnet_verbs: All verb synsets (~13K)
 * - wordnet_adjectives: All adjective synsets (~18K)
 * - wordnet_adverbs: All adverb synsets (~3.6K)
 */

export class WordNetSemanticIndexer {
  /**
   * Create a new WordNetSemanticIndexer
   * @param {Object} resourceManager - The ResourceManager instance
   */
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.mongoClient = null;
    this.semanticSearch = null;
    this.initialized = false;
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

    // Get semantic search provider
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
   * @returns {Promise<Object>} Collection counts by POS
   * @throws {Error} If not initialized
   */
  async getStats() {
    if (!this.initialized) {
      throw new Error('WordNetSemanticIndexer not initialized. Call initialize() first.');
    }

    const [nouns, verbs, adjectives, adverbs] = await Promise.all([
      this.semanticSearch.count('wordnet_nouns'),
      this.semanticSearch.count('wordnet_verbs'),
      this.semanticSearch.count('wordnet_adjectives'),
      this.semanticSearch.count('wordnet_adverbs')
    ]);

    return {
      nouns,
      verbs,
      adjectives,
      adverbs,
      total: nouns + verbs + adjectives + adverbs
    };
  }

  /**
   * Index all synsets from MongoDB into Qdrant, organized by POS
   * @throws {Error} If not initialized or indexing fails
   */
  async indexAllSynsets() {
    if (!this.initialized) {
      throw new Error('WordNetSemanticIndexer not initialized. Call initialize() first.');
    }

    console.log('Starting semantic indexing of all synsets...');

    const db = this.mongoClient.db('wordnet');
    const collection = db.collection('synsets');

    // Index each POS separately
    await this.indexByPOS(collection, 'n', 'wordnet_nouns');
    await this.indexByPOS(collection, 'v', 'wordnet_verbs');
    // Index both 'a' (adjectives) and 's' (satellite adjectives) into wordnet_adjectives
    await this.indexMultiplePOS(collection, ['a', 's'], 'wordnet_adjectives');
    await this.indexByPOS(collection, 'r', 'wordnet_adverbs');

    const stats = await this.getStats();
    console.log('\n=== INDEXING COMPLETE ===');
    console.log(`Nouns: ${stats.nouns}`);
    console.log(`Verbs: ${stats.verbs}`);
    console.log(`Adjectives: ${stats.adjectives}`);
    console.log(`Adverbs: ${stats.adverbs}`);
    console.log(`Total vectors: ${stats.total}`);
    console.log('=========================\n');

    return stats;
  }

  /**
   * Index synsets for multiple parts of speech into a single collection
   * @param {Collection} collection - MongoDB collection
   * @param {Array<string>} posList - Array of POS codes (e.g., ['a', 's'])
   * @param {string} qdrantCollection - Qdrant collection name
   * @throws {Error} If indexing fails
   */
  async indexMultiplePOS(collection, posList, qdrantCollection) {
    console.log(`\nIndexing ${posList.join(', ')} synsets into ${qdrantCollection}...`);

    // Query MongoDB for all POS codes
    const synsets = await collection.find({ pos: { $in: posList } }).toArray();
    console.log(`Found ${synsets.length} synsets`);

    if (synsets.length === 0) {
      console.log(`No synsets found for POS: ${posList.join(', ')}`);
      return;
    }

    // Build documents for Qdrant
    const documents = synsets.map(synset => ({
      id: `${synset.synsetOffset}_${synset.pos}`,
      synsetOffset: synset.synsetOffset,
      pos: synset.pos,
      synonyms: synset.synonyms || [],
      definition: synset.definition || '',
      examples: synset.examples || [],
      lexicalFile: synset.lexicalFile || '',
      searchText: this._buildSearchText(synset)
    }));

    // Insert into Qdrant with embeddings (batched for performance)
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.semanticSearch.insert(qdrantCollection, batch);
      indexed += batch.length;
      console.log(`  Indexed ${indexed}/${documents.length} synsets`);
    }

    console.log(`Completed ${posList.join(', ')} indexing: ${indexed} synsets`);
  }

  /**
   * Index synsets for a specific part of speech
   * @param {Collection} collection - MongoDB collection
   * @param {string} pos - Part of speech (n, v, a, r)
   * @param {string} qdrantCollection - Qdrant collection name
   * @throws {Error} If indexing fails
   */
  async indexByPOS(collection, pos, qdrantCollection) {
    console.log(`\nIndexing ${pos} synsets into ${qdrantCollection}...`);

    // Query MongoDB for this POS
    const synsets = await collection.find({ pos }).toArray();
    console.log(`Found ${synsets.length} synsets`);

    if (synsets.length === 0) {
      console.log(`No synsets found for POS: ${pos}`);
      return;
    }

    // Build documents for Qdrant
    const documents = synsets.map(synset => ({
      id: `${synset.synsetOffset}_${synset.pos}`,
      synsetOffset: synset.synsetOffset,
      pos: synset.pos,
      synonyms: synset.synonyms || [],
      definition: synset.definition || '',
      examples: synset.examples || [],
      lexicalFile: synset.lexicalFile || '',
      searchText: this._buildSearchText(synset)
    }));

    // Insert into Qdrant with embeddings (batched for performance)
    const batchSize = 100;
    let indexed = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.semanticSearch.insert(qdrantCollection, batch);
      indexed += batch.length;
      console.log(`  Indexed ${indexed}/${documents.length} synsets`);
    }

    console.log(`Completed ${pos} indexing: ${indexed} synsets`);
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
   * Close MongoDB connection
   */
  async close() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }
}
