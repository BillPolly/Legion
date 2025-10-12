/**
 * Phase 3: SemanticMapper
 *
 * Maps linguistic tokens to ontology IRIs using semantic search.
 *
 * Responsibilities:
 * - Map nouns → classes
 * - Map verbs → properties
 * - Map prepositions → role IRIs
 * - Handle ambiguity (multiple candidates)
 * - Apply confidence thresholds
 * - Context-aware mapping (domain hints, etc.)
 */

/**
 * SemanticMapper - Map tokens to ontology IRIs
 */
export class SemanticMapper {
  /**
   * @param {Object} semanticSearchProvider - SemanticSearchProvider from @legion/semantic-search
   * @param {Object} options - Configuration options
   * @param {string} options.collectionName - Ontology collection name
   * @param {number} options.confidenceThreshold - Minimum confidence score (default: 0.7)
   * @param {number} options.ambiguityThreshold - Score difference for ambiguity (default: 0.1)
   */
  constructor(semanticSearchProvider, options = {}) {
    if (!semanticSearchProvider) {
      throw new Error('SemanticSearchProvider is required for SemanticMapper');
    }

    this.semanticSearch = semanticSearchProvider;
    this.collectionName = options.collectionName || 'ontology';
    this.confidenceThreshold = options.confidenceThreshold ?? 0.7;
    this.ambiguityThreshold = options.ambiguityThreshold ?? 0.1;
  }

  /**
   * Map a noun to a class IRI
   *
   * @param {string} noun - Noun token (e.g., "country", "nation")
   * @param {Object} context - Optional context for disambiguation
   * @param {string} context.domain - Domain hint (e.g., "geography", "finance")
   * @param {number} context.threshold - Override confidence threshold
   * @returns {Promise<Object|null>} Mapping result or null if no match
   *   - Single match: { iri, score, source: 'semantic' }
   *   - Multiple matches: { candidates: [{ iri, score }, ...], ambiguous: true }
   *   - No match: null
   */
  async mapNoun(noun, context = {}) {
    const threshold = context.threshold ?? this.confidenceThreshold;

    // Search semantic index for classes
    const results = await this.semanticSearch.semanticSearch(this.collectionName, noun, {
      limit: 5,
      threshold: 0,  // Get all results, filter manually
      filter: { 'metadata.type': 'class' }
    });

    if (results.length === 0) {
      return null;
    }

    // Apply context-aware scoring
    const scoredResults = this._applyContextScoring(results, context);

    // Sort by score
    scoredResults.sort((a, b) => b.score - a.score);

    // Filter by threshold
    const aboveThreshold = scoredResults.filter(r => r.score >= threshold);

    if (aboveThreshold.length === 0) {
      return null;
    }

    // Check for ambiguity
    if (aboveThreshold.length > 1) {
      const topScore = aboveThreshold[0].score;
      const secondScore = aboveThreshold[1].score;

      // If top two scores are very close, mark as ambiguous
      if (topScore - secondScore < this.ambiguityThreshold) {
        return {
          candidates: aboveThreshold.map(r => ({
            iri: r.document.id,
            score: r.score,
            domain: r.document.metadata.domain
          })),
          ambiguous: true
        };
      }
    }

    // Single clear match
    return {
      iri: aboveThreshold[0].document.id,
      score: aboveThreshold[0].score,
      source: 'semantic',
      domain: aboveThreshold[0].document.metadata.domain
    };
  }

  /**
   * Map a verb to a property IRI
   *
   * @param {string} verb - Verb token (e.g., "borders", "owns")
   * @param {Object} context - Optional context for disambiguation
   * @returns {Promise<Object|null>} Mapping result or null if no match
   */
  async mapVerb(verb, context = {}) {
    const threshold = context.threshold ?? this.confidenceThreshold;

    // Search semantic index for properties
    const results = await this.semanticSearch.semanticSearch(this.collectionName, verb, {
      limit: 5,
      threshold: 0,  // Get all results, filter manually
      filter: { 'metadata.type': 'property' }
    });

    if (results.length === 0) {
      return null;
    }

    // Apply context-aware scoring
    const scoredResults = this._applyContextScoring(results, context);

    // Sort by score
    scoredResults.sort((a, b) => b.score - a.score);

    // Filter by threshold
    const aboveThreshold = scoredResults.filter(r => r.score >= threshold);

    if (aboveThreshold.length === 0) {
      return null;
    }

    // Check for ambiguity
    if (aboveThreshold.length > 1) {
      const topScore = aboveThreshold[0].score;
      const secondScore = aboveThreshold[1].score;

      if (topScore - secondScore < this.ambiguityThreshold) {
        return {
          candidates: aboveThreshold.map(r => ({
            iri: r.document.id,
            score: r.score,
            propertyType: r.document.metadata.propertyType
          })),
          ambiguous: true
        };
      }
    }

    // Single clear match
    return {
      iri: aboveThreshold[0].document.id,
      score: aboveThreshold[0].score,
      source: 'semantic',
      propertyType: aboveThreshold[0].document.metadata.propertyType
    };
  }

  /**
   * Map a preposition to a role IRI (context-sensitive)
   *
   * @param {string} prep - Preposition (e.g., "in", "at", "on")
   * @param {Object} context - Context for disambiguation
   * @param {string} context.npHead - Head noun of NP following prep
   * @param {string} context.type - Expected type: 'temporal', 'spatial', 'measure'
   * @returns {Promise<Object|null>} Mapping result or null if no match
   */
  async mapPreposition(prep, context = {}) {
    // Build search query from prep + context
    let searchQuery = prep;
    if (context.npHead) {
      searchQuery = `${prep} ${context.npHead}`;
    }

    // Search semantic index for properties
    const results = await this.semanticSearch.semanticSearch(this.collectionName, searchQuery, {
      limit: 5,
      threshold: 0,
      filter: { 'metadata.type': 'property' }
    });

    if (results.length === 0) {
      return null;
    }

    // Filter by property type if provided
    let filteredResults = results;
    if (context.type) {
      filteredResults = results.filter(r =>
        r.document.metadata.propertyType === context.type
      );
    }

    if (filteredResults.length === 0) {
      // Fall back to all results if type filter excluded everything
      filteredResults = results;
    }

    // Sort by score
    filteredResults.sort((a, b) => b.score - a.score);

    const topResult = filteredResults[0];

    return {
      iri: topResult.document.id,
      score: topResult.score,
      source: 'semantic',
      propertyType: topResult.document.metadata.propertyType
    };
  }

  /**
   * Map multiple nouns in batch
   *
   * @param {string[]} nouns - Array of noun tokens
   * @param {Object} context - Optional shared context
   * @returns {Promise<Array>} Array of mapping results
   */
  async mapNouns(nouns, context = {}) {
    const results = [];

    for (const noun of nouns) {
      const result = await this.mapNoun(noun, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Map multiple verbs in batch
   *
   * @param {string[]} verbs - Array of verb tokens
   * @param {Object} context - Optional shared context
   * @returns {Promise<Array>} Array of mapping results
   */
  async mapVerbs(verbs, context = {}) {
    const results = [];

    for (const verb of verbs) {
      const result = await this.mapVerb(verb, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Apply context-aware scoring to search results
   *
   * @private
   * @param {Array} results - Semantic search results
   * @param {Object} context - Context for scoring
   * @returns {Array} Results with adjusted scores
   */
  _applyContextScoring(results, context = {}) {
    if (!context.domain) {
      return results;
    }

    // Boost scores for domain matches
    return results.map(result => {
      let score = result.score;

      if (result.document.metadata.domain === context.domain) {
        // Boost by 0.1 for domain match
        score = Math.min(1.0, score + 0.1);
      }

      return {
        ...result,
        score
      };
    });
  }
}
