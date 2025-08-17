/**
 * PlanLibraryPanel Unit Tests
 * Tests plan library management and plan operations functionality
 */

import { jest } from '@jest/globals';
import { PlanLibraryPanel } from '../../PlanLibraryPanel.js';

describe('PlanLibraryPanel Unit Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock umbilical
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onPlanSelect: jest.fn(),
      onPlanLoad: jest.fn(),
      onPlanSave: jest.fn(),
      onPlanDelete: jest.fn(),
      onPlanImport: jest.fn(),
      onPlanExport: jest.fn(),
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

  describe('Component Initialization', () => {
    test('should initialize with StandardizedComponentAPI', () => {
      expect(component).toBeTruthy();
      expect(component.api).toBeTruthy();
      expect(component.model).toBeTruthy();
      expect(component.view).toBeTruthy();
    });

    test('should have mock data loaded', () => {
      const plans = component.api.getPlans();
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);
    });
  });

  describe('Basic API Methods', () => {
    test('should have all required API methods', () => {
      // Verify core methods exist
      expect(typeof component.api.getPlans).toBe('function');
      expect(typeof component.api.searchPlans).toBe('function');
      expect(typeof component.api.setFilterBy).toBe('function');
      expect(typeof component.api.setSortBy).toBe('function');
      expect(typeof component.api.setSortOrder).toBe('function');
      expect(typeof component.api.getFilteredPlans).toBe('function');
    });

    test('should return filtered plans', () => {
      const filteredPlans = component.api.getFilteredPlans();
      expect(Array.isArray(filteredPlans)).toBe(true);
    });
  });

  describe('Search and Filter Operations', () => {
    test('should search plans', () => {
      const results = component.api.searchPlans('test');
      expect(Array.isArray(results)).toBe(true);
      expect(component.api.getSearchQuery()).toBe('test');
    });

    test('should set filter', () => {
      component.api.setFilterBy('backend');
      expect(component.api.getFilterBy()).toBe('backend');
    });

    test('should set sort criteria', () => {
      component.api.setSortBy('name');
      expect(component.api.getSortBy()).toBe('name');
      
      component.api.setSortOrder('asc');
      expect(component.api.getSortOrder()).toBe('asc');
    });
  });

  describe('View Components', () => {
    test('should render library interface', () => {
      const libraryPanel = component.view.container.querySelector('.plan-library-panel');
      expect(libraryPanel).toBeTruthy();

      const header = component.view.container.querySelector('.library-header');
      expect(header).toBeTruthy();

      const controls = component.view.container.querySelector('.library-controls');
      expect(controls).toBeTruthy();
    });

    test('should have plan display areas', () => {
      const planGrid = component.view.container.querySelector('.plans-grid') ||
                      component.view.container.querySelector('.plan-grid');
      const planList = component.view.container.querySelector('.plans-list') ||
                      component.view.container.querySelector('.plan-list');
      
      // Should have at least one display mode
      expect(planGrid || planList).toBeTruthy();
    });
  });

  describe('Plan Management', () => {
    test('should handle plan operations with existing mock data', () => {
      const initialPlans = component.api.getPlans();
      expect(initialPlans.length).toBeGreaterThan(0);
      
      const firstPlan = initialPlans[0];
      expect(firstPlan).toBeTruthy();
      expect(firstPlan.id).toBeTruthy();
      expect(firstPlan.name).toBeTruthy();
    });
  });

  describe('Integration with StandardizedComponentAPI', () => {
    test('should have destroy method', () => {
      expect(typeof component.destroy).toBe('function');
    });

    test('should have component structure', () => {
      expect(component).toBeTruthy();
      expect(component.api).toBeTruthy();
      expect(component.model).toBeTruthy();
      expect(component.view).toBeTruthy();
    });
  });
});