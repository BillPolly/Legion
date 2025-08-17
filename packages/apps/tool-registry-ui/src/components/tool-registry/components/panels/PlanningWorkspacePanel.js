/**
 * PlanningWorkspacePanel Component
 * MVVM implementation for planning workspace with goal input, decomposition tree,
 * validation, and execution controls
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages planning workspace state
 */
class PlanningWorkspacePanelModel {
  constructor() {
    this.state = {
      goal: '',
      planningStatus: 'idle', // idle, creating, decomposing, validating, complete, error
      currentPlan: null,
      decompositionTree: null,
      validationResult: null,
      executionStatus: 'idle', // idle, starting, running, paused, stopped, completed, error
      currentExecutionId: null,
      executionResults: null,
      executionError: null,
      artifacts: {},
      executionLogs: [],
      collapsedNodes: new Set(),
      breakpoints: new Set()
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
      goal: '',
      planningStatus: 'idle',
      currentPlan: null,
      decompositionTree: null,
      validationResult: null,
      executionStatus: 'idle',
      currentExecutionId: null,
      executionResults: null,
      executionError: null,
      artifacts: {},
      executionLogs: [],
      collapsedNodes: new Set(),
      breakpoints: new Set()
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders UI and handles DOM updates
 */
class PlanningWorkspacePanelView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="planning-workspace-panel">
        <div class="planning-header">
          <h2>Planning Workspace</h2>
          <div class="planning-status"></div>
        </div>
        
        <div class="planning-content">
          <!-- Goal Input Section -->
          <div class="goal-input-section">
            <h3>Goal Definition</h3>
            <textarea 
              class="goal-textarea" 
              placeholder="Enter your goal or task description..."
              rows="3"
            ></textarea>
            <div class="goal-controls">
              <button class="plan-button">Create Plan</button>
              <button class="clear-button">Clear</button>
            </div>
          </div>
          
          <!-- Decomposition Tree -->
          <div class="decomposition-section">
            <h3>Task Decomposition</h3>
            <div class="decomposition-tree"></div>
          </div>
          
          <!-- Validation Panel -->
          <div class="validation-panel">
            <h3>Validation</h3>
            <div class="validation-status"></div>
            <div class="validation-details"></div>
          </div>
          
          <!-- Execution Console -->
          <div class="execution-section">
            <h3>Execution</h3>
            <div class="execution-controls">
              <button class="execute-button" disabled>Execute Plan</button>
              <button class="pause-button" disabled>Pause</button>
              <button class="resume-button" disabled>Resume</button>
              <button class="stop-button" disabled>Stop</button>
              <button class="step-button" disabled>Step</button>
            </div>
            <div class="execution-console">
              <div class="execution-logs"></div>
            </div>
          </div>
          
          <!-- Plan Management -->
          <div class="plan-management">
            <button class="save-plan-button" disabled>Save Plan</button>
            <button class="load-plan-button">Load Plan</button>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Goal input
    const goalTextarea = this.container.querySelector('.goal-textarea');
    goalTextarea.addEventListener('input', (e) => {
      this.viewModel.setGoal(e.target.value);
    });
    
    // Planning controls
    const planButton = this.container.querySelector('.plan-button');
    planButton.addEventListener('click', () => {
      this.viewModel.createPlan();
    });
    
    const clearButton = this.container.querySelector('.clear-button');
    clearButton.addEventListener('click', () => {
      this.viewModel.clearGoal();
    });
    
    // Execution controls
    const executeButton = this.container.querySelector('.execute-button');
    executeButton.addEventListener('click', () => {
      this.viewModel.startExecution();
    });
    
    const pauseButton = this.container.querySelector('.pause-button');
    pauseButton.addEventListener('click', () => {
      this.viewModel.pauseExecution();
    });
    
    const resumeButton = this.container.querySelector('.resume-button');
    resumeButton.addEventListener('click', () => {
      this.viewModel.resumeExecution();
    });
    
    const stopButton = this.container.querySelector('.stop-button');
    stopButton.addEventListener('click', () => {
      this.viewModel.stopExecution();
    });
    
    const stepButton = this.container.querySelector('.step-button');
    stepButton.addEventListener('click', () => {
      this.viewModel.stepExecution();
    });
    
    // Plan management
    const saveButton = this.container.querySelector('.save-plan-button');
    saveButton.addEventListener('click', () => {
      const name = prompt('Enter plan name:');
      if (name) {
        this.viewModel.savePlan(name);
      }
    });
    
    const loadButton = this.container.querySelector('.load-plan-button');
    loadButton.addEventListener('click', () => {
      const planId = prompt('Enter plan ID:');
      if (planId) {
        this.viewModel.loadPlan(planId);
      }
    });
  }

  updatePlanningStatus(status) {
    const statusElement = this.container.querySelector('.planning-status');
    statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    statusElement.className = `planning-status ${status}`;
    
    // Update button states
    const planButton = this.container.querySelector('.plan-button');
    planButton.disabled = status !== 'idle' && status !== 'complete' && status !== 'error';
  }

  updateValidationStatus(result) {
    const statusElement = this.container.querySelector('.validation-status');
    const detailsElement = this.container.querySelector('.validation-details');
    
    if (!result) {
      statusElement.textContent = 'Not validated';
      statusElement.className = 'validation-status';
      detailsElement.innerHTML = '';
      return;
    }
    
    statusElement.textContent = result.valid ? 'Valid' : 'Invalid';
    statusElement.className = `validation-status ${result.valid ? 'valid' : 'invalid'}`;
    
    if (result.feasibility) {
      const feasibleCount = result.feasibility.feasibleTasks?.length || 0;
      const infeasibleCount = result.feasibility.infeasibleTasks?.length || 0;
      
      detailsElement.innerHTML = `
        <div class="feasibility-summary">
          <span class="feasible">✓ ${feasibleCount} feasible tasks</span>
          ${infeasibleCount > 0 ? `<span class="infeasible">✗ ${infeasibleCount} infeasible tasks</span>` : ''}
        </div>
      `;
    }
  }

  updateExecutionControls(status) {
    const executeButton = this.container.querySelector('.execute-button');
    const pauseButton = this.container.querySelector('.pause-button');
    const resumeButton = this.container.querySelector('.resume-button');
    const stopButton = this.container.querySelector('.stop-button');
    const stepButton = this.container.querySelector('.step-button');
    
    // Reset all buttons
    [executeButton, pauseButton, resumeButton, stopButton, stepButton].forEach(btn => {
      btn.disabled = true;
    });
    
    switch (status) {
      case 'idle':
        executeButton.disabled = false;
        break;
      case 'running':
        pauseButton.disabled = false;
        stopButton.disabled = false;
        stepButton.disabled = false;
        break;
      case 'paused':
        resumeButton.disabled = false;
        stopButton.disabled = false;
        stepButton.disabled = false;
        break;
      case 'completed':
      case 'stopped':
        executeButton.disabled = false;
        break;
    }
  }

  renderDecompositionTree(tree) {
    const treeElement = this.container.querySelector('.decomposition-tree');
    if (!tree) {
      treeElement.innerHTML = '<div class="empty-tree">No decomposition available</div>';
      return;
    }
    
    treeElement.innerHTML = this.renderTreeNode(tree.root, 0);
  }

  renderTreeNode(node, level) {
    if (!node) return '';
    
    const nodeClass = `tree-node level-${level} ${node.complexity?.toLowerCase() || ''}`;
    const hasChildren = node.children && node.children.length > 0;
    
    let html = `
      <div class="${nodeClass}" data-node-id="${node.id}">
        <div class="node-content">
          ${hasChildren ? '<span class="toggle-icon">▼</span>' : '<span class="node-bullet">•</span>'}
          <span class="node-description">${node.description || node.id}</span>
          ${node.complexity ? `<span class="node-complexity">${node.complexity}</span>` : ''}
        </div>
    `;
    
    if (hasChildren) {
      html += '<div class="node-children">';
      node.children.forEach(child => {
        html += this.renderTreeNode(child, level + 1);
      });
      html += '</div>';
    }
    
    html += '</div>';
    return html;
  }

  addDecompositionNode(nodeData) {
    const { node, level } = nodeData;
    const treeElement = this.container.querySelector('.decomposition-tree');
    
    // If this is the root node, start fresh
    if (level === 0) {
      treeElement.innerHTML = '';
    }
    
    // Find parent or append to tree
    const nodeHtml = `
      <div class="tree-node level-${level}" data-node-id="${node.id}">
        <div class="node-content">
          <span class="node-bullet">•</span>
          <span class="node-description">${node.description}</span>
          <span class="node-complexity">${node.complexity}</span>
        </div>
      </div>
    `;
    
    treeElement.insertAdjacentHTML('beforeend', nodeHtml);
  }

  addExecutionLog(message, type = 'info') {
    const logsElement = this.container.querySelector('.execution-logs');
    const timestamp = new Date().toLocaleTimeString();
    
    const logEntry = document.createElement('div');
    logEntry.className = `execution-log-entry ${type}`;
    logEntry.innerHTML = `
      <span class="log-timestamp">[${timestamp}]</span>
      <span class="log-message">${message}</span>
    `;
    
    logsElement.appendChild(logEntry);
    logsElement.scrollTop = logsElement.scrollHeight;
  }

  clearExecutionLogs() {
    const logsElement = this.container.querySelector('.execution-logs');
    logsElement.innerHTML = '';
  }

  toggleNode(nodeId) {
    const nodeElement = this.container.querySelector(`[data-node-id="${nodeId}"]`);
    if (nodeElement) {
      nodeElement.classList.toggle('collapsed');
      const toggleIcon = nodeElement.querySelector('.toggle-icon');
      if (toggleIcon) {
        toggleIcon.textContent = nodeElement.classList.contains('collapsed') ? '▶' : '▼';
      }
    }
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class PlanningWorkspacePanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose methods to umbilical
    this.exposeMethods();
  }

  exposeMethods() {
    // Create an API object that includes all public methods
    const api = {
      createPlan: this.createPlan.bind(this),
      savePlan: this.savePlan.bind(this),
      loadPlan: this.loadPlan.bind(this),
      startExecution: this.startExecution.bind(this),
      pauseExecution: this.pauseExecution.bind(this),
      resumeExecution: this.resumeExecution.bind(this),
      stopExecution: this.stopExecution.bind(this),
      stepExecution: this.stepExecution.bind(this),
      handleDecompositionNode: this.handleDecompositionNode.bind(this),
      handleValidationResult: this.handleValidationResult.bind(this),
      handlePlanComplete: this.handlePlanComplete.bind(this),
      addExecutionLog: this.addExecutionLog.bind(this),
      toggleNode: this.toggleNode.bind(this),
      setGoal: this.setGoal.bind(this),
      setCurrentPlan: this.setCurrentPlan.bind(this),
      setDecompositionTree: this.setDecompositionTree.bind(this),
      getState: this.getState.bind(this),
      updateState: this.updateState.bind(this)
    };
    
    // Store API reference
    this.api = api;
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
  }

  onModelChange(changes) {
    if ('planningStatus' in changes) {
      this.view.updatePlanningStatus(changes.planningStatus);
    }
    
    if ('validationResult' in changes) {
      this.view.updateValidationStatus(changes.validationResult);
    }
    
    if ('executionStatus' in changes) {
      this.view.updateExecutionControls(changes.executionStatus);
    }
    
    if ('decompositionTree' in changes) {
      this.view.renderDecompositionTree(changes.decompositionTree);
    }
    
    if ('currentPlan' in changes && changes.currentPlan) {
      // Enable save and execute buttons when plan is ready
      const saveButton = this.view.container.querySelector('.save-plan-button');
      const executeButton = this.view.container.querySelector('.execute-button');
      saveButton.disabled = false;
      executeButton.disabled = false;
    }
  }

  // Goal management
  setGoal(goal) {
    this.model.updateState('goal', goal);
  }

  clearGoal() {
    this.model.updateState('goal', '');
    const textarea = this.view.container.querySelector('.goal-textarea');
    textarea.value = '';
  }

  // Planning operations
  async createPlan() {
    const goal = this.model.getState('goal');
    if (!goal) {
      this.addExecutionLog('Please enter a goal first', 'error');
      return;
    }
    
    this.model.updateState('planningStatus', 'creating');
    this.view.clearExecutionLogs();
    this.addExecutionLog(`Creating plan for: ${goal}`, 'info');
    
    if (this.umbilical.planningActor) {
      try {
        await this.umbilical.planningActor.createPlan(goal, {}, {});
        // Status will be updated by handlePlanComplete
      } catch (error) {
        this.model.updateState('planningStatus', 'error');
        this.addExecutionLog(`Error creating plan: ${error.message}`, 'error');
      }
    } else {
      // No planning actor available - for testing purposes
      this.model.updateState('planningStatus', 'idle');
    }
  }

  async savePlan(name) {
    const currentPlan = this.model.getState('currentPlan');
    if (!currentPlan) {
      this.addExecutionLog('No plan to save', 'error');
      return;
    }
    
    const planToSave = {
      ...currentPlan,
      name,
      savedAt: new Date().toISOString()
    };
    
    if (this.umbilical.planningActor) {
      try {
        await this.umbilical.planningActor.savePlan(planToSave);
        this.addExecutionLog(`Plan saved as: ${name}`, 'success');
      } catch (error) {
        this.addExecutionLog(`Error saving plan: ${error.message}`, 'error');
      }
    }
  }

  async loadPlan(planId) {
    if (this.umbilical.planningActor) {
      try {
        await this.umbilical.planningActor.loadPlan(planId);
        this.addExecutionLog(`Loading plan: ${planId}`, 'info');
      } catch (error) {
        this.addExecutionLog(`Error loading plan: ${error.message}`, 'error');
      }
    }
  }

  // Decomposition handling
  handleDecompositionNode(data) {
    this.view.addDecompositionNode(data);
    
    // Also call umbilical callback if available
    if (this.umbilical.onDecompositionNode) {
      this.umbilical.onDecompositionNode(data);
    }
  }

  setDecompositionTree(tree) {
    this.model.updateState('decompositionTree', tree);
  }

  // Validation handling
  handleValidationResult(result) {
    this.model.updateState('validationResult', result);
  }

  // Plan completion
  handlePlanComplete(plan) {
    this.model.updateState('currentPlan', plan);
    this.model.updateState('planningStatus', 'complete');
    this.addExecutionLog('Plan creation complete', 'success');
    
    if (this.umbilical.onPlanComplete) {
      this.umbilical.onPlanComplete(plan);
    }
  }

  setCurrentPlan(plan) {
    this.model.updateState('currentPlan', plan);
  }

  // Execution operations
  async startExecution() {
    const plan = this.model.getState('currentPlan');
    if (!plan) {
      this.addExecutionLog('No plan to execute', 'error');
      return;
    }
    
    this.model.updateState('executionStatus', 'starting');
    this.addExecutionLog('Starting execution...', 'info');
    
    if (this.umbilical.executionActor) {
      try {
        const executionId = `exec-${Date.now()}`;
        const behaviorTree = plan.behaviorTrees?.main || plan.behaviorTree || {};
        await this.umbilical.executionActor.startExecution(executionId, behaviorTree, {});
        this.model.updateState('currentExecutionId', executionId);
      } catch (error) {
        this.model.updateState('executionStatus', 'error');
        this.addExecutionLog(`Error starting execution: ${error.message}`, 'error');
      }
    }
  }

  async pauseExecution() {
    const executionId = this.model.getState('currentExecutionId');
    if (!executionId) return;
    
    if (this.umbilical.executionActor) {
      try {
        await this.umbilical.executionActor.pauseExecution(executionId);
        this.model.updateState('executionStatus', 'paused');
        this.addExecutionLog('Execution paused', 'info');
      } catch (error) {
        this.addExecutionLog(`Error pausing execution: ${error.message}`, 'error');
      }
    }
  }

  async resumeExecution() {
    const executionId = this.model.getState('currentExecutionId');
    if (!executionId) return;
    
    if (this.umbilical.executionActor) {
      try {
        await this.umbilical.executionActor.resumeExecution(executionId);
        this.model.updateState('executionStatus', 'running');
        this.addExecutionLog('Execution resumed', 'info');
      } catch (error) {
        this.addExecutionLog(`Error resuming execution: ${error.message}`, 'error');
      }
    }
  }

  async stopExecution() {
    const executionId = this.model.getState('currentExecutionId');
    if (!executionId) return;
    
    if (this.umbilical.executionActor) {
      try {
        await this.umbilical.executionActor.stopExecution(executionId);
        this.model.updateState('executionStatus', 'stopped');
        this.addExecutionLog('Execution stopped', 'info');
      } catch (error) {
        this.addExecutionLog(`Error stopping execution: ${error.message}`, 'error');
      }
    }
  }

  async stepExecution() {
    const executionId = this.model.getState('currentExecutionId');
    if (!executionId) return;
    
    if (this.umbilical.executionActor) {
      try {
        await this.umbilical.executionActor.stepExecution(executionId);
        this.addExecutionLog('Step executed', 'info');
      } catch (error) {
        this.addExecutionLog(`Error stepping execution: ${error.message}`, 'error');
      }
    }
  }

  // Tree interaction
  toggleNode(nodeId) {
    const collapsedNodes = this.model.getState('collapsedNodes');
    if (collapsedNodes.has(nodeId)) {
      collapsedNodes.delete(nodeId);
    } else {
      collapsedNodes.add(nodeId);
    }
    this.view.toggleNode(nodeId);
  }

  // Logging
  addExecutionLog(message, type = 'info') {
    const logs = this.model.getState('executionLogs');
    logs.push({ message, type, timestamp: new Date() });
    this.model.updateState('executionLogs', logs);
    this.view.addExecutionLog(message, type);
  }

  // State access for testing
  getState(key) {
    return this.model.getState(key);
  }

  updateState(key, value) {
    this.model.updateState(key, value);
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
 * PlanningWorkspacePanel - Main component class
 */
export class PlanningWorkspacePanel {
  static async create(umbilical) {
    // Validate umbilical - pass array of required capabilities
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'PlanningWorkspacePanel');
    
    // Create MVVM components
    const model = new PlanningWorkspacePanelModel();
    const view = new PlanningWorkspacePanelView(umbilical.dom, null);
    const viewModel = new PlanningWorkspacePanelViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}