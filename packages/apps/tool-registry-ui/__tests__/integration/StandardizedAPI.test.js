/**
 * Standardized API Integration Tests
 * Verifies that all components follow the standardized API interface
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { PlanVisualizationPanel } from '../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js';

describe('Standardized API Integration', () => {
  let dom, container, mockUmbilical, component;

  beforeEach(() => {
    // Create DOM environment
    dom = new JSDOM(`<!DOCTYPE html><div id="container"></div>`);
    global.document = dom.window.document;
    global.window = dom.window;
    global.XMLSerializer = dom.window.XMLSerializer;
    global.URL = {
      createObjectURL: jest.fn(() => 'mock-url'),
      revokeObjectURL: jest.fn()
    };
    global.Blob = jest.fn();
    
    container = dom.window.document.getElementById('container');

    // Mock umbilical
    mockUmbilical = {
      dom: container,
      onMount: jest.fn(),
      onViewChange: jest.fn(),
      onLayoutChange: jest.fn(),
      onZoomChange: jest.fn(),
      onNodeClick: jest.fn(),
      onNodeHover: jest.fn(),
      onEdgeClick: jest.fn()
    };
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  describe('PlanVisualizationPanel Standardized API', () => {
    test('should expose all required lifecycle methods', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Check that standardized lifecycle methods are available
      expect(component.api.isReady).toBeDefined();
      expect(component.api.getState).toBeDefined();
      expect(component.api.setState).toBeDefined();
      expect(component.api.reset).toBeDefined();
      expect(component.api.destroy).toBeDefined();
      
      // Test lifecycle methods work
      expect(component.api.isReady()).toBe(true);
      expect(typeof component.api.getState()).toBe('object');
    });

    test('should expose all required error handling methods', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Check that standardized error handling methods are available
      expect(component.api.getLastError).toBeDefined();
      expect(component.api.clearError).toBeDefined();
      expect(component.api.hasError).toBeDefined();
      
      // Test error handling methods work
      expect(component.api.hasError()).toBe(false);
      expect(component.api.getLastError()).toBeNull();
    });

    test('should expose all required validation methods', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Check that standardized validation methods are available
      expect(component.api.validate).toBeDefined();
      expect(component.api.isValid).toBeDefined();
      expect(component.api.getValidationErrors).toBeDefined();
      
      // Test validation methods work
      expect(component.api.isValid()).toBe(true);
      expect(Array.isArray(component.api.getValidationErrors())).toBe(true);
      
      const validationResult = component.api.validate();
      expect(validationResult.success).toBe(true);
      expect(validationResult.data.isValid).toBe(true);
    });

    test('should maintain component-specific API methods', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Check that component-specific methods are still available
      expect(component.api.setPlan).toBeDefined();
      expect(component.api.getPlan).toBeDefined();
      expect(component.api.setViewMode).toBeDefined();
      expect(component.api.getViewMode).toBeDefined();
      expect(component.api.exportAsSVG).toBeDefined();
      
      // Test component-specific methods work
      const mockPlan = {
        hierarchy: {
          root: { id: 'root', description: 'Test' }
        }
      };
      
      component.api.setPlan(mockPlan);
      expect(component.api.getPlan()).toEqual(mockPlan);
    });

    test('should follow standardized naming conventions', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      const apiMethods = Object.keys(component.api);
      
      // Check that getter methods follow get[Property] pattern
      const getterMethods = apiMethods.filter(method => method.startsWith('get'));
      getterMethods.forEach(method => {
        expect(method).toMatch(/^get[A-Z][a-zA-Z]*$/);
      });
      
      // Check that setter methods follow set[Property] pattern  
      const setterMethods = apiMethods.filter(method => method.startsWith('set'));
      setterMethods.forEach(method => {
        expect(method).toMatch(/^set[A-Z][a-zA-Z]*$/);
      });
      
      // Check that boolean methods follow is[Property] pattern
      const booleanMethods = apiMethods.filter(method => method.startsWith('is'));
      booleanMethods.forEach(method => {
        expect(method).toMatch(/^is[A-Z][a-zA-Z]*$/);
      });
    });

    test('should provide API documentation', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Check that component provides API documentation
      expect(component.getAPIDocumentation).toBeDefined();
      
      const docs = component.getAPIDocumentation();
      expect(docs.componentName).toBe('PlanVisualizationPanel');
      expect(docs.isStandardized).toBe(true);
      expect(docs.categories).toBeDefined();
      expect(docs.totalMethods).toBeGreaterThan(0);
    });

    test('should handle setState and getState consistently', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Test state management through standardized API
      const testValue = 'test-view-mode';
      const setResult = component.api.setState('viewMode', testValue);
      
      expect(setResult.success).toBe(true);
      expect(component.api.getState('viewMode')).toBe(testValue);
      expect(component.api.getState()).toHaveProperty('viewMode', testValue);
    });

    test('should handle reset functionality', async () => {
      component = await PlanVisualizationPanel.create(mockUmbilical);
      
      // Set some state
      component.api.setPlan({ hierarchy: { root: { id: 'test' } } });
      component.api.setViewMode('radial');
      
      // Reset component
      const resetResult = component.api.reset();
      expect(resetResult.success).toBe(true);
      
      // Verify state was reset
      expect(component.api.getPlan()).toBeNull();
      expect(component.api.getViewMode()).toBe('hierarchical'); // default
    });
  });
});