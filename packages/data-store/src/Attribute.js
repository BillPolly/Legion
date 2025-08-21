/**
 * Attribute classes for forward/backward relationship views
 * Per design §1.1: Every relationship type R has two attribute names
 */

/**
 * Abstract base class for attributes
 * Per design §1.2: Forward A[src, dst] and Backward A_inv[dst, src]
 */
export class Attribute {
  constructor() {
    if (this.constructor === Attribute) {
      throw new Error('Cannot instantiate abstract Attribute class');
    }
  }

  /**
   * Create forward attribute
   */
  static forward(forwardName, backwardName) {
    return new ForwardAttribute(forwardName, backwardName);
  }

  /**
   * Create backward attribute
   */
  static backward(forwardName, backwardName) {
    return new BackwardAttribute(forwardName, backwardName);
  }

  /**
   * Create both forward and backward attributes
   */
  static both(forwardName, backwardName) {
    return [
      new ForwardAttribute(forwardName, backwardName),
      new BackwardAttribute(forwardName, backwardName)
    ];
  }
}

/**
 * Forward attribute: src → dst direction
 * Per design: Forward relation A[src, dst]
 */
export class ForwardAttribute extends Attribute {
  constructor(forwardName, backwardName) {
    super();

    if (forwardName === null || forwardName === undefined) {
      throw new Error('Forward name is required');
    }
    if (backwardName === null || backwardName === undefined) {
      throw new Error('Backward name is required');
    }
    if (typeof forwardName !== 'string') {
      throw new Error('Forward name must be a string');
    }
    if (typeof backwardName !== 'string') {
      throw new Error('Backward name must be a string');
    }
    if (forwardName === '') {
      throw new Error('Forward name cannot be empty');
    }
    if (backwardName === '') {
      throw new Error('Backward name cannot be empty');
    }

    this._forwardName = forwardName;
    this._backwardName = backwardName;
    this._name = forwardName; // Forward attribute uses forward name
    
    Object.freeze(this);
  }

  get name() {
    return this._name;
  }

  get forwardName() {
    return this._forwardName;
  }

  get backwardName() {
    return this._backwardName;
  }

  get isForward() {
    return true;
  }

  get isBackward() {
    return false;
  }

  /**
   * Get kernel relation name per design §1.2
   * Forward uses the attribute name directly
   */
  get kernelRelationName() {
    return this._forwardName;
  }

  /**
   * Get the inverse (backward) attribute
   */
  getInverse() {
    return new BackwardAttribute(this._forwardName, this._backwardName);
  }

  /**
   * Get source atom for this attribute direction
   * Forward: src → dst, so source is src
   */
  getSourceAtom(edge) {
    return edge.src;
  }

  /**
   * Get target atom for this attribute direction
   * Forward: src → dst, so target is dst
   */
  getTargetAtom(edge) {
    return edge.dst;
  }

  /**
   * Check equality
   */
  equals(other) {
    if (!(other instanceof ForwardAttribute)) {
      return false;
    }
    return this._forwardName === other._forwardName &&
           this._backwardName === other._backwardName;
  }

  /**
   * String representation
   */
  toString() {
    return `ForwardAttribute(${this._forwardName}, ${this._backwardName})`;
  }
}

/**
 * Backward attribute: dst → src direction (inverse)
 * Per design: Backward relation A_inv[dst, src]
 */
export class BackwardAttribute extends Attribute {
  constructor(forwardName, backwardName) {
    super();

    if (forwardName === null || forwardName === undefined) {
      throw new Error('Forward name is required');
    }
    if (backwardName === null || backwardName === undefined) {
      throw new Error('Backward name is required');
    }
    if (typeof forwardName !== 'string') {
      throw new Error('Forward name must be a string');
    }
    if (typeof backwardName !== 'string') {
      throw new Error('Backward name must be a string');
    }
    if (forwardName === '') {
      throw new Error('Forward name cannot be empty');
    }
    if (backwardName === '') {
      throw new Error('Backward name cannot be empty');
    }

    this._forwardName = forwardName;
    this._backwardName = backwardName;
    this._name = backwardName; // Backward attribute uses backward name
    
    Object.freeze(this);
  }

  get name() {
    return this._name;
  }

  get forwardName() {
    return this._forwardName;
  }

  get backwardName() {
    return this._backwardName;
  }

  get isForward() {
    return false;
  }

  get isBackward() {
    return true;
  }

  /**
   * Get kernel relation name per design §1.2
   * Backward uses _inv suffix: A_inv[dst, src]
   */
  get kernelRelationName() {
    return `${this._forwardName}_inv`;
  }

  /**
   * Get the inverse (forward) attribute
   */
  getInverse() {
    return new ForwardAttribute(this._forwardName, this._backwardName);
  }

  /**
   * Get source atom for this attribute direction
   * Backward: dst → src, so source is dst (reversed)
   */
  getSourceAtom(edge) {
    return edge.dst;
  }

  /**
   * Get target atom for this attribute direction
   * Backward: dst → src, so target is src (reversed)
   */
  getTargetAtom(edge) {
    return edge.src;
  }

  /**
   * Check equality
   */
  equals(other) {
    if (!(other instanceof BackwardAttribute)) {
      return false;
    }
    return this._forwardName === other._forwardName &&
           this._backwardName === other._backwardName;
  }

  /**
   * String representation
   */
  toString() {
    return `BackwardAttribute(${this._forwardName}, ${this._backwardName})`;
  }
}