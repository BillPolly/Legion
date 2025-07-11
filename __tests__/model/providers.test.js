const { OpenAIProvider } = require('../../src/model/providers/open_ai');
const { DeepSeekProvider } = require('../../src/model/providers/deepseek');
const { OpenRouterProvider } = require('../../src/model/providers/openrouter');

// Mock OpenAI SDK
jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn()
            }
        }
    }));
});

const OpenAI = require('openai');

describe('Model Providers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('OpenAIProvider', () => {
        const messages = [
            { role: 'system', content: 'You are helpful' },
            { role: 'user', content: 'Hello' }
        ];

        it('should create OpenAI client with API key', () => {
            new OpenAIProvider({
                apiKey: 'test-api-key',
                model: 'gpt-4'
            });

            expect(OpenAI).toHaveBeenCalledWith({
                apiKey: 'test-api-key'
            });
        });

        it('should send messages and parse response', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: '{"task_completed": true, "response": {"message": "Hi there!"}}'
                    }
                }]
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            OpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            }));

            const provider = new OpenAIProvider({
                apiKey: 'test-api-key',
                model: 'gpt-4'
            });

            const result = await provider.sendAndReceiveResponse(messages);

            expect(mockCreate).toHaveBeenCalledWith({
                messages,
                model: 'gpt-4',
                response_format: {
                    'type': 'json_object'
                }
            });

            expect(result).toEqual({
                task_completed: true,
                response: { message: "Hi there!" }
            });
        });

        it('should handle empty response content', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        content: ''
                    }
                }]
            };

            const mockCreate = jest.fn().mockResolvedValue(mockResponse);
            OpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: mockCreate
                    }
                }
            }));

            const provider = new OpenAIProvider({
                apiKey: 'test-api-key',
                model: 'gpt-4'
            });

            const result = await provider.sendAndReceiveResponse(messages);

            expect(result).toEqual({});
        });
    });
});