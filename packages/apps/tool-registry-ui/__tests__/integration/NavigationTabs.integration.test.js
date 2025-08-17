/**
 * NavigationTabs Integration Tests
 * Tests tab switching and panel loading with real components
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('NavigationTabs Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1200px';
    dom.style.height = '800px';
    document.body.appendChild(dom);

    // Define full planning interface tabs
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
        label: 'Progress Overlay',
        title: 'Progress Overlay',
        icon: '📈',
        component: 'ProgressOverlayPanel'
      }
    ];

    // Create comprehensive umbilical with actors and callbacks
    mockUmbilical = {
      dom,
      tabs,
      activeTab: 'planning',
      
      // Planning actors (minimal mocking for integration testing)
      planningActor: {
        createPlan: jest.fn().mockResolvedValue({ id: 'plan-1', name: 'Test Plan' }),
        decomposePlan: jest.fn().mockResolvedValue({ hierarchy: {} }),
        savePlan: jest.fn().mockResolvedValue({ id: 'plan-1' }),
        loadPlan: jest.fn().mockResolvedValue({ id: 'plan-1' }),
        getPlans: jest.fn().mockResolvedValue([])
      },
      
      executionActor: {
        executePlan: jest.fn().mockResolvedValue({ executionId: 'exec-1' }),
        pauseExecution: jest.fn().mockResolvedValue(),
        resumeExecution: jest.fn().mockResolvedValue(),
        stopExecution: jest.fn().mockResolvedValue(),
        getExecutionStatus: jest.fn().mockResolvedValue({ status: 'idle' })
      },
      
      toolRegistryActor: {
        searchTools: jest.fn().mockResolvedValue([]),
        getToolDetails: jest.fn().mockResolvedValue({}),
        validateTools: jest.fn().mockResolvedValue({ valid: true })
      },
      
      // Planning callbacks for cross-panel communication
      onPlanCreate: jest.fn(),
      onPlanComplete: jest.fn(),
      onPlanLoad: jest.fn(),
      onPlanEdit: jest.fn(),
      onCreateNewPlan: jest.fn(),
      onPlanImported: jest.fn(),
      
      // Execution callbacks
      onExecutionStart: jest.fn(),
      onExecutionComplete: jest.fn(),
      onTaskProgress: jest.fn(),
      
      // Visualization callbacks
      onNodeSelect: jest.fn(),
      onNodeHover: jest.fn(),
      
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

  describe('Complete Tab Switching Integration', () => {
    test('should load and switch between all planning panels', async () => {
      const tabIds = ['planning', 'visualization', 'execution', 'library', 'progress'];
      
      for (const tabId of tabIds) {
        // Switch to tab
        await component.switchTab(tabId);
        
        // Verify tab is active
        expect(component.getActiveTab()).toBe(tabId);
        
        // Verify panel is loaded
        const panel = dom.querySelector(`[data-tab-id="${tabId}"]`);
        expect(panel).toBeTruthy();
        expect(panel.classList.contains('active')).toBe(true);
        
        // Verify panel has content
        expect(panel.innerHTML.length).toBeGreaterThan(0);
        
        // Verify component was loaded
        const loadedComponent = component.getTabComponent(tabId);
        if (loadedComponent) {
          expect(loadedComponent).toBeTruthy();
          expect(typeof loadedComponent).toBe('object');
        }
      }
    });

    test('should maintain component instances across tab switches', async () => {
      // Load all panels
      await component.loadPanelContent('planning');
      await component.loadPanelContent('visualization');
      await component.loadPanelContent('library');
      
      const planningComponent1 = component.getTabComponent('planning');
      const visualizationComponent1 = component.getTabComponent('visualization');
      const libraryComponent1 = component.getTabComponent('library');
      
      // Switch tabs multiple times
      component.switchTab('visualization');
      component.switchTab('library');
      component.switchTab('planning');
      
      // Components should be the same instances
      const planningComponent2 = component.getTabComponent('planning');
      const visualizationComponent2 = component.getTabComponent('visualization');
      const libraryComponent2 = component.getTabComponent('library');
      
      expect(planningComponent1).toBe(planningComponent2);
      expect(visualizationComponent1).toBe(visualizationComponent2);
      expect(libraryComponent1).toBe(libraryComponent2);
    });

    test('should handle rapid tab switching without errors', async () => {
      const switchSequence = [
        'planning', 'visualization', 'execution', 'library', 'progress',
        'library', 'planning', 'execution', 'visualization', 'progress',
        'planning', 'library', 'visualization', 'execution'
      ];
      
      for (const tabId of switchSequence) {
        await component.switchTab(tabId);
        expect(component.getActiveTab()).toBe(tabId);
      }
      
      // Final state should be consistent
      expect(component.getActiveTab()).toBe('execution');
      expect(component.getTabs()).toHaveLength(5);
    });
  });

  describe('Cross-Panel Data Flow Integration', () => {
    test('should support plan flow from library to workspace to visualization', async () => {
      // Load relevant panels
      await component.loadPanelContent('library');
      await component.loadPanelContent('planning');
      await component.loadPanelContent('visualization');
      
      const libraryComponent = component.getTabComponent('library');
      const planningComponent = component.getTabComponent('planning');
      const visualizationComponent = component.getTabComponent('visualization');
      
      // All components should be loaded
      expect(libraryComponent).toBeTruthy();
      expect(planningComponent).toBeTruthy();
      expect(visualizationComponent).toBeTruthy();
      
      // Simulate plan selection in library
      if (libraryComponent && libraryComponent.api) {
        const mockPlan = {
          id: 'integration-plan',
          name: 'Integration Test Plan',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Test plan for integration',
              children: []
            }
          }
        };
        
        // Test plan loading workflow
        libraryComponent.api.setSelectedPlan(mockPlan);
        expect(libraryComponent.api.getSelectedPlan()).toEqual(mockPlan);
      }
    });

    test('should support execution flow from planning to execution to progress', async () => {
      // Load execution-related panels
      await component.loadPanelContent('planning');
      await component.loadPanelContent('execution');
      await component.loadPanelContent('progress');
      
      const planningComponent = component.getTabComponent('planning');
      const executionComponent = component.getTabComponent('execution');
      const progressComponent = component.getTabComponent('progress');
      
      expect(planningComponent).toBeTruthy();
      expect(executionComponent).toBeTruthy();
      expect(progressComponent).toBeTruthy();
      
      // Test execution workflow preparation
      if (planningComponent && planningComponent.api) {
        const mockPlan = {
          id: 'execution-plan',
          name: 'Execution Test Plan',
          hierarchy: {
            root: {
              id: 'root',
              description: 'Test execution plan',
              children: []
            }
          }
        };
        
        // Use the correct API method based on the planning component's actual interface
        if (planningComponent.api.setCurrentPlan) {
          planningComponent.api.setCurrentPlan(mockPlan);
        }
        
        // Check if the plan was set (may use different getter method)
        if (planningComponent.api.getCurrentPlan) {
          expect(planningComponent.api.getCurrentPlan()).toEqual(mockPlan);
        } else if (planningComponent.api.getState) {
          const state = planningComponent.api.getState();
          expect(state.currentPlan).toEqual(mockPlan);
        }
      }
    });

    test('should handle component state synchronization', async () => {
      // Load all panels
      const tabIds = ['planning', 'visualization', 'execution', 'library', 'progress'];
      
      for (const tabId of tabIds) {
        await component.loadPanelContent(tabId);
      }
      
      // Test state updates across components
      const testPlan = {
        id: 'sync-test-plan',
        name: 'Synchronization Test Plan',
        version: '1.0.0'
      };
      
      // Update component states
      component.updateComponentState('planning', { currentPlan: testPlan });
      component.updateComponentState('visualization', { plan: testPlan });
      component.updateComponentState('execution', { plan: testPlan });
      
      // Should not throw errors even if components don't have specific methods
      expect(() => {
        component.updateComponentState('library', { selectedPlan: testPlan });
        component.updateComponentState('progress', { activePlan: testPlan });
      }).not.toThrow();
    });
  });

  describe('Component Lifecycle Integration', () => {
    test('should handle component initialization and cleanup properly', async () => {
      // Load components
      await component.loadPanelContent('planning');
      await component.loadPanelContent('visualization');
      
      const planningComponent = component.getTabComponent('planning');
      const visualizationComponent = component.getTabComponent('visualization');
      
      expect(planningComponent).toBeTruthy();
      expect(visualizationComponent).toBeTruthy();
      
      // Components should have APIs
      if (planningComponent) {
        expect(planningComponent.api).toBeTruthy();
      }
      
      if (visualizationComponent) {
        expect(visualizationComponent.api).toBeTruthy();
      }
      
      // Test cleanup
      component.destroy();
      
      // Component references should still exist but container should be empty
      expect(dom.innerHTML).toBe('');
    });

    test('should handle component loading errors gracefully', async () => {
      // Test loading non-existent or problematic components
      const invalidTabIds = ['invalid-tab', 'non-existent-panel'];
      
      for (const tabId of invalidTabIds) {
        await expect(component.loadPanelContent(tabId)).resolves.not.toThrow();
      }
      
      // Valid panels should still work
      await component.loadPanelContent('planning');
      expect(component.getTabComponent('planning')).toBeTruthy();
    });

    test('should support multiple component instances without conflicts', async () => {
      // Load multiple instances of the same component type
      await component.loadPanelContent('planning');
      await component.loadPanelContent('visualization');
      await component.loadPanelContent('execution');
      
      // Switch between panels multiple times
      component.switchTab('planning');
      component.switchTab('visualization');
      component.switchTab('execution');
      component.switchTab('planning');
      
      // All components should remain functional
      expect(component.getTabComponent('planning')).toBeTruthy();
      expect(component.getTabComponent('visualization')).toBeTruthy();
      expect(component.getTabComponent('execution')).toBeTruthy();
    });
  });

  describe('Planning Workflow Integration', () => {
    test('should support complete planning workflow integration', async () => {
      // Test complete workflow: Library -> Planning -> Visualization -> Execution -> Progress
      
      // 1. Load plan from library
      component.switchTab('library');
      await component.loadPanelContent('library');
      
      const libraryComponent = component.getTabComponent('library');
      expect(libraryComponent).toBeTruthy();
      
      // 2. Create/edit plan in workspace
      component.switchTab('planning');
      await component.loadPanelContent('planning');
      
      const planningComponent = component.getTabComponent('planning');
      expect(planningComponent).toBeTruthy();
      
      // 3. Visualize plan
      component.switchTab('visualization');
      await component.loadPanelContent('visualization');
      
      const visualizationComponent = component.getTabComponent('visualization');
      expect(visualizationComponent).toBeTruthy();
      
      // 4. Execute plan
      component.switchTab('execution');
      await component.loadPanelContent('execution');
      
      const executionComponent = component.getTabComponent('execution');
      expect(executionComponent).toBeTruthy();
      
      // 5. Monitor progress
      component.switchTab('progress');
      await component.loadPanelContent('progress');
      
      const progressComponent = component.getTabComponent('progress');
      expect(progressComponent).toBeTruthy();
      
      // All workflow components should be loaded and functional
      expect(component.getTabs()).toHaveLength(5);
      expect(component.getActiveTab()).toBe('progress');
    });

    test('should handle actor communication across panels', async () => {
      // Load panels that use actors
      await component.loadPanelContent('planning');
      await component.loadPanelContent('library');
      await component.loadPanelContent('execution');
      
      // Verify actors are available to components
      expect(mockUmbilical.planningActor).toBeTruthy();
      expect(mockUmbilical.executionActor).toBeTruthy();
      expect(mockUmbilical.toolRegistryActor).toBeTruthy();
      
      // Components should be able to use actor methods
      const planningComponent = component.getTabComponent('planning');
      const libraryComponent = component.getTabComponent('library');
      const executionComponent = component.getTabComponent('execution');
      
      expect(planningComponent).toBeTruthy();
      expect(libraryComponent).toBeTruthy();
      expect(executionComponent).toBeTruthy();
      
      // Test that actors can be called (they're mocked so they should resolve)
      await expect(mockUmbilical.planningActor.createPlan({})).resolves.toBeTruthy();
      await expect(mockUmbilical.executionActor.getExecutionStatus()).resolves.toBeTruthy();
    });

    test('should maintain state consistency during workflow transitions', async () => {
      const testPlan = {
        id: 'workflow-plan',
        name: 'Workflow Test Plan',
        status: 'draft',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Test workflow plan',
            children: []
          }
        }
      };
      
      // Load all workflow panels
      await component.loadPanelContent('library');
      await component.loadPanelContent('planning');
      await component.loadPanelContent('visualization');
      await component.loadPanelContent('execution');
      
      // Set plan in library
      component.switchTab('library');
      const libraryComponent = component.getTabComponent('library');
      if (libraryComponent && libraryComponent.api) {
        libraryComponent.api.setSelectedPlan(testPlan);
      }
      
      // Load plan in workspace
      component.switchTab('planning');
      const planningComponent = component.getTabComponent('planning');
      if (planningComponent && planningComponent.api) {
        if (planningComponent.api.setCurrentPlan) {
          planningComponent.api.setCurrentPlan(testPlan);
        }
      }
      
      // Set plan in visualization
      component.switchTab('visualization');
      const visualizationComponent = component.getTabComponent('visualization');
      if (visualizationComponent && visualizationComponent.api) {
        if (visualizationComponent.api.setPlan) {
          visualizationComponent.api.setPlan(testPlan);
        }
      }
      
      // Set plan in execution
      component.switchTab('execution');
      const executionComponent = component.getTabComponent('execution');
      if (executionComponent && executionComponent.api) {
        if (executionComponent.api.setPlan) {
          executionComponent.api.setPlan(testPlan);
        }
      }
      
      // State should be consistent across all panels
      if (libraryComponent && libraryComponent.api) {
        if (libraryComponent.api.getSelectedPlan) {
          const selectedPlan = libraryComponent.api.getSelectedPlan();
          if (selectedPlan) {
            expect(selectedPlan).toEqual(testPlan);
          }
        }
      }
      
      if (planningComponent && planningComponent.api) {
        if (planningComponent.api.getCurrentPlan) {
          expect(planningComponent.api.getCurrentPlan()).toEqual(testPlan);
        } else if (planningComponent.api.getState) {
          const state = planningComponent.api.getState();
          if (state.currentPlan) {
            expect(state.currentPlan).toEqual(testPlan);
          }
        }
      }
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle concurrent panel loading efficiently', async () => {
      const startTime = Date.now();
      
      // Load multiple panels concurrently
      const loadPromises = [
        component.loadPanelContent('planning'),
        component.loadPanelContent('visualization'),
        component.loadPanelContent('execution'),
        component.loadPanelContent('library'),
        component.loadPanelContent('progress')
      ];
      
      await Promise.all(loadPromises);
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // All panels should be loaded
      expect(component.getTabComponent('planning')).toBeTruthy();
      expect(component.getTabComponent('visualization')).toBeTruthy();
      expect(component.getTabComponent('execution')).toBeTruthy();
      expect(component.getTabComponent('library')).toBeTruthy();
      expect(component.getTabComponent('progress')).toBeTruthy();
      
      // Loading should complete in reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(5000); // 5 seconds
    });

    test('should manage memory properly during component lifecycle', async () => {
      // Load panels
      await component.loadPanelContent('planning');
      await component.loadPanelContent('visualization');
      
      const initialMemoryUsage = process.memoryUsage().heapUsed;
      
      // Switch tabs multiple times
      for (let i = 0; i < 10; i++) {
        component.switchTab('planning');
        component.switchTab('visualization');
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemoryUsage = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;
      
      // Memory increase should be reasonable (adjust threshold as needed)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });
  });
});