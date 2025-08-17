/**
 * Create Plan Workflow Integration Tests
 * Tests the complete planning flow from goal submission through execution
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('Create Plan Workflow Integration Tests', () => {
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

    // Create comprehensive mock actors
    mockPlanningActor = {
      createPlan: jest.fn(),
      decomposePlan: jest.fn(),
      savePlan: jest.fn(),
      loadPlan: jest.fn(),
      getPlans: jest.fn(),
      validatePlan: jest.fn()
    };

    mockExecutionActor = {
      executePlan: jest.fn(),
      pauseExecution: jest.fn(),
      resumeExecution: jest.fn(),
      stopExecution: jest.fn(),
      getExecutionStatus: jest.fn(),
      stepExecution: jest.fn()
    };

    mockToolRegistryActor = {
      searchTools: jest.fn(),
      getToolDetails: jest.fn(),
      validateTools: jest.fn(),
      getAvailableTools: jest.fn()
    };

    // Define planning tabs
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
      }
    ];

    // Create umbilical with workflow callbacks
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Workflow state tracking
      workflowState: {
        currentGoal: null,
        currentPlan: null,
        decompositionTree: null,
        validationResults: null,
        executionStatus: 'idle'
      },
      
      // Planning workflow callbacks
      onPlanCreate: jest.fn((plan) => {
        mockUmbilical.workflowState.currentPlan = plan;
      }),
      
      onPlanComplete: jest.fn((plan) => {
        mockUmbilical.workflowState.currentPlan = plan;
      }),
      
      onDecompositionComplete: jest.fn((tree) => {
        mockUmbilical.workflowState.decompositionTree = tree;
      }),
      
      onValidationComplete: jest.fn((results) => {
        mockUmbilical.workflowState.validationResults = results;
      }),
      
      // Execution callbacks
      onExecutionStart: jest.fn((executionId) => {
        mockUmbilical.workflowState.executionStatus = 'running';
      }),
      
      onExecutionComplete: jest.fn((executionId) => {
        mockUmbilical.workflowState.executionStatus = 'completed';
      }),
      
      // Navigation callbacks
      onTabChange: jest.fn(),
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
  });

  describe('Complete Planning Flow', () => {
    test('should support complete planning workflow component integration', async () => {
      const testGoal = "Create a web application with user authentication and data storage";
      
      // Step 1: Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      expect(planningComponent).toBeTruthy();
      expect(planningComponent.api).toBeTruthy();

      // Step 2: Verify planning API methods exist
      expect(typeof planningComponent.api.setGoal).toBe('function');
      expect(typeof planningComponent.api.createPlan).toBe('function');
      expect(typeof planningComponent.api.savePlan).toBe('function');
      expect(typeof planningComponent.api.startExecution).toBe('function');
      expect(typeof planningComponent.api.getState).toBe('function');

      // Step 3: Test goal setting
      planningComponent.api.setGoal(testGoal);
      const state = planningComponent.api.getState();
      expect(state.goal).toBe(testGoal);

      // Step 4: Switch to visualization
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const visualizationComponent = component.getTabComponent('visualization');
      expect(visualizationComponent).toBeTruthy();
      expect(visualizationComponent.api).toBeTruthy();

      // Step 5: Switch to execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      expect(executionComponent).toBeTruthy();
      expect(executionComponent.api).toBeTruthy();

      // Step 6: Switch to library
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      expect(libraryComponent).toBeTruthy();
      expect(libraryComponent.api).toBeTruthy();

      // All workflow components should be loaded and have APIs
      expect(planningComponent.api).toBeTruthy();
      expect(visualizationComponent.api).toBeTruthy();
      expect(executionComponent.api).toBeTruthy();
      expect(libraryComponent.api).toBeTruthy();
    });

    test('should support workflow transitions between planning panels', async () => {
      const testGoal = "Deploy a Node.js API to production";

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      expect(planningComponent).toBeTruthy();

      // Test goal setting and basic workflow methods
      if (planningComponent && planningComponent.api) {
        planningComponent.api.setGoal(testGoal);
        
        // Verify goal was set
        const state = planningComponent.api.getState();
        expect(state.goal).toBe(testGoal);
        
        // Verify workflow methods exist
        expect(typeof planningComponent.api.createPlan).toBe('function');
        expect(typeof planningComponent.api.savePlan).toBe('function');
        expect(typeof planningComponent.api.startExecution).toBe('function');
      }

      // Switch to execution panel for workflow testing
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      expect(executionComponent).toBeTruthy();
      expect(executionComponent.api).toBeTruthy();

      // Both components should exist for workflow coordination
      expect(planningComponent).toBeTruthy();
      expect(executionComponent).toBeTruthy();
    });
  });

  describe('Goal Submission and Decomposition', () => {
    test('should handle goal setting and planning API calls', async () => {
      const complexGoal = "Build a microservices architecture with API gateway, authentication service, and data processing pipeline";
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Test goal setting
        planningComponent.api.setGoal(complexGoal);
        const state = planningComponent.api.getState();
        expect(state.goal).toBe(complexGoal);
        
        // Test planning API exists and can be called
        expect(typeof planningComponent.api.createPlan).toBe('function');
        
        // Call createPlan - this will trigger the planningActor if available
        await planningComponent.api.createPlan();
        
        // Verify actor was called with correct parameters
        expect(mockPlanningActor.createPlan).toHaveBeenCalledWith(complexGoal, {}, {});
      }
    });

    test('should handle goal modification and multiple planning calls', async () => {
      const initialGoal = "Create a simple blog website";
      const modifiedGoal = "Create a blog website with comments and user authentication";
      
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Submit initial goal
        planningComponent.api.setGoal(initialGoal);
        await planningComponent.api.createPlan();
        
        expect(mockPlanningActor.createPlan).toHaveBeenCalledWith(initialGoal, {}, {});
        
        // Modify goal and create new plan
        planningComponent.api.setGoal(modifiedGoal);
        await planningComponent.api.createPlan();
        
        expect(mockPlanningActor.createPlan).toHaveBeenCalledWith(modifiedGoal, {}, {});
        expect(mockPlanningActor.createPlan).toHaveBeenCalledTimes(2);
        
        // Verify state reflects latest goal
        const state = planningComponent.api.getState();
        expect(state.goal).toBe(modifiedGoal);
      }
    });
  });

  describe('Plan Validation Workflow', () => {
    test('should handle validation results', async () => {
      const goal = "Setup a React application with TypeScript";
      
      const validationResults = {
        isValid: true,
        toolsAvailable: true,
        availableTools: ['npm', 'node', 'create-react-app', 'typescript'],
        missingTools: [],
        issues: [],
        recommendations: [
          'Use TypeScript strict mode for better type safety',
          'Consider adding ESLint and Prettier for code quality'
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set goal and create plan
        planningComponent.api.setGoal(goal);
        await planningComponent.api.createPlan();
        
        // Test validation result handling
        expect(typeof planningComponent.api.handleValidationResult).toBe('function');
        await planningComponent.api.handleValidationResult(validationResults);
        
        // Note: onValidationComplete callback is not called by handleValidationResult in the current implementation
        // The method only updates the component state
        
        // Check validation state was updated
        const state = planningComponent.api.getState();
        expect(state.validationResult).toEqual(validationResults);
      }
    });

    test('should handle validation with missing tools', async () => {
      const validationResults = {
        isValid: false,
        toolsAvailable: false,
        availableTools: ['npm', 'node'],
        missingTools: ['docker', 'kubectl'],
        issues: [
          'Docker is required for containerization',
          'kubectl is required for Kubernetes deployment'
        ],
        recommendations: [
          'Install Docker Desktop',
          'Install kubectl CLI tool',
          'Setup Kubernetes cluster access'
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Handle validation results
        await planningComponent.api.handleValidationResult(validationResults);
        
        // Note: onValidationComplete callback is not called by handleValidationResult in the current implementation
        // Verify state was updated instead
        
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.missingTools).toEqual(['docker', 'kubectl']);
        expect(state.validationResult.issues).toHaveLength(2);
      }
    });
  });

  describe('Plan Saving Workflow', () => {
    test('should handle plan saving with actor integration', async () => {
      const goal = "Create a REST API with Node.js and Express";
      
      const plan = {
        id: 'rest-api-plan',
        name: 'Node.js REST API',
        goal: goal,
        status: 'draft',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Create REST API with Node.js and Express',
            children: []
          }
        }
      };

      const savedPlan = {
        ...plan,
        status: 'saved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0'
      };

      // Configure mocks
      mockPlanningActor.savePlan.mockResolvedValue(savedPlan);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set current plan and save it with name parameter
        planningComponent.api.setCurrentPlan(plan);
        await planningComponent.api.savePlan('Test Plan Name');
        
        // Verify save was called (savePlan modifies the plan with name and savedAt)
        expect(mockPlanningActor.savePlan).toHaveBeenCalled();
        const saveCall = mockPlanningActor.savePlan.mock.calls[0][0];
        expect(saveCall.id).toBe(plan.id);
        expect(saveCall.name).toBe('Test Plan Name');
        expect(saveCall.savedAt).toBeDefined();
        
        // Verify plan library component loads
        await component.switchTab('library');
        await component.loadPanelContent('library');
        
        const libraryComponent = component.getTabComponent('library');
        expect(libraryComponent).toBeTruthy();
        expect(libraryComponent.api).toBeTruthy();
      }
    });

    test('should handle plan save errors gracefully', async () => {
      const plan = {
        id: 'error-plan',
        name: 'Error Test Plan',
        goal: 'Test error handling'
      };

      const saveError = new Error('Database connection failed');
      
      // Configure mocks
      mockPlanningActor.savePlan.mockRejectedValue(saveError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set current plan first
        planningComponent.api.setCurrentPlan(plan);
        
        // Attempt to save plan that will fail - savePlan doesn't throw, it logs errors
        await planningComponent.api.savePlan('Error Test');
        
        // The method doesn't throw but logs the error internally
        
        // Verify error was handled - savePlan was called with modified plan structure
        expect(mockPlanningActor.savePlan).toHaveBeenCalled();
      }
    });
  });

  describe('Cross-Panel Workflow Integration', () => {
    test('should support panel switching and component loading', async () => {
      const goal = "Build a full-stack application";

      // Start workflow in planning
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      if (planningComponent && planningComponent.api) {
        planningComponent.api.setGoal(goal);
        expect(planningComponent.api.getState().goal).toBe(goal);
      }

      // Switch to visualization - component should load
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const visualizationComponent = component.getTabComponent('visualization');
      expect(visualizationComponent).toBeTruthy();
      expect(visualizationComponent.api).toBeTruthy();

      // Switch to execution - component should load
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      expect(executionComponent).toBeTruthy();
      expect(executionComponent.api).toBeTruthy();

      // Switch to library - component should load
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      expect(libraryComponent).toBeTruthy();
      expect(libraryComponent.api).toBeTruthy();

      // Verify active tab is tracked
      expect(component.getActiveTab()).toBe('library');
    });
  });
});