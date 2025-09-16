/**
 * Validate the system works without timeouts and with intelligent error handling
 */

import { jest } from '@jest/globals';
import { ROMAOrchestrator } from '../../src/core/ROMAOrchestrator.js';
import { ResourceManager } from '@legion/resource-manager';
import { LLMClient } from '../../../../prompting/llm-client/src/LLMClient.js';

describe('No Timeout and Error Handling Validation', () => {
  let resourceManager;
  let orchestrator;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getResourceManager();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.cleanup();
    }
  });

  test('orchestrator should have no timeout configured', async () => {
    orchestrator = new ROMAOrchestrator({ resourceManager });
    await orchestrator.initialize();
    
    // Verify timeout is set to 0 (NO TIMEOUT)
    expect(orchestrator.timeout).toBe(0);
  });

  test('should execute a simple task without timeout', async () => {
    orchestrator = new ROMAOrchestrator({ resourceManager });
    await orchestrator.initialize();
    
    const progressUpdates = [];
    const progressCallback = (update) => {
      progressUpdates.push(update);
    };
    
    const task = {
      id: 'test-task-1',
      description: 'Create a simple function that adds two numbers',
      depth: 0,
      context: {}
    };
    
    const result = await orchestrator.executeTask(task, {
      sessionId: 'test-session',
      progressCallback,
      maxDepth: 2 // Limit depth for faster test
    });
    
    // Verify task completed
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    
    // Verify we got progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);
    expect(progressUpdates[0].status).toBe('started');
    
    // Verify result has expected properties
    expect(result.output).toBeDefined();
    expect(result.metadata.duration).toBeDefined();
    expect(result.metadata.duration).toBeGreaterThan(0);
  }, 60000); // Test timeout for Jest only - task has NO timeout

  test('LLMClient should fail fast on auth errors', async () => {
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'invalid-key',
      maxRetries: 3
    });
    
    // Mock to simulate auth error
    client.provider.complete = jest.fn().mockRejectedValue({
      status: 401,
      message: 'Invalid API key'
    });
    
    const startTime = Date.now();
    
    try {
      await client.complete('test');
      fail('Should have thrown');
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Should fail immediately, not retry
      expect(duration).toBeLessThan(1000);
      expect(error.status).toBe(401);
      expect(client.provider.complete).toHaveBeenCalledTimes(1);
    }
  });

  test('LLMClient should retry on transient errors', async () => {
    const client = new LLMClient({
      provider: 'anthropic',
      apiKey: 'test-key',
      maxRetries: 3,
      baseDelay: 50 // Short for testing
    });
    
    let callCount = 0;
    client.provider.complete = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.reject({
          code: 'ECONNRESET',
          message: 'socket hang up'
        });
      }
      return Promise.resolve('Success');
    });
    
    const result = await client.complete('test');
    
    expect(result).toBe('Success');
    expect(client.provider.complete).toHaveBeenCalledTimes(2);
  });

  test('progress callbacks should work throughout execution', async () => {
    orchestrator = new ROMAOrchestrator({ resourceManager });
    await orchestrator.initialize();
    
    const progressEvents = [];
    const progressCallback = (update) => {
      progressEvents.push({
        status: update.status,
        timestamp: update.timestamp
      });
    };
    
    const task = {
      id: 'test-progress-task',
      description: 'Write a hello world function',
      depth: 0,
      context: {}
    };
    
    await orchestrator.executeTask(task, {
      sessionId: 'test-progress-session',
      progressCallback,
      maxDepth: 1 // Single level for speed
    });
    
    // Verify we got multiple progress events
    expect(progressEvents.length).toBeGreaterThan(0);
    
    // Should have at least started event
    const startedEvent = progressEvents.find(e => e.status === 'started');
    expect(startedEvent).toBeDefined();
    
    // All events should have timestamps
    progressEvents.forEach(event => {
      expect(event.timestamp).toBeDefined();
    });
  }, 60000);
});