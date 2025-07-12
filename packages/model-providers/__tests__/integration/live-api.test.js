/**
 * Integration tests with live APIs
 * These tests run only if API keys are available in environment
 */

import { jest } from '@jest/globals';
import { Model } from '../../src/index.js';
import { 
  hasLiveAPIKeys,
  createIntegrationTestConfigs,
  createTestMessages,
  measureResponseTime,
  validateAPIResponse
} from '../utils/test-helpers.js';

const apiKeys = hasLiveAPIKeys();
const configs = createIntegrationTestConfigs();

// Skip all tests if no API keys are available
const describeIf = (condition) => condition ? describe : describe.skip;

describeIf(Object.keys(configs).length > 0)('Live API Integration Tests', () => {
  // Increase timeout for live API calls
  jest.setTimeout(60000);

  let testMessages;

  beforeAll(() => {
    testMessages = createTestMessages();
  });

  describe('OpenAI Provider Integration', () => {
    describeIf(configs.openai)('with live OpenAI API', () => {
      let model;

      beforeAll(() => {
        model = new Model({ modelConfig: configs.openai });
        model.initializeModel();
      });

      test('should successfully communicate with OpenAI API', async () => {
        const response = await model.sendAndReceiveResponse(testMessages);
        
        validateAPIResponse(response);
        expect(typeof response).toBe('string');
        expect(response.length).toBeGreaterThan(0);
      });

      test('should handle simple conversation', async () => {
        const simpleMessages = [
          { role: 'user', content: 'Say "Hello World" and nothing else.' }
        ];

        const response = await model.sendAndReceiveResponse(simpleMessages);
        
        validateAPIResponse(response);
        expect(response.toLowerCase()).toContain('hello');
      });

      test('should respond within reasonable time', async () => {
        const { response, timeMs } = await measureResponseTime(model, testMessages);
        
        validateAPIResponse(response);
        expect(timeMs).toBeLessThan(30000); // 30 seconds max
        expect(timeMs).toBeGreaterThan(100); // Should take some time
      });

      test('should handle JSON instruction requests', async () => {
        const jsonMessages = [
          { 
            role: 'user', 
            content: 'Respond with valid JSON containing a "message" field with the text "success". No other text, just the JSON object.' 
          }
        ];

        const response = await model.sendAndReceiveResponse(jsonMessages);
        
        validateAPIResponse(response);
        
        // Try to parse as JSON
        try {
          const parsed = JSON.parse(response);
          expect(parsed).toHaveProperty('message');
          expect(parsed.message.toLowerCase()).toContain('success');
        } catch (e) {
          // If not JSON, at least check it contains "success"
          expect(response.toLowerCase()).toContain('success');
        }
      });

      test('should handle longer conversation context', async () => {
        const longConversation = [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there! How can I help you today?' },
          { role: 'user', content: 'What is 2+2?' },
          { role: 'assistant', content: 'The answer to 2+2 is 4.' },
          { role: 'user', content: 'Thank you. Now just say "conversation complete".' }
        ];

        const response = await model.sendAndReceiveResponse(longConversation);
        
        validateAPIResponse(response);
        expect(response.toLowerCase()).toContain('conversation');
      });
    });
  });

  describe('DeepSeek Provider Integration', () => {
    describeIf(configs.deepseek)('with live DeepSeek API', () => {
      let model;

      beforeAll(() => {
        model = new Model({ modelConfig: configs.deepseek });
        model.initializeModel();
      });

      test('should successfully communicate with DeepSeek API', async () => {
        const jsonMessages = [
          { 
            role: 'user', 
            content: 'Respond with valid JSON containing a "response" field with "Hello from DeepSeek" and a "status" field with "success".'
          }
        ];

        const response = await model.sendAndReceiveResponse(jsonMessages);
        
        validateAPIResponse(response);
        expect(typeof response).toBe('object');
        expect(response).toHaveProperty('response');
        expect(response).toHaveProperty('status');
      });

      test('should return structured JSON responses', async () => {
        const structuredRequest = [
          {
            role: 'user',
            content: 'Create a JSON response with the following structure: {"task_completed": true, "response": {"type": "test", "message": "DeepSeek integration test"}, "use_tool": null}'
          }
        ];

        const response = await model.sendAndReceiveResponse(structuredRequest);
        
        validateAPIResponse(response);
        expect(response).toHaveProperty('task_completed');
        expect(response).toHaveProperty('response');
        expect(response.response).toHaveProperty('type');
        expect(response.response).toHaveProperty('message');
      });

      test('should respond within reasonable time', async () => {
        const jsonMessages = [
          { 
            role: 'user', 
            content: 'Respond with valid JSON: {"message": "quick response", "timestamp": "' + new Date().toISOString() + '"}'
          }
        ];

        const { response, timeMs } = await measureResponseTime(model, jsonMessages);
        
        validateAPIResponse(response);
        expect(timeMs).toBeLessThan(30000); // 30 seconds max
        expect(response).toHaveProperty('message');
      });

      test('should handle complex JSON structures', async () => {
        const complexRequest = [
          {
            role: 'user',
            content: 'Create a JSON response with nested objects, arrays, and various data types. Include at least: strings, numbers, booleans, null, arrays, and nested objects.'
          }
        ];

        const response = await model.sendAndReceiveResponse(complexRequest);
        
        validateAPIResponse(response);
        expect(typeof response).toBe('object');
        expect(Object.keys(response).length).toBeGreaterThan(0);
      });
    });
  });

  describe('Cross-Provider Compatibility', () => {
    test('should handle same request across different providers', async () => {
      const testRequest = [
        {
          role: 'user',
          content: 'Respond with exactly: "Provider test successful"'
        }
      ];

      const results = {};

      // Test each available provider
      for (const [providerName, config] of Object.entries(configs)) {
        const model = new Model({ modelConfig: config });
        model.initializeModel();

        try {
          const response = await model.sendAndReceiveResponse(testRequest);
          results[providerName] = response;
          validateAPIResponse(response);
        } catch (error) {
          console.warn(`Provider ${providerName} failed:`, error.message);
          results[providerName] = { error: error.message };
        }
      }

      // At least one provider should succeed
      const successfulProviders = Object.entries(results).filter(
        ([_, result]) => !result.error
      );
      expect(successfulProviders.length).toBeGreaterThan(0);

      // Log results for debugging
      console.log('Provider test results:', results);
    });
  });

  describe('Error Handling with Live APIs', () => {
    describeIf(configs.openai)('OpenAI error scenarios', () => {
      test('should handle invalid API key gracefully', async () => {
        const invalidConfig = {
          ...configs.openai,
          apiKey: 'invalid-key-12345'
        };

        const model = new Model({ modelConfig: invalidConfig });
        model.initializeModel();

        await expect(
          model.sendAndReceiveResponse(testMessages)
        ).rejects.toThrow();
      });

      test('should handle very long messages', async () => {
        const model = new Model({ modelConfig: configs.openai });
        model.initializeModel();

        const longMessage = [
          {
            role: 'user',
            content: 'This is a very long message. ' + 'Repeat this sentence. '.repeat(100) + 'End with "long message processed".'
          }
        ];

        // This might fail due to token limits, which is expected
        try {
          const response = await model.sendAndReceiveResponse(longMessage);
          validateAPIResponse(response);
          expect(response.toLowerCase()).toContain('processed');
        } catch (error) {
          // Token limit errors are acceptable
          expect(error.message).toMatch(/token|length|limit|timeout/i);
        }
      }, 90000);
    });
  });

  describe('Performance Testing', () => {
    describeIf(configs.openai)('Response time benchmarks', () => {
      test('should complete simple requests quickly', async () => {
        const model = new Model({ modelConfig: configs.openai });
        model.initializeModel();

        const quickMessages = [
          { role: 'user', content: 'Say "quick"' }
        ];

        const { response, timeMs } = await measureResponseTime(model, quickMessages);
        
        validateAPIResponse(response);
        expect(timeMs).toBeLessThan(15000); // 15 seconds for simple request
        expect(response.toLowerCase()).toContain('quick');
      });

      test('should handle concurrent requests', async () => {
        const model = new Model({ modelConfig: configs.openai });
        model.initializeModel();

        const requests = Array.from({ length: 3 }, (_, i) => 
          model.sendAndReceiveResponse([
            { role: 'user', content: `Say "Response ${i + 1}"` }
          ])
        );

        const responses = await Promise.all(requests);
        
        responses.forEach((response, i) => {
          validateAPIResponse(response);
          expect(response.toLowerCase()).toContain((i + 1).toString());
        });
      });
    });
  });

  describe('Edge Cases with Live APIs', () => {
    describeIf(configs.openai)('OpenAI edge cases', () => {
      test('should handle empty user message', async () => {
        const model = new Model({ modelConfig: configs.openai });
        model.initializeModel();

        const emptyMessages = [
          { role: 'user', content: '' }
        ];

        // This might succeed or fail depending on API behavior
        try {
          const response = await model.sendAndReceiveResponse(emptyMessages);
          validateAPIResponse(response);
        } catch (error) {
          // Empty messages might be rejected by API
          expect(error).toBeDefined();
        }
      });

      test('should handle system message only', async () => {
        const model = new Model({ modelConfig: configs.openai });
        model.initializeModel();

        const systemOnlyMessages = [
          { role: 'system', content: 'You are a helpful assistant.' }
        ];

        // This might succeed or fail depending on API behavior
        try {
          const response = await model.sendAndReceiveResponse(systemOnlyMessages);
          validateAPIResponse(response);
        } catch (error) {
          // System-only messages might be rejected by API
          expect(error).toBeDefined();
        }
      });
    });
  });
});

// Always run these tests to ensure the integration test setup works
describe('Integration Test Setup', () => {
  test('should detect available API keys', () => {
    const availableKeys = Object.entries(apiKeys).filter(([_, hasKey]) => hasKey);
    
    if (availableKeys.length === 0) {
      console.warn('No live API keys detected. Integration tests will be skipped.');
      console.warn('To run integration tests, set environment variables:');
      console.warn('- OPENAI_API_KEY for OpenAI tests');
      console.warn('- ANTHROPIC_API_KEY for Anthropic tests');
      console.warn('- DEEPSEEK_API_KEY for DeepSeek tests');
    } else {
      console.log('Available API keys for testing:', availableKeys.map(([key]) => key));
    }

    // This test should always pass
    expect(typeof apiKeys).toBe('object');
  });

  test('should create valid test configurations', () => {
    Object.entries(configs).forEach(([provider, config]) => {
      expect(config).toHaveProperty('provider');
      expect(config).toHaveProperty('model');
      expect(config).toHaveProperty('apiKey');
      expect(config.apiKey).toBeTruthy();
    });
  });
});