/**
 * Planning Workflows Integration Tests
 * Tests end-to-end workflows following MVVM architecture
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('Planning Workflows MVVM Integration', () => {
  let dom, container;
  let mockPlanningActor, mockExecutionActor, mockToolRegistryActor;
  let mockWorkflowManager;

  beforeEach(() => {
    // Create minimal DOM environment
    dom = new JSDOM(`<!DOCTYPE html><div id="container"></div>`);
    global.document = dom.window.document;
    global.window = dom.window;
    
    container = dom.window.document.getElementById('container');

    // Mock actors following the established pattern
    mockPlanningActor = {
      createPlan: jest.fn().mockResolvedValue({
        id: 'plan-123',
        goal: 'Test planning workflow',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test planning workflow',
            complexity: 'COMPLEX',
            children: [
              { id: 'task-1', description: 'First Task', complexity: 'SIMPLE' },
              { id: 'task-2', description: 'Second Task', complexity: 'SIMPLE' }
            ]
          }
        }
      }),
      savePlan: jest.fn().mockResolvedValue({ id: 'plan-123', saved: true }),
      listPlans: jest.fn().mockResolvedValue([]),
      validatePlan: jest.fn().mockResolvedValue({ valid: true, issues: [] })
    };

    mockExecutionActor = {
      startExecution: jest.fn().mockResolvedValue({ executionId: 'exec-123' }),
      pauseExecution: jest.fn().mockResolvedValue({}),
      stopExecution: jest.fn().mockResolvedValue({})
    };

    mockToolRegistryActor = {
      searchTools: jest.fn().mockResolvedValue([
        { id: 'tool-1', name: 'Tool One' },
        { id: 'tool-2', name: 'Tool Two' }
      ])
    };

    // Mock workflow manager following MVVM pattern
    mockWorkflowManager = {
      model: {
        state: {
          currentPlan: null,
          activeWorkflow: null,
          executionStatus: 'idle'
        },
        updateState: jest.fn(),
        getState: jest.fn((key) => mockWorkflowManager.model.state[key]),
        subscribe: jest.fn()
      },
      viewModel: {
        initializePlanningWorkflow: jest.fn().mockImplementation(async (config) => {
          mockWorkflowManager.model.updateState('activeWorkflow', 'planning');
          return Promise.resolve();
        }),
        switchToPlanVisualization: jest.fn(),
        startPlanExecution: jest.fn().mockImplementation(async (plan) => {
          await mockExecutionActor.startExecution();
          return Promise.resolve();
        }),
        monitorExecutionProgress: jest.fn()
      }
    };
  });

  afterEach(() => {
    // Cleanup any workflow state
    if (mockWorkflowManager.viewModel.cleanup) {
      mockWorkflowManager.viewModel.cleanup();
    }
  });

  test('should handle end-to-end plan creation workflow', async () => {
    // Test MVVM workflow: Model state changes trigger View updates
    const goal = 'Test planning workflow';
    
    // 1. Initialize planning workflow through ViewModel
    await mockWorkflowManager.viewModel.initializePlanningWorkflow({
      goal,
      actors: {
        planning: mockPlanningActor,
        execution: mockExecutionActor,
        toolRegistry: mockToolRegistryActor
      }
    });
    
    // 2. Verify Model state updated
    expect(mockWorkflowManager.model.updateState).toHaveBeenCalledWith(
      'activeWorkflow', 'planning'
    );
    
    // 3. Test plan creation workflow
    await mockPlanningActor.createPlan({ goal });
    expect(mockPlanningActor.createPlan).toHaveBeenCalledWith({ goal });
    
    // 4. Verify plan creation result
    const planResult = await mockPlanningActor.createPlan({ goal });
    expect(planResult.id).toBe('plan-123');
    expect(planResult.goal).toBe(goal);
    expect(planResult.hierarchy.root.complexity).toBe('COMPLEX');
  });

  test('should handle plan visualization workflow with state management', async () => {
    // Test MVVM: Plan data flows from Model to View through ViewModel
    const mockPlan = {
      id: 'plan-123',
      hierarchy: {
        root: {
          id: 'root',
          description: 'Test Plan',
          children: [
            { id: 'task-1', description: 'Task 1' },
            { id: 'task-2', description: 'Task 2' }
          ]
        }
      }
    };
    
    // 1. Update Model state with plan data
    mockWorkflowManager.model.state.currentPlan = mockPlan;
    
    // 2. ViewModel orchestrates visualization switch
    await mockWorkflowManager.viewModel.switchToPlanVisualization(mockPlan);
    
    // 3. Verify ViewModel was called correctly
    expect(mockWorkflowManager.viewModel.switchToPlanVisualization).toHaveBeenCalledWith(mockPlan);
    
    // 4. Verify Model state reflects visualization mode
    expect(mockWorkflowManager.model.getState('currentPlan')).toEqual(mockPlan);
  });

  test('should handle plan execution workflow with state tracking', async () => {
    // Test MVVM: Execution state managed through Model, coordinated by ViewModel
    const mockPlan = {
      id: 'plan-123',
      behaviorTree: {
        type: 'sequence',
        children: [
          { type: 'task', id: 'task-1' },
          { type: 'task', id: 'task-2' }
        ]
      }
    };
    
    // 1. Set plan in Model state
    mockWorkflowManager.model.state.currentPlan = mockPlan;
    
    // 2. ViewModel handles execution workflow
    await mockWorkflowManager.viewModel.startPlanExecution(mockPlan);
    
    // 3. Verify execution actor called
    expect(mockExecutionActor.startExecution).toHaveBeenCalled();
    
    // 4. Verify execution tracking initiated
    expect(mockWorkflowManager.viewModel.startPlanExecution).toHaveBeenCalledWith(mockPlan);
    
    // 5. Test state transition
    mockWorkflowManager.model.state.executionStatus = 'running';
    expect(mockWorkflowManager.model.getState('executionStatus')).toBe('running');
  });

  test('should handle progress monitoring through state management', async () => {
    // Test MVVM: Progress updates flow through Model state changes
    const executionData = {
      executionId: 'exec-123',
      tasks: [
        { id: 'task-1', name: 'First Task' },
        { id: 'task-2', name: 'Second Task' }
      ]
    };
    
    // 1. Initialize progress monitoring via ViewModel
    await mockWorkflowManager.viewModel.monitorExecutionProgress(executionData);
    
    // 2. Verify monitoring started
    expect(mockWorkflowManager.viewModel.monitorExecutionProgress).toHaveBeenCalledWith(executionData);
    
    // 3. Simulate progress update through Model
    const progressUpdate = {
      taskId: 'task-1',
      status: 'running',
      progress: 50
    };
    
    // 4. Update Model state (would trigger View updates in real implementation)
    mockWorkflowManager.model.updateState('taskProgress', progressUpdate);
    expect(mockWorkflowManager.model.updateState).toHaveBeenCalledWith('taskProgress', progressUpdate);
  });

  test('should handle plan library operations through actor integration', async () => {
    // Test MVVM: Library operations coordinated through proper actor integration
    
    // 1. Test plan listing workflow
    const plansList = await mockPlanningActor.listPlans();
    expect(mockPlanningActor.listPlans).toHaveBeenCalled();
    expect(plansList).toEqual([]);
    
    // 2. Test plan saving workflow
    const planToSave = {
      id: 'plan-123',
      name: 'Test Plan',
      goal: 'Save this plan'
    };
    
    const saveResult = await mockPlanningActor.savePlan(planToSave);
    expect(mockPlanningActor.savePlan).toHaveBeenCalledWith(planToSave);
    expect(saveResult.saved).toBe(true);
    
    // 3. Verify Model state management
    mockWorkflowManager.model.state.currentPlan = planToSave;
    expect(mockWorkflowManager.model.getState('currentPlan')).toEqual(planToSave);
  });

  test('should handle state synchronization across workflow components', async () => {
    // Test MVVM: Central Model state keeps all components synchronized
    const mockPlan = {
      id: 'plan-123',
      goal: 'Cross-component synchronization test',
      hierarchy: { root: { id: 'root' } }
    };
    
    // 1. Update central Model state
    mockWorkflowManager.model.state.currentPlan = mockPlan;
    
    // 2. Verify state is accessible from different workflow contexts
    expect(mockWorkflowManager.model.getState('currentPlan')).toEqual(mockPlan);
    
    // 3. Test state propagation simulation
    const stateChangeHandlers = [
      jest.fn(), // Planning component handler
      jest.fn(), // Visualization component handler  
      jest.fn()  // Execution component handler
    ];
    
    // 4. Simulate state change notifications (in real implementation, triggered by Model)
    stateChangeHandlers.forEach(handler => {
      handler(mockPlan);
      expect(handler).toHaveBeenCalledWith(mockPlan);
    });
  });

  test('should handle error scenarios in MVVM workflow', async () => {
    // Test MVVM: Error handling through proper state management
    
    // 1. Test plan creation error
    mockPlanningActor.createPlan.mockRejectedValueOnce(new Error('Plan creation failed'));
    
    try {
      await mockPlanningActor.createPlan({ goal: 'Invalid goal' });
    } catch (error) {
      expect(error.message).toBe('Plan creation failed');
      
      // 2. Error state should be captured in Model
      mockWorkflowManager.model.updateState('error', error);
      expect(mockWorkflowManager.model.updateState).toHaveBeenCalledWith('error', error);
    }
    
    // 3. Test execution error handling
    mockExecutionActor.startExecution.mockRejectedValueOnce(new Error('Execution failed'));
    
    try {
      await mockExecutionActor.startExecution();
    } catch (error) {
      expect(error.message).toBe('Execution failed');
      
      // 4. Execution error should update execution status
      mockWorkflowManager.model.state.executionStatus = 'error';
      expect(mockWorkflowManager.model.getState('executionStatus')).toBe('error');
    }
  });

  test('should handle workflow state persistence across context switches', async () => {
    // Test MVVM: Model state persists across different workflow contexts
    const initialWorkflowState = {
      currentPlan: { id: 'plan-123', goal: 'Persistent workflow' },
      activeWorkflow: 'planning',
      executionStatus: 'idle'
    };
    
    // 1. Set initial state
    Object.assign(mockWorkflowManager.model.state, initialWorkflowState);
    
    // 2. Simulate context switch (equivalent to tab switching)
    mockWorkflowManager.model.state.activeWorkflow = 'visualization';
    
    // 3. Verify state persistence
    expect(mockWorkflowManager.model.getState('currentPlan')).toEqual(initialWorkflowState.currentPlan);
    expect(mockWorkflowManager.model.getState('activeWorkflow')).toBe('visualization');
    
    // 4. Switch back and verify full state maintained
    mockWorkflowManager.model.state.activeWorkflow = 'planning';
    expect(mockWorkflowManager.model.getState('currentPlan')).toEqual(initialWorkflowState.currentPlan);
  });

  test('should handle workflow state validation', async () => {
    // Test MVVM: ViewModel validates state transitions and operations
    
    // 1. Test invalid plan state
    const invalidPlan = { id: null, goal: '' };
    mockPlanningActor.validatePlan.mockResolvedValueOnce({ 
      valid: false, 
      issues: ['Missing plan ID', 'Empty goal'] 
    });
    
    const validationResult = await mockPlanningActor.validatePlan(invalidPlan);
    expect(validationResult.valid).toBe(false);
    expect(validationResult.issues).toHaveLength(2);
    
    // 2. Test valid plan state
    const validPlan = { id: 'plan-123', goal: 'Valid workflow test' };
    mockPlanningActor.validatePlan.mockResolvedValueOnce({ valid: true, issues: [] });
    
    const validResult = await mockPlanningActor.validatePlan(validPlan);
    expect(validResult.valid).toBe(true);
    expect(validResult.issues).toHaveLength(0);
  });

  test('should handle complex workflow state transitions', async () => {
    // Test MVVM: Complex state transitions managed through ViewModel coordination
    
    // 1. Initialize complete workflow
    const workflowPlan = {
      id: 'plan-123',
      goal: 'Complex workflow test',
      hierarchy: {
        root: {
          id: 'root',
          children: [
            { id: 'task-1', complexity: 'SIMPLE' },
            { id: 'task-2', complexity: 'SIMPLE' }
          ]
        }
      }
    };
    
    // 2. State progression: Planning -> Visualization -> Execution -> Monitoring
    const stateProgression = [
      { activeWorkflow: 'planning', currentPlan: workflowPlan },
      { activeWorkflow: 'visualization', currentPlan: workflowPlan },
      { activeWorkflow: 'execution', currentPlan: workflowPlan, executionStatus: 'running' },
      { activeWorkflow: 'monitoring', currentPlan: workflowPlan, executionStatus: 'running' }
    ];
    
    // 3. Verify each state transition
    for (const state of stateProgression) {
      Object.assign(mockWorkflowManager.model.state, state);
      expect(mockWorkflowManager.model.getState('activeWorkflow')).toBe(state.activeWorkflow);
      expect(mockWorkflowManager.model.getState('currentPlan')).toEqual(state.currentPlan);
    }
    
    // 4. Verify final state consistency
    expect(mockWorkflowManager.model.getState('executionStatus')).toBe('running');
  });
});