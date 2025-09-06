/**
 * TypeHandleRegistry Unit Tests
 * Test type registration and lookup functionality
 */

import { jest } from '@jest/globals';
import { TypeHandleRegistry } from '../../src/TypeHandleRegistry.js';
import { TypeHandle } from '../../src/TypeHandle.js';

describe('TypeHandleRegistry', () => {
  let registry;
  let mockMetadata;

  beforeEach(() => {
    registry = new TypeHandleRegistry();
    
    mockMetadata = {
      methods: {
        read: { params: [], returns: 'string' },
        write: { params: ['content:string'], returns: 'boolean' }
      },
      attributes: {
        path: { type: 'string', readonly: true },
        size: { type: 'number', computed: true }
      },
      documentation: {
        description: "Test handle for registry testing",
        examples: ["handle.read()"]
      }
    };
  });

  describe('Type Registration', () => {
    test('should register a new type', () => {
      const typeHandle = registry.registerType('TestHandle', mockMetadata);
      
      expect(typeHandle).toBeInstanceOf(TypeHandle);
      expect(typeHandle.name).toBe('TestHandle');
      expect(typeHandle.methods).toBe(mockMetadata.methods);
    });

    test('should throw error for duplicate type registration', () => {
      registry.registerType('TestHandle', mockMetadata);
      
      expect(() => {
        registry.registerType('TestHandle', mockMetadata);
      }).toThrow('Type TestHandle already registered');
    });

    test('should validate metadata during registration', () => {
      expect(() => {
        registry.registerType('InvalidHandle', null);
      }).toThrow('Type metadata is required');
      
      expect(() => {
        registry.registerType('InvalidHandle', {});
      }).toThrow('Type metadata must include methods');
    });
  });

  describe('Type Lookup', () => {
    test('should retrieve registered type', () => {
      const registeredType = registry.registerType('TestHandle', mockMetadata);
      const retrievedType = registry.getTypeHandle('TestHandle');
      
      expect(retrievedType).toBe(registeredType);
      expect(retrievedType.name).toBe('TestHandle');
    });

    test('should return null for non-existent type', () => {
      const typeHandle = registry.getTypeHandle('NonExistentHandle');
      
      expect(typeHandle).toBeNull();
    });

    test('should check if type exists', () => {
      registry.registerType('TestHandle', mockMetadata);
      
      expect(registry.hasType('TestHandle')).toBe(true);
      expect(registry.hasType('NonExistentHandle')).toBe(false);
    });
  });

  describe('Type Enumeration', () => {
    test('should list all registered type names', () => {
      registry.registerType('Handle1', mockMetadata);
      registry.registerType('Handle2', mockMetadata);
      
      const typeNames = registry.listTypeNames();
      
      expect(typeNames).toContain('Handle1');
      expect(typeNames).toContain('Handle2');
      expect(typeNames.length).toBe(2);
    });

    test('should list all registered type handles', () => {
      const type1 = registry.registerType('Handle1', mockMetadata);
      const type2 = registry.registerType('Handle2', mockMetadata);
      
      const allTypes = registry.listAllTypes();
      
      expect(allTypes).toContain(type1);
      expect(allTypes).toContain(type2);
      expect(allTypes.length).toBe(2);
    });

    test('should get registry statistics', () => {
      registry.registerType('Handle1', mockMetadata);
      registry.registerType('Handle2', mockMetadata);
      
      const stats = registry.getStats();
      
      expect(stats).toEqual({
        totalTypes: 2,
        typeNames: ['Handle1', 'Handle2']
      });
    });
  });

  describe('Auto-Registration from Classes', () => {
    test('should auto-register from handle class', () => {
      // Mock handle class
      class MockHandleClass {
        static getTypeName() { return 'MockHandle'; }
        static getTypeMetadata() { return mockMetadata; }
      }

      const typeHandle = registry.autoRegisterFromClass(MockHandleClass);
      
      expect(typeHandle).toBeInstanceOf(TypeHandle);
      expect(typeHandle.name).toBe('MockHandle');
      expect(registry.hasType('MockHandle')).toBe(true);
    });

    test('should throw error for class without required static methods', () => {
      class InvalidHandleClass {
        // Missing getTypeName and getTypeMetadata
      }

      expect(() => {
        registry.autoRegisterFromClass(InvalidHandleClass);
      }).toThrow('Handle class must implement getTypeName() static method');
    });

    test('should extract metadata from class if getTypeMetadata missing', () => {
      class PartialHandleClass {
        static getTypeName() { return 'PartialHandle'; }
        
        // Methods that should be auto-detected
        async read() { }
        async write(content) { }
        
        // Attributes that should be auto-detected  
        get path() { return this._path; }
        set path(value) { this._path = value; }
      }

      const typeHandle = registry.autoRegisterFromClass(PartialHandleClass);
      
      expect(typeHandle.name).toBe('PartialHandle');
      expect(typeHandle.listMethods().length).toBeGreaterThan(0);
    });
  });

  describe('Global Registry Access', () => {
    test('should set itself as global TypeHandleRegistry', () => {
      const globalRegistry = TypeHandleRegistry.getGlobalRegistry();
      
      expect(globalRegistry).toBeInstanceOf(TypeHandleRegistry);
      expect(global.TypeHandleRegistry).toBe(globalRegistry);
    });

    test('should maintain singleton global registry', () => {
      const registry1 = TypeHandleRegistry.getGlobalRegistry();
      const registry2 = TypeHandleRegistry.getGlobalRegistry();
      
      expect(registry1).toBe(registry2);
    });
  });

  describe('Registry Cleanup', () => {
    test('should clear all registered types', () => {
      registry.registerType('Handle1', mockMetadata);
      registry.registerType('Handle2', mockMetadata);
      
      expect(registry.listTypeNames().length).toBe(2);
      
      registry.clear();
      
      expect(registry.listTypeNames().length).toBe(0);
    });

    test('should unregister specific types', () => {
      registry.registerType('Handle1', mockMetadata);
      registry.registerType('Handle2', mockMetadata);
      
      const success = registry.unregisterType('Handle1');
      
      expect(success).toBe(true);
      expect(registry.hasType('Handle1')).toBe(false);
      expect(registry.hasType('Handle2')).toBe(true);
    });

    test('should return false when unregistering non-existent type', () => {
      const success = registry.unregisterType('NonExistentHandle');
      
      expect(success).toBe(false);
    });
  });
});