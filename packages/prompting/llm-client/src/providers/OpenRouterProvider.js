import OpenAI from 'openai';

export class OpenRouterProvider {
    constructor(apiKey) {
        this.client = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: apiKey,
            defaultHeaders: {
                'HTTP-Referer': 'https://github.com/jsenvoy',
                'X-Title': 'jsEnvoy'
            }
        });
    }

    async getAvailableModels() {
        // OpenRouter supports many models, here are some popular ones
        return [
            {
                id: 'anthropic/claude-3-opus',
                name: 'Claude 3 Opus',
                description: 'Most capable Claude model',
                contextWindow: 200000,
                maxTokens: 4096
            },
            {
                id: 'anthropic/claude-3-sonnet',
                name: 'Claude 3 Sonnet',
                description: 'Balanced Claude model',
                contextWindow: 200000,
                maxTokens: 4096
            },
            {
                id: 'openai/gpt-4-turbo',
                name: 'GPT-4 Turbo',
                description: 'Latest GPT-4 model via OpenRouter',
                contextWindow: 128000,
                maxTokens: 4096
            },
            {
                id: 'google/gemini-pro',
                name: 'Gemini Pro',
                description: 'Google\'s Gemini model',
                contextWindow: 32768,
                maxTokens: 2048
            },
            {
                id: 'meta-llama/llama-3-70b-instruct',
                name: 'Llama 3 70B',
                description: 'Meta\'s Llama 3 model',
                contextWindow: 8192,
                maxTokens: 2048
            }
        ];
    }

    async complete(prompt, model = 'anthropic/claude-3-sonnet', maxTokens = 1000) {
        const completion = await this.client.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.7
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response content received from OpenRouter');
        }
        return content;
    }

    /**
     * Complete with rich message format and tool support
     */
    async completeMessages(messages, model, options = {}) {
        const requestBody = {
            model,
            messages: messages,
            max_tokens: options.maxTokens || 1000
        };

        // Add supported parameters
        if (options.temperature !== undefined) requestBody.temperature = options.temperature;
        if (options.topP !== undefined) requestBody.top_p = options.topP;
        if (options.frequencyPenalty !== undefined) requestBody.frequency_penalty = options.frequencyPenalty;
        if (options.presencePenalty !== undefined) requestBody.presence_penalty = options.presencePenalty;
        
        // Add tools if provided
        if (options.tools && Array.isArray(options.tools)) {
            requestBody.tools = options.tools;
            if (options.toolChoice) requestBody.tool_choice = options.toolChoice;
        }

        const completion = await this.client.chat.completions.create(requestBody);

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response content received from OpenRouter');
        }

        return content;
    }

    async sendAndReceiveResponse(messages, options = {}) {
        const model = options.model || 'anthropic/claude-3-sonnet';
        const response = await this.client.chat.completions.create({
            messages,
            model,
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            ...(options.responseFormat && { response_format: options.responseFormat })
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response content received from OpenRouter');
        }

        // If response format is JSON, parse it
        if (options.responseFormat?.type === 'json_object') {
            try {
                return JSON.parse(content);
            } catch (e) {
                throw new Error(`Failed to parse JSON response: ${e.message}`);
            }
        }

        return content;
    }

    getProviderName() {
        return 'openrouter';
    }

    isReady() {
        return !!this.client;
    }
}