/**
 * VariablesPanelView - View for variables panel component
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';

export class VariablesPanelView extends ExtendedBaseView {
  constructor(parentElement) {
    super(parentElement);
    
    this.parentElement = parentElement; // Store reference for compatibility
    this.onVariableClick = null;
    this.onVariableRightClick = null;
    this.onSearchInput = null;
    this.onSearchClear = null;
    this.onNewVariable = null;
    this.onCreateVariable = null;
    this.onUpdateVariable = null;
    this.onImportVariables = null;
    this.onExportVariables = null;
    
    this.currentVariables = [];
    this.maxValueLength = 100; // Truncate long values
  }

  /**
   * Render the variables panel
   * @param {Object} options - Render options
   */
  render(options = {}) {
    this.variablesPanel = this.createElement('div', ['variables-panel']);
    
    // Apply theme if provided
    if (options.theme) {
      this.variablesPanel.classList.add(`variables-panel-theme-${options.theme}`);
    }
    
    // Header
    this.renderHeader();
    
    // Search
    this.renderSearch();
    
    // Actions
    this.renderActions();
    
    // Variables list
    this.renderVariablesList();
    
    // Dialogs
    this.renderDialogs();
    
    // Add to parent
    this.parentElement.appendChild(this.variablesPanel);
    
    // Bind events
    this.bindEvents();
  }

  /**
   * Render header section
   */
  renderHeader() {
    this.header = this.createElement('div', ['variables-header']);
    
    const title = this.createElement('h3', ['variables-title']);
    title.textContent = 'Variables';
    
    this.header.appendChild(title);
    this.variablesPanel.appendChild(this.header);
  }

  /**
   * Render search section
   */
  renderSearch() {
    this.searchContainer = this.createElement('div', ['variables-search']);
    
    this.searchInput = this.createElement('input', [], {
      type: 'text',
      placeholder: 'Search variables...'
    });
    
    this.clearButton = this.createElement('button', ['search-clear'], {
      type: 'button',
      'aria-label': 'Clear search'
    });
    this.clearButton.textContent = '✕';
    this.clearButton.style.display = 'none';
    
    this.searchContainer.appendChild(this.searchInput);
    this.searchContainer.appendChild(this.clearButton);
    this.variablesPanel.appendChild(this.searchContainer);
    
    // Search results count
    this.searchResults = this.createElement('div', ['search-results-count']);
    this.searchResults.style.display = 'none';
    this.variablesPanel.appendChild(this.searchResults);
  }

  /**
   * Render actions section
   */
  renderActions() {
    this.actionsContainer = this.createElement('div', ['variables-actions']);
    
    this.newVariableButton = this.createElement('button', ['new-variable-button']);
    this.newVariableButton.textContent = '+ New Variable';
    
    this.importVariablesButton = this.createElement('button', ['import-variables-button']);
    this.importVariablesButton.textContent = 'Import';
    
    this.exportVariablesButton = this.createElement('button', ['export-variables-button']);
    this.exportVariablesButton.textContent = 'Export';
    
    this.actionsContainer.appendChild(this.newVariableButton);
    this.actionsContainer.appendChild(this.importVariablesButton);
    this.actionsContainer.appendChild(this.exportVariablesButton);
    this.variablesPanel.appendChild(this.actionsContainer);
  }

  /**
   * Render variables list section
   */
  renderVariablesList() {
    this.variablesList = this.createElement('div', ['variables-list'], {
      tabindex: '0'
    });
    
    this.variablesPanel.appendChild(this.variablesList);
    
    // Initially show empty state
    this.showEmptyState();
  }

  /**
   * Render dialogs
   */
  renderDialogs() {
    this.renderNewVariableDialog();
    this.renderEditVariableDialog();
    this.renderImportVariablesDialog();
    this.renderContextMenu();
    this.renderDeleteConfirmation();
  }

  /**
   * Render new variable dialog
   */
  renderNewVariableDialog() {
    this.newVariableDialog = this.createElement('div', ['new-variable-dialog']);
    this.newVariableDialog.style.display = 'none';
    
    const dialogContent = this.createElement('div', ['dialog-content']);
    
    const title = this.createElement('h3', ['dialog-title']);
    title.textContent = 'Create New Variable';
    
    this.newVariableForm = this.createElement('form', ['new-variable-form']);
    
    // Name input
    const nameGroup = this.createElement('div', ['form-group']);
    const nameLabel = this.createElement('label');
    nameLabel.textContent = 'Variable Name';
    const nameInput = this.createElement('input', [], {
      type: 'text',
      name: 'name',
      required: 'true',
      placeholder: 'MY_VARIABLE'
    });
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    // Value input
    const valueGroup = this.createElement('div', ['form-group']);
    const valueLabel = this.createElement('label');
    valueLabel.textContent = 'Value';
    const valueInput = this.createElement('textarea', [], {
      name: 'value',
      required: 'true',
      rows: '3'
    });
    valueGroup.appendChild(valueLabel);
    valueGroup.appendChild(valueInput);
    
    // Type select
    const typeGroup = this.createElement('div', ['form-group']);
    const typeLabel = this.createElement('label');
    typeLabel.textContent = 'Type';
    const typeSelect = this.createElement('select', [], { name: 'type', required: 'true' });
    
    // Add default option
    const defaultOption = this.createElement('option', [], { value: '' });
    defaultOption.textContent = 'Select type...';
    typeSelect.appendChild(defaultOption);
    
    // Add type options
    ['string', 'boolean', 'number', 'object'].forEach(type => {
      const option = this.createElement('option', [], { value: type });
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      typeSelect.appendChild(option);
    });
    
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    
    // Scope select
    const scopeGroup = this.createElement('div', ['form-group']);
    const scopeLabel = this.createElement('label');
    scopeLabel.textContent = 'Scope';
    const scopeSelect = this.createElement('select', [], { name: 'scope' });
    
    // Add scope options
    ['global', 'session', 'local'].forEach(scope => {
      const option = this.createElement('option', [], { value: scope });
      option.textContent = scope.charAt(0).toUpperCase() + scope.slice(1);
      if (scope === 'local') {
        option.selected = true;
      }
      scopeSelect.appendChild(option);
    });
    
    scopeGroup.appendChild(scopeLabel);
    scopeGroup.appendChild(scopeSelect);
    
    // Description textarea
    const descGroup = this.createElement('div', ['form-group']);
    const descLabel = this.createElement('label');
    descLabel.textContent = 'Description (optional)';
    const descTextarea = this.createElement('textarea', [], {
      name: 'description',
      rows: '2'
    });
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descTextarea);
    
    // Buttons
    const buttonsGroup = this.createElement('div', ['form-buttons']);
    const cancelButton = this.createElement('button', ['cancel-button'], { type: 'button' });
    cancelButton.textContent = 'Cancel';
    const createButton = this.createElement('button', ['create-button'], { type: 'submit' });
    createButton.textContent = 'Create Variable';
    
    buttonsGroup.appendChild(cancelButton);
    buttonsGroup.appendChild(createButton);
    
    this.newVariableForm.appendChild(nameGroup);
    this.newVariableForm.appendChild(valueGroup);
    this.newVariableForm.appendChild(typeGroup);
    this.newVariableForm.appendChild(scopeGroup);
    this.newVariableForm.appendChild(descGroup);
    this.newVariableForm.appendChild(buttonsGroup);
    
    dialogContent.appendChild(title);
    dialogContent.appendChild(this.newVariableForm);
    this.newVariableDialog.appendChild(dialogContent);
    
    this.variablesPanel.appendChild(this.newVariableDialog);
  }

  /**
   * Render edit variable dialog
   */
  renderEditVariableDialog() {
    this.editVariableDialog = this.createElement('div', ['edit-variable-dialog']);
    this.editVariableDialog.style.display = 'none';
    
    const dialogContent = this.createElement('div', ['dialog-content']);
    
    const title = this.createElement('h3', ['dialog-title']);
    title.textContent = 'Edit Variable';
    
    this.editVariableForm = this.createElement('form', ['edit-variable-form']);
    
    // Same structure as new variable form but for editing
    const nameGroup = this.createElement('div', ['form-group']);
    const nameLabel = this.createElement('label');
    nameLabel.textContent = 'Variable Name';
    const nameInput = this.createElement('input', [], {
      type: 'text',
      name: 'name',
      required: 'true'
    });
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    
    const valueGroup = this.createElement('div', ['form-group']);
    const valueLabel = this.createElement('label');
    valueLabel.textContent = 'Value';
    const valueInput = this.createElement('textarea', [], {
      name: 'value',
      required: 'true',
      rows: '3'
    });
    valueGroup.appendChild(valueLabel);
    valueGroup.appendChild(valueInput);
    
    const typeGroup = this.createElement('div', ['form-group']);
    const typeLabel = this.createElement('label');
    typeLabel.textContent = 'Type';
    const typeSelect = this.createElement('select', [], { name: 'type' });
    
    ['string', 'boolean', 'number', 'object'].forEach(type => {
      const option = this.createElement('option', [], { value: type });
      option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      typeSelect.appendChild(option);
    });
    
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    
    const scopeGroup = this.createElement('div', ['form-group']);
    const scopeLabel = this.createElement('label');
    scopeLabel.textContent = 'Scope';
    const scopeSelect = this.createElement('select', [], { name: 'scope' });
    
    ['global', 'session', 'local'].forEach(scope => {
      const option = this.createElement('option', [], { value: scope });
      option.textContent = scope.charAt(0).toUpperCase() + scope.slice(1);
      scopeSelect.appendChild(option);
    });
    
    scopeGroup.appendChild(scopeLabel);
    scopeGroup.appendChild(scopeSelect);
    
    const descGroup = this.createElement('div', ['form-group']);
    const descLabel = this.createElement('label');
    descLabel.textContent = 'Description (optional)';
    const descTextarea = this.createElement('textarea', [], {
      name: 'description',
      rows: '2'
    });
    descGroup.appendChild(descLabel);
    descGroup.appendChild(descTextarea);
    
    const buttonsGroup = this.createElement('div', ['form-buttons']);
    const cancelButton = this.createElement('button', ['cancel-button'], { type: 'button' });
    cancelButton.textContent = 'Cancel';
    const updateButton = this.createElement('button', ['update-button'], { type: 'submit' });
    updateButton.textContent = 'Update Variable';
    
    buttonsGroup.appendChild(cancelButton);
    buttonsGroup.appendChild(updateButton);
    
    this.editVariableForm.appendChild(nameGroup);
    this.editVariableForm.appendChild(valueGroup);
    this.editVariableForm.appendChild(typeGroup);
    this.editVariableForm.appendChild(scopeGroup);
    this.editVariableForm.appendChild(descGroup);
    this.editVariableForm.appendChild(buttonsGroup);
    
    dialogContent.appendChild(title);
    dialogContent.appendChild(this.editVariableForm);
    this.editVariableDialog.appendChild(dialogContent);
    
    this.variablesPanel.appendChild(this.editVariableDialog);
  }

  /**
   * Render import variables dialog
   */
  renderImportVariablesDialog() {
    this.importVariablesDialog = this.createElement('div', ['import-variables-dialog']);
    this.importVariablesDialog.style.display = 'none';
    
    const dialogContent = this.createElement('div', ['dialog-content']);
    
    const title = this.createElement('h3', ['dialog-title']);
    title.textContent = 'Import Variables';
    
    this.importVariablesForm = this.createElement('form', ['import-variables-form']);
    
    const jsonGroup = this.createElement('div', ['form-group']);
    const jsonLabel = this.createElement('label');
    jsonLabel.textContent = 'Variables JSON';
    const jsonTextarea = this.createElement('textarea', [], {
      name: 'json',
      required: 'true',
      rows: '10',
      placeholder: 'Paste JSON array of variables here...'
    });
    jsonGroup.appendChild(jsonLabel);
    jsonGroup.appendChild(jsonTextarea);
    
    const buttonsGroup = this.createElement('div', ['form-buttons']);
    const cancelButton = this.createElement('button', ['cancel-button'], { type: 'button' });
    cancelButton.textContent = 'Cancel';
    const importButton = this.createElement('button', ['import-button'], { type: 'submit' });
    importButton.textContent = 'Import Variables';
    
    buttonsGroup.appendChild(cancelButton);
    buttonsGroup.appendChild(importButton);
    
    this.importVariablesForm.appendChild(jsonGroup);
    this.importVariablesForm.appendChild(buttonsGroup);
    
    dialogContent.appendChild(title);
    dialogContent.appendChild(this.importVariablesForm);
    this.importVariablesDialog.appendChild(dialogContent);
    
    this.variablesPanel.appendChild(this.importVariablesDialog);
  }

  /**
   * Render context menu
   */
  renderContextMenu() {
    this.contextMenu = this.createElement('div', ['variable-context-menu']);
    this.contextMenu.style.display = 'none';
    
    const editOption = this.createElement('div', ['context-option', 'edit-option']);
    editOption.textContent = 'Edit';
    
    const duplicateOption = this.createElement('div', ['context-option', 'duplicate-option']);
    duplicateOption.textContent = 'Duplicate';
    
    const copyOption = this.createElement('div', ['context-option', 'copy-option']);
    copyOption.textContent = 'Copy Value';
    
    const deleteOption = this.createElement('div', ['context-option', 'delete-option']);
    deleteOption.textContent = 'Delete';
    
    this.contextMenu.appendChild(editOption);
    this.contextMenu.appendChild(duplicateOption);
    this.contextMenu.appendChild(copyOption);
    this.contextMenu.appendChild(deleteOption);
    
    this.variablesPanel.appendChild(this.contextMenu);
  }

  /**
   * Render delete confirmation dialog
   */
  renderDeleteConfirmation() {
    this.deleteConfirmation = this.createElement('div', ['delete-confirmation']);
    this.deleteConfirmation.style.display = 'none';
    
    const message = this.createElement('div', ['confirmation-message']);
    
    const buttonsGroup = this.createElement('div', ['confirmation-buttons']);
    const cancelButton = this.createElement('button', ['cancel-delete']);
    cancelButton.textContent = 'Cancel';
    const confirmButton = this.createElement('button', ['confirm-delete']);
    confirmButton.textContent = 'Delete';
    
    buttonsGroup.appendChild(cancelButton);
    buttonsGroup.appendChild(confirmButton);
    
    this.deleteConfirmation.appendChild(message);
    this.deleteConfirmation.appendChild(buttonsGroup);
    
    this.variablesPanel.appendChild(this.deleteConfirmation);
  }

  /**
   * Render list of variables
   * @param {Array} variables - Array of variables to render
   */
  renderVariables(variables) {
    this.currentVariables = variables || [];
    this.variablesList.innerHTML = '';
    
    if (this.currentVariables.length === 0) {
      this.showEmptyState();
      return;
    }
    
    this.currentVariables.forEach(variable => {
      const variableItem = this.createVariableItem(variable);
      this.variablesList.appendChild(variableItem);
    });
  }

  /**
   * Render variables grouped by type
   * @param {Object} variablesByType - Variables grouped by type
   */
  renderVariablesByType(variablesByType) {
    this.variablesList.innerHTML = '';
    this.currentVariables = [];
    
    const types = Object.keys(variablesByType);
    if (types.length === 0) {
      this.showEmptyState();
      return;
    }
    
    types.forEach(typeName => {
      const variables = variablesByType[typeName];
      this.currentVariables.push(...variables);
      
      const categoryContainer = this.createElement('div', ['variable-category']);
      
      const categoryHeader = this.createElement('div', ['category-header']);
      categoryHeader.textContent = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      categoryContainer.appendChild(categoryHeader);
      
      variables.forEach(variable => {
        const variableItem = this.createVariableItem(variable);
        categoryContainer.appendChild(variableItem);
      });
      
      this.variablesList.appendChild(categoryContainer);
    });
  }

  /**
   * Render variables grouped by scope
   * @param {Object} variablesByScope - Variables grouped by scope
   */
  renderVariablesByScope(variablesByScope) {
    this.variablesList.innerHTML = '';
    this.currentVariables = [];
    
    const scopes = Object.keys(variablesByScope);
    if (scopes.length === 0) {
      this.showEmptyState();
      return;
    }
    
    scopes.forEach(scopeName => {
      const variables = variablesByScope[scopeName];
      this.currentVariables.push(...variables);
      
      const categoryContainer = this.createElement('div', ['variable-category']);
      
      const categoryHeader = this.createElement('div', ['category-header']);
      categoryHeader.textContent = scopeName.charAt(0).toUpperCase() + scopeName.slice(1);
      categoryContainer.appendChild(categoryHeader);
      
      variables.forEach(variable => {
        const variableItem = this.createVariableItem(variable);
        categoryContainer.appendChild(variableItem);
      });
      
      this.variablesList.appendChild(categoryContainer);
    });
  }

  /**
   * Create a variable item element
   * @param {Object} variable - Variable object
   * @returns {HTMLElement} Variable item element
   */
  createVariableItem(variable) {
    const variableItem = this.createElement('div', ['variable-item'], {
      'data-variable-id': variable.id
    });
    
    const variableHeader = this.createElement('div', ['variable-header']);
    
    const variableName = this.createElement('div', ['variable-name']);
    variableName.textContent = variable.name;
    
    const variableType = this.createElement('div', ['variable-type']);
    variableType.textContent = variable.type || 'unknown';
    
    const variableScope = this.createElement('div', ['variable-scope']);
    variableScope.textContent = variable.scope || 'local';
    
    variableHeader.appendChild(variableName);
    variableHeader.appendChild(variableType);
    variableHeader.appendChild(variableScope);
    
    const variableValue = this.createElement('div', ['variable-value']);
    variableValue.textContent = this.formatVariableValue(variable.value, variable.type);
    
    const variableDescription = this.createElement('div', ['variable-description']);
    variableDescription.textContent = variable.description || '';
    
    variableItem.appendChild(variableHeader);
    variableItem.appendChild(variableValue);
    if (variable.description) {
      variableItem.appendChild(variableDescription);
    }
    
    // Add click handler
    variableItem.addEventListener('click', (e) => {
      if (variableItem.classList.contains('disabled')) {
        return;
      }
      if (this.onVariableClick) {
        this.onVariableClick(variable);
      }
    });
    
    // Add right-click handler for context menu
    variableItem.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.onVariableRightClick) {
        this.onVariableRightClick(variable, { x: e.clientX, y: e.clientY });
      }
    });
    
    // Add hover handlers
    variableItem.addEventListener('mouseenter', () => {
      variableItem.classList.add('hover');
    });
    
    variableItem.addEventListener('mouseleave', () => {
      variableItem.classList.remove('hover');
    });
    
    return variableItem;
  }

  /**
   * Format variable value for display
   * @param {*} value - Variable value
   * @param {string} type - Variable type
   * @returns {string} Formatted value
   */
  formatVariableValue(value, type) {
    let formatted;
    
    if (type === 'object') {
      formatted = JSON.stringify(value);
    } else if (type === 'boolean') {
      formatted = value ? 'true' : 'false';
    } else {
      formatted = String(value);
    }
    
    // Truncate long values
    if (formatted.length > this.maxValueLength) {
      return formatted.substring(0, this.maxValueLength) + '...';
    }
    
    return formatted;
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    const emptyState = this.createElement('div', ['variables-empty']);
    emptyState.textContent = 'No variables available';
    this.variablesList.appendChild(emptyState);
  }

  /**
   * Set selected variable
   * @param {string|null} variableId - Variable ID to select
   */
  setSelectedVariable(variableId) {
    // Clear previous selection
    const previousSelected = this.variablesList.querySelector('.variable-item.selected');
    if (previousSelected) {
      previousSelected.classList.remove('selected');
    }
    
    // Select new variable
    if (variableId) {
      const variableItem = this.variablesList.querySelector(`[data-variable-id="${variableId}"]`);
      if (variableItem) {
        variableItem.classList.add('selected');
      }
    }
  }

  /**
   * Set highlighted variable (for keyboard navigation)
   * @param {string|null} variableId - Variable ID to highlight
   */
  setHighlightedVariable(variableId) {
    // Clear previous highlight
    const previousHighlighted = this.variablesList.querySelector('.variable-item.highlighted');
    if (previousHighlighted) {
      previousHighlighted.classList.remove('highlighted');
    }
    
    // Highlight new variable
    if (variableId) {
      const variableItem = this.variablesList.querySelector(`[data-variable-id="${variableId}"]`);
      if (variableItem) {
        variableItem.classList.add('highlighted');
        // Scroll into view if needed
        if (variableItem.scrollIntoView) {
          variableItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  /**
   * Set loading state for entire panel
   * @param {boolean} loading - Whether panel is loading
   */
  setLoading(loading) {
    if (loading) {
      this.variablesPanel.classList.add('loading');
      
      // Add loading overlay
      if (!this.loadingOverlay) {
        this.loadingOverlay = this.createElement('div', ['variables-loading']);
        this.loadingOverlay.textContent = 'Loading variables...';
        this.variablesPanel.appendChild(this.loadingOverlay);
      }
    } else {
      this.variablesPanel.classList.remove('loading');
      
      // Remove loading overlay
      if (this.loadingOverlay) {
        this.loadingOverlay.remove();
        this.loadingOverlay = null;
      }
    }
  }

  /**
   * Set search query in input
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    this.searchInput.value = query || '';
    this.clearButton.style.display = query ? 'block' : 'none';
  }

  /**
   * Show search results count
   * @param {number} count - Number of results
   * @param {number} total - Total number of variables
   */
  showSearchResults(count, total) {
    this.searchResults.textContent = `${count} of ${total} variables`;
    this.searchResults.style.display = 'block';
  }

  /**
   * Show no results message
   * @param {string} query - Search query
   */
  showNoResults(query) {
    const noResults = this.createElement('div', ['variables-no-results']);
    noResults.textContent = `No variables found for "${query}"`;
    this.variablesList.appendChild(noResults);
  }

  /**
   * Show new variable dialog
   */
  showNewVariableDialog() {
    this.newVariableDialog.style.display = 'block';
    
    // Focus name input
    const nameInput = this.newVariableDialog.querySelector('input[name="name"]');
    nameInput.focus();
  }

  /**
   * Hide new variable dialog
   */
  hideNewVariableDialog() {
    this.newVariableDialog.style.display = 'none';
    
    // Clear form
    const form = this.newVariableDialog.querySelector('.new-variable-form');
    form.reset();
  }

  /**
   * Show edit variable dialog
   * @param {Object} variable - Variable to edit
   */
  showEditVariableDialog(variable) {
    this.editVariableDialog.style.display = 'block';
    this.editVariableDialog.dataset.variableId = variable.id;
    
    // Populate form with variable data
    const form = this.editVariableForm;
    form.querySelector('input[name="name"]').value = variable.name || '';
    form.querySelector('textarea[name="value"]').value = this.formatVariableValueForEdit(variable.value, variable.type);
    form.querySelector('select[name="type"]').value = variable.type || '';
    form.querySelector('select[name="scope"]').value = variable.scope || '';
    form.querySelector('textarea[name="description"]').value = variable.description || '';
    
    // Focus name input
    form.querySelector('input[name="name"]').focus();
  }

  /**
   * Format variable value for editing
   * @param {*} value - Variable value
   * @param {string} type - Variable type
   * @returns {string} Formatted value for editing
   */
  formatVariableValueForEdit(value, type) {
    if (type === 'object') {
      return JSON.stringify(value, null, 2);
    } else if (type === 'boolean') {
      return value ? 'true' : 'false';
    } else {
      return String(value);
    }
  }

  /**
   * Hide edit variable dialog
   */
  hideEditVariableDialog() {
    this.editVariableDialog.style.display = 'none';
    delete this.editVariableDialog.dataset.variableId;
    
    // Clear form
    this.editVariableForm.reset();
  }

  /**
   * Show import variables dialog
   */
  showImportVariablesDialog() {
    this.importVariablesDialog.style.display = 'block';
    
    // Focus textarea
    const textarea = this.importVariablesDialog.querySelector('textarea');
    textarea.focus();
  }

  /**
   * Hide import variables dialog
   */
  hideImportVariablesDialog() {
    this.importVariablesDialog.style.display = 'none';
    
    // Clear form
    const form = this.importVariablesDialog.querySelector('.import-variables-form');
    form.reset();
  }

  /**
   * Show variable context menu
   * @param {string} variableId - Variable ID
   * @param {Object} position - Menu position {x, y}
   */
  showVariableContextMenu(variableId, position) {
    this.contextMenu.style.display = 'block';
    this.contextMenu.style.left = `${position.x}px`;
    this.contextMenu.style.top = `${position.y}px`;
    this.contextMenu.dataset.variableId = variableId;
  }

  /**
   * Hide variable context menu
   */
  hideVariableContextMenu() {
    this.contextMenu.style.display = 'none';
    delete this.contextMenu.dataset.variableId;
  }

  /**
   * Show delete confirmation
   * @param {Object} variable - Variable to delete
   */
  showDeleteConfirmation(variable) {
    const message = this.deleteConfirmation.querySelector('.confirmation-message');
    message.textContent = `Are you sure you want to delete "${variable.name}"?`;
    
    this.deleteConfirmation.style.display = 'block';
    this.deleteConfirmation.dataset.variableId = variable.id;
  }

  /**
   * Hide delete confirmation
   */
  hideDeleteConfirmation() {
    this.deleteConfirmation.style.display = 'none';
    delete this.deleteConfirmation.dataset.variableId;
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.clearError();
    
    this.errorMessage = this.createElement('div', ['variables-error']);
    this.errorMessage.textContent = message;
    
    // Add retry button
    const retryButton = this.createElement('button', ['retry-button']);
    retryButton.textContent = 'Retry';
    retryButton.addEventListener('click', () => {
      if (this.onRetry) {
        this.onRetry();
      }
    });
    
    this.errorMessage.appendChild(retryButton);
    this.variablesPanel.appendChild(this.errorMessage);
  }

  /**
   * Clear error message
   */
  clearError() {
    if (this.errorMessage) {
      this.errorMessage.remove();
      this.errorMessage = null;
    }
  }

  /**
   * Trigger export download
   * @param {string} variablesJson - JSON string to download
   */
  triggerExportDownload(variablesJson) {
    // Check if running in a browser environment
    try {
      if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        const blob = new Blob([variablesJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'variables.json';
        link.click();
        link.remove();
        
        URL.revokeObjectURL(url);
        return;
      }
    } catch (error) {
      // Fall through to fallback
    }
    
    // Fallback for test environment - just create the link element
    const link = document.createElement('a');
    link.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(variablesJson);
    link.download = 'variables.json';
    link.click();
    link.remove();
  }

  /**
   * Focus search input
   */
  focusSearch() {
    this.searchInput.focus();
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Search input
    this.searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      this.clearButton.style.display = query ? 'block' : 'none';
      
      if (this.onSearchInput) {
        this.onSearchInput(query);
      }
    });
    
    // Clear search button
    this.clearButton.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearButton.style.display = 'none';
      
      if (this.onSearchClear) {
        this.onSearchClear();
      }
    });
    
    // Action buttons
    this.newVariableButton.addEventListener('click', () => {
      if (this.onNewVariable) {
        this.onNewVariable();
      }
    });
    
    this.importVariablesButton.addEventListener('click', () => {
      this.showImportVariablesDialog();
    });
    
    this.exportVariablesButton.addEventListener('click', () => {
      if (this.onExportVariables) {
        this.onExportVariables();
      }
    });
    
    // Dialog forms
    this.bindDialogEvents();
    
    // Context menu events
    this.bindContextMenuEvents();
    
    // Global events
    this.bindGlobalEvents();
  }

  /**
   * Bind dialog events
   */
  bindDialogEvents() {
    // New variable form
    this.newVariableForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const variableData = {
        name: formData.get('name'),
        value: formData.get('value'),
        type: formData.get('type'),
        scope: formData.get('scope'),
        description: formData.get('description')
      };
      
      if (this.onCreateVariable) {
        this.onCreateVariable(variableData);
      }
    });
    
    // Edit variable form
    this.editVariableForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const variableId = this.editVariableDialog.dataset.variableId;
      const formData = new FormData(e.target);
      const updates = {
        name: formData.get('name'),
        value: formData.get('value'),
        type: formData.get('type'),
        scope: formData.get('scope'),
        description: formData.get('description')
      };
      
      if (this.onUpdateVariable && variableId) {
        this.onUpdateVariable(variableId, updates);
      }
    });
    
    // Import variables form
    this.importVariablesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const json = formData.get('json');
      
      if (this.onImportVariables) {
        this.onImportVariables(json);
      }
    });
    
    // Dialog cancel buttons
    const cancelButtons = this.variablesPanel.querySelectorAll('.cancel-button');
    cancelButtons.forEach(button => {
      button.addEventListener('click', () => {
        this.hideNewVariableDialog();
        this.hideEditVariableDialog();
        this.hideImportVariablesDialog();
      });
    });
  }

  /**
   * Bind context menu events
   */
  bindContextMenuEvents() {
    const editOption = this.contextMenu.querySelector('.edit-option');
    editOption.addEventListener('click', () => {
      const variableId = this.contextMenu.dataset.variableId;
      if (variableId && this.onVariableEdit) {
        this.onVariableEdit(variableId);
      }
      this.hideVariableContextMenu();
    });
    
    const duplicateOption = this.contextMenu.querySelector('.duplicate-option');
    duplicateOption.addEventListener('click', () => {
      const variableId = this.contextMenu.dataset.variableId;
      if (variableId && this.onVariableDuplicate) {
        this.onVariableDuplicate(variableId);
      }
      this.hideVariableContextMenu();
    });
    
    const copyOption = this.contextMenu.querySelector('.copy-option');
    copyOption.addEventListener('click', () => {
      const variableId = this.contextMenu.dataset.variableId;
      if (variableId && this.onVariableCopy) {
        this.onVariableCopy(variableId);
      }
      this.hideVariableContextMenu();
    });
    
    const deleteOption = this.contextMenu.querySelector('.delete-option');
    deleteOption.addEventListener('click', () => {
      const variableId = this.contextMenu.dataset.variableId;
      if (variableId && this.onVariableDelete) {
        this.onVariableDelete(variableId);
      }
      this.hideVariableContextMenu();
    });
    
    // Delete confirmation buttons
    const cancelDeleteButton = this.deleteConfirmation.querySelector('.cancel-delete');
    cancelDeleteButton.addEventListener('click', () => {
      this.hideDeleteConfirmation();
    });
    
    const confirmDeleteButton = this.deleteConfirmation.querySelector('.confirm-delete');
    confirmDeleteButton.addEventListener('click', () => {
      const variableId = this.deleteConfirmation.dataset.variableId;
      if (variableId && this.onConfirmDelete) {
        this.onConfirmDelete(variableId);
      }
      this.hideDeleteConfirmation();
    });
  }

  /**
   * Bind global events
   */
  bindGlobalEvents() {
    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Focus search unless already in an input
        if (document.activeElement.tagName !== 'INPUT' && 
            document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.focusSearch();
        }
      }
    });
    
    // Click outside to close menus
    document.addEventListener('click', (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideVariableContextMenu();
      }
    });
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.variablesPanel && this.variablesPanel.parentNode) {
      this.variablesPanel.parentNode.removeChild(this.variablesPanel);
    }
    
    // Clear references
    this.onVariableClick = null;
    this.onVariableRightClick = null;
    this.onSearchInput = null;
    this.onSearchClear = null;
    this.onNewVariable = null;
    this.onCreateVariable = null;
    this.onUpdateVariable = null;
    this.onImportVariables = null;
    this.onExportVariables = null;
    
    super.destroy();
  }
}