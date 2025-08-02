/**
 * TerminalView - Main terminal component
 * Creates its own container inside the given DOM element
 */
import { ExtendedBaseView } from '../base/ExtendedBaseView.js';
import { TerminalInputView } from './subcomponents/TerminalInputView.js';
import { TerminalOutputView } from './subcomponents/TerminalOutputView.js';

export class TerminalView extends ExtendedBaseView {
  constructor(dom) {
    super(dom);
    
    // DOM element references - create once, update many
    this.elements = {
      container: null,      // Our main container we create
      header: null,
      title: null,
      actions: null,
      body: null,
      terminal: null,       // The actual terminal area
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
    console.log('TerminalView.render called', { initialized: this.initialized, domId: this.dom.id });
    
    if (!this.initialized) {
      console.log('Creating terminal structure...');
      this.createDOMStructure();
      this.createSubcomponents();
      this.setupEventHandlers();
      this.initialized = true;
      
      // Debug: Check the actual DOM structure
      console.log('Terminal DOM created:', {
        outputContainer: this.elements.outputContainer?.className,
        inputContainer: this.elements.inputContainer?.className,
        outputFirst: this.elements.terminal.firstChild === this.elements.outputContainer,
        inputLast: this.elements.terminal.lastChild === this.elements.inputContainer,
        childCount: this.elements.terminal.children.length
      });
    }
    
    // Update existing DOM with options
    this.update(options);
    
    return this.elements.container;
  }

  /**
   * Create DOM structure - ONLY CALLED ONCE
   * Creates our own container inside the given DOM element
   */
  createDOMStructure() {
    // Clear any existing content
    while (this.dom.firstChild) {
      this.dom.removeChild(this.dom.firstChild);
    }
    
    // Use the document that owns our DOM element
    const doc = this.dom.ownerDocument || document;
    
    // Create our main container
    this.elements.container = doc.createElement('section');
    this.elements.container.className = 'terminal-container';
    this.elements.container.style.display = 'flex';
    this.elements.container.style.flexDirection = 'column';
    this.elements.container.style.height = '100%';
    
    // Create header
    this.elements.header = doc.createElement('div');
    this.elements.header.className = 'terminal-header';
    
    this.elements.title = doc.createElement('span');
    this.elements.title.className = 'terminal-title';
    this.elements.title.textContent = 'Terminal';
    
    this.elements.actions = doc.createElement('div');
    this.elements.actions.className = 'terminal-actions';
    
    // Create action buttons
    const clearBtn = doc.createElement('button');
    clearBtn.className = 'terminal-action';
    clearBtn.dataset.action = 'clear';
    clearBtn.textContent = 'Clear';
    
    const exportBtn = doc.createElement('button');
    exportBtn.className = 'terminal-action';
    exportBtn.dataset.action = 'export';
    exportBtn.textContent = 'Export';
    
    this.elements.actions.appendChild(clearBtn);
    this.elements.actions.appendChild(exportBtn);
    
    this.elements.header.appendChild(this.elements.title);
    this.elements.header.appendChild(this.elements.actions);
    
    // Create body
    this.elements.body = doc.createElement('div');
    this.elements.body.className = 'terminal-body';
    this.elements.body.style.flex = '1 1 auto';
    this.elements.body.style.display = 'flex';
    this.elements.body.style.flexDirection = 'column';
    this.elements.body.style.minHeight = '0';
    
    // Create the actual terminal inside body
    this.elements.terminal = doc.createElement('div');
    this.elements.terminal.className = 'terminal';
    this.elements.terminal.style.flex = '1 1 auto';
    this.elements.terminal.style.display = 'flex';
    this.elements.terminal.style.flexDirection = 'column';
    this.elements.terminal.style.minHeight = '0';
    
    // Create containers for subcomponents
    this.elements.outputContainer = doc.createElement('div');
    this.elements.outputContainer.className = 'terminal-output-container';
    
    this.elements.inputContainer = doc.createElement('div');
    this.elements.inputContainer.className = 'terminal-input-container';
    
    // Assemble structure - OUTPUT FIRST, INPUT SECOND
    console.log('ASSEMBLING TERMINAL STRUCTURE:');
    console.log('1. Adding output container to terminal');
    this.elements.terminal.appendChild(this.elements.outputContainer);
    console.log('2. Adding input container to terminal');
    this.elements.terminal.appendChild(this.elements.inputContainer);
    console.log('3. Order after assembly:', {
      firstChild: this.elements.terminal.firstChild?.className,
      secondChild: this.elements.terminal.children[1]?.className,
      childCount: this.elements.terminal.children.length
    });
    this.elements.body.appendChild(this.elements.terminal);
    
    this.elements.container.appendChild(this.elements.header);
    this.elements.container.appendChild(this.elements.body);
    
    // Add our container to the parent DOM element
    this.dom.appendChild(this.elements.container);
    
    // Bind action buttons
    clearBtn.addEventListener('click', () => this.handleClearAction());
    exportBtn.addEventListener('click', () => this.handleExportAction());
  }

  /**
   * Create subcomponents - ONLY CALLED ONCE
   */
  createSubcomponents() {
    console.log('Creating subcomponents...');
    
    // Create output view with its container
    this.outputView = new TerminalOutputView(this.elements.outputContainer);
    this.outputView.render();
    console.log('Output view created');
    
    // Create input view with its container
    this.inputView = new TerminalInputView(this.elements.inputContainer);
    this.inputView.render();
    console.log('Input view created');
    
    // Verify DOM order and CSS
    const terminal = this.elements.terminal;
    console.log('DOM Order Check:', {
      firstChild: terminal.firstChild?.className,
      lastChild: terminal.lastChild?.className,
      children: Array.from(terminal.children).map(c => c.className)
    });
    
    // Fix the layout - output on top, input on bottom
    terminal.style.display = 'flex';
    terminal.style.flexDirection = 'column';
    terminal.style.height = '100%';
    
    // Output container should grow and be scrollable
    this.elements.outputContainer.style.flex = '1 1 auto';
    this.elements.outputContainer.style.overflow = 'auto';
    this.elements.outputContainer.style.minHeight = '0';
    
    // Input container should stay at bottom
    this.elements.inputContainer.style.flex = '0 0 auto';
    this.elements.inputContainer.style.borderTop = '1px solid #444';
    
    // Debug: Check if elements are in right order
    console.log('Terminal layout fixed. Order check:', {
      outputFirst: terminal.children[0] === this.elements.outputContainer,
      inputSecond: terminal.children[1] === this.elements.inputContainer,
      terminalHeight: terminal.style.height,
      outputFlex: this.elements.outputContainer.style.flex,
      inputFlex: this.elements.inputContainer.style.flex
    });
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
      console.log('TerminalView: Command entered:', command);
      // Just call parent handler - ViewModel will add to output
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
   * Handle clear action
   */
  handleClearAction() {
    this.clearOutput();
  }

  /**
   * Handle export action
   */
  handleExportAction() {
    const output = this.getOutputLines();
    const text = output.map(line => line.content).join('\n');
    
    // Create download
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const doc = this.dom.ownerDocument || document;
    const a = doc.createElement('a');
    a.href = url;
    a.download = `terminal-output-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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
    this.elements = {};
    
    this.initialized = false;
    super.destroy();
  }
}