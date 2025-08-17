/**
 * PlanLibraryPanel Standardized API Tests
 * Verifies standardized API implementation
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('PlanLibraryPanel Standardized API', () => {
  let component, mockUmbilical, container, dom;

  beforeEach(() => {
    // Create DOM environment
    dom = new JSDOM(`<!DOCTYPE html><div id="container"></div>`);
    global.document = dom.window.document;
    global.window = dom.window;
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
      planningActor: {
        getPlans: jest.fn(() => Promise.resolve([])),
        savePlan: jest.fn(),
        deletePlan: jest.fn()
      }
    };
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  test('should create component with standardized API', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    expect(component).toBeDefined();
    expect(component.api).toBeDefined();
  });

  test('should have all required lifecycle methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check standardized lifecycle methods
    expect(component.api.isReady).toBeDefined();
    expect(component.api.getState).toBeDefined();
    expect(component.api.setState).toBeDefined();
    expect(component.api.reset).toBeDefined();
    expect(component.api.destroy).toBeDefined();
    
    // Test lifecycle methods work
    expect(component.api.isReady()).toBe(true);
    expect(typeof component.api.getState()).toBe('object');
  });

  test('should have all required error handling methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check standardized error handling methods
    expect(component.api.getLastError).toBeDefined();
    expect(component.api.clearError).toBeDefined();
    expect(component.api.hasError).toBeDefined();
    
    // Test error handling methods work
    expect(component.api.hasError()).toBe(false);
    expect(component.api.getLastError()).toBeNull();
  });

  test('should have all required validation methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check standardized validation methods
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

  test('should have plan management methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check plan management methods
    expect(component.api.loadPlans).toBeDefined();
    expect(component.api.getPlans).toBeDefined();
    expect(component.api.savePlan).toBeDefined();
    expect(component.api.deletePlan).toBeDefined();
    expect(component.api.duplicatePlan).toBeDefined();
    
    // Test plan management
    expect(Array.isArray(component.api.getPlans())).toBe(true);
  });

  test('should have current and selected plan methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check plan selection methods
    expect(component.api.setCurrentPlan).toBeDefined();
    expect(component.api.getCurrentPlan).toBeDefined();
    expect(component.api.setSelectedPlan).toBeDefined();
    expect(component.api.getSelectedPlan).toBeDefined();
    
    // Test plan selection
    const mockPlan = { id: 'test-plan', name: 'Test Plan' };
    component.api.setCurrentPlan(mockPlan);
    expect(component.api.getCurrentPlan()).toEqual(mockPlan);
    
    component.api.setSelectedPlan(mockPlan);
    expect(component.api.getSelectedPlan()).toEqual(mockPlan);
  });

  test('should have search and filtering methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check search and filter methods
    expect(component.api.searchPlans).toBeDefined();
    expect(component.api.getSearchQuery).toBeDefined();
    expect(component.api.setFilterBy).toBeDefined();
    expect(component.api.getFilterBy).toBeDefined();
    expect(component.api.setSortBy).toBeDefined();
    expect(component.api.getSortBy).toBeDefined();
    expect(component.api.setSortOrder).toBeDefined();
    expect(component.api.getSortOrder).toBeDefined();
    expect(component.api.getFilteredPlans).toBeDefined();
    
    // Test filtering
    component.api.setFilterBy('templates');
    expect(component.api.getFilterBy()).toBe('templates');
    
    component.api.setSortBy('name');
    expect(component.api.getSortBy()).toBe('name');
    
    component.api.setSortOrder('asc');
    expect(component.api.getSortOrder()).toBe('asc');
  });

  test('should have tag management methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check tag methods
    expect(component.api.getTags).toBeDefined();
    expect(component.api.getSelectedTags).toBeDefined();
    expect(component.api.setSelectedTags).toBeDefined();
    expect(component.api.addTag).toBeDefined();
    expect(component.api.removeTag).toBeDefined();
    
    // Test tag management
    expect(Array.isArray(component.api.getTags())).toBe(true);
    expect(Array.isArray(component.api.getSelectedTags())).toBe(true);
    
    component.api.setSelectedTags(['frontend', 'react']);
    expect(component.api.getSelectedTags()).toEqual(['frontend', 'react']);
    
    component.api.addTag('backend');
    expect(component.api.getSelectedTags()).toContain('backend');
    
    component.api.removeTag('react');
    expect(component.api.getSelectedTags()).not.toContain('react');
  });

  test('should have view configuration methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check view methods
    expect(component.api.setViewMode).toBeDefined();
    expect(component.api.getViewMode).toBeDefined();
    
    // Test view mode
    component.api.setViewMode('list');
    expect(component.api.getViewMode()).toBe('list');
  });

  test('should have import/export methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check import/export methods
    expect(component.api.importPlan).toBeDefined();
    expect(component.api.exportPlan).toBeDefined();
    expect(component.api.exportPlans).toBeDefined();
    expect(component.api.isImportInProgress).toBeDefined();
    expect(component.api.isExportInProgress).toBeDefined();
    
    // Test status methods
    expect(typeof component.api.isImportInProgress()).toBe('boolean');
    expect(typeof component.api.isExportInProgress()).toBe('boolean');
  });

  test('should have metadata methods', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check metadata methods
    expect(component.api.getPlanMetadata).toBeDefined();
    expect(component.api.setPlanMetadata).toBeDefined();
    
    // Test metadata management
    const metadata = { author: 'test', version: '1.0' };
    component.api.setPlanMetadata('plan-1', metadata);
    expect(component.api.getPlanMetadata('plan-1')).toEqual(metadata);
  });

  test('should follow standardized naming conventions', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    const apiMethods = Object.keys(component.api);
    
    // Check getter methods follow get[Property] pattern
    const getterMethods = apiMethods.filter(method => method.startsWith('get'));
    getterMethods.forEach(method => {
      expect(method).toMatch(/^get[A-Z][a-zA-Z]*$/);
    });
    
    // Check setter methods follow set[Property] pattern  
    const setterMethods = apiMethods.filter(method => method.startsWith('set'));
    setterMethods.forEach(method => {
      expect(method).toMatch(/^set[A-Z][a-zA-Z]*$/);
    });
    
    // Check boolean methods follow is[Property] pattern
    const booleanMethods = apiMethods.filter(method => method.startsWith('is'));
    booleanMethods.forEach(method => {
      expect(method).toMatch(/^is[A-Z][a-zA-Z]*$/);
    });
  });

  test('should provide API documentation', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Check that component provides API documentation
    expect(component.getAPIDocumentation).toBeDefined();
    
    const docs = component.getAPIDocumentation();
    expect(docs.componentName).toBe('PlanLibraryPanel');
    expect(docs.isStandardized).toBe(true);
    expect(docs.categories).toBeDefined();
    expect(docs.totalMethods).toBeGreaterThan(0);
  });

  test('should handle component-specific validation', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Test with invalid sort configuration
    component.api.setSortBy('invalidField');
    const validationResult = component.api.validate();
    expect(validationResult.data.isValid).toBe(false);
    expect(validationResult.data.errors).toContain('Invalid sort field: invalidField');
    
    // Fix the validation error
    component.api.setSortBy('name');
    const validResult = component.api.validate();
    expect(validResult.data.isValid).toBe(true);
  });

  test('should handle search functionality', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    component = await PlanLibraryPanel.create(mockUmbilical);
    
    // Test search
    const results = component.api.searchPlans('test query');
    expect(Array.isArray(results)).toBe(true);
    expect(component.api.getSearchQuery()).toBe('test query');
  });
});