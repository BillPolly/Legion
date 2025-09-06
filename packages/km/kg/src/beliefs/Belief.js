/**
 * Represents agent beliefs about facts
 */
export class Belief {
  constructor(agent, subject, predicate, object, data = {}) {
    this.agent = agent;
    this.subject = subject;
    this.predicate = predicate;
    this.object = object;
    this.confidence = data.confidence !== undefined ? data.confidence : 1.0;
    this.source = data.source;
    this.timestamp = data.timestamp || new Date().toISOString();
  }

  toTriples() {
    const beliefId = this.getId();
    const triples = [];

    // Agent believes this belief
    triples.push([this.agent.getId(), 'kg:believes', beliefId]);
    
    // Belief metadata
    triples.push([beliefId, 'rdf:type', 'kg:Belief']);
    triples.push([beliefId, 'kg:subject', this.subject.getId ? this.subject.getId() : this.subject]);
    triples.push([beliefId, 'kg:predicate', this.predicate]);
    triples.push([beliefId, 'kg:object', this.object.getId ? this.object.getId() : this.object]);
    triples.push([beliefId, 'kg:confidence', this.confidence]);
    triples.push([beliefId, 'kg:timestamp', this.timestamp]);
    
    if (this.source) {
      triples.push([beliefId, 'kg:source', this.source]);
    }

    return triples;
  }
}
