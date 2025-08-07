/**
 * Tests for ModuleInstance base class
 * RED phase: Write failing tests first
 */

import { describe, test, expect } from '@jest/globals';
import { ModuleInstance } from '../../src/modules/ModuleInstance.js';
import { ModuleDefinition } from '../../src/modules/ModuleDefinition.js';

describe('ModuleInstance Base Class', () => {
  test('should accept ModuleDefinition and config in constructor', () => {
    class TestDefinition extends ModuleDefinition {
      static async create(config) {
        return new TestInstance(this, config);
      }
      static getMetadata() {
        return { test: 'metadata' };
      }
    }

    class TestInstance extends ModuleInstance {}

    const config = { test: 'config' };
    const instance = new TestInstance(TestDefinition, config);
    
    expect(instance.moduleDefinition).toBe(TestDefinition);
    expect(instance.config).toEqual(config);
  });

  test('should have tools registry initialized', () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    expect(instance.tools).toEqual({});
  });

  test('should throw error when getTool() called for missing tool', () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    expect(() => instance.getTool('nonexistent')).toThrow("Tool 'nonexistent' not found in module");
  });

  test('should return tool when getTool() called for existing tool', () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    const mockTool = { name: 'testTool', execute: () => {} };
    instance.tools.testTool = mockTool;
    
    expect(instance.getTool('testTool')).toBe(mockTool);
  });

  test('should return tool names when listTools() called', () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    instance.tools.tool1 = { name: 'tool1' };
    instance.tools.tool2 = { name: 'tool2' };
    
    expect(instance.listTools()).toEqual(['tool1', 'tool2']);
  });

  test('should throw error when createTools() is not implemented', () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    expect(() => instance.createTools()).toThrow('Must be implemented by subclass');
  });

  test('should have initialize() method that can be overridden', async () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    // Should not throw and should be callable
    await expect(instance.initialize()).resolves.toBeUndefined();
  });

  test('should have cleanup() method that can be overridden', async () => {
    class TestDefinition extends ModuleDefinition {}
    class TestInstance extends ModuleInstance {}
    
    const instance = new TestInstance(TestDefinition, {});
    // Should not throw and should be callable
    await expect(instance.cleanup()).resolves.toBeUndefined();
  });
});