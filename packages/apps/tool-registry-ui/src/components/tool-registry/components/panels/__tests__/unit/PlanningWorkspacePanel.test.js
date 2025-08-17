/**
 * Unit tests for PlanningWorkspacePanel Component
 * Tests MVVM pattern implementation for planning workspace
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock the UmbilicalUtils
jest.mock('/legion/frontend-components/src/umbilical/index.js', () => ({
  UmbilicalUtils: {
    validateCapabilities: jest.fn((umbilical, requirements) => {
      // Mock validation - just pass through
      return true;
    }),
    createRequirements: () => ({
      add: jest.fn(),
      validate: jest.fn()
    })
  }
}));

describe('PlanningWorkspacePanel', () => {
  let mockUmbilical;
  let mockContainer;
  let component;

  beforeEach(() => {
    // Create mock DOM container
    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Create mock umbilical
    mockUmbilical = {
      dom: mockContainer,
      planningActor: {
        createPlan: jest.fn(),
        savePlan: jest.fn(),
        loadPlan: jest.fn(),
        validatePlan: jest.fn(),
        getCurrentPlan: jest.fn()
      },
      executionActor: {
        startExecution: jest.fn(),
        pauseExecution: jest.fn(),
        resumeExecution: jest.fn(),
        stopExecution: jest.fn()
      },
      onMount: jest.fn(),
      onDestroy: jest.fn(),
      onPlanComplete: jest.fn(),
      onExecutionComplete: jest.fn()
    };
  });

  afterEach(() => {
    document.body.removeChild(mockContainer);
    jest.clearAllMocks();
  });

  describe('Model', () => {
    it('should initialize with default state', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const state = instance.getState();
      expect(state.goal).toBe('');
      expect(state.planningStatus).toBe('idle');
      expect(state.currentPlan).toBeNull();
      expect(state.decompositionTree).toBeNull();
      expect(state.validationResult).toBeNull();
      expect(state.executionStatus).toBe('idle');
    });

    it('should update goal state', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.setGoal('Build a web application');
      expect(instance.getState('goal')).toBe('Build a web application');
    });

    it('should update planning status', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.updateState('planningStatus', 'decomposing');
      expect(instance.getState('planningStatus')).toBe('decomposing');
    });

    it('should store decomposition tree', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const tree = {
        root: {
          id: 'root',
          description: 'Build app',
          complexity: 'COMPLEX',
          children: []
        }
      };
      
      instance.setDecompositionTree(tree);
      expect(instance.getState('decompositionTree')).toEqual(tree);
    });
  });

  describe('View', () => {
    it('should render goal input section', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const goalInput = mockContainer.querySelector('.goal-input-section');
      expect(goalInput).toBeTruthy();
      
      const textarea = mockContainer.querySelector('.goal-textarea');
      expect(textarea).toBeTruthy();
      expect(textarea.placeholder).toContain('Enter your goal');
    });

    it('should render planning controls', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const planButton = mockContainer.querySelector('.plan-button');
      expect(planButton).toBeTruthy();
      expect(planButton.textContent).toBe('Create Plan');
    });

    it('should render decomposition tree area', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const treeArea = mockContainer.querySelector('.decomposition-tree');
      expect(treeArea).toBeTruthy();
    });

    it('should render validation panel', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const validationPanel = mockContainer.querySelector('.validation-panel');
      expect(validationPanel).toBeTruthy();
    });

    it('should render execution console', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const console = mockContainer.querySelector('.execution-console');
      expect(console).toBeTruthy();
      
      const controls = mockContainer.querySelector('.execution-controls');
      expect(controls).toBeTruthy();
    });

    it('should update UI when planning status changes', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.updateState('planningStatus', 'decomposing');
      
      const statusIndicator = mockContainer.querySelector('.planning-status');
      expect(statusIndicator.textContent).toContain('Decomposing');
      
      const planButton = mockContainer.querySelector('.plan-button');
      expect(planButton.disabled).toBe(true);
    });
  });

  describe('ViewModel', () => {
    it('should handle plan creation', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.setGoal('Build a REST API');
      await instance.createPlan();
      
      expect(mockUmbilical.planningActor.createPlan).toHaveBeenCalledWith(
        'Build a REST API',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle decomposition node updates', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const node = {
        id: 'task1',
        description: 'Setup database',
        complexity: 'SIMPLE'
      };
      
      instance.handleDecompositionNode({ node, level: 1 });
      
      const treeNode = mockContainer.querySelector(`[data-node-id="task1"]`);
      expect(treeNode).toBeTruthy();
    });

    it('should handle validation results', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const validationResult = {
        valid: true,
        feasibility: {
          overallFeasible: true,
          feasibleTasks: ['task1', 'task2'],
          infeasibleTasks: []
        }
      };
      
      instance.handleValidationResult(validationResult);
      
      expect(instance.getState('validationResult')).toEqual(validationResult);
      
      const validationStatus = mockContainer.querySelector('.validation-status');
      expect(validationStatus.classList.contains('valid')).toBe(true);
    });

    it('should handle plan completion', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const plan = {
        hierarchy: { root: {} },
        validation: { valid: true },
        behaviorTrees: {}
      };
      
      instance.handlePlanComplete(plan);
      
      expect(instance.getState('currentPlan')).toEqual(plan);
      expect(instance.getState('planningStatus')).toBe('complete');
      
      const executeButton = mockContainer.querySelector('.execute-button');
      expect(executeButton.disabled).toBe(false);
    });

    it('should handle execution start', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const plan = {
        hierarchy: { root: {} },
        behaviorTrees: { main: {} }
      };
      instance.setCurrentPlan(plan);
      
      await instance.startExecution();
      
      expect(mockUmbilical.executionActor.startExecution).toHaveBeenCalledWith(
        expect.any(String),
        plan.behaviorTrees.main,
        expect.any(Object)
      );
    });

    it('should handle execution controls', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.updateState('currentExecutionId', 'exec123');
      
      await instance.pauseExecution();
      expect(mockUmbilical.executionActor.pauseExecution).toHaveBeenCalledWith('exec123');
      
      await instance.resumeExecution();
      expect(mockUmbilical.executionActor.resumeExecution).toHaveBeenCalledWith('exec123');
      
      await instance.stopExecution();
      expect(mockUmbilical.executionActor.stopExecution).toHaveBeenCalledWith('exec123');
    });

    it('should handle task tree interactions', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const tree = {
        root: {
          id: 'root',
          description: 'Main task',
          complexity: 'COMPLEX',
          children: [
            { id: 'child1', description: 'Subtask 1', complexity: 'SIMPLE' },
            { id: 'child2', description: 'Subtask 2', complexity: 'SIMPLE' }
          ]
        }
      };
      
      instance.setDecompositionTree(tree);
      instance.toggleNode('root');
      
      const rootNode = mockContainer.querySelector('[data-node-id="root"]');
      expect(rootNode.classList.contains('collapsed')).toBe(true);
    });

    it('should display execution logs', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.addExecutionLog('Task started', 'info');
      instance.addExecutionLog('Error occurred', 'error');
      
      const logs = mockContainer.querySelectorAll('.execution-log-entry');
      expect(logs.length).toBe(2);
      
      const errorLog = mockContainer.querySelector('.execution-log-entry.error');
      expect(errorLog.textContent).toContain('Error occurred');
    });

    it('should handle save and load operations', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      const plan = {
        name: 'Test Plan',
        hierarchy: { root: {} }
      };
      instance.setCurrentPlan(plan);
      
      await instance.savePlan('Test Plan');
      expect(mockUmbilical.planningActor.savePlan).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Plan' })
      );
      
      await instance.loadPlan('plan123');
      expect(mockUmbilical.planningActor.loadPlan).toHaveBeenCalledWith('plan123');
    });
  });

  describe('Integration', () => {
    it('should integrate with planning actor', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      expect(mockUmbilical.onMount).toHaveBeenCalledWith(
        expect.objectContaining({
          createPlan: expect.any(Function),
          savePlan: expect.any(Function),
          loadPlan: expect.any(Function),
          startExecution: expect.any(Function)
        })
      );
    });

    it('should clean up on destroy', async () => {
      const { PlanningWorkspacePanel } = await import('../../PlanningWorkspacePanel.js');
      const instance = await PlanningWorkspacePanel.create(mockUmbilical);
      
      instance.destroy();
      
      expect(mockUmbilical.onDestroy).toHaveBeenCalled();
      expect(mockContainer.innerHTML).toBe('');
    });
  });
});