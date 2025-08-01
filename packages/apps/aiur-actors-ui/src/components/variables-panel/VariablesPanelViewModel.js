/**
 * VariablesPanelViewModel - ViewModel for variables panel component
 */
import { ExtendedBaseViewModel } from '../base/ExtendedBaseViewModel.js';

export class VariablesPanelViewModel extends ExtendedBaseViewModel {
  constructor(model, view, actorSpace) {
    super(model, view, actorSpace);
    
    this.groupByType = false;
    this.groupByScope = false;
    this.showDescriptions = true;
  }

  /**
   * Initialize the view model
   */
  initialize() {
    super.initialize();
    
    // Get additional actors for variables panel
    this.actors.variablesActor = this.actorSpace.getActor('variables-actor');
    
    // Request initial variables list
    this.requestVariablesList();
  }

  /**
   * Bind model and view
   */
  bind() {
    super.bind();
    
    // Bind view event handlers
    this.view.onVariableClick = this.handleVariableClick.bind(this);
    this.view.onVariableRightClick = this.handleVariableRightClick.bind(this);
    this.view.onSearchInput = this.handleSearchInput.bind(this);
    this.view.onSearchClear = this.handleSearchClear.bind(this);
    this.view.onNewVariable = this.handleNewVariable.bind(this);
    this.view.onCreateVariable = this.handleCreateVariable.bind(this);
    this.view.onUpdateVariable = this.handleUpdateVariable.bind(this);
    this.view.onImportVariables = this.handleImportVariables.bind(this);
    this.view.onExportVariables = this.handleExportVariables.bind(this);
    this.view.onRetry = this.handleRetry.bind(this);
    
    // Context menu handlers
    this.view.onVariableEdit = this.handleVariableEdit.bind(this);
    this.view.onVariableDuplicate = this.handleVariableDuplicate.bind(this);
    this.view.onVariableCopy = this.handleVariableCopy.bind(this);
    this.view.onVariableDelete = this.handleVariableDelete.bind(this);
    this.view.onConfirmDelete = this.handleConfirmDelete.bind(this);
  }

  /**
   * Request variables list from actor
   */
  requestVariablesList() {
    this.view.setLoading(true);
    
    if (this.actors.variablesActor) {
      this.actors.variablesActor.receive({
        type: 'getVariables'
      });
    }
  }

  /**
   * Handle variable click from view
   * @param {Object} variable - Variable object
   */
  handleVariableClick(variable) {
    this.model.selectVariable(variable.id);
  }

  /**
   * Handle variable right-click from view
   * @param {Object} variable - Variable object
   * @param {Object} position - Click position
   */
  handleVariableRightClick(variable, position) {
    this.view.showVariableContextMenu(variable.id, position);
  }

  /**
   * Handle search input from view
   * @param {string} query - Search query
   */
  handleSearchInput(query) {
    this.model.setSearchQuery(query);
  }

  /**
   * Handle search clear from view
   */
  handleSearchClear() {
    this.model.setSearchQuery('');
  }

  /**
   * Handle new variable button click
   */
  handleNewVariable() {
    this.view.showNewVariableDialog();
  }

  /**
   * Handle create variable from dialog
   * @param {Object} variableData - Variable data from form
   */
  handleCreateVariable(variableData) {
    // Validate variable data
    if (!variableData.name || !variableData.name.trim()) {
      this.view.showError('Variable name is required');
      return;
    }
    
    if (variableData.value === undefined || variableData.value === null || variableData.value === '') {
      this.view.showError('Variable value is required');
      return;
    }
    
    if (!variableData.type) {
      this.view.showError('Variable type is required');
      return;
    }
    
    // Validate variable name format
    if (!this.model.isValidVariableName(variableData.name.trim())) {
      this.view.showError('Variable name must be a valid identifier');
      return;
    }
    
    // Parse value based on type
    let parsedValue;
    try {
      parsedValue = this.parseVariableValue(variableData.value, variableData.type);
    } catch (error) {
      this.view.showError(error.message);
      return;
    }
    
    // Validate parsed value
    if (!this.model.validateVariableValue(parsedValue, variableData.type)) {
      if (variableData.type === 'boolean') {
        this.view.showError('Boolean variable must have true/false value');
      } else if (variableData.type === 'number') {
        this.view.showError('Number variable must have numeric value');
      } else if (variableData.type === 'object') {
        this.view.showError('Object variable must have valid JSON object');
      } else {
        this.view.showError('Invalid variable value for type');
      }
      return;
    }
    
    // Create variable through model (which will generate ID and timestamps)
    try {
      const finalVariableData = {
        ...variableData,
        value: parsedValue
      };
      
      this.model.createVariable(finalVariableData);
      
      // Send to actor
      if (this.actors.variablesActor) {
        this.actors.variablesActor.receive({
          type: 'createVariable',
          variableData: this.model.pendingVariable
        });
      }
      
      // Hide dialog
      this.view.hideNewVariableDialog();
      
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  /**
   * Handle update variable from dialog
   * @param {string} variableId - Variable ID
   * @param {Object} updates - Updated variable data
   */
  handleUpdateVariable(variableId, updates) {
    // Parse value based on type
    let parsedValue;
    try {
      parsedValue = this.parseVariableValue(updates.value, updates.type);
    } catch (error) {
      this.view.showError(error.message);
      return;
    }
    
    const finalUpdates = {
      ...updates,
      value: parsedValue
    };
    
    // Update variable
    try {
      this.updateVariable(variableId, finalUpdates);
      this.view.hideEditVariableDialog();
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  /**
   * Handle import variables from dialog
   * @param {string} variablesJson - JSON string of variables
   */
  handleImportVariables(variablesJson) {
    try {
      this.importVariables(variablesJson);
      this.view.hideImportVariablesDialog();
    } catch (error) {
      this.view.showError(error.message);
    }
  }

  /**
   * Handle export variables
   */
  handleExportVariables() {
    this.exportVariables();
  }

  /**
   * Handle retry button click
   */
  handleRetry() {
    this.view.clearError();
    this.requestVariablesList();
  }

  /**
   * Handle variable edit action
   * @param {string} variableId - Variable ID
   */
  handleVariableEdit(variableId) {
    this.editVariable(variableId);
  }

  /**
   * Handle variable duplicate action
   * @param {string} variableId - Variable ID
   */
  handleVariableDuplicate(variableId) {
    this.duplicateVariable(variableId);
  }

  /**
   * Handle variable copy action
   * @param {string} variableId - Variable ID
   */
  handleVariableCopy(variableId) {
    this.copyVariableValue(variableId);
  }

  /**
   * Handle variable delete action
   * @param {string} variableId - Variable ID
   */
  handleVariableDelete(variableId) {
    this.requestDeleteVariable(variableId);
  }

  /**
   * Handle delete confirmation
   * @param {string} variableId - Variable ID
   */
  handleConfirmDelete(variableId) {
    this.confirmDeleteVariable(variableId);
  }

  /**
   * Parse variable value based on type
   * @param {string} value - String value from form
   * @param {string} type - Variable type
   * @returns {*} Parsed value
   */
  parseVariableValue(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'boolean':
        const lowerValue = String(value).toLowerCase().trim();
        if (lowerValue === 'true') return true;
        if (lowerValue === 'false') return false;
        throw new Error('Boolean variable must have true/false value');
      case 'number':
        const numValue = Number(value);
        if (isNaN(numValue)) {
          throw new Error('Number variable must have numeric value');
        }
        return numValue;
      case 'object':
        try {
          return JSON.parse(value);
        } catch (error) {
          throw new Error('Object variable must contain valid JSON');
        }
      default:
        return value;
    }
  }

  /**
   * Show import dialog
   */
  showImportDialog() {
    this.view.showImportVariablesDialog();
  }

  /**
   * Import variables from JSON
   * @param {string} variablesJson - JSON string
   */
  importVariables(variablesJson) {
    // Validate JSON first
    try {
      this.model.importVariables(variablesJson); // This validates the JSON
    } catch (error) {
      this.view.showError(error.message);
      return;
    }

    if (this.actors.variablesActor) {
      this.actors.variablesActor.receive({
        type: 'importVariables',
        variablesJson
      });
    }
  }

  /**
   * Export variables to JSON file
   */
  exportVariables() {
    const variablesJson = this.model.exportVariables();
    this.view.triggerExportDownload(variablesJson);
  }

  /**
   * Edit a variable
   * @param {string} variableId - Variable ID
   */
  editVariable(variableId) {
    const variable = this.model.getVariableById(variableId);
    if (variable) {
      this.view.showEditVariableDialog(variable);
    }
  }

  /**
   * Update a variable
   * @param {string} variableId - Variable ID
   * @param {Object} updates - Updates to apply
   */
  updateVariable(variableId, updates) {
    if (this.actors.variablesActor) {
      this.actors.variablesActor.receive({
        type: 'updateVariable',
        variableId,
        updates
      });
    }
  }

  /**
   * Request variable deletion (show confirmation)
   * @param {string} variableId - Variable ID
   */
  requestDeleteVariable(variableId) {
    const variable = this.model.getVariableById(variableId);
    if (variable) {
      this.view.showDeleteConfirmation(variable);
    }
  }

  /**
   * Confirm variable deletion
   * @param {string} variableId - Variable ID
   */
  confirmDeleteVariable(variableId) {
    if (this.actors.variablesActor) {
      this.actors.variablesActor.receive({
        type: 'deleteVariable',
        variableId
      });
    }
  }

  /**
   * Duplicate a variable
   * @param {string} variableId - Variable ID
   */
  duplicateVariable(variableId) {
    if (this.actors.variablesActor) {
      this.actors.variablesActor.receive({
        type: 'duplicateVariable',
        variableId
      });
    }
  }

  /**
   * Copy variable value to clipboard
   * @param {string} variableId - Variable ID
   */
  copyVariableValue(variableId) {
    const variable = this.model.getVariableById(variableId);
    if (variable && navigator.clipboard && navigator.clipboard.writeText) {
      let valueText;
      if (typeof variable.value === 'object') {
        valueText = JSON.stringify(variable.value);
      } else {
        valueText = String(variable.value);
      }
      
      try {
        const result = navigator.clipboard.writeText(valueText);
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            console.error('Failed to copy to clipboard:', error);
          });
        }
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  }

  /**
   * Toggle type view
   */
  toggleTypeView() {
    this.groupByType = !this.groupByType;
    this.groupByScope = false; // Disable scope grouping
    this.refreshView();
  }

  /**
   * Toggle scope view
   */
  toggleScopeView() {
    this.groupByScope = !this.groupByScope;
    this.groupByType = false; // Disable type grouping
    this.refreshView();
  }

  /**
   * Refresh the view based on current state
   */
  refreshView() {
    const filteredVariables = this.model.getFilteredVariables();
    
    if (this.groupByType) {
      const grouped = this.model.getVariablesByType();
      // Filter each type
      const filteredGrouped = {};
      Object.keys(grouped).forEach(type => {
        const typeVariables = grouped[type].filter(variable => 
          filteredVariables.includes(variable)
        );
        if (typeVariables.length > 0) {
          filteredGrouped[type] = typeVariables;
        }
      });
      this.view.renderVariablesByType(filteredGrouped);
    } else if (this.groupByScope) {
      const grouped = this.model.getVariablesByScope();
      // Filter each scope
      const filteredGrouped = {};
      Object.keys(grouped).forEach(scope => {
        const scopeVariables = grouped[scope].filter(variable => 
          filteredVariables.includes(variable)
        );
        if (scopeVariables.length > 0) {
          filteredGrouped[scope] = scopeVariables;
        }
      });
      this.view.renderVariablesByScope(filteredGrouped);
    } else {
      this.view.renderVariables(filteredVariables);
    }
    
    // Update search results
    if (this.model.searchQuery) {
      const totalVariables = this.model.getVariables().length;
      if (filteredVariables.length === 0) {
        this.view.showNoResults(this.model.searchQuery);
      } else {
        this.view.showSearchResults(filteredVariables.length, totalVariables);
      }
    }
  }

  /**
   * Handle model changes
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  onModelChange(event, data) {
    super.onModelChange(event, data);
    
    switch (event) {
      case 'variablesChanged':
        this.view.setLoading(false);
        this.refreshView();
        break;
        
      case 'variableSelected':
        this.view.setSelectedVariable(data.variableId);
        
        // Notify command actor
        if (data.variableId && this.actors.commandActor) {
          this.actors.commandActor.receive({
            type: 'variableSelected',
            variableId: data.variableId,
            variable: data.variable
          });
        }
        break;
        
      case 'searchQueryChanged':
        this.view.setSearchQuery(data.query);
        this.refreshView();
        break;
        
      case 'variableUpdated':
        this.refreshView();
        break;
        
      case 'variableDeleted':
        this.refreshView();
        break;
        
      case 'variableCreated':
        // Will be handled by actor response
        break;
        
      case 'variablesImported':
        // Will be handled by actor response
        break;
    }
  }

  /**
   * Handle updates from actors
   * @param {Object} update - Update from actor
   */
  handleActorUpdate(update) {
    super.handleActorUpdate(update);
    
    switch (update.type) {
      case 'variablesListResponse':
        this.view.clearError();
        this.model.setVariables(update.variables || []);
        break;
        
      case 'variablesListError':
        this.view.setLoading(false);
        this.view.showError(`Failed to load variables: ${update.error}`);
        break;
        
      case 'variableCreated':
        // Refresh variables list to include new variable
        this.requestVariablesList();
        break;
        
      case 'variableCreationError':
        this.view.showError(`Failed to create variable: ${update.error}`);
        break;
        
      case 'variableUpdated':
        this.model.updateVariable(update.variableId, update.variable);
        break;
        
      case 'variableUpdateError':
        this.view.showError(`Failed to update variable: ${update.error}`);
        break;
        
      case 'variableDeleted':
        this.model.deleteVariable(update.variableId);
        break;
        
      case 'variableDeleteError':
        this.view.showError(`Failed to delete variable: ${update.error}`);
        break;
        
      case 'variableDuplicated':
        // Refresh variables list to include duplicated variable
        this.requestVariablesList();
        break;
        
      case 'variablesImported':
        // Refresh variables list to include imported variables
        this.requestVariablesList();
        break;
        
      case 'variablesImportError':
        this.view.showError(`Failed to import variables: ${update.error}`);
        break;
    }
  }

  /**
   * Get variables panel API
   * @returns {Object} Variables panel API
   */
  getVariablesPanelAPI() {
    return {
      refreshVariables: () => this.requestVariablesList(),
      selectVariable: (variableId) => this.model.selectVariable(variableId),
      getCurrentVariable: () => this.model.getSelectedVariable(),
      createVariable: (variableData) => this.handleCreateVariable(variableData),
      updateVariable: (variableId, updates) => this.updateVariable(variableId, updates),
      deleteVariable: (variableId) => this.confirmDeleteVariable(variableId),
      duplicateVariable: (variableId) => this.duplicateVariable(variableId),
      searchVariables: (query) => this.model.setSearchQuery(query),
      importVariables: (json) => this.importVariables(json),
      exportVariables: () => this.exportVariables(),
      toggleTypeView: () => this.toggleTypeView(),
      toggleScopeView: () => this.toggleScopeView(),
      getVariables: () => this.model.getVariables(),
      getFilteredVariables: () => this.model.getFilteredVariables(),
      getVariableTypes: () => this.model.getVariableTypes(),
      getVariableScopes: () => this.model.getVariableScopes()
    };
  }

  /**
   * Retry loading variables
   */
  retryLoadVariables() {
    this.requestVariablesList();
  }
}