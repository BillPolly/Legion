/**
 * UnaryFact - Property or type assertion about an entity
 */
export class UnaryFact {
  /**
   * @param {Object} synset - WordNet synset object with label, synonyms, definition, etc.
   * @param {string[]} args - [entityId] (arity 1)
   */
  constructor(synset, args) {
    this.synset = synset;  // FULL synset object from WordNet
    this.args = args;
  }

  /**
   * Get the canonical predicate label (for display/serialization)
   * @returns {string}
   */
  get pred() {
    // Handle different synset structures:
    // - Roles have 'label'
    // - Predicates have 'synonyms' array
    if (this.synset.label) {
      return this.synset.label;
    }
    if (this.synset.synonyms && this.synset.synonyms.length > 0) {
      return this.synset.synonyms[0];
    }
    // Fallback to id if neither exists
    return this.synset.id || 'unknown';
  }
}
