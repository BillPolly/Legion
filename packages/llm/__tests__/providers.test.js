import { jest } from '@jest/globals';
import { MockProvider } from '../src/providers/MockProvider.js';

describe('Provider sendAndReceiveResponse Tests', () => {
  describe('MockProvider', () => {
    it('should implement sendAndReceiveResponse method', async () => {
      const provider = new MockProvider();
      
      const messages = [{ role: 'user', content: 'test prompt' }];
      const response = await provider.sendAndReceiveResponse(messages);
      
      expect(typeof response).toBe('string');
      expect(response).toContain('test prompt');
    });

    it('should handle JSON response format', async () => {
      const provider = new MockProvider();
      
      const messages = [{ role: 'user', content: 'test' }];
      const response = await provider.sendAndReceiveResponse(messages, {
        responseFormat: { type: 'json_object' }
      });
      
      expect(typeof response).toBe('object');
      expect(response).toHaveProperty('message');
    });

    it('should use the last user message', async () => {
      const provider = new MockProvider();
      
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'first message' },
        { role: 'assistant', content: 'response' },
        { role: 'user', content: 'second message' }
      ];
      
      const response = await provider.sendAndReceiveResponse(messages);
      
      expect(response).toContain('second message');
    });

    it('should handle empty messages', async () => {
      const provider = new MockProvider();
      
      const messages = [];
      const response = await provider.sendAndReceiveResponse(messages);
      
      expect(typeof response).toBe('string');
    });
  });

  describe('Provider Interface', () => {
    it('all providers should have required methods', () => {
      const provider = new MockProvider();
      
      // Check that all required methods exist
      expect(typeof provider.complete).toBe('function');
      expect(typeof provider.sendAndReceiveResponse).toBe('function');
      expect(typeof provider.getProviderName).toBe('function');
      expect(typeof provider.isReady).toBe('function');
      expect(typeof provider.getAvailableModels).toBe('function');
    });
  });
});