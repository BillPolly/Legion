import { SessionState } from '../../runtime/session/types';
import { Intent } from '../intent/types';

export interface ExecutionContext {
  command: string;
  parameters: Record<string, any>;
  originalIntent: Intent;
  session: SessionState;
  executionId: string;
  startTime: Date;
}

export type ExecutionErrorType = 'validation' | 'requirements' | 'execution';