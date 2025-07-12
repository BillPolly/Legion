import { ExecutionHooks } from '../hooks/ExecutionHooks';
import { DefaultExecutionHooks } from '../hooks/DefaultExecutionHooks';
import { CommandDefinition, CommandResult, FrameworkHooks } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../intent/types';
import { ExecutionContext } from '../types';

describe('ExecutionHooks', () => {
  let hooks: ExecutionHooks;
  let session: SessionState;
  let mockFrameworkHooks: FrameworkHooks;
  let executionLog: string[];

  beforeEach(() => {
    executionLog = [];
    
    mockFrameworkHooks = {
      beforeCommand: async (command, args, session) => {
        executionLog.push(`before:${command}`);
      },
      afterCommand: async (result, session) => {
        executionLog.push(`after:${result.success ? 'success' : 'failure'}`);
      },
      onSessionStart: async (session) => {
        executionLog.push('session:start');
      },
      onSessionEnd: async (session) => {
        executionLog.push('session:end');
      }
    };

    hooks = new DefaultExecutionHooks(mockFrameworkHooks);
    
    session = {
      sessionId: 'test',
      state: new Map(),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('executeBeforeHooks', () => {
    it('should execute beforeCommand hook', async () => {
      const context: ExecutionContext = {
        command: 'search',
        parameters: { query: 'test' },
        originalIntent: {
          command: 'search',
          parameters: { query: 'test' },
          confidence: 0.9,
          rawQuery: 'search test'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      await hooks.executeBeforeHooks(context);

      expect(executionLog).toContain('before:search');
    });

    it('should handle missing beforeCommand hook', async () => {
      hooks = new DefaultExecutionHooks({});
      
      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      // Should not throw
      await expect(hooks.executeBeforeHooks(context)).resolves.toBeUndefined();
    });

    it('should handle beforeCommand hook errors', async () => {
      const errorHooks: FrameworkHooks = {
        beforeCommand: async () => {
          throw new Error('Before hook failed');
        }
      };

      hooks = new DefaultExecutionHooks(errorHooks);

      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      // Should not throw, just log error
      await expect(hooks.executeBeforeHooks(context)).resolves.toBeUndefined();
    });

    it('should pass correct parameters to beforeCommand hook', async () => {
      let capturedCommand: string | undefined;
      let capturedArgs: any;
      let capturedSession: SessionState | undefined;

      const captureHooks: FrameworkHooks = {
        beforeCommand: async (command, args, session) => {
          capturedCommand = command;
          capturedArgs = args;
          capturedSession = session;
        }
      };

      hooks = new DefaultExecutionHooks(captureHooks);

      const context: ExecutionContext = {
        command: 'search',
        parameters: { query: 'test', limit: 10 },
        originalIntent: {
          command: 'search',
          parameters: { query: 'test', limit: 10 },
          confidence: 0.9,
          rawQuery: 'search test'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      await hooks.executeBeforeHooks(context);

      expect(capturedCommand).toBe('search');
      expect(capturedArgs).toEqual({ query: 'test', limit: 10 });
      expect(capturedSession).toBe(session);
    });
  });

  describe('executeAfterHooks', () => {
    it('should execute afterCommand hook with successful result', async () => {
      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const result: CommandResult = {
        success: true,
        output: 'Search completed'
      };

      await hooks.executeAfterHooks(context, result);

      expect(executionLog).toContain('after:success');
    });

    it('should execute afterCommand hook with failed result', async () => {
      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const result: CommandResult = {
        success: false,
        error: 'Search failed'
      };

      await hooks.executeAfterHooks(context, result);

      expect(executionLog).toContain('after:failure');
    });

    it('should handle missing afterCommand hook', async () => {
      hooks = new DefaultExecutionHooks({});
      
      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const result: CommandResult = { success: true };

      // Should not throw
      await expect(hooks.executeAfterHooks(context, result)).resolves.toBeUndefined();
    });

    it('should handle afterCommand hook errors', async () => {
      const errorHooks: FrameworkHooks = {
        afterCommand: async () => {
          throw new Error('After hook failed');
        }
      };

      hooks = new DefaultExecutionHooks(errorHooks);

      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const result: CommandResult = { success: true };

      // Should not throw, just log error
      await expect(hooks.executeAfterHooks(context, result)).resolves.toBeUndefined();
    });

    it('should pass correct parameters to afterCommand hook', async () => {
      let capturedResult: CommandResult | undefined;
      let capturedSession: SessionState | undefined;

      const captureHooks: FrameworkHooks = {
        afterCommand: async (result, session) => {
          capturedResult = result;
          capturedSession = session;
        }
      };

      hooks = new DefaultExecutionHooks(captureHooks);

      const context: ExecutionContext = {
        command: 'search',
        parameters: {},
        originalIntent: {
          command: 'search',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'search'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const result: CommandResult = {
        success: true,
        output: 'Search completed',
        data: { count: 5 }
      };

      await hooks.executeAfterHooks(context, result);

      expect(capturedResult).toEqual(result);
      expect(capturedSession).toBe(session);
    });
  });

  describe('executeSessionHooks', () => {
    it('should execute onSessionStart hook', async () => {
      await hooks.executeSessionHooks('start', session);

      expect(executionLog).toContain('session:start');
    });

    it('should execute onSessionEnd hook', async () => {
      await hooks.executeSessionHooks('end', session);

      expect(executionLog).toContain('session:end');
    });

    it('should handle missing session hooks', async () => {
      hooks = new DefaultExecutionHooks({});

      // Should not throw
      await expect(hooks.executeSessionHooks('start', session)).resolves.toBeUndefined();
      await expect(hooks.executeSessionHooks('end', session)).resolves.toBeUndefined();
    });

    it('should handle session hook errors', async () => {
      const errorHooks: FrameworkHooks = {
        onSessionStart: async () => {
          throw new Error('Session start hook failed');
        },
        onSessionEnd: async () => {
          throw new Error('Session end hook failed');
        }
      };

      hooks = new DefaultExecutionHooks(errorHooks);

      // Should not throw, just log errors
      await expect(hooks.executeSessionHooks('start', session)).resolves.toBeUndefined();
      await expect(hooks.executeSessionHooks('end', session)).resolves.toBeUndefined();
    });
  });

  describe('full execution cycle', () => {
    it('should execute hooks in correct order', async () => {
      const context: ExecutionContext = {
        command: 'search',
        parameters: { query: 'test' },
        originalIntent: {
          command: 'search',
          parameters: { query: 'test' },
          confidence: 0.9,
          rawQuery: 'search test'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const result: CommandResult = {
        success: true,
        output: 'Search completed'
      };

      // Execute session start
      await hooks.executeSessionHooks('start', session);

      // Execute before hooks
      await hooks.executeBeforeHooks(context);

      // Execute after hooks
      await hooks.executeAfterHooks(context, result);

      // Execute session end
      await hooks.executeSessionHooks('end', session);

      expect(executionLog).toEqual([
        'session:start',
        'before:search',
        'after:success',
        'session:end'
      ]);
    });
  });

  describe('hook execution timing', () => {
    it('should measure hook execution time', async () => {
      let beforeStartTime: number;
      let beforeEndTime: number;

      const timingHooks: FrameworkHooks = {
        beforeCommand: async () => {
          beforeStartTime = Date.now();
          await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
          beforeEndTime = Date.now();
        }
      };

      hooks = new DefaultExecutionHooks(timingHooks);

      const context: ExecutionContext = {
        command: 'test',
        parameters: {},
        originalIntent: {
          command: 'test',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'test'
        },
        session,
        executionId: 'exec_123',
        startTime: new Date()
      };

      const startTime = Date.now();
      await hooks.executeBeforeHooks(context);
      const endTime = Date.now();

      expect(beforeEndTime! - beforeStartTime!).toBeGreaterThanOrEqual(5);
      expect(endTime - startTime).toBeGreaterThanOrEqual(5);
    });
  });
});