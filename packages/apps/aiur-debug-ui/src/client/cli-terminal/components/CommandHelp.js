/**
 * CommandHelp - Provides help text and command documentation
 */

export class CommandHelp {
  constructor() {
    this.builtinHelp = {
      '.help': {
        syntax: '.help [command]',
        description: 'Show help information',
        examples: ['.help', '.help context_add']
      },
      '.commands': {
        syntax: '.commands',
        description: 'List all available commands',
        examples: ['.commands']
      },
      '.vars': {
        syntax: '.vars',
        description: 'Show all variables (local and context)',
        examples: ['.vars']
      },
      '.clear': {
        syntax: '.clear',
        description: 'Clear terminal output',
        examples: ['.clear']
      },
      '.history': {
        syntax: '.history',
        description: 'Show command history',
        examples: ['.history']
      },
      '.search': {
        syntax: '.search <term>',
        description: 'Search for commands containing term',
        examples: ['.search file', '.search context']
      },
      '.describe': {
        syntax: '.describe <command>',
        description: 'Show detailed information about a command',
        examples: ['.describe context_add']
      }
    };
  }

  /**
   * Get help text
   */
  getHelp(command, tools) {
    if (!command) {
      return this.getGeneralHelp();
    }
    
    // Check built-in commands
    if (command.startsWith('.')) {
      return this.getBuiltinHelp(command);
    }
    
    // Check tools
    if (tools.has(command)) {
      return this.getToolHelp(command, tools.get(command));
    }
    
    return `Unknown command: ${command}\nUse .commands to see available commands.`;
  }

  /**
   * Get general help
   */
  getGeneralHelp() {
    return `
**Aiur CLI Terminal Help**

*Command Syntax:*
  • tool_name arg1 arg2 --option=value
  • $var = tool_name args...
  • tool_name @variable_reference

*Built-in Commands:*
  ${Object.entries(this.builtinHelp).map(([cmd, info]) => 
    `• \`${cmd}\` - ${info.description}`
  ).join('\n  ')}

*Examples:*
  • \`context_add user {"name": "John"}\`
  • \`$result = file_read ./config.json\`
  • \`plan_create "My Plan" --steps=@plan_steps\`

Type \`.help <command>\` for detailed help on any command.
Type \`.commands\` to see all available tools.
    `.trim();
  }

  /**
   * Get built-in command help
   */
  getBuiltinHelp(command) {
    const help = this.builtinHelp[command];
    if (!help) {
      return `Unknown built-in command: ${command}`;
    }
    
    return `
**${command}**

*Syntax:* \`${help.syntax}\`
*Description:* ${help.description}

*Examples:*
${help.examples.map(ex => `  • \`${ex}\``).join('\n')}
    `.trim();
  }

  /**
   * Get tool help
   */
  getToolHelp(name, tool) {
    let help = `**${name}**\n\n`;
    
    if (tool.description) {
      help += `*Description:* ${tool.description}\n\n`;
    }
    
    if (tool.inputSchema?.properties) {
      help += `*Parameters:*\n`;
      const props = tool.inputSchema.properties;
      const required = tool.inputSchema.required || [];
      
      Object.entries(props).forEach(([param, schema]) => {
        const isRequired = required.includes(param);
        help += `  • \`${param}\` (${schema.type}${isRequired ? ', required' : ''})\n`;
        
        if (schema.description) {
          help += `    ${schema.description}\n`;
        }
        
        if (schema.enum) {
          help += `    Values: ${schema.enum.join(', ')}\n`;
        }
        
        if (schema.default !== undefined) {
          help += `    Default: ${JSON.stringify(schema.default)}\n`;
        }
      });
    }
    
    help += '\n*Examples:*\n';
    help += this.generateExamples(name, tool);
    
    return help.trim();
  }

  /**
   * Generate usage examples
   */
  generateExamples(name, tool) {
    const examples = [];
    
    // Tool-specific examples
    switch (name) {
      case 'context_add':
        examples.push(
          `context_add user {"name": "John", "id": 123}`,
          `context_add config @existing_config --description="Updated config"`,
          `$saved = context_add temp_data [1, 2, 3]`
        );
        break;
        
      case 'context_get':
        examples.push(
          `context_get user`,
          `$data = context_get config`
        );
        break;
        
      case 'context_list':
        examples.push(
          `context_list`,
          `context_list user*`
        );
        break;
        
      case 'file_read':
        examples.push(
          `file_read ./config.json`,
          `$content = file_read /path/to/file.txt`
        );
        break;
        
      case 'plan_create':
        examples.push(
          `plan_create "Deploy Plan" --steps=[{"action": "deploy"}]`,
          `plan_create "Complex Plan" --steps=@saved_steps --description="Multi-step plan"`
        );
        break;
        
      default:
        // Generic example
        examples.push(`${name} <arguments>`);
    }
    
    return examples.map(ex => `  • \`${ex}\``).join('\n');
  }

  /**
   * Get all commands formatted
   */
  getAllCommands(tools) {
    let output = '**Available Commands**\n\n';
    
    // Built-in commands
    output += '*Built-in Commands:*\n';
    Object.entries(this.builtinHelp).forEach(([cmd, info]) => {
      output += `  • \`${cmd}\` - ${info.description}\n`;
    });
    
    output += '\n';
    
    // Group tools by category
    const categories = {};
    for (const [name, tool] of tools) {
      const category = name.split('_')[0] || 'other';
      if (!categories[category]) categories[category] = [];
      categories[category].push({ name, ...tool });
    }
    
    // Display by category
    Object.entries(categories).forEach(([category, toolList]) => {
      output += `*${this.capitalize(category)} Tools:*\n`;
      toolList.forEach(tool => {
        output += `  • \`${tool.name}\` - ${tool.description || 'No description'}\n`;
      });
      output += '\n';
    });
    
    return output.trim();
  }

  /**
   * Format variables display
   */
  formatVariables(variables) {
    let output = '**Variables**\n\n';
    
    if (variables.local.length > 0) {
      output += '*Local Variables:*\n';
      variables.local.forEach(({ name, value }) => {
        const preview = this.formatValue(value, 50);
        output += `  • \`${name}\` = ${preview}\n`;
      });
      output += '\n';
    }
    
    if (variables.context.length > 0) {
      output += '*Context Variables:*\n';
      variables.context.forEach(({ name, value, description }) => {
        const preview = this.formatValue(value, 50);
        output += `  • \`${name}\` = ${preview}`;
        if (description) {
          output += ` (${description})`;
        }
        output += '\n';
      });
    }
    
    if (variables.local.length === 0 && variables.context.length === 0) {
      output += 'No variables stored.';
    }
    
    return output.trim();
  }

  /**
   * Search commands
   */
  searchCommands(term, tools) {
    const results = [];
    const searchTerm = term.toLowerCase();
    
    // Search built-in commands
    Object.entries(this.builtinHelp).forEach(([cmd, info]) => {
      if (cmd.includes(searchTerm) || info.description.toLowerCase().includes(searchTerm)) {
        results.push({ type: 'builtin', name: cmd, description: info.description });
      }
    });
    
    // Search tools
    for (const [name, tool] of tools) {
      if (name.toLowerCase().includes(searchTerm) || 
          (tool.description && tool.description.toLowerCase().includes(searchTerm))) {
        results.push({ type: 'tool', name, description: tool.description });
      }
    }
    
    if (results.length === 0) {
      return `No commands found matching "${term}"`;
    }
    
    let output = `**Search Results for "${term}"**\n\n`;
    
    const builtins = results.filter(r => r.type === 'builtin');
    if (builtins.length > 0) {
      output += '*Built-in Commands:*\n';
      builtins.forEach(r => {
        output += `  • \`${r.name}\` - ${r.description}\n`;
      });
      output += '\n';
    }
    
    const toolResults = results.filter(r => r.type === 'tool');
    if (toolResults.length > 0) {
      output += '*Tools:*\n';
      toolResults.forEach(r => {
        output += `  • \`${r.name}\` - ${r.description || 'No description'}\n`;
      });
    }
    
    return output.trim();
  }

  /**
   * Describe a command in detail
   */
  describeCommand(command, tools) {
    if (command.startsWith('.')) {
      return this.getBuiltinHelp(command);
    }
    
    if (tools.has(command)) {
      return this.getToolHelp(command, tools.get(command));
    }
    
    return `Unknown command: ${command}`;
  }

  /**
   * Helper: Capitalize first letter
   */
  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Helper: Format value for display
   */
  formatValue(value, maxLength = 50) {
    const str = JSON.stringify(value);
    if (str.length > maxLength) {
      return str.substring(0, maxLength - 3) + '...';
    }
    return str;
  }
}