/**
 * TerminalView - Main terminal view component
 * Coordinates subcomponents: input, output, and autocomplete
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';
import { TerminalInputView } from './subcomponents/TerminalInputView.js';
import { TerminalOutputView } from './subcomponents/TerminalOutputView.js';

export class TerminalView extends ExtendedBaseView {
  constructor(dom) {
    super(dom);
    
    // Main elements
    this.terminal = null;
    this.outputContainer = null;
    this.inputContainer = null;
    
    // Subcomponents
    this.outputView = null;
    this.inputView = null;
    
    // Event handlers
    this.onInput = null;
    this.onKeyDown = null;
    this.onCommand = null;
    this.onAutocomplete = null;
  }

  /**
   * Render the terminal UI
   * @param {Object} options - Render options
   */
  render(options = {}) {
    // Clear existing content
    this.dom.innerHTML = '';
    
    // Create terminal container
    this.terminal = this.createElement('div', ['terminal']);
    
    // Apply theme
    if (options.theme) {
      this.terminal.classList.add(`terminal-theme-${options.theme}`);
    }
    
    // Create output container
    this.outputContainer = this.createElement('div', ['terminal-output-container']);
    this.terminal.appendChild(this.outputContainer);
    
    // Create input container
    this.inputContainer = this.createElement('div', ['terminal-input-container']);
    this.terminal.appendChild(this.inputContainer);
    
    // Add to DOM
    this.dom.appendChild(this.terminal);
    
    // Create subcomponents
    this.createSubcomponents(options);
    
    // Setup coordination between subcomponents
    this.setupCoordination();
  }

  /**
   * Create and initialize subcomponents
   * @param {Object} options - Render options
   */
  createSubcomponents(options) {
    // Create output view
    this.outputView = new TerminalOutputView(this.outputContainer);
    this.outputView.render({
      theme: options.theme,
      maxLines: options.maxOutputLines || 10000
    });
    
    // Create input view
    this.inputView = new TerminalInputView(this.inputContainer);
    this.inputView.render({
      prompt: options.prompt || '> ',
      theme: options.theme
    });
  }

  /**
   * Setup coordination between subcomponents
   */
  setupCoordination() {
    // Input view callbacks
    this.inputView.onInput = (value, event) => {
      if (this.onInput) {
        this.onInput(value, event);  // FIX: Pass both value and event correctly
      }
    };
    
    this.inputView.onKeyDown = (key, event) => {
      if (this.onKeyDown) {
        this.onKeyDown(key, event);  // FIX: Pass both key and event correctly
      }
    };
    
    this.inputView.onCommand = (command) => {
      if (this.onCommand) {
        this.onCommand(command);
      }
    };
    
    this.inputView.onAutocomplete = (partial) => {
      if (this.onAutocomplete) {
        this.onAutocomplete(partial);
      }
    };
  }

  /**
   * Append output line
   * @param {Object} output - Output object
   * @returns {string} Line ID
   */
  appendOutput(output) {
    if (this.outputView) {
      return this.outputView.addOutput(output);
    }
  }

  /**
   * Append multiple output lines
   * @param {Array} outputs - Array of output objects
   */
  renderOutput(outputs) {
    if (this.outputView) {
      this.outputView.addOutputs(outputs);
    }
  }

  /**
   * Clear output
   */
  clearOutput() {
    if (this.outputView) {
      this.outputView.clear();
    }
  }

  /**
   * Render current command (for history navigation)
   * @param {string} command - Current command
   * @param {number} cursorPosition - Cursor position (unused with input element)
   */
  renderCommand(command, cursorPosition) {
    if (this.inputView) {
      this.inputView.setValue(command);
    }
  }

  /**
   * Show autocomplete suggestions
   * @param {Array} suggestions - Array of suggestions
   * @param {number} selectedIndex - Selected index
   */
  showAutocomplete(suggestions, selectedIndex = 0) {
    if (this.inputView) {
      this.inputView.showAutocomplete(suggestions);
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        this.inputView.selectedIndex = selectedIndex;
        this.inputView.updateAutocompleteSelection();
      }
    }
  }

  /**
   * Hide autocomplete dropdown
   */
  hideAutocomplete() {
    if (this.inputView) {
      this.inputView.hideAutocomplete();
    }
  }

  /**
   * Update autocomplete selection
   * @param {number} selectedIndex - New selected index
   */
  updateAutocompleteSelection(selectedIndex) {
    if (this.inputView) {
      this.inputView.selectedIndex = selectedIndex;
      this.inputView.updateAutocompleteSelection();
    }
  }

  /**
   * Focus the input
   */
  focusInput() {
    if (this.inputView) {
      this.inputView.focus();
    }
  }

  /**
   * Set prompt text
   * @param {string} prompt - Prompt text
   */
  setPrompt(prompt) {
    if (this.inputView) {
      this.inputView.setPrompt(prompt);
    }
  }

  /**
   * Set executing state
   * @param {boolean} executing - Whether executing
   */
  setExecuting(executing) {
    if (this.inputView) {
      this.inputView.setExecuting(executing);
    }
    
    if (this.terminal) {
      if (executing) {
        this.terminal.classList.add('terminal-executing');
      } else {
        this.terminal.classList.remove('terminal-executing');
      }
    }
  }

  /**
   * Update connection status
   * @param {boolean} connected - Whether connected
   */
  updateConnectionStatus(connected) {
    if (this.terminal) {
      if (connected) {
        this.terminal.classList.remove('terminal-disconnected');
        this.terminal.classList.add('terminal-connected');
      } else {
        this.terminal.classList.remove('terminal-connected');
        this.terminal.classList.add('terminal-disconnected');
      }
    }
    
    // Update input placeholder based on connection
    if (this.inputView) {
      const placeholder = connected ? 
        'Enter command...' : 
        'Not connected to server...';
      this.inputView.setPlaceholder(placeholder);
    }
  }

  /**
   * Get current input value
   * @returns {string} Input value
   */
  getCurrentInput() {
    return this.inputView ? this.inputView.getValue() : '';
  }

  /**
   * Set input value
   * @param {string} value - Input value
   */
  setCurrentInput(value) {
    if (this.inputView) {
      this.inputView.setValue(value);
    }
  }

  /**
   * Clear input
   */
  clearInput() {
    if (this.inputView) {
      this.inputView.clear();
    }
  }

  /**
   * Scroll output to bottom
   */
  scrollToBottom() {
    if (this.outputView) {
      this.outputView.scrollToBottom();
    }
  }

  /**
   * Get output lines
   * @returns {Array} Array of output lines
   */
  getOutputLines() {
    return this.outputView ? this.outputView.getLines() : [];
  }

  /**
   * Find output lines by type
   * @param {string} type - Line type
   * @returns {Array} Matching lines
   */
  findOutputLinesByType(type) {
    return this.outputView ? this.outputView.findLinesByType(type) : [];
  }

  /**
   * Search output lines
   * @param {string} query - Search query
   * @returns {Array} Matching lines
   */
  searchOutputLines(query) {
    return this.outputView ? this.outputView.searchLines(query) : [];
  }

  /**
   * Remove output line
   * @param {string} lineId - Line ID to remove
   */
  removeOutputLine(lineId) {
    if (this.outputView) {
      this.outputView.removeLine(lineId);
    }
  }

  /**
   * Update output line
   * @param {string} lineId - Line ID to update
   * @param {Object} updates - Updates to apply
   */
  updateOutputLine(lineId, updates) {
    if (this.outputView) {
      this.outputView.updateLine(lineId, updates);
    }
  }

  /**
   * Set output auto-scroll
   * @param {boolean} enabled - Whether to enable auto-scroll
   */
  setOutputAutoScroll(enabled) {
    if (this.outputView) {
      this.outputView.setAutoScroll(enabled);
    }
  }

  /**
   * Set output max lines
   * @param {number} maxLines - Maximum number of lines
   */
  setOutputMaxLines(maxLines) {
    if (this.outputView) {
      this.outputView.setMaxLines(maxLines);
    }
  }

  /**
   * Apply theme to terminal
   * @param {string} theme - Theme name
   */
  applyTheme(theme) {
    if (this.terminal) {
      // Remove existing theme classes
      const classList = Array.from(this.terminal.classList);
      classList.forEach(className => {
        if (className.startsWith('terminal-theme-')) {
          this.terminal.classList.remove(className);
        }
      });
      
      // Add new theme
      if (theme) {
        this.terminal.classList.add(`terminal-theme-${theme}`);
      }
    }
  }

  /**
   * Get terminal dimensions
   * @returns {Object} Width and height
   */
  getDimensions() {
    if (this.terminal) {
      const rect = this.terminal.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height
      };
    }
    return { width: 0, height: 0 };
  }

  /**
   * Check if terminal is visible
   * @returns {boolean} True if visible
   */
  isVisible() {
    if (this.terminal) {
      const rect = this.terminal.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }
    return false;
  }

  /**
   * Clean up
   */
  destroy() {
    // Destroy subcomponents
    if (this.outputView) {
      this.outputView.destroy();
      this.outputView = null;
    }
    
    if (this.inputView) {
      this.inputView.destroy();
      this.inputView = null;
    }
    
    // Clear event handlers
    this.onInput = null;
    this.onKeyDown = null;
    this.onCommand = null;
    this.onAutocomplete = null;
    
    // Clear references
    this.terminal = null;
    this.outputContainer = null;
    this.inputContainer = null;
    
    super.destroy();
  }
}