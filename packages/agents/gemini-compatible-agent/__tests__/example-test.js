const { GeminiCompatibleAgent } = require('../../src/core/GeminiCompatibleAgent');
const { ConversationManager } = require('../../src/conversation/ConversationManager');

describe('Example Test Suite', () => {
  let agent;
  let conversationManager;

  beforeEach(() => {
    // Setup test fixtures
    conversationManager = new ConversationManager();
    agent = new GeminiCompatibleAgent({
      conversationManager,
      apiKey: 'test-key',
      model: 'gemini-pro'
    });
  });

  afterEach(() => {
    // Cleanup
    if (agent) {
      agent.cleanup();
    }
  });

  test('should create agent instance', () => {
    expect(agent).toBeDefined();
    expect(agent).toBeInstanceOf(GeminiCompatibleAgent);
  });

  test('should have conversation manager', () => {
    expect(agent.conversationManager).toBeDefined();
    expect(agent.conversationManager).toBeInstanceOf(ConversationManager);
  });

  test('should handle basic conversation', async () => {
    const response = await agent.sendMessage('Hello');
    expect(response).toBeDefined();
    expect(typeof response).toBe('string' || 'object');
  });

  test('should maintain conversation state', async () => {
    await agent.sendMessage('First message');
    const conversation = agent.conversationManager.getConversation();
    expect(conversation).toBeDefined();
    expect(conversation.messages.length).toBeGreaterThan(0);
  });
});
