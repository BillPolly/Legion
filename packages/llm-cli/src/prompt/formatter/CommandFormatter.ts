import { CommandDefinition, CommandRegistry, CommandParameter, CommandExample } from '../../core/types';
import { SessionState } from '../../runtime/session/types';

export interface CommandFormatter {
  /**
   * Format a single parameter description
   */
  formatParameter(param: CommandParameter): string;

  /**
   * Format a command example
   */
  formatExample(example: CommandExample): string;

  /**
   * Format command usage syntax (e.g., "command <required> [optional]")
   */
  formatCommandUsage(name: string, command: CommandDefinition): string;

  /**
   * Format all commands in the registry
   */
  formatRegistry(registry: CommandRegistry, session: SessionState): string;

  /**
   * Format detailed help for a specific command
   */
  formatCommandHelp(name: string, command: CommandDefinition, session: SessionState): string;
}