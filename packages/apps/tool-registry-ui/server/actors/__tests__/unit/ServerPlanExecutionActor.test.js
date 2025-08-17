/**
 * Unit tests for ServerPlanExecutionActor
 * Tests execution message handling and behavior tree execution with mocked dependencies
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ServerPlanExecutionActor } from '../../ServerPlanExecutionActor.js';

describe('ServerPlanExecutionActor', () => {
  let actor;
  let mockBTExecutor;
  let mockToolRegistry;
  let mockMongoProvider;
  let mockRemoteActor;

  beforeEach(() => {
    // Mock BT Executor
    mockBTExecutor = {
      execute: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      stop: jest.fn(),
      step: jest.fn(),
      getStatus: jest.fn(),
      setBreakpoint: jest.fn(),
      removeBreakpoint: jest.fn()
    };

    // Mock Tool Registry
    mockToolRegistry = {
      getTool: jest.fn(),
      executeTool: jest.fn(),
      getAllTools: jest.fn().mockResolvedValue([])
    };

    // Mock MongoDB provider
    mockMongoProvider = {
      getCollection: jest.fn().mockReturnValue({
        insertOne: jest.fn(),
        findOne: jest.fn(),
        updateOne: jest.fn(),
        find: jest.fn().mockReturnValue({
          toArray: jest.fn()
        })
      })
    };

    // Mock remote actor for responses
    mockRemoteActor = {
      send: jest.fn()
    };

    actor = new ServerPlanExecutionActor(mockBTExecutor, mockToolRegistry, mockMongoProvider);
    actor.setRemoteActor(mockRemoteActor);
  });

  describe('initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(actor.btExecutor).toBe(mockBTExecutor);
      expect(actor.toolRegistry).toBe(mockToolRegistry);
      expect(actor.mongoProvider).toBe(mockMongoProvider);
    });

    it('should set remote actor', () => {
      expect(actor.remoteActor).toBe(mockRemoteActor);
    });

    it('should initialize execution state', () => {
      expect(actor.activeExecutions).toBeInstanceOf(Map);
      expect(actor.activeExecutions.size).toBe(0);
    });
  });

  describe('execution:start message', () => {
    it('should start plan execution', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'tool1' },
          { type: 'action', tool: 'tool2' }
        ]
      };

      const executionId = 'exec123';
      mockBTExecutor.execute.mockResolvedValue({
        status: 'completed',
        results: { success: true },
        artifacts: { output: 'result' }
      });

      await actor.receive({
        type: 'execution:start',
        data: {
          executionId,
          planId: 'plan123',
          behaviorTree,
          options: { mode: 'full' }
        }
      });

      expect(mockBTExecutor.execute).toHaveBeenCalledWith(
        behaviorTree,
        expect.objectContaining({
          mode: 'full',
          onTaskStart: expect.any(Function),
          onTaskComplete: expect.any(Function),
          onToolExecute: expect.any(Function),
          onArtifactCreated: expect.any(Function)
        })
      );

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:started',
        data: { executionId, planId: 'plan123' }
      });
    });

    it('should handle step-by-step execution mode', async () => {
      const behaviorTree = { type: 'action', tool: 'tool1' };

      await actor.receive({
        type: 'execution:start',
        data: {
          executionId: 'exec456',
          planId: 'plan456',
          behaviorTree,
          options: { mode: 'step' }
        }
      });

      expect(mockBTExecutor.execute).toHaveBeenCalledWith(
        behaviorTree,
        expect.objectContaining({ mode: 'step' })
      );
    });

    it('should track active executions', async () => {
      const behaviorTree = { type: 'action', tool: 'tool1' };

      // Mock execute to not complete immediately - just hang
      let executeResolve;
      mockBTExecutor.execute.mockImplementation(() => {
        return new Promise((resolve) => {
          executeResolve = resolve;
          // Don't resolve immediately - let the test check the status
        });
      });

      // Start execution but don't await it
      const executionPromise = actor.receive({
        type: 'execution:start',
        data: {
          executionId: 'exec789',
          planId: 'plan789',
          behaviorTree
        }
      });

      // Give it a moment to start
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(actor.activeExecutions.has('exec789')).toBe(true);
      const execution = actor.activeExecutions.get('exec789');
      expect(execution.planId).toBe('plan789');
      expect(execution.status).toBe('running');

      // Clean up - complete the execution
      if (executeResolve) {
        executeResolve({ status: 'completed', results: {} });
      }
      await executionPromise;
    });

    it('should send progress updates during execution', async () => {
      const behaviorTree = {
        type: 'sequence',
        children: [
          { type: 'action', tool: 'tool1', id: 'task1' },
          { type: 'action', tool: 'tool2', id: 'task2' }
        ]
      };

      mockBTExecutor.execute.mockImplementation(async (tree, callbacks) => {
        // Simulate task execution callbacks
        await callbacks.onTaskStart({ id: 'task1', name: 'Execute tool1' });
        await callbacks.onToolExecute({ toolName: 'tool1', params: {} });
        await callbacks.onArtifactCreated({ name: 'artifact1', value: 'value1' });
        await callbacks.onTaskComplete({ id: 'task1', status: 'success', outputs: {} });
        
        return { status: 'completed', results: {} };
      });

      await actor.receive({
        type: 'execution:start',
        data: {
          executionId: 'exec001',
          planId: 'plan001',
          behaviorTree
        }
      });

      // Check that progress updates were sent
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:task:start',
        data: expect.objectContaining({
          taskId: 'task1',
          taskName: 'Execute tool1'
        })
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:tool:execute',
        data: expect.objectContaining({
          toolName: 'tool1'
        })
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:artifact:created',
        data: expect.objectContaining({
          name: 'artifact1',
          value: 'value1'
        })
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:task:complete',
        data: expect.objectContaining({
          taskId: 'task1',
          status: 'success'
        })
      });
    });

    it('should handle execution errors', async () => {
      mockBTExecutor.execute.mockRejectedValue(new Error('Execution failed'));

      await actor.receive({
        type: 'execution:start',
        data: {
          executionId: 'execErr',
          planId: 'planErr',
          behaviorTree: { type: 'action', tool: 'failing_tool' }
        }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:error',
        data: expect.objectContaining({
          executionId: 'execErr',
          error: 'Execution failed: Execution failed'
        })
      });
    });
  });

  describe('execution:pause message', () => {
    it('should pause running execution', async () => {
      // First start an execution
      actor.activeExecutions.set('exec123', {
        planId: 'plan123',
        status: 'running',
        startTime: new Date()
      });

      mockBTExecutor.pause.mockResolvedValue({ paused: true });

      await actor.receive({
        type: 'execution:pause',
        data: { executionId: 'exec123' }
      });

      expect(mockBTExecutor.pause).toHaveBeenCalledWith('exec123');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:paused',
        data: { executionId: 'exec123' }
      });

      const execution = actor.activeExecutions.get('exec123');
      expect(execution.status).toBe('paused');
    });

    it('should handle pause for non-existent execution', async () => {
      await actor.receive({
        type: 'execution:pause',
        data: { executionId: 'nonexistent' }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:error',
        data: expect.objectContaining({
          error: 'Execution not found: nonexistent'
        })
      });
    });
  });

  describe('execution:resume message', () => {
    it('should resume paused execution', async () => {
      actor.activeExecutions.set('exec123', {
        planId: 'plan123',
        status: 'paused',
        startTime: new Date()
      });

      mockBTExecutor.resume.mockResolvedValue({ resumed: true });

      await actor.receive({
        type: 'execution:resume',
        data: { executionId: 'exec123' }
      });

      expect(mockBTExecutor.resume).toHaveBeenCalledWith('exec123');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:resumed',
        data: { executionId: 'exec123' }
      });

      const execution = actor.activeExecutions.get('exec123');
      expect(execution.status).toBe('running');
    });
  });

  describe('execution:stop message', () => {
    it('should stop running execution', async () => {
      actor.activeExecutions.set('exec123', {
        planId: 'plan123',
        status: 'running',
        startTime: new Date()
      });

      mockBTExecutor.stop.mockResolvedValue({ stopped: true });

      await actor.receive({
        type: 'execution:stop',
        data: { executionId: 'exec123' }
      });

      expect(mockBTExecutor.stop).toHaveBeenCalledWith('exec123');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:stopped',
        data: { executionId: 'exec123' }
      });

      expect(actor.activeExecutions.has('exec123')).toBe(false);
    });
  });

  describe('execution:step message', () => {
    it('should execute single step', async () => {
      actor.activeExecutions.set('exec123', {
        planId: 'plan123',
        status: 'paused',
        startTime: new Date()
      });

      mockBTExecutor.step.mockResolvedValue({
        taskExecuted: 'task1',
        status: 'success'
      });

      await actor.receive({
        type: 'execution:step',
        data: { executionId: 'exec123' }
      });

      expect(mockBTExecutor.step).toHaveBeenCalledWith('exec123');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:step:complete',
        data: expect.objectContaining({
          executionId: 'exec123',
          taskExecuted: 'task1'
        })
      });
    });
  });

  describe('execution:status message', () => {
    it('should return execution status', async () => {
      const executionData = {
        planId: 'plan123',
        status: 'running',
        startTime: new Date(),
        progress: { totalTasks: 10, completedTasks: 5 },
        artifacts: { data: 'value' }
      };

      actor.activeExecutions.set('exec123', executionData);

      await actor.receive({
        type: 'execution:status',
        data: { executionId: 'exec123' }
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:status:result',
        data: expect.objectContaining({
          executionId: 'exec123',
          status: 'running',
          progress: executionData.progress
        })
      });
    });
  });

  describe('execution:list message', () => {
    it('should list all active executions', async () => {
      actor.activeExecutions.set('exec1', {
        planId: 'plan1',
        status: 'running',
        startTime: new Date()
      });
      actor.activeExecutions.set('exec2', {
        planId: 'plan2',
        status: 'paused',
        startTime: new Date()
      });

      await actor.receive({
        type: 'execution:list',
        data: {}
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:list:result',
        data: {
          executions: expect.arrayContaining([
            expect.objectContaining({ executionId: 'exec1', status: 'running' }),
            expect.objectContaining({ executionId: 'exec2', status: 'paused' })
          ])
        }
      });
    });
  });

  describe('execution:history message', () => {
    it('should load execution history from MongoDB', async () => {
      const mockExecutions = [
        { _id: 'exec1', planId: 'plan1', status: 'completed' },
        { _id: 'exec2', planId: 'plan2', status: 'failed' }
      ];

      const mockCollection = {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue(mockExecutions)
            })
          })
        })
      };

      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'execution:history',
        data: { limit: 10 }
      });

      expect(mockMongoProvider.getCollection).toHaveBeenCalledWith('plan_executions');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:history:result',
        data: { executions: mockExecutions }
      });
    });
  });

  describe('execution:save message', () => {
    it('should save execution record to MongoDB', async () => {
      const executionRecord = {
        executionId: 'exec123',
        planId: 'plan123',
        status: 'completed',
        artifacts: { result: 'success' },
        logs: ['log1', 'log2']
      };

      const mockCollection = {
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'record123' })
      };
      mockMongoProvider.getCollection.mockReturnValue(mockCollection);

      await actor.receive({
        type: 'execution:save',
        data: executionRecord
      });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          executionId: 'exec123',
          planId: 'plan123',
          status: 'completed'
        })
      );

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:saved',
        data: { recordId: 'record123' }
      });
    });
  });

  describe('execution:breakpoint message', () => {
    it('should set breakpoint on task', async () => {
      mockBTExecutor.setBreakpoint.mockResolvedValue({ set: true });

      await actor.receive({
        type: 'execution:breakpoint:set',
        data: {
          executionId: 'exec123',
          taskId: 'task1'
        }
      });

      expect(mockBTExecutor.setBreakpoint).toHaveBeenCalledWith('exec123', 'task1');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:breakpoint:set:result',
        data: { executionId: 'exec123', taskId: 'task1', set: true }
      });
    });

    it('should remove breakpoint from task', async () => {
      mockBTExecutor.removeBreakpoint.mockResolvedValue({ removed: true });

      await actor.receive({
        type: 'execution:breakpoint:remove',
        data: {
          executionId: 'exec123',
          taskId: 'task1'
        }
      });

      expect(mockBTExecutor.removeBreakpoint).toHaveBeenCalledWith('exec123', 'task1');
      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:breakpoint:removed',
        data: { executionId: 'exec123', taskId: 'task1' }
      });
    });
  });

  describe('error handling', () => {
    it('should handle unknown message types', async () => {
      await actor.receive({
        type: 'unknown:message',
        data: {}
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:error',
        data: expect.objectContaining({
          error: 'Unknown message type: unknown:message'
        })
      });
    });

    it('should handle missing execution ID', async () => {
      await actor.receive({
        type: 'execution:pause',
        data: {}
      });

      expect(mockRemoteActor.send).toHaveBeenCalledWith({
        type: 'execution:error',
        data: expect.objectContaining({
          error: expect.stringContaining('Missing executionId')
        })
      });
    });
  });
});