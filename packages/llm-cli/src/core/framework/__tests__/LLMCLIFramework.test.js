import { LLMCLIFramework } from '../LLMCLIFramework.js';
import { MockLLMProvider } from '../../providers/MockLLMProvider.js';

describe('LLMCLIFramework', () => {
  let framework;
  let mockProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    framework = new LLMCLIFramework({
      llmProvider: mockProvider,
      commands: {
        test: {
          handler: async (args) => ({
            success: true,
            output: `Test executed with: ${args.input || 'no input'}`
          }),
          description: 'Test command'
        }
      }
    });
  });

  describe('constructor', () => {
    it('should create framework instance', () => {
      expect(framework).toBeDefined();
      expect(framework.config).toBeDefined();
      expect(framework.sessionManager).toBeDefined();
    });

    it('should register default chat command when not disabled', () => {
      const commands = framework.listCommands();
      expect(commands).toContain('chat');
      expect(commands).toContain('test');
    });

    it('should not register chat command when disabled', () => {
      const frameworkNoChat = new LLMCLIFramework({
        llmProvider: mockProvider,
        disableDefaultChat: true,
        commands: {}
      });
      expect(frameworkNoChat.listCommands()).not.toContain('chat');
    });
  });

  describe('processInput', () => {
    it('should handle empty input', async () => {
      const result = await framework.processInput('');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Empty input');
    });

    it('should execute test command', async () => {
      const result = await framework.processInput('test hello world');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test executed');
    });

    it('should handle unknown command', async () => {
      const result = await framework.processInput('unknown command');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
    });

    it('should execute chat command', async () => {
      mockProvider.setDefaultResponse('Hello from AI');
      const result = await framework.processInput('chat Hello AI');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Hello from AI');
    });
  });

  describe('command management', () => {
    it('should list commands', () => {
      const commands = framework.listCommands();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands).toContain('test');
      expect(commands).toContain('chat');
    });

    it('should register new command', () => {
      framework.registerCommand('hello', {
        handler: async () => ({ success: true }),
        description: 'Say hello'
      });
      expect(framework.listCommands()).toContain('hello');
    });

    it('should unregister command', () => {
      framework.unregisterCommand('test');
      expect(framework.listCommands()).not.toContain('test');
    });

    it('should not allow removing last command', () => {
      // Remove all but one command
      const commands = framework.listCommands();
      for (let i = 0; i < commands.length - 1; i++) {
        framework.unregisterCommand(commands[i]);
      }
      
      // Try to remove the last one
      const lastCommand = framework.listCommands()[0];
      expect(() => framework.unregisterCommand(lastCommand)).toThrow();
    });
  });

  describe('session management', () => {
    it('should get session', () => {
      const session = framework.getSession();
      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.state).toBeInstanceOf(Map);
    });

    it('should clear session', () => {
      const session = framework.getSession();
      session.state.set('key', 'value');
      session.history.push({ id: '1', timestamp: new Date() });
      
      framework.clearSession();
      
      expect(session.state.size).toBe(0);
      expect(session.history.length).toBe(0);
    });

    it('should export and import session', () => {
      const session = framework.getSession();
      session.state.set('key', 'value');
      
      const exported = framework.exportSession();
      expect(exported.state.key).toBe('value');
      
      // Create new framework and import
      const newFramework = new LLMCLIFramework({
        llmProvider: mockProvider,
        commands: {}
      });
      
      newFramework.importSession(exported);
      const importedSession = newFramework.getSession();
      expect(importedSession.sessionId).toBe(exported.sessionId);
      expect(importedSession.state.get('key')).toBe('value');
    });
  });

  describe('configuration', () => {
    it('should validate config', () => {
      expect(() => new LLMCLIFramework()).toThrow('config is required');
      expect(() => new LLMCLIFramework({})).toThrow('llmProvider is required');
      expect(() => new LLMCLIFramework({ llmProvider: mockProvider })).toThrow('commands object is required');
    });

    it('should update config', () => {
      const newConfig = {
        llmProvider: mockProvider,
        commands: { new: { handler: () => {}, description: 'New' } },
        systemPrompt: 'New prompt'
      };
      
      framework.updateConfig(newConfig);
      expect(framework.getConfig().systemPrompt).toBe('New prompt');
    });

    it('should set system prompt', () => {
      framework.setSystemPrompt('Test prompt');
      expect(framework.getConfig().systemPrompt).toBe('Test prompt');
    });
  });

  describe('context providers', () => {
    it('should add context provider', () => {
      const provider = { name: 'test', description: 'Test provider' };
      framework.addContextProvider(provider);
      
      const session = framework.getSession();
      expect(session.contextProviders).toContainEqual(provider);
    });

    it('should remove context provider', () => {
      const provider = { name: 'test', description: 'Test provider' };
      framework.addContextProvider(provider);
      framework.removeContextProvider('test');
      
      const session = framework.getSession();
      expect(session.contextProviders).not.toContainEqual(provider);
    });
  });
});