/**
 * SentenceAnnotator - Attach type metadata to sentences
 *
 * Simple service that packages sentences with their type information
 * and domain context for downstream processing.
 */

export class SentenceAnnotator {
  constructor() {
    // No dependencies required
  }

  /**
   * Annotate a sentence with type metadata
   *
   * @param {string} sentence - The sentence text
   * @param {Array} types - Array of type information from OntologyQueryService
   * @param {string} domain - Domain context (default: 'general')
   * @returns {Object} - Annotated sentence
   * @returns {string} return.text - The sentence text
   * @returns {Array} return.types - The type information with full hierarchy
   * @returns {string} return.domain - The domain context
   */
  annotate(sentence, types, domain = 'general') {
    return {
      text: sentence,
      types,
      domain
    };
  }
}
