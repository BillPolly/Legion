import { MockProvider } from '../src/providers/MockProvider.js';

describe('MockProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('basic functionality', () => {
    test('returns provider name', () => {
      expect(provider.getProviderName()).toBe('Mock');
    });

    test('is ready', () => {
      expect(provider.isReady()).toBe(true);
    });

    test('gets available models', async () => {
      const models = await provider.getAvailableModels();
      expect(models).toHaveLength(6);
      expect(models[0]).toEqual({
        id: 'quantum-nexus-v7',
        name: 'Quantum Nexus v7',
        description: 'Ultra-advanced quantum reasoning model',
        contextWindow: 1000000,
        maxTokens: 10000
      });
    });
  });

  describe('completion responses', () => {
    test('generates model-specific responses', async () => {
      const response = await provider.complete('test prompt', 'quantum-nexus-v7');
      expect(response).toContain('[Quantum Nexus v7]');
      expect(response).toContain('test prompt');
    });

    test('generates default response for unknown model', async () => {
      const response = await provider.complete('test prompt', 'unknown-model');
      expect(response).toContain('Mock LLM response');
      expect(response).toContain('test prompt');
      expect(response).toContain('unknown-model');
    });
  });

  describe('JSON response detection', () => {
    test('detects JSON request keywords', () => {
      expect(provider.detectJsonRequest('Return a JSON object')).toBe(true);
      expect(provider.detectJsonRequest('Give me json format')).toBe(true);
      expect(provider.detectJsonRequest('respond with JSON')).toBe(true);
      expect(provider.detectJsonRequest('as json please')).toBe(true);
      expect(provider.detectJsonRequest('return object with data')).toBe(true);
      expect(provider.detectJsonRequest('Just return some text')).toBe(false);
    });

    test('returns JSON for name and age request', async () => {
      const response = await provider.complete('Return a JSON object with name and age', 'test-model');
      const parsed = JSON.parse(response);
      expect(parsed).toHaveProperty('name', 'Mock User');
      expect(parsed).toHaveProperty('age', 25);
      expect(parsed).toHaveProperty('model', 'test-model');
      expect(parsed).toHaveProperty('timestamp');
    });

    test('returns JSON array for array request', async () => {
      const response = await provider.complete('Give me a JSON array of items', 'test-model');
      const parsed = JSON.parse(response);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toEqual({ id: 1, value: 'Mock Item 1' });
    });

    test('returns status JSON for status request', async () => {
      const response = await provider.complete('Return JSON with status and result', 'test-model');
      const parsed = JSON.parse(response);
      expect(parsed).toHaveProperty('status', 'success');
      expect(parsed).toHaveProperty('result', 'Mock operation completed');
      expect(parsed).toHaveProperty('model', 'test-model');
    });

    test('returns default JSON for generic JSON request', async () => {
      const response = await provider.complete('Return JSON format data', 'test-model');
      const parsed = JSON.parse(response);
      expect(parsed).toHaveProperty('message', 'Mock JSON response');
      expect(parsed).toHaveProperty('model', 'test-model');
      expect(parsed).toHaveProperty('success', true);
    });
  });

  describe('interaction tracking', () => {
    test('records interactions', async () => {
      await provider.complete('test prompt 1', 'model1');
      await provider.complete('test prompt 2', 'model2');

      const interactions = provider.getInteractions();
      expect(interactions).toHaveLength(2);
      expect(interactions[0].prompt).toBe('test prompt 1');
      expect(interactions[1].prompt).toBe('test prompt 2');
    });

    test('clears interactions', async () => {
      await provider.complete('test prompt', 'model');
      expect(provider.getInteractions()).toHaveLength(1);
      
      provider.clearInteractions();
      expect(provider.getInteractions()).toHaveLength(0);
    });
  });
});