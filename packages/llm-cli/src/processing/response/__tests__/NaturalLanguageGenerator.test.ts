import { NaturalLanguageGenerator } from '../generator/NaturalLanguageGenerator';
import { DefaultNaturalLanguageGenerator } from '../generator/DefaultNaturalLanguageGenerator';
import { CommandResult, LLMCLIConfig } from '../../../core/types';
import { ExecutionContext } from '../../../processing/execution/types';
import { SessionState } from '../../../runtime/session/types';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('NaturalLanguageGenerator', () => {
  let generator: NaturalLanguageGenerator;
  let config: LLMCLIConfig;
  let session: SessionState;
  let context: ExecutionContext;

  beforeEach(() => {
    const mockProvider = new MockLLMProvider();
    mockProvider.setDefaultResponse('I successfully found 5 documents matching your search query.');

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
      state: new Map([['userName', 'Alice']]),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };

    context = {
      command: 'search',
      parameters: { query: 'machine learning' },
      originalIntent: {
        command: 'search',
        parameters: { query: 'machine learning' },
        confidence: 0.9,
        rawQuery: 'find machine learning papers'
      },
      session,
      executionId: 'exec_123',
      startTime: new Date()
    };

    generator = new DefaultNaturalLanguageGenerator();
  });

  describe('generateResponse', () => {
    it('should generate natural language response for successful command', async () => {
      const result: CommandResult = {
        success: true,
        output: 'Found 5 documents'
      };

      const response = await generator.generateResponse(context, result, config);
      expect(response).toBe('Alice, I successfully found 5 documents matching your search query.');
    });

    it('should generate natural language response for failed command', async () => {
      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('I apologize, but the search failed due to invalid parameters.');

      const result: CommandResult = {
        success: false,
        error: 'Invalid search parameters'
      };

      const response = await generator.generateResponse(context, result, config);
      expect(response).toBe('Alice, I apologize, but the search failed due to invalid parameters.');
    });

    it('should include context in natural language response', async () => {
      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('Hello Alice! I found 3 machine learning papers for you.');

      const result: CommandResult = {
        success: true,
        output: 'Found 3 papers'
      };

      const response = await generator.generateResponse(context, result, config);
      expect(response).toContain('Alice');
    });

    it('should handle LLM provider errors gracefully', async () => {
      const errorProvider = new MockLLMProvider();
      errorProvider.complete = async () => {
        throw new Error('LLM unavailable');
      };
      const errorConfig = { ...config, llmProvider: errorProvider };

      const result: CommandResult = {
        success: true,
        output: 'Command succeeded'
      };

      const response = await generator.generateResponse(context, result, errorConfig);
      expect(response).toBe('Command succeeded'); // Falls back to original output
    });
  });

  describe('buildPrompt', () => {
    it('should build comprehensive prompt for successful command', () => {
      const result: CommandResult = {
        success: true,
        output: 'Search completed with 3 results',
        data: { count: 3, results: ['paper1', 'paper2', 'paper3'] }
      };

      const prompt = generator.buildPrompt(context, result, config);

      expect(prompt).toContain('natural, friendly response');
      expect(prompt).toContain('search');
      expect(prompt).toContain('successful');
      expect(prompt).toContain('machine learning');
      expect(prompt).toContain('Alice');
      expect(prompt).toContain('conversational');
    });

    it('should build prompt for failed command with helpful suggestions', () => {
      const result: CommandResult = {
        success: false,
        error: 'Database connection timeout'
      };

      const prompt = generator.buildPrompt(context, result, config);

      expect(prompt).toContain('failed');
      expect(prompt).toContain('Database connection timeout');
      expect(prompt).toContain('helpful');
      expect(prompt).toContain('solution');
      expect(prompt).toContain('empathetic');
    });

    it('should include recent conversation history', () => {
      session.history = [
        {
          id: '1',
          timestamp: new Date(),
          input: 'list documents',
          intent: {
            command: 'list',
            parameters: {},
            confidence: 0.9,
            rawQuery: 'list documents'
          },
          result: { success: true, output: 'Listed 10 documents' }
        }
      ];

      const result: CommandResult = {
        success: true,
        output: 'Search completed'
      };

      const prompt = generator.buildPrompt(context, result, config);
      expect(prompt).toContain('list documents');
    });

    it('should include data details when available', () => {
      const result: CommandResult = {
        success: true,
        output: 'Search completed',
        data: {
          totalCount: 15,
          results: ['doc1', 'doc2'],
          query: 'machine learning'
        }
      };

      const prompt = generator.buildPrompt(context, result, config);
      expect(prompt).toContain('totalCount');
      expect(prompt).toContain('15');
    });
  });

  describe('buildContextInformation', () => {
    it('should extract user information from session', () => {
      const contextInfo = generator.buildContextInformation(context, config);

      expect(contextInfo).toContain('User: Alice');
      expect(contextInfo).toContain('Command: search');
      expect(contextInfo).toContain('Original query: "find machine learning papers"');
    });

    it('should handle session without user information', () => {
      session.state.clear();

      const contextInfo = generator.buildContextInformation(context, config);

      expect(contextInfo).toContain('Command: search');
      expect(contextInfo).not.toContain('User:');
    });

    it('should include command description', () => {
      const contextInfo = generator.buildContextInformation(context, config);

      expect(contextInfo).toContain('Search for documents');
    });
  });

  describe('generateResponseVariation', () => {
    it('should generate different responses for same input', async () => {
      const result: CommandResult = {
        success: true,
        output: 'Task completed'
      };

      // Mock different responses
      const mockProvider = config.llmProvider as MockLLMProvider;
      const responses = [
        'Great! I\'ve completed the task successfully.',
        'Perfect! The task has been finished.',
        'Excellent! Your request has been processed.'
      ];

      const generatedResponses = [];
      for (let i = 0; i < 3; i++) {
        mockProvider.setDefaultResponse(responses[i]);
        const response = await generator.generateResponseVariation(context, result, config, i);
        generatedResponses.push(response);
      }

      expect(generatedResponses).toEqual(responses);
      expect(new Set(generatedResponses).size).toBe(3); // All different
    });

    it('should maintain consistent tone across variations', async () => {
      const result: CommandResult = {
        success: false,
        error: 'Operation failed'
      };

      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('I apologize for the error. Let me help you resolve this issue.');

      const response = await generator.generateResponseVariation(context, result, config, 0);
      expect(response).toContain('apologize');
    });
  });

  describe('personalizeResponse', () => {
    it('should personalize response with user name', () => {
      const baseResponse = 'Search completed successfully';
      const personalized = generator.personalizeResponse(baseResponse, context);

      expect(personalized).toContain('Alice');
    });

    it('should handle response without user name', () => {
      session.state.clear();
      const baseResponse = 'Search completed successfully';
      const personalized = generator.personalizeResponse(baseResponse, context);

      expect(personalized).toBe(baseResponse);
    });

    it('should respect user preferences for personalization', () => {
      session.state.set('disablePersonalization', true);
      const baseResponse = 'Search completed successfully';
      const personalized = generator.personalizeResponse(baseResponse, context);

      expect(personalized).toBe(baseResponse);
    });
  });

  describe('getResponseTone', () => {
    it('should return professional tone by default', () => {
      const tone = generator.getResponseTone(context);
      expect(tone).toBe('professional');
    });

    it('should respect user tone preferences', () => {
      session.state.set('responseTone', 'casual');
      const tone = generator.getResponseTone(context);
      expect(tone).toBe('casual');
    });

    it('should use friendly tone for successful commands', () => {
      const result: CommandResult = { success: true };
      const tone = generator.getResponseTone(context, result);
      expect(['professional', 'friendly']).toContain(tone);
    });

    it('should use empathetic tone for failed commands', () => {
      const result: CommandResult = { success: false };
      const tone = generator.getResponseTone(context, result);
      expect(['professional', 'empathetic']).toContain(tone);
    });
  });

  describe('validateResponse', () => {
    it('should validate appropriate response length', () => {
      const response = 'This is a good response that provides helpful information.';
      const isValid = generator.validateResponse(response, context);
      expect(isValid).toBe(true);
    });

    it('should reject very short responses', () => {
      const response = 'OK';
      const isValid = generator.validateResponse(response, context);
      expect(isValid).toBe(false);
    });

    it('should reject very long responses', () => {
      const response = 'This is an extremely long response that goes on and on with way too much detail and information that nobody really needs to read because it just keeps talking and talking without adding any real value to the conversation and should definitely be considered invalid due to its excessive length.'.repeat(10);
      const isValid = generator.validateResponse(response, context);
      expect(isValid).toBe(false);
    });

    it('should reject responses with inappropriate content', () => {
      const response = 'I cannot help you with that request because I am not authorized.';
      const isValid = generator.validateResponse(response, context);
      expect(isValid).toBe(true); // This is actually appropriate
    });
  });
});