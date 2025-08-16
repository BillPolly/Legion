/**
 * Unit tests for Tool class
 * Tests match the actual Tool implementation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tool } from '../../../src/modules/Tool.js';
import { z } from 'zod';

describe('Tool Class', () => {
  describe('constructor', () => {
    test('creates tool with required properties', () => {
      const executeFn = async (input) => ({ result: input });
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: executeFn
      });
      
      expect(tool.name).toBe('test_tool');
      expect(tool.description).toBe('A test tool');
      expect(tool._execute).toBe(executeFn);
    });
    
    test('uses default description if not provided', () => {
      const tool = new Tool({
        name: 'test_tool',
        execute: async () => ({})
      });
      
      expect(tool.description).toBe('No description available');
    });
    
    test('accepts Zod schema as inputSchema', () => {
      const zodSchema = z.object({
        value: z.string().describe('Test value')
      });
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: zodSchema,
        execute: async () => ({})
      });
      
      expect(tool.validator).toBeDefined();
      expect(tool.validator.zodSchema).toBe(zodSchema);
    });
    
    test('accepts schema validator object', () => {
      const validator = {
        validate: (data) => ({ valid: true, data, errors: null })
      };
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        schema: validator,
        execute: async () => ({})
      });
      
      expect(tool.validator).toBe(validator);
    });
    
    test('extends EventEmitter', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      expect(typeof tool.emit).toBe('function');
      expect(typeof tool.on).toBe('function');
      expect(typeof tool.removeAllListeners).toBe('function');
    });
  });
  
  describe('execute method', () => {
    test('executes the provided function', async () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async (input) => ({ doubled: input.value * 2 })
      });
      
      const result = await tool.execute({ value: 5 });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ doubled: 10 });
    });
    
    test('validates input with Zod schema', async () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: zodSchema,
        execute: async (input) => ({ received: input })
      });
      
      // Valid input
      const result = await tool.execute({
        name: 'John',
        age: 25
      });
      
      expect(result.success).toBe(true);
      expect(result.data.received).toEqual({
        name: 'John',
        age: 25
      });
    });
    
    test('returns error result for invalid input', async () => {
      const zodSchema = z.object({
        name: z.string(),
        age: z.number().min(0)
      });
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: zodSchema,
        execute: async (input) => ({ received: input })
      });
      
      // Invalid input - negative age
      const result = await tool.execute({
        name: 'John',
        age: -5
      });
      
      // Tool returns error as result, not throwing
      expect(result.success).toBe(false);
      expect(result.data.code).toBe('EXECUTION_ERROR');
      expect(result.data.errorMessage).toContain('Validation failed');
    });
    
    test('wraps execution errors in standard format', async () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => {
          throw new Error('Something went wrong');
        }
      });
      
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
      expect(result.data.errorMessage).toBe('Something went wrong');
      expect(result.data.code).toBe('EXECUTION_ERROR');
      expect(result.data.tool).toBe('test_tool');
    });
    
    test('passes through already formatted errors', async () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => {
          const error = new Error('Custom error');
          error.success = false;
          throw error;
        }
      });
      
      const result = await tool.execute({});
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('run method', () => {
    test('run is an alias for execute', async () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async (input) => ({ value: input.x * 2 })
      });
      
      const result1 = await tool.execute({ x: 5 });
      const result2 = await tool.run({ x: 5 });
      
      expect(result1).toEqual(result2);
    });
  });
  
  describe('event methods', () => {
    test('progress emits progress event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.on('progress', (data) => {
        expect(data.tool).toBe('test_tool');
        expect(data.message).toBe('Processing...');
        expect(data.percentage).toBe(50);
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      tool.progress('Processing...', 50);
    });
    
    test('error emits error event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.on('error', (data) => {
        expect(data.tool).toBe('test_tool');
        expect(data.message).toBe('Error occurred');
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      tool.error('Error occurred');
    });
    
    test('info emits info event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.on('info', (data) => {
        expect(data.tool).toBe('test_tool');
        expect(data.message).toBe('Information');
        done();
      });
      
      tool.info('Information');
    });
    
    test('warning emits warning event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.on('warning', (data) => {
        expect(data.tool).toBe('test_tool');
        expect(data.message).toBe('Warning');
        done();
      });
      
      tool.warning('Warning');
    });
  });
  
  describe('getMetadata', () => {
    test('calls getMetadata function if provided', () => {
      const metadata = { version: '1.0', author: 'Test' };
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({}),
        getMetadata: () => metadata
      });
      
      expect(tool.getMetadata()).toBe(metadata);
    });
    
    test('throws if getMetadata not provided', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      expect(() => tool.getMetadata()).toThrow();
    });
  });
  
  describe('validation with custom validator', () => {
    test('uses custom validator if provided', async () => {
      const customValidator = {
        validate: (data) => {
          if (data.value > 10) {
            return { valid: false, data: null, errors: ['Value too large'] };
          }
          return { valid: true, data, errors: null };
        }
      };
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        schema: customValidator,
        execute: async (input) => ({ result: input })
      });
      
      // Valid input
      const result1 = await tool.execute({ value: 5 });
      expect(result1.success).toBe(true);
      expect(result1.data.result.value).toBe(5);
      
      // Invalid input - returns error result
      const result2 = await tool.execute({ value: 15 });
      expect(result2.success).toBe(false);
      expect(result2.data.errorMessage).toContain('Validation failed');
    });
  });
});