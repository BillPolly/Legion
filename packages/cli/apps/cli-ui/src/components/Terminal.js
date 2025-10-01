/**
 * Terminal - Web-based terminal emulator component
 *
 * Provides a terminal interface with:
 * - Command history (up/down arrows)
 * - Auto-completion (tab)
 * - Multi-line output
 * - ANSI color support (basic)
 */

export class Terminal {
  constructor(container) {
    this.container = container;
    this.history = [];
    this.historyIndex = -1;
    this.currentCommand = '';

    // Callback for command execution
    this.onCommand = null;

    // Elements
    this.outputElement = null;
    this.inputElement = null;
    this.promptElement = null;
  }

  /**
   * Initialize terminal
   */
  initialize() {
    // Create terminal structure
    this.container.innerHTML = `
      <div class="terminal">
        <div class="terminal-output" id="terminal-output"></div>
        <div class="terminal-input-line">
          <span class="terminal-prompt" id="terminal-prompt">legion> </span>
          <input
            type="text"
            class="terminal-input"
            id="terminal-input"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
      </div>
    `;

    this.outputElement = document.getElementById('terminal-output');
    this.inputElement = document.getElementById('terminal-input');
    this.promptElement = document.getElementById('terminal-prompt');

    // Set up event listeners
    this.setupEventListeners();

    // Apply styles
    this.applyStyles();

    // Focus input
    this.inputElement.focus();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.inputElement.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // TODO: Auto-completion
      }
    });

    // Keep focus on input
    this.container.addEventListener('click', () => {
      this.inputElement.focus();
    });
  }

  /**
   * Handle command submission
   */
  async handleCommand() {
    const command = this.inputElement.value.trim();

    if (command) {
      // Add to history
      this.history.push(command);
      this.historyIndex = this.history.length;

      // Display command
      this.writeLine(`${this.promptElement.textContent}${command}`, 'command');

      // Clear input
      this.inputElement.value = '';

      // Execute command
      if (this.onCommand) {
        try {
          await this.onCommand(command);
        } catch (error) {
          this.writeLine(`Error: ${error.message}`, 'error');
        }
      }
    } else {
      // Empty line
      this.writeLine(this.promptElement.textContent);
      this.inputElement.value = '';
    }
  }

  /**
   * Navigate command history
   */
  navigateHistory(direction) {
    if (this.history.length === 0) return;

    // Save current command if at end
    if (this.historyIndex === this.history.length) {
      this.currentCommand = this.inputElement.value;
    }

    // Update index
    this.historyIndex += direction;
    this.historyIndex = Math.max(0, Math.min(this.history.length, this.historyIndex));

    // Update input
    if (this.historyIndex === this.history.length) {
      this.inputElement.value = this.currentCommand;
    } else {
      this.inputElement.value = this.history[this.historyIndex];
    }
  }

  /**
   * Write line to output
   */
  writeLine(text, type = 'default') {
    const line = document.createElement('div');
    line.className = `terminal-line terminal-line-${type}`;
    line.textContent = text;
    this.outputElement.appendChild(line);

    // Scroll to bottom
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }

  /**
   * Write multiple lines
   */
  writeLines(lines, type = 'default') {
    lines.forEach(line => this.writeLine(line, type));
  }

  /**
   * Write formatted result
   */
  writeResult(result) {
    if (result.success) {
      if (result.message) {
        // Split message into lines and write each
        const lines = result.message.split('\n');
        lines.forEach(line => this.writeLine(line, 'success'));
      }
    } else {
      this.writeLine(`Error: ${result.error || 'Command failed'}`, 'error');
      if (result.stack) {
        const stackLines = result.stack.split('\n').slice(0, 5); // First 5 lines
        stackLines.forEach(line => this.writeLine(`  ${line}`, 'error-detail'));
      }
    }
  }

  /**
   * Clear terminal
   */
  clear() {
    this.outputElement.innerHTML = '';
  }

  /**
   * Set prompt text
   */
  setPrompt(prompt) {
    this.promptElement.textContent = prompt;
  }

  /**
   * Apply terminal styles
   */
  applyStyles() {
    const styleId = 'terminal-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .terminal {
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #d4d4d4;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace;
        font-size: 14px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .terminal-output {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        overflow-x: hidden;
        word-wrap: break-word;
      }

      .terminal-line {
        line-height: 1.5;
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .terminal-line-command {
        color: #4ec9b0;
      }

      .terminal-line-success {
        color: #d4d4d4;
      }

      .terminal-line-error {
        color: #f48771;
      }

      .terminal-line-error-detail {
        color: #ce9178;
        font-size: 12px;
      }

      .terminal-line-info {
        color: #569cd6;
      }

      .terminal-input-line {
        display: flex;
        align-items: center;
        padding: 8px 16px;
        background: #252526;
        border-top: 1px solid #3e3e42;
      }

      .terminal-prompt {
        color: #4ec9b0;
        margin-right: 8px;
        user-select: none;
      }

      .terminal-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #d4d4d4;
        font-family: inherit;
        font-size: inherit;
        padding: 0;
        caret-color: #d4d4d4;
      }

      .terminal-input::selection {
        background: #264f78;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Destroy terminal
   */
  destroy() {
    // Clear event listeners
    this.inputElement?.removeEventListener('keydown', this.handleCommand);

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
