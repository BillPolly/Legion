import { LLMCLIFramework } from '../LLMCLIFramework';
import { LLMCLIConfig, CommandDefinition, CommandResult } from '../../../core/types';
import { SessionState } from '../../../runtime/session/types';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('LLMCLIFramework', () => {
  let framework: LLMCLIFramework;
  let config: LLMCLIConfig;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    mockProvider.setDefaultResponse('{"command": "help", "parameters": {}, "confidence": 0.9}');
    
    config = {
      llmProvider: mockProvider,
      disableDefaultChat: true,
      commands: {
        help: {
          handler: async () => ({ success: true, output: 'Help command executed' }),
          description: 'Show help information'
        },
        echo: {
          handler: async (params) => ({ success: true, output: `Echo: ${params.text}` }),
          description: 'Echo the input text',
          parameters: [{
            name: 'text',
            type: 'string',
            description: 'Text to echo',
            required: true
          }]
        }
      }
    };

    framework = new LLMCLIFramework(config);
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(framework).toBeDefined();
      expect(framework.getConfig()).toEqual(config);
    });

    it('should create session manager', () => {
      const session = framework.getSession();
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
    });

    it('should initialize components', () => {
      expect(framework.getConfig().commands).toEqual(config.commands);
    });

    it('should handle invalid config', () => {
      expect(() => {
        new LLMCLIFramework({} as any);
      }).toThrow('Invalid configuration');
    });
  });

  describe('processInput', () => {
    it('should process simple command', async () => {
      // Disable natural language generation for cleaner testing
      framework.getSession().state.set('useNaturalLanguage', false);
      
      const result = await framework.processInput('help');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Help command executed');
    });

    it('should process command with parameters', async () => {
      // Disable natural language generation for cleaner testing
      framework.getSession().state.set('useNaturalLanguage', false);
      
      mockProvider.setDefaultResponse('{"command": "echo", "parameters": {"text": "hello world"}, "confidence": 0.9}');
      
      const result = await framework.processInput('echo hello world');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Echo: hello world');
    });

    it('should handle intent recognition errors', async () => {
      mockProvider.setDefaultResponse('{"command": "unknown", "parameters": {}, "confidence": 0.1}');
      
      const result = await framework.processInput('invalid command');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
    });

    it('should handle command execution errors', async () => {
      const errorCommand: CommandDefinition = {
        handler: async () => ({ success: false, error: 'Command failed' }),
        description: 'Always fails'
      };
      
      framework.registerCommand('error', errorCommand);
      // Disable natural language generation for cleaner testing
      framework.getSession().state.set('useNaturalLanguage', false);
      
      mockProvider.setDefaultResponse('{"command": "error", "parameters": {}, "confidence": 0.9}');
      
      const result = await framework.processInput('error');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Command failed');
    });

    it('should update session state', async () => {
      const initialHistoryLength = framework.getSession().history.length;
      
      await framework.processInput('help');
      
      const finalHistoryLength = framework.getSession().history.length;
      expect(finalHistoryLength).toBe(initialHistoryLength + 1);
    });

    it('should handle empty input', async () => {
      const result = await framework.processInput('');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Empty input');
    });

    it('should handle whitespace-only input', async () => {
      const result = await framework.processInput('   ');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Empty input');
    });
  });

  describe('registerCommand', () => {
    it('should register new command', () => {
      const newCommand: CommandDefinition = {
        handler: async () => ({ success: true, output: 'New command' }),
        description: 'A new command'
      };
      
      framework.registerCommand('new', newCommand);
      
      expect(framework.getConfig().commands.new).toEqual(newCommand);
    });

    it('should overwrite existing command', () => {
      const newHelpCommand: CommandDefinition = {
        handler: async () => ({ success: true, output: 'New help' }),
        description: 'Updated help command'
      };
      
      framework.registerCommand('help', newHelpCommand);
      
      expect(framework.getConfig().commands.help).toEqual(newHelpCommand);
    });

    it('should validate command definition', () => {
      expect(() => {
        framework.registerCommand('invalid', {} as any);
      }).toThrow('Invalid command definition');
    });

    it('should validate command name', () => {
      const validCommand: CommandDefinition = {
        handler: async () => ({ success: true }),
        description: 'Valid command'
      };
      
      expect(() => {
        framework.registerCommand('', validCommand);
      }).toThrow('Command name cannot be empty');
    });
  });

  describe('unregisterCommand', () => {
    it('should remove existing command', () => {
      framework.unregisterCommand('help');
      
      expect(framework.getConfig().commands.help).toBeUndefined();
    });

    it('should handle non-existent command', () => {
      expect(() => {
        framework.unregisterCommand('nonexistent');
      }).not.toThrow();
    });

    it('should prevent removing last command', () => {
      // Remove all but one command
      framework.unregisterCommand('help');
      
      expect(() => {
        framework.unregisterCommand('echo');
      }).toThrow('Cannot remove last command');
    });
  });

  describe('listCommands', () => {
    it('should return all registered commands', () => {
      const commands = framework.listCommands();
      
      expect(commands).toEqual(['echo', 'help']);
    });

    it('should return empty array when no commands', () => {
      const emptyFramework = new LLMCLIFramework({
        llmProvider: mockProvider,
        disableDefaultChat: true,
        commands: {}
      });
      
      const commands = emptyFramework.listCommands();
      
      expect(commands).toEqual([]);
    });

    it('should return sorted command names', () => {
      framework.registerCommand('alpha', {
        handler: async () => ({ success: true }),
        description: 'Alpha command'
      });
      
      framework.registerCommand('beta', {
        handler: async () => ({ success: true }),
        description: 'Beta command'
      });
      
      const commands = framework.listCommands();
      
      expect(commands).toEqual(['alpha', 'beta', 'echo', 'help']);
    });
  });

  describe('getSession', () => {
    it('should return current session', () => {
      const session = framework.getSession();
      
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.state).toBeDefined();
      expect(session.history).toBeDefined();
    });

    it('should return same session on multiple calls', () => {
      const session1 = framework.getSession();
      const session2 = framework.getSession();
      
      expect(session1).toBe(session2);
    });
  });

  describe('clearSession', () => {
    it('should clear session history', () => {
      // Add some history
      framework.getSession().history.push({
        id: 'test',
        timestamp: new Date(),
        input: 'test input',
        intent: {
          command: 'help',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'test input'
        },
        result: { success: true }
      });
      
      framework.clearSession();
      
      expect(framework.getSession().history).toHaveLength(0);
    });

    it('should clear session state', () => {
      framework.getSession().state.set('test', 'value');
      
      framework.clearSession();
      
      expect(framework.getSession().state.size).toBe(0);
    });

    it('should keep session ID', () => {
      const originalId = framework.getSession().sessionId;
      
      framework.clearSession();
      
      expect(framework.getSession().sessionId).toBe(originalId);
    });
  });

  describe('exportSession', () => {
    it('should export session data', () => {
      // Set up session data
      framework.getSession().state.set('user', 'test');
      framework.getSession().history.push({
        id: 'test',
        timestamp: new Date(),
        input: 'test input',
        intent: {
          command: 'help',
          parameters: {},
          confidence: 0.9,
          rawQuery: 'test input'
        },
        result: { success: true }
      });
      
      const exported = framework.exportSession();
      
      expect(exported.sessionId).toBeDefined();
      expect(exported.state).toBeDefined();
      expect(exported.history).toHaveLength(1);
    });

    it('should create serializable export', () => {
      const exported = framework.exportSession();
      
      expect(() => {
        JSON.stringify(exported);
      }).not.toThrow();
    });
  });

  describe('importSession', () => {
    it('should import session data', () => {
      const sessionData = {
        sessionId: 'imported-session',
        state: new Map([['user', 'imported']]),
        history: [{
          id: 'imported',
          timestamp: new Date(),
          input: 'imported input',
          intent: {
            command: 'help',
            parameters: {},
            confidence: 0.9,
            rawQuery: 'imported input'
          },
          result: { success: true }
        }],
        contextProviders: [],
        startTime: new Date(),
        lastActivityTime: new Date()
      };
      
      framework.importSession(sessionData);
      
      const currentSession = framework.getSession();
      expect(currentSession.sessionId).toBe('imported-session');
      expect(currentSession.state.get('user')).toBe('imported');
      expect(currentSession.history).toHaveLength(1);
    });

    it('should validate imported session', () => {
      expect(() => {
        framework.importSession({} as any);
      }).toThrow('Invalid session data');
    });
  });

  describe('getCommandInfo', () => {
    it('should return command information', () => {
      const info = framework.getCommandInfo('help');
      
      expect(info).toBeDefined();
      expect(info!.description).toBe('Show help information');
    });

    it('should return undefined for non-existent command', () => {
      const info = framework.getCommandInfo('nonexistent');
      
      expect(info).toBeUndefined();
    });
  });

  describe('setSystemPrompt', () => {
    it('should update system prompt', () => {
      const newPrompt = 'You are a helpful assistant';
      
      framework.setSystemPrompt(newPrompt);
      
      expect(framework.getConfig().systemPrompt).toBe(newPrompt);
    });

    it('should handle empty system prompt', () => {
      framework.setSystemPrompt('');
      
      expect(framework.getConfig().systemPrompt).toBe('');
    });
  });

  describe('addContextProvider', () => {
    it('should add context provider', () => {
      const provider = {
        name: 'test-provider',
        description: 'Test context provider',
        getContext: async () => ({ summary: 'test data' })
      };
      
      framework.addContextProvider(provider);
      
      const session = framework.getSession();
      expect(session.contextProviders).toContain(provider);
    });

    it('should prevent duplicate providers', () => {
      const provider = {
        name: 'test-provider',
        description: 'Test context provider',
        getContext: async () => ({ summary: 'test data' })
      };
      
      framework.addContextProvider(provider);
      framework.addContextProvider(provider);
      
      const session = framework.getSession();
      expect(session.contextProviders.filter(p => p.name === 'test-provider')).toHaveLength(1);
    });
  });

  describe('removeContextProvider', () => {
    it('should remove context provider', () => {
      const provider = {
        name: 'test-provider',
        description: 'Test context provider',
        getContext: async () => ({ summary: 'test data' })
      };
      
      framework.addContextProvider(provider);
      framework.removeContextProvider('test-provider');
      
      const session = framework.getSession();
      expect(session.contextProviders.find(p => p.name === 'test-provider')).toBeUndefined();
    });

    it('should handle non-existent provider', () => {
      expect(() => {
        framework.removeContextProvider('nonexistent');
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle LLM provider errors', async () => {
      mockProvider.complete = async () => {
        throw new Error('LLM provider failed');
      };
      
      const result = await framework.processInput('help');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
    });

    it('should handle command handler errors', async () => {
      const errorCommand: CommandDefinition = {
        handler: async () => {
          throw new Error('Handler error');
        },
        description: 'Error command'
      };
      
      framework.registerCommand('error', errorCommand);
      // Disable natural language generation for cleaner testing
      framework.getSession().state.set('useNaturalLanguage', false);
      
      mockProvider.setDefaultResponse('{"command": "error", "parameters": {}, "confidence": 0.9}');
      
      const result = await framework.processInput('error');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Handler error');
    });

    it('should handle malformed intent responses', async () => {
      mockProvider.setDefaultResponse('invalid json');
      
      const result = await framework.processInput('help');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
    });
  });

  describe('configuration', () => {
    it('should allow updating configuration', () => {
      const newConfig = {
        ...config,
        systemPrompt: 'Updated system prompt'
      };
      
      framework.updateConfig(newConfig);
      
      expect(framework.getConfig().systemPrompt).toBe('Updated system prompt');
    });

    it('should validate configuration updates', () => {
      expect(() => {
        framework.updateConfig({} as any);
      }).toThrow('Invalid configuration');
    });
  });
});