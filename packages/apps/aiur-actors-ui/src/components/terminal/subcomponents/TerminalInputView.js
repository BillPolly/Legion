/**
 * TerminalInputView - Input subcomponent for terminal
 * Handles input field, autocomplete, and keyboard interactions
 */
import { BaseView } from '../../base/BaseView.js';

export class TerminalInputView extends BaseView {
  constructor(container) {
    super();
    this.container = container;
    
    // Elements
    this.inputLine = null;
    this.promptElement = null;
    this.inputElement = null;
    this.autocompleteElement = null;
    
    // Event callbacks
    this.onInput = null;
    this.onKeyDown = null;
    this.onCommand = null;
    this.onAutocomplete = null;
    
    // State
    this.prompt = '> ';
    this.executing = false;
    this.autocompleteVisible = false;
    this.suggestions = [];
    this.selectedIndex = -1;
  }

  /**
   * Render the input component
   * @param {Object} options - Render options
   */
  render(options = {}) {
    // Only create DOM structure if it doesn't exist
    if (!this.inputLine) {
      this.createDOMStructure();
      this.bindEvents();
    }
    
    // Update with options
    this.updateWithOptions(options);
  }
  
  /**
   * Create DOM structure (only called once)
   */
  createDOMStructure() {
    // Create input line container
    this.inputLine = this.createElement('div', ['terminal-input-line']);
    
    // Create prompt
    this.promptElement = this.createElement('span', ['terminal-prompt']);
    this.promptElement.textContent = this.prompt;
    this.inputLine.appendChild(this.promptElement);
    
    // Create input wrapper
    const inputWrapper = this.createElement('div', ['terminal-input-wrapper']);
    
    // Create input element
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.className = 'terminal-input';
    this.inputElement.setAttribute('autocomplete', 'off');
    this.inputElement.setAttribute('spellcheck', 'false');
    this.inputElement.setAttribute('placeholder', 'Enter command...');
    
    inputWrapper.appendChild(this.inputElement);
    this.inputLine.appendChild(inputWrapper);
    
    // Create autocomplete dropdown
    this.autocompleteElement = this.createElement('div', ['terminal-autocomplete']);
    this.autocompleteElement.style.display = 'none';
    this.inputLine.appendChild(this.autocompleteElement);
    
    // Add to container
    this.container.appendChild(this.inputLine);
  }
  
  /**
   * Update component with options (without recreating DOM)
   */
  updateWithOptions(options = {}) {
    // Update prompt if provided
    if (options.prompt && this.promptElement) {
      this.prompt = options.prompt;
      this.promptElement.textContent = this.prompt;
    }
    
    // Update theme if provided
    if (options.theme && this.inputLine) {
      this.inputLine.className = `terminal-input-line ${options.theme ? `theme-${options.theme}` : ''}`;
    }
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Input events
    this.addTrackedListener(this.inputElement, 'input', (e) => {
      if (this.onInput) {
        this.onInput(e.target.value, e);
      }
    });
    
    // Keyboard events
    this.addTrackedListener(this.inputElement, 'keydown', (e) => {
      this.handleKeyDown(e);
    });
    
    // Focus management - keep input focused when clicking in terminal area
    this.addTrackedListener(this.container.parentElement, 'click', (e) => {
      // Don't interfere with text selection
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return;
      }
      
      // Focus input unless clicking on the input itself
      if (e.target !== this.inputElement) {
        this.focus();
      }
    });
    
    // Autocomplete item clicks
    this.addTrackedListener(this.autocompleteElement, 'click', (e) => {
      const item = e.target.closest('.autocomplete-item');
      if (item) {
        const index = parseInt(item.dataset.index);
        this.selectSuggestion(index);
      }
    });
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeyDown(event) {
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.executeCommand();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        if (this.autocompleteVisible) {
          this.navigateAutocomplete(-1);
        } else if (this.onKeyDown) {
          this.onKeyDown('historyUp', event);
        }
        break;
        
      case 'ArrowDown':
        event.preventDefault();
        if (this.autocompleteVisible) {
          this.navigateAutocomplete(1);
        } else if (this.onKeyDown) {
          this.onKeyDown('historyDown', event);
        }
        break;
        
      case 'Tab':
        event.preventDefault();
        if (this.autocompleteVisible && this.selectedIndex >= 0) {
          this.selectSuggestion(this.selectedIndex);
        } else if (this.onAutocomplete) {
          this.onAutocomplete(this.inputElement.value);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        if (this.autocompleteVisible) {
          this.hideAutocomplete();
        } else {
          this.clear();
        }
        break;
        
      default:
        // Pass other keys to handler
        if (this.onKeyDown) {
          this.onKeyDown(event.key, event);
        }
    }
  }

  /**
   * Execute the current command
   */
  executeCommand() {
    const command = this.getValue().trim();
    if (!command || this.executing) {
      return;
    }
    
    if (this.onCommand) {
      this.onCommand(command);
    }
    
    // Clear input
    this.setValue('');
    this.hideAutocomplete();
  }

  /**
   * Navigate autocomplete suggestions
   * @param {number} direction - 1 for down, -1 for up
   */
  navigateAutocomplete(direction) {
    if (!this.autocompleteVisible || this.suggestions.length === 0) {
      return;
    }
    
    this.selectedIndex += direction;
    
    // Wrap around
    if (this.selectedIndex < 0) {
      this.selectedIndex = this.suggestions.length - 1;
    } else if (this.selectedIndex >= this.suggestions.length) {
      this.selectedIndex = 0;
    }
    
    this.updateAutocompleteSelection();
  }

  /**
   * Select an autocomplete suggestion
   * @param {number} index - Suggestion index
   */
  selectSuggestion(index) {
    if (index < 0 || index >= this.suggestions.length) {
      return;
    }
    
    const suggestion = this.suggestions[index];
    this.setValue(suggestion.value || suggestion);
    this.hideAutocomplete();
    this.focus();
  }

  /**
   * Show autocomplete suggestions
   * @param {Array} suggestions - Suggestions array
   */
  showAutocomplete(suggestions) {
    this.suggestions = suggestions || [];
    this.selectedIndex = -1;
    
    if (this.suggestions.length === 0) {
      this.hideAutocomplete();
      return;
    }
    
    // Update autocomplete items efficiently without innerHTML
    this.updateAutocompleteItems();
    
    this.autocompleteElement.style.display = 'block';
    this.autocompleteVisible = true;
    
    // Auto-select first item
    if (this.suggestions.length > 0) {
      this.selectedIndex = 0;
      this.updateAutocompleteSelection();
    }
  }
  
  /**
   * Update autocomplete items without recreating DOM
   */
  updateAutocompleteItems() {
    const existingItems = this.autocompleteElement.querySelectorAll('.autocomplete-item');
    
    // Update or create items as needed
    this.suggestions.forEach((suggestion, index) => {
      let item = existingItems[index];
      
      if (!item) {
        // Create new item if doesn't exist
        item = this.createElement('div', ['autocomplete-item']);
        item.dataset.index = index;
        this.autocompleteElement.appendChild(item);
      } else {
        // Reset for reuse
        item.className = 'autocomplete-item';
        item.dataset.index = index;
      }
      
      if (typeof suggestion === 'object') {
        // Update complex suggestion
        this.updateComplexSuggestion(item, suggestion);
      } else {
        // Simple string - just update text
        item.textContent = suggestion;
      }
    });
    
    // Remove extra items if suggestions decreased
    for (let i = this.suggestions.length; i < existingItems.length; i++) {
      existingItems[i].remove();
    }
  }
  
  /**
   * Update complex suggestion item without recreating
   */
  updateComplexSuggestion(item, suggestion) {
    // Get or create name element
    let nameEl = item.querySelector('.autocomplete-name');
    if (!nameEl) {
      nameEl = this.createElement('div', ['autocomplete-name']);
      item.appendChild(nameEl);
    }
    nameEl.textContent = suggestion.value || suggestion.name;
    
    // Handle description
    let descEl = item.querySelector('.autocomplete-description');
    if (suggestion.description) {
      if (!descEl) {
        descEl = this.createElement('div', ['autocomplete-description']);
        item.appendChild(descEl);
      }
      descEl.textContent = suggestion.description;
    } else if (descEl) {
      descEl.remove();
    }
    
    // Handle type class
    if (suggestion.type) {
      item.classList.add(`autocomplete-type-${suggestion.type}`);
    }
  }

  /**
   * Hide autocomplete
   */
  hideAutocomplete() {
    this.autocompleteElement.style.display = 'none';
    this.autocompleteVisible = false;
    this.selectedIndex = -1;
    this.suggestions = [];
  }

  /**
   * Update autocomplete selection highlighting
   */
  updateAutocompleteSelection() {
    const items = this.autocompleteElement.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Set input value
   * @param {string} value - Input value
   */
  setValue(value) {
    this.inputElement.value = value || '';
  }

  /**
   * Get input value
   * @returns {string} Input value
   */
  getValue() {
    return this.inputElement.value || '';
  }

  /**
   * Set prompt text
   * @param {string} prompt - Prompt text
   */
  setPrompt(prompt) {
    this.prompt = prompt;
    if (this.promptElement) {
      this.promptElement.textContent = prompt;
    }
  }

  /**
   * Focus the input
   */
  focus() {
    if (this.inputElement) {
      // Use timeout to ensure proper focus
      setTimeout(() => {
        this.inputElement.focus();
      }, 0);
    }
  }

  /**
   * Clear the input
   */
  clear() {
    this.setValue('');
    this.hideAutocomplete();
  }

  /**
   * Set executing state
   * @param {boolean} executing - Whether executing
   */
  setExecuting(executing) {
    this.executing = executing;
    
    if (this.inputElement) {
      this.inputElement.disabled = executing;
    }
    
    if (this.inputLine) {
      if (executing) {
        this.inputLine.classList.add('executing');
      } else {
        this.inputLine.classList.remove('executing');
      }
    }
  }

  /**
   * Set placeholder text
   * @param {string} placeholder - Placeholder text
   */
  setPlaceholder(placeholder) {
    if (this.inputElement) {
      this.inputElement.setAttribute('placeholder', placeholder || '');
    }
  }

  /**
   * Create DOM element with classes and attributes
   * @param {string} tag - Element tag
   * @param {Array} classes - CSS classes
   * @param {Object} attributes - Element attributes
   * @returns {HTMLElement} Created element
   */
  createElement(tag, classes = [], attributes = {}) {
    const element = document.createElement(tag);
    
    if (classes.length > 0) {
      element.classList.add(...classes);
    }
    
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    
    return element;
  }

  /**
   * Clean up
   */
  destroy() {
    this.hideAutocomplete();
    
    // Clear callbacks
    this.onInput = null;
    this.onKeyDown = null;
    this.onCommand = null;
    this.onAutocomplete = null;
    
    // Clear state
    this.suggestions = [];
    
    super.destroy();
  }
}