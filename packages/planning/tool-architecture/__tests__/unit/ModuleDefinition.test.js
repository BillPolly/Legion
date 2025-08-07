/**
 * Tests for ModuleDefinition base class
 * RED phase: Write failing tests first
 */

import { describe, test, expect } from '@jest/globals';
import { ModuleDefinition } from '../../src/modules/ModuleDefinition.js';

describe('ModuleDefinition Base Class', () => {
  test('should not be instantiable directly', () => {
    expect(() => new ModuleDefinition()).toThrow('ModuleDefinition is abstract and cannot be instantiated directly');
  });

  test('should throw error when create() is not implemented', async () => {
    class TestDefinition extends ModuleDefinition {}
    
    await expect(TestDefinition.create({})).rejects.toThrow('Must be implemented by subclass');
  });

  test('should throw error when getMetadata() is not implemented', () => {
    class TestDefinition extends ModuleDefinition {}
    
    expect(() => TestDefinition.getMetadata()).toThrow('Must be implemented by subclass');
  });

  test('should have static create method', () => {
    expect(typeof ModuleDefinition.create).toBe('function');
  });

  test('should have static getMetadata method', () => {
    expect(typeof ModuleDefinition.getMetadata).toBe('function');
  });
});