/**
 * PlanningWorkspacePanel Component
 * MVVM implementation for planning workspace with goal input, decomposition tree,
 * validation, and execution controls
 * Now includes sub-tabs for decent planner visualization
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { TaskBreakdownPanel } from './TaskBreakdownPanel.js';
import { ToolDiscoveryPanel } from './ToolDiscoveryPanel.js';
import { ValidationPanel } from './ValidationPanel.js';

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
      breakpoints: new Set(),
      activeSubTab: 'overview' // overview, breakdown, discovery, validation, execution
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
        <style>
          .planning-workspace-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: var(--surface-primary);
          }
          
          .planning-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-subtle);
          }
          
          .planning-header h2 {
            margin: 0;
            font-size: 1.5rem;
            color: var(--text-primary);
          }
          
          .planning-sub-tabs {
            display: flex;
            gap: 0.5rem;
            padding: 0 1.5rem;
            background: var(--surface-secondary);
            border-bottom: 1px solid var(--border-subtle);
          }
          
          .sub-tab-button {
            padding: 0.75rem 1.5rem;
            background: transparent;
            border: none;
            border-bottom: 3px solid transparent;
            color: var(--text-secondary);
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .sub-tab-button:hover {
            color: var(--text-primary);
            background: var(--surface-primary);
          }
          
          .sub-tab-button.active {
            color: var(--color-primary);
            border-bottom-color: var(--color-primary);
            background: var(--surface-primary);
          }
          
          .sub-tab-content {
            flex: 1;
            overflow: hidden;
            position: relative;
          }
          
          .sub-tab-panel {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            overflow-y: auto;
          }
          
          .sub-tab-panel.active {
            display: block;
          }
          
          /* Overview Panel Styles */
          .overview-panel {
            padding: 1.5rem;
          }
          
          .goal-input-section {
            background: var(--surface-secondary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
          }
          
          .goal-input-section h3 {
            margin-top: 0;
            color: var(--text-primary);
          }
          
          .goal-textarea {
            width: 100%;
            padding: 0.75rem;
            border: 1px solid var(--border-subtle);
            border-radius: 0.375rem;
            background: var(--surface-primary);
            color: var(--text-primary);
            font-size: 0.95rem;
            resize: vertical;
          }
          
          .goal-controls {
            display: flex;
            gap: 0.75rem;
            margin-top: 1rem;
          }
          
          .plan-button, .clear-button, .save-plan-button, .load-plan-button {
            padding: 0.75rem 1.5rem;
            border-radius: 0.375rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .plan-button {
            background: var(--color-primary);
            color: white;
            border: none;
          }
          
          .plan-button:hover:not(:disabled) {
            background: var(--color-primary-dark);
          }
          
          .clear-button, .save-plan-button, .load-plan-button {
            background: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--border-subtle);
          }
          
          .clear-button:hover, .save-plan-button:hover, .load-plan-button:hover {
            background: var(--surface-secondary);
          }
          
          button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .quick-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 1.5rem;
          }
          
          .stat-card {
            background: var(--surface-secondary);
            border-radius: 0.5rem;
            padding: 1rem;
            text-align: center;
          }
          
          .stat-value {
            font-size: 2rem;
            font-weight: 600;
            color: var(--color-primary);
          }
          
          .stat-label {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }
          
          /* Fix panel height issues */
          .panel-component {
            min-height: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .planning-workspace-panel {
            min-height: 500px;
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .sub-tab-content {
            flex: 1;
            min-height: 400px;
            overflow-y: auto;
            position: relative;
          }
          
          .sub-tab-panel {
            min-height: 100%;
          }
        </style>
        
        <div class="planning-header">
          <h2>🧠 Planning Workspace</h2>
          <div class="planning-status"></div>
        </div>
        
        <!-- Sub-tabs Navigation -->
        <div class="planning-sub-tabs">
          <button class="sub-tab-button active" data-tab="overview">
            Overview
          </button>
          <button class="sub-tab-button" data-tab="breakdown">
            Task Breakdown
          </button>
          <button class="sub-tab-button" data-tab="discovery">
            Tool Discovery
          </button>
          <button class="sub-tab-button" data-tab="validation">
            Validation
          </button>
          <button class="sub-tab-button" data-tab="execution">
            Execution
          </button>
        </div>
        
        <!-- Sub-tab Content Area -->
        <div class="sub-tab-content">
          <!-- Overview Panel -->
          <div class="sub-tab-panel overview-panel active" data-panel="overview">
            <div class="goal-input-section">
              <h3>Goal Definition</h3>
              <textarea 
                class="goal-textarea" 
                placeholder="Enter your goal or task description..."
                rows="3"
              ></textarea>
              <div class="goal-controls">
                <button class="plan-button">Analyze with Decent Planner</button>
                <button class="clear-button">Clear</button>
                <button class="save-plan-button">Save Plan</button>
                <button class="load-plan-button">Load Plan</button>
              </div>
            </div>
            
            <div class="quick-stats">
              <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Total Tasks</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Tools Found</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">-</div>
                <div class="stat-label">Feasibility</div>
              </div>
              <div class="stat-card">
                <div class="stat-value">-</div>
                <div class="stat-label">Status</div>
              </div>
            </div>
          </div>
          
          <!-- Task Breakdown Panel Container -->
          <div class="sub-tab-panel" data-panel="breakdown"></div>
          
          <!-- Tool Discovery Panel Container -->
          <div class="sub-tab-panel" data-panel="discovery"></div>
          
          <!-- Validation Panel Container -->
          <div class="sub-tab-panel" data-panel="validation"></div>
          
          <!-- Execution Panel -->
          <div class="sub-tab-panel" data-panel="execution">
            <div style="padding: 1.5rem;">
              <h3>Execution Console</h3>
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
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Sub-tab navigation
    const tabButtons = this.container.querySelectorAll('.sub-tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        this.viewModel.switchSubTab(tabName);
      });
    });
    
    // Goal input
    const goalTextarea = this.container.querySelector('.goal-textarea');
    goalTextarea.addEventListener('input', (e) => {
      this.viewModel.setGoal(e.target.value);
    });
    
    // Planning controls
    const planButton = this.container.querySelector('.plan-button');
    planButton.addEventListener('click', () => {
      this.viewModel.analyzeWithDecentPlanner();
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

  switchSubTab(tabName) {
    // Update tab buttons
    const tabButtons = this.container.querySelectorAll('.sub-tab-button');
    tabButtons.forEach(button => {
      if (button.dataset.tab === tabName) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
    
    // Update panels
    const panels = this.container.querySelectorAll('.sub-tab-panel');
    panels.forEach(panel => {
      if (panel.dataset.panel === tabName) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
  }
  
  updateQuickStats(stats) {
    const statCards = this.container.querySelectorAll('.stat-card');
    if (statCards.length >= 4) {
      statCards[0].querySelector('.stat-value').textContent = stats.totalTasks || '0';
      statCards[1].querySelector('.stat-value').textContent = stats.toolsFound || '0';
      statCards[2].querySelector('.stat-value').textContent = stats.feasibility || '-';
      statCards[3].querySelector('.stat-value').textContent = stats.status || '-';
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
    
    // Sub-panel instances
    this.subPanels = {
      breakdown: null,
      discovery: null,
      validation: null
    };
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Initialize sub-panels
    this.initializeSubPanels();
    
    // Expose methods to umbilical
    this.exposeMethods();
  }

  async initializeSubPanels() {
    // Wait for DOM to be ready
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Get sub-panel containers
    const breakdownContainer = this.view.container.querySelector('[data-panel="breakdown"]');
    const discoveryContainer = this.view.container.querySelector('[data-panel="discovery"]');
    const validationContainer = this.view.container.querySelector('[data-panel="validation"]');
    
    // Initialize TaskBreakdownPanel
    if (breakdownContainer) {
      const breakdownUmbilical = {
        dom: breakdownContainer,
        onAnalyzeTask: async (task) => {
          return await this.analyzeTaskWithDecentPlanner(task);
        },
        onNodeSelect: (node) => {
          console.log('Task node selected:', node);
          // Update discovery panel with selected task
          if (this.subPanels.discovery && this.subPanels.discovery.api && this.subPanels.discovery.api.selectTask) {
            this.subPanels.discovery.api.selectTask(node.id);
          }
        }
      };
      
      this.subPanels.breakdown = TaskBreakdownPanel.create(breakdownUmbilical);
    }
    
    // Initialize ToolDiscoveryPanel
    if (discoveryContainer) {
      const discoveryUmbilical = {
        dom: discoveryContainer,
        onAnalyzeFeasibility: async (taskTree) => {
          return await this.analyzeFeasibility(taskTree);
        },
        onTaskSelect: (taskId) => {
          console.log('Discovery task selected:', taskId);
        }
      };
      
      this.subPanels.discovery = ToolDiscoveryPanel.create(discoveryUmbilical);
    }
    
    // Initialize ValidationPanel
    if (validationContainer) {
      const validationUmbilical = {
        dom: validationContainer,
        onValidate: async (decomposition) => {
          return await this.validateDecomposition(decomposition);
        },
        onIssueSelect: (issue) => {
          console.log('Validation issue selected:', issue);
        }
      };
      
      this.subPanels.validation = ValidationPanel.create(validationUmbilical);
    }
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
      updateState: this.updateState.bind(this),
      switchSubTab: this.switchSubTab.bind(this),
      analyzeWithDecentPlanner: this.analyzeWithDecentPlanner.bind(this)
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

  // Sub-tab management
  switchSubTab(tabName) {
    this.model.updateState('activeSubTab', tabName);
    this.view.switchSubTab(tabName);
    
    // Update quick stats based on current sub-tab
    this.updateQuickStats();
  }
  
  updateQuickStats() {
    const decomposition = this.model.getState('decompositionTree');
    const validation = this.model.getState('validationResult');
    const discoveredTools = this.subPanels.discovery?.api?.getDiscoveredTools ? 
      this.subPanels.discovery.api.getDiscoveredTools() : null;
    
    let totalTasks = 0;
    let toolsFound = 0;
    let feasibility = '-';
    let status = 'Ready';
    
    if (decomposition) {
      // Count tasks in decomposition tree
      const countTasks = (node) => {
        let count = 1;
        if (node.subtasks) {
          node.subtasks.forEach(child => count += countTasks(child));
        }
        return count;
      };
      
      if (decomposition.root) {
        totalTasks = countTasks(decomposition.root);
      }
    }
    
    if (discoveredTools) {
      // Count total discovered tools
      discoveredTools.forEach(tools => {
        toolsFound += tools.length;
      });
    }
    
    if (validation) {
      feasibility = validation.valid ? 'High' : 'Low';
      status = validation.valid ? 'Valid' : 'Issues';
    }
    
    this.view.updateQuickStats({
      totalTasks,
      toolsFound,
      feasibility,
      status
    });
  }
  
  // Decent Planner Integration
  async analyzeWithDecentPlanner() {
    const goal = this.model.getState('goal');
    if (!goal) {
      this.addExecutionLog('Please enter a goal first', 'error');
      return;
    }
    
    this.model.updateState('planningStatus', 'decomposing');
    this.addExecutionLog(`Analyzing with Decent Planner: ${goal}`, 'info');
    
    try {
      // Step 1: Analyze task breakdown
      const breakdownResult = await this.analyzeTaskWithDecentPlanner(goal);
      
      if (breakdownResult && breakdownResult.decomposition) {
        // Update breakdown panel
        if (this.subPanels.breakdown) {
          this.subPanels.breakdown.setTask(goal);
          this.model.updateState('decompositionTree', breakdownResult.decomposition);
        }
        
        // Switch to breakdown tab to show results
        this.switchSubTab('breakdown');
        
        // Step 2: Analyze feasibility
        const feasibilityResult = await this.analyzeFeasibility(breakdownResult.decomposition);
        
        if (feasibilityResult && this.subPanels.discovery) {
          this.subPanels.discovery.setTaskTree(breakdownResult.decomposition);
        }
        
        // Step 3: Validate decomposition
        const validationResult = await this.validateDecomposition(breakdownResult.decomposition);
        
        if (validationResult && this.subPanels.validation) {
          this.subPanels.validation.setDecomposition(breakdownResult.decomposition);
        }
        
        this.model.updateState('planningStatus', 'complete');
        this.addExecutionLog('Analysis complete', 'success');
        this.updateQuickStats();
      }
    } catch (error) {
      console.error('Decent Planner analysis failed:', error);
      this.model.updateState('planningStatus', 'error');
      this.addExecutionLog(`Analysis failed: ${error.message}`, 'error');
    }
  }
  
  async analyzeTaskWithDecentPlanner(task) {
    // Use the decent planner through umbilical if available
    if (this.umbilical.onAnalyzeTask) {
      return await this.umbilical.onAnalyzeTask(task);
    }
    
    // Fallback: Create mock decomposition
    return {
      decomposition: {
        root: {
          id: 'root',
          task: task,
          description: task,
          complexity: 'complex',
          reasoning: 'Complex task requiring decomposition',
          inputs: ['Requirements'],
          outputs: ['Implementation'],
          subtasks: [
            {
              id: 'sub-1',
              task: 'Initialize project',
              description: 'Set up project structure',
              complexity: 'simple',
              inputs: ['Requirements'],
              outputs: ['Project structure'],
              suggestedTools: ['directory_create', 'file_write']
            },
            {
              id: 'sub-2',
              task: 'Implement functionality',
              description: 'Build core features',
              complexity: 'moderate',
              inputs: ['Project structure'],
              outputs: ['Code modules'],
              suggestedTools: ['generate_javascript_function']
            }
          ]
        }
      },
      complexity: {
        overall: 'complex',
        breakdown: {
          simple: 1,
          moderate: 1,
          complex: 1
        }
      }
    };
  }
  
  async analyzeFeasibility(decomposition) {
    // Use feasibility checker through umbilical if available
    if (this.umbilical.onAnalyzeFeasibility) {
      return await this.umbilical.onAnalyzeFeasibility(decomposition);
    }
    
    // Fallback: Create mock feasibility
    return {
      feasibleTasks: ['sub-1', 'sub-2'],
      infeasibleTasks: [],
      totalConfidence: 0.85,
      taskAnalysis: [
        {
          taskId: 'sub-1',
          tools: [
            {
              name: 'directory_create',
              confidence: 0.95,
              description: 'Create directories'
            },
            {
              name: 'file_write',
              confidence: 0.90,
              description: 'Write files'
            }
          ]
        },
        {
          taskId: 'sub-2',
          tools: [
            {
              name: 'generate_javascript_function',
              confidence: 0.75,
              description: 'Generate JavaScript functions'
            }
          ]
        }
      ]
    };
  }
  
  async validateDecomposition(decomposition) {
    // Use validator through umbilical if available
    if (this.umbilical.onValidateDecomposition) {
      return await this.umbilical.onValidateDecomposition(decomposition);
    }
    
    // Fallback: Create mock validation
    return {
      valid: true,
      structure: {
        valid: true,
        errors: []
      },
      dependencies: {
        valid: true,
        count: 2,
        graph: [
          { from: 'sub-1', to: 'sub-2', type: 'data' }
        ]
      },
      completeness: {
        valid: true,
        coverage: 1.0
      },
      warnings: [],
      errors: []
    };
  }
  
  // Cleanup
  destroy() {
    // Destroy sub-panels
    if (this.subPanels.breakdown) {
      this.subPanels.breakdown.destroy();
    }
    if (this.subPanels.discovery) {
      this.subPanels.discovery.destroy();
    }
    if (this.subPanels.validation) {
      this.subPanels.validation.destroy();
    }
    
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