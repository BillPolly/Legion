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
            expect(models.length).toBe(6);
            expect(models[0]).toHaveProperty('id');
            expect(models[0]).toHaveProperty('name');
            expect(models[0]).toHaveProperty('description');
            expect(models[0]).toHaveProperty('contextWindow');
            expect(models[0]).toHaveProperty('maxTokens');
        });

        it('should include specific models', async () => {
            const models = await provider.getAvailableModels();
            const modelIds = models.map(m => m.id);
            expect(modelIds).toContain('quantum-nexus-v7');
            expect(modelIds).toContain('neural-storm-pro');
            expect(modelIds).toContain('cosmic-intellect-x1');
        });
    });

    describe('complete', () => {
        it('should return a mock response', async () => {
            const response = await provider.complete('Test prompt', 'mock-model');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
            expect(response).toContain('Mock LLM response');
        });

        it('should handle quantum-nexus-v7 model', async () => {
            const response = await provider.complete('Test prompt', 'quantum-nexus-v7');
            expect(response).toContain('[Quantum Nexus v7]');
            expect(response).toContain('quantum');
        });

        it('should handle neural-storm-pro model', async () => {
            const response = await provider.complete('Test prompt', 'neural-storm-pro');
            expect(response).toContain('[Neural Storm Pro]');
            expect(response).toContain('neural');
        });

        it('should record interactions', async () => {
            expect(provider.getInteractions()).toHaveLength(0);
            
            await provider.complete('First prompt', 'mock-model');
            await provider.complete('Second prompt', 'mock-model');
            
            const interactions = provider.getInteractions();
            expect(interactions).toHaveLength(2);
            expect(interactions[0].prompt).toBe('First prompt');
            expect(interactions[1].prompt).toBe('Second prompt');
        });
    });

    describe('getProviderName', () => {
        it('should return provider name', () => {
            expect(provider.getProviderName()).toBe('Mock');
        });
    });

    describe('isReady', () => {
        it('should always be ready', () => {
            expect(provider.isReady()).toBe(true);
        });
    });

    describe('clearInteractions', () => {
        it('should clear interaction history', async () => {
            await provider.complete('Test prompt', 'mock-model');
            expect(provider.getInteractions()).toHaveLength(1);
            
            provider.clearInteractions();
            expect(provider.getInteractions()).toHaveLength(0);
        });
    });
});