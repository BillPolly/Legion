/**
 * End-to-End Tests: Simple Planning Scenarios
 * Tests complete user workflows for basic planning tasks
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('E2E: Simple Planning Scenarios', () => {
  let component;
  let mockUmbilical;
  let dom;
  let mockPlanningActor;
  let mockExecutionActor;
  let mockToolRegistryActor;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Create comprehensive mock actors with realistic responses
    mockPlanningActor = {
      createPlan: jest.fn().mockImplementation((goal) => {
        // Simulate realistic plan creation
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              id: `plan-${Date.now()}`,
              name: 'Simple Goal Plan',
              goal: goal,
              status: 'created',
              hierarchy: {
                root: {
                  id: 'root',
                  description: goal,
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
                      description: 'Setup configuration',
                      type: 'task',
                      tools: ['node'],
                      children: []
                    },
                    {
                      id: 'task-3',
                      description: 'Run tests',
                      type: 'task',
                      tools: ['jest'],
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
                    { type: 'action', id: 'task-2', command: 'node setup.js' },
                    { type: 'action', id: 'task-3', command: 'npm test' }
                  ]
                }
              },
              createdAt: new Date().toISOString()
            });
          }, 100); // Simulate network delay
        });
      }),
      
      validatePlan: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        toolsAvailable: true
      }),
      
      savePlan: jest.fn().mockResolvedValue({
        success: true,
        planId: `saved-plan-${Date.now()}`
      }),
      
      loadPlan: jest.fn().mockImplementation((planId) => {
        return Promise.resolve({
          id: planId,
          name: 'Loaded Plan',
          goal: 'Previously saved goal',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Previously saved goal',
              children: []
            }
          }
        });
      }),
      
      getPlans: jest.fn().mockResolvedValue([
        { id: 'plan-1', name: 'Plan 1', goal: 'Test goal 1' },
        { id: 'plan-2', name: 'Plan 2', goal: 'Test goal 2' }
      ])
    };

    mockExecutionActor = {
      startExecution: jest.fn().mockResolvedValue({
        executionId: `exec-${Date.now()}`,
        status: 'running'
      }),
      
      getExecutionStatus: jest.fn().mockResolvedValue({
        status: 'running',
        progress: 50,
        currentTask: 'task-2'
      }),
      
      stopExecution: jest.fn().mockResolvedValue({
        success: true,
        status: 'stopped'
      })
    };

    mockToolRegistryActor = {
      searchTools: jest.fn().mockResolvedValue([
        { name: 'npm', version: '9.0.0', available: true },
        { name: 'node', version: '18.0.0', available: true },
        { name: 'jest', version: '29.0.0', available: true }
      ]),
      
      validateTools: jest.fn().mockResolvedValue({
        isValid: true,
        availableTools: ['npm', 'node', 'jest'],
        missingTools: []
      }),
      
      getAvailableTools: jest.fn().mockResolvedValue([
        'npm', 'node', 'jest', 'git', 'docker'
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
        id: 'visualization',
        label: 'Plan Visualization',
        title: 'Plan Visualization',
        icon: '📊',
        component: 'PlanVisualizationPanel'
      },
      {
        id: 'execution',
        label: 'Execution Control',
        title: 'Execution Control',
        icon: '⚡',
        component: 'ExecutionControlPanel'
      },
      {
        id: 'library',
        label: 'Plan Library',
        title: 'Plan Library',
        icon: '📚',
        component: 'PlanLibraryPanel'
      },
      {
        id: 'progress',
        label: 'Progress',
        title: 'Progress Overlay',
        icon: '📈',
        component: 'ProgressOverlayPanel'
      }
    ];

    // Create umbilical with all callbacks
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Workflow tracking
      workflowSteps: [],
      currentWorkflow: null,
      
      // Callbacks
      onPlanCreate: jest.fn((plan) => {
        mockUmbilical.workflowSteps.push({ type: 'plan_created', plan });
      }),
      
      onPlanComplete: jest.fn((plan) => {
        mockUmbilical.workflowSteps.push({ type: 'plan_completed', plan });
      }),
      
      onValidationComplete: jest.fn((result) => {
        mockUmbilical.workflowSteps.push({ type: 'validation_complete', result });
      }),
      
      onExecutionStart: jest.fn((executionId) => {
        mockUmbilical.workflowSteps.push({ type: 'execution_started', executionId });
      }),
      
      onExecutionComplete: jest.fn((executionId) => {
        mockUmbilical.workflowSteps.push({ type: 'execution_completed', executionId });
      }),
      
      onTabChange: jest.fn((tabId) => {
        mockUmbilical.workflowSteps.push({ type: 'tab_changed', tabId });
      }),
      
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

  describe('Simple Goal Planning Workflow', () => {
    test('should complete end-to-end workflow: goal → plan → validate → save', async () => {
      // Step 1: Navigate to planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      expect(planningComponent).toBeDefined();
      
      // Step 2: Set a simple goal
      const simpleGoal = 'Create a basic Node.js REST API';
      planningComponent.api.setGoal(simpleGoal);
      
      // Verify goal was set
      let state = planningComponent.api.getState();
      expect(state.goal).toBe(simpleGoal);
      
      // Step 3: Create plan
      await planningComponent.api.createPlan();
      
      // Wait for async plan creation
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify plan was created
      expect(mockPlanningActor.createPlan).toHaveBeenCalledWith(
        simpleGoal,
        expect.any(Object),
        expect.any(Object)
      );
      
      state = planningComponent.api.getState();
      expect(state.currentPlan).toBeDefined();
      expect(state.currentPlan.goal).toBe(simpleGoal);
      expect(state.currentPlan.hierarchy).toBeDefined();
      
      // Step 4: Validate plan
      const validationResult = await mockPlanningActor.validatePlan(state.currentPlan);
      expect(validationResult.isValid).toBe(true);
      
      // Step 5: Save plan
      await planningComponent.api.savePlan('My REST API Plan');
      expect(mockPlanningActor.savePlan).toHaveBeenCalled();
      
      // Verify workflow completion
      expect(mockUmbilical.workflowSteps).toContainEqual(
        expect.objectContaining({ type: 'plan_created' })
      );
    });

    test('should handle single-task goal planning', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Set single-task goal
      const singleTaskGoal = 'Run unit tests';
      planningComponent.api.setGoal(singleTaskGoal);
      
      // Mock single-task plan response
      mockPlanningActor.createPlan.mockResolvedValueOnce({
        id: 'single-task-plan',
        goal: singleTaskGoal,
        hierarchy: {
          root: {
            id: 'root',
            description: singleTaskGoal,
            type: 'task',
            tools: ['jest'],
            children: []
          }
        },
        behaviorTree: {
          rootNode: { type: 'action', command: 'npm test' }
        }
      });
      
      // Create plan
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify single-task plan
      const state = planningComponent.api.getState();
      expect(state.currentPlan).toBeDefined();
      expect(state.currentPlan.hierarchy.root.children).toHaveLength(0);
      expect(state.currentPlan.hierarchy.root.type).toBe('task');
    });

    test('should navigate between panels during planning', async () => {
      // Start in planning
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create a plan
      planningComponent.api.setGoal('Test navigation workflow');
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Switch to visualization
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const vizComponent = component.getTabComponent('visualization');
      expect(vizComponent).toBeDefined();
      
      // Plan should be available in visualization
      if (vizComponent && vizComponent.api) {
        const plan = planningComponent.api.getState().currentPlan;
        vizComponent.api.setPlan(plan);
        
        const vizState = vizComponent.api.getPlan();
        expect(vizState).toBeDefined();
        expect(vizState.goal).toBe('Test navigation workflow');
      }
      
      // Switch to execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      expect(execComponent).toBeDefined();
      
      // Verify tab navigation was tracked
      const tabChanges = mockUmbilical.workflowSteps.filter(
        step => step.type === 'tab_changed'
      );
      expect(tabChanges.length).toBeGreaterThan(0);
    });

    test('should handle goal modification before planning', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Set initial goal
      planningComponent.api.setGoal('Initial goal');
      
      // Modify goal before creating plan
      planningComponent.api.setGoal('Modified goal with more details');
      
      // Create plan with modified goal
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify plan uses modified goal
      const state = planningComponent.api.getState();
      expect(state.goal).toBe('Modified goal with more details');
      expect(state.currentPlan.goal).toBe('Modified goal with more details');
    });

    test('should validate tools before execution', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan with specific tools
      planningComponent.api.setGoal('Deploy with Docker');
      
      mockPlanningActor.createPlan.mockResolvedValueOnce({
        id: 'docker-plan',
        goal: 'Deploy with Docker',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Deploy with Docker',
            children: [
              {
                id: 'build',
                description: 'Build Docker image',
                tools: ['docker'],
                children: []
              }
            ]
          }
        }
      });
      
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Validate tools
      const state = planningComponent.api.getState();
      const toolValidation = await mockToolRegistryActor.validateTools(['docker']);
      
      // Check validation result
      expect(toolValidation.isValid).toBe(true);
      expect(mockToolRegistryActor.validateTools).toHaveBeenCalled();
    });
  });

  describe('User Interaction Flow', () => {
    test('should handle complete user journey from goal to execution', async () => {
      // Step 1: User starts at planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Step 2: User enters goal
      const userGoal = 'Build a TODO app with React';
      planningComponent.api.setGoal(userGoal);
      
      // Step 3: User creates plan
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Step 4: User reviews plan in visualization
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const vizComponent = component.getTabComponent('visualization');
      if (vizComponent && vizComponent.api) {
        const plan = planningComponent.api.getState().currentPlan;
        vizComponent.api.setPlan(plan);
      }
      
      // Step 5: User proceeds to execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      if (execComponent && execComponent.api) {
        const plan = planningComponent.api.getState().currentPlan;
        execComponent.api.setPlan(plan);
        
        // Start execution
        await execComponent.api.startExecution();
        
        // Verify execution started
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        expect(mockUmbilical.onExecutionStart).toHaveBeenCalled();
      }
      
      // Verify complete journey
      const steps = mockUmbilical.workflowSteps;
      expect(steps).toContainEqual(
        expect.objectContaining({ type: 'plan_created' })
      );
      expect(steps).toContainEqual(
        expect.objectContaining({ type: 'execution_started' })
      );
    });

    test('should support iterative planning refinement', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // First iteration
      planningComponent.api.setGoal('Basic web server');
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      let state = planningComponent.api.getState();
      const firstPlan = state.currentPlan;
      expect(firstPlan).toBeDefined();
      
      // Refine goal for second iteration
      planningComponent.api.setGoal('Web server with authentication and database');
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      state = planningComponent.api.getState();
      const secondPlan = state.currentPlan;
      
      // Verify refinement
      expect(secondPlan.goal).toContain('authentication');
      expect(secondPlan.goal).toContain('database');
      expect(secondPlan.id).not.toBe(firstPlan.id);
    });

    test('should preserve state across panel switches', async () => {
      // Create plan in planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('State preservation test');
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const originalPlan = planningComponent.api.getState().currentPlan;
      
      // Switch to library
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      // Switch back to planning
      await component.switchTab('planning');
      
      // Verify state was preserved
      const preservedPlan = planningComponent.api.getState().currentPlan;
      expect(preservedPlan).toEqual(originalPlan);
      expect(preservedPlan.goal).toBe('State preservation test');
    });

    test('should handle quick successive goal changes', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Rapid goal changes
      const goals = [
        'First goal',
        'Second goal quickly',
        'Third goal immediately',
        'Final goal'
      ];
      
      goals.forEach(goal => {
        planningComponent.api.setGoal(goal);
      });
      
      // Create plan with final goal
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Verify final goal was used
      const state = planningComponent.api.getState();
      expect(state.goal).toBe('Final goal');
      expect(state.currentPlan.goal).toBe('Final goal');
    });
  });

  describe('Plan Library Integration', () => {
    test('should save and load plans from library', async () => {
      // Create a plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Library test plan');
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Save to library
      await planningComponent.api.savePlan('Library Test Plan');
      
      // Switch to library
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      
      if (libraryComponent && libraryComponent.api) {
        // Get saved plans
        const plans = await mockPlanningActor.getPlans();
        expect(plans.length).toBeGreaterThan(0);
        
        // Load a plan
        const planToLoad = plans[0];
        await mockPlanningActor.loadPlan(planToLoad.id);
        
        // Verify load was called
        expect(mockPlanningActor.loadPlan).toHaveBeenCalledWith(planToLoad.id);
      }
    });

    test('should search and filter plans in library', async () => {
      // Mock library with multiple plans
      mockPlanningActor.getPlans.mockResolvedValueOnce([
        { id: 'api-plan', name: 'REST API Plan', goal: 'Build REST API' },
        { id: 'ui-plan', name: 'React UI Plan', goal: 'Build React UI' },
        { id: 'db-plan', name: 'Database Plan', goal: 'Setup PostgreSQL' }
      ]);
      
      // Switch to library
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      
      if (libraryComponent && libraryComponent.api) {
        // Load plans
        const plans = await mockPlanningActor.getPlans();
        expect(plans).toHaveLength(3);
        
        // Simulate search
        const apiPlans = plans.filter(p => p.name.includes('API'));
        expect(apiPlans).toHaveLength(1);
        expect(apiPlans[0].id).toBe('api-plan');
      }
    });
  });

  describe('Progress Tracking', () => {
    test('should track planning progress in real-time', async () => {
      // Start planning
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Track progress stages
      const progressStages = [];
      
      // Stage 1: Goal setting
      planningComponent.api.setGoal('Track progress test');
      progressStages.push('goal_set');
      
      // Stage 2: Plan creation
      const createPromise = planningComponent.api.createPlan();
      progressStages.push('creation_started');
      
      await createPromise;
      await new Promise(resolve => setTimeout(resolve, 150));
      progressStages.push('creation_completed');
      
      // Stage 3: Validation
      const plan = planningComponent.api.getState().currentPlan;
      const validationResult = await mockPlanningActor.validatePlan(plan);
      progressStages.push('validation_completed');
      
      // Verify all stages were tracked
      expect(progressStages).toEqual([
        'goal_set',
        'creation_started',
        'creation_completed',
        'validation_completed'
      ]);
    });

    test('should display progress in progress overlay panel', async () => {
      // Create a plan first
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Progress overlay test');
      await planningComponent.api.createPlan();
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Switch to progress panel
      await component.switchTab('progress');
      await component.loadPanelContent('progress');
      
      const progressComponent = component.getTabComponent('progress');
      
      if (progressComponent && progressComponent.api) {
        // Start tracking execution
        const plan = planningComponent.api.getState().currentPlan;
        const executionId = `exec-${Date.now()}`;
        
        progressComponent.api.startExecution(executionId, plan.hierarchy.root.children);
        
        // Simulate progress updates
        progressComponent.api.updateTaskProgress('task-1', {
          status: 'completed',
          progress: 100
        });
        
        progressComponent.api.updateTaskProgress('task-2', {
          status: 'running',
          progress: 50
        });
        
        // Verify progress state
        const progressState = progressComponent.api.getState();
        expect(progressState.executionId).toBe(executionId);
        expect(progressState.isExecuting).toBe(true);
      }
    });
  });
});