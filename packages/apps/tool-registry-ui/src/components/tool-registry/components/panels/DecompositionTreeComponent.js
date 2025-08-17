/**
 * DecompositionTreeComponent
 * Interactive tree visualization for hierarchical task decomposition
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages tree data and state
 */
class DecompositionTreeModel {
  constructor() {
    this.state = {
      tree: null,
      selectedNodeId: null,
      expandedNodes: new Set(),
      highlightedComplexity: null,
      filter: null,
      hoveredNodeId: null
    };
    
    this.listeners = new Set();
  }

  getState(key) {
    return key ? this.state[key] : { ...this.state };
  }

  updateState(key, value) {
    this.state[key] = value;
    this.notifyListeners({ [key]: value });
  }

  setTree(tree) {
    this.state.tree = tree;
    // Initialize all nodes as expanded
    if (tree) {
      this.initializeExpandedNodes(tree);
    }
    this.notifyListeners({ tree });
  }

  getTree() {
    return this.state.tree;
  }

  initializeExpandedNodes(node) {
    if (node.children && node.children.length > 0) {
      this.state.expandedNodes.add(node.id);
      node.children.forEach(child => this.initializeExpandedNodes(child));
    }
  }

  findNodeInTree(nodeId, currentNode = this.state.tree) {
    if (!currentNode) return null;
    
    if (currentNode.id === nodeId) {
      return currentNode;
    }
    
    if (currentNode.children) {
      for (const child of currentNode.children) {
        const found = this.findNodeInTree(nodeId, child);
        if (found) return found;
      }
    }
    
    return null;
  }

  updateNodeInTree(nodeId, updates, currentNode = this.state.tree) {
    if (!currentNode) return false;
    
    if (currentNode.id === nodeId) {
      Object.assign(currentNode, updates);
      return true;
    }
    
    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (this.updateNodeInTree(nodeId, updates, child)) {
          return true;
        }
      }
    }
    
    return false;
  }

  addChildToNode(parentId, childNode, currentNode = this.state.tree) {
    if (!currentNode) return false;
    
    if (currentNode.id === parentId) {
      if (!currentNode.children) {
        currentNode.children = [];
      }
      currentNode.children.push(childNode);
      this.state.expandedNodes.add(parentId);
      return true;
    }
    
    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (this.addChildToNode(parentId, childNode, child)) {
          return true;
        }
      }
    }
    
    return false;
  }

  removeNodeFromTree(nodeId, currentNode = this.state.tree, parent = null) {
    if (!currentNode) return false;
    
    if (currentNode.id === nodeId && parent) {
      const index = parent.children.indexOf(currentNode);
      if (index > -1) {
        parent.children.splice(index, 1);
        return true;
      }
    }
    
    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (this.removeNodeFromTree(nodeId, child, currentNode)) {
          return true;
        }
      }
    }
    
    return false;
  }

  toggleNodeExpansion(nodeId) {
    if (this.state.expandedNodes.has(nodeId)) {
      this.state.expandedNodes.delete(nodeId);
    } else {
      this.state.expandedNodes.add(nodeId);
    }
    this.notifyListeners({ expandedNodes: this.state.expandedNodes });
  }

  setSelectedNode(nodeId) {
    this.state.selectedNodeId = nodeId;
    this.notifyListeners({ selectedNodeId: nodeId });
  }

  setHighlightedComplexity(complexity) {
    this.state.highlightedComplexity = complexity;
    this.notifyListeners({ highlightedComplexity: complexity });
  }

  setFilter(filter) {
    this.state.filter = filter;
    this.notifyListeners({ filter });
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners(changes) {
    this.listeners.forEach(listener => listener(changes));
  }

  reset() {
    this.state = {
      tree: null,
      selectedNodeId: null,
      expandedNodes: new Set(),
      highlightedComplexity: null,
      filter: null,
      hoveredNodeId: null
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders tree UI and handles DOM updates
 */
class DecompositionTreeView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="decomposition-tree-component">
        <div class="tree-header">
          <div class="tree-summary"></div>
          <div class="tree-controls">
            <button class="expand-all-btn" title="Expand all">⊕</button>
            <button class="collapse-all-btn" title="Collapse all">⊖</button>
          </div>
        </div>
        <div class="tree-container">
          <div class="empty-tree">No decomposition available</div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    const expandAllBtn = this.container.querySelector('.expand-all-btn');
    expandAllBtn.addEventListener('click', () => {
      this.viewModel.expandAll();
    });

    const collapseAllBtn = this.container.querySelector('.collapse-all-btn');
    collapseAllBtn.addEventListener('click', () => {
      this.viewModel.collapseAll();
    });
  }

  renderTree(tree, expandedNodes, selectedNodeId, highlightedComplexity, filter) {
    const treeContainer = this.container.querySelector('.tree-container');
    
    if (!tree) {
      treeContainer.innerHTML = '<div class="empty-tree">No decomposition available</div>';
      return;
    }
    
    treeContainer.innerHTML = this.renderNode(tree, 0, expandedNodes, selectedNodeId, highlightedComplexity, filter);
    
    // Bind node events
    this.bindNodeEvents();
    
    // Update summary
    this.updateSummary(tree);
  }

  renderNode(node, level, expandedNodes, selectedNodeId, highlightedComplexity, filter) {
    if (!node) return '';
    
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.id === selectedNodeId;
    const isHighlighted = highlightedComplexity && node.complexity === highlightedComplexity;
    const isFiltered = filter && !this.nodeMatchesFilter(node, filter);
    
    const nodeClasses = [
      'tree-node',
      `level-${level}`,
      isSelected ? 'selected' : '',
      isHighlighted ? 'highlighted' : '',
      isFiltered ? 'filtered' : '',
      hasChildren && !isExpanded ? 'collapsed' : ''
    ].filter(Boolean).join(' ');
    
    let html = `
      <div class="${nodeClasses}" data-node-id="${node.id}">
        <div class="node-content" style="padding-left: ${level * 20}px">
          ${hasChildren ? `
            <span class="expand-icon">${isExpanded ? '▼' : '▶'}</span>
          ` : '<span class="node-bullet">•</span>'}
          <span class="node-description">${node.description || node.id}</span>
          ${node.complexity ? `
            <span class="complexity-badge ${node.complexity.toLowerCase()}">${node.complexity}</span>
          ` : ''}
        </div>
    `;
    
    if (hasChildren && isExpanded) {
      html += '<div class="node-children">';
      for (const child of node.children) {
        html += this.renderNode(child, level + 1, expandedNodes, selectedNodeId, highlightedComplexity, filter);
      }
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  nodeMatchesFilter(node, filter) {
    const searchTerm = filter.toLowerCase();
    
    // Check node description
    if (node.description && node.description.toLowerCase().includes(searchTerm)) {
      return true;
    }
    
    // Check node id
    if (node.id && node.id.toLowerCase().includes(searchTerm)) {
      return true;
    }
    
    // Check children
    if (node.children) {
      return node.children.some(child => this.nodeMatchesFilter(child, filter));
    }
    
    return false;
  }

  bindNodeEvents() {
    // Node selection
    const nodes = this.container.querySelectorAll('.tree-node');
    nodes.forEach(nodeElement => {
      const nodeId = nodeElement.dataset.nodeId;
      const nodeContent = nodeElement.querySelector('.node-content');
      
      nodeContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('expand-icon')) {
          this.viewModel.toggleNodeExpansion(nodeId);
        } else {
          this.viewModel.selectNode(nodeId);
        }
      });
      
      nodeElement.addEventListener('mouseenter', () => {
        this.viewModel.handleNodeHover(nodeId);
      });
    });
  }

  updateSummary(tree) {
    const summary = this.container.querySelector('.tree-summary');
    const nodeCount = this.countNodes(tree);
    summary.textContent = `${nodeCount} tasks`;
  }

  countNodes(node) {
    if (!node) return 0;
    
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countNodes(child);
      }
    }
    return count;
  }

  highlightNodes(nodeIds) {
    const nodes = this.container.querySelectorAll('.tree-node');
    nodes.forEach(node => {
      if (nodeIds.includes(node.dataset.nodeId)) {
        node.classList.add('highlighted');
      } else {
        node.classList.remove('highlighted');
      }
    });
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class DecompositionTreeViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeAPI();
  }

  exposeAPI() {
    const api = {
      setTree: this.setTree.bind(this),
      getTree: this.getTree.bind(this),
      findNode: this.findNode.bind(this),
      getTreeDepth: this.getTreeDepth.bind(this),
      getNodeCount: this.getNodeCount.bind(this),
      getNodesByComplexity: this.getNodesByComplexity.bind(this),
      getLeafNodes: this.getLeafNodes.bind(this),
      selectNode: this.selectNode.bind(this),
      expandNode: this.expandNode.bind(this),
      collapseNode: this.collapseNode.bind(this),
      toggleNodeExpansion: this.toggleNodeExpansion.bind(this),
      expandAll: this.expandAll.bind(this),
      collapseAll: this.collapseAll.bind(this),
      highlightComplexity: this.highlightComplexity.bind(this),
      clearSelection: this.clearSelection.bind(this),
      updateNode: this.updateNode.bind(this),
      addChildNode: this.addChildNode.bind(this),
      removeNode: this.removeNode.bind(this),
      filterNodes: this.filterNodes.bind(this),
      clearFilter: this.clearFilter.bind(this),
      getComplexityStats: this.getComplexityStats.bind(this),
      getNodePath: this.getNodePath.bind(this)
    };
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
    
    this.api = api;
  }

  onModelChange(changes) {
    // Re-render tree when any relevant state changes
    if ('tree' in changes || 'expandedNodes' in changes || 
        'selectedNodeId' in changes || 'highlightedComplexity' in changes || 
        'filter' in changes) {
      this.view.renderTree(
        this.model.getTree(),
        this.model.getState('expandedNodes'),
        this.model.getState('selectedNodeId'),
        this.model.getState('highlightedComplexity'),
        this.model.getState('filter')
      );
    }
  }

  // Tree data methods
  setTree(tree) {
    this.model.setTree(tree);
  }

  getTree() {
    return this.model.getTree();
  }

  findNode(nodeId) {
    return this.model.findNodeInTree(nodeId);
  }

  getTreeDepth(node = this.model.getTree()) {
    if (!node) return 0;
    
    if (!node.children || node.children.length === 0) {
      return 1;
    }
    
    return 1 + Math.max(...node.children.map(child => this.getTreeDepth(child)));
  }

  getNodeCount(node = this.model.getTree()) {
    if (!node) return 0;
    
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.getNodeCount(child);
      }
    }
    return count;
  }

  getNodesByComplexity(complexity, node = this.model.getTree(), result = []) {
    if (!node) return result;
    
    if (node.complexity === complexity) {
      result.push(node);
    }
    
    if (node.children) {
      for (const child of node.children) {
        this.getNodesByComplexity(complexity, child, result);
      }
    }
    
    return result;
  }

  getLeafNodes(node = this.model.getTree(), result = []) {
    if (!node) return result;
    
    if (!node.children || node.children.length === 0) {
      result.push(node);
    } else {
      for (const child of node.children) {
        this.getLeafNodes(child, result);
      }
    }
    
    return result;
  }

  // Interaction methods
  selectNode(nodeId) {
    this.model.setSelectedNode(nodeId);
    const node = this.findNode(nodeId);
    if (node && this.umbilical.onNodeSelect) {
      this.umbilical.onNodeSelect(node);
    }
  }

  expandNode(nodeId) {
    if (!this.model.getState('expandedNodes').has(nodeId)) {
      this.model.toggleNodeExpansion(nodeId);
      if (this.umbilical.onNodeExpand) {
        this.umbilical.onNodeExpand(nodeId);
      }
    }
  }

  collapseNode(nodeId) {
    if (this.model.getState('expandedNodes').has(nodeId)) {
      this.model.toggleNodeExpansion(nodeId);
      if (this.umbilical.onNodeCollapse) {
        this.umbilical.onNodeCollapse(nodeId);
      }
    }
  }

  toggleNodeExpansion(nodeId) {
    const isExpanded = this.model.getState('expandedNodes').has(nodeId);
    this.model.toggleNodeExpansion(nodeId);
    
    if (isExpanded && this.umbilical.onNodeCollapse) {
      this.umbilical.onNodeCollapse(nodeId);
    } else if (!isExpanded && this.umbilical.onNodeExpand) {
      this.umbilical.onNodeExpand(nodeId);
    }
  }

  expandAll(node = this.model.getTree()) {
    if (!node) return;
    
    if (node.children && node.children.length > 0) {
      this.model.getState('expandedNodes').add(node.id);
      for (const child of node.children) {
        this.expandAll(child);
      }
    }
    
    // Trigger re-render
    this.model.notifyListeners({ expandedNodes: this.model.getState('expandedNodes') });
  }

  collapseAll(node = this.model.getTree()) {
    if (!node) return;
    
    if (node.children && node.children.length > 0) {
      this.model.getState('expandedNodes').delete(node.id);
      for (const child of node.children) {
        this.collapseAll(child);
      }
    }
    
    // Trigger re-render
    this.model.notifyListeners({ expandedNodes: this.model.getState('expandedNodes') });
  }

  highlightComplexity(complexity) {
    this.model.setHighlightedComplexity(complexity);
  }

  clearSelection() {
    this.model.setSelectedNode(null);
  }

  handleNodeHover(nodeId) {
    const node = this.findNode(nodeId);
    if (node && this.umbilical.onNodeHover) {
      this.umbilical.onNodeHover(node);
    }
  }

  // Tree modification methods
  updateNode(nodeId, updates) {
    const oldNode = this.findNode(nodeId);
    const oldComplexity = oldNode?.complexity;
    
    if (this.model.updateNodeInTree(nodeId, updates)) {
      // Trigger re-render
      this.model.notifyListeners({ tree: this.model.getTree() });
      
      // Notify complexity change if applicable
      if (updates.complexity && updates.complexity !== oldComplexity && this.umbilical.onComplexityChange) {
        this.umbilical.onComplexityChange(nodeId, updates.complexity);
      }
    }
  }

  addChildNode(parentId, childNode) {
    if (this.model.addChildToNode(parentId, childNode)) {
      this.model.notifyListeners({ tree: this.model.getTree() });
    }
  }

  removeNode(nodeId) {
    if (this.model.removeNodeFromTree(nodeId)) {
      this.model.notifyListeners({ tree: this.model.getTree() });
    }
  }

  // Filtering methods
  filterNodes(searchTerm) {
    this.model.setFilter(searchTerm);
  }

  clearFilter() {
    this.model.setFilter(null);
  }

  // Statistics methods
  getComplexityStats(node = this.model.getTree()) {
    const stats = {
      SIMPLE: 0,
      COMPLEX: 0,
      total: 0
    };
    
    if (!node) return stats;
    
    const countComplexity = (n) => {
      stats.total++;
      if (n.complexity === 'SIMPLE') stats.SIMPLE++;
      if (n.complexity === 'COMPLEX') stats.COMPLEX++;
      
      if (n.children) {
        n.children.forEach(countComplexity);
      }
    };
    
    countComplexity(node);
    return stats;
  }

  getNodePath(nodeId, node = this.model.getTree(), path = []) {
    if (!node) return null;
    
    path.push(node.id);
    
    if (node.id === nodeId) {
      return path;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const result = this.getNodePath(nodeId, child, [...path]);
        if (result) return result;
      }
    }
    
    return null;
  }

  // Cleanup
  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * DecompositionTreeComponent - Main component class
 */
export class DecompositionTreeComponent {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'DecompositionTreeComponent');
    
    // Create MVVM components
    const model = new DecompositionTreeModel();
    const view = new DecompositionTreeView(umbilical.dom, null);
    const viewModel = new DecompositionTreeViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}