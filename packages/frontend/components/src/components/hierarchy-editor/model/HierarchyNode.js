/**
 * HierarchyNode - Unified node structure for all formats
 */

export class HierarchyNode {
  constructor(data = {}) {
    this.id = data.id || this.generateNodeId();
    this.type = data.type || 'value'; // object, array, value, element, text
    this.name = data.name || '';       // Key name or element tag
    this.value = data.hasOwnProperty('value') ? data.value : null; // Primitive value
    this.children = data.children || []; // Child nodes
    this.metadata = data.metadata || {}; // Format-specific data
    this.parent = data.parent || null;   // Parent reference
  }

  /**
   * Generate unique node ID
   */
  generateNodeId() {
    return 'node-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Add a child node
   */
  addChild(childNode) {
    if (childNode instanceof HierarchyNode) {
      childNode.parent = this;
      this.children.push(childNode);
    } else {
      // Create new node from data
      const newNode = new HierarchyNode(childNode);
      newNode.parent = this;
      this.children.push(newNode);
    }
  }

  /**
   * Remove a child node
   */
  removeChild(nodeOrId) {
    let nodeId;
    if (typeof nodeOrId === 'string') {
      nodeId = nodeOrId;
    } else if (nodeOrId && nodeOrId.id) {
      nodeId = nodeOrId.id;
    } else {
      return false;
    }

    const index = this.children.findIndex(child => child.id === nodeId);
    if (index > -1) {
      const removedNode = this.children[index];
      removedNode.parent = null;
      this.children.splice(index, 1);
      return removedNode;
    }
    return null;
  }

  /**
   * Find child node by ID
   */
  findChild(nodeId) {
    return this.children.find(child => child.id === nodeId) || null;
  }

  /**
   * Find node by ID recursively
   */
  findDescendant(nodeId) {
    if (this.id === nodeId) {
      return this;
    }

    for (const child of this.children) {
      const found = child.findDescendant(nodeId);
      if (found) return found;
    }

    return null;
  }

  /**
   * Get all descendants (flattened)
   */
  getAllDescendants() {
    let descendants = [];
    for (const child of this.children) {
      descendants.push(child);
      descendants = descendants.concat(child.getAllDescendants());
    }
    return descendants;
  }

  /**
   * Get depth of node in tree
   */
  getDepth() {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * Get path from root to this node
   */
  getPath() {
    const path = [];
    let current = this;
    while (current) {
      path.unshift(current.name || current.id);
      current = current.parent;
    }
    return path;
  }

  /**
   * Check if this node is ancestor of another node
   */
  isAncestorOf(node) {
    let current = node.parent;
    while (current) {
      if (current.id === this.id) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if this node is descendant of another node
   */
  isDescendantOf(node) {
    return node.isAncestorOf(this);
  }

  /**
   * Get siblings (nodes with same parent)
   */
  getSiblings() {
    if (!this.parent) return [];
    return this.parent.children.filter(child => child.id !== this.id);
  }

  /**
   * Get next sibling
   */
  getNextSibling() {
    if (!this.parent) return null;
    const index = this.parent.children.findIndex(child => child.id === this.id);
    return index < this.parent.children.length - 1 ? this.parent.children[index + 1] : null;
  }

  /**
   * Get previous sibling
   */
  getPreviousSibling() {
    if (!this.parent) return null;
    const index = this.parent.children.findIndex(child => child.id === this.id);
    return index > 0 ? this.parent.children[index - 1] : null;
  }

  /**
   * Clone this node (deep copy)
   */
  clone() {
    const cloned = new HierarchyNode({
      type: this.type,
      name: this.name,
      value: this.value,
      metadata: JSON.parse(JSON.stringify(this.metadata))
    });

    // Clone children recursively
    for (const child of this.children) {
      cloned.addChild(child.clone());
    }

    return cloned;
  }

  /**
   * Convert to plain object (for serialization)
   */
  toObject() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      value: this.value,
      children: this.children.map(child => child.toObject()),
      metadata: this.metadata,
      parent: this.parent ? this.parent.id : null
    };
  }

  /**
   * Create from plain object
   */
  static fromObject(obj) {
    const node = new HierarchyNode({
      id: obj.id,
      type: obj.type,
      name: obj.name,
      value: obj.value,
      metadata: obj.metadata
    });

    if (obj.children && Array.isArray(obj.children)) {
      for (const childObj of obj.children) {
        node.addChild(HierarchyNode.fromObject(childObj));
      }
    }

    return node;
  }

  /**
   * Validate node structure
   */
  validate() {
    const errors = [];

    if (!this.id || typeof this.id !== 'string') {
      errors.push('Node must have a valid ID');
    }

    if (!this.type || typeof this.type !== 'string') {
      errors.push('Node must have a valid type');
    }

    if (this.name !== null && this.name !== undefined && typeof this.name !== 'string') {
      errors.push('Node name must be a string or null/undefined');
    }

    if (!Array.isArray(this.children)) {
      errors.push('Node children must be an array');
    }

    if (this.metadata && typeof this.metadata !== 'object') {
      errors.push('Node metadata must be an object');
    }

    // Validate children
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      if (!(child instanceof HierarchyNode)) {
        errors.push(`Child at index ${i} is not a HierarchyNode instance`);
      } else if (child.parent !== this) {
        errors.push(`Child at index ${i} has incorrect parent reference`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * String representation for debugging
   */
  toString() {
    return `HierarchyNode(${this.type}:${this.name}:${this.id})`;
  }
}