/**
 * HelpCommand - Display help information
 * Usage: /help [command]
 */

import { BaseCommand } from './BaseCommand.js';

export class HelpCommand extends BaseCommand {
  constructor(commandProcessor) {
    super(
      'help',
      'Display help information',
      'help [command]'
    );

    this.commandProcessor = commandProcessor;
  }

  /**
   * Execute the help command
   * @param {Array} args - Command arguments
   * @returns {Promise<Object>} Help result
   */
  async execute(args) {
    // Show help for specific command
    if (args && args.length > 0) {
      const commandName = args[0];
      const command = this.commandProcessor.getCommand(commandName);

      if (!command) {
        throw new Error(`Unknown command: ${commandName}`);
      }

      return {
        success: true,
        message: command.getHelp()
      };
    }

    // Show general help with all commands
    const commands = Array.from(this.commandProcessor.commands.values());

    let helpText = `
Legion CLI - Available Commands

`;

    commands.forEach(cmd => {
      helpText += `  /${cmd.name.padEnd(12)} - ${cmd.description}\n`;
    });

    helpText += `
Usage:
  /<command> [args] [options]

  Type '/help <command>' for detailed help on a specific command.

Examples:
  /help show
  /help
`;

    return {
      success: true,
      message: helpText
    };
  }

  /**
   * Get command help text
   * @returns {string} Help text
   */
  getHelp() {
    return `
/help - Display help information

Usage:
  /help [command]

Arguments:
  [command]      Optional command name to get detailed help

Examples:
  /help          Show all available commands
  /help show     Show detailed help for the show command
`;
  }
}

export default HelpCommand;
