/**
 * ArtifactInspector Component
 * Displays and manages execution artifacts with context tracking
 */

import { UmbilicalUtils } from '/legion/frontend-components/src/umbilical/index.js';
import { StandardizedComponentAPI } from '../../base/StandardizedComponentAPI.js';
import { APIResponse } from '../../interfaces/ComponentAPI.js';

/**
 * Model - Manages artifact state and context
 */
class ArtifactInspectorModel {
  constructor() {
    this.state = {
      artifacts: [],
      selectedArtifact: null,
      viewMode: 'list', // list, grid, details
      filterType: 'all',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      searchQuery: '',
      context: {
        executionId: null,
        taskId: null,
        planId: null,
        timestamp: null
      },
      artifactTypes: ['file', 'image', 'data', 'log', 'output', 'report'],
      totalSize: 0
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

  addArtifact(artifact) {
    // Add context if not present
    if (!artifact.context && this.state.context.executionId) {
      artifact.context = { ...this.state.context };
    }

    // Add timestamp if not present
    if (!artifact.createdAt) {
      artifact.createdAt = new Date().toISOString();
    }

    this.state.artifacts.push(artifact);
    this.updateTotalSize();
    this.notifyListeners({ artifacts: this.state.artifacts });
  }

  updateArtifact(artifactId, updates) {
    const artifactIndex = this.state.artifacts.findIndex(a => a.id === artifactId);
    if (artifactIndex >= 0) {
      this.state.artifacts[artifactIndex] = {
        ...this.state.artifacts[artifactIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      this.updateTotalSize();
      this.notifyListeners({ artifacts: this.state.artifacts });
      return true;
    }
    return false;
  }

  removeArtifact(artifactId) {
    const originalLength = this.state.artifacts.length;
    this.state.artifacts = this.state.artifacts.filter(a => a.id !== artifactId);
    
    if (this.state.selectedArtifact?.id === artifactId) {
      this.state.selectedArtifact = null;
      this.notifyListeners({ selectedArtifact: null });
    }

    this.updateTotalSize();
    this.notifyListeners({ artifacts: this.state.artifacts });
    return this.state.artifacts.length < originalLength;
  }

  setFilterType(filterType) {
    this.state.filterType = filterType;
    this.notifyListeners({ filterType, filteredArtifacts: this.getFilteredArtifacts() });
  }

  getFilteredArtifacts() {
    let filtered = this.state.artifacts;

    // Filter by type
    if (this.state.filterType !== 'all') {
      filtered = filtered.filter(artifact => artifact.type === this.state.filterType);
    }

    // Filter by search query
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(artifact => 
        artifact.name.toLowerCase().includes(query) ||
        (artifact.description && artifact.description.toLowerCase().includes(query))
      );
    }

    // Sort artifacts
    filtered.sort((a, b) => {
      const aValue = a[this.state.sortBy];
      const bValue = b[this.state.sortBy];
      
      let comparison = 0;
      if (aValue < bValue) comparison = -1;
      if (aValue > bValue) comparison = 1;
      
      return this.state.sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }

  getArtifactsByContext(executionId, taskId = null) {
    return this.state.artifacts.filter(artifact => {
      if (!artifact.context) return false;
      
      const matchesExecution = artifact.context.executionId === executionId;
      const matchesTask = !taskId || artifact.context.taskId === taskId;
      
      return matchesExecution && matchesTask;
    });
  }

  setContext(context) {
    this.state.context = { ...this.state.context, ...context };
    this.notifyListeners({ context: this.state.context });
  }

  updateTotalSize() {
    this.state.totalSize = this.state.artifacts.reduce((total, artifact) => {
      return total + (artifact.size || 0);
    }, 0);
  }

  reset() {
    this.state = {
      artifacts: [],
      selectedArtifact: null,
      viewMode: 'list',
      filterType: 'all',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      searchQuery: '',
      context: {
        executionId: null,
        taskId: null,
        planId: null,
        timestamp: null
      },
      artifactTypes: ['file', 'image', 'data', 'log', 'output', 'report'],
      totalSize: 0
    };
    this.notifyListeners(this.state);
  }
}

/**
 * View - Renders artifact display and handles DOM updates
 */
class ArtifactInspectorView {
  constructor(container, viewModel) {
    this.container = container;
    this.viewModel = viewModel;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="artifact-inspector-panel">
        <!-- Header with Controls -->
        <div class="inspector-header">
          <h3>Artifact Inspector</h3>
          <div class="inspector-controls">
            <div class="view-controls">
              <button class="view-mode-button active" data-mode="list">📋 List</button>
              <button class="view-mode-button" data-mode="grid">⊞ Grid</button>
              <button class="view-mode-button" data-mode="details">📄 Details</button>
            </div>
            <div class="filter-controls">
              <select class="artifact-type-filter">
                <option value="all">All Types</option>
                <option value="file">Files</option>
                <option value="image">Images</option>
                <option value="data">Data</option>
                <option value="log">Logs</option>
                <option value="output">Output</option>
                <option value="report">Reports</option>
              </select>
              <input type="text" class="search-artifacts" placeholder="Search artifacts...">
            </div>
            <div class="action-controls">
              <button class="export-artifacts-button">📤 Export</button>
              <button class="clear-artifacts-button">🗑️ Clear</button>
            </div>
          </div>
        </div>

        <!-- Context Information -->
        <div class="context-info">
          <div class="context-item">
            <span class="context-label">Execution:</span>
            <span class="context-value execution-id">--</span>
          </div>
          <div class="context-item">
            <span class="context-label">Task:</span>
            <span class="context-value task-id">--</span>
          </div>
          <div class="context-item">
            <span class="context-label">Total Size:</span>
            <span class="context-value total-size">0 B</span>
          </div>
          <div class="context-item">
            <span class="context-label">Count:</span>
            <span class="context-value artifact-count">0</span>
          </div>
        </div>

        <!-- Artifact Views -->
        <div class="artifact-views">
          <!-- List View -->
          <div class="artifacts-list view-panel active">
            <div class="list-header">
              <div class="column-header name-column">Name</div>
              <div class="column-header type-column">Type</div>
              <div class="column-header size-column">Size</div>
              <div class="column-header date-column">Created</div>
              <div class="column-header actions-column">Actions</div>
            </div>
            <div class="artifact-list-items"></div>
          </div>

          <!-- Grid View -->
          <div class="artifacts-grid view-panel">
            <div class="artifact-grid-items"></div>
          </div>

          <!-- Details View -->
          <div class="artifact-details view-panel">
            <div class="artifact-preview"></div>
            <div class="artifact-metadata"></div>
          </div>
        </div>

        <!-- Empty State -->
        <div class="empty-state" style="display: none;">
          <div class="empty-icon">📁</div>
          <div class="empty-message">No artifacts found</div>
          <div class="empty-hint">Artifacts will appear here during execution</div>
        </div>
      </div>
    `;
    
    this.bindEvents();
  }

  bindEvents() {
    // View mode switching
    const viewModeButtons = this.container.querySelectorAll('.view-mode-button');
    viewModeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const mode = e.target.dataset.mode;
        this.setViewMode(mode);
        this.viewModel.setViewMode(mode);
      });
    });

    // Filter controls
    const typeFilter = this.container.querySelector('.artifact-type-filter');
    typeFilter.addEventListener('change', (e) => {
      this.viewModel.setFilterType(e.target.value);
    });

    const searchInput = this.container.querySelector('.search-artifacts');
    searchInput.addEventListener('input', (e) => {
      this.viewModel.setSearchQuery(e.target.value);
    });

    // Action buttons
    const exportButton = this.container.querySelector('.export-artifacts-button');
    exportButton.addEventListener('click', () => {
      this.viewModel.exportArtifacts();
    });

    const clearButton = this.container.querySelector('.clear-artifacts-button');
    clearButton.addEventListener('click', () => {
      if (confirm('Clear all artifacts? This action cannot be undone.')) {
        this.viewModel.clearArtifacts();
      }
    });
  }

  setViewMode(mode) {
    // Update button states
    const buttons = this.container.querySelectorAll('.view-mode-button');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Show/hide view panels
    const panels = this.container.querySelectorAll('.view-panel');
    panels.forEach(panel => {
      const isActive = panel.classList.contains(`artifacts-${mode}`);
      panel.classList.toggle('active', isActive);
      panel.style.display = isActive ? 'block' : 'none';
    });
  }

  updateArtifactList(artifacts) {
    const listContainer = this.container.querySelector('.artifact-list-items');
    const gridContainer = this.container.querySelector('.artifact-grid-items');

    if (artifacts.length === 0) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();

    // Update list view
    listContainer.innerHTML = artifacts.map(artifact => `
      <div class="artifact-item" data-id="${artifact.id}">
        <div class="artifact-name">
          <span class="artifact-icon">${this.getArtifactIcon(artifact.type)}</span>
          <span class="name-text">${artifact.name}</span>
        </div>
        <div class="artifact-type">${artifact.type}</div>
        <div class="artifact-size">${this.formatFileSize(artifact.size || 0)}</div>
        <div class="artifact-date">${this.formatDate(artifact.createdAt)}</div>
        <div class="artifact-actions">
          <button class="view-artifact-button" data-id="${artifact.id}">👁️</button>
          <button class="download-artifact-button" data-id="${artifact.id}">⬇️</button>
          <button class="delete-artifact-button" data-id="${artifact.id}">🗑️</button>
        </div>
      </div>
    `).join('');

    // Update grid view
    gridContainer.innerHTML = artifacts.map(artifact => `
      <div class="artifact-card" data-id="${artifact.id}">
        <div class="card-preview">
          ${this.renderArtifactPreview(artifact)}
        </div>
        <div class="card-info">
          <div class="card-name">${artifact.name}</div>
          <div class="card-meta">
            <span class="card-type">${artifact.type}</span>
            <span class="card-size">${this.formatFileSize(artifact.size || 0)}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="view-artifact-button" data-id="${artifact.id}">View</button>
          <button class="download-artifact-button" data-id="${artifact.id}">Download</button>
        </div>
      </div>
    `).join('');

    // Bind artifact action events
    this.bindArtifactEvents();
  }

  bindArtifactEvents() {
    // View artifact buttons
    const viewButtons = this.container.querySelectorAll('.view-artifact-button');
    viewButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const artifactId = e.target.dataset.id;
        this.viewModel.selectArtifact(artifactId);
      });
    });

    // Download artifact buttons
    const downloadButtons = this.container.querySelectorAll('.download-artifact-button');
    downloadButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const artifactId = e.target.dataset.id;
        this.viewModel.downloadArtifact(artifactId);
      });
    });

    // Delete artifact buttons
    const deleteButtons = this.container.querySelectorAll('.delete-artifact-button');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const artifactId = e.target.dataset.id;
        if (confirm('Delete this artifact?')) {
          this.viewModel.removeArtifact(artifactId);
        }
      });
    });
  }

  showArtifactDetails(artifact) {
    const detailsPanel = this.container.querySelector('.artifact-details');
    const previewContainer = detailsPanel.querySelector('.artifact-preview');
    const metadataContainer = detailsPanel.querySelector('.artifact-metadata');

    // Update preview
    previewContainer.innerHTML = this.renderArtifactPreview(artifact, true);

    // Update metadata
    metadataContainer.innerHTML = `
      <div class="metadata-section">
        <h4>Basic Information</h4>
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="metadata-label">Name:</span>
            <span class="metadata-value">${artifact.name}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Type:</span>
            <span class="metadata-value">${artifact.type}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Size:</span>
            <span class="metadata-value">${this.formatFileSize(artifact.size || 0)}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Created:</span>
            <span class="metadata-value">${this.formatDate(artifact.createdAt)}</span>
          </div>
          ${artifact.updatedAt ? `
          <div class="metadata-item">
            <span class="metadata-label">Modified:</span>
            <span class="metadata-value">${this.formatDate(artifact.updatedAt)}</span>
          </div>
          ` : ''}
        </div>
      </div>

      ${artifact.context ? `
      <div class="metadata-section">
        <h4>Context</h4>
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="metadata-label">Execution ID:</span>
            <span class="metadata-value">${artifact.context.executionId || '--'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Task ID:</span>
            <span class="metadata-value">${artifact.context.taskId || '--'}</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Plan ID:</span>
            <span class="metadata-value">${artifact.context.planId || '--'}</span>
          </div>
        </div>
      </div>
      ` : ''}

      ${artifact.description ? `
      <div class="metadata-section">
        <h4>Description</h4>
        <div class="metadata-description">${artifact.description}</div>
      </div>
      ` : ''}
    `;

    // Switch to details view
    this.setViewMode('details');
  }

  renderArtifactPreview(artifact, detailed = false) {
    const iconSize = detailed ? '64px' : '32px';
    
    if (artifact.type === 'image' && artifact.url) {
      return `<img src="${artifact.url}" alt="${artifact.name}" style="max-width: ${detailed ? '100%' : iconSize}; max-height: ${detailed ? '300px' : iconSize};">`;
    }
    
    if (artifact.type === 'file' && artifact.content && detailed) {
      return `
        <div class="file-preview">
          <div class="file-content">
            <pre>${artifact.content.substring(0, 1000)}${artifact.content.length > 1000 ? '...' : ''}</pre>
          </div>
        </div>
      `;
    }

    return `<div class="artifact-icon-large" style="font-size: ${iconSize};">${this.getArtifactIcon(artifact.type)}</div>`;
  }

  getArtifactIcon(type) {
    const icons = {
      file: '📄',
      image: '🖼️',
      data: '📊',
      log: '📋',
      output: '📤',
      report: '📑'
    };
    return icons[type] || '📄';
  }

  updateContextDisplay(context) {
    this.container.querySelector('.execution-id').textContent = context.executionId || '--';
    this.container.querySelector('.task-id').textContent = context.taskId || '--';
  }

  updateStats(totalSize, artifactCount) {
    this.container.querySelector('.total-size').textContent = this.formatFileSize(totalSize);
    this.container.querySelector('.artifact-count').textContent = artifactCount.toString();
  }

  showEmptyState() {
    this.container.querySelector('.empty-state').style.display = 'flex';
    this.container.querySelector('.artifact-views').style.display = 'none';
  }

  hideEmptyState() {
    this.container.querySelector('.empty-state').style.display = 'none';
    this.container.querySelector('.artifact-views').style.display = 'block';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateString) {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleString();
  }
}

/**
 * ViewModel - Manages business logic and coordinates Model/View
 */
class ArtifactInspectorViewModel extends StandardizedComponentAPI {
  constructor(model, view, umbilical) {
    super(model, view, umbilical, 'ArtifactInspector');
    
    this.view = view;
    
    // Listen to model changes
    this.model.addListener(this.onModelChange.bind(this));
  }

  getComponentSpecificMethods() {
    return {
      // === ARTIFACT MANAGEMENT ===
      addArtifact: this.addArtifact.bind(this),
      updateArtifact: this.updateArtifact.bind(this),
      removeArtifact: this.removeArtifact.bind(this),
      clearArtifacts: this.clearArtifacts.bind(this),
      getArtifacts: () => this.model.getState('artifacts'),
      getFilteredArtifacts: () => this.model.getFilteredArtifacts(),
      
      // === ARTIFACT SELECTION ===
      selectArtifact: this.selectArtifact.bind(this),
      getSelectedArtifact: () => this.model.getState('selectedArtifact'),
      
      // === FILTERING AND SEARCHING ===
      setFilterType: this.setFilterType.bind(this),
      getFilterType: () => this.model.getState('filterType'),
      setSearchQuery: this.setSearchQuery.bind(this),
      getSearchQuery: () => this.model.getState('searchQuery'),
      
      // === VIEW MANAGEMENT ===
      setViewMode: this.setViewMode.bind(this),
      getViewMode: () => this.model.getState('viewMode'),
      
      // === CONTEXT MANAGEMENT ===
      setContext: this.setContext.bind(this),
      getContext: () => this.model.getState('context'),
      getArtifactsByContext: this.getArtifactsByContext.bind(this),
      
      // === IMPORT/EXPORT ===
      downloadArtifact: this.downloadArtifact.bind(this),
      exportArtifacts: this.exportArtifacts.bind(this)
    };
  }

  getComponentSpecificValidationErrors() {
    const errors = [];
    
    const artifacts = this.model.getState('artifacts');
    if (artifacts.some(artifact => !artifact.id || !artifact.name)) {
      errors.push('Some artifacts have missing required fields');
    }
    
    return errors;
  }

  onModelChange(changes) {
    if ('artifacts' in changes || 'filterType' in changes || 'searchQuery' in changes) {
      const filteredArtifacts = this.model.getFilteredArtifacts();
      this.view.updateArtifactList(filteredArtifacts);
      this.view.updateStats(this.model.getState('totalSize'), filteredArtifacts.length);
    }
    
    if ('selectedArtifact' in changes && changes.selectedArtifact) {
      this.view.showArtifactDetails(changes.selectedArtifact);
    }
    
    if ('context' in changes) {
      this.view.updateContextDisplay(changes.context);
    }
    
    if ('viewMode' in changes) {
      this.view.setViewMode(changes.viewMode);
    }
  }

  addArtifact(artifact) {
    if (!artifact.id || !artifact.name) {
      return APIResponse.error('Invalid artifact: missing required fields (id, name)');
    }

    // Check for duplicates
    const existing = this.model.getState('artifacts').find(a => a.id === artifact.id);
    if (existing) {
      return APIResponse.error(`Artifact with id ${artifact.id} already exists`);
    }

    this.model.addArtifact(artifact);
    
    if (this.umbilical.onArtifactUpdate) {
      this.umbilical.onArtifactUpdate({ action: 'add', artifact });
    }
    
    return APIResponse.success(artifact);
  }

  updateArtifact(artifactId, updates) {
    const success = this.model.updateArtifact(artifactId, updates);
    
    if (!success) {
      return APIResponse.error(`Artifact ${artifactId} not found`);
    }
    
    if (this.umbilical.onArtifactUpdate) {
      this.umbilical.onArtifactUpdate({ action: 'update', artifactId, updates });
    }
    
    return APIResponse.success({ artifactId, updates });
  }

  removeArtifact(artifactId) {
    const success = this.model.removeArtifact(artifactId);
    
    if (!success) {
      return APIResponse.error(`Artifact ${artifactId} not found`);
    }
    
    if (this.umbilical.onArtifactUpdate) {
      this.umbilical.onArtifactUpdate({ action: 'remove', artifactId });
    }
    
    return APIResponse.success({ artifactId });
  }

  clearArtifacts() {
    this.model.updateState('artifacts', []);
    this.model.updateState('selectedArtifact', null);
    this.model.updateState('totalSize', 0);
    
    if (this.umbilical.onArtifactUpdate) {
      this.umbilical.onArtifactUpdate({ action: 'clear' });
    }
    
    return APIResponse.success({ message: 'All artifacts cleared' });
  }

  selectArtifact(artifactId) {
    const artifact = this.model.getState('artifacts').find(a => a.id === artifactId);
    
    if (!artifact) {
      return APIResponse.error(`Artifact ${artifactId} not found`);
    }
    
    this.model.updateState('selectedArtifact', artifact);
    
    if (this.umbilical.onArtifactSelect) {
      this.umbilical.onArtifactSelect(artifact);
    }
    
    return APIResponse.success(artifact);
  }

  setFilterType(filterType) {
    this.model.setFilterType(filterType);
    return APIResponse.success({ filterType });
  }

  setSearchQuery(query) {
    this.model.updateState('searchQuery', query);
    return APIResponse.success({ searchQuery: query });
  }

  setViewMode(mode) {
    const validModes = ['list', 'grid', 'details'];
    if (!validModes.includes(mode)) {
      return APIResponse.error(`Invalid view mode: ${mode}`);
    }
    
    this.model.updateState('viewMode', mode);
    return APIResponse.success({ viewMode: mode });
  }

  setContext(context) {
    this.model.setContext(context);
    return APIResponse.success(context);
  }

  getArtifactsByContext(executionId, taskId = null) {
    const artifacts = this.model.getArtifactsByContext(executionId, taskId);
    return APIResponse.success(artifacts);
  }

  downloadArtifact(artifactId) {
    const artifact = this.model.getState('artifacts').find(a => a.id === artifactId);
    
    if (!artifact) {
      return APIResponse.error(`Artifact ${artifactId} not found`);
    }

    try {
      let content = '';
      let mimeType = 'text/plain';

      if (artifact.content) {
        content = artifact.content;
      } else if (artifact.url) {
        // For artifacts with URLs, we'd normally fetch the content
        // For now, just indicate it's a reference
        content = `Artifact reference: ${artifact.url}`;
      } else {
        content = `Artifact: ${artifact.name}\nType: ${artifact.type}\nSize: ${artifact.size || 0} bytes`;
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = artifact.name;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      return APIResponse.success({ artifactId, downloaded: true });
    } catch (error) {
      return APIResponse.error(`Failed to download artifact: ${error.message}`);
    }
  }

  exportArtifacts() {
    try {
      const artifacts = this.model.getState('artifacts');
      const exportData = {
        artifacts: artifacts.map(artifact => ({
          ...artifact,
          // Remove large content for metadata export
          content: artifact.content ? `[Content: ${artifact.content.length} characters]` : undefined
        })),
        context: this.model.getState('context'),
        exportedAt: new Date().toISOString(),
        totalSize: this.model.getState('totalSize'),
        artifactCount: artifacts.length
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `artifacts-export-${Date.now()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      return APIResponse.success({ exported: artifacts.length });
    } catch (error) {
      return APIResponse.error(`Failed to export artifacts: ${error.message}`);
    }
  }
}

/**
 * ArtifactInspector - Main component class
 */
export class ArtifactInspector {
  static async create(umbilical) {
    // Validate umbilical
    UmbilicalUtils.validateCapabilities(umbilical, ['dom'], 'ArtifactInspector');
    
    // Create MVVM components
    const model = new ArtifactInspectorModel();
    const view = new ArtifactInspectorView(umbilical.dom, null);
    const viewModel = new ArtifactInspectorViewModel(model, view, umbilical);
    
    // Set view's reference to viewModel
    view.viewModel = viewModel;
    
    return viewModel;
  }
}