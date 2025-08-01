/**
 * ExpansionStateManager - Manages expansion/collapse state for hierarchical nodes
 * Supports persistence and bulk operations
 */

export class ExpansionStateManager {
  constructor(config = {}) {
    this.config = config;
    this.expandedNodes = new Set(config.initialExpanded || []);
    this.defaultExpanded = config.defaultExpanded !== false;
    this.maxDepth = config.maxDepth || Infinity;
    this.persistKey = config.persistKey || null;
    
    // Event listeners
    this.listeners = {
      expand: [],
      collapse: [],
      change: []
    };

    // Load persisted state if available
    if (this.persistKey) {
      this.loadPersistedState();
    }
  }

  /**
   * Check if a node is expanded
   * @param {string} nodePath - Path to the node
   * @returns {boolean} True if expanded
   */
  isExpanded(nodePath) {
    if (!nodePath) return this.defaultExpanded;
    
    // If collapseAll was called, everything is collapsed unless explicitly expanded
    if (this._allCollapsed) {
      return this.expandedNodes.has(nodePath);
    }
    
    // If we haven't explicitly set the state, use the default
    if (!this.expandedNodes.has(nodePath) && !this._hasBeenToggled(nodePath)) {
      return this.defaultExpanded;
    }
    return this.expandedNodes.has(nodePath);
  }
  
  _hasBeenToggled(nodePath) {
    // Track if a node has been explicitly toggled
    if (!this._toggledNodes) {
      this._toggledNodes = new Set();
    }
    return this._toggledNodes.has(nodePath);
  }

  /**
   * Expand a node
   * @param {string} nodePath - Path to the node
   */
  expand(nodePath) {
    if (!nodePath) return;
    
    if (!this._toggledNodes) this._toggledNodes = new Set();
    this._toggledNodes.add(nodePath);
    
    if (this.expandedNodes.has(nodePath)) return;
    
    this.expandedNodes.add(nodePath);
    this.notifyListeners('expand', nodePath);
    this.notifyListeners('change', { action: 'expand', path: nodePath });
    this.persistState();
  }

  /**
   * Collapse a node
   * @param {string} nodePath - Path to the node
   */
  collapse(nodePath) {
    if (!nodePath) return;
    
    if (!this._toggledNodes) this._toggledNodes = new Set();
    this._toggledNodes.add(nodePath);
    
    if (!this.expandedNodes.has(nodePath) && !this.defaultExpanded) return;
    
    this.expandedNodes.delete(nodePath);
    
    // Also collapse all descendants
    this.collapseDescendants(nodePath);
    
    this.notifyListeners('collapse', nodePath);
    this.notifyListeners('change', { action: 'collapse', path: nodePath });
    this.persistState();
  }

  /**
   * Toggle a node's expansion state
   * @param {string} nodePath - Path to the node
   * @returns {boolean} New expansion state
   */
  toggle(nodePath) {
    if (this.isExpanded(nodePath)) {
      this.collapse(nodePath);
      return false;
    } else {
      this.expand(nodePath);
      return true;
    }
  }

  /**
   * Expand all nodes
   * @param {HierarchyNode} rootNode - Root node to traverse
   * @param {number} maxDepth - Maximum depth to expand
   */
  expandAll(rootNode = null, maxDepth = this.maxDepth) {
    this._allCollapsed = false;
    if (rootNode) {
      const paths = this.collectAllPaths(rootNode, '', maxDepth);
      paths.forEach(path => this.expandedNodes.add(path));
    }
    
    this.notifyListeners('change', { action: 'expandAll' });
    this.persistState();
  }

  /**
   * Collapse all nodes
   */
  collapseAll() {
    this.expandedNodes.clear();
    if (!this._toggledNodes) this._toggledNodes = new Set();
    // Mark all as explicitly collapsed
    this._allCollapsed = true;
    this.notifyListeners('change', { action: 'collapseAll' });
    this.persistState();
  }

  /**
   * Expand nodes to a specific depth
   * @param {HierarchyNode} rootNode - Root node to traverse
   * @param {number} depth - Depth to expand to
   */
  expandToDepth(rootNode, depth) {
    if (!rootNode || depth < 0) return;
    
    this.collapseAll();
    const paths = this.collectPathsToDepth(rootNode, '', depth);
    paths.forEach(path => this.expandedNodes.add(path));
    
    this.notifyListeners('change', { action: 'expandToDepth', depth });
    this.persistState();
  }

  /**
   * Expand a path and all its ancestors
   * @param {string} targetPath - Path to expand to
   */
  expandPath(targetPath) {
    if (!targetPath) return;
    
    const parts = targetPath.split('.');
    let currentPath = '';
    
    parts.forEach((part, index) => {
      currentPath = index === 0 ? part : `${currentPath}.${part}`;
      this.expandedNodes.add(currentPath);
    });
    
    this.notifyListeners('change', { action: 'expandPath', path: targetPath });
    this.persistState();
  }

  /**
   * Get all expanded paths
   * @returns {string[]} Array of expanded paths
   */
  getExpandedPaths() {
    return Array.from(this.expandedNodes);
  }

  /**
   * Set expanded paths
   * @param {string[]} paths - Array of paths to expand
   */
  setExpandedPaths(paths) {
    this.expandedNodes = new Set(paths);
    this.notifyListeners('change', { action: 'setPaths' });
    this.persistState();
  }

  /**
   * Save current state
   * @returns {Object} Serializable state object
   */
  saveState() {
    return {
      expandedNodes: Array.from(this.expandedNodes),
      defaultExpanded: this.defaultExpanded,
      maxDepth: this.maxDepth
    };
  }

  /**
   * Restore saved state
   * @param {Object} state - Previously saved state
   */
  restoreState(state) {
    if (!state) return;
    
    if (Array.isArray(state.expandedNodes)) {
      this.expandedNodes = new Set(state.expandedNodes);
    }
    
    if (typeof state.defaultExpanded === 'boolean') {
      this.defaultExpanded = state.defaultExpanded;
    }
    
    if (typeof state.maxDepth === 'number') {
      this.maxDepth = state.maxDepth;
    }
    
    this.notifyListeners('change', { action: 'restore' });
  }

  /**
   * Add event listener
   * @param {string} event - Event name (expand, collapse, change)
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners[event]) {
      const index = this.listeners[event].indexOf(callback);
      if (index > -1) {
        this.listeners[event].splice(index, 1);
      }
    }
  }

  /**
   * Collapse all descendants of a path
   * @private
   */
  collapseDescendants(parentPath) {
    const pathPrefix = parentPath + '.';
    const toRemove = [];
    
    this.expandedNodes.forEach(path => {
      if (path.startsWith(pathPrefix)) {
        toRemove.push(path);
      }
    });
    
    toRemove.forEach(path => this.expandedNodes.delete(path));
  }

  /**
   * Collect all paths from a node tree
   * @private
   */
  collectAllPaths(node, parentPath, maxDepth, currentDepth = 0) {
    const paths = [];
    
    if (currentDepth >= maxDepth) return paths;
    
    const nodePath = this.buildNodePath(node, parentPath);
    
    if (node.children && node.children.length > 0) {
      if (nodePath) {
        paths.push(nodePath);
      }
      
      node.children.forEach(child => {
        const childPaths = this.collectAllPaths(child, nodePath || parentPath, maxDepth, currentDepth + 1);
        paths.push(...childPaths);
      });
    }
    
    return paths;
  }

  /**
   * Collect paths up to a specific depth
   * @private
   */
  collectPathsToDepth(node, parentPath, targetDepth, currentDepth = 0) {
    const paths = [];
    
    if (currentDepth >= targetDepth) return paths;
    
    if (node.children && node.children.length > 0) {
      const nodePath = this.buildNodePath(node, parentPath);
      if (nodePath) {
        paths.push(nodePath);
      }
      
      node.children.forEach(child => {
        const childPaths = this.collectPathsToDepth(child, nodePath, targetDepth, currentDepth + 1);
        paths.push(...childPaths);
      });
    }
    
    return paths;
  }

  /**
   * Build node path
   * @private
   */
  buildNodePath(node, parentPath) {
    if (!node.name && node.id) {
      return parentPath ? `${parentPath}.${node.id}` : node.id;
    }
    return parentPath ? `${parentPath}.${node.name}` : node.name || node.id;
  }

  /**
   * Notify listeners
   * @private
   */
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Persist state to storage
   * @private
   */
  persistState() {
    if (!this.persistKey) return;
    
    try {
      const state = this.saveState();
      localStorage.setItem(this.persistKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist expansion state:', error);
    }
  }

  /**
   * Load persisted state from storage
   * @private
   */
  loadPersistedState() {
    if (!this.persistKey) return;
    
    try {
      const stored = localStorage.getItem(this.persistKey);
      if (stored) {
        const state = JSON.parse(stored);
        this.restoreState(state);
      }
    } catch (error) {
      console.warn('Failed to load persisted expansion state:', error);
    }
  }

  /**
   * Clear persisted state
   */
  clearPersistedState() {
    if (!this.persistKey) return;
    
    try {
      localStorage.removeItem(this.persistKey);
    } catch (error) {
      console.warn('Failed to clear persisted expansion state:', error);
    }
  }

  /**
   * Get statistics about expansion state
   */
  getStats() {
    return {
      totalExpanded: this.expandedNodes.size,
      expandedPaths: this.getExpandedPaths(),
      defaultExpanded: this.defaultExpanded,
      maxDepth: this.maxDepth,
      hasPersistence: !!this.persistKey
    };
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.expandedNodes.clear();
    
    if (this.config.initialExpanded) {
      this.config.initialExpanded.forEach(path => this.expandedNodes.add(path));
    }
    
    this.notifyListeners('change', { action: 'reset' });
    this.persistState();
  }

  /**
   * Destroy and cleanup
   */
  destroy() {
    this.expandedNodes.clear();
    this.listeners.expand = [];
    this.listeners.collapse = [];
    this.listeners.change = [];
  }
}