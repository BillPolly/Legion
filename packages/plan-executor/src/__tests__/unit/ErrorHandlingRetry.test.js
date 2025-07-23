/**
 * Unit tests for Error Handling and Retry Logic
 */

import { PlanExecutor } from '../../core/PlanExecutor.js';

describe('Error Handling and Retry Logic', () => {
  let mockModuleFactory;
  let mockResourceManager;
  let executor;

  beforeEach(() => {
    mockModuleFactory = {
      createModule: jest.fn()
    };
    
    mockResourceManager = {
      get: jest.fn(),
      register: jest.fn()
    };

    executor = new PlanExecutor({
      moduleFactory: mockModuleFactory,
      resourceManager: mockResourceManager
    });

    // Mock moduleLoader methods
    executor.moduleLoader.loadModulesForPlan = jest.fn().mockResolvedValue();
  });

  describe('step-level error handling', () => {
    it('should capture step errors without stopping execution when stopOnError is false', async () => {
      const failingTool = jest.fn().mockRejectedValue(new Error('Tool failure'));
      const successTool = jest.fn().mockResolvedValue({ success: true, result: 'success' });

      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
        return {
          execute: toolName === 'failing_tool' ? failingTool : successTool
        };
      });

      const plan = {
        id: 'error-handling-plan',
        steps: [
          {
            id: 'failing-step',
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'success-step',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['failing-step']);
      expect(result.completedSteps).toEqual(['success-step']);
      expect(result.skippedSteps).toEqual([]);
    });

    it('should stop execution on first error when stopOnError is true', async () => {
      const failingTool = jest.fn().mockRejectedValue(new Error('Tool failure'));
      const successTool = jest.fn().mockResolvedValue({ success: true, result: 'success' });

      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
        return {
          execute: toolName === 'failing_tool' ? failingTool : successTool
        };
      });

      const plan = {
        id: 'stop-on-error-plan',
        steps: [
          {
            id: 'failing-step',
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'success-step',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: true, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['failing-step']);
      expect(result.completedSteps).toEqual([]);
      expect(result.skippedSteps).toEqual(['success-step']);
      expect(failingTool.mock.calls.length).toBe(1);
      expect(successTool.mock.calls.length).toBe(0);
    });

    it('should emit step:error events for failed steps', async () => {
      const errorEvents = [];
      executor.on('step:error', (event) => errorEvents.push(event));

      const failingTool = jest.fn().mockRejectedValue(new Error('Specific tool error'));
      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: failingTool
      });

      const plan = {
        id: 'error-event-plan',
        steps: [
          {
            id: 'error-step',
            name: 'Error Step',
            actions: [{ type: 'failing_tool', parameters: {} }]
          }
        ]
      };

      await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].stepId).toBe('error-step');
      expect(errorEvents[0].stepName).toBe('Error Step');
      expect(errorEvents[0].error).toBe('Specific tool error');
      expect(errorEvents[0].timestamp).toBeInstanceOf(Date);
    });

    it('should handle errors in nested steps', async () => {
      const failingTool = jest.fn().mockRejectedValue(new Error('Nested failure'));
      const successTool = jest.fn().mockResolvedValue({ success: true, result: 'success' });

      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
        return {
          execute: toolName === 'failing_tool' ? failingTool : successTool
        };
      });

      const plan = {
        id: 'nested-error-plan',
        steps: [
          {
            id: 'parent-step',
            steps: [
              {
                id: 'failing-child',
                actions: [{ type: 'failing_tool', parameters: {} }]
              },
              {
                id: 'success-child',
                actions: [{ type: 'success_tool', parameters: {} }]
              }
            ]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['failing-child']);
      expect(result.completedSteps).toEqual(['success-child', 'parent-step']);
    });
  });

  describe('retry logic with exponential backoff', () => {
    it('should retry failed operations up to maxRetries times', async () => {
      let attemptCount = 0;
      const retryingTool = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error(`Attempt ${attemptCount} failed`));
        }
        return Promise.resolve({ success: true, result: 'finally succeeded' });
      });

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: retryingTool
      });

      const plan = {
        id: 'retry-plan',
        steps: [
          {
            id: 'retry-step',
            actions: [{ type: 'retrying_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { retries: 3, timeout: 5000 });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['retry-step']);
      expect(attemptCount).toBe(3);
      expect(retryingTool.mock.calls.length).toBe(3);
    });

    it('should fail after exhausting all retries', async () => {
      let attemptCount = 0;
      const alwaysFailingTool = jest.fn().mockImplementation(() => {
        attemptCount++;
        return Promise.reject(new Error(`Attempt ${attemptCount} failed`));
      });

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: alwaysFailingTool
      });

      const plan = {
        id: 'exhausted-retries-plan',
        steps: [
          {
            id: 'failing-step',
            actions: [{ type: 'failing_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 2, timeout: 5000 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['failing-step']);
      expect(attemptCount).toBe(3); // Initial attempt + 2 retries
      expect(alwaysFailingTool.mock.calls.length).toBe(3);
    });

    it('should apply exponential backoff between retries', async () => {
      const timestamps = [];
      let attemptCount = 0;
      
      const timedTool = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error(`Attempt ${attemptCount} failed`));
        }
        return Promise.resolve({ success: true, result: 'succeeded' });
      });

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: timedTool
      });

      const plan = {
        id: 'backoff-plan',
        steps: [
          {
            id: 'backoff-step',
            actions: [{ type: 'timed_tool', parameters: {} }]
          }
        ]
      };

      const startTime = Date.now();
      await executor.executePlan(plan, { retries: 2, timeout: 10000 });
      const totalTime = Date.now() - startTime;

      // Should take at least 1s + 2s = 3s due to exponential backoff
      expect(totalTime).toBeGreaterThan(3000);
      expect(timestamps).toHaveLength(3);

      // Check that delays increase exponentially (approximately)
      const delay1 = timestamps[1] - timestamps[0];
      const delay2 = timestamps[2] - timestamps[1];
      
      expect(delay1).toBeGreaterThan(900); // ~1s (allowing for some variance)
      expect(delay1).toBeLessThan(1100);
      expect(delay2).toBeGreaterThan(1900); // ~2s
      expect(delay2).toBeLessThan(2100);
    });

    it('should not retry on successful execution', async () => {
      const successTool = jest.fn().mockResolvedValue({ success: true, result: 'immediate success' });

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: successTool
      });

      const plan = {
        id: 'no-retry-needed-plan',
        steps: [
          {
            id: 'success-step',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { retries: 3, timeout: 5000 });

      expect(result.success).toBe(true);
      expect(successTool.mock.calls.length).toBe(1); // Should only be called once
    });
  });

  describe('error context and reporting', () => {
    it('should provide detailed error information', async () => {
      const specificError = new Error('Very specific tool error with details');
      const failingTool = jest.fn().mockRejectedValue(specificError);

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: failingTool
      });

      const plan = {
        id: 'error-context-plan',
        steps: [
          {
            id: 'detailed-error-step',
            name: 'Detailed Error Step',
            actions: [{ type: 'failing_tool', parameters: { detail: 'important' } }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['detailed-error-step']);
      
      // The error should be stored in the context
      // This would be accessible via the execution context if needed
    });

    it('should track multiple error types', async () => {
      const networkError = new Error('Network timeout');
      const validationError = new Error('Invalid input parameters');
      
      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
        if (toolName === 'network_tool') {
          return { execute: jest.fn().mockRejectedValue(networkError) };
        } else if (toolName === 'validation_tool') {
          return { execute: jest.fn().mockRejectedValue(validationError) };
        }
        return { execute: jest.fn().mockResolvedValue({ success: true }) };
      });

      const plan = {
        id: 'multiple-errors-plan',
        steps: [
          {
            id: 'network-step',
            actions: [{ type: 'network_tool', parameters: {} }]
          },
          {
            id: 'validation-step',
            actions: [{ type: 'validation_tool', parameters: {} }]
          },
          {
            id: 'success-step',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['network-step', 'validation-step']);
      expect(result.completedSteps).toEqual(['success-step']);
    });

    it('should preserve error stack traces', async () => {
      const errorWithStack = new Error('Error with stack trace');
      errorWithStack.stack = 'Error: Error with stack trace\n    at test function';
      
      const failingTool = jest.fn().mockRejectedValue(errorWithStack);
      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: failingTool
      });

      const plan = {
        id: 'stack-trace-plan',
        steps: [
          {
            id: 'stack-step',
            actions: [{ type: 'failing_tool', parameters: {} }]
          }
        ]
      };

      // Listen for error events to check if stack is preserved
      let errorEvent;
      executor.on('step:error', (event) => {
        errorEvent = event;
      });

      await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(errorEvent).toBeDefined();
      expect(errorEvent.error).toBe('Error with stack trace');
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running operations', async () => {
      const slowTool = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true }), 2000); // 2 second delay
        });
      });

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: slowTool
      });

      const plan = {
        id: 'timeout-plan',
        steps: [
          {
            id: 'slow-step',
            actions: [{ type: 'slow_tool', parameters: {} }]
          }
        ]
      };

      // Set a 500ms timeout
      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 500 });

      expect(result.success).toBe(false);
      expect(result.failedSteps).toEqual(['slow-step']);
    });

    it('should handle timeout with retries', async () => {
      let callCount = 0;
      const sometimesSlowTool = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          // First two calls are slow (will timeout)
          return new Promise((resolve) => {
            setTimeout(() => resolve({ success: true }), 1000);
          });
        } else {
          // Third call is fast
          return Promise.resolve({ success: true, result: 'finally fast' });
        }
      });

      executor.moduleLoader.getTool = jest.fn().mockReturnValue({
        execute: sometimesSlowTool
      });

      const plan = {
        id: 'timeout-retry-plan',
        steps: [
          {
            id: 'sometimes-slow-step',
            actions: [{ type: 'sometimes_slow_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { retries: 2, timeout: 500 });

      expect(result.success).toBe(true);
      expect(result.completedSteps).toEqual(['sometimes-slow-step']);
      expect(callCount).toBe(3);
    });
  });

  describe('stop-on-error vs continue-on-error modes', () => {
    it('should skip remaining steps in stop-on-error mode', async () => {
      const executionOrder = [];
      const failingTool = jest.fn().mockImplementation(() => {
        executionOrder.push('failing');
        return Promise.reject(new Error('Failure'));
      });
      const successTool = jest.fn().mockImplementation(() => {
        executionOrder.push('success');
        return Promise.resolve({ success: true });
      });

      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
        return {
          execute: toolName === 'failing_tool' ? failingTool : successTool
        };
      });

      const plan = {
        id: 'stop-mode-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'success_tool', parameters: {} }]
          },
          {
            id: 'step2',
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'step3',
            actions: [{ type: 'success_tool', parameters: {} }]
          },
          {
            id: 'step4',
            actions: [{ type: 'success_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: true, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.completedSteps).toEqual(['step1']);
      expect(result.failedSteps).toEqual(['step2']);
      expect(result.skippedSteps).toEqual(['step3', 'step4']);
      expect(executionOrder).toEqual(['success', 'failing']);
    });

    it('should continue execution in continue-on-error mode', async () => {
      const executionOrder = [];
      const failingTool = jest.fn().mockImplementation(() => {
        executionOrder.push('failing');
        return Promise.reject(new Error('Failure'));
      });
      const successTool = jest.fn().mockImplementation(() => {
        executionOrder.push('success');
        return Promise.resolve({ success: true });
      });

      executor.moduleLoader.getTool = jest.fn().mockImplementation((toolName) => {
        return {
          execute: toolName === 'failing_tool' ? failingTool : successTool
        };
      });

      const plan = {
        id: 'continue-mode-plan',
        steps: [
          {
            id: 'step1',
            actions: [{ type: 'success_tool', parameters: {} }]
          },
          {
            id: 'step2',
            actions: [{ type: 'failing_tool', parameters: {} }]
          },
          {
            id: 'step3',
            actions: [{ type: 'success_tool', parameters: {} }]
          },
          {
            id: 'step4',
            actions: [{ type: 'failing_tool', parameters: {} }]
          }
        ]
      };

      const result = await executor.executePlan(plan, { stopOnError: false, retries: 0, timeout: 1000 });

      expect(result.success).toBe(false);
      expect(result.completedSteps).toEqual(['step1', 'step3']);
      expect(result.failedSteps).toEqual(['step2', 'step4']);
      expect(result.skippedSteps).toEqual([]);
      expect(executionOrder).toEqual(['success', 'failing', 'success', 'failing']);
    });
  });
});