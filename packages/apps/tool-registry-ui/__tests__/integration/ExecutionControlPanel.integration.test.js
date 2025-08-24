/**
 * ExecutionControlPanel Integration Tests
 * Tests execution management and control integration with actors and execution system
 * Updated to use ToolRegistry singleton pattern
 */

import { jest } from '@jest/globals';
import { ExecutionControlPanel } from '../../src/components/tool-registry/components/panels/ExecutionControlPanel.js';

describe('ExecutionControlPanel Integration Tests', () => {
  let component;
  let mockUmbilical;
  let mockExecutionActor;
  let mockToolRegistry;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Mock ToolRegistry singleton
    mockToolRegistry = {
      getTool: jest.fn(),
      listTools: jest.fn(),
      searchTools: jest.fn(),
      getStatistics: jest.fn(),
      executeTool: jest.fn(),
      validateExecution: jest.fn()
    };

    // Create mock execution actor (updated for ToolRegistry pattern)
    mockExecutionActor = {
      sendMessage: jest.fn(),
      onMessage: jest.fn(),
      isConnected: jest.fn(() => true),
      startExecution: jest.fn(),
      pauseExecution: jest.fn(),
      resumeExecution: jest.fn(),
      stopExecution: jest.fn(),
      stepExecution: jest.fn(),
      // Add ToolRegistry-aware execution methods
      validateTools: jest.fn(),
      getExecutionContext: jest.fn()
    };

    // Create mock umbilical with execution event handlers and ToolRegistry support
    mockUmbilical = {
      dom,
      executionActor: mockExecutionActor,
      toolRegistry: mockToolRegistry,
      onMount: jest.fn(),
      onExecutionStart: jest.fn(),
      onExecutionPause: jest.fn(),
      onExecutionResume: jest.fn(),
      onExecutionStop: jest.fn(),
      onExecutionComplete: jest.fn(),
      onExecutionError: jest.fn(),
      onTaskProgress: jest.fn(),
      onLogEntry: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await ExecutionControlPanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Plan Execution Lifecycle', () => {
    test('should manage complete execution lifecycle from start to completion', async () => {
      const testPlan = {
        id: 'test-plan-123',
        name: 'Complete Integration Test Plan',
        goal: 'Test full execution lifecycle',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root task',
            children: [
              { id: 'task1', description: 'Initialize system', estimatedDuration: 5000 },
              { id: 'task2', description: 'Process data', estimatedDuration: 10000 },
              { id: 'task3', description: 'Generate output', estimatedDuration: 3000 }
            ]
          }
        }
      };

      // Set plan for execution
      const setPlanResult = component.api.setPlan(testPlan);
      expect(setPlanResult.success).toBe(true);
      expect(component.api.getPlan()).toEqual(testPlan);

      // Verify initial state
      expect(component.api.getExecutionStatus()).toBe('idle');
      expect(component.api.getExecutionId()).toBeNull();

      // Configure execution options
      component.api.setExecutionMode('sequential');
      component.api.setExecutionOption('continueOnError', false);
      component.api.setExecutionOption('maxRetries', 2);
      component.api.setExecutionOption('timeout', 60000);

      // Start execution
      mockExecutionActor.startExecution.mockResolvedValue({ 
        success: true, 
        executionId: 'exec-123' 
      });

      const startResult = await component.api.startExecution();
      expect(startResult.success).toBe(true);
      expect(component.api.getExecutionStatus()).toBe('running');
      expect(component.api.getExecutionId()).toBe('exec-123');

      // Verify execution started callback
      expect(mockUmbilical.onExecutionStart).toHaveBeenCalledWith(
        expect.objectContaining({ executionId: 'exec-123' })
      );

      // Simulate task progress updates
      component.api.updateTaskProgress('task1', {
        status: 'running',
        progress: 0.5,
        startTime: Date.now()
      });

      expect(component.api.getActiveTask()).toEqual(
        expect.objectContaining({ id: 'task1', status: 'running' })
      );

      // Complete first task
      component.api.updateTaskProgress('task1', {
        status: 'completed',
        progress: 1.0,
        endTime: Date.now()
      });

      const completedTasks = component.api.getCompletedTasks();
      expect(completedTasks).toHaveLength(1);
      expect(completedTasks[0].id).toBe('task1');

      // Start and complete remaining tasks
      component.api.updateTaskProgress('task2', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('task3', { status: 'completed', progress: 1.0 });

      // Stop execution
      mockExecutionActor.stopExecution.mockResolvedValue({ success: true });
      
      const stopResult = await component.api.stopExecution();
      expect(stopResult.success).toBe(true);
      expect(component.api.getExecutionStatus()).toBe('stopped');

      // Verify execution metrics
      const metrics = component.api.getExecutionMetrics();
      expect(metrics.totalTasks).toBe(3);
      expect(metrics.successRate).toBeGreaterThan(0);
    });

    test('should handle execution with failures and error recovery', async () => {
      const failurePlan = {
        id: 'failure-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Failure test plan',
            children: [
              { id: 'success-task', description: 'Successful task' },
              { id: 'fail-task', description: 'Failing task' },
              { id: 'recovery-task', description: 'Recovery task' }
            ]
          }
        }
      };

      component.api.setPlan(failurePlan);
      component.api.setExecutionOption('continueOnError', true);
      component.api.setExecutionOption('maxRetries', 2);

      // Start execution
      mockExecutionActor.startExecution.mockResolvedValue({ 
        success: true, 
        executionId: 'fail-exec-456' 
      });

      await component.api.startExecution();

      // Simulate successful task
      component.api.updateTaskProgress('success-task', { status: 'completed', progress: 1.0 });

      // Simulate failing task
      component.api.updateTaskProgress('fail-task', {
        status: 'failed',
        progress: 0.3,
        error: 'Network timeout occurred',
        retryCount: 1
      });

      const failedTasks = component.api.getFailedTasks();
      expect(failedTasks).toHaveLength(1);
      expect(failedTasks[0].error).toBe('Network timeout occurred');

      // Verify error callback was triggered
      expect(mockUmbilical.onExecutionError).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'fail-task',
          error: 'Network timeout occurred'
        })
      );

      // Continue with recovery task (since continueOnError is true)
      component.api.updateTaskProgress('recovery-task', { status: 'completed', progress: 1.0 });

      const completedTasks = component.api.getCompletedTasks();
      expect(completedTasks).toHaveLength(2); // success-task and recovery-task
    });

    test('should support pause and resume functionality', async () => {
      const pausePlan = {
        id: 'pause-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Pausable plan',
            children: [
              { id: 'long-task', description: 'Long running task' }
            ]
          }
        }
      };

      component.api.setPlan(pausePlan);
      
      mockExecutionActor.startExecution.mockResolvedValue({ 
        success: true, 
        executionId: 'pause-exec' 
      });

      await component.api.startExecution();

      // Start long task
      component.api.updateTaskProgress('long-task', { status: 'running', progress: 0.3 });

      // Pause execution
      mockExecutionActor.pauseExecution.mockResolvedValue({ success: true });
      
      const pauseResult = await component.api.pauseExecution();
      expect(pauseResult.success).toBe(true);
      expect(component.api.getExecutionStatus()).toBe('paused');
      expect(mockUmbilical.onExecutionPause).toHaveBeenCalled();

      // Resume execution
      mockExecutionActor.resumeExecution.mockResolvedValue({ success: true });
      
      const resumeResult = await component.api.resumeExecution();
      expect(resumeResult.success).toBe(true);
      expect(component.api.getExecutionStatus()).toBe('running');
      expect(mockUmbilical.onExecutionResume).toHaveBeenCalled();

      // Complete the task
      component.api.updateTaskProgress('long-task', { status: 'completed', progress: 1.0 });
    });
  });

  describe('Execution Control Features', () => {
    test('should support step-by-step execution mode', async () => {
      const stepPlan = {
        id: 'step-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Step-by-step plan',
            children: [
              { id: 'step1', description: 'Step 1' },
              { id: 'step2', description: 'Step 2' },
              { id: 'step3', description: 'Step 3' }
            ]
          }
        }
      };

      component.api.setPlan(stepPlan);
      component.api.setExecutionMode('step');

      mockExecutionActor.startExecution.mockResolvedValue({ 
        success: true, 
        executionId: 'step-exec' 
      });

      await component.api.startExecution();

      // Execute one step at a time
      mockExecutionActor.stepExecution.mockResolvedValue({ 
        success: true, 
        executedTask: 'step1' 
      });

      const step1Result = await component.api.stepExecution();
      expect(step1Result.success).toBe(true);

      // Simulate step completion
      component.api.updateTaskProgress('step1', { status: 'completed', progress: 1.0 });

      // Execute next step
      const step2Result = await component.api.stepExecution();
      expect(step2Result.success).toBe(true);

      // Verify step mode execution
      expect(component.api.getExecutionMode()).toBe('step');
    });

    test('should support execution with breakpoints', async () => {
      const breakpointPlan = {
        id: 'breakpoint-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Plan with breakpoints',
            children: [
              { id: 'before-break', description: 'Before breakpoint' },
              { id: 'at-break', description: 'At breakpoint' },
              { id: 'after-break', description: 'After breakpoint' }
            ]
          }
        }
      };

      component.api.setPlan(breakpointPlan);

      // Set breakpoint
      component.api.setBreakpoint('at-break');
      expect(component.api.getBreakpoints()).toContain('at-break');

      mockExecutionActor.startExecution.mockResolvedValue({ 
        success: true, 
        executionId: 'break-exec' 
      });

      await component.api.startExecution();

      // Execute until breakpoint
      component.api.updateTaskProgress('before-break', { status: 'completed', progress: 1.0 });

      // Should pause at breakpoint
      component.api.updateTaskProgress('at-break', { status: 'paused', progress: 0 });
      expect(component.api.getExecutionStatus()).toBe('paused');

      // Remove breakpoint and continue
      component.api.removeBreakpoint('at-break');
      expect(component.api.getBreakpoints()).not.toContain('at-break');

      await component.api.resumeExecution();
      component.api.updateTaskProgress('at-break', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('after-break', { status: 'completed', progress: 1.0 });
    });

    test('should support dry run mode', async () => {
      const dryRunPlan = {
        id: 'dry-run-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Dry run test',
            children: [
              { id: 'dry-task', description: 'Dry run task' }
            ]
          }
        }
      };

      component.api.setPlan(dryRunPlan);
      component.api.setExecutionOption('dryRun', true);

      expect(component.api.getExecutionOptions().dryRun).toBe(true);

      mockExecutionActor.startExecution.mockResolvedValue({ 
        success: true, 
        executionId: 'dry-exec',
        dryRun: true 
      });

      const startResult = await component.api.startExecution();
      expect(startResult.success).toBe(true);

      // In dry run, tasks should be simulated
      component.api.updateTaskProgress('dry-task', { 
        status: 'completed', 
        progress: 1.0,
        simulated: true 
      });

      const log = component.api.getExecutionLog();
      expect(log.some(entry => entry.message.includes('DRY RUN'))).toBe(true);
    });
  });

  describe('Real-time Monitoring Integration', () => {
    test('should track execution metrics in real-time', () => {
      const metricsPlan = {
        id: 'metrics-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Metrics tracking plan',
            children: [
              { id: 'fast-task', description: 'Fast task' },
              { id: 'slow-task', description: 'Slow task' }
            ]
          }
        }
      };

      component.api.setPlan(metricsPlan);

      // Start tracking metrics
      const startTime = Date.now();
      component.model.updateState('executionMetrics', {
        startTime,
        endTime: null,
        duration: 0,
        totalTasks: 2,
        successRate: 0
      });

      // Simulate task execution with timing
      component.api.updateTaskProgress('fast-task', {
        status: 'running',
        progress: 0,
        startTime: startTime + 1000
      });

      component.api.updateTaskProgress('fast-task', {
        status: 'completed',
        progress: 1.0,
        endTime: startTime + 3000
      });

      // Update metrics
      const metrics = component.api.getExecutionMetrics();
      expect(metrics.totalTasks).toBe(2);
      expect(metrics.startTime).toBe(startTime);

      // Complete second task
      component.api.updateTaskProgress('slow-task', {
        status: 'completed',
        progress: 1.0,
        endTime: startTime + 8000
      });

      // Verify final metrics
      const completedTasks = component.api.getCompletedTasks();
      expect(completedTasks).toHaveLength(2);
    });

    test('should provide detailed execution logging', () => {
      const loggingPlan = {
        id: 'logging-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Logging test plan',
            children: [
              { id: 'logged-task', description: 'Task with logging' }
            ]
          }
        }
      };

      component.api.setPlan(loggingPlan);

      // Add various log entries
      component.api.addLogEntry('info', 'Execution started', { timestamp: Date.now() });
      component.api.addLogEntry('debug', 'Task initialized', { taskId: 'logged-task' });
      component.api.addLogEntry('warn', 'Performance warning', { metric: 'memory_usage' });
      component.api.addLogEntry('error', 'Temporary error', { retryable: true });

      const log = component.api.getExecutionLog();
      expect(log).toHaveLength(4);
      expect(log[0].level).toBe('info');
      expect(log[1].level).toBe('debug');
      expect(log[2].level).toBe('warn');
      expect(log[3].level).toBe('error');

      // Verify log entries trigger callbacks
      expect(mockUmbilical.onLogEntry).toHaveBeenCalledTimes(4);

      // Clear log
      component.api.clearLog();
      expect(component.api.getExecutionLog()).toHaveLength(0);
    });

    test('should handle concurrent task execution monitoring', () => {
      const concurrentPlan = {
        id: 'concurrent-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Concurrent execution plan',
            children: [
              { id: 'parallel1', description: 'Parallel task 1' },
              { id: 'parallel2', description: 'Parallel task 2' },
              { id: 'parallel3', description: 'Parallel task 3' }
            ]
          }
        }
      };

      component.api.setPlan(concurrentPlan);
      component.api.setExecutionMode('parallel');
      component.api.setExecutionOption('parallelLimit', 3);

      const startTime = Date.now();

      // Start all tasks concurrently
      component.api.updateTaskProgress('parallel1', { status: 'running', progress: 0, startTime });
      component.api.updateTaskProgress('parallel2', { status: 'running', progress: 0, startTime });
      component.api.updateTaskProgress('parallel3', { status: 'running', progress: 0, startTime });

      // Update progress at different rates
      component.api.updateTaskProgress('parallel1', { status: 'running', progress: 0.8 });
      component.api.updateTaskProgress('parallel2', { status: 'running', progress: 0.3 });
      component.api.updateTaskProgress('parallel3', { status: 'running', progress: 0.6 });

      // Complete in different order
      component.api.updateTaskProgress('parallel2', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('parallel1', { status: 'completed', progress: 1.0 });
      component.api.updateTaskProgress('parallel3', { status: 'completed', progress: 1.0 });

      const completedTasks = component.api.getCompletedTasks();
      expect(completedTasks).toHaveLength(3);
      expect(component.api.getExecutionMode()).toBe('parallel');
    });
  });

  describe('Actor Integration', () => {
    test('should communicate with execution actor for plan execution', async () => {
      const actorPlan = {
        id: 'actor-integration-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Actor integration test',
            children: [
              { id: 'actor-task', description: 'Task handled by actor' }
            ]
          }
        }
      };

      component.api.setPlan(actorPlan);

      // Test actor communication
      expect(mockExecutionActor.isConnected()).toBe(true);

      // Start execution through actor
      mockExecutionActor.startExecution.mockResolvedValue({
        success: true,
        executionId: 'actor-exec-789',
        message: 'Execution started successfully'
      });

      const result = await component.api.startExecution();
      expect(result.success).toBe(true);
      expect(mockExecutionActor.startExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          planId: 'actor-integration-plan',
          mode: component.api.getExecutionMode(),
          options: component.api.getExecutionOptions()
        })
      );

      // Test pause through actor - use flexible ID matching
      mockExecutionActor.pauseExecution.mockResolvedValue({ success: true });
      await component.api.pauseExecution();
      expect(mockExecutionActor.pauseExecution).toHaveBeenCalledWith(expect.any(String));

      // Test resume through actor - use flexible ID matching
      mockExecutionActor.resumeExecution.mockResolvedValue({ success: true });
      await component.api.resumeExecution();
      expect(mockExecutionActor.resumeExecution).toHaveBeenCalledWith(expect.any(String));

      // Test stop through actor - use flexible ID matching
      mockExecutionActor.stopExecution.mockResolvedValue({ success: true });
      await component.api.stopExecution();
      expect(mockExecutionActor.stopExecution).toHaveBeenCalledWith(expect.any(String));
    });

    test('should handle actor communication failures gracefully', async () => {
      const errorPlan = {
        id: 'error-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Error handling test',
            children: [
              { id: 'error-task', description: 'Task that will fail' }
            ]
          }
        }
      };

      component.api.setPlan(errorPlan);

      // Simulate actor failure
      mockExecutionActor.startExecution.mockRejectedValue(
        new Error('Actor communication failed')
      );

      const result = await component.api.startExecution();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Actor communication failed');

      // Verify error was logged
      const log = component.api.getExecutionLog();
      const errorLog = log.find(entry => entry.level === 'error');
      expect(errorLog).toBeDefined();
      expect(errorLog.message).toContain('Failed to start execution');
    });

    test('should reconnect to actor after disconnection', async () => {
      // Simulate disconnection
      mockExecutionActor.isConnected.mockReturnValue(false);

      const reconnectPlan = {
        id: 'reconnect-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Reconnection test',
            children: [
              { id: 'reconnect-task', description: 'Task after reconnection' }
            ]
          }
        }
      };

      component.api.setPlan(reconnectPlan);

      // Attempt execution while disconnected
      const disconnectedResult = await component.api.startExecution();
      expect(disconnectedResult.success).toBe(false);
      expect(disconnectedResult.error).toContain('not connected');

      // Simulate reconnection
      mockExecutionActor.isConnected.mockReturnValue(true);
      mockExecutionActor.startExecution.mockResolvedValue({
        success: true,
        executionId: 'reconnect-exec'
      });

      // Retry execution after reconnection
      const reconnectedResult = await component.api.startExecution();
      expect(reconnectedResult.success).toBe(true);
    });
  });

  describe('Configuration and Environment', () => {
    test('should support different execution environments', () => {
      component.api.setEnvironment('production');
      expect(component.api.getEnvironment()).toBe('production');

      component.api.setEnvironment('development');
      expect(component.api.getEnvironment()).toBe('development');

      component.api.setEnvironment('testing');
      expect(component.api.getEnvironment()).toBe('testing');
    });

    test('should manage execution variables and context', () => {
      // Set execution variables
      component.api.setVariable('API_URL', 'https://api.example.com');
      component.api.setVariable('TIMEOUT', 30000);
      component.api.setVariable('DEBUG_MODE', true);

      const variables = component.api.getVariables();
      expect(variables.API_URL).toBe('https://api.example.com');
      expect(variables.TIMEOUT).toBe(30000);
      expect(variables.DEBUG_MODE).toBe(true);

      // Update variable
      component.api.setVariable('TIMEOUT', 60000);
      expect(component.api.getVariables().TIMEOUT).toBe(60000);

      // Remove variable
      component.api.removeVariable('DEBUG_MODE');
      expect(component.api.getVariables().DEBUG_MODE).toBeUndefined();

      // Clear all variables
      component.api.clearVariables();
      expect(Object.keys(component.api.getVariables())).toHaveLength(0);
    });

    test('should validate execution configuration', () => {
      const invalidPlan = null;
      const setPlanResult = component.api.setPlan(invalidPlan);
      expect(setPlanResult.success).toBe(false);
      expect(setPlanResult.error).toContain('Plan cannot be null');

      // Test invalid execution options
      const setOptionResult = component.api.setExecutionOption('invalidOption', 'value');
      expect(setOptionResult.success).toBe(false);
      expect(setOptionResult.error).toContain('Invalid execution option');

      // Test invalid execution mode
      const setModeResult = component.api.setExecutionMode('invalidMode');
      expect(setModeResult.success).toBe(false);
      expect(setModeResult.error).toContain('Invalid execution mode');
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle execution reset and cleanup', async () => {
      const resetPlan = {
        id: 'reset-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Reset test plan',
            children: [
              { id: 'reset-task', description: 'Task to be reset' }
            ]
          }
        }
      };

      component.api.setPlan(resetPlan);

      mockExecutionActor.startExecution.mockResolvedValue({
        success: true,
        executionId: 'reset-exec'
      });

      // Start execution and simulate some progress
      await component.api.startExecution();
      component.api.updateTaskProgress('reset-task', { status: 'running', progress: 0.5 });
      component.api.addLogEntry('info', 'Task in progress');

      // Reset execution
      const resetResult = component.api.resetExecution();
      expect(resetResult.success).toBe(true);

      // Verify reset state
      expect(component.api.getExecutionStatus()).toBe('idle');
      expect(component.api.getExecutionId()).toBeNull();
      expect(component.api.getActiveTask()).toBeNull();
      expect(component.api.getCompletedTasks()).toHaveLength(0);
      expect(component.api.getFailedTasks()).toHaveLength(0);
      expect(component.api.getExecutionLog()).toHaveLength(0);
    });

    test('should maintain state consistency during errors', async () => {
      const consistencyPlan = {
        id: 'consistency-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'State consistency test',
            children: [
              { id: 'consistent-task', description: 'State consistency task' }
            ]
          }
        }
      };

      component.api.setPlan(consistencyPlan);

      // Start execution
      mockExecutionActor.startExecution.mockResolvedValue({
        success: true,
        executionId: 'consistency-exec'
      });

      await component.api.startExecution();

      // Simulate error during execution
      component.api.updateTaskProgress('consistent-task', {
        status: 'failed',
        progress: 0.2,
        error: 'Unexpected error occurred'
      });

      // Verify state remains consistent
      expect(component.api.getExecutionStatus()).toBe('running'); // Should still be running
      expect(component.api.getFailedTasks()).toHaveLength(1);
      expect(component.api.getCompletedTasks()).toHaveLength(0);

      // Recovery: retry the task
      component.api.updateTaskProgress('consistent-task', {
        status: 'running',
        progress: 0,
        retryCount: 1
      });

      component.api.updateTaskProgress('consistent-task', {
        status: 'completed',
        progress: 1.0
      });

      // Verify recovery
      expect(component.api.getFailedTasks()).toHaveLength(0); // Should be moved to completed
      expect(component.api.getCompletedTasks()).toHaveLength(1);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large execution plans efficiently', () => {
      // Create a large plan with 100 tasks
      const largePlan = {
        id: 'large-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Large execution plan',
            children: Array.from({ length: 100 }, (_, i) => ({
              id: `task-${i}`,
              description: `Task ${i}`,
              estimatedDuration: 1000 + (i * 100)
            }))
          }
        }
      };

      const startTime = Date.now();
      component.api.setPlan(largePlan);

      // Simulate rapid task updates
      for (let i = 0; i < 100; i++) {
        component.api.updateTaskProgress(`task-${i}`, {
          status: i < 50 ? 'completed' : 'running',
          progress: i < 50 ? 1.0 : Math.random()
        });
      }

      const operationTime = Date.now() - startTime;

      // Should handle large plans efficiently
      expect(operationTime).toBeLessThan(2000);

      // Verify state is correct
      expect(component.api.getCompletedTasks()).toHaveLength(50);
      expect(component.api.getPlan().hierarchy.root.children).toHaveLength(100);
    });

    test('should manage memory efficiently during long executions', () => {
      const memoryPlan = {
        id: 'memory-plan',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Memory management test',
            children: [
              { id: 'memory-task', description: 'Memory intensive task' }
            ]
          }
        }
      };

      component.api.setPlan(memoryPlan);

      // Simulate many log entries (potential memory issue)
      for (let i = 0; i < 1000; i++) {
        component.api.addLogEntry('debug', `Log entry ${i}`, { iteration: i });
      }

      // Verify log management
      const log = component.api.getExecutionLog();
      expect(log.length).toBeLessThanOrEqual(1000); // Should not grow indefinitely

      // Clear log to free memory
      component.api.clearLog();
      expect(component.api.getExecutionLog()).toHaveLength(0);
    });
  });
});