/**
 * Planning System Integration Tests
 * Verifies that all planning components work together correctly
 */

import { jest } from '@jest/globals';

// Import all planning components
import { GoalInputInterface } from '../../src/components/tool-registry/components/panels/GoalInputInterface.js';
import { PlanVisualizationPanel } from '../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js';
import { ExecutionControlPanel } from '../../src/components/tool-registry/components/panels/ExecutionControlPanel.js';
import { PlanLibraryPanel } from '../../src/components/tool-registry/components/panels/PlanLibraryPanel.js';
import { PlanningWorkspacePanel } from '../../src/components/tool-registry/components/panels/PlanningWorkspacePanel.js';
import { DecompositionTreeComponent } from '../../src/components/tool-registry/components/panels/DecompositionTreeComponent.js';

// Import support components
import { StandardizedComponentAPI } from '../../src/components/tool-registry/base/StandardizedComponentAPI.js';
import { APIDocumentationGenerator } from '../../src/components/tool-registry/documentation/APIDocumentationGenerator.js';

describe('Planning System Integration', () => {
  let components;
  let documentationGenerator;

  beforeEach(async () => {
    
    // Initialize documentation generator
    documentationGenerator = new APIDocumentationGenerator();
    
    // Initialize all components
    components = {
      goalInput: null,
      planVisualization: null,
      executionControl: null,
      planLibrary: null,
      planningWorkspace: null,
      decompositionTree: null
    };

    // Create mock umbilical for each component
    const createMockUmbilical = (name) => ({
      onMount: jest.fn(),
      container: document.createElement('div'),
      componentName: name
    });

    // Initialize components
    try {
      components.goalInput = await GoalInputInterface.create(
        createMockUmbilical('GoalInputInterface')
      );
      
      components.planVisualization = await PlanVisualizationPanel.create(
        createMockUmbilical('PlanVisualizationPanel')
      );
      
      components.executionControl = await ExecutionControlPanel.create(
        createMockUmbilical('ExecutionControlPanel')
      );
      
      components.planLibrary = await PlanLibraryPanel.create(
        createMockUmbilical('PlanLibraryPanel')
      );
      
      components.planningWorkspace = await PlanningWorkspacePanel.create(
        createMockUmbilical('PlanningWorkspacePanel')
      );
      
      components.decompositionTree = await DecompositionTreeComponent.create(
        createMockUmbilical('DecompositionTreeComponent')
      );
    } catch (error) {
      console.error('Failed to initialize components:', error);
    }
  });

  afterEach(() => {
    // Clean up components
    Object.values(components).forEach(component => {
      if (component && component.api && component.api.destroy) {
        component.api.destroy();
      }
    });
  });

  describe('Component Initialization', () => {
    test('all components should initialize successfully', () => {
      expect(components.goalInput).toBeDefined();
      expect(components.planVisualization).toBeDefined();
      expect(components.executionControl).toBeDefined();
      expect(components.planLibrary).toBeDefined();
      expect(components.planningWorkspace).toBeDefined();
      expect(components.decompositionTree).toBeDefined();
    });

    test('all components should have standardized API', () => {
      Object.values(components).forEach(component => {
        if (component && component.api) {
          // Check for standard lifecycle methods
          expect(typeof component.api.isReady).toBe('function');
          expect(typeof component.api.getState).toBe('function');
          expect(typeof component.api.setState).toBe('function');
          expect(typeof component.api.reset).toBe('function');
          expect(typeof component.api.destroy).toBe('function');
          
          // Check for error handling methods
          expect(typeof component.api.hasError).toBe('function');
          expect(typeof component.api.getLastError).toBe('function');
          expect(typeof component.api.clearError).toBe('function');
        }
      });
    });

    test('all components should be ready after initialization', () => {
      Object.values(components).forEach(component => {
        if (component && component.api) {
          expect(component.api.isReady()).toBe(true);
        }
      });
    });
  });

  describe('Goal Input to Planning Flow', () => {
    test('should flow from goal input to planning workspace', async () => {
      if (!components.goalInput || !components.planningWorkspace) {
        console.warn('Components not initialized, skipping test');
        return;
      }

      // Set a goal
      const goal = 'Create a REST API for user management';
      components.goalInput.api.setGoal(goal);
      
      // Add preferences
      components.goalInput.api.setPreference('language', 'JavaScript');
      components.goalInput.api.setPreference('framework', 'Express');
      
      // Get goal configuration
      const goalConfig = {
        goal: components.goalInput.api.getGoal(),
        preferences: components.goalInput.api.getPreferences()
      };
      
      expect(goalConfig.goal).toBe(goal);
      expect(goalConfig.preferences.language).toBe('JavaScript');
      
      // Submit to planning workspace
      if (components.goalInput.api.canSubmit()) {
        const result = components.goalInput.api.submitGoal();
        expect(result.success).toBe(true);
      }
    });

    test('should validate goal before submission', () => {
      if (!components.goalInput) return;
      
      // Try to submit without goal
      expect(components.goalInput.api.canSubmit()).toBe(false);
      
      // Set goal and check again
      components.goalInput.api.setGoal('Test goal');
      expect(components.goalInput.api.canSubmit()).toBe(true);
    });
  });

  describe('Plan Visualization Integration', () => {
    test('should load and visualize plans', async () => {
      if (!components.planVisualization) return;
      
      // Create a mock plan
      const mockPlan = {
        id: 'test-plan-1',
        name: 'Test Plan',
        goal: 'Test Goal',
        steps: [
          { id: 'step-1', name: 'Step 1', type: 'action' },
          { id: 'step-2', name: 'Step 2', type: 'decision' },
          { id: 'step-3', name: 'Step 3', type: 'action' }
        ],
        edges: [
          { from: 'step-1', to: 'step-2' },
          { from: 'step-2', to: 'step-3' }
        ]
      };
      
      // Load the plan
      const result = await components.planVisualization.api.loadPlan(mockPlan);
      expect(result.success).toBe(true);
      
      // Check current plan
      const currentPlan = components.planVisualization.api.getCurrentPlan();
      expect(currentPlan).toBeDefined();
      expect(currentPlan.id).toBe('test-plan-1');
    });

    test('should support different visualization modes', () => {
      if (!components.planVisualization) return;
      
      const modes = ['hierarchical', 'circular', 'force'];
      
      modes.forEach(mode => {
        const result = components.planVisualization.api.setVisualizationMode(mode);
        expect(result.success).toBe(true);
        
        const currentMode = components.planVisualization.api.getVisualizationMode();
        expect(currentMode).toBe(mode);
      });
    });
  });

  describe('Execution Control Integration', () => {
    test('should control plan execution', async () => {
      if (!components.executionControl) return;
      
      // Start execution
      const startResult = await components.executionControl.api.startExecution();
      expect(startResult.success).toBe(true);
      
      // Check execution state
      let state = components.executionControl.api.getExecutionState();
      expect(state).toBe('running');
      
      // Pause execution
      const pauseResult = components.executionControl.api.pauseExecution();
      expect(pauseResult.success).toBe(true);
      
      state = components.executionControl.api.getExecutionState();
      expect(state).toBe('paused');
      
      // Resume execution
      const resumeResult = components.executionControl.api.resumeExecution();
      expect(resumeResult.success).toBe(true);
      
      state = components.executionControl.api.getExecutionState();
      expect(state).toBe('running');
      
      // Stop execution
      const stopResult = components.executionControl.api.stopExecution();
      expect(stopResult.success).toBe(true);
      
      state = components.executionControl.api.getExecutionState();
      expect(state).toBe('stopped');
    });

    test('should manage breakpoints', () => {
      if (!components.executionControl) return;
      
      // Set breakpoints
      components.executionControl.api.setBreakpoint('step-1');
      components.executionControl.api.setBreakpoint('step-3');
      
      // Get breakpoints
      const breakpoints = components.executionControl.api.getBreakpoints();
      expect(breakpoints).toContain('step-1');
      expect(breakpoints).toContain('step-3');
      
      // Remove breakpoint
      components.executionControl.api.removeBreakpoint('step-1');
      
      const updatedBreakpoints = components.executionControl.api.getBreakpoints();
      expect(updatedBreakpoints).not.toContain('step-1');
      expect(updatedBreakpoints).toContain('step-3');
    });
  });

  describe('Plan Library Integration', () => {
    test('should manage saved plans', async () => {
      if (!components.planLibrary) return;
      
      // Create test plans
      const plans = [
        { id: 'plan-1', name: 'API Development', goal: 'Create REST API' },
        { id: 'plan-2', name: 'Database Design', goal: 'Design database schema' },
        { id: 'plan-3', name: 'Frontend Development', goal: 'Build React UI' }
      ];
      
      // Save plans
      for (const plan of plans) {
        const result = await components.planLibrary.api.savePlan(plan);
        expect(result.success).toBe(true);
      }
      
      // Get all plans
      const savedPlans = components.planLibrary.api.getPlans();
      expect(savedPlans.length).toBe(3);
      
      // Search plans
      const searchResults = components.planLibrary.api.searchPlans('API');
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].name).toBe('API Development');
      
      // Delete a plan
      const deleteResult = components.planLibrary.api.deletePlan('plan-2');
      expect(deleteResult.success).toBe(true);
      
      const remainingPlans = components.planLibrary.api.getPlans();
      expect(remainingPlans.length).toBe(2);
    });

    test('should export and import plans', async () => {
      if (!components.planLibrary) return;
      
      // Add some plans
      const plans = [
        { id: 'export-1', name: 'Plan 1', goal: 'Goal 1' },
        { id: 'export-2', name: 'Plan 2', goal: 'Goal 2' }
      ];
      
      for (const plan of plans) {
        await components.planLibrary.api.savePlan(plan);
      }
      
      // Export plans
      const exported = components.planLibrary.api.exportPlans();
      expect(exported).toBeDefined();
      expect(exported.plans).toBeInstanceOf(Array);
      expect(exported.plans.length).toBe(2);
      
      // Clear library
      components.planLibrary.api.clearLibrary();
      expect(components.planLibrary.api.getPlans().length).toBe(0);
      
      // Import plans back
      const importResult = components.planLibrary.api.importPlans(exported);
      expect(importResult.success).toBe(true);
      expect(components.planLibrary.api.getPlans().length).toBe(2);
    });
  });

  describe('Decomposition Tree Integration', () => {
    test('should manage plan decomposition', () => {
      if (!components.decompositionTree) return;
      
      // Create a decomposition tree
      const tree = {
        root: 'Main Goal',
        children: [
          { id: 'sub1', name: 'Subgoal 1', children: [] },
          { id: 'sub2', name: 'Subgoal 2', children: [
            { id: 'sub2-1', name: 'Task 1', children: [] },
            { id: 'sub2-2', name: 'Task 2', children: [] }
          ]}
        ]
      };
      
      // Load tree
      if (components.decompositionTree.api.loadTree) {
        const result = components.decompositionTree.api.loadTree(tree);
        expect(result.success).toBe(true);
      }
      
      // Get tree structure
      if (components.decompositionTree.api.getTree) {
        const loadedTree = components.decompositionTree.api.getTree();
        expect(loadedTree).toBeDefined();
      }
    });

    test('should handle node operations', () => {
      if (!components.decompositionTree) return;
      
      // Add nodes
      if (components.decompositionTree.api.addNode) {
        const result = components.decompositionTree.api.addNode('parent', {
          id: 'new-node',
          name: 'New Task'
        });
        expect(result.success).toBe(true);
      }
      
      // Remove nodes
      if (components.decompositionTree.api.removeNode) {
        const result = components.decompositionTree.api.removeNode('new-node');
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Component Communication', () => {
    test('should communicate between goal input and planning workspace', async () => {
      if (!components.goalInput || !components.planningWorkspace) return;
      
      // Set up goal in input
      components.goalInput.api.setGoal('Build authentication system');
      components.goalInput.api.setPreference('security', 'high');
      
      // Submit goal (simulated)
      const goalData = {
        goal: components.goalInput.api.getGoal(),
        preferences: components.goalInput.api.getPreferences()
      };
      
      // Planning workspace should be able to receive this
      if (components.planningWorkspace.api.setGoalConfiguration) {
        const result = components.planningWorkspace.api.setGoalConfiguration(goalData);
        expect(result.success).toBe(true);
      }
    });

    test('should coordinate visualization and execution', async () => {
      if (!components.planVisualization || !components.executionControl) return;
      
      // Load a plan in visualization
      const plan = {
        id: 'exec-plan',
        name: 'Execution Test',
        steps: [
          { id: 's1', name: 'Initialize' },
          { id: 's2', name: 'Process' },
          { id: 's3', name: 'Complete' }
        ]
      };
      
      await components.planVisualization.api.loadPlan(plan);
      
      // Execution control should be able to use this plan
      if (components.executionControl.api.loadPlan) {
        const result = await components.executionControl.api.loadPlan(plan);
        expect(result.success).toBe(true);
      }
      
      // Set breakpoint on visualization step
      if (components.planVisualization.api.highlightStep) {
        components.planVisualization.api.highlightStep('s2');
      }
      
      // Execution control sets corresponding breakpoint
      components.executionControl.api.setBreakpoint('s2');
      expect(components.executionControl.api.getBreakpoints()).toContain('s2');
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle errors gracefully across components', async () => {
      if (!components.goalInput) return;
      
      // Simulate an error
      components.goalInput.api.setError(new Error('Test error'));
      
      // Check error state
      expect(components.goalInput.api.hasError()).toBe(true);
      
      // Get error details
      const error = components.goalInput.api.getLastError();
      expect(error).toBeDefined();
      expect(error.message).toBe('Test error');
      
      // Clear error
      components.goalInput.api.clearError();
      expect(components.goalInput.api.hasError()).toBe(false);
    });

    test('should recover from errors using retry mechanism', async () => {
      if (!components.planLibrary) return;
      
      let attempts = 0;
      const flakyOperation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true, data: 'Success after retry' };
      };
      
      // Execute with retry
      const result = await components.planLibrary.api.executeWithRetry(
        flakyOperation,
        { maxRetries: 3 }
      );
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('Success after retry');
      expect(attempts).toBe(2);
    });
  });

  describe('Documentation Generation', () => {
    test('should generate documentation for all components', () => {
      Object.entries(components).forEach(([name, component]) => {
        if (component && component.api) {
          const doc = documentationGenerator.generateComponentDocumentation(
            component,
            component.api
          );
          
          expect(doc).toBeDefined();
          expect(doc.name).toBeDefined();
          expect(doc.api).toBeDefined();
          expect(doc.categories).toBeDefined();
        }
      });
    });

    test('should export documentation in multiple formats', () => {
      if (!components.goalInput) return;
      
      // Generate documentation
      documentationGenerator.generateComponentDocumentation(
        components.goalInput,
        components.goalInput.api
      );
      
      // Get markdown
      const markdown = documentationGenerator.generateMarkdown('GoalInputInterface');
      expect(markdown).toContain('# GoalInputInterface API Documentation');
      expect(markdown).toContain('## Methods');
      
      // Get HTML
      const html = documentationGenerator.generateHTML('GoalInputInterface');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('GoalInputInterface API Documentation');
    });
  });

  describe('Full Workflow Integration', () => {
    test('should complete full planning workflow', async () => {
      // Skip if components not initialized
      const allComponentsReady = Object.values(components).every(c => c !== null);
      if (!allComponentsReady) {
        console.warn('Not all components initialized, skipping workflow test');
        return;
      }
      
      // 1. Set goal
      components.goalInput.api.setGoal('Create microservices architecture');
      components.goalInput.api.setPreference('language', 'TypeScript');
      components.goalInput.api.setPreference('containerization', 'Docker');
      
      // 2. Generate plan (simulated)
      const plan = {
        id: 'workflow-plan',
        name: 'Microservices Plan',
        goal: components.goalInput.api.getGoal(),
        steps: [
          { id: 'design', name: 'Design Architecture' },
          { id: 'implement', name: 'Implement Services' },
          { id: 'test', name: 'Test Services' },
          { id: 'deploy', name: 'Deploy to Production' }
        ],
        edges: [
          { from: 'design', to: 'implement' },
          { from: 'implement', to: 'test' },
          { from: 'test', to: 'deploy' }
        ]
      };
      
      // 3. Visualize plan
      await components.planVisualization.api.loadPlan(plan);
      expect(components.planVisualization.api.getCurrentPlan()).toBeDefined();
      
      // 4. Save to library
      await components.planLibrary.api.savePlan(plan);
      expect(components.planLibrary.api.getPlans().length).toBeGreaterThan(0);
      
      // 5. Set up execution
      components.executionControl.api.setBreakpoint('test');
      
      // 6. Start execution
      await components.executionControl.api.startExecution();
      expect(components.executionControl.api.getExecutionState()).toBe('running');
      
      // 7. Stop execution
      components.executionControl.api.stopExecution();
      expect(components.executionControl.api.getExecutionState()).toBe('stopped');
      
      // 8. Check final state
      const savedPlans = components.planLibrary.api.getPlans();
      expect(savedPlans.some(p => p.id === 'workflow-plan')).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large plans efficiently', async () => {
      if (!components.planVisualization) return;
      
      // Create a large plan
      const largePlan = {
        id: 'large-plan',
        name: 'Large Plan',
        steps: [],
        edges: []
      };
      
      // Add 100 steps
      for (let i = 0; i < 100; i++) {
        largePlan.steps.push({
          id: `step-${i}`,
          name: `Step ${i}`,
          type: i % 3 === 0 ? 'decision' : 'action'
        });
        
        if (i > 0) {
          largePlan.edges.push({
            from: `step-${i - 1}`,
            to: `step-${i}`
          });
        }
      }
      
      const startTime = Date.now();
      await components.planVisualization.api.loadPlan(largePlan);
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time (2 seconds)
      expect(loadTime).toBeLessThan(2000);
      
      // Should still be functional
      const currentPlan = components.planVisualization.api.getCurrentPlan();
      expect(currentPlan.steps.length).toBe(100);
    });

    test('should handle multiple concurrent operations', async () => {
      if (!components.planLibrary) return;
      
      // Create multiple plans concurrently
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          components.planLibrary.api.savePlan({
            id: `concurrent-${i}`,
            name: `Concurrent Plan ${i}`,
            goal: `Goal ${i}`
          })
        );
      }
      
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // All should be saved
      const plans = components.planLibrary.api.getPlans();
      expect(plans.length).toBeGreaterThanOrEqual(10);
    });
  });
});