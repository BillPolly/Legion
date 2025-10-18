/**
 * RelationCategorizer - Categorize adverb synsets into relation types
 *
 * Categorizes WordNet adverb synsets into relation types using:
 * - Strategy 1: Synonym analysis (check if synonym is a known spatial/temporal/logical word)
 * - Strategy 2: Definition keyword analysis
 * - Fallback: logical (default for adverbs)
 */

export class RelationCategorizer {
  /**
   * Create a new RelationCategorizer
   */
  constructor() {
    // Spatial relation keywords - indicate location/direction/position
    this.spatialKeywords = [
      'location', 'place', 'position', 'direction', 'inside', 'outside',
      'lower', 'higher', 'distance', 'space', 'side', 'area', 'vicinity',
      'front', 'end'
    ];

    // Temporal relation keywords - indicate time
    this.temporalKeywords = [
      'time', 'when', 'duration', 'sequence', 'moment', 'future',
      'subsequent', 'present', 'past', 'occasion', 'deadline'
    ];

    // Spatial relation words - specific synonyms that indicate spatial relations
    this.spatialWords = [
      'in', 'inside', 'out', 'outside', 'on', 'upon', 'under', 'below',
      'above', 'over', 'near', 'close', 'far', 'between', 'beside',
      'around', 'about', 'through', 'across', 'along', 'behind', 'ahead'
    ];

    // Temporal relation words - specific synonyms that indicate temporal relations
    this.temporalWords = [
      'before', 'after', 'during', 'while', 'when', 'then', 'now',
      'soon', 'later', 'always', 'never', 'sometimes', 'often', 'rarely',
      'once', 'twice', 'again', 'still', 'yet', 'already', 'since', 'until'
    ];

    // Logical relation words - causation, condition, consequence
    this.logicalWords = [
      'because', 'therefore', 'thus', 'hence', 'if', 'unless', 'although',
      'though', 'however', 'nevertheless', 'nonetheless', 'so', 'accordingly',
      'consequently', 'otherwise'
    ];
  }

  /**
   * Categorize an adverb synset into a relation type
   *
   * @param {Object} synset - Synset object from MongoDB with pos, synonyms, definition
   * @returns {string} Relation type (spatial, temporal, or logical)
   */
  categorizeRelationType(synset) {
    // Strategy 1: Check if any synonym is a known relation word
    if (synset.synonyms && Array.isArray(synset.synonyms)) {
      for (const synonym of synset.synonyms) {
        const lowerSynonym = synonym.toLowerCase();

        // Check spatial words first (most specific)
        if (this.spatialWords.includes(lowerSynonym)) {
          return 'spatial';
        }

        // Check temporal words
        if (this.temporalWords.includes(lowerSynonym)) {
          return 'temporal';
        }

        // Check logical words
        if (this.logicalWords.includes(lowerSynonym)) {
          return 'logical';
        }
      }
    }

    // Strategy 2: Definition keyword analysis
    if (synset.definition) {
      const lowerDef = synset.definition.toLowerCase();

      // Check for spatial keywords
      for (const keyword of this.spatialKeywords) {
        if (lowerDef.includes(keyword)) {
          return 'spatial';
        }
      }

      // Check for temporal keywords
      for (const temporalKeyword of this.temporalKeywords) {
        if (lowerDef.includes(temporalKeyword)) {
          return 'temporal';
        }
      }
    }

    // Fallback: logical (default for adverbs that don't clearly fit spatial/temporal)
    return 'logical';
  }
}
