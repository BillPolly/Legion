/**
 * Simple unit tests for Agent class to verify basic functionality
 */

import { jest } from '@jest/globals';

// Simple test to verify the testing setup works
describe('Agent Simple Tests', () => {
  it('should run a simple test', () => {
    expect(true).toBe(true);
  });

  it('should be able to import Agent class', async () => {
    // Dynamic import to avoid module resolution issues
    const { Agent } = await import('../../src/Agent.js');
    expect(Agent).toBeDefined();
    expect(typeof Agent).toBe('function');
  });

  it('should create an agent instance', async () => {
    const { Agent } = await import('../../src/Agent.js');
    
    const agent = new Agent({
      name: 'TestAgent',
      bio: 'Test bio',
      modelConfig: {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        apiKey: 'test-key'
      },
      tools: []
    });

    expect(agent.name).toBe('TestAgent');
    expect(agent.bio).toBe('Test bio');
  });
});