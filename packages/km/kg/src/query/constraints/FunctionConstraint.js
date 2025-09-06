import { Constraint } from './Constraint.js';

/**
 * Function Constraint for custom validation logic
 */
export class FunctionConstraint extends Constraint {
  constructor(fn, description = '') {
    super('kg:FunctionConstraint');
    if (typeof fn !== 'function') {
      throw new Error('FunctionConstraint requires a valid function');
    }
    this.fn = fn;
    this.description = description;
  }

  evaluate(value, context = {}) {
    if (value === null || value === undefined) return false;
    return this.fn(value, context);
  }

  getErrorMessage(value) {
    return this.description || `Value ${value} violates constraint`;
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();
    
    triples.push([id, 'kg:description', this.description]);
    triples.push([id, 'kg:functionBody', this.fn.toString()]);
    
    return triples;
  }
}

export default FunctionConstraint;
