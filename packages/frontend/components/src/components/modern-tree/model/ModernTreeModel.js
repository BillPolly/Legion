/**
 * ModernTreeModel - Tree data model extending BaseModel
 * 
 * Handles hierarchical data structure, expansion state, selection state,
 * search functionality, and drag/drop operations.
 */

import { BaseModel } from '@legion/components';

export class ModernTreeModel extends BaseModel {
  constructor(data, config) {
    super(null, config); // Don't pass data to super to avoid setData call
    
    // Tree structure maps for O(1) lookups
    this.nodeMap = new Map(); // id -> node
    this.parentMap = new Map(); // childId -> parentId  
    this.childrenMap = new Map(); // parentId -> [childIds]
    this.pathMap = new Map(); // nodeId -> path array
    
    // Tree-specific state
    this.expandedNodes = new Set();
    this.selectedNodes = new Set();
    this.searchQuery = '';
    this.searchResults = new Set();
    this.focusedNode = null;
    this.dragState = null;
    
    // Initialize with data if provided
    if (data) {
      this.setTreeData(data);
    }
  }

  /**
   * Set tree data and build internal maps
   * @param {Array|Object} data - Hierarchical data
   */
  setTreeData(data) {
    // Clear existing state
    this.nodeMap.clear();
    this.parentMap.clear();
    this.childrenMap.clear();
    this.pathMap.clear();
    this.expandedNodes.clear();
    this.selectedNodes.clear();
    this.searchResults.clear();
    
    // Build tree structure
    const nodes = Array.isArray(data) ? data : [data];
    this._buildTreeMaps(nodes, null, []);
    
    // Store the root data using BaseModel method
    super.setData(data);
    
    this._notifyChange('treeDataChanged', { data, nodeCount: this.nodeMap.size });
  }

  /**
   * Override setData to use tree-specific logic
   * @param {Array|Object} data - Hierarchical data
   */
  setData(data) {
    this.setTreeData(data);
  }

  /**
   * Build internal maps for efficient tree operations
   * @private
   */
  _buildTreeMaps(nodes, parentId, parentPath, visited = new Set()) {
    nodes.forEach((node, index) => {
      // Skip if this is a circular reference or invalid node
      if (!node || typeof node !== 'object') return;
      
      // Ensure node has an ID
      if (!node.id) {
        node.id = this._generateNodeId(node, parentId, index);
      }
      
      const nodeId = node.id;
      
      // Prevent circular references
      if (visited.has(nodeId) || parentPath.includes(nodeId)) {
        console.warn(`Circular reference detected for node: ${nodeId}`);
        return;
      }
      
      const nodePath = [...parentPath, nodeId];
      visited.add(nodeId);
      
      // Store node and relationships
      this.nodeMap.set(nodeId, { ...node });
      this.pathMap.set(nodeId, nodePath);
      
      if (parentId) {
        this.parentMap.set(nodeId, parentId);
        
        if (!this.childrenMap.has(parentId)) {
          this.childrenMap.set(parentId, []);
        }
        this.childrenMap.get(parentId).push(nodeId);
      }
      
      // Process children recursively
      if (node.children && Array.isArray(node.children)) {
        this._buildTreeMaps(node.children, nodeId, nodePath, new Set(visited));
      } else {
        // Initialize empty children array for leaf nodes
        this.childrenMap.set(nodeId, []);
      }
    });
  }

  /**
   * Generate unique node ID
   * @private
   */
  _generateNodeId(node, parentId, index) {
    const name = node.name || node.title || 'node';
    const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const prefix = parentId ? `${parentId}_` : 'root_';
    return `${prefix}${safeName}_${index}_${Date.now()}`;
  }

  /**
   * Get node by ID
   * @param {string} nodeId - Node identifier
   * @returns {Object|null} Node data or null
   */
  getNode(nodeId) {
    return this.nodeMap.get(nodeId) || null;
  }

  /**
   * Get node children IDs
   * @param {string} nodeId - Parent node ID
   * @returns {Array} Array of child node IDs
   */
  getNodeChildren(nodeId) {
    return this.childrenMap.get(nodeId) || [];
  }

  /**
   * Get node parent ID
   * @param {string} nodeId - Child node ID
   * @returns {string|null} Parent node ID or null for root nodes
   */
  getNodeParent(nodeId) {
    return this.parentMap.get(nodeId) || null;
  }

  /**
   * Get node path from root
   * @param {string} nodeId - Node ID
   * @returns {Array} Path array of node IDs
   */
  getNodePath(nodeId) {
    return this.pathMap.get(nodeId) || [];
  }

  /**
   * Check if node has children
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node has children
   */
  hasChildren(nodeId) {
    const children = this.childrenMap.get(nodeId);
    return children && children.length > 0;
  }

  /**
   * Get node depth (distance from root)
   * @param {string} nodeId - Node ID
   * @returns {number} Node depth (0 for root nodes)
   */
  getNodeDepth(nodeId) {
    const path = this.getNodePath(nodeId);
    return Math.max(0, path.length - 1);
  }

  /**
   * Get all visible nodes (respecting expansion state)
   * @returns {Array} Array of visible node IDs in display order
   */
  getVisibleNodes() {
    const visible = [];
    const roots = this._getRootNodes();
    
    for (const rootId of roots) {
      this._collectVisibleNodes(rootId, visible);
    }
    
    return visible;
  }

  /**
   * Get root node IDs
   * @private
   */
  _getRootNodes() {
    const roots = [];
    for (const nodeId of this.nodeMap.keys()) {
      if (!this.parentMap.has(nodeId)) {
        roots.push(nodeId);
      }
    }
    return roots;
  }

  /**
   * Recursively collect visible nodes
   * @private
   */
  _collectVisibleNodes(nodeId, visible) {
    visible.push(nodeId);
    
    if (this.isExpanded(nodeId)) {
      const children = this.getNodeChildren(nodeId);
      for (const childId of children) {
        this._collectVisibleNodes(childId, visible);
      }
    }
  }

  // Expansion Management

  /**
   * Expand node
   * @param {string} nodeId - Node ID to expand
   */
  expandNode(nodeId) {
    if (!this.hasChildren(nodeId) || this.isExpanded(nodeId)) return;
    
    this.expandedNodes.add(nodeId);
    this.setMetadata(nodeId, 'expanded', true);
    this._trackChange('nodeExpanded', { nodeId, node: this.getNode(nodeId) });
  }

  /**
   * Collapse node
   * @param {string} nodeId - Node ID to collapse
   */
  collapseNode(nodeId) {
    if (!this.isExpanded(nodeId)) return;
    
    this.expandedNodes.delete(nodeId);
    this.setMetadata(nodeId, 'expanded', false);
    this._trackChange('nodeCollapsed', { nodeId, node: this.getNode(nodeId) });
  }

  /**
   * Toggle node expansion
   * @param {string} nodeId - Node ID to toggle
   */
  toggleNode(nodeId) {
    if (this.isExpanded(nodeId)) {
      this.collapseNode(nodeId);
    } else {
      this.expandNode(nodeId);
    }
  }

  /**
   * Check if node is expanded
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node is expanded
   */
  isExpanded(nodeId) {
    return this.expandedNodes.has(nodeId);
  }

  /**
   * Expand all nodes
   */
  expandAll() {
    this.startBatch();
    for (const nodeId of this.nodeMap.keys()) {
      if (this.hasChildren(nodeId)) {
        this.expandNode(nodeId);
      }
    }
    this.endBatch();
  }

  /**
   * Collapse all nodes
   */
  collapseAll() {
    this.startBatch();
    this.expandedNodes.clear();
    for (const nodeId of this.nodeMap.keys()) {
      this.setMetadata(nodeId, 'expanded', false);
    }
    this._trackChange('allNodesCollapsed', {});
    this.endBatch();
  }

  /**
   * Expand to specific depth
   * @param {number} depth - Target depth (0 = only roots visible)
   */
  expandToDepth(depth) {
    this.startBatch();
    this.collapseAll();
    
    for (const nodeId of this.nodeMap.keys()) {
      if (this.getNodeDepth(nodeId) < depth && this.hasChildren(nodeId)) {
        this.expandNode(nodeId);
      }
    }
    this.endBatch();
  }

  // Selection Management

  /**
   * Select node
   * @param {string} nodeId - Node ID to select
   * @param {boolean} extend - If true, extend selection (for multiple mode)
   */
  selectNode(nodeId, extend = false) {
    if (this.config.selectable === 'none') return;
    
    const wasSelected = this.isSelected(nodeId);
    
    // Handle selection mode
    if (this.config.selectable === 'single' || !extend) {
      this.clearSelection();
    }
    
    if (!wasSelected) {
      this.selectedNodes.add(nodeId);
      this.setMetadata(nodeId, 'selected', true);
      this._trackChange('nodeSelected', { 
        nodeId, 
        node: this.getNode(nodeId),
        selectedNodes: Array.from(this.selectedNodes)
      });
    }
  }

  /**
   * Deselect node
   * @param {string} nodeId - Node ID to deselect
   */
  deselectNode(nodeId) {
    if (!this.isSelected(nodeId)) return;
    
    this.selectedNodes.delete(nodeId);
    this.setMetadata(nodeId, 'selected', false);
    this._trackChange('nodeDeselected', { 
      nodeId, 
      node: this.getNode(nodeId),
      selectedNodes: Array.from(this.selectedNodes)
    });
  }

  /**
   * Toggle node selection
   * @param {string} nodeId - Node ID to toggle
   * @param {boolean} extend - If true, extend selection
   */
  toggleSelection(nodeId, extend = false) {
    if (this.isSelected(nodeId)) {
      this.deselectNode(nodeId);
    } else {
      this.selectNode(nodeId, extend);
    }
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    const previouslySelected = Array.from(this.selectedNodes);
    this.selectedNodes.clear();
    
    for (const nodeId of previouslySelected) {
      this.setMetadata(nodeId, 'selected', false);
    }
    
    if (previouslySelected.length > 0) {
      this._trackChange('selectionCleared', { previouslySelected });
    }
  }

  /**
   * Check if node is selected
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node is selected
   */
  isSelected(nodeId) {
    return this.selectedNodes.has(nodeId);
  }

  /**
   * Get selected node IDs
   * @returns {Array} Array of selected node IDs
   */
  getSelectedNodes() {
    return Array.from(this.selectedNodes);
  }

  // Search Functionality

  /**
   * Search nodes by query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  search(query, options = {}) {
    this.searchQuery = query;
    this.searchResults.clear();
    
    if (!query.trim()) {
      this._trackChange('searchCleared', {});
      return [];
    }
    
    const {
      fields = ['name', 'title'],
      caseSensitive = false,
      wholeWord = false,
      expandResults = true
    } = options;
    
    const searchTerm = caseSensitive ? query : query.toLowerCase();
    const results = [];
    
    for (const [nodeId, node] of this.nodeMap.entries()) {
      if (this._matchesSearch(node, searchTerm, fields, caseSensitive, wholeWord)) {
        this.searchResults.add(nodeId);
        results.push({
          nodeId,
          node,
          path: this.getNodePath(nodeId)
        });
      }
    }
    
    // Optionally expand ancestors of search results
    if (expandResults) {
      this._expandSearchResults();
    }
    
    this._trackChange('searchPerformed', { 
      query, 
      results: results.length, 
      resultIds: Array.from(this.searchResults) 
    });
    
    return results;
  }

  /**
   * Check if node matches search criteria
   * @private
   */
  _matchesSearch(node, searchTerm, fields, caseSensitive, wholeWord) {
    for (const field of fields) {
      if (!node[field]) continue;
      
      const fieldValue = caseSensitive ? node[field] : node[field].toLowerCase();
      
      if (wholeWord) {
        const words = fieldValue.split(/\s+/);
        if (words.includes(searchTerm)) return true;
      } else {
        if (fieldValue.includes(searchTerm)) return true;
      }
    }
    return false;
  }

  /**
   * Expand ancestors of search results
   * @private
   */
  _expandSearchResults() {
    for (const nodeId of this.searchResults) {
      const path = this.getNodePath(nodeId);
      for (const ancestorId of path.slice(0, -1)) {
        this.expandNode(ancestorId);
      }
    }
  }

  /**
   * Clear search
   */
  clearSearch() {
    this.searchQuery = '';
    this.searchResults.clear();
    this._trackChange('searchCleared', {});
  }

  /**
   * Check if node is in search results
   * @param {string} nodeId - Node ID
   * @returns {boolean} True if node matches search
   */
  isSearchResult(nodeId) {
    return this.searchResults.has(nodeId);
  }

  // Focus Management

  /**
   * Set focused node
   * @param {string} nodeId - Node ID to focus
   */
  setFocusedNode(nodeId) {
    const oldFocused = this.focusedNode;
    this.focusedNode = nodeId;
    
    if (oldFocused) {
      this.setMetadata(oldFocused, 'focused', false);
    }
    if (nodeId) {
      this.setMetadata(nodeId, 'focused', true);
    }
    
    this._trackChange('focusChanged', { 
      oldFocused, 
      newFocused: nodeId,
      node: nodeId ? this.getNode(nodeId) : null
    });
  }

  /**
   * Get focused node ID
   * @returns {string|null} Focused node ID or null
   */
  getFocusedNode() {
    return this.focusedNode;
  }

  // Statistics and Info

  /**
   * Get tree statistics
   * @returns {Object} Tree statistics
   */
  getTreeStats() {
    const stats = this.getStats();
    
    return {
      ...stats,
      totalNodes: this.nodeMap.size,
      rootNodes: this._getRootNodes().length,
      expandedNodes: this.expandedNodes.size,
      selectedNodes: this.selectedNodes.size,
      searchResults: this.searchResults.size,
      maxDepth: this._getMaxDepth(),
      visibleNodes: this.getVisibleNodes().length
    };
  }

  /**
   * Get maximum tree depth
   * @private
   */
  _getMaxDepth() {
    let maxDepth = 0;
    for (const nodeId of this.nodeMap.keys()) {
      maxDepth = Math.max(maxDepth, this.getNodeDepth(nodeId));
    }
    return maxDepth;
  }

  /**
   * Export tree state
   * @returns {Object} Complete tree state
   */
  exportTreeState() {
    const baseState = this.exportState();
    
    return {
      ...baseState,
      expandedNodes: Array.from(this.expandedNodes),
      selectedNodes: Array.from(this.selectedNodes),
      searchQuery: this.searchQuery,
      searchResults: Array.from(this.searchResults),
      focusedNode: this.focusedNode
    };
  }

  /**
   * Import tree state
   * @param {Object} state - Tree state to import
   */
  importTreeState(state) {
    this.importState(state);
    
    if (state.expandedNodes) {
      this.expandedNodes = new Set(state.expandedNodes);
    }
    if (state.selectedNodes) {
      this.selectedNodes = new Set(state.selectedNodes);
    }
    if (state.searchQuery !== undefined) {
      this.searchQuery = state.searchQuery;
    }
    if (state.searchResults) {
      this.searchResults = new Set(state.searchResults);
    }
    if (state.focusedNode !== undefined) {
      this.focusedNode = state.focusedNode;
    }
    
    this._trackChange('treeStateImported', { state });
  }

  /**
   * Validate tree structure
   * @returns {Object} Validation result
   */
  validateTreeStructure() {
    const errors = [];
    const warnings = [];
    const visited = new Set();
    
    // Check for circular references and orphaned nodes
    for (const nodeId of this.nodeMap.keys()) {
      if (this._hasCircularReference(nodeId, visited)) {
        errors.push(`Circular reference detected for node: ${nodeId}`);
      }
    }
    
    // Check for inconsistent parent-child relationships
    for (const [childId, parentId] of this.parentMap.entries()) {
      const parentChildren = this.childrenMap.get(parentId) || [];
      if (!parentChildren.includes(childId)) {
        errors.push(`Inconsistent parent-child relationship: ${parentId} -> ${childId}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check for circular references
   * @private
   */
  _hasCircularReference(nodeId, visited, path = new Set()) {
    if (path.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    path.add(nodeId);
    
    const children = this.getNodeChildren(nodeId);
    for (const childId of children) {
      if (this._hasCircularReference(childId, visited, path)) {
        return true;
      }
    }
    
    path.delete(nodeId);
    return false;
  }
}