import { Atom } from './Atom.js';

/**
 * Tuple implementation per design §2.3
 * An ordered vector of Atoms with canonical encoding
 */
export class Tuple {
  constructor(atoms) {
    if (!Array.isArray(atoms)) {
      throw new Error('Atoms must be an array');
    }

    // Validate all elements are Atom instances
    for (let i = 0; i < atoms.length; i++) {
      if (!(atoms[i] instanceof Atom)) {
        throw new Error('All elements must be Atom instances');
      }
    }

    this._atoms = Object.freeze([...atoms]);
    this._arity = atoms.length;
    this._hashCode = null; // Lazy computation
    this._computeHashCode(); // Compute now before freezing
    Object.freeze(this);
  }

  get arity() {
    return this._arity;
  }

  get atoms() {
    return this._atoms;
  }

  equals(other) {
    if (!(other instanceof Tuple)) return false;
    if (this._arity !== other._arity) return false;

    for (let i = 0; i < this._arity; i++) {
      if (!this._atoms[i].equals(other._atoms[i])) {
        return false;
      }
    }
    return true;
  }

  /**
   * Canonical byte encoding per design §2.3
   * Format: [arity:uint8][type-tag+value bytes]*
   */
  toBytes() {
    if (this._arity > 255) {
      throw new Error('Tuple arity cannot exceed 255');
    }

    // Calculate total size
    let totalSize = 1; // For arity byte
    const atomBytes = [];
    
    for (const atom of this._atoms) {
      const bytes = atom.toBytes();
      atomBytes.push(bytes);
      totalSize += bytes.length;
    }

    // Build result
    const result = new Uint8Array(totalSize);
    result[0] = this._arity;
    
    let offset = 1;
    for (const bytes of atomBytes) {
      result.set(bytes, offset);
      offset += bytes.length;
    }

    return result;
  }

  /**
   * Compute hash code during construction
   */
  _computeHashCode() {
    // Simple hash based on bytes
    const bytes = this.toBytes();
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash + bytes[i]) | 0; // 32-bit integer
    }
    this._hashCode = hash;
  }

  /**
   * Hash code for use as Map keys
   */
  hashCode() {
    return this._hashCode;
  }

  /**
   * Project tuple to subset of indices
   */
  project(indices) {
    const projectedAtoms = [];
    for (const index of indices) {
      if (index < 0 || index >= this._arity) {
        throw new Error(`Index ${index} out of bounds for tuple of arity ${this._arity}`);
      }
      projectedAtoms.push(this._atoms[index]);
    }
    return new Tuple(projectedAtoms);
  }

  /**
   * Get atom at index
   */
  get(index) {
    if (index < 0 || index >= this._arity) {
      throw new Error(`Index ${index} out of bounds for tuple of arity ${this._arity}`);
    }
    return this._atoms[index];
  }

  /**
   * String representation for debugging
   */
  toString() {
    const atomStrs = this._atoms.map(atom => `${atom.type}(${atom.value})`);
    return `Tuple(${atomStrs.join(', ')})`;
  }
}