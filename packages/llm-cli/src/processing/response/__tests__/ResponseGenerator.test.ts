import { ResponseGenerator } from '../generator/ResponseGenerator';
import { DefaultResponseGenerator } from '../generator/DefaultResponseGenerator';
import { CommandResult, LLMCLIConfig } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../../../processing/intent/types';
import { ExecutionContext } from '../../../processing/execution/types';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('ResponseGenerator', () => {
  let generator: ResponseGenerator;
  let config: LLMCLIConfig;
  let session: SessionState;
  let context: ExecutionContext;

  beforeEach(() => {
    const mockProvider = new MockLLMProvider();
    mockProvider.setDefaultResponse('Generated natural language response');

    config = {
      llmProvider: mockProvider,
      commands: {
        search: {
          handler: async () => ({ success: true }),
          description: 'Search for documents'
        }
      }
    };

    session = {
      sessionId: 'test',
      state: new Map([['user', 'testUser']]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };

    context = {
      command: 'search',
      parameters: { query: 'test' },
      originalIntent: {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.9,
        rawQuery: 'search for test'
      },
      session,
      executionId: 'exec_123',
      startTime: new Date()
    };

    generator = new DefaultResponseGenerator();
  });

  describe('generateResponse', () => {
    it('should generate response for successful command', async () => {
      // Disable natural language for this test
      session.state.set('useNaturalLanguage', false);
      
      const result: CommandResult = {
        success: true,
        output: 'Search completed successfully'
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.success).toBe(true);
      expect(response.message).toBe('Search completed successfully');
      expect(response.data).toBeUndefined();
    });

    it('should generate response for failed command', async () => {
      // Disable natural language for this test
      session.state.set('useNaturalLanguage', false);
      
      const result: CommandResult = {
        success: false,
        error: 'Search failed: invalid query'
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.success).toBe(false);
      expect(response.message).toBe('Search failed: invalid query');
      expect(response.suggestions).toBeUndefined();
    });

    it('should include command result data', async () => {
      // Disable natural language for this test
      session.state.set('useNaturalLanguage', false);
      
      const result: CommandResult = {
        success: true,
        output: 'Found 5 results',
        data: {
          results: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'],
          totalCount: 5
        }
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.success).toBe(true);
      expect(response.message).toBe('Found 5 results');
      expect(response.data).toEqual({
        results: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'],
        totalCount: 5
      });
    });

    it('should include suggestions from command result', async () => {
      const result: CommandResult = {
        success: true,
        output: 'Search completed',
        suggestions: ['Try refining your search', 'Use filters']
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.success).toBe(true);
      expect(response.suggestions).toEqual(['Try refining your search', 'Use filters']);
    });

    it('should include execution metadata', async () => {
      const result: CommandResult = {
        success: true,
        output: 'Command executed'
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.executionId).toBe('exec_123');
      expect(response.timestamp).toBeInstanceOf(Date);
      expect(response.command).toBe('search');
    });

    it('should handle command with no output', async () => {
      // Disable natural language for this test
      session.state.set('useNaturalLanguage', false);
      
      const result: CommandResult = {
        success: true
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.success).toBe(true);
      expect(response.message).toBe('Command completed successfully');
    });

    it('should handle command with response context', async () => {
      const result: CommandResult = {
        success: true,
        output: 'Search completed',
        responseContext: {
          queryTime: '125ms',
          source: 'database'
        }
      };

      const response = await generator.generateResponse(context, result, config);

      expect(response.success).toBe(true);
      expect(response.metadata).toEqual({
        queryTime: '125ms',
        source: 'database'
      });
    });
  });

  describe('formatSuccessMessage', () => {
    it('should return command output if provided', () => {
      const result: CommandResult = {
        success: true,
        output: 'Search found 10 results'
      };

      const message = generator.formatSuccessMessage(result, context);
      expect(message).toBe('Search found 10 results');
    });

    it('should generate default success message', () => {
      const result: CommandResult = {
        success: true
      };

      const message = generator.formatSuccessMessage(result, context);
      expect(message).toBe('Command completed successfully');
    });

    it('should include data summary when available', () => {
      const result: CommandResult = {
        success: true,
        data: {
          count: 5,
          items: ['a', 'b', 'c', 'd', 'e']
        }
      };

      const message = generator.formatSuccessMessage(result, context);
      expect(message).toContain('Command completed successfully');
    });
  });

  describe('formatErrorMessage', () => {
    it('should return command error if provided', () => {
      const result: CommandResult = {
        success: false,
        error: 'Database connection failed'
      };

      const message = generator.formatErrorMessage(result, context);
      expect(message).toBe('Database connection failed');
    });

    it('should generate default error message', () => {
      const result: CommandResult = {
        success: false
      };

      const message = generator.formatErrorMessage(result, context);
      expect(message).toBe('Command failed');
    });

    it('should include command name in error message', () => {
      const result: CommandResult = {
        success: false,
        error: 'Invalid parameters'
      };

      const message = generator.formatErrorMessage(result, context);
      expect(message).toBe('Invalid parameters');
    });
  });

  describe('shouldGenerateNaturalLanguage', () => {
    it('should return true when LLM provider supports completion', () => {
      const shouldGenerate = generator.shouldGenerateNaturalLanguage(config, context, { success: true });
      expect(shouldGenerate).toBe(true);
    });

    it('should return false when no LLM provider', () => {
      const configWithoutLLM = { ...config, llmProvider: undefined as any };
      const shouldGenerate = generator.shouldGenerateNaturalLanguage(configWithoutLLM, context, { success: true });
      expect(shouldGenerate).toBe(false);
    });

    it('should respect user preferences', () => {
      session.state.set('useNaturalLanguage', false);
      const shouldGenerate = generator.shouldGenerateNaturalLanguage(config, context, { success: true });
      expect(shouldGenerate).toBe(false);
    });
  });

  describe('generateNaturalLanguageResponse', () => {
    it('should generate natural language response', async () => {
      const result: CommandResult = {
        success: true,
        output: 'Search completed with 5 results'
      };

      const nlResponse = await generator.generateNaturalLanguageResponse(context, result, config);
      expect(nlResponse).toBe('Generated natural language response');
    });

    it('should handle LLM provider errors gracefully', async () => {
      const errorProvider = new MockLLMProvider();
      // Simulate an error by making the provider throw
      errorProvider.complete = async () => {
        throw new Error('LLM provider error');
      };
      const errorConfig = { ...config, llmProvider: errorProvider };

      const result: CommandResult = {
        success: true,
        output: 'Command output'
      };

      const nlResponse = await generator.generateNaturalLanguageResponse(context, result, errorConfig);
      expect(nlResponse).toBe('Command output'); // Falls back to original output
    });
  });

  describe('buildResponsePrompt', () => {
    it('should build prompt for successful command', () => {
      const result: CommandResult = {
        success: true,
        output: 'Search found 3 documents'
      };

      const prompt = generator.buildResponsePrompt(context, result, config);

      expect(prompt).toContain('search');
      expect(prompt).toContain('successful');
      expect(prompt).toContain('Search found 3 documents');
      expect(prompt).toContain('natural language');
    });

    it('should build prompt for failed command', () => {
      const result: CommandResult = {
        success: false,
        error: 'Permission denied'
      };

      const prompt = generator.buildResponsePrompt(context, result, config);

      expect(prompt).toContain('search');
      expect(prompt).toContain('failed');
      expect(prompt).toContain('Permission denied');
      expect(prompt).toContain('helpful');
    });

    it('should include session context', () => {
      session.state.set('userName', 'Alice');
      session.history = [{
        id: '1',
        timestamp: new Date(),
        input: 'previous command',
        intent: {
          command: 'list',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'list items'
        },
        result: { success: true }
      }];

      const result: CommandResult = {
        success: true,
        output: 'Command executed'
      };

      const prompt = generator.buildResponsePrompt(context, result, config);

      expect(prompt).toContain('Alice');
      expect(prompt).toContain('previous command');
    });
  });

  describe('extractDataSummary', () => {
    it('should extract count from array data', () => {
      const data = {
        results: ['item1', 'item2', 'item3'],
        totalCount: 3
      };

      const summary = generator.extractDataSummary(data);
      expect(summary).toContain('3 items');
    });

    it('should extract count from object with count property', () => {
      const data = {
        count: 42,
        items: []
      };

      const summary = generator.extractDataSummary(data);
      expect(summary).toContain('42 items');
    });

    it('should handle non-countable data', () => {
      const data = {
        status: 'active',
        configuration: { theme: 'dark' }
      };

      const summary = generator.extractDataSummary(data);
      expect(summary).toBe('');
    });

    it('should handle null/undefined data', () => {
      expect(generator.extractDataSummary(null)).toBe('');
      expect(generator.extractDataSummary(undefined)).toBe('');
    });
  });
});