import OpenAI from 'openai';
import { ILLMProvider, LLMModel } from './ILLMProvider';

export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async getAvailableModels(): Promise<LLMModel[]> {
    return [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Most capable GPT-4 model',
        contextWindow: 8192,
        maxTokens: 4096
      },
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo',
        description: 'Latest GPT-4 Turbo model',
        contextWindow: 128000,
        maxTokens: 4096
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and capable model for most tasks',
        contextWindow: 16385,
        maxTokens: 4096
      },
      {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
        description: 'Smaller, efficient embedding model',
        contextWindow: 8191
      },
      {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        description: 'Most capable embedding model',
        contextWindow: 8191
      },
      {
        id: 'text-embedding-ada-002',
        name: 'Text Embedding Ada 002',
        description: 'Previous generation embedding model',
        contextWindow: 8191
      }
    ];
  }

  async complete(prompt: string, model: string, maxTokens: number = 1000): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content received from OpenAI');
    }

    return content;
  }

  async generateEmbeddings(text: string | string[], model: string = 'text-embedding-3-small'): Promise<number[][]> {
    const input = Array.isArray(text) ? text : [text];
    
    const response = await this.client.embeddings.create({
      model: model,
      input: input,
      encoding_format: 'float'
    });

    return response.data.map(item => item.embedding);
  }

  getProviderName(): string {
    return 'openai';
  }

  isReady(): boolean {
    return !!this.client;
  }
}