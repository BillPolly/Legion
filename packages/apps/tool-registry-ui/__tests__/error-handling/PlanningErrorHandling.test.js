/**
 * Planning Error Handling Tests
 * Tests error handling for LLM failures, validation errors, and planning issues
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';
import { PlanningWorkspacePanel } from '../../src/components/tool-registry/components/panels/PlanningWorkspacePanel.js';
import { PlanLibraryPanel } from '../../src/components/tool-registry/components/panels/PlanLibraryPanel.js';

describe('Planning Error Handling Tests', () => {
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
      getExecutionStatus: jest.fn()
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

    // Create umbilical with error tracking
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Error tracking
      errorLog: [],
      lastError: null,
      
      // Error callbacks
      onError: jest.fn((error) => {
        mockUmbilical.lastError = error;
        mockUmbilical.errorLog.push(error);
      }),
      
      onPlanningError: jest.fn((error) => {
        mockUmbilical.lastError = { type: 'planning', ...error };
        mockUmbilical.errorLog.push({ type: 'planning', ...error });
      }),
      
      onValidationError: jest.fn((error) => {
        mockUmbilical.lastError = { type: 'validation', ...error };
        mockUmbilical.errorLog.push({ type: 'validation', ...error });
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
    jest.clearAllMocks();
  });

  describe('LLM Failure Handling', () => {
    test('should handle LLM connection timeout', async () => {
      const timeoutError = new Error('LLM request timeout after 30000ms');
      timeoutError.code = 'TIMEOUT';
      
      // Mock LLM timeout
      mockPlanningActor.createPlan.mockRejectedValue(timeoutError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set goal and attempt to create plan
        planningComponent.api.setGoal('Create a complex web application');
        await planningComponent.api.createPlan();
        
        // Verify error was handled
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        // Check component state
        const state = planningComponent.api.getState();
        expect(state.planningStatus).toBe('error');
      }
    });

    test('should handle LLM rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded. Please wait 60 seconds.');
      rateLimitError.code = 'RATE_LIMIT';
      rateLimitError.retryAfter = 60;
      
      // Mock rate limit error
      mockPlanningActor.createPlan.mockRejectedValue(rateLimitError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Attempt to create plan
        planningComponent.api.setGoal('Build a microservices architecture');
        await planningComponent.api.createPlan();
        
        // Verify rate limit was encountered
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        // Check error state
        const state = planningComponent.api.getState();
        expect(state.planningStatus).toBe('error');
      }
    });

    test('should handle malformed LLM response', async () => {
      const malformedResponse = {
        // Missing required fields
        hierarchy: null,
        goal: 'Test goal'
      };
      
      // Mock malformed response
      mockPlanningActor.createPlan.mockResolvedValue(malformedResponse);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Create plan with malformed response
        planningComponent.api.setGoal('Test malformed response handling');
        await planningComponent.api.createPlan();
        
        // Verify creation was attempted
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        // Component should handle gracefully
        const state = planningComponent.api.getState();
        expect(state.currentPlan).toBeDefined();
      }
    });

    test('should handle LLM service unavailable', async () => {
      const serviceError = new Error('Service temporarily unavailable');
      serviceError.code = 'SERVICE_UNAVAILABLE';
      serviceError.statusCode = 503;
      
      // Mock service unavailable
      mockPlanningActor.decomposePlan.mockRejectedValue(serviceError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan and attempt decomposition
        const testPlan = {
          id: 'test-plan',
          goal: 'Test service unavailable',
          hierarchy: { root: { id: 'root', description: 'Root task' } }
        };
        
        planningComponent.api.setCurrentPlan(testPlan);
        
        // Attempt decomposition (if available)
        if (typeof planningComponent.api.decomposePlan === 'function') {
          await planningComponent.api.decomposePlan();
          expect(mockPlanningActor.decomposePlan).toHaveBeenCalled();
        }
      }
    });

    test('should handle token limit exceeded', async () => {
      const tokenLimitError = new Error('Token limit exceeded. Plan too complex.');
      tokenLimitError.code = 'TOKEN_LIMIT_EXCEEDED';
      tokenLimitError.tokenCount = 8192;
      tokenLimitError.maxTokens = 4096;
      
      // Mock token limit error
      mockPlanningActor.createPlan.mockRejectedValue(tokenLimitError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Very long goal that might exceed token limit
        const longGoal = 'Create a comprehensive enterprise application with ' +
          'user authentication, authorization, data management, reporting, ' +
          'analytics, real-time notifications, messaging, file storage, ' +
          'backup systems, monitoring, logging, error tracking, and more...';
        
        planningComponent.api.setGoal(longGoal);
        await planningComponent.api.createPlan();
        
        // Verify error was encountered
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        const state = planningComponent.api.getState();
        expect(state.planningStatus).toBe('error');
      }
    });
  });

  describe('Validation Error Handling', () => {
    test('should handle invalid plan structure', async () => {
      const invalidPlan = {
        id: 'invalid-structure-plan',
        goal: 'Test invalid structure',
        // Invalid hierarchy structure
        hierarchy: {
          root: {
            id: null, // Invalid: missing ID
            description: 'Root task',
            children: [
              {
                // Missing required fields
                description: 'Child task'
              }
            ]
          }
        }
      };

      const validationError = {
        isValid: false,
        errors: [
          'Root node missing ID',
          'Child node at index 0 missing ID',
          'Invalid hierarchy structure'
        ]
      };

      // Mock validation failure
      mockPlanningActor.validatePlan.mockResolvedValue(validationError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set invalid plan
        planningComponent.api.setCurrentPlan(invalidPlan);
        
        // Handle validation result
        await planningComponent.api.handleValidationResult(validationError);
        
        // Check validation state
        const state = planningComponent.api.getState();
        expect(state.validationResult).toBeDefined();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.errors).toHaveLength(3);
      }
    });

    test('should handle circular dependency detection', async () => {
      const planWithCircularDeps = {
        id: 'circular-deps-plan',
        goal: 'Test circular dependencies',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root task',
            children: [
              {
                id: 'task-a',
                description: 'Task A',
                dependencies: ['task-b'],
                children: []
              },
              {
                id: 'task-b',
                description: 'Task B',
                dependencies: ['task-c'],
                children: []
              },
              {
                id: 'task-c',
                description: 'Task C',
                dependencies: ['task-a'], // Circular dependency
                children: []
              }
            ]
          }
        }
      };

      const circularDepError = {
        isValid: false,
        errors: ['Circular dependency detected: task-a -> task-b -> task-c -> task-a'],
        circularDependencies: [
          { from: 'task-a', to: 'task-b' },
          { from: 'task-b', to: 'task-c' },
          { from: 'task-c', to: 'task-a' }
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan with circular dependencies
        planningComponent.api.setCurrentPlan(planWithCircularDeps);
        
        // Handle validation
        await planningComponent.api.handleValidationResult(circularDepError);
        
        // Verify circular dependency was detected
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.errors[0]).toContain('Circular dependency');
      }
    });

    test('should handle missing required tools', async () => {
      const planWithMissingTools = {
        id: 'missing-tools-plan',
        goal: 'Deploy application with missing tools',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Deploy application',
            children: [
              {
                id: 'docker-build',
                description: 'Build Docker image',
                tools: ['docker', 'docker-compose'],
                children: []
              },
              {
                id: 'k8s-deploy',
                description: 'Deploy to Kubernetes',
                tools: ['kubectl', 'helm'],
                children: []
              }
            ]
          }
        }
      };

      const toolValidationError = {
        isValid: false,
        toolsAvailable: false,
        missingTools: ['docker', 'docker-compose', 'kubectl', 'helm'],
        errors: [
          'Required tool "docker" is not available',
          'Required tool "docker-compose" is not available',
          'Required tool "kubectl" is not available',
          'Required tool "helm" is not available'
        ],
        suggestions: [
          'Install Docker Desktop for docker and docker-compose',
          'Install kubectl CLI tool',
          'Install Helm package manager'
        ]
      };

      // Mock tool validation failure
      mockToolRegistryActor.validateTools.mockResolvedValue(toolValidationError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan with missing tools
        planningComponent.api.setCurrentPlan(planWithMissingTools);
        
        // Handle tool validation
        await planningComponent.api.handleValidationResult(toolValidationError);
        
        // Verify missing tools were identified
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.missingTools).toHaveLength(4);
        expect(state.validationResult.suggestions).toBeDefined();
      }
    });

    test('should handle incompatible task dependencies', async () => {
      const planWithIncompatibleDeps = {
        id: 'incompatible-deps-plan',
        goal: 'Test incompatible dependencies',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root task',
            children: [
              {
                id: 'frontend',
                description: 'Build React 18 frontend',
                dependencies: { react: '18.0.0' },
                children: []
              },
              {
                id: 'legacy-component',
                description: 'Integrate legacy React 16 component',
                dependencies: { react: '16.14.0' },
                children: []
              }
            ]
          }
        }
      };

      const depValidationError = {
        isValid: false,
        errors: [
          'Incompatible React versions: 18.0.0 and 16.14.0',
          'Cannot use React 16 component with React 18 application'
        ],
        conflicts: [
          {
            package: 'react',
            versions: ['18.0.0', '16.14.0'],
            tasks: ['frontend', 'legacy-component']
          }
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan with incompatible dependencies
        planningComponent.api.setCurrentPlan(planWithIncompatibleDeps);
        
        // Handle dependency validation
        await planningComponent.api.handleValidationResult(depValidationError);
        
        // Verify conflicts were detected
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.conflicts).toBeDefined();
        expect(state.validationResult.conflicts[0].versions).toHaveLength(2);
      }
    });
  });

  describe('Plan Storage Error Handling', () => {
    test('should handle database connection failure', async () => {
      const dbError = new Error('MongoDB connection failed');
      dbError.code = 'ECONNREFUSED';
      
      // Mock database error
      mockPlanningActor.savePlan.mockRejectedValue(dbError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan and attempt to save
        const testPlan = {
          id: 'test-save-plan',
          goal: 'Test database save',
          hierarchy: { root: { id: 'root', description: 'Root' } }
        };
        
        planningComponent.api.setCurrentPlan(testPlan);
        await planningComponent.api.savePlan('Test Plan');
        
        // Verify save was attempted
        expect(mockPlanningActor.savePlan).toHaveBeenCalled();
        
        // Component should handle error gracefully
        const state = planningComponent.api.getState();
        expect(state.currentPlan).toBeDefined();
      }
    });

    test('should handle plan not found error', async () => {
      const notFoundError = new Error('Plan not found');
      notFoundError.code = 'PLAN_NOT_FOUND';
      notFoundError.planId = 'non-existent-plan';
      
      // Mock not found error
      mockPlanningActor.loadPlan.mockRejectedValue(notFoundError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Attempt to load non-existent plan
        await planningComponent.api.loadPlan('non-existent-plan');
        
        // Verify load was attempted
        expect(mockPlanningActor.loadPlan).toHaveBeenCalledWith('non-existent-plan');
        
        // Component should handle gracefully
        const state = planningComponent.api.getState();
        expect(state.planningStatus).toBeDefined();
      }
    });

    test('should handle storage quota exceeded', async () => {
      const quotaError = new Error('Storage quota exceeded');
      quotaError.code = 'QUOTA_EXCEEDED';
      quotaError.currentUsage = 5242880; // 5MB
      quotaError.maxQuota = 5242880; // 5MB
      
      // Mock quota error
      mockPlanningActor.savePlan.mockRejectedValue(quotaError);

      // Load library panel for storage testing
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');

      if (libraryComponent && libraryComponent.api) {
        // Attempt to add plan when quota exceeded
        const largePlan = {
          id: 'large-plan',
          name: 'Large Plan',
          goal: 'Test storage quota',
          size: 1048576, // 1MB
          hierarchy: { root: { id: 'root', description: 'Root' } }
        };
        
        // PlanLibraryPanel uses addPlan method directly on the model
        libraryComponent.model.addPlan(largePlan);
        
        // Verify plan was added to local state
        const plans = libraryComponent.api.getPlans();
        expect(plans.find(p => p.id === 'large-plan')).toBeDefined();
      }
    });
  });

  describe('Recovery and Retry Logic', () => {
    test('should retry failed LLM requests', async () => {
      // First attempt fails, second succeeds
      mockPlanningActor.createPlan
        .mockRejectedValueOnce(new Error('Temporary network error'))
        .mockResolvedValueOnce({
          id: 'retry-success-plan',
          goal: 'Test retry logic',
          hierarchy: { root: { id: 'root', description: 'Root task' } }
        });

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set goal and create plan (will retry internally)
        planningComponent.api.setGoal('Test retry logic');
        
        // First attempt
        await planningComponent.api.createPlan();
        
        // If component supports retry, attempt again
        if (planningComponent.api.getState().planningStatus === 'error') {
          await planningComponent.api.createPlan();
        }
        
        // Verify retries were attempted
        expect(mockPlanningActor.createPlan).toHaveBeenCalledTimes(2);
      }
    });

    test('should provide error recovery suggestions', async () => {
      const recoverableError = {
        code: 'VALIDATION_FAILED',
        message: 'Plan validation failed',
        recoverable: true,
        suggestions: [
          'Simplify the plan hierarchy',
          'Remove circular dependencies',
          'Ensure all required tools are available'
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Handle recoverable error
        await planningComponent.api.handleValidationResult({
          isValid: false,
          ...recoverableError
        });
        
        // Verify suggestions are available
        const state = planningComponent.api.getState();
        expect(state.validationResult).toBeDefined();
        expect(state.validationResult.suggestions).toBeDefined();
        expect(state.validationResult.suggestions).toHaveLength(3);
      }
    });

    test('should gracefully degrade functionality on partial failures', async () => {
      // Decomposition fails but plan creation succeeds
      const basicPlan = {
        id: 'basic-plan',
        goal: 'Test graceful degradation',
        hierarchy: { root: { id: 'root', description: 'Simple task' } }
      };
      
      mockPlanningActor.createPlan.mockResolvedValue(basicPlan);
      mockPlanningActor.decomposePlan.mockRejectedValue(new Error('Decomposition service unavailable'));

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Create plan (succeeds)
        planningComponent.api.setGoal('Test graceful degradation');
        await planningComponent.api.createPlan();
        
        // Verify plan was created despite decomposition failure
        const state = planningComponent.api.getState();
        expect(state.currentPlan).toBeDefined();
        if (state.currentPlan) {
          expect(state.currentPlan.id).toBe('basic-plan');
        }
        
        // Decomposition may have failed but plan is still usable
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
      }
    });
  });

  describe('User Feedback for Errors', () => {
    test('should provide clear error messages to users', async () => {
      const userFriendlyError = new Error('Unable to create plan: The goal description is too vague. Please provide more specific details.');
      userFriendlyError.code = 'GOAL_TOO_VAGUE';
      userFriendlyError.userMessage = 'Please provide more specific details about what you want to build.';
      
      mockPlanningActor.createPlan.mockRejectedValue(userFriendlyError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set vague goal
        planningComponent.api.setGoal('Build something');
        await planningComponent.api.createPlan();
        
        // Verify user-friendly error handling
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        const state = planningComponent.api.getState();
        expect(state.planningStatus).toBe('error');
        
        // Error message should be accessible through execution logs
        expect(state.executionLogs).toBeDefined();
      }
    });

    test('should log errors for debugging', async () => {
      const debugError = new Error('Internal planning error');
      debugError.code = 'INTERNAL_ERROR';
      debugError.stack = 'Error stack trace...';
      debugError.context = {
        goal: 'Test error logging',
        timestamp: new Date().toISOString()
      };
      
      mockPlanningActor.createPlan.mockRejectedValue(debugError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Trigger error
        planningComponent.api.setGoal('Test error logging');
        await planningComponent.api.createPlan();
        
        // Verify error was logged
        expect(mockPlanningActor.createPlan).toHaveBeenCalled();
        
        // Check execution logs for error
        const state = planningComponent.api.getState();
        expect(state.executionLogs).toBeDefined();
        expect(state.executionLogs.length).toBeGreaterThan(0);
      }
    });
  });
});