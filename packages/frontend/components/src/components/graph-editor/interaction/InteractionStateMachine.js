/**
 * InteractionStateMachine - Handles user interaction state tracking
 * 
 * Manages mouse/touch events and determines interaction types (click, drag, etc.)
 */

export class InteractionStateMachine {
  constructor() {
    this.state = 'idle';
    this.lastAction = null;
    this.mouseDownData = null;
    this.dragData = null;
    this.clickData = null;
    this.touchData = null;
    this.interactionHistory = [];
    this.statistics = {
      totalInteractions: 0,
      clickCount: 0,
      rightClickCount: 0,
      middleClickCount: 0,
      dragCount: 0,
      doubleClickCount: 0
    };
    
    // Configuration
    this.dragThreshold = 5; // pixels
    this.doubleClickThreshold = 500; // milliseconds
    this.lastClickTime = 0;
    this.lastClickPosition = null;
  }

  getState() {
    return this.state;
  }

  getLastAction() {
    return this.lastAction;
  }

  setDragThreshold(threshold) {
    this.dragThreshold = threshold;
  }

  setDoubleClickThreshold(threshold) {
    this.doubleClickThreshold = threshold;
  }

  handleMouseDown(position, button, node, modifiers = {}) {
    if (this.state !== 'idle') {
      return;
    }

    const timestamp = Date.now();
    
    this.mouseDownData = {
      position,
      button,
      node,
      timestamp,
      modifiers
    };
    
    this.state = 'mouseDown';
    this.lastAction = 'mouseDown';
    
    this._recordInteraction('mouseDown', {
      position,
      button,
      node,
      timestamp,
      modifiers
    });
  }

  handleMouseMove(position) {
    if (this.state === 'idle') {
      return;
    }

    if (this.state === 'mouseDown') {
      const distance = this._calculateDistance(
        this.mouseDownData.position,
        position
      );

      if (distance > this.dragThreshold) {
        this.state = 'dragging';
        this.lastAction = 'dragStart';
        
        this.dragData = {
          startPosition: this.mouseDownData.position,
          currentPosition: position,
          delta: {
            x: position.x - this.mouseDownData.position.x,
            y: position.y - this.mouseDownData.position.y
          },
          distance,
          node: this.mouseDownData.node,
          button: this.mouseDownData.button,
          modifiers: this.mouseDownData.modifiers
        };
        
        this._recordInteraction('dragStart', this.dragData);
        this.statistics.dragCount++;
      }
    } else if (this.state === 'dragging') {
      this.lastAction = 'drag';
      
      this.dragData.currentPosition = position;
      this.dragData.delta = {
        x: position.x - this.dragData.startPosition.x,
        y: position.y - this.dragData.startPosition.y
      };
      this.dragData.distance = this._calculateDistance(
        this.dragData.startPosition,
        position
      );
      
      this._recordInteraction('drag', {
        position,
        delta: this.dragData.delta,
        distance: this.dragData.distance
      });
    } else if (this.state === 'touching') {
      const distance = this._calculateDistance(
        this.touchData.startPosition,
        position
      );

      if (distance > this.dragThreshold) {
        this.state = 'dragging';
        this.lastAction = 'dragStart';
        
        this.dragData = {
          startPosition: this.touchData.startPosition,
          currentPosition: position,
          delta: {
            x: position.x - this.touchData.startPosition.x,
            y: position.y - this.touchData.startPosition.y
          },
          distance,
          node: this.touchData.node,
          isTouchDrag: true
        };
        
        this._recordInteraction('dragStart', this.dragData);
        this.statistics.dragCount++;
      }
    }
  }

  handleMouseUp(position) {
    if (this.state === 'idle') {
      return;
    }

    const timestamp = Date.now();
    
    if (this.state === 'mouseDown') {
      // This is a click
      const duration = timestamp - this.mouseDownData.timestamp;
      const isDoubleClick = this._checkDoubleClick(position, timestamp);
      
      let actionType = 'click';
      if (this.mouseDownData.button === 2) {
        actionType = 'rightClick';
        this.statistics.rightClickCount++;
      } else if (this.mouseDownData.button === 1) {
        actionType = 'middleClick';
        this.statistics.middleClickCount++;
      } else {
        this.statistics.clickCount++;
      }
      
      if (this.mouseDownData.node === null) {
        actionType = 'backgroundClick';
      }
      
      this.lastAction = actionType;
      
      this.clickData = {
        position,
        button: this.mouseDownData.button,
        node: this.mouseDownData.node,
        duration,
        isDoubleClick,
        modifiers: this.mouseDownData.modifiers
      };
      
      if (isDoubleClick) {
        this.statistics.doubleClickCount++;
      }
      
      this._recordInteraction(actionType, this.clickData);
      
    } else if (this.state === 'dragging') {
      // End drag
      this.lastAction = 'dragEnd';
      
      this.dragData.endPosition = position;
      this.dragData.duration = timestamp - this.mouseDownData.timestamp;
      
      this._recordInteraction('dragEnd', {
        endPosition: position,
        totalDelta: this.dragData.delta,
        totalDistance: this.dragData.distance,
        duration: this.dragData.duration
      });
    }
    
    this.state = 'idle';
    this.statistics.totalInteractions++;
  }

  handleTouchStart(position, node) {
    if (this.state === 'idle') {
      this.state = 'touching';
      this.touchData = {
        startPosition: position,
        node,
        touchCount: 1,
        timestamp: Date.now()
      };
      this._recordInteraction('touchStart', this.touchData);
    } else if (this.state === 'touching') {
      this.state = 'multiTouch';
      this.touchData.touchCount++;
      this._recordInteraction('multiTouchStart', this.touchData);
    }
  }

  handleTouchMove(position) {
    this.handleMouseMove(position);
  }

  handleTouchEnd(position) {
    if (this.state === 'touching') {
      // Touch tap
      this.lastAction = 'tap';
      this.clickData = {
        position,
        node: this.touchData.node,
        duration: Date.now() - this.touchData.timestamp,
        isTouch: true
      };
      this._recordInteraction('tap', this.clickData);
      this.statistics.clickCount++;
    } else if (this.state === 'dragging' && this.dragData && this.dragData.isTouchDrag) {
      // End touch drag
      this.lastAction = 'dragEnd';
      this.dragData.endPosition = position;
      this.dragData.duration = Date.now() - this.touchData.timestamp;
      this._recordInteraction('dragEnd', this.dragData);
    }
    
    this.state = 'idle';
    this.touchData = null;
    this.statistics.totalInteractions++;
  }

  _checkDoubleClick(position, timestamp) {
    const timeDiff = timestamp - this.lastClickTime;
    const positionDiff = this.lastClickPosition 
      ? this._calculateDistance(this.lastClickPosition, position)
      : Infinity;
    
    const isDoubleClick = timeDiff < this.doubleClickThreshold && positionDiff < this.dragThreshold;
    
    this.lastClickTime = timestamp;
    this.lastClickPosition = position;
    
    return isDoubleClick;
  }

  _calculateDistance(pos1, pos2) {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _recordInteraction(action, data) {
    this.interactionHistory.push({
      action,
      data,
      timestamp: Date.now(),
      state: this.state
    });
    
    // Keep history limited to last 100 interactions
    if (this.interactionHistory.length > 100) {
      this.interactionHistory = this.interactionHistory.slice(-100);
    }
  }

  getMouseDownData() {
    return this.mouseDownData;
  }

  getDragData() {
    return this.dragData;
  }

  getClickData() {
    return this.clickData;
  }

  getTouchData() {
    return this.touchData;
  }

  getStatistics() {
    return { ...this.statistics };
  }

  getInteractionHistory() {
    return [...this.interactionHistory];
  }

  reset() {
    this.state = 'idle';
    this.lastAction = null;
    this.mouseDownData = null;
    this.dragData = null;
    this.clickData = null;
    this.touchData = null;
  }
}