/**
 * ProvenanceTracker - Tracks where knowledge came from
 *
 * Manages provenance metadata for entities and relationships,
 * tracking which sentences/documents mentioned them.
 */

export class ProvenanceTracker {
  constructor(knowledgeGraphStore) {
    if (!knowledgeGraphStore) {
      throw new Error('KnowledgeGraphStore is required');
    }

    this.store = knowledgeGraphStore;
  }

  /**
   * Add a mention to an entity or relationship
   *
   * @param {string|ObjectId} itemId - Graph item ID
   * @param {string} sentenceId - Sentence ID that mentioned this item
   * @param {Object} options - Additional metadata
   * @returns {Promise<Object>} - Update result
   */
  async addMention(itemId, sentenceId, options = {}) {
    const item = await this.store.findGraphItem(itemId);

    if (!item) {
      throw new Error(`Graph item ${itemId} not found`);
    }

    // Add sentence ID to mentions if not already present
    const mentions = item.provenance?.mentionedIn || [];
    if (!mentions.includes(sentenceId)) {
      mentions.push(sentenceId);
    }

    // Update item with new mention
    const updateMethod = item.graphType === 'entity' ?
      this.store.updateEntity.bind(this.store) :
      this.store.updateRelationship.bind(this.store);

    return await updateMethod(itemId, {
      'provenance.mentionedIn': mentions
    });
  }

  /**
   * Add document source to an entity or relationship
   *
   * @param {string|ObjectId} itemId - Graph item ID
   * @param {string} documentId - Document ID this was extracted from
   * @returns {Promise<Object>} - Update result
   */
  async addDocumentSource(itemId, documentId) {
    const item = await this.store.findGraphItem(itemId);

    if (!item) {
      throw new Error(`Graph item ${itemId} not found`);
    }

    const sources = item.provenance?.extractedFrom || [];
    if (!sources.includes(documentId)) {
      sources.push(documentId);
    }

    const updateMethod = item.graphType === 'entity' ?
      this.store.updateEntity.bind(this.store) :
      this.store.updateRelationship.bind(this.store);

    return await updateMethod(itemId, {
      'provenance.extractedFrom': sources
    });
  }

  /**
   * Get all entities/relationships mentioned in a specific sentence
   *
   * @param {string} sentenceId - Sentence ID
   * @returns {Promise<Object>} - { entities: [...], relationships: [...] }
   */
  async getMentionsInSentence(sentenceId) {
    const items = await this.store.findByMention(sentenceId);

    return {
      entities: items.filter(item => item.graphType === 'entity'),
      relationships: items.filter(item => item.graphType === 'relationship')
    };
  }

  /**
   * Get all sentences that mentioned a specific entity/relationship
   *
   * @param {string|ObjectId} itemId - Graph item ID
   * @returns {Promise<Array>} - Array of sentence IDs
   */
  async getSentencesMentioning(itemId) {
    const item = await this.store.findGraphItem(itemId);

    if (!item) {
      return [];
    }

    return item.provenance?.mentionedIn || [];
  }

  /**
   * Get provenance chain for an entity/relationship
   *
   * Returns full provenance information including all sources
   *
   * @param {string|ObjectId} itemId - Graph item ID
   * @returns {Promise<Object>} - Provenance information
   */
  async getProvenanceChain(itemId) {
    const item = await this.store.findGraphItem(itemId);

    if (!item) {
      return null;
    }

    return {
      itemId: item._id,
      graphType: item.graphType,
      ontologyType: item.ontologyType,
      label: item.label,
      provenance: item.provenance,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      mergedFrom: item.mergedInto ? await this._getMergeHistory(item.mergedInto) : null
    };
  }

  /**
   * Get merge history for an item
   * @private
   */
  async _getMergeHistory(mergedIntoId) {
    if (!this.store.connected) await this.store.connect();

    const mergedItems = await this.store.collection.find({
      mergedInto: mergedIntoId,
      deletedAt: { $ne: null }
    }).toArray();

    return mergedItems.map(item => ({
      id: item._id,
      label: item.label,
      mergedAt: item.deletedAt,
      provenance: item.provenance
    }));
  }

  /**
   * Update confidence score for an item
   *
   * @param {string|ObjectId} itemId - Graph item ID
   * @param {number} confidence - New confidence score (0-1)
   * @returns {Promise<Object>} - Update result
   */
  async updateConfidence(itemId, confidence) {
    if (confidence < 0 || confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    const item = await this.store.findGraphItem(itemId);

    if (!item) {
      throw new Error(`Graph item ${itemId} not found`);
    }

    const updateMethod = item.graphType === 'entity' ?
      this.store.updateEntity.bind(this.store) :
      this.store.updateRelationship.bind(this.store);

    return await updateMethod(itemId, {
      'provenance.confidence': confidence
    });
  }

  /**
   * Get statistics about provenance coverage
   *
   * @returns {Promise<Object>} - Statistics
   */
  async getProvenanceStatistics() {
    if (!this.store.connected) await this.store.connect();

    const [entitiesWithSources, relationshipsWithSources, avgMentions] = await Promise.all([
      this.store.collection.countDocuments({
        graphType: 'entity',
        deletedAt: null,
        'provenance.mentionedIn.0': { $exists: true }
      }),
      this.store.collection.countDocuments({
        graphType: 'relationship',
        deletedAt: null,
        'provenance.mentionedIn.0': { $exists: true }
      }),
      this.store.collection.aggregate([
        { $match: { deletedAt: null } },
        { $project: { mentionCount: { $size: { $ifNull: ['$provenance.mentionedIn', []] } } } },
        { $group: { _id: null, avgMentions: { $avg: '$mentionCount' } } }
      ]).toArray()
    ]);

    return {
      entitiesWithSources,
      relationshipsWithSources,
      averageMentionsPerItem: avgMentions[0]?.avgMentions || 0
    };
  }
}
