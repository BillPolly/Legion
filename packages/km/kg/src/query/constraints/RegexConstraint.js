import { Constraint } from './Constraint.js';

/**
 * Regex Constraint for pattern matching
 */
export class RegexConstraint extends Constraint {
  constructor(pattern, flags = '') {
    super('kg:RegexConstraint');
    
    if (pattern === null || pattern === undefined) {
      throw new Error('Pattern cannot be null or undefined');
    }
    
    this.pattern = pattern;
    this.flags = flags;
    
    try {
      this.regex = new RegExp(pattern, flags);
    } catch (error) {
      throw new Error('Invalid regular expression');
    }
  }

  evaluate(value) {
    if (value === null || value === undefined) return false;
    return this.regex.test(String(value));
  }

  getErrorMessage(value) {
    return `Value "${value}" does not match the required pattern: ${this.pattern}`;
  }

  toTriples() {
    const triples = super.toTriples();
    const id = this.getId();
    
    triples.push([id, 'kg:pattern', this.pattern]);
    triples.push([id, 'kg:regexFlags', this.flags]);
    
    return triples;
  }
}

export default RegexConstraint;
