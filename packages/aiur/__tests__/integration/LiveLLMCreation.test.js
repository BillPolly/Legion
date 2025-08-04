/**
 * Test basic LLM creation and functionality using ResourceManager
 * This test verifies that we can create an LLMClient through ResourceManager
 * and get a response from the live Anthropic API
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';

describe('Live LLM Creation Test', () => {
  let resourceManager;
  let llmClient;
  
  beforeAll(async () => {
    // Initialize ResourceManager - it will load .env automatically
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Verify we have the API key
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
  });
  
  it('should create an LLMClient through ResourceManager', async () => {
    // Create LLMClient using ResourceManager (no API key in config!)
    llmClient = await resourceManager.createLLMClient({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      maxRetries: 3
    });
    
    expect(llmClient).toBeDefined();
    expect(llmClient.provider).toBeDefined();
    expect(llmClient.provider.getProviderName()).toBe('Anthropic');
  });
  
  it('should get a response from the LLM for a simple "hi" message', async () => {
    // Test basic completion
    const response = await llmClient.complete('Say "Hello! I am working." and nothing else.', 100);
    
    console.log('LLM Response:', response);
    
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(response.toLowerCase()).toContain('hello');
  }, 30000); // 30 second timeout for API call
  
  it('should handle conversation-style messages', async () => {
    // Test with message array format
    const messages = [
      { role: 'system', content: 'You are a helpful assistant. Be very concise.' },
      { role: 'user', content: 'What is 2+2? Just give the number.' }
    ];
    
    const response = await llmClient.sendAndReceiveResponse(messages, {
      maxTokens: 50
    });
    
    console.log('Math Response:', response);
    
    expect(response).toBeDefined();
    expect(response).toContain('4');
  }, 30000);
});