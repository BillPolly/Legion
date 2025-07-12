import { IntentRecognizer } from '../recognizer/IntentRecognizer';
import { DefaultIntentRecognizer } from '../recognizer/DefaultIntentRecognizer';
import { LLMCLIConfig, CommandRegistry } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';
import { Intent } from '../types';

describe('IntentRecognizer', () => {
  let recognizer: IntentRecognizer;
  let config: LLMCLIConfig;
  let session: SessionState;

  beforeEach(() => {
    const mockProvider = new MockLLMProvider();
    
    // Set up structured response for intent recognition
    mockProvider.setStructuredResponse({
      command: 'search',
      parameters: { query: 'AI papers' },
      confidence: 0.9,
      reasoning: 'User wants to search for AI papers'
    });

    config = {
      llmProvider: mockProvider,
      commands: {
        search: {
          handler: async () => ({ success: true }),
          description: 'Search for documents',
          parameters: [{
            name: 'query',
            type: 'string',
            required: true,
            description: 'Search query'
          }]
        },
        list: {
          handler: async () => ({ success: true }),
          description: 'List all items'
        },
        stats: {
          handler: async () => ({ success: true }),
          description: 'Show statistics'
        }
      } as CommandRegistry
    };

    session = {
      sessionId: 'test',
      state: new Map(),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };

    recognizer = new DefaultIntentRecognizer();
  });

  describe('recognizeIntent', () => {
    it('should recognize simple command intent', async () => {
      const intent = await recognizer.recognizeIntent('search for AI papers', config, session);
      
      expect(intent.command).toBe('search');
      expect(intent.parameters.query).toBe('AI papers');
      expect(intent.confidence).toBe(0.9);
      expect(intent.rawQuery).toBe('search for AI papers');
    });

    it('should handle natural language queries', async () => {
      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setStructuredResponse({
        command: 'search',
        parameters: { query: 'machine learning' },
        confidence: 0.85,
        reasoning: 'Natural language search request'
      });

      const intent = await recognizer.recognizeIntent('find me papers about machine learning', config, session);
      
      expect(intent.command).toBe('search');
      expect(intent.parameters.query).toBe('machine learning');
      expect(intent.confidence).toBe(0.85);
    });

    it('should handle commands with no parameters', async () => {
      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setStructuredResponse({
        command: 'list',
        parameters: {},
        confidence: 0.95,
        reasoning: 'User wants to list items'
      });

      const intent = await recognizer.recognizeIntent('show me the list', config, session);
      
      expect(intent.command).toBe('list');
      expect(intent.parameters).toEqual({});
      expect(intent.confidence).toBe(0.95);
    });

    it('should handle low confidence queries', async () => {
      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setStructuredResponse({
        command: 'unknown',
        parameters: {},
        confidence: 0.3,
        reasoning: 'Unclear intent'
      });

      const intent = await recognizer.recognizeIntent('do something weird', config, session);
      
      expect(intent.command).toBe('unknown');
      expect(intent.confidence).toBe(0.3);
    });

    it('should include context in prompt', async () => {
      session.history = [{
        id: '1',
        timestamp: new Date(),
        input: 'search for AI',
        intent: {
          command: 'search',
          parameters: { query: 'AI' },
          confidence: 0.9,
          rawQuery: 'search for AI'
        },
        result: { success: true }
      }];

      const intent = await recognizer.recognizeIntent('show more results', config, session);
      
      // Should still work with context
      expect(intent.command).toBe('search');
      expect(intent.rawQuery).toBe('show more results');
    });

    it('should handle malformed LLM responses', async () => {
      const mockProvider = config.llmProvider as MockLLMProvider;
      mockProvider.setStructuredResponse({
        // Missing required fields - invalid response
        confidence: 0.5
      });

      const intent = await recognizer.recognizeIntent('test query', config, session);
      
      expect(intent.command).toBe('unknown');
      expect(intent.confidence).toBeLessThanOrEqual(0.5);
      expect(intent.parameters).toEqual({});
    });
  });

  describe('getCommandSimilarity', () => {
    it('should calculate command similarity correctly', () => {
      const similarity1 = recognizer.getCommandSimilarity('search', 'search');
      expect(similarity1).toBe(1.0);

      const similarity2 = recognizer.getCommandSimilarity('list', 'lists');
      expect(similarity2).toBeGreaterThan(0.5);
      expect(similarity2).toBeLessThan(1);

      const similarity3 = recognizer.getCommandSimilarity('search', 'xyz');
      expect(similarity3).toBeLessThan(0.5);
    });
  });

  describe('suggestCommands', () => {
    it('should suggest similar commands', () => {
      const suggestions = recognizer.suggestCommands('search', config.commands);
      
      expect(suggestions).toHaveLength(3);
      expect(suggestions[0].command).toBe('search'); // Exact match should be first
      expect(suggestions[0].similarity).toBe(1.0);
    });

    it('should limit suggestions', () => {
      const suggestions = recognizer.suggestCommands('test', config.commands, 2);
      
      expect(suggestions).toHaveLength(2);
    });

    it('should sort by similarity', () => {
      const suggestions = recognizer.suggestCommands('list', config.commands);
      
      expect(suggestions[0].similarity).toBeGreaterThanOrEqual(suggestions[1].similarity);
      expect(suggestions[1].similarity).toBeGreaterThanOrEqual(suggestions[2].similarity);
    });
  });

  describe('validateParameters', () => {
    it('should validate required parameters', () => {
      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.9,
        rawQuery: 'search test'
      };

      const result = recognizer.validateParameters(intent, config.commands.search);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required parameters', () => {
      const intent: Intent = {
        command: 'search',
        parameters: {},
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = recognizer.validateParameters(intent, config.commands.search);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: query');
    });

    it('should validate parameter types', () => {
      config.commands.search.parameters![0].type = 'number';
      
      const intent: Intent = {
        command: 'search',
        parameters: { query: 'not a number' },
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = recognizer.validateParameters(intent, config.commands.search);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameter query must be of type number');
    });

    it('should apply default values', () => {
      config.commands.search.parameters!.push({
        name: 'limit',
        type: 'number',
        required: false,
        default: 10,
        description: 'Result limit'
      });

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = recognizer.validateParameters(intent, config.commands.search);
      expect(result.isValid).toBe(true);
      expect(result.parameters.limit).toBe(10);
    });

    it('should validate enum parameters', () => {
      config.commands.search.parameters!.push({
        name: 'format',
        type: 'enum',
        required: true,
        enum: ['json', 'csv', 'xml'],
        description: 'Output format'
      });

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test', format: 'pdf' },
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = recognizer.validateParameters(intent, config.commands.search);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameter format must be one of: json, csv, xml');
    });

    it('should handle custom validators', () => {
      config.commands.search.parameters![0].validator = (value) => value.length > 2;
      config.commands.search.parameters![0].validationError = 'Query must be longer than 2 characters';

      const intent: Intent = {
        command: 'search',
        parameters: { query: 'ab' },
        confidence: 0.9,
        rawQuery: 'search'
      };

      const result = recognizer.validateParameters(intent, config.commands.search);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Query must be longer than 2 characters');
    });
  });

  describe('buildIntentPrompt', () => {
    it('should build prompt with commands and context', async () => {
      const prompt = await recognizer.buildIntentPrompt('search for AI', config, session);
      
      expect(prompt).toContain('search for AI');
      expect(prompt).toContain('search');
      expect(prompt).toContain('Search for documents');
      expect(prompt).toContain('JSON');
    });

    it('should include history context', async () => {
      session.history = [{
        id: '1',
        timestamp: new Date(),
        input: 'previous command',
        intent: {
          command: 'list',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'previous command'
        }
      }];

      const prompt = await recognizer.buildIntentPrompt('follow up', config, session);
      
      expect(prompt).toContain('previous command');
      expect(prompt).toContain('follow up');
    });
  });
});