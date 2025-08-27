/**
 * PlanningGoal Value Object
 * Immutable representation of a planning goal
 */

export class PlanningGoal {
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Planning goal must be a non-empty string');
    }
    
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      throw new Error('Planning goal cannot be empty');
    }
    
    if (trimmed.length > 1000) {
      throw new Error('Planning goal cannot exceed 1000 characters');
    }
    
    this._value = trimmed;
    Object.freeze(this);
  }
  
  toString() {
    return this._value;
  }
  
  equals(other) {
    if (!(other instanceof PlanningGoal)) {
      return false;
    }
    return this._value === other._value;
  }
  
  getShortDescription(maxLength = 50) {
    if (this._value.length <= maxLength) {
      return this._value;
    }
    return this._value.substring(0, maxLength - 3) + '...';
  }
}