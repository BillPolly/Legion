import { CommandExecutor } from '../executor/CommandExecutor';
import { DefaultCommandExecutor } from '../executor/DefaultCommandExecutor';
import { CommandDefinition, CommandResult } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../../processing/intent/types';
import { DefaultCommandValidator } from '../validator/DefaultCommandValidator';

describe('CommandExecutor', () => {
  let executor: CommandExecutor;
  let session: SessionState;

  beforeEach(() => {
    executor = new DefaultCommandExecutor(new DefaultCommandValidator());
    session = {
      sessionId: 'test',
      state: new Map([['user', 'testUser']]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('executeCommand', () => {
    it('should execute simple command successfully', async () => {
      const command: CommandDefinition = {
        handler: async (args, session) => ({
          success: true,
          output: 'Command executed successfully'
        }),
        description: 'Simple test command'
      };

      const intent: Intent = {
        command: 'test',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'test command'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Command executed successfully');
    });

    it('should handle command with parameters', async () => {
      const command: CommandDefinition = {
        handler: async (args, session) => ({
          success: true,
          output: `Search completed for: ${args.query}`
        }),
        description: 'Search command',
        parameters: [{
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query'
        }]
      };

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test query' },
        confidence: 0.9,
        rawQuery: 'search for test query'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Search completed for: test query');
    });

    it('should handle validation errors', async () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Search command',
        parameters: [{
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query'
        }]
      };

      const intent: Intent = {
        command: 'search',
        parameters: {}, // Missing required parameter
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required parameter: query');
    });

    it('should handle command execution errors', async () => {
      const command: CommandDefinition = {
        handler: async () => {
          throw new Error('Command failed');
        },
        description: 'Failing command'
      };

      const intent: Intent = {
        command: 'fail',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'fail command'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command failed');
    });

    it('should apply state updates from command result', async () => {
      const command: CommandDefinition = {
        handler: async (args, session) => ({
          success: true,
          output: 'State updated',
          stateUpdates: new Map<string, any>([['lastCommand', 'update'], ['count', 42]])
        }),
        description: 'State updating command'
      };

      const intent: Intent = {
        command: 'update',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'update state'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(true);
      expect(session.state.get('lastCommand')).toBe('update');
      expect(session.state.get('count')).toBe(42);
    });

    it('should handle requirement check failures', async () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Admin command',
        requirements: {
          requiredState: ['isAdmin'],
          errorMessage: 'Admin access required'
        }
      };

      const intent: Intent = {
        command: 'admin',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'admin command'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Admin access required');
    });

    it('should preserve suggestions from command result', async () => {
      const command: CommandDefinition = {
        handler: async () => ({
          success: true,
          output: 'Command completed',
          suggestions: ['Try command A', 'Try command B']
        }),
        description: 'Command with suggestions'
      };

      const intent: Intent = {
        command: 'suggest',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'suggest command'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(true);
      expect(result.suggestions).toEqual(['Try command A', 'Try command B']);
    });

    it('should handle partial success results', async () => {
      const command: CommandDefinition = {
        handler: async () => ({
          success: false,
          error: 'Partial failure',
          data: { processedItems: 5, failedItems: 2 }
        }),
        description: 'Partially failing command'
      };

      const intent: Intent = {
        command: 'partial',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'partial command'
      };

      const result = await executor.executeCommand(intent, command, session);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Partial failure');
      expect(result.data).toEqual({ processedItems: 5, failedItems: 2 });
    });
  });

  describe('updateSessionState', () => {
    it('should update session state with command result updates', () => {
      const result: CommandResult = {
        success: true,
        stateUpdates: new Map<string, any>([
          ['key1', 'value1'],
          ['key2', 42],
          ['key3', true]
        ])
      };

      executor.updateSessionState(session, result);

      expect(session.state.get('key1')).toBe('value1');
      expect(session.state.get('key2')).toBe(42);
      expect(session.state.get('key3')).toBe(true);
    });

    it('should not modify session state when no updates provided', () => {
      const originalState = new Map(session.state);
      const result: CommandResult = {
        success: true
      };

      executor.updateSessionState(session, result);

      expect(session.state).toEqual(originalState);
    });

    it('should handle empty state updates', () => {
      const originalState = new Map(session.state);
      const result: CommandResult = {
        success: true,
        stateUpdates: new Map<string, any>()
      };

      executor.updateSessionState(session, result);

      expect(session.state).toEqual(originalState);
    });

    it('should overwrite existing state values', () => {
      session.state.set('existingKey', 'oldValue');
      
      const result: CommandResult = {
        success: true,
        stateUpdates: new Map<string, any>([['existingKey', 'newValue']])
      };

      executor.updateSessionState(session, result);

      expect(session.state.get('existingKey')).toBe('newValue');
    });
  });

  describe('formatExecutionError', () => {
    it('should format validation errors', () => {
      const errors = ['Missing parameter: query', 'Invalid type for limit'];
      const formatted = executor.formatExecutionError('validation', errors);

      expect(formatted).toContain('Validation failed');
      expect(formatted).toContain('Missing parameter: query');
      expect(formatted).toContain('Invalid type for limit');
    });

    it('should format requirement errors', () => {
      const errors = ['Admin access required', 'Feature not available'];
      const formatted = executor.formatExecutionError('requirements', errors);

      expect(formatted).toContain('Requirements not met');
      expect(formatted).toContain('Admin access required');
      expect(formatted).toContain('Feature not available');
    });

    it('should format execution errors', () => {
      const errors = ['Network timeout', 'Database connection failed'];
      const formatted = executor.formatExecutionError('execution', errors);

      expect(formatted).toContain('Execution failed');
      expect(formatted).toContain('Network timeout');
      expect(formatted).toContain('Database connection failed');
    });

    it('should handle unknown error types', () => {
      const errors = ['Unknown error'];
      const formatted = executor.formatExecutionError('unknown' as any, errors);

      expect(formatted).toContain('Error');
      expect(formatted).toContain('Unknown error');
    });

    it('should handle single error', () => {
      const errors = ['Single error message'];
      const formatted = executor.formatExecutionError('validation', errors);

      expect(formatted).toBe('Validation failed: Single error message');
    });
  });

  describe('createExecutionContext', () => {
    it('should create execution context with validated parameters', () => {
      const intent: Intent = {
        command: 'test',
        parameters: { query: 'test', limit: 10 },
        confidence: 0.9,
        rawQuery: 'test command'
      };

      const validatedParams = { query: 'test', limit: 10, format: 'json' };

      const context = executor.createExecutionContext(intent, validatedParams, session);

      expect(context.command).toBe('test');
      expect(context.parameters).toEqual(validatedParams);
      expect(context.originalIntent).toEqual(intent);
      expect(context.session).toBe(session);
      expect(context.executionId).toBeDefined();
      expect(context.startTime).toBeInstanceOf(Date);
    });

    it('should generate unique execution IDs', () => {
      const intent: Intent = {
        command: 'test',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'test'
      };

      const context1 = executor.createExecutionContext(intent, {}, session);
      const context2 = executor.createExecutionContext(intent, {}, session);

      expect(context1.executionId).not.toBe(context2.executionId);
    });
  });
});