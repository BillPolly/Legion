const { Model } = require('../../src/model');
const { ModelType } = require('../../src/model/types');

// Mock the providers
jest.mock('../../src/model/providers/open_ai', () => ({
    OpenAIProvider: jest.fn().mockImplementation(() => ({
        sendAndReceiveResponse: jest.fn()
    })),
    openAIStreamAndGetResponse: jest.fn()
}));
jest.mock('../../src/model/providers/deepseek', () => ({
    DeepSeekProvider: jest.fn().mockImplementation(() => ({
        sendAndReceiveResponse: jest.fn()
    })),
    deepSeekStreamAndGetResponse: jest.fn()
}));
jest.mock('../../src/model/providers/openrouter', () => ({
    OpenRouterProvider: jest.fn().mockImplementation(() => ({
        sendAndReceiveResponse: jest.fn()
    })),
    openRouterStreamAndGetResponse: jest.fn()
}));

const { openAIStreamAndGetResponse } = require('../../src/model/providers/open_ai');
const { deepSeekStreamAndGetResponse } = require('../../src/model/providers/deepseek');
const { openRouterStreamAndGetResponse } = require('../../src/model/providers/openrouter');

describe('Model', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OPENAI_API_KEY;
        delete process.env.DEEPSEEK_API_KEY;
        delete process.env.OPENROUTER_API_KEY;
    });

    describe('constructor', () => {
        it('should initialize with provided model config', () => {
            const modelConfig = {
                model: 'gpt-4',
                temperature: 0.7,
                provider: ModelType.openai
            };

            const model = new Model({ modelConfig });

            expect(model.modelConfig).toEqual(modelConfig);
        });

        it('should not throw error if empty modelConfig is provided', () => {
            // The Model constructor doesn't actually validate modelConfig presence
            expect(() => new Model({ modelConfig: {} })).not.toThrow();
        });
    });

    describe('initializeModel', () => {
        it('should initialize OpenAI provider with API key', () => {
            const model = new Model({
                modelConfig: {
                    provider: 'OPEN_AI',
                    model: 'gpt-4',
                    apiKey: 'test-key'
                }
            });

            model.initializeModel();

            expect(model.openAiProvider).toBeDefined();
        });

        it('should throw error if OpenAI API key is not set', () => {
            const model = new Model({
                modelConfig: {
                    provider: 'OPEN_AI',
                    model: 'gpt-4'
                }
            });

            expect(() => model.initializeModel()).toThrow('OpenAI API Key is missing!');
        });

        it('should initialize DeepSeek provider with API key', () => {
            const model = new Model({
                modelConfig: {
                    provider: 'DEEP_SEEK',
                    model: 'deepseek-chat',
                    apiKey: 'deepseek-key'
                }
            });

            model.initializeModel();

            expect(model.deepSeekProvider).toBeDefined();
        });

        it('should initialize OpenRouter provider with API key', () => {
            const model = new Model({
                modelConfig: {
                    provider: 'OPEN_ROUTER',
                    model: 'meta-llama/llama-3.1-8b-instruct:free',
                    apiKey: 'openrouter-key'
                }
            });

            model.initializeModel();

            expect(model.openRouterProvider).toBeDefined();
        });
    });

    describe('sendAndReceiveResponse', () => {
        const mockMessages = [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'Hello' }
        ];

        it('should call OpenAI provider for OpenAI model', async () => {
            const mockResponse = { result: 'OpenAI response' };
            const mockSendAndReceive = jest.fn().mockResolvedValue(mockResponse);
            
            const model = new Model({
                modelConfig: {
                    provider: 'OPEN_AI',
                    model: 'gpt-4',
                    temperature: 0.7,
                    apiKey: 'test-key'
                }
            });
            model.initializeModel();
            model.openAiProvider.sendAndReceiveResponse = mockSendAndReceive;

            const response = await model.sendAndReceiveResponse(mockMessages);

            expect(mockSendAndReceive).toHaveBeenCalledWith(mockMessages);
            expect(response).toBe(mockResponse);
        });

        it('should call DeepSeek provider for DeepSeek model', async () => {
            const mockResponse = { result: 'DeepSeek response' };
            const mockSendAndReceive = jest.fn().mockResolvedValue(mockResponse);

            const model = new Model({
                modelConfig: {
                    provider: 'DEEP_SEEK',
                    model: 'deepseek-chat',
                    temperature: 0.5,
                    apiKey: 'deepseek-key'
                }
            });
            model.initializeModel();
            model.deepSeekProvider.sendAndReceiveResponse = mockSendAndReceive;

            const response = await model.sendAndReceiveResponse(mockMessages);

            expect(mockSendAndReceive).toHaveBeenCalledWith(mockMessages);
            expect(response).toBe(mockResponse);
        });

        it('should call OpenRouter provider for OpenRouter model', async () => {
            const mockResponse = { result: 'OpenRouter response' };
            const mockSendAndReceive = jest.fn().mockResolvedValue(mockResponse);

            const model = new Model({
                modelConfig: {
                    provider: 'OPEN_ROUTER',
                    model: 'meta-llama/llama-3.1-8b-instruct:free',
                    temperature: 0.8,
                    apiKey: 'openrouter-key'
                }
            });
            model.initializeModel();
            model.openRouterProvider.sendAndReceiveResponse = mockSendAndReceive;

            const response = await model.sendAndReceiveResponse(mockMessages);

            expect(mockSendAndReceive).toHaveBeenCalledWith(mockMessages);
            expect(response).toBe(mockResponse);
        });

        it('should return undefined for unsupported provider', async () => {
            const model = new Model({
                modelConfig: {
                    provider: 'unsupported-provider',
                    model: 'some-model'
                }
            });

            const response = await model.sendAndReceiveResponse(mockMessages);
            expect(response).toBeUndefined();
        });
    });
});