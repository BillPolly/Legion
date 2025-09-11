import { jest } from '@jest/globals';
import { LLMClient, MaxRetriesExceededError, ValidationError } from '../src/LLMClient.js';
import { MockProvider } from '../src/providers/MockProvider.js';

describe('LLMClient', () => {
    let client;

    beforeEach(() => {
        client = new LLMClient({ provider: 'mock' });
    });

    describe('constructor', () => {
        it('should create client with mock provider', () => {
            expect(client).toBeDefined();
            expect(client.getProviderName()).toBe('mock');
        });

        it('should generate unique client ID', () => {
            const client2 = new LLMClient({ provider: 'mock' });
            expect(client.clientId).toBeDefined();
            expect(client2.clientId).toBeDefined();
            expect(client.clientId).not.toBe(client2.clientId);
        });

        it('should throw error for unknown provider', () => {
            expect(() => new LLMClient({ provider: 'unknown' })).toThrow('Unknown provider: unknown');
        });

        it('should throw error when API key is missing for Anthropic', () => {
            expect(() => new LLMClient({ provider: 'anthropic' })).toThrow('API key is required for Anthropic provider');
        });

        it('should throw error when API key is missing for OpenAI', () => {
            expect(() => new LLMClient({ provider: 'openai' })).toThrow('API key is required for OpenAI provider');
        });
    });

    describe('complete', () => {
        it('should complete a prompt successfully', async () => {
            const response = await client.complete('Hello');
            expect(response).toBeDefined();
            expect(typeof response).toBe('string');
        });

        it('should throw MaxRetriesExceededError when maxRetries is 0', async () => {
            const zeroRetryClient = new LLMClient({ provider: 'mock', maxRetries: 0 });
            await expect(zeroRetryClient.complete('Hello')).rejects.toThrow(MaxRetriesExceededError);
        });
    });

    describe('completeWithValidation', () => {
        it('should return response when validation passes', async () => {
            const validator = (response) => response.includes('Mock');
            const response = await client.completeWithValidation('Hello', validator);
            expect(response).toBeDefined();
        });

        it('should throw ValidationError when validation fails', async () => {
            const validator = () => false; // Always fail
            await expect(client.completeWithValidation('Hello', validator)).rejects.toThrow(ValidationError);
        });
    });

    describe('completeWithJsonValidation', () => {
        it('should fail when response is not JSON', async () => {
            // Mock provider doesn't return JSON, so this should fail
            await expect(client.completeWithJsonValidation('Return JSON'))
                .rejects.toThrow(ValidationError);
        });
    });

    describe('getters', () => {
        it('should return current model', () => {
            expect(client.currentModel).toBe('claude-3-sonnet-20240229');
        });

        it('should return max retries configured', () => {
            expect(client.maxRetriesConfigured).toBe(3);
        });
    });

    describe('updateModel', () => {
        it('should update the model', () => {
            client.updateModel('new-model');
            expect(client.currentModel).toBe('new-model');
        });
    });

    describe('embeddings', () => {
        it('should check if provider supports embeddings', () => {
            expect(client.supportsEmbeddings()).toBe(true);
        });

        it('should generate embeddings successfully with mock provider', async () => {
            const embeddings = await client.generateEmbeddings('test');
            expect(embeddings).toBeDefined();
            expect(Array.isArray(embeddings)).toBe(true);
            expect(embeddings.length).toBe(1);
            expect(Array.isArray(embeddings[0])).toBe(true);
            expect(embeddings[0].length).toBe(1536); // Mock provider returns 1536-dimensional embeddings
        });
    });
});