import { MockProvider } from '../../src/providers/MockProvider.js';

describe('MockProvider', () => {
    let provider;

    beforeEach(() => {
        provider = new MockProvider();
    });

    describe('getAvailableModels', () => {
        it('should return available models', async () => {
            const models = await provider.getAvailableModels();
            expect(Array.isArray(models)).toBe(true);
            expect(models.length).toBe(2);
            expect(models[0]).toHaveProperty('id');
            expect(models[0]).toHaveProperty('name');
            expect(models[0]).toHaveProperty('description');
            expect(models[0]).toHaveProperty('contextWindow');
            expect(models[0]).toHaveProperty('maxTokens');
        });

        it('should include expected model IDs', async () => {
            const models = await provider.getAvailableModels();
            const modelIds = models.map(m => m.id);
            expect(modelIds).toContain('mock-model-1');
            expect(modelIds).toContain('mock-model-2');
        });
    });

    describe('complete', () => {
        it('should return a mock response', async () => {
            const response = await provider.complete('Test prompt', 'mock-model');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response).toContain('Mock response for');
            expect(response).toContain('This is a mock response');
        });

        it('should cycle through different responses', async () => {
            const response1 = await provider.complete('First', 'mock-model');
            const response2 = await provider.complete('Second', 'mock-model');
            const response3 = await provider.complete('Third', 'mock-model');
            
            // Should get different responses as it cycles through
            expect(response1).not.toBe(response2);
            expect(response2).not.toBe(response3);
            expect(response1).toContain('This is a mock response');
            expect(response2).toContain('Here is another sample');
            expect(response3).toContain('Mock provider returning');
        });

        it('should include prompt in response', async () => {
            const response = await provider.complete('Special prompt text', 'mock-model');
            expect(response).toContain('Special prompt text');
        });
    });

    describe('getProviderName', () => {
        it('should return provider name', () => {
            expect(provider.getProviderName()).toBe('mock');
        });
    });

    describe('isReady', () => {
        it('should always be ready', () => {
            expect(provider.isReady()).toBe(true);
        });
    });

    describe('mock response management', () => {
        it('should allow setting custom responses', () => {
            const customResponses = ['Custom response 1', 'Custom response 2'];
            provider.setMockResponses(customResponses);
            
            expect(provider.responses).toEqual(customResponses);
            expect(provider.responseIndex).toBe(0);
        });

        it('should reset response index', () => {
            provider.responseIndex = 5;
            provider.resetResponseIndex();
            expect(provider.responseIndex).toBe(0);
        });
    });
});