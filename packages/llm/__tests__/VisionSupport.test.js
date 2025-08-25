import { LLMClient } from '../src/index.js';

describe('Vision Support', () => {
  let client;

  beforeEach(() => {
    client = new LLMClient({ provider: 'mock' });
  });

  describe('sendAndReceiveResponse with vision', () => {
    test('handles text-only messages normally', async () => {
      const messages = [
        { role: 'user', content: 'Hello, how are you?' }
      ];

      const response = await client.sendAndReceiveResponse(messages);
      expect(response).toContain('Mock LLM response');
      expect(response).toContain('Hello, how are you?');
    });

    test('detects and handles vision messages', async () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe what you see in this image' },
            { 
              type: 'image_url', 
              image_url: { 
                url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==' 
              } 
            }
          ]
        }
      ];

      const response = await client.sendAndReceiveResponse(messages);
      expect(response).toContain('Vision analysis complete');
      expect(response).toContain('I can see 1 image');
      expect(response).toContain('Describe what you see in this image');
    });

    test('handles multiple images in vision messages', async () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Compare these two images' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,image1' } },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,image2' } }
          ]
        }
      ];

      const response = await client.sendAndReceiveResponse(messages);
      expect(response).toContain('Vision analysis complete');
      expect(response).toContain('I can see 2 images');
      expect(response).toContain('Compare these two images');
    });

    test('returns JSON for vision JSON requests', async () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and return JSON with your findings' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,test' } }
          ]
        }
      ];

      const response = await client.sendAndReceiveResponse(messages);
      const parsed = JSON.parse(response);
      expect(parsed).toHaveProperty('message', 'Mock vision analysis result');
      expect(parsed).toHaveProperty('images_analyzed', 1);
      expect(parsed).toHaveProperty('analysis');
      expect(parsed.text_prompt).toContain('Analyze this image and return JSON');
    });

    test('emits vision-specific events', async () => {
      const events = [];
      client.on('interaction', (event) => events.push(event));

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What do you see?' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,test' } }
          ]
        }
      ];

      await client.sendAndReceiveResponse(messages);

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('vision_request');
      expect(events[1].type).toBe('vision_response');
      expect(events[0].messages).toEqual(messages);
    });
  });

  describe('provider vision support', () => {
    test('mock provider supports vision for all models', () => {
      expect(client.provider.supportsVision('any-model')).toBe(true);
      expect(client.provider.completeWithMessages).toBeDefined();
    });

    test('throws error for non-vision providers', async () => {
      // Create a minimal provider without vision support
      class NonVisionProvider {
        async complete(prompt, model, maxTokens) {
          return `Non-vision response: ${prompt}`;
        }
        
        getProviderName() {
          return 'NonVision';
        }
        
        async getAvailableModels() {
          return [{ id: 'text-only', name: 'Text Only Model' }];
        }
        
        isReady() {
          return true;
        }
        
        // No completeWithMessages method - this provider doesn't support vision
      }

      const nonVisionClient = new LLMClient({ provider: 'mock' });
      nonVisionClient.provider = new NonVisionProvider();

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,test' } }
          ]
        }
      ];

      // Test the completeWithVision method directly, which does the validation
      await expect(nonVisionClient.completeWithVision(messages))
        .rejects.toThrow('does not support vision capabilities');
    });
  });

  describe('completeWithVision method', () => {
    test('processes vision messages directly', async () => {
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,test' } }
          ]
        }
      ];

      const response = await client.completeWithVision(messages);
      expect(response).toContain('Vision analysis complete');
    });

    test('validates model vision support', async () => {
      // Test with OpenAI provider that has vision model validation
      const openaiClient = new LLMClient({ 
        provider: 'mock', 
        model: 'gpt-3.5-turbo' // Non-vision model
      });
      
      // Mock the supportsVision method to return false for this model
      openaiClient.provider.supportsVision = (model) => model.includes('vision');

      const messages = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,test' } }
          ]
        }
      ];

      await expect(openaiClient.completeWithVision(messages))
        .rejects.toThrow('does not support vision');
    });
  });
});