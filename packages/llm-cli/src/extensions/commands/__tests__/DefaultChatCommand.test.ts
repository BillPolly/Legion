import { DefaultChatCommand } from '../DefaultChatCommand';
import { MockLLMProvider } from '../../../core/providers/MockLLMProvider';
import { SessionState } from '../../../runtime/session/types';

describe('DefaultChatCommand', () => {
  let chatCommand: DefaultChatCommand;
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    chatCommand = new DefaultChatCommand();
    mockProvider = new MockLLMProvider();
  });

  describe('getCommandDefinition', () => {
    it('should return a valid command definition', () => {
      const definition = chatCommand.getCommandDefinition(mockProvider);
      
      expect(definition.description).toBe('General conversational interface');
      expect(definition.parameters).toHaveLength(1);
      expect(definition.parameters![0].name).toBe('message');
      expect(definition.parameters![0].type).toBe('string');
      expect(definition.parameters![0].required).toBe(false);
      expect(definition.handler).toBeDefined();
      expect(definition.examples).toHaveLength(3);
      expect(definition.category).toBe('general');
      expect(definition.metadata).toEqual({
        isDefault: true,
        fallbackCommand: true
      });
    });
  });

  describe('handler', () => {
    const mockSession: SessionState = {
      sessionId: 'test-session',
      state: new Map(),
      history: [],
      contextProviders: [],
      startTime: new Date(),
      lastActivityTime: new Date()
    };

    it('should handle chat messages successfully', async () => {
      mockProvider.addResponse('You are a helpful CLI assistant', 'Hello! How can I help you today?');
      
      const definition = chatCommand.getCommandDefinition(mockProvider);
      const result = await definition.handler({ message: 'Hello' }, mockSession);
      
      expect(result.success).toBe(true);
      expect(result.output).toBe('Hello! How can I help you today?');
      expect(result.data?.originalMessage).toBe('Hello');
      expect(result.data?.timestamp).toBeInstanceOf(Date);
    });

    it('should handle different parameter names', async () => {
      mockProvider.addResponse('You are a helpful CLI assistant', 'I can help with that!');
      
      const definition = chatCommand.getCommandDefinition(mockProvider);
      
      // Test with 'input' parameter
      let result = await definition.handler({ input: 'Help me' }, mockSession);
      expect(result.success).toBe(true);
      expect(result.data?.originalMessage).toBe('Help me');
      
      // Test with 'query' parameter
      result = await definition.handler({ query: 'What can you do?' }, mockSession);
      expect(result.success).toBe(true);
      expect(result.data?.originalMessage).toBe('What can you do?');
    });

    it('should use default message when none provided', async () => {
      mockProvider.addResponse('You are a helpful CLI assistant', 'Hello there!');
      
      const definition = chatCommand.getCommandDefinition(mockProvider);
      const result = await definition.handler({}, mockSession);
      
      expect(result.success).toBe(true);
      expect(result.data?.originalMessage).toBe('Hello');
    });

    it('should handle errors gracefully', async () => {
      // Configure mock provider to throw an error
      mockProvider.complete = async () => {
        throw new Error('LLM provider failed');
      };
      
      const definition = chatCommand.getCommandDefinition(mockProvider);
      const result = await definition.handler({ message: 'Test' }, mockSession);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('LLM provider failed');
      expect(result.data?.originalMessage).toBe('Test');
    });
  });

  describe('with history', () => {
    it('should include conversation history when session is provided', async () => {
      const chatCommandWithHistory = new DefaultChatCommand({
        includeHistory: true,
        maxHistoryEntries: 2
      });
      
      let capturedPrompt = '';
      mockProvider.addResponse('', 'Response with history');
      mockProvider.complete = async (prompt: string) => {
        capturedPrompt = prompt;
        return 'Response with history';
      };
      
      const session: SessionState = {
        sessionId: 'test-session',
        state: new Map(),
        history: [
          {
            id: '1',
            timestamp: new Date(),
            input: 'Previous question',
            intent: { command: 'chat', parameters: { message: 'Previous question' }, confidence: 1, rawQuery: 'Previous question' },
            result: { success: true, output: 'Previous answer' }
          },
          {
            id: '2',
            timestamp: new Date(),
            input: 'Another question',
            intent: { command: 'chat', parameters: { message: 'Another question' }, confidence: 1, rawQuery: 'Another question' },
            result: { success: true, output: 'Another answer' }
          }
        ],
        contextProviders: [],
        startTime: new Date(),
        lastActivityTime: new Date()
      };
      
      const definition = chatCommandWithHistory.getCommandDefinition(mockProvider);
      await definition.handler({ message: 'Current question' }, session);
      
      expect(capturedPrompt).toContain('Previous conversation:');
      expect(capturedPrompt).toContain('User: Previous question');
      expect(capturedPrompt).toContain('Assistant: Previous answer');
      expect(capturedPrompt).toContain('User: Another question');
      expect(capturedPrompt).toContain('Assistant: Another answer');
      expect(capturedPrompt).toContain('User: Current question');
    });

    it('should not include history when disabled', async () => {
      const chatCommandNoHistory = new DefaultChatCommand({
        includeHistory: false
      });
      
      let capturedPrompt = '';
      mockProvider.complete = async (prompt: string) => {
        capturedPrompt = prompt;
        return 'Response without history';
      };
      
      const session: SessionState = {
        sessionId: 'test-session',
        state: new Map(),
        history: [
          {
            id: '1',
            timestamp: new Date(),
            input: 'Previous question',
            intent: { command: 'chat', parameters: {}, confidence: 1, rawQuery: 'Previous question' },
            result: { success: true, output: 'Previous answer' }
          }
        ],
        contextProviders: [],
        startTime: new Date(),
        lastActivityTime: new Date()
      };
      
      const definition = chatCommandNoHistory.getCommandDefinition(mockProvider);
      await definition.handler({ message: 'Current question' }, session);
      
      expect(capturedPrompt).not.toContain('Previous conversation:');
      expect(capturedPrompt).not.toContain('Previous question');
    });
  });

  describe('custom system prompt', () => {
    it('should use custom system prompt when provided', async () => {
      const customPrompt = 'You are a specialized assistant for coding tasks.';
      const chatCommandCustom = new DefaultChatCommand({
        systemPrompt: customPrompt
      });
      
      let capturedPrompt = '';
      mockProvider.complete = async (prompt: string) => {
        capturedPrompt = prompt;
        return 'Custom response';
      };
      
      const mockSession: SessionState = {
        sessionId: 'test-session',
        state: new Map(),
        history: [],
        contextProviders: [],
        startTime: new Date(),
        lastActivityTime: new Date()
      };
      
      const definition = chatCommandCustom.getCommandDefinition(mockProvider);
      await definition.handler({ message: 'Test' }, mockSession);
      
      expect(capturedPrompt).toContain(customPrompt);
    });
  });
});