/**
 * SceneGraph - Hierarchical graph structure with efficient node management
 */

import { Node } from './Node.js';
import { QuadTree, Rectangle } from './QuadTree.js';

export class SceneGraph {
  constructor() {
    // Create root node
    this.root = new Node({ id: 'root', type: 'root' });
    
    // Node map for O(1) lookup
    this.nodeMap = new Map();
    this.nodeMap.set('root', this.root);
    
    // Spatial index for efficient hit testing
    this.spatialIndex = new QuadTree(
      new Rectangle(-10000, -10000, 20000, 20000), // Large default bounds
      { maxObjects: 10, maxDepth: 8 }
    );
    
    // Change tracking
    this.dirty = false;
    this.changeListeners = [];
    
    // Batch update tracking
    this.batchDepth = 0;
    this.batchOperations = [];
    this.batchRollback = [];
    
    // Listen to root node changes
    this.root.onChange(() => this._markDirty());
  }

  /**
   * Get root node
   */
  getRoot() {
    return this.root;
  }

  /**
   * Get node by ID
   */
  getNodeById(id) {
    return this.nodeMap.get(id);
  }

  /**
   * Get total node count
   */
  getNodeCount() {
    return this.nodeMap.size;
  }

  /**
   * Get all nodes
   */
  getAllNodes() {
    return Array.from(this.nodeMap.values());
  }

  /**
   * Add node to the graph
   */
  addNode(node, parentId = 'root') {
    // Check for duplicate ID
    if (this.nodeMap.has(node.getId())) {
      throw new Error(`Node with id ${node.getId()} already exists`);
    }
    
    // Find parent
    const parent = this.nodeMap.get(parentId);
    if (!parent) {
      throw new Error(`Parent node ${parentId} not found`);
    }
    
    // Track for rollback if in batch
    if (this.batchDepth > 0) {
      this.batchRollback.push({ type: 'add', nodeId: node.getId() });
    }
    
    // Add to parent and map
    parent.addChild(node);
    this.nodeMap.set(node.getId(), node);
    
    // Add to spatial index if not root
    if (node.getId() !== 'root') {
      const bounds = node.getBounds();
      this.spatialIndex.insert({
        id: node.getId(),
        node: node,
        bounds: Rectangle.fromBounds(bounds)
      });
    }
    
    // Listen to node changes
    node.onChange((change) => {
      this._handleNodeChange(node, change);
    });
    
    // Notify change
    this._notifyChange({ type: 'nodeAdded', node, parent });
  }

  /**
   * Set parent of a node
   */
  setParent(node, newParent) {
    if (!node || !newParent) {
      throw new Error('Node and parent must be provided');
    }
    
    const oldParent = node.getParent();
    if (oldParent === newParent) {
      return; // No change
    }
    
    // Remove from old parent
    if (oldParent) {
      oldParent.removeChild(node);
    }
    
    // Add to new parent
    newParent.addChild(node);
    
    // Notify change
    this._notifyChange({ 
      type: 'parentChanged', 
      node, 
      oldParent, 
      newParent 
    });
  }

  /**
   * Remove node from the graph
   */
  removeNode(nodeId) {
    if (nodeId === 'root') {
      throw new Error('Cannot remove root node');
    }
    
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      return;
    }
    
    // Track for rollback if in batch
    if (this.batchDepth > 0) {
      this.batchRollback.push({ 
        type: 'remove', 
        node,
        parent: node.getParent()
      });
    }
    
    // Remove node and all its children
    this._removeNodeRecursive(node);
    
    // Notify change
    this._notifyChange({ type: 'nodeRemoved', nodeId, node });
  }

  /**
   * Remove node and all its children recursively
   * @private
   */
  _removeNodeRecursive(node) {
    // Remove children first
    const children = node.getChildren();
    children.forEach(child => this._removeNodeRecursive(child));
    
    // Remove from parent
    const parent = node.getParent();
    if (parent) {
      parent.removeChild(node);
    }
    
    // Remove from spatial index
    const spatialEntry = this._findSpatialEntry(node.getId());
    if (spatialEntry) {
      this.spatialIndex.remove(spatialEntry);
    }
    
    // Remove from map
    this.nodeMap.delete(node.getId());
  }

  /**
   * Clear all nodes except root
   */
  clear() {
    // Track for rollback if in batch
    if (this.batchDepth > 0) {
      const allNodes = this.getAllNodes().filter(n => n.getId() !== 'root');
      this.batchRollback.push({ type: 'clear', nodes: allNodes });
    }
    
    // Clear root's children
    this.root.removeAllChildren();
    
    // Clear node map except root
    this.nodeMap.clear();
    this.nodeMap.set('root', this.root);
    
    // Clear spatial index
    this._clearSpatialIndex();
    
    // Notify change
    this._notifyChange({ type: 'cleared' });
  }

  /**
   * Begin batch update
   */
  beginBatch() {
    this.batchDepth++;
    if (this.batchDepth === 1) {
      this.batchOperations = [];
      this.batchRollback = [];
    }
  }

  /**
   * End batch update
   */
  endBatch() {
    if (this.batchDepth === 0) return;
    
    this.batchDepth--;
    
    if (this.batchDepth === 0) {
      // Send batch notification
      if (this.batchOperations.length > 0) {
        this._notifyChange({
          type: 'batchUpdate',
          operations: [...this.batchOperations]
        });
      }
      this.batchOperations = [];
      this.batchRollback = [];
    }
  }

  /**
   * Cancel batch update and rollback changes
   */
  cancelBatch() {
    if (this.batchDepth === 0) return;
    
    // Rollback operations in reverse order
    for (let i = this.batchRollback.length - 1; i >= 0; i--) {
      const op = this.batchRollback[i];
      
      switch (op.type) {
        case 'add':
          // Remove added node
          const node = this.nodeMap.get(op.nodeId);
          if (node && node.getParent()) {
            node.getParent().removeChild(node);
          }
          this.nodeMap.delete(op.nodeId);
          break;
          
        case 'remove':
          // Re-add removed node
          op.parent.addChild(op.node);
          this.nodeMap.set(op.node.getId(), op.node);
          break;
          
        case 'clear':
          // Re-add all cleared nodes
          op.nodes.forEach(node => {
            if (node.getParent()) {
              this.nodeMap.set(node.getId(), node);
            }
          });
          break;
      }
    }
    
    this.batchDepth = 0;
    this.batchOperations = [];
    this.batchRollback = [];
  }

  /**
   * Check if scene is dirty
   */
  isDirty() {
    if (this.dirty) return true;
    
    // Check if any node is dirty
    for (const node of this.nodeMap.values()) {
      if (node.isDirty()) return true;
    }
    
    return false;
  }

  /**
   * Clear dirty state
   */
  clearDirty() {
    this.dirty = false;
    
    // Clear all nodes' dirty state
    for (const node of this.nodeMap.values()) {
      node.clearDirty();
    }
  }

  /**
   * Mark as dirty
   * @private
   */
  _markDirty() {
    this.dirty = true;
  }

  /**
   * Add change listener
   */
  onChange(listener) {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  offChange(listener) {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify change
   * @private
   */
  _notifyChange(event) {
    this._markDirty();
    
    if (this.batchDepth > 0) {
      // Store operation for batch
      this.batchOperations.push(event);
    } else {
      // Notify immediately
      this.changeListeners.forEach(listener => listener(event));
    }
  }

  /**
   * Handle node changes (position, size, etc)
   * @private
   */
  _handleNodeChange(node, change) {
    this._markDirty();
    
    // Update spatial index if transform changed
    if (change.type === 'transformChanged') {
      const spatialEntry = this._findSpatialEntry(node.getId());
      if (spatialEntry) {
        const bounds = node.getBounds();
        this.spatialIndex.update(spatialEntry, Rectangle.fromBounds(bounds));
      }
    }
    
    // Forward node change
    this._notifyChange({ 
      type: 'nodeChanged', 
      node, 
      data: change 
    });
  }

  /**
   * Find spatial index entry for node
   * @private
   */
  _findSpatialEntry(nodeId) {
    // This is inefficient but works for MVP
    // In production, we'd maintain a map of nodeId to spatial entry
    const allEntries = this.spatialIndex.retrieve(
      new Rectangle(-10000, -10000, 20000, 20000)
    );
    return allEntries.find(entry => entry.id === nodeId);
  }

  /**
   * Get nodes at point
   */
  getNodesAt(x, y) {
    const entries = this.spatialIndex.retrieveAt(x, y);
    return entries.map(entry => entry.node);
  }

  /**
   * Get nodes in rectangle
   */
  getNodesInRect(x, y, width, height) {
    const rect = new Rectangle(x, y, width, height);
    const entries = this.spatialIndex.retrieve(rect);
    return entries.map(entry => entry.node);
  }

  /**
   * Get spatial index stats
   */
  getSpatialIndexStats() {
    return this.spatialIndex.getStats();
  }

  /**
   * Clear spatial index (for clear operation)
   * @private
   */
  _clearSpatialIndex() {
    this.spatialIndex.clear();
  }
}