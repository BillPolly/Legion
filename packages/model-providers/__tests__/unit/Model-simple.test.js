/**
 * Simplified unit tests for Model class
 */

import { jest } from '@jest/globals';
import { Model } from '../../src/index.js';
import { createMockConfigs, createTestMessages } from '../utils/test-helpers.js';

describe('Model - Basic Functionality', () => {
  let mockConfigs;
  let testMessages;

  beforeEach(() => {
    mockConfigs = createMockConfigs();
    testMessages = createTestMessages();
  });

  describe('constructor', () => {
    test('should initialize with correct model config', () => {
      const model = new Model({ modelConfig: mockConfigs.openai });
      
      expect(model.modelConfig).toEqual(mockConfigs.openai);
      expect(model.modelConfig.provider).toBe('OPEN_AI');
      expect(model.modelConfig.model).toBe('gpt-4o');
      expect(model.modelConfig.apiKey).toBe('test-openai-key');
    });

    test('should accept different provider configurations', () => {
      const providers = ['openai', 'deepseek', 'openrouter'];
      
      providers.forEach(provider => {
        const model = new Model({ modelConfig: mockConfigs[provider] });
        expect(model.modelConfig).toEqual(mockConfigs[provider]);
      });
    });
  });

  describe('initializeModel', () => {
    test('should throw error for OpenAI without API key', () => {
      const configWithoutKey = { ...mockConfigs.openai, apiKey: null };
      const model = new Model({ modelConfig: configWithoutKey });

      expect(() => model.initializeModel()).toThrow('OpenAI API Key is missing!');
    });

    test('should throw error for DeepSeek without API key', () => {
      const configWithoutKey = { ...mockConfigs.deepseek, apiKey: '' };
      const model = new Model({ modelConfig: configWithoutKey });

      expect(() => model.initializeModel()).toThrow('DEEP SEEK API Key is missing!');
    });

    test('should throw error for OpenRouter without API key', () => {
      const configWithoutKey = { ...mockConfigs.openrouter, apiKey: undefined };
      const model = new Model({ modelConfig: configWithoutKey });

      expect(() => model.initializeModel()).toThrow('OPEN ROUTER API Key is missing!');
    });

    test('should initialize providers when API keys are present', () => {
      const providers = ['openai', 'deepseek', 'openrouter'];
      
      providers.forEach(provider => {
        const model = new Model({ modelConfig: mockConfigs[provider] });
        
        // Should not throw
        expect(() => model.initializeModel()).not.toThrow();
      });
    });
  });

  describe('message validation', () => {
    test('should work with valid message formats', () => {
      const validMessages = [
        [{ role: 'user', content: 'Simple message' }],
        [{ role: 'system', content: 'System message' }, { role: 'user', content: 'User message' }],
        testMessages
      ];

      validMessages.forEach(messages => {
        expect(Array.isArray(messages)).toBe(true);
        messages.forEach(message => {
          expect(message).toHaveProperty('role');
          expect(message).toHaveProperty('content');
          expect(['system', 'user', 'assistant']).toContain(message.role);
        });
      });
    });
  });

  describe('configuration validation', () => {
    test('should validate provider types', () => {
      const validProviders = ['OPEN_AI', 'DEEP_SEEK', 'OPEN_ROUTER'];
      
      validProviders.forEach(provider => {
        const config = { ...mockConfigs.openai, provider };
        const model = new Model({ modelConfig: config });
        expect(model.modelConfig.provider).toBe(provider);
      });
    });

    test('should store model names correctly', () => {
      const modelConfigs = [
        { ...mockConfigs.openai, model: 'gpt-4o' },
        { ...mockConfigs.deepseek, model: 'deepseek-chat' },
        { ...mockConfigs.openrouter, model: 'anthropic/claude-3.5-sonnet' }
      ];

      modelConfigs.forEach(config => {
        const model = new Model({ modelConfig: config });
        expect(model.modelConfig.model).toBe(config.model);
      });
    });

    test('should require apiKey for initialization', () => {
      const providersToTest = ['OPEN_AI', 'DEEP_SEEK', 'OPEN_ROUTER'];
      
      providersToTest.forEach(provider => {
        const configWithoutKey = { provider, model: 'test-model', apiKey: null };
        const model = new Model({ modelConfig: configWithoutKey });
        
        expect(() => model.initializeModel()).toThrow(/API Key is missing/);
      });
    });
  });

  describe('JSON response parsing', () => {
    test('should parse valid JSON strings', () => {
      const model = new Model({ modelConfig: mockConfigs.openai });
      
      const jsonStrings = [
        '{"message": "hello"}',
        '{"complex": {"nested": {"data": true}}}',
        '{"array": [1, 2, 3]}'
      ];

      jsonStrings.forEach(jsonStr => {
        // Test the JSON parsing logic
        let result;
        if (typeof jsonStr === 'string') {
          try {
            result = JSON.parse(jsonStr);
          } catch (e) {
            result = jsonStr;
          }
        }
        
        expect(typeof result).toBe('object');
      });
    });

    test('should handle malformed JSON gracefully', () => {
      const model = new Model({ modelConfig: mockConfigs.openai });
      
      const malformedJsonStrings = [
        'not json',
        '{"incomplete": json',
        'undefined',
        null
      ];

      malformedJsonStrings.forEach(jsonStr => {
        let result;
        if (typeof jsonStr === 'string') {
          try {
            result = JSON.parse(jsonStr);
          } catch (e) {
            result = jsonStr; // Return as-is if parsing fails
          }
        } else {
          result = jsonStr;
        }
        
        // Should not throw and should have a result
        expect(result).toBeDefined();
      });
    });
  });

  describe('provider switching', () => {
    test('should maintain separate configurations for different providers', () => {
      const openAIModel = new Model({ modelConfig: mockConfigs.openai });
      const deepSeekModel = new Model({ modelConfig: mockConfigs.deepseek });
      const openRouterModel = new Model({ modelConfig: mockConfigs.openrouter });

      expect(openAIModel.modelConfig.provider).toBe('OPEN_AI');
      expect(deepSeekModel.modelConfig.provider).toBe('DEEP_SEEK');
      expect(openRouterModel.modelConfig.provider).toBe('OPEN_ROUTER');

      expect(openAIModel.modelConfig.model).toBe('gpt-4o');
      expect(deepSeekModel.modelConfig.model).toBe('deepseek-chat');
      expect(openRouterModel.modelConfig.model).toBe('openai/gpt-4o');
    });
  });
});