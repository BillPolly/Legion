/**
 * EventCoordinator - Coordinates events between View, InteractionStateMachine, and Tools
 * 
 * Bridges raw DOM events to high-level interaction events for tools
 */

import { InteractionStateMachine } from './InteractionStateMachine.js';

export class EventCoordinator {
  constructor(view, viewModel) {
    this.view = view;
    this.viewModel = viewModel;
    this.stateMachine = new InteractionStateMachine();

    // Tool registry
    this.tools = new Map();
    this.activeTool = null;

    // Event listeners
    this.listeners = {
      interaction: [],
      toolChange: []
    };

    // Pan state (for middle-button or space+drag pan)
    this.panState = {
      active: false,
      startPosition: null,
      startViewportPan: null
    };

    // Setup view event listeners
    this._setupEventListeners();
  }

  /**
   * Register a tool
   */
  registerTool(name, tool) {
    this.tools.set(name, tool);
    tool.coordinator = this;
  }

  /**
   * Get registered tool
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Set active tool
   */
  setActiveTool(name) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not registered`);
    }
    
    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    
    // Activate new tool
    this.activeTool = tool;
    this.activeTool.activate();
    
    // Notify listeners
    this._notifyToolChange(name, tool);
  }

  /**
   * Get active tool
   */
  getActiveTool() {
    return this.activeTool;
  }

  /**
   * Add interaction listener
   */
  onInteraction(listener) {
    this.listeners.interaction.push(listener);
  }

  /**
   * Remove interaction listener
   */
  offInteraction(listener) {
    const index = this.listeners.interaction.indexOf(listener);
    if (index !== -1) {
      this.listeners.interaction.splice(index, 1);
    }
  }

  /**
   * Add tool change listener
   */
  onToolChange(listener) {
    this.listeners.toolChange.push(listener);
  }

  /**
   * Remove tool change listener
   */
  offToolChange(listener) {
    const index = this.listeners.toolChange.indexOf(listener);
    if (index !== -1) {
      this.listeners.toolChange.splice(index, 1);
    }
  }

  /**
   * Get interaction state machine
   */
  getStateMachine() {
    return this.stateMachine;
  }

  /**
   * Setup event listeners
   * @private
   */
  _setupEventListeners() {
    // Listen to view events
    this.view.onEvent((event) => {
      this._handleViewEvent(event);
    });
  }

  /**
   * Handle view event
   * @private
   */
  _handleViewEvent(event) {
    // Find what element is under the cursor
    const hitResult = this._performHitTest(event.screenPosition);

    // Check for background drag pan (dragging on empty space or SVG background)
    const isBackground = !hitResult || (hitResult && hitResult.type === 'background');
    if (event.type === 'mousedown' && isBackground && event.button === 0) {
      this._startPan(event);
      return; // Don't process as normal interaction
    }

    // Handle pan drag
    if (event.type === 'mousemove' && this.panState.active) {
      this._updatePan(event);
      return; // Don't process as normal interaction
    }

    // Handle pan end
    if (event.type === 'mouseup' && this.panState.active) {
      this._endPan();
      return; // Don't process as normal interaction
    }

    // Update hover state for mousemove events
    if (event.type === 'mousemove') {
      this._updateHoverState(hitResult);
    }

    // Update state machine based on event type
    switch (event.type) {
      case 'mousedown':
        this.stateMachine.handleMouseDown(
          event.position,
          event.button,
          hitResult ? hitResult.element : null,
          event.modifiers
        );
        break;

      case 'mousemove':
        this.stateMachine.handleMouseMove(event.position);
        break;

      case 'mouseup':
        this.stateMachine.handleMouseUp(event.position);
        break;

      case 'touchstart':
        this.stateMachine.handleTouchStart(
          event.position,
          hitResult ? hitResult.element : null
        );
        break;

      case 'touchmove':
        this.stateMachine.handleTouchMove(event.position);
        break;

      case 'touchend':
        this.stateMachine.handleTouchEnd(event.position);
        break;

      case 'wheel':
        // Wheel events don't need state machine processing
        // Handle zoom directly
        this._handleWheelZoom(event);
        break;
    }

    // Create interaction event
    const interaction = this._createInteractionEvent(event, hitResult);

    // Notify listeners
    this._notifyInteraction(interaction);

    // Let active tool handle the interaction
    if (this.activeTool) {
      this.activeTool.handleInteraction(interaction);
    }
  }

  /**
   * Start panning
   * @private
   */
  _startPan(event) {
    const viewport = this.view.getViewport();
    if (!viewport) return;

    this.panState.active = true;
    this.panState.startPosition = { ...event.screenPosition };
    this.panState.startViewportPan = viewport.getPan();

    // Change cursor to indicate panning
    this.view.setCursor('grabbing');
  }

  /**
   * Update pan position
   * @private
   */
  _updatePan(event) {
    const viewport = this.view.getViewport();
    if (!viewport || !this.panState.active) return;

    // Calculate delta from start position
    const dx = event.screenPosition.x - this.panState.startPosition.x;
    const dy = event.screenPosition.y - this.panState.startPosition.y;

    // Update viewport pan
    viewport.setPan(
      this.panState.startViewportPan.x + dx,
      this.panState.startViewportPan.y + dy
    );

    this.view.requestRender();
  }

  /**
   * End panning
   * @private
   */
  _endPan() {
    this.panState.active = false;
    this.panState.startPosition = null;
    this.panState.startViewportPan = null;

    // Restore cursor
    this.view.setCursor('default');
  }

  /**
   * Handle wheel zoom
   * @private
   */
  _handleWheelZoom(event) {
    const viewport = this.view.getViewport();
    if (!viewport) return;

    // Calculate zoom factor from wheel delta
    // Negative deltaY = zoom in, positive = zoom out
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

    // Zoom at mouse position
    const applied = viewport.zoom(zoomFactor, event.screenPosition);

    if (applied) {
      this.view.requestRender();
    }
  }

  /**
   * Perform hit test
   * @private
   */
  _performHitTest(screenPosition) {
    const renderer = this.view.getRenderer();
    if (!renderer) return null;
    
    // Convert to container coordinates
    const rect = this.view.getContainer().getBoundingClientRect();
    const x = screenPosition.x;
    const y = screenPosition.y;
    
    // Use renderer's hit testing
    return renderer.getElementAt(x, y);
  }

  /**
   * Create interaction event
   * @private
   */
  _createInteractionEvent(viewEvent, hitResult) {
    const state = this.stateMachine.getState();
    const action = this.stateMachine.getLastAction();
    
    return {
      // Original event data
      type: viewEvent.type,
      position: viewEvent.position,
      screenPosition: viewEvent.screenPosition,
      button: viewEvent.button,
      buttons: viewEvent.buttons,
      modifiers: viewEvent.modifiers,
      originalEvent: viewEvent.originalEvent,
      
      // Hit test result
      target: hitResult ? hitResult.element : null,
      targetType: hitResult ? hitResult.type : null,
      
      // State machine data
      state: state,
      action: action,
      
      // Interaction-specific data
      clickData: this.stateMachine.getClickData(),
      dragData: this.stateMachine.getDragData(),
      touchData: this.stateMachine.getTouchData(),
      
      // Helper methods
      isClick: () => action === 'click',
      isRightClick: () => action === 'rightClick',
      isDoubleClick: () => action === 'click' && this.stateMachine.getClickData()?.isDoubleClick,
      isDragStart: () => action === 'dragStart',
      isDragging: () => state === 'dragging',
      isDragEnd: () => action === 'dragEnd',
      isBackgroundClick: () => action === 'backgroundClick'
    };
  }

  /**
   * Notify interaction listeners
   * @private
   */
  _notifyInteraction(interaction) {
    this.listeners.interaction.forEach(listener => listener(interaction));
  }

  /**
   * Notify tool change listeners
   * @private
   */
  _notifyToolChange(name, tool) {
    this.listeners.toolChange.forEach(listener => listener(name, tool));
  }

  /**
   * Update hover state based on hit test result
   * @private
   */
  _updateHoverState(hitResult) {
    if (hitResult && hitResult.element) {
      // Something is hovered
      this.viewModel.setHoveredElement(hitResult.element, hitResult.type);
    } else {
      // Nothing is hovered
      this.viewModel.clearHover();
    }
  }

  /**
   * Destroy and clean up
   */
  destroy() {
    // Deactivate current tool
    if (this.activeTool) {
      this.activeTool.deactivate();
    }
    
    // Clear listeners
    this.listeners.interaction = [];
    this.listeners.toolChange = [];
    
    // Clear tools
    this.tools.clear();
    
    // Reset state machine
    this.stateMachine.reset();
  }
}