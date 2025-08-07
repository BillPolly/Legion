/**
 * Basic tests for PlannerEngine without validation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { PlannerEngine, PlanningRequest } from '../../src/core/PlannerEngine.js';
import { PlanningStrategy } from '../../src/strategies/PlanningStrategy.js';

// Mock strategy for testing
class MockStrategy extends PlanningStrategy {
  async generateBT(request, context = {}) {
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

// Mock validator that always passes
class MockValidator {
  async validate(bt, tools = [], context = {}) {
    return {
      valid: true,
      errors: [],
      warnings: []
    };
  }
}

describe('PlannerEngine (Basic)', () => {
  let engine;
  let mockStrategy;

  beforeEach(() => {
    // Create engine with mock validator
    engine = new PlannerEngine({ 
      debugMode: false,
      validator: new MockValidator()
    });
    mockStrategy = new MockStrategy();
  });

  test('should register and retrieve strategies', () => {
    engine.registerStrategy('mock', mockStrategy);
    
    expect(engine.listStrategies()).toContain('mock');
    expect(engine.getStrategy('mock')).toBe(mockStrategy);
  });

  test('should create valid BT plan', async () => {
    engine.registerStrategy('mock', mockStrategy);
    
    const request = new PlanningRequest({
      description: 'Test planning request',
      allowableActions: [
        { type: 'mockTool', description: 'Mock tool for testing' }
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

  test('should handle strategy errors', async () => {
    const failingStrategy = new MockStrategy();
    failingStrategy.generateBT = () => { throw new Error('Strategy failed'); };
    
    engine.registerStrategy('failing', failingStrategy);
    
    const request = new PlanningRequest({
      description: 'Test request',
      allowableActions: [{ type: 'test', description: 'test' }]
    });

    await expect(engine.createPlan(request, 'failing'))
      .rejects.toThrow('Failed to generate valid BT plan');
  });

  test('should provide engine statistics', () => {
    engine.registerStrategy('test', mockStrategy);
    
    const stats = engine.getStats();
    
    expect(stats.registeredStrategies).toContain('test');
    expect(stats.strategyCount).toBe(1);
    expect(stats.maxRetries).toBeDefined();
  });

  test('should count BT nodes', () => {
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
});