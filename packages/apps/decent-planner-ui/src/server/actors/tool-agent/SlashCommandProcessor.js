/**
 * SlashCommandProcessor - Parse and route slash commands
 * 
 * Provides modular command parsing with extensible command registry.
 * Follows fail-fast principles with no fallbacks.
 */

export class SlashCommandProcessor {
  constructor() {
    this.commands = new Map();
    this.registerCoreCommands();
  }

  /**
   * Register core slash commands
   */
  registerCoreCommands() {
    this.commands.set('help', {
      name: 'help',
      description: 'Show available commands or help for specific command',
      usage: '/help [command]',
      args: [
        { name: 'command', type: 'string', optional: true, description: 'Command to get help for' }
      ],
      category: 'core'
    });

    this.commands.set('context', {
      name: 'context',
      description: 'Display current execution context and variables',
      usage: '/context',
      args: [],
      category: 'debug'
    });

    this.commands.set('clear', {
      name: 'clear',
      description: 'Clear chat context and execution state',
      usage: '/clear',
      args: [],
      category: 'core'
    });

    this.commands.set('debug', {
      name: 'debug',
      description: 'Show debug information (LLM interactions, tool searches)',
      usage: '/debug [type]',
      args: [
        { name: 'type', type: 'string', optional: true, description: 'Debug type: llm, tools, operations' }
      ],
      category: 'debug'
    });

    this.commands.set('history', {
      name: 'history',
      description: 'Show recent operation history',
      usage: '/history [count]',
      args: [
        { name: 'count', type: 'number', optional: true, description: 'Number of recent operations to show' }
      ],
      category: 'debug'
    });

    this.commands.set('save', {
      name: 'save',
      description: 'Save current context/chat as named session',
      usage: '/save <name>',
      args: [
        { name: 'name', type: 'string', required: true, description: 'Session name to save as' }
      ],
      category: 'session'
    });

    this.commands.set('load', {
      name: 'load',
      description: 'Load saved session',
      usage: '/load <name>',
      args: [
        { name: 'name', type: 'string', required: true, description: 'Session name to load' }
      ],
      category: 'session'
    });
    
    this.commands.set('show', {
      name: 'show',
      description: 'Open a resource (file, image, directory) in appropriate viewer',
      usage: '/show <path>',
      args: [
        { name: 'path', type: 'string', required: true, description: 'Path to the resource to display' }
      ],
      category: 'resources',
      examples: [
        '/show myfile.txt',
        '/show image.png', 
        '/show /path/to/directory',
        '/show script.js'
      ]
    });
  }

  /**
   * Parse slash command input
   * @param {string} input - User input starting with /
   * @returns {Object} Parsed command or null if not a slash command
   */
  parseCommand(input) {
    const trimmedInput = input.trim();
    if (!trimmedInput.startsWith('/')) {
      return null;
    }

    const trimmed = trimmedInput.slice(1).trim();
    if (!trimmed) {
      return {
        isSlashCommand: true,
        isValid: false,
        error: 'Empty command. Use /help to see available commands.'
      };
    }

    const parts = this.parseCommandLine(trimmed);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const commandSpec = this.commands.get(commandName);
    if (!commandSpec) {
      return {
        isSlashCommand: true,
        isValid: false,
        error: `Unknown command: /${commandName}. Use /help to see available commands.`
      };
    }

    // Validate arguments
    const validation = this.validateArguments(commandSpec, args);
    if (!validation.valid) {
      return {
        isSlashCommand: true,
        isValid: false,
        error: validation.error,
        usage: commandSpec.usage
      };
    }

    return {
      isSlashCommand: true,
      isValid: true,
      command: commandName,
      args: validation.parsedArgs,
      spec: commandSpec
    };
  }

  /**
   * Parse command line into parts, respecting quotes
   * @param {string} line - Command line
   * @returns {Array} Array of command parts
   */
  parseCommandLine(line) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;
    let wasQuoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        wasQuoted = true;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = null;
        // Don't reset wasQuoted here - we want to remember this was a quoted string
      } else if (char === ' ' && !inQuotes) {
        if (current.trim() || wasQuoted) {
          parts.push(current.trim());
          current = '';
          wasQuoted = false;
        }
      } else if (!((char === '"' || char === "'") && (inQuotes && char === quoteChar))) {
        // Add character unless it's the closing quote
        current += char;
      }
    }

    if (current.trim() || wasQuoted) {
      parts.push(current.trim());
    }

    if (inQuotes) {
      throw new Error(`Unterminated quote in command: ${line}`);
    }

    return parts;
  }

  /**
   * Validate command arguments against specification
   * @param {Object} commandSpec - Command specification
   * @param {Array} args - Provided arguments
   * @returns {Object} Validation result with parsed args
   */
  validateArguments(commandSpec, args) {
    const parsedArgs = {};
    const errors = [];

    // Check required arguments
    const requiredArgs = commandSpec.args.filter(arg => arg.required);
    if (args.length < requiredArgs.length) {
      return {
        valid: false,
        error: `Missing required arguments. Usage: ${commandSpec.usage}`
      };
    }

    // Parse and validate each argument
    for (let i = 0; i < commandSpec.args.length; i++) {
      const argSpec = commandSpec.args[i];
      const providedValue = args[i];

      if (providedValue === undefined) {
        if (argSpec.required) {
          errors.push(`Missing required argument: ${argSpec.name}`);
        }
        continue;
      }

      // Handle empty string arguments (they are valid but empty)
      if (providedValue === '') {
        parsedArgs[argSpec.name] = '';
        continue;
      }

      // Type conversion and validation
      let parsedValue = providedValue;
      switch (argSpec.type) {
        case 'number':
          parsedValue = Number(providedValue);
          if (isNaN(parsedValue)) {
            errors.push(`Argument '${argSpec.name}' must be a number, got: ${providedValue}`);
          }
          break;
        case 'boolean':
          parsedValue = ['true', '1', 'yes', 'on'].includes(providedValue.toLowerCase());
          break;
        case 'string':
          break;
        default:
          break;
      }

      parsedArgs[argSpec.name] = parsedValue;
    }

    // Check for extra arguments
    if (args.length > commandSpec.args.length) {
      const extra = args.slice(commandSpec.args.length);
      errors.push(`Unexpected arguments: ${extra.join(' ')}`);
    }

    if (errors.length > 0) {
      return {
        valid: false,
        error: errors.join('; ') + `. Usage: ${commandSpec.usage}`
      };
    }

    return {
      valid: true,
      parsedArgs
    };
  }

  /**
   * Get command specification by name
   * @param {string} commandName - Command name
   * @returns {Object|null} Command specification
   */
  getCommandSpec(commandName) {
    return this.commands.get(commandName.toLowerCase()) || null;
  }

  /**
   * Get all registered commands
   * @returns {Map} All command specifications
   */
  getAllCommands() {
    return new Map(this.commands);
  }

  /**
   * Get commands by category
   * @param {string} category - Category name
   * @returns {Array} Commands in category
   */
  getCommandsByCategory(category) {
    return Array.from(this.commands.values()).filter(cmd => cmd.category === category);
  }

  /**
   * Register a new slash command
   * @param {Object} commandSpec - Command specification
   */
  registerCommand(commandSpec) {
    if (!commandSpec.name || typeof commandSpec.name !== 'string') {
      throw new Error('Command must have a name');
    }

    if (!commandSpec.description) {
      throw new Error('Command must have a description');
    }

    if (!commandSpec.usage) {
      throw new Error('Command must have usage text');
    }

    if (!Array.isArray(commandSpec.args)) {
      throw new Error('Command must have args array');
    }

    this.commands.set(commandSpec.name.toLowerCase(), commandSpec);
  }

  /**
   * Generate help text for a specific command or all commands
   * @param {string|null} commandName - Specific command or null for all
   * @returns {string} Formatted help text
   */
  generateHelpText(commandName = null) {
    if (commandName) {
      const spec = this.getCommandSpec(commandName);
      if (!spec) {
        return `Unknown command: /${commandName}. Use /help to see available commands.`;
      }

      let help = `**/${spec.name}** - ${spec.description}\n\n`;
      help += `**Usage:** ${spec.usage}\n\n`;
      
      if (spec.args.length > 0) {
        help += '**Arguments:**\n';
        spec.args.forEach(arg => {
          const required = arg.required ? ' (required)' : ' (optional)';
          help += `- ${arg.name} (${arg.type})${required}: ${arg.description}\n`;
        });
        help += '\n';
      }

      return help.trim();
    }

    // Generate help for all commands grouped by category
    const categories = ['core', 'debug', 'session'];
    let help = '**Available Slash Commands:**\n\n';

    categories.forEach(category => {
      const categoryCommands = this.getCommandsByCategory(category);
      if (categoryCommands.length > 0) {
        help += `**${category.charAt(0).toUpperCase() + category.slice(1)} Commands:**\n`;
        categoryCommands.forEach(cmd => {
          help += `- ${cmd.usage} - ${cmd.description}\n`;
        });
        help += '\n';
      }
    });

    help += 'Use `/help <command>` for detailed information about a specific command.';
    return help;
  }
}