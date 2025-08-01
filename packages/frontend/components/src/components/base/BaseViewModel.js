/**
 * BaseViewModel - Foundation class for MVVM ViewModel layer
 * 
 * Provides common Model-View coordination patterns found across complex components:
 * - Model-View event coordination
 * - Command pattern implementation
 * - State synchronization
 * - Lifecycle management
 * - Common interaction patterns
 */

export class BaseViewModel {
  constructor(model, view, config = {}) {
    this.model = model;
    this.view = view;
    this.config = { ...config };
    this.destroyed = false;
    
    // Command system
    this.commands = new Map();
    this.commandHistory = [];
    this.maxHistorySize = config.maxHistorySize || 100;
    
    // Event coordination
    this.modelListener = null;
    this.viewListener = null;
    
    // State management
    this.state = {
      loading: false,
      error: null,
      ready: false
    };
    
    // External event listeners
    this.eventListeners = new Map();
    
    // Initialize
    this._setupEventCoordination();
    this._initializeCommands();
    
    // Mark as ready
    this.state.ready = true;
    this._emitEvent('ready', { viewModel: this });
  }

  /**
   * Setup Model-View event coordination
   * @protected
   */
  _setupEventCoordination() {
    // Listen to model changes
    this.modelListener = (event) => {
      this._handleModelEvent(event);
    };
    this.model.addChangeListener(this.modelListener);
    
    // Listen to view events
    this.viewListener = (event) => {
      this._handleViewEvent(event);
    };
    this.view.addViewEventListener(this.viewListener);
  }

  /**
   * Initialize command system - Override in subclasses
   * @protected
   */
  _initializeCommands() {
    // Base commands that most components need
    this.registerCommand('render', this._renderCommand.bind(this));
    this.registerCommand('setTheme', this._setThemeCommand.bind(this));
    this.registerCommand('showLoading', this._showLoadingCommand.bind(this));
    this.registerCommand('hideLoading', this._hideLoadingCommand.bind(this));
    this.registerCommand('showError', this._showErrorCommand.bind(this));
    this.registerCommand('hideError', this._hideErrorCommand.bind(this));
  }

  /**
   * Register a command
   * @param {string} name - Command name
   * @param {Function} handler - Command handler function
   */
  registerCommand(name, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`Command handler for '${name}' must be a function`);
    }
    
    this.commands.set(name, handler);
  }

  /**
   * Execute a command
   * @param {string} name - Command name
   * @param {*} params - Command parameters
   * @returns {*} Command result
   */
  executeCommand(name, params = {}) {
    if (this.destroyed) {
      console.warn(`Cannot execute command '${name}' on destroyed ViewModel`);
      return null;
    }
    
    const command = this.commands.get(name);
    if (!command) {
      console.warn(`Unknown command: ${name}`);
      return null;
    }
    
    try {
      const result = command(params);
      
      // Track command in history
      this._addToHistory(name, params, result);
      
      return result;
    } catch (error) {
      console.error(`Command '${name}' failed:`, error);
      this._handleError(error);
      return null;
    }
  }

  /**
   * Check if command can be executed
   * @param {string} name - Command name
   * @returns {boolean} True if command can be executed
   */
  canExecuteCommand(name) {
    return !this.destroyed && this.commands.has(name) && this.state.ready;
  }

  /**
   * Get command history
   * @returns {Array} Command history
   */
  getCommandHistory() {
    return [...this.commandHistory];
  }

  /**
   * Clear command history
   */
  clearCommandHistory() {
    this.commandHistory = [];
  }

  /**
   * Render the view with current model data
   */
  render() {
    this.executeCommand('render');
  }

  /**
   * Set theme
   * @param {string} theme - Theme name
   */
  setTheme(theme) {
    this.executeCommand('setTheme', { theme });
  }

  /**
   * Show loading state
   * @param {string} message - Loading message
   */
  showLoading(message) {
    this.executeCommand('showLoading', { message });
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.executeCommand('hideLoading');
  }

  /**
   * Show error
   * @param {string} error - Error message
   */
  showError(error) {
    this.executeCommand('showError', { error });
  }

  /**
   * Hide error
   */
  hideError() {
    this.executeCommand('hideError');
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Set state value
   * @param {string} key - State key
   * @param {*} value - State value
   */
  setState(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    
    this._emitEvent('stateChanged', { key, value, oldValue });
  }

  /**
   * Add event listener
   * @param {string} eventType - Event type
   * @param {Function} listener - Event listener
   */
  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType).add(listener);
  }

  /**
   * Remove event listener
   * @param {string} eventType - Event type
   * @param {Function} listener - Event listener
   */
  removeEventListener(eventType, listener) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * Get ViewModel statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      commands: this.commands.size,
      commandHistory: this.commandHistory.length,
      eventListeners: Array.from(this.eventListeners.entries()).reduce(
        (total, [, listeners]) => total + listeners.size, 0
      ),
      state: { ...this.state },
      ready: this.state.ready,
      destroyed: this.destroyed
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.setState('ready', false);
    
    // Remove model listener
    if (this.modelListener) {
      this.model.removeChangeListener(this.modelListener);
      this.modelListener = null;
    }
    
    // Remove view listener
    if (this.viewListener) {
      this.view.removeViewEventListener(this.viewListener);
      this.viewListener = null;
    }
    
    // Clear commands and history
    this.commands.clear();
    this.commandHistory = [];
    
    // Clear event listeners
    this.eventListeners.clear();
    
    // Emit destroyed event
    this._emitEvent('destroyed', { viewModel: this });
  }

  // Protected methods

  /**
   * Handle model events - Override in subclasses
   * @param {Object} event - Model event
   * @protected
   */
  _handleModelEvent(event) {
    switch (event.type) {
      case 'dataChanged':
        this.render();
        break;
      case 'itemChanged':
      case 'itemRemoved':
      case 'metadataChanged':
      case 'stateChanged':
        this.view.requestRender();
        break;
      case 'batchChanged':
        this.render();
        break;
    }
    
    // Forward model events
    this._emitEvent('modelEvent', event);
  }

  /**
   * Handle view events - Override in subclasses
   * @param {Object} event - View event
   * @protected
   */
  _handleViewEvent(event) {
    switch (event.type) {
      case 'rendered':
        this._emitEvent('rendered', event.data);
        break;
      case 'themeChanged':
        this._emitEvent('themeChanged', event.data);
        break;
      case 'loadingChanged':
      case 'errorChanged':
      case 'emptyChanged':
        this.setState(event.type.replace('Changed', ''), event.data);
        break;
    }
    
    // Forward view events
    this._emitEvent('viewEvent', event);
  }

  /**
   * Handle errors
   * @param {Error} error - Error object
   * @protected
   */
  _handleError(error) {
    this.setState('error', error.message);
    this.showError(error.message);
    this._emitEvent('error', { error, viewModel: this });
  }

  /**
   * Add command to history
   * @param {string} name - Command name
   * @param {*} params - Command parameters
   * @param {*} result - Command result
   * @protected
   */
  _addToHistory(name, params, result) {
    const entry = {
      name,
      params,
      result,
      timestamp: Date.now()
    };
    
    this.commandHistory.push(entry);
    
    // Limit history size
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    }
  }

  /**
   * Emit event to listeners
   * @param {string} type - Event type
   * @param {*} data - Event data
   * @protected
   */
  _emitEvent(type, data) {
    const listeners = this.eventListeners.get(type);
    if (!listeners || listeners.size === 0) return;
    
    const event = { type, data, viewModel: this, timestamp: Date.now() };
    
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('ViewModel event listener error:', error);
      }
    });
  }

  // Built-in command implementations

  /**
   * Render command implementation
   * @protected
   */
  _renderCommand() {
    if (this.destroyed) return false;
    
    this.view.render();
    return true;
  }

  /**
   * Set theme command implementation
   * @protected
   */
  _setThemeCommand({ theme }) {
    if (!theme || this.destroyed) return false;
    
    this.view.setTheme(theme);
    return true;
  }

  /**
   * Show loading command implementation
   * @protected
   */
  _showLoadingCommand({ message }) {
    if (this.destroyed) return false;
    
    this.setState('loading', true);
    this.view.showLoading(message);
    return true;
  }

  /**
   * Hide loading command implementation
   * @protected
   */
  _hideLoadingCommand() {
    if (this.destroyed) return false;
    
    this.setState('loading', false);
    this.view.hideLoading();
    return true;
  }

  /**
   * Show error command implementation
   * @protected
   */
  _showErrorCommand({ error }) {
    if (this.destroyed) return false;
    
    this.setState('error', error);
    this.view.showError(error);
    return true;
  }

  /**
   * Hide error command implementation
   * @protected
   */
  _hideErrorCommand() {
    if (this.destroyed) return false;
    
    this.setState('error', null);
    this.view.hideError();
    return true;
  }
}