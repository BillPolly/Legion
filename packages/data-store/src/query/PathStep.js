/**
 * PathStep classes for query path navigation
 * Per design §3: Query Compiler - path+predicate → GraphSpec compilation
 * 
 * PathStep represents a single navigation step in a query path,
 * supporting forward traversal, inverse traversal, and literal matching.
 */

/**
 * Base class for path navigation steps
 */
export class PathStep {
  constructor(type) {
    if (new.target === PathStep) {
      throw new Error('PathStep is an abstract class');
    }
    if (!type) {
      throw new Error('Step type is required');
    }
    this._type = type;
  }

  /**
   * Get the step type
   */
  get type() {
    return this._type;
  }

  /**
   * Check if this is a forward step
   */
  isForward() {
    return false;
  }

  /**
   * Check if this is an inverse step
   */
  isInverse() {
    return false;
  }

  /**
   * Check if this is a literal step
   */
  isLiteral() {
    return false;
  }

  /**
   * Convert step to GraphSpec representation
   * To be implemented by subclasses
   */
  toGraphSpec(variableMap) {
    throw new Error('toGraphSpec must be implemented by subclass');
  }

  /**
   * Get the relation name for this step
   * To be implemented by subclasses
   */
  getRelationName() {
    throw new Error('getRelationName must be implemented by subclass');
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `${this.constructor.name}(${this._type})`;
  }
}

/**
 * Forward traversal step: navigate from source to destination
 * Example: worksAt means follow the worksAt relation forward
 */
export class ForwardStep extends PathStep {
  constructor(relationName) {
    if (!relationName) {
      throw new Error('Relation name is required for forward step');
    }
    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    super('forward');
    this._relationName = relationName;
  }

  /**
   * Get the relation name
   */
  get relationName() {
    return this._relationName;
  }

  isForward() {
    return true;
  }

  getRelationName() {
    return this._relationName;
  }

  /**
   * Convert to GraphSpec edge pattern
   * Forward step creates edge: (src) -[relationName]-> (dst)
   */
  toGraphSpec(variableMap) {
    if (!variableMap) {
      throw new Error('Variable map is required');
    }
    
    return {
      type: 'edge',
      relation: this._relationName,
      direction: 'forward',
      source: variableMap.current,
      target: variableMap.next
    };
  }

  toString() {
    return `ForwardStep(${this._relationName})`;
  }

  /**
   * Check equality
   */
  equals(other) {
    return other instanceof ForwardStep && 
           other._relationName === this._relationName;
  }
}

/**
 * Inverse traversal step: navigate from destination to source
 * Example: ^worksAt means follow the worksAt relation backward
 */
export class InverseStep extends PathStep {
  constructor(relationName) {
    if (!relationName) {
      throw new Error('Relation name is required for inverse step');
    }
    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    super('inverse');
    this._relationName = relationName;
  }

  /**
   * Get the relation name
   */
  get relationName() {
    return this._relationName;
  }

  isInverse() {
    return true;
  }

  getRelationName() {
    return this._relationName;
  }

  /**
   * Convert to GraphSpec edge pattern
   * Inverse step creates edge: (dst) <-[relationName]- (src)
   */
  toGraphSpec(variableMap) {
    if (!variableMap) {
      throw new Error('Variable map is required');
    }
    
    return {
      type: 'edge',
      relation: this._relationName,
      direction: 'backward',
      source: variableMap.current,
      target: variableMap.next
    };
  }

  toString() {
    return `InverseStep(^${this._relationName})`;
  }

  /**
   * Check equality
   */
  equals(other) {
    return other instanceof InverseStep && 
           other._relationName === this._relationName;
  }
}

/**
 * Literal matching step: match a specific value
 * Example: ="alice" means the current position must be "alice"
 */
export class LiteralStep extends PathStep {
  constructor(value) {
    if (value === undefined) {
      throw new Error('Value is required for literal step');
    }
    super('literal');
    this._value = value;
  }

  /**
   * Get the literal value
   */
  get value() {
    return this._value;
  }

  isLiteral() {
    return true;
  }

  getRelationName() {
    return null; // Literals don't have relation names
  }

  /**
   * Convert to GraphSpec constraint
   * Literal step creates constraint: variable = value
   */
  toGraphSpec(variableMap) {
    if (!variableMap) {
      throw new Error('Variable map is required');
    }
    
    return {
      type: 'constraint',
      operator: 'equals',
      variable: variableMap.current,
      value: this._value
    };
  }

  toString() {
    return `LiteralStep(=${JSON.stringify(this._value)})`;
  }

  /**
   * Check equality
   */
  equals(other) {
    return other instanceof LiteralStep && 
           other._value === this._value;
  }
}

/**
 * Factory for creating path steps from different representations
 */
export class PathStepFactory {
  /**
   * Create a path step from a string representation
   * - "relationName" -> ForwardStep
   * - "^relationName" -> InverseStep
   * - "=value" -> LiteralStep
   */
  static fromString(stepString) {
    if (!stepString || typeof stepString !== 'string') {
      throw new Error('Step string is required');
    }

    // Check for inverse step (starts with ^)
    if (stepString.startsWith('^')) {
      const relationName = stepString.substring(1);
      if (!relationName) {
        throw new Error('Relation name required after ^');
      }
      return new InverseStep(relationName);
    }

    // Check for literal step (starts with =)
    if (stepString.startsWith('=')) {
      const valueStr = stepString.substring(1);
      // Try to parse as JSON, fallback to string
      let value;
      try {
        value = JSON.parse(valueStr);
      } catch {
        value = valueStr;
      }
      return new LiteralStep(value);
    }

    // Default to forward step
    return new ForwardStep(stepString);
  }

  /**
   * Create path steps from an array of strings
   */
  static fromArray(stepStrings) {
    if (!Array.isArray(stepStrings)) {
      throw new Error('Step strings must be an array');
    }

    return stepStrings.map(str => PathStepFactory.fromString(str));
  }

  /**
   * Create a path step from an object representation
   */
  static fromObject(obj) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Step object is required');
    }

    switch (obj.type) {
      case 'forward':
        return new ForwardStep(obj.relation);
      case 'inverse':
        return new InverseStep(obj.relation);
      case 'literal':
        return new LiteralStep(obj.value);
      default:
        throw new Error(`Unknown step type: ${obj.type}`);
    }
  }
}