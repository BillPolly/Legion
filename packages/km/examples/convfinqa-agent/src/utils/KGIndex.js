/**
 * KGIndex - Fast O(1) lookup index for knowledge graph instances
 *
 * Builds in-memory indices for:
 * - Label-based lookups (normalized)
 * - Year-based lookups
 * - Category-based lookups
 *
 * Dramatically improves query performance from O(n) to O(1)
 */

export class KGIndex {
  constructor(kgStore, logger = console) {
    this.kgStore = kgStore;
    this.logger = logger;

    // Index structures
    this.labelIndex = new Map();      // normalized_label -> [instanceURIs]
    this.yearIndex = new Map();       // year -> [instanceURIs]
    this.categoryIndex = new Map();   // normalized_category -> [instanceURIs]
    this.instanceCache = new Map();   // instanceURI -> { properties }

    // Metadata
    this.isBuilt = false;
    this.instanceCount = 0;
    this.buildTime = null;
  }

  /**
   * Build all indices by scanning the knowledge graph
   */
  async build() {
    const startTime = Date.now();
    this.logger.info('kg_index_build_start');

    try {
      // Get all instances
      const instances = await this.kgStore.query(null, 'rdf:type', null);
      this.instanceCount = instances.length;

      this.logger.info('kg_index_scanning', { instanceCount: this.instanceCount });

      // Process each instance
      for (const [instanceUri] of instances) {
        await this._indexInstance(instanceUri);
      }

      this.isBuilt = true;
      this.buildTime = Date.now() - startTime;

      this.logger.info('kg_index_build_complete', {
        instanceCount: this.instanceCount,
        uniqueLabels: this.labelIndex.size,
        uniqueYears: this.yearIndex.size,
        uniqueCategories: this.categoryIndex.size,
        buildTimeMs: this.buildTime
      });

    } catch (error) {
      this.logger.error('kg_index_build_error', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Index a single instance
   * @private
   */
  async _indexInstance(instanceUri) {
    // Get all properties for this instance
    const label = await this._getProperty(instanceUri, 'kg:label');
    const year = await this._getProperty(instanceUri, 'kg:year');
    const category = await this._getProperty(instanceUri, 'kg:category');
    const value = await this._getProperty(instanceUri, 'kg:value');
    const rawValue = await this._getProperty(instanceUri, 'kg:rawValue');
    const rawValueString = await this._getProperty(instanceUri, 'kg:rawValueString');
    const unit = await this._getProperty(instanceUri, 'kg:unit');

    // Cache instance data for fast retrieval
    this.instanceCache.set(instanceUri, {
      uri: instanceUri,
      label,
      year,
      category,
      value: value ? parseFloat(value) : null,
      rawValue: rawValue ? parseFloat(rawValue) : null,
      rawValueString,
      unit
    });

    // Index by label (normalized)
    if (label) {
      const normLabel = this._normalizeLabel(label);
      if (!this.labelIndex.has(normLabel)) {
        this.labelIndex.set(normLabel, []);
      }
      this.labelIndex.get(normLabel).push(instanceUri);
    }

    // Index by year
    if (year) {
      if (!this.yearIndex.has(year)) {
        this.yearIndex.set(year, []);
      }
      this.yearIndex.get(year).push(instanceUri);
    }

    // Index by category (normalized)
    if (category) {
      const normCategory = this._normalizeLabel(category);
      if (!this.categoryIndex.has(normCategory)) {
        this.categoryIndex.set(normCategory, []);
      }
      this.categoryIndex.get(normCategory).push(instanceUri);
    }
  }

  /**
   * Get a property value from the KG
   * @private
   */
  async _getProperty(instanceUri, propertyUri) {
    const triples = await this.kgStore.query(instanceUri, propertyUri, null);
    if (triples.length === 0) return null;
    // Remove quotes from RDF literals
    return triples[0][2].replace(/^"|"$/g, '');
  }

  /**
   * Normalize a label for matching
   * - Lowercase
   * - Remove punctuation except spaces
   * - Collapse whitespace
   * @private
   */
  _normalizeLabel(label) {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  /**
   * Query the index for matching instances
   *
   * @param {string} label - The label to search for
   * @param {string} year - Optional year constraint
   * @param {string} category - Optional category constraint
   * @returns {Array} Array of instance data objects
   */
  query(label, year = null, category = null) {
    if (!this.isBuilt) {
      throw new Error('KGIndex.build() must be called before querying');
    }

    // Normalize search label
    const normLabel = this._normalizeLabel(label);

    // Get candidates by label (O(1) lookup)
    let candidates = this.labelIndex.get(normLabel) || [];

    // If no exact match, try fuzzy matching
    if (candidates.length === 0) {
      candidates = this._fuzzyMatchLabel(normLabel);
    }

    // Filter by year if provided
    if (year && candidates.length > 0) {
      const yearInstances = new Set(this.yearIndex.get(year) || []);
      candidates = candidates.filter(uri => yearInstances.has(uri));
    }

    // Filter by category if provided
    if (category && candidates.length > 0) {
      const normCategory = this._normalizeLabel(category);
      const categoryInstances = new Set(this.categoryIndex.get(normCategory) || []);
      candidates = candidates.filter(uri => categoryInstances.has(uri));
    }

    // Return instance data from cache
    return candidates.map(uri => this.instanceCache.get(uri)).filter(Boolean);
  }

  /**
   * Fuzzy match a label using token-based similarity
   * @private
   */
  _fuzzyMatchLabel(normLabel) {
    let bestMatches = [];
    let bestScore = 0;

    for (const [indexedLabel, instanceUris] of this.labelIndex.entries()) {
      const score = this._computeSimilarity(normLabel, indexedLabel);

      if (score > 0.8 && score > bestScore) {
        bestScore = score;
        bestMatches = instanceUris;
      }
    }

    return bestMatches;
  }

  /**
   * Compute similarity between two normalized labels
   * Uses Jaccard similarity on tokens
   * @private
   */
  _computeSimilarity(label1, label2) {
    // Exact match
    if (label1 === label2) return 1.0;

    // Tokenize
    const tokens1 = new Set(label1.split('_'));
    const tokens2 = new Set(label2.split('_'));

    // Jaccard similarity: |intersection| / |union|
    const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    const jaccard = intersection.size / union.size;

    // Substring bonus
    const substring = label1.includes(label2) || label2.includes(label1) ? 0.3 : 0;

    return Math.max(jaccard, substring);
  }

  /**
   * Get all unique labels (for autocomplete/suggestions)
   */
  getAllLabels() {
    return Array.from(this.labelIndex.keys());
  }

  /**
   * Get all unique years
   */
  getAllYears() {
    return Array.from(this.yearIndex.keys());
  }

  /**
   * Get all unique categories
   */
  getAllCategories() {
    return Array.from(this.categoryIndex.keys());
  }

  /**
   * Get statistics about the index
   */
  getStats() {
    return {
      isBuilt: this.isBuilt,
      instanceCount: this.instanceCount,
      uniqueLabels: this.labelIndex.size,
      uniqueYears: this.yearIndex.size,
      uniqueCategories: this.categoryIndex.size,
      buildTimeMs: this.buildTime
    };
  }
}
