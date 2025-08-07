/**
 * InputView Component - Manages input field with tab completion and ghost text
 * Maintains 2-way mapping between state and DOM elements
 */

export class InputView {
  constructor(container) {
    this.container = container;
    
    // State
    this.state = {
      value: '',
      prompt: '> ',
      focused: false,
      ghostText: '',
      completionActive: false
    };
    
    // DOM elements - maintain persistent references
    this.elements = {
      inputLine: null,
      promptSpan: null,
      inputWrapper: null,
      input: null,
      ghost: null
    };
    
    // Event callbacks
    this.onInput = null;      // Called when input value changes
    this.onCommand = null;    // Called when command is submitted
    this.onHistoryRequest = null; // Called for history navigation
    
    // Tab completion state
    this.completions = [];
    this.completionIndex = -1;
    this.completionBase = '';
    this.availableCommands = [];
    this.toolDefinitions = new Map();
    
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
    
    // Create input wrapper for layering input and ghost
    this.elements.inputWrapper = document.createElement('div');
    this.elements.inputWrapper.className = 'input-wrapper';
    this.elements.inputWrapper.style.position = 'relative';
    this.elements.inputWrapper.style.flex = '1';
    
    // Create ghost text element (behind input)
    this.elements.ghost = document.createElement('div');
    this.elements.ghost.className = 'ghost-text';
    
    // Create input field (on top)
    this.elements.input = document.createElement('input');
    this.elements.input.type = 'text';
    this.elements.input.className = 'terminal-input';
    this.elements.input.value = this.state.value;
    this.elements.input.setAttribute('autocomplete', 'off');
    this.elements.input.setAttribute('spellcheck', 'false');
    
    // Apply styles
    this.applyStyles();
    
    // Assemble
    this.elements.inputWrapper.appendChild(this.elements.ghost);
    this.elements.inputWrapper.appendChild(this.elements.input);
    this.elements.inputLine.appendChild(this.elements.promptSpan);
    this.elements.inputLine.appendChild(this.elements.inputWrapper);
    
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
    
    // Ghost text styling - positioned behind input
    Object.assign(this.elements.ghost.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      color: '#666',
      fontFamily: 'inherit',
      fontSize: 'inherit',
      padding: '0',
      pointerEvents: 'none',
      whiteSpace: 'pre'
    });
    
    // Input field styling - transparent background to show ghost
    Object.assign(this.elements.input.style, {
      position: 'relative',
      width: '100%',
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
      this.state.completionActive = false;
      this.updateGhostText();
      
      if (this.onInput) {
        this.onInput(this.state.value);
      }
    });
    
    // Key handling
    this.elements.input.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          this.handleTabCompletion();
          break;
          
        case 'Enter':
          e.preventDefault();
          // Don't accept parameter hints, just execute the command
          // Only accept ghost text if it's a command completion (not parameter hints)
          if (this.state.ghostText && !this.state.ghostText.includes('<') && !this.state.completionActive) {
            this.acceptGhostText();
          } else {
            this.handleCommand();
          }
          break;
          
        case 'Escape':
          e.preventDefault();
          this.cancelCompletion();
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
          
        case 'ArrowRight':
          // Accept ghost text on right arrow at end of input
          if (this.elements.input.selectionStart === this.state.value.length && this.state.ghostText) {
            e.preventDefault();
            this.acceptGhostText();
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
   * Update ghost text based on current input
   */
  updateGhostText() {
    const input = this.state.value;  // Don't trim - we need to detect trailing spaces
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      this.setGhostText('');
      return;
    }
    
    const parts = trimmedInput.split(' ');
    const command = parts[0];
    
    // If typing a command (no space yet), show command completions
    if (parts.length === 1 && !input.endsWith(' ')) {
      const suggestions = this.getCommandSuggestions(command);
      if (suggestions.length > 0) {
        const suggestion = suggestions[0];
        const ghostPart = suggestion.substring(command.length);
        this.setGhostText(trimmedInput + ghostPart);
      } else {
        this.setGhostText('');
      }
    } 
    // If we have a space after the command, show parameter hints
    else if (input.endsWith(' ') || parts.length > 1) {
      const toolDef = this.toolDefinitions.get(command);
      if (toolDef && toolDef.inputSchema && toolDef.inputSchema.properties) {
        const props = toolDef.inputSchema.properties;
        const required = toolDef.inputSchema.required || [];
        const paramNames = Object.keys(props);
        
        // Count how many arguments we already have
        const argsProvided = parts.length - 1;
        
        // Build the parameter hints
        let hints = [];
        for (let i = argsProvided; i < paramNames.length; i++) {
          const paramName = paramNames[i];
          const prop = props[paramName];
          const isRequired = required.includes(paramName);
          hints.push(`<${paramName}: ${prop.type}${isRequired ? '' : '?'}>`);
        }
        
        if (hints.length > 0) {
          // Show the hints after the current input
          this.setGhostText(input + hints.join(' '));
        } else {
          this.setGhostText('');
        }
      } else {
        this.setGhostText('');
      }
    } else {
      this.setGhostText('');
    }
  }
  
  /**
   * Get command suggestions based on input
   */
  getCommandSuggestions(input) {
    if (!input) return [];
    
    // Combine available commands and tool names
    const allCommands = [
      ...this.availableCommands,
      ...Array.from(this.toolDefinitions.keys())
    ];
    
    // Filter and sort by relevance
    return allCommands
      .filter(cmd => cmd.startsWith(input))
      .sort((a, b) => {
        // Exact match first
        if (a === input) return -1;
        if (b === input) return 1;
        // Then by length (shorter first)
        return a.length - b.length;
      });
  }
  
  /**
   * Handle tab completion
   */
  handleTabCompletion() {
    const rawInput = this.state.value;
    const trimmedInput = rawInput.trim();
    
    console.log('Tab completion:', { rawInput, trimmedInput, tools: this.toolDefinitions.size });
    
    if (!trimmedInput) {
      // Show all available commands
      this.completions = [
        ...this.availableCommands,
        ...Array.from(this.toolDefinitions.keys())
      ].sort();
      console.log('Empty input completions:', this.completions);
      this.completionIndex = -1;
      this.completionBase = '';
      this.state.completionActive = true;
      this.cycleCompletion();
      return;
    }
    
    const parts = trimmedInput.split(' ');
    const command = parts[0];
    
    // Complete command name (only if we haven't typed a space yet)
    if (parts.length === 1 && !rawInput.endsWith(' ')) {
      if (!this.state.completionActive) {
        // Start new completion
        this.completions = this.getCommandSuggestions(command);
        console.log('Command completions for', command, ':', this.completions);
        this.completionIndex = -1;
        this.completionBase = command;
        this.state.completionActive = true;
      }
      this.cycleCompletion();
    }
    // Don't do parameter completion on tab for now - too complex
    else {
      // Just cancel any active completion
      this.cancelCompletion();
    }
  }
  
  /**
   * Cycle through completions
   */
  cycleCompletion() {
    if (this.completions.length === 0) {
      return;
    }
    
    // Increment index with wrap-around
    this.completionIndex = (this.completionIndex + 1) % this.completions.length;
    
    // Apply completion
    const completion = this.completions[this.completionIndex];
    this.setState({ value: completion });
    
    // Update ghost text for next completion
    if (this.completions.length > 1) {
      const nextIndex = (this.completionIndex + 1) % this.completions.length;
      const nextCompletion = this.completions[nextIndex];
      this.setGhostText(nextCompletion + ' (Tab for next)');
    } else {
      this.updateGhostText();
    }
  }
  
  /**
   * Accept ghost text suggestion
   */
  acceptGhostText() {
    if (this.state.ghostText) {
      // Remove parameter hints if present
      const cleanText = this.state.ghostText.replace(/ <[^>]+>/g, '');
      this.setState({ value: cleanText });
      this.setGhostText('');
    }
  }
  
  /**
   * Cancel completion
   */
  cancelCompletion() {
    this.state.completionActive = false;
    this.completions = [];
    this.completionIndex = -1;
    this.setGhostText('');
  }
  
  /**
   * Set ghost text
   */
  setGhostText(text) {
    this.state.ghostText = text;
    this.elements.ghost.textContent = text;
  }
  
  /**
   * Set available commands for completion
   */
  setAvailableCommands(commands) {
    this.availableCommands = commands;
  }
  
  /**
   * Set tool definitions for parameter hints
   */
  setToolDefinitions(tools) {
    this.toolDefinitions = tools;
    this.updateGhostText();
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
    if (newState.ghostText !== undefined) {
      this.state.ghostText = newState.ghostText;
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
      // Update ghost text when value changes
      if (!this.state.completionActive) {
        this.updateGhostText();
      }
    }
    
    // Update prompt if changed
    if (this.state.prompt !== prevState.prompt) {
      this.elements.promptSpan.textContent = this.state.prompt;
    }
    
    // Update ghost text if changed
    if (this.state.ghostText !== prevState.ghostText) {
      this.elements.ghost.textContent = this.state.ghostText;
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
    this.setState({ value: '', ghostText: '' });
    this.cancelCompletion();
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