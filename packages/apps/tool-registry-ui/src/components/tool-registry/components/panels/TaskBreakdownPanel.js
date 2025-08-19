/**
 * TaskBreakdownPanel Component
 * Interactive panel for visualizing task decomposition from the decent planner
 * Shows task breakdown into simple blocks with input/output hints
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages task breakdown state
 */
class TaskBreakdownPanelModel {
  constructor() {
    this.state = {
      taskInput: '',
      isAnalyzing: false,
      currentAnalysis: null,
      decompositionTree: null,
      complexityAnalysis: null,
      toolMapping: null,
      error: null,
      expandedNodes: new Set(),
      selectedNode: null
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
      taskInput: '',
      isAnalyzing: false,
      currentAnalysis: null,
      decompositionTree: null,
      complexityAnalysis: null,
      toolMapping: null,
      error: null,
      expandedNodes: new Set(),
      selectedNode: null
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders UI and handles DOM updates
 */
class TaskBreakdownPanelView {
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="task-breakdown-panel">
        <style>
          .task-breakdown-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 1.5rem;
            gap: 1.5rem;
            overflow-y: auto;
          }
          
          .breakdown-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-subtle);
          }
          
          .breakdown-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
          }
          
          .breakdown-subtitle {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }
          
          .task-input-section {
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .task-input-label {
            display: block;
            font-weight: 500;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
          }
          
          .task-input-wrapper {
            display: flex;
            gap: 0.75rem;
          }
          
          .task-input {
            flex: 1;
            padding: 0.75rem;
            border: 1px solid var(--border-subtle);
            border-radius: 0.375rem;
            font-size: 0.95rem;
            background: var(--surface-secondary);
            color: var(--text-primary);
            transition: border-color 0.2s;
          }
          
          .task-input:focus {
            outline: none;
            border-color: var(--color-primary);
          }
          
          .analyze-button {
            padding: 0.75rem 1.5rem;
            background: var(--color-primary);
            color: white;
            border: none;
            border-radius: 0.375rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }
          
          .analyze-button:hover:not(:disabled) {
            background: var(--color-primary-dark);
          }
          
          .analyze-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          
          .analyzing-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--color-primary);
            font-size: 0.875rem;
          }
          
          .spinner {
            width: 1rem;
            height: 1rem;
            border: 2px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          
          .breakdown-visualization {
            flex: 1;
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
            min-height: 400px;
          }
          
          .breakdown-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            text-align: center;
          }
          
          .breakdown-empty-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
          }
          
          .breakdown-tree {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }
          
          .task-node {
            background: var(--surface-secondary);
            border-radius: 0.5rem;
            padding: 1rem;
            border: 2px solid var(--border-subtle);
            transition: all 0.2s;
            cursor: pointer;
          }
          
          .task-node:hover {
            border-color: var(--color-primary);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          .task-node.selected {
            border-color: var(--color-primary);
            background: var(--surface-primary);
          }
          
          .task-node-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          
          .task-node-title {
            font-weight: 500;
            color: var(--text-primary);
          }
          
          .task-node-complexity {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          
          .complexity-simple {
            background: var(--color-success-light);
            color: var(--color-success-dark);
          }
          
          .complexity-moderate {
            background: var(--color-warning-light);
            color: var(--color-warning-dark);
          }
          
          .complexity-complex {
            background: var(--color-error-light);
            color: var(--color-error-dark);
          }
          
          .task-node-description {
            color: var(--text-secondary);
            font-size: 0.875rem;
            margin-bottom: 0.75rem;
          }
          
          .task-node-hints {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
          }
          
          .hint-section {
            flex: 1;
            min-width: 200px;
          }
          
          .hint-label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--text-tertiary);
            margin-bottom: 0.25rem;
          }
          
          .hint-content {
            font-size: 0.875rem;
            color: var(--text-secondary);
            padding: 0.5rem;
            background: var(--surface-primary);
            border-radius: 0.25rem;
            border: 1px solid var(--border-subtle);
          }
          
          .hint-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          
          .hint-item {
            padding: 0.25rem 0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .hint-icon {
            font-size: 0.75rem;
            opacity: 0.7;
          }
          
          .task-children {
            margin-left: 2rem;
            margin-top: 1rem;
            padding-left: 1rem;
            border-left: 2px solid var(--border-subtle);
          }
          
          .expand-toggle {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.25rem;
            font-size: 1rem;
            transition: transform 0.2s;
          }
          
          .expand-toggle.expanded {
            transform: rotate(90deg);
          }
          
          .error-message {
            background: var(--color-error-light);
            color: var(--color-error-dark);
            padding: 1rem;
            border-radius: 0.5rem;
            margin-top: 1rem;
          }
        </style>
        
        <div class="breakdown-header">
          <div>
            <h2 class="breakdown-title">Task Hierarchy Breakdown</h2>
            <p class="breakdown-subtitle">View the top-down informal planning decomposition with input/output hints</p>
          </div>
        </div>
        
        <div class="task-input-section">
          <label class="task-input-label">Task Description</label>
          <div class="task-input-wrapper">
            <input 
              type="text" 
              class="task-input" 
              placeholder="e.g., Create a REST API with user authentication"
            />
            <button class="analyze-button">Analyze Task</button>
          </div>
          <div class="analyzing-indicator" style="display: none;">
            <div class="spinner"></div>
            <span>Analyzing task breakdown...</span>
          </div>
        </div>
        
        <div class="breakdown-visualization">
          <div class="breakdown-empty">
            <div class="breakdown-empty-icon">🌳</div>
            <p>Enter a task above to see its hierarchical breakdown</p>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">
              The informal planner will decompose your task into a tree of simpler subtasks with input/output hints
            </p>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    const input = this.container.querySelector('.task-input');
    const button = this.container.querySelector('.analyze-button');
    
    // Handle analyze button click
    button.addEventListener('click', () => {
      const task = input.value.trim();
      if (task && this.onAnalyze) {
        this.onAnalyze(task);
      }
    });
    
    // Handle enter key in input
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const task = input.value.trim();
        if (task && this.onAnalyze) {
          this.onAnalyze(task);
        }
      }
    });
  }

  showAnalyzing(isAnalyzing) {
    const button = this.container.querySelector('.analyze-button');
    const indicator = this.container.querySelector('.analyzing-indicator');
    const input = this.container.querySelector('.task-input');
    
    if (isAnalyzing) {
      button.disabled = true;
      input.disabled = true;
      indicator.style.display = 'flex';
    } else {
      button.disabled = false;
      input.disabled = false;
      indicator.style.display = 'none';
    }
  }

  renderBreakdown(decomposition) {
    const visualization = this.container.querySelector('.breakdown-visualization');
    
    if (!decomposition || !decomposition.root) {
      visualization.innerHTML = `
        <div class="breakdown-empty">
          <div class="breakdown-empty-icon">❌</div>
          <p>No breakdown available</p>
        </div>
      `;
      return;
    }
    
    visualization.innerHTML = `
      <div class="breakdown-tree">
        ${this.renderTaskNode(decomposition.root, 0)}
      </div>
    `;
    
    // Bind node click events
    this.bindNodeEvents();
  }

  renderTaskNode(node, level = 0) {
    if (!node) return '';
    
    const hasChildren = node.subtasks && node.subtasks.length > 0;
    const complexityClass = `complexity-${(node.complexity || 'simple').toLowerCase()}`;
    
    return `
      <div class="task-node" data-node-id="${node.id}" data-level="${level}">
        <div class="task-node-header">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            ${hasChildren ? `<button class="expand-toggle expanded">▶</button>` : ''}
            <span class="task-node-title">${node.description || node.task}</span>
          </div>
          <span class="task-node-complexity ${complexityClass}">
            ${node.complexity || 'simple'}
          </span>
        </div>
        
        ${node.reasoning ? `
          <div class="task-node-description">${node.reasoning}</div>
        ` : ''}
        
        <div class="task-node-hints">
          ${node.inputs && node.inputs.length > 0 ? `
            <div class="hint-section">
              <div class="hint-label">Expected Inputs</div>
              <div class="hint-content">
                <ul class="hint-list">
                  ${node.inputs.map(input => `
                    <li class="hint-item">
                      <span class="hint-icon">→</span>
                      <span>${input}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          ` : ''}
          
          ${node.outputs && node.outputs.length > 0 ? `
            <div class="hint-section">
              <div class="hint-label">Expected Outputs</div>
              <div class="hint-content">
                <ul class="hint-list">
                  ${node.outputs.map(output => `
                    <li class="hint-item">
                      <span class="hint-icon">←</span>
                      <span>${output}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </div>
          ` : ''}
        </div>
        
        ${hasChildren ? `
          <div class="task-children">
            ${node.subtasks.map(child => this.renderTaskNode(child, level + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  bindNodeEvents() {
    const nodes = this.container.querySelectorAll('.task-node');
    const toggles = this.container.querySelectorAll('.expand-toggle');
    
    // Handle node selection
    nodes.forEach(node => {
      node.addEventListener('click', (e) => {
        // Don't select if clicking on toggle
        if (e.target.classList.contains('expand-toggle')) return;
        
        // Clear previous selection
        nodes.forEach(n => n.classList.remove('selected'));
        // Select this node
        node.classList.add('selected');
        
        if (this.onNodeSelect) {
          this.onNodeSelect(node.dataset.nodeId);
        }
      });
    });
    
    // Handle expand/collapse
    toggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const node = toggle.closest('.task-node');
        const children = node.querySelector('.task-children');
        
        if (children) {
          toggle.classList.toggle('expanded');
          children.style.display = toggle.classList.contains('expanded') ? 'block' : 'none';
        }
      });
    });
  }

  showError(error) {
    const visualization = this.container.querySelector('.breakdown-visualization');
    visualization.innerHTML = `
      <div class="error-message">
        <strong>Error:</strong> ${error.message || error}
      </div>
    `;
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class TaskBreakdownPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Bind view callbacks
    this.view.onAnalyze = this.analyzeTask.bind(this);
    this.view.onNodeSelect = this.selectNode.bind(this);
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeMethods();
  }

  exposeMethods() {
    const api = {
      analyzeTask: this.analyzeTask.bind(this),
      getAnalysis: () => this.model.getState('currentAnalysis'),
      getDecomposition: () => this.model.getState('decompositionTree'),
      reset: () => this.model.reset(),
      setTask: (task) => {
        this.model.updateState('taskInput', task);
        const input = this.view.container.querySelector('.task-input');
        if (input) input.value = task;
      }
    };
    
    this.api = api;
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
  }

  onModelChange(changes) {
    if ('isAnalyzing' in changes) {
      this.view.showAnalyzing(changes.isAnalyzing);
    }
    
    if ('decompositionTree' in changes && changes.decompositionTree) {
      this.view.renderBreakdown(changes.decompositionTree);
    }
    
    if ('error' in changes && changes.error) {
      this.view.showError(changes.error);
    }
  }

  async analyzeTask(taskDescription) {
    if (!taskDescription) return;
    
    this.model.updateState('taskInput', taskDescription);
    this.model.updateState('isAnalyzing', true);
    this.model.updateState('error', null);
    
    try {
      // Call the decent planner through the umbilical
      if (this.umbilical.onAnalyzeTask) {
        const result = await this.umbilical.onAnalyzeTask(taskDescription);
        
        if (result && result.decomposition) {
          this.model.updateState('currentAnalysis', result);
          this.model.updateState('decompositionTree', result.decomposition);
          this.model.updateState('complexityAnalysis', result.complexity);
          this.model.updateState('toolMapping', result.tools);
        } else {
          throw new Error('Invalid analysis result');
        }
      } else {
        // Fallback: Create mock decomposition for testing
        const mockDecomposition = this.createMockDecomposition(taskDescription);
        this.model.updateState('decompositionTree', mockDecomposition);
      }
    } catch (error) {
      console.error('Task analysis failed:', error);
      this.model.updateState('error', error);
    } finally {
      this.model.updateState('isAnalyzing', false);
    }
  }

  createMockDecomposition(task) {
    // Create a mock decomposition for testing UI (no tool references)
    return {
      root: {
        id: 'root',
        task: task,
        description: task,
        complexity: 'complex',
        reasoning: 'This is a complex task that needs to be broken down into simpler steps',
        inputs: ['User requirements', 'System specifications'],
        outputs: ['Completed implementation', 'Documentation'],
        subtasks: [
          {
            id: 'subtask-1',
            task: 'Set up project structure',
            description: 'Initialize project with required dependencies',
            complexity: 'simple',
            inputs: ['Project requirements'],
            outputs: ['Project skeleton', 'Configuration files']
          },
          {
            id: 'subtask-2',
            task: 'Implement core functionality',
            description: 'Build the main features',
            complexity: 'moderate',
            inputs: ['Requirements', 'Design patterns'],
            outputs: ['Core modules', 'Unit tests'],
            subtasks: [
              {
                id: 'subtask-2-1',
                task: 'Create data models',
                description: 'Define data structures',
                complexity: 'simple',
                inputs: ['Schema definitions'],
                outputs: ['Model classes']
              },
              {
                id: 'subtask-2-2',
                task: 'Implement business logic',
                description: 'Write core business rules',
                complexity: 'simple',
                inputs: ['Business requirements'],
                outputs: ['Service modules']
              }
            ]
          },
          {
            id: 'subtask-3',
            task: 'Add tests and documentation',
            description: 'Ensure quality and maintainability',
            complexity: 'simple',
            inputs: ['Code modules'],
            outputs: ['Test suites', 'Documentation']
          }
        ]
      }
    };
  }

  selectNode(nodeId) {
    this.model.updateState('selectedNode', nodeId);
    
    if (this.umbilical.onNodeSelect) {
      const decomposition = this.model.getState('decompositionTree');
      const node = this.findNode(decomposition.root, nodeId);
      if (node) {
        this.umbilical.onNodeSelect(node);
      }
    }
  }

  findNode(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    
    if (node.subtasks) {
      for (const child of node.subtasks) {
        const found = this.findNode(child, id);
        if (found) return found;
      }
    }
    
    return null;
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * TaskBreakdownPanel - Main component export
 */
export class TaskBreakdownPanel {
  static create(umbilical) {
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'TaskBreakdownPanel');
    
    const model = new TaskBreakdownPanelModel();
    const view = new TaskBreakdownPanelView(umbilical.dom);
    const viewModel = new TaskBreakdownPanelViewModel(model, view, umbilical);
    
    return viewModel;
  }
}