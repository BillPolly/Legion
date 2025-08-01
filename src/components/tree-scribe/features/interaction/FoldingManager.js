/**
 * FoldingManager - Manages node folding state with history and undo functionality
 */

export class FoldingManager {
  constructor(model) {
    this.model = model;
    this.destroyed = false;
    this.eventListeners = new Map();
    
    // State management
    this.stateHistory = [];
    this.redoStack = [];
    this.maxHistorySize = 50;
    this.loadingNodes = new Set();
    
    // Don't capture initial state - let first operation do that
  }

  /**
   * Expand a specific node
   */
  expandNode(nodeId) {
    if (this.destroyed) return false;
    
    const node = this.model.getNode(nodeId);
    if (!node || node.isLeaf()) return false;
    
    this._captureCurrentState();
    node.setState({ expanded: true });
    this._clearRedoStack();
    this._emit('nodeStateChanged', { nodeId, expanded: true });
    
    return true;
  }

  /**
   * Collapse a specific node
   */
  collapseNode(nodeId) {
    if (this.destroyed) return false;
    
    const node = this.model.getNode(nodeId);
    if (!node || node.isLeaf()) return false;
    
    this._captureCurrentState();
    node.setState({ expanded: false });
    this._clearRedoStack();
    this._emit('nodeStateChanged', { nodeId, expanded: false });
    
    return true;
  }

  /**
   * Toggle a specific node's expanded state
   */
  toggleNode(nodeId) {
    if (this.destroyed) return false;
    
    const node = this.model.getNode(nodeId);
    if (!node || node.isLeaf()) return false;
    
    const willExpand = !node.state.expanded;
    this._captureCurrentState();
    node.setState({ expanded: willExpand });
    this._clearRedoStack();
    this._emit('nodeStateChanged', { nodeId, expanded: willExpand });
    
    return true;
  }

  /**
   * Expand all nodes in the tree
   */
  expandAll() {
    if (this.destroyed) return false;
    
    this._captureCurrentState();
    
    const allNodes = this.model.getAllNodes();
    allNodes.forEach(node => {
      if (!node.isLeaf()) {
        node.setState({ expanded: true });
      }
    });
    
    this._clearRedoStack();
    this._emit('expandAll');
    
    return true;
  }

  /**
   * Collapse all nodes except root
   */
  collapseAll() {
    if (this.destroyed) return false;
    
    this._captureCurrentState();
    
    const allNodes = this.model.getAllNodes();
    allNodes.forEach(node => {
      if (!node.isRoot() && !node.isLeaf()) {
        node.setState({ expanded: false });
      }
    });
    
    this._clearRedoStack();
    this._emit('collapseAll');
    
    return true;
  }

  /**
   * Expand nodes to a specific depth
   */
  expandToDepth(depth) {
    if (this.destroyed || depth < 0) return false;
    
    this._captureCurrentState();
    
    const allNodes = this.model.getAllNodes();
    allNodes.forEach(node => {
      if (!node.isLeaf()) {
        const nodeDepth = node.getDepth();
        node.setState({ expanded: nodeDepth <= depth });
      }
    });
    
    this._clearRedoStack();
    this._emit('expandToDepth', { depth });
    
    return true;
  }

  /**
   * Get current folding state of all nodes
   */
  getFoldingState() {
    if (this.destroyed) return {};
    
    const state = {};
    if (this.model.rootNode) {
      const allNodes = this.model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isLeaf()) {
          state[node.id] = node.state.expanded;
        }
      });
    }
    
    return state;
  }

  /**
   * Restore folding state from a state object
   */
  restoreFoldingState(state) {
    if (this.destroyed || !state || typeof state !== 'object') return false;
    
    this._captureCurrentState();
    
    Object.keys(state).forEach(nodeId => {
      const node = this.model.getNode(nodeId);
      if (node && !node.isLeaf() && typeof state[nodeId] === 'boolean') {
        node.setState({ expanded: state[nodeId] });
      }
    });
    
    this._clearRedoStack();
    this._emit('stateRestored', { state });
    
    return true;
  }

  /**
   * Get state history
   */
  getStateHistory() {
    return [...this.stateHistory];
  }

  /**
   * Undo last operation
   */
  undo() {
    if (this.destroyed || this.stateHistory.length === 0) return false;
    
    const currentState = this.getFoldingState();
    const previousState = this.stateHistory.pop();
    
    // Save current state to redo stack
    this.redoStack.push(currentState);
    
    // Restore previous state
    this._restoreStateInternal(previousState);
    this._emit('undo', { previousState });
    
    return true;
  }

  /**
   * Redo undone operation
   */
  redo() {
    if (this.destroyed || this.redoStack.length === 0) return false;
    
    const currentState = this.getFoldingState();
    const redoState = this.redoStack.pop();
    
    // Save current state to history
    this.stateHistory.push(currentState);
    this._trimHistory();
    
    // Restore redo state
    this._restoreStateInternal(redoState);
    this._emit('redo', { redoState });
    
    return true;
  }

  /**
   * Get folding indicators for visual representation
   */
  getFoldingIndicators() {
    if (this.destroyed) return {};
    
    const indicators = {};
    if (this.model.rootNode) {
      const allNodes = this.model.getAllNodes();
      allNodes.forEach(node => {
        if (!node.isLeaf()) {
          if (this.loadingNodes.has(node.id)) {
            indicators[node.id] = 'loading';
          } else {
            indicators[node.id] = node.state.expanded ? 'expanded' : 'collapsed';
          }
        }
      });
    }
    
    return indicators;
  }

  /**
   * Set loading state for a node (internal method for async operations)
   * @private
   */
  _setNodeLoading(nodeId, loading) {
    if (loading) {
      this.loadingNodes.add(nodeId);
    } else {
      this.loadingNodes.delete(nodeId);
    }
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
   * Remove event listener (alias for returned function from on())
   */
  off(eventType, callback) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   * @private
   */
  _emit(eventType, data) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('FoldingManager event listener error:', error);
        }
      });
    }
  }

  /**
   * Capture current state for history
   * @private
   */
  _captureCurrentState() {
    const currentState = this.getFoldingState();
    this.stateHistory.push(currentState);
    this._trimHistory();
  }

  /**
   * Trim history to max size
   * @private
   */
  _trimHistory() {
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory = this.stateHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Clear redo stack (called when new operations are performed)
   * @private
   */
  _clearRedoStack() {
    this.redoStack = [];
  }

  /**
   * Restore state without affecting history
   * @private
   */
  _restoreStateInternal(state) {
    if (!state || typeof state !== 'object') return;
    
    const allNodes = this.model.getAllNodes();
    allNodes.forEach(node => {
      if (!node.isLeaf() && state.hasOwnProperty(node.id)) {
        node.setState({ expanded: state[node.id] });
      }
    });
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;
    
    // Clear state
    this.stateHistory = [];
    this.redoStack = [];
    this.loadingNodes.clear();
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Clear references
    this.model = null;
    
    this.destroyed = true;
  }
}