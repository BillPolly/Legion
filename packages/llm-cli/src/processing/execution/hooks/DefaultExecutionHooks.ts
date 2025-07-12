import { ExecutionHooks, SessionHookType } from './ExecutionHooks';
import { CommandResult, FrameworkHooks } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { ExecutionContext } from '../types';

export class DefaultExecutionHooks implements ExecutionHooks {
  constructor(private frameworkHooks: FrameworkHooks) {}

  async executeBeforeHooks(context: ExecutionContext): Promise<void> {
    if (!this.frameworkHooks.beforeCommand) {
      return;
    }

    try {
      await this.frameworkHooks.beforeCommand(
        context.command,
        context.parameters,
        context.session
      );
    } catch (error) {
      console.error('Error in beforeCommand hook:', error);
      // Don't throw - hooks should not break command execution
    }
  }

  async executeAfterHooks(context: ExecutionContext, result: CommandResult): Promise<void> {
    if (!this.frameworkHooks.afterCommand) {
      return;
    }

    try {
      await this.frameworkHooks.afterCommand(result, context.session);
    } catch (error) {
      console.error('Error in afterCommand hook:', error);
      // Don't throw - hooks should not break command execution
    }
  }

  async executeSessionHooks(type: SessionHookType, session: SessionState): Promise<void> {
    const hookFn = type === 'start' 
      ? this.frameworkHooks.onSessionStart
      : this.frameworkHooks.onSessionEnd;

    if (!hookFn) {
      return;
    }

    try {
      await hookFn(session);
    } catch (error) {
      console.error(`Error in ${type === 'start' ? 'onSessionStart' : 'onSessionEnd'} hook:`, error);
      // Don't throw - hooks should not break session management
    }
  }
}