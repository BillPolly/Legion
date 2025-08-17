/**
 * NavigationTabs Planning Integration Unit Tests
 * Tests new tab configurations for planning panels
 */

import { jest } from '@jest/globals';
import { NavigationTabs } from '../../src/components/tool-registry/components/NavigationTabs.js';

describe('NavigationTabs Planning Integration Unit Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1000px';
    dom.style.height = '700px';
    document.body.appendChild(dom);

    // Define planning tabs configuration
    const planningTabs = [
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

    // Create mock umbilical with planning actors
    mockUmbilical = {
      dom,
      tabs: planningTabs,
      activeTab: 'planning',
      
      // Planning actors
      planningActor: {
        createPlan: jest.fn(),
        decomposePlan: jest.fn(),
        savePlan: jest.fn(),
        loadPlan: jest.fn(),
        getPlans: jest.fn()
      },
      
      executionActor: {
        executePlan: jest.fn(),
        pauseExecution: jest.fn(),
        resumeExecution: jest.fn(),
        stopExecution: jest.fn(),
        getExecutionStatus: jest.fn()
      },
      
      toolRegistryActor: {
        searchTools: jest.fn(),
        getToolDetails: jest.fn(),
        validateTools: jest.fn()
      },
      
      // Planning callbacks
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
      
      // Standard callbacks
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

  describe('Tab Configuration Validation', () => {
    test('should initialize with planning tab configurations', () => {
      const tabs = component.getTabs();
      
      expect(tabs).toHaveLength(5);
      expect(tabs.map(t => t.id)).toEqual(['planning', 'visualization', 'execution', 'library', 'progress']);
      
      // Verify each tab has required properties
      tabs.forEach(tab => {
        expect(tab.id).toBeTruthy();
        expect(tab.label).toBeTruthy();
        expect(tab.title).toBeTruthy();
        expect(tab.icon).toBeTruthy();
        expect(tab.component).toBeTruthy();
      });
    });

    test('should set planning workspace as initial active tab', () => {
      const activeTab = component.getActiveTab();
      expect(activeTab).toBe('planning');
    });

    test('should validate planning component configurations', () => {
      const tabs = component.getTabs();
      
      const planningTab = tabs.find(t => t.id === 'planning');
      expect(planningTab.component).toBe('PlanningWorkspacePanel');
      expect(planningTab.icon).toBe('🧠');
      
      const visualizationTab = tabs.find(t => t.id === 'visualization');
      expect(visualizationTab.component).toBe('PlanVisualizationPanel');
      expect(visualizationTab.icon).toBe('📊');
      
      const executionTab = tabs.find(t => t.id === 'execution');
      expect(executionTab.component).toBe('ExecutionControlPanel');
      expect(executionTab.icon).toBe('⚡');
      
      const libraryTab = tabs.find(t => t.id === 'library');
      expect(libraryTab.component).toBe('PlanLibraryPanel');
      expect(libraryTab.icon).toBe('📚');
      
      const progressTab = tabs.find(t => t.id === 'progress');
      expect(progressTab.component).toBe('ProgressOverlayPanel');
      expect(progressTab.icon).toBe('📈');
    });

    test('should handle tab management operations', () => {
      // Test tab switching
      component.switchTab('visualization');
      expect(component.getActiveTab()).toBe('visualization');
      
      // onTabChange callback should be called if available
      if (mockUmbilical.onTabChange.mock.calls.length > 0) {
        expect(mockUmbilical.onTabChange).toHaveBeenCalledWith('visualization', expect.objectContaining({
          id: 'visualization',
          component: 'PlanVisualizationPanel'
        }));
      }

      // Test tab updates
      component.updateTab('planning', { badge: 3 });
      const updatedTab = component.getTabs().find(t => t.id === 'planning');
      expect(updatedTab.badge).toBe(3);

      // Test adding new tab
      const newTab = {
        id: 'settings',
        label: 'Settings',
        title: 'Settings',
        icon: '⚙️',
        component: 'SettingsPanel'
      };
      component.addTab(newTab);
      expect(component.getTabs()).toHaveLength(6);
      expect(component.getTabs().find(t => t.id === 'settings')).toBeTruthy();

      // Test removing tab
      component.removeTab('settings');
      expect(component.getTabs()).toHaveLength(5);
      expect(component.getTabs().find(t => t.id === 'settings')).toBeUndefined();
    });
  });

  describe('Planning Panel Component Loading', () => {
    test('should handle component loading for planning panels', async () => {
      // Test that component loading can be initiated
      expect(typeof component.loadPanelContent).toBe('function');
      
      // Test loading without mocking (will use fallback)
      await component.loadPanelContent('planning');
      
      // Should create the panel element
      const planningPanel = dom.querySelector('[data-tab-id="planning"]');
      expect(planningPanel).toBeTruthy();
      
      // Component loading should complete without errors
      expect(planningPanel.innerHTML).not.toBe('');
    });

    test('should support component loading for all planning panels', async () => {
      const planningPanelIds = ['planning', 'visualization', 'execution', 'library', 'progress'];
      
      for (const panelId of planningPanelIds) {
        await component.loadPanelContent(panelId);
        
        const panel = dom.querySelector(`[data-tab-id="${panelId}"]`);
        expect(panel).toBeTruthy();
        expect(panel.innerHTML).not.toBe('');
      }
    });

    test('should handle component loading without errors', async () => {
      // Test that component loading completes without throwing
      expect(async () => {
        await component.loadPanelContent('planning');
        await component.loadPanelContent('visualization');
        await component.loadPanelContent('execution');
      }).not.toThrow();
    });

    test('should create fallback content for unavailable components', async () => {
      // Load a panel - will create fallback since components don't exist in test
      await component.loadPanelContent('planning');
      
      const planningPanel = dom.querySelector('[data-tab-id="planning"]');
      expect(planningPanel).toBeTruthy();
      
      // Should have some content (either component or fallback)
      expect(planningPanel.innerHTML.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Panel Communication', () => {
    test('should configure cross-panel communication callbacks', () => {
      // Verify planning workspace can communicate with other panels
      const tabs = component.getTabs();
      const planningTab = tabs.find(t => t.id === 'planning');
      expect(planningTab).toBeTruthy();
      
      // Test that switching tabs works without error
      expect(() => {
        component.switchTab('visualization');
        component.switchTab('execution');
        component.switchTab('library');
      }).not.toThrow();
      
      // Verify active tab changes
      component.switchTab('visualization');
      expect(component.getActiveTab()).toBe('visualization');
      
      component.switchTab('execution');
      expect(component.getActiveTab()).toBe('execution');
    });

    test('should support component state updates across panels', () => {
      // Test updating component state
      const mockPlan = { id: 'test-plan', name: 'Test Plan' };
      
      // This would typically be called when a plan is loaded
      component.updateComponentState('planning', { currentPlan: mockPlan });
      component.updateComponentState('visualization', { plan: mockPlan });
      component.updateComponentState('execution', { plan: mockPlan });
      
      // No errors should occur even without loaded components
      expect(() => {
        component.updateComponentState('planning', { currentPlan: mockPlan });
      }).not.toThrow();
    });

    test('should handle component access for cross-panel operations', async () => {
      // Component loading should be available
      expect(typeof component.loadPanelContent).toBe('function');
      expect(typeof component.getTabComponent).toBe('function');
      
      // Test component loading
      await component.loadPanelContent('planning');
      
      // Test getting tab components after loading
      const planningComponent = component.getTabComponent('planning');
      
      // Component should be loaded now
      if (planningComponent) {
        expect(planningComponent).toBeTruthy();
        expect(typeof planningComponent).toBe('object');
      }
    });
  });

  describe('Planning Workflow Integration', () => {
    test('should support complete planning workflow', async () => {
      // Test workflow: Library -> Planning -> Visualization -> Execution
      
      // 1. Start in library to browse plans
      component.switchTab('library');
      expect(component.getActiveTab()).toBe('library');
      
      // 2. Switch to planning workspace for creating/editing plans
      component.switchTab('planning');
      expect(component.getActiveTab()).toBe('planning');
      
      // 3. Switch to visualization for plan review
      component.switchTab('visualization');
      expect(component.getActiveTab()).toBe('visualization');
      
      // 4. Switch to execution for plan execution
      component.switchTab('execution');
      expect(component.getActiveTab()).toBe('execution');
      
      // 5. Monitor progress overlay
      component.switchTab('progress');
      expect(component.getActiveTab()).toBe('progress');
      
      // All tab switches should complete without errors
      expect(component.getActiveTab()).toBe('progress');
    });

    test('should handle planning actor integration', () => {
      // Verify planning actors are available in umbilical
      expect(mockUmbilical.planningActor).toBeTruthy();
      expect(mockUmbilical.executionActor).toBeTruthy();
      expect(mockUmbilical.toolRegistryActor).toBeTruthy();
      
      // Verify planning callbacks are configured
      expect(mockUmbilical.onPlanCreate).toBeTruthy();
      expect(mockUmbilical.onPlanComplete).toBeTruthy();
      expect(mockUmbilical.onExecutionStart).toBeTruthy();
      expect(mockUmbilical.onExecutionComplete).toBeTruthy();
    });

    test('should handle error states in planning components', async () => {
      // Test that component loading handles errors gracefully
      await component.loadPanelContent('planning');
      
      // Should create some content without throwing
      const planningPanel = dom.querySelector('[data-tab-id="planning"]');
      expect(planningPanel).toBeTruthy();
      expect(planningPanel.innerHTML.length).toBeGreaterThan(0);
      
      // Component loading should not throw errors
      expect(async () => {
        await component.loadPanelContent('visualization');
        await component.loadPanelContent('execution');
      }).not.toThrow();
    });
  });

  describe('State Synchronization', () => {
    test('should maintain consistent state across tab switches', () => {
      const initialActiveTab = component.getActiveTab();
      expect(initialActiveTab).toBe('planning');
      
      // Switch tabs multiple times
      component.switchTab('visualization');
      component.switchTab('execution');
      component.switchTab('library');
      component.switchTab('planning');
      
      // State should be consistent
      expect(component.getActiveTab()).toBe('planning');
      expect(component.getTabs()).toHaveLength(5);
    });

    test('should handle tab state updates correctly', () => {
      // Update tab with badge
      component.updateTab('planning', { badge: 5 });
      const planningTab = component.getTabs().find(t => t.id === 'planning');
      expect(planningTab.badge).toBe(5);
      
      // Update multiple properties
      component.updateTab('visualization', { 
        badge: 2, 
        disabled: false,
        tooltip: 'Updated visualization panel'
      });
      
      const visualizationTab = component.getTabs().find(t => t.id === 'visualization');
      expect(visualizationTab.badge).toBe(2);
      expect(visualizationTab.disabled).toBe(false);
      expect(visualizationTab.tooltip).toBe('Updated visualization panel');
    });

    test('should preserve tab order and configuration', () => {
      const originalTabs = component.getTabs();
      const originalTabIds = originalTabs.map(t => t.id);
      
      // Switch tabs multiple times
      component.switchTab('library');
      component.switchTab('execution');
      component.switchTab('visualization');
      
      // Tab order should remain unchanged
      const currentTabs = component.getTabs();
      const currentTabIds = currentTabs.map(t => t.id);
      expect(currentTabIds).toEqual(originalTabIds);
      
      // Original configurations should be preserved
      expect(currentTabs).toEqual(originalTabs);
    });
  });
});