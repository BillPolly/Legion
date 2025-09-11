import ConversationManager from '../../src/conversation/ConversationManager.js';
import { ValidationHelper } from '../../src/utils/ValidationHelper.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Conversation Validation Tests', () => {
  let conversationManager;
  let validationHelper;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    // Create mock prompt manager for testing
    const mockPromptManager = {
      buildSystemPrompt: async () => 'Test system prompt'
    };
    
    conversationManager = new ConversationManager(resourceManager);
    validationHelper = new ValidationHelper();
  });

  test('should validate conversation format', () => {
    const validConversation = {
      id: 'test-123',
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ],
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId: 'session-123'
      }
    };

    expect(() => {
      validationHelper.validateConversation(validConversation);
    }).not.toThrow();
  });

  test('should reject invalid conversation format', () => {
    const invalidConversation = {
      messages: 'not-an-array',
      metadata: 'invalid'
    };

    expect(() => {
      validationHelper.validateConversation(invalidConversation);
    }).toThrow();
  });

  test('should handle conversation state changes', () => {
    const initialState = conversationManager.getState();
    expect(initialState.messages).toHaveLength(0);

    conversationManager.addMessage({
      role: 'user',
      content: 'Test message'
    });

    const updatedState = conversationManager.getState();
    expect(updatedState.messages).toHaveLength(1);
  });
});
