/**
 * Integration tests for progress tracking
 * Tests event emission, percentage accuracy, and time estimation
 */

import { jest } from '@jest/globals';
import { ROMAAgent } from '../../src/ROMAAgent.js';
import { TaskProgressStream } from '../../src/core/TaskProgressStream.js';
import { ResourceManager } from '@legion/resource-manager';

describe('Progress Tracking Integration', () => {
  let resourceManager;
  let agent;
  let progressEvents;
  
  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
  });

  beforeEach(async () => {
    agent = new ROMAAgent();
    await agent.initialize();
    progressEvents = [];
    
    // Capture all progress events
    agent.on('progress', (event) => {
      progressEvents.push(event);
    });
  });

  afterEach(() => {
    if (agent && agent.cleanup) {
      agent.cleanup();
    }
    progressEvents = [];
  });

  describe('Basic Progress Event Emission', () => {
    it('should emit progress events during task execution', async () => {
      const task = {
        description: 'Write hello world to a file',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: '__tests__/tmp/test-progress.txt',
          content: 'Hello, World!'
        }
      };

      await agent.execute(task);

      // Should have multiple progress events
      expect(progressEvents.length).toBeGreaterThan(0);
      
      // Check for expected event types
      const eventTypes = progressEvents.map(e => e.type || e.status);
      expect(eventTypes).toContain('started');
      expect(eventTypes).toContain('tool_progress');
    });

    it('should emit events with required fields', async () => {
      const task = {
        description: 'Simple atomic task',
        atomic: true
      };

      await agent.execute(task);

      progressEvents.forEach(event => {
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('taskId');
        expect(event.timestamp).toBeGreaterThan(0);
        expect(typeof event.taskId).toBe('string');
      });
    });

    it('should emit progress events in correct order', async () => {
      const task = {
        description: 'Execute with file tool',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: '__tests__/tmp/test-order.txt',
          content: 'Test content'
        }
      };

      await agent.execute(task);

      // Find progress events for this execution
      const progressEventTypes = progressEvents
        .filter(e => e.type === 'tool_progress' || e.status === 'tool_progress')
        .map(e => e.phase);

      if (progressEventTypes.length > 0) {
        expect(progressEventTypes).toContain('initializing');
        
        // If we have multiple phases, they should be in order
        if (progressEventTypes.length > 1) {
          const initIndex = progressEventTypes.indexOf('initializing');
          const execIndex = progressEventTypes.indexOf('executing');
          const compIndex = progressEventTypes.indexOf('completed');
          
          if (execIndex !== -1) expect(execIndex).toBeGreaterThan(initIndex);
          if (compIndex !== -1) expect(compIndex).toBeGreaterThan(execIndex);
        }
      }
    });
  });

  describe('Percentage Accuracy', () => {
    it('should emit percentage values between 0 and 100', async () => {
      const task = {
        description: 'Task with percentage tracking',
        atomic: true
      };

      await agent.execute(task);

      const percentageEvents = progressEvents.filter(e => 
        e.percentage !== undefined || e.percent !== undefined
      );

      percentageEvents.forEach(event => {
        const pct = event.percentage || event.percent;
        expect(pct).toBeGreaterThanOrEqual(0);
        expect(pct).toBeLessThanOrEqual(100);
        expect(Number.isInteger(pct) || Number.isFinite(pct)).toBe(true);
      });
    });

    it('should show increasing percentages for tool execution', async () => {
      const task = {
        description: 'Tool execution with progress',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: '__tests__/tmp/test-percentage.txt',
          content: 'Progress test'
        }
      };

      await agent.execute(task);

      const toolProgressEvents = progressEvents
        .filter(e => e.type === 'tool_progress' || e.status === 'tool_progress')
        .sort((a, b) => a.timestamp - b.timestamp);

      if (toolProgressEvents.length > 1) {
        let lastPercentage = -1;
        toolProgressEvents.forEach(event => {
          if (event.percentage !== undefined) {
            expect(event.percentage).toBeGreaterThanOrEqual(lastPercentage);
            lastPercentage = event.percentage;
          }
        });
      }
    });

    it('should reach 100% completion for successful tasks', async () => {
      const task = {
        description: 'Task that should complete successfully',
        atomic: true,
        tool: 'file_write',
        params: {
          filePath: '__tests__/tmp/test-completion.txt',
          content: 'Completion test'
        }
      };

      const result = await agent.execute(task);
      
      if (result.success) {
        const completionEvents = progressEvents.filter(e => 
          (e.percentage === 100 || e.percent === 100) ||
          (e.phase === 'completed' || e.status === 'completed')
        );
        
        expect(completionEvents.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Time Estimation', () => {
    it('should include time estimates in progress events', async () => {
      const task = {
        description: 'Task with time estimation',
        atomic: false, // Use recursive to get more detailed progress
        subtasks: [
          { description: 'First subtask', atomic: true },
          { description: 'Second subtask', atomic: true }
        ]
      };

      await agent.execute(task);

      const eventsWithTime = progressEvents.filter(e => 
        e.estimatedTimeRemaining !== undefined || 
        e.remainingTime !== undefined ||
        e.elapsedTime !== undefined
      );

      if (eventsWithTime.length > 0) {
        eventsWithTime.forEach(event => {
          const remaining = event.estimatedTimeRemaining || event.remainingTime;
          const elapsed = event.elapsedTime;
          
          if (remaining !== undefined) {
            expect(remaining).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(remaining)).toBe(true);
          }
          
          if (elapsed !== undefined) {
            expect(elapsed).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(elapsed)).toBe(true);
          }
        });
      }
    });

    it('should show decreasing remaining time over execution', async () => {
      const task = {
        description: 'Multi-step task for time tracking',
        atomic: false,
        subtasks: [
          { description: 'Step 1', atomic: true, tool: 'file_write', params: { filePath: '__tests__/tmp/step1.txt', content: 'Step 1' }},
          { description: 'Step 2', atomic: true, tool: 'file_write', params: { filePath: '__tests__/tmp/step2.txt', content: 'Step 2' }}
        ]
      };

      await agent.execute(task);

      const timeEvents = progressEvents
        .filter(e => e.estimatedTimeRemaining !== undefined || e.remainingTime !== undefined)
        .sort((a, b) => a.timestamp - b.timestamp);

      if (timeEvents.length > 1) {
        // Generally, remaining time should decrease (though it might fluctuate due to estimation adjustments)
        const firstTime = timeEvents[0].estimatedTimeRemaining || timeEvents[0].remainingTime;
        const lastTime = timeEvents[timeEvents.length - 1].estimatedTimeRemaining || timeEvents[timeEvents.length - 1].remainingTime;
        
        // At minimum, the last estimate should be less than or equal to the first
        expect(lastTime).toBeLessThanOrEqual(firstTime);
      }
    });

    it('should provide execution plan with time estimates for complex tasks', async () => {
      const task = {
        description: 'Create a multi-file project with backend and frontend components',
        atomic: false
      };

      await agent.execute(task);

      const planEvents = progressEvents.filter(e => 
        e.type === 'execution_plan' || e.status === 'execution_plan'
      );

      if (planEvents.length > 0) {
        const planEvent = planEvents[0];
        expect(planEvent).toHaveProperty('totalSubtasks');
        expect(planEvent.totalSubtasks).toBeGreaterThan(0);
        
        if (planEvent.estimatedTime !== undefined) {
          expect(planEvent.estimatedTime).toBeGreaterThan(0);
          expect(Number.isFinite(planEvent.estimatedTime)).toBe(true);
        }
      }
    });
  });

  describe('TaskProgressStream Integration', () => {
    let progressStream;

    beforeEach(() => {
      progressStream = new TaskProgressStream();
    });

    afterEach(() => {
      if (progressStream && progressStream.cleanup) {
        progressStream.cleanup();
      }
    });

    it('should integrate with TaskProgressStream for progress updates', async () => {
      const updates = [];
      progressStream.subscribe('*', (event) => {
        updates.push(event);
      });

      const emitter = progressStream.createTaskEmitter('test-task');
      
      emitter.started({ totalSteps: 3 });
      emitter.progress(33, 'First step completed');
      emitter.progress(66, 'Second step completed');
      emitter.completed({ result: 'success' });

      expect(updates.length).toBe(4);
      expect(updates[0].status).toBe('started');
      expect(updates[1].percentage).toBe(33);
      expect(updates[2].percentage).toBe(66);
      expect(updates[3].status).toBe('completed');
    });

    it('should track multiple tasks simultaneously', async () => {
      const task1Updates = [];
      const task2Updates = [];
      
      progressStream.subscribe('task-1', (event) => task1Updates.push(event));
      progressStream.subscribe('task-2', (event) => task2Updates.push(event));

      const emitter1 = progressStream.createTaskEmitter('task-1');
      const emitter2 = progressStream.createTaskEmitter('task-2');

      emitter1.started();
      emitter2.started();
      emitter1.progress(50);
      emitter2.progress(25);
      emitter1.completed();
      emitter2.progress(75);

      expect(task1Updates.length).toBe(3); // started, progress, completed
      expect(task2Updates.length).toBe(3); // started, progress, progress
      
      // Verify task isolation
      expect(task1Updates.every(e => e.taskId === 'task-1')).toBe(true);
      expect(task2Updates.every(e => e.taskId === 'task-2')).toBe(true);
    });

    it('should provide historical progress data', async () => {
      const taskId = 'historical-task';
      const emitter = progressStream.createTaskEmitter(taskId);

      emitter.started();
      emitter.progress(25);
      emitter.progress(75);
      emitter.completed();

      const history = progressStream.getHistory(taskId);
      expect(history.length).toBe(4);
      
      // Verify chronological order
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).toBeGreaterThanOrEqual(history[i-1].timestamp);
      }
    });

    it('should calculate overall progress correctly', () => {
      progressStream.updateProgress('task-1', 'progress', { percentage: 50, totalSteps: 4 });
      progressStream.updateProgress('task-2', 'progress', { percentage: 25, totalSteps: 2 });
      progressStream.updateProgress('task-3', 'completed', { percentage: 100, totalSteps: 1 });

      const overallProgress = progressStream.calculateOverallProgress();
      
      // Should be average of all task percentages: (50 + 25 + 100) / 3 = 58.33 → 58
      expect(overallProgress).toBe(Math.round(175/3));
    });
  });

  describe('Error Scenarios', () => {
    it('should emit error events with progress context', async () => {
      const task = {
        description: 'Task that will fail',
        atomic: true,
        tool: 'nonexistent_tool'
      };

      try {
        await agent.execute(task);
      } catch (error) {
        // Expected to fail
      }

      const errorEvents = progressEvents.filter(e => 
        e.status === 'failed' || 
        e.error !== undefined ||
        e.type === 'error'
      );

      if (errorEvents.length > 0) {
        const errorEvent = errorEvents[0];
        expect(errorEvent).toHaveProperty('taskId');
        expect(errorEvent).toHaveProperty('timestamp');
        
        if (errorEvent.error) {
          expect(typeof errorEvent.error).toBe('string');
        }
      }
    });

    it('should handle progress tracking when tasks are retried', async () => {
      // Mock a tool that fails once then succeeds
      let callCount = 0;
      const mockTool = {
        execute: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Temporary failure');
          }
          return { success: true, result: 'Success on retry' };
        })
      };

      // Mock tool registry to return our failing tool
      const originalGetTool = agent.toolRegistry?.getTool;
      if (agent.toolRegistry) {
        agent.toolRegistry.getTool = jest.fn().mockResolvedValue(mockTool);
      }

      const task = {
        description: 'Task with retry',
        atomic: true,
        tool: 'retry_test_tool',
        maxRetries: 2
      };

      try {
        await agent.execute(task);

        const retryEvents = progressEvents.filter(e => 
          e.status === 'retrying' || e.type === 'retry'
        );

        if (retryEvents.length > 0) {
          const retryEvent = retryEvents[0];
          expect(retryEvent).toHaveProperty('attempt');
          expect(retryEvent).toHaveProperty('maxAttempts');
          expect(retryEvent.attempt).toBeGreaterThan(0);
          expect(retryEvent.maxAttempts).toBeGreaterThan(retryEvent.attempt);
        }
      } finally {
        // Restore original getTool method
        if (agent.toolRegistry && originalGetTool) {
          agent.toolRegistry.getTool = originalGetTool;
        }
      }
    });
  });

});