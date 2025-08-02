/**
 * TerminalView - View for terminal component
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';

export class TerminalView extends ExtendedBaseView {
  constructor(dom) {
    super(dom);
    
    this.terminal = null;
    this.outputElement = null;
    this.inputLine = null;
    this.promptElement = null;
    this.inputElement = null;
    this.cursorElement = null;
    this.autocompleteElement = null;
    
    // Event handlers
    this.onInput = null;
    this.onKeyDown = null;
    this.onPaste = null;
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
    
    // Create output area
    this.outputElement = this.createElement('div', ['terminal-output']);
    this.terminal.appendChild(this.outputElement);
    
    // Create input line
    this.inputLine = this.createElement('div', ['terminal-input-line']);
    
    // Create prompt
    this.promptElement = this.createElement('span', ['terminal-prompt']);
    this.promptElement.textContent = options.prompt || '> ';
    this.inputLine.appendChild(this.promptElement);
    
    // Create input wrapper for proper alignment
    const inputWrapper = this.createElement('div', ['terminal-input-wrapper']);
    
    // Create input area using regular input element
    this.inputElement = document.createElement('input');
    this.inputElement.type = 'text';
    this.inputElement.className = 'terminal-input';
    this.inputElement.setAttribute('autocomplete', 'off');
    this.inputElement.setAttribute('spellcheck', 'false');
    
    inputWrapper.appendChild(this.inputElement);
    this.inputLine.appendChild(inputWrapper);
    this.terminal.appendChild(this.inputLine);
    
    // Create autocomplete dropdown
    this.autocompleteElement = this.createElement('div', ['terminal-autocomplete']);
    this.autocompleteElement.style.display = 'none';
    this.autocompleteElement.style.position = 'absolute';
    this.terminal.appendChild(this.autocompleteElement);
    
    // Add to DOM
    this.dom.appendChild(this.terminal);
    
    // Set up event handlers
    this.setupEventHandlers();
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Input events - attach to the input element
    this.addEventListener(this.inputElement, 'input', (e) => {
      if (this.onInput) {
        this.onInput(e);
      }
    });
    
    // Keyboard events - attach to the input element
    this.addEventListener(this.inputElement, 'keydown', (e) => {
      if (this.onKeyDown) {
        this.onKeyDown(e);
      }
    });
    
    // Paste events - attach to the input element
    this.addEventListener(this.inputElement, 'paste', (e) => {
      e.preventDefault();
      if (this.onPaste && e.clipboardData) {
        const text = e.clipboardData.getData('text/plain');
        this.onPaste(text);
      }
    });
    
    // Focus input when clicking anywhere in the terminal
    this.addEventListener(this.terminal, 'click', () => {
      this.focusInput();
    });
  }

  /**
   * Render output lines
   * @param {Array} outputs - Array of output objects
   */
  renderOutput(outputs) {
    this.outputElement.innerHTML = '';
    outputs.forEach(output => {
      this.appendOutputLine(output);
    });
  }

  /**
   * Append a single output line
   * @param {Object} output - Output object
   */
  appendOutput(output) {
    this.appendOutputLine(output);
    this.scrollToBottom();
  }

  /**
   * Append output line to DOM
   * @param {Object} output - Output object
   */
  appendOutputLine(output) {
    const line = this.createElement('div', ['terminal-line', `terminal-line-${output.type || 'info'}`]);
    line.textContent = output.content;
    line.setAttribute('data-id', output.id);
    this.outputElement.appendChild(line);
  }

  /**
   * Clear output
   */
  clearOutput() {
    this.outputElement.innerHTML = '';
  }

  /**
   * Scroll output to bottom
   */
  scrollToBottom() {
    if (this.outputElement.scrollTo) {
      this.outputElement.scrollTo({
        top: this.outputElement.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      // Fallback for environments without scrollTo
      this.outputElement.scrollTop = this.outputElement.scrollHeight;
    }
  }

  /**
   * Render current command with cursor
   * @param {string} command - Current command
   * @param {number} cursorPosition - Cursor position
   */
  renderCommand(command, cursorPosition) {
    // For regular input element, just set the value
    this.inputElement.value = command;
    
    // Set cursor position if the element is focused
    if (document.activeElement === this.inputElement && typeof cursorPosition === 'number') {
      this.inputElement.selectionStart = cursorPosition;
      this.inputElement.selectionEnd = cursorPosition;
    }
  }

  /**
   * Set cursor visibility
   * @param {boolean} visible - Whether cursor is visible
   */
  setCursorVisible(visible) {
    // For regular input, cursor is handled by the browser
    // This method is kept for compatibility
  }

  /**
   * Focus the input
   */
  focusInput() {
    this.inputElement.focus();
  }

  /**
   * Set prompt text
   * @param {string} prompt - Prompt text
   */
  setPrompt(prompt) {
    this.promptElement.textContent = prompt;
  }

  /**
   * Show autocomplete dropdown
   * @param {Array} suggestions - Array of suggestions
   * @param {number} selectedIndex - Selected index
   */
  showAutocomplete(suggestions, selectedIndex) {
    this.autocompleteElement.innerHTML = '';
    
    suggestions.forEach((suggestion, index) => {
      const item = this.createElement('div', ['autocomplete-item']);
      if (index === selectedIndex) {
        item.classList.add('selected');
      }
      item.textContent = suggestion;
      this.autocompleteElement.appendChild(item);
    });
    
    this.autocompleteElement.style.display = 'block';
    this.positionAutocomplete();
  }

  /**
   * Hide autocomplete dropdown
   */
  hideAutocomplete() {
    this.autocompleteElement.style.display = 'none';
  }

  /**
   * Update autocomplete selection
   * @param {number} selectedIndex - New selected index
   */
  updateAutocompleteSelection(selectedIndex) {
    const items = this.autocompleteElement.querySelectorAll('.autocomplete-item');
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  /**
   * Position autocomplete dropdown near cursor
   */
  positionAutocomplete() {
    // Get input position
    const inputRect = this.inputElement.getBoundingClientRect();
    const terminalRect = this.terminal.getBoundingClientRect();
    
    // Position relative to terminal
    const left = inputRect.left - terminalRect.left;
    const bottom = terminalRect.bottom - inputRect.bottom + 5;
    
    this.autocompleteElement.style.left = `${left}px`;
    this.autocompleteElement.style.bottom = `${bottom}px`;
  }

  /**
   * Set executing state
   * @param {boolean} executing - Whether executing
   */
  setExecuting(executing) {
    if (executing) {
      this.inputElement.disabled = true;
      this.addClass(this.terminal, 'terminal-executing');
    } else {
      this.inputElement.disabled = false;
      this.removeClass(this.terminal, 'terminal-executing');
    }
  }

  /**
   * Update connection status
   * @param {boolean} connected - Whether connected
   */
  updateConnectionStatus(connected) {
    if (connected) {
      this.removeClass(this.terminal, 'terminal-disconnected');
    } else {
      this.addClass(this.terminal, 'terminal-disconnected');
    }
  }

  /**
   * Clean up
   */
  destroy() {
    if (this.terminal && this.terminal.parentNode) {
      this.terminal.parentNode.removeChild(this.terminal);
    }
    
    this.terminal = null;
    this.outputElement = null;
    this.inputLine = null;
    this.promptElement = null;
    this.inputElement = null;
    this.cursorElement = null;
    this.autocompleteElement = null;
    
    super.destroy();
  }
}