/**
 * StateProjector - Handles complex projection rules with array indexing and nested property projection
 * 
 * Provides advanced state projection capabilities for hierarchical components,
 * supporting dynamic variables, array indexing, and complex nested property paths.
 */

export class StateProjector {
  constructor(initialRules = {}) {
    if (initialRules && (typeof initialRules !== 'object' || Array.isArray(initialRules))) {
      throw new Error('Initial rules must be an object');
    }
    
    this.projectionRules = {};
    this.variables = new Map(); // For dynamic variable substitution
    
    if (initialRules && Object.keys(initialRules).length > 0) {
      this.setProjectionRules(initialRules);
    }
  }

  /**
   * Project a local path to a parent path using projection rules
   * @param {string} localPath - Local property path
   * @returns {string} Projected parent path or original path if no projection
   */
  project(localPath) {
    if (!localPath || typeof localPath !== 'string') {
      return localPath;
    }
    
    // Check if we have a projection rule for this path
    if (this.projectionRules.hasOwnProperty(localPath)) {
      const projectedPath = this.projectionRules[localPath];
      
      // Resolve any dynamic variables in the projected path
      return this.resolveVariables(projectedPath);
    }
    
    // No projection rule - return original path
    return localPath;
  }

  /**
   * Resolve dynamic variables in a path string
   * @param {string} path - Path with potential {variable} placeholders
   * @returns {string} Path with variables resolved
   * @private
   */
  resolveVariables(path) {
    let resolvedPath = path;
    
    // Replace {variable} placeholders with actual values
    for (const [variable, value] of this.variables) {
      const placeholder = `{${variable}}`;
      // Use global replace to handle multiple occurrences
      resolvedPath = resolvedPath.replace(new RegExp(`\\{${this.escapeRegExp(variable)}\\}`, 'g'), value);
    }
    
    return resolvedPath;
  }

  /**
   * Escape special regex characters in variable names
   * @param {string} string - String to escape
   * @returns {string} Escaped string
   * @private
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Set projection rules (replaces existing rules)
   * @param {Object} rules - Projection rules mapping local paths to parent paths
   */
  setProjectionRules(rules) {
    if (!rules || typeof rules !== 'object' || Array.isArray(rules)) {
      throw new Error('Projection rules must be an object');
    }
    
    // Validate all rules before setting
    this.validateProjectionRules(rules);
    
    this.projectionRules = { ...rules };
  }

  /**
   * Add or update a single projection rule
   * @param {string} localPath - Local property path
   * @param {string} parentPath - Parent property path
   */
  addProjectionRule(localPath, parentPath) {
    this.validateProjectionRule(localPath, parentPath);
    this.projectionRules[localPath] = parentPath;
  }

  /**
   * Remove a projection rule
   * @param {string} localPath - Local property path to remove
   */
  removeProjectionRule(localPath) {
    delete this.projectionRules[localPath];
  }

  /**
   * Clear all projection rules
   */
  clearAllProjectionRules() {
    this.projectionRules = {};
  }

  /**
   * Check if a projection rule exists for the given local path
   * @param {string} localPath - Local property path
   * @returns {boolean} True if projection rule exists
   */
  hasProjectionRule(localPath) {
    return this.projectionRules.hasOwnProperty(localPath);
  }

  /**
   * Validate projection rules format
   * @param {Object} rules - Rules to validate
   * @private
   */
  validateProjectionRules(rules) {
    for (const [localPath, parentPath] of Object.entries(rules)) {
      this.validateProjectionRule(localPath, parentPath);
    }
  }

  /**
   * Validate a single projection rule
   * @param {string} localPath - Local property path
   * @param {string} parentPath - Parent property path
   * @private
   */
  validateProjectionRule(localPath, parentPath) {
    if (typeof localPath !== 'string') {
      throw new Error('Invalid projection rule: local path must be a string');
    }
    
    if (!localPath || localPath.trim() === '') {
      throw new Error('Invalid projection rule: local path cannot be empty');
    }
    
    if (typeof parentPath !== 'string') {
      throw new Error('Invalid projection rule: parent path must be a string');
    }
    
    if (!parentPath || parentPath.trim() === '') {
      throw new Error('Invalid projection rule: parent path cannot be empty');
    }
  }

  /**
   * Set a projection variable for dynamic path resolution
   * @param {string} variable - Variable name
   * @param {*} value - Variable value
   */
  setVariable(variable, value) {
    this.variables.set(variable, value);
  }

  /**
   * Get a projection variable value
   * @param {string} variable - Variable name
   * @returns {*} Variable value or undefined
   */
  getVariable(variable) {
    return this.variables.get(variable);
  }

  /**
   * Check if a variable exists
   * @param {string} variable - Variable name
   * @returns {boolean} True if variable exists
   */
  hasVariable(variable) {
    return this.variables.has(variable);
  }

  /**
   * Set multiple projection variables at once
   * @param {Object} variables - Object with variable name/value pairs
   */
  setVariables(variables) {
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      throw new Error('Variables must be an object');
    }
    
    for (const [name, value] of Object.entries(variables)) {
      this.variables.set(name, value);
    }
  }

  /**
   * Clear a single variable
   * @param {string} variable - Variable name to clear
   */
  clearVariable(variable) {
    this.variables.delete(variable);
  }

  /**
   * Clear all variables
   */
  clearAllVariables() {
    this.variables.clear();
  }

  /**
   * Get metadata about the current state
   * @returns {Object} Metadata object
   */
  getMetadata() {
    return {
      projectionRuleCount: Object.keys(this.projectionRules).length,
      variableCount: this.variables.size,
      projectionRuleKeys: Object.keys(this.projectionRules),
      variableKeys: Array.from(this.variables.keys())
    };
  }

  /**
   * Create a copy of this projector with the same rules and variables
   * @returns {StateProjector} New StateProjector instance
   */
  clone() {
    const cloned = new StateProjector();
    cloned.projectionRules = { ...this.projectionRules };
    cloned.variables = new Map(this.variables);
    return cloned;
  }

  /**
   * Export current state as JSON-serializable object
   * @returns {Object} Serializable state object
   */
  exportState() {
    return {
      projectionRules: { ...this.projectionRules },
      variables: Array.from(this.variables.entries())
    };
  }

  /**
   * Import state from exported object
   * @param {Object} state - State object from exportState()
   */
  importState(state) {
    if (!state || typeof state !== 'object') {
      throw new Error('State must be an object');
    }
    
    if (state.projectionRules) {
      this.setProjectionRules(state.projectionRules);
    }
    
    if (Array.isArray(state.variables)) {
      this.variables = new Map(state.variables);
    }
  }
}