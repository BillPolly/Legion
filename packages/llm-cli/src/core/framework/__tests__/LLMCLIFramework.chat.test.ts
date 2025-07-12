import { LLMCLIFramework } from '../LLMCLIFramework';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';
import { LLMCLIConfig } from '../../../core/types';

describe('LLMCLIFramework - Default Chat', () => {
  let mockProvider: MockLLMProvider;
  let baseConfig: LLMCLIConfig;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
    baseConfig = {
      llmProvider: mockProvider,
      commands: {}
    };
  });

  describe('Default chat command registration', () => {
    it('should automatically register default chat command when no commands provided', () => {
      const framework = new LLMCLIFramework(baseConfig);
      const commands = framework.listCommands();
      
      expect(commands).toContain('chat');
      expect(commands).toHaveLength(1);
      
      const chatCommand = framework.getCommandInfo('chat');
      expect(chatCommand).toBeDefined();
      expect(chatCommand?.description).toBe('General conversational interface');
      expect(chatCommand?.metadata?.isDefault).toBe(true);
    });

    it('should register default chat command alongside other commands', () => {
      const configWithCommands: LLMCLIConfig = {
        ...baseConfig,
        commands: {
          test: {
            description: 'Test command',
            handler: async () => ({ success: true, output: 'Test output' })
          }
        }
      };
      
      const framework = new LLMCLIFramework(configWithCommands);
      const commands = framework.listCommands();
      
      expect(commands).toContain('chat');
      expect(commands).toContain('test');
      expect(commands).toHaveLength(2);
    });

    it('should not register default chat when disableDefaultChat is true', () => {
      const configNoChat: LLMCLIConfig = {
        ...baseConfig,
        disableDefaultChat: true
      };
      
      const framework = new LLMCLIFramework(configNoChat);
      const commands = framework.listCommands();
      
      expect(commands).not.toContain('chat');
      expect(commands).toHaveLength(0);
    });

    it('should not override existing chat command', () => {
      const customChatHandler = jest.fn(async () => ({ 
        success: true, 
        output: 'Custom chat response' 
      }));
      
      const configWithCustomChat: LLMCLIConfig = {
        ...baseConfig,
        commands: {
          chat: {
            description: 'Custom chat command',
            handler: customChatHandler
          }
        }
      };
      
      const framework = new LLMCLIFramework(configWithCustomChat);
      const chatCommand = framework.getCommandInfo('chat');
      
      expect(chatCommand?.description).toBe('Custom chat command');
      expect(chatCommand?.metadata?.isDefault).toBeUndefined();
    });
  });

  describe('Chat fallback behavior', () => {
    it('should fall back to chat for unrecognized commands', async () => {
      // Configure mock provider for intent recognition
      mockProvider.addResponse('Determine the intent', JSON.stringify({
        command: 'unknown',
        parameters: {},
        confidence: 0.2,
        reasoning: 'Command not found'
      }));
      
      // Configure mock provider for chat response
      mockProvider.addResponse('You are a helpful CLI assistant', 'I didn\'t understand that command, but I can help!');
      
      const framework = new LLMCLIFramework(baseConfig);
      const result = await framework.processInput('gibberish command');
      
      expect(result.success).toBe(true);
      expect(result.command).toBe('chat');
      expect(result.message).toContain('I didn\'t understand that command');
    });

    it('should fall back to chat for low confidence matches', async () => {
      const configWithTestCommand: LLMCLIConfig = {
        ...baseConfig,
        commands: {
          test: {
            description: 'Test command',
            handler: async () => ({ success: true, output: 'Test output' })
          }
        }
      };
      
      // Configure mock provider for low confidence intent
      mockProvider.addResponse('Determine the intent', JSON.stringify({
        command: 'test',
        parameters: {},
        confidence: 0.3,
        reasoning: 'Low confidence match'
      }));
      
      // Configure mock provider for chat response
      mockProvider.addResponse('You are a helpful CLI assistant', 'I think you might want the test command, but let me help you conversationally.');
      
      const framework = new LLMCLIFramework(configWithTestCommand);
      const result = await framework.processInput('maybe test something');
      
      expect(result.success).toBe(true);
      expect(result.command).toBe('chat');
    });

    it('should not fall back to chat when disabled', async () => {
      const configNoChat: LLMCLIConfig = {
        ...baseConfig,
        disableDefaultChat: true,
        commands: {
          test: {
            description: 'Test command',
            handler: async () => ({ success: true, output: 'Test output' })
          }
        }
      };
      
      // Configure mock provider for unknown command
      mockProvider.addResponse('Determine the intent', JSON.stringify({
        command: 'unknown',
        parameters: {},
        confidence: 0.2,
        reasoning: 'Command not found'
      }));
      
      const framework = new LLMCLIFramework(configNoChat);
      const result = await framework.processInput('gibberish command');
      
      expect(result.success).toBe(false);
      expect(result.command).toBe('unknown');
      expect(result.message).toContain('Unknown command');
    });
  });


  describe('Override behavior', () => {
    it('should allow runtime override of default chat', async () => {
      const framework = new LLMCLIFramework(baseConfig);
      
      // Verify default chat exists
      expect(framework.listCommands()).toContain('chat');
      const defaultChat = framework.getCommandInfo('chat');
      expect(defaultChat?.metadata?.isDefault).toBe(true);
      
      // Override with custom chat
      const customHandler = jest.fn(async () => ({ 
        success: true, 
        output: 'Custom chat!' 
      }));
      
      framework.registerCommand('chat', {
        description: 'Custom chat override',
        handler: customHandler
      });
      
      // Verify override
      const overriddenChat = framework.getCommandInfo('chat');
      expect(overriddenChat?.description).toBe('Custom chat override');
      expect(overriddenChat?.metadata?.isDefault).toBeUndefined();
      
      // Test execution uses custom handler
      mockProvider.addResponse('Determine the intent', JSON.stringify({
        command: 'chat',
        parameters: { message: 'Test' },
        confidence: 0.9
      }));
      
      await framework.processInput('Test');
      expect(customHandler).toHaveBeenCalled();
    });
  });
});