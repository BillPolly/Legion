/**
 * Tests for PlannerEngine core functionality
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlannerEngine, PlanningRequest } from '../../src/core/PlannerEngine.js';
import { PlanningStrategy } from '../../src/strategies/PlanningStrategy.js';

// Mock strategy for testing
class MockStrategy extends PlanningStrategy {
  constructor(options = {}) {
    super({ name: 'MockStrategy', ...options });
    this.generateBTMock = options.generateBTMock || this.defaultGenerateBT;
  }

  async generateBT(request, context = {}) {
    return this.generateBTMock(request, context);
  }

  defaultGenerateBT(request, context) {
    return {
      type: 'sequence',
      id: 'mock_root',
      description: `Mock BT for: ${request.description}`,
      children: [
        {
          type: 'action',
          id: 'mock_action',
          tool: 'mockTool',
          description: 'Mock action',
          params: { input: 'test' }
        }
      ]
    };
  }
}

describe('PlannerEngine', () => {
  let engine;
  let mockStrategy;

  beforeEach(() => {
    engine = new PlannerEngine({ debugMode: false });
    mockStrategy = new MockStrategy();
  });

  describe('Strategy management', () => {
    test('should register and retrieve strategies', () => {
      engine.registerStrategy('mock', mockStrategy);
      
      expect(engine.listStrategies()).toContain('mock');
      expect(engine.getStrategy('mock')).toBe(mockStrategy);
    });

    test('should throw error for non-existent strategy', () => {
      expect(() => engine.getStrategy('nonexistent')).toThrow('Strategy \'nonexistent\' not found');
    });

    test('should validate strategy interface', () => {
      const badStrategy = { name: 'bad' }; // Missing generateBT method
      
      expect(() => engine.registerStrategy('bad', badStrategy))
        .toThrow('Strategy \'bad\' must implement generateBT method');
    });
  });

  describe('Plan creation', () => {
    beforeEach(() => {
      engine.registerStrategy('mock', mockStrategy);
    });

    test('should create valid BT plan', async () => {
      const request = new PlanningRequest({
        description: 'Test planning request',
        allowableActions: [
          { 
            type: 'mockTool', 
            name: 'mockTool',
            description: 'Mock tool for testing',
            getMetadata: () => ({ name: 'mockTool', input: {}, output: {} })
          }
        ]
      });

      const result = await engine.createPlan(request, 'mock');
      
      expect(result).toBeDefined();
      expect(result.bt).toBeDefined();
      expect(result.bt.type).toBe('sequence');
      expect(result.bt.id).toBe('mock_root');
      expect(result.strategy).toBe('mock');
      expect(result.isValid()).toBe(true);
    });

    test('should validate planning request', async () => {
      const invalidRequest = new PlanningRequest({
        // Missing description and allowableActions
      });

      await expect(engine.createPlan(invalidRequest, 'mock'))
        .rejects.toThrow('Planning request must have a description');
    });

    test('should handle strategy generation errors', async () => {
      const failingStrategy = new MockStrategy({
        generateBTMock: () => { throw new Error('Strategy failed'); }
      });
      
      engine.registerStrategy('failing', failingStrategy);
      
      const request = new PlanningRequest({
        description: 'Test request',
        allowableActions: [{ 
          type: 'test', 
          name: 'test',
          description: 'test',
          getMetadata: () => ({ name: 'test', input: {}, output: {} })
        }]
      });

      await expect(engine.createPlan(request, 'failing'))
        .rejects.toThrow('Failed to generate valid BT plan');
    });

    test('should retry on failure', async () => {
      let attempts = 0;
      const retryStrategy = new MockStrategy({
        generateBTMock: (request, context) => {
          attempts++;
          if (attempts < 2) {
            throw new Error('First attempt fails');
          }
          return mockStrategy.defaultGenerateBT(request, context);
        }
      });
      
      engine.registerStrategy('retry', retryStrategy);
      engine.maxRetries = 2;
      
      const request = new PlanningRequest({
        description: 'Retry test',
        allowableActions: [{ 
          type: 'mockTool', 
          name: 'mockTool',
          description: 'test',
          getMetadata: () => ({ name: 'mockTool', input: {}, output: {} })
        }]
      });

      const result = await engine.createPlan(request, 'retry');
      
      expect(attempts).toBe(2);
      expect(result.isValid()).toBe(true);
      expect(result.metadata.retries).toBe(1);
    });
  });

  describe('Multiple plans', () => {
    beforeEach(() => {
      engine.registerStrategy('mock1', new MockStrategy({ name: 'Mock1' }));
      engine.registerStrategy('mock2', new MockStrategy({ name: 'Mock2' }));
    });

    test('should create multiple plans', async () => {
      const request = new PlanningRequest({
        description: 'Multi-strategy test',
        allowableActions: [{ 
          type: 'mockTool', 
          name: 'mockTool',
          description: 'test',
          getMetadata: () => ({ name: 'mockTool', input: {}, output: {} })
        }]
      });

      const results = await engine.createMultiplePlans(request, ['mock1', 'mock2']);
      
      expect(results).toHaveLength(2);
      expect(results[0].isValid()).toBe(true);
      expect(results[1].isValid()).toBe(true);
      expect(results[0].strategy).toBe('mock1');
      expect(results[1].strategy).toBe('mock2');
    });

    test('should handle partial failures in multiple plans', async () => {
      const failingStrategy = new MockStrategy({
        generateBTMock: () => { throw new Error('Strategy fails'); }
      });
      
      engine.registerStrategy('failing', failingStrategy);
      
      const request = new PlanningRequest({
        description: 'Partial failure test',
        allowableActions: [{ 
          type: 'mockTool', 
          name: 'mockTool',
          description: 'test',
          getMetadata: () => ({ name: 'mockTool', input: {}, output: {} })
        }]
      });

      const results = await engine.createMultiplePlans(request, ['mock1', 'failing']);
      
      expect(results).toHaveLength(2);
      expect(results[0].isValid()).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('Strategy fails');
    });
  });

  describe('Statistics', () => {
    test('should provide engine statistics', () => {
      engine.registerStrategy('test', mockStrategy);
      
      const stats = engine.getStats();
      
      expect(stats.registeredStrategies).toContain('test');
      expect(stats.strategyCount).toBe(1);
      expect(stats.maxRetries).toBeDefined();
      expect(stats.debugMode).toBeDefined();
    });
  });

  describe('BT node counting', () => {
    test('should count nodes in BT structure', () => {
      const bt = {
        type: 'sequence',
        id: 'root',
        children: [
          { type: 'action', id: 'action1', tool: 'tool1' },
          {
            type: 'sequence',
            id: 'sub',
            children: [
              { type: 'action', id: 'action2', tool: 'tool2' }
            ]
          }
        ]
      };

      const count = engine.countBTNodes(bt);
      expect(count).toBe(4); // root + action1 + sub + action2
    });

    test('should count retry node structure', () => {
      const bt = {
        type: 'retry',
        id: 'retry_root',
        child: {
          type: 'action',
          id: 'action',
          tool: 'tool'
        }
      };

      const count = engine.countBTNodes(bt);
      expect(count).toBe(2); // retry + action
    });
  });
});