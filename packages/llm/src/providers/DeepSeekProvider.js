import OpenAI from 'openai';

export class DeepSeekProvider {
    constructor(apiKey) {
        this.client = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: apiKey
        });
    }

    async getAvailableModels() {
        return [
            {
                id: 'deepseek-chat',
                name: 'DeepSeek Chat',
                description: 'General-purpose chat model',
                contextWindow: 32768,
                maxTokens: 4096
            },
            {
                id: 'deepseek-coder',
                name: 'DeepSeek Coder',
                description: 'Specialized model for code generation',
                contextWindow: 16384,
                maxTokens: 4096
            }
        ];
    }

    async complete(prompt, model = 'deepseek-chat', maxTokens = 1000) {
        const completion = await this.client.chat.completions.create({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0.7
        });
        
        const content = completion.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response content received from DeepSeek');
        }
        return content;
    }

    async sendAndReceiveResponse(messages, options = {}) {
        const model = options.model || 'deepseek-chat';
        const response = await this.client.chat.completions.create({
            messages,
            model,
            max_tokens: options.maxTokens || 1000,
            temperature: options.temperature || 0.7,
            ...(options.responseFormat && { response_format: options.responseFormat })
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No response content received from DeepSeek');
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
        return 'deepseek';
    }

    isReady() {
        return !!this.client;
    }
}