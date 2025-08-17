/**
 * Simple unit tests for StandardizedComponentAPI
 * Focuses on API validation without SVG DOM issues
 */

import { jest } from '@jest/globals';
import { StandardizedComponentAPI } from '../../src/components/tool-registry/base/StandardizedComponentAPI.js';

describe('StandardizedComponentAPI Unit Tests', () => {
  let api, mockModel, mockViewModel, mockUmbilical;

  beforeEach(() => {
    mockModel = {
      getState: jest.fn(() => ({})),
      updateState: jest.fn(),
      reset: jest.fn()
    };

    mockViewModel = {
      destroy: jest.fn()
    };

    mockUmbilical = {
      onMount: jest.fn()
    };

    api = new StandardizedComponentAPI(mockModel, mockViewModel, mockUmbilical, 'TestComponent');
  });

  test('should initialize without circular function call errors', () => {
    expect(api.isInitialized).toBe(true);
    expect(api.api).toBeDefined();
  });

  test('should have all lifecycle methods', () => {
    expect(api.api.isReady).toBeDefined();
    expect(api.api.getState).toBeDefined();
    expect(api.api.setState).toBeDefined();
    expect(api.api.reset).toBeDefined();
    expect(api.api.destroy).toBeDefined();
  });

  test('should have all error handling methods', () => {
    expect(api.api.getLastError).toBeDefined();
    expect(api.api.clearError).toBeDefined();
    expect(api.api.hasError).toBeDefined();
    expect(api.api.setError).toBeDefined();
  });

  test('should have all validation methods', () => {
    expect(api.api.validate).toBeDefined();
    expect(api.api.isValid).toBeDefined();
    expect(api.api.getValidationErrors).toBeDefined();
  });

  test('should validate without circular calls', () => {
    const validationResult = api.api.validate();
    expect(validationResult.success).toBe(true);
    expect(validationResult.data.isValid).toBe(true);
    expect(Array.isArray(validationResult.data.errors)).toBe(true);
  });

  test('should check validity without circular calls', () => {
    const isValid = api.api.isValid();
    expect(typeof isValid).toBe('boolean');
  });

  test('should get validation errors without circular calls', () => {
    const errors = api.api.getValidationErrors();
    expect(Array.isArray(errors)).toBe(true);
  });

  test('should handle readiness check correctly', () => {
    const isReady = api.api.isReady();
    expect(typeof isReady).toBe('boolean');
    expect(isReady).toBe(true); // Should be ready with mock model/viewModel
  });

  test('should handle error states correctly', () => {
    expect(api.api.hasError()).toBe(false);
    expect(api.api.getLastError()).toBeNull();
    
    api.api.setError('Test error');
    expect(api.api.hasError()).toBe(true);
    expect(api.api.getLastError()).toBeTruthy();
    
    api.api.clearError();
    expect(api.api.hasError()).toBe(false);
  });

  test('should provide API documentation', () => {
    const docs = api.getAPIDocumentation();
    expect(docs.componentName).toBe('TestComponent');
    expect(docs.isStandardized).toBe(true);
    expect(docs.categories).toBeDefined();
    expect(docs.totalMethods).toBeGreaterThan(0);
  });

  test('should create method names correctly', () => {
    expect(StandardizedComponentAPI.createMethodName('get', 'plan')).toBe('getPlan');
    expect(StandardizedComponentAPI.createMethodName('set', 'viewMode')).toBe('setViewMode');
    expect(StandardizedComponentAPI.createMethodName('is', 'ready')).toBe('isReady');
  });

  test('should validate method names correctly', () => {
    expect(StandardizedComponentAPI.validateMethodName('getPlan', /^get[A-Z]/)).toBe(true);
    expect(StandardizedComponentAPI.validateMethodName('setPlan', /^set[A-Z]/)).toBe(true);
    expect(StandardizedComponentAPI.validateMethodName('isReady', /^is[A-Z]/)).toBe(true);
    expect(StandardizedComponentAPI.validateMethodName('invalidMethod', /^get[A-Z]/)).toBe(false);
  });
});