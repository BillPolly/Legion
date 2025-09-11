/**
 * Integration tests for ErrorHandlingService
 * NO MOCKS - tests real error scenarios and handling
 */

import ErrorHandlingService, { ToolErrorType, StructuredError } from '../../src/services/ErrorHandlingService.js';
import { ResourceManager } from '@legion/resource-manager';

describe('ErrorHandlingService Integration', () => {
  let errorService;
  let resourceManager;

  beforeAll(async () => {
    resourceManager = await ResourceManager.getInstance();
    errorService = new ErrorHandlingService(resourceManager);
  });

  test('should classify different error types correctly', () => {
    const testErrors = [
      { error: new Error('ENOENT: no such file or directory'), expected: ToolErrorType.FILE_NOT_FOUND },
      { error: new Error('EACCES: permission denied'), expected: ToolErrorType.PERMISSION_ERROR },
      { error: new Error('fetch failed: network error'), expected: ToolErrorType.NETWORK_ERROR },
      { error: new Error('Request timeout after 5000ms'), expected: ToolErrorType.TIMEOUT_ERROR },
      { error: new Error('Validation failed: required field missing'), expected: ToolErrorType.VALIDATION_ERROR },
      { error: new Error('Something unexpected happened'), expected: ToolErrorType.EXECUTION_ERROR }
    ];

    for (const testCase of testErrors) {
      const classification = errorService.classifyError(testCase.error);
      expect(classification).toBe(testCase.expected);
    }

    console.log('✅ Error classification working for all types');
  });

  test('should create structured errors with proper details', () => {
    const originalError = new Error('File not found: test.txt');
    const context = 'read_file operation';
    
    const structuredError = errorService.createStructuredError(originalError, context);
    
    expect(structuredError).toBeInstanceOf(StructuredError);
    expect(structuredError.message).toBe('File not found: test.txt');
    expect(structuredError.errorType).toBe(ToolErrorType.FILE_NOT_FOUND);
    expect(structuredError.details.context).toBe(context);
    expect(structuredError.details.originalError).toBe('Error');
    expect(structuredError.timestamp).toBeDefined();
    
    console.log('Structured error:', structuredError.toJSON());
  });

  test('should provide user-friendly error messages', () => {
    const errors = [
      { type: ToolErrorType.FILE_NOT_FOUND, expectedText: 'File not found' },
      { type: ToolErrorType.PERMISSION_ERROR, expectedText: 'Permission denied' },
      { type: ToolErrorType.NETWORK_ERROR, expectedText: 'Network error' },
      { type: ToolErrorType.TIMEOUT_ERROR, expectedText: 'timed out' },
      { type: ToolErrorType.VALIDATION_ERROR, expectedText: 'Invalid input' }
    ];

    for (const testCase of errors) {
      const structuredError = new StructuredError('Test error', testCase.type);
      const friendlyMessage = errorService.getFriendlyErrorMessage(structuredError);
      
      expect(friendlyMessage.toLowerCase()).toContain(testCase.expectedText.toLowerCase());
    }

    console.log('✅ User-friendly error messages working');
  });

  test('should track error history for debugging', () => {
    errorService.clearErrorHistory();
    
    // Create several different errors
    const errors = [
      new Error('File not found'),
      new Error('Permission denied'),
      new Error('Network timeout')
    ];
    
    for (const [index, error] of errors.entries()) {
      errorService.createStructuredError(error, `operation_${index}`);
    }
    
    const stats = errorService.getErrorStatistics();
    
    expect(stats.totalErrors).toBe(3);
    expect(stats.errorTypes[ToolErrorType.FILE_NOT_FOUND]).toBe(1);
    expect(stats.errorTypes[ToolErrorType.PERMISSION_ERROR]).toBe(1);
    expect(stats.errorTypes[ToolErrorType.NETWORK_ERROR]).toBe(1);
    expect(stats.recentErrors.length).toBe(3);
    
    console.log('Error statistics:', stats);
  });

  test('should determine retry eligibility correctly', () => {
    const retryableErrors = [
      new StructuredError('Network failed', ToolErrorType.NETWORK_ERROR),
      new StructuredError('Timed out', ToolErrorType.TIMEOUT_ERROR),
      new StructuredError('Execution failed', ToolErrorType.EXECUTION_ERROR)
    ];

    const nonRetryableErrors = [
      new StructuredError('Invalid input', ToolErrorType.VALIDATION_ERROR),
      new StructuredError('Access denied', ToolErrorType.PERMISSION_ERROR),
      new StructuredError('File missing', ToolErrorType.FILE_NOT_FOUND)
    ];

    // Test retryable errors
    for (const error of retryableErrors) {
      expect(errorService.shouldRetry(error, 1)).toBe(true);
    }

    // Test non-retryable errors  
    for (const error of nonRetryableErrors) {
      expect(errorService.shouldRetry(error, 1)).toBe(false);
    }

    // Test retry limits
    const networkError = retryableErrors[0];
    expect(errorService.shouldRetry(networkError, 1)).toBe(true);
    expect(errorService.shouldRetry(networkError, 2)).toBe(true);
    expect(errorService.shouldRetry(networkError, 3)).toBe(false);
    
    console.log('✅ Retry logic working correctly');
  });

  test('should maintain error history size limits', () => {
    errorService.clearErrorHistory();
    
    // Add more errors than the limit
    for (let i = 0; i < 60; i++) {
      errorService.createStructuredError(new Error(`Error ${i}`), `test_${i}`);
    }
    
    const stats = errorService.getErrorStatistics();
    expect(stats.totalErrors).toBeLessThanOrEqual(50); // maxErrorHistory limit
    
    console.log('Error history maintained at reasonable size:', stats.totalErrors);
  });

  test('should handle error recording without breaking functionality', () => {
    // Test that error recording doesn't interfere with normal operation
    const testError = new Error('Test error for recording');
    
    expect(() => {
      errorService.createStructuredError(testError, 'test_context');
    }).not.toThrow();
    
    const stats = errorService.getErrorStatistics();
    expect(stats.totalErrors).toBeGreaterThan(0);
    
    console.log('✅ Error recording working without side effects');
  });
});