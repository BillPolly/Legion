import { PromptBuilder } from '../builder/PromptBuilder';
import { DefaultPromptBuilder } from '../builder/DefaultPromptBuilder';
import { LLMCLIConfig, CommandRegistry } from '../../core/types';
import { SessionState } from '../../runtime/session/types';
import { ContextData } from '../../runtime/context/types';
import { HistoryEntry } from '../../runtime/session/types';

describe('PromptBuilder', () => {
  let builder: PromptBuilder;
  let config: LLMCLIConfig;
  let session: SessionState;

  beforeEach(() => {
    builder = new DefaultPromptBuilder();
    
    config = {
      llmProvider: {} as any,
      commands: {
        search: {
          handler: async () => ({ success: true }),
          description: 'Search for documents',
          parameters: [{
            name: 'query',
            type: 'string',
            description: 'Search query',
            required: true
          }],
          examples: [
            { input: 'search for AI papers' },
            { input: 'find machine learning docs' }
          ]
        },
        stats: {
          handler: async () => ({ success: true }),
          description: 'Show statistics'
        }
      } as CommandRegistry,
      systemPrompt: 'You are a helpful CLI assistant'
    };

    session = {
      sessionId: 'test',
      state: new Map([['user', 'john']]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };
  });

  describe('buildSystemPrompt', () => {
    it('should include custom system prompt', async () => {
      const prompt = await builder.buildSystemPrompt(config, session);
      expect(prompt).toContain('You are a helpful CLI assistant');
    });

    it('should use default system prompt if not provided', async () => {
      config.systemPrompt = undefined;
      const prompt = await builder.buildSystemPrompt(config, session);
      expect(prompt).toContain('CLI intent recognition system');
    });

    it('should include available commands', async () => {
      const prompt = await builder.buildSystemPrompt(config, session);
      expect(prompt).toContain('AVAILABLE COMMANDS:');
      expect(prompt).toContain('Command: search');
      expect(prompt).toContain('Description: Search for documents');
      expect(prompt).toContain('query: string (required)');
    });

    it('should include command examples', async () => {
      const prompt = await builder.buildSystemPrompt(config, session);
      expect(prompt).toContain('Examples:');
      expect(prompt).toContain('search for AI papers');
      expect(prompt).toContain('find machine learning docs');
    });

    it('should include response format instructions', async () => {
      const prompt = await builder.buildSystemPrompt(config, session);
      expect(prompt).toContain('RESPONSE FORMAT:');
    });
  });

  describe('buildUserMessage', () => {
    it('should format user input', async () => {
      const message = await builder.buildUserMessage('find papers about AI', session);
      expect(message).toContain('find papers about AI');
    });

    it('should include conversation context', async () => {
      session.history = [{
        id: '1',
        timestamp: new Date(),
        input: 'search for ML',
        intent: {
          command: 'search',
          parameters: { query: 'ML' },
          confidence: 0.9,
          rawQuery: 'search for ML'
        },
        result: { success: true }
      }];

      const message = await builder.buildUserMessage('show more results', session);
      expect(message).toContain('Previous context:');
      expect(message).toContain('search for ML');
    });
  });

  describe('formatCommandInfo', () => {
    it('should format command without parameters', () => {
      const formatted = builder.formatCommandInfo('stats', config.commands.stats, session);
      expect(formatted).toContain('Command: stats');
      expect(formatted).toContain('Description: Show statistics');
      expect(formatted).not.toContain('Parameters:');
    });

    it('should format command with parameters', () => {
      const formatted = builder.formatCommandInfo('search', config.commands.search, session);
      expect(formatted).toContain('Parameters:');
      expect(formatted).toContain('query: string (required)');
      expect(formatted).toContain('Search query');
    });

    it('should include default values', () => {
      config.commands.test = {
        handler: async () => ({ success: true }),
        description: 'Test command',
        parameters: [{
          name: 'limit',
          type: 'number',
          description: 'Result limit',
          required: false,
          default: 10
        }]
      };

      const formatted = builder.formatCommandInfo('test', config.commands.test, session);
      expect(formatted).toContain('limit: number (optional) (default: 10)');
    });

    it('should include dynamic help', () => {
      config.commands.search.helpGenerator = (session) => 
        `${session.state.size} items in state`;

      const formatted = builder.formatCommandInfo('search', config.commands.search, session);
      expect(formatted).toContain('Note: 1 items in state');
    });

    it('should skip commands that fail requirements', () => {
      config.commands.search.requirements = {
        customChecker: () => false,
        errorMessage: 'Not available'
      };

      const formatted = builder.formatCommandInfo('search', config.commands.search, session);
      expect(formatted).toBe('');
    });
  });

  describe('formatContext', () => {
    it('should format empty context', () => {
      const formatted = builder.formatContext([]);
      expect(formatted).toBe('No additional context available.');
    });

    it('should format single context', () => {
      const contexts: ContextData[] = [{
        summary: 'User is authenticated',
        details: { userId: '123' }
      }];

      const formatted = builder.formatContext(contexts);
      expect(formatted).toContain('User is authenticated');
    });

    it('should format multiple contexts', () => {
      const contexts: ContextData[] = [
        { summary: 'Context 1' },
        { summary: 'Context 2' }
      ];

      const formatted = builder.formatContext(contexts);
      expect(formatted).toContain('- Context 1');
      expect(formatted).toContain('- Context 2');
    });

    it('should include warnings', () => {
      const contexts: ContextData[] = [{
        summary: 'System state',
        warnings: ['Low memory', 'High CPU usage']
      }];

      const formatted = builder.formatContext(contexts);
      expect(formatted).toContain('Warnings:');
      expect(formatted).toContain('Low memory');
      expect(formatted).toContain('High CPU usage');
    });
  });

  describe('formatHistory', () => {
    it('should format empty history', () => {
      const formatted = builder.formatHistory([]);
      expect(formatted).toBe('No previous commands.');
    });

    it('should format history entries', () => {
      const history: HistoryEntry[] = [{
        id: '1',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        input: 'search for AI',
        intent: {
          command: 'search',
          parameters: { query: 'AI' },
          confidence: 0.9,
          rawQuery: 'search for AI'
        },
        result: { success: true, output: 'Found 5 results' }
      }];

      const formatted = builder.formatHistory(history);
      expect(formatted).toContain('User: search for AI');
      expect(formatted).toContain('Command: search');
      expect(formatted).toContain('Result: Success - Found 5 results');
    });

    it('should limit history entries', () => {
      const history: HistoryEntry[] = Array(10).fill(null).map((_, i) => ({
        id: `${i}`,
        timestamp: new Date(),
        input: `command ${i}`
      }));

      const formatted = builder.formatHistory(history, 3);
      expect(formatted).toContain('command 7');
      expect(formatted).toContain('command 8');
      expect(formatted).toContain('command 9');
      expect(formatted).not.toContain('command 6');
    });

    it('should show failed commands', () => {
      const history: HistoryEntry[] = [{
        id: '1',
        timestamp: new Date(),
        input: 'invalid command',
        intent: {
          command: 'invalid',
          parameters: {},
          confidence: 0.3,
          rawQuery: 'invalid command'
        },
        result: { success: false, error: 'Command not found' }
      }];

      const formatted = builder.formatHistory(history);
      expect(formatted).toContain('Result: Failed - Command not found');
    });
  });

  describe('template integration', () => {
    it('should use custom templates', async () => {
      config.promptTemplate = {
        systemTemplate: 'CUSTOM SYSTEM: {{basePrompt}}',
        commandTemplate: 'CMD: {{name}} - {{description}}',
        contextTemplate: 'CTX: {{context}}',
        historyTemplate: 'HIST: {{entry}}'
      };

      const customBuilder = new DefaultPromptBuilder();
      const prompt = await customBuilder.buildSystemPrompt(config, session);
      
      expect(prompt).toContain('CUSTOM SYSTEM:');
    });

    it('should include custom sections', async () => {
      config.promptTemplate = {
        customSections: [{
          name: 'warnings',
          generator: (session) => 'WARNING: System is in test mode',
          priority: 100
        }]
      };

      const prompt = await builder.buildSystemPrompt(config, session);
      expect(prompt).toContain('WARNING: System is in test mode');
    });
  });
});