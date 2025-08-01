/**
 * TreeViewModel - ViewModel layer for the tree component
 * 
 * Coordinates between TreeModel and TreeView, handles user interactions,
 * and manages the application logic following MVVM pattern.
 */
export class TreeViewModel {
  constructor(model, view, config) {
    this.model = model;
    this.view = view;
    this.config = config;
    
    // Interaction state
    this.dragState = {
      isDragging: false,
      startPosition: null,
      currentTarget: null
    };
    
    // Keyboard navigation state
    this.focusedNodeId = null;
    this.lastSelectedNodeId = null;
    
    // Inline editing state  
    this.editingNodeId = null;
    this.editingInput = null;
    
    // Bind view events
    this.bindViewEvents();
    
    // Setup interaction handlers
    this.setupClickHandlers();
    this.setupDragHandlers();
    this.setupKeyboardHandlers();
  }
  
  /**
   * Initial render
   */
  render() {
    const visibleNodes = this.model.getVisibleNodes();
    this.view.render(visibleNodes, this.config.nodeRenderer);
    this.updateSelection();
  }
  
  /**
   * Bind view events to viewmodel handlers
   */
  bindViewEvents() {
    // Click events
    this.view.addEventHandler('click', this.handleClick.bind(this));
    this.view.addEventHandler('dblclick', this.handleDoubleClick.bind(this));
    
    // Drag events (if dragging is enabled)
    if (this.config.draggable) {
      this.view.addEventHandler('mousedown', this.handleMouseDown.bind(this));
      this.view.addEventHandler('mousemove', this.handleMouseMove.bind(this));
      this.view.addEventHandler('mouseup', this.handleMouseUp.bind(this));
      this.view.addEventHandler('dragstart', this.preventDefaultDrag.bind(this));
    }
    
    // Keyboard events
    this.view.addEventHandler('keydown', this.handleKeyDown.bind(this));
    this.view.addEventHandler('focusin', this.handleFocusIn.bind(this));
  }
  
  /**
   * Click handling
   */
  setupClickHandlers() {
    this.expandClickHandler = (event) => {
      // Find the element with data-action attribute
      const actionElement = event.target.closest('[data-action]');
      if (!actionElement) return;
      
      const action = actionElement.getAttribute('data-action');
      const nodeId = actionElement.getAttribute('data-node-id');
      
      if (!nodeId) return;
      
      event.stopPropagation();
      
      switch (action) {
        case 'expand':
          this.toggleExpansion(nodeId);
          break;
          
        case 'edit':
          if (this.config.editable && !this.editingNodeId && !this.dragState.isDragging) {
            event.preventDefault();
            this.startEditing(nodeId);
          }
          break;
          
        case 'select':
          // Only select if not clicking on a more specific action
          if (event.target === actionElement || !event.target.closest('[data-action]', actionElement)) {
            this.handleNodeClick(nodeId, event);
          }
          break;
      }
    };
  }
  
  handleClick(event) {
    this.expandClickHandler(event);
  }
  
  handleDoubleClick(event) {
    const nodeElement = event.target.closest('.tree-node');
    if (!nodeElement) return;
    
    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;
    
    // Double-click toggles expansion
    this.toggleExpansion(nodeId);
    
    // Call callback if provided
    if (this.config.onDoubleClick) {
      const node = this.model.getNode(nodeId);
      this.config.onDoubleClick(nodeId, node, event);
    }
  }
  
  handleNodeClick(nodeId, event) {
    // Handle selection
    if (this.config.selectable !== 'none') {
      const isSelected = this.model.isSelected(nodeId);
      
      if (this.config.selectable === 'multiple' && (event.ctrlKey || event.metaKey)) {
        // Multi-select with Ctrl/Cmd
        if (isSelected) {
          this.model.deselect(nodeId);
        } else {
          this.model.select(nodeId);
        }
      } else if (this.config.selectable === 'multiple' && event.shiftKey && this.lastSelectedNodeId) {
        // Range selection with Shift
        this.selectRange(this.lastSelectedNodeId, nodeId);
      } else {
        // Single selection or primary selection in multi-mode
        this.model.clearSelection();
        this.model.select(nodeId);
      }
      
      this.lastSelectedNodeId = nodeId;
      this.updateSelection();
      
      // Call selection callback
      if (this.config.onSelectionChange) {
        this.config.onSelectionChange(
          this.model.getSelectedIds(),
          this.model.getSelectedNodes()
        );
      }
    }
    
    // Focus the node
    this.focusNode(nodeId);
    
    // Call click callback
    if (this.config.onClick) {
      const node = this.model.getNode(nodeId);
      this.config.onClick(nodeId, node, event);
    }
  }
  
  selectRange(startNodeId, endNodeId) {
    const visibleNodes = this.model.getVisibleNodes();
    const startIndex = visibleNodes.findIndex(n => n.nodeId === startNodeId);
    const endIndex = visibleNodes.findIndex(n => n.nodeId === endNodeId);
    
    if (startIndex >= 0 && endIndex >= 0) {
      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);
      
      this.model.clearSelection();
      for (let i = minIndex; i <= maxIndex; i++) {
        this.model.select(visibleNodes[i].nodeId);
      }
    }
  }
  
  /**
   * Expansion/collapse handling
   */
  toggleExpansion(nodeId) {
    const result = this.model.toggleExpansion(nodeId);
    
    if (result.changed) {
      // Update view
      this.view.updateNodeExpansion(nodeId, result.action === 'expand');
      
      // Re-render to show/hide children
      this.render();
      
      // Call callbacks
      if (result.action === 'expand' && this.config.onExpand) {
        const node = this.model.getNode(nodeId);
        this.config.onExpand(nodeId, node);
      } else if (result.action === 'collapse' && this.config.onCollapse) {
        const node = this.model.getNode(nodeId);
        this.config.onCollapse(nodeId, node);
      }
    }
  }
  
  expandNode(nodeId) {
    if (this.model.expand(nodeId)) {
      this.view.updateNodeExpansion(nodeId, true);
      this.render();
      
      if (this.config.onExpand) {
        const node = this.model.getNode(nodeId);
        this.config.onExpand(nodeId, node);
      }
    }
  }
  
  collapseNode(nodeId) {
    if (this.model.collapse(nodeId)) {
      this.view.updateNodeExpansion(nodeId, false);
      this.render();
      
      if (this.config.onCollapse) {
        const node = this.model.getNode(nodeId);
        this.config.onCollapse(nodeId, node);
      }
    }
  }
  
  /**
   * Drag & Drop handling
   */
  setupDragHandlers() {
    if (!this.config.draggable) return;
    
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;
  }
  
  handleMouseDown(event) {
    if (!this.config.draggable) return;
    
    // Only start drag from drag handle or node content
    const nodeElement = event.target.closest('.tree-node');
    const dragHandle = event.target.closest('.tree-node-drag-handle');
    const nodeContent = event.target.closest('.tree-node-content');
    
    if (!nodeElement || (!dragHandle && !nodeContent)) return;
    
    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;
    
    // Prevent text selection during drag
    event.preventDefault();
    
    this.dragState.isDragging = false; // Not dragging yet, just mouse down
    this.dragState.startPosition = { x: event.clientX, y: event.clientY };
    this.dragState.nodeId = nodeId;
    this.dragState.startTime = Date.now();
    
    // Add global mouse handlers
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
    this.mouseUpHandler = this.handleMouseUp.bind(this);
    
    document.addEventListener('mousemove', this.mouseMoveHandler);
    document.addEventListener('mouseup', this.mouseUpHandler);
  }
  
  handleMouseMove(event) {
    if (!this.dragState.startPosition) return;
    
    // Check if we've moved enough to start dragging
    const deltaX = Math.abs(event.clientX - this.dragState.startPosition.x);
    const deltaY = Math.abs(event.clientY - this.dragState.startPosition.y);
    const threshold = 5;
    
    if (!this.dragState.isDragging && (deltaX > threshold || deltaY > threshold)) {
      // Start dragging
      this.startDrag(this.dragState.nodeId, event);
    }
    
    if (this.dragState.isDragging) {
      this.updateDrag(event);
    }
  }
  
  handleMouseUp(event) {
    if (this.dragState.isDragging) {
      this.endDrag(event);
    } else {
      // Was just a click, not a drag
      this.resetDragState();
    }
    
    // Remove global handlers
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      document.removeEventListener('mouseup', this.mouseUpHandler);
      this.mouseMoveHandler = null;
      this.mouseUpHandler = null;
    }
  }
  
  startDrag(nodeId, event) {
    if (!this.model.startDrag(nodeId)) return;
    
    this.dragState.isDragging = true;
    this.view.startDragVisual(nodeId, event);
    
    // Call drag start callback
    if (this.config.onDragStart) {
      const node = this.model.getNode(nodeId);
      this.config.onDragStart(nodeId, node, event);
    }
  }
  
  updateDrag(event) {
    this.view.updateDragVisual(event);
    
    // Find drop target
    const dropInfo = this.view.getNodeAtPoint(event.clientX, event.clientY);
    
    if (dropInfo) {
      const { nodeId: targetNodeId, position } = dropInfo;
      
      // Check if drop is valid
      if (this.model.canDrop(targetNodeId, position)) {
        this.model.updateDropTarget(targetNodeId, position);
        this.view.showDropIndicator(targetNodeId, position);
        this.dragState.currentTarget = { nodeId: targetNodeId, position };
      } else {
        this.view.hideDropIndicator();
        this.dragState.currentTarget = null;
      }
    } else {
      this.view.hideDropIndicator();
      this.dragState.currentTarget = null;
    }
  }
  
  endDrag(event) {
    const dropResult = this.model.completeDrop();
    
    if (dropResult) {
      // Successful drop - re-render to show new structure
      this.render();
      
      // Call drop callback
      if (this.config.onMove) {
        this.config.onMove(
          dropResult.draggedNodeId,
          dropResult.draggedNode,
          dropResult.targetNodeId,
          dropResult.position
        );
      }
    }
    
    this.view.endDragVisual();
    this.resetDragState();
  }
  
  resetDragState() {
    this.dragState.isDragging = false;
    this.dragState.startPosition = null;
    this.dragState.nodeId = null;
    this.dragState.currentTarget = null;
  }
  
  preventDefaultDrag(event) {
    // Prevent default HTML5 drag to use our custom implementation
    event.preventDefault();
  }
  
  /**
   * Keyboard handling
   */
  setupKeyboardHandlers() {
    this.keyActions = {
      'ArrowUp': () => this.navigateUp(),
      'ArrowDown': () => this.navigateDown(),
      'ArrowLeft': () => this.navigateLeft(),
      'ArrowRight': () => this.navigateRight(),
      'Enter': () => this.activateNode(),
      'Space': () => this.toggleSelection(),
      'Home': () => this.navigateToFirst(),
      'End': () => this.navigateToLast(),
      'Escape': () => this.clearSelection()
    };
  }
  
  handleKeyDown(event) {
    if (!this.focusedNodeId) return;
    
    const action = this.keyActions[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }
  
  handleFocusIn(event) {
    const nodeElement = event.target.closest('.tree-node');
    if (nodeElement) {
      const nodeId = nodeElement.getAttribute('data-node-id');
      this.focusedNodeId = nodeId;
    }
  }
  
  navigateUp() {
    const visibleNodes = this.model.getVisibleNodes();
    const currentIndex = visibleNodes.findIndex(n => n.nodeId === this.focusedNodeId);
    
    if (currentIndex > 0) {
      const previousNode = visibleNodes[currentIndex - 1];
      this.focusNode(previousNode.nodeId);
    }
  }
  
  navigateDown() {
    const visibleNodes = this.model.getVisibleNodes();
    const currentIndex = visibleNodes.findIndex(n => n.nodeId === this.focusedNodeId);
    
    if (currentIndex >= 0 && currentIndex < visibleNodes.length - 1) {
      const nextNode = visibleNodes[currentIndex + 1];
      this.focusNode(nextNode.nodeId);
    }
  }
  
  navigateLeft() {
    if (this.model.isExpanded(this.focusedNodeId)) {
      this.collapseNode(this.focusedNodeId);
    } else {
      // Navigate to parent
      const parentId = this.model.getParentId(this.focusedNodeId);
      if (parentId) {
        this.focusNode(parentId);
      }
    }
  }
  
  navigateRight() {
    if (this.model.hasChildren(this.focusedNodeId)) {
      if (!this.model.isExpanded(this.focusedNodeId)) {
        this.expandNode(this.focusedNodeId);
      } else {
        // Navigate to first child
        const children = this.model.getNodeChildren(this.focusedNodeId);
        if (children.length > 0) {
          const firstChildId = this.model.getNodeId(children[0]);
          this.focusNode(firstChildId);
        }
      }
    }
  }
  
  activateNode() {
    if (this.model.hasChildren(this.focusedNodeId)) {
      this.toggleExpansion(this.focusedNodeId);
    }
    
    // Also trigger selection
    if (this.config.selectable !== 'none') {
      this.model.clearSelection();
      this.model.select(this.focusedNodeId);
      this.updateSelection();
      
      if (this.config.onSelectionChange) {
        this.config.onSelectionChange(
          this.model.getSelectedIds(),
          this.model.getSelectedNodes()
        );
      }
    }
  }
  
  toggleSelection() {
    if (this.config.selectable === 'none') return;
    
    if (this.model.isSelected(this.focusedNodeId)) {
      this.model.deselect(this.focusedNodeId);
    } else {
      if (this.config.selectable === 'single') {
        this.model.clearSelection();
      }
      this.model.select(this.focusedNodeId);
    }
    
    this.updateSelection();
    
    if (this.config.onSelectionChange) {
      this.config.onSelectionChange(
        this.model.getSelectedIds(),
        this.model.getSelectedNodes()
      );
    }
  }
  
  navigateToFirst() {
    const visibleNodes = this.model.getVisibleNodes();
    if (visibleNodes.length > 0) {
      this.focusNode(visibleNodes[0].nodeId);
    }
  }
  
  navigateToLast() {
    const visibleNodes = this.model.getVisibleNodes();
    if (visibleNodes.length > 0) {
      this.focusNode(visibleNodes[visibleNodes.length - 1].nodeId);
    }
  }
  
  clearSelection() {
    if (this.model.clearSelection()) {
      this.updateSelection();
      
      if (this.config.onSelectionChange) {
        this.config.onSelectionChange([], []);
      }
    }
  }
  
  /**
   * Inline editing methods
   */
  startEditing(nodeId) {
    // Finish any existing edit first
    if (this.editingNodeId) {
      this.finishEditing();
    }
    
    const node = this.model.getNode(nodeId);
    if (!node) return false;
    
    this.editingNodeId = nodeId;
    const fullValue = node.name || node.label || node.title || String(node);
    
    // Extract text part (remove emoji if present)
    // Check if starts with emoji (Unicode emoji characters)
    const emojiMatch = fullValue.match(/^([\u{1F000}-\u{1F9FF}]|\u{2600}-\u{26FF}|\u{2700}-\u{27BF})\s(.+)$/u);
    const currentValue = emojiMatch ? emojiMatch[2] : fullValue;
    const emoji = emojiMatch ? emojiMatch[1] : '';
    
    this.editingInput = this.view.startEditingNode(nodeId, currentValue, emoji);
    
    if (this.editingInput) {
      // Add event listeners to the input
      this.editingInput.addEventListener('blur', () => this.finishEditing());
      this.editingInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.finishEditing();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.cancelEditing();
        }
      });
      
      return true;
    }
    
    this.editingNodeId = null;
    return false;
  }
  
  finishEditing(newValue = null) {
    if (!this.editingNodeId) return null;
    
    // Store the editing node id before clearing it
    const currentEditingNodeId = this.editingNodeId;
    
    const finalValue = newValue || (this.editingInput ? this.editingInput.value : null);
    const result = this.view.finishEditingNode(currentEditingNodeId, finalValue);
    
    // Clear editing state immediately to prevent double calls
    this.editingNodeId = null;
    this.editingInput = null;
    
    if (result && result.changed) {
      // Update the model with new value
      const node = this.model.getNode(currentEditingNodeId);
      
      if (node) {
        const oldValue = result.originalValue;
        const newNodeValue = result.newValue;
        
        // Update node data (prefer 'name' field)
        if ('name' in node) {
          node.name = newNodeValue;
        } else if ('label' in node) {
          node.label = newNodeValue;
        } else if ('title' in node) {
          node.title = newNodeValue;
        } else {
          // If no standard field exists, add name
          node.name = newNodeValue;
        }
        
        // Re-render to show the change
        this.render();
        
        // Call callback if provided
        if (this.config.onNodeEdit) {
          this.config.onNodeEdit(currentEditingNodeId, newNodeValue, oldValue, node);
        }
        
        // Trigger data change callback
        if (this.config.onDataChange) {
          this.config.onDataChange(this.model.data);
        }
      }
    }
    
    return result;
  }
  
  cancelEditing() {
    if (!this.editingNodeId) return null;
    
    const result = this.view.cancelEditingNode(this.editingNodeId);
    this.editingNodeId = null;
    this.editingInput = null;
    
    return result;
  }
  
  isEditing(nodeId = null) {
    if (nodeId) {
      return this.editingNodeId === nodeId;
    }
    return this.editingNodeId !== null;
  }

  /**
   * Public API methods
   */
  focusNode(nodeId) {
    this.focusedNodeId = nodeId;
    this.view.focusNode(nodeId);
  }
  
  highlightNode(nodeId) {
    // Ensure node is visible by expanding ancestors
    this.model.expandToNode(nodeId);
    this.render();
    this.view.highlightNode(nodeId);
  }
  
  updateSelection() {
    const selectedIds = this.model.getSelectedIds();
    this.view.updateSelection(selectedIds);
  }
  
  search(searchTerm, options = {}) {
    const searchField = options.field || 'name';
    const matches = this.model.searchNodes(searchTerm, searchField);
    
    if (options.expandResults !== false) {
      this.model.expandSearchResults(matches);
      this.render();
    }
    
    // Highlight first match
    if (matches.length > 0 && options.highlightFirst !== false) {
      this.highlightNode(matches[0].nodeId);
    }
    
    return matches;
  }
  
  /**
   * Data operations
   */
  setData(newData) {
    this.model.data = [...newData];
    this.model.buildNodeMaps();
    this.render();
  }
  
  getData() {
    return this.model.data;
  }
  
  getSelectedNodes() {
    return this.model.getSelectedNodes();
  }
  
  getSelectedIds() {
    return this.model.getSelectedIds();
  }
  
  expandAll() {
    const allNodes = this.model.getAllNodes();
    let changed = false;
    
    allNodes.forEach(({ nodeId }) => {
      if (this.model.hasChildren(nodeId) && !this.model.isExpanded(nodeId)) {
        this.model.expand(nodeId);
        changed = true;
      }
    });
    
    if (changed) {
      this.render();
    }
  }
  
  collapseAll() {
    const expandedIds = Array.from(this.model.expandedNodes);
    expandedIds.forEach(nodeId => {
      this.model.collapse(nodeId);
    });
    
    this.render();
  }
  
  /**
   * State management
   */
  exportState() {
    return this.model.exportState();
  }
  
  importState(state) {
    this.model.importState(state);
    this.render();
  }
  
  getStats() {
    return this.model.getStats();
  }
  
  /**
   * Cleanup
   */
  destroy() {
    // Cancel any ongoing drag
    if (this.dragState.isDragging) {
      this.model.cancelDrag();
      this.view.endDragVisual();
    }
    
    // Remove global event listeners
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler);
      document.removeEventListener('mouseup', this.mouseUpHandler);
    }
    
    // Clear state
    this.resetDragState();
    this.focusedNodeId = null;
    this.lastSelectedNodeId = null;
  }
}