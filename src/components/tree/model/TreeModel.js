/**
 * TreeModel - Data layer for the tree component
 * 
 * Manages hierarchical data, expansion state, selection, and drag & drop operations
 * following the Model layer of MVVM pattern.
 */
export class TreeModel {
  constructor(data, config) {
    this.data = [...data];
    this.config = config;
    
    // State tracking
    this.expandedNodes = new Set();
    this.selectedNodes = new Set();
    this.expandedNodesHistory = new Map(); // Track expansion history for animations
    
    // Node operations
    this.getChildren = config.getChildren || ((node) => node.children || []);
    this.getNodeId = config.getNodeId || ((node) => node.id || node.name || JSON.stringify(node));
    
    // Drag & drop state
    this.isDragging = false;
    this.draggedNode = null;
    this.draggedNodeId = null;
    this.dropTarget = null;
    this.dropPosition = null; // 'before', 'after', 'inside'
    
    // Build internal node map for efficient lookups
    this.nodeMap = new Map();
    this.parentMap = new Map();
    this.buildNodeMaps();
  }
  
  /**
   * Build internal maps for efficient node operations
   */
  buildNodeMaps() {
    this.nodeMap.clear();
    this.parentMap.clear();
    
    const visited = new Set();
    const traverse = (nodes, parent = null, depth = 0) => {
      // Prevent infinite recursion
      if (depth > 100) {
        console.warn('TreeModel: Maximum depth exceeded, possible circular reference');
        return;
      }
      
      nodes.forEach(node => {
        let nodeId;
        try {
          nodeId = this.getNodeId(node);
        } catch (error) {
          console.warn('TreeModel: Unable to get node ID, skipping node');
          return;
        }
        
        if (visited.has(nodeId)) {
          console.warn(`TreeModel: Duplicate node ID "${nodeId}" detected, skipping`);
          return;
        }
        
        visited.add(nodeId);
        this.nodeMap.set(nodeId, node);
        if (parent) {
          try {
            this.parentMap.set(nodeId, this.getNodeId(parent));
          } catch (error) {
            console.warn('TreeModel: Unable to get parent node ID');
          }
        }
        
        const children = this.getChildren(node);
        if (children && children.length > 0) {
          traverse(children, node, depth + 1);
        }
      });
    };
    
    try {
      traverse(this.data);
    } catch (error) {
      console.error('TreeModel: Error building node maps:', error);
    }
  }
  
  /**
   * Get node by ID
   */
  getNode(nodeId) {
    return this.nodeMap.get(nodeId);
  }
  
  /**
   * Get parent node ID
   */
  getParentId(nodeId) {
    return this.parentMap.get(nodeId);
  }
  
  /**
   * Get all ancestor IDs of a node
   */
  getAncestorIds(nodeId) {
    const ancestors = [];
    let currentId = this.getParentId(nodeId);
    
    while (currentId) {
      ancestors.unshift(currentId);
      currentId = this.getParentId(currentId);
    }
    
    return ancestors;
  }
  
  /**
   * Check if node has children
   */
  hasChildren(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return false;
    
    const children = this.getChildren(node);
    return children && children.length > 0;
  }
  
  /**
   * Get children of a node
   */
  getNodeChildren(nodeId) {
    const node = this.getNode(nodeId);
    if (!node) return [];
    
    return this.getChildren(node) || [];
  }
  
  /**
   * Expansion state management
   */
  isExpanded(nodeId) {
    return this.expandedNodes.has(nodeId);
  }
  
  expand(nodeId) {
    if (this.hasChildren(nodeId)) {
      const wasExpanded = this.expandedNodes.has(nodeId);
      this.expandedNodes.add(nodeId);
      this.expandedNodesHistory.set(nodeId, Date.now());
      return !wasExpanded; // Return true if state changed
    }
    return false;
  }
  
  collapse(nodeId) {
    const wasExpanded = this.expandedNodes.has(nodeId);
    this.expandedNodes.delete(nodeId);
    return wasExpanded; // Return true if state changed
  }
  
  toggleExpansion(nodeId) {
    if (this.isExpanded(nodeId)) {
      return { action: 'collapse', changed: this.collapse(nodeId) };
    } else {
      return { action: 'expand', changed: this.expand(nodeId) };
    }
  }
  
  /**
   * Expand all ancestors of a node (useful for revealing selected nodes)
   */
  expandToNode(nodeId) {
    const ancestors = this.getAncestorIds(nodeId);
    let changed = false;
    
    ancestors.forEach(ancestorId => {
      if (this.expand(ancestorId)) {
        changed = true;
      }
    });
    
    return changed;
  }
  
  /**
   * Selection management
   */
  isSelected(nodeId) {
    return this.selectedNodes.has(nodeId);
  }
  
  select(nodeId) {
    if (this.config.selectable === 'none') return false;
    
    if (this.config.selectable === 'single') {
      this.selectedNodes.clear();
    }
    
    this.selectedNodes.add(nodeId);
    return true;
  }
  
  deselect(nodeId) {
    return this.selectedNodes.delete(nodeId);
  }
  
  clearSelection() {
    const hadSelection = this.selectedNodes.size > 0;
    this.selectedNodes.clear();
    return hadSelection;
  }
  
  getSelectedNodes() {
    return Array.from(this.selectedNodes).map(id => this.getNode(id)).filter(Boolean);
  }
  
  getSelectedIds() {
    return Array.from(this.selectedNodes);
  }
  
  /**
   * Drag & Drop operations
   */
  startDrag(nodeId) {
    const node = this.getNode(nodeId);
    if (!node || !this.config.draggable) return false;
    
    this.isDragging = true;
    this.draggedNode = node;
    this.draggedNodeId = nodeId;
    return true;
  }
  
  updateDropTarget(targetNodeId, position) {
    this.dropTarget = targetNodeId;
    this.dropPosition = position;
  }
  
  canDrop(targetNodeId, position) {
    if (!this.isDragging || !this.draggedNodeId || !targetNodeId) return false;
    
    // Can't drop on itself
    if (this.draggedNodeId === targetNodeId) return false;
    
    // Can't drop inside a descendant (would create infinite loop)
    if (this.isDescendant(targetNodeId, this.draggedNodeId)) return false;
    
    // Position-specific validation
    if (position === 'inside') {
      // Only allow dropping inside if target can have children
      return this.hasChildren(targetNodeId) || this.config.allowDropIntoLeaves;
    }
    
    return true;
  }
  
  isDescendant(nodeId, ancestorId) {
    const ancestors = this.getAncestorIds(nodeId);
    return ancestors.includes(ancestorId);
  }
  
  completeDrop() {
    if (!this.isDragging || !this.canDrop(this.dropTarget, this.dropPosition)) {
      this.cancelDrag();
      return null;
    }
    
    const result = {
      draggedNode: this.draggedNode,
      draggedNodeId: this.draggedNodeId,
      targetNodeId: this.dropTarget,
      position: this.dropPosition
    };
    
    // Perform the actual move operation
    this.moveNode(this.draggedNodeId, this.dropTarget, this.dropPosition);
    
    this.cancelDrag();
    return result;
  }
  
  cancelDrag() {
    this.isDragging = false;
    this.draggedNode = null;
    this.draggedNodeId = null;
    this.dropTarget = null;
    this.dropPosition = null;
  }
  
  /**
   * Move a node to a new position
   */
  moveNode(sourceNodeId, targetNodeId, position) {
    const sourceNode = this.getNode(sourceNodeId);
    const targetNode = this.getNode(targetNodeId);
    
    if (!sourceNode || !targetNode) return false;
    
    // Remove from current parent
    const oldParentId = this.getParentId(sourceNodeId);
    if (oldParentId) {
      const oldParent = this.getNode(oldParentId);
      const oldChildren = this.getChildren(oldParent);
      const sourceIndex = oldChildren.findIndex(child => this.getNodeId(child) === sourceNodeId);
      if (sourceIndex >= 0) {
        oldChildren.splice(sourceIndex, 1);
      }
    } else {
      // Remove from root level
      const sourceIndex = this.data.findIndex(node => this.getNodeId(node) === sourceNodeId);
      if (sourceIndex >= 0) {
        this.data.splice(sourceIndex, 1);
      }
    }
    
    // Add to new position
    if (position === 'inside') {
      // Add as child of target
      let targetChildren = this.getChildren(targetNode);
      if (!targetChildren) {
        targetNode.children = [];
        targetChildren = targetNode.children;
      }
      targetChildren.push(sourceNode);
    } else {
      // Add as sibling of target
      const targetParentId = this.getParentId(targetNodeId);
      let targetParent, targetSiblings;
      
      if (targetParentId) {
        targetParent = this.getNode(targetParentId);
        targetSiblings = this.getChildren(targetParent);
      } else {
        targetSiblings = this.data;
      }
      
      const targetIndex = targetSiblings.findIndex(child => this.getNodeId(child) === targetNodeId);
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      targetSiblings.splice(insertIndex, 0, sourceNode);
    }
    
    // Rebuild maps after structural change
    this.buildNodeMaps();
    return true;
  }
  
  /**
   * Get all visible nodes (respecting expansion state) in display order
   */
  getVisibleNodes() {
    const result = [];
    
    const traverse = (nodes, depth = 0) => {
      nodes.forEach(node => {
        const nodeId = this.getNodeId(node);
        result.push({
          node,
          nodeId,
          depth,
          hasChildren: this.hasChildren(nodeId),
          isExpanded: this.isExpanded(nodeId),
          isSelected: this.isSelected(nodeId)
        });
        
        // Only traverse children if node is expanded
        if (this.isExpanded(nodeId)) {
          const children = this.getChildren(node);
          if (children && children.length > 0) {
            traverse(children, depth + 1);
          }
        }
      });
    };
    
    traverse(this.data);
    return result;
  }
  
  /**
   * Get flat list of all nodes (regardless of expansion state)
   */
  getAllNodes() {
    const result = [];
    
    const traverse = (nodes, depth = 0) => {
      nodes.forEach(node => {
        const nodeId = this.getNodeId(node);
        result.push({
          node,
          nodeId,
          depth,
          hasChildren: this.hasChildren(nodeId),
          isExpanded: this.isExpanded(nodeId),
          isSelected: this.isSelected(nodeId)
        });
        
        const children = this.getChildren(node);
        if (children && children.length > 0) {
          traverse(children, depth + 1);
        }
      });
    };
    
    traverse(this.data);
    return result;
  }
  
  /**
   * Search functionality
   */
  searchNodes(searchTerm, searchField = 'name') {
    if (!searchTerm || searchTerm.trim() === '') return [];
    
    const term = searchTerm.toLowerCase();
    const matches = [];
    
    this.getAllNodes().forEach(({ node, nodeId, depth }) => {
      const searchValue = node[searchField];
      if (searchValue && searchValue.toString().toLowerCase().includes(term)) {
        matches.push({ node, nodeId, depth });
      }
    });
    
    return matches;
  }
  
  /**
   * Expand all nodes that match search results (for revealing search results)
   */
  expandSearchResults(searchMatches) {
    let changed = false;
    
    searchMatches.forEach(({ nodeId }) => {
      if (this.expandToNode(nodeId)) {
        changed = true;
      }
    });
    
    return changed;
  }
  
  /**
   * Utility methods
   */
  getStats() {
    const allNodes = this.getAllNodes();
    return {
      totalNodes: allNodes.length,
      expandedNodes: this.expandedNodes.size,
      selectedNodes: this.selectedNodes.size,
      maxDepth: Math.max(...allNodes.map(n => n.depth), 0)
    };
  }
  
  /**
   * Export/import state for persistence
   */
  exportState() {
    return {
      expandedNodes: Array.from(this.expandedNodes),
      selectedNodes: Array.from(this.selectedNodes)
    };
  }
  
  importState(state) {
    if (state.expandedNodes) {
      this.expandedNodes = new Set(state.expandedNodes);
    }
    if (state.selectedNodes) {
      this.selectedNodes = new Set(state.selectedNodes);
    }
  }
}