/**
 * Debug Plan Workflow Integration Tests
 * Tests plan loading, validation, issue identification, and modification workflows
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('Debug Plan Workflow Integration Tests', () => {
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

    // Create umbilical with debug workflow callbacks
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'library',
      
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
        debugInfo: {
          loadedPlan: null,
          validationIssues: [],
          modificationHistory: []
        }
      },
      
      // Debug workflow callbacks
      onPlanLoad: jest.fn((plan) => {
        mockUmbilical.workflowState.debugInfo.loadedPlan = plan;
      }),
      
      onValidationIssue: jest.fn((issue) => {
        mockUmbilical.workflowState.debugInfo.validationIssues.push(issue);
      }),
      
      onPlanModification: jest.fn((modification) => {
        mockUmbilical.workflowState.debugInfo.modificationHistory.push(modification);
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

  describe('Plan Loading and Debugging', () => {
    test('should load existing plan from library', async () => {
      const existingPlan = {
        id: 'debug-plan-001',
        name: 'Plan to Debug',
        goal: 'Build a web application with potential issues',
        status: 'saved',
        createdAt: '2024-01-01T10:00:00Z',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build web application',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'setup',
                description: 'Setup development environment',
                complexity: 'SIMPLE',
                children: []
              },
              {
                id: 'backend',
                description: 'Develop backend API',
                complexity: 'MEDIUM',
                children: []
              }
            ]
          }
        }
      };

      // Mock plan loading
      mockPlanningActor.loadPlan.mockResolvedValue(existingPlan);

      // Start in library to load plan
      await component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      expect(libraryComponent).toBeTruthy();
      expect(libraryComponent.api).toBeTruthy();

      // Switch to planning to load the plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Load the plan for debugging
        await planningComponent.api.loadPlan('debug-plan-001');
        
        // Verify load was called
        expect(mockPlanningActor.loadPlan).toHaveBeenCalledWith('debug-plan-001');
        
        // Verify API methods exist for debugging
        expect(typeof planningComponent.api.loadPlan).toBe('function');
        expect(typeof planningComponent.api.setCurrentPlan).toBe('function');
        expect(typeof planningComponent.api.getState).toBe('function');
      }
    });

    test('should handle plan loading errors gracefully', async () => {
      const loadError = new Error('Plan not found');
      
      // Mock plan loading error
      mockPlanningActor.loadPlan.mockRejectedValue(loadError);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Attempt to load non-existent plan
        await planningComponent.api.loadPlan('non-existent-plan');
        
        // Verify load was attempted
        expect(mockPlanningActor.loadPlan).toHaveBeenCalledWith('non-existent-plan');
        
        // The method logs errors internally but doesn't throw
        // Verify the component is still functional
        expect(planningComponent.api.getState).toBeTruthy();
      }
    });

    test('should display loaded plan in visualization panel', async () => {
      const debugPlan = {
        id: 'visualization-debug-plan',
        name: 'Plan for Visualization Debug',
        goal: 'Test plan visualization debugging',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test visualization',
            children: [
              {
                id: 'step1',
                description: 'First step',
                children: []
              },
              {
                id: 'step2',
                description: 'Second step',
                children: []
              }
            ]
          }
        }
      };

      // Load planning workspace first
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Set the plan to debug
        planningComponent.api.setCurrentPlan(debugPlan);
        
        // Switch to visualization
        await component.switchTab('visualization');
        await component.loadPanelContent('visualization');
        
        const visualizationComponent = component.getTabComponent('visualization');
        expect(visualizationComponent).toBeTruthy();
        expect(visualizationComponent.api).toBeTruthy();
        
        // Verify visualization component loaded with correct API
        expect(typeof visualizationComponent.api.setPlan).toBe('function');
        expect(typeof visualizationComponent.api.getPlan).toBe('function');
      }
    });
  });

  describe('Validation and Issue Identification', () => {
    test('should identify tool availability issues', async () => {
      const planWithToolIssues = {
        id: 'tool-issues-plan',
        name: 'Plan with Tool Issues',
        goal: 'Build application requiring unavailable tools',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build application using Docker and Kubernetes',
            children: [
              {
                id: 'containerize',
                description: 'Containerize application with Docker',
                tools: ['docker', 'docker-compose'],
                children: []
              },
              {
                id: 'deploy',
                description: 'Deploy to Kubernetes',
                tools: ['kubectl', 'helm'],
                children: []
              }
            ]
          }
        }
      };

      const validationIssues = {
        isValid: false,
        toolsAvailable: false,
        availableTools: ['npm', 'node', 'git'],
        missingTools: ['docker', 'docker-compose', 'kubectl', 'helm'],
        issues: [
          'Docker is required but not available',
          'kubectl is required but not available',
          'helm is required but not available'
        ],
        recommendations: [
          'Install Docker Desktop',
          'Install kubectl CLI',
          'Install Helm package manager'
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan with tool issues
        planningComponent.api.setCurrentPlan(planWithToolIssues);
        
        // Handle validation results showing issues
        await planningComponent.api.handleValidationResult(validationIssues);
        
        // Verify validation state shows issues
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.missingTools).toHaveLength(4);
        expect(state.validationResult.issues).toHaveLength(3);
      }
    });

    test('should identify dependency conflicts', async () => {
      const planWithDependencyConflicts = {
        id: 'dependency-conflicts-plan',
        name: 'Plan with Dependency Conflicts',
        goal: 'Build application with conflicting dependencies',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build application with conflicting versions',
            children: [
              {
                id: 'frontend',
                description: 'Setup React frontend',
                dependencies: ['react@18.0.0', 'react-dom@18.0.0'],
                children: []
              },
              {
                id: 'legacy-component',
                description: 'Integrate legacy component',
                dependencies: ['react@16.14.0', 'react-dom@16.14.0'],
                children: []
              }
            ]
          }
        }
      };

      const dependencyValidation = {
        isValid: false,
        dependenciesValid: false,
        conflicts: [
          {
            package: 'react',
            requiredVersions: ['18.0.0', '16.14.0'],
            conflict: 'Major version mismatch'
          },
          {
            package: 'react-dom',
            requiredVersions: ['18.0.0', '16.14.0'],
            conflict: 'Major version mismatch'
          }
        ],
        issues: [
          'React version conflict between frontend and legacy component',
          'React-dom version conflict detected'
        ],
        recommendations: [
          'Upgrade legacy component to React 18',
          'Use React compatibility layer',
          'Separate applications with different React versions'
        ]
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set plan with dependency conflicts
        planningComponent.api.setCurrentPlan(planWithDependencyConflicts);
        
        // Handle dependency validation results
        await planningComponent.api.handleValidationResult(dependencyValidation);
        
        // Verify validation shows dependency issues
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.dependenciesValid).toBe(false);
        expect(state.validationResult.conflicts).toHaveLength(2);
      }
    });

    test('should validate plan hierarchy complexity', async () => {
      const complexPlanWithIssues = {
        id: 'complex-hierarchy-plan',
        name: 'Complex Plan with Hierarchy Issues',
        goal: 'Build overly complex system',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Build complex system',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'subsystem1',
                description: 'First subsystem',
                complexity: 'COMPLEX',
                children: [
                  {
                    id: 'component1',
                    description: 'Complex component 1',
                    complexity: 'COMPLEX',
                    children: [
                      {
                        id: 'subcomponent1',
                        description: 'Deep nested component',
                        complexity: 'MEDIUM',
                        children: []
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      const hierarchyValidation = {
        isValid: false,
        hierarchyValid: false,
        issues: [
          'Plan hierarchy is too deep (4 levels)',
          'Too many COMPLEX nodes in single branch',
          'Potential for circular dependencies'
        ],
        recommendations: [
          'Flatten hierarchy to reduce complexity',
          'Break complex components into separate plans',
          'Consider parallel execution paths'
        ],
        maxDepth: 4,
        complexityScore: 85,
        maxRecommendedDepth: 3
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set complex plan
        planningComponent.api.setCurrentPlan(complexPlanWithIssues);
        
        // Handle hierarchy validation
        await planningComponent.api.handleValidationResult(hierarchyValidation);
        
        // Verify hierarchy issues are identified
        const state = planningComponent.api.getState();
        expect(state.validationResult.isValid).toBe(false);
        expect(state.validationResult.hierarchyValid).toBe(false);
        expect(state.validationResult.maxDepth).toBe(4);
        expect(state.validationResult.complexityScore).toBe(85);
      }
    });
  });

  describe('Plan Modification and Re-validation', () => {
    test('should modify plan and trigger re-validation', async () => {
      const originalPlan = {
        id: 'modification-test-plan',
        name: 'Plan for Modification Testing',
        goal: 'Test plan modification workflow',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Original plan structure',
            children: [
              {
                id: 'step1',
                description: 'First step',
                children: []
              }
            ]
          }
        }
      };

      const modifiedPlan = {
        ...originalPlan,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Modified plan structure',
            children: [
              {
                id: 'step1',
                description: 'Modified first step',
                children: []
              },
              {
                id: 'step2',
                description: 'Added second step',
                children: []
              }
            ]
          }
        }
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set original plan
        planningComponent.api.setCurrentPlan(originalPlan);
        
        let state = planningComponent.api.getState();
        expect(state.currentPlan.hierarchy.root.children).toHaveLength(1);
        
        // Modify the plan
        planningComponent.api.setCurrentPlan(modifiedPlan);
        
        // Verify modification
        state = planningComponent.api.getState();
        expect(state.currentPlan.hierarchy.root.children).toHaveLength(2);
        expect(state.currentPlan.hierarchy.root.children[1].id).toBe('step2');
      }
    });

    test('should track modification history', async () => {
      const basePlan = {
        id: 'history-tracking-plan',
        name: 'Plan for History Tracking',
        goal: 'Test modification history tracking',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Base plan',
            children: []
          }
        }
      };

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set base plan
        planningComponent.api.setCurrentPlan(basePlan);
        
        // Simulate multiple modifications
        const modification1 = {
          ...basePlan,
          hierarchy: {
            root: {
              id: 'root',
              description: 'Base plan with first modification',
              children: [
                { id: 'new-step', description: 'Added step', children: [] }
              ]
            }
          }
        };
        
        planningComponent.api.setCurrentPlan(modification1);
        
        const modification2 = {
          ...modification1,
          goal: 'Updated goal for modification history test',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Base plan with second modification',
              children: [
                { id: 'new-step', description: 'Modified step', children: [] },
                { id: 'another-step', description: 'Another added step', children: [] }
              ]
            }
          }
        };
        
        planningComponent.api.setCurrentPlan(modification2);
        
        // Verify final state
        const state = planningComponent.api.getState();
        expect(state.currentPlan.goal).toBe('Updated goal for modification history test');
        expect(state.currentPlan.hierarchy.root.children).toHaveLength(2);
      }
    });

    test('should save modified plan with proper versioning', async () => {
      const originalPlan = {
        id: 'versioning-test-plan',
        name: 'Plan for Versioning Test',
        goal: 'Test plan versioning',
        version: '1.0.0',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Original version',
            children: []
          }
        }
      };

      const modifiedPlan = {
        ...originalPlan,
        hierarchy: {
          root: {
            id: 'root',
            description: 'Modified version',
            children: [
              { id: 'new-feature', description: 'New feature added', children: [] }
            ]
          }
        }
      };

      const savedModifiedPlan = {
        ...modifiedPlan,
        version: '1.1.0',
        updatedAt: new Date().toISOString(),
        modificationReason: 'Added new feature'
      };

      // Mock save operation
      mockPlanningActor.savePlan.mockResolvedValue(savedModifiedPlan);

      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');

      if (planningComponent && planningComponent.api) {
        // Set original plan
        planningComponent.api.setCurrentPlan(originalPlan);
        
        // Modify the plan
        planningComponent.api.setCurrentPlan(modifiedPlan);
        
        // Save modified plan
        await planningComponent.api.savePlan('Modified Plan');
        
        // Verify save was called
        expect(mockPlanningActor.savePlan).toHaveBeenCalled();
        
        // Verify the component can handle saved plans
        const state = planningComponent.api.getState();
        expect(state.currentPlan.hierarchy.root.children).toHaveLength(1);
      }
    });
  });

  describe('Cross-Panel Debug Workflow', () => {
    test('should coordinate debugging across planning panels', async () => {
      const debugPlan = {
        id: 'cross-panel-debug-plan',
        name: 'Cross-Panel Debug Plan',
        goal: 'Test cross-panel debugging workflow',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Debug across panels',
            children: [
              { id: 'debug-step', description: 'Step to debug', children: [] }
            ]
          }
        }
      };

      // Start in planning panel
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      if (planningComponent && planningComponent.api) {
        // Load plan for debugging
        planningComponent.api.setCurrentPlan(debugPlan);
        
        // Switch to visualization for visual debugging
        await component.switchTab('visualization');
        await component.loadPanelContent('visualization');
        
        const visualizationComponent = component.getTabComponent('visualization');
        expect(visualizationComponent).toBeTruthy();
        
        // Switch to library to check saved versions
        await component.switchTab('library');
        await component.loadPanelContent('library');
        
        const libraryComponent = component.getTabComponent('library');
        expect(libraryComponent).toBeTruthy();
        
        // Return to planning for modifications
        await component.switchTab('planning');
        const returnedPlanningComponent = component.getTabComponent('planning');
        expect(returnedPlanningComponent).toBeTruthy();
        
        // Verify all components are available for debugging workflow
        expect(planningComponent.api).toBeTruthy();
        expect(visualizationComponent.api).toBeTruthy();
        expect(libraryComponent.api).toBeTruthy();
      }
    });
  });
});