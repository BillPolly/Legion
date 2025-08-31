/**
 * PlanningSessionId Value Object
 * Immutable unique identifier for planning sessions
 */

export class PlanningSessionId {
  constructor(value = null) {
    this._value = value || this._generateId();
    Object.freeze(this);
  }
  
  _generateId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `session-${timestamp}-${random}`;
  }
  
  toString() {
    return this._value;
  }
  
  equals(other) {
    if (!(other instanceof PlanningSessionId)) {
      return false;
    }
    return this._value === other._value;
  }
  
  static fromString(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Invalid session ID');
    }
    return new PlanningSessionId(value);
  }
}