/**
 * EditingManager - Handles editing operations
 */

export class EditingManager {
  constructor(viewModel) {
    this.viewModel = viewModel;
    this.model = viewModel.model;
    this.view = viewModel.view;
    this.activeEdit = null;
  }

  /**
   * Start editing a node
   */
  startEdit(nodeId) {
    this.activeEdit = {
      nodeId,
      startTime: Date.now()
    };
    
    // The actual inline editing is handled by the view
  }

  /**
   * Commit an edit
   */
  commitEdit(nodeId, value) {
    if (this.activeEdit && this.activeEdit.nodeId === nodeId) {
      this.model.updateNodeValue(nodeId, value);
      this.activeEdit = null;
    }
  }

  /**
   * Cancel an edit
   */
  cancelEdit(nodeId) {
    if (this.activeEdit && this.activeEdit.nodeId === nodeId) {
      this.activeEdit = null;
    }
  }

  /**
   * Add a new node
   */
  addNode(parentId, type = 'value') {
    const nodeData = {
      type: type,
      name: this.generateNodeName(parentId, type),
      value: this.getDefaultValue(type)
    };
    
    this.model.addNode(parentId, nodeData);
  }

  /**
   * Remove a node
   */
  removeNode(nodeId) {
    this.model.removeNode(nodeId);
  }

  /**
   * Move a node
   */
  moveNode(nodeId, newParentId, position) {
    this.model.moveNode(nodeId, newParentId, position);
  }

  /**
   * Duplicate a node
   */
  duplicateNode(nodeId) {
    const node = this.model.findNode(nodeId);
    if (node && node.parent) {
      const clone = this.cloneNode(node);
      this.model.addNode(node.parent.id, clone);
    }
  }

  /**
   * Generate a name for a new node
   */
  generateNodeName(parentId, type) {
    const parent = this.model.findNode(parentId);
    if (!parent) return 'newProperty';
    
    const existingNames = (parent.children || []).map(child => child.name);
    let baseName = type === 'array' ? 'newArray' : 
                   type === 'object' ? 'newObject' : 'newProperty';
    let counter = 1;
    let name = baseName;
    
    while (existingNames.includes(name)) {
      name = `${baseName}${counter}`;
      counter++;
    }
    
    return name;
  }

  /**
   * Get default value for a node type
   */
  getDefaultValue(type) {
    switch (type) {
      case 'value': return '';
      case 'array': return null;
      case 'object': return null;
      default: return '';
    }
  }

  /**
   * Clone a node recursively
   */
  cloneNode(node) {
    const clone = {
      id: this.model.generateNodeId(),
      type: node.type,
      name: node.name + '_copy',
      value: node.value,
      children: [],
      metadata: { ...node.metadata },
      parent: null
    };
    
    if (node.children) {
      clone.children = node.children.map(child => {
        const childClone = this.cloneNode(child);
        childClone.parent = clone;
        return childClone;
      });
    }
    
    return clone;
  }

  /**
   * Get current edit status
   */
  getActiveEdit() {
    return this.activeEdit;
  }

  /**
   * Check if a node is being edited
   */
  isEditing(nodeId) {
    return this.activeEdit && this.activeEdit.nodeId === nodeId;
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    this.activeEdit = null;
  }
}