/**
 * Real LLM Integration Tests - Starting with the most basic functionality
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import { LLMClientManager } from '../../src/integration/LLMClientManager.js';
import { ResourceManager } from '@legion/tools-registry';

describe('LLMClient Real Integration Tests', () => {
  let resourceManager;
  let apiKey;
  
  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    apiKey = resourceManager.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not found in ResourceManager');
    }
  });

  describe('Step 1: Basic LLM Client', () => {
    test('should create and initialize LLM client manager', async () => {
      const manager = new LLMClientManager({
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-sonnet-20240229'
      });

      await manager.initialize();

      expect(manager.initialized).toBe(true);
      expect(manager.llmClient).toBeDefined();
    }, 30000);

    test('should get basic response from LLM', async () => {
      const manager = new LLMClientManager({
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-sonnet-20240229'
      });

      await manager.initialize();

      // Test basic communication
      const response = await manager.llmClient.sendAndReceiveResponse(
        [
          { role: 'user', content: 'hi' }
        ],
        {
          maxTokens: 100
        }
      );

      console.log('Full response:', JSON.stringify(response, null, 2));

      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
      expect(response.toLowerCase()).toContain('hello');
      
      console.log('LLM Response to "hi":', response);
    }, 30000);

    test('should generate simple code', async () => {
      const manager = new LLMClientManager({
        provider: 'anthropic',
        apiKey: apiKey,
        model: 'claude-3-sonnet-20240229'
      });

      await manager.initialize();

      const result = await manager.generateCode(
        'Create a JavaScript function that adds two numbers',
        { language: 'javascript' }
      );

      console.log('Generate code result:', JSON.stringify(result, null, 2));

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toContain('function');
      expect(result.code).toMatch(/add|sum|plus/i);
      console.log('Generated code:', result.code);
    }, 30000);
  });
});