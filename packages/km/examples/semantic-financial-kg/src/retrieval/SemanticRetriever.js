/**
 * SemanticRetriever - Retrieve relevant ontology candidates using semantic search
 *
 * Finds ontology entities (classes and properties) that are semantically similar
 * to a given sentence using embeddings and vector search.
 */

export class SemanticRetriever {
  constructor(semanticSearchProvider, ontology, collectionName = 'ontology') {
    if (!semanticSearchProvider) {
      throw new Error('SemanticSearchProvider is required');
    }
    if (!ontology) {
      throw new Error('Ontology is required');
    }
    this.semanticSearch = semanticSearchProvider;
    this.ontology = ontology;
    this.collectionName = collectionName;
  }

  /**
   * Retrieve ontology candidates for a sentence
   * @param {string} sentence - Simple sentence to search for
   * @param {Object} options - Options for retrieval
   * @param {number} options.topK - Number of candidates to return (default: 10)
   * @param {number} options.threshold - Minimum similarity threshold (default: 0.3)
   * @returns {Object} - { candidates: [...] }
   */
  async retrieve(sentence, options = {}) {
    const { topK = 10, threshold = 0.3 } = options;

    // Query semantic search with sentence
    const results = await this.semanticSearch.semanticSearch(
      this.collectionName,
      sentence,
      {
        limit: topK,
        threshold: threshold
      }
    );

    // Enrich results with full ontology definitions
    const candidates = results.map(result => {
      const uri = result.payload.uri;
      const type = result.payload.type;

      // Get full definition from ontology
      let definition = {};
      if (type === 'class') {
        const classObj = this.ontology.classes.get(uri);
        if (classObj) {
          definition = {
            label: classObj.label,
            comment: classObj.comment
          };
        }
      } else if (type === 'property') {
        const propObj = this.ontology.properties.get(uri);
        if (propObj) {
          definition = {
            label: propObj.label,
            comment: propObj.comment,
            propertyType: propObj.type,
            domain: propObj.domain,
            range: propObj.range
          };
        }
      }

      return {
        uri: uri,
        type: type,
        score: result.score,
        ...definition
      };
    });

    return { candidates };
  }
}
