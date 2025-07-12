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
      } else {
        // Try to resolve as a tool command (with or without module prefix)
        const parts = processedCommand.split(' ');
        const commandName = parts[0];
        
        // Check if it's a direct tool command or module.tool format
        let toolData = null;
        let moduleName = null;
        let toolName = null;
        
        if (commandName.includes('.')) {
          // Module.tool format
          [moduleName, toolName] = commandName.split('.');
          toolData = this.cli.toolRegistry.resolveTool(`${moduleName}_${toolName}`) || 
                     this.cli.toolRegistry.resolveTool(toolName);
        } else {
          // Direct tool name or short name
          toolData = this.cli.toolRegistry.resolveTool(commandName);
        }
        
        if (toolData) {
          // Parse remaining arguments
          const toolArgs = {};
          const parsedArgs = this.parseInteractiveLine(trimmed);
          
          // Get tool parameters to determine positional argument mapping
          const toolParams = toolData.metadata.parameters;
          const paramNames = toolParams?.properties ? Object.keys(toolParams.properties) : [];
          const requiredParams = toolParams?.required || [];
          
          // Debug logging
          if (config?.verbose) {
            console.log('DEBUG: parsedArgs:', parsedArgs);
            console.log('DEBUG: paramNames:', paramNames);
          }
          
          // First pass: collect all named arguments
          let i = 1;
          const namedArgs = {};
          const positionalArgs = [];
          
          while (i < parsedArgs.length) {
            if (parsedArgs[i].startsWith('--')) {
              // Named argument
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
                    Object.assign(toolArgs, parsed);
                    break; // JSON consumes rest of args
                  } catch (e) {
                    console.error(`Invalid JSON: ${e.message}`);
                    rl.prompt();
                    return;
                  }
                } else {
                  namedArgs[key] = value;
                }
                i += 2;
              } else {
                namedArgs[key] = true;
                i++;
              }
            } else {
              // Collect positional arguments
              positionalArgs.push(parsedArgs[i]);
              i++;
            }
          }
          
          // Apply named arguments
          Object.assign(toolArgs, namedArgs);
          
          // Second pass: map positional arguments to unfilled parameters
          let positionalIndex = 0;
          for (let paramIndex = 0; paramIndex < paramNames.length && positionalIndex < positionalArgs.length; paramIndex++) {
            const paramName = paramNames[paramIndex];
            
            // Skip if already filled by named argument
            if (paramName in toolArgs) {
              continue;
            }
            
            // Check if this is the last unfilled parameter
            const remainingParams = paramNames.slice(paramIndex).filter(p => !(p in toolArgs));
            if (remainingParams.length === 1 && positionalArgs.length - positionalIndex > 1) {
              // Last unfilled parameter gets all remaining positional args
              toolArgs[paramName] = positionalArgs.slice(positionalIndex).join(' ');
              break;
            } else {
              toolArgs[paramName] = positionalArgs[positionalIndex];
              positionalIndex++;
            }
          }
          
          // Execute tool
          await this.cli.commands.execute.execute({
            moduleName: toolData.module,
            toolName: toolData.metadata.name || toolData.metadata.functionName,
            args: toolArgs,
            options: {}
          }, config);
        } else {
          console.log(`Unknown command: ${commandName}`);
          
          // Try to find similar commands
          const allTools = this.cli.toolRegistry.getAllTools();
          const allCommands = [];
          
          // Add tool names and short names
          for (const tool of allTools) {
            allCommands.push(tool.name);
            if (tool.shortNames) {
              allCommands.push(...tool.shortNames);
            }
          }
          
          // Add built-in commands
          allCommands.push('help', 'list', 'exit', 'quit', 'clear');
          
          // Find similar commands
          const similar = this.findSimilarCommands(commandName, allCommands);
          
          if (similar.length > 0) {
            console.log(`\nDid you mean:`);
            similar.forEach(cmd => console.log(`  ${cmd}`));
          }
          
          console.log('\nType "help" for available commands or "list" to see available tools');
        }
      }
    } catch (error) {
      this.cli.errorHandler.handle(error, config);
    }
    
    // Show prompt again
    rl.prompt();
  }

  /**
   * Parse interactive command line with smart argument handling
   * @param {string} line - Command line to parse
   * @returns {string[]} Parsed arguments
   */
  parseInteractiveLine(line) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (inQuotes) {
        if (char === quoteChar) {
          inQuotes = false;
          quoteChar = '';
          // Push the current string even if empty (for empty quotes)
          args.push(current);
          current = '';
        } else {
          current += char;
        }
      } else {
        if (char === '"' || char === "'") {
          inQuotes = true;
          quoteChar = char;
        } else if (char === ' ' || char === '\t') {
          if (current) {
            args.push(current);
            current = '';
          }
          // Skip multiple spaces
          while (i + 1 < line.length && (line[i + 1] === ' ' || line[i + 1] === '\t')) {
            i++;
          }
        } else {
          current += char;
        }
      }
      i++;
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
   * Find similar commands using Levenshtein distance
   * @param {string} input - User input
   * @param {string[]} commands - Available commands
   * @returns {string[]} Similar commands
   */
  findSimilarCommands(input, commands) {
    const maxDistance = 2; // Maximum edit distance
    const similar = [];
    
    for (const cmd of commands) {
      const distance = this.levenshteinDistance(input.toLowerCase(), cmd.toLowerCase());
      if (distance <= maxDistance && distance > 0) {
        similar.push(cmd);
      }
    }
    
    // Sort by similarity (lower distance first)
    return similar.sort((a, b) => {
      const distA = this.levenshteinDistance(input.toLowerCase(), a.toLowerCase());
      const distB = this.levenshteinDistance(input.toLowerCase(), b.toLowerCase());
      return distA - distB;
    }).slice(0, 3); // Return top 3 suggestions
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {number} Edit distance
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
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