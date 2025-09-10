const { describe, it, expect, beforeEach } = require('@jest/globals');
const { GeminiCompatibleAgent } = require('../../src/core/GeminiCompatibleAgent');

describe('New Feature Test', () => {
  let agent;

  beforeEach(() => {
    agent = new GeminiCompatibleAgent({
      name: 'test-agent',
      model: 'test-model',
      apiKey: 'test-key'
    });
  });

  it('should initialize agent with correct configuration', () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe('test-agent');
    expect(agent.model).toBe('test-model');
  });

  it('should handle basic conversation flow', async () => {
    const response = await agent.processMessage('Hello');
    expect(response).toBeDefined();
    expect(typeof response).toBe('object');
  });

  it('should maintain conversation context', async () => {
    await agent.processMessage('What is my name?');
    const response = await agent.processMessage('Repeat what I just asked');
    expect(response.content).toContain('name');
  });

  it('should validate tool calls', async () => {
    const toolCall = {
      name: 'testTool',
      parameters: { input: 'test' }
    };
    
    const isValid = await agent.validateToolCall(toolCall);
    expect(isValid).toBeDefined();
  });
});
