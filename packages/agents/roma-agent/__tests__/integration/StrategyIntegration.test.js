/**
 * Integration tests for strategy communication
 * Tests end-to-end message flow between strategies
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTask } from '@legion/tasks';
import { createRecursiveDecompositionStrategy } from '../../src/strategies/recursive/RecursiveDecompositionStrategy.js';
import { createAnalysisStrategy } from '../../src/strategies/coding/AnalysisStrategy.js';
import { createExecutionStrategy } from '../../src/strategies/coding/ExecutionStrategy.js';

describe('Strategy Communication Integration', () => {
  let mockLlmClient;
  let mockToolRegistry;

  beforeEach(() => {
    mockLlmClient = {
      generateResponse: jest.fn()
    };

    mockToolRegistry = {
      getTool: jest.fn()
    };
  });

  describe('Parent-Child Task Communication', () => {
    it('should create parent-child task hierarchy and handle completion messages', (done) => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      
      // Verify hierarchy setup
      expect(childTask.parent).toBe(parentTask);
      expect(parentTask.parent).toBeNull();
      
      // Mock parent's send method to capture child messages
      const parentSendSpy = jest.fn();
      parentTask.send = parentSendSpy;
      
      // Mock child completion methods
      childTask.deliverGoalOutputs = jest.fn().mockReturnValue(['artifact1', 'artifact2']);
      parentTask.addArtifact = jest.fn();
      parentTask.addConversationEntry = jest.fn();
      
      // Child sends completion message to parent
      const completionMessage = {
        type: 'completed',
        result: { success: true, message: 'Child completed successfully' }
      };
      
      // This should not throw and should handle the message properly
      expect(() => {
        parentTask.onMessage(childTask, completionMessage);
      }).not.toThrow();
      
      // Parent should have processed the child completion immediately (synchronous part)
      expect(childTask.deliverGoalOutputs).toHaveBeenCalledWith(parentTask);
      
      // Wait for async operations to complete
      setTimeout(() => {
        expect(parentTask.addConversationEntry).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should handle child failure messages correctly', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      
      // Mock parent methods
      parentTask.addConversationEntry = jest.fn();
      parentTask.fail = jest.fn();
      parentTask.send = jest.fn();
      parentTask.getAllArtifacts = jest.fn().mockReturnValue({});
      
      // Child sends failure message to parent
      const failureMessage = {
        type: 'failed',
        error: new Error('Child task failed')
      };
      
      // This should not throw and should handle the failure properly
      expect(() => {
        parentTask.onMessage(childTask, failureMessage);
      }).not.toThrow();
      
      // Parent should have handled the failure
      expect(parentTask.addConversationEntry).toHaveBeenCalled();
      expect(parentTask.fail).toHaveBeenCalledWith(failureMessage.error);
    });
  });

  describe('Strategy Message Routing', () => {
    it('should properly route start messages to different strategies', () => {
      const strategies = [
        createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry),
        createAnalysisStrategy(mockLlmClient),
        createExecutionStrategy()
      ];
      
      const tasks = strategies.map((strategy, i) => 
        createTask(`Test task ${i}`, null, strategy)
      );
      
      // Mock required methods for each task
      tasks.forEach(task => {
        task.addConversationEntry = jest.fn();
        task.send = jest.fn();
        task.fail = jest.fn();
        task.metadata = {};
        task.lookup = jest.fn().mockReturnValue(mockLlmClient);
      });
      
      const mockSender = { parent: null };
      const startMessage = { type: 'start' };
      
      // All strategies should handle start messages without throwing
      tasks.forEach((task, i) => {
        expect(() => {
          task.onMessage(mockSender, startMessage);
        }).not.toThrow();
      });
    });

    it('should handle external sender messages vs child messages differently', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      
      const parentTask = createTask('Parent task', null, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      const externalSender = createTask('External sender', null, strategy);
      
      // Mock methods
      parentTask.addConversationEntry = jest.fn();
      parentTask.send = jest.fn();
      parentTask.metadata = {};
      parentTask.lookup = jest.fn().mockReturnValue(null);
      childTask.deliverGoalOutputs = jest.fn().mockReturnValue([]);
      
      const childMessage = { type: 'completed', result: { success: true } };
      const externalMessage = { type: 'start' };
      
      // Both should be handled without throwing, but through different code paths
      expect(() => {
        parentTask.onMessage(childTask, childMessage);
      }).not.toThrow();
      
      expect(() => {
        parentTask.onMessage(externalSender, externalMessage);
      }).not.toThrow();
      
      // Verify different handling paths were taken
      expect(childTask.deliverGoalOutputs).toHaveBeenCalled(); // Child message path
      expect(parentTask.addConversationEntry).toHaveBeenCalled(); // External message path
    });
  });

  describe('Multi-Strategy Workflow', () => {
    it('should coordinate analysis and execution strategies', () => {
      const analysisStrategy = createAnalysisStrategy(mockLlmClient);
      const executionStrategy = createExecutionStrategy();
      
      const analysisTask = createTask('Analysis task', null, analysisStrategy);
      const executionTask = createTask('Execution task', analysisTask, executionStrategy);
      
      // Mock methods for analysis task
      analysisTask.addConversationEntry = jest.fn();
      analysisTask.send = jest.fn();
      analysisTask.complete = jest.fn();
      analysisTask.lookup = jest.fn().mockReturnValue(mockLlmClient);
      
      // Mock methods for execution task
      executionTask.addConversationEntry = jest.fn();
      executionTask.send = jest.fn();
      executionTask.getArtifact = jest.fn();
      executionTask.metadata = {};
      
      const externalSender = { parent: null };
      
      // Start analysis
      expect(() => {
        analysisTask.onMessage(externalSender, { type: 'start' });
      }).not.toThrow();
      
      // Start execution
      expect(() => {
        executionTask.onMessage(externalSender, { type: 'start' });
      }).not.toThrow();
      
      // Both should have initiated their respective workflows
      expect(analysisTask.addConversationEntry).toHaveBeenCalled();
      expect(executionTask.addConversationEntry).toHaveBeenCalled();
    });

    it('should handle recursive decomposition with subtask creation', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      const parentTask = createTask('Complex parent task', null, strategy);
      
      // Mock task methods
      parentTask.metadata = { classification: 'COMPLEX' };
      parentTask.addConversationEntry = jest.fn();
      parentTask.send = jest.fn();
      parentTask.lookup = jest.fn().mockReturnValue(mockLlmClient);
      parentTask.setDecomposition = jest.fn();
      parentTask.createNextSubtask = jest.fn().mockResolvedValue(null); // No more subtasks
      
      const externalSender = { parent: null };
      
      // This should trigger complex task handling
      expect(() => {
        parentTask.onMessage(externalSender, { type: 'start' });
      }).not.toThrow();
      
      // Should have attempted to create subtasks
      expect(parentTask.addConversationEntry).toHaveBeenCalled();
    });
  });

  describe('Message Type Handling', () => {
    it('should handle all standard message types without errors', () => {
      const strategies = [
        createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry),
        createAnalysisStrategy(mockLlmClient),
        createExecutionStrategy()
      ];
      
      const messageTypes = ['start', 'work', 'abort', 'completed', 'failed'];
      
      strategies.forEach((strategy, strategyIndex) => {
        const task = createTask(`Test task ${strategyIndex}`, null, strategy);
        
        // Mock all required methods
        task.addConversationEntry = jest.fn();
        task.send = jest.fn();
        task.fail = jest.fn();
        task.complete = jest.fn();
        task.metadata = {};
        task.lookup = jest.fn().mockReturnValue(mockLlmClient);
        task.getArtifact = jest.fn();
        task.getAllArtifacts = jest.fn().mockReturnValue({});
        
        messageTypes.forEach(messageType => {
          const mockSender = { parent: null };
          const message = { 
            type: messageType,
            result: { success: true },
            error: new Error('Test error')
          };
          
          expect(() => {
            task.onMessage(mockSender, message);
          }).not.toThrow();
        });
      });
    });

    it('should handle unknown message types gracefully', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      const task = createTask('Test task', null, strategy);
      
      // Mock console.log to capture unknown message warnings
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      const mockSender = { parent: null };
      const unknownMessage = { type: 'unknown_message_type' };
      
      expect(() => {
        task.onMessage(mockSender, unknownMessage);
      }).not.toThrow();
      
      // Should have logged a warning about unknown message
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('unhandled message')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling in Strategy Communication', () => {
    it('should handle errors in message processing without breaking communication', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      const task = createTask('Test task', null, strategy);
      
      // Mock a method to throw an error
      task.addConversationEntry = jest.fn().mockImplementation(() => {
        throw new Error('Mock processing error');
      });
      
      // Mock other methods normally
      task.send = jest.fn();
      task.fail = jest.fn();
      task.lookup = jest.fn().mockReturnValue(mockLlmClient);
      
      const mockSender = { parent: null };
      const message = { type: 'start' };
      
      // Should handle the error gracefully without throwing
      expect(() => {
        task.onMessage(mockSender, message);
      }).not.toThrow();
    });

    it('should propagate task failures up the hierarchy', () => {
      const strategy = createRecursiveDecompositionStrategy(mockLlmClient, mockToolRegistry);
      
      const grandParentTask = createTask('Grandparent task', null, strategy);
      const parentTask = createTask('Parent task', grandParentTask, strategy);
      const childTask = createTask('Child task', parentTask, strategy);
      
      // Mock methods
      parentTask.addConversationEntry = jest.fn();
      parentTask.fail = jest.fn();
      parentTask.send = jest.fn();
      parentTask.getAllArtifacts = jest.fn().mockReturnValue({});
      
      grandParentTask.send = jest.fn();
      
      // Child fails and notifies parent
      const failureMessage = {
        type: 'failed',
        error: new Error('Child task failed')
      };
      
      parentTask.onMessage(childTask, failureMessage);
      
      // Parent should have failed and notified grandparent
      expect(parentTask.fail).toHaveBeenCalled();
      expect(parentTask.send).toHaveBeenCalledWith(grandParentTask, expect.objectContaining({
        type: 'failed'
      }));
    });
  });

  describe('Strategy Context and State Management', () => {
    it('should maintain separate context for different task instances', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      
      const task1 = createTask('Task 1', null, strategy);
      const task2 = createTask('Task 2', null, strategy);
      
      // Tasks should have separate state but share strategy methods
      expect(task1.description).toBe('Task 1');
      expect(task2.description).toBe('Task 2');
      expect(task1.onMessage).toBe(task2.onMessage); // Same strategy method
      expect(task1.id).not.toBe(task2.id); // Different IDs
    });

    it('should handle context binding properly with this keyword', () => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      const task = createTask('Context test task', null, strategy);
      
      // Mock methods to verify 'this' context
      task.addConversationEntry = jest.fn();
      task.send = jest.fn();
      task.fail = jest.fn();
      task.lookup = jest.fn().mockReturnValue(mockLlmClient);
      
      const mockSender = { parent: null };
      const message = { type: 'start' };
      
      // When onMessage is called, 'this' should refer to the task
      task.onMessage(mockSender, message);
      
      // Verify that methods were called on the correct task instance
      expect(task.addConversationEntry).toHaveBeenCalled();
    });
  });

  describe('Async Operations in Message Flow', () => {
    it('should not block on async operations in message handlers', (done) => {
      const strategy = createAnalysisStrategy(mockLlmClient);
      const task = createTask('Async test task', null, strategy);
      
      // Mock methods with async behavior
      task.addConversationEntry = jest.fn();
      task.send = jest.fn();
      task.lookup = jest.fn().mockReturnValue(mockLlmClient);
      
      const mockSender = { parent: null };
      const message = { type: 'start' };
      
      const startTime = Date.now();
      
      // Message handler should return immediately
      const result = task.onMessage(mockSender, message);
      const endTime = Date.now();
      
      // Should return undefined (fire-and-forget)
      expect(result).toBeUndefined();
      
      // Should be immediate (not blocked on async operations)
      expect(endTime - startTime).toBeLessThan(10);
      
      // Async operations should be initiated but not waited for
      setTimeout(() => {
        expect(task.addConversationEntry).toHaveBeenCalled();
        done();
      }, 50);
    });
  });
});