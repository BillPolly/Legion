/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { LLMClient } from '@jsenvoy/llm';

describe('Simple Real LLM Test', () => {
  let resourceManager;
  let llmClient;
  
  beforeAll(async () => {
    console.log('🚀 Initializing Simple Real LLM Test...');
    
    // Initialize ResourceManager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    const apiKey = resourceManager.get('env.ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for real LLM tests');
    }
    
    // Create real LLM client
    llmClient = new LLMClient({
      provider: 'anthropic',
      apiKey: apiKey,
      model: 'claude-3-sonnet-20240229',
      maxRetries: 1
    });
    
    console.log('✅ Simple Real LLM Test initialized');
  });
  
  afterAll(async () => {
    console.log('🧹 Cleaning up simple test resources...');
  });

  test('should make a simple LLM call and get response', async () => {
    console.log('🔍 Testing simple LLM call...');
    
    const prompt = 'What is 2 + 2? Respond with just the number.';
    
    const startTime = Date.now();
    const response = await llmClient.complete(prompt);
    const duration = Date.now() - startTime;
    
    console.log(`✅ LLM call completed in ${duration}ms`);
    console.log(`📝 Response: "${response}"`);
    
    // Verify we got a response
    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    
  }, 30000); // 30 second timeout
});