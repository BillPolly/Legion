/**
 * InteractionManager - Handles user interactions, event delegation, and keyboard navigation
 */

export class InteractionManager {
  constructor(treeView, nodeRenderer) {
    if (!treeView) {
      throw new Error('TreeView is required');
    }
    
    if (!nodeRenderer) {
      throw new Error('NodeRenderer is required');
    }

    this.treeView = treeView;
    this.nodeRenderer = nodeRenderer;
    this.destroyed = false;
    
    this.focusedNodeId = null;
    this.eventListeners = new Map(); // eventType -> [callbacks]
    this.domEventListeners = new Map(); // eventType -> handler function
    this.nodeRendererSubscriptions = [];

    // Navigation key mappings
    this.navigationKeys = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Home', 'End', 'PageUp', 'PageDown',
      'Enter', ' ' // Space
    ]);

    this._initializeEventDelegation();
    this._subscribeToNodeRenderer();
  }

  /**
   * Initialize event delegation on the tree container
   * @private
   */
  _initializeEventDelegation() {
    const container = this.treeView.container;
    
    // Click handler for node toggles and general interactions
    const clickHandler = this._handleClick.bind(this);
    container.addEventListener('click', clickHandler);
    this.domEventListeners.set('click', clickHandler);

    // Keyboard navigation handler
    const keydownHandler = this._handleKeydown.bind(this);
    container.addEventListener('keydown', keydownHandler);
    this.domEventListeners.set('keydown', keydownHandler);

    // Focus management
    const focusHandler = this._handleFocus.bind(this);
    container.addEventListener('focus', focusHandler, true); // Use capture
    this.domEventListeners.set('focus', focusHandler);

    const blurHandler = this._handleBlur.bind(this);
    container.addEventListener('blur', blurHandler, true); // Use capture
    this.domEventListeners.set('blur', blurHandler);
  }

  /**
   * Subscribe to node renderer events
   * @private
   */
  _subscribeToNodeRenderer() {
    // Handle node toggle events from renderer
    const toggleSubscription = this.nodeRenderer.on('nodeToggle', (data) => {
      this._emit('nodeToggle', {
        ...data,
        source: 'renderer'
      });
    });
    this.nodeRendererSubscriptions.push(toggleSubscription);

    // Handle content interaction events
    const contentSubscription = this.nodeRenderer.on('contentInteraction', (data) => {
      this._emit('contentInteraction', data);
    });
    this.nodeRendererSubscriptions.push(contentSubscription);
  }

  /**
   * Handle click events
   * @private
   */
  _handleClick(event) {
    if (this.destroyed) return;

    const target = event.target;
    const nodeElement = this._findNodeElement(target);
    
    if (!nodeElement) return;

    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;

    // Handle toggle button clicks
    if (target.classList.contains('node-toggle')) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      
      this._emit('nodeToggle', {
        nodeId,
        action: 'toggle',
        source: 'click'
      });
      return;
    }

    // Handle general node clicks
    this._emit('nodeClick', {
      nodeId,
      target: target.className,
      event
    });
  }

  /**
   * Handle keyboard events
   * @private
   */
  _handleKeydown(event) {
    if (this.destroyed) return;

    const target = event.target;
    const nodeElement = this._findNodeElement(target);
    
    if (!nodeElement) return;

    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;

    const key = event.key;

    // Handle navigation keys
    if (this.navigationKeys.has(key)) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();

      // Handle toggle keys (Enter and Space)
      if (key === 'Enter' || key === ' ') {
        this._emit('nodeToggle', {
          nodeId,
          action: 'toggle',
          source: 'keyboard'
        });
        return;
      }

      // Handle navigation keys
      this._emit('keyboardNavigation', {
        nodeId,
        key,
        direction: this._getNavigationDirection(key),
        event
      });
    }
  }

  /**
   * Handle focus events
   * @private
   */
  _handleFocus(event) {
    if (this.destroyed) return;

    const target = event.target;
    const nodeElement = this._findNodeElement(target);
    
    if (!nodeElement) return;

    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;

    // Update focused node
    this.focusedNodeId = nodeId;
    
    // Update tree view state
    if (this.treeView.setFocusedNode) {
      this.treeView.setFocusedNode(nodeId);
    }

    this._emit('nodeFocus', {
      nodeId,
      previousFocus: this.focusedNodeId !== nodeId ? this.focusedNodeId : null
    });
  }

  /**
   * Handle blur events
   * @private
   */
  _handleBlur(event) {
    if (this.destroyed) return;

    const target = event.target;
    const nodeElement = this._findNodeElement(target);
    
    if (!nodeElement) return;

    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) return;

    // Clear focused node if it matches
    if (this.focusedNodeId === nodeId) {
      this.focusedNodeId = null;
      
      if (this.treeView.setFocusedNode) {
        this.treeView.setFocusedNode(null);
      }
    }

    this._emit('nodeBlur', {
      nodeId
    });
  }

  /**
   * Find the closest tree node element
   * @private
   */
  _findNodeElement(element) {
    if (!element || !element.closest) return null;
    
    // Walk up the DOM to find a tree node
    let current = element;
    while (current && current !== this.treeView.container) {
      if (current.classList && current.classList.contains('tree-node')) {
        return current;
      }
      current = current.parentElement;
    }
    
    return null;
  }

  /**
   * Get navigation direction from key
   * @private
   */
  _getNavigationDirection(key) {
    switch (key) {
      case 'ArrowUp': return 'up';
      case 'ArrowDown': return 'down';
      case 'ArrowLeft': return 'left';
      case 'ArrowRight': return 'right';
      case 'Home': return 'first';
      case 'End': return 'last';
      case 'PageUp': return 'pageUp';
      case 'PageDown': return 'pageDown';
      default: return 'unknown';
    }
  }

  /**
   * Get currently focused node ID
   */
  getFocusedNodeId() {
    return this.focusedNodeId;
  }

  /**
   * Focus a specific node
   */
  focusNode(nodeId) {
    if (this.destroyed || !nodeId) return false;

    const nodeElement = this.treeView.getNodeElement ? 
      this.treeView.getNodeElement(nodeId) : 
      this.treeView.container.querySelector(`[data-node-id="${nodeId}"]`);
    
    if (nodeElement && nodeElement.focus) {
      nodeElement.focus();
      return true;
    }
    
    return false;
  }

  /**
   * Focus next node in tree order
   */
  focusNextNode() {
    if (this.destroyed) return false;

    const visibleNodes = this.treeView.getVisibleNodes ? 
      this.treeView.getVisibleNodes() : 
      [];
    
    if (visibleNodes.length === 0) return false;

    const currentIndex = this.focusedNodeId ? 
      visibleNodes.indexOf(this.focusedNodeId) : 
      -1;
    
    const nextIndex = (currentIndex + 1) % visibleNodes.length;
    return this.focusNode(visibleNodes[nextIndex]);
  }

  /**
   * Focus previous node in tree order
   */
  focusPreviousNode() {
    if (this.destroyed) return false;

    const visibleNodes = this.treeView.getVisibleNodes ? 
      this.treeView.getVisibleNodes() : 
      [];
    
    if (visibleNodes.length === 0) return false;

    const currentIndex = this.focusedNodeId ? 
      visibleNodes.indexOf(this.focusedNodeId) : 
      0;
    
    const previousIndex = currentIndex > 0 ? 
      currentIndex - 1 : 
      visibleNodes.length - 1;
    
    return this.focusNode(visibleNodes[previousIndex]);
  }

  /**
   * Focus first node
   */
  focusFirstNode() {
    if (this.destroyed) return false;

    const visibleNodes = this.treeView.getVisibleNodes ? 
      this.treeView.getVisibleNodes() : 
      [];
    
    if (visibleNodes.length > 0) {
      return this.focusNode(visibleNodes[0]);
    }
    
    return false;
  }

  /**
   * Focus last node
   */
  focusLastNode() {
    if (this.destroyed) return false;

    const visibleNodes = this.treeView.getVisibleNodes ? 
      this.treeView.getVisibleNodes() : 
      [];
    
    if (visibleNodes.length > 0) {
      return this.focusNode(visibleNodes[visibleNodes.length - 1]);
    }
    
    return false;
  }

  /**
   * Add event listener
   */
  on(eventType, callback) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    
    const listeners = this.eventListeners.get(eventType);
    listeners.push(callback);
    
    return () => {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(eventType, data) {
    if (this.destroyed) return;
    
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Interaction event listener error:', error);
        }
      });
    }
  }

  /**
   * Get list of attached DOM events (for testing)
   * @private
   */
  _getAttachedEvents() {
    return Array.from(this.domEventListeners.keys());
  }

  /**
   * Get interaction manager info
   */
  getInfo() {
    return {
      name: 'InteractionManager',
      version: '1.0.0',
      focusedNodeId: this.focusedNodeId,
      eventListenerCount: Array.from(this.eventListeners.values())
        .reduce((total, listeners) => total + listeners.length, 0),
      domEventListenerCount: this.domEventListeners.size,
      destroyed: this.destroyed
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;

    // Remove DOM event listeners
    const container = this.treeView ? this.treeView.container : null;
    if (container) {
      this.domEventListeners.forEach((handler, eventType) => {
        if (eventType === 'focus' || eventType === 'blur') {
          container.removeEventListener(eventType, handler, true);
        } else {
          container.removeEventListener(eventType, handler);
        }
      });
    }
    this.domEventListeners.clear();

    // Unsubscribe from node renderer
    this.nodeRendererSubscriptions.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.nodeRendererSubscriptions = [];

    // Clear event listeners
    this.eventListeners.clear();

    // Clear references
    this.treeView = null;
    this.nodeRenderer = null;
    this.focusedNodeId = null;

    this.destroyed = true;
  }
}