/**
 * Basic test file demonstrating enhanced features without external dependencies
 */

import { describe, test, expect, jest } from '@jest/globals';
import { Tool } from '../src/modules/Tool.js';
import { ModuleInstance } from '../src/modules/ModuleInstance.js';
import { ResourceManager } from '../src/ResourceManager.js';

describe('Enhanced Tool Architecture Features', () => {
  
  describe('Tool with Events', () => {
    test('should emit progress events during execution', async () => {
      const progressEvents = [];
      
      const tool = new Tool({
        name: 'test_tool',
        execute: async function(input) {
          // Access tool methods through closure
          tool.progress('Starting task', 0);
          await new Promise(resolve => setTimeout(resolve, 10));
          tool.progress('Half way', 50);
          await new Promise(resolve => setTimeout(resolve, 10));
          tool.progress('Complete', 100);
          return { success: true, result: input.value * 2 };
        }
      });
      
      tool.on('progress', event => progressEvents.push(event));
      
      const result = await tool.execute({ value: 5 });
      
      expect(result.success).toBe(true);
      expect(result.result).toBe(10);
      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[0].percentage).toBe(0);
      expect(progressEvents[1].percentage).toBe(50);
      expect(progressEvents[2].percentage).toBe(100);
    });
    
    test('should emit error events on failure', async () => {
      const errorEvents = [];
      
      const tool = new Tool({
        name: 'error_tool',
        execute: async function(input) {
          tool.error('Something went wrong', { code: 'TEST_ERROR' });
          throw new Error('Test error');
        }
      });
      
      tool.on('error', event => errorEvents.push(event));
      
      const result = await tool.execute({ test: true });
      
      expect(result.success).toBe(false);
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].message).toBe('Something went wrong');
      expect(errorEvents[0].code).toBe('TEST_ERROR');
    });
  });
  
  describe('ModuleInstance with Event Forwarding', () => {
    test('should forward tool events to module level', async () => {
      class TestModule extends ModuleInstance {
        constructor() {
          super({ name: 'TestModule' }, {});
          this.createTools();
        }
        
        createTools() {
          const tool = new Tool({
            name: 'module_tool',
            execute: async function(input) {
              tool.progress('Working...', 50);
              return { success: true };
            }
          });
          
          this.registerTool('module_tool', tool);
        }
      }
      
      const moduleEvents = [];
      const module = new TestModule();
      
      module.on('progress', event => moduleEvents.push(event));
      
      await module.executeTool('module_tool', {});
      
      expect(moduleEvents).toHaveLength(1);
      expect(moduleEvents[0].tool).toBe('module_tool');
      expect(moduleEvents[0].module).toBe('TestModule');
      expect(moduleEvents[0].message).toBe('Working...');
    });
    
    test('module should emit its own events', () => {
      class EventModule extends ModuleInstance {
        constructor() {
          super({ name: 'EventModule' }, {});
        }
        
        doWork() {
          this.progress('Starting work', 0);
          this.info('Processing data');
          this.warning('Low memory', { available: '100MB' });
          this.progress('Work complete', 100);
        }
      }
      
      const events = [];
      const module = new EventModule();
      
      module.on('progress', e => events.push({ type: 'progress', ...e }));
      module.on('info', e => events.push({ type: 'info', ...e }));
      module.on('warning', e => events.push({ type: 'warning', ...e }));
      
      module.doWork();
      
      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('progress');
      expect(events[0].percentage).toBe(0);
      expect(events[1].type).toBe('info');
      expect(events[2].type).toBe('warning');
      expect(events[2].available).toBe('100MB');
      expect(events[3].type).toBe('progress');
      expect(events[3].percentage).toBe(100);
    });
  });
  
  describe('ResourceManager with Proxy', () => {
    test('should provide transparent property access', () => {
      const rm = new ResourceManager();
      
      // Set properties like a plain object
      rm.apiKey = 'sk-12345';
      rm.basePath = '/workspace';
      rm.timeout = 5000;
      
      // Access properties like a plain object
      expect(rm.apiKey).toBe('sk-12345');
      expect(rm.basePath).toBe('/workspace');
      expect(rm.timeout).toBe(5000);
      
      // Can still use methods
      expect(rm.has('apiKey')).toBe(true);
      expect(rm.has('nonexistent')).toBe(false);
      
      // Can delete properties
      delete rm.timeout;
      expect(rm.timeout).toBeUndefined();
    });
    
    test('should support bulk loading', () => {
      const rm = new ResourceManager({
        host: 'localhost',
        port: 3000,
        ssl: true
      });
      
      expect(rm.host).toBe('localhost');
      expect(rm.port).toBe(3000);
      expect(rm.ssl).toBe(true);
      
      // Load more resources
      rm.load({
        apiKey: 'new-key',
        port: 3001  // Overwrite existing
      });
      
      expect(rm.apiKey).toBe('new-key');
      expect(rm.port).toBe(3001);
    });
    
    test('should work as module configuration', () => {
      // ResourceManager looks exactly like a config object
      const rm = new ResourceManager();
      rm.basePath = '/test';
      rm.allowWrite = true;
      rm.maxFileSize = 1024;
      
      // Can be passed directly as config
      class TestModule extends ModuleInstance {
        constructor(config) {
          super({ name: 'Test' }, config);
        }
        
        getConfig() {
          // Access config properties transparently
          return {
            base: this.config.basePath,
            write: this.config.allowWrite,
            size: this.config.maxFileSize
          };
        }
      }
      
      const module = new TestModule(rm);
      const config = module.getConfig();
      
      expect(config.base).toBe('/test');
      expect(config.write).toBe(true);
      expect(config.size).toBe(1024);
    });
    
    test('should support iteration and keys', () => {
      const rm = new ResourceManager({
        a: 1,
        b: 2,
        c: 3
      });
      
      expect(rm.keys()).toEqual(['a', 'b', 'c']);
      expect(rm.size).toBe(3);
      
      const obj = rm.toObject();
      expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });
    
    test('should support child resource managers', () => {
      const parent = new ResourceManager({
        apiKey: 'parent-key',
        baseUrl: 'https://api.example.com'
      });
      
      const child = parent.createChild({
        apiKey: 'child-key',  // Override parent
        timeout: 5000  // Add new
      });
      
      expect(child.apiKey).toBe('child-key');
      expect(child.baseUrl).toBe('https://api.example.com');
      expect(child.timeout).toBe(5000);
      
      // Parent is unaffected
      expect(parent.apiKey).toBe('parent-key');
      expect(parent.timeout).toBeUndefined();
    });
  });
  
  describe('Integration Example', () => {
    test('should work together seamlessly', async () => {
      // Setup ResourceManager with configuration
      const rm = new ResourceManager({
        apiKey: 'test-key',
        endpoint: 'https://api.example.com',
        timeout: 3000
      });
      
      // Create a module that uses the ResourceManager
      class APIModule extends ModuleInstance {
        constructor(config) {
          super({ name: 'APIModule' }, config);
          this.createTools();
        }
        
        createTools() {
          const fetchTool = new Tool({
            name: 'fetch_data',
            execute: async (input) => {
              // Access config through ResourceManager
              const url = `${this.config.endpoint}${input.path}`;
              const apiKey = this.config.apiKey;
              
              fetchTool.progress(`Fetching from ${url}`, 50);
              
              // Simulate API call
              await new Promise(resolve => setTimeout(resolve, 10));
              
              fetchTool.progress('Complete', 100);
              
              return {
                success: true,
                data: {
                  url,
                  apiKey: apiKey.substring(0, 4) + '***',
                  response: 'mock data'
                }
              };
            }
          });
          
          this.registerTool('fetch_data', fetchTool);
        }
      }
      
      // Create module with ResourceManager as config
      const api = new APIModule(rm);
      const events = [];
      
      api.on('progress', e => events.push(e));
      
      // Execute tool
      const result = await api.executeTool('fetch_data', { path: '/users' });
      
      expect(result.success).toBe(true);
      expect(result.data.url).toBe('https://api.example.com/users');
      expect(result.data.apiKey).toBe('test***');
      expect(events).toHaveLength(2);
      expect(events[0].percentage).toBe(50);
      expect(events[1].percentage).toBe(100);
    });
  });
});