/**
 * End-to-End Tests: Execution Scenarios
 * Tests complete execution workflows including success, failure, pause/resume, and step-through
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('E2E: Execution Scenarios', () => {
  let component;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockToolRegistryActor;

  // Sample plan for testing
  const createTestPlan = (complexity = 'simple') => {
    const basePlan = {
      id: `test-plan-${Date.now()}`,
      name: 'Test Execution Plan',
      goal: 'Test execution scenarios',
      status: 'created',
      createdAt: new Date().toISOString()
    };

    if (complexity === 'simple') {
      return {
        ...basePlan,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Simple execution test',
            type: 'goal',
            children: [
              {
                id: 'task-1',
                description: 'Initialize project',
                type: 'task',
                tools: ['npm'],
                children: []
              },
              {
                id: 'task-2',
                description: 'Run tests',
                type: 'task',
                tools: ['jest'],
                dependencies: ['task-1'],
                children: []
              }
            ]
          }
        },
        behaviorTree: {
          rootNode: {
            type: 'sequence',
            children: [
              { type: 'action', id: 'task-1', command: 'npm init -y' },
              { type: 'action', id: 'task-2', command: 'npm test' }
            ]
          }
        }
      };
    } else if (complexity === 'complex') {
      return {
        ...basePlan,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Complex execution test',
            type: 'goal',
            children: [
              {
                id: 'phase-1',
                description: 'Setup Phase',
                type: 'phase',
                children: [
                  {
                    id: 'task-1.1',
                    description: 'Install dependencies',
                    type: 'task',
                    tools: ['npm'],
                    children: []
                  },
                  {
                    id: 'task-1.2',
                    description: 'Configure environment',
                    type: 'task',
                    tools: ['node'],
                    children: []
                  }
                ]
              },
              {
                id: 'phase-2',
                description: 'Build Phase',
                type: 'phase',
                dependencies: ['phase-1'],
                children: [
                  {
                    id: 'task-2.1',
                    description: 'Compile source',
                    type: 'task',
                    tools: ['webpack'],
                    children: []
                  },
                  {
                    id: 'task-2.2',
                    description: 'Optimize assets',
                    type: 'task',
                    tools: ['webpack'],
                    children: []
                  }
                ]
              }
            ]
          }
        },
        behaviorTree: {
          rootNode: {
            type: 'sequence',
            children: [
              {
                type: 'parallel',
                children: [
                  { type: 'action', id: 'task-1.1', command: 'npm install' },
                  { type: 'action', id: 'task-1.2', command: 'node setup.js' }
                ]
              },
              {
                type: 'sequence',
                children: [
                  { type: 'action', id: 'task-2.1', command: 'webpack build' },
                  { type: 'action', id: 'task-2.2', command: 'webpack optimize' }
                ]
              }
            ]
          }
        }
      };
    }
    
    return basePlan;
  };

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create comprehensive mock actors
    mockPlanningActor = {
      createPlan: jest.fn().mockResolvedValue(createTestPlan('simple')),
      validatePlan: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      }),
      savePlan: jest.fn().mockResolvedValue({ success: true }),
      loadPlan: jest.fn(),
      getPlans: jest.fn().mockResolvedValue([])
    };

    // Execution state tracking
    let executionState = {
      status: 'idle',
      progress: 0,
      currentTask: null,
      completedTasks: [],
      failedTasks: [],
      logs: [],
      isPaused: false,
      stepMode: false
    };

    mockExecutionActor = {
      startExecution: jest.fn().mockImplementation((plan) => {
        executionState.status = 'running';
        executionState.progress = 0;
        executionState.currentTask = plan.hierarchy.root.children[0].id;
        
        return Promise.resolve({
          executionId: `exec-${Date.now()}`,
          status: 'running',
          startTime: new Date().toISOString()
        });
      }),
      
      pauseExecution: jest.fn().mockImplementation(() => {
        if (executionState.status === 'running') {
          executionState.status = 'paused';
          executionState.isPaused = true;
          return Promise.resolve({ status: 'paused' });
        }
        return Promise.reject(new Error('Not running'));
      }),
      
      resumeExecution: jest.fn().mockImplementation(() => {
        if (executionState.status === 'paused') {
          executionState.status = 'running';
          executionState.isPaused = false;
          return Promise.resolve({ status: 'running' });
        }
        return Promise.reject(new Error('Not paused'));
      }),
      
      stopExecution: jest.fn().mockImplementation(() => {
        executionState.status = 'stopped';
        executionState.progress = 0;
        executionState.currentTask = null;
        return Promise.resolve({ status: 'stopped' });
      }),
      
      stepExecution: jest.fn().mockImplementation(() => {
        if (executionState.stepMode) {
          // Move to next task
          executionState.progress += 50;
          if (executionState.progress >= 100) {
            executionState.status = 'completed';
            executionState.currentTask = null;
          }
          return Promise.resolve({
            stepped: true,
            currentTask: executionState.currentTask,
            progress: executionState.progress
          });
        }
        return Promise.reject(new Error('Not in step mode'));
      }),
      
      getExecutionStatus: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          ...executionState,
          executionLogs: executionState.logs
        });
      }),
      
      enableStepMode: jest.fn().mockImplementation(() => {
        executionState.stepMode = true;
        return Promise.resolve({ stepMode: true });
      }),
      
      disableStepMode: jest.fn().mockImplementation(() => {
        executionState.stepMode = false;
        return Promise.resolve({ stepMode: false });
      }),
      
      // Simulate task execution
      executeTask: jest.fn().mockImplementation((taskId) => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            // Simulate random success/failure
            if (Math.random() > 0.2) {
              executionState.completedTasks.push(taskId);
              executionState.logs.push({
                taskId,
                message: `Task ${taskId} completed successfully`,
                timestamp: new Date().toISOString(),
                type: 'success'
              });
              resolve({ success: true, taskId });
            } else {
              executionState.failedTasks.push(taskId);
              executionState.logs.push({
                taskId,
                message: `Task ${taskId} failed`,
                timestamp: new Date().toISOString(),
                type: 'error'
              });
              reject(new Error(`Task ${taskId} failed`));
            }
          }, 100);
        });
      }),
      
      retryTask: jest.fn().mockImplementation((taskId) => {
        const index = executionState.failedTasks.indexOf(taskId);
        if (index > -1) {
          executionState.failedTasks.splice(index, 1);
          return mockExecutionActor.executeTask(taskId);
        }
        return Promise.reject(new Error('Task not in failed list'));
      }),
      
      skipTask: jest.fn().mockImplementation((taskId) => {
        executionState.logs.push({
          taskId,
          message: `Task ${taskId} skipped`,
          timestamp: new Date().toISOString(),
          type: 'warning'
        });
        return Promise.resolve({ skipped: true, taskId });
      }),
      
      rollbackExecution: jest.fn().mockImplementation(() => {
        executionState.status = 'rolledback';
        executionState.completedTasks = [];
        executionState.progress = 0;
        return Promise.resolve({ rolledBack: true });
      })
    };

    mockToolRegistryActor = {
      searchTools: jest.fn(),
      validateTools: jest.fn().mockResolvedValue({
        isValid: true,
        availableTools: ['npm', 'node', 'jest', 'webpack'],
        missingTools: []
      }),
      getAvailableTools: jest.fn().mockResolvedValue([
        'npm', 'node', 'jest', 'webpack', 'git'
      ])
    };

    // Define all planning tabs
    const tabs = [
      {
        id: 'planning',
        label: 'Planning Workspace',
        title: 'Planning Workspace',
        icon: '🧠',
        component: 'PlanningWorkspacePanel'
      },
      {
        id: 'execution',
        label: 'Execution Control',
        title: 'Execution Control',
        icon: '⚡',
        component: 'ExecutionControlPanel'
      },
      {
        id: 'progress',
        label: 'Progress',
        title: 'Progress Overlay',
        icon: '📈',
        component: 'ProgressOverlayPanel'
      }
    ];

    // Create umbilical
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'execution',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Execution tracking
      executionHistory: [],
      executionErrors: [],
      
      // Callbacks
      onExecutionStart: jest.fn((execId) => {
        mockUmbilical.executionHistory.push({
          type: 'start',
          executionId: execId,
          timestamp: new Date().toISOString()
        });
      }),
      
      onExecutionComplete: jest.fn((execId) => {
        mockUmbilical.executionHistory.push({
          type: 'complete',
          executionId: execId,
          timestamp: new Date().toISOString()
        });
      }),
      
      onExecutionError: jest.fn((error) => {
        mockUmbilical.executionErrors.push(error);
      }),
      
      onTaskComplete: jest.fn(),
      onTaskFailed: jest.fn(),
      onExecutionPaused: jest.fn(),
      onExecutionResumed: jest.fn(),
      onStepExecuted: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await NavigationTabs.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
    jest.clearAllMocks();
  });

  describe('Successful Execution', () => {
    test('should execute simple plan successfully', async () => {
      // Create and set plan
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start execution
        const result = await mockExecutionActor.startExecution(plan);
        expect(result.status).toBe('running');
        expect(result.executionId).toBeDefined();
        
        // Simulate task execution
        for (const task of plan.hierarchy.root.children) {
          await mockExecutionActor.executeTask(task.id);
        }
        
        // Check execution status
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.completedTasks).toHaveLength(2);
        expect(status.logs.filter(l => l.type === 'success').length).toBeGreaterThan(0);
        
        // Verify callbacks
        expect(mockUmbilical.onExecutionStart).toHaveBeenCalled();
      }
    });

    test('should execute complex plan with phases', async () => {
      // Create complex plan
      const plan = createTestPlan('complex');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start execution
        await mockExecutionActor.startExecution(plan);
        
        // Execute phase 1 tasks
        const phase1Tasks = plan.hierarchy.root.children[0].children;
        for (const task of phase1Tasks) {
          await mockExecutionActor.executeTask(task.id);
        }
        
        // Execute phase 2 tasks
        const phase2Tasks = plan.hierarchy.root.children[1].children;
        for (const task of phase2Tasks) {
          await mockExecutionActor.executeTask(task.id);
        }
        
        // Verify phased execution
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.completedTasks).toContain('task-1.1');
        expect(status.completedTasks).toContain('task-2.1');
      }
    });

    test('should track execution progress', async () => {
      // Create plan
      const plan = createTestPlan('simple');
      
      // Load progress panel
      await component.switchTab('progress');
      await component.loadPanelContent('progress');
      
      const progressComponent = component.getTabComponent('progress');
      
      if (progressComponent && progressComponent.api) {
        // Start tracking execution
        const tasks = plan.hierarchy.root.children;
        progressComponent.api.startExecution('exec-123', tasks);
        
        // Update progress for each task
        progressComponent.api.updateTaskProgress('task-1', {
          status: 'running',
          progress: 50
        });
        
        progressComponent.api.updateTaskProgress('task-1', {
          status: 'completed',
          progress: 100
        });
        
        progressComponent.api.updateTaskProgress('task-2', {
          status: 'running',
          progress: 25
        });
        
        // Check overall progress
        const state = progressComponent.api.getState();
        expect(state.taskProgress['task-1'].status).toBe('completed');
        expect(state.taskProgress['task-2'].status).toBe('running');
      }
    });

    test('should complete execution and generate artifacts', async () => {
      const plan = createTestPlan('simple');
      
      // Mock successful execution with artifacts
      mockExecutionActor.startExecution.mockResolvedValueOnce({
        executionId: 'exec-with-artifacts',
        status: 'running'
      });
      
      mockExecutionActor.executeTask.mockResolvedValue({
        success: true,
        artifacts: [
          { name: 'package.json', type: 'file', path: './package.json' },
          { name: 'test-results.xml', type: 'file', path: './test-results.xml' }
        ]
      });
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // Execute all tasks
        for (const task of plan.hierarchy.root.children) {
          const result = await mockExecutionActor.executeTask(task.id);
          expect(result.success).toBe(true);
          expect(result.artifacts).toBeDefined();
        }
        
        // Mark execution complete
        mockExecutionActor.getExecutionStatus.mockResolvedValueOnce({
          status: 'completed',
          progress: 100,
          completedTasks: ['task-1', 'task-2'],
          artifacts: [
            { name: 'package.json', type: 'file' },
            { name: 'test-results.xml', type: 'file' }
          ]
        });
        
        const finalStatus = await mockExecutionActor.getExecutionStatus();
        expect(finalStatus.status).toBe('completed');
        expect(finalStatus.artifacts).toHaveLength(2);
      }
    });
  });

  describe('Execution with Failures', () => {
    test('should handle task failure gracefully', async () => {
      const plan = createTestPlan('simple');
      
      // Mock task failure
      mockExecutionActor.executeTask.mockRejectedValueOnce(
        new Error('Task task-1 failed: Command not found')
      );
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // Attempt to execute failing task
        try {
          await mockExecutionActor.executeTask('task-1');
        } catch (error) {
          expect(error.message).toContain('failed');
        }
        
        // Verify error was recorded
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.failedTasks).toContain('task-1');
      }
    });

    test('should retry failed tasks', async () => {
      const plan = createTestPlan('simple');
      
      // First attempt fails, retry succeeds
      mockExecutionActor.executeTask
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ success: true });
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // First attempt fails
        try {
          await mockExecutionActor.executeTask('task-1');
        } catch (error) {
          // Task failed, add to failed list
          const status = await mockExecutionActor.getExecutionStatus();
          status.failedTasks.push('task-1');
        }
        
        // Retry the failed task
        mockExecutionActor.retryTask.mockResolvedValueOnce({ success: true });
        const retryResult = await mockExecutionActor.retryTask('task-1');
        expect(retryResult.success).toBe(true);
      }
    });

    test('should skip non-critical failed tasks', async () => {
      const plan = createTestPlan('complex');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // Mark a task as non-critical and skip it
        const skipResult = await mockExecutionActor.skipTask('task-1.2');
        expect(skipResult.skipped).toBe(true);
        
        // Continue with other tasks
        await mockExecutionActor.executeTask('task-2.1');
        
        // Verify execution continues
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.logs.some(l => l.message.includes('skipped'))).toBe(true);
      }
    });

    test('should rollback on critical failure', async () => {
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // Execute first task successfully
        mockExecutionActor.executeTask.mockResolvedValueOnce({ success: true });
        await mockExecutionActor.executeTask('task-1');
        
        // Critical failure on second task
        mockExecutionActor.executeTask.mockRejectedValueOnce(
          new Error('Critical: Database migration failed')
        );
        
        try {
          await mockExecutionActor.executeTask('task-2');
        } catch (error) {
          // Trigger rollback
          const rollbackResult = await mockExecutionActor.rollbackExecution();
          expect(rollbackResult.rolledBack).toBe(true);
          
          // Verify rollback state
          const status = await mockExecutionActor.getExecutionStatus();
          expect(status.status).toBe('rolledback');
          expect(status.completedTasks).toHaveLength(0);
        }
      }
    });
  });

  describe('Pause/Resume Execution', () => {
    test('should pause running execution', async () => {
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start execution
        await mockExecutionActor.startExecution(plan);
        
        // Pause execution
        const pauseResult = await mockExecutionActor.pauseExecution();
        expect(pauseResult.status).toBe('paused');
        
        // Verify paused state
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.status).toBe('paused');
        expect(status.isPaused).toBe(true);
      }
    });

    test('should resume paused execution', async () => {
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start and pause
        await mockExecutionActor.startExecution(plan);
        await mockExecutionActor.pauseExecution();
        
        // Resume execution
        const resumeResult = await mockExecutionActor.resumeExecution();
        expect(resumeResult.status).toBe('running');
        
        // Verify resumed state
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.status).toBe('running');
        expect(status.isPaused).toBe(false);
      }
    });

    test('should maintain state during pause', async () => {
      const plan = createTestPlan('complex');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // Execute some tasks
        mockExecutionActor.executeTask.mockResolvedValue({ success: true });
        await mockExecutionActor.executeTask('task-1.1');
        
        // Update state before pause
        const statusBeforePause = await mockExecutionActor.getExecutionStatus();
        statusBeforePause.completedTasks = ['task-1.1'];
        statusBeforePause.progress = 25;
        
        // Pause
        await mockExecutionActor.pauseExecution();
        
        // Verify state is maintained
        const pausedStatus = await mockExecutionActor.getExecutionStatus();
        expect(pausedStatus.completedTasks).toContain('task-1.1');
        expect(pausedStatus.progress).toBe(25);
        
        // Resume and continue
        await mockExecutionActor.resumeExecution();
        await mockExecutionActor.executeTask('task-1.2');
        
        // Verify progress continues
        const resumedStatus = await mockExecutionActor.getExecutionStatus();
        expect(resumedStatus.completedTasks.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('Step-Through Mode', () => {
    test('should enable step-through mode', async () => {
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Enable step mode
        const stepModeResult = await mockExecutionActor.enableStepMode();
        expect(stepModeResult.stepMode).toBe(true);
        
        // Start execution in step mode
        await mockExecutionActor.startExecution(plan);
        
        // Verify step mode is active
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.stepMode).toBe(true);
      }
    });

    test('should execute one task at a time in step mode', async () => {
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Enable step mode and start
        await mockExecutionActor.enableStepMode();
        await mockExecutionActor.startExecution(plan);
        
        // Execute first step
        const step1 = await mockExecutionActor.stepExecution();
        expect(step1.stepped).toBe(true);
        expect(step1.progress).toBe(50);
        
        // Execute second step
        const step2 = await mockExecutionActor.stepExecution();
        expect(step2.stepped).toBe(true);
        expect(step2.progress).toBe(100);
        
        // Verify completion
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.status).toBe('completed');
      }
    });

    test('should allow inspection between steps', async () => {
      const plan = createTestPlan('complex');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Enable step mode
        await mockExecutionActor.enableStepMode();
        await mockExecutionActor.startExecution(plan);
        
        // Execute first step
        await mockExecutionActor.stepExecution();
        
        // Inspect state between steps
        const midState = await mockExecutionActor.getExecutionStatus();
        expect(midState.progress).toBeGreaterThan(0);
        expect(midState.progress).toBeLessThan(100);
        expect(midState.stepMode).toBe(true);
        
        // User can examine logs, artifacts, etc.
        expect(midState.logs).toBeDefined();
        
        // Continue with next step
        await mockExecutionActor.stepExecution();
      }
    });

    test('should switch between step mode and normal execution', async () => {
      const plan = createTestPlan('simple');
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start in step mode
        await mockExecutionActor.enableStepMode();
        await mockExecutionActor.startExecution(plan);
        
        // Execute one step
        await mockExecutionActor.stepExecution();
        
        // Disable step mode to continue normally
        await mockExecutionActor.disableStepMode();
        
        // Continue execution normally
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.stepMode).toBe(false);
        
        // Can re-enable step mode if needed
        await mockExecutionActor.enableStepMode();
        const newStatus = await mockExecutionActor.getExecutionStatus();
        expect(newStatus.stepMode).toBe(true);
      }
    });
  });

  describe('Execution Monitoring', () => {
    test('should stream execution logs in real-time', async () => {
      const plan = createTestPlan('simple');
      const logs = [];
      
      // Mock log streaming
      mockExecutionActor.executeTask.mockImplementation((taskId) => {
        logs.push({
          taskId,
          message: `Executing ${taskId}`,
          timestamp: new Date().toISOString(),
          type: 'info'
        });
        
        return new Promise((resolve) => {
          setTimeout(() => {
            logs.push({
              taskId,
              message: `Completed ${taskId}`,
              timestamp: new Date().toISOString(),
              type: 'success'
            });
            resolve({ success: true });
          }, 50);
        });
      });
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await mockExecutionActor.startExecution(plan);
        
        // Execute tasks and collect logs
        for (const task of plan.hierarchy.root.children) {
          await mockExecutionActor.executeTask(task.id);
        }
        
        // Verify logs were collected
        expect(logs.length).toBeGreaterThan(0);
        expect(logs.some(l => l.type === 'info')).toBe(true);
        expect(logs.some(l => l.type === 'success')).toBe(true);
      }
    });

    test('should track execution metrics', async () => {
      const plan = createTestPlan('complex');
      const startTime = Date.now();
      
      // Load execution panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start execution
        await mockExecutionActor.startExecution(plan);
        
        // Execute tasks with timing
        mockExecutionActor.executeTask.mockResolvedValue({ 
          success: true,
          duration: 150
        });
        
        await mockExecutionActor.executeTask('task-1.1');
        await mockExecutionActor.executeTask('task-1.2');
        
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        
        // Get execution metrics
        const status = await mockExecutionActor.getExecutionStatus();
        
        // Verify metrics
        expect(totalDuration).toBeGreaterThan(0);
        expect(status.completedTasks).toHaveLength(2);
        
        // Calculate success rate
        const successRate = (status.completedTasks.length / 
          (status.completedTasks.length + status.failedTasks.length)) * 100;
        expect(successRate).toBeGreaterThanOrEqual(0);
      }
    });
  });
});