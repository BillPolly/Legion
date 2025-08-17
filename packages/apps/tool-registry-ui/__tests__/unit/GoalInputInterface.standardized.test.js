/**
 * GoalInputInterface Standardized API Tests
 * Verifies standardized API implementation
 */

import { jest } from '@jest/globals';
import { JSDOM } from 'jsdom';

describe('GoalInputInterface Standardized API', () => {
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
      onSubmit: jest.fn(),
      onGoalChange: jest.fn(),
      onContextChange: jest.fn(),
      onValidation: jest.fn()
    };
  });

  afterEach(() => {
    if (component) {
      component.destroy();
    }
  });

  test('should create component with standardized API', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    expect(component).toBeDefined();
    expect(component.api).toBeDefined();
  });

  test('should have all required lifecycle methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
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
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check standardized error handling methods
    expect(component.api.getLastError).toBeDefined();
    expect(component.api.clearError).toBeDefined();
    expect(component.api.hasError).toBeDefined();
    
    // Test error handling methods work
    expect(component.api.hasError()).toBe(false);
    expect(component.api.getLastError()).toBeNull();
  });

  test('should have all required validation methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
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

  test('should have goal management methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check goal management methods
    expect(component.api.getGoal).toBeDefined();
    expect(component.api.setGoal).toBeDefined();
    expect(component.api.clearGoal).toBeDefined();
    
    // Test goal management
    expect(component.api.getGoal()).toBe('');
    
    component.api.setGoal('Build a web application');
    expect(component.api.getGoal()).toBe('Build a web application');
    
    component.api.clearGoal();
    expect(component.api.getGoal()).toBe('');
  });

  test('should have goal validation methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check validation methods
    expect(component.api.validateGoal).toBeDefined();
    expect(component.api.getValidationResult).toBeDefined();
    expect(component.api.isGoalValid).toBeDefined();
    
    // Test validation with empty goal
    let validation = component.api.validateGoal('');
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Goal cannot be empty');
    
    // Test validation with valid goal
    validation = component.api.validateGoal('Build a comprehensive web application with user authentication');
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should have context management methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check context methods
    expect(component.api.getContext).toBeDefined();
    expect(component.api.setContext).toBeDefined();
    expect(component.api.clearContext).toBeDefined();
    
    // Test context management
    const context = component.api.getContext();
    expect(typeof context).toBe('object');
    expect(Array.isArray(context.constraints)).toBe(true);
    expect(typeof context.preferences).toBe('object');
    
    const newContext = { constraints: [{ type: 'time', value: '2 weeks' }] };
    component.api.setContext(newContext);
    expect(component.api.getContext().constraints).toEqual([{ type: 'time', value: '2 weeks' }]);
    
    component.api.clearContext();
    expect(component.api.getContext().constraints.length).toBe(0);
  });

  test('should have constraint management methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check constraint methods
    expect(component.api.addConstraint).toBeDefined();
    expect(component.api.removeConstraint).toBeDefined();
    expect(component.api.getConstraints).toBeDefined();
    
    // Test constraint management
    expect(component.api.getConstraints().length).toBe(0);
    
    component.api.addConstraint('budget', '$10000');
    expect(component.api.getConstraints().length).toBe(1);
    expect(component.api.getConstraints()[0]).toEqual({ type: 'budget', value: '$10000' });
    
    component.api.removeConstraint(0);
    expect(component.api.getConstraints().length).toBe(0);
  });

  test('should have preference management methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check preference methods
    expect(component.api.setPreference).toBeDefined();
    expect(component.api.getPreferences).toBeDefined();
    expect(component.api.removePreference).toBeDefined();
    
    // Test preference management
    expect(Object.keys(component.api.getPreferences()).length).toBe(0);
    
    component.api.setPreference('language', 'JavaScript');
    expect(component.api.getPreferences().language).toBe('JavaScript');
    
    component.api.removePreference('language');
    expect(component.api.getPreferences().language).toBeUndefined();
  });

  test('should have tool configuration methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check tool methods
    expect(component.api.setAvailableTools).toBeDefined();
    expect(component.api.getAvailableTools).toBeDefined();
    
    // Test tool configuration
    expect(Array.isArray(component.api.getAvailableTools())).toBe(true);
    
    const tools = ['npm', 'git', 'docker'];
    component.api.setAvailableTools(tools);
    expect(component.api.getAvailableTools()).toEqual(tools);
  });

  test('should have environment configuration methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check environment methods
    expect(component.api.setEnvironment).toBeDefined();
    expect(component.api.getEnvironment).toBeDefined();
    
    // Test environment configuration
    expect(component.api.getEnvironment()).toBe('development');
    
    component.api.setEnvironment('production');
    expect(component.api.getEnvironment()).toBe('production');
  });

  test('should have template methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check template methods
    expect(component.api.getGoalTemplates).toBeDefined();
    expect(component.api.applyTemplate).toBeDefined();
    
    // Test templates
    const templates = component.api.getGoalTemplates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBeGreaterThan(0);
    
    const restApiTemplate = templates.find(t => t.name === 'REST API');
    expect(restApiTemplate).toBeDefined();
    
    component.api.applyTemplate('REST API');
    expect(component.api.getGoal()).toContain('REST API service');
  });

  test('should have analysis methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check analysis methods
    expect(component.api.analyzeComplexity).toBeDefined();
    expect(component.api.detectTechnologies).toBeDefined();
    expect(component.api.estimateComplexity).toBeDefined();
    expect(component.api.getSuggestions).toBeDefined();
    
    // Test analysis
    component.api.setGoal('Build a React application with Node.js backend');
    
    const technologies = component.api.detectTechnologies();
    expect(Array.isArray(technologies)).toBe(true);
    
    const complexity = component.api.estimateComplexity();
    expect(typeof complexity).toBe('object');
    expect(complexity.level).toBeDefined();
  });

  test('should have submission methods', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check submission methods
    expect(component.api.submit).toBeDefined();
    expect(component.api.canSubmit).toBeDefined();
    
    // Test submission capability
    expect(component.api.canSubmit()).toBe(false); // Empty goal
    
    component.api.setGoal('Build a comprehensive web application');
    expect(component.api.canSubmit()).toBe(true);
    
    component.api.submit();
    expect(mockUmbilical.onSubmit).toHaveBeenCalledWith({
      goal: 'Build a comprehensive web application',
      context: expect.any(Object)
    });
  });

  test('should follow standardized naming conventions', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
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
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Check that component provides API documentation
    expect(component.getAPIDocumentation).toBeDefined();
    
    const docs = component.getAPIDocumentation();
    expect(docs.componentName).toBe('GoalInputInterface');
    expect(docs.isStandardized).toBe(true);
    expect(docs.categories).toBeDefined();
    expect(docs.totalMethods).toBeGreaterThan(0);
  });

  test('should handle component-specific validation', async () => {
    const { GoalInputInterface } = await import('../../src/components/tool-registry/components/panels/GoalInputInterface.js');
    component = await GoalInputInterface.create(mockUmbilical);
    
    // Test with invalid environment
    component.api.setEnvironment('invalid');
    const validationResult = component.api.validate();
    expect(validationResult.data.isValid).toBe(false);
    expect(validationResult.data.errors).toContain('Invalid environment: invalid');
    
    // Fix the validation error
    component.api.setEnvironment('development');
    const validResult = component.api.validate();
    expect(validResult.data.isValid).toBe(true);
  });
});