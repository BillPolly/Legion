import { KnowsRelationship } from './KnowsRelationship.js';

/**
 * Specific relationship type for work relationships
 */
export class WorksWithRelationship extends KnowsRelationship {
  constructor(from, to, data = {}) {
    super(from, to, { ...data, context: 'work' });
    this.department = data.department;
    this.role = data.role;
  }

  toTriples() {
    const triples = super.toTriples();
    const relationshipId = this.getId();
    
    if (this.department !== null && this.department !== undefined) triples.push([relationshipId, 'kg:department', this.department]);
    if (this.role !== null && this.role !== undefined) triples.push([relationshipId, 'kg:role', this.role]);
    
    return triples;
  }
}
