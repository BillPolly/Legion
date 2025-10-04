/**
 * GraphEditorViewModel - ViewModel layer for the Graph Editor
 * 
 * Coordinates between Model and View, managing application state and user interactions.
 */

import { EventCoordinator } from '../interaction/EventCoordinator.js';
import { 
  CommandHistory, 
  AddNodeCommand, 
  RemoveNodeCommand, 
  MoveNodeCommand, 
  ConnectNodesCommand 
} from '../commands/index.js';

export class GraphEditorViewModel {
  constructor(model, view, config = {}) {
    this.model = model;
    this.view = view;
    this.config = config;
    this._destroyed = false;
    
    // Selection state
    this.selection = new Set();
    
    // Hover state
    this.hoveredElement = null;
    this.hoveredElementType = null;
    
    // Drag preview state
    this.dragPreview = {
      active: false,
      nodes: new Map(), // node -> { originalPos, previewPos }
      offset: { x: 0, y: 0 }
    };
    
    // Active tool
    this.activeTool = 'select';
    
    // Command history for undo/redo
    this.commandHistory = new CommandHistory({
      maxSize: 100,
      mergeEnabled: true
    });
    
    // Listen to command history changes
    this.commandHistory.on('change', () => {
      this._notifyHistoryChange();
    });
    
    // Dirty tracking
    this.dirtyRegions = [];
    this.isDirty = false;
    
    // Interaction listeners
    this.interactionListeners = [];
    this.errorListeners = [];
    
    // Event coordinator for handling interactions
    this.eventCoordinator = null;
    
    // Viewport state
    this.viewport = {
      pan: { x: 0, y: 0 },
      zoom: 1.0
    };
    
    // Setup model listeners
    this._setupModelListeners();
    
    // Setup view listeners if view is provided
    if (view) {
      this._setupViewListeners();
      // Initialize event coordinator
      this.eventCoordinator = new EventCoordinator(view, this);
    }
  }

  /**
   * Get model
   */
  getModel() {
    return this.model;
  }

  /**
   * Get view
   */
  getView() {
    return this.view;
  }

  /**
   * Set view (for delayed initialization)
   */
  setView(view) {
    this.view = view;
    if (view && !this._destroyed) {
      this._setupViewListeners();
      // Set up render callback
      this.view.onRender(() => this.render());
      
      // Initialize event coordinator
      this.eventCoordinator = new EventCoordinator(view, this);
    }
  }

  /**
   * Get event coordinator
   */
  getEventCoordinator() {
    return this.eventCoordinator;
  }

  /**
   * Get viewport state
   */
  getViewport() {
    return this.viewport;
  }

  /**
   * Set viewport state
   */
  setViewport(newViewport) {
    // Update local viewport state
    if (newViewport.pan) {
      this.viewport.pan = { ...this.viewport.pan, ...newViewport.pan };
    }
    if (newViewport.zoom !== undefined) {
      this.viewport.zoom = newViewport.zoom;
    }
    
    // Update view viewport using its methods
    if (this.view) {
      const viewViewport = this.view.getViewport();
      if (viewViewport) {
        // Set pan position
        if (newViewport.pan) {
          viewViewport.setPan(this.viewport.pan.x, this.viewport.pan.y);
        }
        
        // Set zoom level (zoom at center of view)
        if (newViewport.zoom !== undefined) {
          const container = this.view.getContainer();
          const centerPoint = {
            x: container.offsetWidth / 2,
            y: container.offsetHeight / 2
          };
          viewViewport.setZoom(this.viewport.zoom, centerPoint);
        }
      }
      this.view.requestRender();
    }
  }

  /**
   * Set selection (used by tools)
   */
  setSelection(selection) {
    this.selection.clear();
    
    if (selection.nodes) {
      selection.nodes.forEach(node => {
        this.selection.add(node.getId());
      });
    }
    
    this._notifySelectionChange();
  }

  /**
   * Get selected node IDs
   */
  getSelection() {
    return Array.from(this.selection);
  }

  /**
   * Check if node is selected
   */
  isSelected(nodeId) {
    return this.selection.has(nodeId);
  }

  /**
   * Select node
   */
  selectNode(nodeId, addToSelection = false) {
    if (!addToSelection) {
      this.selection.clear();
    }
    
    this.selection.add(nodeId);
    this._notifySelectionChange();
  }

  /**
   * Deselect node
   */
  deselectNode(nodeId) {
    this.selection.delete(nodeId);
    this._notifySelectionChange();
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selection.clear();
    this._notifySelectionChange();
  }

  /**
   * Set hovered element
   */
  setHoveredElement(element, elementType) {
    if (this.hoveredElement !== element || this.hoveredElementType !== elementType) {
      this.hoveredElement = element;
      this.hoveredElementType = elementType;
      this._notifyHoverChange();
      if (this.view) {
        this.view.requestRender();
      }
    }
  }

  /**
   * Clear hover
   */
  clearHover() {
    if (this.hoveredElement !== null) {
      this.hoveredElement = null;
      this.hoveredElementType = null;
      this._notifyHoverChange();
      if (this.view) {
        this.view.requestRender();
      }
    }
  }

  /**
   * Get hovered element
   */
  getHoveredElement() {
    return {
      element: this.hoveredElement,
      type: this.hoveredElementType
    };
  }

  /**
   * Check if element is hovered
   */
  isHovered(element) {
    return this.hoveredElement === element;
  }

  /**
   * Start drag preview for nodes
   */
  startDragPreview(nodes, startPosition) {
    this.dragPreview.active = true;
    this.dragPreview.nodes.clear();
    this.dragPreview.offset = { x: 0, y: 0 };
    
    // Store original positions for each node
    nodes.forEach(node => {
      const pos = node.getPosition();
      this.dragPreview.nodes.set(node, {
        originalPos: { x: pos.x, y: pos.y },
        previewPos: { x: pos.x, y: pos.y }
      });
    });
    
    if (this.view) {
      this.view.requestRender();
    }
  }

  /**
   * Update drag preview positions
   */
  updateDragPreview(offset) {
    if (!this.dragPreview.active) return;
    
    this.dragPreview.offset = offset;
    
    // Update preview positions
    this.dragPreview.nodes.forEach((data, node) => {
      data.previewPos.x = data.originalPos.x + offset.x;
      data.previewPos.y = data.originalPos.y + offset.y;
    });
    
    if (this.view) {
      this.view.requestRender();
    }
  }

  /**
   * End drag preview and commit positions
   */
  endDragPreview(commit = true) {
    if (!this.dragPreview.active) return;
    
    if (commit) {
      // Commit preview positions to actual nodes
      const model = this.getModel();
      if (model) {
        model.beginBatch();
        
        this.dragPreview.nodes.forEach((data, node) => {
          node.setPosition(data.previewPos.x, data.previewPos.y);
        });
        
        model.endBatch();
      }
    }
    
    // Clear preview state
    this.dragPreview.active = false;
    this.dragPreview.nodes.clear();
    this.dragPreview.offset = { x: 0, y: 0 };
    
    if (this.view) {
      this.view.requestRender();
    }
  }

  /**
   * Get drag preview state
   */
  getDragPreview() {
    return {
      active: this.dragPreview.active,
      nodes: Array.from(this.dragPreview.nodes.entries()).map(([node, data]) => ({
        node,
        originalPos: data.originalPos,
        previewPos: data.previewPos
      })),
      offset: this.dragPreview.offset
    };
  }

  /**
   * Check if node has drag preview
   */
  hasNodeDragPreview(node) {
    return this.dragPreview.active && this.dragPreview.nodes.has(node);
  }

  /**
   * Get node preview position
   */
  getNodePreviewPosition(node) {
    if (!this.dragPreview.active || !this.dragPreview.nodes.has(node)) {
      return node.getPosition();
    }
    return this.dragPreview.nodes.get(node).previewPos;
  }

  /**
   * Get active tool
   */
  getActiveTool() {
    return this.activeTool;
  }

  /**
   * Set active tool
   */
  setActiveTool(tool) {
    this.activeTool = tool;
  }

  /**
   * Execute command
   */
  executeCommand(command) {
    const success = this.commandHistory.execute(command, this.model);
    
    if (success && this.view) {
      this.view.requestRender();
    }
    
    return success;
  }

  /**
   * Execute a specific command type with data
   * @param {string} type - Command type
   * @param {Object} data - Command data
   * @returns {boolean} Success
   */
  executeCommandType(type, data) {
    let command;
    
    switch (type) {
      case 'addNode':
        command = new AddNodeCommand(data.nodeData, data.parentId);
        break;
      case 'removeNode':
        command = new RemoveNodeCommand(data.nodeId);
        break;
      case 'moveNode':
        command = new MoveNodeCommand(data.nodeId, data.position, data.oldPosition);
        break;
      case 'connectNodes':
        command = new ConnectNodesCommand(data.sourceNodeId, data.targetNodeId, data.edgeData);
        break;
      default:
        console.error(`Unknown command type: ${type}`);
        return false;
    }
    
    return this.executeCommand(command);
  }

  /**
   * Can undo
   */
  canUndo() {
    return this.commandHistory.canUndo();
  }

  /**
   * Can redo
   */
  canRedo() {
    return this.commandHistory.canRedo();
  }

  /**
   * Undo last command
   */
  undo() {
    const success = this.commandHistory.undo(this.model);
    
    if (success && this.view) {
      this.view.requestRender();
    }
    
    return success;
  }

  /**
   * Redo next command
   */
  redo() {
    const success = this.commandHistory.redo(this.model);
    
    if (success && this.view) {
      this.view.requestRender();
    }
    
    return success;
  }

  /**
   * Get undo/redo state
   */
  getHistoryState() {
    return this.commandHistory.getState();
  }

  /**
   * Zoom in
   */
  zoomIn() {
    this.view.getViewport().zoom(1.2);
    this.view.requestRender();
  }

  /**
   * Zoom out
   */
  zoomOut() {
    this.view.getViewport().zoom(0.8);
    this.view.requestRender();
  }

  /**
   * Reset view
   */
  resetView() {
    this.view.getViewport().reset();
    this.view.requestRender();
  }

  /**
   * Apply layout
   */
  applyLayout(layoutType) {
    // TODO: Implement actual layout
    // For now, just position nodes in a grid
    const nodes = this.model.getSceneGraph().getAllNodes().filter(n => n.getId() !== 'root');
    const cols = Math.ceil(Math.sqrt(nodes.length));
    
    nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      node.setPosition(col * 150 + 50, row * 100 + 50);
    });
    
    this.view.requestRender();
  }

  /**
   * Get dirty regions
   */
  getDirtyRegions() {
    return this.dirtyRegions;
  }

  /**
   * Clear dirty regions
   */
  clearDirtyRegions() {
    this.dirtyRegions = [];
    this.isDirty = false;
  }

  /**
   * Mark region as dirty
   */
  markDirty(region) {
    this.dirtyRegions.push(region);
    this.isDirty = true;
  }

  /**
   * Mark node as dirty
   */
  markNodeDirty(node) {
    const pos = node.getPosition();
    const size = node.getSize();
    this.markDirty({
      x: pos.x - 5,
      y: pos.y - 5,
      width: size.width + 10,
      height: size.height + 10
    });
  }

  /**
   * Render the graph
   */
  render() {
    if (!this.view || !this.view.getRenderer()) return;
    
    // Skip if nothing is dirty
    if (!this.isDirty && this.dirtyRegions.length === 0) {
      return;
    }
    
    const renderer = this.view.getRenderer();
    const sceneGraph = this.model.getSceneGraph();
    
    // Begin frame
    renderer.beginFrame();
    
    // Clear (in real implementation, could clear only dirty regions)
    renderer.clear();
    
    // Render all edges
    const edges = this.model.getEdges();
    edges.forEach(edge => {
      const sourceNode = sceneGraph.getNodeById(edge.getSource());
      const targetNode = sceneGraph.getNodeById(edge.getTarget());
      if (sourceNode && targetNode) {
        const options = {
          isHovered: this.isHovered(edge),
          isSelected: false // TODO: Implement edge selection
        };
        renderer.renderEdge(edge, sourceNode, targetNode, options);
      }
    });
    
    // Render all nodes
    const nodes = sceneGraph.getAllNodes().filter(n => n.getId() !== 'root');
    nodes.forEach(node => {
      const options = {
        isHovered: this.isHovered(node),
        isSelected: this.isSelected(node.getId()),
        selected: this.isSelected(node.getId()), // Keep for backwards compatibility
        isDragPreview: this.hasNodeDragPreview(node),
        previewPosition: this.hasNodeDragPreview(node) ? this.getNodePreviewPosition(node) : null
      };
      renderer.renderNode(node, options);
    });
    
    // Render connection preview if active
    if (this.hasConnectionPreview()) {
      const preview = this.getConnectionPreview();
      renderer.renderConnectionPreview(preview);
    }
    
    // End frame
    renderer.endFrame();
    
    // Clear dirty regions
    this.clearDirtyRegions();
  }

  /**
   * Add interaction listener
   */
  onInteraction(listener) {
    this.interactionListeners.push(listener);
  }

  /**
   * Remove interaction listener
   */
  offInteraction(listener) {
    const index = this.interactionListeners.indexOf(listener);
    if (index !== -1) {
      this.interactionListeners.splice(index, 1);
    }
  }

  /**
   * Add error listener
   */
  onError(listener) {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  offError(listener) {
    const index = this.errorListeners.indexOf(listener);
    if (index !== -1) {
      this.errorListeners.splice(index, 1);
    }
  }

  /**
   * Setup model listeners
   * @private
   */
  _setupModelListeners() {
    // Listen to model changes
    this.model.onChange = (type, data) => {
      // Check if destroyed
      if (this._destroyed) return;
      
      // Handle specific changes and mark dirty
      switch (type) {
        case 'nodeAdded':
          if (data.node) {
            this.markNodeDirty(data.node);
          }
          break;
          
        case 'nodeUpdated':
          if (data.node) {
            // Mark both old and new positions dirty if moved
            if (data.oldPosition) {
              this.markDirty({
                x: data.oldPosition.x - 5,
                y: data.oldPosition.y - 5,
                width: data.node.getSize().width + 10,
                height: data.node.getSize().height + 10
              });
            }
            this.markNodeDirty(data.node);
          }
          break;
          
        case 'sceneGraphChanged':
          // Handle scene graph changes (node property changes)
          if (data.type === 'nodeChanged' && data.node) {
            const changeData = data.data;
            if (changeData && changeData.property === 'position' && changeData.oldValue) {
              // Mark old position dirty
              this.markDirty({
                x: changeData.oldValue.x - 5,
                y: changeData.oldValue.y - 5,
                width: data.node.getSize().width + 10,
                height: data.node.getSize().height + 10
              });
            }
            // Mark new position dirty
            this.markNodeDirty(data.node);
          }
          break;
          
        case 'nodeRemoved':
          // Mark old position dirty
          if (data.position && data.size) {
            this.markDirty({
              x: data.position.x - 5,
              y: data.position.y - 5,
              width: data.size.width + 10,
              height: data.size.height + 10
            });
          }
          
          // Remove from selection if selected
          if (this.selection.has(data.nodeId)) {
            this.selection.delete(data.nodeId);
            this._notifySelectionChange();
          }
          break;
          
        case 'edgeAdded':
        case 'edgeUpdated':
        case 'edgeRemoved':
          // For now, mark entire viewport dirty for edges
          this.isDirty = true;
          break;
          
        case 'batchUpdate':
          // Process all changes in batch
          if (data.changes) {
            // Mark everything dirty for batch update
            this.isDirty = true;
            
            // Process selection changes
            data.changes.forEach(change => {
              if (change.type === 'nodeRemoved' && this.selection.has(change.data.nodeId)) {
                this.selection.delete(change.data.nodeId);
                this._notifySelectionChange();
              }
            });
          }
          break;
      }
      
      // Request view update
      if (this.view) {
        this.view.requestRender();
      }
    };
  }

  /**
   * Setup view listeners
   * @private
   */
  _setupViewListeners() {
    // Register render callback with the view
    if (this.view && typeof this.view.onRender === 'function') {
      this.view.onRender(() => this.render());
    }
  }

  /**
   * Handle view event (legacy method)
   * @private
   */
  _handleViewEvent(event) {
    // Notify interaction listeners
    this.interactionListeners.forEach(listener => listener(event));
  }


  /**
   * Notify history change
   * @private
   */
  _notifyHistoryChange() {
    if (this.config.onHistoryChange) {
      this.config.onHistoryChange(this.getHistoryState());
    }
  }

  /**
   * Notify selection change
   * @private
   */
  _notifySelectionChange() {
    if (this.config.onSelectionChange) {
      this.config.onSelectionChange(this.getSelection());
    }
  }

  /**
   * Notify hover change
   * @private
   */
  _notifyHoverChange() {
    if (this.config.onHoverChange) {
      this.config.onHoverChange(this.getHoveredElement());
    }
  }

  /**
   * Handle error
   * @private
   */
  _handleError(error) {
    console.error('GraphEditorViewModel Error:', error);
    this.errorListeners.forEach(listener => listener(error));
  }

  /**
   * Start connection preview
   * @param {Object} sourceNode - Source node for the connection
   * @param {Object} startPosition - Starting position for the preview
   */
  startConnectionPreview(sourceNode, startPosition) {
    this.connectionPreview = {
      active: true,
      sourceNode: sourceNode,
      sourcePosition: startPosition,
      targetPosition: startPosition,
      previewElement: null
    };
    
    this.view.requestRender();
  }

  /**
   * Update connection preview
   * @param {Object} targetPosition - Current position of the preview end
   */
  updateConnectionPreview(targetPosition) {
    if (!this.connectionPreview || !this.connectionPreview.active) return;
    
    this.connectionPreview.targetPosition = targetPosition;
    this.view.requestRender();
  }

  /**
   * End connection preview
   */
  endConnectionPreview() {
    if (!this.connectionPreview) return;
    
    this.connectionPreview = null;
    this.view.requestRender();
  }

  /**
   * Check if connection preview is active
   * @returns {boolean}
   */
  hasConnectionPreview() {
    return this.connectionPreview && this.connectionPreview.active;
  }

  /**
   * Get connection preview data
   * @returns {Object|null}
   */
  getConnectionPreview() {
    return this.connectionPreview;
  }

  /**
   * Destroy the view model and clean up resources
   */
  destroy() {
    this._destroyed = true;
    
    // Destroy event coordinator
    if (this.eventCoordinator) {
      this.eventCoordinator.destroy();
      this.eventCoordinator = null;
    }
    
    // Clear listeners
    this.interactionListeners = [];
    this.errorListeners = [];
    
    // Clear references
    this.model = null;
    this.view = null;
  }
}