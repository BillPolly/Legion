/**
 * MongoTripleStore - MongoDB-backed RDF triple store
 *
 * Stores ontology triples in MongoDB for persistence.
 * Simple flattened representation: { subject, predicate, object }
 *
 * Benefits over in-memory:
 * - Persistence across restarts
 * - Scalability for large ontologies
 * - Unified storage with entity instances
 * - Efficient queries with indexes
 */

import { MongoClient } from 'mongodb';

export class MongoTripleStore {
  constructor(config = {}) {
    this.connectionString = config.connectionString || 'mongodb://localhost:27017';
    this.databaseName = config.database || 'knowledge-graph';
    this.collectionName = config.collection || 'ontology_triples';

    this.client = null;
    this.db = null;
    this.collection = null;
    this.connected = false;

    // For compatibility with SimpleTripleStore (synchronous subscriptions)
    this.subscribers = [];
    this.nextSubscriberId = 1;
  }

  /**
   * Connect to MongoDB and ensure indexes
   */
  async connect() {
    if (this.connected) return;

    this.client = new MongoClient(this.connectionString);
    await this.client.connect();

    this.db = this.client.db(this.databaseName);
    this.collection = this.db.collection(this.collectionName);

    // Create indexes for efficient querying
    await this._ensureIndexes();

    this.connected = true;
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.connected = false;
    }
  }

  /**
   * Ensure indexes for triple pattern queries
   * @private
   */
  async _ensureIndexes() {
    // Index for subject queries
    await this.collection.createIndex({ subject: 1 });

    // Index for predicate queries
    await this.collection.createIndex({ predicate: 1 });

    // Index for object queries
    await this.collection.createIndex({ object: 1 });

    // Compound index for common patterns
    await this.collection.createIndex({ subject: 1, predicate: 1 });
    await this.collection.createIndex({ predicate: 1, object: 1 });

    // Unique index to prevent duplicates
    await this.collection.createIndex(
      { subject: 1, predicate: 1, object: 1 },
      { unique: true }
    );
  }

  /**
   * Add a triple to the store
   *
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   */
  async add(subject, predicate, object) {
    if (!this.connected) await this.connect();

    try {
      await this.collection.insertOne({
        subject,
        predicate,
        object,
        createdAt: new Date()
      });

      // Notify subscribers
      this._notifySubscribers();
    } catch (error) {
      // Ignore duplicate key errors (triple already exists)
      if (error.code !== 11000) {
        throw error;
      }
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
    if (!this.connected) await this.connect();

    // Build MongoDB query from pattern
    const filter = {};
    if (subject !== null && subject !== undefined) filter.subject = subject;
    if (predicate !== null && predicate !== undefined) filter.predicate = predicate;
    if (object !== null && object !== undefined) filter.object = object;

    const results = await this.collection.find(filter).toArray();

    // Return in same format as SimpleTripleStore: [[s, p, o], ...]
    return results.map(doc => [doc.subject, doc.predicate, doc.object]);
  }

  /**
   * Remove a triple from the store
   *
   * @param {string|number} subject - The subject
   * @param {string} predicate - The predicate
   * @param {string|number|boolean} object - The object
   */
  async remove(subject, predicate, object) {
    if (!this.connected) await this.connect();

    await this.collection.deleteOne({ subject, predicate, object });

    // Notify subscribers
    this._notifySubscribers();
  }

  /**
   * Remove all triples matching a pattern
   *
   * @param {string|number|null} subject - Subject or null for wildcard
   * @param {string|null} predicate - Predicate or null for wildcard
   * @param {string|number|boolean|null} object - Object or null for wildcard
   */
  async removePattern(subject, predicate, object) {
    if (!this.connected) await this.connect();

    const filter = {};
    if (subject !== null && subject !== undefined) filter.subject = subject;
    if (predicate !== null && predicate !== undefined) filter.predicate = predicate;
    if (object !== null && object !== undefined) filter.object = object;

    await this.collection.deleteMany(filter);

    // Notify subscribers
    this._notifySubscribers();
  }

  /**
   * Get all triples
   * @returns {Promise<Array<[subject, predicate, object]>>}
   */
  async getAll() {
    if (!this.connected) await this.connect();

    const results = await this.collection.find({}).toArray();
    return results.map(doc => [doc.subject, doc.predicate, doc.object]);
  }

  /**
   * Count total triples
   * @returns {Promise<number>}
   */
  async count() {
    if (!this.connected) await this.connect();
    return await this.collection.countDocuments();
  }

  /**
   * Clear all triples
   */
  async clear() {
    if (!this.connected) await this.connect();
    await this.collection.deleteMany({});
    this._notifySubscribers();
  }

  /**
   * Subscribe to changes
   * @param {Function} callback - Called when triples are added/removed
   * @returns {number} - Subscription ID
   */
  subscribe(callback) {
    const id = this.nextSubscriberId++;
    this.subscribers.push({ id, callback });
    return id;
  }

  /**
   * Unsubscribe from changes
   * @param {number} subscriptionId - The subscription ID to remove
   */
  unsubscribe(subscriptionId) {
    this.subscribers = this.subscribers.filter(sub => sub.id !== subscriptionId);
  }

  /**
   * Notify all subscribers of changes
   * @private
   */
  _notifySubscribers() {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.callback();
      } catch (error) {
        console.error('Error in triple store subscriber:', error);
      }
    }
  }

  /**
   * Get statistics about the triple store
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    if (!this.connected) await this.connect();

    const total = await this.count();

    // Count by predicate type
    const byPredicate = await this.collection.aggregate([
      { $group: { _id: '$predicate', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    // Count classes
    const classes = await this.collection.countDocuments({
      predicate: 'rdf:type',
      object: 'owl:Class'
    });

    // Count properties
    const datatypeProps = await this.collection.countDocuments({
      predicate: 'rdf:type',
      object: 'owl:DatatypeProperty'
    });

    const objectProps = await this.collection.countDocuments({
      predicate: 'rdf:type',
      object: 'owl:ObjectProperty'
    });

    return {
      totalTriples: total,
      classes,
      datatypeProperties: datatypeProps,
      objectProperties: objectProps,
      byPredicate: byPredicate.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {})
    };
  }
}
