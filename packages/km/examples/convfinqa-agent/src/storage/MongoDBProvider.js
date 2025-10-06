/**
 * MongoDBProvider - MongoDB implementation of triple store
 *
 * Stores RDF triples in MongoDB with metadata tagging for:
 * - Ontology vs instances (type: 'tbox' vs 'abox')
 * - Run tracking (runId)
 * - Conversation tracking (conversationId)
 */

export class MongoDBProvider {
  /**
   * @param {Object} config
   * @param {MongoClient} config.mongoClient - Connected MongoDB client
   * @param {string} config.dbName - Database name (default: 'convfinqa')
   * @param {string} config.collectionName - Collection name (e.g., 'ontology', 'instances')
   * @param {Object} config.metadata - Metadata to attach to all triples (e.g., {type: 'tbox', version: '1.0.0'})
   */
  constructor({ mongoClient, dbName = 'convfinqa', collectionName, metadata = {}, collection }) {
    // Support both mongoClient+dbName+collectionName or collection directly
    if (collection) {
      this.collection = collection;
      this.client = null;
      this.db = null;
      this.collectionName = collection.collectionName;
    } else {
      if (!mongoClient) {
        throw new Error('MongoDBProvider requires a mongoClient or collection');
      }
      if (!collectionName) {
        throw new Error('MongoDBProvider requires a collectionName');
      }
      this.client = mongoClient;
      this.db = mongoClient.db(dbName);
      this.collection = this.db.collection(collectionName);
      this.collectionName = collectionName;
    }

    this.metadata = metadata;
    this.dbName = dbName;
  }

  /**
   * Ensure indexes are created
   * Call this during initialization
   */
  async ensureIndexes() {
    await this.collection.createIndex(
      { s: 1, p: 1, o: 1 },
      { unique: true, name: 'triple_unique' }
    );

    await this.collection.createIndex({ s: 1 }, { name: 'subject_idx' });
    await this.collection.createIndex({ p: 1 }, { name: 'predicate_idx' });
    await this.collection.createIndex({ type: 1 }, { name: 'type_idx' });

    // Index metadata fields if present
    if (this.metadata.runId) {
      await this.collection.createIndex({ runId: 1 }, { name: 'runId_idx' });
    }

    if (this.metadata.conversationId) {
      await this.collection.createIndex({ conversationId: 1 }, { name: 'conversationId_idx' });
    }
  }

  /**
   * Add a triple to the store
   *
   * @param {string|number} subject - The subject of the triple
   * @param {string} predicate - The predicate/relationship
   * @param {string|number|boolean} object - The object/value
   * @returns {Promise<boolean>} - True if added, false if already exists
   */
  async addTriple(subject, predicate, object) {
    const doc = {
      s: subject,
      p: predicate,
      o: object,
      ...this.metadata,
      createdAt: new Date()
    };

    try {
      await this.collection.insertOne(doc);
      return true;
    } catch (err) {
      // Duplicate key error (triple already exists)
      if (err.code === 11000) {
        return false;
      }
      throw err;
    }
  }

  /**
   * Query triples with pattern matching
   * Use null for wildcards
   *
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   * @returns {Promise<Array<[subject, predicate, object]>>} - Array of matching triples
   */
  async query(subject, predicate, object) {
    const filter = {};

    // Add triple pattern filters
    if (subject !== null && subject !== undefined) {
      filter.s = subject;
    }

    if (predicate !== null && predicate !== undefined) {
      filter.p = predicate;
    }

    if (object !== null && object !== undefined) {
      filter.o = object;
    }

    // Include metadata filters (e.g., type, runId, conversationId)
    Object.assign(filter, this.metadata);

    const docs = await this.collection.find(filter).toArray();
    return docs.map(doc => [doc.s, doc.p, doc.o]);
  }

  /**
   * Remove a triple from the store
   *
   * @param {string|number} subject - The subject of the triple
   * @param {string} predicate - The predicate/relationship
   * @param {string|number|boolean} object - The object/value
   * @returns {Promise<boolean>} - True if removed, false if not found
   */
  async removeTriple(subject, predicate, object) {
    const filter = {
      s: subject,
      p: predicate,
      o: object,
      ...this.metadata
    };

    const result = await this.collection.deleteOne(filter);
    return result.deletedCount > 0;
  }

  /**
   * Get the total number of triples in the store
   *
   * @returns {Promise<number>} - Count of triples
   */
  async size() {
    return await this.collection.countDocuments(this.metadata);
  }

  /**
   * Clear all triples from the store (respecting metadata filters)
   *
   * @returns {Promise<void>}
   */
  async clear() {
    await this.collection.deleteMany(this.metadata);
  }

  /**
   * Get metadata about the store implementation
   *
   * @returns {Object} - Metadata object
   */
  getMetadata() {
    return {
      type: 'mongodb',
      dbName: this.dbName,
      collectionName: this.collectionName,
      metadata: this.metadata,
      supportsTransactions: true,
      supportsPersistence: true,
      supportsAsync: true
    };
  }

  /**
   * Get all triples (useful for export/serialization)
   *
   * @returns {Promise<Array<[subject, predicate, object]>>}
   */
  async getAllTriples() {
    return await this.query(null, null, null);
  }
}
