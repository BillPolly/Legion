import { MockLLMProvider } from '../MockLLMProvider';

describe('MockLLMProvider', () => {
  let provider: MockLLMProvider;

  beforeEach(() => {
    provider = new MockLLMProvider();
  });

  describe('complete', () => {
    it('should return default response when no patterns match', async () => {
      const response = await provider.complete('random query');
      expect(response).toContain('command');
      expect(response).toContain('unknown');
    });

    it('should return matching response for pattern', async () => {
      provider.addResponse('search for', JSON.stringify({
        intent: {
          command: 'search',
          parameters: { query: 'test' },
          confidence: 0.9
        }
      }));

      const response = await provider.complete('search for something');
      expect(response).toContain('search');
      expect(response).toContain('0.9');
    });

    it('should match patterns in order', async () => {
      provider.addResponse('hello', 'First match');
      provider.addResponse('hello world', 'Second match');

      const response = await provider.complete('hello world');
      expect(response).toBe('First match'); // First pattern matches
    });
  });

  describe('completeStructured', () => {
    it('should parse JSON response', async () => {
      const expected = { command: 'test', params: {} };
      provider.addResponse('test', JSON.stringify(expected));

      const result = await provider.completeStructured<typeof expected>(
        'test command',
        {}
      );
      
      expect(result).toEqual(expected);
    });

    it('should throw on invalid JSON', async () => {
      provider.addResponse('test', 'invalid json');

      await expect(
        provider.completeStructured('test', {})
      ).rejects.toThrow('Failed to parse structured response');
    });
  });

  describe('provider info', () => {
    it('should return provider name', () => {
      expect(provider.getProviderName()).toBe('mock');
    });

    it('should return model name', () => {
      expect(provider.getModelName()).toBe('mock-model');
    });

    it('should support structured output', () => {
      expect(provider.supportsStructuredOutput()).toBe(true);
    });

    it('should return max tokens', () => {
      expect(provider.getMaxTokens()).toBe(4096);
    });
  });

  describe('response management', () => {
    it('should clear responses', () => {
      provider.addResponse('test', 'response');
      provider.clearResponses();

      const response = provider.complete('test');
      expect(response).resolves.toContain('unknown');
    });

    it('should set default response', () => {
      provider.setDefaultResponse('custom default');
      const response = provider.complete('no match');
      expect(response).resolves.toBe('custom default');
    });
  });
});