/**
 * HierarchyTreeView - Tree rendering component for hierarchy display
 */

export class HierarchyTreeView {
  constructor(container, options = {}, nodeMapping = null) {
    this.container = container;
    this.options = {
      maxDepth: options.maxDepth || 10,
      indentSize: options.indentSize || 20,
      showIcons: options.showIcons !== false,
      expandable: options.expandable !== false,
      ...options
    };
    
    // Store node mapping reference
    this.nodeMapping = nodeMapping;
    
    // Add base CSS classes to container
    this.container.classList.add('hierarchy-tree-view');
    
    // Simple event system for MVP
    this.eventHandlers = {};
    
    // Edit state tracking
    this.editingNodeId = null;
    this.editingElement = null;
    
    // Node registry for structural operations
    this.nodeRegistry = new Map(); // nodeId -> node reference
  }

  /**
   * Render a node and its children
   */
  renderNode(node, depth = 0) {
    if (!node || depth > this.options.maxDepth) {
      return null;
    }

    // Register the node for structural operations
    this.nodeRegistry.set(node.id, node);

    const element = this.createNodeElement(node, depth);
    
    // Render children if they exist and depth allows
    if (node.children && node.children.length > 0 && depth < this.options.maxDepth) {
      const childrenContainer = this.createChildrenContainer();
      
      for (const child of node.children) {
        const childElement = this.renderNode(child, depth + 1);
        if (childElement) {
          childElement.dataset.parentId = node.id;
          childrenContainer.appendChild(childElement);
        }
      }
      
      element.appendChild(childrenContainer);
      element.classList.add('has-children');
    }

    return element;
  }

  /**
   * Create the main node element
   * @private
   */
  createNodeElement(node, depth) {
    const element = document.createElement('div');
    element.className = 'hierarchy-node';
    element.classList.add(`node-${node.type}`);
    element.classList.add(`depth-${depth}`);
    
    // Add data attributes
    element.dataset.nodeId = node.id;
    element.dataset.nodeType = node.type;
    element.dataset.depth = depth.toString();
    
    // Add ARIA attributes
    element.setAttribute('role', 'treeitem');
    element.setAttribute('aria-label', `${node.name}: ${this.getNodeDisplayValue(node)}`);
    
    if (node.children && node.children.length > 0) {
      element.setAttribute('aria-expanded', 'true'); // Default expanded
    }
    
    // Add custom CSS classes from metadata
    if (node.metadata && node.metadata.cssClasses) {
      node.metadata.cssClasses.forEach(className => {
        element.classList.add(className);
      });
    }
    
    // Create and append header
    const header = this.createNodeHeader(node, depth);
    element.appendChild(header);
    
    return element;
  }

  /**
   * Create the node header (name, value, expand toggle, icon)
   * @private
   */
  createNodeHeader(node, depth) {
    const header = document.createElement('div');
    header.className = 'node-header';
    
    // Apply indentation
    header.style.paddingLeft = `${depth * this.options.indentSize}px`;
    
    // Add expand toggle for nodes with children
    if (node.children && node.children.length > 0 && this.options.expandable) {
      const toggle = this.createExpandToggle();
      header.appendChild(toggle);
    }
    
    // Add node icon
    if (this.options.showIcons) {
      const icon = this.createNodeIcon(node);
      header.appendChild(icon);
    }
    
    // Add node name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    nameSpan.textContent = node.name || '';
    header.appendChild(nameSpan);
    
    // Add separator for value nodes
    if (node.type === 'value' && node.value !== null && node.value !== undefined) {
      const separator = document.createElement('span');
      separator.className = 'name-value-separator';
      separator.textContent = ': ';
      header.appendChild(separator);
    }
    
    // Add node value
    const valueSpan = this.createValueSpan(node);
    header.appendChild(valueSpan);
    
    return header;
  }

  /**
   * Create expand/collapse toggle
   * @private
   */
  createExpandToggle() {
    const toggle = document.createElement('span');
    toggle.className = 'expand-toggle';
    toggle.textContent = '▼'; // Default expanded
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-label', 'Toggle expansion');
    toggle.setAttribute('tabindex', '0');
    return toggle;
  }

  /**
   * Create node type icon
   * @private
   */
  createNodeIcon(node) {
    const icon = document.createElement('span');
    icon.className = 'node-icon';
    icon.classList.add(`icon-${node.type}`);
    
    // Set icon content based on node type
    switch (node.type) {
      case 'object':
        icon.textContent = '{}';
        break;
      case 'array':
        icon.textContent = '[]';
        break;
      case 'value':
        if (node.value === null) {
          icon.textContent = '∅';
        } else if (typeof node.value === 'boolean') {
          icon.textContent = node.value ? '✓' : '✗';
        } else if (typeof node.value === 'number') {
          icon.textContent = '#';
        } else {
          icon.textContent = '"';
        }
        break;
      default:
        icon.textContent = '•';
    }
    
    return icon;
  }

  /**
   * Create value display span
   * @private
   */
  createValueSpan(node) {
    const valueSpan = document.createElement('span');
    valueSpan.className = 'node-value';
    
    if (node.type === 'value') {
      if (node.value === null) {
        valueSpan.textContent = 'null';
        valueSpan.classList.add('null-value');
      } else if (node.value === undefined) {
        valueSpan.textContent = 'undefined';
        valueSpan.classList.add('undefined-value');
      } else if (typeof node.value === 'string') {
        valueSpan.textContent = node.value;
        valueSpan.classList.add('string-value');
      } else if (typeof node.value === 'number') {
        valueSpan.textContent = node.value.toString();
        valueSpan.classList.add('number-value');
      } else if (typeof node.value === 'boolean') {
        valueSpan.textContent = node.value.toString();
        valueSpan.classList.add('boolean-value');
      } else {
        valueSpan.textContent = String(node.value);
        valueSpan.classList.add('other-value');
      }
      
      // Add double-click event for inline editing
      valueSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const element = e.target.closest('.hierarchy-node');
        if (element) {
          this.startInlineEdit(node.id, element);
        }
      });
    } else {
      // For object/array nodes, show child count
      const childCount = node.children ? node.children.length : 0;
      if (childCount > 0) {
        valueSpan.textContent = `(${childCount} ${childCount === 1 ? 'item' : 'items'})`;
        valueSpan.classList.add('child-count');
      }
    }
    
    return valueSpan;
  }

  /**
   * Create children container
   * @private
   */
  createChildrenContainer() {
    const container = document.createElement('div');
    container.className = 'node-children';
    container.setAttribute('role', 'group');
    return container;
  }

  /**
   * Get display value for node (for ARIA labels)
   * @private
   */
  getNodeDisplayValue(node) {
    if (node.type === 'value') {
      if (node.value === null) return 'null';
      if (node.value === undefined) return 'undefined';
      return String(node.value);
    } else {
      const childCount = node.children ? node.children.length : 0;
      return `${childCount} ${childCount === 1 ? 'item' : 'items'}`;
    }
  }

  /**
   * Clear the container
   */
  clear() {
    this.container.innerHTML = '';
    this.nodeRegistry.clear();
  }

  /**
   * Render tree into container
   */
  render(rootNode) {
    this.clear();
    if (rootNode) {
      const element = this.renderNode(rootNode);
      if (element) {
        this.container.appendChild(element);
      }
    }
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
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => handler(data));
    }
  }

  /**
   * Start inline editing for a node
   */
  startInlineEdit(nodeId, element) {
    // Prevent multiple simultaneous edits
    if (this.isEditing()) {
      return false;
    }
    
    // Only allow editing of value nodes
    if (!element || element.dataset.nodeType !== 'value') {
      return false;
    }
    
    const valueSpan = element.querySelector('.node-value');
    if (!valueSpan) {
      return false;
    }
    
    // Store edit state
    this.editingNodeId = nodeId;
    this.editingElement = element;
    
    // Get original value
    const originalValue = valueSpan.textContent;
    
    // Create inline editor
    const editor = document.createElement('input');
    editor.type = 'text';
    editor.className = 'inline-editor';
    editor.value = originalValue;
    
    // Replace value span with editor
    valueSpan.replaceWith(editor);
    
    // Focus and select all text
    editor.focus();
    editor.select();
    
    // Add event listeners
    editor.addEventListener('keydown', (e) => this.handleEditorKeydown(e, nodeId, originalValue));
    editor.addEventListener('blur', () => this.commitEdit(nodeId, editor.value, originalValue));
    
    // Emit edit start event
    this.emit('editStart', {
      nodeId: nodeId,
      originalValue: originalValue
    });
    
    return true;
  }

  /**
   * Handle keyboard events in editor
   */
  handleEditorKeydown(event, nodeId, originalValue) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit(nodeId, event.target.value, originalValue);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelEdit(nodeId, originalValue);
    }
  }

  /**
   * Commit edit changes
   */
  commitEdit(nodeId, newValue, originalValue) {
    if (!this.isEditing() || this.editingNodeId !== nodeId) {
      return;
    }
    
    const element = this.editingElement;
    const editor = element.querySelector('.inline-editor');
    
    if (!editor) {
      return;
    }
    
    // Validate the new value
    const validation = this.validateEditValue(newValue, originalValue);
    
    // Create new value span
    const valueSpan = document.createElement('span');
    valueSpan.className = 'node-value';
    valueSpan.textContent = newValue;
    
    // Add appropriate CSS class based on value type
    this.addValueTypeClass(valueSpan, newValue);
    
    // Replace editor with value span
    editor.replaceWith(valueSpan);
    
    // Clear edit state
    this.editingNodeId = null;
    this.editingElement = null;
    
    // Emit events
    this.emit('nodeValueChanged', {
      nodeId: nodeId,
      oldValue: originalValue,
      newValue: newValue,
      valid: validation.valid,
      errors: validation.errors
    });
    
    this.emit('editEnd', {
      nodeId: nodeId,
      committed: true
    });
  }

  /**
   * Cancel edit changes
   */
  cancelEdit(nodeId, originalValue) {
    if (!this.isEditing() || this.editingNodeId !== nodeId) {
      return;
    }
    
    const element = this.editingElement;
    const editor = element.querySelector('.inline-editor');
    
    if (!editor) {
      return;
    }
    
    // Create value span with original value
    const valueSpan = document.createElement('span');
    valueSpan.className = 'node-value';
    valueSpan.textContent = originalValue;
    
    // Add appropriate CSS class
    this.addValueTypeClass(valueSpan, originalValue);
    
    // Replace editor with original value span
    editor.replaceWith(valueSpan);
    
    // Clear edit state
    this.editingNodeId = null;
    this.editingElement = null;
    
    // Emit edit end event
    this.emit('editEnd', {
      nodeId: nodeId,
      committed: false
    });
  }

  /**
   * Check if currently editing
   */
  isEditing() {
    return this.editingNodeId !== null;
  }

  /**
   * Get the ID of the node being edited
   */
  getEditingNodeId() {
    return this.editingNodeId;
  }

  /**
   * Validate edit value
   */
  validateEditValue(newValue, originalValue) {
    const errors = [];
    
    // Try to determine the expected type from original value
    if (originalValue === 'null' || originalValue === null) {
      // Allow any value for null
      return { valid: true, errors: [] };
    }
    
    if (originalValue === 'true' || originalValue === 'false') {
      // Expect boolean
      if (newValue !== 'true' && newValue !== 'false') {
        errors.push('Expected boolean value (true or false)');
      }
    } else if (!isNaN(originalValue) && !isNaN(parseFloat(originalValue))) {
      // Expect number
      if (isNaN(newValue) || isNaN(parseFloat(newValue))) {
        errors.push('Expected numeric value');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Add appropriate CSS class based on value type
   */
  addValueTypeClass(valueSpan, value) {
    if (value === 'null') {
      valueSpan.classList.add('null-value');
    } else if (value === 'undefined') {
      valueSpan.classList.add('undefined-value');
    } else if (value === 'true' || value === 'false') {
      valueSpan.classList.add('boolean-value');
    } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
      valueSpan.classList.add('number-value');
    } else {
      valueSpan.classList.add('string-value');
    }
  }

  /**
   * Refresh a node's display
   */
  refreshNode(nodeId, element) {
    // This would typically re-render the node content
    // For now, just ensure the display is correct
    const valueSpan = element.querySelector('.node-value');
    if (valueSpan) {
      // Update value span classes
      valueSpan.className = 'node-value';
      this.addValueTypeClass(valueSpan, valueSpan.textContent);
    }
  }

  /**
   * Add a child node to a parent
   */
  addChildNode(parentId, nodeData, parentElement) {
    // Validate the addition
    const validation = this.validateAddition(parentId, nodeData);
    if (!validation.valid) {
      return false;
    }

    // Find parent node in the data model
    const parentNode = this.findNodeById(parentId);
    if (!parentNode) {
      return false;
    }

    // Only objects and arrays can have children
    if (parentNode.type === 'value') {
      return false;
    }

    // Create new node
    const newNode = this.createNodeFromData(nodeData);
    newNode.parent = parentNode;

    // Add to parent's children
    if (!parentNode.children) {
      parentNode.children = [];
    }
    parentNode.children.push(newNode);

    // Update DOM
    this.updateNodeInDOM(parentElement, parentNode);

    // Emit event
    this.emit('nodeAdded', {
      parentId: parentId,
      parentNode: parentNode,
      nodeData: newNode,
      position: parentNode.children.length - 1
    });

    return true;
  }

  /**
   * Add a sibling node
   */
  addSiblingNode(siblingId, nodeData, position = 'after') {
    const siblingNode = this.findNodeById(siblingId);
    if (!siblingNode || !siblingNode.parent) {
      return false;
    }

    const parent = siblingNode.parent;
    const siblingIndex = parent.children.indexOf(siblingNode);
    
    if (siblingIndex === -1) {
      return false;
    }

    // Validate the addition
    const validation = this.validateAddition(parent.id, nodeData);
    if (!validation.valid) {
      return false;
    }

    // Create new node
    const newNode = this.createNodeFromData(nodeData);
    newNode.parent = parent;

    // Insert at appropriate position
    const insertIndex = position === 'before' ? siblingIndex : siblingIndex + 1;
    parent.children.splice(insertIndex, 0, newNode);

    // Update DOM
    const parentElement = this.container.querySelector(`[data-node-id="${parent.id}"]`);
    if (parentElement) {
      this.updateNodeInDOM(parentElement, parent);
    }

    // Emit event
    this.emit('nodeAdded', {
      parentId: parent.id,
      parentNode: parent,
      nodeData: newNode,
      position: insertIndex
    });

    return true;
  }

  /**
   * Remove a node
   */
  removeNode(nodeId, options = {}) {
    const node = this.findNodeById(nodeId);
    if (!node) {
      return false;
    }

    // Handle root node removal
    if (!node.parent) {
      // Can only remove root if cascade is enabled or no children
      if (!options.cascade && node.children && node.children.length > 0) {
        return false;
      }
      
      // Remove from registry and clear container
      this.nodeRegistry.delete(nodeId);
      this.clear();
      
      this.emit('nodeRemoved', {
        nodeId: nodeId,
        removedNode: node,
        parentId: null,
        cascaded: !!options.cascade,
        childrenRemoved: node.children ? this.countAllDescendants(node) : 0
      });
      
      return true;
    }

    const parent = node.parent;
    const nodeIndex = parent.children.indexOf(node);
    
    if (nodeIndex === -1) {
      return false;
    }

    // Check for children if cascade is not enabled
    if (!options.cascade && node.children && node.children.length > 0) {
      return false; // Prevent orphan creation
    }

    // Remove from parent's children
    parent.children.splice(nodeIndex, 1);

    // Remove from registry
    this.nodeRegistry.delete(nodeId);

    // Count removed children for cascade
    let childrenRemoved = 0;
    if (node.children && node.children.length > 0) {
      childrenRemoved = this.countAllDescendants(node);
    }

    // Update DOM - remove the specific node element
    const nodeElement = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (nodeElement && nodeElement.parentNode) {
      nodeElement.parentNode.removeChild(nodeElement);
    }

    // Handle array index adjustment
    if (parent.type === 'array') {
      this.adjustArrayIndices(parent, nodeIndex);
    }

    // Emit event
    this.emit('nodeRemoved', {
      nodeId: nodeId,
      removedNode: node,
      parentId: parent.id,
      cascaded: !!options.cascade,
      childrenRemoved: childrenRemoved
    });

    return true;
  }

  /**
   * Move a node to a new parent or position
   */
  moveNode(nodeId, newParentId, newPosition = -1) {
    const node = this.findNodeById(nodeId);
    const newParent = this.findNodeById(newParentId);
    
    if (!node || !newParent || !node.parent) {
      return false;
    }

    // Validate the move
    const validation = this.validateMove(nodeId, newParentId);
    if (!validation.valid) {
      return false;
    }

    const oldParent = node.parent;
    const oldIndex = oldParent.children.indexOf(node);

    // Remove from old parent
    oldParent.children.splice(oldIndex, 1);

    // Add to new parent
    node.parent = newParent;
    if (!newParent.children) {
      newParent.children = [];
    }

    if (newPosition === -1 || newPosition >= newParent.children.length) {
      newParent.children.push(node);
      newPosition = newParent.children.length - 1;
    } else {
      newParent.children.splice(newPosition, 0, node);
    }

    // Update DOM - move the node element
    const nodeElement = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    const newParentElement = this.container.querySelector(`[data-node-id="${newParent.id}"]`);
    
    if (nodeElement && newParentElement) {
      // Find or create children container in new parent
      let childrenContainer = newParentElement.querySelector('.node-children');
      if (!childrenContainer) {
        childrenContainer = this.createChildrenContainer();
        newParentElement.appendChild(childrenContainer);
        newParentElement.classList.add('has-children');
      }
      
      // Move the element
      childrenContainer.appendChild(nodeElement);
      nodeElement.dataset.parentId = newParent.id;
    }

    // Emit event
    this.emit('nodeMoved', {
      nodeId: nodeId,
      movedNode: node,
      oldParentId: oldParent.id,
      newParentId: newParent.id,
      oldPosition: oldIndex,
      newPosition: newPosition
    });

    return true;
  }

  /**
   * Handle drag and drop operations
   */
  handleDragDrop(dragData) {
    const { sourceNodeId, targetNodeId, position, dropEffect } = dragData;
    
    if (dropEffect === 'move') {
      let success = false;
      
      if (position === 'child') {
        success = this.moveNode(sourceNodeId, targetNodeId);
      } else if (position === 'before' || position === 'after') {
        const targetNode = this.findNodeById(targetNodeId);
        if (targetNode && targetNode.parent) {
          const targetIndex = targetNode.parent.children.indexOf(targetNode);
          const newPosition = position === 'before' ? targetIndex : targetIndex + 1;
          success = this.moveNode(sourceNodeId, targetNode.parent.id, newPosition);
        }
      }
      
      if (success) {
        this.emit('dragDrop', dragData);
      }
      
      return success;
    }
    
    return false;
  }

  /**
   * Validate node addition
   */
  validateAddition(parentId, nodeData) {
    const errors = [];
    const parent = this.findNodeById(parentId);
    
    if (!parent) {
      errors.push('Parent node not found');
      return { valid: false, errors };
    }

    // Value nodes cannot have children
    if (parent.type === 'value') {
      errors.push('Cannot add children to value nodes');
    }

    // Array children must have numeric indices
    if (parent.type === 'array' && nodeData.name && isNaN(nodeData.name)) {
      errors.push('Array children must have numeric indices');
    }

    // Check for duplicate keys in objects
    if (parent.type === 'object' && nodeData.name) {
      const existingChild = parent.children && parent.children.find(child => child.name === nodeData.name);
      if (existingChild) {
        errors.push('Duplicate key in object');
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Validate node movement
   */
  validateMove(nodeId, newParentId) {
    const errors = [];
    const node = this.findNodeById(nodeId);
    const newParent = this.findNodeById(newParentId);
    
    if (!node || !newParent) {
      errors.push('Node or parent not found');
      return { valid: false, errors };
    }

    // Check for circular reference
    if (this.wouldCreateCircularReference(node, newParent)) {
      errors.push('Cannot create circular reference');
    }

    // Value nodes cannot have children
    if (newParent.type === 'value') {
      errors.push('Cannot move to value node');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Helper methods
   */
  findNodeById(nodeId, root = null) {
    // Use the registry for fast lookup
    return this.nodeRegistry.get(nodeId) || null;
  }

  createNodeFromData(nodeData) {
    // Import HierarchyNode dynamically to avoid circular dependency
    const node = {
      id: nodeData.id || this.generateNodeId(),
      type: nodeData.type || 'value',
      name: nodeData.name || '',
      value: nodeData.value || null,
      children: nodeData.children || [],
      metadata: nodeData.metadata || {},
      parent: null
    };
    
    // Register the new node
    this.nodeRegistry.set(node.id, node);
    
    return node;
  }

  generateNodeId() {
    return 'node-' + Math.random().toString(36).substr(2, 9);
  }

  updateNodeInDOM(element, node) {
    // Re-render the node in the DOM
    const newElement = this.renderNode(node);
    if (newElement && element.parentNode) {
      element.parentNode.replaceChild(newElement, element);
    }
  }

  countAllDescendants(node) {
    let count = 0;
    if (node.children) {
      count += node.children.length;
      for (const child of node.children) {
        count += this.countAllDescendants(child);
      }
    }
    return count;
  }

  adjustArrayIndices(arrayNode, removedIndex) {
    if (!arrayNode.children) return;
    
    let adjustedCount = 0;
    for (let i = removedIndex; i < arrayNode.children.length; i++) {
      const child = arrayNode.children[i];
      const oldIndex = parseInt(child.name);
      const newIndex = oldIndex - 1;
      child.name = newIndex.toString();
      adjustedCount++;
    }
    
    if (adjustedCount > 0) {
      this.emit('indicesAdjusted', {
        arrayNodeId: arrayNode.id,
        adjustedCount: adjustedCount
      });
    }
  }

  wouldCreateCircularReference(node, potentialParent) {
    let current = potentialParent;
    while (current) {
      if (current.id === node.id) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Destroy the view and clean up
   */
  destroy() {
    // Cancel any active edit
    if (this.isEditing()) {
      this.cancelEdit(this.editingNodeId, '');
    }
    
    this.clear();
    this.eventHandlers = {};
  }
  
  // Additional methods for public API
  
  selectNode(nodeId) {
    const element = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (element) {
      // Remove previous selection
      const prevSelected = this.container.querySelector('.selected');
      if (prevSelected) {
        prevSelected.classList.remove('selected');
      }
      
      // Add selection
      element.classList.add('selected');
      
      // Emit event
      this.emit('select', {
        nodeId,
        path: element.dataset.path || '',
        value: this.nodeRegistry.get(nodeId)?.value,
        previousSelection: prevSelected?.dataset.nodeId || null
      });
    }
  }
  
  expandNode(nodeId, recursive = false) {
    const element = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (element && element.classList.contains('has-children')) {
      element.classList.add('expanded');
      element.setAttribute('aria-expanded', 'true');
      
      const toggle = element.querySelector('.expand-toggle');
      if (toggle) {
        toggle.textContent = '▼';
      }
      
      const node = this.nodeRegistry.get(nodeId);
      const childCount = node?.children?.length || 0;
      
      this.emit('expand', {
        nodeId,
        path: element.dataset.path || '',
        recursive,
        childCount
      });
      
      if (recursive && node?.children) {
        node.children.forEach(child => {
          this.expandNode(child.id, true);
        });
      }
    }
  }
  
  collapseNode(nodeId) {
    const element = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (element && element.classList.contains('has-children')) {
      element.classList.remove('expanded');
      element.setAttribute('aria-expanded', 'false');
      
      const toggle = element.querySelector('.expand-toggle');
      if (toggle) {
        toggle.textContent = '▶';
      }
      
      this.emit('collapse', {
        nodeId,
        path: element.dataset.path || ''
      });
    }
  }
  
  expandAll() {
    const nodes = this.container.querySelectorAll('.has-children');
    nodes.forEach(node => {
      const nodeId = node.dataset.nodeId;
      if (nodeId) {
        this.expandNode(nodeId);
      }
    });
  }
  
  collapseAll() {
    const nodes = this.container.querySelectorAll('.has-children');
    nodes.forEach(node => {
      const nodeId = node.dataset.nodeId;
      if (nodeId) {
        this.collapseNode(nodeId);
      }
    });
  }
  
  setTheme(theme) {
    // Update container theme classes if needed
    this.container.className = this.container.className.replace(/theme-\S+/g, '');
    this.container.classList.add(`theme-${theme}`);
  }
  
  navigate(direction) {
    const selected = this.container.querySelector('.selected');
    if (!selected) {
      // Select first node if none selected
      const firstNode = this.container.querySelector('.hierarchy-node');
      if (firstNode) {
        this.selectNode(firstNode.dataset.nodeId);
      }
      return;
    }
    
    let target = null;
    const allNodes = Array.from(this.container.querySelectorAll('.hierarchy-node'));
    const currentIndex = allNodes.indexOf(selected);
    
    switch (direction) {
      case 'up':
        if (currentIndex > 0) {
          target = allNodes[currentIndex - 1];
        }
        break;
      case 'down':
        if (currentIndex < allNodes.length - 1) {
          target = allNodes[currentIndex + 1];
        }
        break;
      case 'left':
        if (selected.classList.contains('expanded')) {
          this.collapseNode(selected.dataset.nodeId);
        } else {
          // Navigate to parent
          const parent = selected.parentElement.closest('.hierarchy-node');
          if (parent) {
            target = parent;
          }
        }
        break;
      case 'right':
        if (selected.classList.contains('has-children')) {
          if (!selected.classList.contains('expanded')) {
            this.expandNode(selected.dataset.nodeId);
          } else {
            // Navigate to first child
            const firstChild = selected.querySelector('.node-children .hierarchy-node');
            if (firstChild) {
              target = firstChild;
            }
          }
        }
        break;
    }
    
    if (target) {
      const targetId = target.dataset.nodeId;
      this.selectNode(targetId);
      
      this.emit('navigate', {
        direction,
        from: { nodeId: selected.dataset.nodeId, path: selected.dataset.path || '' },
        to: { nodeId: targetId, path: target.dataset.path || '' },
        method: 'keyboard'
      });
    }
  }
}