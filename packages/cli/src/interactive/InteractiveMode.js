/**
 * InteractiveMode - Main REPL loop and command processing
 */

export class InteractiveMode {
  constructor(cli, tabCompleter, commandHistory, multiLineInput) {
    this.cli = cli;
    this.tabCompleter = tabCompleter;
    this.commandHistory = commandHistory;
    this.multiLineInput = multiLineInput;
    this.interactiveContext = {};
  }

  /**
   * Start interactive mode
   * @param {readline.Interface} rl - Readline interface
   * @param {object} config - Configuration
   */
  async start(rl, config) {
    // Set prompt
    rl.setPrompt('jsenvoy> ');
    rl.prompt();
    
    // Return a promise that resolves when the REPL exits
    return new Promise((resolve) => {
      // Handle line input
      rl.on('line', async (line) => {
        const trimmed = line.trim();
        
        // Handle multi-line mode
        if (this.multiLineInput.isActive()) {
          const result = this.multiLineInput.processLine(line);
          
          if (result.cancelled) {
            console.log('Multi-line input cancelled');
            rl.setPrompt('jsenvoy> ');
            rl.prompt();
            return;
          }
          
          if (result.complete) {
            rl.setPrompt('jsenvoy> ');
            // Process the complete command
            await this.processCommand(result.command, rl, config);
            return;
          }
          
          // Continue multi-line input
          rl.setPrompt('... ');
          rl.prompt();
          return;
        }
        
        // Skip empty lines
        if (!trimmed) {
          rl.prompt();
          return;
        }
        
        // Add to history
        this.commandHistory.add(trimmed);
        
        // Check for multi-line start
        if (this.multiLineInput.shouldStartMultiLine(trimmed)) {
          this.multiLineInput.start(trimmed);
          rl.setPrompt('... ');
          rl.prompt();
          return;
        }
        
        // Handle special commands
        if (trimmed === 'exit' || trimmed === 'quit' || trimmed === '.exit') {
          console.log('Goodbye!');
          rl.close();
          return;
        }
        
        if (trimmed === 'clear' || trimmed === 'cls') {
          process.stdout.write('\x1Bc');
          rl.prompt();
          return;
        }
        
        if (trimmed.startsWith('set ')) {
          this.handleSetCommand(trimmed);
          rl.prompt();
          return;
        }
        
        if (trimmed === 'show') {
          this.handleShowCommand();
          rl.prompt();
          return;
        }
        
        // Process the command
        await this.processCommand(trimmed, rl, config);
      });
      
      // Handle SIGINT (Ctrl+C)
      rl.on('SIGINT', () => {
        console.log('\nGoodbye!');
        rl.close();
      });
      
      // Handle close event
      rl.on('close', () => {
        resolve();
      });
    });
  }

  /**
   * Process a command in interactive mode
   * @param {string} command - Command to process
   * @param {readline.Interface} rl - Readline interface
   * @param {object} config - Configuration
   */
  async processCommand(command, rl, config) {
    try {
      const trimmed = command.trim();
      
      // Expand aliases
      const firstWord = trimmed.split(' ')[0];
      const expanded = this.cli.argumentParser.expandAlias(firstWord);
      let processedCommand = trimmed;
      if (expanded && expanded !== firstWord) {
        processedCommand = trimmed.replace(firstWord, expanded);
      }
      
      // Parse the command line
      const args = this.parseInteractiveLine(processedCommand);
      
      // Execute based on command type
      if (processedCommand === 'help') {
        await this.cli.commands.help.execute({ helpTopic: null }, config);
      } else if (processedCommand.startsWith('help ')) {
        const topic = processedCommand.substring(5).trim();
        await this.cli.commands.help.execute({ helpTopic: topic }, config);
      } else if (processedCommand === 'list' || processedCommand === 'list all') {
        await this.cli.commands.list.execute({ listType: 'all', options: {} }, config);
      } else if (processedCommand === 'list modules') {
        await this.cli.commands.list.execute({ listType: 'modules', options: {} }, config);
      } else if (processedCommand === 'list tools') {
        await this.cli.commands.list.execute({ listType: 'tools', args: {}, options: {} }, config);
      } else if (processedCommand === 'list aliases') {
        await this.cli.commands.list.execute({ listType: 'aliases', options: {} }, config);
      } else if (processedCommand === 'list presets') {
        await this.cli.commands.list.execute({ listType: 'presets', options: {} }, config);
      } else if (processedCommand.includes('.')) {
        // Tool command
        const parts = processedCommand.split(' ');
        const [moduleName, toolName] = parts[0].split('.');
        
        // Parse remaining arguments
        const toolArgs = {};
        const parsedArgs = this.parseInteractiveLine(trimmed);
        let i = 1;
        while (i < parsedArgs.length) {
          if (parsedArgs[i].startsWith('--')) {
            const key = parsedArgs[i].substring(2);
            if (i + 1 < parsedArgs.length && !parsedArgs[i + 1].startsWith('--')) {
              let value = parsedArgs[i + 1];
              
              // Handle JSON arguments
              if (key === 'json' && (value.startsWith('{') || value.startsWith('['))) {
                // Find where JSON starts in the original command
                const jsonIndex = processedCommand.indexOf(value);
                const jsonString = processedCommand.substring(jsonIndex);
                try {
                  const parsed = JSON.parse(jsonString);
                  // Merge parsed JSON into toolArgs
                  Object.assign(toolArgs, parsed);
                  break; // JSON consumes rest of args
                } catch (e) {
                  console.error(`Invalid JSON: ${e.message}`);
                  rl.prompt();
                  return;
                }
              } else {
                toolArgs[key] = value;
              }
              i += 2;
            } else {
              toolArgs[key] = true;
              i++;
            }
          } else {
            i++;
          }
        }
        
        // Execute tool
        await this.cli.commands.execute.execute({
          moduleName,
          toolName,
          args: toolArgs,
          options: {}
        }, config);
      } else {
        console.log(`Unknown command: ${processedCommand}`);
        console.log('Type "help" for available commands');
      }
    } catch (error) {
      this.cli.errorHandler.handle(error, config);
    }
    
    // Show prompt again
    rl.prompt();
  }

  /**
   * Parse interactive command line
   * @param {string} line - Command line to parse
   * @returns {string[]} Parsed arguments
   */
  parseInteractiveLine(line) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
        } else {
          current += char;
        }
      } else {
        if (char === '"' || char === "'") {
          inQuotes = true;
          quoteChar = char;
        } else if (char === ' ') {
          if (current) {
            args.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }
    }
    
    if (current) {
      args.push(current);
    }
    
    return args;
  }

  /**
   * Handle set command
   * @param {string} command - Set command
   */
  handleSetCommand(command) {
    const parts = command.substring(4).split(' ');
    if (parts.length >= 2) {
      const key = parts[0];
      const value = parts.slice(1).join(' ');
      // Convert string values to appropriate types
      if (value === 'true') {
        this.interactiveContext[key] = true;
      } else if (value === 'false') {
        this.interactiveContext[key] = false;
      } else if (!isNaN(value)) {
        this.interactiveContext[key] = Number(value);
      } else {
        this.interactiveContext[key] = value;
      }
      console.log(`Set ${key} = ${value}`);
    }
  }

  /**
   * Handle show command
   */
  handleShowCommand() {
    console.log('Context:');
    Object.entries(this.interactiveContext).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
    if (Object.keys(this.interactiveContext).length === 0) {
      console.log('  (empty)');
    }
  }

  /**
   * Get tab completer function
   * @returns {Function} Completer function
   */
  getCompleter() {
    return this.tabCompleter.getCompleter();
  }
}

export default InteractiveMode;