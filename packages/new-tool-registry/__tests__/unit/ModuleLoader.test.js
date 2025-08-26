/**
 * Unit tests for ModuleLoader
 * 
 * Tests module loading, metadata extraction, tool retrieval, and tool invocation
 * Following TDD principles - these tests are written before implementation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ModuleLoader } from '../../src/core/ModuleLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('ModuleLoader', () => {
  let moduleLoader;
  
  beforeEach(() => {
    moduleLoader = new ModuleLoader();
  });
  
  afterEach(() => {
    // Clean up any resources
    if (moduleLoader && moduleLoader.cleanup) {
      moduleLoader.cleanup();
    }
  });
  
  describe('constructor', () => {
    it('should create a ModuleLoader instance', () => {
      expect(moduleLoader).toBeInstanceOf(ModuleLoader);
    });
    
    it('should accept options', () => {
      const loader = new ModuleLoader({ verbose: true });
      expect(loader.options.verbose).toBe(true);
    });
  });
  
  describe('loadModule', () => {
    it('should load a valid module class', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      
      expect(moduleInstance).toBeDefined();
      expect(moduleInstance.getName).toBeDefined();
      expect(moduleInstance.getName()).toBe('MockCalculator');
    });
    
    it('should throw error for non-existent module', async () => {
      const modulePath = '/non/existent/module.js';
      
      await expect(moduleLoader.loadModule(modulePath))
        .rejects
        .toThrow('Failed to load module');
    });
    
    it('should throw error for invalid module structure', async () => {
      // Create a test file that doesn't export a valid module
      const invalidModulePath = path.join(__dirname, '../fixtures/invalid-module.js');
      
      await expect(moduleLoader.loadModule(invalidModulePath))
        .rejects
        .toThrow('Invalid module structure');
    });
    
    it('should cache loaded modules', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      
      const instance1 = await moduleLoader.loadModule(modulePath);
      const instance2 = await moduleLoader.loadModule(modulePath);
      
      // Should return the same instance (cached)
      expect(instance1).toBe(instance2);
    });
    
    it('should handle modules with different export styles', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      
      expect(moduleInstance).toBeDefined();
      expect(typeof moduleInstance.getTools).toBe('function');
    });
  });
  
  describe('getModuleMetadata', () => {
    it('should extract metadata from a loaded module', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const metadata = await moduleLoader.getModuleMetadata(moduleInstance);
      
      expect(metadata).toMatchObject({
        name: 'MockCalculator',
        version: '1.0.0',
        description: 'A simple calculator module for testing'
      });
    });
    
    it('should handle modules without metadata methods', async () => {
      const minimalModule = {
        getName: () => 'MinimalModule',
        getTools: () => []
      };
      
      const metadata = await moduleLoader.getModuleMetadata(minimalModule);
      
      expect(metadata).toMatchObject({
        name: 'MinimalModule',
        version: 'unknown',
        description: 'No description available'
      });
    });
    
    it('should throw error for invalid module instance', async () => {
      await expect(moduleLoader.getModuleMetadata(null))
        .rejects
        .toThrow('Invalid module instance');
      
      await expect(moduleLoader.getModuleMetadata({}))
        .rejects
        .toThrow('Invalid module instance');
    });
  });
  
  describe('getTools', () => {
    it('should retrieve tools from a module', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(4); // add, subtract, multiply, divide
      
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('add');
      expect(toolNames).toContain('subtract');
      expect(toolNames).toContain('multiply');
      expect(toolNames).toContain('divide');
    });
    
    it('should validate tool structure', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('execute');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool).toHaveProperty('outputSchema');
        expect(typeof tool.execute).toBe('function');
      });
    });
    
    it('should handle modules with no tools', async () => {
      const emptyModule = {
        getName: () => 'EmptyModule',
        getTools: () => []
      };
      
      const tools = await moduleLoader.getTools(emptyModule);
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(0);
    });
    
    it('should throw error if getTools is not defined', async () => {
      const invalidModule = {
        getName: () => 'InvalidModule'
      };
      
      await expect(moduleLoader.getTools(invalidModule))
        .rejects
        .toThrow('Module does not have getTools method');
    });
  });
  
  describe('invokeTool', () => {
    it('should execute a tool with valid parameters', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      const addTool = tools.find(t => t.name === 'add');
      
      const result = await moduleLoader.invokeTool(addTool, { a: 5, b: 3 });
      
      expect(result).toMatchObject({
        success: true,
        result: 8
      });
    });
    
    it('should handle tool execution errors', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      const divideTool = tools.find(t => t.name === 'divide');
      
      // Division by zero should throw error
      await expect(moduleLoader.invokeTool(divideTool, { a: 10, b: 0 }))
        .rejects
        .toThrow('Division by zero is not allowed');
    });
    
    it('should validate tool parameters against schema', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      const moduleInstance = await moduleLoader.loadModule(modulePath);
      const tools = await moduleLoader.getTools(moduleInstance);
      const addTool = tools.find(t => t.name === 'add');
      
      // Missing required parameter
      await expect(moduleLoader.invokeTool(addTool, { a: 5 }))
        .rejects
        .toThrow('Missing required parameter');
      
      // Wrong parameter type
      await expect(moduleLoader.invokeTool(addTool, { a: '5', b: '3' }))
        .rejects
        .toThrow('Invalid parameter type');
    });
    
    it('should handle async tool execution', async () => {
      const asyncTool = {
        name: 'asyncOperation',
        execute: async (params) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return { success: true, data: params.value * 2 };
        },
        inputSchema: {
          type: 'object',
          properties: { value: { type: 'number' } },
          required: ['value']
        }
      };
      
      const result = await moduleLoader.invokeTool(asyncTool, { value: 21 });
      
      expect(result).toMatchObject({
        success: true,
        data: 42
      });
    });
    
    it('should throw error for invalid tool structure', async () => {
      const invalidTool = { name: 'invalid' }; // Missing execute function
      
      await expect(moduleLoader.invokeTool(invalidTool, {}))
        .rejects
        .toThrow('Tool does not have execute method');
    });
  });
  
  describe('validateModuleStructure', () => {
    it('should validate a proper module structure', () => {
      const validModule = {
        getName: () => 'ValidModule',
        getTools: () => []
      };
      
      expect(() => moduleLoader.validateModuleStructure(validModule)).not.toThrow();
    });
    
    it('should throw for missing getName method', () => {
      const invalidModule = {
        getTools: () => []
      };
      
      expect(() => moduleLoader.validateModuleStructure(invalidModule))
        .toThrow('Module validation failed');
    });
    
    it('should throw for missing getTools method', () => {
      const invalidModule = {
        getName: () => 'InvalidModule'
      };
      
      expect(() => moduleLoader.validateModuleStructure(invalidModule))
        .toThrow('Module validation failed');
    });
  });
  
  describe('validateToolSchema', () => {
    it('should validate a proper tool schema', () => {
      const validTool = {
        name: 'validTool',
        description: 'A valid tool',
        execute: async () => ({ success: true }),
        inputSchema: {
          type: 'object',
          properties: {}
        },
        outputSchema: {
          type: 'object',
          properties: {}
        }
      };
      
      expect(() => moduleLoader.validateToolSchema(validTool)).not.toThrow();
    });
    
    it('should throw for missing required properties', () => {
      const invalidTool = {
        name: 'invalidTool'
        // Missing description, execute, schemas
      };
      
      expect(() => moduleLoader.validateToolSchema(invalidTool))
        .toThrow('Tool validation failed');
    });
    
    it('should throw for invalid schema format', () => {
      const invalidTool = {
        name: 'invalidTool',
        description: 'Invalid tool',
        execute: async () => ({ success: true }),
        inputSchema: 'not-an-object', // Should be object
        outputSchema: {
          type: 'object'
        }
      };
      
      expect(() => moduleLoader.validateToolSchema(invalidTool))
        .toThrow('Tool validation failed');
    });
  });
  
  describe('cleanup', () => {
    it('should clear module cache on cleanup', async () => {
      const modulePath = path.join(__dirname, '../fixtures/MockCalculatorModule.js');
      
      await moduleLoader.loadModule(modulePath);
      expect(moduleLoader.moduleCache.size).toBe(1);
      
      moduleLoader.cleanup();
      expect(moduleLoader.moduleCache.size).toBe(0);
    });
    
    it('should be safe to call cleanup multiple times', () => {
      expect(() => {
        moduleLoader.cleanup();
        moduleLoader.cleanup();
      }).not.toThrow();
    });
  });
});