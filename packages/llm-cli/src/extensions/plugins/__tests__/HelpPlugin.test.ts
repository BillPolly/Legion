import { HelpPlugin } from '../builtin/HelpPlugin';
import { PluginManager } from '../PluginManager';
import { LLMCLIFramework } from '../../../core/framework/LLMCLIFramework';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';

describe('HelpPlugin', () => {
  let plugin: HelpPlugin;
  let manager: PluginManager;
  let framework: LLMCLIFramework;

  beforeEach(async () => {
    framework = new LLMCLIFramework({
      llmProvider: new MockLLMProvider(),
      commands: {
        echo: {
          handler: async (params) => ({ success: true, output: `Echo: ${params.text}` }),
          description: 'Echo the input text',
          parameters: [{
            name: 'text',
            type: 'string',
            description: 'Text to echo',
            required: true
          }],
          examples: [
            { input: 'echo hello', description: 'Echo a simple word' },
            { input: 'echo "hello world"', description: 'Echo a phrase with spaces' }
          ]
        },
        test: {
          handler: async () => ({ success: true }),
          description: 'Test command'
        }
      }
    });

    manager = new PluginManager(framework);
    
    // Ensure clean state - unload any existing plugin first
    if (manager.isLoaded('help-plugin')) {
      await manager.unloadPlugin('help-plugin');
    }
    
    plugin = new HelpPlugin();
    await manager.loadPlugin(plugin);
  });

  describe('help command', () => {
    it('should show general help', async () => {
      // Disable natural language for cleaner test assertions
      framework.getSession().state.set('useNaturalLanguage', false);
      
      // Mock the intent recognition
      const mockProvider = framework.getConfig().llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('{"command": "help", "parameters": {}, "confidence": 0.9}');
      
      const result = await framework.processInput('help');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('Available Commands');
      expect(result.message).toContain('echo');
      expect(result.message).toContain('test');
      expect(result.message).toContain('help');
    });

    it('should show help for specific command', async () => {
      framework.getSession().state.set('useNaturalLanguage', false);
      const mockProvider = framework.getConfig().llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('{"command": "help", "parameters": {"command": "echo"}, "confidence": 0.9}');
      
      const result = await framework.processInput('help echo');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('echo');
      expect(result.message).toContain('Echo the input text');
      expect(result.message).toContain('Parameters');
      expect(result.message).toContain('text (string)');
      expect(result.message).toContain('Examples');
    });

    it('should handle non-existent command', async () => {
      framework.getSession().state.set('useNaturalLanguage', false);
      const mockProvider = framework.getConfig().llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('{"command": "help", "parameters": {"command": "nonexistent"}, "confidence": 0.9}');
      
      const result = await framework.processInput('help nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should suggest similar commands', async () => {
      framework.getSession().state.set('useNaturalLanguage', false);
      const mockProvider = framework.getConfig().llmProvider as MockLLMProvider;
      mockProvider.setDefaultResponse('{"command": "help", "parameters": {"command": "eco"}, "confidence": 0.9}');
      
      const result = await framework.processInput('help eco');
      
      expect(result.success).toBe(false);
      expect(result.suggestions).toContain('echo');
    });

    it('should handle empty command registry', async () => {
      // Create a new framework with no commands
      const emptyFramework = new LLMCLIFramework({
        llmProvider: new MockLLMProvider(),
        commands: {}
      });
      
      const emptyManager = new PluginManager(emptyFramework);
      await emptyManager.loadPlugin(new HelpPlugin());
      
      emptyFramework.getSession().state.set('useNaturalLanguage', false);
      const emptyMockProvider = emptyFramework.getConfig().llmProvider as MockLLMProvider;
      emptyMockProvider.setDefaultResponse('{"command": "help", "parameters": {}, "confidence": 0.9}');
      
      const result = await emptyFramework.processInput('help');
      
      expect(result.success).toBe(true);
      expect(result.message).toContain('help');
    });
  });

  describe('help context provider', () => {
    it('should provide command context', async () => {
      const session = framework.getSession();
      const provider = session.contextProviders.find(p => p.name === 'help-context');
      
      expect(provider).toBeDefined();
      
      const context = await provider!.getContext(session);
      expect(context.summary).toContain('Available commands');
      expect(context.details?.commands).toContain('echo');
      expect(context.details?.commands).toContain('test');
      expect(context.details?.commands).toContain('help');
    });
  });

  describe('plugin lifecycle', () => {
    it('should register help command on initialization', () => {
      const commands = framework.listCommands();
      expect(commands).toContain('help');
    });

    it('should unregister help command on cleanup', async () => {
      await manager.unloadPlugin('help-plugin');
      
      const commands = framework.listCommands();
      expect(commands).not.toContain('help');
    });

    it('should remove context provider on cleanup', async () => {
      const session = framework.getSession();
      
      await manager.unloadPlugin('help-plugin');
      
      const provider = session.contextProviders.find(p => p.name === 'help-context');
      expect(provider).toBeUndefined();
    });
  });
});