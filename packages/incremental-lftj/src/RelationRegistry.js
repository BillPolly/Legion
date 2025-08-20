import { Schema } from './Schema.js';

/**
 * Relation registry per design §3.2
 * Tracks name → schema mapping
 */
export class RelationRegistry {
  constructor() {
    this._schemas = new Map();
  }

  /**
   * Register a relation with its schema
   */
  register(relationName, schema) {
    if (typeof relationName !== 'string') {
      throw new Error('Relation name must be a string');
    }
    if (!(schema instanceof Schema)) {
      throw new Error('Schema must be a Schema instance');
    }
    if (this._schemas.has(relationName)) {
      throw new Error(`Relation ${relationName} already exists`);
    }

    this._schemas.set(relationName, schema);
  }

  /**
   * Get schema for a relation
   */
  getSchema(relationName) {
    if (!this._schemas.has(relationName)) {
      throw new Error(`Relation ${relationName} not found`);
    }
    return this._schemas.get(relationName);
  }

  /**
   * Check if relation exists
   */
  hasRelation(relationName) {
    return this._schemas.has(relationName);
  }

  /**
   * Get all relation names
   */
  getRelationNames() {
    return Array.from(this._schemas.keys()).sort();
  }

  /**
   * Remove a relation
   */
  remove(relationName) {
    if (!this._schemas.has(relationName)) {
      throw new Error(`Relation ${relationName} not found`);
    }
    this._schemas.delete(relationName);
  }

  /**
   * Clear all relations
   */
  clear() {
    this._schemas.clear();
  }

  /**
   * Get count of registered relations
   */
  get size() {
    return this._schemas.size;
  }
}