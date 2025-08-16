/**
 * Unit tests for Module base class
 * Tests match the actual Module implementation
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { Module } from '../../../src/modules/Module.js';
import { Tool } from '../../../src/modules/Tool.js';

describe('Module Base Class', () => {
  let module;
  let moduleDefinition;
  
  beforeEach(() => {
    moduleDefinition = { name: 'TestModule', version: '1.0.0' };
    module = new Module(moduleDefinition, { testConfig: true });
  });
  
  describe('constructor', () => {
    test('creates module with moduleDefinition and config', () => {
      expect(module.moduleDefinition).toEqual(moduleDefinition);
      expect(module.config).toEqual({ testConfig: true });
      expect(module.tools).toEqual({});
    });
    
    test('extends EventEmitter', () => {
      expect(typeof module.emit).toBe('function');
      expect(typeof module.on).toBe('function');
      expect(typeof module.removeAllListeners).toBe('function');
    });
  });
  
  describe('registerTool', () => {
    test('registers a tool by name', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test tool',
        execute: async (input) => ({ result: input })
      });
      
      module.registerTool('test_tool', tool);
      
      expect(module.tools.test_tool).toBe(tool);
    });
    
    test('forwards tool events to module', (done) => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test tool',
        execute: async (input) => ({ result: input })
      });
      
      module.registerTool('test_tool', tool);
      
      module.on('progress', (data) => {
        expect(data.tool).toBe('test_tool');
        expect(data.module).toBe('TestModule');
        expect(data.percentage).toBe(50);
        done();
      });
      
      tool.emit('progress', { percentage: 50 });
    });
  });
  
  describe('getTool', () => {
    test('returns registered tool by name', () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test tool',
        execute: async (input) => ({ result: input })
      });
      
      module.registerTool('test_tool', tool);
      
      expect(module.getTool('test_tool')).toBe(tool);
    });
    
    test('throws error for non-existent tool', () => {
      expect(() => {
        module.getTool('non_existent');
      }).toThrow("Tool 'non_existent' not found in module");
    });
  });
  
  describe('getTools', () => {
    test('returns all tools as array', () => {
      const tool1 = new Tool({
        name: 'tool1',
        description: 'Tool 1',
        execute: async (input) => ({ result: input })
      });
      
      const tool2 = new Tool({
        name: 'tool2',
        description: 'Tool 2',
        execute: async (input) => ({ result: input })
      });
      
      module.registerTool('tool1', tool1);
      module.registerTool('tool2', tool2);
      
      const tools = module.getTools();
      
      expect(tools).toHaveLength(2);
      expect(tools).toContain(tool1);
      expect(tools).toContain(tool2);
    });
    
    test('returns empty array when no tools', () => {
      expect(module.getTools()).toEqual([]);
    });
  });
  
  describe('listTools', () => {
    test('returns names of all registered tools', () => {
      const tool1 = new Tool({
        name: 'alpha_tool',
        description: 'Alpha',
        execute: async () => ({})
      });
      
      const tool2 = new Tool({
        name: 'beta_tool',
        description: 'Beta',
        execute: async () => ({})
      });
      
      module.registerTool('alpha_tool', tool1);
      module.registerTool('beta_tool', tool2);
      
      const names = module.listTools();
      
      expect(names).toEqual(['alpha_tool', 'beta_tool']);
    });
  });
  
  describe('executeTool', () => {
    test('executes tool by name', async () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test tool',
        execute: async (input) => ({ doubled: input.value * 2 })
      });
      
      module.registerTool('test_tool', tool);
      
      const result = await module.executeTool('test_tool', { value: 5 });
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ doubled: 10 });
    });
    
    test('throws if tool not found', async () => {
      await expect(module.executeTool('fake', {})).rejects.toThrow(
        "Tool 'fake' not found in module"
      );
    });
  });
  
  describe('createTools', () => {
    test('base class throws not implemented error', () => {
      expect(() => {
        module.createTools();
      }).toThrow('Must be implemented by subclass');
    });
  });
  
  describe('event methods', () => {
    test('progress emits progress event with context', (done) => {
      module.on('progress', (data) => {
        expect(data.module).toBe('TestModule');
        expect(data.message).toBe('Processing...');
        expect(data.percentage).toBe(75);
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      module.progress('Processing...', 75);
    });
    
    test('error emits error event with context', (done) => {
      module.on('error', (data) => {
        expect(data.module).toBe('TestModule');
        expect(data.message).toBe('Something went wrong');
        expect(data.timestamp).toBeDefined();
        done();
      });
      
      module.error('Something went wrong');
    });
    
    test('info emits info event', (done) => {
      module.on('info', (data) => {
        expect(data.message).toBe('Info message');
        done();
      });
      
      module.info('Info message');
    });
    
    test('warning emits warning event', (done) => {
      module.on('warning', (data) => {
        expect(data.message).toBe('Warning message');
        done();
      });
      
      module.warning('Warning message');
    });
  });
  
  describe('initialize', () => {
    test('initialize method exists and is async', async () => {
      expect(typeof module.initialize).toBe('function');
      await module.initialize(); // Should not throw
    });
  });
  
  describe('cleanup', () => {
    test('cleanup removes all listeners', async () => {
      const tool = new Tool({
        name: 'test_tool',
        description: 'Test tool',
        execute: async () => ({})
      });
      
      module.registerTool('test_tool', tool);
      
      // Add some listeners
      module.on('test', () => {});
      tool.on('test', () => {});
      
      await module.cleanup();
      
      expect(module.listenerCount('test')).toBe(0);
      expect(tool.listenerCount('test')).toBe(0);
    });
  });
});