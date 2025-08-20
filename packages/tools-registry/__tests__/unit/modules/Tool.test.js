/**
 * Unit tests for Tool class
 * Tests match the actual Tool implementation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { Tool } from '../../../src/modules/Tool.js';
import { createValidator } from '@legion/schema';

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
    
    test('accepts JSON Schema as inputSchema', () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            description: 'Test value'
          }
        },
        required: ['value']
      };
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: jsonSchema,
        execute: async () => ({})
      });
      
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema).toEqual(jsonSchema);
    });
    
    test('accepts schema via schema parameter', () => {
      const schema = {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      };
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        schema: schema,
        execute: async () => ({})
      });
      
      expect(tool.inputSchema).toBe(schema);
    });
    
    test('has subscriber pattern for events', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      expect(typeof tool.subscribe).toBe('function');
      expect(typeof tool.progress).toBe('function');
      expect(typeof tool.error).toBe('function');
      expect(typeof tool.info).toBe('function');
      expect(typeof tool.warning).toBe('function');
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
    
    test('executes without validation (validation happens at invocation layer)', async () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name', 'age']
      };
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: jsonSchema,
        execute: async (input) => ({ received: input })
      });
      
      // Tool executes without validation - validation happens at invocation layer
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
    
    test('passes through input without validation', async () => {
      const jsonSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name', 'age']
      };
      
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: jsonSchema,
        execute: async (input) => ({ received: input })
      });
      
      // Tool passes through input without validation - even "invalid" input
      const result = await tool.execute({
        name: 'John',
        age: -5  // Would be invalid but tool doesn't validate
      });
      
      expect(result.success).toBe(true);
      expect(result.data.received).toEqual({
        name: 'John',
        age: -5
      });
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
      expect(result.data).toBe(null);
      expect(result.error.message).toBe('Something went wrong');
      expect(result.error.code).toBe('EXECUTION_ERROR');
      expect(result.error.details.tool).toBe('test_tool');
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
    test('progress notifies subscribers with progress event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.subscribe((data) => {
        if (data.type === 'progress') {
          expect(data.tool).toBe('test_tool');
          expect(data.message).toBe('Processing...');
          expect(data.percentage).toBe(50);
          expect(data.timestamp).toBeDefined();
          done();
        }
      });
      
      tool.progress('Processing...', 50);
    });
    
    test('error notifies subscribers with error event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.subscribe((data) => {
        if (data.type === 'error') {
          expect(data.tool).toBe('test_tool');
          expect(data.message).toBe('Error occurred');
          expect(data.timestamp).toBeDefined();
          done();
        }
      });
      
      tool.error('Error occurred');
    });
    
    test('info notifies subscribers with info event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.subscribe((data) => {
        if (data.type === 'info') {
          expect(data.tool).toBe('test_tool');
          expect(data.message).toBe('Information');
          done();
        }
      });
      
      tool.info('Information');
    });
    
    test('warning notifies subscribers with warning event', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      tool.subscribe((data) => {
        if (data.type === 'warning') {
          expect(data.tool).toBe('test_tool');
          expect(data.message).toBe('Warning');
          done();
        }
      });
      
      tool.warning('Warning');
    });
  });
  
  describe('getMetadata', () => {
    test('merges custom metadata with base metadata', () => {
      const customMetadata = { version: '1.0', author: 'Test' };
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({}),
        getMetadata: () => customMetadata
      });
      
      const result = tool.getMetadata();
      expect(result.name).toBe('test_tool');
      expect(result.description).toBe('A test tool');
      expect(result.version).toBe('1.0');
      expect(result.author).toBe('Test');
      expect(result.inputSchema).toBe(null);
      expect(result.outputSchema).toBe(null);
    });
    
    test('returns base metadata if no custom getMetadata provided', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'A test tool',
        execute: async () => ({})
      });
      
      const result = tool.getMetadata();
      expect(result.name).toBe('test_tool');
      expect(result.description).toBe('A test tool');
      expect(result.inputSchema).toBe(null);
      expect(result.outputSchema).toBe(null);
    });
  });
  
  describe('schema storage', () => {
    test('stores custom validator object as inputSchema', () => {
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
      
      expect(tool.inputSchema).toBe(customValidator);
    });
    
    test('tool executes without validation regardless of schema', async () => {
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
      
      // Tool executes "invalid" input without validation
      const result = await tool.execute({ value: 15 });
      expect(result.success).toBe(true);
      expect(result.data.result.value).toBe(15);
    });
  });
});