import { LLMClient } from '../../src/index.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '../../../../.env' });

describe('Real API Integration Tests', () => {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Skip tests if no API keys are available
  const skipIfNoKeys = anthropicKey || openaiKey ? describe : describe.skip;

  skipIfNoKeys('Live API Tests', () => {
    describe('Anthropic Provider', () => {
      let client;

      beforeAll(() => {
        if (!anthropicKey) {
          console.log('⚠️  Skipping Anthropic tests - no API key');
          return;
        }
        client = new LLMClient({
          provider: 'anthropic',
          apiKey: anthropicKey,
          model: 'claude-3-haiku-20240307' // Use faster model for testing
        });
      });

      test('completes simple prompt', async () => {
        if (!anthropicKey) return;
        
        const response = await client.complete('Say "Hello from Anthropic!" and nothing else.', 50);
        expect(response).toContain('Hello from Anthropic');
      }, 30000);

      test('gets available models', async () => {
        if (!anthropicKey) return;
        
        const models = await client.getAvailableModels();
        expect(models.length).toBeGreaterThan(0);
        expect(models[0]).toHaveProperty('id');
        expect(models[0]).toHaveProperty('name');
      });

      test('emits interaction events', async () => {
        if (!anthropicKey) return;
        
        const events = [];
        client.on('interaction', (event) => events.push(event));
        
        await client.complete('Test event emission', 50);
        
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events[0].type).toBe('request');
        expect(events.find(e => e.type === 'response')).toBeDefined();
      }, 30000);
    });

    describe('OpenAI Provider', () => {
      let client;

      beforeAll(() => {
        if (!openaiKey) {
          console.log('⚠️  Skipping OpenAI tests - no API key');
          return;
        }
        client = new LLMClient({
          provider: 'openai',
          apiKey: openaiKey,
          model: 'gpt-3.5-turbo' // Use faster model for testing
        });
      });

      test('completes simple prompt', async () => {
        if (!openaiKey) return;
        
        const response = await client.complete('Say "Hello from OpenAI!" and nothing else.', 50);
        expect(response).toContain('Hello from OpenAI');
      }, 30000);

      test('generates embeddings', async () => {
        if (!openaiKey) return;
        
        expect(client.supportsEmbeddings()).toBe(true);
        
        const embeddings = await client.generateEmbeddings(['hello', 'world']);
        expect(embeddings).toHaveLength(2);
        expect(embeddings[0]).toHaveLength(1536); // Default embedding dimension
        expect(typeof embeddings[0][0]).toBe('number');
      }, 30000);

      test('sendAndReceiveResponse compatibility', async () => {
        if (!openaiKey) return;
        
        const messages = [
          { role: 'user', content: 'Say "Compatibility test passed!"' }
        ];
        const response = await client.sendAndReceiveResponse(messages, { max_tokens: 50 });
        expect(response).toContain('Compatibility test passed');
      }, 30000);
    });
  });

  describe('API Key Validation', () => {
    test('throws error for invalid Anthropic API key', async () => {
      const client = new LLMClient({
        provider: 'anthropic',
        apiKey: 'invalid-key'
      });

      await expect(client.complete('test'))
        .rejects.toThrow();
    });

    test('throws error for invalid OpenAI API key', async () => {
      const client = new LLMClient({
        provider: 'openai',
        apiKey: 'invalid-key'
      });

      await expect(client.complete('test'))
        .rejects.toThrow();
    });
  });
});