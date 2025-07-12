import { CommandFormatter } from './CommandFormatter';
import { CommandDefinition, CommandRegistry, CommandParameter, CommandExample } from '../../core/types';
import { SessionState } from '../../runtime/session/types';

export class DefaultCommandFormatter implements CommandFormatter {
  formatParameter(param: CommandParameter): string {
    const parts: string[] = [];
    
    // Name and type
    parts.push(`${param.name}:`);
    
    // Handle array types
    if (param.type === 'array' && param.items) {
      parts.push(`array<${param.items.type}>`);
    } else if (param.type === 'enum' && param.enum) {
      parts.push(`enum (${param.enum.join(', ')})`);
    } else {
      parts.push(param.type);
    }
    
    // Required/optional
    parts.push(`(${param.required ? 'required' : 'optional'})`);
    
    // Default value
    if (!param.required && param.default !== undefined) {
      parts.push(`(default: ${param.default})`);
    }
    
    // Description
    parts.push(`- ${param.description}`);
    
    return parts.join(' ');
  }

  formatExample(example: CommandExample): string {
    let formatted = `"${example.input}"`;
    
    if (example.description) {
      formatted += ` - ${example.description}`;
    }
    
    if (example.output) {
      formatted += ` → ${example.output}`;
    }
    
    return formatted;
  }

  formatCommandUsage(name: string, command: CommandDefinition): string {
    if (!command.parameters || command.parameters.length === 0) {
      return name;
    }
    
    // Sort parameters: required first, then optional
    const sortedParams = [...command.parameters].sort((a, b) => {
      if (a.required === b.required) return 0;
      return a.required ? -1 : 1;
    });
    
    const paramParts = sortedParams.map(param => {
      return param.required ? `<${param.name}>` : `[${param.name}]`;
    });
    
    return `${name} ${paramParts.join(' ')}`.trim();
  }

  formatRegistry(registry: CommandRegistry, session: SessionState): string {
    const entries = Object.entries(registry);
    
    if (entries.length === 0) {
      return 'No commands available.';
    }
    
    // Filter commands based on requirements
    const visibleCommands = entries.filter(([_, command]) => {
      if (!command.requirements?.customChecker) {
        return true;
      }
      return command.requirements.customChecker(session);
    });
    
    if (visibleCommands.length === 0) {
      return 'No commands available.';
    }
    
    // Group by category if present
    const grouped = new Map<string, Array<[string, CommandDefinition]>>();
    const uncategorized: Array<[string, CommandDefinition]> = [];
    
    visibleCommands.forEach(([name, command]) => {
      if (command.category) {
        const existing = grouped.get(command.category) || [];
        existing.push([name, command]);
        grouped.set(command.category, existing);
      } else {
        uncategorized.push([name, command]);
      }
    });
    
    const parts: string[] = [];
    
    // Format categorized commands
    const sortedCategories = Array.from(grouped.keys()).sort();
    sortedCategories.forEach(category => {
      parts.push(`\n${category}:`);
      const commands = grouped.get(category)!;
      commands.forEach(([name, command]) => {
        parts.push(`  ${this.formatCommandUsage(name, command)} - ${command.description}`);
      });
    });
    
    // Format uncategorized commands
    if (uncategorized.length > 0) {
      if (grouped.size > 0) {
        parts.push('\nOther commands:');
      }
      uncategorized.forEach(([name, command]) => {
        const indent = grouped.size > 0 ? '  ' : '';
        parts.push(`${indent}${this.formatCommandUsage(name, command)} - ${command.description}`);
      });
    }
    
    return parts.join('\n').trim();
  }

  formatCommandHelp(name: string, command: CommandDefinition, session: SessionState): string {
    const parts: string[] = [];
    
    // Check requirements first
    if (command.requirements?.customChecker && !command.requirements.customChecker(session)) {
      parts.push(`Command '${name}' is currently unavailable.`);
      if (command.requirements.errorMessage) {
        parts.push(`Reason: ${command.requirements.errorMessage}`);
      }
      return parts.join('\n');
    }
    
    // Usage
    parts.push(`Usage: ${this.formatCommandUsage(name, command)}`);
    parts.push('');
    
    // Description
    parts.push(command.description);
    parts.push('');
    
    // Parameters
    if (command.parameters && command.parameters.length > 0) {
      parts.push('Parameters:');
      command.parameters.forEach(param => {
        parts.push(`  ${this.formatParameter(param)}`);
      });
      parts.push('');
    }
    
    // Examples
    if (command.examples && command.examples.length > 0) {
      parts.push('Examples:');
      command.examples.forEach(example => {
        parts.push(`  ${this.formatExample(example)}`);
      });
      parts.push('');
    }
    
    // Dynamic help
    if (command.helpGenerator) {
      const dynamicHelp = command.helpGenerator(session);
      parts.push(dynamicHelp);
      parts.push('');
    }
    
    return parts.join('\n').trim();
  }
}