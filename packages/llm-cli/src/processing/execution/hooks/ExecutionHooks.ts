import { CommandResult } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { ExecutionContext } from '../types';

export type SessionHookType = 'start' | 'end';

export interface ExecutionHooks {
  /**
   * Execute hooks before command execution
   */
  executeBeforeHooks(context: ExecutionContext): Promise<void>;

  /**
   * Execute hooks after command execution
   */
  executeAfterHooks(context: ExecutionContext, result: CommandResult): Promise<void>;

  /**
   * Execute session lifecycle hooks
   */
  executeSessionHooks(type: SessionHookType, session: SessionState): Promise<void>;
}