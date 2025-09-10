/**
 * InteractionStateMachine - Manages complex interaction states for DiagramView
 * Provides clean state transitions between idle, panning, drag selection, and node dragging
 */

/**
 * Interaction states
 */
export const InteractionState = {
  IDLE: 'IDLE',
  PANNING: 'PANNING',
  DRAG_SELECTING: 'DRAG_SELECTING',
  DRAGGING_NODE: 'DRAGGING_NODE',
  HOVER: 'HOVER'
};

/**
 * Interaction events that can trigger state transitions
 */
export const InteractionEvent = {
  MOUSE_DOWN_BACKGROUND: 'MOUSE_DOWN_BACKGROUND',
  MOUSE_DOWN_NODE: 'MOUSE_DOWN_NODE',
  MOUSE_MOVE: 'MOUSE_MOVE',
  MOUSE_UP: 'MOUSE_UP',
  MOUSE_LEAVE: 'MOUSE_LEAVE',
  KEY_ESCAPE: 'KEY_ESCAPE',
  THRESHOLD_EXCEEDED: 'THRESHOLD_EXCEEDED'
};

/**
 * State machine for managing diagram interactions
 */
export class InteractionStateMachine {
  constructor(options = {}) {
    this.currentState = InteractionState.IDLE;
    this.previousState = null;
    
    // Configuration
    this.config = {
      dragThreshold: options.dragThreshold || 5,
      enablePan: options.enablePan !== false,
      enableDragSelection: options.enableDragSelection !== false,
      enableNodeDragging: options.enableNodeDragging !== false,
      ...options
    };
    
    // State data
    this.stateData = {
      startPoint: null,
      currentPoint: null,
      targetElement: null,
      mouseDown: false
    };
    
    // Event listeners
    this.listeners = new Map();
    
    // State transition map
    this.transitions = this._createTransitionMap();
  }

  /**
   * Creates the state transition map
   * Defines which states can transition to which other states on which events
   */
  _createTransitionMap() {
    return new Map([
      // FROM IDLE STATE
      [`${InteractionState.IDLE}-${InteractionEvent.MOUSE_DOWN_BACKGROUND}`, {
        nextState: InteractionState.IDLE, // Stay idle until we decide
        action: 'handlePotentialStart'
      }],
      [`${InteractionState.IDLE}-${InteractionEvent.MOUSE_DOWN_NODE}`, {
        nextState: this.config.enableNodeDragging ? InteractionState.IDLE : null,
        action: 'handleNodeMouseDown'
      }],
      [`${InteractionState.IDLE}-${InteractionEvent.MOUSE_MOVE}`, {
        nextState: InteractionState.HOVER,
        action: 'handleHover'
      }],
      [`${InteractionState.IDLE}-${InteractionEvent.THRESHOLD_EXCEEDED}`, {
        nextState: null, // Decided in action
        action: 'decideInteractionMode'
      }],

      // FROM HOVER STATE
      [`${InteractionState.HOVER}-${InteractionEvent.MOUSE_DOWN_BACKGROUND}`, {
        nextState: InteractionState.IDLE,
        action: 'handlePotentialStart'
      }],
      [`${InteractionState.HOVER}-${InteractionEvent.MOUSE_DOWN_NODE}`, {
        nextState: InteractionState.IDLE,
        action: 'handleNodeMouseDown'
      }],
      [`${InteractionState.HOVER}-${InteractionEvent.MOUSE_MOVE}`, {
        nextState: InteractionState.HOVER,
        action: 'handleHover'
      }],

      // FROM PANNING STATE
      [`${InteractionState.PANNING}-${InteractionEvent.MOUSE_MOVE}`, {
        nextState: InteractionState.PANNING,
        action: 'updatePanning'
      }],
      [`${InteractionState.PANNING}-${InteractionEvent.MOUSE_UP}`, {
        nextState: InteractionState.IDLE,
        action: 'completePanning'
      }],
      [`${InteractionState.PANNING}-${InteractionEvent.MOUSE_LEAVE}`, {
        nextState: InteractionState.IDLE,
        action: 'cancelPanning'
      }],
      [`${InteractionState.PANNING}-${InteractionEvent.KEY_ESCAPE}`, {
        nextState: InteractionState.IDLE,
        action: 'cancelPanning'
      }],

      // FROM DRAG_SELECTING STATE
      [`${InteractionState.DRAG_SELECTING}-${InteractionEvent.MOUSE_MOVE}`, {
        nextState: InteractionState.DRAG_SELECTING,
        action: 'updateDragSelection'
      }],
      [`${InteractionState.DRAG_SELECTING}-${InteractionEvent.MOUSE_UP}`, {
        nextState: InteractionState.IDLE,
        action: 'completeDragSelection'
      }],
      [`${InteractionState.DRAG_SELECTING}-${InteractionEvent.MOUSE_LEAVE}`, {
        nextState: InteractionState.IDLE,
        action: 'cancelDragSelection'
      }],
      [`${InteractionState.DRAG_SELECTING}-${InteractionEvent.KEY_ESCAPE}`, {
        nextState: InteractionState.IDLE,
        action: 'cancelDragSelection'
      }],

      // FROM DRAGGING_NODE STATE
      [`${InteractionState.DRAGGING_NODE}-${InteractionEvent.MOUSE_MOVE}`, {
        nextState: InteractionState.DRAGGING_NODE,
        action: 'updateNodeDragging'
      }],
      [`${InteractionState.DRAGGING_NODE}-${InteractionEvent.MOUSE_UP}`, {
        nextState: InteractionState.IDLE,
        action: 'completeNodeDragging'
      }],
      [`${InteractionState.DRAGGING_NODE}-${InteractionEvent.MOUSE_LEAVE}`, {
        nextState: InteractionState.IDLE,
        action: 'cancelNodeDragging'
      }],
      [`${InteractionState.DRAGGING_NODE}-${InteractionEvent.KEY_ESCAPE}`, {
        nextState: InteractionState.IDLE,
        action: 'cancelNodeDragging'
      }]
    ]);
  }

  /**
   * Process an event through the state machine
   */
  handleEvent(eventType, eventData = {}) {
    const transitionKey = `${this.currentState}-${eventType}`;
    const transition = this.transitions.get(transitionKey);

    if (!transition) {
      // No valid transition - ignore event
      return false;
    }

    // Store previous state
    this.previousState = this.currentState;

    // Execute action if defined
    let nextState = transition.nextState;
    if (transition.action && this[transition.action]) {
      const actionResult = this[transition.action](eventData);
      // Action can override next state
      if (actionResult && actionResult.nextState) {
        nextState = actionResult.nextState;
      }
    }

    // Transition to next state
    if (nextState !== null) {
      this._transitionTo(nextState);
    }

    return true;
  }

  /**
   * Transition to a new state
   */
  _transitionTo(newState) {
    const oldState = this.currentState;
    this.currentState = newState;
    
    // Emit state change event
    this._emit('stateChange', {
      fromState: oldState,
      toState: newState,
      stateData: { ...this.stateData }
    });
  }

  // ===================
  // ACTION HANDLERS
  // ===================

  handlePotentialStart(eventData) {
    this.stateData.startPoint = { x: eventData.clientX, y: eventData.clientY };
    this.stateData.mouseDown = true;
    this.stateData.targetElement = eventData.elementInfo;
    
    this._emit('potentialStartDetected', {
      point: this.stateData.startPoint,
      elementInfo: eventData.elementInfo
    });
  }

  handleNodeMouseDown(eventData) {
    if (this.config.enableNodeDragging) {
      this.stateData.startPoint = { x: eventData.clientX, y: eventData.clientY };
      this.stateData.targetElement = eventData.elementInfo;
      this.stateData.mouseDown = true;
      
      this._emit('nodeMouseDown', {
        nodeId: eventData.elementInfo.id,
        point: this.stateData.startPoint
      });
    }
  }

  handleHover(eventData) {
    this._emit('hover', {
      point: { x: eventData.clientX, y: eventData.clientY },
      elementInfo: eventData.elementInfo
    });

    // Check if we should trigger threshold decision
    if (this.stateData.mouseDown && this.stateData.startPoint) {
      const dx = Math.abs(eventData.clientX - this.stateData.startPoint.x);
      const dy = Math.abs(eventData.clientY - this.stateData.startPoint.y);
      
      if (dx > this.config.dragThreshold || dy > this.config.dragThreshold) {
        // Trigger threshold exceeded - call the decision method directly and transition
        const result = this.decideInteractionMode(eventData);
        if (result && result.nextState) {
          this._transitionTo(result.nextState);
          return result;
        }
      }
    }
  }

  decideInteractionMode(eventData) {
    const elementInfo = this.stateData.targetElement;
    
    // Decision logic based on element type and configuration
    if (elementInfo.type === 'node' && this.config.enableNodeDragging) {
      this._emit('startNodeDragging', {
        nodeId: elementInfo.id,
        startPoint: this.stateData.startPoint,
        currentPoint: { x: eventData.clientX, y: eventData.clientY }
      });
      return { nextState: InteractionState.DRAGGING_NODE };
      
    } else if (elementInfo.type === 'background') {
      // Prefer drag selection over panning if both are enabled
      if (this.config.enableDragSelection) {
        this._emit('startDragSelection', {
          startPoint: this.stateData.startPoint,
          currentPoint: { x: eventData.clientX, y: eventData.clientY }
        });
        return { nextState: InteractionState.DRAG_SELECTING };
        
      } else if (this.config.enablePan) {
        this._emit('startPanning', {
          startPoint: this.stateData.startPoint,
          currentPoint: { x: eventData.clientX, y: eventData.clientY }
        });
        return { nextState: InteractionState.PANNING };
      }
    }
    
    return { nextState: InteractionState.IDLE };
  }

  updatePanning(eventData) {
    this.stateData.currentPoint = { x: eventData.clientX, y: eventData.clientY };
    
    this._emit('updatePanning', {
      startPoint: this.stateData.startPoint,
      currentPoint: this.stateData.currentPoint,
      delta: {
        x: this.stateData.currentPoint.x - this.stateData.startPoint.x,
        y: this.stateData.currentPoint.y - this.stateData.startPoint.y
      }
    });
  }

  completePanning(eventData) {
    this._emit('completePanning', {
      startPoint: this.stateData.startPoint,
      endPoint: { x: eventData.clientX, y: eventData.clientY }
    });
    this._resetStateData();
  }

  cancelPanning() {
    this._emit('cancelPanning', {
      startPoint: this.stateData.startPoint
    });
    this._resetStateData();
  }

  updateDragSelection(eventData) {
    this.stateData.currentPoint = { x: eventData.clientX, y: eventData.clientY };
    
    this._emit('updateDragSelection', {
      startPoint: this.stateData.startPoint,
      currentPoint: this.stateData.currentPoint
    });
  }

  completeDragSelection(eventData) {
    this._emit('completeDragSelection', {
      startPoint: this.stateData.startPoint,
      endPoint: { x: eventData.clientX, y: eventData.clientY },
      modifiers: {
        ctrl: eventData.ctrlKey,
        alt: eventData.altKey,
        shift: eventData.shiftKey
      }
    });
    this._resetStateData();
  }

  cancelDragSelection() {
    this._emit('cancelDragSelection', {
      startPoint: this.stateData.startPoint
    });
    this._resetStateData();
  }

  updateNodeDragging(eventData) {
    this.stateData.currentPoint = { x: eventData.clientX, y: eventData.clientY };
    
    this._emit('updateNodeDragging', {
      nodeId: this.stateData.targetElement.id,
      startPoint: this.stateData.startPoint,
      currentPoint: this.stateData.currentPoint,
      delta: {
        x: this.stateData.currentPoint.x - this.stateData.startPoint.x,
        y: this.stateData.currentPoint.y - this.stateData.startPoint.y
      }
    });
  }

  completeNodeDragging(eventData) {
    this._emit('completeNodeDragging', {
      nodeId: this.stateData.targetElement.id,
      startPoint: this.stateData.startPoint,
      endPoint: { x: eventData.clientX, y: eventData.clientY }
    });
    this._resetStateData();
  }

  cancelNodeDragging() {
    this._emit('cancelNodeDragging', {
      nodeId: this.stateData.targetElement.id,
      startPoint: this.stateData.startPoint
    });
    this._resetStateData();
  }

  // ===================
  // UTILITY METHODS
  // ===================

  _resetStateData() {
    this.stateData = {
      startPoint: null,
      currentPoint: null,
      targetElement: null,
      mouseDown: false
    };
  }

  /**
   * Get current state
   */
  getState() {
    return this.currentState;
  }

  /**
   * Check if in a specific state
   */
  isInState(state) {
    return this.currentState === state;
  }

  /**
   * Get state data
   */
  getStateData() {
    return { ...this.stateData };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Reset to idle state
   */
  reset() {
    this.currentState = InteractionState.IDLE;
    this.previousState = null;
    this._resetStateData();
    this._emit('reset');
  }

  // ===================
  // EVENT EMITTER
  // ===================

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
  }

  off(eventType, handler) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(handler);
    }
  }

  _emit(eventType, data) {
    if (this.listeners.has(eventType)) {
      for (const handler of this.listeners.get(eventType)) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.listeners.clear();
    this._resetStateData();
    this.currentState = InteractionState.IDLE;
  }
}