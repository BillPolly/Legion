/**
 * Comprehensive Standardized API Integration Tests
 * Verifies all planning components follow standardized API patterns
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('All Standardized APIs Integration', () => {
  let dom, container, mockUmbilical;

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

    // Comprehensive mock umbilical for all components
    mockUmbilical = {
      dom: container,
      onMount: jest.fn(),
      // For ExecutionControlPanel
      executionActor: {
        startExecution: jest.fn(),
        pauseExecution: jest.fn(),
        resumeExecution: jest.fn(),
        stopExecution: jest.fn(),
        stepExecution: jest.fn()
      },
      onExecutionStart: jest.fn(),
      // For PlanLibraryPanel
      planningActor: {
        getPlans: jest.fn(() => Promise.resolve([])),
        savePlan: jest.fn(),
        deletePlan: jest.fn()
      },
      // For GoalInputInterface
      onSubmit: jest.fn(),
      onGoalChange: jest.fn(),
      onContextChange: jest.fn(),
      onValidation: jest.fn(),
      // Common
      onViewChange: jest.fn(),
      onLayoutChange: jest.fn(),
      onZoomChange: jest.fn(),
      onNodeClick: jest.fn(),
      onNodeHover: jest.fn(),
      onEdgeClick: jest.fn(),
      onDestroy: jest.fn()
    };
  });

  const testStandardizedAPI = async (componentModule, componentName) => {
    const component = await componentModule.create(mockUmbilical);
    
    // Test 1: Component creation
    expect(component).toBeDefined();
    expect(component.api).toBeDefined();
    
    // Test 2: Standardized lifecycle methods
    expect(component.api.isReady).toBeDefined();
    expect(component.api.getState).toBeDefined();
    expect(component.api.setState).toBeDefined();
    expect(component.api.reset).toBeDefined();
    expect(component.api.destroy).toBeDefined();
    
    expect(component.api.isReady()).toBe(true);
    expect(typeof component.api.getState()).toBe('object');
    
    // Test 3: Standardized error handling methods
    expect(component.api.getLastError).toBeDefined();
    expect(component.api.clearError).toBeDefined();
    expect(component.api.hasError).toBeDefined();
    expect(component.api.setError).toBeDefined();
    
    expect(component.api.hasError()).toBe(false);
    expect(component.api.getLastError()).toBeNull();
    
    // Test 4: Standardized validation methods
    expect(component.api.validate).toBeDefined();
    expect(component.api.isValid).toBeDefined();
    expect(component.api.getValidationErrors).toBeDefined();
    
    expect(component.api.isValid()).toBe(true);
    expect(Array.isArray(component.api.getValidationErrors())).toBe(true);
    
    const validationResult = component.api.validate();
    expect(validationResult.success).toBe(true);
    expect(validationResult.data.isValid).toBe(true);
    expect(Array.isArray(validationResult.data.errors)).toBe(true);
    
    // Test 5: API documentation
    expect(component.getAPIDocumentation).toBeDefined();
    const docs = component.getAPIDocumentation();
    expect(docs.componentName).toBe(componentName);
    expect(docs.isStandardized).toBe(true);
    expect(docs.categories).toBeDefined();
    expect(docs.totalMethods).toBeGreaterThan(0);
    
    // Test 6: Naming conventions
    const apiMethods = Object.keys(component.api);
    
    const getterMethods = apiMethods.filter(method => method.startsWith('get'));
    getterMethods.forEach(method => {
      expect(method).toMatch(/^get[A-Z][a-zA-Z]*$/);
    });
    
    const setterMethods = apiMethods.filter(method => method.startsWith('set'));
    setterMethods.forEach(method => {
      expect(method).toMatch(/^set[A-Z][a-zA-Z]*$/);
    });
    
    const booleanMethods = apiMethods.filter(method => method.startsWith('is'));
    booleanMethods.forEach(method => {
      expect(method).toMatch(/^is[A-Z][a-zA-Z]*$/);
    });
    
    // Test 7: Error handling
    component.api.setError('Test error');
    expect(component.api.hasError()).toBe(true);
    expect(component.api.getLastError()).toBeTruthy();
    
    component.api.clearError();
    expect(component.api.hasError()).toBe(false);
    expect(component.api.getLastError()).toBeNull();
    
    // Test 8: State management
    const testState = { testKey: 'testValue' };
    const setResult = component.api.setState('testKey', 'testValue');
    expect(setResult.success).toBe(true);
    expect(component.api.getState('testKey')).toBe('testValue');
    
    // Clean up
    component.destroy();
    
    return component;
  };

  test('PlanVisualizationPanel should follow standardized API', async () => {
    const { PlanVisualizationPanel } = await import('../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js');
    await testStandardizedAPI(PlanVisualizationPanel, 'PlanVisualizationPanel');
  });

  test('ExecutionControlPanel should follow standardized API', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    await testStandardizedAPI(ExecutionControlPanel, 'ExecutionControlPanel');
  });

  test('PlanLibraryPanel should follow standardized API', async () => {
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    await testStandardizedAPI(PlanLibraryPanel, 'PlanLibraryPanel');
  });

  test('GoalInputInterface should follow standardized API', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    await testStandardizedAPI(GoalInputInterface, 'GoalInputInterface');
  });

  test('All components should have consistent API structure', async () => {
    const components = [];
    
    // Create all components
    const { PlanVisualizationPanel } = await import('../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js');
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    
    components.push(await PlanVisualizationPanel.create(mockUmbilical));
    components.push(await ExecutionControlPanel.create(mockUmbilical));
    components.push(await PlanLibraryPanel.create(mockUmbilical));
    components.push(await GoalInputInterface.create(mockUmbilical));
    
    // Verify all components have same standardized methods
    const standardizedMethods = [
      'isReady', 'getState', 'setState', 'reset', 'destroy',
      'getLastError', 'clearError', 'hasError', 'setError',
      'validate', 'isValid', 'getValidationErrors'
    ];
    
    components.forEach((component, index) => {
      standardizedMethods.forEach(method => {
        expect(component.api[method]).toBeDefined();
      });
      
      // Verify API documentation exists
      expect(component.getAPIDocumentation).toBeDefined();
      const docs = component.getAPIDocumentation();
      expect(docs.isStandardized).toBe(true);
    });
    
    // Clean up all components
    components.forEach(component => component.destroy());
  });

  test('Component-specific methods should coexist with standardized methods', async () => {
    // Test that each component has its specific methods while maintaining standardized ones
    
    // PlanVisualizationPanel specific methods
    const { PlanVisualizationPanel } = await import('../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js');
    const planViz = await PlanVisualizationPanel.create(mockUmbilical);
    expect(planViz.api.setPlan).toBeDefined();
    expect(planViz.api.setViewMode).toBeDefined();
    expect(planViz.api.exportAsSVG).toBeDefined();
    expect(planViz.api.isReady).toBeDefined(); // Standardized method
    planViz.destroy();
    
    // ExecutionControlPanel specific methods
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    const execControl = await ExecutionControlPanel.create(mockUmbilical);
    expect(execControl.api.startExecution).toBeDefined();
    expect(execControl.api.getExecutionStatus).toBeDefined();
    expect(execControl.api.addLogEntry).toBeDefined();
    expect(execControl.api.isReady).toBeDefined(); // Standardized method
    execControl.destroy();
    
    // PlanLibraryPanel specific methods
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    const planLibrary = await PlanLibraryPanel.create(mockUmbilical);
    expect(planLibrary.api.loadPlans).toBeDefined();
    expect(planLibrary.api.searchPlans).toBeDefined();
    expect(planLibrary.api.exportPlans).toBeDefined();
    expect(planLibrary.api.isReady).toBeDefined(); // Standardized method
    planLibrary.destroy();
    
    // GoalInputInterface specific methods
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    const goalInput = await GoalInputInterface.create(mockUmbilical);
    expect(goalInput.api.setGoal).toBeDefined();
    expect(goalInput.api.validateGoal).toBeDefined();
    expect(goalInput.api.addConstraint).toBeDefined();
    expect(goalInput.api.isReady).toBeDefined(); // Standardized method
    goalInput.destroy();
  });

  test('Error handling should be consistent across all components', async () => {
    const { PlanVisualizationPanel } = await import('../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js');
    const component = await PlanVisualizationPanel.create(mockUmbilical);
    
    // Test error handling consistency
    expect(component.api.hasError()).toBe(false);
    
    // Set an error
    const errorResult = component.api.setError('Test error message');
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBe('Test error message');
    expect(component.api.hasError()).toBe(true);
    expect(component.api.getLastError().message).toBe('Test error message');
    
    // Clear the error
    const clearResult = component.api.clearError();
    expect(clearResult.success).toBe(true);
    expect(component.api.hasError()).toBe(false);
    expect(component.api.getLastError()).toBeNull();
    
    component.destroy();
  });

  test('Validation should work consistently across all components', async () => {
    const components = [];
    
    // Create all components
    const { PlanVisualizationPanel } = await import('../../src/components/tool-registry/components/panels/PlanVisualizationPanel.js');
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    const { PlanLibraryPanel } = await import('../../src/components/tool-registry/components/panels/PlanLibraryPanel.js');
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    
    components.push(await PlanVisualizationPanel.create(mockUmbilical));
    components.push(await ExecutionControlPanel.create(mockUmbilical));
    components.push(await PlanLibraryPanel.create(mockUmbilical));
    components.push(await GoalInputInterface.create(mockUmbilical));
    
    // Test validation consistency
    components.forEach(component => {
      const validation = component.api.validate();
      expect(validation.success).toBe(true);
      expect(validation.data).toBeDefined();
      expect(validation.data.isValid).toBeDefined();
      expect(Array.isArray(validation.data.errors)).toBe(true);
      expect(validation.data.timestamp).toBeDefined();
      
      expect(typeof component.api.isValid()).toBe('boolean');
      expect(Array.isArray(component.api.getValidationErrors())).toBe(true);
    });
    
    // Clean up
    components.forEach(component => component.destroy());
  });
});