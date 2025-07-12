import { Plugin, PluginContext } from '../types';
import { CommandResult, CommandArgs, CommandDefinition } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';

export class HelpPlugin implements Plugin {
  metadata = {
    name: 'help-plugin',
    version: '1.0.0',
    description: 'Provides help command and assistance features',
    author: 'LLM CLI Framework'
  };

  async initialize(context: PluginContext): Promise<void> {
    // Register the help command
    context.framework.registerCommand('help', {
      handler: async (params: CommandArgs, session: SessionState) => this.handleHelpCommand(params, context),
      description: 'Show help information',
      parameters: [{
        name: 'command',
        type: 'string',
        description: 'Command to get help for',
        required: false
      }]
    });

    // Add help context provider
    context.framework.addContextProvider({
      name: 'help-context',
      description: 'Provides command help information',
      getContext: async (session: SessionState) => {
        const config = context.framework.getConfig();
        const commandNames = Object.keys(config.commands);
        
        return {
          summary: `Available commands: ${commandNames.join(', ')}`,
          details: {
            commandCount: commandNames.length,
            commands: commandNames
          },
          relevantCommands: ['help'],
          suggestions: commandNames.length === 0 ? ['Register some commands to get started'] : []
        };
      }
    });

    context.logger?.info('HelpPlugin initialized');
  }

  async cleanup(context: PluginContext): Promise<void> {
    // Unregister help command
    context.framework.unregisterCommand('help');
    
    // Remove help context provider
    context.framework.removeContextProvider('help-context');
    
    context.logger?.info('HelpPlugin cleaned up');
  }

  private async handleHelpCommand(params: CommandArgs, context: PluginContext): Promise<CommandResult> {
    const config = context.framework.getConfig();
    
    if (params.command) {
      // Show help for specific command
      const command = config.commands[params.command];
      
      if (!command) {
        return {
          success: false,
          error: `Command '${params.command}' not found`,
          suggestions: this.findSimilarCommands(params.command, config.commands)
        };
      }

      let helpText = `**${params.command}**\n`;
      helpText += `${command.description || 'No description available'}\n\n`;
      
      if (command.parameters && command.parameters.length > 0) {
        helpText += '**Parameters:**\n';
        for (const param of command.parameters) {
          helpText += `- ${param.name} (${param.type})`;
          if (param.required) helpText += ' [required]';
          if (param.description) helpText += `: ${param.description}`;
          helpText += '\n';
        }
      }

      if (command.examples && command.examples.length > 0) {
        helpText += '\n**Examples:**\n';
        for (const example of command.examples) {
          helpText += `- ${example.input}`;
          if (example.description) {
            helpText += ` - ${example.description}`;
          }
          helpText += '\n';
        }
      }

      return {
        success: true,
        output: helpText
      };
    } else {
      // Show general help
      const commands = Object.entries(config.commands);
      
      if (commands.length === 0) {
        return {
          success: true,
          output: 'No commands are currently registered.',
          suggestions: ['Register commands to enable functionality']
        };
      }

      let helpText = '**Available Commands:**\n\n';
      
      for (const [name, command] of commands as [string, CommandDefinition][]) {
        helpText += `- **${name}**: ${command.description || 'No description'}\n`;
      }

      helpText += '\nUse `help <command>` to get detailed help for a specific command.';

      return {
        success: true,
        output: helpText
      };
    }
  }

  private findSimilarCommands(input: string, commands: Record<string, any>): string[] {
    const commandNames = Object.keys(commands);
    const similar: string[] = [];

    for (const name of commandNames) {
      if (this.calculateSimilarity(input, name) > 0.5) {
        similar.push(name);
      }
    }

    return similar.slice(0, 3);
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}