/**
 * Google Gemini Provider for Legion LLMClient
 *
 * Supports Gemini models via Google Generative AI REST API
 * https://ai.google.dev/api/rest
 */

export class GoogleProvider {
  constructor(apiKey, baseURL = 'https://generativelanguage.googleapis.com/v1beta') {
    if (!apiKey) {
      throw new Error('Google API key is required');
    }
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async getAvailableModels() {
    const response = await fetch(`${this.baseURL}/models?key=${this.apiKey}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    return (data.models || [])
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(model => ({
        id: model.name.replace('models/', ''),
        name: model.displayName,
        description: model.description || '',
        contextWindow: model.inputTokenLimit,
        maxTokens: model.outputTokenLimit
      }));
  }

  async complete(prompt, model, maxTokens = 1000) {
    const messages = [{ role: 'user', content: prompt }];
    return this.completeMessages(messages, model, { maxTokens });
  }

  /**
   * Complete with rich message format
   * Supports text, images, and function calling
   */
  async completeMessages(messages, model, options = {}) {
    const modelId = model.startsWith('models/') ? model : `models/${model}`;
    const url = `${this.baseURL}/${modelId}:generateContent?key=${this.apiKey}`;

    // Convert Legion message format to Gemini format
    const contents = this.convertMessagesToGeminiFormat(messages);

    const requestBody = {
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 1.0,
        topP: options.topP ?? 0.95,
        topK: options.topK ?? 40
      }
    };

    // Add tools if provided (for function calling or computer use)
    if (options.tools) {
      requestBody.tools = options.tools;
    }

    // Add system instruction if provided
    if (options.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemInstruction }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    // Check for safety blocks
    if (data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new Error('Content blocked by safety filters');
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No candidate response from Gemini');
    }

    // Return full response for function calling support
    if (options.returnFullResponse) {
      return data;
    }

    // Extract text content
    const content = candidate.content;
    const textParts = content.parts
      ?.filter(p => p.text)
      ?.map(p => p.text)
      ?.join('\n');

    if (!textParts) {
      throw new Error('No text content in Gemini response');
    }

    return textParts;
  }

  /**
   * Convert Legion/OpenAI message format to Gemini format
   */
  convertMessagesToGeminiFormat(messages) {
    return messages.map(msg => {
      // Handle role conversion: 'assistant' -> 'model', but preserve 'model' if already set
      let role;
      if (msg.role === 'assistant' || msg.role === 'model') {
        role = 'model';
      } else {
        role = 'user';
      }

      // Handle different content types
      let parts = [];

      if (typeof msg.content === 'string') {
        parts = [{ text: msg.content }];
      } else if (Array.isArray(msg.content)) {
        parts = msg.content.map(part => {
          if (part.type === 'text') {
            return { text: part.text };
          } else if (part.type === 'image_url') {
            // Extract base64 data
            const base64Data = part.image_url.url.split(',')[1] || part.image_url.url;
            return {
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            };
          } else if (part.inlineData) {
            return part; // Already in Gemini format
          }
          return part;
        });
      } else if (msg.parts) {
        parts = msg.parts; // Already in Gemini format
      }

      return { role, parts };
    });
  }

  getProviderName() {
    return 'google';
  }

  isReady() {
    return !!this.apiKey;
  }
}
