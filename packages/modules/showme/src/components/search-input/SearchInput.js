/**
 * SearchInput Component - Reusable search input following umbilical protocol
 * 
 * Provides search functionality with debouncing, clear button, and
 * real-time filtering capabilities for the ShowMe module.
 */

import { ShowMeBaseComponent } from '../base/ShowMeBaseComponent.js';

/**
 * SearchInput Instance Class
 */
class SearchInputInstance {
  constructor(umbilical, config) {
    this.umbilical = umbilical;
    this.config = config;
    this.element = null;
    this.inputElement = null;
    this.clearButton = null;
    this.eventListeners = [];
    this._isDestroyed = false;
    this.searchTimeout = null;
    this.currentValue = this.config.value || '';
    
    this.createElement();
    this.attachEventListeners();
    
    // Handle mount callback
    ShowMeBaseComponent.handleLifecycle('mount', umbilical, this);
  }

  /**
   * Create the search input container and elements
   */
  createElement() {
    // Create container
    this.element = ShowMeBaseComponent.createElement('div', 'showme-search-input', this.config);
    
    // Create input element
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'search';
    this.inputElement.className = 'search-input-field';
    this.inputElement.placeholder = this.config.placeholder || 'Search...';
    this.inputElement.setAttribute('role', 'searchbox');
    this.inputElement.setAttribute('aria-label', this.config.ariaLabel || 'Search input');
    
    if (this.config.value) {
      this.inputElement.value = this.config.value;
      this.currentValue = this.config.value;
    }

    // Create clear button
    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'search-clear-button';
    this.clearButton.innerHTML = '×';
    this.clearButton.title = 'Clear search';
    this.clearButton.setAttribute('aria-label', 'Clear search');
    this.clearButton.style.display = this.currentValue ? 'flex' : 'none';

    // Assemble structure
    this.element.appendChild(this.inputElement);
    this.element.appendChild(this.clearButton);

    // Apply styling
    this.applySearchInputStyles();
    
    // Append to DOM if parent provided
    if (this.config.dom) {
      this.config.dom.appendChild(this.element);
    }
  }

  /**
   * Apply search input styling
   */
  applySearchInputStyles() {
    // Container styles
    this.element.style.cssText = `
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
      max-width: ${this.config.maxWidth || '300px'};
      border: 1px solid #ccc;
      border-radius: 4px;
      background: white;
      overflow: hidden;
      transition: border-color 0.2s ease;
    `;

    // Input styles
    this.inputElement.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      border: none;
      outline: none;
      font-size: 14px;
      font-family: inherit;
      background: transparent;
      color: inherit;
      line-height: 1.4;
    `;

    // Clear button styles - set initial display based on current value
    const initialDisplay = this.currentValue ? 'flex' : 'none';
    this.clearButton.style.cssText = `
      display: ${initialDisplay};
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin-right: 6px;
      border: none;
      background: #f0f0f0;
      border-radius: 50%;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
      color: #666;
      transition: all 0.2s ease;
      flex-shrink: 0;
    `;

    // Add size-specific styling
    this.applySizeStyles();
    
    // Ensure CSS classes are available
    this.ensureSearchInputStyles();
  }

  /**
   * Apply size-specific styles
   */
  applySizeStyles() {
    const size = this.config.size;
    
    switch (size) {
      case 'small':
        this.inputElement.style.padding = '6px 10px';
        this.inputElement.style.fontSize = '12px';
        this.clearButton.style.width = '20px';
        this.clearButton.style.height = '20px';
        this.clearButton.style.fontSize = '14px';
        break;
      case 'large':
        this.inputElement.style.padding = '12px 16px';
        this.inputElement.style.fontSize = '16px';
        this.clearButton.style.width = '28px';
        this.clearButton.style.height = '28px';
        this.clearButton.style.fontSize = '18px';
        break;
      // 'medium' is default
    }
  }

  /**
   * Ensure search input CSS classes are available in document
   */
  ensureSearchInputStyles() {
    const styleId = 'showme-search-input-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .showme-search-input:focus-within {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
      }

      .showme-search-input.disabled {
        opacity: 0.5;
        pointer-events: none;
      }

      .search-input-field::placeholder {
        color: #9ca3af;
      }

      .search-input-field::-webkit-search-cancel-button {
        -webkit-appearance: none;
        display: none;
      }

      .search-clear-button:hover {
        background-color: #e5e7eb;
        color: #374151;
      }

      .search-clear-button:focus {
        outline: 2px solid #2563eb;
        outline-offset: 2px;
      }

      .search-clear-button:active {
        background-color: #d1d5db;
        transform: scale(0.95);
      }
    `;
    
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Input event handler for real-time search
    const inputHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      if (this._isDestroyed || this.config.disabled) return;
      
      const value = event.target.value;
      this.currentValue = value;
      
      // Show/hide clear button
      this.clearButton.style.display = value ? 'flex' : 'none';
      
      // Handle debounced search
      if (this.config.debounceMs > 0) {
        this.handleDebouncedSearch(value);
      } else {
        this.triggerSearch(value);
      }
    });

    // Keydown handler for special keys
    const keydownHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      if (this._isDestroyed || this.config.disabled) return;
      
      if (event.key === 'Enter') {
        event.preventDefault();
        // Update current value from input field before searching
        const currentInputValue = event.target.value;
        this.currentValue = currentInputValue;
        this.triggerSearch(currentInputValue, true); // Force immediate search
      } else if (event.key === 'Escape') {
        this.clear();
        if (this.config.onEscape) {
          this.config.onEscape(this);
        }
      }
    });

    // Clear button click handler
    const clearHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      event.preventDefault();
      this.clear();
    });

    // Focus/blur handlers
    const focusHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      if (this.config.onFocus) {
        try {
          this.config.onFocus(this.currentValue, this);
        } catch (error) {
          ShowMeBaseComponent.handleComponentError(error, 'SearchInput', this.umbilical);
        }
      }
    });

    const blurHandler = ShowMeBaseComponent.createBoundEventHandler(this, (event) => {
      if (this.config.onBlur) {
        try {
          this.config.onBlur(this.currentValue, this);
        } catch (error) {
          ShowMeBaseComponent.handleComponentError(error, 'SearchInput', this.umbilical);
        }
      }
    });

    // Attach listeners
    this.inputElement.addEventListener('input', inputHandler);
    this.inputElement.addEventListener('keydown', keydownHandler);
    this.inputElement.addEventListener('focus', focusHandler);
    this.inputElement.addEventListener('blur', blurHandler);
    this.clearButton.addEventListener('click', clearHandler);

    // Store for cleanup
    this.eventListeners.push(
      { element: this.inputElement, event: 'input', handler: inputHandler },
      { element: this.inputElement, event: 'keydown', handler: keydownHandler },
      { element: this.inputElement, event: 'focus', handler: focusHandler },
      { element: this.inputElement, event: 'blur', handler: blurHandler },
      { element: this.clearButton, event: 'click', handler: clearHandler }
    );
  }

  /**
   * Handle debounced search
   * @param {string} value - Search value
   */
  handleDebouncedSearch(value) {
    // Clear existing timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
    
    // Set new timeout
    this.searchTimeout = setTimeout(() => {
      this.triggerSearch(value);
    }, this.config.debounceMs);
  }

  /**
   * Trigger search callback
   * @param {string} value - Search value
   * @param {boolean} immediate - Whether this is an immediate search (e.g., from Enter key)
   */
  triggerSearch(value, immediate = false) {
    if (this.config.onSearch) {
      try {
        this.config.onSearch(value, this, { immediate });
      } catch (error) {
        ShowMeBaseComponent.handleComponentError(error, 'SearchInput', this.umbilical);
      }
    }
  }

  /**
   * Get current search value
   * @returns {string} Current search value
   */
  getValue() {
    return this.currentValue;
  }

  /**
   * Set search value
   * @param {string} value - New search value
   * @param {boolean} triggerSearch - Whether to trigger search callback
   */
  setValue(value, triggerSearch = false) {
    if (this._isDestroyed) return;
    
    this.currentValue = value;
    this.inputElement.value = value;
    this.clearButton.style.display = value ? 'flex' : 'none';
    
    if (triggerSearch) {
      this.triggerSearch(value);
    }
  }

  /**
   * Clear the search input
   */
  clear() {
    if (this._isDestroyed) return;
    
    this.setValue('');
    this.inputElement.focus();
    
    if (this.config.onClear) {
      try {
        this.config.onClear(this);
      } catch (error) {
        ShowMeBaseComponent.handleComponentError(error, 'SearchInput', this.umbilical);
      }
    }
    
    // Trigger search with empty value
    this.triggerSearch('');
  }

  /**
   * Focus the search input
   */
  focus() {
    if (this._isDestroyed) return;
    this.inputElement.focus();
  }

  /**
   * Blur the search input
   */
  blur() {
    if (this._isDestroyed) return;
    this.inputElement.blur();
  }

  /**
   * Set disabled state
   * @param {boolean} disabled - Whether to disable the input
   */
  setDisabled(disabled) {
    if (this._isDestroyed) return;
    
    this.config.disabled = disabled;
    this.inputElement.disabled = disabled;
    this.clearButton.disabled = disabled;
    
    if (disabled) {
      this.element.classList.add('disabled');
    } else {
      this.element.classList.remove('disabled');
    }
  }

  /**
   * Set placeholder text
   * @param {string} placeholder - New placeholder text
   */
  setPlaceholder(placeholder) {
    if (this._isDestroyed) return;
    this.inputElement.placeholder = placeholder;
  }

  /**
   * Get the DOM element
   * @returns {HTMLElement} Search input container element
   */
  getElement() {
    return this.element;
  }

  /**
   * Get the input field element
   * @returns {HTMLInputElement} Input field element
   */
  getInputElement() {
    return this.inputElement;
  }

  /**
   * Check if component is destroyed
   * @returns {boolean} True if destroyed
   */
  isDestroyed() {
    return this._isDestroyed;
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this._isDestroyed) return;
    
    // Clear search timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = null;
    }
    
    // Remove event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      if (element && typeof element.removeEventListener === 'function') {
        element.removeEventListener(event, handler);
      }
    });
    
    // Remove from DOM if still attached
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    
    // Handle destroy callback
    ShowMeBaseComponent.handleLifecycle('destroy', this.umbilical, this);
    
    // Clean up references
    this.element = null;
    this.inputElement = null;
    this.clearButton = null;
    this.eventListeners = [];
    this._isDestroyed = true;
  }
}

/**
 * SearchInput Component Factory
 */
export const SearchInput = {
  create(umbilical) {
    // 1. Introspection mode
    if (umbilical && umbilical.describe) {
      const requirements = ShowMeBaseComponent.defineRequirements();
      
      // Add search input-specific requirements
      requirements.add('onSearch', 'function', 'Search event handler - optional', false);
      requirements.add('onClear', 'function', 'Clear event handler - optional', false);
      requirements.add('onFocus', 'function', 'Focus event handler - optional', false);
      requirements.add('onBlur', 'function', 'Blur event handler - optional', false);
      requirements.add('onEscape', 'function', 'Escape key handler - optional', false);
      requirements.add('placeholder', 'string', 'Input placeholder text - optional', false);
      requirements.add('value', 'string', 'Initial search value - optional', false);
      requirements.add('ariaLabel', 'string', 'ARIA label for accessibility - optional', false);
      requirements.add('debounceMs', 'number', 'Debounce delay in milliseconds - optional', false);
      requirements.add('size', 'string', 'Input size (small|medium|large) - optional', false);
      requirements.add('maxWidth', 'string', 'Maximum width CSS value - optional', false);
      
      umbilical.describe(requirements);
      return;
    }

    // 2. Validation mode
    if (umbilical && umbilical.validate) {
      const checks = ShowMeBaseComponent.validateCapabilities(umbilical);
      
      const searchInputChecks = {
        ...checks,
        hasValidCallbacks: ['onSearch', 'onClear', 'onFocus', 'onBlur', 'onEscape'].every(cb => 
          !umbilical[cb] || typeof umbilical[cb] === 'function'
        ),
        hasValidPlaceholder: !umbilical.placeholder || typeof umbilical.placeholder === 'string',
        hasValidValue: !umbilical.value || typeof umbilical.value === 'string',
        hasValidDebounce: !umbilical.debounceMs || (typeof umbilical.debounceMs === 'number' && umbilical.debounceMs >= 0),
        hasValidSize: !umbilical.size || ['small', 'medium', 'large'].includes(umbilical.size),
        hasValidMaxWidth: !umbilical.maxWidth || typeof umbilical.maxWidth === 'string'
      };
      
      return umbilical.validate(searchInputChecks);
    }

    // 3. Instance creation mode
    if (!umbilical) {
      throw new Error('SearchInput requires an umbilical object');
    }

    // Extract configuration
    const config = ShowMeBaseComponent.extractConfig(umbilical, {
      placeholder: 'Search...',
      value: '',
      debounceMs: 300,
      size: 'medium',
      maxWidth: '300px',
      ariaLabel: 'Search input',
      onSearch: umbilical.onSearch,
      onClear: umbilical.onClear,
      onFocus: umbilical.onFocus,
      onBlur: umbilical.onBlur,
      onEscape: umbilical.onEscape
    });

    // Create and return instance
    return new SearchInputInstance(umbilical, config);
  }
};