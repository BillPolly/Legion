/**
 * Unit tests for the message passing system
 * Tests the Actor Model implementation with fire-and-forget messaging
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTask } from '@legion/tasks';
import { createRecursiveDecompositionStrategy } from '../../../src/strategies/recursive/RecursiveDecompositionStrategy.js';
import { createAnalysisStrategy } from '../../../src/strategies/coding/AnalysisStrategy.js';
import { createExecutionStrategy } from '../../../src/strategies/coding/ExecutionStrategy.js';

describe('Message Passing System', () => {
  let mockLlmClient;
  let mockToolRegistry;

  beforeEach(() => {
    mockLlmClient = {
      generateResponse: jest.fn().mockResolvedValue('mock response')
    };

    mockToolRegistry = {
      getTool: jest.fn().mockResolvedValue({
        name: 'mock_tool',
        execute: jest.fn().mockResolvedValue({ success: true })
      })
    };
  });

  describe('Fire-and-Forget Message Pattern', () => {
    it('should have synchronous onMessage handlers that return nothing', async () => {
      const context1 = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const context2 = { llmClient: mockLlmClient };
      const context3 = {};
      
      const strategies = [
        await createRecursiveDecompositionStrategy(context1),
        await createAnalysisStrategy(context2),
        await createExecutionStrategy(context3)
      ];

      strategies.forEach(strategy => {
        // onMessage should be a regular function, not async
        expect(typeof strategy.onMessage).toBe('function');
        expect(strategy.onMessage.constructor.name).toBe('Function');
        expect(strategy.onMessage.constructor.name).not.toBe('AsyncFunction');
      });
    });

    it('should not return values from onMessage handlers', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Test task', null, strategy);
      
      const mockSender = { parent: null };
      const mockMessage = { type: 'start' };
      
      // onMessage should not return anything (fire-and-forget)
      const result = task.onMessage(mockSender, mockMessage);
      expect(result).toBeUndefined();
    });

    it('should handle messages without blocking', async () => {
      const context = {};
      const strategy = await createExecutionStrategy(context);
      const task = createTask('Test task', null, strategy);
      
      const mockSender = { parent: null };
      const messages = [
        { type: 'start' },
        { type: 'work' },
        { type: 'abort' },
        { type: 'unknown' }
      ];
      
      // All message handling should be immediate and non-blocking
      messages.forEach(message => {
        const startTime = Date.now();
        const result = task.onMessage(mockSender, message);
        const endTime = Date.now();
        
        expect(result).toBeUndefined();
        expect(endTime - startTime).toBeLessThan(10); // Should be immediate
      });
    });
  });

  describe('Message Routing and Context', () => {
    it('should properly route messages from parent vs child', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      
      // Mock the send method to capture calls
      parentTask.send = jest.fn();
      
      // Message from child to parent
      const childMessage = { type: 'completed', result: 'success' };
      parentTask.onMessage(childTask, childMessage);
      
      // Should not throw and should handle child message
      expect(() => {
        parentTask.onMessage(childTask, childMessage);
      }).not.toThrow();
      
      // Message from external sender to parent
      const externalSender = { parent: null };
      const parentMessage = { type: 'start' };
      
      expect(() => {
        parentTask.onMessage(externalSender, parentMessage);
      }).not.toThrow();
    });

    it('should use proper context binding in message handlers', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Analysis task', null, strategy);
      
      // Spy on console.log to capture context usage
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Mock required methods and properties
      task.metadata = { classification: undefined };
      task.addConversationEntry = jest.fn();
      task.fail = jest.fn();
      task.send = jest.fn();
      
      const mockSender = { parent: null };
      const mockMessage = { type: 'start' };
      
      // Should use 'this' context properly without throwing
      expect(() => {
        task.onMessage(mockSender, mockMessage);
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Message Types and Handling', () => {
    it('should handle start/work messages in RecursiveDecompositionStrategy', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const task = createTask('Complex task', null, strategy);
      
      // Mock required methods to prevent errors
      task.metadata = {};
      task.addConversationEntry = jest.fn();
      task.fail = jest.fn();
      task.send = jest.fn();
      task.lookup = jest.fn().mockReturnValue(null);
      
      const mockSender = { parent: null };
      
      // Should handle start message
      expect(() => {
        task.onMessage(mockSender, { type: 'start' });
      }).not.toThrow();
      
      // Should handle work message
      expect(() => {
        task.onMessage(mockSender, { type: 'work' });
      }).not.toThrow();
    });

    it('should handle child completion messages', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      
      // Mock required methods
      parentTask.addConversationEntry = jest.fn();
      parentTask.send = jest.fn();
      childTask.deliverGoalOutputs = jest.fn().mockReturnValue([]);
      
      const completionMessage = {
        type: 'completed',
        result: { success: true, message: 'Child completed' }
      };
      
      // Should handle child completion without throwing
      expect(() => {
        parentTask.onMessage(childTask, completionMessage);
      }).not.toThrow();
    });

    it('should handle child failure messages', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      
      // Mock required methods
      parentTask.addConversationEntry = jest.fn();
      parentTask.fail = jest.fn();
      parentTask.send = jest.fn();
      parentTask.getAllArtifacts = jest.fn().mockReturnValue({});
      
      const failureMessage = {
        type: 'failed',
        error: new Error('Child failed')
      };
      
      // Should handle child failure without throwing
      expect(() => {
        parentTask.onMessage(childTask, failureMessage);
      }).not.toThrow();
    });
  });

  describe('Strategy-Specific Message Handling', () => {
    it('should handle AnalysisStrategy messages correctly', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Analysis task', null, strategy);
      
      // Mock required methods
      task.addConversationEntry = jest.fn();
      task.send = jest.fn();
      
      const mockSender = { parent: null };
      
      // Should handle start message
      expect(() => {
        task.onMessage(mockSender, { type: 'start' });
      }).not.toThrow();
      
      // Should handle abort message
      expect(() => {
        task.onMessage(mockSender, { type: 'abort' });
      }).not.toThrow();
      
      // Should handle unknown message gracefully
      expect(() => {
        task.onMessage(mockSender, { type: 'unknown' });
      }).not.toThrow();
    });

    it('should handle ExecutionStrategy messages correctly', async () => {
      const context = {};
      const strategy = await createExecutionStrategy(context);
      const task = createTask('Execution task', null, strategy);
      
      // Mock required methods
      task.addConversationEntry = jest.fn();
      task.send = jest.fn();
      task.getArtifact = jest.fn();
      task.metadata = {};
      
      const mockSender = { parent: null };
      
      // Should handle start/work messages
      expect(() => {
        task.onMessage(mockSender, { type: 'start' });
      }).not.toThrow();
      
      expect(() => {
        task.onMessage(mockSender, { type: 'work' });
      }).not.toThrow();
      
      // Should handle abort message
      expect(() => {
        task.onMessage(mockSender, { type: 'abort' });
      }).not.toThrow();
    });
  });

  describe('Message Flow and Asynchronous Operations', () => {
    it('should initiate async operations without blocking message handler', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Analysis task', null, strategy);
      
      // Mock methods that might be called asynchronously
      task.addConversationEntry = jest.fn();
      task.send = jest.fn();
      task.fail = jest.fn();
      task.lookup = jest.fn().mockReturnValue(mockLlmClient);
      
      const mockSender = { parent: null };
      const mockMessage = { type: 'start' };
      
      const startTime = Date.now();
      const result = task.onMessage(mockSender, mockMessage);
      const endTime = Date.now();
      
      // Message handler should return immediately
      expect(result).toBeUndefined();
      expect(endTime - startTime).toBeLessThan(10);
      
      // Async operations should be initiated but not waited for
      // (The actual async work happens in the background)
    });

    it('should not block on async operations in message handlers', async () => {
      const context = {};
      const strategy = await createExecutionStrategy(context);
      const task = createTask('Execution task', null, strategy);
      
      // Mock methods
      task.send = jest.fn();
      task.getArtifact = jest.fn().mockReturnValue(null);
      task.fail = jest.fn();
      
      const mockSender = { parent: null };
      const mockMessage = { type: 'start' };
      
      // Even if underlying operations are async, message handler should not block
      const result = task.onMessage(mockSender, mockMessage);
      expect(result).toBeUndefined();
    });
  });

  describe('Error Handling in Message Passing', () => {
    it('should handle errors in message processing gracefully', async () => {
      const context = { llmClient: mockLlmClient };
      const strategy = await createAnalysisStrategy(context);
      const task = createTask('Analysis task', null, strategy);
      
      // Mock methods to throw errors
      task.addConversationEntry = jest.fn().mockImplementation(() => {
        throw new Error('Mock error');
      });
      
      const mockSender = { parent: null };
      const mockMessage = { type: 'start' };
      
      // Should not let errors escape the message handler
      expect(() => {
        task.onMessage(mockSender, mockMessage);
      }).not.toThrow();
    });

    it('should handle malformed messages gracefully', async () => {
      const context = { llmClient: mockLlmClient, toolRegistry: mockToolRegistry };
      const strategy = await createRecursiveDecompositionStrategy(context);
      const task = createTask('Test task', null, strategy);
      
      // Mock methods
      task.send = jest.fn();
      
      const mockSender = { parent: null };
      const malformedMessages = [
        null,
        undefined,
        {},
        { type: null },
        { type: undefined },
        { invalidProperty: 'test' }
      ];
      
      malformedMessages.forEach(message => {
        expect(() => {
          task.onMessage(mockSender, message);
        }).not.toThrow();
      });
    });
  });
});