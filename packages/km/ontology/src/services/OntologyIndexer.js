/**
 * OntologyIndexer - Central service for indexing ontology classes/properties in semantic search
 *
 * Provides consistent multi-perspective indexing for ontology concepts to enable
 * semantic query understanding in downstream applications.
 */

export class OntologyIndexer {
  /**
   * @param {Object} tripleStore - Triple store containing ontology
   * @param {Object} semanticSearch - SemanticSearchProvider instance
   */
  constructor(tripleStore, semanticSearch) {
    if (!tripleStore) {
      throw new Error('Triple store is required');
    }
    if (!semanticSearch) {
      throw new Error('Semantic search provider is required');
    }

    this.tripleStore = tripleStore;
    this.semanticSearch = semanticSearch;
  }

  /**
   * Index a class in semantic search with multi-perspective vectors
   *
   * Creates 4 perspective embeddings for rich semantic retrieval:
   * - definition: What is this concept?
   * - supertype: What broader category does it belong to?
   * - usage: How is it used in practice?
   * - example: What are examples of this concept?
   *
   * @param {string} classURI - Class URI (e.g., "kg:StockPerformanceIndex")
   * @param {string} label - Human-readable label
   * @returns {Promise<number>} Number of perspectives indexed
   */
  async indexClass(classURI, label) {
    // Get descriptions from ontology
    const definitionTriples = await this.tripleStore.query(classURI, 'skos:definition', null);
    const commentTriples = await this.tripleStore.query(classURI, 'rdfs:comment', null);
    const scopeNoteTriples = await this.tripleStore.query(classURI, 'skos:scopeNote', null);
    const exampleTriples = await this.tripleStore.query(classURI, 'skos:example', null);

    const definition = this._extractValue(definitionTriples);
    const comment = this._extractValue(commentTriples);
    const scopeNote = this._extractValue(scopeNoteTriples);
    const example = this._extractValue(exampleTriples);

    // Create 4 perspectives for rich semantic search
    const perspectives = [
      {
        type: 'definition',
        text: definition ? `${label}: ${definition}` : label
      },
      {
        type: 'supertype',
        text: comment ? `${label}: ${comment}` : label
      },
      {
        type: 'usage',
        text: scopeNote ? `${label}: ${scopeNote}` : label
      },
      {
        type: 'example',
        text: example ? `${label}: ${example}` : label
      }
    ];

    // Index each perspective
    let indexed = 0;
    for (const perspective of perspectives) {
      await this.semanticSearch.insert('ontology-classes', {
        text: perspective.text,
        metadata: {
          classURI,
          label,
          perspectiveType: perspective.type
        }
      });
      indexed++;
    }

    return indexed;
  }

  /**
   * Query ontology semantically for concepts related to a question
   *
   * @param {string} query - Natural language query (e.g., "stock performance index")
   * @param {number} limit - Max number of unique classes to return
   * @param {number} threshold - Minimum similarity threshold (0-1)
   * @returns {Promise<Array>} Array of {classURI, label, similarity}
   */
  async findRelevantConcepts(query, limit = 10, threshold = 0.3) {
    const results = await this.semanticSearch.semanticSearch(
      'ontology-classes',
      query,
      {
        limit: limit * 4,  // Get more results since we deduplicate
        threshold
      }
    );

    // Deduplicate by classURI (multiple perspectives per class)
    // Keep the highest similarity score across all perspectives
    const uniqueClasses = new Map();
    for (const result of results) {
      const uri = result.document.metadata.classURI;
      const existing = uniqueClasses.get(uri);

      if (!existing || result._similarity > existing.similarity) {
        uniqueClasses.set(uri, {
          classURI: uri,
          label: result.document.metadata.label,
          similarity: result._similarity
        });
      }
    }

    // Return top N unique classes, sorted by similarity
    return Array.from(uniqueClasses.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Extract value from triple query result, removing quotes
   * @private
   */
  _extractValue(triples) {
    if (!triples || triples.length === 0) {
      return '';
    }

    // Handle both array format [s, p, o] and object format {object: "value"}
    const value = Array.isArray(triples[0])
      ? triples[0][2]
      : triples[0].object;

    return value ? value.replace(/^"|"$/g, '') : '';
  }
}
