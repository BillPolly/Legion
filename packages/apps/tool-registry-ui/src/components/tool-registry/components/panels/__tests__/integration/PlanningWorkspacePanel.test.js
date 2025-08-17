/**
 * Integration tests for PlanningWorkspacePanel Component
 * Tests real actor communication and workflow integration
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the UmbilicalUtils
jest.mock('/legion/frontend-components/src/umbilical/index.js', () => ({
  UmbilicalUtils: {
    validateCapabilities: jest.fn((umbilical, requirements) => {
      return true;
    }),
    createRequirements: () => ({
      add: jest.fn(),
      validate: jest.fn()
    })
  }
}));

import { PlanningWorkspacePanel } from '../../PlanningWorkspacePanel.js';
import { ClientPlanningActor } from '../../../../../../actors/ClientPlanningActor.js';
import { ClientPlanExecutionActor } from '../../../../../../actors/ClientPlanExecutionActor.js';

describe('PlanningWorkspacePanel Integration', () => {
  let container;
  let component;
  let planningActor;
  let executionActor;
  let applicationContext;

  beforeEach(() => {
    // Create DOM container
    container = document.createElement('div');
    document.body.appendChild(container);

    // Create application context
    applicationContext = {
      updateState: jest.fn(),
      onDecompositionStart: jest.fn(),
      onDecompositionNode: jest.fn(),
      onValidationResult: jest.fn(),
      onPlanComplete: jest.fn(),
      onExecutionStarted: jest.fn(),
      onTaskStart: jest.fn(),
      onTaskComplete: jest.fn(),
      onExecutionComplete: jest.fn()
    };

    // Create real actors
    planningActor = new ClientPlanningActor(applicationContext);
    executionActor = new ClientPlanExecutionActor(applicationContext);

    // Set up mock remote actors
    const mockRemotePlanningActor = {
      send: jest.fn().mockResolvedValue()
    };
    const mockRemoteExecutionActor = {
      send: jest.fn().mockResolvedValue()
    };

    planningActor.setRemoteActor(mockRemotePlanningActor);
    executionActor.setRemoteActor(mockRemoteExecutionActor);
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('Actor Communication', () => {
    it('should integrate with planning actor for goal submission', async () => {
      // Create component with actors
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Set goal and create plan
      component.setGoal('Build a REST API service');
      await component.createPlan();

      // Verify actor was called
      expect(planningActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'plan:create',
        data: expect.objectContaining({
          goal: 'Build a REST API service',
          context: {},
          options: {},
          requestId: expect.stringMatching(/^plan-\d+$/)
        })
      });

      // Verify UI state updates
      expect(applicationContext.updateState).toHaveBeenCalledWith('planningStatus', 'creating');
      expect(applicationContext.updateState).toHaveBeenCalledWith('currentGoal', 'Build a REST API service');
    });

    it('should handle decomposition updates from planning actor', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Simulate decomposition start
      await planningActor.receive({
        type: 'plan:decomposition:start',
        data: { goal: 'Build a REST API service' }
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('planningStatus', 'decomposing');
      expect(applicationContext.onDecompositionStart).toHaveBeenCalled();

      // Simulate decomposition node
      const nodeData = {
        node: {
          id: 'task1',
          description: 'Setup Express server',
          complexity: 'SIMPLE'
        },
        level: 1
      };

      await planningActor.receive({
        type: 'plan:decomposition:node',
        data: nodeData
      });

      expect(applicationContext.onDecompositionNode).toHaveBeenCalledWith(nodeData);

      // Check if node appears in DOM
      const nodeElement = container.querySelector('[data-node-id="task1"]');
      expect(nodeElement).toBeTruthy();
      expect(nodeElement.textContent).toContain('Setup Express server');
    });

    it('should handle validation results', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      const validationResult = {
        valid: true,
        feasibility: {
          overallFeasible: true,
          feasibleTasks: ['task1', 'task2'],
          infeasibleTasks: []
        }
      };

      await planningActor.receive({
        type: 'plan:validation:result',
        data: validationResult
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('validationResult', validationResult);
      expect(applicationContext.onValidationResult).toHaveBeenCalledWith(validationResult);

      // Check validation status in DOM
      const validationStatus = container.querySelector('.validation-status');
      expect(validationStatus.classList.contains('valid')).toBe(true);
    });

    it('should handle plan completion', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor,
        onPlanComplete: jest.fn()
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      const completePlan = {
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build API',
            complexity: 'COMPLEX',
            children: []
          }
        },
        validation: {
          valid: true
        },
        behaviorTrees: {
          main: { type: 'sequence', children: [] }
        },
        metadata: {
          goal: 'Build API'
        }
      };

      await planningActor.receive({
        type: 'plan:complete',
        data: completePlan
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('planningStatus', 'complete');
      expect(applicationContext.updateState).toHaveBeenCalledWith('currentPlan', completePlan);
      expect(applicationContext.onPlanComplete).toHaveBeenCalledWith(completePlan);
      expect(umbilical.onPlanComplete).toHaveBeenCalledWith(completePlan);

      // Check that execute button is enabled
      const executeButton = container.querySelector('.execute-button');
      expect(executeButton.disabled).toBe(false);
    });

    it('should integrate with execution actor for plan execution', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Set a plan first
      const plan = {
        behaviorTrees: {
          main: { type: 'sequence', children: [] }
        }
      };
      component.setCurrentPlan(plan);

      // Start execution
      await component.startExecution();

      // Verify execution actor was called
      expect(executionActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'execution:start',
        data: expect.objectContaining({
          executionId: expect.stringMatching(/^exec-\d+$/),
          planId: expect.stringMatching(/^exec-\d+$/),
          behaviorTree: plan.behaviorTrees.main,
          options: {}
        })
      });

      // Verify UI state updates
      expect(applicationContext.updateState).toHaveBeenCalledWith('executionStatus', 'starting');
      expect(applicationContext.updateState).toHaveBeenCalledWith('currentExecutionId', expect.stringMatching(/^exec-\d+$/));
    });

    it('should handle execution status updates', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Set execution ID
      component.updateState('currentExecutionId', 'exec123');

      // Simulate execution started
      await executionActor.receive({
        type: 'execution:started',
        data: {
          executionId: 'exec123',
          planId: 'plan123'
        }
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('executionStatus', 'running');

      // Simulate task start
      await executionActor.receive({
        type: 'execution:task:start',
        data: {
          taskId: 'task1',
          taskName: 'Setup server'
        }
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('currentTask', 'Setup server');

      // Check execution logs
      const logs = container.querySelector('.execution-logs');
      expect(logs.textContent).toContain('Starting execution');
    });
  });

  describe('End-to-End Workflows', () => {
    it('should handle complete planning workflow', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // 1. Enter goal
      const goalTextarea = container.querySelector('.goal-textarea');
      goalTextarea.value = 'Create a todo list app';
      goalTextarea.dispatchEvent(new Event('input'));

      expect(component.getState('goal')).toBe('Create a todo list app');

      // 2. Click create plan
      const planButton = container.querySelector('.plan-button');
      planButton.click();

      // 3. Simulate decomposition
      await planningActor.receive({
        type: 'plan:decomposition:start',
        data: { goal: 'Create a todo list app' }
      });

      await planningActor.receive({
        type: 'plan:decomposition:node',
        data: {
          node: { id: 'task1', description: 'Setup project', complexity: 'SIMPLE' },
          level: 1
        }
      });

      // 4. Simulate validation
      await planningActor.receive({
        type: 'plan:validation:result',
        data: {
          valid: true,
          feasibility: {
            overallFeasible: true,
            feasibleTasks: ['task1'],
            infeasibleTasks: []
          }
        }
      });

      // 5. Simulate plan completion
      await planningActor.receive({
        type: 'plan:complete',
        data: {
          hierarchy: { root: { id: 'root' } },
          validation: { valid: true },
          behaviorTrees: { main: {} }
        }
      });

      // Verify final state
      expect(component.getState('planningStatus')).toBe('complete');
      expect(component.getState('currentPlan')).toBeTruthy();
      
      // Verify UI elements
      const executeButton = container.querySelector('.execute-button');
      expect(executeButton.disabled).toBe(false);

      const validationStatus = container.querySelector('.validation-status');
      expect(validationStatus.textContent).toBe('Valid');
    });

    it('should handle save and load operations', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Create a plan
      const plan = {
        hierarchy: { root: {} },
        behaviorTrees: { main: {} }
      };
      component.setCurrentPlan(plan);

      // Save plan
      await component.savePlan('My Test Plan');

      expect(planningActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'plan:save',
        data: expect.objectContaining({
          name: 'My Test Plan',
          hierarchy: plan.hierarchy,
          behaviorTrees: plan.behaviorTrees
        })
      });

      // Load plan
      await component.loadPlan('plan123');

      expect(planningActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'plan:load',
        data: { planId: 'plan123' }
      });

      // Simulate loaded plan
      await planningActor.receive({
        type: 'plan:loaded',
        data: {
          id: 'plan123',
          name: 'Loaded Plan',
          hierarchy: { root: {} }
        }
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('currentPlan', expect.objectContaining({
        id: 'plan123',
        name: 'Loaded Plan'
      }));
    });

    it('should handle execution control workflow', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Set up a plan and execution
      component.setCurrentPlan({
        behaviorTrees: { main: {} }
      });
      component.updateState('currentExecutionId', 'exec123');
      component.updateState('executionStatus', 'running');

      // Pause execution
      const pauseButton = container.querySelector('.pause-button');
      pauseButton.click();

      expect(executionActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'execution:pause',
        data: { executionId: 'exec123' }
      });

      // Resume execution
      component.updateState('executionStatus', 'paused');
      const resumeButton = container.querySelector('.resume-button');
      resumeButton.click();

      expect(executionActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'execution:resume',
        data: { executionId: 'exec123' }
      });

      // Stop execution
      component.updateState('executionStatus', 'running');
      const stopButton = container.querySelector('.stop-button');
      stopButton.click();

      expect(executionActor.remoteActor.send).toHaveBeenCalledWith({
        type: 'execution:stop',
        data: { executionId: 'exec123' }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle planning errors gracefully', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Simulate planning error
      await planningActor.receive({
        type: 'plan:error',
        data: {
          error: 'Failed to decompose goal: LLM service unavailable'
        }
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('planningStatus', 'error');
      expect(applicationContext.updateState).toHaveBeenCalledWith('planningError', 'Failed to decompose goal: LLM service unavailable');

      // Check error appears in logs
      const logs = container.querySelector('.execution-logs');
      expect(logs.textContent).toContain('Error');
    });

    it('should handle execution errors gracefully', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Simulate execution error
      await executionActor.receive({
        type: 'execution:error',
        data: {
          executionId: 'exec123',
          error: 'Tool execution failed: npm not found'
        }
      });

      expect(applicationContext.updateState).toHaveBeenCalledWith('executionStatus', 'error');
      expect(applicationContext.updateState).toHaveBeenCalledWith('executionError', 'Tool execution failed: npm not found');
    });

    it('should validate goal before creating plan', async () => {
      const umbilical = {
        dom: container,
        planningActor,
        executionActor
      };

      component = await PlanningWorkspacePanel.create(umbilical);

      // Try to create plan without goal
      await component.createPlan();

      // Should not call actor
      expect(planningActor.remoteActor.send).not.toHaveBeenCalled();

      // Should show error in logs
      const logs = container.querySelector('.execution-logs');
      expect(logs.textContent).toContain('Please enter a goal first');
    });
  });
});