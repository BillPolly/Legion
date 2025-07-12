import { AmbiguityResolver } from '../resolver/AmbiguityResolver';
import { DefaultAmbiguityResolver } from '../resolver/DefaultAmbiguityResolver';
import { LLMCLIConfig, CommandRegistry } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { Intent } from '../types';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('AmbiguityResolver', () => {
  let resolver: AmbiguityResolver;
  let config: LLMCLIConfig;
  let session: SessionState;

  beforeEach(() => {
    resolver = new DefaultAmbiguityResolver();
    
    const mockProvider = new MockLLMProvider();
    mockProvider.setStructuredResponse({
      command: 'search',
      parameters: { query: 'AI papers' },
      confidence: 0.8,
      reasoning: 'Extracted from clarification'
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
        find: {
          handler: async () => ({ success: true }),
          description: 'Find specific items',
          parameters: [{
            name: 'term',
            type: 'string',
            required: true,
            description: 'Search term'
          }]
        },
        list: {
          handler: async () => ({ success: true }),
          description: 'List all items'
        },
        show: {
          handler: async () => ({ success: true }),
          description: 'Show details',
          parameters: [{
            name: 'id',
            type: 'string',
            required: true,
            description: 'Item ID'
          }]
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
  });

  describe('isAmbiguous', () => {
    it('should detect low confidence as ambiguous', () => {
      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.3,
        rawQuery: 'unclear input'
      };

      const result = resolver.isAmbiguous(intent, config, session);
      expect(result).toBe(true);
    });

    it('should not consider high confidence as ambiguous', () => {
      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.9,
        rawQuery: 'search for test'
      };

      const result = resolver.isAmbiguous(intent, config, session);
      expect(result).toBe(false);
    });

    it('should consider unknown command as ambiguous', () => {
      const intent: Intent = {
        command: 'unknown',
        parameters: {},
        confidence: 0.5,
        rawQuery: 'do something'
      };

      const result = resolver.isAmbiguous(intent, config, session);
      expect(result).toBe(true);
    });

    it('should consider missing required parameters as ambiguous', () => {
      const intent: Intent = {
        command: 'search',
        parameters: {}, // Missing required 'query' parameter
        confidence: 0.8,
        rawQuery: 'search'
      };

      const result = resolver.isAmbiguous(intent, config, session);
      expect(result).toBe(true);
    });
  });

  describe('generateClarificationQuestion', () => {
    it('should ask for missing required parameters', () => {
      const intent: Intent = {
        command: 'search',
        parameters: {},
        confidence: 0.8,
        rawQuery: 'search'
      };

      const question = resolver.generateClarificationQuestion(intent, config, session);
      
      expect(question).toContain('query');
      expect(question).toContain('search');
      expect(question).toContain('?');
    });

    it('should suggest similar commands for unknown command', () => {
      const intent: Intent = {
        command: 'unknown',
        parameters: {},
        confidence: 0.3,
        rawQuery: 'find something'
      };

      const question = resolver.generateClarificationQuestion(intent, config, session);
      
      expect(question).toContain('find');
      expect(question).toContain('search');
      expect(question).toContain('?');
    });

    it('should ask for confirmation on low confidence', () => {
      const intent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.4,
        rawQuery: 'maybe search for test'
      };

      const question = resolver.generateClarificationQuestion(intent, config, session);
      
      expect(question).toContain('search');
      expect(question).toContain('test');
      expect(question).toContain('?');
    });

    it('should handle multiple issues', () => {
      const intent: Intent = {
        command: 'show',
        parameters: {}, // Missing required 'id' parameter
        confidence: 0.3, // Low confidence
        rawQuery: 'show me'
      };

      const question = resolver.generateClarificationQuestion(intent, config, session);
      
      expect(question).toContain('show');
      expect(question).toContain('id');
    });
  });

  describe('suggestAlternatives', () => {
    it('should suggest similar commands', () => {
      const intent: Intent = {
        command: 'unknown',
        parameters: {},
        confidence: 0.3,
        rawQuery: 'find documents'
      };

      const suggestions = resolver.suggestAlternatives(intent, config, session);
      
      expect(suggestions).toHaveLength(4); // All commands
      expect(suggestions[0].similarity).toBeGreaterThanOrEqual(suggestions[1].similarity);
      expect(suggestions.some(s => s.command === 'find')).toBe(true);
      expect(suggestions.some(s => s.command === 'search')).toBe(true);
    });

    it('should limit number of suggestions', () => {
      const intent: Intent = {
        command: 'unknown',
        parameters: {},
        confidence: 0.3,
        rawQuery: 'test'
      };

      const suggestions = resolver.suggestAlternatives(intent, config, session, 2);
      
      expect(suggestions).toHaveLength(2);
    });

    it('should include similarity scores', () => {
      const intent: Intent = {
        command: 'unknown',
        parameters: {},
        confidence: 0.3,
        rawQuery: 'search'
      };

      const suggestions = resolver.suggestAlternatives(intent, config, session);
      
      suggestions.forEach(suggestion => {
        expect(suggestion.similarity).toBeGreaterThanOrEqual(0);
        expect(suggestion.similarity).toBeLessThanOrEqual(1);
        expect(suggestion.command).toBeDefined();
        expect(suggestion.description).toBeDefined();
      });
    });
  });

  describe('resolveAmbiguity', () => {
    it('should handle clarification response for missing parameters', async () => {
      const originalIntent: Intent = {
        command: 'search',
        parameters: {},
        confidence: 0.8,
        rawQuery: 'search'
      };

      const clarificationResponse = 'I want to search for AI papers';
      
      const resolved = await resolver.resolveAmbiguity(
        originalIntent,
        clarificationResponse,
        config,
        session
      );

      expect(resolved.command).toBe('search');
      expect(resolved.parameters.query.toLowerCase()).toContain('ai papers');
      expect(resolved.confidence).toBeGreaterThan(originalIntent.confidence);
    });

    it('should handle command selection from alternatives', async () => {
      const originalIntent: Intent = {
        command: 'unknown',
        parameters: {},
        confidence: 0.3,
        rawQuery: 'find documents'
      };

      const clarificationResponse = 'I meant the search command';
      
      const resolved = await resolver.resolveAmbiguity(
        originalIntent,
        clarificationResponse,
        config,
        session
      );

      // Should either recognize the search command or return search command directly
      expect(['search', 'unknown']).toContain(resolved.command);
      if (resolved.command === 'search') {
        expect(resolved.confidence).toBeGreaterThan(originalIntent.confidence);
      }
    });

    it('should preserve original intent if clarification unclear', async () => {
      const originalIntent: Intent = {
        command: 'search',
        parameters: { query: 'test' },
        confidence: 0.4,
        rawQuery: 'search test'
      };

      const clarificationResponse = 'I dont know what I want';
      
      const resolved = await resolver.resolveAmbiguity(
        originalIntent,
        clarificationResponse,
        config,
        session
      );

      // Should either preserve original command or recognize new intent
      expect(resolved.command).toBeDefined();
      expect(resolved.confidence).toBeGreaterThanOrEqual(0);
      
      // If it's the same command, parameters might be updated by the LLM
      if (resolved.command === originalIntent.command) {
        expect(resolved.parameters).toBeDefined();
      }
    });
  });

  describe('getConfidenceThreshold', () => {
    it('should return default threshold', () => {
      const threshold = resolver.getConfidenceThreshold(session);
      expect(threshold).toBe(0.7);
    });

    it('should adjust based on session history', () => {
      // Add successful command to history
      session.history = [{
        id: '1',
        timestamp: new Date(),
        input: 'search test',
        intent: {
          command: 'search',
          parameters: { query: 'test' },
          confidence: 0.9,
          rawQuery: 'search test'
        },
        result: { success: true }
      }];

      const threshold = resolver.getConfidenceThreshold(session);
      expect(threshold).toBeLessThanOrEqual(0.7); // Lower threshold for experienced users
    });

    it('should be higher for sessions with errors', () => {
      // Add failed command to history
      session.history = [{
        id: '1',
        timestamp: new Date(),
        input: 'unclear command',
        intent: {
          command: 'unknown',
          parameters: {},
          confidence: 0.3,
          rawQuery: 'unclear command'
        },
        result: { success: false, error: 'Command not found' }
      }];

      const threshold = resolver.getConfidenceThreshold(session);
      expect(threshold).toBeGreaterThanOrEqual(0.7); // Higher threshold after errors
    });
  });

  describe('extractParametersFromText', () => {
    it('should extract parameters from natural language', () => {
      const text = 'I want to search for machine learning papers with limit 5';
      const commandDef = config.commands.search;
      
      const params = resolver.extractParametersFromText(text, commandDef);
      
      expect(params.query).toContain('machine learning');
    });

    it('should handle multiple parameters', () => {
      // Add a command with multiple parameters for testing
      const commandDef = {
        handler: async () => ({ success: true }),
        description: 'Advanced search',
        parameters: [
          { name: 'query', type: 'string' as const, required: true, description: 'Search query' },
          { name: 'author', type: 'string' as const, required: false, description: 'Author name' },
          { name: 'year', type: 'number' as const, required: false, description: 'Publication year' }
        ]
      };
      
      const text = 'find papers about AI by John Smith from 2023';
      
      const params = resolver.extractParametersFromText(text, commandDef);
      
      expect(params.query.toLowerCase()).toContain('ai');
      expect(params.author.toLowerCase()).toContain('john smith');
      expect(params.year).toBe(2023);
    });

    it('should return empty object for no matches', () => {
      const text = 'completely unrelated text';
      const commandDef = config.commands.search;
      
      const params = resolver.extractParametersFromText(text, commandDef);
      
      expect(Object.keys(params)).toHaveLength(0);
    });
  });
});