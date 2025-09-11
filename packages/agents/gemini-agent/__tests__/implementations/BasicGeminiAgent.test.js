import { BasicGeminiAgent } from '../../src/implementations/BasicGeminiAgent.js';
import { ResourceManager } from '@legion/resource-manager';

describe('BasicGeminiAgent', () => {
  let agent;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    const config = {
      agent: {
        id: 'test-basic-agent',
        name: 'Test Basic Gemini Agent',
        type: 'conversational',
        version: '1.0.0',
        llm: {
          provider: 'openai',
          model: 'gpt-4'
        }
      }
    };
    agent = new BasicGeminiAgent(config, resourceManager);
  });

  test('should initialize with default config', () => {
    expect(agent).toBeInstanceOf(BasicGeminiAgent);
  });

  test('should process input and return formatted response', async () => {
    const input = 'test input';
    const response = await agent.processInput(input);
    
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('status', 'success');
  });

  test('should handle errors appropriately', async () => {
    // Mock generateResponse to throw error using manual mock
    let errorThrown = false;
    agent.generateResponse = async () => {
      errorThrown = true;
      throw new Error('Test error');
    };

    await expect(agent.processInput('test')).rejects.toThrow('Test error');
    expect(errorThrown).toBe(true);
  });
});
