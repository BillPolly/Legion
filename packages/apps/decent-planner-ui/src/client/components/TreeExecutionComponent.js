/**
 * TreeExecutionComponent - MVVM Component for behavior tree execution visualization
 * Shows tree structure with execution state, controls, and debugging features
 */

import { CollapsibleSectionComponent } from './CollapsibleSectionComponent.js';

export class TreeExecutionComponent {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // Model
    this.model = {
      executionState: null,
      nodeStates: {},
      currentNode: null,
      history: [],
      breakpoints: new Set(),
      mode: 'step', // 'step' or 'run'
      isPaused: false,
      isExecuting: false,
      
      // Inspection state
      selectedHistoryItem: null,
      selectedArtifact: null,
      inspectionData: null,
      showInspectionModal: false,
      inspectionType: null, // 'history-inputs', 'history-outputs', 'artifact-value'
      contextArtifacts: {}, // Key-value pairs with previews for context.artifacts
      isLoadingInspection: false
    };
    
    // View elements
    this.elements = {};
    
    // Event handlers from options
    this.onStep = options.onStep || (() => {});
    this.onRun = options.onRun || (() => {});
    this.onPause = options.onPause || (() => {});
    this.onReset = options.onReset || (() => {});
    this.onBreakpoint = options.onBreakpoint || (() => {});
    
    // Remote actor for inspection requests
    this.remoteActor = options.remoteActor || null;
    
    this.render();
  }
  
  // ViewModel methods for inspection
  async inspectHistoryInputs(index) {
    console.log(`🔍 inspectHistoryInputs called: index=${index}, remoteActor=${!!this.remoteActor}`);
    
    if (!this.remoteActor) {
      console.error('❌ No remoteActor available for inspection');
      return;
    }
    
    this.model.isLoadingInspection = true;
    this.model.selectedHistoryItem = index;
    this.model.inspectionType = 'history-inputs';
    this.updateInspectionLoadingState();
    
    try {
      const details = await this.remoteActor.receive('get-execution-details', {
        type: 'history-inputs',
        index: index
      });
      
      this.model.inspectionData = details;
      this.model.showInspectionModal = true;
      this.model.isLoadingInspection = false;
      this.renderInspectionModal();
    } catch (error) {
      console.error('Failed to fetch execution details:', error);
      this.model.isLoadingInspection = false;
      this.updateInspectionLoadingState();
    }
  }
  
  async inspectHistoryOutputs(index) {
    if (!this.remoteActor) return;
    
    this.model.isLoadingInspection = true;
    this.model.selectedHistoryItem = index;
    this.model.inspectionType = 'history-outputs';
    this.updateInspectionLoadingState();
    
    try {
      const details = await this.remoteActor.receive('get-execution-details', {
        type: 'history-outputs',
        index: index
      });
      
      this.model.inspectionData = details;
      this.model.showInspectionModal = true;
      this.model.isLoadingInspection = false;
      this.renderInspectionModal();
    } catch (error) {
      console.error('Failed to fetch output details:', error);
      this.model.isLoadingInspection = false;
      this.updateInspectionLoadingState();
    }
  }
  
  async inspectArtifact(artifactKey) {
    if (!this.remoteActor) return;
    
    this.model.isLoadingInspection = true;
    this.model.selectedArtifact = artifactKey;
    this.model.inspectionType = 'artifact-value';
    this.updateInspectionLoadingState();
    
    try {
      const details = await this.remoteActor.receive('get-execution-details', {
        type: 'artifact-value',
        key: artifactKey
      });
      
      this.model.inspectionData = details;
      this.model.showInspectionModal = true;
      this.model.isLoadingInspection = false;
      this.renderInspectionModal();
    } catch (error) {
      console.error('Failed to fetch artifact details:', error);
      this.model.isLoadingInspection = false;
      this.updateInspectionLoadingState();
    }
  }
  
  closeInspectionModal() {
    this.model.showInspectionModal = false;
    this.model.inspectionData = null;
    this.model.selectedHistoryItem = null;
    this.model.selectedArtifact = null;
    this.model.inspectionType = null;
    this.hideInspectionModal();
  }
  
  // View creation methods - proper MVVM DOM element creation
  createHistoryItemElement(entry, index) {
    const item = document.createElement('li');
    item.className = `history-item ${entry.status.toLowerCase()}`;
    
    // Node info
    const indexSpan = document.createElement('span');
    indexSpan.className = 'history-index';
    indexSpan.textContent = `${index + 1}`;
    
    const nodeSpan = document.createElement('span');
    nodeSpan.className = 'history-node';
    nodeSpan.textContent = entry.nodeId;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = 'history-status';
    statusSpan.textContent = entry.status;
    
    // Clickable inputs button
    const inputsBtn = document.createElement('button');
    inputsBtn.className = 'inspect-btn inputs-btn';
    const inputCount = entry.inputs ? Object.keys(entry.inputs).length : 0;
    inputsBtn.textContent = `📥 Inputs (${inputCount})`;
    inputsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log(`🖱️ Inputs button clicked for history item ${index}`);
      this.inspectHistoryInputs(index);
    });
    
    // Clickable outputs button  
    const outputsBtn = document.createElement('button');
    outputsBtn.className = 'inspect-btn outputs-btn';
    const outputCount = entry.outputs ? Object.keys(entry.outputs).length : 0;
    outputsBtn.textContent = `📤 Outputs (${outputCount})`;
    outputsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log(`🖱️ Outputs button clicked for history item ${index}`);
      this.inspectHistoryOutputs(index);
    });
    
    // Assemble the item
    item.appendChild(indexSpan);
    item.appendChild(nodeSpan);
    item.appendChild(statusSpan);
    item.appendChild(inputsBtn);
    item.appendChild(outputsBtn);
    
    return item;
  }
  
  createArtifactItemElement(key, value) {
    const item = document.createElement('div');
    item.className = 'artifact-item';
    
    const keySpan = document.createElement('span');
    keySpan.className = 'artifact-key';
    keySpan.textContent = key;
    
    const valuePreview = document.createElement('span');
    valuePreview.className = 'artifact-preview';
    valuePreview.textContent = this.getValuePreview(value);
    
    const inspectBtn = document.createElement('button');
    inspectBtn.className = 'inspect-btn artifact-btn';
    inspectBtn.textContent = '🔍 Inspect';
    inspectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.inspectArtifact(key);
    });
    
    item.appendChild(keySpan);
    item.appendChild(valuePreview);
    item.appendChild(inspectBtn);
    
    return item;
  }
  
  getValuePreview(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    
    const type = typeof value;
    switch (type) {
      case 'string':
        return value.length > 50 ? `"${value.substring(0, 47)}..."` : `"${value}"`;
      case 'number':
      case 'boolean':
        return String(value);
      case 'object':
        if (Array.isArray(value)) {
          return `Array(${value.length})`;
        } else {
          const keys = Object.keys(value);
          return `Object(${keys.length} keys)`;
        }
      default:
        return `${type}`;
    }
  }
  
  // Loading state updates
  updateInspectionLoadingState() {
    // Update UI to show loading state if needed
    // This would update existing buttons to show spinners etc.
  }
  
  // Inspection modal rendering
  renderInspectionModal() {
    if (!this.model.showInspectionModal || !this.model.inspectionData) return;
    
    // Create modal overlay
    let modal = document.getElementById('inspection-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'inspection-modal';
      modal.className = 'modal-overlay';
      document.body.appendChild(modal);
    }
    
    // Clear and create modal content
    modal.innerHTML = '';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    // Modal header
    const header = document.createElement('div');
    header.className = 'modal-header';
    
    const title = document.createElement('h3');
    title.textContent = this.getInspectionTitle();
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.closeInspectionModal());
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Modal body with JSON viewer
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    const jsonViewer = document.createElement('pre');
    jsonViewer.className = 'json-viewer';
    jsonViewer.textContent = JSON.stringify(this.model.inspectionData, null, 2);
    
    body.appendChild(jsonViewer);
    
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modal.appendChild(modalContent);
    
    modal.style.display = 'flex';
  }
  
  hideInspectionModal() {
    const modal = document.getElementById('inspection-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }
  
  getInspectionTitle() {
    switch (this.model.inspectionType) {
      case 'history-inputs':
        return `History Item ${this.model.selectedHistoryItem + 1} - Inputs`;
      case 'history-outputs':
        return `History Item ${this.model.selectedHistoryItem + 1} - Outputs`;
      case 'artifact-value':
        return `Artifact: ${this.model.selectedArtifact}`;
      default:
        return 'Inspection';
    }
  }
  
  render() {
    this.container.innerHTML = '';
    
    // Get tree from global state (MVVM pattern)
    const tree = this.options.state?.formalResult?.plan?.behaviorTrees?.[0];
    console.log('🌳 [TreeExecutionComponent] render() called');
    console.log('🌳 [TreeExecutionComponent] this.options.state:', !!this.options.state);
    console.log('🌳 [TreeExecutionComponent] formalResult:', !!this.options.state?.formalResult);
    console.log('🌳 [TreeExecutionComponent] plan:', !!this.options.state?.formalResult?.plan);
    console.log('🌳 [TreeExecutionComponent] behaviorTrees:', this.options.state?.formalResult?.plan?.behaviorTrees?.length);
    console.log('🌳 [TreeExecutionComponent] tree found:', !!tree);
    if (tree) {
      console.log('🌳 [TreeExecutionComponent] tree structure:', { id: tree.id, type: tree.type, childrenCount: tree.children?.length });
    }
    
    // Main container
    const mainDiv = document.createElement('div');
    mainDiv.className = 'tree-execution-container';
    
    // Controls section
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'execution-controls';
    controlsDiv.innerHTML = `
      <div class="control-buttons">
        <button id="step-btn" class="control-btn" ${!tree || this.model.isExecuting ? 'disabled' : ''}>
          ⏭️ Step
        </button>
        <button id="run-btn" class="control-btn" ${!tree || this.model.isExecuting ? 'disabled' : ''}>
          ▶️ Run
        </button>
        <button id="pause-btn" class="control-btn" ${!this.model.isExecuting ? 'disabled' : ''}>
          ⏸️ Pause
        </button>
        <button id="reset-btn" class="control-btn" ${!tree ? 'disabled' : ''}>
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
    
    if (tree) {
      const treeContainer = document.createElement('div');
      const treeCollapsible = new CollapsibleSectionComponent(treeContainer, {
        title: 'Behavior Tree',
        icon: '🌳',
        defaultExpanded: true
      });
      
      const treeContent = document.createElement('div');
      treeContent.className = 'tree-content';
      treeContent.appendChild(this.renderTreeNode(tree));
      
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
      defaultExpanded: true  // Changed to true to keep expanded by default
    });
    
    const historyContent = document.createElement('div');
    historyContent.className = 'execution-history';
    
    if (this.model.history.length > 0) {
      const historyList = document.createElement('ul');
      historyList.className = 'history-list';
      
      this.model.history.forEach((entry, index) => {
        const item = this.createHistoryItemElement(entry, index);
        historyList.appendChild(item);
      });
      
      historyContent.appendChild(historyList);
    } else {
      const noHistory = document.createElement('p');
      noHistory.className = 'no-history';
      noHistory.textContent = 'No execution history yet';
      historyContent.appendChild(noHistory);
    }
    
    historyCollapsible.setContent(historyContent);
    mainDiv.appendChild(historyContainer);
    
    // Context inspection section
    const contextContainer = document.createElement('div');
    const contextCollapsible = new CollapsibleSectionComponent(contextContainer, {
      title: 'Execution Context',
      icon: '🔍',
      defaultExpanded: true  // Changed to true to keep expanded by default
    });
    
    const contextContent = document.createElement('div');
    contextContent.className = 'execution-context';
    
    if (this.model.executionState?.context?.artifacts) {
      const artifacts = this.model.executionState.context.artifacts;
      const artifactKeys = Object.keys(artifacts);
      
      if (artifactKeys.length > 0) {
        const artifactsList = document.createElement('div');
        artifactsList.className = 'artifacts-list';
        
        artifactKeys.forEach(key => {
          const artifactItem = this.createArtifactItemElement(key, artifacts[key]);
          artifactsList.appendChild(artifactItem);
        });
        
        contextContent.appendChild(artifactsList);
      } else {
        const noArtifacts = document.createElement('p');
        noArtifacts.className = 'no-artifacts';
        noArtifacts.textContent = 'No artifacts stored yet';
        contextContent.appendChild(noArtifacts);
      }
    } else {
      const noContext = document.createElement('p');
      noContext.className = 'no-context';
      noContext.textContent = 'No context available';
      contextContent.appendChild(noContext);
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