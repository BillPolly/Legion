import { Anthropic } from '@anthropic-ai/sdk';

/**
 * Anthropic provider implementation
 */
export class AnthropicProvider {
  constructor(apiKey, baseURL = undefined) {
    this.apiKey = apiKey;
    const clientConfig = { apiKey };
    if (baseURL) {
      clientConfig.baseURL = baseURL;
    }
    this.client = new Anthropic(clientConfig);
  }

  async getAvailableModels() {
    // Anthropic doesn't have a public models API endpoint yet
    // So we return the known available models
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most intelligent model, best for complex tasks',
        contextWindow: 200000,
        maxTokens: 8192
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model, best for simple tasks',
        contextWindow: 200000,
        maxTokens: 8192
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model, best for highly complex tasks',
        contextWindow: 200000,
        maxTokens: 4096
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Balanced model for most tasks',
        contextWindow: 200000,
        maxTokens: 4096
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient for simple tasks',
        contextWindow: 200000,
        maxTokens: 4096
      }
    ];
  }

  async complete(prompt, model, maxTokens = 1000) {
    const response = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    });

    if (!response || !response.content || response.content.length === 0) {
      throw new Error('Empty or invalid response from Anthropic');
    }

    const content = response.content[0];
    if (content && content.type === 'text') {
      return content.text;
    } else {
      throw new Error('Unexpected response content type from Anthropic');
    }
  }

  getProviderName() {
    return 'Anthropic';
  }

  isReady() {
    return !!this.apiKey;
  }
}