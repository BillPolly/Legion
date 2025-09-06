import { Relationship } from './Relationship.js';

/**
 * Specific relationship type for "knows" relationships
 */
export class KnowsRelationship extends Relationship {
  constructor(from, to, data = {}) {
    super(from, to, 'knows', data);
    this.howMet = data.howMet;
    this.closeness = data.closeness;
  }

  toTriples() {
    const triples = super.toTriples();
    const relationshipId = this.getId();
    
    if (this.howMet !== null && this.howMet !== undefined) triples.push([relationshipId, 'kg:howMet', this.howMet]);
    if (this.closeness !== null && this.closeness !== undefined) triples.push([relationshipId, 'kg:closeness', this.closeness]);
    
    return triples;
  }
}
