/**
 * NodeViewMapping - Two-way mapping between model nodes and view elements
 */

export class NodeViewMapping {
  constructor() {
    this.modelToView = new Map();  // nodeId -> DOM element
    this.viewToModel = new WeakMap(); // DOM element -> nodeId
    this.dirtyNodes = new Set();     // Nodes needing re-render
  }

  /**
   * Register a model-view pair
   */
  register(nodeId, element) {
    // Handle null/undefined gracefully
    if (nodeId == null || element == null) {
      return;
    }

    // If node was previously mapped to a different element, clean up old mapping
    const oldElement = this.modelToView.get(nodeId);
    if (oldElement && oldElement !== element) {
      this.viewToModel.delete(oldElement);
    }

    this.modelToView.set(nodeId, element);
    this.viewToModel.set(element, nodeId);
  }

  /**
   * Unregister a mapping
   */
  unregister(nodeId) {
    if (nodeId == null) {
      return;
    }
    
    const element = this.modelToView.get(nodeId);
    if (element) {
      this.modelToView.delete(nodeId);
      this.viewToModel.delete(element);
    }
  }

  /**
   * Get DOM element for node ID
   */
  getElement(nodeId) {
    if (nodeId == null) {
      return undefined;
    }
    return this.modelToView.get(nodeId);
  }

  /**
   * Get node ID for DOM element
   */
  getNodeId(element) {
    if (element == null) {
      return undefined;
    }
    return this.viewToModel.get(element);
  }

  /**
   * Mark node as dirty for incremental update
   */
  markDirty(nodeId) {
    if (nodeId == null) {
      return;
    }
    this.dirtyNodes.add(nodeId);
  }

  /**
   * Get only nodes that need updating
   */
  getDirtyNodes() {
    return Array.from(this.dirtyNodes);
  }

  /**
   * Clear dirty state after render
   */
  clearDirty() {
    this.dirtyNodes.clear();
  }

  /**
   * Check if node is dirty
   */
  isDirty(nodeId) {
    if (nodeId == null) {
      return false;
    }
    return this.dirtyNodes.has(nodeId);
  }

  /**
   * Clear all mappings
   */
  clear() {
    this.modelToView.clear();
    this.viewToModel = new WeakMap();
    this.dirtyNodes.clear();
  }

  /**
   * Get all registered node IDs
   */
  getAllNodeIds() {
    return Array.from(this.modelToView.keys());
  }

  /**
   * Get mapping statistics
   */
  getStats() {
    return {
      totalMappings: this.modelToView.size,
      dirtyNodes: this.dirtyNodes.size
    };
  }
}