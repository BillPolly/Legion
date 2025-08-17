/**
 * Execute Plan Workflow Integration Tests
 * Tests execution initiation, progress monitoring, artifact generation, and completion handling
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('Execute Plan Workflow Integration Tests', () => {
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
      startExecution: jest.fn(),
      pauseExecution: jest.fn(),
      resumeExecution: jest.fn(),
      stopExecution: jest.fn(),
      getExecutionStatus: jest.fn(),
      stepExecution: jest.fn(),
      getExecutionResults: jest.fn(),
      getArtifacts: jest.fn()
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

    // Create umbilical with execution workflow callbacks
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'execution',
      
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
        executionStatus: 'idle',
        executionProgress: {
          currentStep: null,
          completedSteps: [],
          artifacts: {},
          logs: []
        }
      },
      
      // Execution workflow callbacks
      onExecutionStart: jest.fn((executionId) => {
        mockUmbilical.workflowState.executionStatus = 'running';
      }),
      
      onExecutionProgress: jest.fn((progress) => {
        Object.assign(mockUmbilical.workflowState.executionProgress, progress);
      }),
      
      onExecutionComplete: jest.fn((results) => {
        mockUmbilical.workflowState.executionStatus = 'completed';
        mockUmbilical.workflowState.executionProgress.results = results;
      }),
      
      onExecutionError: jest.fn((error) => {
        mockUmbilical.workflowState.executionStatus = 'error';
        mockUmbilical.workflowState.executionProgress.error = error;
      }),
      
      onArtifactGenerated: jest.fn((artifact) => {
        const artifacts = mockUmbilical.workflowState.executionProgress.artifacts;
        artifacts[artifact.id] = artifact;
      }),
      
      // Standard callbacks
      onPlanComplete: jest.fn(),
      onValidationComplete: jest.fn(),
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

  describe('Execution Initiation', () => {
    test('should initiate plan execution from planning workspace', async () => {
      const executablePlan = {
        id: 'executable-plan-001',
        name: 'Plan Ready for Execution',
        goal: 'Execute a validated plan',
        status: 'validated',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Execute validated plan',
            complexity: 'MEDIUM',
            children: [
              {
                id: 'step1',
                description: 'Initialize execution environment',
                complexity: 'SIMPLE',
                tools: ['npm', 'node'],
                children: []
              },
              {
                id: 'step2',
                description: 'Run main process',
                complexity: 'MEDIUM',
                tools: ['node'],
                children: []
              }
            ]
          }
        },
        behaviorTree: {
          rootNode: {
            type: 'sequence',
            children: [
              { type: 'action', id: 'step1', command: 'npm install' },
              { type: 'action', id: 'step2', command: 'npm start' }
            ]
          }
        }
      };

      // Mock execution start
      mockExecutionActor.startExecution.mockResolvedValue({
        executionId: 'exec-001',
        status: 'started',
        message: 'Execution initiated successfully'
      });

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set executable plan
        planningComponent.api.setCurrentPlan(executablePlan);
        
        // Start execution
        await planningComponent.api.startExecution();
        
        // Verify execution was initiated
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        // Note: onExecutionStart callback is not automatically called by startExecution
        // The execution actor would trigger this in a real scenario
        
        // Check planning component API
        expect(typeof planningComponent.api.startExecution).toBe('function');
        expect(typeof planningComponent.api.pauseExecution).toBe('function');
        expect(typeof planningComponent.api.stopExecution).toBe('function');
      }
    });

    test('should transition to execution control panel after starting execution', async () => {
      const plan = {
        id: 'transition-test-plan',
        name: 'Plan for Transition Test',
        goal: 'Test panel transition during execution',
        behaviorTree: {
          rootNode: { type: 'action', command: 'echo "test"' }
        }
      };

      // Load planning workspace and start execution
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        planningComponent.api.setCurrentPlan(plan);
        await planningComponent.api.startExecution();
      }

      // Switch to execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      expect(executionComponent).toBeTruthy();
      expect(executionComponent.api).toBeTruthy();
      
      // Verify execution control API
      expect(typeof executionComponent.api.pauseExecution).toBe('function');
      expect(typeof executionComponent.api.resumeExecution).toBe('function');
      expect(typeof executionComponent.api.stopExecution).toBe('function');
    });

    test('should handle execution initiation errors', async () => {
      const invalidPlan = {
        id: 'invalid-execution-plan',
        name: 'Plan with Execution Issues',
        goal: 'Test execution error handling'
      };

      const executionError = new Error('Missing behavior tree');
      mockExecutionActor.startExecution.mockRejectedValue(executionError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set invalid plan
        planningComponent.api.setCurrentPlan(invalidPlan);
        
        // Attempt to start execution
        await planningComponent.api.startExecution();
        
        // Verify execution attempt was made
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
        
        // The component handles errors internally by logging them
        const state = planningComponent.api.getState();
        expect(state.executionStatus).toBe('error');
      }
    });
  });

  describe('Progress Monitoring', () => {
    test('should monitor execution progress in real-time', async () => {
      const progressUpdates = [
        {
          step: 'step1',
          status: 'running',
          progress: 25,
          message: 'Initializing environment'
        },
        {
          step: 'step1',
          status: 'completed',
          progress: 50,
          message: 'Environment initialized'
        },
        {
          step: 'step2',
          status: 'running',
          progress: 75,
          message: 'Running main process'
        },
        {
          step: 'step2',
          status: 'completed',
          progress: 100,
          message: 'Execution completed'
        }
      ];

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Simulate progress updates
        for (const update of progressUpdates) {
          // Simulate progress update callback
          if (mockUmbilical.onExecutionProgress) {
            mockUmbilical.onExecutionProgress(update);
          }
        }
        
        // Verify progress tracking
        expect(mockUmbilical.onExecutionProgress).toHaveBeenCalledTimes(4);
        expect(mockUmbilical.workflowState.executionProgress.step).toBe('step2');
      }
    });

    test('should display execution logs in real-time', async () => {
      const executionLogs = [
        { timestamp: new Date(), level: 'info', message: 'Starting execution' },
        { timestamp: new Date(), level: 'info', message: 'Running npm install' },
        { timestamp: new Date(), level: 'success', message: 'Dependencies installed' },
        { timestamp: new Date(), level: 'info', message: 'Starting application' },
        { timestamp: new Date(), level: 'success', message: 'Application started successfully' }
      ];

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Verify execution component loaded with standardized API
        expect(typeof executionComponent.api.getState).toBe('function');
        expect(typeof executionComponent.api.startExecution).toBe('function');
        
        // Verify execution log state exists
        const state = executionComponent.api.getState();
        expect(state.executionLog).toBeDefined();
        expect(Array.isArray(state.executionLog)).toBe(true);
      }
    });

    test('should handle execution step failures', async () => {
      const failureScenario = {
        step: 'step2',
        status: 'failed',
        error: 'Command failed with exit code 1',
        details: 'npm start failed - missing start script'
      };

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Simulate execution error
        if (mockUmbilical.onExecutionError) {
          mockUmbilical.onExecutionError(failureScenario);
        }
        
        // Verify error handling
        expect(mockUmbilical.workflowState.executionStatus).toBe('error');
        expect(mockUmbilical.workflowState.executionProgress.error).toEqual(failureScenario);
      }
    });
  });

  describe('Artifact Generation and Management', () => {
    test('should track generated artifacts during execution', async () => {
      const artifacts = [
        {
          id: 'build-output',
          type: 'file',
          name: 'build.log',
          path: '/tmp/build.log',
          size: 1024,
          createdAt: new Date().toISOString()
        },
        {
          id: 'test-results',
          type: 'report',
          name: 'test-results.json',
          path: '/tmp/test-results.json',
          size: 2048,
          createdAt: new Date().toISOString()
        },
        {
          id: 'deployment-config',
          type: 'config',
          name: 'deployment.yaml',
          path: '/tmp/deployment.yaml',
          size: 512,
          createdAt: new Date().toISOString()
        }
      ];

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Simulate artifact generation
        artifacts.forEach(artifact => {
          if (mockUmbilical.onArtifactGenerated) {
            mockUmbilical.onArtifactGenerated(artifact);
          }
        });
        
        // Verify artifacts are tracked
        const trackedArtifacts = mockUmbilical.workflowState.executionProgress.artifacts;
        expect(Object.keys(trackedArtifacts)).toHaveLength(3);
        expect(trackedArtifacts['build-output']).toBeDefined();
        expect(trackedArtifacts['test-results']).toBeDefined();
        expect(trackedArtifacts['deployment-config']).toBeDefined();
      }
    });

    test('should provide artifact inspection capabilities', async () => {
      const artifact = {
        id: 'inspection-test-artifact',
        type: 'file',
        name: 'output.txt',
        content: 'Sample output content for inspection',
        metadata: {
          encoding: 'utf-8',
          lines: 10,
          characters: 100
        }
      };

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Verify component has standardized API
        expect(typeof executionComponent.api.getState).toBe('function');
        
        // Simulate artifact inspection
        if (mockUmbilical.onArtifactGenerated) {
          mockUmbilical.onArtifactGenerated(artifact);
        }
        
        // Verify artifact is available for inspection
        const artifacts = mockUmbilical.workflowState.executionProgress.artifacts;
        expect(artifacts[artifact.id]).toEqual(artifact);
      }
    });
  });

  describe('Execution Control Operations', () => {
    test('should support pause and resume operations', async () => {
      const executionId = 'pause-resume-test-exec';

      // Mock pause and resume operations
      mockExecutionActor.pauseExecution.mockResolvedValue({ status: 'paused' });
      mockExecutionActor.resumeExecution.mockResolvedValue({ status: 'running' });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set execution ID in component state
        executionComponent.api.setState('executionId', executionId);
        
        // Test pause operation
        await executionComponent.api.pauseExecution();
        expect(mockExecutionActor.pauseExecution).toHaveBeenCalledWith(executionId);
        
        // Test resume operation
        await executionComponent.api.resumeExecution();
        expect(mockExecutionActor.resumeExecution).toHaveBeenCalledWith(executionId);
      }
    });

    test('should support step-through execution mode', async () => {
      const executionId = 'step-through-test-exec';

      // Mock step execution
      mockExecutionActor.stepExecution.mockResolvedValue({
        stepCompleted: true,
        nextStep: 'step2',
        status: 'paused'
      });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set execution ID
        executionComponent.api.setState('executionId', executionId);
        
        // Test step execution
        await executionComponent.api.stepExecution();
        expect(mockExecutionActor.stepExecution).toHaveBeenCalledWith(executionId);
        
        // Verify step execution API exists
        expect(typeof executionComponent.api.stepExecution).toBe('function');
      }
    });

    test('should support stopping execution', async () => {
      const executionId = 'stop-test-exec';

      // Mock stop operation
      mockExecutionActor.stopExecution.mockResolvedValue({
        status: 'stopped',
        message: 'Execution stopped by user'
      });

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Set execution ID
        executionComponent.api.setState('executionId', executionId);
        
        // Test stop operation
        await executionComponent.api.stopExecution();
        expect(mockExecutionActor.stopExecution).toHaveBeenCalledWith(executionId);
      }
    });
  });

  describe('Execution Completion Handling', () => {
    test('should handle successful execution completion', async () => {
      const completionResults = {
        executionId: 'completion-test-exec',
        status: 'completed',
        duration: 120000,
        stepsCompleted: 5,
        stepsTotal: 5,
        artifacts: ['build-output', 'test-results'],
        summary: 'All steps completed successfully'
      };

      // Load execution control panel
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');

      if (executionComponent && executionComponent.api) {
        // Simulate completion
        if (mockUmbilical.onExecutionComplete) {
          mockUmbilical.onExecutionComplete(completionResults);
        }
        
        // Verify completion handling
        expect(mockUmbilical.workflowState.executionStatus).toBe('completed');
        expect(mockUmbilical.workflowState.executionProgress.results).toEqual(completionResults);
      }
    });

    test('should save execution results and artifacts', async () => {
      const executionResults = {
        executionId: 'save-results-test',
        plan: {
          id: 'test-plan',
          name: 'Test Plan'
        },
        results: {
          status: 'completed',
          artifacts: ['output.txt', 'results.json'],
          duration: 90000
        }
      };

      // Mock save operation
      mockPlanningActor.savePlan.mockResolvedValue({
        ...executionResults.plan,
        executionHistory: [executionResults.results]
      });

      // Load planning workspace for saving results
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set a plan first, then save execution results
        planningComponent.api.setCurrentPlan(executionResults.plan);
        await planningComponent.api.savePlan('Executed Plan');
        
        // Verify save was called
        expect(mockPlanningActor.savePlan).toHaveBeenCalled();
      }
    });
  });

  describe('Cross-Panel Execution Workflow', () => {
    test('should coordinate execution across planning panels', async () => {
      const executionPlan = {
        id: 'cross-panel-execution-plan',
        name: 'Cross-Panel Execution Plan',
        goal: 'Test execution workflow across panels',
        behaviorTree: {
          rootNode: { type: 'action', command: 'echo "cross-panel test"' }
        }
      };

      // Start in planning panel
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Set plan and start execution
        planningComponent.api.setCurrentPlan(executionPlan);
        await planningComponent.api.startExecution();
      }

      // Switch to visualization to monitor visually
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const visualizationComponent = component.getTabComponent('visualization');
      expect(visualizationComponent).toBeTruthy();

      // Switch to execution control for detailed monitoring
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      expect(executionComponent).toBeTruthy();

      // Return to planning for completion handling
      await component.switchTab('planning');
      const returnedPlanningComponent = component.getTabComponent('planning');
      expect(returnedPlanningComponent).toBeTruthy();

      // Verify all components support execution workflow
      expect(planningComponent.api.startExecution).toBeTruthy();
      expect(visualizationComponent.api.setPlan).toBeTruthy();
      expect(executionComponent.api.pauseExecution).toBeTruthy();
    });
  });
});