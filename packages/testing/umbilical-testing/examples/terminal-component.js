/**
 * Example: Terminal Component with Actor-Based Architecture
 * This component demonstrates a complex MVVM terminal emulator that uses
 * actor-based communication patterns and requires comprehensive testing.
 */

export const TerminalComponent = {
  name: 'TerminalComponent',
  
  describe: function(descriptor) {
    descriptor
      .name('TerminalComponent')
      .description('Interactive terminal emulator with command processing')
      .requires('actorSpace', 'ActorSpace')
      .requires('commandProcessor', 'CommandProcessor')
      .requires('dom', 'DOMElement')
      .requires('eventSystem', 'EventSystem')
      .optional('fileSystem', 'FileSystem')
      .optional('networkClient', 'NetworkClient')
      
      // State management
      .manages('history', 'Array', { default: [], maxLength: 1000 })
      .manages('currentInput', 'string', { default: '' })
      .manages('cursorPosition', 'number', { default: 0, min: 0 })
      .manages('historyIndex', 'number', { default: -1 })
      .manages('outputBuffer', 'Array', { default: [] })
      .manages('currentDirectory', 'string', { default: '~' })
      .manages('environmentVars', 'Object', { default: {} })
      .manages('isProcessing', 'boolean', { default: false })
      
      // Events
      .listens('keydown', 'object')
      .listens('paste', 'object')
      .emits('command', 'string')
      .emits('output', 'object')
      .emits('stateChange', 'object')
      .emits('error', 'string')
      
      // DOM structure
      .creates('div.terminal-container')
      .creates('div.terminal-output', {
        attributes: { role: 'log', 'aria-live': 'polite' }
      })
      .creates('div.terminal-input-line')
      .creates('span.terminal-prompt', {
        attributes: { textContent: 'state.currentDirectory + " $ "' }
      })
      .creates('input.terminal-input', {
        attributes: { 
          value: 'state.currentInput',
          spellcheck: 'false',
          autocomplete: 'off'
        },
        events: {
          keydown: 'handleKeydown',
          input: 'handleInput',
          paste: 'handlePaste'
        }
      })
      
      // Actor definitions
      .actor('CommandActor', {
        protocol: 'command-processing',
        handles: ['execute', 'validate', 'autocomplete'],
        emits: ['result', 'error', 'suggestion']
      })
      .actor('OutputActor', {
        protocol: 'output-management',
        handles: ['write', 'clear', 'scroll'],
        emits: ['rendered', 'overflow']
      })
      .actor('HistoryActor', {
        protocol: 'history-management',
        handles: ['add', 'navigate', 'search'],
        emits: ['updated', 'found']
      })
      
      // User flows
      .flow('command-execution', [
        'User types command',
        'Press Enter to execute',
        'Command is validated',
        'Command is processed',
        'Output is displayed',
        'History is updated'
      ])
      .flow('history-navigation', [
        'User presses Arrow Up',
        'Previous command is loaded',
        'Cursor is positioned at end',
        'User can edit command',
        'User executes modified command'
      ])
      .flow('autocomplete', [
        'User types partial command',
        'User presses Tab',
        'Suggestions are generated',
        'First suggestion is applied',
        'User can cycle through suggestions'
      ])
      
      // Invariants
      .invariant('cursor-bounds', (state) => 
        state.cursorPosition >= 0 && 
        state.cursorPosition <= state.currentInput.length
      )
      .invariant('history-index-bounds', (state) =>
        state.historyIndex >= -1 && 
        state.historyIndex < state.history.length
      )
      .invariant('history-limit', (state) =>
        state.history.length <= 1000
      );
  },
  
  create: function(dependencies) {
    const { actorSpace, commandProcessor, dom, eventSystem, fileSystem, networkClient } = dependencies;
    
    // Initialize state
    const state = new Map([
      ['history', []],
      ['currentInput', ''],
      ['cursorPosition', 0],
      ['historyIndex', -1],
      ['outputBuffer', []],
      ['currentDirectory', '~'],
      ['environmentVars', { USER: 'user', HOME: '~', PATH: '/usr/bin:/bin' }],
      ['isProcessing', false]
    ]);
    
    // Create actors
    const actors = {
      command: null,
      output: null,
      history: null
    };
    
    // Initialize actors if actorSpace is available
    if (actorSpace) {
      actors.command = actorSpace.createActor('CommandActor', {
        handle: async (message) => {
          switch (message.type) {
            case 'execute':
              return await commandProcessor.execute(message.command);
            case 'validate':
              return commandProcessor.validate(message.command);
            case 'autocomplete':
              return commandProcessor.autocomplete(message.partial);
            default:
              throw new Error(`Unknown message type: ${message.type}`);
          }
        }
      });
      
      actors.output = actorSpace.createActor('OutputActor', {
        handle: (message) => {
          const buffer = state.get('outputBuffer');
          switch (message.type) {
            case 'write':
              buffer.push(message.content);
              state.set('outputBuffer', buffer.slice(-500)); // Keep last 500 lines
              break;
            case 'clear':
              state.set('outputBuffer', []);
              break;
            case 'scroll':
              // Handle scrolling logic
              break;
          }
        }
      });
      
      actors.history = actorSpace.createActor('HistoryActor', {
        handle: (message) => {
          const history = state.get('history');
          switch (message.type) {
            case 'add':
              if (message.command && message.command.trim()) {
                const newHistory = [...history, message.command];
                state.set('history', newHistory.slice(-1000));
                state.set('historyIndex', -1);
              }
              break;
            case 'navigate':
              const newIndex = Math.max(-1, Math.min(history.length - 1, message.direction === 'up' ? 
                state.get('historyIndex') + 1 : state.get('historyIndex') - 1));
              state.set('historyIndex', newIndex);
              if (newIndex >= 0 && newIndex < history.length) {
                const command = history[history.length - 1 - newIndex];
                state.set('currentInput', command);
                state.set('cursorPosition', command.length);
              }
              break;
            case 'search':
              return history.filter(cmd => cmd.includes(message.query));
          }
        }
      });
    }
    
    // Component instance
    return {
      dependencies,
      state,
      actors,
      
      // CORRECT: Proper input handling
      handleInput: function(event) {
        const value = event.target.value; // Extract value correctly
        const cursorPos = event.target.selectionStart;
        
        this.state.set('currentInput', value);
        this.state.set('cursorPosition', cursorPos);
        
        // Emit state change with proper values
        eventSystem.dispatchEvent('stateChange', {
          input: value,
          cursor: cursorPos
        });
      },
      
      // CORRECT: Keyboard event handling
      handleKeydown: async function(event) {
        const key = event.key;
        const currentInput = this.state.get('currentInput');
        
        switch (key) {
          case 'Enter':
            event.preventDefault();
            await this.executeCommand(currentInput);
            break;
            
          case 'ArrowUp':
            event.preventDefault();
            this.navigateHistory('up');
            break;
            
          case 'ArrowDown':
            event.preventDefault();
            this.navigateHistory('down');
            break;
            
          case 'Tab':
            event.preventDefault();
            await this.handleAutocomplete(currentInput);
            break;
            
          case 'c':
            if (event.ctrlKey) {
              event.preventDefault();
              this.cancelCurrentCommand();
            }
            break;
            
          case 'l':
            if (event.ctrlKey) {
              event.preventDefault();
              this.clearTerminal();
            }
            break;
        }
      },
      
      // CORRECT: Paste handling
      handlePaste: function(event) {
        event.preventDefault();
        const pastedText = event.clipboardData.getData('text');
        
        // Sanitize pasted text
        const sanitized = pastedText.replace(/[\r\n]+/g, ' ').trim();
        
        const currentInput = this.state.get('currentInput');
        const cursorPos = this.state.get('cursorPosition');
        
        // Insert at cursor position
        const newInput = currentInput.slice(0, cursorPos) + sanitized + currentInput.slice(cursorPos);
        const newCursor = cursorPos + sanitized.length;
        
        this.state.set('currentInput', newInput);
        this.state.set('cursorPosition', newCursor);
      },
      
      // Execute command with proper async handling
      executeCommand: async function(command) {
        if (!command.trim()) return;
        
        this.state.set('isProcessing', true);
        
        // Add to output
        this.addOutput(`$ ${command}`, 'command');
        
        // Add to history
        if (this.actors.history) {
          await this.actors.history.send({ type: 'add', command });
        }
        
        try {
          // Process command
          let result;
          if (this.actors.command) {
            result = await this.actors.command.send({ type: 'execute', command });
          } else {
            result = await commandProcessor.execute(command);
          }
          
          // Display result
          this.addOutput(result.output, result.type || 'output');
          
          // Update directory if changed
          if (result.newDirectory) {
            this.state.set('currentDirectory', result.newDirectory);
          }
          
          // Update environment if changed
          if (result.environmentChanges) {
            const currentEnv = this.state.get('environmentVars');
            this.state.set('environmentVars', { ...currentEnv, ...result.environmentChanges });
          }
          
          // Emit command event
          eventSystem.dispatchEvent('command', command);
          
        } catch (error) {
          const errorMessage = error.message || 'Command execution failed';
          this.addOutput(errorMessage, 'error');
          eventSystem.dispatchEvent('error', errorMessage);
        } finally {
          // Clear input and reset
          this.state.set('currentInput', '');
          this.state.set('cursorPosition', 0);
          this.state.set('historyIndex', -1);
          this.state.set('isProcessing', false);
        }
      },
      
      // Navigate command history
      navigateHistory: function(direction) {
        if (this.actors.history) {
          this.actors.history.send({ type: 'navigate', direction });
        } else {
          const history = this.state.get('history');
          const currentIndex = this.state.get('historyIndex');
          
          let newIndex;
          if (direction === 'up') {
            newIndex = Math.min(currentIndex + 1, history.length - 1);
          } else {
            newIndex = Math.max(currentIndex - 1, -1);
          }
          
          this.state.set('historyIndex', newIndex);
          
          if (newIndex >= 0 && newIndex < history.length) {
            const command = history[history.length - 1 - newIndex];
            this.state.set('currentInput', command);
            this.state.set('cursorPosition', command.length);
          } else if (newIndex === -1) {
            this.state.set('currentInput', '');
            this.state.set('cursorPosition', 0);
          }
        }
      },
      
      // Handle autocomplete
      handleAutocomplete: async function(partial) {
        if (!partial.trim()) return;
        
        try {
          let suggestions;
          if (this.actors.command) {
            suggestions = await this.actors.command.send({ type: 'autocomplete', partial });
          } else {
            suggestions = commandProcessor.autocomplete(partial);
          }
          
          if (suggestions && suggestions.length > 0) {
            // Apply first suggestion
            this.state.set('currentInput', suggestions[0]);
            this.state.set('cursorPosition', suggestions[0].length);
            
            // Show all suggestions if multiple
            if (suggestions.length > 1) {
              this.addOutput(`Suggestions: ${suggestions.join(', ')}`, 'info');
            }
          }
        } catch (error) {
          console.error('Autocomplete error:', error);
        }
      },
      
      // Add output to buffer
      addOutput: function(content, type = 'output') {
        const outputBuffer = this.state.get('outputBuffer');
        const timestamp = new Date().toISOString();
        
        const outputEntry = {
          content: String(content), // Ensure string type
          type,
          timestamp
        };
        
        const newBuffer = [...outputBuffer, outputEntry].slice(-500);
        this.state.set('outputBuffer', newBuffer);
        
        if (this.actors.output) {
          this.actors.output.send({ type: 'write', content: outputEntry });
        }
        
        eventSystem.dispatchEvent('output', outputEntry);
      },
      
      // Clear terminal
      clearTerminal: function() {
        this.state.set('outputBuffer', []);
        if (this.actors.output) {
          this.actors.output.send({ type: 'clear' });
        }
      },
      
      // Cancel current command
      cancelCurrentCommand: function() {
        if (this.state.get('isProcessing')) {
          this.state.set('isProcessing', false);
          this.addOutput('^C', 'error');
        }
        this.state.set('currentInput', '');
        this.state.set('cursorPosition', 0);
      },
      
      // State management
      setState: function(key, value) {
        this.state.set(key, value);
      },
      
      getState: function(key) {
        return this.state.get(key);
      },
      
      // Render terminal UI
      render: function() {
        if (!dom) return null;
        
        const container = dom.createElement('div');
        container.className = 'terminal-container';
        
        // Output area
        const output = dom.createElement('div');
        output.className = 'terminal-output';
        output.setAttribute('role', 'log');
        output.setAttribute('aria-live', 'polite');
        
        // Render output buffer
        const outputBuffer = this.state.get('outputBuffer');
        outputBuffer.forEach(entry => {
          const line = dom.createElement('div');
          line.className = `terminal-line terminal-${entry.type}`;
          line.textContent = entry.content;
          output.appendChild(line);
        });
        
        // Input line
        const inputLine = dom.createElement('div');
        inputLine.className = 'terminal-input-line';
        
        // Prompt
        const prompt = dom.createElement('span');
        prompt.className = 'terminal-prompt';
        prompt.textContent = `${this.state.get('currentDirectory')} $ `;
        
        // Input field
        const input = dom.createElement('input');
        input.className = 'terminal-input';
        input.type = 'text';
        input.value = this.state.get('currentInput');
        input.spellcheck = false;
        input.autocomplete = 'off';
        
        if (this.state.get('isProcessing')) {
          input.disabled = true;
        }
        
        inputLine.appendChild(prompt);
        inputLine.appendChild(input);
        
        container.appendChild(output);
        container.appendChild(inputLine);
        
        return container;
      },
      
      // Cleanup
      destroy: function() {
        // Clean up actors
        if (this.actors.command) this.actors.command.destroy();
        if (this.actors.output) this.actors.output.destroy();
        if (this.actors.history) this.actors.history.destroy();
        
        // Clear state
        this.state.clear();
      }
    };
  }
};

/**
 * Testing the Terminal Component:
 * 
 * import { UmbilicalTestingFramework } from '@legion/umbilical-testing';
 * 
 * const framework = new UmbilicalTestingFramework({
 *   includeActorTests: true,
 *   includeFlowTests: true,
 *   includeInvariantTests: true
 * });
 * 
 * const results = await framework.testComponent(TerminalComponent);
 * 
 * console.log('Component complexity:', results.description.summary.totalCapabilities);
 * // Expected: High complexity due to actors, flows, and invariants
 * 
 * console.log('Actor tests passed:', results.testResults.generators.ActorTestGenerator.passed);
 * // Tests actor-based communication
 * 
 * console.log('Flow tests passed:', results.testResults.generators.FlowTestGenerator.passed);
 * // Tests complete user workflows
 * 
 * console.log('Invariant tests passed:', results.testResults.generators.InvariantTestGenerator.passed);
 * // Tests cursor bounds, history limits, etc.
 * 
 * console.log('Quality grade:', results.report.executive.grade);
 * // Expected: 'A' or 'A+' for well-implemented component
 */