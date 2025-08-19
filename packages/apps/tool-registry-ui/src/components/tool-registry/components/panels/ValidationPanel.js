/**
 * ValidationPanel Component
 * Shows decomposition validation results from the decent planner
 * Displays dependency analysis, completeness checks, and validation issues
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages validation state
 */
class ValidationPanelModel {
  constructor() {
    this.state = {
      validationResults: null,
      decompositionTree: null,
      selectedIssue: null,
      filterType: 'all', // all, errors, warnings, info
      isValidating: false,
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
      validationResults: null,
      decompositionTree: null,
      selectedIssue: null,
      filterType: 'all',
      isValidating: false,
      error: null
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders UI and handles DOM updates
 */
class ValidationPanelView {
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="validation-panel">
        <style>
          .validation-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
            padding: 1.5rem;
            gap: 1.5rem;
            overflow-y: auto;
          }
          
          .validation-header {
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--border-subtle);
          }
          
          .validation-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--text-primary);
          }
          
          .validation-subtitle {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
          }
          
          .validation-summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            padding: 1.5rem;
            background: var(--surface-primary);
            border-radius: 0.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .summary-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 1rem;
            background: var(--surface-secondary);
            border-radius: 0.375rem;
            border: 1px solid var(--border-subtle);
          }
          
          .summary-icon {
            font-size: 2rem;
            margin-bottom: 0.5rem;
          }
          
          .summary-label {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-bottom: 0.25rem;
          }
          
          .summary-value {
            font-size: 1.5rem;
            font-weight: 600;
            color: var(--text-primary);
          }
          
          .status-valid {
            color: var(--color-success);
          }
          
          .status-invalid {
            color: var(--color-error);
          }
          
          .status-warning {
            color: var(--color-warning);
          }
          
          .validation-filter {
            display: flex;
            gap: 0.5rem;
            padding: 0.75rem;
            background: var(--surface-primary);
            border-radius: 0.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .filter-button {
            padding: 0.5rem 1rem;
            background: var(--surface-secondary);
            border: 1px solid var(--border-subtle);
            border-radius: 0.25rem;
            cursor: pointer;
            font-size: 0.875rem;
            color: var(--text-secondary);
            transition: all 0.2s;
          }
          
          .filter-button:hover {
            background: var(--surface-primary);
            border-color: var(--color-primary);
          }
          
          .filter-button.active {
            background: var(--color-primary);
            color: white;
            border-color: var(--color-primary);
          }
          
          .validation-issues {
            flex: 1;
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .issues-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          }
          
          .issues-title {
            font-weight: 600;
            color: var(--text-primary);
          }
          
          .issues-count {
            padding: 0.25rem 0.75rem;
            background: var(--surface-secondary);
            border-radius: 9999px;
            font-size: 0.875rem;
            color: var(--text-secondary);
          }
          
          .issues-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            max-height: 400px;
            overflow-y: auto;
          }
          
          .issue-item {
            background: var(--surface-secondary);
            border-radius: 0.375rem;
            padding: 1rem;
            border-left: 4px solid;
            cursor: pointer;
            transition: all 0.2s;
          }
          
          .issue-item:hover {
            transform: translateX(2px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          .issue-item.selected {
            background: var(--surface-primary);
            border-color: var(--color-primary);
          }
          
          .issue-error {
            border-color: var(--color-error);
          }
          
          .issue-warning {
            border-color: var(--color-warning);
          }
          
          .issue-info {
            border-color: var(--color-info);
          }
          
          .issue-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          
          .issue-type {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 500;
          }
          
          .issue-icon {
            font-size: 1rem;
          }
          
          .issue-location {
            font-size: 0.875rem;
            color: var(--text-secondary);
          }
          
          .issue-message {
            font-size: 0.875rem;
            color: var(--text-primary);
            margin-bottom: 0.5rem;
          }
          
          .issue-details {
            font-size: 0.825rem;
            color: var(--text-secondary);
            font-style: italic;
          }
          
          .issue-fix {
            margin-top: 0.5rem;
            padding: 0.5rem;
            background: var(--surface-primary);
            border-radius: 0.25rem;
            border: 1px solid var(--border-subtle);
            font-size: 0.825rem;
            color: var(--text-secondary);
          }
          
          .dependency-graph {
            background: var(--surface-primary);
            border-radius: 0.5rem;
            padding: 1.5rem;
            border: 1px solid var(--border-subtle);
          }
          
          .graph-title {
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 1rem;
          }
          
          .dependency-items {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }
          
          .dependency-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.75rem;
            background: var(--surface-secondary);
            border-radius: 0.375rem;
          }
          
          .dependency-from {
            flex: 1;
            text-align: right;
            font-weight: 500;
            color: var(--text-primary);
          }
          
          .dependency-arrow {
            color: var(--text-tertiary);
            font-size: 1.25rem;
          }
          
          .dependency-to {
            flex: 1;
            font-weight: 500;
            color: var(--text-primary);
          }
          
          .dependency-type {
            padding: 0.25rem 0.5rem;
            background: var(--surface-primary);
            border-radius: 0.25rem;
            font-size: 0.75rem;
            color: var(--text-secondary);
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
          
          .validating-spinner {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding: 2rem;
            color: var(--color-primary);
          }
          
          .spinner {
            width: 2rem;
            height: 2rem;
            border: 3px solid currentColor;
            border-top-color: transparent;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
        
        <div class="validation-header">
          <h2 class="validation-title">Decomposition Validation</h2>
          <p class="validation-subtitle">Analyze structure, dependencies, and completeness of task breakdown</p>
        </div>
        
        <div class="validation-summary">
          <div class="summary-card">
            <div class="summary-icon status-valid">✓</div>
            <div class="summary-label">Overall Status</div>
            <div class="summary-value">Valid</div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">🔗</div>
            <div class="summary-label">Dependencies</div>
            <div class="summary-value">0</div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">⚠️</div>
            <div class="summary-label">Warnings</div>
            <div class="summary-value">0</div>
          </div>
          <div class="summary-card">
            <div class="summary-icon">❌</div>
            <div class="summary-label">Errors</div>
            <div class="summary-value">0</div>
          </div>
        </div>
        
        <div class="validation-filter">
          <button class="filter-button active" data-filter="all">All Issues</button>
          <button class="filter-button" data-filter="errors">Errors</button>
          <button class="filter-button" data-filter="warnings">Warnings</button>
          <button class="filter-button" data-filter="info">Info</button>
        </div>
        
        <div class="validation-issues">
          <div class="issues-header">
            <h3 class="issues-title">Validation Issues</h3>
            <span class="issues-count">0 issues</span>
          </div>
          <div class="issues-list">
            <div class="empty-state">
              <div class="empty-icon">✅</div>
              <p>No validation issues found</p>
              <p style="font-size: 0.875rem;">The decomposition is valid and complete</p>
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Filter button clicks
    const filterButtons = this.container.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Update active state
        filterButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        
        if (this.onFilterChange) {
          this.onFilterChange(button.dataset.filter);
        }
      });
    });
  }

  showValidating(isValidating) {
    const issuesContainer = this.container.querySelector('.validation-issues');
    
    if (isValidating) {
      issuesContainer.innerHTML = `
        <div class="validating-spinner">
          <div class="spinner"></div>
          <span>Validating decomposition...</span>
        </div>
      `;
    } else {
      // Restore issues display
      this.renderIssues([]);
    }
  }

  renderSummary(validation) {
    const summaryContainer = this.container.querySelector('.validation-summary');
    
    const overallValid = validation.valid;
    const dependencyCount = validation.dependencies?.count || 0;
    const warningCount = validation.warnings?.length || 0;
    const errorCount = validation.errors?.length || 0;
    
    summaryContainer.innerHTML = `
      <div class="summary-card">
        <div class="summary-icon ${overallValid ? 'status-valid' : 'status-invalid'}">
          ${overallValid ? '✓' : '✗'}
        </div>
        <div class="summary-label">Overall Status</div>
        <div class="summary-value">${overallValid ? 'Valid' : 'Invalid'}</div>
      </div>
      <div class="summary-card">
        <div class="summary-icon">🔗</div>
        <div class="summary-label">Dependencies</div>
        <div class="summary-value">${dependencyCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-icon ${warningCount > 0 ? 'status-warning' : ''}">⚠️</div>
        <div class="summary-label">Warnings</div>
        <div class="summary-value">${warningCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-icon ${errorCount > 0 ? 'status-invalid' : ''}">❌</div>
        <div class="summary-label">Errors</div>
        <div class="summary-value">${errorCount}</div>
      </div>
    `;
  }

  renderIssues(issues, filterType = 'all') {
    const issuesContainer = this.container.querySelector('.validation-issues');
    
    // Filter issues
    const filteredIssues = filterType === 'all' ? issues :
      issues.filter(issue => issue.type === filterType);
    
    // Update count
    const countElement = issuesContainer.querySelector('.issues-count') || 
      document.createElement('span');
    countElement.className = 'issues-count';
    countElement.textContent = `${filteredIssues.length} issue${filteredIssues.length !== 1 ? 's' : ''}`;
    
    const listContainer = issuesContainer.querySelector('.issues-list') ||
      document.createElement('div');
    listContainer.className = 'issues-list';
    
    if (filteredIssues.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✅</div>
          <p>No ${filterType === 'all' ? '' : filterType} issues found</p>
        </div>
      `;
    } else {
      listContainer.innerHTML = filteredIssues.map(issue => this.renderIssue(issue)).join('');
    }
    
    // Re-render the container
    issuesContainer.innerHTML = `
      <div class="issues-header">
        <h3 class="issues-title">Validation Issues</h3>
        ${countElement.outerHTML}
      </div>
      ${listContainer.outerHTML}
    `;
    
    // Bind issue click events
    issuesContainer.querySelectorAll('.issue-item').forEach(item => {
      item.addEventListener('click', () => {
        const issueId = item.dataset.issueId;
        if (this.onIssueSelect) {
          this.onIssueSelect(issueId);
        }
      });
    });
  }

  renderIssue(issue) {
    const typeIcons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    return `
      <div class="issue-item issue-${issue.type}" data-issue-id="${issue.id}">
        <div class="issue-header">
          <div class="issue-type">
            <span class="issue-icon">${typeIcons[issue.type] || '•'}</span>
            <span>${issue.category || issue.type}</span>
          </div>
          ${issue.location ? `
            <span class="issue-location">${issue.location}</span>
          ` : ''}
        </div>
        <div class="issue-message">${issue.message}</div>
        ${issue.details ? `
          <div class="issue-details">${issue.details}</div>
        ` : ''}
        ${issue.fix ? `
          <div class="issue-fix">
            <strong>Suggested fix:</strong> ${issue.fix}
          </div>
        ` : ''}
      </div>
    `;
  }

  renderDependencies(dependencies) {
    const container = document.createElement('div');
    container.className = 'dependency-graph';
    container.innerHTML = `
      <h3 class="graph-title">Task Dependencies</h3>
      <div class="dependency-items">
        ${dependencies.map(dep => `
          <div class="dependency-item">
            <span class="dependency-from">${dep.from}</span>
            <span class="dependency-arrow">→</span>
            <span class="dependency-to">${dep.to}</span>
            <span class="dependency-type">${dep.type || 'data'}</span>
          </div>
        `).join('')}
      </div>
    `;
    
    // Insert after validation issues
    const issuesSection = this.container.querySelector('.validation-issues');
    if (issuesSection && dependencies.length > 0) {
      issuesSection.parentNode.insertBefore(container, issuesSection.nextSibling);
    }
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class ValidationPanelViewModel {
  constructor(model, view, umbilical) {
    this.model = model;
    this.view = view;
    this.umbilical = umbilical;
    
    // Bind view callbacks
    this.view.onFilterChange = this.changeFilter.bind(this);
    this.view.onIssueSelect = this.selectIssue.bind(this);
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Expose API
    this.exposeMethods();
  }

  exposeMethods() {
    const api = {
      validateDecomposition: this.validateDecomposition.bind(this),
      setDecomposition: this.setDecomposition.bind(this),
      getValidationResults: () => this.model.getState('validationResults'),
      reset: () => this.model.reset()
    };
    
    this.api = api;
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
  }

  onModelChange(changes) {
    if ('isValidating' in changes) {
      this.view.showValidating(changes.isValidating);
    }
    
    if ('validationResults' in changes && changes.validationResults) {
      this.updateValidationDisplay();
    }
    
    if ('filterType' in changes) {
      this.updateIssuesDisplay();
    }
  }

  setDecomposition(decomposition) {
    this.model.updateState('decompositionTree', decomposition);
    
    // Automatically validate if umbilical supports it
    if (this.umbilical.onValidate) {
      this.validateDecomposition(decomposition);
    } else {
      // Create mock validation for testing
      this.createMockValidation(decomposition);
    }
  }

  async validateDecomposition(decomposition) {
    if (!decomposition) return;
    
    this.model.updateState('isValidating', true);
    
    try {
      if (this.umbilical.onValidate) {
        const results = await this.umbilical.onValidate(decomposition);
        this.model.updateState('validationResults', results);
      } else {
        this.createMockValidation(decomposition);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      this.model.updateState('error', error);
    } finally {
      this.model.updateState('isValidating', false);
    }
  }

  createMockValidation(decomposition) {
    // Create mock validation results for UI testing
    const mockResults = {
      valid: Math.random() > 0.3,
      structure: {
        valid: true,
        errors: []
      },
      dependencies: {
        valid: true,
        count: Math.floor(Math.random() * 5),
        issues: [],
        graph: [
          { from: 'Task A', to: 'Task B', type: 'data' },
          { from: 'Task B', to: 'Task C', type: 'sequential' }
        ]
      },
      completeness: {
        valid: true,
        coverage: 0.95
      },
      feasibility: {
        overallFeasible: true,
        infeasibleTasks: []
      },
      warnings: [
        {
          id: 'warn-1',
          type: 'warning',
          category: 'Structure',
          message: 'Task depth exceeds recommended limit',
          location: 'Task C > Subtask 3',
          details: 'Maximum depth of 5 levels reached',
          fix: 'Consider consolidating some subtasks'
        }
      ],
      errors: Math.random() > 0.7 ? [
        {
          id: 'err-1',
          type: 'error',
          category: 'Dependencies',
          message: 'Circular dependency detected',
          location: 'Task D -> Task B',
          details: 'Task D depends on Task B which depends on Task D',
          fix: 'Reorganize task dependencies to remove cycle'
        }
      ] : []
    };
    
    this.model.updateState('validationResults', mockResults);
  }

  updateValidationDisplay() {
    const validation = this.model.getState('validationResults');
    if (!validation) return;
    
    // Update summary
    this.view.renderSummary(validation);
    
    // Collect all issues
    const issues = [
      ...(validation.errors || []),
      ...(validation.warnings || []),
      ...(validation.info || [])
    ];
    
    // Render issues
    const filterType = this.model.getState('filterType');
    this.view.renderIssues(issues, filterType);
    
    // Render dependencies if present
    if (validation.dependencies && validation.dependencies.graph) {
      this.view.renderDependencies(validation.dependencies.graph);
    }
  }

  updateIssuesDisplay() {
    const validation = this.model.getState('validationResults');
    if (!validation) return;
    
    const issues = [
      ...(validation.errors || []),
      ...(validation.warnings || []),
      ...(validation.info || [])
    ];
    
    const filterType = this.model.getState('filterType');
    this.view.renderIssues(issues, filterType);
  }

  changeFilter(filterType) {
    this.model.updateState('filterType', filterType);
  }

  selectIssue(issueId) {
    this.model.updateState('selectedIssue', issueId);
    
    if (this.umbilical.onIssueSelect) {
      const validation = this.model.getState('validationResults');
      const allIssues = [
        ...(validation.errors || []),
        ...(validation.warnings || []),
        ...(validation.info || [])
      ];
      const issue = allIssues.find(i => i.id === issueId);
      if (issue) {
        this.umbilical.onIssueSelect(issue);
      }
    }
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * ValidationPanel - Main component export
 */
export class ValidationPanel {
  static create(umbilical) {
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ValidationPanel');
    
    const model = new ValidationPanelModel();
    const view = new ValidationPanelView(umbilical.dom);
    const viewModel = new ValidationPanelViewModel(model, view, umbilical);
    
    return viewModel;
  }
}