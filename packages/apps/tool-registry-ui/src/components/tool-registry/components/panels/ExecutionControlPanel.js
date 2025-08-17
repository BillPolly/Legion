/**
 * ExecutionControlPanel Component
 * Provides controls for managing plan execution with real-time monitoring
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { StandardizedComponentAPI, apiMethod, validateState } from '../../base/StandardizedComponentAPI.js';
import { APIResponse } from '../../interfaces/ComponentAPI.js';

/**
 * Model - Manages execution control state
 */
class ExecutionControlModel {
  constructor() {
    this.state = {
      currentPlan: null,
      executionId: null,
      executionStatus: 'idle', // idle, starting, running, paused, stopping, stopped, completed, error
      executionMode: 'sequential', // sequential, parallel, custom
      executionOptions: {
        continueOnError: false,
        maxRetries: 3,
        timeout: 300000, // 5 minutes default
        parallelLimit: 5,
        debugMode: false,
        dryRun: false
      },
      activeTask: null,
      taskQueue: [],
      completedTasks: [],
      failedTasks: [],
      executionLog: [],
      executionMetrics: {
        startTime: null,
        endTime: null,
        duration: 0,
        totalTasks: 0,
        successRate: 0
      },
      breakpoints: new Set(),
      variables: {},
      environment: 'development'
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

  addLogEntry(entry) {
    this.state.executionLog.push({
      ...entry,
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random()
    });
    this.notifyListeners({ executionLog: this.state.executionLog });
  }

  updateMetrics() {
    const { startTime, endTime } = this.state.executionMetrics;
    const totalTasks = this.state.taskQueue.length + 
                      this.state.completedTasks.length + 
                      this.state.failedTasks.length;
    
    const successRate = totalTasks > 0 
      ? (this.state.completedTasks.length / totalTasks) * 100 
      : 0;

    this.state.executionMetrics = {
      ...this.state.executionMetrics,
      duration: startTime && endTime ? new Date(endTime) - new Date(startTime) : 0,
      totalTasks,
      successRate
    };

    this.notifyListeners({ executionMetrics: this.state.executionMetrics });
  }

  reset() {
    this.state = {
      currentPlan: null,
      executionId: null,
      executionStatus: 'idle',
      executionMode: 'sequential',
      executionOptions: {
        continueOnError: false,
        maxRetries: 3,
        timeout: 300000,
        parallelLimit: 5,
        debugMode: false,
        dryRun: false
      },
      activeTask: null,
      taskQueue: [],
      completedTasks: [],
      failedTasks: [],
      executionLog: [],
      executionMetrics: {
        startTime: null,
        endTime: null,
        duration: 0,
        totalTasks: 0,
        successRate: 0
      },
      breakpoints: new Set(),
      variables: {},
      environment: 'development'
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders execution controls and handles DOM updates
 */
class ExecutionControlView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="execution-control-panel">
        <!-- Header with Status -->
        <div class="execution-header">
          <h3>Execution Control</h3>
          <div class="execution-status-indicator">
            <span class="status-dot"></span>
            <span class="status-text">Idle</span>
          </div>
        </div>

        <!-- Plan Information -->
        <div class="plan-info-section">
          <h4>Current Plan</h4>
          <div class="plan-summary">
            <div class="plan-name">No plan loaded</div>
            <div class="plan-tasks-count">0 tasks</div>
          </div>
        </div>

        <!-- Execution Controls -->
        <div class="execution-controls">
          <div class="primary-controls">
            <button class="start-execution-button" disabled>▶ Start</button>
            <button class="pause-execution-button" disabled>⏸ Pause</button>
            <button class="resume-execution-button" disabled>▶ Resume</button>
            <button class="stop-execution-button" disabled>⏹ Stop</button>
            <button class="step-execution-button" disabled>⏭ Step</button>
          </div>
          
          <div class="secondary-controls">
            <button class="reset-execution-button">🔄 Reset</button>
            <button class="debug-toggle-button">🐛 Debug</button>
            <button class="dry-run-toggle-button">📋 Dry Run</button>
          </div>
        </div>

        <!-- Execution Mode Configuration -->
        <div class="execution-mode-section">
          <h4>Execution Mode</h4>
          <div class="mode-selection">
            <label>
              <input type="radio" name="execution-mode" value="sequential" checked>
              Sequential
            </label>
            <label>
              <input type="radio" name="execution-mode" value="parallel">
              Parallel
            </label>
            <label>
              <input type="radio" name="execution-mode" value="custom">
              Custom
            </label>
          </div>
        </div>

        <!-- Execution Options -->
        <div class="execution-options-section">
          <h4>Options</h4>
          <div class="options-grid">
            <label>
              <input type="checkbox" class="continue-on-error-option">
              Continue on Error
            </label>
            <label>
              Max Retries:
              <input type="number" class="max-retries-input" value="3" min="0" max="10">
            </label>
            <label>
              Timeout (seconds):
              <input type="number" class="timeout-input" value="300" min="10" max="3600">
            </label>
            <label>
              Parallel Limit:
              <input type="number" class="parallel-limit-input" value="5" min="1" max="20">
            </label>
          </div>
        </div>

        <!-- Active Task Display -->
        <div class="active-task-section">
          <h4>Current Task</h4>
          <div class="active-task-info">
            <div class="task-name">No active task</div>
            <div class="task-progress">
              <div class="progress-bar">
                <div class="progress-fill"></div>
                <span class="progress-text">0%</span>
              </div>
            </div>
            <div class="task-details">
              <span class="task-status">idle</span>
              <span class="task-duration">--</span>
            </div>
          </div>
        </div>

        <!-- Execution Queue -->
        <div class="execution-queue-section">
          <h4>Task Queue</h4>
          <div class="queue-tabs">
            <button class="queue-tab active" data-tab="pending">Pending</button>
            <button class="queue-tab" data-tab="completed">Completed</button>
            <button class="queue-tab" data-tab="failed">Failed</button>
          </div>
          <div class="queue-content">
            <div class="task-list pending-tasks"></div>
            <div class="task-list completed-tasks" style="display: none;"></div>
            <div class="task-list failed-tasks" style="display: none;"></div>
          </div>
        </div>

        <!-- Execution Log -->
        <div class="execution-log-section">
          <h4>Execution Log</h4>
          <div class="log-controls">
            <button class="clear-log-button">Clear</button>
            <button class="export-log-button">Export</button>
            <select class="log-level-filter">
              <option value="all">All Levels</option>
              <option value="error">Errors Only</option>
              <option value="warning">Warnings+</option>
              <option value="info">Info+</option>
            </select>
          </div>
          <div class="execution-log-display"></div>
        </div>

        <!-- Execution Metrics -->
        <div class="metrics-section">
          <h4>Metrics</h4>
          <div class="metrics-grid">
            <div class="metric-item">
              <span class="metric-label">Duration:</span>
              <span class="metric-value duration-value">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Success Rate:</span>
              <span class="metric-value success-rate-value">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Tasks/Min:</span>
              <span class="metric-value throughput-value">--</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Memory:</span>
              <span class="metric-value memory-value">--</span>
            </div>
          </div>
        </div>

        <!-- Variables Section -->
        <div class="variables-section">
          <h4>Variables</h4>
          <div class="variables-controls">
            <input type="text" class="variable-name-input" placeholder="Variable name">
            <input type="text" class="variable-value-input" placeholder="Value">
            <button class="add-variable-button">Add</button>
          </div>
          <div class="variables-list"></div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Primary execution controls
    const startButton = this.container.querySelector('.start-execution-button');
    startButton.addEventListener('click', () => this.viewModel.startExecution());

    const pauseButton = this.container.querySelector('.pause-execution-button');
    pauseButton.addEventListener('click', () => this.viewModel.pauseExecution());

    const resumeButton = this.container.querySelector('.resume-execution-button');
    resumeButton.addEventListener('click', () => this.viewModel.resumeExecution());

    const stopButton = this.container.querySelector('.stop-execution-button');
    stopButton.addEventListener('click', () => this.viewModel.stopExecution());

    const stepButton = this.container.querySelector('.step-execution-button');
    stepButton.addEventListener('click', () => this.viewModel.stepExecution());

    // Secondary controls
    const resetButton = this.container.querySelector('.reset-execution-button');
    resetButton.addEventListener('click', () => this.viewModel.resetExecution());

    const debugToggle = this.container.querySelector('.debug-toggle-button');
    debugToggle.addEventListener('click', () => this.viewModel.toggleDebugMode());

    const dryRunToggle = this.container.querySelector('.dry-run-toggle-button');
    dryRunToggle.addEventListener('click', () => this.viewModel.toggleDryRun());

    // Execution mode
    const modeRadios = this.container.querySelectorAll('input[name="execution-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.viewModel.setExecutionMode(e.target.value);
        }
      });
    });

    // Options
    const continueOnError = this.container.querySelector('.continue-on-error-option');
    continueOnError.addEventListener('change', (e) => {
      this.viewModel.setExecutionOption('continueOnError', e.target.checked);
    });

    const maxRetries = this.container.querySelector('.max-retries-input');
    maxRetries.addEventListener('change', (e) => {
      this.viewModel.setExecutionOption('maxRetries', parseInt(e.target.value));
    });

    const timeout = this.container.querySelector('.timeout-input');
    timeout.addEventListener('change', (e) => {
      this.viewModel.setExecutionOption('timeout', parseInt(e.target.value) * 1000);
    });

    const parallelLimit = this.container.querySelector('.parallel-limit-input');
    parallelLimit.addEventListener('change', (e) => {
      this.viewModel.setExecutionOption('parallelLimit', parseInt(e.target.value));
    });

    // Queue tabs
    const queueTabs = this.container.querySelectorAll('.queue-tab');
    queueTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchQueueTab(tab.dataset.tab);
      });
    });

    // Log controls
    const clearLogButton = this.container.querySelector('.clear-log-button');
    clearLogButton.addEventListener('click', () => this.viewModel.clearLog());

    const exportLogButton = this.container.querySelector('.export-log-button');
    exportLogButton.addEventListener('click', () => this.viewModel.exportLog());

    const logLevelFilter = this.container.querySelector('.log-level-filter');
    logLevelFilter.addEventListener('change', (e) => {
      this.updateLogDisplay(this.viewModel.model.getState('executionLog'), e.target.value);
    });

    // Variables
    const addVariableButton = this.container.querySelector('.add-variable-button');
    addVariableButton.addEventListener('click', () => this.addVariable());

    const variableInputs = this.container.querySelectorAll('.variable-name-input, .variable-value-input');
    variableInputs.forEach(input => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addVariable();
        }
      });
    });
  }

  updateExecutionStatus(status) {
    const statusDot = this.container.querySelector('.status-dot');
    const statusText = this.container.querySelector('.status-text');
    
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    
    this.updateControlButtons(status);
  }

  updateControlButtons(status) {
    const buttons = {
      start: this.container.querySelector('.start-execution-button'),
      pause: this.container.querySelector('.pause-execution-button'),
      resume: this.container.querySelector('.resume-execution-button'),
      stop: this.container.querySelector('.stop-execution-button'),
      step: this.container.querySelector('.step-execution-button')
    };

    // Reset all buttons
    Object.values(buttons).forEach(btn => btn.disabled = true);

    switch (status) {
      case 'idle':
      case 'stopped':
      case 'completed':
      case 'error':
        buttons.start.disabled = false;
        break;
      case 'running':
        buttons.pause.disabled = false;
        buttons.stop.disabled = false;
        buttons.step.disabled = false;
        break;
      case 'paused':
        buttons.resume.disabled = false;
        buttons.stop.disabled = false;
        buttons.step.disabled = false;
        break;
    }
  }

  updatePlanInfo(plan) {
    const planName = this.container.querySelector('.plan-name');
    const tasksCount = this.container.querySelector('.plan-tasks-count');
    
    if (plan) {
      planName.textContent = plan.name || plan.id || 'Unnamed Plan';
      const taskCount = this.countPlanTasks(plan);
      tasksCount.textContent = `${taskCount} tasks`;
    } else {
      planName.textContent = 'No plan loaded';
      tasksCount.textContent = '0 tasks';
    }
  }

  countPlanTasks(plan) {
    if (!plan.hierarchy || !plan.hierarchy.root) return 0;
    
    const countNodes = (node) => {
      let count = 1;
      if (node.children) {
        count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
      }
      return count;
    };
    
    return countNodes(plan.hierarchy.root);
  }

  updateActiveTask(task) {
    const taskName = this.container.querySelector('.task-name');
    const taskStatus = this.container.querySelector('.task-status');
    const taskDuration = this.container.querySelector('.task-duration');
    const progressFill = this.container.querySelector('.progress-fill');
    const progressText = this.container.querySelector('.progress-text');
    
    if (task) {
      taskName.textContent = task.name || task.id;
      taskStatus.textContent = task.status;
      taskDuration.textContent = task.duration ? this.formatDuration(task.duration) : '--';
      
      const progress = task.progress || 0;
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${Math.round(progress)}%`;
    } else {
      taskName.textContent = 'No active task';
      taskStatus.textContent = 'idle';
      taskDuration.textContent = '--';
      progressFill.style.width = '0%';
      progressText.textContent = '0%';
    }
  }

  updateTaskQueues(taskQueue, completedTasks, failedTasks) {
    this.updateTaskList('.pending-tasks', taskQueue, 'pending');
    this.updateTaskList('.completed-tasks', completedTasks, 'completed');
    this.updateTaskList('.failed-tasks', failedTasks, 'failed');
  }

  updateTaskList(selector, tasks, status) {
    const listElement = this.container.querySelector(selector);
    
    if (!tasks || tasks.length === 0) {
      listElement.innerHTML = `<div class="empty-list">No ${status} tasks</div>`;
      return;
    }
    
    listElement.innerHTML = tasks.map(task => `
      <div class="task-item ${status}" data-task-id="${task.id}">
        <div class="task-item-header">
          <span class="task-item-name">${task.name || task.id}</span>
          <span class="task-item-status">${task.status}</span>
        </div>
        <div class="task-item-details">
          ${task.duration ? `<span class="task-duration">${this.formatDuration(task.duration)}</span>` : ''}
          ${task.error ? `<span class="task-error">${task.error}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  switchQueueTab(tabName) {
    // Update tab appearance
    const tabs = this.container.querySelectorAll('.queue-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Show/hide task lists
    const taskLists = this.container.querySelectorAll('.task-list');
    taskLists.forEach(list => {
      list.style.display = 'none';
    });
    
    const activeList = this.container.querySelector(`.${tabName}-tasks`);
    if (activeList) {
      activeList.style.display = 'block';
    }
  }

  updateLogDisplay(log, levelFilter = 'all') {
    const logDisplay = this.container.querySelector('.execution-log-display');
    
    let filteredLog = log;
    if (levelFilter !== 'all') {
      const levels = { error: 0, warning: 1, info: 2, debug: 3 };
      const filterLevel = levels[levelFilter];
      filteredLog = log.filter(entry => levels[entry.level] <= filterLevel);
    }
    
    logDisplay.innerHTML = filteredLog.slice(-100).map(entry => `
      <div class="log-entry ${entry.level}">
        <span class="log-timestamp">${new Date(entry.timestamp).toLocaleTimeString()}</span>
        <span class="log-level">[${entry.level.toUpperCase()}]</span>
        <span class="log-message">${entry.message}</span>
        ${entry.taskId ? `<span class="log-task-id">(${entry.taskId})</span>` : ''}
      </div>
    `).join('');
    
    // Auto-scroll to bottom
    logDisplay.scrollTop = logDisplay.scrollHeight;
  }

  updateMetrics(metrics) {
    const durationValue = this.container.querySelector('.duration-value');
    const successRateValue = this.container.querySelector('.success-rate-value');
    const throughputValue = this.container.querySelector('.throughput-value');
    
    durationValue.textContent = metrics.duration ? this.formatDuration(metrics.duration) : '--';
    successRateValue.textContent = metrics.totalTasks > 0 ? `${Math.round(metrics.successRate)}%` : '--';
    
    if (metrics.duration > 0 && metrics.totalTasks > 0) {
      const throughput = (metrics.totalTasks / (metrics.duration / 60000)).toFixed(1);
      throughputValue.textContent = `${throughput}/min`;
    } else {
      throughputValue.textContent = '--';
    }
  }

  updateVariables(variables) {
    const variablesList = this.container.querySelector('.variables-list');
    
    if (!variables || Object.keys(variables).length === 0) {
      variablesList.innerHTML = '<div class="empty-variables">No variables defined</div>';
      return;
    }
    
    variablesList.innerHTML = Object.entries(variables).map(([key, value]) => `
      <div class="variable-item" data-variable="${key}">
        <span class="variable-name">${key}</span>
        <span class="variable-value">${value}</span>
        <button class="remove-variable-button" data-variable="${key}">×</button>
      </div>
    `).join('');
    
    // Bind remove buttons
    const removeButtons = variablesList.querySelectorAll('.remove-variable-button');
    removeButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.viewModel.removeVariable(button.dataset.variable);
      });
    });
  }

  addVariable() {
    const nameInput = this.container.querySelector('.variable-name-input');
    const valueInput = this.container.querySelector('.variable-value-input');
    
    const name = nameInput.value.trim();
    const value = valueInput.value.trim();
    
    if (name && value) {
      this.viewModel.setVariable(name, value);
      nameInput.value = '';
      valueInput.value = '';
    }
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 * Now extends StandardizedComponentAPI for consistent interface
 */
class ExecutionControlViewModel extends StandardizedComponentAPI {
  constructor(model, view, umbilical) {
    // Initialize base standardized API
    super(model, view, umbilical, 'ExecutionControlPanel');
    
    this.view = view;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
  }

  /**
   * Component-specific API methods for ExecutionControlPanel
   * Follows standardized naming conventions and error handling
   */
  getComponentSpecificMethods() {
    return {
      // === PLAN METHODS ===
      setPlan: this.setPlan.bind(this),
      getPlan: () => this.model.getState('currentPlan'),
      
      // === EXECUTION CONTROL ===
      startExecution: this.startExecution.bind(this),
      pauseExecution: this.pauseExecution.bind(this),
      resumeExecution: this.resumeExecution.bind(this),
      stopExecution: this.stopExecution.bind(this),
      stepExecution: this.stepExecution.bind(this),
      resetExecution: this.resetExecution.bind(this),
      
      // === EXECUTION STATUS ===
      getExecutionStatus: () => this.model.getState('executionStatus'),
      getExecutionId: () => this.model.getState('executionId'),
      getExecutionMetrics: () => this.model.getState('executionMetrics'),
      
      // === EXECUTION CONFIGURATION ===
      setExecutionMode: this.setExecutionMode.bind(this),
      getExecutionMode: () => this.model.getState('executionMode'),
      setExecutionOption: this.setExecutionOption.bind(this),
      getExecutionOptions: () => this.model.getState('executionOptions'),
      
      // === TASK MANAGEMENT ===
      updateTaskProgress: this.updateTaskProgress.bind(this),
      getActiveTask: () => this.model.getState('activeTask'),
      getTaskQueue: () => this.model.getState('taskQueue'),
      getCompletedTasks: () => this.model.getState('completedTasks'),
      getFailedTasks: () => this.model.getState('failedTasks'),
      
      // === LOGGING ===
      addLogEntry: this.addLogEntry.bind(this),
      clearLog: this.clearLog.bind(this),
      exportLog: this.exportLog.bind(this),
      getExecutionLog: () => this.model.getState('executionLog'),
      
      // === VARIABLES ===
      setVariable: this.setVariable.bind(this),
      removeVariable: this.removeVariable.bind(this),
      clearVariables: this.clearVariables.bind(this),
      getVariables: () => this.model.getState('variables'),
      
      // === ENVIRONMENT ===
      setEnvironment: this.setEnvironment.bind(this),
      getEnvironment: this.getEnvironment.bind(this),
      
      // === DEBUGGING ===
      setBreakpoint: this.setBreakpoint.bind(this),
      removeBreakpoint: this.removeBreakpoint.bind(this),
      getBreakpoints: () => Array.from(this.model.getState('breakpoints'))
    };
  }

  /**
   * Component-specific validation for ExecutionControlPanel
   */
  getComponentSpecificValidationErrors() {
    const errors = [];
    
    // Check if execution actor is available when needed
    const status = this.model.getState('executionStatus');
    if (['running', 'starting'].includes(status) && !this.umbilical.executionActor) {
      errors.push('Execution actor not available but execution is active');
    }
    
    // Check if plan is valid for execution
    const plan = this.model.getState('currentPlan');
    if (plan && (!plan.hierarchy || !plan.hierarchy.root)) {
      errors.push('Current plan has invalid hierarchy structure');
    }
    
    // Check execution options validity
    const options = this.model.getState('executionOptions');
    if (options.maxRetries < 0) {
      errors.push('Max retries cannot be negative');
    }
    if (options.timeout <= 0) {
      errors.push('Timeout must be positive');
    }
    if (options.parallelLimit <= 0) {
      errors.push('Parallel limit must be positive');
    }
    
    return errors;
  }

  onModelChange(changes) {
    if ('executionStatus' in changes) {
      this.view.updateExecutionStatus(changes.executionStatus);
    }
    
    if ('currentPlan' in changes) {
      this.view.updatePlanInfo(changes.currentPlan);
    }
    
    if ('activeTask' in changes) {
      this.view.updateActiveTask(changes.activeTask);
    }
    
    if ('taskQueue' in changes || 'completedTasks' in changes || 'failedTasks' in changes) {
      this.view.updateTaskQueues(
        this.model.getState('taskQueue'),
        this.model.getState('completedTasks'),
        this.model.getState('failedTasks')
      );
    }
    
    if ('executionLog' in changes) {
      this.view.updateLogDisplay(changes.executionLog);
    }
    
    if ('executionMetrics' in changes) {
      this.view.updateMetrics(changes.executionMetrics);
    }
    
    if ('variables' in changes) {
      this.view.updateVariables(changes.variables);
    }
  }

  setPlan(plan) {
    if (!plan) {
      return APIResponse.error('Plan cannot be null');
    }
    
    this.model.updateState('currentPlan', plan);
    
    // Initialize task queue from plan
    if (plan && plan.hierarchy) {
      const tasks = this.extractTasksFromPlan(plan);
      this.model.updateState('taskQueue', tasks);
      this.model.updateState('completedTasks', []);
      this.model.updateState('failedTasks', []);
    }
    
    return APIResponse.success(plan);
  }

  extractTasksFromPlan(plan) {
    const tasks = [];
    
    const extractFromNode = (node) => {
      if (node.complexity === 'SIMPLE') {
        tasks.push({
          id: node.id,
          name: node.description,
          status: 'pending',
          dependencies: node.dependencies || [],
          tools: node.tools || []
        });
      }
      
      if (node.children) {
        node.children.forEach(extractFromNode);
      }
    };
    
    if (plan.hierarchy.root) {
      extractFromNode(plan.hierarchy.root);
    }
    
    return tasks;
  }

  async startExecution() {
    const plan = this.model.getState('currentPlan');
    if (!plan) {
      this.addLogEntry({ level: 'error', message: 'No plan available for execution' });
      return APIResponse.error('No plan available for execution');
    }
    
    // Check actor connectivity
    if (this.umbilical.executionActor && this.umbilical.executionActor.isConnected && !this.umbilical.executionActor.isConnected()) {
      this.addLogEntry({ level: 'error', message: 'Execution actor is not connected' });
      return APIResponse.error('Execution actor is not connected');
    }
    
    this.model.updateState('executionStatus', 'starting');
    this.model.updateState('executionId', `exec-${Date.now()}`);
    this.model.updateState('executionMetrics', {
      ...this.model.getState('executionMetrics'),
      startTime: new Date().toISOString()
    });
    
    this.addLogEntry({ level: 'info', message: 'Starting plan execution' });
    
    if (this.umbilical.executionActor) {
      try {
        const executionId = this.model.getState('executionId');
        const mode = this.model.getState('executionMode');
        const options = this.model.getState('executionOptions');
        
        const result = await this.umbilical.executionActor.startExecution({
          planId: plan.id,
          mode,
          options
        });
        
        this.model.updateState('executionStatus', 'running');
        
        if (this.umbilical.onExecutionStart) {
          this.umbilical.onExecutionStart({ executionId });
        }
        
        return APIResponse.success({ success: true, executionId, ...result });
      } catch (error) {
        this.model.updateState('executionStatus', 'error');
        this.addLogEntry({ level: 'error', message: `Failed to start execution: ${error.message}` });
        return APIResponse.error(`Failed to start execution: ${error.message}`);
      }
    } else {
      // Simulation mode for testing
      this.model.updateState('executionStatus', 'running');
      this.addLogEntry({ level: 'info', message: 'Execution started (simulation mode)' });
      return APIResponse.success({ success: true, executionId: this.model.getState('executionId') });
    }
  }

  async pauseExecution() {
    const executionId = this.model.getState('executionId');
    if (!executionId) {
      return APIResponse.error('No active execution to pause');
    }
    
    this.model.updateState('executionStatus', 'paused');
    this.addLogEntry({ level: 'info', message: 'Execution paused' });
    
    if (this.umbilical.executionActor) {
      const result = await this.umbilical.executionActor.pauseExecution(executionId);
      if (this.umbilical.onExecutionPause) {
        this.umbilical.onExecutionPause();
      }
      return APIResponse.success({ success: true, ...result });
    }
    
    if (this.umbilical.onExecutionPause) {
      this.umbilical.onExecutionPause();
    }
    
    return APIResponse.success({ success: true, executionId, status: 'paused' });
  }

  async resumeExecution() {
    const executionId = this.model.getState('executionId');
    if (!executionId) {
      return APIResponse.error('No paused execution to resume');
    }
    
    this.model.updateState('executionStatus', 'running');
    this.addLogEntry({ level: 'info', message: 'Execution resumed' });
    
    if (this.umbilical.executionActor) {
      const result = await this.umbilical.executionActor.resumeExecution(executionId);
      if (this.umbilical.onExecutionResume) {
        this.umbilical.onExecutionResume();
      }
      return APIResponse.success({ success: true, ...result });
    }
    
    if (this.umbilical.onExecutionResume) {
      this.umbilical.onExecutionResume();
    }
    
    return APIResponse.success({ success: true, executionId, status: 'running' });
  }

  async stopExecution() {
    const executionId = this.model.getState('executionId');
    if (!executionId) {
      return APIResponse.error('No active execution to stop');
    }
    
    this.model.updateState('executionStatus', 'stopping');
    this.addLogEntry({ level: 'info', message: 'Stopping execution' });
    
    if (this.umbilical.executionActor) {
      const result = await this.umbilical.executionActor.stopExecution(executionId);
    }
    
    this.model.updateState('executionStatus', 'stopped');
    this.model.updateState('activeTask', null);
    this.model.updateState('executionMetrics', {
      ...this.model.getState('executionMetrics'),
      endTime: new Date().toISOString()
    });
    this.model.updateMetrics();
    
    return APIResponse.success({ success: true, executionId, status: 'stopped' });
  }

  async stepExecution() {
    const executionId = this.model.getState('executionId');
    if (!executionId) {
      return APIResponse.error('No active execution for stepping');
    }
    
    this.addLogEntry({ level: 'info', message: 'Stepping to next task' });
    
    if (this.umbilical.executionActor) {
      const result = await this.umbilical.executionActor.stepExecution(executionId);
      return APIResponse.success({ success: true, ...result });
    }
    
    return APIResponse.success({ success: true, executionId, action: 'step' });
  }

  resetExecution() {
    if (this.umbilical.onExecutionReset) {
      this.umbilical.onExecutionReset();
    }
    
    this.model.reset();
    
    return APIResponse.success({ message: 'Execution reset successfully' });
  }

  setExecutionMode(mode) {
    const validModes = ['sequential', 'parallel', 'step'];
    if (!validModes.includes(mode)) {
      return APIResponse.error(`Invalid execution mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
    }
    
    this.model.updateState('executionMode', mode);
    this.addLogEntry({ level: 'info', message: `Execution mode set to ${mode}` });
    return APIResponse.success({ mode });
  }

  setExecutionOption(key, value) {
    const validOptions = ['continueOnError', 'maxRetries', 'timeout', 'parallelLimit', 'debugMode', 'dryRun'];
    if (!validOptions.includes(key)) {
      return APIResponse.error(`Invalid execution option: ${key}. Valid options: ${validOptions.join(', ')}`);
    }
    
    const options = this.model.getState('executionOptions');
    options[key] = value;
    this.model.updateState('executionOptions', options);
    return APIResponse.success({ [key]: value });
  }

  toggleDebugMode() {
    const options = this.model.getState('executionOptions');
    options.debugMode = !options.debugMode;
    this.model.updateState('executionOptions', options);
    
    const debugButton = this.view.container.querySelector('.debug-toggle-button');
    debugButton.classList.toggle('active', options.debugMode);
    
    this.addLogEntry({ 
      level: 'info', 
      message: `Debug mode ${options.debugMode ? 'enabled' : 'disabled'}` 
    });
  }

  toggleDryRun() {
    const options = this.model.getState('executionOptions');
    options.dryRun = !options.dryRun;
    this.model.updateState('executionOptions', options);
    
    const dryRunButton = this.view.container.querySelector('.dry-run-toggle-button');
    dryRunButton.classList.toggle('active', options.dryRun);
    
    this.addLogEntry({ 
      level: 'info', 
      message: `Dry run mode ${options.dryRun ? 'enabled' : 'disabled'}` 
    });
  }

  updateTaskProgress(taskId, progress) {
    const activeTask = {
      id: taskId,
      ...progress,
      duration: progress.startTime ? Date.now() - new Date(progress.startTime) : 0
    };
    
    this.model.updateState('activeTask', activeTask);
    
    // Move tasks between queues based on status
    if (progress.status === 'completed') {
      this.moveTaskToCompleted(taskId);
    } else if (progress.status === 'failed') {
      this.moveTaskToFailed(taskId, progress.error);
    }
    
    this.addLogEntry({
      level: progress.status === 'failed' ? 'error' : 'info',
      message: `Task ${taskId}: ${progress.status}`,
      taskId
    });
  }

  moveTaskToCompleted(taskId) {
    const taskQueue = [...this.model.getState('taskQueue')];
    const completedTasks = [...this.model.getState('completedTasks')];
    
    const taskIndex = taskQueue.findIndex(task => task.id === taskId);
    if (taskIndex >= 0) {
      const task = taskQueue.splice(taskIndex, 1)[0];
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      completedTasks.push(task);
      
      this.model.updateState('taskQueue', taskQueue);
      this.model.updateState('completedTasks', completedTasks);
      this.model.updateMetrics();
    } else {
      // Check if it's already in failed tasks and move it
      const failedTasks = [...this.model.getState('failedTasks')];
      const failedIndex = failedTasks.findIndex(task => task.id === taskId);
      if (failedIndex >= 0) {
        const task = failedTasks.splice(failedIndex, 1)[0];
        task.status = 'completed';
        task.completedAt = new Date().toISOString();
        delete task.error;
        delete task.failedAt;
        completedTasks.push(task);
        
        this.model.updateState('failedTasks', failedTasks);
        this.model.updateState('completedTasks', completedTasks);
        this.model.updateMetrics();
      }
    }
  }

  moveTaskToFailed(taskId, error) {
    const taskQueue = [...this.model.getState('taskQueue')];
    const failedTasks = [...this.model.getState('failedTasks')];
    
    const taskIndex = taskQueue.findIndex(task => task.id === taskId);
    if (taskIndex >= 0) {
      const task = taskQueue.splice(taskIndex, 1)[0];
      task.status = 'failed';
      task.error = error;
      task.failedAt = new Date().toISOString();
      failedTasks.push(task);
      
      this.model.updateState('taskQueue', taskQueue);
      this.model.updateState('failedTasks', failedTasks);
      this.model.updateMetrics();
    }
  }

  addLogEntry(level, message, data = null) {
    const entry = typeof level === 'object' ? level : { level, message, data };
    this.model.addLogEntry(entry);
  }

  clearLog() {
    this.model.updateState('executionLog', []);
  }

  exportLog() {
    const log = this.model.getState('executionLog');
    const executionId = this.model.getState('executionId') || 'unknown';
    
    const logData = {
      executionId,
      exportedAt: new Date().toISOString(),
      log
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `execution-log-${executionId}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  setVariable(name, value) {
    const variables = this.model.getState('variables');
    variables[name] = value;
    this.model.updateState('variables', { ...variables });
    return APIResponse.success({ [name]: value });
  }

  removeVariable(name) {
    const variables = this.model.getState('variables');
    delete variables[name];
    this.model.updateState('variables', { ...variables });
    return APIResponse.success({ removed: name });
  }

  clearVariables() {
    this.model.updateState('variables', {});
    return APIResponse.success({ message: 'All variables cleared' });
  }

  setEnvironment(environment) {
    const validEnvironments = ['development', 'testing', 'production'];
    if (!validEnvironments.includes(environment)) {
      return APIResponse.error(`Invalid environment: ${environment}. Valid environments: ${validEnvironments.join(', ')}`);
    }
    
    this.model.updateState('environment', environment);
    return APIResponse.success({ environment });
  }

  getEnvironment() {
    return this.model.getState('environment');
  }

  setBreakpoint(taskId) {
    const breakpoints = this.model.getState('breakpoints');
    breakpoints.add(taskId);
    this.model.updateState('breakpoints', breakpoints);
    this.addLogEntry({ 
      level: 'info', 
      message: `Breakpoint set for task: ${taskId}` 
    });
  }

  removeBreakpoint(taskId) {
    const breakpoints = this.model.getState('breakpoints');
    breakpoints.delete(taskId);
    this.model.updateState('breakpoints', breakpoints);
    this.addLogEntry({ 
      level: 'info', 
      message: `Breakpoint removed for task: ${taskId}` 
    });
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * ExecutionControlPanel - Main component class
 */
export class ExecutionControlPanel {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ExecutionControlPanel');
    
    // Create MVVM components
    const model = new ExecutionControlModel();
    const view = new ExecutionControlView(umbilical.dom, null);
    const viewModel = new ExecutionControlViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}