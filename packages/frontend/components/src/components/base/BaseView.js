/**
 * BaseView - Foundation class for MVVM View layer
 * 
 * Provides common DOM management patterns found across complex components:
 * - Container setup and styling
 * - Event handler binding and cleanup
 * - Theme management
 * - Render cycle coordination
 * - Accessibility support
 */

export class BaseView {
  constructor(dom, config = {}) {
    this.config = { ...config };
    this.destroyed = false;
    
    // DOM references
    this.parentDom = dom;
    this.container = null;
    this.elements = new Map(); // Named element references
    
    // Event management
    this.eventListeners = new Map(); // DOM event listeners for cleanup
    this.viewEventListeners = new Set(); // View event listeners for internal communication
    
    // State
    this.currentTheme = config.theme || 'light';
    this.renderRequested = false;
    this.renderFrame = null;
    
    // Initialize
    this._createContainer();
    this._applyTheme();
    
    if (config.accessible !== false) {
      this._setupAccessibility();
    }
  }

  /**
   * Create the main container element - Override in subclasses
   * @protected
   */
  _createContainer() {
    this.container = document.createElement('div');
    this.container.className = this._getContainerClasses().join(' ');
    this.parentDom.appendChild(this.container);
    
    // Store reference for cleanup
    this.elements.set('container', this.container);
  }

  /**
   * Get container CSS classes - Override in subclasses
   * @returns {Array} Array of CSS class names
   * @protected
   */
  _getContainerClasses() {
    const baseClass = this.config.baseClass || 'base-component';
    return [
      baseClass,
      `${baseClass}-view`,
      `theme-${this.currentTheme}`
    ];
  }

  /**
   * Apply theme to container
   * @protected
   */
  _applyTheme() {
    if (!this.container) return;
    
    // Remove existing theme classes
    this.container.classList.remove('theme-light', 'theme-dark');
    
    // Add new theme class
    this.container.classList.add(`theme-${this.currentTheme}`);
    
    this._emitViewEvent('themeChanged', { theme: this.currentTheme });
  }

  /**
   * Setup accessibility attributes - Override in subclasses
   * @protected
   */
  _setupAccessibility() {
    if (!this.container) return;
    
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('tabindex', '0');
    
    if (this.config.ariaLabel) {
      this.container.setAttribute('aria-label', this.config.ariaLabel);
    }
  }

  /**
   * Set theme
   * @param {string} theme - Theme name (light|dark)
   */
  setTheme(theme) {
    if (theme === this.currentTheme) return;
    
    this.currentTheme = theme;
    this._applyTheme();
  }

  /**
   * Get current theme
   * @returns {string} Current theme name
   */
  getTheme() {
    return this.currentTheme;
  }

  /**
   * Add named element reference
   * @param {string} name - Element name
   * @param {HTMLElement} element - DOM element
   */
  addElement(name, element) {
    this.elements.set(name, element);
  }

  /**
   * Get named element
   * @param {string} name - Element name
   * @returns {HTMLElement|null} DOM element or null
   */
  getElement(name) {
    return this.elements.get(name) || null;
  }

  /**
   * Remove named element
   * @param {string} name - Element name
   */
  removeElement(name) {
    const element = this.elements.get(name);
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
    this.elements.delete(name);
  }

  /**
   * Add DOM event listener with automatic cleanup
   * @param {HTMLElement} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   * @param {Object} options - Event options
   */
  addEventListener(element, event, handler, options = {}) {
    const key = `${element}_${event}_${handler}`;
    
    // Remove existing listener if present
    this.removeEventListener(element, event, handler);
    
    // Add new listener
    element.addEventListener(event, handler, options);
    
    // Store for cleanup
    this.eventListeners.set(key, { element, event, handler, options });
  }

  /**
   * Remove DOM event listener
   * @param {HTMLElement} element - Target element
   * @param {string} event - Event type
   * @param {Function} handler - Event handler
   */
  removeEventListener(element, event, handler) {
    const key = `${element}_${event}_${handler}`;
    const stored = this.eventListeners.get(key);
    
    if (stored) {
      element.removeEventListener(event, handler);
      this.eventListeners.delete(key);
    }
  }

  /**
   * Add view event listener for internal communication
   * @param {Function} listener - Event listener
   */
  addViewEventListener(listener) {
    if (typeof listener === 'function') {
      this.viewEventListeners.add(listener);
    }
  }

  /**
   * Remove view event listener
   * @param {Function} listener - Event listener
   */
  removeViewEventListener(listener) {
    this.viewEventListeners.delete(listener);
  }

  /**
   * Request a render update (debounced)
   */
  requestRender() {
    if (this.renderRequested || this.destroyed) return;
    
    this.renderRequested = true;
    this.renderFrame = requestAnimationFrame(() => {
      this.renderRequested = false;
      this.renderFrame = null;
      this.render();
    });
  }

  /**
   * Cancel pending render
   */
  cancelRender() {
    if (this.renderFrame) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
      this.renderRequested = false;
    }
  }

  /**
   * Render the view - Override in subclasses
   */
  render() {
    if (this.destroyed) return;
    
    // Base implementation - subclasses should override
    this._emitViewEvent('rendered', { view: this });
  }

  /**
   * Show loading state
   * @param {string} message - Loading message
   */
  showLoading(message = 'Loading...') {
    this._setLoadingState(true, message);
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this._setLoadingState(false);
  }

  /**
   * Show error state
   * @param {string} error - Error message
   */
  showError(error) {
    this._setErrorState(true, error);
  }

  /**
   * Hide error state
   */
  hideError() {
    this._setErrorState(false);
  }

  /**
   * Show empty state
   * @param {string} message - Empty state message
   */
  showEmpty(message = 'No data available') {
    this._setEmptyState(true, message);
  }

  /**
   * Hide empty state
   */
  hideEmpty() {
    this._setEmptyState(false);
  }

  /**
   * Scroll element into view
   * @param {HTMLElement|string} elementOrId - Element or element ID
   * @param {Object} options - Scroll options
   */
  scrollToElement(elementOrId, options = { behavior: 'smooth', block: 'nearest' }) {
    let element;
    
    if (typeof elementOrId === 'string') {
      element = this.elements.get(elementOrId) || document.getElementById(elementOrId);
    } else {
      element = elementOrId;
    }
    
    if (element && element.scrollIntoView) {
      element.scrollIntoView(options);
    }
  }

  /**
   * Focus element
   * @param {HTMLElement|string} elementOrId - Element or element ID
   */
  focusElement(elementOrId) {
    let element;
    
    if (typeof elementOrId === 'string') {
      element = this.elements.get(elementOrId) || document.getElementById(elementOrId);
    } else {
      element = elementOrId;
    }
    
    if (element && element.focus) {
      element.focus();
    }
  }

  /**
   * Get view statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      elements: this.elements.size,
      eventListeners: this.eventListeners.size,
      viewEventListeners: this.viewEventListeners.size,
      currentTheme: this.currentTheme,
      renderRequested: this.renderRequested,
      destroyed: this.destroyed
    };
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.destroyed) return;
    
    this.destroyed = true;
    
    // Cancel pending render
    this.cancelRender();
    
    // Remove all DOM event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners.clear();
    
    // Clear view event listeners
    this.viewEventListeners.clear();
    
    // Remove container from DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Clear references
    this.elements.clear();
    this.container = null;
    this.parentDom = null;
  }

  // Protected methods

  /**
   * Set loading state
   * @param {boolean} loading - Loading state
   * @param {string} message - Loading message
   * @protected
   */
  _setLoadingState(loading, message = '') {
    if (!this.container) return;
    
    this.container.classList.toggle('loading', loading);
    this.container.setAttribute('aria-busy', loading);
    
    if (loading && message) {
      this.container.setAttribute('aria-label', message);
    } else {
      this.container.removeAttribute('aria-label');
    }
    
    this._emitViewEvent('loadingChanged', { loading, message });
  }

  /**
   * Set error state
   * @param {boolean} error - Error state
   * @param {string} message - Error message
   * @protected
   */
  _setErrorState(error, message = '') {
    if (!this.container) return;
    
    this.container.classList.toggle('error', error);
    
    if (error) {
      this.container.setAttribute('role', 'alert');
      if (message) {
        this.container.setAttribute('aria-label', `Error: ${message}`);
      }
    } else {
      this.container.setAttribute('role', 'region');
      this.container.removeAttribute('aria-label');
    }
    
    this._emitViewEvent('errorChanged', { error, message });
  }

  /**
   * Set empty state
   * @param {boolean} empty - Empty state
   * @param {string} message - Empty message
   * @protected
   */
  _setEmptyState(empty, message = '') {
    if (!this.container) return;
    
    this.container.classList.toggle('empty', empty);
    
    if (empty && message) {
      this.container.setAttribute('aria-label', message);
    }
    
    this._emitViewEvent('emptyChanged', { empty, message });
  }

  /**
   * Emit view event to listeners
   * @param {string} type - Event type
   * @param {*} data - Event data
   * @protected
   */
  _emitViewEvent(type, data) {
    if (this.destroyed || this.viewEventListeners.size === 0) return;
    
    const event = { type, data, view: this, timestamp: Date.now() };
    
    this.viewEventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('View event listener error:', error);
      }
    });
  }
}