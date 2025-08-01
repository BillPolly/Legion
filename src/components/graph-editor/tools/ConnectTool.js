/**
 * ConnectTool - Tool for creating edges between nodes
 * 
 * Handles interactive edge creation with visual feedback.
 */
import { Tool } from './Tool.js';

export class ConnectTool extends Tool {
  constructor(config = {}) {
    super('connect', {
      cursor: 'crosshair',
      ...config
    });
    
    this.sourceNode = null;
    this.isConnecting = false;
    this.viewModel = null;
    this.view = null;
  }
  
  onActivate() {
    this.reset();
  }
  
  onDeactivate() {
    this.reset();
  }
  
  reset() {
    this.sourceNode = null;
    this.isConnecting = false;
    if (this.coordinator && this.coordinator.viewModel) {
      this.coordinator.viewModel.endConnectionPreview();
    }
  }
  
  // Override Tool base class methods
  onMouseDown(interaction) {
    if (!this.coordinator) return;
    this.handlePointerDown(interaction, this.coordinator.viewModel, this.coordinator.view);
  }
  
  onMouseMove(interaction) {
    if (!this.coordinator) return;
    this.handlePointerMove(interaction, this.coordinator.viewModel, this.coordinator.view);
  }
  
  onMouseUp(interaction) {
    if (!this.coordinator) return;
    this.handlePointerUp(interaction, this.coordinator.viewModel, this.coordinator.view);
  }
  
  onDoubleClick(interaction) {
    if (!this.coordinator) return;
    this.handleDoubleClick(interaction, this.coordinator.viewModel, this.coordinator.view);
  }
  
  onKeyDown(interaction) {
    if (!this.coordinator) return;
    this.handleKeyDown(interaction, this.coordinator.viewModel, this.coordinator.view);
  }
  
  // Tool interface methods for testing
  handleEvent(event) {
    if (!this.coordinator) return;
    
    const viewModel = this.coordinator.viewModel;
    const view = this.coordinator.view;
    
    switch (event.type) {
      case 'pointerdown':
        this.handlePointerDown(event, viewModel, view);
        break;
      case 'pointermove':
        this.handlePointerMove(event, viewModel, view);
        break;
      case 'pointerup':
        this.handlePointerUp(event, viewModel, view);
        break;
      case 'doubleclick':
        this.handleDoubleClick(event, viewModel, view);
        break;
      case 'keydown':
        this.handleKeyDown(event, viewModel, view);
        break;
    }
  }
  
  handlePointerDown(event, viewModel, view) {
    const position = event.position;
    const node = viewModel.getNodeAtPosition(position);
    
    if (node && node.getId() !== 'root') {
      if (!this.sourceNode) {
        // Start connection
        this.sourceNode = node;
        this.isConnecting = true;
        
        // Visual feedback
        viewModel.selectNode(node.getId());
        
        // Start connection preview
        const nodePos = node.getPosition();
        viewModel.startConnectionPreview(node, nodePos);
        
        // Update cursor
        view.getContainer().style.cursor = 'crosshair';
      } else if (node.getId() !== this.sourceNode.getId()) {
        // Complete connection
        const sourceId = this.sourceNode.getId();
        const targetId = node.getId();
        
        // Check if edge already exists
        const existingEdge = viewModel.getModel().getEdges().find(edge => 
          edge.getSource() === sourceId && edge.getTarget() === targetId
        );
        
        if (!existingEdge) {
          // Create edge using command
          viewModel.executeCommandType('connectNodes', {
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            edgeData: {
              id: `edge-${Date.now()}`,
              directed: true
            }
          });
        }
        
        // Reset
        this.reset();
        viewModel.clearSelection();
        view.getContainer().style.cursor = 'default';
      }
    } else {
      // Clicked on empty space - cancel connection
      this.reset();
      viewModel.clearSelection();
      view.getContainer().style.cursor = 'default';
    }
  }
  
  handlePointerMove(event, viewModel, view) {
    if (this.isConnecting) {
      // Update connection preview with graph coordinates
      const viewport = view.getViewport();
      const graphPos = viewport.screenToGraph(event.position);
      viewModel.updateConnectionPreview(graphPos);
    }
  }
  
  handlePointerUp(event, viewModel, view) {
    // Connection is completed in handlePointerDown
  }
  
  handleDoubleClick(event, viewModel, view) {
    // No special double-click behavior
  }
  
  handleKeyDown(event, viewModel, view) {
    if (event.key === 'Escape') {
      this.reset();
      viewModel.clearSelection();
      view.getContainer().style.cursor = 'default';
    }
  }
}