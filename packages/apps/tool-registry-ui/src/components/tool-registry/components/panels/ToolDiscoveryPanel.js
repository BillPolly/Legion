/**
 * ToolDiscoveryPanel Component
 * Visualizes tool discovery and feasibility analysis from the decent planner
 * Shows which tools can handle each subtask with confidence scores
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages tool discovery state
 */
class ToolDiscoveryPanelModel {
  constructor() {
    this.state = {
      taskTree: null,
      feasibilityResults: null,
      discoveredTools: new Map(), // Map of taskId -> tools[]
      missingCapabilities: [],
      isAnalyzing: false,
      selectedTask: null,
      error: null
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
      taskTree: null,
      feasibilityResults: null,
      discoveredTools: new Map(),
      missingCapabilities: [],
      isAnalyzing: false,
      selectedTask: null,
      error: null
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders UI and handles DOM updates
 */
class ToolDiscoveryPanelView {
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="tool-discovery-panel">
        <style>
          .tool-discovery-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 1.5rem;
            gap: 1.5rem;
            overflow-y: auto;
          }
          
          .discovery-header {
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-subtle);
          }
          
          .discovery-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
          }
          
          .discovery-subtitle {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }
          
          .discovery-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
            flex: 1;
          }
          
          .tasks-section {
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .section-title {
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--text-primary);
          }
          
          .task-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          
          .task-item {
            background: var(--surface-secondary);
            border-radius: 0.375rem;
            padding: 1rem;
            border: 2px solid var(--border-subtle);
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .task-item:hover {
            border-color: var(--color-primary);
            transform: translateX(2px);
          }
          
          .task-item.selected {
            border-color: var(--color-primary);
            background: var(--surface-primary);
          }
          
          .task-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          
          .task-item-name {
            font-weight: 500;
            color: var(--text-primary);
          }
          
          .feasibility-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
          }
          
          .feasibility-high {
            background: var(--color-success-light);
            color: var(--color-success-dark);
          }
          
          .feasibility-medium {
            background: var(--color-warning-light);
            color: var(--color-warning-dark);
          }
          
          .feasibility-low {
            background: var(--color-error-light);
            color: var(--color-error-dark);
          }
          
          .task-item-stats {
            display: flex;
            gap: 1rem;
            font-size: 0.875rem;
            color: var(--text-secondary);
          }
          
          .stat-item {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }
          
          .tools-section {
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .tools-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          
          .tool-card {
            background: var(--surface-secondary);
            border-radius: 0.375rem;
            padding: 1rem;
            border: 1px solid var(--border-subtle);
          }
          
          .tool-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          
          .tool-name {
            font-weight: 500;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .tool-icon {
            font-size: 1rem;
          }
          
          .confidence-score {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
          }
          
          .confidence-bar {
            width: 60px;
            height: 6px;
            background: var(--border-subtle);
            border-radius: 3px;
            overflow: hidden;
          }
          
          .confidence-fill {
            height: 100%;
            background: var(--color-primary);
            transition: width 0.3s;
          }
          
          .confidence-value {
            font-weight: 600;
            color: var(--text-primary);
          }
          
          .tool-description {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
          }
          
          .tool-reasoning {
            font-size: 0.825rem;
            color: var(--text-tertiary);
            font-style: italic;
            padding-top: 0.5rem;
            border-top: 1px solid var(--border-subtle);
          }
          
          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--text-secondary);
            text-align: center;
          }
          
          .empty-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
            opacity: 0.5;
          }
          
          .summary-section {
            grid-column: 1 / -1;
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
          }
          
          .summary-stat {
            text-align: center;
            padding: 1rem;
            background: var(--surface-secondary);
            border-radius: 0.375rem;
          }
          
          .summary-stat-value {
            font-size: 2rem;
            font-weight: 600;
            color: var(--color-primary);
          }
          
          .summary-stat-label {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }
          
          .missing-capabilities {
            margin-top: 1.5rem;
            padding: 1rem;
            background: var(--color-warning-light);
            border-radius: 0.375rem;
            border: 1px solid var(--color-warning);
          }
          
          .missing-title {
            font-weight: 600;
            color: var(--color-warning-dark);
            margin-bottom: 0.5rem;
          }
          
          .missing-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          
          .missing-item {
            padding: 0.25rem 0;
            color: var(--text-secondary);
            font-size: 0.875rem;
          }
        </style>
        
        <div class="discovery-header">
          <h2 class="discovery-title">Tool Discovery & Feasibility</h2>
          <p class="discovery-subtitle">Analyze which tools can execute each task with confidence scores</p>
        </div>
        
        <div class="discovery-content">
          <div class="tasks-section">
            <h3 class="section-title">Tasks</h3>
            <div class="task-list">
              <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>No tasks analyzed yet</p>
                <p style="font-size: 0.875rem;">Analyze a task in the breakdown tab first</p>
              </div>
            </div>
          </div>
          
          <div class="tools-section">
            <h3 class="section-title">Discovered Tools</h3>
            <div class="tools-list">
              <div class="empty-state">
                <div class="empty-icon">🔧</div>
                <p>Select a task to see available tools</p>
              </div>
            </div>
          </div>
          
          <div class="summary-section">
            <h3 class="section-title">Feasibility Summary</h3>
            <div class="summary-stats">
              <div class="summary-stat">
                <div class="summary-stat-value">0</div>
                <div class="summary-stat-label">Total Tasks</div>
              </div>
              <div class="summary-stat">
                <div class="summary-stat-value">0</div>
                <div class="summary-stat-label">Feasible</div>
              </div>
              <div class="summary-stat">
                <div class="summary-stat-value">0</div>
                <div class="summary-stat-label">Tools Found</div>
              </div>
              <div class="summary-stat">
                <div class="summary-stat-value">0%</div>
                <div class="summary-stat-label">Coverage</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderTasks(tasks, selectedTaskId) {
    const taskList = this.container.querySelector('.task-list');
    
    if (!tasks || tasks.length === 0) {
      taskList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No tasks analyzed yet</p>
        </div>
      `;
      return;
    }
    
    taskList.innerHTML = tasks.map(task => {
      const feasibility = this.getFeasibilityClass(task.feasibility);
      const isSelected = task.id === selectedTaskId;
      
      return `
        <div class="task-item ${isSelected ? 'selected' : ''}" data-task-id="${task.id}">
          <div class="task-item-header">
            <span class="task-item-name">${task.name || task.description}</span>
            <span class="feasibility-badge feasibility-${feasibility}">
              ${feasibility}
            </span>
          </div>
          <div class="task-item-stats">
            <span class="stat-item">
              <span>🔧</span>
              <span>${task.toolCount || 0} tools</span>
            </span>
            <span class="stat-item">
              <span>📊</span>
              <span>${Math.round((task.confidence || 0) * 100)}%</span>
            </span>
          </div>
        </div>
      `;
    }).join('');
    
    // Bind click events
    taskList.querySelectorAll('.task-item').forEach(item => {
      item.addEventListener('click', () => {
        const taskId = item.dataset.taskId;
        if (this.onTaskSelect) {
          this.onTaskSelect(taskId);
        }
      });
    });
  }

  renderTools(tools) {
    const toolsList = this.container.querySelector('.tools-list');
    
    if (!tools || tools.length === 0) {
      toolsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔧</div>
          <p>No tools discovered for this task</p>
        </div>
      `;
      return;
    }
    
    toolsList.innerHTML = tools.map(tool => `
      <div class="tool-card">
        <div class="tool-card-header">
          <div class="tool-name">
            <span class="tool-icon">🔧</span>
            <span>${tool.name}</span>
          </div>
          <div class="confidence-score">
            <div class="confidence-bar">
              <div class="confidence-fill" style="width: ${tool.confidence * 100}%"></div>
            </div>
            <span class="confidence-value">${Math.round(tool.confidence * 100)}%</span>
          </div>
        </div>
        ${tool.description ? `
          <div class="tool-description">${tool.description}</div>
        ` : ''}
        ${tool.reasoning ? `
          <div class="tool-reasoning">${tool.reasoning}</div>
        ` : ''}
      </div>
    `).join('');
  }

  updateSummary(summary) {
    const statsContainer = this.container.querySelector('.summary-stats');
    
    statsContainer.innerHTML = `
      <div class="summary-stat">
        <div class="summary-stat-value">${summary.totalTasks || 0}</div>
        <div class="summary-stat-label">Total Tasks</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-value">${summary.feasibleTasks || 0}</div>
        <div class="summary-stat-label">Feasible</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-value">${summary.totalTools || 0}</div>
        <div class="summary-stat-label">Tools Found</div>
      </div>
      <div class="summary-stat">
        <div class="summary-stat-value">${summary.coverage || 0}%</div>
        <div class="summary-stat-label">Coverage</div>
      </div>
    `;
    
    // Add missing capabilities if any
    if (summary.missingCapabilities && summary.missingCapabilities.length > 0) {
      const summarySection = this.container.querySelector('.summary-section');
      const existingMissing = summarySection.querySelector('.missing-capabilities');
      
      if (existingMissing) {
        existingMissing.remove();
      }
      
      const missingHtml = `
        <div class="missing-capabilities">
          <div class="missing-title">⚠️ Missing Capabilities</div>
          <ul class="missing-list">
            ${summary.missingCapabilities.map(cap => `
              <li class="missing-item">• ${cap}</li>
            `).join('')}
          </ul>
        </div>
      `;
      
      summarySection.insertAdjacentHTML('beforeend', missingHtml);
    }
  }

  getFeasibilityClass(score) {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class ToolDiscoveryPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Bind view callbacks
    this.view.onTaskSelect = this.selectTask.bind(this);
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeMethods();
  }

  exposeMethods() {
    const api = {
      analyzeFeasibility: this.analyzeFeasibility.bind(this),
      setTaskTree: this.setTaskTree.bind(this),
      selectTask: this.selectTask.bind(this),
      getResults: () => this.model.getState('feasibilityResults'),
      getDiscoveredTools: () => this.model.getState('discoveredTools'),
      reset: () => this.model.reset()
    };
    
    this.api = api;
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
  }

  onModelChange(changes) {
    if ('taskTree' in changes) {
      this.updateTaskList();
    }
    
    if ('selectedTask' in changes) {
      this.updateToolsList(changes.selectedTask);
    }
    
    if ('feasibilityResults' in changes) {
      this.updateSummary();
    }
  }

  setTaskTree(tree) {
    this.model.updateState('taskTree', tree);
    
    // Automatically analyze feasibility if umbilical supports it
    if (this.umbilical.onAnalyzeFeasibility) {
      this.analyzeFeasibility(tree);
    } else {
      // Create mock feasibility data for testing
      this.createMockFeasibility(tree);
    }
  }

  async analyzeFeasibility(taskTree) {
    if (!taskTree) return;
    
    this.model.updateState('isAnalyzing', true);
    
    try {
      if (this.umbilical.onAnalyzeFeasibility) {
        const results = await this.umbilical.onAnalyzeFeasibility(taskTree);
        this.processFeasibilityResults(results);
      } else {
        this.createMockFeasibility(taskTree);
      }
    } catch (error) {
      console.error('Feasibility analysis failed:', error);
      this.model.updateState('error', error);
    } finally {
      this.model.updateState('isAnalyzing', false);
    }
  }

  createMockFeasibility(tree) {
    // Create mock feasibility data for UI testing
    const tasks = this.flattenTasks(tree);
    const discoveredTools = new Map();
    
    tasks.forEach(task => {
      const mockTools = [
        {
          name: 'file_write',
          description: 'Write content to a file',
          confidence: 0.85,
          reasoning: 'This tool can handle file creation operations'
        },
        {
          name: 'generate_javascript_function',
          description: 'Generate JavaScript functions',
          confidence: 0.72,
          reasoning: 'Can generate code for this task'
        },
        {
          name: 'directory_create',
          description: 'Create directories',
          confidence: 0.65,
          reasoning: 'May be needed for project structure'
        }
      ];
      
      discoveredTools.set(task.id, mockTools.slice(0, Math.floor(Math.random() * 3) + 1));
    });
    
    const feasibilityResults = {
      feasibleTasks: tasks.filter(t => Math.random() > 0.3),
      infeasibleTasks: tasks.filter(t => Math.random() > 0.7),
      totalConfidence: 0.75
    };
    
    this.model.updateState('discoveredTools', discoveredTools);
    this.model.updateState('feasibilityResults', feasibilityResults);
    this.updateTaskList();
    this.updateSummary();
  }

  processFeasibilityResults(results) {
    const discoveredTools = new Map();
    
    if (results.taskAnalysis) {
      results.taskAnalysis.forEach(analysis => {
        discoveredTools.set(analysis.taskId, analysis.tools || []);
      });
    }
    
    this.model.updateState('discoveredTools', discoveredTools);
    this.model.updateState('feasibilityResults', results);
    this.model.updateState('missingCapabilities', results.missingCapabilities || []);
    
    this.updateTaskList();
    this.updateSummary();
  }

  flattenTasks(tree, tasks = []) {
    if (!tree) return tasks;
    
    const processNode = (node, depth = 0) => {
      if (!node) return;
      
      const discoveredTools = this.model.getState('discoveredTools');
      const toolsForTask = discoveredTools.get(node.id) || [];
      
      tasks.push({
        id: node.id,
        name: node.task || node.description,
        description: node.description,
        complexity: node.complexity,
        depth: depth,
        toolCount: toolsForTask.length,
        confidence: toolsForTask.length > 0 ? 
          Math.max(...toolsForTask.map(t => t.confidence || 0)) : 0,
        feasibility: toolsForTask.length > 0 ? 
          (toolsForTask[0].confidence || 0) : 0
      });
      
      if (node.subtasks) {
        node.subtasks.forEach(child => processNode(child, depth + 1));
      }
    };
    
    if (tree.root) {
      processNode(tree.root);
    } else {
      processNode(tree);
    }
    
    return tasks;
  }

  updateTaskList() {
    const tree = this.model.getState('taskTree');
    const selectedTask = this.model.getState('selectedTask');
    
    if (tree) {
      const tasks = this.flattenTasks(tree);
      this.view.renderTasks(tasks, selectedTask);
    }
  }

  selectTask(taskId) {
    this.model.updateState('selectedTask', taskId);
    
    if (this.umbilical.onTaskSelect) {
      this.umbilical.onTaskSelect(taskId);
    }
  }

  updateToolsList(taskId) {
    const discoveredTools = this.model.getState('discoveredTools');
    const tools = discoveredTools.get(taskId) || [];
    this.view.renderTools(tools);
  }

  updateSummary() {
    const tree = this.model.getState('taskTree');
    const feasibilityResults = this.model.getState('feasibilityResults');
    const discoveredTools = this.model.getState('discoveredTools');
    const missingCapabilities = this.model.getState('missingCapabilities');
    
    const tasks = tree ? this.flattenTasks(tree) : [];
    const feasibleCount = tasks.filter(t => t.toolCount > 0).length;
    const totalToolCount = Array.from(discoveredTools.values())
      .reduce((sum, tools) => sum + tools.length, 0);
    
    const summary = {
      totalTasks: tasks.length,
      feasibleTasks: feasibleCount,
      totalTools: totalToolCount,
      coverage: tasks.length > 0 ? Math.round((feasibleCount / tasks.length) * 100) : 0,
      missingCapabilities: missingCapabilities
    };
    
    this.view.updateSummary(summary);
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * ToolDiscoveryPanel - Main component export
 */
export class ToolDiscoveryPanel {
  static create(umbilical) {
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ToolDiscoveryPanel');
    
    const model = new ToolDiscoveryPanelModel();
    const view = new ToolDiscoveryPanelView(umbilical.dom);
    const viewModel = new ToolDiscoveryPanelViewModel(model, view, umbilical);
    
    return viewModel;
  }
}