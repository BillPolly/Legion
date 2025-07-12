/**
 * ArgumentParser - Handles CLI argument parsing and validation
 */

export class ArgumentParser {
  constructor(config = {}) {
    this.config = config;
    this.aliasExpansionDepth = 0;
    this.maxAliasExpansionDepth = 10;
  }

  /**
   * Parse command line arguments
   * @param {string[]} argv - Command line arguments
   * @returns {object} Parsed arguments and options
   */
  parse(argv) {
    // Initialize default values
    const result = {
      args: {},
      options: {
        verbose: false,
        output: 'text',
        color: true,
        config: null,
        preset: null,
        batch: null
      },
      command: null,
      moduleName: null,
      toolName: null,
      helpTopic: null,
      listType: null
    };
    
    // Skip node and script name
    const args = argv.slice(2);
    
    if (args.length === 0) {
      result.command = 'help';
      return result;
    }
    
    let currentIndex = 0;
    
    // Parse global options first
    while (currentIndex < args.length && args[currentIndex].startsWith('--')) {
      const option = args[currentIndex];
      
      if (option === '--verbose') {
        result.options.verbose = true;
        currentIndex++;
      } else if (option === '--output') {
        currentIndex++;
        if (currentIndex < args.length) {
          result.options.output = args[currentIndex];
          currentIndex++;
        }
      } else if (option === '--no-color') {
        result.options.color = false;
        currentIndex++;
      } else if (option === '--config') {
        currentIndex++;
        if (currentIndex < args.length) {
          result.options.config = args[currentIndex];
          currentIndex++;
        } else {
          throw new Error('--config requires a value');
        }
      } else if (option === '--preset') {
        currentIndex++;
        if (currentIndex < args.length) {
          result.options.preset = args[currentIndex];
          currentIndex++;
        } else {
          throw new Error('--preset requires a value');
        }
      } else if (option === '--batch') {
        currentIndex++;
        if (currentIndex < args.length) {
          result.options.batch = args[currentIndex];
          currentIndex++;
        } else {
          throw new Error('--batch requires a value');
        }
      } else {
        break; // Not a global option, stop parsing
      }
    }
    
    // Check for help flags
    if (args.includes('--help') || args.includes('-h')) {
      result.command = 'help';
      // If there's a command before --help, use it as help topic
      const helpIndex = Math.max(args.indexOf('--help'), args.indexOf('-h'));
      if (helpIndex > 0 && !args[0].startsWith('-')) {
        result.helpTopic = args[0];
      }
      return result;
    }
    
    // Check for -i flag
    if (args[currentIndex] === '-i') {
      result.command = 'interactive';
      return result;
    }
    
    // Get the main command
    const mainArg = args[currentIndex];
    currentIndex++;
    
    // Check for alias expansion (including built-in aliases)
    if (mainArg) {
      const expandedCommand = this.expandAlias(mainArg);
      if (expandedCommand && expandedCommand !== mainArg) {
        // Replace the alias with expanded command
        const expandedParts = this.splitCommandLine(expandedCommand);
        const remainingArgs = args.slice(currentIndex);
        const newArgs = [...args.slice(0, currentIndex - 1), ...expandedParts, ...remainingArgs];
        // Re-parse with expanded args
        return this.parse(['node', 'jsenvoy', ...newArgs]);
      }
    }
    
    // Check for special commands
    if (mainArg === 'help') {
      result.command = 'help';
      if (currentIndex < args.length) {
        result.helpTopic = args[currentIndex];
      }
      return result;
    }
    
    if (mainArg === 'list') {
      result.command = 'list';
      result.listType = currentIndex < args.length ? args[currentIndex] : 'all';
      return result;
    }
    
    if (mainArg === 'interactive') {
      result.command = 'interactive';
      return result;
    }
    
    // Check for module.tool syntax
    if (mainArg.includes('.')) {
      const [moduleName, toolName] = mainArg.split('.');
      if (moduleName && toolName) {
        result.command = 'execute';
        result.moduleName = moduleName;
        result.toolName = toolName;
        
        // Parse remaining arguments
        while (currentIndex < args.length) {
          const arg = args[currentIndex];
          
          if (arg === '--json') {
            currentIndex++;
            if (currentIndex < args.length) {
              try {
                const jsonArgs = JSON.parse(args[currentIndex]);
                Object.assign(result.args, jsonArgs);
              } catch (e) {
                throw new Error(`Invalid JSON argument: ${e.message}`);
              }
              currentIndex++;
            }
          } else if (arg.startsWith('--')) {
            const key = arg.slice(2);
            currentIndex++;
            
            if (currentIndex < args.length && !args[currentIndex].startsWith('--')) {
              // Named argument with value
              let value = args[currentIndex];
              // Remove quotes if present
              if ((value.startsWith('"') && value.endsWith('"')) || 
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
              }
              result.args[key] = value;
              currentIndex++;
            } else {
              // Boolean flag
              result.args[key] = true;
            }
          } else {
            currentIndex++;
          }
        }
        
        return result;
      }
    }
    
    // If we get here, it's an invalid command
    throw new Error(`Invalid command: ${mainArg}`);
  }

  /**
   * Expand command aliases
   * @param {string} command - Command to expand
   * @returns {string} Expanded command or original if no alias
   */
  expandAlias(command) {
    // Prevent infinite recursion
    if (this.aliasExpansionDepth >= this.maxAliasExpansionDepth) {
      throw new Error('Circular alias detected');
    }
    
    // Built-in aliases
    const builtInAliases = {
      'ls': 'list',
      'i': 'interactive'
    };
    
    // Check built-in aliases first
    if (builtInAliases[command]) {
      return builtInAliases[command];
    }
    
    // Check user-defined aliases
    if (this.config?.aliases && this.config.aliases[command]) {
      this.aliasExpansionDepth++;
      try {
        const expanded = this.config.aliases[command];
        // Check if the expansion itself is an alias
        const firstWord = expanded.split(' ')[0];
        const furtherExpanded = this.expandAlias(firstWord);
        if (furtherExpanded && furtherExpanded !== firstWord) {
          return expanded.replace(firstWord, furtherExpanded);
        }
        return expanded;
      } finally {
        this.aliasExpansionDepth--;
      }
    }
    
    return command;
  }

  /**
   * Split command line respecting quotes
   * @param {string} command - Command line to split
   * @returns {string[]} Split command parts
   */
  splitCommandLine(command) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if ((char === '"' || char === "'") && (i === 0 || command[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        } else {
          current += char;
        }
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  /**
   * Parse command chain (commands separated by && or ;)
   * @param {string[]} argv - Command line arguments
   * @returns {object[]} Array of parsed commands
   */
  parseCommandChain(argv) {
    const args = argv.slice(2);
    const commands = [];
    let currentCommand = [];
    
    // Parse commands and operators
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '&&' || args[i] === ';') {
        if (currentCommand.length > 0) {
          commands.push({ args: currentCommand, operator: args[i] });
          currentCommand = [];
        }
      } else {
        currentCommand.push(args[i]);
      }
    }
    
    // Add the last command
    if (currentCommand.length > 0) {
      commands.push({ args: currentCommand, operator: null });
    }
    
    return commands;
  }

  /**
   * Check if arguments contain command chain
   * @param {string[]} argv - Command line arguments
   * @returns {boolean} True if command chain detected
   */
  hasCommandChain(argv) {
    return argv && (argv.includes('&&') || argv.includes(';'));
  }
}

export default ArgumentParser;