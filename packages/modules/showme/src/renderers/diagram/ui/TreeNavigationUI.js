/**
 * TreeNavigationUI - Interactive navigation controls for tree layouts
 * 
 * Provides navigation functionality including:
 * - Parent/child navigation
 * - Sibling navigation
 * - Tree traversal (DFS, BFS)
 * - Node selection and highlighting
 * - Path finding between nodes
 * - Tree expansion/collapse controls
 */

export class TreeNavigationUI {
  constructor(config = {}) {
    this.config = {
      container: config.container,
      treeLayout: config.treeLayout,
      graphData: config.graphData,
      onNodeSelect: config.onNodeSelect,
      onNavigationChange: config.onNavigationChange,
      theme: config.theme || 'light',
      showBreadcrumbs: config.showBreadcrumbs !== false,
      showMinimap: config.showMinimap !== false,
      enableKeyboardNav: config.enableKeyboardNav !== false,
      animateTransitions: config.animateTransitions !== false,
      ...config
    };
    
    // Navigation state
    this.currentNode = null;
    this.selectedNodes = new Set();
    this.navigationHistory = [];
    this.historyIndex = -1;
    
    // Tree structure
    this.nodeMap = new Map();
    this.parentMap = new Map();
    this.childrenMap = new Map();
    this.siblingMap = new Map();
    
    // UI elements
    this.container = null;
    this.toolbar = null;
    this.breadcrumbs = null;
    this.minimap = null;
    this.nodeInfo = null;
    
    // Keyboard handler
    this.keyboardHandler = null;
    
    // Animation state
    this.animationId = null;
  }
  
  /**
   * Initialize the navigation UI
   */
  initialize() {
    if (!this.config.container) {
      throw new Error('TreeNavigationUI requires a container element');
    }
    
    this.container = this.config.container;
    this.container.className = 'tree-navigation-ui';
    this.container.innerHTML = '';
    
    // Build tree structure maps
    this._buildTreeStructure();
    
    // Create UI components
    this._createToolbar();
    if (this.config.showBreadcrumbs) this._createBreadcrumbs();
    if (this.config.showMinimap) this._createMinimap();
    this._createNodeInfo();
    
    // Set up keyboard navigation
    if (this.config.enableKeyboardNav) {
      this._setupKeyboardNavigation();
    }
    
    // Apply theme
    this._applyTheme();
    
    return this;
  }
  
  /**
   * Build tree structure maps for efficient navigation
   * @private
   */
  _buildTreeStructure() {
    if (!this.config.graphData) return;
    
    this.nodeMap.clear();
    this.parentMap.clear();
    this.childrenMap.clear();
    this.siblingMap.clear();
    
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
    
    // Build sibling relationships
    this.childrenMap.forEach((children, parent) => {
      children.forEach((child, index) => {
        const siblings = children.filter(c => c !== child);
        this.siblingMap.set(child, {
          all: siblings,
          prev: children[index - 1] || null,
          next: children[index + 1] || null
        });
      });
    });
  }
  
  /**
   * Create navigation toolbar
   * @private
   */
  _createToolbar() {
    this.toolbar = document.createElement('div');
    this.toolbar.className = 'tree-nav-toolbar';
    
    const buttons = [
      { id: 'back', icon: '←', title: 'Navigate Back', action: () => this.navigateBack() },
      { id: 'forward', icon: '→', title: 'Navigate Forward', action: () => this.navigateForward() },
      { id: 'parent', icon: '↑', title: 'Go to Parent', action: () => this.navigateToParent() },
      { id: 'first-child', icon: '↓', title: 'Go to First Child', action: () => this.navigateToFirstChild() },
      { id: 'prev-sibling', icon: '←', title: 'Previous Sibling', action: () => this.navigateToPreviousSibling() },
      { id: 'next-sibling', icon: '→', title: 'Next Sibling', action: () => this.navigateToNextSibling() },
      { id: 'root', icon: '⌂', title: 'Go to Root', action: () => this.navigateToRoot() },
      { id: 'expand-all', icon: '⊞', title: 'Expand All', action: () => this.expandAll() },
      { id: 'collapse-all', icon: '⊟', title: 'Collapse All', action: () => this.collapseAll() }
    ];
    
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `tree-nav-btn tree-nav-${btn.id}`;
      button.innerHTML = btn.icon;
      button.title = btn.title;
      button.addEventListener('click', btn.action);
      this.toolbar.appendChild(button);
    });
    
    // Add search input
    const searchContainer = document.createElement('div');
    searchContainer.className = 'tree-nav-search';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search nodes...';
    searchInput.addEventListener('input', (e) => this._handleSearch(e.target.value));
    
    const searchResults = document.createElement('div');
    searchResults.className = 'tree-nav-search-results';
    searchResults.style.display = 'none';
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchResults);
    this.toolbar.appendChild(searchContainer);
    
    this.container.appendChild(this.toolbar);
  }
  
  /**
   * Create breadcrumb navigation
   * @private
   */
  _createBreadcrumbs() {
    this.breadcrumbs = document.createElement('div');
    this.breadcrumbs.className = 'tree-nav-breadcrumbs';
    this.container.appendChild(this.breadcrumbs);
  }
  
  /**
   * Create minimap for tree overview
   * @private
   */
  _createMinimap() {
    this.minimap = document.createElement('div');
    this.minimap.className = 'tree-nav-minimap';
    
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.width = 200;
    minimapCanvas.height = 150;
    this.minimap.appendChild(minimapCanvas);
    
    this.container.appendChild(this.minimap);
    
    // Update minimap when layout changes
    this._updateMinimap();
  }
  
  /**
   * Create node information panel
   * @private
   */
  _createNodeInfo() {
    this.nodeInfo = document.createElement('div');
    this.nodeInfo.className = 'tree-nav-node-info';
    this.container.appendChild(this.nodeInfo);
  }
  
  /**
   * Set up keyboard navigation
   * @private
   */
  _setupKeyboardNavigation() {
    this.keyboardHandler = (event) => {
      if (!this.currentNode) return;
      
      const { key, ctrlKey, altKey } = event;
      
      switch (key) {
        case 'ArrowUp':
          event.preventDefault();
          if (ctrlKey) {
            this.navigateToParent();
          } else {
            this.navigateToPreviousSibling();
          }
          break;
          
        case 'ArrowDown':
          event.preventDefault();
          if (ctrlKey) {
            this.navigateToFirstChild();
          } else {
            this.navigateToNextSibling();
          }
          break;
          
        case 'ArrowLeft':
          event.preventDefault();
          if (ctrlKey) {
            this.navigateBack();
          } else {
            this.navigateToPreviousSibling();
          }
          break;
          
        case 'ArrowRight':
          event.preventDefault();
          if (ctrlKey) {
            this.navigateForward();
          } else {
            this.navigateToNextSibling();
          }
          break;
          
        case 'Home':
          event.preventDefault();
          this.navigateToRoot();
          break;
          
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (altKey) {
            this.toggleNodeExpansion(this.currentNode);
          }
          break;
          
        case 'Escape':
          this.clearSelection();
          break;
      }
    };
    
    // Add keyboard listener to container or document
    const target = this.container.tabIndex >= 0 ? this.container : document;
    target.addEventListener('keydown', this.keyboardHandler);
  }
  
  /**
   * Navigate to a specific node
   * @param {string} nodeId - Target node ID
   * @param {boolean} addToHistory - Whether to add to navigation history
   */
  navigateToNode(nodeId, addToHistory = true) {
    if (!this.nodeMap.has(nodeId)) {
      console.warn(`Node ${nodeId} not found`);
      return false;
    }
    
    const previousNode = this.currentNode;
    this.currentNode = nodeId;
    
    // Add to history
    if (addToHistory && previousNode !== nodeId) {
      this.navigationHistory = this.navigationHistory.slice(0, this.historyIndex + 1);
      this.navigationHistory.push(nodeId);
      this.historyIndex = this.navigationHistory.length - 1;
    }
    
    // Update UI
    this._updateCurrentNodeDisplay();
    this._updateBreadcrumbs();
    this._updateNodeInfo();
    this._updateToolbarState();
    
    // Notify listeners
    if (this.config.onNodeSelect) {
      this.config.onNodeSelect(nodeId, this.nodeMap.get(nodeId));
    }
    
    if (this.config.onNavigationChange) {
      this.config.onNavigationChange({
        currentNode: nodeId,
        previousNode: previousNode,
        action: 'navigate'
      });
    }
    
    return true;
  }
  
  /**
   * Navigate to parent node
   */
  navigateToParent() {
    if (!this.currentNode) return false;
    
    const parentId = this.parentMap.get(this.currentNode);
    if (parentId) {
      return this.navigateToNode(parentId);
    }
    
    return false;
  }
  
  /**
   * Navigate to first child node
   */
  navigateToFirstChild() {
    if (!this.currentNode) return false;
    
    const children = this.childrenMap.get(this.currentNode) || [];
    if (children.length > 0) {
      return this.navigateToNode(children[0]);
    }
    
    return false;
  }
  
  /**
   * Navigate to previous sibling
   */
  navigateToPreviousSibling() {
    if (!this.currentNode) return false;
    
    const siblings = this.siblingMap.get(this.currentNode);
    if (siblings && siblings.prev) {
      return this.navigateToNode(siblings.prev);
    }
    
    return false;
  }
  
  /**
   * Navigate to next sibling
   */
  navigateToNextSibling() {
    if (!this.currentNode) return false;
    
    const siblings = this.siblingMap.get(this.currentNode);
    if (siblings && siblings.next) {
      return this.navigateToNode(siblings.next);
    }
    
    return false;
  }
  
  /**
   * Navigate to root node
   */
  navigateToRoot() {
    // Find root node (node with no parent)
    for (const [nodeId] of this.nodeMap) {
      if (!this.parentMap.has(nodeId)) {
        return this.navigateToNode(nodeId);
      }
    }
    
    return false;
  }
  
  /**
   * Navigate back in history
   */
  navigateBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const nodeId = this.navigationHistory[this.historyIndex];
      this.currentNode = nodeId;
      this._updateCurrentNodeDisplay();
      this._updateBreadcrumbs();
      this._updateNodeInfo();
      this._updateToolbarState();
      
      if (this.config.onNodeSelect) {
        this.config.onNodeSelect(nodeId, this.nodeMap.get(nodeId));
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Navigate forward in history
   */
  navigateForward() {
    if (this.historyIndex < this.navigationHistory.length - 1) {
      this.historyIndex++;
      const nodeId = this.navigationHistory[this.historyIndex];
      this.currentNode = nodeId;
      this._updateCurrentNodeDisplay();
      this._updateBreadcrumbs();
      this._updateNodeInfo();
      this._updateToolbarState();
      
      if (this.config.onNodeSelect) {
        this.config.onNodeSelect(nodeId, this.nodeMap.get(nodeId));
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Find path between two nodes
   * @param {string} fromId - Source node ID
   * @param {string} toId - Target node ID
   * @returns {Array} Path of node IDs
   */
  findPath(fromId, toId) {
    if (!this.nodeMap.has(fromId) || !this.nodeMap.has(toId)) {
      return [];
    }
    
    // Find common ancestor using BFS
    const fromAncestors = this._getAncestors(fromId);
    const toAncestors = this._getAncestors(toId);
    
    // Find lowest common ancestor
    let commonAncestor = null;
    for (const ancestor of fromAncestors) {
      if (toAncestors.includes(ancestor)) {
        commonAncestor = ancestor;
        break;
      }
    }
    
    if (!commonAncestor) return [];
    
    // Build path: from -> common ancestor -> to
    const fromPath = this._getPathToAncestor(fromId, commonAncestor).reverse();
    const toPath = this._getPathToAncestor(toId, commonAncestor);
    
    // Remove duplicate common ancestor
    fromPath.pop();
    
    return [...fromPath, ...toPath];
  }
  
  /**
   * Traverse tree using DFS
   * @param {string} startId - Starting node ID
   * @param {Function} visitor - Visitor function
   * @param {string} order - Traversal order: 'pre', 'post', 'in'
   */
  traverseDFS(startId, visitor, order = 'pre') {
    if (!this.nodeMap.has(startId)) return;
    
    const visited = new Set();
    
    const traverse = (nodeId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = this.nodeMap.get(nodeId);
      const children = this.childrenMap.get(nodeId) || [];
      
      if (order === 'pre') {
        visitor(node, nodeId);
      }
      
      children.forEach(childId => traverse(childId));
      
      if (order === 'post') {
        visitor(node, nodeId);
      }
    };
    
    traverse(startId);
  }
  
  /**
   * Traverse tree using BFS
   * @param {string} startId - Starting node ID
   * @param {Function} visitor - Visitor function
   */
  traverseBFS(startId, visitor) {
    if (!this.nodeMap.has(startId)) return;
    
    const queue = [startId];
    const visited = new Set();
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      const node = this.nodeMap.get(nodeId);
      visitor(node, nodeId);
      
      const children = this.childrenMap.get(nodeId) || [];
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      });
    }
  }
  
  /**
   * Expand all nodes
   */
  expandAll() {
    if (this.config.onNavigationChange) {
      this.config.onNavigationChange({
        action: 'expandAll'
      });
    }
  }
  
  /**
   * Collapse all nodes
   */
  collapseAll() {
    if (this.config.onNavigationChange) {
      this.config.onNavigationChange({
        action: 'collapseAll'
      });
    }
  }
  
  /**
   * Toggle node expansion
   * @param {string} nodeId - Node ID to toggle
   */
  toggleNodeExpansion(nodeId) {
    if (this.config.onNavigationChange) {
      this.config.onNavigationChange({
        action: 'toggleExpansion',
        nodeId: nodeId
      });
    }
  }
  
  /**
   * Clear current selection
   */
  clearSelection() {
    this.selectedNodes.clear();
    this._updateCurrentNodeDisplay();
  }
  
  /**
   * Get ancestors of a node
   * @private
   */
  _getAncestors(nodeId) {
    const ancestors = [];
    let current = nodeId;
    
    while (current) {
      ancestors.push(current);
      current = this.parentMap.get(current);
    }
    
    return ancestors;
  }
  
  /**
   * Get path from node to ancestor
   * @private
   */
  _getPathToAncestor(nodeId, ancestorId) {
    const path = [];
    let current = nodeId;
    
    while (current && current !== ancestorId) {
      path.push(current);
      current = this.parentMap.get(current);
    }
    
    if (current === ancestorId) {
      path.push(ancestorId);
    }
    
    return path;
  }
  
  /**
   * Handle search input
   * @private
   */
  _handleSearch(query) {
    if (!query.trim()) {
      this._hideSearchResults();
      return;
    }
    
    const results = [];
    const lowerQuery = query.toLowerCase();
    
    this.nodeMap.forEach((node, nodeId) => {
      const nodeLabel = node.label || node.id || nodeId;
      if (nodeLabel.toLowerCase().includes(lowerQuery)) {
        results.push({ id: nodeId, node, relevance: this._calculateRelevance(nodeLabel, query) });
      }
    });
    
    results.sort((a, b) => b.relevance - a.relevance);
    this._showSearchResults(results.slice(0, 10));
  }
  
  /**
   * Calculate search relevance score
   * @private
   */
  _calculateRelevance(text, query) {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    if (lowerText === lowerQuery) return 100;
    if (lowerText.startsWith(lowerQuery)) return 90;
    if (lowerText.includes(lowerQuery)) return 70;
    
    // Fuzzy matching score
    let score = 0;
    let queryIndex = 0;
    for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
      if (lowerText[i] === lowerQuery[queryIndex]) {
        score += 1;
        queryIndex++;
      }
    }
    
    return (score / lowerQuery.length) * 50;
  }
  
  /**
   * Show search results
   * @private
   */
  _showSearchResults(results) {
    const container = this.toolbar.querySelector('.tree-nav-search-results');
    container.innerHTML = '';
    
    if (results.length === 0) {
      container.innerHTML = '<div class="no-results">No results found</div>';
    } else {
      results.forEach(result => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.textContent = result.node.label || result.id;
        item.addEventListener('click', () => {
          this.navigateToNode(result.id);
          this._hideSearchResults();
        });
        container.appendChild(item);
      });
    }
    
    container.style.display = 'block';
  }
  
  /**
   * Hide search results
   * @private
   */
  _hideSearchResults() {
    const container = this.toolbar.querySelector('.tree-nav-search-results');
    if (container) {
      container.style.display = 'none';
    }
  }
  
  /**
   * Update current node display
   * @private
   */
  _updateCurrentNodeDisplay() {
    // This would typically highlight the current node in the main diagram
    // For now, just update internal state
  }
  
  /**
   * Update breadcrumbs
   * @private
   */
  _updateBreadcrumbs() {
    if (!this.breadcrumbs || !this.currentNode) return;
    
    const ancestors = this._getAncestors(this.currentNode).reverse();
    this.breadcrumbs.innerHTML = '';
    
    ancestors.forEach((nodeId, index) => {
      const node = this.nodeMap.get(nodeId);
      const crumb = document.createElement('span');
      crumb.className = 'breadcrumb-item';
      crumb.textContent = node.label || nodeId;
      
      if (nodeId !== this.currentNode) {
        crumb.classList.add('clickable');
        crumb.addEventListener('click', () => this.navigateToNode(nodeId));
      } else {
        crumb.classList.add('current');
      }
      
      this.breadcrumbs.appendChild(crumb);
      
      if (index < ancestors.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = ' › ';
        this.breadcrumbs.appendChild(separator);
      }
    });
  }
  
  /**
   * Update node information panel
   * @private
   */
  _updateNodeInfo() {
    if (!this.nodeInfo || !this.currentNode) return;
    
    const node = this.nodeMap.get(this.currentNode);
    const children = this.childrenMap.get(this.currentNode) || [];
    const parent = this.parentMap.get(this.currentNode);
    const siblings = this.siblingMap.get(this.currentNode);
    
    this.nodeInfo.innerHTML = `
      <div class="node-info-header">
        <h3>${node.label || this.currentNode}</h3>
      </div>
      <div class="node-info-details">
        <div class="info-item">
          <label>ID:</label>
          <span>${this.currentNode}</span>
        </div>
        <div class="info-item">
          <label>Children:</label>
          <span>${children.length}</span>
        </div>
        <div class="info-item">
          <label>Parent:</label>
          <span>${parent || 'None'}</span>
        </div>
        <div class="info-item">
          <label>Siblings:</label>
          <span>${siblings ? siblings.all.length : 0}</span>
        </div>
      </div>
    `;
  }
  
  /**
   * Update toolbar button states
   * @private
   */
  _updateToolbarState() {
    const buttons = {
      back: this.historyIndex > 0,
      forward: this.historyIndex < this.navigationHistory.length - 1,
      parent: this.currentNode && this.parentMap.has(this.currentNode),
      'first-child': this.currentNode && (this.childrenMap.get(this.currentNode) || []).length > 0,
      'prev-sibling': this.currentNode && this.siblingMap.get(this.currentNode)?.prev,
      'next-sibling': this.currentNode && this.siblingMap.get(this.currentNode)?.next
    };
    
    Object.entries(buttons).forEach(([buttonId, enabled]) => {
      const button = this.toolbar.querySelector(`.tree-nav-${buttonId}`);
      if (button) {
        button.disabled = !enabled;
      }
    });
  }
  
  /**
   * Update minimap
   * @private
   */
  _updateMinimap() {
    if (!this.minimap) return;
    
    const canvas = this.minimap.querySelector('canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw simplified tree structure
    // This would typically render a miniature version of the tree
    ctx.fillStyle = '#ddd';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.fillText('Tree Overview', 10, 20);
  }
  
  /**
   * Apply theme styles
   * @private
   */
  _applyTheme() {
    this.container.classList.add(`theme-${this.config.theme}`);
  }
  
  /**
   * Update graph data
   * @param {Object} graphData - New graph data
   */
  updateGraphData(graphData) {
    this.config.graphData = graphData;
    this._buildTreeStructure();
    this._updateMinimap();
    
    // Reset navigation if current node no longer exists
    if (this.currentNode && !this.nodeMap.has(this.currentNode)) {
      this.currentNode = null;
      this.navigationHistory = [];
      this.historyIndex = -1;
    }
    
    this._updateBreadcrumbs();
    this._updateNodeInfo();
    this._updateToolbarState();
  }
  
  /**
   * Destroy the navigation UI
   */
  destroy() {
    if (this.keyboardHandler) {
      const target = this.container.tabIndex >= 0 ? this.container : document;
      target.removeEventListener('keydown', this.keyboardHandler);
    }
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    // Clear state
    this.nodeMap.clear();
    this.parentMap.clear();
    this.childrenMap.clear();
    this.siblingMap.clear();
    this.selectedNodes.clear();
    this.navigationHistory = [];
  }
}

export default TreeNavigationUI;