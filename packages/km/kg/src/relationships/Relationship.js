/**
 * Base class for reified relationships
 */
export class Relationship {
  constructor(from, to, type, data = {}) {
    this.from = from;
    this.to = to;
    this.type = type;
    this.started = data.started;
    this.finished = data.finished;
    this.confidence = data.confidence;
    this.context = data.context;
    this.source = data.source;
  }

  toTriples() {
    const relationshipId = this.getId();
    const triples = [];

    // Core relationship triple
    triples.push([this.from.getId(), relationshipId, this.to.getId()]);
    
    // Relationship metadata
    triples.push([relationshipId, 'rdf:type', this.constructor.name]);
    triples.push([relationshipId, 'kg:from', this.from.getId()]);
    triples.push([relationshipId, 'kg:to', this.to.getId()]);
    
    if (this.type !== null && this.type !== undefined) triples.push([relationshipId, 'kg:relationType', this.type]);
    if (this.started !== null && this.started !== undefined) triples.push([relationshipId, 'kg:started', this.started]);
    if (this.finished !== null && this.finished !== undefined) triples.push([relationshipId, 'kg:finished', this.finished]);
    if (this.confidence !== null && this.confidence !== undefined) triples.push([relationshipId, 'kg:confidence', this.confidence]);
    if (this.context !== null && this.context !== undefined) triples.push([relationshipId, 'kg:context', this.context]);
    if (this.source !== null && this.source !== undefined) triples.push([relationshipId, 'kg:source', this.source]);

    return triples;
  }
}
