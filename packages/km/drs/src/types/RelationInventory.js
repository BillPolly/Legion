/**
 * RelationInventory - Closed set of allowed symbols from semantic search
 */
export class RelationInventory {
  /**
   * @param {Object[]} unaryPredicates - Array of WordNet synset objects
   * @param {Object[]} roles - Array of WordNet synset objects
   * @param {Object[]} binaryRelations - Array of WordNet synset objects
   */
  constructor(unaryPredicates, roles, binaryRelations) {
    this.unaryPredicates = unaryPredicates;  // SYNSET OBJECTS
    this.roles = roles;  // SYNSET OBJECTS
    this.binaryRelations = binaryRelations;  // SYNSET OBJECTS
  }
}
