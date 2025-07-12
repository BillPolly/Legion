import { CommandDefinition, CommandResult } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../intent/types';
import { ExecutionContext, ExecutionErrorType } from '../types';

export interface CommandExecutor {
  /**
   * Execute a command with the given intent
   */
  executeCommand(intent: Intent, command: CommandDefinition, session: SessionState): Promise<CommandResult>;

  /**
   * Update session state with command result
   */
  updateSessionState(session: SessionState, result: CommandResult): void;

  /**
   * Format execution error message
   */
  formatExecutionError(type: ExecutionErrorType, errors: string[]): string;

  /**
   * Create execution context for command
   */
  createExecutionContext(intent: Intent, validatedParameters: Record<string, any>, session: SessionState): ExecutionContext;
}