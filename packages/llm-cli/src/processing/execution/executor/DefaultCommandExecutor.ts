import { CommandExecutor } from './CommandExecutor';
import { CommandValidator } from '../validator/CommandValidator';
import { CommandDefinition, CommandResult } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../intent/types';
import { ExecutionContext, ExecutionErrorType } from '../types';

export class DefaultCommandExecutor implements CommandExecutor {
  constructor(private validator: CommandValidator) {}

  async executeCommand(intent: Intent, command: CommandDefinition, session: SessionState): Promise<CommandResult> {
    try {
      // Validate the intent against the command
      const validation = this.validator.validateIntent(intent, command, session);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: this.formatExecutionError('validation', validation.errors)
        };
      }

      // Create execution context
      const context = this.createExecutionContext(intent, validation.validatedParameters, session);

      // Execute the command handler
      const result = await command.handler(validation.validatedParameters, session);

      // Update session state if command provided state updates
      this.updateSessionState(session, result);

      return result;

    } catch (error) {
      console.error('Command execution error:', error);
      
      return {
        success: false,
        error: this.formatExecutionError('execution', [
          error instanceof Error ? error.message : String(error)
        ])
      };
    }
  }

  updateSessionState(session: SessionState, result: CommandResult): void {
    if (result.stateUpdates && result.stateUpdates.size > 0) {
      for (const [key, value] of result.stateUpdates) {
        session.state.set(key, value);
      }
    }
  }

  formatExecutionError(type: ExecutionErrorType, errors: string[]): string {
    const prefix = this.getErrorPrefix(type);
    
    if (errors.length === 1) {
      return `${prefix}: ${errors[0]}`;
    }
    
    return `${prefix}:\n${errors.map(error => `- ${error}`).join('\n')}`;
  }

  createExecutionContext(intent: Intent, validatedParameters: Record<string, any>, session: SessionState): ExecutionContext {
    return {
      command: intent.command,
      parameters: validatedParameters,
      originalIntent: intent,
      session,
      executionId: this.generateExecutionId(),
      startTime: new Date()
    };
  }

  private getErrorPrefix(type: ExecutionErrorType): string {
    switch (type) {
      case 'validation':
        return 'Validation failed';
      case 'requirements':
        return 'Requirements not met';
      case 'execution':
        return 'Execution failed';
      default:
        return 'Error';
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}