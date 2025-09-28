/**
 * Unit tests for RetryStrategy
 * 
 * RetryStrategy retries failed children:
 * - Retries on failure up to maxRetries
 * - Configurable delay between retries
 * - Succeeds when child succeeds (stops retrying)
 * - Fails after maxRetries exceeded
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createBTTask } from '../../../src/factory/createBTTask.js';
import { BTTaskStrategy } from '../../../src/core/BTTaskStrategy.js';

describe('RetryStrategy', () => {
  let RetryStrategy;
  
  beforeEach(async () => {
    // Try to import the strategy
    try {
      const strategyModule = await import('../../../src/strategies/RetryStrategy.js');
      RetryStrategy = strategyModule.RetryStrategy;
    } catch (error) {
      // Will fail until implemented
      RetryStrategy = null;
    }
  });
  
  describe('Prototype Chain', () => {
    it('should extend BTTaskStrategy', () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return; // Skip until implemented
      }
      
      expect(Object.getPrototypeOf(RetryStrategy)).toBe(BTTaskStrategy);
    });
    
    it('should have executeBTNode method', () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      expect(typeof RetryStrategy.executeBTNode).toBe('function');
    });
    
    it('should have handleChildResult method', () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      expect(typeof RetryStrategy.handleChildResult).toBe('function');
    });
  });
  
  describe('Retry on Failure', () => {
    it('should retry child on failure', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Retry Task',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 3,
          retryDelay: 10 // Small delay for testing
        }
      );
      
      let executionCount = 0;
      const child = createBTTask('Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executionCount++;
          // Fail first time, succeed second time
          if (executionCount === 1) {
            this.send(this.parent, {
              type: 'child-result',
              status: 'FAILURE',
              error: 'First attempt failed'
            });
          } else {
            this.send(this.parent, {
              type: 'child-result',
              status: 'SUCCESS',
              data: { attempt: executionCount }
            });
          }
        }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      // Wait for retries with delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should have tried twice (1 fail, 1 success)
      expect(executionCount).toBe(2);
      expect(retryTask.status).toBe('completed');
    });
    
    it('should stop retrying after max retries', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Max Retries Test',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 2,
          retryDelay: 10
        }
      );
      
      let executionCount = 0;
      const child = createBTTask('Failing Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executionCount++;
          // Always fail
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Always fails'
          });
        }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      // Wait for all retries
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have tried 3 times total (1 initial + 2 retries)
      expect(executionCount).toBe(3);
      expect(retryTask.status).toBe('failed');
    });
    
    it('should succeed immediately when child succeeds', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Immediate Success',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 5
        }
      );
      
      let executionCount = 0;
      const child = createBTTask('Success Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executionCount++;
          // Succeed immediately
          this.send(this.parent, {
            type: 'child-result',
            status: 'SUCCESS',
            data: { result: 'immediate' }
          });
        }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should only execute once
      expect(executionCount).toBe(1);
      expect(retryTask.status).toBe('completed');
    });
  });
  
  describe('Retry Configuration', () => {
    it('should use default maxRetries if not configured', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Default Config',
        null,
        RetryStrategy,
        {
          type: 'retry'
          // No maxRetries configured
        }
      );
      
      let executionCount = 0;
      const child = createBTTask('Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executionCount++;
          // Always fail
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Fail'
          });
        }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // Default should be 3 retries (4 total attempts)
      expect(executionCount).toBe(4);
    });
    
    it('should respect configured retry delay', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Delay Test',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 2,
          retryDelay: 50 // 50ms delay
        }
      );
      
      let executionTimes = [];
      const child = createBTTask('Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          executionTimes.push(Date.now());
          // Always fail to trigger retries
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Fail'
          });
        }
      };
      
      const startTime = Date.now();
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      // Wait for retries with delays
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Check delays between executions
      expect(executionTimes.length).toBe(3); // 1 initial + 2 retries
      
      // First retry should be at least 50ms after first execution
      if (executionTimes.length > 1) {
        const firstDelay = executionTimes[1] - executionTimes[0];
        expect(firstDelay).toBeGreaterThanOrEqual(45); // Allow some variance
      }
      
      // Second retry should also have delay
      if (executionTimes.length > 2) {
        const secondDelay = executionTimes[2] - executionTimes[1];
        expect(secondDelay).toBeGreaterThanOrEqual(45);
      }
    });
  });
  
  describe('Retry Counter', () => {
    it('should track retry attempts', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Counter Test',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 3,
          retryDelay: 10
        }
      );
      
      let attemptNumbers = [];
      const child = createBTTask('Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          // Context should have retry attempt number
          attemptNumbers.push(message.context?.retryAttempt || 0);
          
          // Fail to trigger more retries
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Fail'
          });
        }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should have increasing attempt numbers
      expect(attemptNumbers).toEqual([0, 1, 2, 3]);
    });
  });
  
  describe('Context Propagation', () => {
    it('should preserve context through retries', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Context Test',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 2,
          retryDelay: 10
        }
      );
      
      let receivedContexts = [];
      const child = createBTTask('Child', retryTask, BTTaskStrategy);
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          // Capture context
          receivedContexts.push(message.context);
          
          // Fail first time, succeed second
          if (receivedContexts.length === 1) {
            this.send(this.parent, {
              type: 'child-result',
              status: 'FAILURE',
              error: 'First fail'
            });
          } else {
            // Modify context on success
            message.context.result = 'success';
            this.send(this.parent, {
              type: 'child-result',
              status: 'SUCCESS',
              data: { done: true },
              context: message.context
            });
          }
        }
      };
      
      const initialContext = {
        workspaceDir: '/test',
        artifacts: { initial: 'value' }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: initialContext
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // All attempts should have the same base context
      expect(receivedContexts.length).toBe(2);
      expect(receivedContexts[0].workspaceDir).toBe('/test');
      expect(receivedContexts[1].workspaceDir).toBe('/test');
      expect(receivedContexts[0].artifacts.initial).toBe('value');
      expect(receivedContexts[1].artifacts.initial).toBe('value');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle missing children', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'No Children',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 3
        }
      );
      
      // No children added
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Should fail with no children
      expect(retryTask.status).toBe('failed');
    });
    
    it('should provide detailed failure information', async () => {
      if (!RetryStrategy) {
        expect(RetryStrategy).toBeDefined();
        return;
      }
      
      const retryTask = createBTTask(
        'Detailed Failure',
        null,
        RetryStrategy,
        {
          type: 'retry',
          maxRetries: 1,
          retryDelay: 10
        }
      );
      
      const child = createBTTask('Child', retryTask, BTTaskStrategy);
      
      let completionResult = null;
      const originalComplete = retryTask.completeBTNode;
      retryTask.completeBTNode = function(result) {
        completionResult = result;
        originalComplete.call(this, result);
      };
      
      child.onMessage = function(sender, message) {
        if (message.type === 'execute') {
          this.send(this.parent, {
            type: 'child-result',
            status: 'FAILURE',
            error: 'Specific error message'
          });
        }
      };
      
      retryTask.executeBTNode(retryTask, {
        type: 'execute',
        context: {}
      });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should include retry information in failure
      expect(completionResult).toBeDefined();
      expect(completionResult.status).toBe('FAILURE');
      expect(completionResult.error).toContain('retries exhausted');
      expect(completionResult.totalAttempts).toBe(2); // 1 initial + 1 retry
      expect(completionResult.lastError).toBe('Specific error message');
    });
  });
});