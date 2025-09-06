/**
 * Base Constraint Class
 */
export class Constraint {
  constructor(type) {
    this.type = type;
    this._kgId = `constraint_${Math.random().toString(36).substr(2, 9)}`;
  }

  getId() {
    return this._kgId;
  }

  evaluate(value, context = {}) {
    throw new Error('evaluate must be implemented by constraint subclasses');
  }

  toTriples() {
    return [
      [this.getId(), 'rdf:type', this.type],
      [this.getId(), 'kg:constraintType', this.type]
    ];
  }
}

export default Constraint;
