/**
 * PlanLibraryPanel Component
 * Provides plan management interface for saving, loading, and organizing plans
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { StandardizedComponentAPI, apiMethod, validateState } from '../../base/StandardizedComponentAPI.js';
import { APIResponse } from '../../interfaces/ComponentAPI.js';

/**
 * Model - Manages plan library state
 */
class PlanLibraryModel {
  constructor() {
    this.state = {
      plans: [],
      selectedPlan: null,
      searchQuery: '',
      sortBy: 'createdAt', // createdAt, updatedAt, name, complexity
      sortOrder: 'desc', // asc, desc
      filterBy: 'all', // all, templates, drafts, completed
      tags: [],
      selectedTags: [],
      viewMode: 'grid', // grid, list, table
      currentPlan: null,
      planMetadata: {},
      importInProgress: false,
      exportInProgress: false
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

  addPlan(plan) {
    this.state.plans.push(plan);
    this.updateAvailableTags();
    this.notifyListeners({ plans: this.state.plans, tags: this.state.tags });
  }

  updatePlan(planId, updates) {
    const planIndex = this.state.plans.findIndex(p => p.id === planId);
    if (planIndex >= 0) {
      this.state.plans[planIndex] = { ...this.state.plans[planIndex], ...updates };
      this.notifyListeners({ plans: this.state.plans });
    }
  }

  removePlan(planId) {
    this.state.plans = this.state.plans.filter(p => p.id !== planId);
    if (this.state.selectedPlan?.id === planId) {
      this.state.selectedPlan = null;
    }
    this.updateAvailableTags();
    this.notifyListeners({ 
      plans: this.state.plans, 
      selectedPlan: this.state.selectedPlan,
      tags: this.state.tags 
    });
  }

  updateAvailableTags() {
    const allTags = new Set();
    this.state.plans.forEach(plan => {
      if (plan.tags) {
        plan.tags.forEach(tag => allTags.add(tag));
      }
    });
    this.state.tags = Array.from(allTags).sort();
  }

  getFilteredPlans() {
    let filtered = [...this.state.plans];
    
    // Apply search filter
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(plan => 
        plan.name.toLowerCase().includes(query) ||
        plan.description?.toLowerCase().includes(query) ||
        plan.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (this.state.filterBy !== 'all') {
      filtered = filtered.filter(plan => {
        switch (this.state.filterBy) {
          case 'templates':
            return plan.isTemplate;
          case 'drafts':
            return plan.status === 'draft';
          case 'completed':
            return plan.status === 'completed';
          default:
            return true;
        }
      });
    }
    
    // Apply tag filter
    if (this.state.selectedTags.length > 0) {
      filtered = filtered.filter(plan => 
        plan.tags && this.state.selectedTags.every(tag => plan.tags.includes(tag))
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[this.state.sortBy];
      let bVal = b[this.state.sortBy];
      
      if (this.state.sortBy === 'name') {
        aVal = aVal?.toLowerCase() || '';
        bVal = bVal?.toLowerCase() || '';
      } else if (this.state.sortBy.endsWith('At')) {
        aVal = new Date(aVal || 0);
        bVal = new Date(bVal || 0);
      }
      
      if (this.state.sortOrder === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
    });
    
    return filtered;
  }

  reset() {
    this.state = {
      plans: [],
      selectedPlan: null,
      searchQuery: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      filterBy: 'all',
      tags: [],
      selectedTags: [],
      viewMode: 'grid',
      currentPlan: null,
      planMetadata: {},
      importInProgress: false,
      exportInProgress: false
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders plan library UI and handles DOM updates
 */
class PlanLibraryView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="plan-library-panel">
        <!-- Header with Controls -->
        <div class="library-header">
          <h3>Plan Library</h3>
          <div class="library-actions">
            <button class="new-plan-button">+ New Plan</button>
            <button class="import-plan-button">📁 Import</button>
            <button class="export-selected-button" disabled>📤 Export</button>
          </div>
        </div>

        <!-- Search and Filters -->
        <div class="library-controls">
          <div class="search-section">
            <input type="text" class="plan-search-input" placeholder="Search plans...">
            <button class="search-clear-button" style="display: none;">×</button>
          </div>
          
          <div class="filter-section">
            <select class="filter-select">
              <option value="all">All Plans</option>
              <option value="templates">Templates</option>
              <option value="drafts">Drafts</option>
              <option value="completed">Completed</option>
            </select>
            
            <select class="sort-select">
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="updatedAt:desc">Recently Updated</option>
              <option value="name:asc">Name A-Z</option>
              <option value="name:desc">Name Z-A</option>
              <option value="complexity:desc">Most Complex</option>
            </select>
            
            <div class="view-mode-toggles">
              <button class="view-toggle grid-view active" data-view="grid">⊞</button>
              <button class="view-toggle list-view" data-view="list">☰</button>
              <button class="view-toggle table-view" data-view="table">⊟</button>
            </div>
          </div>
        </div>

        <!-- Tags Filter -->
        <div class="tags-section">
          <div class="tags-label">Filter by tags:</div>
          <div class="tags-container">
            <div class="available-tags"></div>
            <div class="selected-tags"></div>
          </div>
        </div>

        <!-- Plans Display -->
        <div class="plans-content">
          <div class="plans-grid"></div>
          <div class="plans-list" style="display: none;"></div>
          <div class="plans-table" style="display: none;"></div>
        </div>

        <!-- Plan Details Modal -->
        <div class="plan-details-modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h4 class="plan-title"></h4>
              <button class="modal-close-button">×</button>
            </div>
            <div class="modal-body">
              <div class="plan-metadata">
                <div class="metadata-item">
                  <label>Description:</label>
                  <div class="plan-description"></div>
                </div>
                <div class="metadata-item">
                  <label>Created:</label>
                  <div class="plan-created"></div>
                </div>
                <div class="metadata-item">
                  <label>Updated:</label>
                  <div class="plan-updated"></div>
                </div>
                <div class="metadata-item">
                  <label>Status:</label>
                  <div class="plan-status"></div>
                </div>
                <div class="metadata-item">
                  <label>Tags:</label>
                  <div class="plan-tags"></div>
                </div>
                <div class="metadata-item">
                  <label>Tasks:</label>
                  <div class="plan-task-count"></div>
                </div>
              </div>
              <div class="plan-preview">
                <h5>Plan Preview</h5>
                <div class="plan-hierarchy-preview"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="load-plan-button">Load Plan</button>
              <button class="duplicate-plan-button">Duplicate</button>
              <button class="edit-plan-button">Edit</button>
              <button class="delete-plan-button">Delete</button>
              <button class="export-plan-button">Export</button>
            </div>
          </div>
        </div>

        <!-- Import Modal -->
        <div class="import-modal" style="display: none;">
          <div class="modal-content">
            <div class="modal-header">
              <h4>Import Plan</h4>
              <button class="modal-close-button">×</button>
            </div>
            <div class="modal-body">
              <div class="import-options">
                <div class="import-method">
                  <label>
                    <input type="radio" name="import-method" value="file" checked>
                    Import from File
                  </label>
                  <input type="file" class="file-input" accept=".json,.yaml,.yml" style="display: none;">
                  <button class="browse-file-button">Browse Files</button>
                </div>
                <div class="import-method">
                  <label>
                    <input type="radio" name="import-method" value="url">
                    Import from URL
                  </label>
                  <input type="url" class="url-input" placeholder="https://example.com/plan.json">
                </div>
                <div class="import-method">
                  <label>
                    <input type="radio" name="import-method" value="text">
                    Paste JSON
                  </label>
                  <textarea class="json-input" placeholder="Paste plan JSON here..." rows="8"></textarea>
                </div>
              </div>
              <div class="import-preview" style="display: none;">
                <h5>Preview</h5>
                <div class="preview-content"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="import-confirm-button" disabled>Import Plan</button>
              <button class="import-cancel-button">Cancel</button>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" style="display: none;">
          <div class="empty-icon">📋</div>
          <div class="empty-title">No Plans Found</div>
          <div class="empty-message">Create your first plan or import existing ones to get started.</div>
          <button class="empty-new-plan-button">Create New Plan</button>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // Header actions
    const newPlanButton = this.container.querySelector('.new-plan-button');
    newPlanButton.addEventListener('click', () => this.viewModel.createNewPlan());

    const importButton = this.container.querySelector('.import-plan-button');
    importButton.addEventListener('click', () => this.showImportModal());

    const exportButton = this.container.querySelector('.export-selected-button');
    exportButton.addEventListener('click', () => this.viewModel.exportSelectedPlans());

    // Search
    const searchInput = this.container.querySelector('.plan-search-input');
    searchInput.addEventListener('input', (e) => {
      this.viewModel.setSearchQuery(e.target.value);
      this.updateSearchClearButton(e.target.value);
    });

    const searchClear = this.container.querySelector('.search-clear-button');
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      this.viewModel.setSearchQuery('');
      this.updateSearchClearButton('');
    });

    // Filters and sorting
    const filterSelect = this.container.querySelector('.filter-select');
    filterSelect.addEventListener('change', (e) => {
      this.viewModel.setFilter(e.target.value);
    });

    const sortSelect = this.container.querySelector('.sort-select');
    sortSelect.addEventListener('change', (e) => {
      const [sortBy, sortOrder] = e.target.value.split(':');
      this.viewModel.setSorting(sortBy, sortOrder);
    });

    // View mode toggles
    const viewToggles = this.container.querySelectorAll('.view-toggle');
    viewToggles.forEach(toggle => {
      toggle.addEventListener('click', () => {
        const viewMode = toggle.dataset.view;
        this.viewModel.setViewMode(viewMode);
        this.updateViewToggles(viewMode);
      });
    });

    // Modal close buttons
    const modalCloseButtons = this.container.querySelectorAll('.modal-close-button');
    modalCloseButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.hideAllModals();
      });
    });

    // Import modal
    this.bindImportModalEvents();
    
    // Plan details modal
    this.bindPlanDetailsModalEvents();

    // Empty state
    const emptyNewPlanButton = this.container.querySelector('.empty-new-plan-button');
    emptyNewPlanButton.addEventListener('click', () => this.viewModel.createNewPlan());
  }

  bindImportModalEvents() {
    const importMethods = this.container.querySelectorAll('input[name="import-method"]');
    importMethods.forEach(radio => {
      radio.addEventListener('change', () => this.updateImportMethod());
    });

    const browseButton = this.container.querySelector('.browse-file-button');
    const fileInput = this.container.querySelector('.file-input');
    
    browseButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleFileSelection(e));

    const urlInput = this.container.querySelector('.url-input');
    urlInput.addEventListener('input', () => this.validateImportData());

    const jsonInput = this.container.querySelector('.json-input');
    jsonInput.addEventListener('input', () => this.validateImportData());

    const importConfirm = this.container.querySelector('.import-confirm-button');
    importConfirm.addEventListener('click', () => this.viewModel.confirmImport());

    const importCancel = this.container.querySelector('.import-cancel-button');
    importCancel.addEventListener('click', () => this.hideImportModal());
  }

  bindPlanDetailsModalEvents() {
    const loadButton = this.container.querySelector('.load-plan-button');
    loadButton.addEventListener('click', () => this.viewModel.loadSelectedPlan());

    const duplicateButton = this.container.querySelector('.duplicate-plan-button');
    duplicateButton.addEventListener('click', () => this.viewModel.duplicateSelectedPlan());

    const editButton = this.container.querySelector('.edit-plan-button');
    editButton.addEventListener('click', () => this.viewModel.editSelectedPlan());

    const deleteButton = this.container.querySelector('.delete-plan-button');
    deleteButton.addEventListener('click', () => this.viewModel.deleteSelectedPlan());

    const exportPlanButton = this.container.querySelector('.export-plan-button');
    exportPlanButton.addEventListener('click', () => this.viewModel.exportSelectedPlan());
  }

  updatePlansDisplay(plans, viewMode) {
    // Hide all views
    this.container.querySelector('.plans-grid').style.display = 'none';
    this.container.querySelector('.plans-list').style.display = 'none';
    this.container.querySelector('.plans-table').style.display = 'none';
    this.container.querySelector('.empty-state').style.display = 'none';

    if (plans.length === 0) {
      this.container.querySelector('.empty-state').style.display = 'block';
      return;
    }

    // Show appropriate view
    switch (viewMode) {
      case 'grid':
        this.renderGridView(plans);
        this.container.querySelector('.plans-grid').style.display = 'grid';
        break;
      case 'list':
        this.renderListView(plans);
        this.container.querySelector('.plans-list').style.display = 'block';
        break;
      case 'table':
        this.renderTableView(plans);
        this.container.querySelector('.plans-table').style.display = 'block';
        break;
    }
  }

  renderGridView(plans) {
    const grid = this.container.querySelector('.plans-grid');
    grid.innerHTML = plans.map(plan => `
      <div class="plan-card" data-plan-id="${plan.id}">
        <div class="plan-card-header">
          <h4 class="plan-card-title">${plan.name}</h4>
          <div class="plan-card-status ${plan.status}">${plan.status}</div>
        </div>
        <div class="plan-card-description">${plan.description || 'No description'}</div>
        <div class="plan-card-meta">
          <div class="plan-task-count">${this.countPlanTasks(plan)} tasks</div>
          <div class="plan-updated">${this.formatDate(plan.updatedAt)}</div>
        </div>
        <div class="plan-card-tags">
          ${(plan.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('')}
        </div>
        <div class="plan-card-actions">
          <button class="quick-load-button" data-plan-id="${plan.id}">Load</button>
          <button class="plan-details-button" data-plan-id="${plan.id}">Details</button>
        </div>
      </div>
    `).join('');

    this.bindPlanCardEvents();
  }

  renderListView(plans) {
    const list = this.container.querySelector('.plans-list');
    list.innerHTML = plans.map(plan => `
      <div class="plan-list-item" data-plan-id="${plan.id}">
        <div class="plan-item-content">
          <div class="plan-item-header">
            <h4 class="plan-item-title">${plan.name}</h4>
            <div class="plan-item-status ${plan.status}">${plan.status}</div>
          </div>
          <div class="plan-item-description">${plan.description || 'No description'}</div>
          <div class="plan-item-meta">
            <span class="plan-tasks">${this.countPlanTasks(plan)} tasks</span>
            <span class="plan-updated">Updated ${this.formatDate(plan.updatedAt)}</span>
          </div>
        </div>
        <div class="plan-item-actions">
          <button class="quick-load-button" data-plan-id="${plan.id}">Load</button>
          <button class="plan-details-button" data-plan-id="${plan.id}">⋯</button>
        </div>
      </div>
    `).join('');

    this.bindPlanCardEvents();
  }

  renderTableView(plans) {
    const table = this.container.querySelector('.plans-table');
    table.innerHTML = `
      <table class="plans-table-content">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Tasks</th>
            <th>Created</th>
            <th>Updated</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${plans.map(plan => `
            <tr class="plan-table-row" data-plan-id="${plan.id}">
              <td class="plan-name-cell">
                <div class="plan-name">${plan.name}</div>
                <div class="plan-description-brief">${this.truncateText(plan.description, 50)}</div>
              </td>
              <td class="plan-status-cell">
                <span class="status-badge ${plan.status}">${plan.status}</span>
              </td>
              <td class="plan-tasks-cell">${this.countPlanTasks(plan)}</td>
              <td class="plan-created-cell">${this.formatDate(plan.createdAt)}</td>
              <td class="plan-updated-cell">${this.formatDate(plan.updatedAt)}</td>
              <td class="plan-actions-cell">
                <button class="quick-load-button" data-plan-id="${plan.id}">Load</button>
                <button class="plan-details-button" data-plan-id="${plan.id}">Details</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    this.bindPlanCardEvents();
  }

  bindPlanCardEvents() {
    const loadButtons = this.container.querySelectorAll('.quick-load-button');
    loadButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewModel.quickLoadPlan(button.dataset.planId);
      });
    });

    const detailsButtons = this.container.querySelectorAll('.plan-details-button');
    detailsButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewModel.showPlanDetails(button.dataset.planId);
      });
    });

    const planCards = this.container.querySelectorAll('.plan-card, .plan-list-item, .plan-table-row');
    planCards.forEach(card => {
      card.addEventListener('click', () => {
        this.viewModel.selectPlan(card.dataset.planId);
      });
    });
  }

  updateAvailableTags(tags, selectedTags) {
    const availableContainer = this.container.querySelector('.available-tags');
    const selectedContainer = this.container.querySelector('.selected-tags');
    
    availableContainer.innerHTML = tags
      .filter(tag => !selectedTags.includes(tag))
      .map(tag => `
        <span class="tag available" data-tag="${tag}">${tag}</span>
      `).join('');
    
    selectedContainer.innerHTML = selectedTags.map(tag => `
      <span class="tag selected" data-tag="${tag}">
        ${tag}
        <button class="tag-remove" data-tag="${tag}">×</button>
      </span>
    `).join('');
    
    // Bind tag events
    const availableTags = availableContainer.querySelectorAll('.tag');
    availableTags.forEach(tag => {
      tag.addEventListener('click', () => {
        this.viewModel.addTagFilter(tag.dataset.tag);
      });
    });
    
    const removeButtons = selectedContainer.querySelectorAll('.tag-remove');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.viewModel.removeTagFilter(button.dataset.tag);
      });
    });
  }

  showPlanDetailsModal(plan) {
    const modal = this.container.querySelector('.plan-details-modal');
    
    // Populate modal content
    modal.querySelector('.plan-title').textContent = plan.name;
    modal.querySelector('.plan-description').textContent = plan.description || 'No description';
    modal.querySelector('.plan-created').textContent = this.formatDate(plan.createdAt);
    modal.querySelector('.plan-updated').textContent = this.formatDate(plan.updatedAt);
    modal.querySelector('.plan-status').textContent = plan.status;
    modal.querySelector('.plan-task-count').textContent = `${this.countPlanTasks(plan)} tasks`;
    
    const tagsContainer = modal.querySelector('.plan-tags');
    tagsContainer.innerHTML = (plan.tags || [])
      .map(tag => `<span class="tag">${tag}</span>`)
      .join('');
    
    // Render plan hierarchy preview
    this.renderPlanPreview(plan);
    
    modal.style.display = 'flex';
  }

  renderPlanPreview(plan) {
    const previewContainer = this.container.querySelector('.plan-hierarchy-preview');
    
    if (!plan.hierarchy || !plan.hierarchy.root) {
      previewContainer.innerHTML = '<div class="no-preview">No hierarchy available</div>';
      return;
    }
    
    const renderNode = (node, level = 0) => {
      const indent = '  '.repeat(level);
      let html = `<div class="preview-node level-${level}">
        ${indent}• ${node.description || node.id}
        ${node.complexity ? `<span class="complexity">[${node.complexity}]</span>` : ''}
      </div>`;
      
      if (node.children) {
        html += node.children.map(child => renderNode(child, level + 1)).join('');
      }
      
      return html;
    };
    
    previewContainer.innerHTML = renderNode(plan.hierarchy.root);
  }

  showImportModal() {
    const modal = this.container.querySelector('.import-modal');
    modal.style.display = 'flex';
    this.updateImportMethod();
  }

  hideImportModal() {
    const modal = this.container.querySelector('.import-modal');
    modal.style.display = 'none';
    this.resetImportModal();
  }

  hideAllModals() {
    this.container.querySelectorAll('.plan-details-modal, .import-modal').forEach(modal => {
      modal.style.display = 'none';
    });
  }

  updateImportMethod() {
    const selectedMethod = this.container.querySelector('input[name="import-method"]:checked').value;
    
    // Hide all input methods
    this.container.querySelector('.file-input').style.display = 'none';
    this.container.querySelector('.browse-file-button').style.display = 'none';
    this.container.querySelector('.url-input').style.display = 'none';
    this.container.querySelector('.json-input').style.display = 'none';
    
    // Show selected method
    switch (selectedMethod) {
      case 'file':
        this.container.querySelector('.browse-file-button').style.display = 'inline-block';
        break;
      case 'url':
        this.container.querySelector('.url-input').style.display = 'block';
        break;
      case 'text':
        this.container.querySelector('.json-input').style.display = 'block';
        break;
    }
    
    this.validateImportData();
  }

  handleFileSelection(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const plan = JSON.parse(e.target.result);
          this.showImportPreview(plan);
          this.validateImportData();
        } catch (error) {
          this.showImportError('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  }

  validateImportData() {
    const method = this.container.querySelector('input[name="import-method"]:checked').value;
    const confirmButton = this.container.querySelector('.import-confirm-button');
    
    let isValid = false;
    
    switch (method) {
      case 'file':
        isValid = this.container.querySelector('.file-input').files.length > 0;
        break;
      case 'url':
        const url = this.container.querySelector('.url-input').value;
        isValid = url && this.isValidUrl(url);
        break;
      case 'text':
        const json = this.container.querySelector('.json-input').value;
        isValid = json && this.isValidJson(json);
        break;
    }
    
    confirmButton.disabled = !isValid;
  }

  showImportPreview(plan) {
    const previewContainer = this.container.querySelector('.import-preview');
    const previewContent = previewContainer.querySelector('.preview-content');
    
    previewContent.innerHTML = `
      <div class="preview-item">
        <strong>Name:</strong> ${plan.name || 'Unnamed Plan'}
      </div>
      <div class="preview-item">
        <strong>Description:</strong> ${plan.description || 'No description'}
      </div>
      <div class="preview-item">
        <strong>Tasks:</strong> ${this.countPlanTasks(plan)}
      </div>
      <div class="preview-item">
        <strong>Status:</strong> ${plan.status || 'draft'}
      </div>
    `;
    
    previewContainer.style.display = 'block';
  }

  showImportError(message) {
    const previewContainer = this.container.querySelector('.import-preview');
    const previewContent = previewContainer.querySelector('.preview-content');
    
    previewContent.innerHTML = `<div class="import-error">${message}</div>`;
    previewContainer.style.display = 'block';
  }

  resetImportModal() {
    this.container.querySelector('.file-input').value = '';
    this.container.querySelector('.url-input').value = '';
    this.container.querySelector('.json-input').value = '';
    this.container.querySelector('.import-preview').style.display = 'none';
    this.container.querySelector('.import-confirm-button').disabled = true;
  }

  updateSearchClearButton(query) {
    const clearButton = this.container.querySelector('.search-clear-button');
    clearButton.style.display = query ? 'block' : 'none';
  }

  updateViewToggles(activeView) {
    const toggles = this.container.querySelectorAll('.view-toggle');
    toggles.forEach(toggle => {
      toggle.classList.toggle('active', toggle.dataset.view === activeView);
    });
  }

  countPlanTasks(plan) {
    if (!plan.hierarchy || !plan.hierarchy.root) return 0;
    
    const countNodes = (node) => {
      let count = 0;
      if (node.complexity === 'SIMPLE') count = 1;
      if (node.children) {
        count += node.children.reduce((sum, child) => sum + countNodes(child), 0);
      }
      return count;
    };
    
    return countNodes(plan.hierarchy.root);
  }

  formatDate(dateString) {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substr(0, maxLength) + '...' : text;
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  isValidJson(text) {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 * Now extends StandardizedComponentAPI for consistent interface
 */
class PlanLibraryViewModel extends StandardizedComponentAPI {
  constructor(model, view, umbilical) {
    // Initialize base standardized API
    super(model, view, umbilical, 'PlanLibraryPanel');
    
    this.view = view;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
    
    // Initialize with data
    this.loadPlans();
  }

  /**
   * Component-specific API methods for PlanLibraryPanel
   * Follows standardized naming conventions and error handling
   */
  getComponentSpecificMethods() {
    return {
      // === PLAN MANAGEMENT ===
      loadPlans: this.loadPlans.bind(this),
      getPlans: () => this.model.getState('plans'),
      savePlan: this.savePlan.bind(this),
      deletePlan: this.deletePlan.bind(this),
      duplicatePlan: this.duplicatePlan.bind(this),
      
      // === CURRENT PLAN ===
      setCurrentPlan: this.setCurrentPlan.bind(this),
      getCurrentPlan: () => this.model.getState('currentPlan'),
      
      // === PLAN SELECTION ===
      setSelectedPlan: this.setSelectedPlan.bind(this),
      getSelectedPlan: () => this.model.getState('selectedPlan'),
      
      // === SEARCH AND FILTERING ===
      searchPlans: this.searchPlans.bind(this),
      getSearchQuery: () => this.model.getState('searchQuery'),
      setFilterBy: this.setFilterBy.bind(this),
      getFilterBy: () => this.model.getState('filterBy'),
      setSortBy: this.setSortBy.bind(this),
      getSortBy: () => this.model.getState('sortBy'),
      setSortOrder: this.setSortOrder.bind(this),
      getSortOrder: () => this.model.getState('sortOrder'),
      getFilteredPlans: () => this.model.getFilteredPlans(),
      
      // === TAG MANAGEMENT ===
      getTags: () => this.model.getState('tags'),
      getSelectedTags: () => this.model.getState('selectedTags'),
      setSelectedTags: this.setSelectedTags.bind(this),
      addTag: this.addTag.bind(this),
      removeTag: this.removeTag.bind(this),
      
      // === VIEW CONFIGURATION ===
      setViewMode: this.setViewMode.bind(this),
      getViewMode: () => this.model.getState('viewMode'),
      
      // === IMPORT/EXPORT ===
      importPlan: this.importPlan.bind(this),
      exportPlan: this.exportPlan.bind(this),
      exportPlans: this.exportPlans.bind(this),
      isImportInProgress: () => this.model.getState('importInProgress'),
      isExportInProgress: () => this.model.getState('exportInProgress'),
      
      // === METADATA ===
      getPlanMetadata: (planId) => this.model.getState('planMetadata')[planId] || {},
      setPlanMetadata: this.setPlanMetadata.bind(this)
    };
  }

  /**
   * Component-specific validation for PlanLibraryPanel
   */
  getComponentSpecificValidationErrors() {
    const errors = [];
    
    // Check if plans array is valid
    const plans = this.model.getState('plans');
    if (!Array.isArray(plans)) {
      errors.push('Plans must be an array');
    }
    
    // Check if sort configuration is valid
    const sortBy = this.model.getState('sortBy');
    const validSortFields = ['createdAt', 'updatedAt', 'name', 'complexity'];
    if (!validSortFields.includes(sortBy)) {
      errors.push(`Invalid sort field: ${sortBy}`);
    }
    
    const sortOrder = this.model.getState('sortOrder');
    if (!['asc', 'desc'].includes(sortOrder)) {
      errors.push(`Invalid sort order: ${sortOrder}`);
    }
    
    // Check if filter configuration is valid
    const filterBy = this.model.getState('filterBy');
    const validFilters = ['all', 'templates', 'drafts', 'completed'];
    if (!validFilters.includes(filterBy)) {
      errors.push(`Invalid filter: ${filterBy}`);
    }
    
    // Check if view mode is valid
    const viewMode = this.model.getState('viewMode');
    const validViewModes = ['grid', 'list', 'table'];
    if (!validViewModes.includes(viewMode)) {
      errors.push(`Invalid view mode: ${viewMode}`);
    }
    
    return errors;
  }

  onModelChange(changes) {
    if ('plans' in changes || 'searchQuery' in changes || 'filterBy' in changes || 
        'sortBy' in changes || 'sortOrder' in changes || 'selectedTags' in changes) {
      const filteredPlans = this.model.getFilteredPlans();
      this.view.updatePlansDisplay(filteredPlans, this.model.getState('viewMode'));
    }
    
    if ('tags' in changes || 'selectedTags' in changes) {
      this.view.updateAvailableTags(
        this.model.getState('tags'),
        this.model.getState('selectedTags')
      );
    }
    
    if ('viewMode' in changes) {
      const filteredPlans = this.model.getFilteredPlans();
      this.view.updatePlansDisplay(filteredPlans, changes.viewMode);
    }
  }

  async loadPlans() {
    if (this.umbilical.planningActor) {
      try {
        const plans = await this.umbilical.planningActor.getPlans();
        this.model.updateState('plans', plans || []);
      } catch (error) {
        console.error('Failed to load plans:', error);
      }
    } else {
      // Mock data for testing
      const mockPlans = this.generateMockPlans();
      this.model.updateState('plans', mockPlans);
    }
  }

  generateMockPlans() {
    return [
      {
        id: 'plan-1',
        name: 'Build REST API',
        description: 'Create a REST API service with authentication and CRUD operations',
        status: 'completed',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['backend', 'api', 'nodejs'],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build REST API',
            complexity: 'COMPLEX',
            children: [
              { id: 'setup', description: 'Setup project', complexity: 'SIMPLE', children: [] },
              { id: 'auth', description: 'Implement authentication', complexity: 'SIMPLE', children: [] },
              { id: 'crud', description: 'Create CRUD endpoints', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      },
      {
        id: 'plan-2',
        name: 'Frontend Dashboard',
        description: 'Build responsive dashboard with charts and data visualization',
        status: 'draft',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        tags: ['frontend', 'react', 'dashboard'],
        isTemplate: true,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build Dashboard',
            complexity: 'COMPLEX',
            children: [
              { id: 'layout', description: 'Create layout', complexity: 'SIMPLE', children: [] },
              { id: 'charts', description: 'Add charts', complexity: 'SIMPLE', children: [] }
            ]
          }
        }
      }
    ];
  }

  async savePlan(plan) {
    if (this.umbilical.planningActor) {
      try {
        const savedPlan = await this.umbilical.planningActor.savePlan(plan);
        
        const existingIndex = this.model.getState('plans').findIndex(p => p.id === plan.id);
        if (existingIndex >= 0) {
          this.model.updatePlan(plan.id, savedPlan);
        } else {
          this.model.addPlan(savedPlan);
        }
        
        return savedPlan;
      } catch (error) {
        console.error('Failed to save plan:', error);
        throw error;
      }
    }
  }

  async deletePlan(planId) {
    if (this.umbilical.planningActor) {
      try {
        await this.umbilical.planningActor.deletePlan(planId);
        this.model.removePlan(planId);
      } catch (error) {
        console.error('Failed to delete plan:', error);
        throw error;
      }
    } else {
      this.model.removePlan(planId);
    }
  }

  async duplicatePlan(planId) {
    const originalPlan = this.model.getState('plans').find(p => p.id === planId);
    if (!originalPlan) return;
    
    const duplicatedPlan = {
      ...originalPlan,
      id: `${originalPlan.id}-copy-${Date.now()}`,
      name: `${originalPlan.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft'
    };
    
    await this.savePlan(duplicatedPlan);
  }

  async importPlan(planData, source = 'file') {
    try {
      let plan;
      
      if (typeof planData === 'string') {
        if (source === 'url') {
          const response = await fetch(planData);
          plan = await response.json();
        } else {
          plan = JSON.parse(planData);
        }
      } else {
        plan = planData;
      }
      
      // Validate plan structure
      if (!plan.name) {
        throw new Error('Plan must have a name');
      }
      
      // Ensure unique ID
      plan.id = plan.id || `imported-${Date.now()}`;
      plan.createdAt = plan.createdAt || new Date().toISOString();
      plan.updatedAt = new Date().toISOString();
      plan.status = plan.status || 'draft';
      
      await this.savePlan(plan);
      
      if (this.umbilical.onPlanImported) {
        this.umbilical.onPlanImported(plan);
      }
      
      return plan;
    } catch (error) {
      console.error('Failed to import plan:', error);
      throw error;
    }
  }

  exportPlan(planId) {
    const plan = this.model.getState('plans').find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');
    
    const exportData = {
      ...plan,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${plan.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  // UI interaction methods
  createNewPlan() {
    if (this.umbilical.onCreateNewPlan) {
      this.umbilical.onCreateNewPlan();
    }
  }

  quickLoadPlan(planId) {
    const plan = this.model.getState('plans').find(p => p.id === planId);
    if (plan && this.umbilical.onPlanLoad) {
      this.umbilical.onPlanLoad(plan);
    }
  }

  showPlanDetails(planId) {
    const plan = this.model.getState('plans').find(p => p.id === planId);
    if (plan) {
      this.model.updateState('selectedPlan', plan);
      this.view.showPlanDetailsModal(plan);
    }
  }

  selectPlan(planId) {
    const plan = this.model.getState('plans').find(p => p.id === planId);
    this.model.updateState('selectedPlan', plan);
  }

  loadSelectedPlan() {
    const selectedPlan = this.model.getState('selectedPlan');
    if (selectedPlan && this.umbilical.onPlanLoad) {
      this.umbilical.onPlanLoad(selectedPlan);
      this.view.hideAllModals();
    }
  }

  duplicateSelectedPlan() {
    const selectedPlan = this.model.getState('selectedPlan');
    if (selectedPlan) {
      this.duplicatePlan(selectedPlan.id);
      this.view.hideAllModals();
    }
  }

  editSelectedPlan() {
    const selectedPlan = this.model.getState('selectedPlan');
    if (selectedPlan && this.umbilical.onPlanEdit) {
      this.umbilical.onPlanEdit(selectedPlan);
      this.view.hideAllModals();
    }
  }

  deleteSelectedPlan() {
    const selectedPlan = this.model.getState('selectedPlan');
    if (selectedPlan && confirm(`Are you sure you want to delete "${selectedPlan.name}"?`)) {
      this.deletePlan(selectedPlan.id);
      this.view.hideAllModals();
    }
  }

  exportSelectedPlan() {
    const selectedPlan = this.model.getState('selectedPlan');
    if (selectedPlan) {
      this.exportPlan(selectedPlan.id);
    }
  }

  confirmImport() {
    const method = this.view.container.querySelector('input[name="import-method"]:checked').value;
    let importData;
    
    switch (method) {
      case 'file':
        const file = this.view.container.querySelector('.file-input').files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            try {
              await this.importPlan(e.target.result, 'file');
              this.view.hideImportModal();
            } catch (error) {
              this.view.showImportError(`Import failed: ${error.message}`);
            }
          };
          reader.readAsText(file);
        }
        break;
      case 'url':
        importData = this.view.container.querySelector('.url-input').value;
        this.importPlan(importData, 'url').then(() => {
          this.view.hideImportModal();
        }).catch(error => {
          this.view.showImportError(`Import failed: ${error.message}`);
        });
        break;
      case 'text':
        importData = this.view.container.querySelector('.json-input').value;
        this.importPlan(importData, 'text').then(() => {
          this.view.hideImportModal();
        }).catch(error => {
          this.view.showImportError(`Import failed: ${error.message}`);
        });
        break;
    }
  }

  // Search and filter methods
  setSearchQuery(query) {
    this.model.updateState('searchQuery', query);
  }

  setFilter(filter) {
    this.model.updateState('filterBy', filter);
  }

  setSorting(sortBy, sortOrder) {
    this.model.updateState('sortBy', sortBy);
    this.model.updateState('sortOrder', sortOrder);
  }

  setViewMode(viewMode) {
    this.model.updateState('viewMode', viewMode);
  }

  addTagFilter(tag) {
    const selectedTags = this.model.getState('selectedTags');
    if (!selectedTags.includes(tag)) {
      selectedTags.push(tag);
      this.model.updateState('selectedTags', [...selectedTags]);
    }
  }

  removeTagFilter(tag) {
    const selectedTags = this.model.getState('selectedTags');
    const filtered = selectedTags.filter(t => t !== tag);
    this.model.updateState('selectedTags', filtered);
  }

  setCurrentPlan(plan) {
    this.model.updateState('currentPlan', plan);
  }

  searchPlans(query) {
    this.setSearchQuery(query);
    return this.model.getFilteredPlans();
  }

  // Additional methods for standardized API

  setSelectedPlan(plan) {
    this.model.updateState('selectedPlan', plan);
  }

  setFilterBy(filter) {
    this.model.updateState('filterBy', filter);
  }

  setSortBy(sortBy) {
    this.model.updateState('sortBy', sortBy);
  }

  setSortOrder(order) {
    this.model.updateState('sortOrder', order);
  }

  setSelectedTags(tags) {
    this.model.updateState('selectedTags', Array.isArray(tags) ? [...tags] : []);
  }

  addTag(tag) {
    this.addTagFilter(tag);
  }

  removeTag(tag) {
    this.removeTagFilter(tag);
  }

  exportPlans(planIds = null) {
    const plans = planIds 
      ? this.model.getState('plans').filter(p => planIds.includes(p.id))
      : this.model.getState('plans');
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      plans: plans
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.download = `plans-export-${new Date().toISOString().split('T')[0]}.json`;
    link.href = url;
    link.click();
    
    URL.revokeObjectURL(url);
    return exportData;
  }

  setPlanMetadata(planId, metadata) {
    const currentMetadata = this.model.getState('planMetadata');
    const updatedMetadata = {
      ...currentMetadata,
      [planId]: { ...currentMetadata[planId], ...metadata }
    };
    this.model.updateState('planMetadata', updatedMetadata);
  }

  destroy() {
    if (this.umbilical.onDestroy) {
      this.umbilical.onDestroy();
    }
    this.view.container.innerHTML = '';
  }
}

/**
 * PlanLibraryPanel - Main component class
 */
export class PlanLibraryPanel {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'PlanLibraryPanel');
    
    // Create MVVM components
    const model = new PlanLibraryModel();
    const view = new PlanLibraryView(umbilical.dom, null);
    const viewModel = new PlanLibraryViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    // Return component with standardized API
    return {
      api: {
        // Standardized lifecycle methods
        isReady: () => true,
        getState: (key) => key ? model.getState(key) : model.getState(),
        setState: (key, value) => model.updateState(key, value),
        reset: () => {
          model.updateState('plans', []);
          model.updateState('selectedPlan', null);
          model.updateState('searchQuery', '');
        },
        destroy: () => {
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
          const plans = model.getState('plans');
          if (!Array.isArray(plans)) {
            errors.push('Invalid plans data structure');
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
        ...viewModel.getComponentSpecificMethods()
      },
      
      // Internal references for advanced usage
      model,
      viewModel,
      view
    };
  }
}