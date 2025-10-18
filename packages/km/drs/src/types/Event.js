/**
 * Event - An occurrence with semantic roles
 */
export class Event {
  /**
   * @param {string} id - "e1", "e2", ...
   * @param {Object} synset - WordNet synset object with label, synonyms, definition, etc.
   * @param {string} tense - "PAST" | "PRESENT" | "FUTURE"
   * @param {string} aspect - "NONE" | "PROGRESSIVE" | "PERFECT"
   * @param {string|null} modal - "can", "must", "should", etc.
   * @param {boolean} neg - Negation flag
   * @param {object} roles - { "Agent": "x1", "Theme": "x2" }
   */
  constructor(id, synset, tense, aspect, modal, neg, roles) {
    this.id = id;
    this.synset = synset;  // FULL synset object from WordNet
    this.tense = tense;
    this.aspect = aspect;
    this.modal = modal;
    this.neg = neg;
    this.roles = roles;
  }

  /**
   * Get the canonical lemma (for display/serialization)
   * @returns {string}
   */
  get lemma() {
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
