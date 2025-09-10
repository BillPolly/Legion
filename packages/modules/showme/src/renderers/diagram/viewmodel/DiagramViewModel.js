/**
 * DiagramViewModel - State management for diagram rendering
 * 
 * Manages diagram state including layout, viewport, and selection
 * All state is managed on the frontend
 */

export class DiagramViewModel {
  constructor(config = {}) {
    this.config = config;
    this.layoutEngine = config.layoutEngine;
    this.view = config.view;
    
    // Diagram data
    this.nodes = new Map();
    this.edges = new Map();
    this.groups = new Map();
    
    // View state (Frontend Only)
    this.viewport = {
      zoom: 1,
      panX: 0,
      panY: 0
    };
    
    // Layout state (Frontend Only)
    this.layoutState = {
      positions: new Map(), // node id -> {x, y}
      bounds: null // overall diagram bounds
    };
    
    // Interaction state
    this.selection = new Set();
    this.hoveredElement = null;
    
    // Display options
    this.displayOptions = {
      showGrid: false,
      showMinimap: false,
      theme: config.theme || 'light'
    };
    
    // Event callbacks
    this.onModelChange = config.onModelChange;
    this.onSelectionChange = config.onSelectionChange;
    this.onNodeClick = config.onNodeClick;
    this.onEdgeClick = config.onEdgeClick;
    this.onHoverChange = config.onHoverChange;
    this.onHoverEnd = config.onHoverEnd;
    
    // Bind event handlers
    this._bindEventHandlers();
  }

  /**
   * Bind event handlers
   * @private
   */
  _bindEventHandlers() {
    if (this.view) {
      // Set ViewModel reference in View
      this.view.setViewModel(this);
      
      // View will emit events that we handle
      this.view.on('nodeClick', (nodeId) => this._handleNodeClick(nodeId));
      this.view.on('edgeClick', (edgeId) => this._handleEdgeClick(edgeId));
      this.view.on('backgroundClick', () => this._handleBackgroundClick());
      this.view.on('elementHover', (elementId) => this._handleElementHover(elementId));
      this.view.on('viewportChange', (viewport) => this._handleViewportChange(viewport));
    }
  }

  /**
   * Set diagram data
   * @param {Object} data - Diagram data structure
   */
  setDiagramData(data) {
    // Clear existing data
    this.nodes.clear();
    this.edges.clear();
    this.groups.clear();
    
    // Clear hover if the hovered element no longer exists
    if (this.hoveredElement) {
      this.hoveredElement = null;
    }
    
    // Process nodes
    if (data.nodes) {
      data.nodes.forEach(node => {
        this.nodes.set(node.id, {
          ...node,
          position: { x: 0, y: 0 }, // Will be set by layout
          size: this._calculateNodeSize(node)
        });
      });
    }
    
    // Process edges
    if (data.edges) {
      data.edges.forEach(edge => {
        this.edges.set(edge.id, {
          ...edge,
          path: null // Will be calculated during rendering
        });
      });
    }
    
    // Process groups
    if (data.groups) {
      data.groups.forEach(group => {
        this.groups.set(group.id, group);
      });
    }
    
    // Notify model change
    this._notifyModelChange('dataLoaded');
  }

  /**
   * Calculate node size based on content
   * @private
   */
  _calculateNodeSize(node) {
    // Base size
    let width = 120;
    let height = 60;
    
    // Adjust based on label length
    if (node.label) {
      width = Math.max(width, node.label.length * 8 + 20);
    }
    
    // Adjust based on shape
    switch (node.style?.shape) {
      case 'circle':
        width = height = 80;
        break;
      case 'cylinder':
        height = 80;
        break;
      case 'diamond':
        width = 100;
        height = 100;
        break;
    }
    
    return { width, height };
  }

  /**
   * Compute layout for all nodes
   */
  computeLayout() {
    if (!this.layoutEngine) {
      throw new Error('No layout engine configured');
    }
    
    // Prepare graph data for layout
    const graphData = {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
    
    // Compute layout
    const layoutResult = this.layoutEngine.compute(graphData);
    
    // Update node positions
    layoutResult.positions.forEach((position, nodeId) => {
      const node = this.nodes.get(nodeId);
      if (node) {
        node.position = position;
        this.layoutState.positions.set(nodeId, position);
      }
    });
    
    // Update bounds
    this.layoutState.bounds = layoutResult.bounds;
    
    // Calculate edge paths
    this._calculateEdgePaths();
    
    // Notify layout change
    this._notifyModelChange('layoutComputed');
  }

  /**
   * Calculate edge paths based on node positions
   * @private
   */
  _calculateEdgePaths() {
    this.edges.forEach((edge, edgeId) => {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      
      if (sourceNode && targetNode) {
        // Simple straight line for now
        edge.path = {
          start: {
            x: sourceNode.position.x + sourceNode.size.width / 2,
            y: sourceNode.position.y + sourceNode.size.height / 2
          },
          end: {
            x: targetNode.position.x + targetNode.size.width / 2,
            y: targetNode.position.y + targetNode.size.height / 2
          }
        };
      }
    });
  }

  /**
   * Update viewport (pan/zoom)
   * @param {Object} transform - { zoom, panX, panY }
   */
  updateViewport(transform) {
    this.viewport = { ...this.viewport, ...transform };
    this._notifyModelChange('viewportChanged');
  }

  /**
   * Select an element
   * @param {string} elementId - ID of element to select
   */
  selectElement(elementId) {
    this.selection.clear();
    if (this.nodes.has(elementId) || this.edges.has(elementId)) {
      this.selection.add(elementId);
    }
    this._notifySelectionChange();
  }

  /**
   * Select a node
   * @param {string} nodeId - ID of node to select
   */
  selectNode(nodeId) {
    const previousSize = this.selection.size;
    const hadNode = this.selection.has(nodeId);
    
    this.selection.clear();
    if (this.nodes.has(nodeId)) {
      this.selection.add(nodeId);
    }
    
    // Only notify if selection actually changed
    if (this.selection.size !== previousSize || !hadNode) {
      this._notifySelectionChange();
    }
  }

  /**
   * Select an edge
   * @param {string} edgeId - ID of edge to select
   */
  selectEdge(edgeId) {
    const previousSize = this.selection.size;
    const hadEdge = this.selection.has(edgeId);
    
    this.selection.clear();
    if (this.edges.has(edgeId)) {
      this.selection.add(edgeId);
    }
    
    // Only notify if selection actually changed
    if (this.selection.size !== previousSize || !hadEdge) {
      this._notifySelectionChange();
    }
  }

  /**
   * Toggle selection of an element
   * @param {string} elementId - ID of element to toggle
   */
  toggleSelection(elementId) {
    if (this.selection.has(elementId)) {
      this.selection.delete(elementId);
    } else if (this.nodes.has(elementId) || this.edges.has(elementId)) {
      this.selection.add(elementId);
    }
    this._notifySelectionChange();
  }

  /**
   * Add element to selection
   * @param {string} elementId - ID of element to add
   */
  addToSelection(elementId) {
    const previousSize = this.selection.size;
    if (this.nodes.has(elementId) || this.edges.has(elementId)) {
      this.selection.add(elementId);
    }
    if (this.selection.size !== previousSize) {
      this._notifySelectionChange();
    }
  }

  /**
   * Remove element from selection
   * @param {string} elementId - ID of element to remove
   */
  removeFromSelection(elementId) {
    const previousSize = this.selection.size;
    this.selection.delete(elementId);
    if (this.selection.size !== previousSize) {
      this._notifySelectionChange();
    }
  }

  /**
   * Select multiple elements
   * @param {Array<string>} elementIds - Array of element IDs to select
   */
  selectMultiple(elementIds) {
    this.selection.clear();
    elementIds.forEach(id => {
      if (this.nodes.has(id) || this.edges.has(id)) {
        this.selection.add(id);
      }
    });
    this._notifySelectionChange();
  }

  /**
   * Select all elements
   */
  selectAll() {
    this.selection.clear();
    this.nodes.forEach((node, id) => this.selection.add(id));
    this.edges.forEach((edge, id) => this.selection.add(id));
    this._notifySelectionChange();
  }

  /**
   * Select elements within a box
   * @param {Object} box - Selection box { x, y, width, height }
   */
  selectInBox(box) {
    this.selection.clear();
    
    // Select nodes that fall within the box
    this.nodes.forEach((node, id) => {
      if (this._isNodeInBox(node, box)) {
        this.selection.add(id);
      }
    });
    
    // Select edges if both endpoints are in the box
    this.edges.forEach((edge, id) => {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      if (sourceNode && targetNode && 
          this._isNodeInBox(sourceNode, box) && 
          this._isNodeInBox(targetNode, box)) {
        this.selection.add(id);
      }
    });
    
    this._notifySelectionChange();
  }

  /**
   * Check if a node is within a box
   * @private
   */
  _isNodeInBox(node, box) {
    const nodeRight = node.position.x + node.size.width;
    const nodeBottom = node.position.y + node.size.height;
    const boxRight = box.x + box.width;
    const boxBottom = box.y + box.height;
    
    return !(node.position.x > boxRight || 
             nodeRight < box.x || 
             node.position.y > boxBottom || 
             nodeBottom < box.y);
  }

  /**
   * Select with keyboard modifier
   * @param {string} elementId - Element to select
   * @param {Object} modifiers - Keyboard modifiers { ctrlKey, shiftKey, metaKey }
   */
  selectWithModifier(elementId, modifiers = {}) {
    if (modifiers.ctrlKey || modifiers.metaKey) {
      // Add/remove from selection
      this.toggleSelection(elementId);
    } else if (modifiers.shiftKey) {
      // Range selection (simplified for MVP)
      // In a full implementation, this would select all elements between last selected and current
      this.addToSelection(elementId);
    } else {
      // Normal selection
      this.selectElement(elementId);
    }
  }

  /**
   * Clear selection
   */
  clearSelection() {
    if (this.selection.size > 0) {
      this.selection.clear();
      this._notifySelectionChange();
    }
  }

  /**
   * Check if element is selected
   * @param {string} elementId - Element ID to check
   * @returns {boolean} True if selected
   */
  isSelected(elementId) {
    return this.selection.has(elementId);
  }

  /**
   * Get all selected elements
   * @returns {Array<string>} Array of selected element IDs
   */
  getSelectedElements() {
    return Array.from(this.selection);
  }

  /**
   * Get selected nodes only
   * @returns {Array<string>} Array of selected node IDs
   */
  getSelectedNodes() {
    return Array.from(this.selection).filter(id => this.nodes.has(id));
  }

  /**
   * Get selected edges only
   * @returns {Array<string>} Array of selected edge IDs
   */
  getSelectedEdges() {
    return Array.from(this.selection).filter(id => this.edges.has(id));
  }

  /**
   * Handle background click
   */
  handleBackgroundClick() {
    this.clearSelection();
  }

  /**
   * Set hovered element
   * @param {string} elementId - ID of element to hover
   */
  setHoveredElement(elementId) {
    // Only set if element exists
    if (!elementId || (!this.nodes.has(elementId) && !this.edges.has(elementId))) {
      this.clearHoveredElement();
      return;
    }
    
    // Only notify if changed
    if (this.hoveredElement !== elementId) {
      this.hoveredElement = elementId;
      this._notifyHoverChange();
    }
  }

  /**
   * Clear hovered element
   */
  clearHoveredElement() {
    if (this.hoveredElement !== null) {
      this.hoveredElement = null;
      if (this.onHoverEnd) {
        this.onHoverEnd();
      }
      this._notifyModelChange('hoverChanged');
    }
  }

  /**
   * Check if element is hovered
   * @param {string} elementId - Element ID to check
   * @returns {boolean} True if hovered
   */
  isHovered(elementId) {
    return this.hoveredElement === elementId;
  }

  /**
   * Get hover information
   * @returns {Object|null} Hover info or null
   */
  getHoverInfo() {
    if (!this.hoveredElement) {
      return null;
    }

    const node = this.nodes.get(this.hoveredElement);
    if (node) {
      return {
        id: this.hoveredElement,
        type: 'node',
        data: node
      };
    }

    const edge = this.edges.get(this.hoveredElement);
    if (edge) {
      return {
        id: this.hoveredElement,
        type: 'edge',
        data: edge
      };
    }

    return null;
  }

  /**
   * Get element display properties
   * @param {string} elementId - Element ID
   * @returns {Object} Display properties
   */
  getElementDisplayProperties(elementId) {
    return {
      isSelected: this.isSelected(elementId),
      isHovered: this.isHovered(elementId)
    };
  }

  /**
   * Notify hover change
   * @private
   */
  _notifyHoverChange() {
    if (this.onHoverChange) {
      const info = this.getHoverInfo();
      if (info) {
        this.onHoverChange(info);
      }
    }
    this._notifyModelChange('hoverChanged');
  }
  
  /**
   * Clear hover state
   */
  clearHover() {
    this.hoveredElement = null;
    this._notifyModelChange('hoverChanged');
  }
  
  
  /**
   * Duplicate selected elements
   */
  duplicateSelection() {
    const selectedIds = Array.from(this.selection);
    if (selectedIds.length === 0) return;
    
    // Emit event using EventEmitter pattern
    this._emit('duplicateSelection', selectedIds);
    
    // Also call callback if provided
    if (this.onDuplicateSelection) {
      this.onDuplicateSelection(selectedIds);
    }
    
    this._notifyModelChange('duplicateSelection');
  }
  
  /**
   * Register event listener (EventEmitter pattern)
   */
  on(eventName, handler) {
    if (!this._eventListeners) {
      this._eventListeners = new Map();
    }
    
    if (!this._eventListeners.has(eventName)) {
      this._eventListeners.set(eventName, []);
    }
    
    this._eventListeners.get(eventName).push(handler);
  }
  
  /**
   * Emit event to registered listeners
   */
  _emit(eventName, ...args) {
    if (this._eventListeners && this._eventListeners.has(eventName)) {
      this._eventListeners.get(eventName).forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in ${eventName} handler:`, error);
        }
      });
    }
  }

  /**
   * Get visible elements based on viewport
   * @returns {Object} Visible nodes and edges
   */
  getVisibleElements() {
    // For MVP, return all elements
    // TODO: Implement viewport culling for performance
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values())
    };
  }

  /**
   * Get current state
   * @returns {Object} Current view model state
   */
  getState() {
    return {
      nodes: this.nodes,
      edges: this.edges,
      groups: this.groups,
      viewport: this.viewport,
      selection: this.selection,
      hoveredElement: this.hoveredElement,
      layoutBounds: this.layoutState.bounds,
      displayOptions: this.displayOptions,
      viewModel: this  // Pass reference for display properties queries
    };
  }

  /**
   * Handle node click
   * @private
   */
  _handleNodeClick(nodeId) {
    this.selectElement(nodeId);
    
    if (this.onNodeClick) {
      const node = this.nodes.get(nodeId);
      this.onNodeClick(node);
    }
  }

  /**
   * Handle edge click
   * @private
   */
  _handleEdgeClick(edgeId) {
    this.selectElement(edgeId);
    
    if (this.onEdgeClick) {
      const edge = this.edges.get(edgeId);
      this.onEdgeClick(edge);
    }
  }

  /**
   * Handle background click
   * @private
   */
  _handleBackgroundClick() {
    this.handleBackgroundClick();
  }

  /**
   * Handle element hover
   * @private
   */
  _handleElementHover(elementInfo) {
    if (elementInfo && elementInfo.id) {
      this.setHoveredElement(elementInfo.id);
    }
  }

  /**
   * Handle viewport change from view
   * @private
   */
  _handleViewportChange(viewport) {
    this.viewport = viewport;
    this._notifyModelChange('viewportChanged');
  }

  /**
   * Notify model change
   * @private
   */
  _notifyModelChange(changeType) {
    if (this.onModelChange) {
      this.onModelChange(changeType, this.getState());
    }
  }

  /**
   * Notify selection change
   * @private
   */
  _notifySelectionChange() {
    if (this.onSelectionChange) {
      this.onSelectionChange(new Set(this.selection));
    }
    this._notifyModelChange('selectionChanged');
  }

  /**
   * Destroy the view model
   */
  destroy() {
    // Clear data
    this.nodes.clear();
    this.edges.clear();
    this.groups.clear();
    this.selection.clear();
    
    // Clear references
    this.layoutEngine = null;
    this.view = null;
    this.onModelChange = null;
    this.onSelectionChange = null;
    this.onNodeClick = null;
    this.onEdgeClick = null;
  }
}