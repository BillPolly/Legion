/**
 * InputView Component - Manages input field and prompt
 * Maintains 2-way mapping between state and DOM elements
 */

export class InputView {
  constructor(container) {
    this.container = container;
    
    // State
    this.state = {
      value: '',
      prompt: '> ',
      focused: false
    };
    
    // DOM elements - maintain persistent references
    this.elements = {
      inputLine: null,
      promptSpan: null,
      input: null
    };
    
    // Event callbacks
    this.onInput = null;      // Called when input value changes
    this.onCommand = null;    // Called when command is submitted
    this.onHistoryRequest = null; // Called for history navigation
    
    // Initialize
    this.createDOM();
    this.bindEvents();
  }
  
  /**
   * Create DOM structure - called once
   */
  createDOM() {
    // Clear container
    this.container.innerHTML = '';
    
    // Create input line container
    this.elements.inputLine = document.createElement('div');
    this.elements.inputLine.className = 'input-line';
    
    // Create prompt span
    this.elements.promptSpan = document.createElement('span');
    this.elements.promptSpan.className = 'prompt';
    this.elements.promptSpan.textContent = this.state.prompt;
    
    // Create input field
    this.elements.input = document.createElement('input');
    this.elements.input.type = 'text';
    this.elements.input.className = 'terminal-input';
    this.elements.input.value = this.state.value;
    this.elements.input.setAttribute('autocomplete', 'off');
    this.elements.input.setAttribute('spellcheck', 'false');
    
    // Apply styles
    this.applyStyles();
    
    // Assemble
    this.elements.inputLine.appendChild(this.elements.promptSpan);
    this.elements.inputLine.appendChild(this.elements.input);
    
    // Add to container
    this.container.appendChild(this.elements.inputLine);
  }
  
  /**
   * Apply styles for proper layout
   */
  applyStyles() {
    // Input line - flex container
    Object.assign(this.elements.inputLine.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '10px',
      gap: '8px'
    });
    
    // Prompt styling
    Object.assign(this.elements.promptSpan.style, {
      color: '#4a9eff',
      fontWeight: 'bold',
      flexShrink: '0'
    });
    
    // Input field styling
    Object.assign(this.elements.input.style, {
      flex: '1',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: '#e0e0e0',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      padding: '0'
    });
  }
  
  /**
   * Bind event handlers
   */
  bindEvents() {
    // Input value changes
    this.elements.input.addEventListener('input', (e) => {
      this.state.value = e.target.value;
      if (this.onInput) {
        this.onInput(this.state.value);
      }
    });
    
    // Key handling
    this.elements.input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          this.handleCommand();
          break;
          
        case 'ArrowUp':
          e.preventDefault();
          if (this.onHistoryRequest) {
            this.onHistoryRequest(-1);
          }
          break;
          
        case 'ArrowDown':
          e.preventDefault();
          if (this.onHistoryRequest) {
            this.onHistoryRequest(1);
          }
          break;
      }
    });
    
    // Focus handling
    this.elements.input.addEventListener('focus', () => {
      this.state.focused = true;
    });
    
    this.elements.input.addEventListener('blur', () => {
      this.state.focused = false;
    });
  }
  
  /**
   * Handle command submission
   */
  handleCommand() {
    const command = this.state.value.trim();
    if (command && this.onCommand) {
      this.onCommand(command);
    }
  }
  
  /**
   * Update state and sync with DOM - maintains 2-way mapping
   */
  setState(newState) {
    const prevState = { ...this.state };
    
    // Update state
    if (newState.value !== undefined) {
      this.state.value = newState.value;
    }
    if (newState.prompt !== undefined) {
      this.state.prompt = newState.prompt;
    }
    if (newState.focused !== undefined) {
      this.state.focused = newState.focused;
    }
    
    // Sync DOM with state changes
    this.syncDOMWithState(prevState);
  }
  
  /**
   * Sync DOM with state - only update changed elements
   */
  syncDOMWithState(prevState) {
    // Update input value if changed
    if (this.state.value !== prevState.value) {
      this.elements.input.value = this.state.value;
    }
    
    // Update prompt if changed
    if (this.state.prompt !== prevState.prompt) {
      this.elements.promptSpan.textContent = this.state.prompt;
    }
    
    // Update focus if changed
    if (this.state.focused !== prevState.focused) {
      if (this.state.focused) {
        this.elements.input.focus();
      } else {
        this.elements.input.blur();
      }
    }
  }
  
  /**
   * Focus the input field
   */
  focus() {
    this.setState({ focused: true });
  }
  
  /**
   * Blur the input field
   */
  blur() {
    this.setState({ focused: false });
  }
  
  /**
   * Clear the input
   */
  clear() {
    this.setState({ value: '' });
  }
  
  /**
   * Set input value
   */
  setValue(value) {
    this.setState({ value });
  }
  
  /**
   * Set prompt text
   */
  setPrompt(prompt) {
    this.setState({ prompt });
  }
  
  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }
  
  /**
   * Get current input value
   */
  getValue() {
    return this.state.value;
  }
  
  /**
   * Check if input is focused
   */
  isFocused() {
    return this.state.focused;
  }
  
  /**
   * Destroy component
   */
  destroy() {
    // Remove event listeners are automatically removed when DOM is cleared
    this.container.innerHTML = '';
  }
}