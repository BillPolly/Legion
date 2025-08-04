/**
 * Test ChatAgent basic functionality without tools
 * This test verifies that ChatAgent can have a basic conversation
 * using the LLMClient from ResourceManager
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import { ChatAgent } from '../../src/agents/ChatAgent.js';

describe('ChatAgent Basic Conversation Test', () => {
  let resourceManager;
  let chatAgent;
  let receivedMessages = [];
  
  beforeAll(async () => {
    // Initialize ResourceManager - it will load .env automatically
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Verify we have the API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
  });
  
  afterAll(() => {
    if (chatAgent) {
      chatAgent.destroy();
    }
  });
  
  it('should create ChatAgent with ResourceManager', async () => {
    // Create ChatAgent with ResourceManager (no API key!)
    chatAgent = new ChatAgent({
      sessionId: 'test-session-1',
      resourceManager: resourceManager,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022'
    });
    
    // Initialize the agent (creates LLMClient)
    await chatAgent.initialize();
    
    expect(chatAgent).toBeDefined();
    expect(chatAgent.llmClient).toBeDefined();
    expect(chatAgent.initialized).toBe(true);
  });
  
  it('should process a simple "hi" message', async () => {
    // Mock the emit function to capture responses
    chatAgent.emit = (eventName, data) => {
      console.log(`ChatAgent emitted: ${eventName}`, data);
      receivedMessages.push({ event: eventName, data });
    };
    
    // Process a simple message
    await chatAgent.processMessage('Say "Hello! I am ChatAgent." and nothing else.');
    
    // Check we got the expected events
    const responseEvent = receivedMessages.find(m => m.event === 'message');
    expect(responseEvent).toBeDefined();
    expect(responseEvent.data.type).toBe('chat_response');
    expect(responseEvent.data.content).toBeDefined();
    expect(responseEvent.data.content.toLowerCase()).toContain('hello');
    
    console.log('ChatAgent response:', responseEvent.data.content);
  }, 30000); // 30 second timeout for API call
  
  it('should maintain conversation history', async () => {
    // Clear previous messages
    receivedMessages = [];
    
    // Ask a question
    await chatAgent.processMessage('My favorite color is blue. What is my favorite color? Just say the color.');
    
    // Check the response knows the context
    const responseEvent = receivedMessages.find(m => m.event === 'message');
    expect(responseEvent).toBeDefined();
    expect(responseEvent.data.content.toLowerCase()).toContain('blue');
    
    // Check conversation history
    const history = chatAgent.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(2); // At least user message and assistant response
    expect(history.some(m => m.role === 'user' && m.content.includes('blue'))).toBe(true);
    expect(history.some(m => m.role === 'assistant')).toBe(true);
    
    console.log('Conversation history length:', history.length);
  }, 30000);
  
  it('should handle multiple messages in sequence', async () => {
    // Clear previous messages
    receivedMessages = [];
    
    // First message
    await chatAgent.processMessage('Remember the number 42.');
    
    let responseEvent = receivedMessages.find(m => m.event === 'message');
    expect(responseEvent).toBeDefined();
    
    // Clear for next message
    receivedMessages = [];
    
    // Second message referencing the first
    await chatAgent.processMessage('What number did I ask you to remember? Just say the number.');
    
    responseEvent = receivedMessages.find(m => m.event === 'message');
    expect(responseEvent).toBeDefined();
    expect(responseEvent.data.content).toContain('42');
    
    console.log('Memory test response:', responseEvent.data.content);
  }, 30000);
  
  it('should clear conversation history', () => {
    // Clear history
    chatAgent.clearHistory();
    
    // Check history is empty
    const history = chatAgent.getHistory();
    expect(history).toEqual([]);
    
    console.log('History cleared successfully');
  });
});