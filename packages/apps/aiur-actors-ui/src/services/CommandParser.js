/**
 * CommandParser - Command string parsing and analysis
 * Parses command strings into structured data for execution
 */
export class CommandParser {
  constructor(dependencies = {}) {
    this.variableStore = dependencies.variableStore;
    this.config = {
      allowPipes: true,
      allowRedirection: true,
      allowBackgroundJobs: true,
      allowGlobbing: true,
      expandVariables: true,
      expandTilde: true,
      ...dependencies.config
    };
  }
  
  /**
   * Parse a command string
   * @param {string} command - Command to parse
   * @returns {Object} Parsed command structure
   */
  parse(command) {
    const result = {
      raw: command,
      executable: null,
      args: [],
      options: {},
      flags: [],
      pipes: [],
      redirections: [],
      background: false,
      variables: [],
      errors: []
    };
    
    try {
      // Pre-process command
      let processed = command.trim();
      
      // Check for background job
      if (processed.endsWith('&')) {
        result.background = true;
        processed = processed.slice(0, -1).trim();
      }
      
      // Split by pipes
      if (this.config.allowPipes && processed.includes('|')) {
        const parts = this.splitByPipes(processed);
        result.pipes = parts.slice(1);
        processed = parts[0];
      }
      
      // Handle redirections
      if (this.config.allowRedirection) {
        const { command: cmd, redirections } = this.extractRedirections(processed);
        result.redirections = redirections;
        processed = cmd;
      }
      
      // Expand variables
      if (this.config.expandVariables) {
        const { expanded, variables } = this.expandVariables(processed);
        result.variables = variables;
        processed = expanded;
      }
      
      // Parse command and arguments
      const tokens = this.tokenize(processed);
      if (tokens.length > 0) {
        result.executable = tokens[0];
        
        // Parse remaining tokens as args/options
        let stopParsing = false;
        for (let i = 1; i < tokens.length; i++) {
          const token = tokens[i];
          
          // Double dash stops option parsing
          if (token === '--') {
            stopParsing = true;
            result.args.push(token);
            continue;
          }
          
          if (!stopParsing && token.startsWith('--')) {
            // Long option
            const [key, value] = this.parseOption(token.substring(2));
            result.options[key] = value || true;
          } else if (!stopParsing && token.startsWith('-') && token.length > 1) {
            // Short option(s)
            if (token.length === 2) {
              result.flags.push(token[1]);
            } else {
              // Multiple flags like -abc
              for (let j = 1; j < token.length; j++) {
                result.flags.push(token[j]);
              }
            }
          } else {
            // Regular argument
            result.args.push(token);
          }
        }
      }
      
    } catch (error) {
      result.errors.push(error.message);
    }
    
    return result;
  }
  
  /**
   * Tokenize command string respecting quotes
   * @param {string} command - Command string
   * @returns {Array<string>} Tokens
   */
  tokenize(command) {
    const tokens = [];
    let current = '';
    let inQuote = null;
    let escaped = false;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if ((char === '"' || char === "'") && !inQuote) {
        inQuote = char;
        continue;
      }
      
      if (char === inQuote) {
        inQuote = null;
        continue;
      }
      
      if (!inQuote && char === ' ') {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      tokens.push(current);
    }
    
    if (inQuote) {
      throw new Error(`Unclosed quote: ${inQuote}`);
    }
    
    return tokens;
  }
  
  /**
   * Split command by pipes respecting quotes and parentheses
   * @param {string} command - Command string
   * @returns {Array<string>} Pipe-separated parts
   */
  splitByPipes(command) {
    const parts = [];
    let current = '';
    let inQuote = null;
    let depth = 0;
    
    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if ((char === '"' || char === "'") && command[i-1] !== '\\') {
        if (!inQuote) {
          inQuote = char;
        } else if (char === inQuote) {
          inQuote = null;
        }
      }
      
      if (!inQuote) {
        if (char === '(') depth++;
        if (char === ')') depth--;
        
        if (char === '|' && depth === 0 && command[i+1] !== '|') {
          parts.push(current.trim());
          current = '';
          continue;
        }
      }
      
      current += char;
    }
    
    if (current) {
      parts.push(current.trim());
    }
    
    return parts;
  }
  
  /**
   * Extract redirections from command
   * @param {string} command - Command string
   * @returns {Object} Command and redirections
   */
  extractRedirections(command) {
    const redirections = [];
    let processed = command;
    
    // Match patterns like > file, >> file, 2>&1, < file
    const patterns = [
      />>\s*(\S+)/g,  // Append
      />\s*(\S+)/g,   // Output
      /<\s*(\S+)/g,   // Input
      /2>&1/g,        // Stderr to stdout
      /2>\s*(\S+)/g   // Stderr
    ];
    
    const types = ['append', 'output', 'input', 'stderr-to-stdout', 'stderr'];
    
    patterns.forEach((pattern, index) => {
      let match;
      while ((match = pattern.exec(command)) !== null) {
        redirections.push({
          type: types[index],
          target: match[1] || 'stdout',
          position: match.index
        });
        
        // Remove from processed command
        processed = processed.replace(match[0], '');
      }
    });
    
    return { command: processed.trim(), redirections };
  }
  
  /**
   * Expand variables in command
   * @param {string} command - Command string
   * @returns {Object} Expanded command and variables used
   */
  expandVariables(command) {
    const variables = [];
    let expanded = command;
    
    // Match $VAR or ${VAR} patterns
    const pattern = /\$\{?([A-Z_][A-Z0-9_]*)\}?/g;
    let match;
    
    while ((match = pattern.exec(command)) !== null) {
      const varName = match[1];
      variables.push(varName);
      
      if (this.variableStore && this.variableStore.hasVariable(varName)) {
        const variable = this.variableStore.getVariable(varName);
        let value = variable.value;
        
        // Convert non-string values
        if (typeof value !== 'string') {
          if (typeof value === 'object') {
            value = JSON.stringify(value);
          } else {
            value = String(value);
          }
        }
        
        expanded = expanded.replace(match[0], value);
      }
    }
    
    // Expand tilde
    if (this.config.expandTilde) {
      expanded = expanded.replace(/^~/, process.env.HOME || '/home/user');
    }
    
    return { expanded, variables };
  }
  
  /**
   * Parse option string
   * @param {string} option - Option string
   * @returns {Array} [key, value]
   */
  parseOption(option) {
    const equalIndex = option.indexOf('=');
    if (equalIndex !== -1) {
      return [option.substring(0, equalIndex), option.substring(equalIndex + 1)];
    }
    return [option, null];
  }
  
  /**
   * Validate parsed command
   * @param {Object} parsed - Parsed command
   * @returns {Array<string>} Validation errors
   */
  validate(parsed) {
    const errors = [];
    
    if (!parsed.executable) {
      errors.push('No command specified');
    }
    
    // Check for unclosed quotes in args
    for (const arg of parsed.args) {
      if ((arg.includes('"') && arg.split('"').length % 2 === 0) ||
          (arg.includes("'") && arg.split("'").length % 2 === 0)) {
        errors.push(`Unclosed quote in argument: ${arg}`);
      }
    }
    
    // Validate redirections
    for (const redir of parsed.redirections) {
      if (!redir.target && redir.type !== 'stderr-to-stdout') {
        errors.push(`Invalid redirection: missing target`);
      }
    }
    
    return errors;
  }
  
  /**
   * Reconstruct command from parsed structure
   * @param {Object} parsed - Parsed command
   * @returns {string} Reconstructed command
   */
  reconstruct(parsed) {
    let command = parsed.executable || '';
    
    // Add flags
    if (parsed.flags.length > 0) {
      command += ' -' + parsed.flags.join('');
    }
    
    // Add options
    for (const [key, value] of Object.entries(parsed.options)) {
      if (value === true) {
        command += ` --${key}`;
      } else {
        command += ` --${key}=${value}`;
      }
    }
    
    // Add arguments
    if (parsed.args.length > 0) {
      command += ' ' + parsed.args.map(arg => {
        if (arg.includes(' ')) {
          return `"${arg}"`;
        }
        return arg;
      }).join(' ');
    }
    
    // Add pipes
    if (parsed.pipes.length > 0) {
      command += ' | ' + parsed.pipes.join(' | ');
    }
    
    // Add redirections
    for (const redir of parsed.redirections) {
      switch (redir.type) {
        case 'output':
          command += ` > ${redir.target}`;
          break;
        case 'append':
          command += ` >> ${redir.target}`;
          break;
        case 'input':
          command += ` < ${redir.target}`;
          break;
        case 'stderr':
          command += ` 2> ${redir.target}`;
          break;
        case 'stderr-to-stdout':
          command += ` 2>&1`;
          break;
      }
    }
    
    // Add background
    if (parsed.background) {
      command += ' &';
    }
    
    return command;
  }
}