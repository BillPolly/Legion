/**
 * Simple LLM integration test - just say hi to real LLM
 * NO MOCKS - uses real Anthropic LLM client
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Simple LLM Integration', () => {
  let resourceManager;
  let llmClient;

  beforeAll(async () => {
    // Get real ResourceManager singleton
    resourceManager = await ResourceManager.getInstance();
    
    // Get real LLM client
    llmClient = await resourceManager.get('llmClient');
  });

  test('should get response from real LLM', async () => {
    const simplePrompt = 'Hello! Please respond with just "Hi there!" and nothing else.';
    
    const response = await llmClient.complete(simplePrompt);
    
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    
    console.log('LLM Response:', response);
  }, 30000); // 30 second timeout for real LLM call
});