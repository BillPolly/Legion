import { LLMProvider, LLMOptions } from '../types';
import { MockLLMProvider } from '../MockLLMProvider';

describe('LLM Provider Types', () => {
  describe('LLMProvider Interface', () => {
    it('should define required methods', () => {
      const provider: LLMProvider = {
        complete: async (prompt: string) => 'response',
        getProviderName: () => 'test',
        getModelName: () => 'test-model'
      };

      expect(provider.complete).toBeDefined();
      expect(provider.getProviderName).toBeDefined();
      expect(provider.getModelName).toBeDefined();
    });

    it('should define optional methods', () => {
      const provider: LLMProvider = {
        complete: async (prompt: string) => 'response',
        completeStructured: async <T>(prompt: string, schema: object) => ({ data: 'structured' } as T),
        getProviderName: () => 'test',
        getModelName: () => 'test-model',
        supportsStructuredOutput: () => true,
        getMaxTokens: () => 4096
      };

      expect(provider.completeStructured).toBeDefined();
      expect(provider.supportsStructuredOutput?.()).toBe(true);
      expect(provider.getMaxTokens?.()).toBe(4096);
    });
  });

  describe('LLMOptions', () => {
    it('should accept all options', () => {
      const options: LLMOptions = {
        maxTokens: 1000,
        temperature: 0.7,
        systemPrompt: 'You are a helpful assistant',
        responseFormat: 'json'
      };

      expect(options.maxTokens).toBe(1000);
      expect(options.temperature).toBe(0.7);
      expect(options.responseFormat).toBe('json');
    });
  });
});