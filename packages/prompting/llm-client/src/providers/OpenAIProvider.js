import OpenAI from 'openai';

export class OpenAIProvider {
  constructor(apiKey) {
    this.client = new OpenAI({
      apiKey: apiKey
    });
  }

  async getAvailableModels() {
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

  async complete(prompt, model, maxTokens = 1000) {
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

    const message = completion.choices[0]?.message;
    if (!message) {
      throw new Error('No response message received from OpenAI');
    }

    // Handle tool calls - OpenAI might return tool calls without text content
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCallsText = message.tool_calls.map(tc => 
        `Tool Call: ${tc.function.name}(${tc.function.arguments})`
      ).join('\n');
      
      return message.content || toolCallsText;
    }

    const content = message.content;
    if (!content) {
      throw new Error('No response content received from OpenAI');
    }

    return content;
  }

  async generateEmbeddings(text, model = 'text-embedding-3-small') {
    const input = Array.isArray(text) ? text : [text];
    
    const response = await this.client.embeddings.create({
      model: model,
      input: input,
      encoding_format: 'float'
    });

    return response.data.map(item => item.embedding);
  }

  getProviderName() {
    return 'openai';
  }

  isReady() {
    return !!this.client;
  }

  async generateImage(params) {
    const {
      prompt,
      model = 'dall-e-3',
      n = 1,
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      response_format = 'b64_json',
      user
    } = params;

    const response = await this.client.images.generate({
      model,
      prompt,
      n,
      size,
      quality,
      style,
      response_format,
      user
    });

    return response;
  }
}