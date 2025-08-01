/**
 * Node - Graph node with hierarchical transform support
 */

import { Transform } from './Transform.js';

let nodeIdCounter = 0;

export class Node {
  constructor(config = {}) {
    this.id = config.id || `node-${++nodeIdCounter}`;
    this.type = config.type || 'default';
    this.label = config.label || '';
    this.data = config.data ? { ...config.data } : {};
    
    // Visual properties
    this.visible = config.visible !== false;
    this.locked = config.locked || false;
    
    // Transform
    this.transform = new Transform({
      position: config.position,
      scale: config.scale,
      rotation: config.rotation
    });
    
    // Size
    this.size = {
      width: config.size?.width || 100,
      height: config.size?.height || 50
    };
    
    // Style
    this.style = {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      opacity: 1,
      ...config.style
    };
    
    // Hierarchy
    this.parent = null;
    this.children = [];
    
    // Change tracking
    this.dirty = false;
    this.changeListeners = [];
  }

  /**
   * Get node ID
   */
  getId() {
    return this.id;
  }

  /**
   * Get node type
   */
  getType() {
    return this.type;
  }

  /**
   * Set node type
   */
  setType(type) {
    if (this.locked) return;
    
    const oldValue = this.type;
    this.type = type;
    this._notifyChange('propertyChanged', { property: 'type', oldValue, newValue: type });
  }

  /**
   * Get label
   */
  getLabel() {
    return this.label;
  }

  /**
   * Set label
   */
  setLabel(label) {
    if (this.locked) return;
    
    const oldValue = this.label;
    this.label = label;
    this._notifyChange('propertyChanged', { property: 'label', oldValue, newValue: label });
  }

  /**
   * Get custom data
   */
  getData() {
    return { ...this.data };
  }

  /**
   * Set custom data
   */
  setData(data, merge = false) {
    if (this.locked) return;
    
    const oldValue = this.data;
    this.data = merge ? { ...this.data, ...data } : { ...data };
    this._notifyChange('propertyChanged', { property: 'data', oldValue, newValue: this.data });
  }

  /**
   * Get visibility
   */
  isVisible() {
    return this.visible;
  }

  /**
   * Set visibility
   */
  setVisible(visible) {
    const oldValue = this.visible;
    this.visible = visible;
    this._notifyChange('propertyChanged', { property: 'visible', oldValue, newValue: visible });
  }

  /**
   * Toggle visibility
   */
  toggleVisibility() {
    this.setVisible(!this.visible);
  }

  /**
   * Get locked state
   */
  isLocked() {
    return this.locked;
  }

  /**
   * Set locked state
   */
  setLocked(locked) {
    const oldValue = this.locked;
    this.locked = locked;
    this._notifyChange('propertyChanged', { property: 'locked', oldValue, newValue: locked });
  }

  /**
   * Toggle locked state
   */
  toggleLocked() {
    this.setLocked(!this.locked);
  }

  /**
   * Get transform
   */
  getTransform() {
    return this.transform;
  }

  /**
   * Get position
   */
  getPosition() {
    return this.transform.getPosition();
  }

  /**
   * Set position
   */
  setPosition(x, y) {
    if (this.locked) return;
    
    const oldValue = this.transform.getPosition();
    this.transform.setPosition(x, y);
    this._notifyChange('transformChanged', { 
      property: 'position', 
      oldValue, 
      newValue: { x, y } 
    });
  }

  /**
   * Get size
   */
  getSize() {
    return { ...this.size };
  }

  /**
   * Set size
   */
  setSize(width, height) {
    if (this.locked) return;
    
    const oldValue = { ...this.size };
    this.size.width = width;
    this.size.height = height;
    this._notifyChange('transformChanged', { 
      property: 'size', 
      oldValue, 
      newValue: { width, height } 
    });
  }

  /**
   * Get scale
   */
  getScale() {
    return this.transform.getScale();
  }

  /**
   * Set scale
   */
  setScale(x, y = x) {
    if (this.locked) return;
    
    const oldValue = this.transform.getScale();
    this.transform.setScale(x, y);
    this._notifyChange('transformChanged', { 
      property: 'scale', 
      oldValue, 
      newValue: { x, y } 
    });
  }

  /**
   * Get rotation
   */
  getRotation() {
    return this.transform.getRotation();
  }

  /**
   * Set rotation
   */
  setRotation(degrees) {
    if (this.locked) return;
    
    const oldValue = this.transform.getRotation();
    this.transform.setRotation(degrees);
    this._notifyChange('transformChanged', { 
      property: 'rotation', 
      oldValue, 
      newValue: degrees 
    });
  }

  /**
   * Get local bounds
   */
  getBounds() {
    const pos = this.getPosition();
    return {
      x: pos.x,
      y: pos.y,
      width: this.size.width,
      height: this.size.height,
      left: pos.x,
      top: pos.y,
      right: pos.x + this.size.width,
      bottom: pos.y + this.size.height
    };
  }

  /**
   * Get world bounds (including parent transforms)
   */
  getWorldBounds() {
    const localBounds = {
      x: 0,
      y: 0,
      width: this.size.width,
      height: this.size.height
    };
    
    // Get world transform
    let worldTransform = this.transform;
    if (this.parent) {
      const parentWorld = this.parent.getWorldTransform();
      worldTransform = Transform.multiply(parentWorld, this.transform);
    }
    
    const transformed = worldTransform.transformBounds(localBounds);
    
    return {
      x: transformed.x,
      y: transformed.y,
      width: transformed.width,
      height: transformed.height,
      left: transformed.x,
      top: transformed.y,
      right: transformed.x + transformed.width,
      bottom: transformed.y + transformed.height
    };
  }

  /**
   * Get world transform (including parent transforms)
   */
  getWorldTransform() {
    if (!this.parent) {
      return this.transform;
    }
    
    const parentWorld = this.parent.getWorldTransform();
    return Transform.multiply(parentWorld, this.transform);
  }

  /**
   * Get parent node
   */
  getParent() {
    return this.parent;
  }

  /**
   * Set parent node
   */
  setParent(parent) {
    this.parent = parent;
  }

  /**
   * Get children
   */
  getChildren() {
    return [...this.children];
  }

  /**
   * Add child node
   */
  addChild(child) {
    // Check for circular hierarchy
    if (this.isDescendantOf(child)) {
      throw new Error('Circular hierarchy detected');
    }
    
    // Remove from previous parent
    if (child.parent) {
      child.parent.removeChild(child);
    }
    
    this.children.push(child);
    child.setParent(this);
  }

  /**
   * Remove child node
   */
  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      this.children.splice(index, 1);
      child.setParent(null);
    }
  }

  /**
   * Remove all children
   */
  removeAllChildren() {
    const children = [...this.children];
    children.forEach(child => this.removeChild(child));
  }

  /**
   * Check if this node is an ancestor of another
   */
  isAncestorOf(node) {
    let current = node.parent;
    while (current) {
      if (current === this) return true;
      current = current.parent;
    }
    return false;
  }

  /**
   * Check if this node is a descendant of another
   */
  isDescendantOf(node) {
    return node.isAncestorOf(this);
  }

  /**
   * Get depth in hierarchy
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
   * Traverse node and descendants
   */
  traverse(callback) {
    callback(this);
    this.children.forEach(child => child.traverse(callback));
  }

  /**
   * Get style
   */
  getStyle() {
    return { ...this.style };
  }

  /**
   * Set style property
   */
  setStyle(property, value) {
    const oldValue = this.style[property];
    this.style[property] = value;
    this._notifyChange('styleChanged', { property, oldValue, newValue: value });
  }

  /**
   * Set multiple style properties
   */
  setStyles(styles) {
    Object.entries(styles).forEach(([property, value]) => {
      this.setStyle(property, value);
    });
  }

  /**
   * Reset style to defaults
   */
  resetStyle() {
    this.style = {
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 1,
      opacity: 1
    };
    this._notifyChange('styleChanged', { property: 'all', oldValue: null, newValue: this.style });
  }

  /**
   * Check if dirty
   */
  isDirty() {
    return this.dirty;
  }

  /**
   * Clear dirty flag
   */
  clearDirty() {
    this.dirty = false;
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
  _notifyChange(type, details) {
    this.dirty = true;
    const change = { type, ...details };
    this.changeListeners.forEach(listener => listener(change));
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    const json = {
      id: this.id,
      type: this.type,
      label: this.label,
      position: this.getPosition(),
      size: this.getSize(),
      scale: this.getScale(),
      rotation: this.getRotation(),
      visible: this.visible,
      locked: this.locked,
      style: { ...this.style },
      data: { ...this.data }
    };
    
    // Include parent ID if not root
    if (this.parent && this.parent.getId() !== 'root') {
      json.parentId = this.parent.getId();
    }
    
    return json;
  }

  /**
   * Create from JSON
   */
  static fromJSON(json) {
    return new Node(json);
  }
}