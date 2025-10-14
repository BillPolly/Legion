import OpenAI from 'openai';

/**
 * ZAI Provider - OpenAI-compatible API for ZAI (GLM models)
 *
 * ZAI provides an OpenAI-compatible API, so we can use the same interface
 * but with a different base URL.
 */
export class ZAIProvider {
  constructor(apiKey, baseURL = 'https://api.z.ai/api/paas/v4') {
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    });
  }

  async getAvailableModels() {
    return [
      {
        id: 'glm-4.6',
        name: 'GLM-4.6',
        description: 'Latest GLM model from ZAI',
        contextWindow: 128000,
        maxTokens: 4096
      },
      {
        id: 'glm-4',
        name: 'GLM-4',
        description: 'GLM-4 base model',
        contextWindow: 128000,
        maxTokens: 4096
      }
    ];
  }

  async complete(prompt, model, maxTokens = 1000) {
    const completion = await this.client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content received from ZAI');
    }

    return content;
  }

  /**
   * Complete with rich message format
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

    const completion = await this.client.chat.completions.create(requestBody);

    const message = completion.choices[0]?.message;
    if (!message) {
      throw new Error('No response message received from ZAI');
    }

    // GLM-4.6 sometimes returns content in reasoning_content field
    const content = message.content || message.reasoning_content || '';

    if (!content || content.trim() === '') {
      // Debug: log what we actually got
      console.error('ZAI empty response. Full message:', JSON.stringify(message, null, 2));
      console.error('Full completion:', JSON.stringify(completion, null, 2));
      throw new Error('No response content received from ZAI (empty response)');
    }

    return content;
  }

  getProviderName() {
    return 'zai';
  }

  isReady() {
    return !!this.client;
  }
}
