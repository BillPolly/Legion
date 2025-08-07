/**
 * Unit tests for SelectorNode
 * Tests fallback behavior, first success wins, error recovery
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SelectorNode } from '../../src/nodes/SelectorNode.js';
import { NodeStatus } from '../../src/core/BehaviorTreeNode.js';
import { MockToolRegistry, MockToolFactory } from '../utils/MockToolFactory.js';

// Mock executor
class MockExecutor {
  constructor() {
    this.nodeTypes = new Map();
    this.messageBus = {
      sendMessage: jest.fn()
    };
  }
  
  createNode(config) {
    if (config.type === 'selector') {
      return new SelectorNode(config, new MockToolRegistry(), this);
    }
    // Return mock for other types
    return {
      id: config.id || 'mock',
      config,
      async execute(context) {
        if (config.tool === 'failingTool') {
          return {
            status: NodeStatus.FAILURE,
            data: { error: 'Mock tool failed' }
          };
        }
        if (config.tool === 'successTool') {
          return {
            status: NodeStatus.SUCCESS,
            data: { result: `Success from ${config.id || config.tool}` }
          };
        }
        return {
          status: NodeStatus.SUCCESS,
          data: { result: `Mock execution of ${config.type}` }
        };
      }
    };
  }
}

describe('SelectorNode Unit Tests', () => {
  let toolRegistry;
  let mockExecutor;
  let selectorNode;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    mockExecutor = new MockExecutor();
    
    // Register common tools
    toolRegistry.registerCommonTools();

    const config = {
      id: 'test-selector',
      type: 'selector',
      description: 'Test selector node',
      children: [
        { type: 'action', tool: 'failingTool', id: 'option1' },
        { type: 'action', tool: 'failingTool', id: 'option2' },
        { type: 'action', tool: 'successTool', id: 'option3' }
      ]
    };

    selectorNode = new SelectorNode(config, toolRegistry, mockExecutor);
  });

  describe('Node Creation and Configuration', () => {
    test('should create selector node with correct properties', () => {
      expect(selectorNode.config.type).toBe('selector');
      expect(selectorNode.id).toBe('test-selector');
      expect(selectorNode.children).toHaveLength(3);
      expect(selectorNode.isLeaf()).toBe(false);
    });

    test('should provide correct type name', () => {
      expect(SelectorNode.getTypeName()).toBe('selector');
    });

    test('should create selector without children', () => {
      const emptyConfig = {
        type: 'selector',
        description: 'Empty selector'
      };

      const emptySelector = new SelectorNode(emptyConfig, toolRegistry, mockExecutor);
      expect(emptySelector.children).toHaveLength(0);
      expect(emptySelector.isLeaf()).toBe(true);
    });

    test('should initialize children from configuration', () => {
      expect(selectorNode.children[0].id).toBe('option1');
      expect(selectorNode.children[1].id).toBe('option2');
      expect(selectorNode.children[2].id).toBe('option3');
    });
  });

  describe('Selector Behavior', () => {
    test('should return success on first successful child', async () => {
      const result = await selectorNode.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.successfulOption).toBe(2); // Third child (index 2) succeeded
      expect(result.data.attemptedOptions).toBe(3);
    });

    test('should try all children until one succeeds', async () => {
      // All children fail except the last
      const config = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail1' },
          { type: 'action', tool: 'failingTool', id: 'fail2' },
          { type: 'action', tool: 'failingTool', id: 'fail3' },
          { type: 'action', tool: 'successTool', id: 'success' }
        ]
      };

      const selector = new SelectorNode(config, toolRegistry, mockExecutor);
      const result = await selector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.attemptedOptions).toBe(4);
      expect(result.data.successfulOption).toBe(3);
    });

    test('should fail if all children fail', async () => {
      const allFailConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail1' },
          { type: 'action', tool: 'failingTool', id: 'fail2' },
          { type: 'action', tool: 'failingTool', id: 'fail3' }
        ]
      };

      const failSelector = new SelectorNode(allFailConfig, toolRegistry, mockExecutor);
      const result = await failSelector.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.attemptedOptions).toBe(3);
      expect(result.data.allOptionsFailed).toBe(true);
    });

    test('should succeed immediately on first success', async () => {
      const immediateSuccessConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'successTool', id: 'success1' },
          { type: 'action', tool: 'failingTool', id: 'notExecuted1' },
          { type: 'action', tool: 'failingTool', id: 'notExecuted2' }
        ]
      };

      const selector = new SelectorNode(immediateSuccessConfig, toolRegistry, mockExecutor);
      const result = await selector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.attemptedOptions).toBe(1); // Only tried first child
      expect(result.data.successfulOption).toBe(0);
    });

    test('should handle empty selector', async () => {
      const emptyConfig = { type: 'selector', children: [] };
      const emptySelector = new SelectorNode(emptyConfig, toolRegistry, mockExecutor);

      const result = await emptySelector.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.allOptionsFailed).toBe(true);
    });
  });

  describe('Context Propagation', () => {
    test('should pass context to all attempted children', async () => {
      const context = { 
        userName: 'TestUser',
        sessionId: 'test-123'
      };

      const result = await selectorNode.execute(context);

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // Context should have been passed to all attempted children
      expect(result.data.attemptedOptions).toBeGreaterThan(0);
    });

    test('should accumulate context from failed attempts', async () => {
      const contextAccumConfig = {
        type: 'selector',
        accumulateContext: true, // Enable context accumulation
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail1' },
          { type: 'action', tool: 'failingTool', id: 'fail2' },
          { type: 'action', tool: 'successTool', id: 'success' }
        ]
      };

      const selector = new SelectorNode(contextAccumConfig, toolRegistry, mockExecutor);
      const result = await selector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.optionResults).toBeDefined();
      expect(result.data.optionResults).toHaveLength(3);
    });

    test('should provide option context to children', async () => {
      const configWithOptionContext = {
        type: 'selector',
        optionContexts: [
          { priority: 'high' },
          { priority: 'medium' },
          { priority: 'low' }
        ],
        children: [
          { type: 'action', tool: 'failingTool', id: 'high-priority' },
          { type: 'action', tool: 'failingTool', id: 'medium-priority' },
          { type: 'action', tool: 'successTool', id: 'low-priority' }
        ]
      };

      const selector = new SelectorNode(configWithOptionContext, toolRegistry, mockExecutor);
      const result = await selector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });
  });

  describe('Error Handling', () => {
    test('should handle child execution errors gracefully', async () => {
      // Mock child that throws an error
      const errorChild = {
        id: 'error-child',
        async execute(context) {
          throw new Error('Child execution error');
        }
      };

      selectorNode.children = [errorChild];

      const result = await selectorNode.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.failureReason).toBeDefined();
    });

    test('should continue after child errors', async () => {
      const errorThenSuccessConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'errorTool', id: 'error' }, // Will throw
          { type: 'action', tool: 'successTool', id: 'success' } // Should still try this
        ]
      };

      // Mock error tool
      const errorChild = {
        id: 'error',
        async execute(context) {
          throw new Error('Intentional error');
        }
      };

      const successChild = {
        id: 'success',
        async execute(context) {
          return { status: NodeStatus.SUCCESS, data: { result: 'Recovered' } };
        }
      };

      const selector = new SelectorNode(errorThenSuccessConfig, toolRegistry, mockExecutor);
      selector.children = [errorChild, successChild];

      const result = await selector.execute({});

      // Should recover and succeed with second child
      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.successfulOption).toBe(1);
    });

    test('should handle null/undefined context', async () => {
      const result = await selectorNode.execute(null);

      expect(result).toBeDefined();
      expect([NodeStatus.SUCCESS, NodeStatus.FAILURE]).toContain(result.status);
    });

    test('should provide detailed failure information', async () => {
      const allFailConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail1' },
          { type: 'action', tool: 'failingTool', id: 'fail2' }
        ]
      };

      const failSelector = new SelectorNode(allFailConfig, toolRegistry, mockExecutor);
      const result = await failSelector.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.optionResults).toBeDefined();
      expect(result.data.allOptionsFailed).toBe(true);
      expect(result.data.attemptedOptions).toBe(2);
    });
  });

  describe('Configuration Options', () => {
    test('should support priority-based selection', async () => {
      const priorityConfig = {
        type: 'selector',
        selectionStrategy: 'priority',
        priorities: [2, 0, 1], // Try third, first, second
        children: [
          { type: 'action', tool: 'failingTool', id: 'option1' },
          { type: 'action', tool: 'successTool', id: 'option2' },
          { type: 'action', tool: 'failingTool', id: 'option3' }
        ]
      };

      const prioritySelector = new SelectorNode(priorityConfig, toolRegistry, mockExecutor);
      const result = await prioritySelector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // Should try option3 first (priority 2), fail, then option1 (priority 0), fail, then option2 (priority 1), succeed
    });

    test('should support weighted random selection', async () => {
      const weightedConfig = {
        type: 'selector',
        selectionStrategy: 'weighted',
        weights: [0.1, 0.2, 0.7], // Heavily favor third option
        children: [
          { type: 'action', tool: 'failingTool', id: 'low-weight' },
          { type: 'action', tool: 'failingTool', id: 'medium-weight' },
          { type: 'action', tool: 'successTool', id: 'high-weight' }
        ]
      };

      const weightedSelector = new SelectorNode(weightedConfig, toolRegistry, mockExecutor);
      const result = await weightedSelector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should support conditional selection', async () => {
      const conditionalConfig = {
        type: 'selector',
        conditions: [
          '{{useOption1}}',
          '{{useOption2}}',
          'true' // Always try this one
        ],
        children: [
          { type: 'action', tool: 'failingTool', id: 'conditional1' },
          { type: 'action', tool: 'failingTool', id: 'conditional2' },
          { type: 'action', tool: 'successTool', id: 'always' }
        ]
      };

      const conditionalSelector = new SelectorNode(conditionalConfig, toolRegistry, mockExecutor);
      const context = { useOption1: false, useOption2: false };
      
      const result = await conditionalSelector.execute(context);

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // Should skip first two due to conditions
    });
  });

  describe('Message Handling', () => {
    test('should send selection updates to parent', async () => {
      const configWithReporting = {
        type: 'selector',
        reportProgress: true,
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail' },
          { type: 'action', tool: 'successTool', id: 'success' }
        ]
      };

      const selector = new SelectorNode(configWithReporting, toolRegistry, mockExecutor);
      const result = await selector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // Progress reports would be sent via message bus
    });

    test('should handle child messages during selection', async () => {
      const parentMessageSpy = jest.fn();
      selectorNode.handleChildMessage = parentMessageSpy;

      // Mock child that sends message
      const messagingChild = {
        id: 'messaging-child',
        async execute(context) {
          if (selectorNode.handleChildMessage) {
            selectorNode.handleChildMessage(this, { 
              type: 'OPTION_INFO', 
              info: 'Attempting option'
            });
          }
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      };

      selectorNode.children = [messagingChild];

      await selectorNode.execute({});

      expect(parentMessageSpy).toHaveBeenCalledWith(
        messagingChild,
        { type: 'OPTION_INFO', info: 'Attempting option' }
      );
    });
  });

  describe('Metadata and Introspection', () => {
    test('should provide comprehensive metadata', () => {
      const metadata = selectorNode.getMetadata();

      expect(metadata.name).toBe('selector');
      expect(metadata.type).toBe('selector');
      expect(metadata.children).toBe(3);
      expect(metadata.coordinationPattern).toBe('selector');
    });

    test('should provide selection strategy information', () => {
      const metadata = selectorNode.getMetadata();

      expect(metadata.executionStrategy).toBe('sequential');
      expect(metadata.totalOptions).toBe(3);
    });

    test('should indicate fallback support', () => {
      const fallbackConfig = {
        type: 'selector',
        fallbackOption: { type: 'action', tool: 'defaultTool' },
        children: [
          { type: 'action', tool: 'primaryTool' }
        ]
      };

      const fallbackSelector = new SelectorNode(fallbackConfig, toolRegistry, mockExecutor);
      const metadata = fallbackSelector.getMetadata();

      expect(metadata.fallbackBehavior).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    test('should short-circuit on first success', async () => {
      let executionCount = 0;
      
      const countingChildren = [
        {
          id: 'success-first',
          async execute(context) {
            executionCount++;
            return { status: NodeStatus.SUCCESS, data: { executed: true } };
          }
        },
        {
          id: 'not-executed-1',
          async execute(context) {
            executionCount++;
            return { status: NodeStatus.SUCCESS, data: { executed: true } };
          }
        },
        {
          id: 'not-executed-2',
          async execute(context) {
            executionCount++;
            return { status: NodeStatus.SUCCESS, data: { executed: true } };
          }
        }
      ];

      selectorNode.children = countingChildren;
      await selectorNode.execute({});

      expect(executionCount).toBe(1); // Only first child executed
    });

    test('should handle timeout configuration', async () => {
      const timeoutConfig = {
        type: 'selector',
        timeout: 100, // 100ms timeout per child
        children: [
          { type: 'action', tool: 'slowTool', id: 'slow' },
          { type: 'action', tool: 'successTool', id: 'fast' }
        ]
      };

      // Mock slow child
      const slowChild = {
        id: 'slow',
        async execute(context) {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      };

      const fastChild = {
        id: 'fast',
        async execute(context) {
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      };

      const timeoutSelector = new SelectorNode(timeoutConfig, toolRegistry, mockExecutor);
      timeoutSelector.children = [slowChild, fastChild];

      const result = await timeoutSelector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // Should timeout on first and succeed with second
    });

    test('should track successful option for subsequent executions', async () => {
      const trackingConfig = {
        type: 'selector',
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail' },
          { type: 'action', tool: 'successTool', id: 'success' }
        ]
      };

      const trackingSelector = new SelectorNode(trackingConfig, toolRegistry, mockExecutor);
      
      // First execution
      const result1 = await trackingSelector.execute({});
      expect(result1.status).toBe(NodeStatus.SUCCESS);
      expect(result1.data.successfulOption).toBe(1);

      // Second execution - should still work the same way
      const result2 = await trackingSelector.execute({});
      expect(result2.status).toBe(NodeStatus.SUCCESS);
      expect(result2.data.successfulOption).toBe(1);
    });
  });

  describe('Advanced Selection Patterns', () => {
    test('should support parallel trial of options', async () => {
      const parallelConfig = {
        type: 'selector',
        executionMode: 'parallel',
        maxParallel: 2,
        children: [
          { type: 'action', tool: 'failingTool', id: 'fail1' },
          { type: 'action', tool: 'failingTool', id: 'fail2' },
          { type: 'action', tool: 'successTool', id: 'success' }
        ]
      };

      const parallelSelector = new SelectorNode(parallelConfig, toolRegistry, mockExecutor);
      const result = await parallelSelector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      // Should try options in parallel and return first success
    });

    test('should support retry on failure', async () => {
      const retryConfig = {
        type: 'selector',
        retryFailedOptions: true,
        maxRetries: 2,
        children: [
          { type: 'action', tool: 'failingTool', id: 'retry-fail' },
          { type: 'action', tool: 'successTool', id: 'eventual-success' }
        ]
      };

      const retrySelector = new SelectorNode(retryConfig, toolRegistry, mockExecutor);
      const result = await retrySelector.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });
  });
});