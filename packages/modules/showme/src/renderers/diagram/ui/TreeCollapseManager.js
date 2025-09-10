/**
 * TreeCollapseManager - Manages tree node expansion/collapse state
 * 
 * Provides functionality for:
 * - Node-level expand/collapse controls
 * - Subtree expansion/collapse
 * - Batch operations (expand all, collapse all)
 * - State persistence and restoration
 * - Animation support for expand/collapse transitions
 * - Integration with TreeLayout and TreeNavigationUI
 */

export class TreeCollapseManager {
  constructor(config = {}) {
    this.config = {
      container: config.container,
      treeLayout: config.treeLayout,
      navigationUI: config.navigationUI,
      graphData: config.graphData,
      onStateChange: config.onStateChange,
      onNodeToggle: config.onNodeToggle,
      
      // Visual configuration
      showToggleButtons: config.showToggleButtons !== false,
      buttonSize: config.buttonSize || 16,
      buttonOffset: config.buttonOffset || 8,
      
      // Animation settings
      animateTransitions: config.animateTransitions !== false,
      animationDuration: config.animationDuration || 300,
      animationEasing: config.animationEasing || 'ease-out',
      
      // Behavior settings
      defaultExpanded: config.defaultExpanded !== false,
      collapseLeaves: config.collapseLeaves || false,
      preserveSelection: config.preserveSelection !== false,
      
      // Persistence
      persistState: config.persistState || false,
      storageKey: config.storageKey || 'tree-collapse-state',
      
      ...config
    };
    
    // Collapse state management
    this.expandedNodes = new Set();
    this.collapsedNodes = new Set();
    this.nodeVisibility = new Map(); // Track which nodes should be visible
    this.animatingNodes = new Set(); // Track nodes currently animating
    
    // Tree structure cache
    this.nodeMap = new Map();
    this.childrenMap = new Map();
    this.parentMap = new Map();
    this.descendantsCache = new Map();
    
    // UI elements
    this.toggleButtons = new Map();
    this.container = null;
    
    // Animation state
    this.animationFrameId = null;
    this.pendingUpdates = new Set();
  }
  
  /**
   * Initialize the collapse manager
   */
  initialize() {
    if (!this.config.container) {
      throw new Error('TreeCollapseManager requires a container element');
    }
    
    this.container = this.config.container;
    
    // Build tree structure
    this._buildTreeStructure();
    
    // Initialize default state
    this._initializeDefaultState();
    
    // Create toggle buttons if enabled
    if (this.config.showToggleButtons) {
      this._createToggleButtons();
    }
    
    // Load persisted state if enabled
    if (this.config.persistState) {
      this._loadPersistedState();
    }
    
    // Update initial visibility
    this._updateNodeVisibility();
    
    return this;
  }
  
  /**
   * Build tree structure from graph data
   * @private
   */
  _buildTreeStructure() {
    if (!this.config.graphData) return;
    
    this.nodeMap.clear();
    this.childrenMap.clear();
    this.parentMap.clear();
    this.descendantsCache.clear();
    
    // Build node map
    this.config.graphData.nodes.forEach(node => {
      this.nodeMap.set(node.id, node);
      this.childrenMap.set(node.id, []);
    });
    
    // Build parent-child relationships
    if (this.config.graphData.edges) {
      this.config.graphData.edges.forEach(edge => {
        const parent = edge.source;
        const child = edge.target;
        
        this.parentMap.set(child, parent);
        
        const children = this.childrenMap.get(parent) || [];
        children.push(child);
        this.childrenMap.set(parent, children);
      });
    }
  }
  
  /**
   * Initialize default expansion state
   * @private
   */
  _initializeDefaultState() {
    if (this.config.defaultExpanded) {
      // All nodes start expanded
      this.nodeMap.forEach((node, nodeId) => {
        const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
        if (hasChildren) {
          this.expandedNodes.add(nodeId);
        }
      });
    } else {
      // All nodes start collapsed
      this.nodeMap.forEach((node, nodeId) => {
        const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
        if (hasChildren) {
          this.collapsedNodes.add(nodeId);
        }
      });
    }
  }
  
  /**
   * Create toggle buttons for nodes with children
   * @private
   */
  _createToggleButtons() {
    this.toggleButtons.clear();
    
    this.nodeMap.forEach((node, nodeId) => {
      const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
      
      if (hasChildren) {
        const button = this._createToggleButton(nodeId);
        this.toggleButtons.set(nodeId, button);
        this.container.appendChild(button);
      }
    });
  }
  
  /**
   * Create a single toggle button for a node
   * @private
   */
  _createToggleButton(nodeId) {
    const button = document.createElement('div');
    button.className = 'tree-toggle-button';
    button.setAttribute('data-node-id', nodeId);
    
    const isExpanded = this.isNodeExpanded(nodeId);
    const icon = isExpanded ? '−' : '+'; // Minus for expanded, plus for collapsed
    
    button.innerHTML = `
      <div class="toggle-button-content">
        <span class="toggle-icon">${icon}</span>
      </div>
    `;
    
    // Position button (this would typically be updated based on node position)
    button.style.position = 'absolute';
    button.style.width = this.config.buttonSize + 'px';
    button.style.height = this.config.buttonSize + 'px';
    button.style.cursor = 'pointer';
    button.style.userSelect = 'none';
    button.style.zIndex = '1000';
    
    // Add event listeners
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleNode(nodeId);
    });
    
    return button;
  }
  
  /**
   * Update toggle button positions based on node layout
   * @param {Map} nodePositions - Map of node ID to position
   */
  updateButtonPositions(nodePositions) {
    if (!this.config.showToggleButtons) return;
    
    this.toggleButtons.forEach((button, nodeId) => {
      const position = nodePositions.get(nodeId);
      if (position) {
        const nodeSize = this.nodeMap.get(nodeId)?.size || { width: 100, height: 60 };
        
        // Position button at bottom-right of node
        button.style.left = (position.x + nodeSize.width / 2 - this.config.buttonOffset) + 'px';
        button.style.top = (position.y + nodeSize.height / 2 - this.config.buttonOffset) + 'px';
      }
    });
  }
  
  /**
   * Check if a node is expanded
   * @param {string} nodeId - Node ID to check
   * @returns {boolean}
   */
  isNodeExpanded(nodeId) {
    const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
    if (!hasChildren) return true; // Leaf nodes are always "expanded"
    
    return this.expandedNodes.has(nodeId) && !this.collapsedNodes.has(nodeId);
  }
  
  /**
   * Check if a node is collapsed
   * @param {string} nodeId - Node ID to check
   * @returns {boolean}
   */
  isNodeCollapsed(nodeId) {
    const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
    if (!hasChildren) return false; // Leaf nodes can't be collapsed
    
    return !this.isNodeExpanded(nodeId);
  }
  
  /**
   * Check if a node should be visible
   * @param {string} nodeId - Node ID to check
   * @returns {boolean}
   */
  isNodeVisible(nodeId) {
    if (this.nodeVisibility.has(nodeId)) {
      return this.nodeVisibility.get(nodeId);
    }
    
    // Check if any ancestor is collapsed
    let current = this.parentMap.get(nodeId);
    while (current) {
      if (this.isNodeCollapsed(current)) {
        this.nodeVisibility.set(nodeId, false);
        return false;
      }
      current = this.parentMap.get(current);
    }
    
    this.nodeVisibility.set(nodeId, true);
    return true;
  }
  
  /**
   * Toggle expansion state of a node
   * @param {string} nodeId - Node ID to toggle
   */
  toggleNode(nodeId) {
    const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
    if (!hasChildren) return false;
    
    const wasExpanded = this.isNodeExpanded(nodeId);
    
    if (wasExpanded) {
      this.collapseNode(nodeId);
    } else {
      this.expandNode(nodeId);
    }
    
    return true;
  }
  
  /**
   * Expand a node
   * @param {string} nodeId - Node ID to expand
   * @param {boolean} animate - Whether to animate the expansion
   */
  expandNode(nodeId, animate = true) {
    const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
    if (!hasChildren) return false;
    
    // Update state
    this.expandedNodes.add(nodeId);
    this.collapsedNodes.delete(nodeId);
    
    // Update toggle button
    this._updateToggleButton(nodeId, true);
    
    // Update visibility
    this._updateNodeVisibility();
    
    // Animate if enabled
    if (animate && this.config.animateTransitions) {
      this._animateNodeExpansion(nodeId);
    }
    
    // Notify listeners
    if (this.config.onNodeToggle) {
      this.config.onNodeToggle(nodeId, true);
    }
    
    this._notifyStateChange();
    
    return true;
  }
  
  /**
   * Collapse a node
   * @param {string} nodeId - Node ID to collapse
   * @param {boolean} animate - Whether to animate the collapse
   */
  collapseNode(nodeId, animate = true) {
    const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
    if (!hasChildren) return false;
    
    // Update state
    this.collapsedNodes.add(nodeId);
    this.expandedNodes.delete(nodeId);
    
    // Update toggle button
    this._updateToggleButton(nodeId, false);
    
    // Update visibility
    this._updateNodeVisibility();
    
    // Animate if enabled
    if (animate && this.config.animateTransitions) {
      this._animateNodeCollapse(nodeId);
    }
    
    // Notify listeners
    if (this.config.onNodeToggle) {
      this.config.onNodeToggle(nodeId, false);
    }
    
    this._notifyStateChange();
    
    return true;
  }
  
  /**
   * Expand all nodes
   */
  expandAll() {
    let expandedAny = false;
    
    this.nodeMap.forEach((node, nodeId) => {
      const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
      if (hasChildren && !this.isNodeExpanded(nodeId)) {
        this.expandNode(nodeId, false);
        expandedAny = true;
      }
    });
    
    if (expandedAny) {
      this._notifyStateChange('expandAll');
    }
  }
  
  /**
   * Collapse all nodes
   */
  collapseAll() {
    let collapsedAny = false;
    
    this.nodeMap.forEach((node, nodeId) => {
      const hasChildren = (this.childrenMap.get(nodeId) || []).length > 0;
      if (hasChildren && this.isNodeExpanded(nodeId)) {
        this.collapseNode(nodeId, false);
        collapsedAny = true;
      }
    });
    
    if (collapsedAny) {
      this._notifyStateChange('collapseAll');
    }
  }
  
  /**
   * Expand subtree rooted at a node
   * @param {string} nodeId - Root of subtree to expand
   * @param {number} levels - Number of levels to expand (0 = all)
   */
  expandSubtree(nodeId, levels = 0) {
    const toExpand = this._getSubtreeNodes(nodeId, levels);
    
    toExpand.forEach(id => {
      if (this.isNodeCollapsed(id)) {
        this.expandNode(id, false);
      }
    });
    
    this._notifyStateChange('expandSubtree');
  }
  
  /**
   * Collapse subtree rooted at a node
   * @param {string} nodeId - Root of subtree to collapse
   */
  collapseSubtree(nodeId) {
    const descendants = this._getDescendants(nodeId);
    
    descendants.forEach(id => {
      if (this.isNodeExpanded(id)) {
        this.collapseNode(id, false);
      }
    });
    
    // Also collapse the root node
    if (this.isNodeExpanded(nodeId)) {
      this.collapseNode(nodeId, false);
    }
    
    this._notifyStateChange('collapseSubtree');
  }
  
  /**
   * Get visible nodes based on current collapse state
   * @returns {Array} Array of visible node IDs
   */
  getVisibleNodes() {
    return Array.from(this.nodeMap.keys()).filter(nodeId => 
      this.isNodeVisible(nodeId)
    );
  }
  
  /**
   * Get visible edges based on current collapse state
   * @returns {Array} Array of visible edges
   */
  getVisibleEdges() {
    if (!this.config.graphData.edges) return [];
    
    return this.config.graphData.edges.filter(edge => 
      this.isNodeVisible(edge.source) && this.isNodeVisible(edge.target)
    );
  }
  
  /**
   * Get current collapse state
   * @returns {Object} State object with expanded and collapsed sets
   */
  getState() {
    return {
      expanded: new Set(this.expandedNodes),
      collapsed: new Set(this.collapsedNodes),
      visible: new Map(this.nodeVisibility)
    };
  }
  
  /**
   * Restore collapse state
   * @param {Object} state - State object to restore
   */
  setState(state) {
    if (state.expanded) {
      this.expandedNodes = new Set(state.expanded);
    }
    
    if (state.collapsed) {
      this.collapsedNodes = new Set(state.collapsed);
    }
    
    // Update toggle buttons
    this.toggleButtons.forEach((button, nodeId) => {
      this._updateToggleButton(nodeId, this.isNodeExpanded(nodeId));
    });
    
    // Update visibility
    this._updateNodeVisibility();
    
    this._notifyStateChange('setState');
  }
  
  /**
   * Update node visibility cache
   * @private
   */
  _updateNodeVisibility() {
    this.nodeVisibility.clear();
    
    this.nodeMap.forEach((node, nodeId) => {
      this.isNodeVisible(nodeId); // This will cache the result
    });
  }
  
  /**
   * Update toggle button appearance
   * @private
   */
  _updateToggleButton(nodeId, isExpanded) {
    const button = this.toggleButtons.get(nodeId);
    if (!button) return;
    
    const icon = isExpanded ? '−' : '+';
    const iconElement = button.querySelector('.toggle-icon');
    if (iconElement) {
      iconElement.textContent = icon;
    }
    
    button.classList.toggle('expanded', isExpanded);
    button.classList.toggle('collapsed', !isExpanded);
  }
  
  /**
   * Get all descendants of a node
   * @private
   */
  _getDescendants(nodeId) {
    if (this.descendantsCache.has(nodeId)) {
      return this.descendantsCache.get(nodeId);
    }
    
    const descendants = new Set();
    const queue = [...(this.childrenMap.get(nodeId) || [])];
    
    while (queue.length > 0) {
      const current = queue.shift();
      descendants.add(current);
      
      const children = this.childrenMap.get(current) || [];
      queue.push(...children);
    }
    
    const result = Array.from(descendants);
    this.descendantsCache.set(nodeId, result);
    return result;
  }
  
  /**
   * Get subtree nodes up to a certain level
   * @private
   */
  _getSubtreeNodes(nodeId, levels) {
    const result = [];
    const queue = [{ id: nodeId, level: 0 }];
    
    while (queue.length > 0) {
      const { id, level } = queue.shift();
      result.push(id);
      
      if (levels === 0 || level < levels) {
        const children = this.childrenMap.get(id) || [];
        children.forEach(childId => {
          queue.push({ id: childId, level: level + 1 });
        });
      }
    }
    
    return result;
  }
  
  /**
   * Animate node expansion
   * @private
   */
  _animateNodeExpansion(nodeId) {
    if (!this.config.animateTransitions) return;
    
    this.animatingNodes.add(nodeId);
    
    // Get descendants to animate
    const descendants = this._getDescendants(nodeId);
    
    // Implement expansion animation logic here
    // This would typically involve CSS transitions or custom animation
    
    setTimeout(() => {
      this.animatingNodes.delete(nodeId);
    }, this.config.animationDuration);
  }
  
  /**
   * Animate node collapse
   * @private
   */
  _animateNodeCollapse(nodeId) {
    if (!this.config.animateTransitions) return;
    
    this.animatingNodes.add(nodeId);
    
    // Implement collapse animation logic here
    
    setTimeout(() => {
      this.animatingNodes.delete(nodeId);
    }, this.config.animationDuration);
  }
  
  /**
   * Load persisted state from storage
   * @private
   */
  _loadPersistedState() {
    try {
      const stored = localStorage.getItem(this.config.storageKey);
      if (stored) {
        const state = JSON.parse(stored);
        if (state.expanded && state.collapsed) {
          this.expandedNodes = new Set(state.expanded);
          this.collapsedNodes = new Set(state.collapsed);
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted tree state:', error);
    }
  }
  
  /**
   * Save state to storage
   * @private
   */
  _persistState() {
    if (!this.config.persistState) return;
    
    try {
      const state = {
        expanded: Array.from(this.expandedNodes),
        collapsed: Array.from(this.collapsedNodes),
        timestamp: Date.now()
      };
      
      localStorage.setItem(this.config.storageKey, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to persist tree state:', error);
    }
  }
  
  /**
   * Notify state change listeners
   * @private
   */
  _notifyStateChange(action = 'toggle') {
    if (this.config.onStateChange) {
      this.config.onStateChange({
        action,
        expanded: Array.from(this.expandedNodes),
        collapsed: Array.from(this.collapsedNodes),
        visibleNodes: this.getVisibleNodes(),
        visibleEdges: this.getVisibleEdges()
      });
    }
    
    // Persist state if enabled
    this._persistState();
  }
  
  /**
   * Update graph data
   * @param {Object} graphData - New graph data
   */
  updateGraphData(graphData) {
    this.config.graphData = graphData;
    this._buildTreeStructure();
    
    // Clean up state for nodes that no longer exist
    const currentNodeIds = new Set(graphData.nodes.map(n => n.id));
    
    for (const nodeId of this.expandedNodes) {
      if (!currentNodeIds.has(nodeId)) {
        this.expandedNodes.delete(nodeId);
      }
    }
    
    for (const nodeId of this.collapsedNodes) {
      if (!currentNodeIds.has(nodeId)) {
        this.collapsedNodes.delete(nodeId);
      }
    }
    
    // Update toggle buttons
    if (this.config.showToggleButtons) {
      this._createToggleButtons();
    }
    
    // Update visibility
    this._updateNodeVisibility();
  }
  
  /**
   * Destroy the collapse manager
   */
  destroy() {
    // Cancel any pending animations
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    
    // Remove toggle buttons
    this.toggleButtons.forEach(button => {
      if (button.parentNode) {
        button.parentNode.removeChild(button);
      }
    });
    
    // Clear state
    this.expandedNodes.clear();
    this.collapsedNodes.clear();
    this.nodeVisibility.clear();
    this.animatingNodes.clear();
    this.toggleButtons.clear();
    this.nodeMap.clear();
    this.childrenMap.clear();
    this.parentMap.clear();
    this.descendantsCache.clear();
    this.pendingUpdates.clear();
  }
}

export default TreeCollapseManager;