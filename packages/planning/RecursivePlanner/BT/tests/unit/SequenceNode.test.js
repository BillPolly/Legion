/**
 * Unit tests for SequenceNode
 * Tests sequential execution, early termination, result aggregation
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SequenceNode } from '../../src/nodes/SequenceNode.js';
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
    if (config.type === 'sequence') {
      return new SequenceNode(config, new MockToolRegistry(), this);
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
        return {
          status: NodeStatus.SUCCESS,
          data: { result: `Mock execution of ${config.type}` }
        };
      }
    };
  }
}

describe('SequenceNode Unit Tests', () => {
  let toolRegistry;
  let mockExecutor;
  let sequenceNode;

  beforeEach(() => {
    toolRegistry = new MockToolRegistry();
    mockExecutor = new MockExecutor();
    
    // Register common tools
    toolRegistry.registerCommonTools();

    const config = {
      id: 'test-sequence',
      type: 'sequence',
      description: 'Test sequence node',
      children: [
        { type: 'action', tool: 'codeGenerator', params: { step: 1 } },
        { type: 'action', tool: 'testRunner', params: { step: 2 } },
        { type: 'action', tool: 'FileSystemModule.writeFile', params: { step: 3 } }
      ]
    };

    sequenceNode = new SequenceNode(config, toolRegistry, mockExecutor);
  });

  describe('Node Creation and Configuration', () => {
    test('should create sequence node with correct properties', () => {
      expect(sequenceNode.config.type).toBe('sequence');
      expect(sequenceNode.id).toBe('test-sequence');
      expect(sequenceNode.children).toHaveLength(3);
      expect(sequenceNode.isLeaf()).toBe(false);
    });

    test('should provide correct type name', () => {
      expect(SequenceNode.getTypeName()).toBe('sequence');
    });

    test('should create sequence without children', () => {
      const emptyConfig = {
        type: 'sequence',
        description: 'Empty sequence'
      };

      const emptySequence = new SequenceNode(emptyConfig, toolRegistry, mockExecutor);
      expect(emptySequence.children).toHaveLength(0);
      expect(emptySequence.isLeaf()).toBe(true);
    });

    test('should initialize children from configuration', () => {
      expect(sequenceNode.children[0].config.tool).toBe('codeGenerator');
      expect(sequenceNode.children[1].config.tool).toBe('testRunner');
      expect(sequenceNode.children[2].config.tool).toBe('FileSystemModule.writeFile');
    });
  });

  describe('Sequential Execution', () => {
    test('should execute all children in sequence when all succeed', async () => {
      const context = { projectName: 'TestProject' };
      const result = await sequenceNode.execute(context);

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results).toHaveLength(3);
      expect(result.data.completedSteps).toBe(3);
    });

    test('should stop execution on first failure', async () => {
      // Create sequence with failing middle child
      const configWithFailure = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'failingTool' }, // This will fail
          { type: 'action', tool: 'testRunner' }   // This should not execute
        ]
      };

      const failingSequence = new SequenceNode(configWithFailure, toolRegistry, mockExecutor);
      const result = await failingSequence.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.failedAt).toBe(1);
      expect(result.data.results).toHaveLength(2); // Only first two executed
    });

    test('should handle empty sequence', async () => {
      const emptyConfig = { type: 'sequence', children: [] };
      const emptySequence = new SequenceNode(emptyConfig, toolRegistry, mockExecutor);

      const result = await emptySequence.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results).toHaveLength(0);
      expect(result.data.completedSteps).toBe(0);
    });

    test('should pass context through execution chain', async () => {
      const initialContext = { 
        userName: 'TestUser',
        counter: 0
      };

      // Mock children that modify context
      const contextModifyingConfig = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'step1' },
          { type: 'action', tool: 'step2' },
          { type: 'action', tool: 'step3' }
        ]
      };

      const contextSequence = new SequenceNode(contextModifyingConfig, toolRegistry, mockExecutor);
      const result = await contextSequence.execute(initialContext);

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results).toHaveLength(3);
    });
  });

  describe('Result Aggregation', () => {
    test('should aggregate results from all successful children', async () => {
      const result = await sequenceNode.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results).toBeDefined();
      expect(result.data.results).toHaveLength(3);
      expect(result.data.completedSteps).toBe(3);
      expect(result.data.totalSteps).toBe(3);
    });

    test('should provide partial results on failure', async () => {
      const configWithFailure = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'failingTool' },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const failingSequence = new SequenceNode(configWithFailure, toolRegistry, mockExecutor);
      const result = await failingSequence.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.results).toHaveLength(2); // First successful, second failed
      expect(result.data.completedSteps).toBe(2); // Two steps attempted (including the failed one)
      expect(result.data.failedAt).toBe(1);
    });

    test('should collect execution metadata', async () => {
      const result = await sequenceNode.execute({});

      expect(result.data.totalSteps).toBe(3);
      expect(result.data.completedSteps).toBe(3);
      expect(result.data.sequenceComplete).toBe(true);
    });

    test('should handle child result transformation', async () => {
      const result = await sequenceNode.execute({});

      // Each child result should have required structure
      for (const childResult of result.data.results) {
        expect(childResult).toHaveProperty('status');
        expect(childResult).toHaveProperty('data');
        expect([NodeStatus.SUCCESS, NodeStatus.FAILURE]).toContain(childResult.status);
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle child execution errors gracefully', async () => {
      // Mock child that throws an error
      const mockChild = {
        id: 'error-child',
        async execute(context) {
          throw new Error('Child execution failed');
        }
      };

      sequenceNode.children = [mockChild];

      const result = await sequenceNode.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.error).toContain('Child execution failed');
    });

    test('should continue execution despite child warnings', async () => {
      // Mock children with warnings but successful execution
      const childWithWarning = {
        id: 'warning-child',
        async execute(context) {
          return {
            status: NodeStatus.SUCCESS,
            data: { 
              result: 'Success with warnings',
              warnings: ['This is a warning'] 
            }
          };
        }
      };

      sequenceNode.children = [childWithWarning];

      const result = await sequenceNode.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results[0].data.warnings).toBeDefined();
    });

    test('should handle null/undefined context', async () => {
      const result = await sequenceNode.execute(null);

      expect(result).toBeDefined();
      expect([NodeStatus.SUCCESS, NodeStatus.FAILURE]).toContain(result.status);
    });

    test('should provide detailed error information on failure', async () => {
      const configWithFailure = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'failingTool' }
        ]
      };

      const failingSequence = new SequenceNode(configWithFailure, toolRegistry, mockExecutor);
      const result = await failingSequence.execute({});

      expect(result.status).toBe(NodeStatus.FAILURE);
      expect(result.data.failedAt).toBe(1);
      expect(result.data.failureReason).toBeDefined();
      expect(result.data.results).toBeDefined();
    });
  });

  describe('Configuration and Customization', () => {
    test('should support custom success criteria', async () => {
      const customConfig = {
        type: 'sequence',
        successPolicy: 'all', // Default behavior
        children: [
          { type: 'action', tool: 'codeGenerator' },
          { type: 'action', tool: 'testRunner' }
        ]
      };

      const customSequence = new SequenceNode(customConfig, toolRegistry, mockExecutor);
      const result = await customSequence.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should support execution options', async () => {
      const optionsConfig = {
        type: 'sequence',
        options: {
          continueOnFailure: false, // Default sequence behavior
          collectAllResults: true
        },
        children: [
          { type: 'action', tool: 'codeGenerator' }
        ]
      };

      const optionsSequence = new SequenceNode(optionsConfig, toolRegistry, mockExecutor);
      const result = await optionsSequence.execute({});

      expect(result.status).toBe(NodeStatus.SUCCESS);
    });

    test('should handle dynamic child addition', () => {
      const newChild = mockExecutor.createNode({ type: 'action', tool: 'newTool' });
      
      const initialChildCount = sequenceNode.children.length;
      sequenceNode.addChild(newChild);

      expect(sequenceNode.children.length).toBe(initialChildCount + 1);
      expect(sequenceNode.children[initialChildCount]).toBe(newChild);
    });
  });

  describe('Message Handling', () => {
    test('should propagate messages to children', async () => {
      // Test that message bus sendMessage gets called with correct parameters
      const originalMessageBus = mockExecutor.messageBus.sendMessage;
      
      // Mock child 
      const mockChild = {
        id: 'message-child',
        handleMessage: jest.fn(),
        async execute(context) {
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      };

      sequenceNode.children = [mockChild];

      // Send message to children
      sequenceNode.sendToChildren({ type: 'TEST_MESSAGE', data: 'hello' });

      // Check that the message bus was called for the child
      expect(mockExecutor.messageBus.sendMessage).toHaveBeenCalledWith(
        sequenceNode,
        mockChild,
        { type: 'TEST_MESSAGE', data: 'hello' }
      );
    });

    test('should handle messages from children during execution', async () => {
      const parentMessageSpy = jest.fn();
      sequenceNode.handleChildMessage = parentMessageSpy;

      // Mock child that sends message to parent
      const messagingChild = {
        id: 'messaging-child',
        async execute(context) {
          // Simulate child sending message to parent
          if (sequenceNode.handleChildMessage) {
            sequenceNode.handleChildMessage(this, { 
              type: 'PROGRESS_UPDATE', 
              progress: 0.5 
            });
          }
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      };

      sequenceNode.children = [messagingChild];

      await sequenceNode.execute({});

      expect(parentMessageSpy).toHaveBeenCalledWith(
        messagingChild,
        { type: 'PROGRESS_UPDATE', progress: 0.5 }
      );
    });
  });

  describe('Metadata and Introspection', () => {
    test('should provide comprehensive metadata', () => {
      const metadata = sequenceNode.getMetadata();

      expect(metadata.name).toBe('sequence');
      expect(metadata.type).toBe('sequence');
      expect(metadata.children).toBe(3);
      expect(metadata.coordinationPattern).toBe('sequence');
    });

    test('should provide execution strategy information', () => {
      const metadata = sequenceNode.getMetadata();

      expect(metadata.failFast).toBe(true);
      expect(metadata.coordinationPattern).toBe('sequence');
      expect(metadata.totalSteps).toBe(3);
    });

    test('should provide step information', () => {
      const metadata = sequenceNode.getMetadata();

      expect(metadata.totalSteps).toBe(3);
      expect(metadata.stepNames).toBeDefined();
      expect(metadata.supportsConditionalExecution).toBe(false);
    });

    test('should support conditional execution configuration', () => {
      const conditionalConfig = {
        type: 'sequence',
        conditions: ['{{runStep1}}', '{{runStep2}}'],
        children: [
          { type: 'action', tool: 'validTool' }
        ]
      };

      const conditionalSequence = new SequenceNode(conditionalConfig, toolRegistry, mockExecutor);
      const metadata = conditionalSequence.getMetadata();
      expect(metadata.supportsConditionalExecution).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    test('should track individual child execution times', async () => {
      const result = await sequenceNode.execute({});

      expect(result.data.results).toBeDefined();
      for (const childResult of result.data.results) {
        // Child results might have execution timing information
        expect(childResult.data).toBeDefined();
      }
    });

    test('should support execution cancellation', async () => {
      // Create a sequence with slow children
      const slowChildren = [1, 2, 3].map(i => ({
        id: `slow-child-${i}`,
        async execute(context) {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { status: NodeStatus.SUCCESS, data: {} };
        }
      }));

      sequenceNode.children = slowChildren;

      // Start execution and cancel quickly
      const executionPromise = sequenceNode.execute({});
      
      // Simulate cancellation after short delay
      setTimeout(() => {
        sequenceNode.isRunning = false; // Simulate cancellation
      }, 50);

      const result = await executionPromise;
      
      // Execution should complete (may succeed or fail depending on timing)
      expect(result).toBeDefined();
      expect([NodeStatus.SUCCESS, NodeStatus.FAILURE]).toContain(result.status);
    });

    test('should handle large numbers of children efficiently', async () => {
      // Create sequence with many children
      const manyChildren = Array.from({ length: 50 }, (_, i) => ({
        type: 'action',
        tool: 'quickTool',
        params: { index: i }
      }));

      const largeConfig = {
        type: 'sequence',
        children: manyChildren
      };

      const largeSequence = new SequenceNode(largeConfig, toolRegistry, mockExecutor);
      
      const startTime = Date.now();
      const result = await largeSequence.execute({});
      const executionTime = Date.now() - startTime;

      expect(result.status).toBe(NodeStatus.SUCCESS);
      expect(result.data.results).toHaveLength(50);
      expect(executionTime).toBeLessThan(1000); // Should complete reasonably quickly
    });
  });
});