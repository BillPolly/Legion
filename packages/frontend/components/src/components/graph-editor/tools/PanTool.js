/**
 * PanTool - Tool for panning the viewport
 */

import { Tool } from './Tool.js';

export class PanTool extends Tool {
  constructor(config = {}) {
    super('pan', {
      cursor: 'grab',
      ...config
    });
    
    this.isPanning = false;
    this.panStartPosition = null;
    this.viewStartPosition = null;
  }

  // Tool lifecycle
  onActivate() {
    // Update cursor
    const view = this.getView();
    if (view) {
      view.setCursor(this.cursor);
    }
  }

  onDeactivate() {
    // Reset cursor
    const view = this.getView();
    if (view) {
      view.setCursor('default');
    }
    
    this.isPanning = false;
    this.panStartPosition = null;
    this.viewStartPosition = null;
  }

  // Interaction handlers
  onDragStart(interaction) {
    const { dragData } = interaction;
    const view = this.getView();
    const viewModel = this.getViewModel();
    
    if (view && viewModel && dragData) {
      this.isPanning = true;
      this.panStartPosition = dragData.startPosition;
      this.viewStartPosition = view.getViewport().getPan();
      
      // Update cursor to grabbing
      view.setCursor('grabbing');
      
      // Apply initial pan offset
      const deltaX = dragData.delta.x;
      const deltaY = dragData.delta.y;
      
      const viewViewport = view.getViewport();
      viewViewport.setPan(
        this.viewStartPosition.x + deltaX,
        this.viewStartPosition.y + deltaY
      );
      
      // Update ViewModel state to match View
      const newPan = viewViewport.getPan();
      viewModel.viewport.pan = { x: newPan.x, y: newPan.y };
      
      // Request render
      view.requestRender();
      
    }
  }

  onDrag(interaction) {
    if (!this.isPanning) return;
    
    const { dragData } = interaction;
    const view = this.getView();
    const viewModel = this.getViewModel();
    
    if (view && viewModel && dragData && this.viewStartPosition) {
      // Use the delta from the InteractionStateMachine
      const deltaX = dragData.delta.x;
      const deltaY = dragData.delta.y;
      
      // Apply pan directly to view viewport
      const viewViewport = view.getViewport();
      viewViewport.setPan(
        this.viewStartPosition.x + deltaX,
        this.viewStartPosition.y + deltaY
      );
      
      // Update ViewModel state to match View
      const newPan = viewViewport.getPan();
      viewModel.viewport.pan = { x: newPan.x, y: newPan.y };
      
      // Request render
      view.requestRender();
      
    }
  }

  onDragEnd(interaction) {
    if (this.isPanning) {
      this.isPanning = false;
      this.panStartPosition = null;
      this.viewStartPosition = null;
      
      // Reset cursor
      const view = this.getView();
      if (view) {
        view.setCursor(this.cursor);
      }
    }
  }

  // Handle mouse wheel for zoom
  onWheel(interaction) {
    const { screenPosition, deltaY, modifiers } = interaction;
    const view = this.getView();
    const viewModel = this.getViewModel();
    
    if (view && viewModel) {
      const viewViewport = view.getViewport();
      
      // Calculate zoom factor (negative deltaY means zoom in)
      const zoomSpeed = 0.001;
      const scaleFactor = 1 - deltaY * zoomSpeed;
      
      // Apply zoom at mouse position
      const success = viewViewport.zoom(scaleFactor, screenPosition);
      
      if (success) {
        // Update ViewModel state to match View
        const newZoom = viewViewport.getZoom();
        const newPan = viewViewport.getPan();
        
        // Update ViewModel without triggering view update
        viewModel.viewport.zoom = newZoom;
        viewModel.viewport.pan = { x: newPan.x, y: newPan.y };
        
        // Request render
        view.requestRender();
      }
    }
  }
}