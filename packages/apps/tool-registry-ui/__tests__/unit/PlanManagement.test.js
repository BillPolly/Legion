/**
 * Plan Management Unit Tests
 * Tests save/load operations and plan editing functionality for PlanLibraryPanel
 */

import { jest } from '@jest/globals';
import { PlanLibraryPanel } from '../../src/components/tool-registry/components/panels/PlanLibraryPanel.js';

describe('Plan Management Unit Tests', () => {
  let component;
  let mockUmbilical;
  let mockPlanningActor;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock planning actor
    mockPlanningActor = {
      savePlan: jest.fn(),
      deletePlan: jest.fn(),
      getPlans: jest.fn(),
      updatePlan: jest.fn()
    };

    // Create mock umbilical with planning actor
    mockUmbilical = {
      dom,
      planningActor: mockPlanningActor,
      onPlanSave: jest.fn(),
      onPlanDelete: jest.fn(),
      onPlanImported: jest.fn(),
      onMount: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
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

  describe('Save Operations', () => {
    test('should save new plan via planning actor', async () => {
      const newPlan = {
        id: 'new-plan-123',
        name: 'Test Plan',
        description: 'A test plan for saving',
        tags: [],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root task',
            children: []
          }
        }
      };

      const savedPlan = {
        ...newPlan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft'
      };

      mockPlanningActor.savePlan.mockResolvedValue(savedPlan);

      const result = await component.api.savePlan(newPlan);

      expect(mockPlanningActor.savePlan).toHaveBeenCalledWith(newPlan);
      expect(result).toEqual(savedPlan);
      
      // Verify plan was added to local state
      const plans = component.api.getPlans();
      const foundPlan = plans.find(p => p.id === 'new-plan-123');
      expect(foundPlan).toBeTruthy();
    });

    test('should update existing plan via planning actor', async () => {
      const existingPlan = {
        id: 'existing-plan',
        name: 'Existing Plan',
        description: 'Original description',
        version: '1.0.0',
        tags: []
      };

      // Add existing plan to mock data
      component.model.addPlan(existingPlan);

      const updatedPlan = {
        ...existingPlan,
        description: 'Updated description',
        version: '1.1.0',
        updatedAt: new Date().toISOString()
      };

      mockPlanningActor.savePlan.mockResolvedValue(updatedPlan);

      const result = await component.api.savePlan(existingPlan);

      expect(mockPlanningActor.savePlan).toHaveBeenCalledWith(existingPlan);
      expect(result).toEqual(updatedPlan);
      
      // Verify plan was updated in local state
      const plans = component.api.getPlans();
      const foundPlan = plans.find(p => p.id === 'existing-plan');
      expect(foundPlan.description).toBe('Updated description');
    });

    test('should handle save errors gracefully', async () => {
      const plan = {
        id: 'error-plan',
        name: 'Error Plan',
        tags: []
      };

      const error = new Error('Failed to save plan to database');
      mockPlanningActor.savePlan.mockRejectedValue(error);

      await expect(component.api.savePlan(plan)).rejects.toThrow('Failed to save plan to database');
      expect(mockPlanningActor.savePlan).toHaveBeenCalledWith(plan);
    });

    test('should save plan without planning actor in local mode', async () => {
      // Create component without planning actor
      const localUmbilical = { ...mockUmbilical, planningActor: null };
      const localComponent = await PlanLibraryPanel.create(localUmbilical);

      const plan = {
        id: 'local-plan',
        name: 'Local Plan',
        description: 'Plan saved locally',
        tags: []
      };

      // In local mode, savePlan should not fail but may not persist
      const result = await localComponent.api.savePlan(plan);
      
      // Should handle gracefully without throwing
      expect(result).toBeUndefined(); // No actor to return saved plan

      localComponent.destroy();
    });
  });

  describe('Load Operations', () => {
    test('should load plans from planning actor', async () => {
      const mockPlans = [
        {
          id: 'loaded-plan-1',
          name: 'Loaded Plan 1',
          description: 'First loaded plan',
          createdAt: '2023-08-17T10:00:00Z'
        },
        {
          id: 'loaded-plan-2',
          name: 'Loaded Plan 2',
          description: 'Second loaded plan',
          createdAt: '2023-08-17T11:00:00Z'
        }
      ];

      mockPlanningActor.getPlans.mockResolvedValue(mockPlans);

      await component.api.loadPlans();

      expect(mockPlanningActor.getPlans).toHaveBeenCalled();
      
      const plans = component.api.getPlans();
      expect(plans).toEqual(mockPlans);
    });

    test('should handle load errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockPlanningActor.getPlans.mockRejectedValue(error);

      // Should not throw, but log error internally
      await component.api.loadPlans();
      
      expect(mockPlanningActor.getPlans).toHaveBeenCalled();
      // Plans should remain as mock data since load failed
      const plans = component.api.getPlans();
      expect(Array.isArray(plans)).toBe(true);
    });

    test('should use mock data when no planning actor available', async () => {
      // Create component without planning actor
      const localUmbilical = { ...mockUmbilical, planningActor: null };
      const localComponent = await PlanLibraryPanel.create(localUmbilical);

      await localComponent.api.loadPlans();
      
      // Should have mock data loaded
      const plans = localComponent.api.getPlans();
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);

      localComponent.destroy();
    });
  });

  describe('Delete Operations', () => {
    test('should delete plan via planning actor', async () => {
      const planToDelete = {
        id: 'delete-plan',
        name: 'Plan to Delete',
        tags: []
      };

      // Add plan to mock data
      component.model.addPlan(planToDelete);
      const initialCount = component.api.getPlans().length;

      mockPlanningActor.deletePlan.mockResolvedValue();

      await component.api.deletePlan('delete-plan');

      expect(mockPlanningActor.deletePlan).toHaveBeenCalledWith('delete-plan');
      
      // Verify plan was removed from local state
      const plans = component.api.getPlans();
      expect(plans.length).toBe(initialCount - 1);
      expect(plans.find(p => p.id === 'delete-plan')).toBeUndefined();
    });

    test('should handle delete errors gracefully', async () => {
      const error = new Error('Failed to delete plan from database');
      mockPlanningActor.deletePlan.mockRejectedValue(error);

      await expect(component.api.deletePlan('error-plan')).rejects.toThrow('Failed to delete plan from database');
      expect(mockPlanningActor.deletePlan).toHaveBeenCalledWith('error-plan');
    });

    test('should delete plan locally when no planning actor', async () => {
      // Create component without planning actor
      const localUmbilical = { ...mockUmbilical, planningActor: null };
      const localComponent = await PlanLibraryPanel.create(localUmbilical);

      const plans = localComponent.api.getPlans();
      const initialCount = plans.length;
      const planToDelete = plans[0];

      await localComponent.api.deletePlan(planToDelete.id);
      
      // Should remove from local state
      const remainingPlans = localComponent.api.getPlans();
      expect(remainingPlans.length).toBe(initialCount - 1);
      expect(remainingPlans.find(p => p.id === planToDelete.id)).toBeUndefined();

      localComponent.destroy();
    });

    test('should clear selected plan when deleting selected plan', async () => {
      const planToDelete = {
        id: 'selected-delete-plan',
        name: 'Selected Plan to Delete',
        tags: []
      };

      component.model.addPlan(planToDelete);
      component.api.setSelectedPlan(planToDelete); // Pass full object, not just ID
      
      expect(component.api.getSelectedPlan()).toEqual(planToDelete);

      mockPlanningActor.deletePlan.mockResolvedValue();
      await component.api.deletePlan('selected-delete-plan');

      // Selected plan should be cleared
      expect(component.api.getSelectedPlan()).toBeNull();
    });
  });

  describe('Plan Duplication', () => {
    test('should duplicate existing plan', async () => {
      const originalPlan = {
        id: 'original-plan',
        name: 'Original Plan',
        description: 'Plan to be duplicated',
        tags: ['test'],
        hierarchy: {
          root: {
            id: 'root',
            description: 'Root task',
            children: []
          }
        }
      };

      component.model.addPlan(originalPlan);
      const initialCount = component.api.getPlans().length;

      // Mock successful save of duplicated plan
      mockPlanningActor.savePlan.mockImplementation((plan) => {
        return Promise.resolve({
          ...plan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          status: 'draft'
        });
      });

      await component.api.duplicatePlan('original-plan');

      expect(mockPlanningActor.savePlan).toHaveBeenCalled();
      
      // Verify duplicated plan was added
      const plans = component.api.getPlans();
      expect(plans.length).toBe(initialCount + 1);
      
      // Find the duplicated plan (should have different ID but similar content)
      const duplicatedPlan = plans.find(p => p.id !== 'original-plan' && p.name.includes('Copy'));
      expect(duplicatedPlan).toBeTruthy();
      expect(duplicatedPlan.description).toBe(originalPlan.description);
    });

    test('should handle duplication of non-existent plan', async () => {
      const result = await component.api.duplicatePlan('non-existent-plan');
      
      // Should handle gracefully
      expect(result).toBeUndefined();
      expect(mockPlanningActor.savePlan).not.toHaveBeenCalled();
    });
  });

  describe('Plan Import Operations', () => {
    test('should import plan from object data', async () => {
      const importData = {
        name: 'Imported Plan',
        description: 'Plan imported from external source',
        hierarchy: {
          root: {
            id: 'root',
            description: 'Imported root task',
            children: []
          }
        }
      };

      const savedPlan = {
        ...importData,
        id: expect.stringMatching(/^imported-\d+$/),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        status: 'draft'
      };

      mockPlanningActor.savePlan.mockResolvedValue(savedPlan);

      const result = await component.api.importPlan(importData);

      expect(result).toEqual(savedPlan);
      expect(mockPlanningActor.savePlan).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Imported Plan',
        description: 'Plan imported from external source'
      }));

      // Verify import callback was triggered
      expect(mockUmbilical.onPlanImported).toHaveBeenCalledWith(savedPlan);
    });

    test('should import plan from JSON string', async () => {
      const planData = {
        name: 'JSON Imported Plan',
        description: 'Plan from JSON string'
      };

      const jsonString = JSON.stringify(planData);

      mockPlanningActor.savePlan.mockImplementation((plan) => {
        return Promise.resolve({
          ...plan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      const result = await component.api.importPlan(jsonString);

      expect(result).toBeTruthy();
      expect(result.name).toBe('JSON Imported Plan');
      expect(mockPlanningActor.savePlan).toHaveBeenCalled();
    });

    test('should handle import errors gracefully', async () => {
      const invalidData = "invalid json data";

      await expect(component.api.importPlan(invalidData)).rejects.toThrow();
    });
  });

  describe('Plan Selection and Current Plan Management', () => {
    test('should set and get selected plan', () => {
      const plan = {
        id: 'selected-plan',
        name: 'Selected Plan',
        tags: []
      };

      component.model.addPlan(plan);
      component.api.setSelectedPlan(plan); // Pass full object

      const selectedPlan = component.api.getSelectedPlan();
      expect(selectedPlan).toEqual(plan);
    });

    test('should set and get current plan', () => {
      const plan = {
        id: 'current-plan',
        name: 'Current Plan'
      };

      component.api.setCurrentPlan(plan);

      const currentPlan = component.api.getCurrentPlan();
      expect(currentPlan).toEqual(plan);
    });

    test('should clear selected plan when setting to null', () => {
      const plan = { id: 'temp-plan', name: 'Temp Plan', tags: [] };
      component.model.addPlan(plan);
      component.api.setSelectedPlan(plan); // Pass full object
      
      expect(component.api.getSelectedPlan()).toBeTruthy();
      
      component.api.setSelectedPlan(null);
      expect(component.api.getSelectedPlan()).toBeNull();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle network timeouts during save', async () => {
      const plan = { id: 'timeout-plan', name: 'Timeout Plan' };
      
      mockPlanningActor.savePlan.mockRejectedValue(new Error('Network timeout'));

      await expect(component.api.savePlan(plan)).rejects.toThrow('Network timeout');
    });

    test('should handle malformed plan data', async () => {
      const malformedPlan = {
        // Missing required fields
        description: 'Plan without required fields'
      };

      mockPlanningActor.savePlan.mockRejectedValue(new Error('Invalid plan structure'));

      await expect(component.api.savePlan(malformedPlan)).rejects.toThrow('Invalid plan structure');
    });

    test('should handle concurrent modifications', async () => {
      const plan1 = { 
        id: 'concurrent-plan-1', 
        name: 'Concurrent Plan 1',
        tags: []
      };
      const plan2 = { 
        id: 'concurrent-plan-2', 
        name: 'Concurrent Plan 2',
        tags: []
      };
      
      // Simulate two separate save operations
      mockPlanningActor.savePlan.mockImplementation((plan) => {
        return Promise.resolve({
          ...plan,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      });

      await Promise.all([
        component.api.savePlan(plan1),
        component.api.savePlan(plan2)
      ]);
      
      // Both should complete without error
      expect(mockPlanningActor.savePlan).toHaveBeenCalledTimes(2);
    });
  });
});