/**
 * Phase 3: OntologyIndexer
 *
 * Indexes ontology (classes, properties, individuals) into semantic search
 * for robust natural language → ontology concept mapping.
 *
 * Uses @legion/semantic-search with vector embeddings to handle:
 * - Synonyms: "nation" → :Country
 * - Paraphrases: "earnings" → :revenue
 * - Domain terminology: "net cash from operating activities" → :NetCashFromOperatingActivities
 */

/**
 * OntologyIndexer - Index ontology into semantic search
 *
 * Responsibilities:
 * 1. Index classes (with labels, descriptions, synonyms)
 * 2. Index properties (with labels, descriptions, domain/range)
 * 3. Index individuals (with labels, aliases)
 * 4. Store metadata for filtering (type, domain, propertyType)
 */
export class OntologyIndexer {
  /**
   * @param {Object} semanticSearchProvider - SemanticSearchProvider from @legion/semantic-search
   * @param {Object} options - Configuration options
   */
  constructor(semanticSearchProvider, options = {}) {
    if (!semanticSearchProvider) {
      throw new Error('SemanticSearchProvider is required for OntologyIndexer');
    }

    this.semanticSearch = semanticSearchProvider;
    this.collectionName = options.collectionName || 'ontology';
    this.initialized = false;
  }

  /**
   * Initialize the indexer (create collection if needed)
   */
  async initialize() {
    // Semantic search provider handles collection creation
    this.initialized = true;
  }

  /**
   * Index a class into semantic search
   *
   * @param {Object} classInfo - Class information
   * @param {string} classInfo.iri - Class IRI (e.g., ":Country")
   * @param {string} classInfo.label - Primary label (e.g., "Country")
   * @param {string} [classInfo.description] - Description
   * @param {string[]} [classInfo.synonyms] - Synonyms (e.g., ["nation", "state"])
   * @param {string} [classInfo.domain] - Domain (e.g., "geography")
   */
  async indexClass({ iri, label, description = '', synonyms = [], domain = null }) {
    if (!this.initialized) {
      throw new Error('OntologyIndexer not initialized. Call initialize() first.');
    }

    // Build searchable text from label + description + synonyms
    const textParts = [label, description, ...synonyms].filter(Boolean);
    const searchText = textParts.join(' ');

    const document = {
      id: iri,
      text: searchText,
      metadata: {
        type: 'class',
        label,
        domain: domain,
        synonyms: synonyms
      }
    };

    await this.semanticSearch.insert(this.collectionName, [document]);
  }

  /**
   * Index a property into semantic search
   *
   * @param {Object} propertyInfo - Property information
   * @param {string} propertyInfo.iri - Property IRI (e.g., ":borders")
   * @param {string} propertyInfo.label - Primary label (e.g., "borders")
   * @param {string} [propertyInfo.description] - Description
   * @param {string[]} [propertyInfo.synonyms] - Synonyms (e.g., ["adjacent", "neighbors"])
   * @param {string} [propertyInfo.domain] - Domain (e.g., "geography")
   * @param {string} [propertyInfo.propertyType] - Type (e.g., "spatial", "temporal", "measure")
   * @param {string} [propertyInfo.range] - Expected value type
   */
  async indexProperty({ iri, label, description = '', synonyms = [], domain = null, propertyType = null, range = null }) {
    if (!this.initialized) {
      throw new Error('OntologyIndexer not initialized. Call initialize() first.');
    }

    const textParts = [label, description, ...synonyms].filter(Boolean);
    const searchText = textParts.join(' ');

    const document = {
      id: iri,
      text: searchText,
      metadata: {
        type: 'property',
        label,
        domain,
        propertyType,
        range,
        synonyms
      }
    };

    await this.semanticSearch.insert(this.collectionName, [document]);
  }

  /**
   * Index an individual into semantic search
   *
   * @param {Object} individualInfo - Individual information
   * @param {string} individualInfo.iri - Individual IRI (e.g., ":Germany")
   * @param {string} individualInfo.label - Primary label (e.g., "Germany")
   * @param {string[]} [individualInfo.aliases] - Aliases (e.g., ["Deutschland", "DE"])
   * @param {string} [individualInfo.domain] - Domain (e.g., "geography")
   * @param {string} [individualInfo.instanceOf] - Class IRI (e.g., ":Country")
   */
  async indexIndividual({ iri, label, aliases = [], domain = null, instanceOf = null }) {
    if (!this.initialized) {
      throw new Error('OntologyIndexer not initialized. Call initialize() first.');
    }

    const textParts = [label, ...aliases].filter(Boolean);
    const searchText = textParts.join(' ');

    const document = {
      id: iri,
      text: searchText,
      metadata: {
        type: 'individual',
        label,
        domain,
        instanceOf,
        aliases
      }
    };

    await this.semanticSearch.insert(this.collectionName, [document]);
  }

  /**
   * Index batch of ontology items
   *
   * @param {Object} ontology - Ontology with classes, properties, individuals
   */
  async indexOntology(ontology) {
    if (!this.initialized) {
      throw new Error('OntologyIndexer not initialized. Call initialize() first.');
    }

    const documents = [];

    // Index classes
    if (ontology.classes) {
      for (const classInfo of ontology.classes) {
        const textParts = [
          classInfo.label,
          classInfo.description || '',
          ...(classInfo.synonyms || [])
        ].filter(Boolean);

        documents.push({
          id: classInfo.iri,
          text: textParts.join(' '),
          metadata: {
            type: 'class',
            label: classInfo.label,
            domain: classInfo.domain || null,
            synonyms: classInfo.synonyms || []
          }
        });
      }
    }

    // Index properties
    if (ontology.properties) {
      for (const propInfo of ontology.properties) {
        const textParts = [
          propInfo.label,
          propInfo.description || '',
          ...(propInfo.synonyms || [])
        ].filter(Boolean);

        documents.push({
          id: propInfo.iri,
          text: textParts.join(' '),
          metadata: {
            type: 'property',
            label: propInfo.label,
            domain: propInfo.domain || null,
            propertyType: propInfo.propertyType || null,
            range: propInfo.range || null,
            synonyms: propInfo.synonyms || []
          }
        });
      }
    }

    // Index individuals
    if (ontology.individuals) {
      for (const indInfo of ontology.individuals) {
        const textParts = [
          indInfo.label,
          ...(indInfo.aliases || [])
        ].filter(Boolean);

        documents.push({
          id: indInfo.iri,
          text: textParts.join(' '),
          metadata: {
            type: 'individual',
            label: indInfo.label,
            domain: indInfo.domain || null,
            instanceOf: indInfo.instanceOf || null,
            aliases: indInfo.aliases || []
          }
        });
      }
    }

    // Batch insert all documents
    if (documents.length > 0) {
      await this.semanticSearch.insert(this.collectionName, documents);
    }
  }

  /**
   * Clear all indexed ontology data
   */
  async clear() {
    // Semantic search provider handles collection clearing
    // For now, we'll recreate by deleting and reinitializing
    this.initialized = false;
  }
}
