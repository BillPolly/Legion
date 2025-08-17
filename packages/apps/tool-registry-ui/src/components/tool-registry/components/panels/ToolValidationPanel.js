/**
 * ToolValidationPanel Component
 * Displays tool availability and validation results for planning
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';

/**
 * Model - Manages tool validation state
 */
class ToolValidationModel {
  constructor() {
    this.state = {
      requiredTools: [],
      discoveredTools: [],
      toolStatus: {},
      toolCompatibility: {},
      validationResult: null,
      feasibilityScore: null,
      missingTools: [],
      toolConflicts: [],
      taskToolMapping: {},
      validationWarnings: [],
      validationErrors: [],
      selectedToolIds: new Set(),
      filter: '',
      categoryFilter: '',
      expandedSections: new Set(['required', 'discovered', 'validation'])
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
      requiredTools: [],
      discoveredTools: [],
      toolStatus: {},
      toolCompatibility: {},
      validationResult: null,
      feasibilityScore: null,
      missingTools: [],
      toolConflicts: [],
      taskToolMapping: {},
      validationWarnings: [],
      validationErrors: [],
      selectedToolIds: new Set(),
      filter: '',
      categoryFilter: '',
      expandedSections: new Set(['required', 'discovered', 'validation'])
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders validation UI and handles DOM updates
 */
class ToolValidationView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="tool-validation-panel">
        <div class="panel-header">
          <h3>Tool Validation</h3>
          <button class="refresh-validation-button" title="Refresh validation">🔄</button>
        </div>
        
        <div class="validation-content">
          <!-- Validation Summary -->
          <div class="validation-summary-section">
            <div class="validation-summary"></div>
            <div class="feasibility-score"></div>
            <div class="feasibility-breakdown"></div>
          </div>
          
          <!-- Required Tools Section -->
          <div class="section required-tools-section" data-section="required">
            <div class="section-header">
              <span class="section-title">Required Tools</span>
              <span class="section-toggle">▼</span>
            </div>
            <div class="section-content">
              <div class="required-tools-list"></div>
            </div>
          </div>
          
          <!-- Discovered Tools Section -->
          <div class="section discovered-tools-section" data-section="discovered">
            <div class="section-header">
              <span class="section-title">Discovered Tools</span>
              <span class="section-toggle">▼</span>
            </div>
            <div class="section-content">
              <div class="tool-filters">
                <input type="text" class="tool-search" placeholder="Search tools...">
                <select class="category-filter">
                  <option value="">All Categories</option>
                  <option value="database">Database</option>
                  <option value="api">API</option>
                  <option value="auth">Authentication</option>
                  <option value="server">Server</option>
                  <option value="testing">Testing</option>
                  <option value="deployment">Deployment</option>
                </select>
              </div>
              <div class="discovered-tools-grid"></div>
            </div>
          </div>
          
          <!-- Validation Details Section -->
          <div class="section validation-details-section" data-section="validation">
            <div class="section-header">
              <span class="section-title">Validation Details</span>
              <span class="section-toggle">▼</span>
            </div>
            <div class="section-content">
              <div class="validation-warnings"></div>
              <div class="validation-errors"></div>
              <div class="missing-tools-list"></div>
              <div class="conflicts-list"></div>
              <div class="task-tool-mapping"></div>
            </div>
          </div>
        </div>
        
        <div class="tool-tooltip" style="display: none;"></div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Refresh button
    const refreshBtn = this.container.querySelector('.refresh-validation-button');
    refreshBtn.addEventListener('click', () => {
      this.viewModel.refreshValidation();
    });

    // Section toggles
    const sectionHeaders = this.container.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement;
        const sectionName = section.dataset.section;
        this.viewModel.toggleSection(sectionName);
      });
    });

    // Tool search
    const searchInput = this.container.querySelector('.tool-search');
    searchInput?.addEventListener('input', (e) => {
      this.viewModel.filterTools(e.target.value);
    });

    // Category filter
    const categoryFilter = this.container.querySelector('.category-filter');
    categoryFilter?.addEventListener('change', (e) => {
      this.viewModel.filterByCategory(e.target.value);
    });
  }

  updateRequiredTools(tools, toolStatus) {
    const listElement = this.container.querySelector('.required-tools-list');
    
    if (!tools || tools.length === 0) {
      listElement.innerHTML = '<div class="empty-state">No required tools specified</div>';
      return;
    }
    
    listElement.innerHTML = tools.map(tool => {
      const status = toolStatus[tool.name] || {};
      const statusClass = status.available ? 'available' : 'unavailable';
      
      return `
        <div class="required-tool-item" data-tool="${tool.name}">
          <span class="tool-name">${tool.name}</span>
          <span class="tool-version">${tool.version || 'any'}</span>
          <span class="tool-status ${statusClass}">
            ${status.available ? '✓' : '✗'}
            ${status.version ? `(${status.version})` : ''}
          </span>
        </div>
      `;
    }).join('');
  }

  updateDiscoveredTools(tools, selectedIds, filter, categoryFilter, compatibility) {
    const gridElement = this.container.querySelector('.discovered-tools-grid');
    
    if (!tools || tools.length === 0) {
      gridElement.innerHTML = '<div class="empty-state">No tools discovered yet</div>';
      return;
    }
    
    // Apply filters
    let filteredTools = tools;
    
    if (filter) {
      const searchTerm = filter.toLowerCase();
      filteredTools = filteredTools.filter(tool => 
        tool.name.toLowerCase().includes(searchTerm) ||
        (tool.description && tool.description.toLowerCase().includes(searchTerm))
      );
    }
    
    if (categoryFilter) {
      filteredTools = filteredTools.filter(tool => tool.category === categoryFilter);
    }
    
    gridElement.innerHTML = filteredTools.map(tool => {
      const isSelected = selectedIds.has(tool.id);
      const compat = compatibility[tool.id];
      const compatClass = compat ? (compat.compatible ? 'compatible' : 'incompatible') : '';
      const isHidden = false; // Will be set based on filter
      
      return `
        <div class="tool-card ${isSelected ? 'selected' : ''} ${compatClass} ${isHidden ? 'hidden' : ''}"
             data-tool-id="${tool.id}"
             data-category="${tool.category || ''}">
          <div class="tool-card-header">
            <span class="tool-card-name">${tool.name}</span>
            ${compat ? `
              <span class="compatibility-indicator">
                ${compat.compatible ? '✓' : '✗'}
                ${compat.confidence ? `${Math.round(compat.confidence * 100)}%` : ''}
              </span>
            ` : ''}
          </div>
          <div class="tool-card-category">${tool.category || 'Uncategorized'}</div>
          ${tool.description ? `
            <div class="tool-card-description">${tool.description}</div>
          ` : ''}
        </div>
      `;
    }).join('');
    
    // Bind tool card events
    this.bindToolCardEvents();
  }

  bindToolCardEvents() {
    const toolCards = this.container.querySelectorAll('.tool-card');
    const tooltip = this.container.querySelector('.tool-tooltip');
    
    toolCards.forEach(card => {
      const toolId = card.dataset.toolId;
      
      // Click to select
      card.addEventListener('click', () => {
        this.viewModel.toggleToolSelection(toolId);
      });
      
      // Hover for tooltip
      card.addEventListener('mouseenter', (e) => {
        const tool = this.viewModel.getToolById(toolId);
        if (tool && tool.description) {
          tooltip.textContent = tool.description;
          tooltip.style.display = 'block';
          tooltip.style.left = `${e.pageX + 10}px`;
          tooltip.style.top = `${e.pageY + 10}px`;
        }
      });
      
      card.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
      });
    });
  }

  updateValidationSummary(validation) {
    const summaryElement = this.container.querySelector('.validation-summary');
    
    if (!validation) {
      summaryElement.innerHTML = '';
      return;
    }
    
    const statusClass = validation.valid ? 'valid' : 'invalid';
    const statusText = validation.valid ? 'Valid' : 'Invalid';
    
    summaryElement.innerHTML = `
      <div class="validation-status ${statusClass}">
        <span class="status-label">Status:</span>
        <span class="status-value">${statusText}</span>
      </div>
      <div class="tools-available">
        <span class="label">Tools Available:</span>
        <span class="value">${validation.toolsAvailable} of ${validation.toolsRequired}</span>
      </div>
    `;
  }

  updateFeasibilityScore(feasibility) {
    const scoreElement = this.container.querySelector('.feasibility-score');
    const breakdownElement = this.container.querySelector('.feasibility-breakdown');
    
    if (!feasibility) {
      scoreElement.innerHTML = '';
      breakdownElement.innerHTML = '';
      return;
    }
    
    const scorePercent = Math.round(feasibility.score * 100);
    const scoreClass = scorePercent >= 80 ? 'high' : scorePercent >= 50 ? 'medium' : 'low';
    
    scoreElement.innerHTML = `
      <div class="feasibility-display ${scoreClass}">
        <span class="label">Feasibility:</span>
        <span class="score">${scorePercent}%</span>
      </div>
    `;
    
    if (feasibility.breakdown) {
      breakdownElement.innerHTML = `
        <div class="breakdown-items">
          ${Object.entries(feasibility.breakdown).map(([key, value]) => `
            <div class="breakdown-item">
              <span class="breakdown-label">${this.formatLabel(key)}:</span>
              <span class="breakdown-value">${Math.round(value * 100)}%</span>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  updateMissingTools(missingTools) {
    const listElement = this.container.querySelector('.missing-tools-list');
    
    if (!missingTools || missingTools.length === 0) {
      listElement.innerHTML = '';
      return;
    }
    
    listElement.innerHTML = `
      <h4>Missing Tools</h4>
      <div class="missing-tools">
        ${missingTools.map(tool => `
          <div class="missing-tool-item">
            <span class="tool-name">${tool.name}</span>
            <span class="tool-type ${tool.type}">${tool.type}</span>
            ${tool.alternatives && tool.alternatives.length > 0 ? `
              <div class="alternatives">
                Alternatives: ${tool.alternatives.join(', ')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  updateConflicts(conflicts) {
    const listElement = this.container.querySelector('.conflicts-list');
    
    if (!conflicts || conflicts.length === 0) {
      listElement.innerHTML = '';
      return;
    }
    
    listElement.innerHTML = `
      <h4>Tool Conflicts</h4>
      <div class="conflicts">
        ${conflicts.map(conflict => `
          <div class="conflict-item">
            <div class="conflict-tools">
              ${conflict.tools.join(' ⚡ ')}
            </div>
            <div class="conflict-reason">${conflict.reason}</div>
            ${conflict.resolution ? `
              <div class="conflict-resolution">
                💡 ${conflict.resolution}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  updateTaskToolMapping(mapping) {
    const mappingElement = this.container.querySelector('.task-tool-mapping');
    
    if (!mapping || Object.keys(mapping).length === 0) {
      mappingElement.innerHTML = '';
      return;
    }
    
    mappingElement.innerHTML = `
      <h4>Task-Tool Mapping</h4>
      <div class="mapping-table">
        ${Object.entries(mapping).map(([task, tools]) => `
          <div class="mapping-row" data-task="${task}">
            <div class="task-name">${task}</div>
            <div class="tools">${tools.join(', ')}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  updateWarnings(warnings) {
    const warningsElement = this.container.querySelector('.validation-warnings');
    
    if (!warnings || warnings.length === 0) {
      warningsElement.innerHTML = '';
      return;
    }
    
    warningsElement.innerHTML = `
      <div class="warnings">
        ${warnings.map(warning => `
          <div class="warning-item">⚠️ ${warning}</div>
        `).join('')}
      </div>
    `;
  }

  updateErrors(errors) {
    const errorsElement = this.container.querySelector('.validation-errors');
    
    if (!errors || errors.length === 0) {
      errorsElement.innerHTML = '';
      return;
    }
    
    errorsElement.innerHTML = `
      <div class="errors error">
        ${errors.map(error => `
          <div class="error-item">❌ ${error}</div>
        `).join('')}
      </div>
    `;
  }

  toggleSection(sectionName, isExpanded) {
    const section = this.container.querySelector(`[data-section="${sectionName}"]`);
    if (section) {
      const toggle = section.querySelector('.section-toggle');
      if (isExpanded) {
        section.classList.remove('collapsed');
        toggle.textContent = '▼';
      } else {
        section.classList.add('collapsed');
        toggle.textContent = '▶';
      }
    }
  }

  highlightTool(toolId) {
    const toolCard = this.container.querySelector(`[data-tool-id="${toolId}"]`);
    if (toolCard) {
      toolCard.classList.add('newly-available');
      setTimeout(() => {
        toolCard.classList.remove('newly-available');
      }, 2000);
    }
  }

  formatLabel(key) {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class ToolValidationViewModel {
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
      setRequiredTools: this.setRequiredTools.bind(this),
      setToolStatus: this.setToolStatus.bind(this),
      setDiscoveredTools: this.setDiscoveredTools.bind(this),
      addDiscoveredTool: this.addDiscoveredTool.bind(this),
      setToolCompatibility: this.setToolCompatibility.bind(this),
      setValidationResult: this.setValidationResult.bind(this),
      setFeasibilityScore: this.setFeasibilityScore.bind(this),
      updateFeasibilityScore: this.updateFeasibilityScore.bind(this),
      setMissingTools: this.setMissingTools.bind(this),
      setToolConflicts: this.setToolConflicts.bind(this),
      setTaskToolMapping: this.setTaskToolMapping.bind(this),
      setValidationWarnings: this.setValidationWarnings.bind(this),
      setValidationErrors: this.setValidationErrors.bind(this),
      getToolsByCategory: this.getToolsByCategory.bind(this),
      filterTools: this.filterTools.bind(this),
      refreshValidation: this.refreshValidation.bind(this),
      getSelectedTools: this.getSelectedTools.bind(this),
      markToolAvailable: this.markToolAvailable.bind(this),
      searchToolsForTask: this.searchToolsForTask.bind(this)
    };
    
    if (this.umbilical.onMount) {
      this.umbilical.onMount(api);
    }
    
    this.api = api;
  }

  onModelChange(changes) {
    if ('requiredTools' in changes || 'toolStatus' in changes) {
      this.view.updateRequiredTools(
        this.model.getState('requiredTools'),
        this.model.getState('toolStatus')
      );
    }
    
    if ('discoveredTools' in changes || 'selectedToolIds' in changes || 
        'filter' in changes || 'categoryFilter' in changes || 
        'toolCompatibility' in changes) {
      this.view.updateDiscoveredTools(
        this.model.getState('discoveredTools'),
        this.model.getState('selectedToolIds'),
        this.model.getState('filter'),
        this.model.getState('categoryFilter'),
        this.model.getState('toolCompatibility')
      );
    }
    
    if ('validationResult' in changes) {
      this.view.updateValidationSummary(changes.validationResult);
    }
    
    if ('feasibilityScore' in changes) {
      this.view.updateFeasibilityScore(changes.feasibilityScore);
    }
    
    if ('missingTools' in changes) {
      this.view.updateMissingTools(changes.missingTools);
    }
    
    if ('toolConflicts' in changes) {
      this.view.updateConflicts(changes.toolConflicts);
    }
    
    if ('taskToolMapping' in changes) {
      this.view.updateTaskToolMapping(changes.taskToolMapping);
    }
    
    if ('validationWarnings' in changes) {
      this.view.updateWarnings(changes.validationWarnings);
    }
    
    if ('validationErrors' in changes) {
      this.view.updateErrors(changes.validationErrors);
    }
    
    if ('expandedSections' in changes) {
      const sections = this.model.getState('expandedSections');
      ['required', 'discovered', 'validation'].forEach(section => {
        this.view.toggleSection(section, sections.has(section));
      });
    }
  }

  // Public API methods
  setRequiredTools(tools) {
    this.model.updateState('requiredTools', tools);
  }

  setToolStatus(status) {
    this.model.updateState('toolStatus', status);
  }

  setDiscoveredTools(tools) {
    this.model.updateState('discoveredTools', tools);
  }

  addDiscoveredTool(tool) {
    const tools = this.model.getState('discoveredTools');
    tools.push(tool);
    this.model.updateState('discoveredTools', [...tools]);
  }

  setToolCompatibility(compatibility) {
    this.model.updateState('toolCompatibility', compatibility);
  }

  setValidationResult(result) {
    this.model.updateState('validationResult', result);
    if (this.umbilical.onValidationComplete) {
      this.umbilical.onValidationComplete(result);
    }
  }

  setFeasibilityScore(score) {
    this.model.updateState('feasibilityScore', score);
  }

  updateFeasibilityScore(newScore) {
    this.model.updateState('feasibilityScore', { score: newScore });
  }

  setMissingTools(tools) {
    this.model.updateState('missingTools', tools);
    if (tools.length > 0 && this.umbilical.onToolMissing) {
      this.umbilical.onToolMissing(tools);
    }
  }

  setToolConflicts(conflicts) {
    this.model.updateState('toolConflicts', conflicts);
  }

  setTaskToolMapping(mapping) {
    this.model.updateState('taskToolMapping', mapping);
  }

  setValidationWarnings(warnings) {
    this.model.updateState('validationWarnings', warnings);
  }

  setValidationErrors(errors) {
    this.model.updateState('validationErrors', errors);
  }

  getToolsByCategory() {
    const tools = this.model.getState('discoveredTools');
    const grouped = {};
    
    tools.forEach(tool => {
      const category = tool.category || 'uncategorized';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(tool);
    });
    
    return grouped;
  }

  filterTools(searchTerm) {
    this.model.updateState('filter', searchTerm);
  }

  filterByCategory(category) {
    this.model.updateState('categoryFilter', category);
  }

  async refreshValidation() {
    if (this.umbilical.toolRegistryActor) {
      try {
        const tools = await this.umbilical.toolRegistryActor.searchTools({});
        this.setDiscoveredTools(tools || []);
      } catch (error) {
        console.error('Failed to refresh tools:', error);
      }
    }
  }

  getSelectedTools() {
    const selectedIds = this.model.getState('selectedToolIds');
    const allTools = this.model.getState('discoveredTools');
    return allTools.filter(tool => selectedIds.has(tool.id));
  }

  toggleToolSelection(toolId) {
    const selectedIds = this.model.getState('selectedToolIds');
    
    if (selectedIds.has(toolId)) {
      selectedIds.delete(toolId);
    } else {
      selectedIds.add(toolId);
    }
    
    this.model.updateState('selectedToolIds', new Set(selectedIds));
    
    if (this.umbilical.onToolSelect) {
      this.umbilical.onToolSelect(toolId);
    }
  }

  toggleSection(sectionName) {
    const sections = this.model.getState('expandedSections');
    
    if (sections.has(sectionName)) {
      sections.delete(sectionName);
    } else {
      sections.add(sectionName);
    }
    
    this.model.updateState('expandedSections', new Set(sections));
  }

  getToolById(toolId) {
    const tools = this.model.getState('discoveredTools');
    return tools.find(tool => tool.id === toolId);
  }

  markToolAvailable(toolId) {
    this.view.highlightTool(toolId);
  }

  async searchToolsForTask(taskDescription) {
    if (this.umbilical.toolRegistryActor) {
      try {
        const tools = await this.umbilical.toolRegistryActor.searchTools({
          query: taskDescription
        });
        return tools;
      } catch (error) {
        console.error('Failed to search tools:', error);
        return [];
      }
    }
    return [];
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * ToolValidationPanel - Main component class
 */
export class ToolValidationPanel {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ToolValidationPanel');
    
    // Create MVVM components
    const model = new ToolValidationModel();
    const view = new ToolValidationView(umbilical.dom, null);
    const viewModel = new ToolValidationViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}