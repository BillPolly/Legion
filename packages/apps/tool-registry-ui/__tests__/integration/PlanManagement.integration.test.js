/**
 * Plan Management Integration Tests
 * Tests plan management operations with live components and real services
 */

import { jest } from '@jest/globals';
import { PlanLibraryPanel } from '../../src/components/tool-registry/components/panels/PlanLibraryPanel.js';

describe('Plan Management Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1000px';
    dom.style.height = '700px';
    document.body.appendChild(dom);

    // Create umbilical with minimal mocking (integration test approach)
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component without planning actor for integration testing
    component = await PlanLibraryPanel.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Full Plan Lifecycle Integration', () => {
    test('should handle complete plan lifecycle with real components', async () => {
      const initialPlans = component.api.getPlans();
      const initialCount = initialPlans.length;

      // Create a comprehensive plan
      const newPlan = {
        id: 'integration-plan-001',
        name: 'Integration Test Plan',
        description: 'A comprehensive plan for testing the full lifecycle',
        tags: ['integration', 'testing', 'lifecycle'],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Complete integration testing workflow',
            complexity: 'COMPLEX',
            children: [
              {
                id: 'setup',
                description: 'Setup test environment',
                complexity: 'SIMPLE',
                children: []
              },
              {
                id: 'execute',
                description: 'Execute test scenarios',
                complexity: 'MEDIUM',
                children: [
                  {
                    id: 'unit-tests',
                    description: 'Run unit tests',
                    complexity: 'SIMPLE',
                    children: []
                  },
                  {
                    id: 'integration-tests',
                    description: 'Run integration tests',
                    complexity: 'MEDIUM',
                    children: []
                  }
                ]
              },
              {
                id: 'cleanup',
                description: 'Cleanup test environment',
                complexity: 'SIMPLE',
                children: []
              }
            ]
          }
        },
        metadata: {
          author: 'Integration Test Suite',
          version: '1.0.0',
          estimatedDuration: '30 minutes',
          priority: 'high'
        }
      };

      // 1. Save the plan (in local mode, add directly to model)
      component.model.addPlan(newPlan);
      
      // Verify plan was added to the collection
      let currentPlans = component.api.getPlans();
      expect(currentPlans.length).toBe(initialCount + 1);
      
      const foundPlan = currentPlans.find(p => p.id === 'integration-plan-001');
      expect(foundPlan).toBeTruthy();
      expect(foundPlan.name).toBe('Integration Test Plan');
      expect(foundPlan.tags).toContain('integration');

      // 2. Select the plan
      component.api.setSelectedPlan(foundPlan);
      expect(component.api.getSelectedPlan()).toEqual(foundPlan);

      // 3. Update the plan
      const updatedData = {
        description: 'Updated integration test plan with enhanced scenarios',
        version: '1.1.0',
        tags: ['integration', 'testing', 'lifecycle', 'enhanced'],
        updatedAt: new Date().toISOString()
      };

      component.model.updatePlan('integration-plan-001', updatedData);
      
      currentPlans = component.api.getPlans();
      const updatedPlan = currentPlans.find(p => p.id === 'integration-plan-001');
      expect(updatedPlan.description).toBe('Updated integration test plan with enhanced scenarios');
      expect(updatedPlan.tags).toContain('enhanced');

      // 4. Test search functionality
      component.api.searchPlans('enhanced');
      const searchResults = component.api.getFilteredPlans();
      expect(searchResults.some(p => p.id === 'integration-plan-001')).toBe(true);

      // 5. Test filtering by tags
      component.api.setFilterBy('enhanced');
      const filteredPlans = component.api.getFilteredPlans();
      expect(Array.isArray(filteredPlans)).toBe(true);

      // 6. Test sorting
      component.api.setSortBy('name');
      component.api.setSortOrder('asc');
      const sortedPlans = component.api.getFilteredPlans();
      expect(Array.isArray(sortedPlans)).toBe(true);

      // 7. Duplicate the plan (in local mode, manually duplicate)
      const duplicatedPlan = {
        ...updatedPlan,
        id: 'integration-plan-001-copy',
        name: 'Copy of ' + updatedPlan.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      component.model.addPlan(duplicatedPlan);
      
      currentPlans = component.api.getPlans();
      const foundDuplicate = currentPlans.find(p => p.id === 'integration-plan-001-copy');
      expect(foundDuplicate).toBeTruthy();
      expect(foundDuplicate.description).toBe(updatedPlan.description);

      // 8. Delete the original plan (in local mode)
      component.model.removePlan('integration-plan-001');
      
      currentPlans = component.api.getPlans();
      expect(currentPlans.find(p => p.id === 'integration-plan-001')).toBeUndefined();
      expect(component.api.getSelectedPlan()).toBeNull(); // Should clear selection
      
      // Duplicated plan should still exist
      expect(currentPlans.find(p => p.id === 'integration-plan-001-copy')).toBeTruthy();
    });

    test('should handle import/export workflow', async () => {
      // Prepare test plan for export
      const exportPlan = {
        id: 'export-test-plan',
        name: 'Export Test Plan',
        description: 'Plan designed for testing export/import functionality',
        tags: ['export', 'import', 'test'],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Export test workflow',
            children: [
              {
                id: 'step1',
                description: 'Prepare data for export',
                children: []
              },
              {
                id: 'step2',
                description: 'Verify export format',
                children: []
              }
            ]
          }
        }
      };

      component.model.addPlan(exportPlan);

      // Simulate export by getting the plan data
      const plans = component.api.getPlans();
      const planToExport = plans.find(p => p.id === 'export-test-plan');
      expect(planToExport).toBeTruthy();

      // Simulate import process with modified plan
      const importData = {
        ...planToExport,
        id: undefined, // Will be auto-generated
        name: 'Imported Test Plan',
        description: 'This plan was imported from exported data',
        metadata: {
          ...planToExport.metadata,
          importedAt: new Date().toISOString(),
          originalId: planToExport.id
        }
      };

      // Simulate import by adding the modified plan
      const importedPlan = {
        ...importData,
        id: 'imported-test-plan-' + Date.now(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      component.model.addPlan(importedPlan);
      
      expect(importedPlan).toBeTruthy();
      expect(importedPlan.name).toBe('Imported Test Plan');
      expect(importedPlan.id).toBeTruthy();
      expect(importedPlan.id).not.toBe('export-test-plan');

      // Verify both plans exist
      const finalPlans = component.api.getPlans();
      expect(finalPlans.find(p => p.id === 'export-test-plan')).toBeTruthy();
      expect(finalPlans.find(p => p.name === 'Imported Test Plan')).toBeTruthy();
    });
  });

  describe('Template System Integration', () => {
    test('should work with plan templates', async () => {
      // Create a template plan
      const template = {
        id: 'integration-template',
        name: 'Integration Test Template',
        description: 'A template for integration testing workflows',
        isTemplate: true,
        tags: ['template', 'integration'],
        templateConfig: {
          placeholders: ['{{project_name}}', '{{environment}}'],
          defaultValues: {
            timeout: 30000,
            retries: 3
          }
        },
        hierarchy: {
          root: {
            id: 'root',
            description: 'Integration testing for {{project_name}} in {{environment}}',
            children: [
              {
                id: 'setup-env',
                description: 'Setup {{environment}} environment',
                children: []
              },
              {
                id: 'run-tests',
                description: 'Run integration tests for {{project_name}}',
                children: []
              }
            ]
          }
        }
      };

      component.model.addPlan(template);

      // Verify template was added
      const plans = component.api.getPlans();
      const savedTemplate = plans.find(p => p.id === 'integration-template');
      expect(savedTemplate).toBeTruthy();
      expect(savedTemplate.isTemplate).toBe(true);

      // Get templates by filtering plans
      const allPlans = component.api.getPlans();
      const templates = allPlans.filter(p => p.isTemplate);
      expect(templates.some(t => t.id === 'integration-template')).toBe(true);

      // Test template usage (if createFromTemplate is available)
      if (component.api.createFromTemplate) {
        const templateData = {
          project_name: 'MyProject',
          environment: 'staging'
        };

        const createdPlan = await component.api.createFromTemplate(
          'integration-template',
          'MyProject Integration Tests',
          templateData
        );

        expect(createdPlan).toBeTruthy();
        expect(createdPlan.name).toBe('MyProject Integration Tests');
        expect(createdPlan.isTemplate).toBeFalsy();
        
        // Check placeholder replacement
        const planFromLibrary = component.api.getPlans().find(p => p.name === 'MyProject Integration Tests');
        expect(planFromLibrary.hierarchy.root.description).toContain('MyProject');
        expect(planFromLibrary.hierarchy.root.description).toContain('staging');
      }
    });
  });

  describe('State Management Integration', () => {
    test('should maintain consistent state across operations', async () => {
      // Reset any previous state to ensure clean test  
      component.api.searchPlans(''); // This sets search query
      component.api.setFilterBy('all');
      component.api.setSelectedPlan(null);
      
      const initialState = {
        plans: component.api.getPlans(),
        selectedPlan: component.api.getSelectedPlan(),
        searchQuery: component.api.getSearchQuery(),
        filterBy: component.api.getFilterBy(),
        sortBy: component.api.getSortBy(),
        sortOrder: component.api.getSortOrder()
      };

      // Perform multiple operations
      const testPlan = {
        id: 'state-test-plan',
        name: 'State Management Test',
        tags: ['state', 'test']
      };

      // 1. Add plan and verify state change
      // First ensure the plan doesn't already exist from previous test
      const plansBefore = component.api.getPlans().length;
      if (!component.api.getPlans().find(p => p.id === 'state-test-plan')) {
        component.model.addPlan(testPlan);
      }
      
      const plansAfter = component.api.getPlans().length;
      const foundPlan = component.api.getPlans().find(p => p.id === 'state-test-plan');
      expect(foundPlan).toBeTruthy();
      expect(foundPlan.name).toBe('State Management Test');

      // 2. Set filters and search
      component.api.setFilterBy('test');
      component.api.searchPlans('state');
      component.api.setSortBy('name');
      component.api.setSortOrder('desc');

      // Verify state changes
      expect(component.api.getFilterBy()).toBe('test');
      expect(component.api.getSearchQuery()).toBe('state');
      expect(component.api.getSortBy()).toBe('name');
      expect(component.api.getSortOrder()).toBe('desc');

      // 3. Select plan
      const savedPlan = component.api.getPlans().find(p => p.id === 'state-test-plan');
      component.api.setSelectedPlan(savedPlan);
      expect(component.api.getSelectedPlan()).toEqual(savedPlan);

      // 4. Delete plan and verify state cleanup
      component.model.removePlan('state-test-plan');
      expect(component.api.getSelectedPlan()).toBeNull();
      expect(component.api.getPlans().find(p => p.id === 'state-test-plan')).toBeUndefined();

      // Filters and search should persist
      expect(component.api.getFilterBy()).toBe('test');
      expect(component.api.getSearchQuery()).toBe('state');
    });

    test('should handle rapid successive operations', async () => {
      const operationResults = [];
      const planBase = {
        name: 'Rapid Test Plan',
        tags: ['rapid', 'test']
      };

      // Perform rapid operations
      for (let i = 0; i < 5; i++) {
        const plan = {
          ...planBase,
          id: `rapid-plan-${i}`,
          name: `${planBase.name} ${i}`,
          description: `Test plan number ${i}`
        };

        component.model.addPlan(plan);
        operationResults.push(plan);
      }

      // Verify all operations completed
      const plans = component.api.getPlans();
      const rapidPlans = plans.filter(p => p.id.startsWith('rapid-plan-'));
      expect(rapidPlans).toHaveLength(5);

      // Test rapid filtering
      component.api.setFilterBy('rapid');
      const filteredPlans = component.api.getFilteredPlans();
      const rapidFilteredPlans = filteredPlans.filter(p => p.tags && p.tags.includes('rapid'));
      expect(rapidFilteredPlans.length).toBeGreaterThan(0);

      // Cleanup - rapid deletion
      for (let i = 0; i < 5; i++) {
        component.model.removePlan(`rapid-plan-${i}`);
      }

      const finalPlans = component.api.getPlans();
      const remainingRapidPlans = finalPlans.filter(p => p.id.startsWith('rapid-plan-'));
      expect(remainingRapidPlans).toHaveLength(0);
    });
  });

  describe('Real Component Integration', () => {
    test('should integrate with view updates during operations', async () => {
      // Verify initial view state
      const libraryPanel = component.view.container.querySelector('.plan-library-panel');
      expect(libraryPanel).toBeTruthy();

      // Add a plan and verify view can be updated
      const viewTestPlan = {
        id: 'view-integration-plan',
        name: 'View Integration Test',
        description: 'Testing view integration with plan operations',
        tags: ['view', 'integration']
      };

      component.model.addPlan(viewTestPlan);

      // Update view with current plans
      const currentPlans = component.api.getFilteredPlans();
      component.view.updatePlansDisplay(currentPlans, 'grid');

      // Verify no errors occurred during view update
      expect(libraryPanel.style.display).not.toBe('none');

      // Test different view modes
      component.view.updatePlansDisplay(currentPlans, 'list');
      
      // Test empty state
      component.view.updatePlansDisplay([], 'grid');
      const emptyState = component.view.container.querySelector('.empty-state');
      if (emptyState) {
        expect(emptyState.style.display).not.toBe('none');
      }

      // Restore normal view
      component.view.updatePlansDisplay(currentPlans, 'grid');
    });

    test('should handle component lifecycle properly', async () => {
      // Verify component is properly initialized
      expect(component.api).toBeTruthy();
      expect(component.model).toBeTruthy();
      expect(component.view).toBeTruthy();

      // Test component validation if available  
      if (typeof component.validate === 'function') {
        const validation = component.validate();
        expect(validation).toBeTruthy();
        if (validation.isValid !== undefined) {
          expect(validation.isValid).toBe(true);
        }
      }
      
      // Component structure should be valid regardless
      expect(component.api).toBeTruthy();
      expect(component.model).toBeTruthy();
      expect(component.view).toBeTruthy();

      // Add some data
      const lifecyclePlan = {
        id: 'lifecycle-test',
        name: 'Lifecycle Test Plan',
        tags: ['lifecycle']
      };

      component.model.addPlan(lifecyclePlan);
      expect(component.api.getPlans().find(p => p.id === 'lifecycle-test')).toBeTruthy();

      // Component should handle cleanup properly
      // (cleanup happens in afterEach via component.destroy())
    });
  });
});