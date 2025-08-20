import { Node } from './Node.js';
import { Schema } from './Schema.js';

/**
 * Rename operator per design §4.1
 * Variable renaming (stateless; applied to Δ in-flight)
 * Often compiled away
 */
export class RenameNode extends Node {
  constructor(id, variableMapping) {
    super(id);

    if (!variableMapping) {
      throw new Error('Variable mapping must be provided');
    }

    // Convert object to Map if needed
    if (variableMapping instanceof Map) {
      this._variableMapping = new Map(variableMapping);
    } else {
      this._variableMapping = new Map(Object.entries(variableMapping));
    }
  }

  get variableMapping() {
    return new Map(this._variableMapping);
  }

  /**
   * Rename schema variables according to mapping
   */
  renameSchema(schema) {
    if (!(schema instanceof Schema)) {
      throw new Error('Schema must be a Schema instance');
    }

    const renamedSpecs = [];
    for (let i = 0; i < schema.arity; i++) {
      const originalName = schema.variables[i];
      const renamedName = this._variableMapping.get(originalName) || originalName;
      renamedSpecs.push({
        name: renamedName,
        type: schema.types[i]
      });
    }

    return new Schema(renamedSpecs);
  }

  /**
   * Handle incoming deltas from input nodes
   */
  onDeltaReceived(sourceNode, delta) {
    this.pushDelta(delta);
  }

  /**
   * Process delta per design §4.1:
   * Stateless operation - delta passes through unchanged
   * The renaming affects schema/variable names, not tuple data
   */
  processDelta(delta) {
    // Rename is stateless and applied to schema, not tuple data
    // Tuples pass through unchanged
    return delta;
  }

  /**
   * Reset state (no-op for stateless operator)
   */
  reset() {
    // Stateless operator - no state to reset
  }

  /**
   * Get state information
   */
  getState() {
    return {
      type: 'Rename',
      stateless: true,
      variableMapping: Object.fromEntries(this._variableMapping)
    };
  }

  toString() {
    const mappings = Array.from(this._variableMapping.entries())
      .map(([from, to]) => `${from}→${to}`)
      .join(',');
    return `Rename(${this._id}, {${mappings}})`;
  }
}