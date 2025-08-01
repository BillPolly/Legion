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
    this.terminal.setAttribute('tabindex', '0');
    
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
    
    // Create input area
    this.inputElement = this.createElement('div', ['terminal-input']);
    this.inputElement.setAttribute('contenteditable', 'true');
    this.inputElement.setAttribute('spellcheck', 'false');
    
    // Create cursor
    this.cursorElement = this.createElement('span', ['terminal-cursor']);
    this.cursorElement.textContent = '\u00A0'; // Non-breaking space
    
    this.inputLine.appendChild(this.inputElement);
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
    // Input events
    this.addEventListener(this.terminal, 'input', (e) => {
      if (this.onInput) {
        this.onInput(e);
      }
    });
    
    // Keyboard events
    this.addEventListener(this.terminal, 'keydown', (e) => {
      if (this.onKeyDown) {
        this.onKeyDown(e);
      }
    });
    
    // Paste events
    this.addEventListener(this.terminal, 'paste', (e) => {
      e.preventDefault();
      if (this.onPaste && e.clipboardData) {
        const text = e.clipboardData.getData('text/plain');
        this.onPaste(text);
      }
    });
    
    // Focus events
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
    this.inputElement.innerHTML = '';
    
    if (command.length === 0) {
      // Just show cursor
      this.inputElement.appendChild(this.cursorElement);
    } else {
      // Split command at cursor position
      const before = command.substring(0, cursorPosition);
      const after = command.substring(cursorPosition);
      
      if (before) {
        const beforeText = document.createTextNode(before);
        this.inputElement.appendChild(beforeText);
      }
      
      this.inputElement.appendChild(this.cursorElement);
      
      if (after) {
        const afterText = document.createTextNode(after);
        this.inputElement.appendChild(afterText);
      }
    }
  }

  /**
   * Set cursor visibility
   * @param {boolean} visible - Whether cursor is visible
   */
  setCursorVisible(visible) {
    this.cursorElement.style.display = visible ? 'inline' : 'none';
  }

  /**
   * Focus the input
   */
  focusInput() {
    this.terminal.focus();
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
    // Get cursor position
    const cursorRect = this.cursorElement.getBoundingClientRect();
    const terminalRect = this.terminal.getBoundingClientRect();
    
    // Position relative to terminal
    const left = cursorRect.left - terminalRect.left;
    const top = cursorRect.bottom - terminalRect.top + 5;
    
    this.autocompleteElement.style.left = `${left}px`;
    this.autocompleteElement.style.top = `${top}px`;
  }

  /**
   * Set executing state
   * @param {boolean} executing - Whether executing
   */
  setExecuting(executing) {
    if (executing) {
      this.inputElement.setAttribute('contenteditable', 'false');
      this.addClass(this.terminal, 'terminal-executing');
    } else {
      this.inputElement.setAttribute('contenteditable', 'true');
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