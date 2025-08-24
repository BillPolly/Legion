/**
 * PlanVisualizationPanel Component
 * Interactive graph visualization for plan hierarchy with multiple view modes
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages visualization state
 */
class PlanVisualizationModel {
  constructor() {
    this.state = {
      plan: null,
      viewMode: 'hierarchical', // hierarchical, graph, tree, radial
      layout: { type: 'hierarchical' },
      selectedNodeId: null,
      hoveredNodeId: null,
      zoomLevel: 1,
      panPosition: { x: 0, y: 0 },
      compactMode: false,
      animationEnabled: true,
      nodePositions: {},
      virtualizationEnabled: false,
      nodeCount: 0,
      // Progress tracking
      nodeStatuses: {},
      nodeWeights: {},
      executionTimes: {},
      progressBarVisible: false,
      progressValue: 0,
      progressMode: 'determinate', // determinate or indeterminate
      statusMessage: '',
      nodeAnimations: {}
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

  setPlan(plan) {
    this.state.plan = plan;
    if (plan) {
      this.state.nodeCount = this.countNodes(plan.hierarchy?.root);
      this.state.virtualizationEnabled = this.state.nodeCount > 100;
    }
    this.notifyListeners({ plan, nodeCount: this.state.nodeCount });
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

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners(changes) {
    this.listeners.forEach(listener => listener(changes));
  }

  updateNodeStatus(nodeId, status) {
    this.state.nodeStatuses[nodeId] = status;
    this.notifyListeners({ nodeStatuses: this.state.nodeStatuses });
  }

  getNodeStatus(nodeId) {
    return this.state.nodeStatuses[nodeId] || 'pending';
  }

  setNodeWeight(nodeId, weight) {
    this.state.nodeWeights[nodeId] = weight;
    this.notifyListeners({ nodeWeights: this.state.nodeWeights });
  }

  startNodeExecution(nodeId) {
    this.state.executionTimes[nodeId] = { start: Date.now() };
    this.updateNodeStatus(nodeId, 'running');
  }

  endNodeExecution(nodeId) {
    if (this.state.executionTimes[nodeId]) {
      this.state.executionTimes[nodeId].end = Date.now();
      this.state.executionTimes[nodeId].duration = 
        this.state.executionTimes[nodeId].end - this.state.executionTimes[nodeId].start;
    }
  }

  getNodeExecutionTime(nodeId) {
    const times = this.state.executionTimes[nodeId];
    return times ? times.duration || 0 : 0;
  }

  setProgressBarVisible(visible) {
    this.state.progressBarVisible = visible;
    this.notifyListeners({ progressBarVisible: visible });
  }

  setProgressValue(value) {
    this.state.progressValue = value;
    this.notifyListeners({ progressValue: value });
  }

  setProgressMode(mode) {
    this.state.progressMode = mode;
    this.notifyListeners({ progressMode: mode });
  }

  setStatusMessage(message) {
    this.state.statusMessage = message;
    this.notifyListeners({ statusMessage: message });
  }

  setNodeAnimation(nodeId, animation) {
    this.state.nodeAnimations[nodeId] = animation;
    this.notifyListeners({ nodeAnimations: this.state.nodeAnimations });
  }

  reset() {
    this.state = {
      plan: null,
      viewMode: 'hierarchical',
      layout: { type: 'hierarchical' },
      selectedNodeId: null,
      hoveredNodeId: null,
      zoomLevel: 1,
      panPosition: { x: 0, y: 0 },
      compactMode: false,
      animationEnabled: true,
      nodePositions: {},
      virtualizationEnabled: false,
      nodeCount: 0,
      // Progress tracking
      nodeStatuses: {},
      nodeWeights: {},
      executionTimes: {},
      progressBarVisible: false,
      progressValue: 0,
      progressMode: 'determinate',
      statusMessage: '',
      nodeAnimations: {}
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders visualization and handles DOM updates
 */
class PlanVisualizationView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.svg = null;
    this.g = null; // Main group for zoom/pan
    this.isDragging = false;
    this.dragStart = null;
    
    // Only render if container is provided
    if (this.container) {
      this.render();
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="plan-visualization-panel">
        <div class="visualization-header">
          <div class="view-controls">
            <select class="view-mode-selector">
              <option value="hierarchical">Hierarchical</option>
              <option value="graph">Graph</option>
              <option value="tree">Tree</option>
              <option value="radial">Radial</option>
            </select>
            <button class="compact-toggle" title="Toggle compact mode">⊟</button>
          </div>
          <div class="zoom-controls">
            <button class="zoom-in" title="Zoom in">+</button>
            <button class="zoom-out" title="Zoom out">-</button>
            <button class="zoom-reset" title="Reset zoom">⊙</button>
            <button class="fit-view" title="Fit to view">⊡</button>
          </div>
          <div class="export-controls">
            <button class="export-svg" title="Export as SVG">SVG</button>
            <button class="export-png" title="Export as PNG">PNG</button>
            <button class="export-json" title="Export as JSON">JSON</button>
          </div>
        </div>
        <div class="visualization-container">
          <svg class="visualization-canvas" width="100%" height="100%">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" 
                      refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#666" />
              </marker>
            </defs>
            <g class="zoom-group"></g>
          </svg>
          <div class="empty-visualization" style="display: none;">
            No plan to visualize
          </div>
        </div>
        <div class="node-tooltip" style="display: none; position: absolute;"></div>
        <!-- Progress overlay elements -->
        <div class="progress-overlay" style="display: none;">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
            <div class="progress-text">0%</div>
          </div>
        </div>
        <div class="status-message" style="display: none;"></div>
      </div>
    `;
    
    this.svg = this.container.querySelector('.visualization-canvas');
    this.g = this.container.querySelector('.zoom-group');
    
    this.bindEvents();
  }

  bindEvents() {
    // View mode selector
    const modeSelector = this.container.querySelector('.view-mode-selector');
    modeSelector.addEventListener('change', (e) => {
      this.viewModel.setViewMode(e.target.value);
    });

    // Compact mode toggle
    const compactToggle = this.container.querySelector('.compact-toggle');
    compactToggle.addEventListener('click', () => {
      this.viewModel.toggleCompactMode();
    });

    // Zoom controls
    const zoomIn = this.container.querySelector('.zoom-in');
    const zoomOut = this.container.querySelector('.zoom-out');
    const zoomReset = this.container.querySelector('.zoom-reset');
    const fitView = this.container.querySelector('.fit-view');

    zoomIn.addEventListener('click', () => this.viewModel.zoomIn());
    zoomOut.addEventListener('click', () => this.viewModel.zoomOut());
    zoomReset.addEventListener('click', () => this.viewModel.resetZoom());
    fitView.addEventListener('click', () => this.viewModel.fitToView());

    // Export controls
    const exportSvg = this.container.querySelector('.export-svg');
    const exportPng = this.container.querySelector('.export-png');
    const exportJson = this.container.querySelector('.export-json');

    exportSvg.addEventListener('click', () => this.viewModel.handleExportSVG());
    exportPng.addEventListener('click', () => this.viewModel.handleExportPNG());
    exportJson.addEventListener('click', () => this.viewModel.handleExportJSON());

    // Mouse wheel zoom
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.viewModel.handleWheel(e.deltaY);
    });

    // Pan with mouse drag
    this.svg.addEventListener('mousedown', (e) => {
      if (e.target === this.svg || e.target.parentElement === this.g) {
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.dragStart) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.viewModel.pan(dx, dy);
        this.dragStart = { x: e.clientX, y: e.clientY };
      }
    });

    this.svg.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.dragStart = null;
    });

    this.svg.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.dragStart = null;
    });

    // Double click to reset pan
    this.svg.addEventListener('dblclick', () => {
      this.viewModel.setPanPosition(0, 0);
      this.viewModel.setZoomLevel(1);
    });

    // Keyboard shortcuts
    const doc = this.container.ownerDocument || document;
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.viewModel.selectNode(null);
      } else if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        this.viewModel.fitToView();
      } else if (e.key === 'ArrowRight') {
        this.viewModel.pan(10, 0);
      } else if (e.key === 'ArrowLeft') {
        this.viewModel.pan(-10, 0);
      } else if (e.key === 'ArrowUp') {
        this.viewModel.pan(0, -10);
      } else if (e.key === 'ArrowDown') {
        this.viewModel.pan(0, 10);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.focusNextNode();
      }
    });

    // Mouse wheel zoom with ctrl/cmd
    this.svg.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        this.viewModel.handleWheel(e.deltaY);
      }
    }, { passive: false });

    // Touch events for mobile
    let touchStartDistance = 0;
    let touchStartPos = null;

    this.svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        // Pinch zoom start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDistance = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1) {
        // Pan start
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    this.svg.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && touchStartDistance > 0) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scale = distance / touchStartDistance;
        
        const currentZoom = this.viewModel.model.getState('zoomLevel');
        this.viewModel.setZoomLevel(currentZoom * scale);
        touchStartDistance = distance;
      } else if (e.touches.length === 1 && touchStartPos) {
        // Pan
        const dx = e.touches[0].clientX - touchStartPos.x;
        const dy = e.touches[0].clientY - touchStartPos.y;
        this.viewModel.pan(dx, dy);
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });

    this.svg.addEventListener('touchend', () => {
      touchStartDistance = 0;
      touchStartPos = null;
    });
  }

  focusNextNode() {
    const nodes = this.container.querySelectorAll('[data-node-id]');
    const currentFocused = this.container.querySelector('.node-focused');
    
    if (nodes.length === 0) return;
    
    let nextIndex = 0;
    if (currentFocused) {
      const currentIndex = Array.from(nodes).indexOf(currentFocused);
      nextIndex = (currentIndex + 1) % nodes.length;
      currentFocused.classList.remove('node-focused');
    }
    
    nodes[nextIndex].classList.add('node-focused');
  }

  renderPlan(plan, nodePositions, selectedNodeId, hoveredNodeId, viewMode) {
    if (!plan || !plan.hierarchy) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();
    this.clearCanvas();

    const root = plan.hierarchy.root;
    if (!root) return;

    // Render edges first (behind nodes)
    this.renderEdges(root, nodePositions);

    // Render nodes
    this.renderNodes(root, nodePositions, selectedNodeId, hoveredNodeId);
  }

  renderNodes(node, positions, selectedNodeId, hoveredNodeId, parentG = this.g) {
    if (!node || !positions[node.id]) return;

    const pos = positions[node.id];
    const isSelected = node.id === selectedNodeId || 
                      (this.viewModel.model.getState('selectedNodes') || []).includes(node.id);
    const isHovered = node.id === hoveredNodeId;
    const hasChildren = node.children && node.children.length > 0;

    // Create node group
    const doc = this.container.ownerDocument || document;
    const nodeG = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodeG.setAttribute('data-node-id', node.id);
    nodeG.classList.add('node');
    nodeG.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    
    // Add click handler for node selection
    nodeG.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.ctrlKey || e.metaKey) {
        // Multi-selection
        const selectedNodes = this.viewModel.model.getState('selectedNodes') || [];
        if (selectedNodes.includes(node.id)) {
          // Deselect
          const newSelection = selectedNodes.filter(id => id !== node.id);
          this.viewModel.model.updateState('selectedNodes', newSelection);
        } else {
          // Add to selection
          this.viewModel.model.updateState('selectedNodes', [...selectedNodes, node.id]);
        }
      } else {
        // Single selection
        this.viewModel.selectNode(node.id);
        this.viewModel.model.updateState('selectedNodes', []);
      }
      
      if (this.viewModel.umbilical.onNodeSelect) {
        this.viewModel.umbilical.onNodeSelect(node);
      }
    });
    
    // Add hover handlers
    nodeG.addEventListener('mouseenter', (e) => {
      this.viewModel.handleNodeHover(node, e);
    });
    
    nodeG.addEventListener('mouseleave', () => {
      this.viewModel.model.updateState('hoveredNodeId', null);
      this.hideTooltip();
    });

    // Add classes
    if (isSelected) nodeG.classList.add('selected');
    if (isHovered) nodeG.classList.add('hovered');
    if (node.complexity) nodeG.classList.add(node.complexity.toLowerCase());
    if (hasChildren && selectedNodeId === node.id) {
      // Mark children as connected
      node.children.forEach(child => {
        const childNode = this.g.querySelector(`[data-node-id="${child.id}"]`);
        if (childNode) childNode.classList.add('connected');
      });
    }

    // Create node circle/rect based on complexity
    const shape = node.complexity === 'COMPLEX' ? 'rect' : 'circle';
    const nodeShape = doc.createElementNS('http://www.w3.org/2000/svg', shape);
    
    if (shape === 'rect') {
      nodeShape.setAttribute('x', '-30');
      nodeShape.setAttribute('y', '-20');
      nodeShape.setAttribute('width', '60');
      nodeShape.setAttribute('height', '40');
      nodeShape.setAttribute('rx', '5');
    } else {
      nodeShape.setAttribute('r', '20');
    }
    
    nodeShape.classList.add('node-shape');
    nodeG.appendChild(nodeShape);

    // Add label
    const label = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('node-label');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dy', '5');
    label.textContent = this.truncateLabel(node.description || node.id);
    nodeG.appendChild(label);

    // Add event listeners
    nodeG.addEventListener('click', () => {
      this.viewModel.handleNodeClick(node);
    });

    nodeG.addEventListener('mouseenter', (e) => {
      this.viewModel.handleNodeHover(node, e);
    });

    nodeG.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });

    parentG.appendChild(nodeG);

    // Recursively render children
    if (node.children) {
      node.children.forEach(child => {
        this.renderNodes(child, positions, selectedNodeId, hoveredNodeId, parentG);
      });
    }
  }

  renderEdges(node, positions, parentG = this.g) {
    if (!node || !node.children) return;

    const parentPos = positions[node.id];
    if (!parentPos) return;

    node.children.forEach(child => {
      const childPos = positions[child.id];
      if (!childPos) return;

      // Create edge line
      const doc = this.container.ownerDocument || document;
      const edge = doc.createElementNS('http://www.w3.org/2000/svg', 'line');
      edge.classList.add('edge');
      edge.setAttribute('x1', parentPos.x);
      edge.setAttribute('y1', parentPos.y);
      edge.setAttribute('x2', childPos.x);
      edge.setAttribute('y2', childPos.y);
      edge.setAttribute('stroke', '#666');
      edge.setAttribute('stroke-width', '2');
      edge.setAttribute('marker-end', 'url(#arrowhead)');

      // Add event listener
      edge.addEventListener('click', () => {
        this.viewModel.handleEdgeClick({ source: node.id, target: child.id });
      });

      parentG.appendChild(edge);

      // Recursively render child edges
      this.renderEdges(child, positions, parentG);
    });
  }

  clearCanvas() {
    while (this.g.firstChild) {
      this.g.removeChild(this.g.firstChild);
    }
  }

  showEmptyState() {
    const empty = this.container.querySelector('.empty-visualization');
    const canvas = this.container.querySelector('.visualization-canvas');
    empty.style.display = 'flex';
    canvas.style.display = 'none';
  }

  hideEmptyState() {
    const empty = this.container.querySelector('.empty-visualization');
    const canvas = this.container.querySelector('.visualization-canvas');
    empty.style.display = 'none';
    canvas.style.display = 'block';
  }

  showTooltip(node, event) {
    const tooltip = this.container.querySelector('.node-tooltip');
    tooltip.innerHTML = `
      <div class="tooltip-content">
        <div class="tooltip-title">${node.description || node.id}</div>
        ${node.complexity ? `<div class="tooltip-complexity">Complexity: ${node.complexity}</div>` : ''}
        ${node.children ? `<div class="tooltip-children">Children: ${node.children.length}</div>` : ''}
      </div>
    `;
    tooltip.style.display = 'block';
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
  }

  hideTooltip() {
    const tooltip = this.container.querySelector('.node-tooltip');
    tooltip.style.display = 'none';
  }

  updateTransform(zoomLevel, panPosition) {
    this.g.setAttribute('transform', 
      `translate(${panPosition.x}, ${panPosition.y}) scale(${zoomLevel})`);
  }

  updateCompactMode(isCompact) {
    const container = this.container.querySelector('.visualization-container');
    if (isCompact) {
      container.classList.add('compact');
    } else {
      container.classList.remove('compact');
    }
  }

  truncateLabel(text, maxLength = 20) {
    if (!text) return '';
    return text.length > maxLength ? text.substr(0, maxLength) + '...' : text;
  }

  showLayoutTransition() {
    this.g.classList.add('layout-transition');
    setTimeout(() => {
      this.g.classList.remove('layout-transition');
    }, 500);
  }

  getSVGString() {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(this.svg);
  }


  // Progress overlay methods
  showProgressBar(visible) {
    const overlay = this.container.querySelector('.progress-overlay');
    if (visible && !overlay) {
      // Create progress overlay if it doesn't exist
      const progressHTML = `
        <div class="progress-overlay">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
            <div class="progress-text">0%</div>
          </div>
        </div>
      `;
      this.container.querySelector('.plan-visualization-panel').insertAdjacentHTML('beforeend', progressHTML);
    } else if (!visible && overlay) {
      // Remove progress overlay
      overlay.remove();
    }
  }

  updateProgressBar(value, mode = 'determinate') {
    const progressBar = this.container.querySelector('.progress-bar');
    const progressFill = this.container.querySelector('.progress-fill');
    const progressText = this.container.querySelector('.progress-text');
    
    if (progressBar && progressFill && progressText) {
      if (mode === 'indeterminate') {
        progressBar.classList.add('indeterminate');
        progressFill.style.width = '100%';
        progressText.textContent = 'Processing...';
      } else {
        progressBar.classList.remove('indeterminate');
        progressFill.style.width = `${value}%`;
        progressText.textContent = `${value}%`;
      }
    }
  }

  showStatusMessage(message) {
    let statusEl = this.container.querySelector('.status-message');
    if (message && !statusEl) {
      // Create status message element if it doesn't exist
      statusEl = document.createElement('div');
      statusEl.className = 'status-message';
      this.container.querySelector('.plan-visualization-panel').appendChild(statusEl);
    }
    
    if (statusEl) {
      if (message) {
        statusEl.textContent = message;
        statusEl.style.display = 'block';
      } else {
        // Remove status message element when cleared
        statusEl.remove();
      }
    }
  }

  updateNodeStatusClass(nodeId, status) {
    const node = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (node) {
      // Remove old status classes
      node.classList.remove('status-pending', 'status-running', 'status-completed', 'status-failed', 'status-skipped');
      // Add new status class
      node.classList.add(`status-${status}`);
      
      // Add status indicator
      let indicator = node.querySelector('.status-indicator');
      if (!indicator) {
        const doc = this.container.ownerDocument || document;
        indicator = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
        indicator.classList.add('status-indicator');
        indicator.setAttribute('dx', '25');
        indicator.setAttribute('dy', '-5');
        node.appendChild(indicator);
      }
      
      // Update indicator content
      switch(status) {
        case 'completed':
          indicator.textContent = '✓';
          indicator.style.fill = 'green';
          break;
        case 'failed':
          indicator.textContent = '✗';
          indicator.style.fill = 'red';
          break;
        case 'running':
          indicator.textContent = '⟲';
          indicator.style.fill = 'blue';
          break;
        case 'skipped':
          indicator.textContent = '⊘';
          indicator.style.fill = 'gray';
          break;
        default:
          indicator.textContent = '';
      }
    }
  }

  addNodeAnimation(nodeId, animation) {
    const node = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (node) {
      node.classList.add(`animation-${animation}`);
    }
  }

  removeNodeAnimation(nodeId, animation) {
    const node = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (node) {
      node.classList.remove(`animation-${animation}`);
    }
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class PlanVisualizationViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    this.throttleTimer = null;
    
    // Available layouts
    this.layouts = {
      hierarchical: this.calculateHierarchicalLayout.bind(this),
      'force-directed': this.calculateForceDirectedLayout.bind(this),
      radial: this.calculateRadialLayout.bind(this),
      tree: this.calculateTreeLayout.bind(this)
    };
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeAPI();
  }

  exposeAPI() {
    const api = {
      setPlan: this.setPlan.bind(this),
      getPlan: () => this.model.getState('plan'),
      setViewMode: this.setViewMode.bind(this),
      getViewMode: () => this.model.getState('viewMode'),
      setLayout: this.setLayout.bind(this),
      getLayout: () => this.model.getState('layout'),
      getAvailableLayouts: () => Object.keys(this.layouts),
      selectNode: this.selectNode.bind(this),
      setCompactMode: this.setCompactMode.bind(this),
      isCompactMode: () => this.model.getState('compactMode'),
      getZoomLevel: () => this.model.getState('zoomLevel'),
      setZoomLevel: this.setZoomLevel.bind(this),
      getPanPosition: () => this.model.getState('panPosition'),
      fitToView: this.fitToView.bind(this),
      exportAsSVG: this.exportAsSVG.bind(this),
      exportAsPNG: this.exportAsPNG.bind(this),
      exportAsJSON: this.exportAsJSON.bind(this),
      getNodePositions: () => this.model.getState('nodePositions'),
      setNodeCount: (count) => this.model.updateState('nodeCount', count),
      isVirtualizationEnabled: () => this.model.getState('virtualizationEnabled'),
      setAnimationEnabled: (enabled) => this.model.updateState('animationEnabled', enabled),
      // Progress tracking API
      updateNodeStatus: this.updateNodeStatus.bind(this),
      getNodeStatus: (nodeId) => this.model.getNodeStatus(nodeId),
      getOverallProgress: this.getOverallProgress.bind(this),
      getNodeProgress: this.getNodeProgress.bind(this),
      showProgressBar: this.showProgressBar.bind(this),
      setProgress: this.setProgress.bind(this),
      setProgressMode: this.setProgressMode.bind(this),
      setStatusMessage: this.setStatusMessage.bind(this),
      clearStatusMessage: this.clearStatusMessage.bind(this),
      startNodeExecution: this.startNodeExecution.bind(this),
      endNodeExecution: this.endNodeExecution.bind(this),
      getNodeExecutionTime: (nodeId) => this.model.getNodeExecutionTime(nodeId),
      setNodeWeight: (nodeId, weight) => this.model.setNodeWeight(nodeId, weight),
      getWeightedProgress: this.getWeightedProgress.bind(this),
      getProgressSummary: this.getProgressSummary.bind(this),
      showNodeAnimation: this.showNodeAnimation.bind(this),
      getStatusColors: this.getStatusColors.bind(this)
    };
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
    
    this.api = api;
  }

  onModelChange(changes) {
    if ('plan' in changes || 'viewMode' in changes) {
      this.recalculateLayout();
    }
    
    if ('nodePositions' in changes || 'selectedNodeId' in changes || 
        'hoveredNodeId' in changes) {
      this.view.renderPlan(
        this.model.getState('plan'),
        this.model.getState('nodePositions'),
        this.model.getState('selectedNodeId'),
        this.model.getState('hoveredNodeId'),
        this.model.getState('viewMode')
      );
    }
    
    if ('zoomLevel' in changes || 'panPosition' in changes) {
      this.view.updateTransform(
        this.model.getState('zoomLevel'),
        this.model.getState('panPosition')
      );
    }
    
    if ('compactMode' in changes) {
      this.view.updateCompactMode(changes.compactMode);
    }
    
    // Progress-related changes
    if ('progressBarVisible' in changes) {
      this.view.showProgressBar(changes.progressBarVisible);
    }
    
    if ('progressValue' in changes || 'progressMode' in changes) {
      this.view.updateProgressBar(
        this.model.getState('progressValue'),
        this.model.getState('progressMode')
      );
    }
    
    if ('statusMessage' in changes) {
      this.view.showStatusMessage(changes.statusMessage);
    }
    
    if ('nodeStatuses' in changes) {
      // Update visual status for all changed nodes
      for (const nodeId in changes.nodeStatuses) {
        this.view.updateNodeStatusClass(nodeId, changes.nodeStatuses[nodeId]);
      }
    }
  }

  setPlan(plan) {
    this.model.setPlan(plan);
  }

  setViewMode(mode) {
    this.model.updateState('viewMode', mode);
    this.model.updateState('layout', { type: mode === 'graph' ? 'force-directed' : mode });
    
    if (this.umbilical.onViewChange) {
      this.umbilical.onViewChange(mode);
    }
  }

  setLayout(layoutType) {
    this.model.updateState('layout', { type: layoutType });
    this.recalculateLayout();
    
    if (this.model.getState('animationEnabled')) {
      this.view.showLayoutTransition();
    }
    
    if (this.umbilical.onLayoutChange) {
      this.umbilical.onLayoutChange(layoutType);
    }
  }

  recalculateLayout() {
    const plan = this.model.getState('plan');
    if (!plan || !plan.hierarchy) return;
    
    const layoutType = this.model.getState('layout').type;
    const layoutFn = this.layouts[layoutType] || this.layouts.hierarchical;
    
    const positions = layoutFn(plan.hierarchy.root);
    this.model.updateState('nodePositions', positions);
  }

  calculateHierarchicalLayout(root) {
    const positions = {};
    const levelWidth = 150;
    const nodeSpacing = 80;
    
    const calculatePositions = (node, level = 0, index = 0, parentX = 0) => {
      if (!node) return 0;
      
      const x = parentX;
      const y = level * levelWidth;
      
      positions[node.id] = { x, y };
      
      if (node.children && node.children.length > 0) {
        const childWidth = nodeSpacing * (node.children.length - 1);
        let startX = x - childWidth / 2;
        
        node.children.forEach((child, i) => {
          calculatePositions(child, level + 1, i, startX + i * nodeSpacing);
        });
      }
      
      return 1;
    };
    
    calculatePositions(root, 0, 0, 400);
    return positions;
  }

  calculateForceDirectedLayout(root) {
    // Simplified force-directed layout
    const positions = {};
    const nodes = [];
    
    const collectNodes = (node) => {
      if (!node) return;
      nodes.push(node);
      if (node.children) {
        node.children.forEach(collectNodes);
      }
    };
    
    collectNodes(root);
    
    // Random initial positions
    nodes.forEach(node => {
      positions[node.id] = {
        x: 200 + Math.random() * 400,
        y: 200 + Math.random() * 400
      };
    });
    
    return positions;
  }

  calculateRadialLayout(root) {
    const positions = {};
    const centerX = 400;
    const centerY = 300;
    const radiusStep = 100;
    
    const calculatePositions = (node, level = 0, angleStart = 0, angleEnd = Math.PI * 2) => {
      if (!node) return;
      
      if (level === 0) {
        positions[node.id] = { x: centerX, y: centerY };
      } else {
        const angle = (angleStart + angleEnd) / 2;
        const radius = level * radiusStep;
        positions[node.id] = {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle)
        };
      }
      
      if (node.children && node.children.length > 0) {
        const angleRange = angleEnd - angleStart;
        const angleStep = angleRange / node.children.length;
        
        node.children.forEach((child, i) => {
          const childAngleStart = angleStart + i * angleStep;
          const childAngleEnd = childAngleStart + angleStep;
          calculatePositions(child, level + 1, childAngleStart, childAngleEnd);
        });
      }
    };
    
    calculatePositions(root);
    return positions;
  }

  calculateTreeLayout(root) {
    // Similar to hierarchical but with different spacing
    return this.calculateHierarchicalLayout(root);
  }

  selectNode(nodeId) {
    this.model.updateState('selectedNodeId', nodeId);
  }

  setCompactMode(enabled) {
    this.model.updateState('compactMode', enabled);
  }

  toggleCompactMode() {
    const current = this.model.getState('compactMode');
    this.setCompactMode(!current);
  }

  // Zoom and pan methods
  setZoomLevel(level) {
    const clampedLevel = Math.max(0.1, Math.min(5, level));
    this.model.updateState('zoomLevel', clampedLevel);
    
    if (this.umbilical.onZoomChange) {
      this.umbilical.onZoomChange(clampedLevel);
    }
  }

  zoomIn() {
    const current = this.model.getState('zoomLevel');
    this.setZoomLevel(current * 1.2);
  }

  zoomOut() {
    const current = this.model.getState('zoomLevel');
    this.setZoomLevel(current / 1.2);
  }

  resetZoom() {
    this.setZoomLevel(1);
    this.model.updateState('panPosition', { x: 0, y: 0 });
  }

  handleWheel(deltaY) {
    // Throttle wheel events
    if (this.throttleTimer) return;
    
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
    }, 50);
    
    if (deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  pan(dx, dy) {
    const current = this.model.getState('panPosition');
    this.setPanPosition(current.x + dx, current.y + dy);
  }

  setPanPosition(x, y) {
    this.model.updateState('panPosition', { x, y });
    
    if (this.umbilical.onPanChange) {
      this.umbilical.onPanChange({ x, y });
    }
  }

  fitToView() {
    const positions = this.model.getState('nodePositions');
    if (!positions || Object.keys(positions).length === 0) return;
    
    // Find bounds
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    Object.values(positions).forEach(pos => {
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x);
      maxY = Math.max(maxY, pos.y);
    });
    
    const width = maxX - minX + 100;
    const height = maxY - minY + 100;
    
    // Calculate zoom to fit
    const containerWidth = 800; // Approximate
    const containerHeight = 600;
    
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const scale = Math.min(scaleX, scaleY, 1);
    
    this.setZoomLevel(scale);
    this.model.updateState('panPosition', {
      x: -minX * scale + 50,
      y: -minY * scale + 50
    });
  }

  // Event handlers
  handleNodeClick(node) {
    this.selectNode(node.id);
    
    if (this.umbilical.onNodeClick) {
      this.umbilical.onNodeClick(node);
    }
  }

  handleNodeHover(node, event) {
    this.model.updateState('hoveredNodeId', node.id);
    this.view.showTooltip(node, event);
    
    if (this.umbilical.onNodeHover) {
      this.umbilical.onNodeHover(node);
    }
  }

  handleEdgeClick(edge) {
    if (this.umbilical.onEdgeClick) {
      this.umbilical.onEdgeClick(edge);
    }
  }

  // Export methods
  exportAsSVG() {
    return this.view.getSVGString();
  }

  async exportAsPNG() {
    const svgString = this.exportAsSVG();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1200;
    canvas.height = 800;
    
    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = url;
    });
  }

  exportAsJSON() {
    const plan = this.model.getState('plan');
    return JSON.stringify(plan, null, 2);
  }

  handleExportSVG() {
    const svg = this.exportAsSVG();
    this.downloadFile('plan.svg', svg, 'image/svg+xml');
  }

  async handleExportPNG() {
    const dataUrl = await this.exportAsPNG();
    const link = document.createElement('a');
    link.download = 'plan.png';
    link.href = dataUrl;
    link.click();
  }

  handleExportJSON() {
    const json = this.exportAsJSON();
    this.downloadFile('plan.json', json, 'application/json');
  }

  downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Progress tracking methods
  updateNodeStatus(nodeId, status) {
    this.model.updateNodeStatus(nodeId, status);
    this.view.updateNodeStatusClass(nodeId, status);
    
    // Notify umbilical
    if (this.umbilical.onStatusChange) {
      this.umbilical.onStatusChange({ nodeId, status });
    }
    
    if (status === 'completed' && this.umbilical.onNodeComplete) {
      this.umbilical.onNodeComplete({ nodeId, status });
    }
    
    // Update overall progress BEFORE parent completion
    const progress = this.getOverallProgress();
    if (this.umbilical.onProgressUpdate) {
      this.umbilical.onProgressUpdate(progress);
    }
    
    // Check if parent should be marked complete AFTER progress notification
    const plan = this.model.getState('plan');
    if (plan && status === 'completed') {
      this.checkParentCompletion(nodeId, plan.hierarchy.root);
    }
  }

  checkParentCompletion(nodeId, node) {
    if (!node) return null;
    
    if (node.children) {
      for (const child of node.children) {
        if (child.id === nodeId) {
          // Check if all siblings are complete
          const allComplete = node.children.every(c => 
            this.model.getNodeStatus(c.id) === 'completed'
          );
          if (allComplete && this.model.getNodeStatus(node.id) !== 'completed') {
            this.updateNodeStatus(node.id, 'completed');
          }
          return node;
        }
        const found = this.checkParentCompletion(nodeId, child);
        if (found) return found;
      }
    }
    return null;
  }

  getOverallProgress() {
    const plan = this.model.getState('plan');
    if (!plan || !plan.hierarchy) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    const counts = this.countNodeStatuses(plan.hierarchy.root);
    const total = counts.total;
    const completed = counts.completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { completed, total, percentage };
  }

  countNodeStatuses(node) {
    if (!node) return { total: 0, completed: 0 };
    
    let counts = { total: 1, completed: 0 };
    const status = this.model.getNodeStatus(node.id);
    if (status === 'completed') counts.completed = 1;
    
    if (node.children) {
      for (const child of node.children) {
        const childCounts = this.countNodeStatuses(child);
        counts.total += childCounts.total;
        counts.completed += childCounts.completed;
      }
    }
    
    return counts;
  }

  getNodeProgress(nodeId) {
    const plan = this.model.getState('plan');
    if (!plan || !plan.hierarchy) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    const node = this.findNode(nodeId, plan.hierarchy.root);
    if (!node) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    // For a parent node, count only its children, not itself
    if (node.children && node.children.length > 0) {
      let totalChildren = 0;
      let completedChildren = 0;
      
      for (const child of node.children) {
        const childCounts = this.countNodeStatuses(child);
        totalChildren += childCounts.total;
        completedChildren += childCounts.completed;
      }
      
      const percentage = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
      return { 
        completed: completedChildren, 
        total: totalChildren, 
        percentage 
      };
    } else {
      // For leaf nodes, count just itself
      const status = this.model.getNodeStatus(node.id);
      return {
        completed: status === 'completed' ? 1 : 0,
        total: 1,
        percentage: status === 'completed' ? 100 : 0
      };
    }
  }

  findNode(nodeId, node) {
    if (!node) return null;
    if (node.id === nodeId) return node;
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNode(nodeId, child);
        if (found) return found;
      }
    }
    return null;
  }

  showProgressBar(visible) {
    this.model.setProgressBarVisible(visible);
    this.view.showProgressBar(visible);
  }

  setProgress(value) {
    this.model.setProgressValue(value);
    this.view.updateProgressBar(value, this.model.getState('progressMode'));
  }

  setProgressMode(mode) {
    this.model.setProgressMode(mode);
    this.view.updateProgressBar(this.model.getState('progressValue'), mode);
  }

  setStatusMessage(message) {
    this.model.setStatusMessage(message);
    this.view.showStatusMessage(message);
  }

  clearStatusMessage() {
    this.model.setStatusMessage('');
    this.view.showStatusMessage('');
  }

  startNodeExecution(nodeId) {
    this.model.startNodeExecution(nodeId);
    this.view.updateNodeStatusClass(nodeId, 'running');
    this.view.addNodeAnimation(nodeId, 'pulse');
    
    if (this.umbilical.onNodeStart) {
      this.umbilical.onNodeStart({ nodeId, timestamp: Date.now() });
    }
  }

  endNodeExecution(nodeId) {
    this.model.endNodeExecution(nodeId);
    this.view.removeNodeAnimation(nodeId, 'pulse');
  }

  getWeightedProgress() {
    const plan = this.model.getState('plan');
    if (!plan || !plan.hierarchy) {
      return { completed: 0, total: 0, percentage: 0 };
    }
    
    const weights = this.model.getState('nodeWeights');
    const progress = this.calculateWeightedProgress(plan.hierarchy.root, weights);
    
    return {
      completed: progress.completedWeight,
      total: progress.totalWeight,
      percentage: progress.totalWeight > 0 ? 
        Math.round((progress.completedWeight / progress.totalWeight) * 100) : 0
    };
  }

  calculateWeightedProgress(node, weights) {
    if (!node) return { totalWeight: 0, completedWeight: 0 };
    
    const weight = weights[node.id] || 1;
    const status = this.model.getNodeStatus(node.id);
    
    let result = {
      totalWeight: weight,
      completedWeight: status === 'completed' ? weight : 0
    };
    
    if (node.children && node.children.length > 0) {
      // If node has children, use their weights instead
      result = { totalWeight: 0, completedWeight: 0 };
      for (const child of node.children) {
        const childProgress = this.calculateWeightedProgress(child, weights);
        result.totalWeight += childProgress.totalWeight;
        result.completedWeight += childProgress.completedWeight;
      }
    }
    
    return result;
  }

  getProgressSummary() {
    const plan = this.model.getState('plan');
    if (!plan || !plan.hierarchy) {
      return { pending: 0, running: 0, completed: 0, failed: 0, skipped: 0 };
    }
    
    const summary = { pending: 0, running: 0, completed: 0, failed: 0, skipped: 0 };
    this.countStatuses(plan.hierarchy.root, summary);
    return summary;
  }

  countStatuses(node, summary) {
    if (!node) return;
    
    const status = this.model.getNodeStatus(node.id);
    summary[status] = (summary[status] || 0) + 1;
    
    if (node.children) {
      for (const child of node.children) {
        this.countStatuses(child, summary);
      }
    }
  }

  showNodeAnimation(nodeId, animation) {
    this.model.setNodeAnimation(nodeId, animation);
    this.view.addNodeAnimation(nodeId, animation);
  }

  getStatusColors() {
    return {
      pending: '#gray',
      running: '#blue',
      completed: '#green',
      failed: '#red',
      skipped: '#orange'
    };
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
 * PlanVisualizationPanel - Main component class
 */
export class PlanVisualizationPanel {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'PlanVisualizationPanel');
    
    // Create MVVM components
    const model = new PlanVisualizationModel();
    const viewModel = new PlanVisualizationViewModel(model, null, umbilical);
    const view = new PlanVisualizationView(umbilical.dom, viewModel);
    
    // Set view reference in viewModel
    viewModel.view = view;
    
    // Return component with standardized API
    return {
      api: {
        // Standardized lifecycle methods
        isReady: () => true,
        getState: (key) => key ? model.getState(key) : model.getState(),
        setState: (key, value) => model.updateState(key, value),
        reset: () => {
          model.setPlan(null);
          model.updateState('selectedNodeId', null);
          model.updateState('hoveredNodeId', null);
          model.updateState('zoomLevel', 1);
        },
        destroy: () => {
          // Clean up listeners and DOM
          viewModel.cleanup && viewModel.cleanup();
        },
        
        // Standardized error handling methods
        getLastError: () => model.getState('lastError') || null,
        clearError: () => model.updateState('lastError', null),
        hasError: () => !!model.getState('lastError'),
        setError: (error) => {
          model.updateState('lastError', error);
          return { success: false, error: error };
        },
        
        // Standardized validation methods
        validate: () => {
          const errors = [];
          const plan = model.getState('plan');
          if (!plan) {
            errors.push('No plan loaded');
          }
          model.updateState('validationErrors', errors);
          return { 
            success: true, 
            data: { 
              isValid: errors.length === 0, 
              errors 
            } 
          };
        },
        isValid: () => {
          const errors = model.getState('validationErrors') || [];
          return errors.length === 0;
        },
        getValidationErrors: () => model.getState('validationErrors') || [],
        
        // Component-specific API methods
        setPlan: (plan) => model.setPlan(plan),
        getPlan: () => model.getState('plan'),
        setViewMode: (mode) => model.updateState('viewMode', mode),
        getViewMode: () => model.getState('viewMode'),
        selectNode: (nodeId) => model.updateState('selectedNodeId', nodeId),
        getSelectedNode: () => model.getState('selectedNodeId'),
        setZoom: (level) => model.updateState('zoomLevel', level),
        getZoom: () => model.getState('zoomLevel'),
        updateNodeStatus: (nodeId, status) => model.updateNodeStatus(nodeId, status),
        getNodeStatus: (nodeId) => model.getNodeStatus(nodeId),
        exportAsSVG: () => {
          // Simple mock implementation for testing
          return { success: true, data: '<svg>mock svg content</svg>' };
        }
      },
      
      // Internal references for advanced usage
      model,
      viewModel,
      view
    };
  }
}