import { Delta } from './Delta.js';

/**
 * Base class for all operator nodes per design §4.1
 * Maintains internal support/witness state and is purely set-based
 */
export class Node {
  constructor(id) {
    if (typeof id !== 'string') {
      throw new Error('Node ID must be a string');
    }

    this._id = id;
    this._inputs = [];
    this._outputs = [];
    this._onDeltaReceived = null;
  }

  get id() {
    return this._id;
  }

  get inputs() {
    return [...this._inputs];
  }

  get outputs() {
    return [...this._outputs];
  }

  /**
   * Add input connection from another node
   */
  addInput(sourceNode) {
    if (!(sourceNode instanceof Node)) {
      throw new Error('Input must be a Node instance');
    }
    
    if (!this._inputs.includes(sourceNode)) {
      this._inputs.push(sourceNode);
      sourceNode._addOutput(this);
    }
  }

  /**
   * Add output connection to another node
   */
  addOutput(targetNode) {
    if (!(targetNode instanceof Node)) {
      throw new Error('Output must be a Node instance');
    }

    if (!this._outputs.includes(targetNode)) {
      this._outputs.push(targetNode);
      targetNode._addInput(this);
    }
  }

  /**
   * Internal method to add output without circular calls
   */
  _addOutput(targetNode) {
    if (!this._outputs.includes(targetNode)) {
      this._outputs.push(targetNode);
    }
  }

  /**
   * Internal method to add input without circular calls
   */
  _addInput(sourceNode) {
    if (!this._inputs.includes(sourceNode)) {
      this._inputs.push(sourceNode);
    }
  }

  /**
   * Process incoming delta and emit to outputs
   * Per design §6.2: emit removes then adds
   */
  pushDelta(delta) {
    if (!(delta instanceof Delta)) {
      throw new Error('Must push a Delta instance');
    }

    // Process the delta using subclass implementation
    const outputDelta = this.processDelta(delta);

    // Emit to all outputs if delta is not empty
    if (outputDelta && !outputDelta.isEmpty()) {
      for (const outputNode of this._outputs) {
        if (outputNode._onDeltaReceived) {
          outputNode._onDeltaReceived(this, outputDelta);
        } else if (outputNode.onDeltaReceived) {
          outputNode.onDeltaReceived(this, outputDelta);
        }
      }
    }
  }

  /**
   * Process delta - must be implemented by subclasses
   */
  processDelta(delta) {
    throw new Error('Subclass must implement processDelta');
  }

  /**
   * Reset internal state - override in subclasses
   */
  reset() {
    // Base implementation is no-op
  }

  /**
   * Get current state for debugging - override in subclasses
   */
  getState() {
    return {};
  }

  /**
   * Set callback for receiving deltas (for testing)
   */
  set onDeltaReceived(callback) {
    this._onDeltaReceived = callback;
  }

  toString() {
    return `${this.constructor.name}(${this._id})`;
  }
}