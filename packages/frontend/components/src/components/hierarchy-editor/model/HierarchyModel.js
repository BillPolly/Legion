/**
 * HierarchyModel - Core data model for hierarchy editing
 */
import { BaseModel } from '../../base/index.js';
import { HierarchyNode } from './HierarchyNode.js';

export class HierarchyModel extends BaseModel {
  constructor(config) {
    super();
    this.config = config;
    
    // Core data
    this.root = null;          // Root hierarchy node
    this.format = null;        // Current format
    this.source = '';          // Original source
    this.handlers = new Map(); // Format handlers
    this.isDirty = false;      // Modified flag
    
    // Simple event system for MVP
    this.eventHandlers = {};
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  notify(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Load content with optional format detection
   */
  loadContent(content, format = null) {
    if (!format) {
      format = this.detectFormat(content);
    }
    
    const handler = this.handlers.get(format);
    if (!handler) {
      throw new Error(`No handler registered for format: ${format}`);
    }
    
    this.root = handler.parse(content);
    this.source = content;
    this.format = format;
    this.isDirty = false;
    
    this.notify('contentLoaded', { root: this.root, format });
  }

  /**
   * Detect format from content
   */
  detectFormat(content) {
    if (!content || typeof content !== 'string') {
      return 'json';
    }

    const trimmed = content.trim();
    
    // JSON detection
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch (e) {
        // Not valid JSON
      }
    }

    // XML detection
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
      return 'xml';
    }

    // YAML detection (basic heuristics)
    if (trimmed.includes(':') && !trimmed.includes('<') && !trimmed.includes('{')) {
      return 'yaml';
    }

    // Markdown detection
    if (trimmed.includes('#') || trimmed.includes('##')) {
      return 'markdown';
    }

    // Default to JSON
    return 'json';
  }

  /**
   * Register a format handler
   */
  registerHandler(format, handler) {
    this.handlers.set(format, handler);
  }

  /**
   * Find node by ID (recursive search)
   */
  findNode(nodeId, node = this.root) {
    if (!node) return null;
    
    if (node.id === nodeId) {
      return node;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNode(nodeId, child);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Update node value
   */
  updateNodeValue(nodeId, newValue) {
    const node = this.findNode(nodeId);
    if (node) {
      const oldValue = node.value;
      node.value = newValue;
      this.isDirty = true;
      this.notify('nodeUpdated', { node, oldValue });
      this.syncSource();
    }
  }

  /**
   * Add child node
   */
  addNode(parentId, nodeData) {
    const parent = this.findNode(parentId);
    if (parent) {
      const newNode = this.createNode(nodeData);
      newNode.parent = parent;
      parent.children = parent.children || [];
      parent.children.push(newNode);
      
      this.isDirty = true;
      this.notify('nodeAdded', { parent, node: newNode });
      this.syncSource();
    }
  }

  /**
   * Remove node
   */
  removeNode(nodeId) {
    const node = this.findNode(nodeId);
    if (node && node.parent) {
      const parent = node.parent;
      const index = parent.children.indexOf(node);
      if (index > -1) {
        parent.children.splice(index, 1);
        this.isDirty = true;
        this.notify('nodeRemoved', { parent, node, index });
        this.syncSource();
      }
    }
  }

  /**
   * Move node to new parent
   */
  moveNode(nodeId, newParentId, position = -1) {
    const node = this.findNode(nodeId);
    const newParent = this.findNode(newParentId);
    
    if (node && newParent && node.parent) {
      // Remove from old parent
      const oldParent = node.parent;
      const oldIndex = oldParent.children.indexOf(node);
      oldParent.children.splice(oldIndex, 1);
      
      // Add to new parent
      node.parent = newParent;
      newParent.children = newParent.children || [];
      
      if (position === -1 || position >= newParent.children.length) {
        newParent.children.push(node);
      } else {
        newParent.children.splice(position, 0, node);
      }
      
      this.isDirty = true;
      this.notify('nodeMoved', { node, oldParent, newParent, position });
      this.syncSource();
    }
  }

  /**
   * Create a new node with given data
   */
  createNode(nodeData) {
    return new HierarchyNode(nodeData);
  }

  /**
   * Synchronize source from hierarchy
   */
  syncSource() {
    if (this.root && this.format) {
      const handler = this.handlers.get(this.format);
      if (handler) {
        this.source = handler.serialize(this.root);
        this.notify('sourceUpdated', { source: this.source });
      }
    }
  }

  /**
   * Validate current content
   */
  validate() {
    if (!this.format || !this.handlers.has(this.format)) {
      return { valid: false, errors: ['No handler for current format'] };
    }

    const handler = this.handlers.get(this.format);
    if (handler.validate) {
      return handler.validate(this.source);
    }

    return { valid: true, errors: [] };
  }

  /**
   * Get all nodes (flattened)
   */
  getAllNodes(node = this.root) {
    if (!node) return [];
    
    let nodes = [node];
    if (node.children) {
      for (const child of node.children) {
        nodes = nodes.concat(this.getAllNodes(child));
      }
    }
    
    return nodes;
  }

  /**
   * Clear all data
   */
  clear() {
    this.root = null;
    this.source = '';
    this.format = null;
    this.isDirty = false;
    this.notify('cleared');
  }
  
  // Additional methods for compatibility
  
  setRootNode(node) {
    this.root = node;
    this.isDirty = true;
    this.syncSource();
  }
  
  getRootNode() {
    return this.root;
  }
  
  findById(id) {
    return this.findNode(id);
  }
  
  findByPath(path) {
    if (!path || !this.root) return null;
    
    // Handle root path
    if (path === '' || path === '.') return this.root;
    
    const parts = path.split('.');
    let current = this.root;
    
    for (const part of parts) {
      if (!current.children) return null;
      
      // Handle array indices
      if (/^\d+$/.test(part)) {
        const index = parseInt(part, 10);
        current = current.children[index];
      } else {
        // Handle object properties
        current = current.children.find(child => child.name === part);
      }
      
      if (!current) return null;
    }
    
    return current;
  }
  
  getNodeCount() {
    return this.getAllNodes().length;
  }
  
  destroy() {
    this.clear();
    this.eventHandlers = {};
  }
  
  // Alias methods for compatibility
  emit(event, data) {
    this.notify(event, data);
  }
}