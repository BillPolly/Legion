import { LLMCLIFramework } from '../core/framework/LLMCLIFramework';
import { MockLLMProvider } from '../core/providers/MockLLMProvider';
import { CommandArgs, CommandRegistry, LLMCLIConfig } from '../core/types';
import { SessionState } from '../runtime/session/types';

describe('LLM-CLI and Semantic Search Integration', () => {
  let framework: LLMCLIFramework;
  let mockLLMProvider: MockLLMProvider;
  let commands: CommandRegistry;

  beforeEach(async () => {
    mockLLMProvider = new MockLLMProvider();
    commands = {};

    // Configure mock responses for intent recognition
    // The mock provider checks if the prompt includes these strings
    // Order matters - more specific patterns should come first
    
    // Specific test cases first
    // The DefaultIntentRecognizer includes "USER INPUT:" in the prompt
    mockLLMProvider.addResponse('USER INPUT: empty search', JSON.stringify({
      command: 'search',
      parameters: {}, // Missing required query parameter
      confidence: 0.9
    }));

    mockLLMProvider.addResponse('error test', JSON.stringify({
      command: 'error-test',
      parameters: {},
      confidence: 0.9
    }));
    
    mockLLMProvider.addResponse('show me the stats', JSON.stringify({
      command: 'stats',
      parameters: {},
      confidence: 0.9
    }));

    mockLLMProvider.addResponse('sync the index', JSON.stringify({
      command: 'sync',
      parameters: {},
      confidence: 0.9
    }));
    
    // General search patterns last
    mockLLMProvider.addResponse('search for', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning', limit: 10 },
      confidence: 0.95
    }));

    mockLLMProvider.addResponse('find documents', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning', limit: 10 },
      confidence: 0.95
    }));

    mockLLMProvider.addResponse('look for', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning', limit: 10 },
      confidence: 0.95
    }));

    mockLLMProvider.addResponse('query the database', JSON.stringify({
      command: 'search',
      parameters: { query: 'machine learning', limit: 10 },
      confidence: 0.95
    }));

    // Set default response for unknown inputs
    mockLLMProvider.setDefaultResponse(JSON.stringify({
      command: 'unknown',
      parameters: {},
      confidence: 0.3
    }));

    // Configure mock responses for natural language generation
    // When DefaultResponseGenerator tries to generate natural language, it includes "EXECUTION RESULT:" in the prompt
    // We need to return actual text, not JSON, for these prompts
    mockLLMProvider.addResponse('Generate a helpful, natural language response', 'Found 2 results for "machine learning"');
    mockLLMProvider.addResponse('Output: Found 2 results', 'Found 2 results for "machine learning"');
    mockLLMProvider.addResponse('MongoDB documents: 150', 'Index Statistics: MongoDB documents: 150, Vector documents: 148, Synced documents: 148, Unsynced documents: 2');
    mockLLMProvider.addResponse('Total documents: 150', 'Index rebuild completed: Total documents: 150, Processed: 150, Failed: 0');

    // Define search command
    commands.search = {
      description: 'Search for documents using semantic search',
      parameters: [
        {
          name: 'query',
          type: 'string',
          description: 'The search query',
          required: true
        },
        {
          name: 'limit',
          type: 'number',
          description: 'Maximum number of results',
          required: false,
          default: 10
        },
        {
          name: 'threshold',
          type: 'number',
          description: 'Minimum similarity score (0-1)',
          required: false,
          default: 0.7
        }
      ],
      handler: async (args: CommandArgs, session: SessionState) => {
        // Check if query is provided (it's a required parameter)
        if (!args.query) {
          return {
            success: false,
            error: 'Query parameter is required'
          };
        }
        
        // Simulate search results
        const mockResults = [
          {
            id: '123',
            title: 'Introduction to Machine Learning',
            content: 'Machine learning is a subset of artificial intelligence...',
            score: 0.95
          },
          {
            id: '456',
            title: 'Deep Learning Fundamentals',
            content: 'Deep learning is a branch of machine learning...',
            score: 0.87
          }
        ];

        const output = mockResults
          .map((result, index) => {
            return `${index + 1}. ${result.title} (Score: ${(result.score * 100).toFixed(1)}%)
   Content: ${result.content.substring(0, 100)}...
   ID: ${result.id}`;
          })
          .join('\n\n');

        return {
          success: true,
          output: `Found ${mockResults.length} results for "${args.query}":\n\n${output}`
        };
      }
    };

    // Define stats command
    commands.stats = {
      description: 'Show index statistics',
      handler: async (args: CommandArgs, session: SessionState) => {
        return {
          success: true,
          output: `Index Statistics:
- MongoDB documents: 150
- Vector documents: 148
- Synced documents: 148
- Unsynced documents: 2`
        };
      }
    };

    // Define sync command
    commands.sync = {
      description: 'Synchronize the search index',
      handler: async (args: CommandArgs, session: SessionState) => {
        return {
          success: true,
          output: `Index rebuild completed:
- Total documents: 150
- Processed: 150
- Failed: 0`
        };
      }
    };

    // Also register alias commands that map to the main commands
    commands.find = commands.search;
    commands.query = commands.search;
    commands.status = commands.stats;
    commands.info = commands.stats;
    commands.rebuild = commands.sync;
    commands.reindex = commands.sync;

    // Create framework config
    const config: LLMCLIConfig = {
      llmProvider: mockLLMProvider,
      disableDefaultChat: true,
      commands: commands
    };

    // Initialize framework
    framework = new LLMCLIFramework(config);
    
    // Disable natural language generation for tests
    // We want to test command execution, not LLM response generation
    const session = framework.getSession();
    session.state.set('useNaturalLanguage', false);
  });

  describe('Natural Language Understanding', () => {
    it('should understand search queries in natural language', async () => {
      const queries = [
        'find documents about machine learning',
        'search for papers on AI',
        'look for articles about neural networks',
        'query the database for deep learning'
      ];

      for (const query of queries) {
        const result = await framework.processInput(query);
        expect(result.success).toBe(true);
        expect(result.message).toContain('Found 2 results');
        expect(result.message).toContain('Machine Learning');
      }
    });

    it('should handle command execution', async () => {
      const result = await framework.processInput('search for machine learning papers');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Found 2 results');
      expect(result.message).toContain('Introduction to Machine Learning');
      expect(result.message).toContain('Deep Learning Fundamentals');
    });

    it('should execute stats command', async () => {
      const result = await framework.processInput('show me the stats');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Index Statistics');
      expect(result.message).toContain('MongoDB documents: 150');
    });

    it('should execute sync command', async () => {
      const result = await framework.processInput('sync the index');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Index rebuild completed');
      expect(result.message).toContain('Total documents: 150');
    });
  });

  describe('Command Registration', () => {
    it('should allow registering new commands', () => {
      framework.registerCommand('test', {
        description: 'Test command',
        handler: async () => ({ success: true, output: 'Test executed' })
      });

      // Command should be registered
      const commandList = framework.listCommands();
      expect(commandList).toContain('test');
    });

    it('should support command aliases through multiple registrations', () => {
      // Check that command exists
      const commandList = framework.listCommands();
      expect(commandList).toContain('search');
      expect(commandList).toContain('find');
      expect(commandList).toContain('query');
      
      // All aliases should point to the same handler
      expect(commands.find).toBe(commands.search);
      expect(commands.query).toBe(commands.search);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      // Configure mock to return command without required query parameter
      mockLLMProvider.addResponse('empty', JSON.stringify({
        command: 'search',
        parameters: {},
        confidence: 0.9
      }));

      const result = await framework.processInput('empty search');
      expect(result.success).toBe(false);
      expect(result.message).toContain('query');
    });

    it('should handle unknown commands gracefully', async () => {
      // Clear all responses and set only the default for this test
      mockLLMProvider.clearResponses();
      mockLLMProvider.setDefaultResponse(JSON.stringify({
        command: 'unknown',
        parameters: {},
        confidence: 0.3
      }));
      
      const result = await framework.processInput('unknown command test');
      expect(result.success).toBe(false);
      expect(result.message.toLowerCase()).toContain('unknown');
    });

    it('should handle command execution errors', () => {
      framework.registerCommand('error-test', {
        description: 'Test error handling',
        handler: async () => {
          throw new Error('Simulated service error');
        }
      });

      mockLLMProvider.addResponse('error', JSON.stringify({
        command: 'error-test',
        parameters: {},
        confidence: 0.9
      }));

      return framework.processInput('error test').then(result => {
        expect(result.success).toBe(false);
        expect(result.message).toContain('Simulated service error');
      });
    });
  });

  describe('Mock Provider Integration', () => {
    it('should use string patterns for mock responses', () => {
      // Clear existing responses
      mockLLMProvider.clearResponses();
      
      // Add a specific response
      mockLLMProvider.addResponse('quantum', JSON.stringify({
        command: 'search',
        parameters: { query: 'quantum computing' },
        confidence: 0.95
      }));

      return framework.processInput('find documents about quantum computing').then(result => {
        expect(result.success).toBe(true);
        expect(result.message).toContain('quantum computing');
      });
    });

    it('should format responses properly', async () => {
      const result = await framework.processInput('search for AI papers');
      
      // Check for formatted output
      expect(result.message).toMatch(/\d+\./); // Numbered list
      expect(result.message).toMatch(/Score: \d+\.\d+%/); // Percentage scores
      expect(result.message).toMatch(/ID: \w+/); // Document IDs
    });
  });

  describe('Session Management', () => {
    it('should maintain session state', async () => {
      // Execute a command
      await framework.processInput('search for machine learning');
      
      // Get current session
      const session = framework.getSession();
      expect(session).toBeDefined();
      expect(session.history.length).toBeGreaterThan(0);
    });

    it('should track command history', async () => {
      // Execute multiple commands
      await framework.processInput('search for AI');
      await framework.processInput('show stats');
      
      const session = framework.getSession();
      expect(session.history.length).toBe(2);
      expect(session.history[0].input).toBe('search for AI');
      expect(session.history[1].input).toBe('show stats');
    });

    it('should allow clearing session', () => {
      // Execute a command
      framework.processInput('search for test');
      
      // Clear session
      framework.clearSession();
      
      // Check session is cleared
      const session = framework.getSession();
      expect(session.history.length).toBe(0);
    });

    it('should support session export and import', async () => {
      // Execute some commands
      await framework.processInput('search for AI');
      await framework.processInput('show stats');
      
      // Export session
      const exportedSession = framework.exportSession();
      expect(exportedSession.history.length).toBe(2);
      
      // Clear and verify it's empty
      framework.clearSession();
      expect(framework.getSession().history.length).toBe(0);
      
      // Import session back
      framework.importSession(exportedSession);
      
      // Verify imported session
      const importedSession = framework.getSession();
      expect(importedSession.history.length).toBe(2);
      expect(importedSession.history[0].input).toBe('search for AI');
    });
  });
});