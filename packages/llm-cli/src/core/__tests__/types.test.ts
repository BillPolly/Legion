import {
  CommandRegistry,
  CommandDefinition,
  CommandHandler,
  CommandResult,
  ParameterDefinition,
  CommandExample,
  CommandRequirements,
  LLMCLIConfig,
  SessionConfig,
  FrameworkHooks,
  FrameworkError,
  ErrorType
} from '../types';

describe('Core Types', () => {
  describe('CommandDefinition', () => {
    it('should accept minimal command definition', () => {
      const command: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Test command'
      };

      expect(command.handler).toBeDefined();
      expect(command.description).toBe('Test command');
    });

    it('should accept full command definition', () => {
      const command: CommandDefinition = {
        handler: async (args, session) => ({ 
          success: true,
          output: `Hello ${args.name}`,
          stateUpdates: new Map([['lastGreeted', args.name]])
        }),
        description: 'Greet someone',
        parameters: [{
          name: 'name',
          type: 'string',
          description: 'Name to greet',
          required: true,
          default: 'World'
        }],
        examples: [{
          input: 'say hello to John',
          description: 'Greets John'
        }],
        useCases: ['greeting', 'introduction'],
        relatedCommands: ['wave', 'goodbye'],
        category: 'social',
        helpGenerator: (session) => 'Dynamic help',
        requirements: {
          requiredState: ['authenticated'],
          errorMessage: 'Must be authenticated'
        },
        metadata: { custom: 'data' }
      };

      expect(command.parameters).toHaveLength(1);
      expect(command.examples).toHaveLength(1);
    });
  });

  describe('CommandResult', () => {
    it('should handle success result', () => {
      const result: CommandResult = {
        success: true,
        output: 'Command executed',
        data: { count: 5 },
        suggestions: ['Try next command'],
        stateUpdates: new Map([['count', 5]])
      };

      expect(result.success).toBe(true);
      expect(result.stateUpdates?.get('count')).toBe(5);
    });

    it('should handle error result', () => {
      const result: CommandResult = {
        success: false,
        error: 'Command failed',
        suggestions: ['Check input', 'Try again']
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe('Command failed');
    });
  });

  describe('ParameterDefinition', () => {
    it('should define string parameter', () => {
      const param: ParameterDefinition = {
        name: 'query',
        type: 'string',
        description: 'Search query',
        required: true,
        examples: ['hello world', 'test query'],
        pattern: '^[a-zA-Z\\s]+$'
      };

      expect(param.type).toBe('string');
      expect(param.examples).toHaveLength(2);
    });

    it('should define enum parameter', () => {
      const param: ParameterDefinition = {
        name: 'format',
        type: 'string',
        description: 'Output format',
        required: false,
        default: 'json',
        enum: ['json', 'yaml', 'xml']
      };

      expect(param.enum).toContain('json');
      expect(param.default).toBe('json');
    });
  });

  describe('LLMCLIConfig', () => {
    it('should accept minimal config', () => {
      const config: LLMCLIConfig = {
        llmProvider: {} as any,
        commands: {}
      };

      expect(config.llmProvider).toBeDefined();
      expect(config.commands).toBeDefined();
    });

    it('should accept full config', () => {
      const config: LLMCLIConfig = {
        llmProvider: {} as any,
        commands: {},
        contextProviders: [],
        systemPrompt: 'You are a helpful assistant',
        promptTemplate: {
          systemTemplate: 'System: {{prompt}}',
          commandTemplate: 'Command: {{name}}'
        },
        sessionConfig: {
          maxHistoryLength: 100,
          timeout: 300000,
          initialState: new Map([['key', 'value']])
        },
        hooks: {
          beforeCommand: async () => {},
          afterCommand: async () => {},
          onSessionStart: async () => {},
          onSessionEnd: async () => {}
        }
      };

      expect(config.systemPrompt).toBe('You are a helpful assistant');
      expect(config.sessionConfig?.maxHistoryLength).toBe(100);
    });
  });

  describe('FrameworkError', () => {
    it('should create framework errors', () => {
      const error: FrameworkError = {
        type: ErrorType.INTENT_RECOGNITION_FAILED,
        message: 'Could not understand query',
        details: { query: 'gibberish' },
        suggestions: ['Try rephrasing', 'Use simpler terms']
      };

      expect(error.type).toBe(ErrorType.INTENT_RECOGNITION_FAILED);
      expect(error.suggestions).toHaveLength(2);
    });
  });
});