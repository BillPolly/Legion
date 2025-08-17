/**
 * ExecutionControlPanel Standardized API Tests
 * Verifies standardized API implementation
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('ExecutionControlPanel Standardized API', () => {
  let component, mockUmbilical, container, dom;

  beforeEach(() => {
    // Create DOM environment
    dom = new JSDOM(`<!DOCTYPE html><div id="container"></div>`);
    global.document = dom.window.document;
    global.window = dom.window;
    
    container = dom.window.document.getElementById('container');

    // Mock umbilical
    mockUmbilical = {
      dom: container,
      onMount: jest.fn(),
      executionActor: {
        startExecution: jest.fn(),
        pauseExecution: jest.fn(),
        resumeExecution: jest.fn(),
        stopExecution: jest.fn(),
        stepExecution: jest.fn()
      },
      onExecutionStart: jest.fn(),
      onExecutionPause: jest.fn(),
      onExecutionStop: jest.fn(),
      onExecutionReset: jest.fn()
    };
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  test('should create component with standardized API', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    expect(component).toBeDefined();
    expect(component.api).toBeDefined();
  });

  test('should have all required lifecycle methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
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
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check standardized error handling methods
    expect(component.api.getLastError).toBeDefined();
    expect(component.api.clearError).toBeDefined();
    expect(component.api.hasError).toBeDefined();
    
    // Test error handling methods work
    expect(component.api.hasError()).toBe(false);
    expect(component.api.getLastError()).toBeNull();
  });

  test('should have all required validation methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
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

  test('should have component-specific execution control methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check execution control methods
    expect(component.api.startExecution).toBeDefined();
    expect(component.api.pauseExecution).toBeDefined();
    expect(component.api.resumeExecution).toBeDefined();
    expect(component.api.stopExecution).toBeDefined();
    expect(component.api.stepExecution).toBeDefined();
    expect(component.api.resetExecution).toBeDefined();
    
    // Check status methods
    expect(component.api.getExecutionStatus).toBeDefined();
    expect(component.api.getExecutionId).toBeDefined();
    expect(component.api.getExecutionMetrics).toBeDefined();
  });

  test('should have plan management methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check plan methods
    expect(component.api.setPlan).toBeDefined();
    expect(component.api.getPlan).toBeDefined();
    
    // Test plan handling
    const mockPlan = {
      id: 'test-plan',
      hierarchy: {
        root: {
          id: 'root',
          description: 'Test plan',
          children: []
        }
      }
    };
    
    component.api.setPlan(mockPlan);
    expect(component.api.getPlan()).toEqual(mockPlan);
  });

  test('should have task management methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check task methods
    expect(component.api.getActiveTask).toBeDefined();
    expect(component.api.getTaskQueue).toBeDefined();
    expect(component.api.getCompletedTasks).toBeDefined();
    expect(component.api.getFailedTasks).toBeDefined();
    expect(component.api.updateTaskProgress).toBeDefined();
    
    // Test initial state
    expect(component.api.getActiveTask()).toBeNull();
    expect(Array.isArray(component.api.getTaskQueue())).toBe(true);
    expect(Array.isArray(component.api.getCompletedTasks())).toBe(true);
    expect(Array.isArray(component.api.getFailedTasks())).toBe(true);
  });

  test('should have logging methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check logging methods
    expect(component.api.addLogEntry).toBeDefined();
    expect(component.api.clearLog).toBeDefined();
    expect(component.api.exportLog).toBeDefined();
    expect(component.api.getExecutionLog).toBeDefined();
    
    // Test logging
    component.api.addLogEntry({ level: 'info', message: 'Test log entry' });
    const log = component.api.getExecutionLog();
    expect(Array.isArray(log)).toBe(true);
    expect(log.length).toBe(1);
    expect(log[0].message).toBe('Test log entry');
    
    component.api.clearLog();
    expect(component.api.getExecutionLog().length).toBe(0);
  });

  test('should have variable management methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check variable methods
    expect(component.api.setVariable).toBeDefined();
    expect(component.api.removeVariable).toBeDefined();
    expect(component.api.getVariables).toBeDefined();
    
    // Test variable management
    component.api.setVariable('testVar', 'testValue');
    const variables = component.api.getVariables();
    expect(variables.testVar).toBe('testValue');
    
    component.api.removeVariable('testVar');
    expect(component.api.getVariables().testVar).toBeUndefined();
  });

  test('should have debugging methods', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check debugging methods
    expect(component.api.setBreakpoint).toBeDefined();
    expect(component.api.removeBreakpoint).toBeDefined();
    expect(component.api.getBreakpoints).toBeDefined();
    
    // Test breakpoint management
    component.api.setBreakpoint('task-1');
    let breakpoints = component.api.getBreakpoints();
    expect(Array.isArray(breakpoints)).toBe(true);
    expect(breakpoints).toContain('task-1');
    
    component.api.removeBreakpoint('task-1');
    breakpoints = component.api.getBreakpoints();
    expect(breakpoints).not.toContain('task-1');
  });

  test('should follow standardized naming conventions', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
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
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Check that component provides API documentation
    expect(component.getAPIDocumentation).toBeDefined();
    
    const docs = component.getAPIDocumentation();
    expect(docs.componentName).toBe('ExecutionControlPanel');
    expect(docs.isStandardized).toBe(true);
    expect(docs.categories).toBeDefined();
    expect(docs.totalMethods).toBeGreaterThan(0);
  });

  test('should handle component-specific validation', async () => {
    const { ExecutionControlPanel } = await import('../../src/components/tool-registry/components/panels/ExecutionControlPanel.js');
    component = await ExecutionControlPanel.create(mockUmbilical);
    
    // Test with invalid execution options
    component.api.setExecutionOption('maxRetries', -1);
    const validationResult = component.api.validate();
    expect(validationResult.data.isValid).toBe(false);
    expect(validationResult.data.errors).toContain('Max retries cannot be negative');
    
    // Fix the validation error
    component.api.setExecutionOption('maxRetries', 3);
    const validResult = component.api.validate();
    expect(validResult.data.isValid).toBe(true);
  });
});