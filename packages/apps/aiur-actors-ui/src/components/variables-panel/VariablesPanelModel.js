/**
 * VariablesPanelModel - Model for variables panel component
 */
import { ExtendedBaseModel } from '../base/ExtendedBaseModel.js';

export class VariablesPanelModel extends ExtendedBaseModel {
  constructor() {
    super();
    
    this.variables = [];
    this.selectedVariableId = null;
    this.searchQuery = '';
    this.pendingVariable = null;
  }

  /**
   * Set the variables list
   * @param {Array} variables - Array of variable objects
   */
  setVariables(variables) {
    this.variables = (variables || []).sort((a, b) => {
      // Sort by name alphabetically
      return (a.name || '').localeCompare(b.name || '');
    });
    this.notify('variablesChanged', { variables: this.variables });
  }

  /**
   * Get all variables
   * @returns {Array} Array of variables
   */
  getVariables() {
    return this.variables;
  }

  /**
   * Select a variable by ID
   * @param {string|null} variableId - Variable ID to select, or null to deselect
   */
  selectVariable(variableId) {
    if (variableId && !this.getVariableById(variableId)) {
      return; // Variable doesn't exist
    }
    
    if (this.selectedVariableId === variableId) {
      return; // Already selected
    }
    
    this.selectedVariableId = variableId;
    const variable = variableId ? this.getVariableById(variableId) : null;
    
    this.notify('variableSelected', { variableId, variable });
  }

  /**
   * Get the currently selected variable
   * @returns {Object|null} Selected variable object or null
   */
  getSelectedVariable() {
    return this.selectedVariableId ? this.getVariableById(this.selectedVariableId) : null;
  }

  /**
   * Create a new variable
   * @param {Object} variableData - Variable data
   */
  createVariable(variableData) {
    if (!variableData.name || !variableData.name.trim()) {
      throw new Error('Variable name is required');
    }
    
    if (variableData.value === undefined || variableData.value === null) {
      throw new Error('Variable value is required');
    }
    
    if (!variableData.type) {
      throw new Error('Variable type is required');
    }
    
    // Validate variable name format
    if (!this.isValidVariableName(variableData.name.trim())) {
      throw new Error('Variable name must be a valid identifier');
    }
    
    // Validate variable value for type
    if (!this.validateVariableValue(variableData.value, variableData.type)) {
      if (variableData.type === 'boolean') {
        throw new Error('Boolean variable must have true/false value');
      } else if (variableData.type === 'number') {
        throw new Error('Number variable must have numeric value');
      } else if (variableData.type === 'object') {
        throw new Error('Object variable must have valid object value');
      } else {
        throw new Error('Invalid variable value for type');
      }
    }
    
    const now = Date.now();
    this.pendingVariable = {
      id: `var-${now}-${Math.random().toString(36).substr(2, 9)}`,
      name: variableData.name.trim(),
      type: variableData.type,
      value: variableData.value,
      scope: variableData.scope || 'local',
      description: variableData.description || '',
      created: now,
      lastModified: now,
      ...variableData
    };
    
    this.notify('variableCreated', { variable: this.pendingVariable });
  }

  /**
   * Update variable details
   * @param {string} variableId - Variable ID
   * @param {Object} updates - Properties to update
   */
  updateVariable(variableId, updates) {
    const variable = this.getVariableById(variableId);
    if (!variable) {
      return;
    }
    
    // Validate updates if they include type/value changes
    if (updates.type && updates.value !== undefined) {
      if (!this.validateVariableValue(updates.value, updates.type)) {
        if (updates.type === 'boolean') {
          throw new Error('Boolean variable must have true/false value');
        } else if (updates.type === 'number') {
          throw new Error('Number variable must have numeric value');
        } else if (updates.type === 'object') {
          throw new Error('Object variable must have valid object value');
        } else {
          throw new Error('Invalid variable value for type');
        }
      }
    } else if (updates.value !== undefined && variable.type) {
      if (!this.validateVariableValue(updates.value, variable.type)) {
        if (variable.type === 'boolean') {
          throw new Error('Boolean variable must have true/false value');
        } else if (variable.type === 'number') {
          throw new Error('Number variable must have numeric value');
        } else if (variable.type === 'object') {
          throw new Error('Object variable must have valid object value');
        } else {
          throw new Error('Invalid variable value for type');
        }
      }
    }
    
    Object.assign(variable, updates, { lastModified: Date.now() });
    
    // Re-sort variables if name changed
    if (updates.name) {
      this.variables.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    
    this.notify('variableUpdated', { variableId, updates });
  }

  /**
   * Delete a variable
   * @param {string} variableId - Variable ID
   */
  deleteVariable(variableId) {
    const index = this.variables.findIndex(variable => variable.id === variableId);
    if (index === -1) {
      return;
    }
    
    this.variables.splice(index, 1);
    
    // Deselect if selected
    if (this.selectedVariableId === variableId) {
      this.selectedVariableId = null;
    }
    
    this.notify('variableDeleted', { variableId });
  }

  /**
   * Set the search query
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    const trimmedQuery = (query || '').trim();
    if (this.searchQuery === trimmedQuery) {
      return;
    }
    
    this.searchQuery = trimmedQuery;
    this.notify('searchQueryChanged', { query: this.searchQuery });
  }

  /**
   * Get filtered variables based on search query
   * @returns {Array} Filtered variables
   */
  getFilteredVariables() {
    if (!this.searchQuery) {
      return this.variables;
    }
    
    const query = this.searchQuery.toLowerCase();
    
    return this.variables.filter(variable => {
      const name = (variable.name || '').toLowerCase();
      const description = (variable.description || '').toLowerCase();
      const type = (variable.type || '').toLowerCase();
      const scope = (variable.scope || '').toLowerCase();
      return name.includes(query) || description.includes(query) || 
             type.includes(query) || scope.includes(query);
    });
  }

  /**
   * Group variables by type
   * @returns {Object} Variables grouped by type
   */
  getVariablesByType() {
    const grouped = {};
    
    this.variables.forEach(variable => {
      const type = variable.type || 'Unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(variable);
    });
    
    return grouped;
  }

  /**
   * Group variables by scope
   * @returns {Object} Variables grouped by scope
   */
  getVariablesByScope() {
    const grouped = {};
    
    this.variables.forEach(variable => {
      const scope = variable.scope || 'Unknown';
      if (!grouped[scope]) {
        grouped[scope] = [];
      }
      grouped[scope].push(variable);
    });
    
    return grouped;
  }

  /**
   * Get available variable types
   * @returns {Array} Array of variable types
   */
  getVariableTypes() {
    const types = new Set();
    this.variables.forEach(variable => {
      if (variable.type) {
        types.add(variable.type);
      }
    });
    return Array.from(types).sort();
  }

  /**
   * Get available variable scopes
   * @returns {Array} Array of variable scopes
   */
  getVariableScopes() {
    const scopes = new Set();
    this.variables.forEach(variable => {
      if (variable.scope) {
        scopes.add(variable.scope);
      }
    });
    return Array.from(scopes).sort();
  }

  /**
   * Get variable by ID
   * @param {string} variableId - Variable ID
   * @returns {Object|null} Variable object or null
   */
  getVariableById(variableId) {
    return this.variables.find(variable => variable.id === variableId) || null;
  }

  /**
   * Get recent variables
   * @param {number} limit - Maximum number of variables to return
   * @returns {Array} Recent variables
   */
  getRecentVariables(limit = 10) {
    return [...this.variables]
      .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
      .slice(0, limit);
  }

  /**
   * Get variables by name pattern
   * @param {RegExp} pattern - Regular expression pattern
   * @returns {Array} Matching variables
   */
  getVariablesByPattern(pattern) {
    return this.variables.filter(variable => pattern.test(variable.name || ''));
  }

  /**
   * Validate variable value for type
   * @param {*} value - Value to validate
   * @param {string} type - Variable type
   * @returns {boolean} Whether value is valid for type
   */
  validateVariableValue(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'object':
        return typeof value === 'object' && value !== null;
      default:
        return true;
    }
  }

  /**
   * Validate variable name format
   * @param {string} name - Variable name
   * @returns {boolean} Whether name is valid
   */
  isValidVariableName(name) {
    if (!name || typeof name !== 'string') {
      return false;
    }
    
    // Valid identifier: starts with letter or underscore, followed by letters, digits, or underscores
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
  }

  /**
   * Export variables as JSON
   * @returns {string} JSON string of variables (without IDs)
   */
  exportVariables() {
    const exportData = this.variables.map(variable => {
      const { id, created, lastModified, ...exportVar } = variable;
      return exportVar;
    });
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import variables from JSON
   * @param {string} variablesJson - JSON string of variables
   */
  importVariables(variablesJson) {
    let variablesData;
    
    try {
      variablesData = JSON.parse(variablesJson);
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
    
    if (!Array.isArray(variablesData)) {
      throw new Error('JSON must contain an array of variables');
    }
    
    // Validate each variable
    variablesData.forEach((variable, index) => {
      if (!variable.name || !this.isValidVariableName(variable.name)) {
        throw new Error(`Variable at index ${index}: Variable name must be a valid identifier`);
      }
      
      if (variable.value === undefined || variable.value === null) {
        throw new Error(`Variable at index ${index}: Variable value is required`);
      }
      
      if (!variable.type) {
        throw new Error(`Variable at index ${index}: Variable type is required`);
      }
      
      if (!this.validateVariableValue(variable.value, variable.type)) {
        throw new Error(`Variable at index ${index}: Invalid value for type ${variable.type}`);
      }
    });
    
    // Add IDs and timestamps to imported variables
    const now = Date.now();
    const importedVariables = variablesData.map((variable, index) => ({
      id: `imported-${now}-${index}`,
      created: now,
      lastModified: now,
      scope: 'global',
      description: '',
      ...variable
    }));
    
    this.notify('variablesImported', { variables: importedVariables });
  }

  /**
   * Clear all data
   */
  destroy() {
    this.variables = [];
    this.selectedVariableId = null;
    this.searchQuery = '';
    this.pendingVariable = null;
    super.destroy();
  }
}