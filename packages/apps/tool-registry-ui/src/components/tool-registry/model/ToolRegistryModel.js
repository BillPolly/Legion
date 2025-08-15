/**
 * ToolRegistryModel - Model layer for ToolRegistry application
 * Implements state management, event subscription, and nested property access
 * Following MVVM architecture pattern from design document
 */

export class ToolRegistryModel {
  constructor() {
    this.state = {
      // Application State
      currentPanel: 'search',
      isLoading: false,
      errorState: null,
      connectionStatus: 'disconnected',
      
      // Data State
      tools: new Map(),
      modules: new Map(), 
      searchResults: [],
      selectedTool: null,
      selectedModule: null,
      
      // UI State
      windowDimensions: { width: 0, height: 0 },
      activeFilters: {},
      userPreferences: {
        theme: 'light',
        defaultView: 'search',
        itemsPerPage: 20
      }
    };
    
    // Event system for component communication
    this.eventEmitter = new EventTarget();
    this.subscriptions = new Map();
  }
  
  /**
   * Update state at the specified path and notify subscribers
   * @param {string} path - Dot-separated path to the property
   * @param {any} value - New value to set
   */
  updateState(path, value) {
    const oldValue = this.getState(path);
    this.setNestedProperty(this.state, path, value);
    this.emit('stateChanged', { path, value, oldValue });
    
    // Notify path-specific subscribers
    const subscribers = this.subscriptions.get(path);
    if (subscribers) {
      subscribers.forEach(callback => callback(value, oldValue, path));
    }
  }
  
  /**
   * Get state value at the specified path
   * @param {string} path - Dot-separated path to the property
   * @returns {any} Value at the path, or entire state if no path provided
   */
  getState(path) {
    if (!path) return this.state;
    return this.getNestedProperty(this.state, path);
  }
  
  /**
   * Subscribe to changes at a specific state path
   * @param {string} path - Dot-separated path to watch
   * @param {Function} callback - Function to call when path changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(path, callback) {
    if (!this.subscriptions.has(path)) {
      this.subscriptions.set(path, new Set());
    }
    this.subscriptions.get(path).add(callback);
    
    return () => this.subscriptions.get(path)?.delete(callback);
  }
  
  /**
   * Emit a custom event
   * @param {string} eventType - Type of event to emit
   * @param {any} data - Event data
   */
  emit(eventType, data) {
    this.eventEmitter.dispatchEvent(new CustomEvent(eventType, { detail: data }));
  }
  
  /**
   * Get nested property value using dot notation
   * @param {Object} obj - Object to traverse
   * @param {string} path - Dot-separated path
   * @returns {any} Value at path or undefined
   */
  getNestedProperty(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Set nested property value using dot notation, creating intermediate objects as needed
   * @param {Object} obj - Object to modify
   * @param {string} path - Dot-separated path
   * @param {any} value - Value to set
   */
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }
  
  /**
   * Get all tools as an array
   * @returns {Array} Array of tool objects
   */
  getToolsArray() {
    return Array.from(this.state.tools.values());
  }
  
  /**
   * Get all modules as an array
   * @returns {Array} Array of module objects
   */
  getModulesArray() {
    return Array.from(this.state.modules.values());
  }
  
  /**
   * Add a tool to the tools collection
   * @param {Object} tool - Tool object to add
   */
  addTool(tool) {
    if (tool && tool.name) {
      this.state.tools.set(tool.name, tool);
      this.emit('toolAdded', { tool });
    }
  }
  
  /**
   * Add a module to the modules collection
   * @param {Object} module - Module object to add
   */
  addModule(module) {
    if (module && module.name) {
      this.state.modules.set(module.name, module);
      this.emit('moduleAdded', { module });
    }
  }
  
  /**
   * Set multiple tools at once
   * @param {Array} toolsArray - Array of tool objects
   */
  setTools(toolsArray) {
    this.state.tools.clear();
    toolsArray.forEach(tool => {
      if (tool && tool.name) {
        this.state.tools.set(tool.name, tool);
      }
    });
    this.emit('toolsUpdated', { tools: toolsArray });
  }
  
  /**
   * Set multiple modules at once
   * @param {Array} modulesArray - Array of module objects
   */
  setModules(modulesArray) {
    this.state.modules.clear();
    modulesArray.forEach(module => {
      if (module && module.name) {
        this.state.modules.set(module.name, module);
      }
    });
    this.emit('modulesUpdated', { modules: modulesArray });
  }
  
  /**
   * Clear all state and subscriptions
   */
  destroy() {
    this.subscriptions.clear();
    this.state = null;
    this.eventEmitter = null;
  }
}