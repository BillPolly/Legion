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
    this.propertyLabelMap = new Map(); // instanceURI -> Map(normalized_label -> propertyUri)

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
    // Get instance label (rdfs:label for table instances, kg:label for text-derived facts)
    let label = await this._getProperty(instanceUri, 'rdfs:label');
    if (!label) {
      label = await this._getProperty(instanceUri, 'kg:label');
    }
    const year = await this._getProperty(instanceUri, 'kg:year');

    // Get all properties for this instance
    const allTriples = await this.kgStore.query(instanceUri, null, null);

    // Extract property values and labels
    const properties = {};
    const propertyLabels = [];
    const propertyPrecisions = new Map(); // Store precision for each property

    // Map property labels to their URIs for this instance
    const labelToPropertyUri = new Map();

    for (const [, predicate, object] of allTriples) {
      // Skip RDF meta properties
      if (predicate.startsWith('rdf:') || predicate.startsWith('rdfs:')) {
        continue;
      }

      // Check if this is a property label triple (skip kg:original_label - it's instance metadata, not a property)
      if (predicate.endsWith('_label') && predicate !== 'kg:original_label') {
        const labelValue = object.replace(/^"|"$/g, '');
        propertyLabels.push(labelValue);

        // Map normalized label to property URI
        const normLabel = this._normalizeLabel(labelValue);
        const propertyUri = predicate.slice(0, -6); // Remove '_label' suffix
        labelToPropertyUri.set(normLabel, propertyUri);
      } else if (predicate.endsWith('_precision')) {
        // Store precision metadata
        const propertyUri = predicate.slice(0, -10); // Remove '_precision' suffix
        propertyPrecisions.set(propertyUri, object);
      } else {
        // Regular property
        properties[predicate] = object;
      }
    }

    // Store property label mapping for this instance
    this.propertyLabelMap.set(instanceUri, labelToPropertyUri);

    // Extract value from properties if it exists (for text-derived facts)
    const value = properties['kg:value'];
    const unit = properties['kg:unit'];

    // Cache instance data for fast retrieval
    this.instanceCache.set(instanceUri, {
      uri: instanceUri,
      label,
      year,
      value,  // Add value as top-level field for text-derived facts
      unit,   // Add unit as top-level field
      properties,
      propertyLabels,
      propertyPrecisions  // Include precision map
    });

    // Index by instance label (normalized)
    if (label) {
      const normLabel = this._normalizeLabel(label);
      if (!this.labelIndex.has(normLabel)) {
        this.labelIndex.set(normLabel, []);
      }
      this.labelIndex.get(normLabel).push(instanceUri);
    }

    // ✅ INDEX BY PROPERTY LABELS - This is critical for semantic matching!
    for (const propLabel of propertyLabels) {
      const normLabel = this._normalizeLabel(propLabel);
      if (!this.labelIndex.has(normLabel)) {
        this.labelIndex.set(normLabel, []);
      }
      // Avoid duplicates
      if (!this.labelIndex.get(normLabel).includes(instanceUri)) {
        this.labelIndex.get(normLabel).push(instanceUri);
      }
    }

    // Index by year
    if (year) {
      if (!this.yearIndex.has(year)) {
        this.yearIndex.set(year, []);
      }
      this.yearIndex.get(year).push(instanceUri);
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
      .replace(/[^a-z0-9\s_]/g, '')  // Keep underscores
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

    // Get candidates by label (O(1) lookup - EXACT MATCH ONLY)
    let candidates = this.labelIndex.get(normLabel) || [];

    // With deterministic canonicalization, we expect exact matches
    // If no match found, it means the label doesn't exist in the KG
    if (candidates.length === 0) {
      this.logger?.debug('kg_index_no_match', { label, normLabel });
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

    // Transform candidates into result instances
    const results = [];

    for (const uri of candidates) {
      const instance = this.instanceCache.get(uri);
      if (!instance) continue;

      // Check if search label matches a property label
      const propertyLabelMap = this.propertyLabelMap.get(uri);
      const propertyUri = propertyLabelMap?.get(normLabel);

      if (propertyUri) {
        // This is a property-level match - extract property value
        const value = instance.properties[propertyUri];

        if (value !== undefined) {
          // Get precision for this property
          const precision = instance.propertyPrecisions?.get(propertyUri);

          // Create virtual instance with property value
          results.push({
            uri: `${uri}_${normLabel}`, // Virtual URI
            label: label, // Use original search label
            value: value,
            year: instance.year,
            propertyUri: propertyUri,
            entityUri: uri,
            precision: precision  // Include precision metadata
          });
        }
      } else {
        // This is an instance-level match - return as-is
        results.push(instance);
      }
    }

    return results;
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
