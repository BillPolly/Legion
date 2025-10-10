/**
 * SemanticValidator - Validate knowledge graph coverage using semantic similarity
 *
 * Compares source text with KG-generated text using embeddings to verify
 * that the knowledge graph captures all information from the source.
 */
export class SemanticValidator {
  constructor({ semanticSearch }) {
    if (!semanticSearch) {
      throw new Error('SemanticValidator requires semanticSearch');
    }

    this.semanticSearch = semanticSearch;
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * @param {Array<number>} vec1 - First embedding vector
   * @param {Array<number>} vec2 - Second embedding vector
   * @returns {number} Cosine similarity (0-1)
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Calculate semantic similarity between two texts
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {Promise<number>} Similarity score (0-1)
   */
  async calculateSimilarity(text1, text2) {
    // Get embeddings for both texts using embeddingService
    const embeddings1 = await this.semanticSearch.embeddingService.generateEmbeddings([text1]);
    const embeddings2 = await this.semanticSearch.embeddingService.generateEmbeddings([text2]);

    const embedding1 = embeddings1[0];
    const embedding2 = embeddings2[0];

    // Calculate cosine similarity
    const similarity = this.cosineSimilarity(embedding1, embedding2);

    return similarity;
  }

  /**
   * Validate knowledge graph coverage against source text
   * @param {string} sourceText - Original source text
   * @param {string} kgText - Text generated from knowledge graph
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result with similarity and completeness
   */
  async validateCoverage(sourceText, kgText, options = {}) {
    const { threshold = 0.9 } = options;

    // Calculate semantic similarity
    const similarity = await this.calculateSimilarity(sourceText, kgText);

    // Determine if coverage is complete
    const complete = similarity >= threshold;

    const result = {
      similarity,
      complete,
      threshold
    };

    if (!complete) {
      result.message = `Coverage incomplete: similarity ${similarity.toFixed(3)} < threshold ${threshold}`;
    }

    return result;
  }
}
