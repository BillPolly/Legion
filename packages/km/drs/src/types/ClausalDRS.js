/**
 * ClausalDRS - Final output: flat list of conditions
 */
export class ClausalDRS {
  /**
   * @param {string[]} referents - ["x1", "x2", "e1"]
   * @param {Condition[]} conditions - Predicates and relations
   */
  constructor(referents, conditions) {
    this.referents = referents;
    this.conditions = conditions;
  }
}

/**
 * Condition types:
 * - { pred: "student", args: ["x1"] }  // Unary predicate
 * - { pred: "read", args: ["e1"] }      // Event predicate
 * - { rel: "Agent", args: ["e1", "x1"] } // Semantic role
 * - { rel: "Every", args: ["x1"] }      // Quantifier
 * - { rel: "Some", args: ["x2"] }       // Quantifier
 * - { rel: "Not", args: ["S1"] }        // Negation
 */
