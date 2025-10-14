/**
 * Computer Use Agent Tests
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseAgent } from '../src/index.js';

describe('ComputerUseAgent', () => {
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  describe('Initialization', () => {
    test('should require Google provider', async () => {
      // Create agent with options
      const agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        maxTurns: 5,
      });

      // Should throw if not using Google provider
      const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
      if (!googleApiKey) {
        await expect(agent.initialize()).rejects.toThrow('Google provider');
      } else {
        // If key exists, should initialize successfully
        await agent.initialize();
        await agent.cleanup();
      }
    });

    test('should validate options with schema', () => {
      // Valid options should work
      expect(() => {
        new ComputerUseAgent(resourceManager, {
          headless: true,
          width: 1024,
          height: 768,
        });
      }).not.toThrow();

      // Invalid options should throw
      expect(() => {
        new ComputerUseAgent(resourceManager, {
          width: 'invalid', // Should be number
        });
      }).toThrow();
    });

    test('should create session ID and output directory', () => {
      const agent = new ComputerUseAgent(resourceManager, {
        outDir: 'test_output',
      });

      expect(agent.sessionId).toBeDefined();
      expect(agent.outDir).toContain('test_output');
      expect(agent.outDir).toContain(agent.sessionId);
    });
  });

  describe('Options', () => {
    test('should use default options', () => {
      const agent = new ComputerUseAgent(resourceManager);

      expect(agent.options.headless).toBe(false);
      expect(agent.options.width).toBe(1440);
      expect(agent.options.height).toBe(900);
      expect(agent.options.maxTurns).toBe(30);
    });

    test('should override default options', () => {
      const agent = new ComputerUseAgent(resourceManager, {
        headless: true,
        width: 1024,
        maxTurns: 10,
      });

      expect(agent.options.headless).toBe(true);
      expect(agent.options.width).toBe(1024);
      expect(agent.options.maxTurns).toBe(10);
    });
  });
});

describe('Integration Tests (require GOOGLE_API_KEY)', () => {
  let resourceManager;
  let agent;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(() => {
    const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
    if (!googleApiKey) {
      console.warn('Skipping integration tests - GOOGLE_API_KEY not set');
    }
  });

  afterEach(async () => {
    if (agent) {
      await agent.cleanup();
      agent = null;
    }
  });

  test('should initialize browser and execute simple task', async () => {
    const googleApiKey = resourceManager.get('env.GOOGLE_API_KEY');
    if (!googleApiKey) {
      return; // Skip test
    }

    agent = new ComputerUseAgent(resourceManager, {
      headless: true,
      maxTurns: 3,
      startUrl: 'https://example.com',
    });

    await agent.initialize();

    const result = await agent.executeTask('What is the title of this page?');

    expect(result).toBeDefined();
    expect(result.outDir).toBeDefined();
  }, 120000); // 2 minute timeout for LLM calls
});
