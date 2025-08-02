/**
 * TerminalView - Main terminal component that composes input and output
 * Maintains persistent DOM references and updates incrementally
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';
import { TerminalInputView } from './subcomponents/TerminalInputView.js';
import { TerminalOutputView } from './subcomponents/TerminalOutputView.js';

export class TerminalView extends ExtendedBaseView {
  constructor(dom) {
    super(dom);
    
    // DOM element references - create once, update many
    this.elements = {
      terminal: null,
      outputContainer: null,
      inputContainer: null
    };
    
    // Subcomponents - they manage their own DOM
    this.outputView = null;
    this.inputView = null;
    
    // Event handlers
    this.onInput = null;
    this.onKeyDown = null;
    this.onCommand = null;
    this.onAutocomplete = null;
    
    // State
    this.initialized = false;
  }

  /**
   * Render the terminal - creates DOM once, updates on subsequent calls
   */
  render(options = {}) {
    if (!this.initialized) {
      this.createDOMStructure();
      this.createSubcomponents();
      this.setupEventHandlers();
      this.initialized = true;
    }
    
    // Update existing DOM with options
    this.update(options);
    
    return this.elements.terminal;
  }

  /**
   * Create DOM structure - ONLY CALLED ONCE
   */
  createDOMStructure() {
    // Create main terminal container
    this.elements.terminal = document.createElement('div');
    this.elements.terminal.className = 'terminal';
    
    // Create containers for subcomponents
    this.elements.outputContainer = document.createElement('div');
    this.elements.outputContainer.className = 'terminal-output-container';
    
    this.elements.inputContainer = document.createElement('div');
    this.elements.inputContainer.className = 'terminal-input-container';
    
    // Assemble structure
    this.elements.terminal.appendChild(this.elements.outputContainer);
    this.elements.terminal.appendChild(this.elements.inputContainer);
    
    // Add to parent DOM
    this.dom.appendChild(this.elements.terminal);
  }

  /**
   * Create subcomponents - ONLY CALLED ONCE
   */
  createSubcomponents() {
    // Create output view with its container
    this.outputView = new TerminalOutputView(this.elements.outputContainer);
    this.outputView.render();
    
    // Create input view with its container
    this.inputView = new TerminalInputView(this.elements.inputContainer);
    this.inputView.render();
  }

  /**
   * Update existing DOM - called multiple times
   */
  update(options = {}) {
    // Update theme
    if (options.theme) {
      // Remove old theme classes
      const classes = Array.from(this.elements.terminal.classList);
      classes.forEach(cls => {
        if (cls.startsWith('terminal-theme-')) {
          this.elements.terminal.classList.remove(cls);
        }
      });
      // Add new theme
      this.elements.terminal.classList.add(`terminal-theme-${options.theme}`);
    }
    
    // Update subcomponents
    if (options.prompt && this.inputView) {
      this.inputView.setPrompt(options.prompt);
    }
    
    if (options.maxOutputLines && this.outputView) {
      this.outputView.setMaxLines(options.maxOutputLines);
    }
  }

  /**
   * Setup event handlers between components
   */
  setupEventHandlers() {
    // Input events
    this.inputView.onCommand = (command) => {
      // Add command to output
      this.outputView.addLine(`> ${command}`, 'command');
      
      // Call parent handler
      if (this.onCommand) {
        this.onCommand(command);
      }
    };
    
    this.inputView.onInput = (value, event) => {
      if (this.onInput) {
        this.onInput(value, event);
      }
    };
    
    this.inputView.onKeyDown = (key, event) => {
      if (this.onKeyDown) {
        this.onKeyDown(key, event);
      }
    };
    
    this.inputView.onAutocomplete = (partial) => {
      if (this.onAutocomplete) {
        this.onAutocomplete(partial);
      }
    };
  }

  /**
   * Add output line
   */
  appendOutput(output) {
    if (this.outputView) {
      const content = typeof output === 'string' ? output : output.content;
      const type = typeof output === 'string' ? 'info' : output.type;
      return this.outputView.addLine(content, type);
    }
  }

  /**
   * Add multiple outputs
   */
  renderOutput(outputs) {
    if (this.outputView) {
      outputs.forEach(output => this.appendOutput(output));
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
   * Clear input
   */
  clearInput() {
    if (this.inputView) {
      this.inputView.clear();
    }
  }

  /**
   * Set current command
   */
  renderCommand(command) {
    if (this.inputView) {
      this.inputView.setValue(command);
    }
  }

  /**
   * Get current input
   */
  getCurrentInput() {
    return this.inputView ? this.inputView.getValue() : '';
  }

  /**
   * Set current input
   */
  setCurrentInput(value) {
    if (this.inputView) {
      this.inputView.setValue(value);
    }
  }

  /**
   * Focus input
   */
  focusInput() {
    if (this.inputView) {
      this.inputView.focus();
    }
  }

  /**
   * Set prompt
   */
  setPrompt(prompt) {
    if (this.inputView) {
      this.inputView.setPrompt(prompt);
    }
  }

  /**
   * Set executing state
   */
  setExecuting(executing) {
    if (this.inputView) {
      this.inputView.setExecuting(executing);
    }
    if (this.elements.terminal) {
      this.elements.terminal.classList.toggle('terminal-executing', executing);
    }
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(connected) {
    if (this.elements.terminal) {
      this.elements.terminal.classList.toggle('terminal-connected', connected);
      this.elements.terminal.classList.toggle('terminal-disconnected', !connected);
    }
    if (this.inputView) {
      this.inputView.setPlaceholder(
        connected ? 'Enter command...' : 'Not connected...'
      );
    }
  }

  /**
   * Show autocomplete
   */
  showAutocomplete(suggestions, selectedIndex = 0) {
    if (this.inputView) {
      this.inputView.showAutocomplete(suggestions);
      if (selectedIndex >= 0) {
        this.inputView.selectedIndex = selectedIndex;
        this.inputView.updateAutocompleteSelection();
      }
    }
  }

  /**
   * Hide autocomplete
   */
  hideAutocomplete() {
    if (this.inputView) {
      this.inputView.hideAutocomplete();
    }
  }

  /**
   * Update autocomplete selection
   */
  updateAutocompleteSelection(selectedIndex) {
    if (this.inputView) {
      this.inputView.selectedIndex = selectedIndex;
      this.inputView.updateAutocompleteSelection();
    }
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom() {
    if (this.outputView) {
      this.outputView.scrollToBottom();
    }
  }

  /**
   * Get output lines
   */
  getOutputLines() {
    return this.outputView ? this.outputView.getLines() : [];
  }

  /**
   * Search output lines
   */
  searchOutputLines(query) {
    return this.outputView ? this.outputView.searchLines(query) : [];
  }

  /**
   * Find lines by type
   */
  findOutputLinesByType(type) {
    return this.outputView ? this.outputView.findLinesByType(type) : [];
  }

  /**
   * Remove output line
   */
  removeOutputLine(lineId) {
    if (this.outputView) {
      this.outputView.removeLine(lineId);
    }
  }

  /**
   * Update output line
   */
  updateOutputLine(lineId, updates) {
    if (this.outputView) {
      this.outputView.updateLine(lineId, updates);
    }
  }

  /**
   * Set auto scroll
   */
  setOutputAutoScroll(enabled) {
    if (this.outputView) {
      this.outputView.setAutoScroll(enabled);
    }
  }

  /**
   * Set max output lines
   */
  setOutputMaxLines(maxLines) {
    if (this.outputView) {
      this.outputView.setMaxLines(maxLines);
    }
  }

  /**
   * Destroy - cleanup
   */
  destroy() {
    if (this.outputView) {
      this.outputView.destroy();
      this.outputView = null;
    }
    if (this.inputView) {
      this.inputView.destroy();
      this.inputView = null;
    }
    
    // Clear DOM references
    this.elements = {
      terminal: null,
      outputContainer: null,
      inputContainer: null
    };
    
    this.initialized = false;
    super.destroy();
  }
}