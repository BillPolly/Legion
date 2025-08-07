/**
 * Tests for Error Handling utilities
 * RED phase: Write failing tests first
 */

import { describe, test, expect } from '@jest/globals';
import { ToolError, createStandardError } from '../../src/utils/ErrorHandling.js';

describe('Error Handling', () => {
  describe('ToolError class', () => {
    test('should create ToolError with message and context', () => {
      const context = {
        tool: 'testTool',
        input: { test: 'input' },
        module: 'TestModule'
      };
      
      const error = new ToolError('Test error message', context);
      
      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('ToolError');
      expect(error.tool).toBe('testTool');
      expect(error.input).toEqual({ test: 'input' });
      expect(error.module).toBe('TestModule');
      expect(typeof error.timestamp).toBe('number');
    });

    test('should be instance of Error', () => {
      const error = new ToolError('Test error', { tool: 'test' });
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('createStandardError function', () => {
    test('should create standard error object with code and message', () => {
      const error = createStandardError('TEST_ERROR', 'Test error message', 'testTool');
      
      expect(error).toEqual({
        success: false,
        error: {
          code: 'TEST_ERROR',
          message: 'Test error message',
          details: {
            tool: 'testTool',
            timestamp: expect.any(Number)
          }
        }
      });
    });

    test('should create error with additional details', () => {
      const additionalDetails = { input: { test: 'data' }, step: 5 };
      const error = createStandardError('VALIDATION_ERROR', 'Invalid input', 'validationTool', additionalDetails);
      
      expect(error).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: {
            tool: 'validationTool',
            timestamp: expect.any(Number),
            input: { test: 'data' },
            step: 5
          }
        }
      });
    });

    test('should create error without tool name', () => {
      const error = createStandardError('SYSTEM_ERROR', 'System failure');
      
      expect(error).toEqual({
        success: false,
        error: {
          code: 'SYSTEM_ERROR',
          message: 'System failure',
          details: {
            timestamp: expect.any(Number)
          }
        }
      });
    });
  });

  describe('Error code constants', () => {
    test('should have standard error codes defined', async () => {
      const { ERROR_CODES } = await import('../../src/utils/ErrorHandling.js');
      
      expect(ERROR_CODES).toEqual({
        MISSING_PARAMETER: 'MISSING_PARAMETER',
        INVALID_PARAMETER: 'INVALID_PARAMETER',
        TYPE_MISMATCH: 'TYPE_MISMATCH',
        RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
        RESOURCE_UNAVAILABLE: 'RESOURCE_UNAVAILABLE',
        RESOURCE_LOCKED: 'RESOURCE_LOCKED',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
        AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
        OPERATION_FAILED: 'OPERATION_FAILED',
        OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',
        OPERATION_CANCELLED: 'OPERATION_CANCELLED',
        INVALID_STATE: 'INVALID_STATE',
        PRECONDITION_FAILED: 'PRECONDITION_FAILED',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        NETWORK_ERROR: 'NETWORK_ERROR',
        RATE_LIMITED: 'RATE_LIMITED',
        EXECUTION_ERROR: 'EXECUTION_ERROR'
      });
    });
  });
});