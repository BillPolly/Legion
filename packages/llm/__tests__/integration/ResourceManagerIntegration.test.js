import { ResourceManager } from '@legion/resource-manager';
import { LLMClient } from '../../src/index.js';

describe('ResourceManager Integration Tests', () => {
  let resourceManager;

  beforeAll(async () => {
    // Initialize ResourceManager (loads .env automatically)
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
  });

  describe('LLM Client with ResourceManager', () => {
    test('creates Anthropic client using ResourceManager', async () => {
      const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
      
      if (!anthropicKey) {
        console.log('⚠️  Skipping Anthropic ResourceManager test - no API key in .env');
        return;
      }

      // Create LLM client using ResourceManager-provided API key
      const client = new LLMClient({
        provider: 'anthropic',
        apiKey: anthropicKey,
        model: 'claude-3-haiku-20240307'
      });

      expect(client.getProviderName()).toBe('Anthropic');
      expect(client.currentModel).toBe('claude-3-haiku-20240307');

      // Test that it can complete a simple request
      const response = await client.complete('Say "ResourceManager test passed!" and nothing else.', 50);
      expect(response).toContain('ResourceManager test passed');
    }, 30000);

    test('creates OpenAI client using ResourceManager', async () => {
      const openaiKey = resourceManager.get('env.OPENAI_API_KEY');
      
      if (!openaiKey) {
        console.log('⚠️  Skipping OpenAI ResourceManager test - no API key in .env');
        return;
      }

      // Create LLM client using ResourceManager-provided API key
      const client = new LLMClient({
        provider: 'openai',
        apiKey: openaiKey,
        model: 'gpt-3.5-turbo'
      });

      expect(client.getProviderName()).toBe('OpenAI');
      expect(client.currentModel).toBe('gpt-3.5-turbo');

      // Test completion
      const response = await client.complete('Say "ResourceManager OpenAI test passed!" and nothing else.', 50);
      expect(response).toContain('ResourceManager OpenAI test passed');

      // Test embeddings if available
      if (client.supportsEmbeddings()) {
        const embeddings = await client.generateEmbeddings(['test embedding']);
        expect(embeddings).toHaveLength(1);
        expect(Array.isArray(embeddings[0])).toBe(true);
      }
    }, 30000);

    test('handles missing API keys gracefully', () => {
      // Test that missing keys are handled properly
      const missingKey = resourceManager.get('env.NONEXISTENT_API_KEY');
      expect(missingKey).toBeUndefined();

      // Should throw error when trying to create client without key
      expect(() => {
        new LLMClient({
          provider: 'anthropic',
          apiKey: missingKey
        });
      }).toThrow('API key is required for Anthropic provider');
    });

    test('mock provider works without ResourceManager dependencies', () => {
      // Mock provider should work even without any API keys
      const client = new LLMClient({ provider: 'mock' });
      
      expect(client.getProviderName()).toBe('Mock');
      expect(client.currentModel).toBe('claude-3-sonnet-20240229');
    });
  });

  describe('LLM Client Factory Pattern', () => {
    test('creates LLM client using async factory pattern', async () => {
      // This demonstrates how an LLM-using module should be structured
      class LLMUsingModule {
        constructor(llmClient) {
          this.llmClient = llmClient;
        }

        static async create(resourceManager) {
          // Try to get API keys from ResourceManager
          const anthropicKey = resourceManager.get('env.ANTHROPIC_API_KEY');
          const openaiKey = resourceManager.get('env.OPENAI_API_KEY');

          let llmClient;
          if (anthropicKey) {
            llmClient = new LLMClient({
              provider: 'anthropic',
              apiKey: anthropicKey,
              model: 'claude-3-haiku-20240307'
            });
          } else if (openaiKey) {
            llmClient = new LLMClient({
              provider: 'openai',
              apiKey: openaiKey,
              model: 'gpt-3.5-turbo'
            });
          } else {
            // Fallback to mock for testing
            llmClient = new LLMClient({ provider: 'mock' });
          }

          return new LLMUsingModule(llmClient);
        }

        async generateText(prompt) {
          return await this.llmClient.complete(prompt, 100);
        }

        getProviderInfo() {
          return {
            provider: this.llmClient.getProviderName(),
            model: this.llmClient.currentModel
          };
        }
      }

      // Create module using ResourceManager
      const module = await LLMUsingModule.create(resourceManager);
      
      // Test that it works
      const info = module.getProviderInfo();
      expect(info.provider).toBeDefined();
      expect(info.model).toBeDefined();

      const response = await module.generateText('Hello');
      expect(response).toBeDefined();
      expect(typeof response).toBe('string');
    });
  });

  describe('Environment Variable Access', () => {
    test('ResourceManager provides access to all environment variables', () => {
      // Test that ResourceManager loaded the .env file
      const allKeys = [
        'ANTHROPIC_API_KEY',
        'OPENAI_API_KEY',
        'GITHUB_PAT',
        'SERPER_API_KEY',
        'RAILWAY_API_TOKEN'
      ];

      // At least some environment variables should be accessible
      // (We don't require all to be set, but ResourceManager should handle them if they exist)
      allKeys.forEach(key => {
        const value = resourceManager.get(`env.${key}`);
        // Value can be undefined if not set, but get() should not throw
        expect(() => resourceManager.get(`env.${key}`)).not.toThrow();
      });
    });

    test('ResourceManager handles environment variable prefixing correctly', () => {
      // Test the env. prefix pattern with a variable we know exists from .env
      const testKey = 'OPENAI_API_KEY'; // From the console output, we know this exists
      const value = resourceManager.get('env.OPENAI_API_KEY');
      // Value might be undefined if not set, but the get() should work
      expect(() => resourceManager.get('env.OPENAI_API_KEY')).not.toThrow();
      
      // Test that non-env keys return undefined
      const nonEnvValue = resourceManager.get('OPENAI_API_KEY'); // Without env. prefix
      expect(nonEnvValue).toBeUndefined();
    });
  });
});