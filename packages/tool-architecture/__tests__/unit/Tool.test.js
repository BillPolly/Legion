/**
 * Tests for Tool class
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest } from '@jest/globals';
import { Tool } from '../../src/modules/Tool.js';

describe('Tool Class', () => {
  test('should accept name, execute, and getMetadata in constructor', () => {
    const executeFn = jest.fn();
    const getMetadataFn = jest.fn();
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    expect(tool.name).toBe('testTool');
    expect(tool._execute).toBe(executeFn);
    expect(tool._getMetadata).toBe(getMetadataFn);
  });

  test('should call provided execute function when execute() called', async () => {
    const executeFn = jest.fn().mockResolvedValue({ result: 'test' });
    const getMetadataFn = jest.fn();
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    const input = { test: 'input' };
    const result = await tool.execute(input);
    
    expect(executeFn).toHaveBeenCalledWith(input);
    expect(result).toEqual({ result: 'test' });
  });

  test('should wrap errors when execute function throws', async () => {
    const executeFn = jest.fn().mockRejectedValue(new Error('Test error'));
    const getMetadataFn = jest.fn();
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    const result = await tool.execute({ test: 'input' });
    
    expect(result).toEqual({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: 'Test error',
        details: {
          tool: 'testTool',
          timestamp: expect.any(Number)
        }
      }
    });
  });

  test('should return error object if execute function returns error format', async () => {
    const errorResponse = {
      success: false,
      error: {
        code: 'CUSTOM_ERROR',
        message: 'Custom error message'
      }
    };
    
    const executeFn = jest.fn().mockRejectedValue(errorResponse);
    const getMetadataFn = jest.fn();
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    const result = await tool.execute({ test: 'input' });
    expect(result).toBe(errorResponse);
  });

  test('should call provided getMetadata function when getMetadata() called', () => {
    const executeFn = jest.fn();
    const metadata = { description: 'Test tool', input: 'object', output: 'object' };
    const getMetadataFn = jest.fn().mockReturnValue(metadata);
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    const result = tool.getMetadata();
    
    expect(getMetadataFn).toHaveBeenCalled();
    expect(result).toEqual(metadata);
  });

  test('should return result directly when execute function returns any value', async () => {
    const executeFn = jest.fn().mockResolvedValue('test result');
    const getMetadataFn = jest.fn();
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    const result = await tool.execute({ test: 'input' });
    expect(result).toBe('test result');
  });

  test('should return object directly when execute function returns object', async () => {
    const resultData = { result: 'test', count: 42 };
    const executeFn = jest.fn().mockResolvedValue(resultData);
    const getMetadataFn = jest.fn();
    
    const tool = new Tool({
      name: 'testTool',
      execute: executeFn,
      getMetadata: getMetadataFn
    });
    
    const result = await tool.execute({ test: 'input' });
    expect(result).toEqual(resultData);
  });
});