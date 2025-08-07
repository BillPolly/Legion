/**
 * Tests for concrete implementations of base classes
 * RED phase: Write failing tests first
 */

import { describe, test, expect, jest } from '@jest/globals';
import { ExampleModuleDefinition, ExampleModuleInstance } from '../../src/examples/ExampleModule.js';
import { ModuleDefinition } from '../../src/modules/ModuleDefinition.js';
import { ModuleInstance } from '../../src/modules/ModuleInstance.js';

describe('Concrete Base Implementations', () => {
  describe('ExampleModuleDefinition', () => {
    test('should extend ModuleDefinition', () => {
      expect(ExampleModuleDefinition.prototype).toBeInstanceOf(ModuleDefinition);
    });

    test('should implement create() method successfully', async () => {
      const config = { name: 'TestModule', enabled: true };
      const instance = await ExampleModuleDefinition.create(config);
      
      expect(instance).toBeInstanceOf(ExampleModuleInstance);
      expect(instance.config).toEqual({ 
        name: 'TestModule', 
        enabled: true, 
        timeout: 5000  // Default value applied
      });
      expect(instance.moduleDefinition).toBe(ExampleModuleDefinition);
    });

    test('should implement getMetadata() method', () => {
      const metadata = ExampleModuleDefinition.getMetadata();
      
      expect(metadata).toEqual({
        name: 'ExampleModule',
        description: 'Example module for testing',
        version: '1.0.0',
        tools: {
          exampleTool: {
            description: 'An example tool',
            input: { message: 'string' },
            output: { result: 'string' }
          }
        }
      });
    });

    test('should support async initialization', async () => {
      const config = { name: 'AsyncModule' };
      const instance = await ExampleModuleDefinition.create(config);
      
      // Should be able to call initialize
      await expect(instance.initialize()).resolves.toBeUndefined();
    });
  });

  describe('ExampleModuleInstance', () => {
    let instance;

    beforeEach(async () => {
      const config = { name: 'TestModule' };
      instance = await ExampleModuleDefinition.create(config);
    });

    test('should extend ModuleInstance', () => {
      expect(instance).toBeInstanceOf(ModuleInstance);
    });

    test('should implement createTools() method', () => {
      expect(() => instance.createTools()).not.toThrow();
      expect(instance.tools.exampleTool).toBeDefined();
      expect(typeof instance.tools.exampleTool.execute).toBe('function');
      expect(typeof instance.tools.exampleTool.getMetadata).toBe('function');
    });

    test('should create working tools', async () => {
      instance.createTools();
      const tool = instance.getTool('exampleTool');
      
      const result = await tool.execute({ message: 'Hello' });
      expect(result).toEqual({ result: 'Echo: Hello' });
    });

    test('should handle resource management', async () => {
      const initSpy = jest.spyOn(instance, 'initialize');
      const cleanupSpy = jest.spyOn(instance, 'cleanup');
      
      await instance.initialize();
      expect(initSpy).toHaveBeenCalled();
      
      await instance.cleanup();
      expect(cleanupSpy).toHaveBeenCalled();
    });

    test('should support configuration validation', async () => {
      const invalidConfig = { name: 123 }; // Wrong type
      await expect(ExampleModuleDefinition.create(invalidConfig))
        .rejects.toThrow('Configuration validation failed');
    });
  });
});