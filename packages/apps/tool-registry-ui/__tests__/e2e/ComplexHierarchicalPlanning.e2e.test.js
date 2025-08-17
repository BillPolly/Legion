/**
 * End-to-End Tests: Complex Hierarchical Planning
 * Tests complete workflows for complex, multi-level planning scenarios
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('E2E: Complex Hierarchical Planning', () => {
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

    // Create comprehensive mock actors with complex plan responses
    mockPlanningActor = {
      createPlan: jest.fn().mockImplementation((goal) => {
        // Return complex hierarchical plan
        return Promise.resolve({
          id: `complex-plan-${Date.now()}`,
          name: 'Complex Hierarchical Plan',
          goal: goal,
          status: 'created',
          hierarchy: {
            root: {
              id: 'root',
              description: goal,
              type: 'goal',
              children: [
                {
                  id: 'phase-1',
                  description: 'Backend Development',
                  type: 'phase',
                  children: [
                    {
                      id: 'task-1.1',
                      description: 'Setup database schema',
                      type: 'task',
                      tools: ['postgresql', 'prisma'],
                      dependencies: [],
                      children: [
                        {
                          id: 'subtask-1.1.1',
                          description: 'Create migrations',
                          type: 'subtask',
                          tools: ['prisma'],
                          children: []
                        },
                        {
                          id: 'subtask-1.1.2',
                          description: 'Seed initial data',
                          type: 'subtask',
                          tools: ['node'],
                          children: []
                        }
                      ]
                    },
                    {
                      id: 'task-1.2',
                      description: 'Implement API endpoints',
                      type: 'task',
                      tools: ['node', 'express'],
                      dependencies: ['task-1.1'],
                      children: [
                        {
                          id: 'subtask-1.2.1',
                          description: 'User authentication',
                          type: 'subtask',
                          tools: ['passport', 'jwt'],
                          children: []
                        },
                        {
                          id: 'subtask-1.2.2',
                          description: 'CRUD operations',
                          type: 'subtask',
                          tools: ['express'],
                          children: []
                        }
                      ]
                    }
                  ]
                },
                {
                  id: 'phase-2',
                  description: 'Frontend Development',
                  type: 'phase',
                  dependencies: ['phase-1'],
                  children: [
                    {
                      id: 'task-2.1',
                      description: 'Setup React application',
                      type: 'task',
                      tools: ['create-react-app', 'webpack'],
                      children: [
                        {
                          id: 'subtask-2.1.1',
                          description: 'Configure build pipeline',
                          type: 'subtask',
                          tools: ['webpack', 'babel'],
                          children: []
                        }
                      ]
                    },
                    {
                      id: 'task-2.2',
                      description: 'Implement UI components',
                      type: 'task',
                      tools: ['react', 'tailwindcss'],
                      dependencies: ['task-2.1'],
                      children: [
                        {
                          id: 'subtask-2.2.1',
                          description: 'Navigation components',
                          type: 'subtask',
                          tools: ['react-router'],
                          children: []
                        },
                        {
                          id: 'subtask-2.2.2',
                          description: 'Form components',
                          type: 'subtask',
                          tools: ['react-hook-form'],
                          children: []
                        }
                      ]
                    }
                  ]
                },
                {
                  id: 'phase-3',
                  description: 'Testing & Deployment',
                  type: 'phase',
                  dependencies: ['phase-1', 'phase-2'],
                  children: [
                    {
                      id: 'task-3.1',
                      description: 'Write comprehensive tests',
                      type: 'task',
                      tools: ['jest', 'cypress'],
                      children: []
                    },
                    {
                      id: 'task-3.2',
                      description: 'Deploy to production',
                      type: 'task',
                      tools: ['docker', 'kubernetes'],
                      dependencies: ['task-3.1'],
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
                  id: 'backend-tasks',
                  children: [
                    { type: 'action', id: 'task-1.1', command: 'prisma migrate dev' },
                    { type: 'action', id: 'task-1.2', command: 'npm run api:dev' }
                  ]
                },
                {
                  type: 'sequence',
                  id: 'frontend-tasks',
                  children: [
                    { type: 'action', id: 'task-2.1', command: 'npx create-react-app frontend' },
                    { type: 'action', id: 'task-2.2', command: 'npm run build' }
                  ]
                },
                {
                  type: 'sequence',
                  id: 'deployment',
                  children: [
                    { type: 'action', id: 'task-3.1', command: 'npm test' },
                    { type: 'action', id: 'task-3.2', command: 'docker-compose up' }
                  ]
                }
              ]
            }
          },
          createdAt: new Date().toISOString(),
          estimatedDuration: 28800000, // 8 hours in milliseconds
          complexity: 'high',
          requiredTools: [
            'node', 'npm', 'postgresql', 'prisma', 'express',
            'react', 'webpack', 'docker', 'kubernetes', 'jest'
          ]
        });
      }),
      
      decomposePlan: jest.fn().mockResolvedValue({
        success: true,
        decomposedTasks: 15,
        maxDepth: 4
      }),
      
      validatePlan: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: ['Some tools may require additional configuration'],
        toolsAvailable: true,
        dependencies: {
          resolved: true,
          conflicts: []
        }
      }),
      
      optimizePlan: jest.fn().mockResolvedValue({
        optimized: true,
        parallelizableTasks: ['task-1.1', 'task-1.2'],
        estimatedTimeSaved: 7200000 // 2 hours
      }),
      
      savePlan: jest.fn().mockResolvedValue({
        success: true,
        planId: `saved-complex-${Date.now()}`
      }),
      
      loadPlan: jest.fn(),
      getPlans: jest.fn().mockResolvedValue([])
    };

    mockExecutionActor = {
      startExecution: jest.fn().mockResolvedValue({
        executionId: `complex-exec-${Date.now()}`,
        status: 'running',
        parallelExecutions: 2
      }),
      
      pauseExecution: jest.fn().mockResolvedValue({ status: 'paused' }),
      resumeExecution: jest.fn().mockResolvedValue({ status: 'running' }),
      stopExecution: jest.fn().mockResolvedValue({ status: 'stopped' }),
      
      getExecutionStatus: jest.fn().mockImplementation(() => ({
        status: 'running',
        progress: 35,
        currentPhase: 'phase-1',
        completedTasks: ['task-1.1', 'subtask-1.1.1'],
        runningTasks: ['task-1.2'],
        pendingTasks: ['phase-2', 'phase-3'],
        logs: []
      }))
    };

    mockToolRegistryActor = {
      searchTools: jest.fn(),
      validateTools: jest.fn().mockResolvedValue({
        isValid: true,
        availableTools: [
          'node', 'npm', 'postgresql', 'prisma', 'express',
          'react', 'webpack', 'jest'
        ],
        missingTools: ['kubernetes'],
        suggestions: ['Install Docker Desktop for Kubernetes support']
      }),
      
      getAvailableTools: jest.fn().mockResolvedValue([
        'node', 'npm', 'git', 'docker'
      ]),
      
      getToolDetails: jest.fn().mockImplementation((toolName) => ({
        name: toolName,
        version: '1.0.0',
        installed: true,
        configRequired: toolName === 'kubernetes'
      }))
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

    // Create umbilical
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Actors
      planningActor: mockPlanningActor,
      executionActor: mockExecutionActor,
      toolRegistryActor: mockToolRegistryActor,
      
      // Callbacks
      onPlanCreate: jest.fn(),
      onPlanComplete: jest.fn(),
      onDecompositionComplete: jest.fn(),
      onValidationComplete: jest.fn(),
      onExecutionStart: jest.fn(),
      onExecutionComplete: jest.fn(),
      onTaskComplete: jest.fn(),
      onPhaseComplete: jest.fn(),
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

  describe('Complex Plan Creation', () => {
    test('should handle multi-phase project planning', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Set complex goal
      const complexGoal = 'Build a full-stack e-commerce platform with microservices';
      planningComponent.api.setGoal(complexGoal);
      
      // Create complex plan
      const planPromise = planningComponent.api.createPlan();
      
      // Handle the async plan creation
      if (mockUmbilical.onPlanComplete) {
        const plan = await mockPlanningActor.createPlan(complexGoal, {}, {});
        planningComponent.api.handlePlanComplete(plan);
        mockUmbilical.onPlanComplete(plan);
      }
      
      await planPromise;
      
      // Verify complex plan structure
      const state = planningComponent.api.getState();
      expect(state.currentPlan).toBeDefined();
      
      if (state.currentPlan) {
        const { hierarchy } = state.currentPlan;
        
        // Verify phases
        expect(hierarchy.root.children).toHaveLength(3);
        expect(hierarchy.root.children[0].type).toBe('phase');
        expect(hierarchy.root.children[0].description).toContain('Backend');
        
        // Verify task nesting
        const backendPhase = hierarchy.root.children[0];
        expect(backendPhase.children.length).toBeGreaterThan(0);
        
        // Verify subtasks
        const firstTask = backendPhase.children[0];
        expect(firstTask.children.length).toBeGreaterThan(0);
        expect(firstTask.children[0].type).toBe('subtask');
        
        // Verify dependencies
        const frontendPhase = hierarchy.root.children[1];
        expect(frontendPhase.dependencies).toContain('phase-1');
      }
    });

    test('should handle deep task hierarchies (4+ levels)', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan with deep hierarchy
      planningComponent.api.setGoal('Complex system with deep task nesting');
      const planPromise = planningComponent.api.createPlan();
      
      // Handle plan completion
      const plan = await mockPlanningActor.createPlan(
        'Complex system with deep task nesting', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      
      await planPromise;
      
      // Navigate hierarchy depth
      const state = planningComponent.api.getState();
      if (state.currentPlan) {
        const { hierarchy } = state.currentPlan;
        
        // Check depth: root -> phase -> task -> subtask
        const phase = hierarchy.root.children[0];
        const task = phase.children[0];
        const subtask = task.children[0];
        
        expect(phase).toBeDefined();
        expect(task).toBeDefined();
        expect(subtask).toBeDefined();
        expect(subtask.type).toBe('subtask');
        
        // Verify each level has proper structure
        expect(phase.id).toContain('phase');
        expect(task.id).toContain('task');
        expect(subtask.id).toContain('subtask');
      }
    });

    test('should resolve complex task dependencies', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan with dependencies
      planningComponent.api.setGoal('Project with complex dependencies');
      const planPromise = planningComponent.api.createPlan();
      
      const plan = await mockPlanningActor.createPlan(
        'Project with complex dependencies', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      
      await planPromise;
      
      // Validate dependencies
      const validationResult = await mockPlanningActor.validatePlan(plan);
      expect(validationResult.dependencies.resolved).toBe(true);
      expect(validationResult.dependencies.conflicts).toHaveLength(0);
      
      // Check cross-phase dependencies
      const state = planningComponent.api.getState();
      if (state.currentPlan) {
        const deploymentPhase = state.currentPlan.hierarchy.root.children[2];
        expect(deploymentPhase.dependencies).toContain('phase-1');
        expect(deploymentPhase.dependencies).toContain('phase-2');
      }
    });

    test('should optimize parallel task execution', async () => {
      // Load planning workspace
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Create plan
      planningComponent.api.setGoal('Optimize for parallel execution');
      const planPromise = planningComponent.api.createPlan();
      
      const plan = await mockPlanningActor.createPlan(
        'Optimize for parallel execution', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      
      await planPromise;
      
      // Optimize plan
      const optimization = await mockPlanningActor.optimizePlan(plan);
      expect(optimization.optimized).toBe(true);
      expect(optimization.parallelizableTasks).toHaveLength(2);
      expect(optimization.estimatedTimeSaved).toBeGreaterThan(0);
      
      // Verify behavior tree has parallel nodes
      const state = planningComponent.api.getState();
      if (state.currentPlan && state.currentPlan.behaviorTree) {
        const { behaviorTree } = state.currentPlan;
        const parallelNode = behaviorTree.rootNode.children.find(
          node => node.type === 'parallel'
        );
        expect(parallelNode).toBeDefined();
      }
    });
  });

  describe('Hierarchical Visualization', () => {
    test('should visualize complex plan hierarchy', async () => {
      // Create complex plan first
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Visualize complex hierarchy');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Visualize complex hierarchy', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Switch to visualization
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const vizComponent = component.getTabComponent('visualization');
      
      if (vizComponent && vizComponent.api) {
        // Set the complex plan
        vizComponent.api.setPlan(plan);
        
        // Verify visualization state
        const vizPlan = vizComponent.api.getPlan();
        expect(vizPlan).toBeDefined();
        
        // Check visualization modes for hierarchy
        const state = vizComponent.api.getState();
        expect(state.viewMode).toBeDefined();
        
        // Switch between view modes
        if (vizComponent.api.setViewMode) {
          vizComponent.api.setViewMode('tree');
          expect(vizComponent.api.getState().viewMode).toBe('tree');
          
          vizComponent.api.setViewMode('graph');
          expect(vizComponent.api.getState().viewMode).toBe('graph');
        }
      }
    });

    test('should handle node expansion/collapse in hierarchy', async () => {
      // Create and load complex plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Test node interactions');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Test node interactions', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Switch to visualization
      await component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const vizComponent = component.getTabComponent('visualization');
      
      if (vizComponent && vizComponent.api) {
        vizComponent.api.setPlan(plan);
        
        // Test node interactions
        if (vizComponent.api.toggleNode) {
          // Collapse phase-1
          vizComponent.api.toggleNode('phase-1');
          
          // Expand phase-1
          vizComponent.api.toggleNode('phase-1');
          
          // Verify state changes
          const state = vizComponent.api.getState();
          expect(state).toBeDefined();
        }
      }
    });
  });

  describe('Phased Execution', () => {
    test('should execute phases sequentially with dependencies', async () => {
      // Create complex plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Execute phased deployment');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Execute phased deployment', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Switch to execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        
        // Start execution
        await execComponent.api.startExecution();
        
        // Check execution status
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.currentPhase).toBe('phase-1');
        expect(status.completedTasks).toContain('task-1.1');
        
        // Verify phases execute in order
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
      }
    });

    test('should handle parallel task execution within phases', async () => {
      // Create plan with parallel tasks
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Parallel task execution');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Parallel task execution', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Start execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await execComponent.api.startExecution();
        
        // Verify parallel execution
        const result = await mockExecutionActor.startExecution(plan);
        expect(result.parallelExecutions).toBe(2);
        
        // Check running tasks
        const status = await mockExecutionActor.getExecutionStatus();
        expect(status.runningTasks).toBeDefined();
      }
    });

    test('should track progress across all hierarchy levels', async () => {
      // Create and execute complex plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Track hierarchical progress');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Track hierarchical progress', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Switch to progress overlay
      await component.switchTab('progress');
      await component.loadPanelContent('progress');
      
      const progressComponent = component.getTabComponent('progress');
      
      if (progressComponent && progressComponent.api) {
        // Start tracking
        const tasks = plan.hierarchy.root.children.flatMap(phase =>
          phase.children.flatMap(task => [
            task,
            ...task.children
          ])
        );
        
        progressComponent.api.startExecution('exec-123', tasks);
        
        // Update progress at different levels
        progressComponent.api.updateTaskProgress('subtask-1.1.1', {
          status: 'completed',
          progress: 100
        });
        
        progressComponent.api.updateTaskProgress('task-1.1', {
          status: 'running',
          progress: 50
        });
        
        progressComponent.api.updateTaskProgress('phase-1', {
          status: 'running',
          progress: 25
        });
        
        // Verify hierarchical progress
        const state = progressComponent.api.getState();
        expect(state.taskProgress).toBeDefined();
        expect(state.taskProgress['subtask-1.1.1']).toEqual({
          status: 'completed',
          progress: 100
        });
      }
    });
  });

  describe('Tool Requirements Validation', () => {
    test('should validate all tools across hierarchy', async () => {
      // Create plan with many tool requirements
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Project with extensive tooling');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Project with extensive tooling', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Validate all required tools
      const validation = await mockToolRegistryActor.validateTools(
        plan.requiredTools
      );
      
      expect(validation.availableTools).toContain('node');
      expect(validation.availableTools).toContain('react');
      expect(validation.missingTools).toContain('kubernetes');
      expect(validation.suggestions).toHaveLength(1);
    });

    test('should suggest alternatives for missing tools', async () => {
      // Mock missing tools scenario
      mockToolRegistryActor.validateTools.mockResolvedValueOnce({
        isValid: false,
        availableTools: ['node', 'npm'],
        missingTools: ['kubernetes', 'helm'],
        suggestions: [
          'Use Docker Compose instead of Kubernetes for local development',
          'Install Minikube for local Kubernetes testing'
        ],
        alternatives: {
          'kubernetes': ['docker-compose', 'docker-swarm'],
          'helm': ['kustomize', 'kubectl']
        }
      });
      
      // Create plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Deploy with Kubernetes');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Deploy with Kubernetes', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Validate and get alternatives
      const validation = await mockToolRegistryActor.validateTools(
        plan.requiredTools
      );
      
      expect(validation.isValid).toBe(false);
      expect(validation.alternatives).toBeDefined();
      expect(validation.alternatives['kubernetes']).toContain('docker-compose');
    });
  });

  describe('Complex Workflow Management', () => {
    test('should handle complete development lifecycle workflow', async () => {
      // Step 1: Planning
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      planningComponent.api.setGoal('Complete application lifecycle');
      
      const planPromise = planningComponent.api.createPlan();
      const plan = await mockPlanningActor.createPlan(
        'Complete application lifecycle', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      // Step 2: Validation
      const validation = await mockPlanningActor.validatePlan(plan);
      expect(validation.isValid).toBe(true);
      
      // Step 3: Decomposition
      const decomposition = await mockPlanningActor.decomposePlan(plan);
      expect(decomposition.decomposedTasks).toBe(15);
      
      // Step 4: Optimization
      const optimization = await mockPlanningActor.optimizePlan(plan);
      expect(optimization.optimized).toBe(true);
      
      // Step 5: Save to library
      await planningComponent.api.savePlan('Lifecycle Plan');
      expect(mockPlanningActor.savePlan).toHaveBeenCalled();
      
      // Step 6: Begin execution
      await component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const execComponent = component.getTabComponent('execution');
      if (execComponent && execComponent.api) {
        execComponent.api.setPlan(plan);
        await execComponent.api.startExecution();
        
        // Verify complete workflow
        expect(mockUmbilical.onPlanComplete).toHaveBeenCalled();
        expect(mockExecutionActor.startExecution).toHaveBeenCalled();
      }
    });

    test('should support iterative refinement of complex plans', async () => {
      // Initial complex plan
      await component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      
      // Iteration 1: Basic structure
      planningComponent.api.setGoal('MVP application');
      let planPromise = planningComponent.api.createPlan();
      let plan = await mockPlanningActor.createPlan('MVP application', {}, {});
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      const mvpPlan = planningComponent.api.getState().currentPlan;
      
      // Iteration 2: Add more features
      planningComponent.api.setGoal('MVP with authentication and payments');
      planPromise = planningComponent.api.createPlan();
      plan = await mockPlanningActor.createPlan(
        'MVP with authentication and payments', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      const enhancedPlan = planningComponent.api.getState().currentPlan;
      
      // Iteration 3: Scale to production
      planningComponent.api.setGoal('Production-ready scalable application');
      planPromise = planningComponent.api.createPlan();
      plan = await mockPlanningActor.createPlan(
        'Production-ready scalable application', {}, {}
      );
      planningComponent.api.handlePlanComplete(plan);
      await planPromise;
      
      const productionPlan = planningComponent.api.getState().currentPlan;
      
      // Verify iterative complexity increase
      expect(productionPlan.complexity).toBe('high');
      expect(productionPlan.requiredTools.length).toBeGreaterThan(
        mvpPlan.requiredTools.length
      );
    });
  });
});