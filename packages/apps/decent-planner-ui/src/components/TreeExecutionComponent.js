/**
 * TreeExecutionComponent - MVVM Component for behavior tree execution visualization
 * Shows tree structure with execution state, controls, and debugging features
 */

import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class TreeExecutionComponent {
  constructor(container, options = {}) {
    this.container = container;
    
    // Model
    this.model = {
      tree: null,
      executionState: null,
      nodeStates: {},
      currentNode: null,
      history: [],
      breakpoints: new Set(),
      mode: 'step', // 'step' or 'run'
      isPaused: false,
      isExecuting: false
    };
    
    // View elements
    this.elements = {};
    
    // Event handlers from options
    this.onStep = options.onStep || (() => {});
    this.onRun = options.onRun || (() => {});
    this.onPause = options.onPause || (() => {});
    this.onReset = options.onReset || (() => {});
    this.onBreakpoint = options.onBreakpoint || (() => {});
    
    this.render();
  }
  
  render() {
    this.container.innerHTML = '';
    
    // Main container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'tree-execution-container';
    
    // Controls section
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'execution-controls';
    controlsDiv.innerHTML = `
      <div class="control-buttons">
        <button id="step-btn" class="control-btn" ${!this.model.tree || this.model.isExecuting ? 'disabled' : ''}>
          ⏭️ Step
        </button>
        <button id="run-btn" class="control-btn" ${!this.model.tree || this.model.isExecuting ? 'disabled' : ''}>
          ▶️ Run
        </button>
        <button id="pause-btn" class="control-btn" ${!this.model.isExecuting ? 'disabled' : ''}>
          ⏸️ Pause
        </button>
        <button id="reset-btn" class="control-btn" ${!this.model.tree ? 'disabled' : ''}>
          🔄 Reset
        </button>
      </div>
      <div class="execution-status">
        <span class="status-label">Mode:</span>
        <span class="status-value">${this.model.mode}</span>
        <span class="status-separator">|</span>
        <span class="status-label">Status:</span>
        <span class="status-value">${this.model.isPaused ? 'Paused' : this.model.isExecuting ? 'Running' : 'Ready'}</span>
      </div>
    `;
    mainDiv.appendChild(controlsDiv);
    
    // Tree visualization section
    const treeSection = document.createElement('div');
    treeSection.className = 'tree-visualization-section';
    
    if (this.model.tree) {
      const treeContainer = document.createElement('div');
      const treeCollapsible = new CollapsibleSectionComponent(treeContainer, {
        title: 'Behavior Tree',
        icon: '🌳',
        defaultExpanded: true
      });
      
      const treeContent = document.createElement('div');
      treeContent.className = 'tree-content';
      treeContent.appendChild(this.renderTreeNode(this.model.tree));
      
      treeCollapsible.setContent(treeContent);
      treeSection.appendChild(treeContainer);
    } else {
      treeSection.innerHTML = '<div class="no-tree">No behavior tree loaded. Complete formal planning first.</div>';
    }
    
    mainDiv.appendChild(treeSection);
    
    // Execution history section
    const historyContainer = document.createElement('div');
    const historyCollapsible = new CollapsibleSectionComponent(historyContainer, {
      title: 'Execution History',
      icon: '📜',
      defaultExpanded: false
    });
    
    const historyContent = document.createElement('div');
    historyContent.className = 'execution-history';
    
    if (this.model.history.length > 0) {
      const historyList = document.createElement('ul');
      historyList.className = 'history-list';
      
      this.model.history.forEach((entry, index) => {
        const item = document.createElement('li');
        item.className = `history-item ${entry.status}`;
        item.innerHTML = `
          <span class="history-index">${index + 1}</span>
          <span class="history-node">${entry.nodeId}</span>
          <span class="history-status">${entry.status}</span>
        `;
        historyList.appendChild(item);
      });
      
      historyContent.appendChild(historyList);
    } else {
      historyContent.innerHTML = '<p class="no-history">No execution history yet</p>';
    }
    
    historyCollapsible.setContent(historyContent);
    mainDiv.appendChild(historyContainer);
    
    // Context inspection section
    const contextContainer = document.createElement('div');
    const contextCollapsible = new CollapsibleSectionComponent(contextContainer, {
      title: 'Execution Context',
      icon: '🔍',
      defaultExpanded: false
    });
    
    const contextContent = document.createElement('div');
    contextContent.className = 'execution-context';
    
    if (this.model.executionState?.context) {
      const contextPre = document.createElement('pre');
      contextPre.textContent = JSON.stringify(this.model.executionState.context, null, 2);
      contextContent.appendChild(contextPre);
    } else {
      contextContent.innerHTML = '<p class="no-context">No context available</p>';
    }
    
    contextCollapsible.setContent(contextContent);
    mainDiv.appendChild(contextContainer);
    
    this.container.appendChild(mainDiv);
    
    // Store element references and attach listeners
    this.attachEventListeners();
  }
  
  renderTreeNode(node, depth = 0) {
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'tree-node';
    nodeDiv.style.marginLeft = `${depth * 20}px`;
    
    const nodeId = node.id || `node-${Math.random()}`;
    const nodeState = this.model.nodeStates[nodeId] || 'pending';
    const isCurrentNode = this.model.currentNode === nodeId;
    const hasBreakpoint = this.model.breakpoints.has(nodeId);
    
    // Node header
    const headerDiv = document.createElement('div');
    headerDiv.className = `node-header ${nodeState} ${isCurrentNode ? 'current' : ''}`;
    
    // Breakpoint toggle
    const breakpointBtn = document.createElement('button');
    breakpointBtn.className = `breakpoint-btn ${hasBreakpoint ? 'active' : ''}`;
    breakpointBtn.innerHTML = hasBreakpoint ? '🔴' : '⭕';
    breakpointBtn.title = hasBreakpoint ? 'Remove breakpoint' : 'Add breakpoint';
    breakpointBtn.onclick = () => this.toggleBreakpoint(nodeId);
    
    // Node type icon
    const typeIcon = this.getNodeTypeIcon(node.type);
    
    // Node name
    const nameSpan = document.createElement('span');
    nameSpan.className = 'node-name';
    nameSpan.textContent = node.name || node.description || nodeId;
    
    // State indicator
    const stateSpan = document.createElement('span');
    stateSpan.className = `node-state-indicator ${nodeState}`;
    stateSpan.textContent = this.getStateSymbol(nodeState);
    
    headerDiv.appendChild(breakpointBtn);
    headerDiv.appendChild(document.createTextNode(typeIcon + ' '));
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(stateSpan);
    
    nodeDiv.appendChild(headerDiv);
    
    // Node details (tool, params, etc.)
    if (node.tool || node.params) {
      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'node-details';
      detailsDiv.style.marginLeft = '40px';
      
      if (node.tool) {
        const toolSpan = document.createElement('span');
        toolSpan.className = 'node-tool';
        toolSpan.textContent = `Tool: ${node.tool}`;
        detailsDiv.appendChild(toolSpan);
      }
      
      if (node.params) {
        const paramsSpan = document.createElement('span');
        paramsSpan.className = 'node-params';
        paramsSpan.textContent = `Params: ${JSON.stringify(node.params)}`;
        detailsDiv.appendChild(paramsSpan);
      }
      
      nodeDiv.appendChild(detailsDiv);
    }
    
    // Render children
    if (node.children && node.children.length > 0) {
      const childrenDiv = document.createElement('div');
      childrenDiv.className = 'node-children';
      
      node.children.forEach(child => {
        childrenDiv.appendChild(this.renderTreeNode(child, depth + 1));
      });
      
      nodeDiv.appendChild(childrenDiv);
    }
    
    return nodeDiv;
  }
  
  getNodeTypeIcon(type) {
    const icons = {
      'sequence': '➡️',
      'selector': '❓',
      'parallel': '⚡',
      'action': '⚙️',
      'condition': '🔍',
      'retry': '🔄'
    };
    return icons[type] || '📦';
  }
  
  getStateSymbol(state) {
    const symbols = {
      'pending': '⏳',
      'running': '▶️',
      'success': '✅',
      'failure': '❌',
      'error': '⚠️'
    };
    return symbols[state] || '❓';
  }
  
  attachEventListeners() {
    const stepBtn = this.container.querySelector('#step-btn');
    const runBtn = this.container.querySelector('#run-btn');
    const pauseBtn = this.container.querySelector('#pause-btn');
    const resetBtn = this.container.querySelector('#reset-btn');
    
    if (stepBtn) {
      stepBtn.addEventListener('click', () => {
        this.onStep();
      });
    }
    
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.onRun();
      });
    }
    
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.onPause();
      });
    }
    
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.onReset();
      });
    }
  }
  
  toggleBreakpoint(nodeId) {
    if (this.model.breakpoints.has(nodeId)) {
      this.model.breakpoints.delete(nodeId);
      this.onBreakpoint(nodeId, false);
    } else {
      this.model.breakpoints.add(nodeId);
      this.onBreakpoint(nodeId, true);
    }
    this.render();
  }
  
  setTree(tree) {
    this.model.tree = tree;
    this.model.nodeStates = {};
    this.model.currentNode = null;
    this.model.history = [];
    this.render();
  }
  
  updateExecutionState(state) {
    this.model.executionState = state;
    this.model.nodeStates = state.nodeStates || {};
    this.model.currentNode = state.currentNode;
    this.model.history = state.history || [];
    this.model.mode = state.mode || 'step';
    this.model.isPaused = state.isPaused || false;
    this.model.isExecuting = state.mode === 'run' && !state.isPaused;
    
    // Update breakpoints from state
    if (state.breakpoints) {
      this.model.breakpoints = new Set(state.breakpoints);
    }
    
    this.render();
  }
  
  setExecuting(isExecuting) {
    this.model.isExecuting = isExecuting;
    this.render();
  }
  
  addHistoryEntry(entry) {
    this.model.history.push(entry);
    this.render();
  }
  
  updateNodeState(nodeId, state) {
    this.model.nodeStates[nodeId] = state;
    this.render();
  }
  
  setCurrentNode(nodeId) {
    this.model.currentNode = nodeId;
    this.render();
  }
}