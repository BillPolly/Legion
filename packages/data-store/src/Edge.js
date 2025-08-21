/**
 * Edge class representing binary relationship instances
 * Per design §1.1: Only primitive is binary relationship instance (type, src, dst)
 */

export class Edge {
  constructor(type, src, dst) {
    if (type === undefined || type === null) {
      throw new Error('Edge type is required');
    }
    if (typeof type !== 'string') {
      throw new Error('Edge type must be a string');
    }
    if (type === '') {
      throw new Error('Edge type cannot be empty');
    }
    if (src === undefined) {
      throw new Error('Edge src is required');
    }
    if (dst === undefined) {
      throw new Error('Edge dst is required');
    }

    this._type = type;
    this._src = src;
    this._dst = dst;
    
    // Make immutable
    Object.freeze(this);
  }

  get type() {
    return this._type;
  }

  get src() {
    return this._src;
  }

  get dst() {
    return this._dst;
  }

  /**
   * Check equality with another edge
   * Per design: set semantics require equality check
   */
  equals(other) {
    if (!(other instanceof Edge)) {
      return false;
    }
    return this._type === other._type &&
           this._src === other._src &&
           this._dst === other._dst;
  }

  /**
   * Generate hash code for use in sets and maps
   * Per design: edges must be hashable for set semantics
   */
  hashCode() {
    // Simple hash combining all components
    let hash = 0;
    const str = `${this._type}:${this._src}:${this._dst}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `Edge(${this._type}, ${this._src}, ${this._dst})`;
  }

  /**
   * Convert to triple array
   */
  toTriple() {
    return [this._type, this._src, this._dst];
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      type: this._type,
      src: this._src,
      dst: this._dst
    };
  }

  /**
   * Static factory method
   */
  static of(type, src, dst) {
    return new Edge(type, src, dst);
  }

  /**
   * Create edge from triple array
   */
  static fromTriple(triple) {
    if (!Array.isArray(triple) || triple.length !== 3) {
      throw new Error('Triple must have exactly 3 elements');
    }
    return new Edge(triple[0], triple[1], triple[2]);
  }
}