/**
 * Simple LLM Test to isolate the hanging issue
 */

import { ResourceManager } from '@legion/resource-manager';

describe('Simple LLM Test', () => {
  let llmClient;

  beforeAll(async () => {
    const resourceManager = await ResourceManager.getInstance();
    llmClient = await resourceManager.get('llmClient');
    
    console.log('LLMClient obtained:', !!llmClient);
    console.log('LLMClient type:', typeof llmClient);
  });

  test('should complete a simple LLM request', async () => {
    console.log('Testing simple LLM completion...');
    
    const simplePrompt = 'Return only: {"test": true}';
    
    try {
      console.log('Making LLM request...');
      const response = await llmClient.complete(simplePrompt);
      console.log('LLM response received:', response);
      
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    } catch (error) {
      console.error('LLM request failed:', error);
      throw error;
    }
  }, 30000);
});