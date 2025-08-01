/**
 * SelectTool - Tool for selecting and manipulating nodes/edges
 */

import { Tool } from './Tool.js';
import { MoveNodeCommand } from '../commands/MoveNodeCommand.js';

export class SelectTool extends Tool {
  constructor(config = {}) {
    super('select', {
      cursor: 'default',
      ...config
    });
    
    // Selection state
    this.selectedNodes = new Set();
    this.selectedEdges = new Set();
    this.selectionBox = null;
    this.isDragging = false;
    this.dragStartPosition = null;
    this.draggedNodes = new Map(); // node -> original position
  }

  /**
   * Get selected nodes
   */
  getSelectedNodes() {
    return Array.from(this.selectedNodes);
  }

  /**
   * Get selected edges
   */
  getSelectedEdges() {
    return Array.from(this.selectedEdges);
  }

  /**
   * Select node
   */
  selectNode(node, additive = false) {
    if (!additive) {
      this.clearSelection();
    }
    
    this.selectedNodes.add(node);
    this._notifySelectionChange();
  }

  /**
   * Select edge
   */
  selectEdge(edge, additive = false) {
    if (!additive) {
      this.clearSelection();
    }
    
    this.selectedEdges.add(edge);
    this._notifySelectionChange();
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedNodes.clear();
    this.selectedEdges.clear();
    this._notifySelectionChange();
  }

  /**
   * Check if node is selected
   */
  isNodeSelected(node) {
    return this.selectedNodes.has(node);
  }

  /**
   * Check if edge is selected
   */
  isEdgeSelected(edge) {
    return this.selectedEdges.has(edge);
  }

  // Tool lifecycle
  onActivate() {
    // Clear selection when activated
    this.clearSelection();
  }

  onDeactivate() {
    // Clear selection when deactivated
    this.clearSelection();
    
    // Cancel any active drag preview
    if (this.isDragging) {
      const viewModel = this.getViewModel();
      if (viewModel) {
        viewModel.endDragPreview(false); // commit = false (cancel)
      }
    }
    
    this.isDragging = false;
    this.draggedNodes.clear();
  }

  // Interaction handlers
  onClick(interaction) {
    const { target, targetType, modifiers = {} } = interaction;
    
    if (targetType === 'node') {
      // Select/deselect node
      const additive = modifiers.shift || modifiers.ctrl || modifiers.meta;
      if (additive && this.isNodeSelected(target)) {
        this.selectedNodes.delete(target);
        this._notifySelectionChange();
      } else {
        this.selectNode(target, additive);
      }
    } else if (targetType === 'edge') {
      // Select/deselect edge
      const additive = modifiers.shift || modifiers.ctrl || modifiers.meta;
      if (additive && this.isEdgeSelected(target)) {
        this.selectedEdges.delete(target);
        this._notifySelectionChange();
      } else {
        this.selectEdge(target, additive);
      }
    }
  }

  onBackgroundClick(interaction) {
    // Clear selection on background click
    this.clearSelection();
  }

  onDragStart(interaction) {
    const { target, targetType, dragData } = interaction;
    
    if (targetType === 'node') {
      // Start dragging node(s)
      if (!this.isNodeSelected(target)) {
        // Select the node if not already selected
        this.selectNode(target);
      }
      
      // Start drag preview
      this.isDragging = true;
      this.dragStartPosition = dragData ? dragData.startPosition : interaction.position;
      this.draggedNodes.clear();
      
      // Store original positions for potential undo
      for (const node of this.selectedNodes) {
        const pos = node.getPosition();
        this.draggedNodes.set(node, { x: pos.x, y: pos.y });
      }
      
      // Start drag preview in ViewModel
      const viewModel = this.getViewModel();
      if (viewModel) {
        viewModel.startDragPreview(Array.from(this.selectedNodes), this.dragStartPosition);
        
        // Apply initial drag offset if we have drag data
        if (dragData && dragData.delta) {
          viewModel.updateDragPreview(dragData.delta);
        }
      }
    } else if (!target) {
      // Start selection box
      this.selectionBox = {
        start: dragData ? dragData.startPosition : interaction.position,
        current: dragData ? dragData.currentPosition : interaction.position
      };
      // Apply selection immediately for single-move selections
      const rect = this._getSelectionRect();
      const sceneGraph = this.getModel()?.getSceneGraph();
      if (sceneGraph) {
        const nodesInRect = sceneGraph.getNodesInRect(
          rect.x, rect.y, rect.width, rect.height
        );
        
        this.selectedNodes.clear();
        nodesInRect.forEach(node => {
          if (node.getId() !== 'root') {
            this.selectedNodes.add(node);
          }
        });
        this._notifySelectionChange();
      }
    }
  }

  onDrag(interaction) {
    const { dragData } = interaction;
    
    if (this.isDragging && this.draggedNodes.size > 0 && dragData) {
      // Update drag preview using delta from InteractionStateMachine
      const viewModel = this.getViewModel();
      if (viewModel) {
        viewModel.updateDragPreview(dragData.delta);
      }
    } else if (this.selectionBox && dragData) {
      // Update selection box
      this.selectionBox.current = dragData.currentPosition;
      
      // Find nodes in selection box
      const rect = this._getSelectionRect();
      const sceneGraph = this.getModel()?.getSceneGraph();
      if (sceneGraph) {
        const nodesInRect = sceneGraph.getNodesInRect(
          rect.x, rect.y, rect.width, rect.height
        );
        
        
        // Update selection
        this.selectedNodes.clear();
        nodesInRect.forEach(node => {
          if (node.getId() !== 'root') {
            this.selectedNodes.add(node);
          }
        });
        this._notifySelectionChange();
      }
    }
  }

  onDragEnd(interaction) {
    if (this.isDragging) {
      const viewModel = this.getViewModel();
      if (viewModel) {
        // Get final positions from drag preview
        const dragPreview = viewModel.getDragPreview();
        
        if (dragPreview.active) {
          // Create move commands for each dragged node
          dragPreview.nodes.forEach(({ node, originalPos, previewPos }) => {
            // Only create command if position actually changed
            if (originalPos.x !== previewPos.x || originalPos.y !== previewPos.y) {
              const command = new MoveNodeCommand(
                node.getId(),
                previewPos,
                originalPos
              );
              viewModel.executeCommand(command);
            }
          });
          
          // End drag preview without committing (we already did via commands)
          viewModel.endDragPreview(false);
        }
      }
      
      this.isDragging = false;
      this.dragStartPosition = null;
      this.draggedNodes.clear();
    } else if (this.selectionBox) {
      // End selection box
      this.selectionBox = null;
    }
  }

  /**
   * Get selection box rectangle
   * @private
   */
  _getSelectionRect() {
    if (!this.selectionBox) return null;
    
    const { start, current } = this.selectionBox;
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    
    return { x, y, width, height };
  }

  /**
   * Notify selection change
   * @private
   */
  _notifySelectionChange() {
    const viewModel = this.getViewModel();
    if (viewModel) {
      viewModel.setSelection({
        nodes: this.getSelectedNodes(),
        edges: this.getSelectedEdges()
      });
    }
  }

  /**
   * Get selection box for rendering
   */
  getSelectionBox() {
    return this._getSelectionRect();
  }
}