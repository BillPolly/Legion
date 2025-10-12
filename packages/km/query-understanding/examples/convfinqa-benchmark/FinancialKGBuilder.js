/**
 * FinancialKGBuilder - Convert ConvFinQA tables to KG facts + ontology
 *
 * Transforms financial tables into:
 * 1. KG facts stored in DataStore (entity-attribute-value triples with temporal info)
 * 2. Domain ontology indexed in Qdrant (classes, properties, synonyms)
 *
 * For ConvFinQA benchmarks, each example gets its own isolated ontology collection
 * and fresh DataStore, ensuring no cross-contamination between examples.
 */

export class FinancialKGBuilder {
  constructor(resourceManager) {
    this.resourceManager = resourceManager;
    this.dataStore = null;
    this.semanticSearch = null;
    this.collectionName = null;
  }

  /**
   * Initialize builder and prepare for a specific example
   *
   * @param {string} exampleId - Unique example ID (used for collection name)
   */
  async initialize(exampleId) {
    // Create simple in-memory fact store
    // Structure: { entityId: { attribute: { year: value } } }
    this.facts = {};

    this.semanticSearch = await this.resourceManager.get('semanticSearch');
    if (!this.semanticSearch) {
      throw new Error('Semantic search not available in ResourceManager');
    }

    // Generate unique collection name for this example's ontology
    this.collectionName = `convfinqa-${exampleId.replace(/[^a-z0-9]/gi, '-')}`;
  }

  /**
   * Ingest a ConvFinQA document and build KG + ontology
   *
   * @param {Object} doc - ConvFinQA document { table, pre_text, post_text }
   * @returns {Promise<Object>} Ingestion stats
   */
  async ingest(doc) {
    const { table, pre_text, post_text } = doc;

    // 1. Clear any existing collection with this name
    await this.clear();

    // 2. Extract entities and attributes from table
    const { entities, attributes, facts } = this._extractTableStructure(table);

    // 3. Build ontology schema
    const ontologySchema = this._buildOntologySchema(entities, attributes);

    // 4. Index ontology in Qdrant
    await this._indexOntology(ontologySchema);

    // 5. Store facts in DataStore
    await this._storeFacts(facts);

    return {
      entitiesCount: entities.length,
      attributesCount: attributes.length,
      factsCount: facts.length,
      ontologyCollection: this.collectionName,
      facts: this.facts  // Return facts for use in queries
    };
  }

  /**
   * Extract entities, attributes, and facts from table
   *
   * ConvFinQA tables have structure:
   * {
   *   "12/31/04": { "united parcel service inc .": 100, "s&p 500 index": 100 },
   *   "12/31/09": { "united parcel service inc .": 75.95, "s&p 500 index": 102.11 }
   * }
   *
   * We extract:
   * - Entities: Companies/indices (columns)
   * - Attributes: Always "performance" for this dataset
   * - Facts: [entity, attribute, value, year]
   *
   * @private
   */
  _extractTableStructure(table) {
    const entities = new Set();
    const attributes = new Set(['performance']); // ConvFinQA is about performance values
    const facts = [];

    // Iterate over date rows
    for (const [dateStr, row] of Object.entries(table)) {
      // Parse year from date string
      const year = this._parseYear(dateStr);

      // Iterate over entity columns
      for (const [entityName, value] of Object.entries(row)) {
        // Normalize entity name
        const normalizedEntity = this._normalizeEntityName(entityName);
        entities.add(normalizedEntity);

        // Create fact
        facts.push({
          entity: normalizedEntity,
          attribute: 'performance',
          value: parseFloat(value),
          year: year,
          rawEntityName: entityName // Keep original for reference
        });
      }
    }

    return {
      entities: Array.from(entities),
      attributes: Array.from(attributes),
      facts
    };
  }

  /**
   * Parse year from date string
   *
   * Examples:
   * - "12/31/04" → 2004
   * - "12/31/2009" → 2009
   * - "2009" → 2009
   *
   * @private
   */
  _parseYear(dateStr) {
    // Try to find 4-digit year
    const match4 = dateStr.match(/\b(19|20)\d{2}\b/);
    if (match4) {
      return parseInt(match4[0], 10);
    }

    // Try to find 2-digit year and assume 20xx
    const match2 = dateStr.match(/\b(\d{2})$/);
    if (match2) {
      const twoDigit = parseInt(match2[1], 10);
      // Assume 00-30 → 2000-2030, 31-99 → 1931-1999
      return twoDigit <= 30 ? 2000 + twoDigit : 1900 + twoDigit;
    }

    throw new Error(`Could not parse year from date string: ${dateStr}`);
  }

  /**
   * Normalize entity name to IRI format
   *
   * Examples:
   * - "united parcel service inc ." → "ups"
   * - "s&p 500 index" → "sp500"
   * - "dow jones transportation average" → "dj_transport"
   *
   * @private
   */
  _normalizeEntityName(name) {
    const lower = name.toLowerCase().trim();

    // Special cases for common entities
    if (lower.includes('united parcel') || lower.includes('ups')) {
      return 'ups';
    }
    if (lower.includes('s&p 500') || lower.includes('s & p 500')) {
      return 'sp500';
    }
    if (lower.includes('dow jones') && lower.includes('transport')) {
      return 'dj_transport';
    }

    // Generic normalization: remove punctuation, replace spaces with underscores
    return lower
      .replace(/[.&]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Build ontology schema from extracted entities and attributes
   *
   * Creates:
   * - Class definitions (Company, Index) - the TYPES
   * - Property definitions (performance, name) - the RELATIONS
   * - Individual definitions (UPS, S&P500) - the INSTANCES
   *
   * This is the CORRECT ontology structure:
   * - Classes: Company, Index (abstract types)
   * - Individuals: UPS (instance of Company), S&P500 (instance of Index)
   *
   * @private
   */
  _buildOntologySchema(entities, attributes) {
    const classes = [];
    const properties = [];
    const individuals = [];

    // Define abstract CLASSES (the types/categories)
    classes.push({
      iri: ':Company',
      type: 'class',
      label: 'Company',
      synonyms: ['company', 'service', 'inc', 'corporation', 'business'],
      description: 'A business organization or corporation'
    });

    classes.push({
      iri: ':Index',
      type: 'class',
      label: 'Index',
      synonyms: ['index', 'average', 'benchmark', 'indicator'],
      description: 'A financial market index or average'
    });

    // Create INDIVIDUALS (instances of the classes)
    for (const entityId of entities) {
      // Determine instance type based on name patterns
      let instanceOf = ':Company';  // Default to Company
      let rawLabel = entityId.replace(/_/g, ' ');
      const lowerLabel = rawLabel.toLowerCase();

      // Classify as Index if name contains index/average keywords
      // Common index patterns: "index", "average", "S&P", "Dow Jones", "transport"
      const indexKeywords = [
        'index',
        'average',
        'sp500',
        's&p',
        'dj transport',  // Normalized form of "Dow Jones Transportation"
        'dow jones',
        'transport',     // Transportation Average
        'nasdaq',
        'russell',
        'ftse',
        'dax',
        'nikkei'
      ];

      if (indexKeywords.some(keyword => lowerLabel.includes(keyword))) {
        instanceOf = ':Index';
      }

      // Generate human-readable label
      const label = rawLabel
        .replace(/\b\w/g, char => char.toUpperCase());

      // Generate aliases (variations of the name)
      const aliases = [
        entityId,                    // "ups"
        entityId.replace(/_/g, ' '), // "ups" (same for ups, but "s p 500" for others)
        label.toLowerCase(),          // "ups"
        label                        // "Ups"
      ];

      individuals.push({
        iri: `:${entityId}`,
        type: 'individual',
        label: label,
        aliases: aliases,
        instanceOf: instanceOf,
        description: `${instanceOf === ':Company' ? 'Company' : 'Index'}: ${label}`
      });
    }

    // Create property definitions
    properties.push({
      iri: ':performance',
      type: 'property',
      label: 'Performance',
      synonyms: ['performance', 'value', 'price', 'index value', 'stock price'],
      description: 'Performance value over time',
      domain: ':Company',
      range: 'xsd:decimal'
    });

    properties.push({
      iri: ':name',
      type: 'property',
      label: 'Name',
      synonyms: ['name', 'company name', 'entity name', 'title'],
      description: 'Name of the entity'
    });

    return {
      classes,
      properties,
      individuals
    };
  }

  /**
   * Index ontology in Qdrant for semantic search
   *
   * Indexes:
   * - Classes (Company, Index) - abstract types
   * - Properties (performance, name) - relations
   * - Individuals (UPS, S&P500) - concrete instances
   *
   * @private
   */
  async _indexOntology(schema) {
    const { OntologyIndexer } = await import('../../src/phase3/OntologyIndexer.js');

    const indexer = new OntologyIndexer(this.semanticSearch, {
      collectionName: this.collectionName
    });

    // Initialize indexer (creates collection)
    await indexer.initialize();

    // Index classes (Company, Index)
    for (const cls of schema.classes) {
      await indexer.indexClass(cls);
    }

    // Index properties (performance, name)
    for (const prop of schema.properties) {
      await indexer.indexProperty(prop);
    }

    // Index individuals (UPS, S&P500, etc.)
    for (const individual of schema.individuals) {
      await indexer.indexIndividual(individual);
    }

    console.log(`✓ Indexed ${schema.classes.length} classes, ${schema.properties.length} properties, and ${schema.individuals.length} individuals in ${this.collectionName}`);
  }

  /**
   * Store facts in simple in-memory structure
   *
   * Structure: { entityId: { attribute: { year: value } } }
   *
   * @private
   */
  async _storeFacts(facts) {
    for (const fact of facts) {
      const entityId = `:${fact.entity}`;

      if (!this.facts[entityId]) {
        this.facts[entityId] = {
          ':name': fact.entity,
          ':performance': {}
        };
      }

      // Store value by year
      this.facts[entityId][':performance'][fact.year] = fact.value;
    }

    console.log(`✓ Stored ${facts.length} facts`);
  }

  /**
   * Clear this example's ontology collection
   */
  async clear() {
    // Clear Qdrant collection for this example
    try {
      const qdrantClient = await this.resourceManager.get('qdrantClient');
      await qdrantClient.deleteCollection(this.collectionName);
      console.log(`✓ Cleared collection ${this.collectionName}`);
    } catch (error) {
      // Collection might not exist, that's okay
    }
  }
}
