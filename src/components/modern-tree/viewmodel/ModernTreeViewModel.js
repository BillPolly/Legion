/**
 * ModernTreeViewModel - Tree coordination layer extending BaseViewModel
 * 
 * Coordinates interactions between ModernTreeModel and ModernTreeView.
 * Handles user interactions, keyboard navigation, and state synchronization.
 */

import { BaseViewModel } from '../../base/index.js';

export class ModernTreeViewModel extends BaseViewModel {
  constructor(model, view, config) {
    super(model, view, config);
    
    // Set model reference on view
    this.view.setModel(this.model);
    
    // Navigation state
    this.keyboardNavigationEnabled = true;
    this.lastSelectedNode = null;
    
    // Interaction state
    this.dragState = null;
    this.editingNode = null;
    
    // Inline editing state
    this.editingNodeId = null;
    this.editingInput = null;
    
    // Performance optimizations
    this.renderDebounceTimeout = null;
    this.searchDebounceTimeout = null;
  }

  /**
   * Initialize tree-specific commands
   * @protected
   */
  _initializeCommands() {
    super._initializeCommands();
    
    // Node management commands
    this.registerCommand('expandNode', this._expandNodeCommand.bind(this));
    this.registerCommand('collapseNode', this._collapseNodeCommand.bind(this));
    this.registerCommand('toggleNode', this._toggleNodeCommand.bind(this));
    this.registerCommand('expandAll', this._expandAllCommand.bind(this));
    this.registerCommand('collapseAll', this._collapseAllCommand.bind(this));
    this.registerCommand('expandToDepth', this._expandToDepthCommand.bind(this));
    
    // Selection commands
    this.registerCommand('selectNode', this._selectNodeCommand.bind(this));
    this.registerCommand('deselectNode', this._deselectNodeCommand.bind(this));
    this.registerCommand('clearSelection', this._clearSelectionCommand.bind(this));
    this.registerCommand('selectAll', this._selectAllCommand.bind(this));
    
    // Focus and navigation commands
    this.registerCommand('focusNode', this._focusNodeCommand.bind(this));
    this.registerCommand('navigateUp', this._navigateUpCommand.bind(this));
    this.registerCommand('navigateDown', this._navigateDownCommand.bind(this));
    this.registerCommand('navigateLeft', this._navigateLeftCommand.bind(this));
    this.registerCommand('navigateRight', this._navigateRightCommand.bind(this));
    this.registerCommand('navigateHome', this._navigateHomeCommand.bind(this));
    this.registerCommand('navigateEnd', this._navigateEndCommand.bind(this));
    
    // Search commands
    this.registerCommand('search', this._searchCommand.bind(this));
    this.registerCommand('clearSearch', this._clearSearchCommand.bind(this));
    
    // Data commands
    this.registerCommand('setData', this._setDataCommand.bind(this));
    this.registerCommand('refreshData', this._refreshDataCommand.bind(this));
    
    // State commands
    this.registerCommand('exportState', this._exportStateCommand.bind(this));
    this.registerCommand('importState', this._importStateCommand.bind(this));
    
    // Editing commands (if enabled)
    if (this.config.editable) {
      this.registerCommand('startEdit', this._startEditCommand.bind(this));
      this.registerCommand('finishEdit', this._finishEditCommand.bind(this));
      this.registerCommand('cancelEdit', this._cancelEditCommand.bind(this));
    }
  }

  /**
   * Handle view events from ModernTreeView
   * @protected
   */
  _handleViewEvent(event) {
    super._handleViewEvent(event);
    
    switch (event.type) {
      case 'nodeToggle':
        this.executeCommand('toggleNode', { nodeId: event.data.nodeId });
        break;
        
      case 'nodeClick':
        this._handleNodeClick(event.data);
        break;
        
      case 'nodeDoubleClick':
        this._handleNodeDoubleClick(event.data);
        break;
        
      case 'nodeStartEdit':
        console.log('📝 [VIEWMODEL] Received nodeStartEdit event for:', event.data.nodeId);
        console.log('📝 [VIEWMODEL] Config editable:', this.config.editable);
        console.log('📝 [VIEWMODEL] Current editing state:', {
          editingNodeId: this.editingNodeId,
          editingInput: !!this.editingInput
        });
        
        if (this.config.editable) {
          console.log('✅ [VIEWMODEL] Config allows editing, executing startEdit command...');
          const result = this.executeCommand('startEdit', { nodeId: event.data.nodeId });
          console.log('📝 [VIEWMODEL] startEdit command result:', result);
          
          // Double-check the editing state after command
          setTimeout(() => {
            console.log('📝 [VIEWMODEL] Post-command editing state:', {
              editingNodeId: this.editingNodeId,
              editingInput: !!this.editingInput,
              inputInDOM: !!document.querySelector('.tree-node-label-input')
            });
          }, 10);
        } else {
          console.log('❌ [VIEWMODEL] Editing disabled in config');
        }
        break;
        
      case 'nodeContextMenu':
        this._handleNodeContextMenu(event.data);
        break;
        
      case 'nodeFocus':
        this.executeCommand('focusNode', { nodeId: event.data.nodeId });
        break;
        
      case 'keyboardNavigate':
        this._handleKeyboardNavigation(event.data);
        break;
        
      case 'nodeActivate':
        this._handleNodeActivate(event.data);
        break;
        
      case 'dragStart':
        this._handleDragStart(event.data);
        break;
        
      case 'dragOver':
        this._handleDragOver(event.data);
        break;
        
      case 'drop':
        this._handleDrop(event.data);
        break;
        
      case 'treeBlur':
        this._handleTreeBlur();
        break;
    }
  }

  /**
   * Handle model events from ModernTreeModel
   * @protected
   */
  _handleModelEvent(event) {
    super._handleModelEvent(event);
    
    switch (event.type) {
      case 'treeDataChanged':
        this._handleTreeDataChanged(event.data);
        break;
        
      case 'nodeExpanded':
      case 'nodeCollapsed':
        this._handleExpansionChanged(event.data);
        break;
        
      case 'nodeSelected':
      case 'nodeDeselected':
      case 'selectionCleared':
        this._handleSelectionChanged(event.data);
        break;
        
      case 'focusChanged':
        this._handleFocusChanged(event.data);
        break;
        
      case 'searchPerformed':
      case 'searchCleared':
        this._handleSearchChanged(event.data);
        break;
        
      case 'allNodesCollapsed':
        this._debouncedRender();
        break;
        
      case 'batchChanged':
        this._debouncedRender();
        break;
    }
  }

  // Event Handlers

  /**
   * Handle node click events
   * @private
   */
  _handleNodeClick({ nodeId, ctrlKey, shiftKey }) {
    // Handle selection based on mode and modifiers
    if (this.config.selectable === 'none') return;
    
    if (this.config.selectable === 'multiple') {
      if (ctrlKey) {
        // Toggle individual selection
        if (this.model.isSelected(nodeId)) {
          this.executeCommand('deselectNode', { nodeId });
        } else {
          this.executeCommand('selectNode', { nodeId, extend: true });
        }
      } else if (shiftKey && this.lastSelectedNode) {
        // Range selection
        this._selectRange(this.lastSelectedNode, nodeId);
      } else {
        // Single selection (clear others)
        this.executeCommand('selectNode', { nodeId, extend: false });
      }
    } else {
      // Single selection mode
      this.executeCommand('selectNode', { nodeId, extend: false });
    }
    
    // Focus the node
    this.executeCommand('focusNode', { nodeId });
    
    // Call external callback
    this._notifySelectionChange();
  }

  /**
   * Handle node double-click events
   * @private
   */
  _handleNodeDoubleClick({ nodeId }) {
    // Toggle expansion on double-click
    if (this.model.hasChildren(nodeId)) {
      this.executeCommand('toggleNode', { nodeId });
    }
    
    // Trigger edit mode if enabled
    if (this.config.editable) {
      this._startEditing(nodeId);
    }
    
    // Call external callback
    if (this.config.onNodeDoubleClick) {
      this.config.onNodeDoubleClick(nodeId, this.model.getNode(nodeId));
    }
  }

  /**
   * Handle node context menu events
   * @private
   */
  _handleNodeContextMenu({ nodeId, x, y }) {
    // Focus the node
    this.executeCommand('focusNode', { nodeId });
    
    // Call external callback
    if (this.config.onContextMenu) {
      this.config.onContextMenu(nodeId, this.model.getNode(nodeId), { x, y });
    }
  }

  /**
   * Handle keyboard navigation
   * @private
   */
  _handleKeyboardNavigation({ direction, nodeId }) {
    switch (direction) {
      case 'up':
        this.executeCommand('navigateUp', { fromNode: nodeId });
        break;
      case 'down':
        this.executeCommand('navigateDown', { fromNode: nodeId });
        break;
      case 'left':
        this.executeCommand('navigateLeft', { fromNode: nodeId });
        break;
      case 'right':
        this.executeCommand('navigateRight', { fromNode: nodeId });
        break;
      case 'home':
        this.executeCommand('navigateHome');
        break;
      case 'end':
        this.executeCommand('navigateEnd');
        break;
    }
  }

  /**
   * Handle node activation (Enter/Space)
   * @private
   */
  _handleNodeActivate({ nodeId }) {
    // Toggle expansion if node has children
    if (this.model.hasChildren(nodeId)) {
      this.executeCommand('toggleNode', { nodeId });
    }
    
    // Select if not already selected
    if (!this.model.isSelected(nodeId)) {
      this.executeCommand('selectNode', { nodeId });
    }
    
    // Call external callback
    if (this.config.onNodeActivate) {
      this.config.onNodeActivate(nodeId, this.model.getNode(nodeId));
    }
  }

  /**
   * Handle tree data changes
   * @private
   */
  _handleTreeDataChanged({ data, nodeCount }) {
    this.view.announce(`Tree updated with ${nodeCount} nodes`);
    this.render();
    
    // Call external callback
    if (this.config.onDataChange) {
      this.config.onDataChange(data, nodeCount);
    }
  }

  /**
   * Handle expansion changes
   * @private
   */
  _handleExpansionChanged({ nodeId, node }) {
    // Update view immediately for expansion changes
    this.view.render();
    
    // Announce to screen readers
    const isExpanded = this.model.isExpanded(nodeId);
    this.view.announce(`${node.name || 'Node'} ${isExpanded ? 'expanded' : 'collapsed'}`);
    
    // Call external callback
    if (this.config.onExpansionChange) {
      this.config.onExpansionChange(nodeId, isExpanded, node);
    }
  }

  /**
   * Handle selection changes
   * @private
   */
  _handleSelectionChanged({ nodeId, selectedNodes }) {
    this.view._updateSelection();
    
    if (nodeId) {
      this.lastSelectedNode = nodeId;
    }
    
    this._notifySelectionChange();
  }

  /**
   * Handle focus changes
   * @private
   */
  _handleFocusChanged({ newFocused, node }) {
    this.view._updateFocus();
    
    if (newFocused) {
      // Ensure focused node is visible
      this.view.scrollToNode(newFocused);
      
      // Announce to screen readers
      if (node) {
        this.view.announce(`Focused on ${node.name || 'node'}`);
      }
    }
  }

  /**
   * Handle search changes
   * @private
   */
  _handleSearchChanged({ query, results, resultIds }) {
    this.view._updateSearch();
    
    if (query) {
      this.view.announce(`Search found ${results} results for "${query}"`);
    } else {
      this.view.announce('Search cleared');
    }
    
    // Call external callback
    if (this.config.onSearchResults) {
      this.config.onSearchResults(query, results, resultIds);
    }
  }

  // Command Implementations

  /**
   * Expand node command
   * @private
   */
  _expandNodeCommand({ nodeId }) {
    this.model.expandNode(nodeId);
    return true;
  }

  /**
   * Collapse node command
   * @private
   */
  _collapseNodeCommand({ nodeId }) {
    this.model.collapseNode(nodeId);
    return true;
  }

  /**
   * Toggle node command
   * @private
   */
  _toggleNodeCommand({ nodeId }) {
    this.model.toggleNode(nodeId);
    return true;
  }

  /**
   * Expand all nodes command
   * @private
   */
  _expandAllCommand() {
    this.model.expandAll();
    return true;
  }

  /**
   * Collapse all nodes command
   * @private
   */
  _collapseAllCommand() {
    this.model.collapseAll();
    return true;
  }

  /**
   * Expand to depth command
   * @private
   */
  _expandToDepthCommand({ depth }) {
    this.model.expandToDepth(depth);
    return true;
  }

  /**
   * Select node command
   * @private
   */
  _selectNodeCommand({ nodeId, extend = false }) {
    this.model.selectNode(nodeId, extend);
    return true;
  }

  /**
   * Deselect node command
   * @private
   */
  _deselectNodeCommand({ nodeId }) {
    this.model.deselectNode(nodeId);
    return true;
  }

  /**
   * Clear selection command
   * @private
   */
  _clearSelectionCommand() {
    this.model.clearSelection();
    return true;
  }

  /**
   * Select all visible nodes command
   * @private
   */
  _selectAllCommand() {
    if (this.config.selectable !== 'multiple') return false;
    
    const visibleNodes = this.model.getVisibleNodes();
    this.model.startBatch();
    visibleNodes.forEach(nodeId => this.model.selectNode(nodeId, true));
    this.model.endBatch();
    return true;
  }

  /**
   * Focus node command
   * @private
   */
  _focusNodeCommand({ nodeId }) {
    this.model.setFocusedNode(nodeId);
    return true;
  }

  /**
   * Navigate up command
   * @private
   */
  _navigateUpCommand({ fromNode }) {
    const visibleNodes = this.model.getVisibleNodes();
    const currentIndex = visibleNodes.indexOf(fromNode);
    
    if (currentIndex > 0) {
      const previousNode = visibleNodes[currentIndex - 1];
      this.executeCommand('focusNode', { nodeId: previousNode });
    }
    
    return true;
  }

  /**
   * Navigate down command
   * @private
   */
  _navigateDownCommand({ fromNode }) {
    const visibleNodes = this.model.getVisibleNodes();
    const currentIndex = visibleNodes.indexOf(fromNode);
    
    if (currentIndex < visibleNodes.length - 1) {
      const nextNode = visibleNodes[currentIndex + 1];
      this.executeCommand('focusNode', { nodeId: nextNode });
    }
    
    return true;
  }

  /**
   * Navigate left command (collapse or go to parent)
   * @private
   */
  _navigateLeftCommand({ fromNode }) {
    if (this.model.isExpanded(fromNode)) {
      // Collapse if expanded
      this.executeCommand('collapseNode', { nodeId: fromNode });
    } else {
      // Go to parent
      const parentId = this.model.getNodeParent(fromNode);
      if (parentId) {
        this.executeCommand('focusNode', { nodeId: parentId });
      }
    }
    
    return true;
  }

  /**
   * Navigate right command (expand or go to first child)
   * @private
   */
  _navigateRightCommand({ fromNode }) {
    if (this.model.hasChildren(fromNode)) {
      if (!this.model.isExpanded(fromNode)) {
        // Expand if collapsed
        this.executeCommand('expandNode', { nodeId: fromNode });
      } else {
        // Go to first child if expanded
        const children = this.model.getNodeChildren(fromNode);
        if (children.length > 0) {
          this.executeCommand('focusNode', { nodeId: children[0] });
        }
      }
    }
    
    return true;
  }

  /**
   * Navigate to first visible node
   * @private
   */
  _navigateHomeCommand() {
    const visibleNodes = this.model.getVisibleNodes();
    if (visibleNodes.length > 0) {
      this.executeCommand('focusNode', { nodeId: visibleNodes[0] });
    }
    return true;
  }

  /**
   * Navigate to last visible node
   * @private
   */
  _navigateEndCommand() {
    const visibleNodes = this.model.getVisibleNodes();
    if (visibleNodes.length > 0) {
      this.executeCommand('focusNode', { nodeId: visibleNodes[visibleNodes.length - 1] });
    }
    return true;
  }

  /**
   * Search command
   * @private
   */
  _searchCommand({ query, options = {} }) {
    // Debounce search for performance
    clearTimeout(this.searchDebounceTimeout);
    this.searchDebounceTimeout = setTimeout(() => {
      this.model.search(query, options);
    }, 300);
    
    return true;
  }

  /**
   * Clear search command
   * @private
   */
  _clearSearchCommand() {
    this.model.clearSearch();
    return true;
  }

  /**
   * Set data command
   * @private
   */
  _setDataCommand({ data }) {
    this.model.setTreeData(data);
    return true;
  }

  /**
   * Refresh data command
   * @private
   */
  _refreshDataCommand() {
    this.render();
    return true;
  }

  /**
   * Export state command
   * @private
   */
  _exportStateCommand() {
    return this.model.exportTreeState();
  }

  /**
   * Import state command
   * @private
   */
  _importStateCommand({ state }) {
    this.model.importTreeState(state);
    return true;
  }


  /**
   * Start editing command
   * @private
   */
  _startEditCommand({ nodeId }) {
    console.log('🔧 [VIEWMODEL] _startEditCommand called for:', nodeId);
    console.log('🔧 [VIEWMODEL] Config editable:', this.config.editable);
    console.log('🔧 [VIEWMODEL] View reference exists:', !!this.view);
    console.log('🔧 [VIEWMODEL] Model reference exists:', !!this.model);
    
    if (!this.config.editable) {
      console.log('❌ [VIEWMODEL] Edit command failed: not editable');
      return false;
    }
    
    // Finish any existing edit first
    if (this.editingNodeId) {
      console.log('⚠️ [VIEWMODEL] Finishing existing edit for:', this.editingNodeId);
      this._finishEditCommand();
    }
    
    const node = this.model.getNode(nodeId);
    console.log('🔧 [VIEWMODEL] Node data:', node);
    if (!node) {
      console.log('❌ [VIEWMODEL] Edit command failed: node not found');
      return false;
    }
    
    this.editingNodeId = nodeId;
    const fullValue = node.name || node.label || node.title || String(node);
    
    // Extract text part (remove emoji if present)
    // Use a simpler approach - find first space and assume everything before it is emoji
    const spaceIndex = fullValue.indexOf(' ');
    let currentValue, emoji;
    
    if (spaceIndex > 0) {
      const possibleEmoji = fullValue.substring(0, spaceIndex);
      const textPart = fullValue.substring(spaceIndex + 1);
      
      // Check if the first part looks like emoji by testing if it's not normal text
      // Simple heuristic: if it's 1-2 characters and not alphanumeric, treat as emoji
      if (possibleEmoji.length <= 2 && !/^[a-zA-Z0-9]+$/.test(possibleEmoji)) {
        emoji = possibleEmoji;
        currentValue = textPart;
      } else {
        emoji = '';
        currentValue = fullValue;
      }
    } else {
      emoji = '';
      currentValue = fullValue;
    }
    
    console.log('🔧 [VIEWMODEL] About to call view.startEditingNode with:', {
      nodeId, 
      currentValue, 
      emoji
    });
    
    this.editingInput = this.view.startEditingNode(nodeId, currentValue, emoji);
    console.log('🔧 [VIEWMODEL] view.startEditingNode returned:', !!this.editingInput);
    
    if (this.editingInput) {
      console.log('✅ [VIEWMODEL] Got editing input element, adding event listeners');
      console.log('🔧 [VIEWMODEL] Input element:', this.editingInput.tagName, this.editingInput.className);
      console.log('🔧 [VIEWMODEL] Input value:', this.editingInput.value);
      
      // Add event listeners to the input
      this.editingInput.addEventListener('blur', () => {
        console.log('🔧 [VIEWMODEL] Input blur event - finishing edit');
        this._finishEditCommand();
      });
      this.editingInput.addEventListener('keydown', (e) => {
        console.log('🔧 [VIEWMODEL] Input keydown event:', e.key);
        if (e.key === 'Enter') {
          e.preventDefault();
          console.log('🔧 [VIEWMODEL] Enter pressed - finishing edit');
          this._finishEditCommand();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          console.log('🔧 [VIEWMODEL] Escape pressed - cancelling edit');
          this._cancelEditCommand();
        }
      });
      
      console.log('✅ [VIEWMODEL] Edit command successful, returning true');
      return true;
    }
    
    console.log('❌ [VIEWMODEL] view.startEditingNode failed, clearing editing state');
    this.editingNodeId = null;
    return false;
  }

  /**
   * Finish editing command
   * @private
   */
  _finishEditCommand({ newValue = null } = {}) {
    if (!this.editingNodeId) return null;
    
    const currentEditingNodeId = this.editingNodeId;
    const finalValue = newValue || (this.editingInput ? this.editingInput.value : null);
    const result = this.view.finishEditingNode(currentEditingNodeId, finalValue);
    
    // Clear editing state immediately
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
          node.name = newNodeValue;
        }
        
        // Re-render to show the change
        this.render();
        
        // Call callback if provided
        if (this.config.onNodeEdit) {
          this.config.onNodeEdit(currentEditingNodeId, newNodeValue, oldValue, node);
        }
      }
    }
    
    return result;
  }

  /**
   * Cancel editing command
   * @private
   */
  _cancelEditCommand() {
    if (!this.editingNodeId) return null;
    
    const result = this.view.cancelEditingNode(this.editingNodeId);
    this.editingNodeId = null;
    this.editingInput = null;
    
    return result;
  }

  // Utility Methods

  /**
   * Select range of nodes
   * @private
   */
  _selectRange(fromNodeId, toNodeId) {
    const visibleNodes = this.model.getVisibleNodes();
    const fromIndex = visibleNodes.indexOf(fromNodeId);
    const toIndex = visibleNodes.indexOf(toNodeId);
    
    if (fromIndex === -1 || toIndex === -1) return;
    
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);
    
    this.model.startBatch();
    this.model.clearSelection();
    for (let i = startIndex; i <= endIndex; i++) {
      this.model.selectNode(visibleNodes[i], true);
    }
    this.model.endBatch();
  }

  /**
   * Notify external callbacks about selection changes
   * @private
   */
  _notifySelectionChange() {
    if (this.config.onSelectionChange) {
      const selectedNodes = this.model.getSelectedNodes();
      const selectedData = selectedNodes.map(nodeId => this.model.getNode(nodeId));
      this.config.onSelectionChange(selectedNodes, selectedData);
    }
  }

  /**
   * Debounced render for performance
   * @private
   */
  _debouncedRender() {
    clearTimeout(this.renderDebounceTimeout);
    this.renderDebounceTimeout = setTimeout(() => {
      this.render();
    }, 16); // ~60fps
  }

  /**
   * Handle tree blur
   * @private
   */
  _handleTreeBlur() {
    // Optional: Clear focus when tree loses focus
    // this.model.setFocusedNode(null);
  }

  // Drag and Drop Support

  /**
   * Handle drag start
   * @private
   */
  _handleDragStart({ nodeId, dataTransfer }) {
    if (!this.config.draggable) return;
    
    this.dragState = {
      draggedNode: nodeId,
      startTime: Date.now()
    };
    
    const node = this.model.getNode(nodeId);
    dataTransfer.setData('text/plain', node.name || '');
    dataTransfer.setData('application/x-tree-node', nodeId);
    dataTransfer.effectAllowed = 'move';
    
    // Call external callback
    if (this.config.onDragStart) {
      this.config.onDragStart(nodeId, node, dataTransfer);
    }
  }

  /**
   * Handle drag over
   * @private
   */
  _handleDragOver({ nodeId, dataTransfer }) {
    if (!this.config.draggable || !this.dragState) return;
    
    dataTransfer.dropEffect = 'move';
    
    // Call external callback
    if (this.config.onDragOver) {
      this.config.onDragOver(nodeId, this.model.getNode(nodeId), dataTransfer);
    }
  }

  /**
   * Handle drop
   * @private
   */
  _handleDrop({ nodeId, dataTransfer }) {
    if (!this.config.draggable || !this.dragState) return;
    
    const draggedNodeId = this.dragState.draggedNode;
    const targetNodeId = nodeId;
    
    // Reset drag state
    this.dragState = null;
    
    // Prevent dropping on self or descendants
    if (draggedNodeId === targetNodeId) return;
    
    const draggedPath = this.model.getNodePath(draggedNodeId);
    if (draggedPath.includes(targetNodeId)) return;
    
    // Call external callback
    if (this.config.onNodeMove) {
      const draggedNode = this.model.getNode(draggedNodeId);
      const targetNode = this.model.getNode(targetNodeId);
      this.config.onNodeMove(draggedNodeId, targetNodeId, draggedNode, targetNode);
    }
  }

  // Public API Extensions

  /**
   * Search nodes with external API
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Search results
   */
  search(query, options) {
    // Call model search directly to get results
    return this.model.search(query, options);
  }

  /**
   * Get selected nodes
   * @returns {Array} Selected node data
   */
  getSelection() {
    const selectedNodes = this.model.getSelectedNodes();
    return selectedNodes.map(nodeId => ({
      id: nodeId,
      data: this.model.getNode(nodeId)
    }));
  }

  /**
   * Get tree statistics
   * @returns {Object} Tree statistics
   */
  getStats() {
    return this.model.getTreeStats();
  }
}