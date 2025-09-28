/**
 * MetaHandle Unit Tests
 * 
 * Tests the core MetaHandle functionality for Phase 1:
 * - Query operations (prototype-members, methods, properties, inheritance-chain)
 * - Instance creation (createInstance)
 * - Update operations (add-method, modify-property, add-property)
 * - Subscription to prototype changes
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { MetaDataSource } from '../../src/introspection/MetaDataSource.js';

// Test class for wrapping as MetaHandle
class TestClass {
  constructor(name, value) {
    this.name = name;
    this.value = value;
  }
  
  getName() {
    return this.name;
  }
  
  getValue() {
    return this.value;
  }
  
  setValue(newValue) {
    this.value = newValue;
  }
}

describe('MetaHandle - Core Functionality', () => {
  let metaDataSource;
  let metaHandle;
  
  beforeEach(() => {
    // Create fresh MetaDataSource and MetaHandle for each test
    metaDataSource = new MetaDataSource(TestClass);
    metaHandle = new MetaHandle(metaDataSource, TestClass);
  });
  
  describe('Construction', () => {
    it('should create MetaHandle with valid DataSource and prototype', () => {
      expect(metaHandle).toBeDefined();
      expect(metaHandle.value()).toBe(TestClass);
    });
    
    it('should throw error if prototype is not a function', () => {
      expect(() => {
        new MetaHandle(metaDataSource, {});
      }).toThrow('PrototypeClass must be a constructor function or class');
    });
    
    it('should throw error if DataSource is invalid', () => {
      expect(() => {
        new MetaHandle({}, TestClass);
      }).toThrow();
    });
  });
  
  describe('Query Operations - prototype-members', () => {
    it('should query prototype-members and return methods and properties', () => {
      const result = metaHandle.query({ type: 'prototype-members' });
      
      expect(result).toBeDefined();
      expect(result.methods).toBeDefined();
      expect(result.properties).toBeDefined();
      expect(result.descriptors).toBeDefined();
      
      // Should have methods from TestClass
      expect(result.methods).toContain('getName');
      expect(result.methods).toContain('getValue');
      expect(result.methods).toContain('setValue');
    });
    
    it('should filter prototype-members by type (methods only)', () => {
      const result = metaHandle.query({ 
        type: 'prototype-members',
        filter: 'methods'
      });
      
      expect(result.methods).toBeDefined();
      expect(result.methods.length).toBeGreaterThan(0);
      expect(result.properties.length).toBe(0);
    });
    
    it('should filter prototype-members by type (properties only)', () => {
      const result = metaHandle.query({ 
        type: 'prototype-members',
        filter: 'properties'
      });
      
      expect(result.properties).toBeDefined();
      expect(result.methods.length).toBe(0);
    });
  });
  
  describe('Query Operations - methods', () => {
    it('should query methods and return method details', () => {
      const methods = metaHandle.query({ type: 'methods' });
      
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThan(0);
      
      // Should have getName method
      const getName = methods.find(m => m.name === 'getName');
      expect(getName).toBeDefined();
      expect(getName.isEnumerable).toBeDefined();
      expect(getName.isConfigurable).toBeDefined();
    });
  });
  
  describe('Query Operations - properties', () => {
    it('should query properties and return property details', () => {
      const properties = metaHandle.query({ type: 'properties' });
      
      expect(Array.isArray(properties)).toBe(true);
      // TestClass might not have properties on prototype, which is valid
    });
  });
  
  describe('Query Operations - inheritance-chain', () => {
    it('should query inheritance chain and return chain array', () => {
      const chain = metaHandle.query({ type: 'inheritance-chain' });
      
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
      
      // First item should be TestClass
      expect(chain[0].name).toBe('TestClass');
      expect(chain[0].constructor).toBe(TestClass);
    });
  });
  
  describe('Query Operations - descriptors', () => {
    it('should query descriptors and return property descriptors', () => {
      const descriptors = metaHandle.query({ type: 'descriptors' });
      
      expect(descriptors).toBeDefined();
      expect(typeof descriptors).toBe('object');
      
      // Should have descriptors for methods
      expect(descriptors.getName).toBeDefined();
      expect(descriptors.getValue).toBeDefined();
    });
  });
  
  describe('Query Operations - metadata', () => {
    it('should query metadata and return prototype metadata', () => {
      const metadata = metaHandle.query({ type: 'metadata' });
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('TestClass');
      expect(metadata.isClass).toBe(true);
      expect(metadata.isFunction).toBe(true);
      expect(metadata.hasPrototype).toBe(true);
      expect(metadata.prototypeChainLength).toBeGreaterThan(0);
    });
  });
  
  describe('Query Operations - error handling', () => {
    it('should throw error for invalid query specification', () => {
      expect(() => {
        metaHandle.query(null);
      }).toThrow('Query specification must be an object');
    });
    
    it('should throw error for unknown query type', () => {
      expect(() => {
        metaHandle.query({ type: 'unknown-type' });
      }).toThrow('Unknown query type: unknown-type');
    });
  });
  
  describe('Instance Creation', () => {
    it('should create instances using createInstance', () => {
      const instance = metaHandle.createInstance('test-name', 42);
      
      expect(instance).toBeDefined();
      expect(instance instanceof TestClass).toBe(true);
      expect(instance.name).toBe('test-name');
      expect(instance.value).toBe(42);
    });
    
    it('should create multiple instances', () => {
      const instance1 = metaHandle.createInstance('name1', 1);
      const instance2 = metaHandle.createInstance('name2', 2);
      
      expect(instance1).not.toBe(instance2);
      expect(instance1.name).toBe('name1');
      expect(instance2.name).toBe('name2');
    });
    
    it('should track instances in WeakSet', () => {
      const instance = metaHandle.createInstance('test', 123);
      
      // WeakSet membership cannot be tested directly
      // but we verify instance creation works
      expect(instance).toBeDefined();
    });
  });
  
  describe('Update Operations - add-method', () => {
    it('should add method to prototype', () => {
      const newMethod = function() { return 'new-method-result'; };
      
      const result = metaHandle.update({
        type: 'add-method',
        name: 'newMethod',
        method: newMethod
      });
      
      expect(result).toBe(true);
      
      // Verify method was added
      const instance = metaHandle.createInstance('test', 1);
      expect(instance.newMethod).toBeDefined();
      expect(instance.newMethod()).toBe('new-method-result');
    });
    
    it('should throw error if method name is invalid', () => {
      expect(() => {
        metaHandle.update({
          type: 'add-method',
          name: '',
          method: () => {}
        });
      }).toThrow('Method name must be a non-empty string');
    });
    
    it('should throw error if method is not a function', () => {
      expect(() => {
        metaHandle.update({
          type: 'add-method',
          name: 'invalidMethod',
          method: 'not-a-function'
        });
      }).toThrow('Method must be a function');
    });
  });
  
  describe('Update Operations - add-property', () => {
    it('should add property to prototype', () => {
      const result = metaHandle.update({
        type: 'add-property',
        name: 'newProperty',
        value: 'default-value'
      });
      
      expect(result).toBe(true);
      
      // Verify property was added
      const instance = metaHandle.createInstance('test', 1);
      expect(instance.newProperty).toBe('default-value');
    });
    
    it('should add property with custom descriptor', () => {
      const result = metaHandle.update({
        type: 'add-property',
        name: 'readOnlyProperty',
        value: 'read-only-value',
        descriptor: {
          writable: false,
          enumerable: true,
          configurable: false
        }
      });
      
      expect(result).toBe(true);
      
      // Verify property was added with descriptor
      const instance = metaHandle.createInstance('test', 1);
      expect(instance.readOnlyProperty).toBe('read-only-value');
      
      // Verify it's read-only
      expect(() => {
        'use strict';
        instance.readOnlyProperty = 'new-value';
      }).toThrow();
    });
  });
  
  describe('Update Operations - modify-property', () => {
    it('should modify property descriptor', () => {
      // First add a property
      metaHandle.update({
        type: 'add-property',
        name: 'modifiableProperty',
        value: 'initial-value'
      });
      
      // Now modify its descriptor
      const result = metaHandle.update({
        type: 'modify-property',
        name: 'modifiableProperty',
        descriptor: {
          value: 'modified-value',
          writable: false,
          enumerable: true,
          configurable: true
        }
      });
      
      expect(result).toBe(true);
      
      // Verify property was modified
      const instance = metaHandle.createInstance('test', 1);
      expect(instance.modifiableProperty).toBe('modified-value');
    });
  });
  
  describe('Update Operations - remove-method', () => {
    it('should remove method from prototype', () => {
      // First add a method
      metaHandle.update({
        type: 'add-method',
        name: 'removableMethod',
        method: () => 'test'
      });
      
      // Verify it exists
      let instance = metaHandle.createInstance('test', 1);
      expect(instance.removableMethod).toBeDefined();
      
      // Remove it
      const result = metaHandle.update({
        type: 'remove-method',
        name: 'removableMethod'
      });
      
      expect(result).toBe(true);
      
      // Verify it's gone
      instance = metaHandle.createInstance('test', 1);
      expect(instance.removableMethod).toBeUndefined();
    });
    
    it('should throw error when removing non-existent method', () => {
      expect(() => {
        metaHandle.update({
          type: 'remove-method',
          name: 'nonExistentMethod'
        });
      }).toThrow("Method 'nonExistentMethod' does not exist on prototype");
    });
  });
  
  describe('Update Operations - remove-property', () => {
    it('should remove property from prototype', () => {
      // First add a property
      metaHandle.update({
        type: 'add-property',
        name: 'removableProperty',
        value: 'test-value'
      });
      
      // Verify it exists
      let instance = metaHandle.createInstance('test', 1);
      expect(instance.removableProperty).toBeDefined();
      
      // Remove it
      const result = metaHandle.update({
        type: 'remove-property',
        name: 'removableProperty'
      });
      
      expect(result).toBe(true);
      
      // Verify it's gone
      instance = metaHandle.createInstance('test', 1);
      expect(instance.removableProperty).toBeUndefined();
    });
  });
  
  describe('Update Operations - error handling', () => {
    it('should throw error for invalid update specification', () => {
      expect(() => {
        metaHandle.update(null);
      }).toThrow('Update specification must be an object');
    });
    
    it('should throw error for unknown update type', () => {
      expect(() => {
        metaHandle.update({ type: 'unknown-update-type' });
      }).toThrow('Unknown update type: unknown-update-type');
    });
  });
  
  describe('Subscription to Changes', () => {
    it('should subscribe to prototype modifications', () => {
      let changeNotification = null;
      
      const subscription = metaHandle.subscribe(
        { type: 'prototype-members' },
        (change) => {
          changeNotification = change;
        }
      );
      
      expect(subscription).toBeDefined();
      expect(subscription.unsubscribe).toBeDefined();
      
      // Make a change
      metaHandle.update({
        type: 'add-method',
        name: 'subscribedMethod',
        method: () => 'test'
      });
      
      // Verify callback was invoked
      expect(changeNotification).toBeDefined();
      expect(changeNotification.type).toBe('method-added');
      expect(changeNotification.name).toBe('subscribedMethod');
      
      // Clean up
      subscription.unsubscribe();
    });
    
    it('should unsubscribe from prototype modifications', () => {
      let callbackCount = 0;
      
      const subscription = metaHandle.subscribe(
        { type: 'prototype-members' },
        () => {
          callbackCount++;
        }
      );
      
      // Make a change
      metaHandle.update({
        type: 'add-method',
        name: 'method1',
        method: () => 'test1'
      });
      
      expect(callbackCount).toBe(1);
      
      // Unsubscribe
      subscription.unsubscribe();
      
      // Make another change
      metaHandle.update({
        type: 'add-method',
        name: 'method2',
        method: () => 'test2'
      });
      
      // Callback should not have been invoked again
      expect(callbackCount).toBe(1);
    });
  });
  
  describe('Introspection', () => {
    it('should return introspection information', () => {
      const info = metaHandle.getIntrospectionInfo();
      
      expect(info).toBeDefined();
      expect(info.metaType).toBe('MetaHandle');
      expect(info.prototypeName).toBe('TestClass');
      expect(info.prototypeType).toBe('function');
      expect(info.methods).toBeDefined();
      expect(info.properties).toBeDefined();
      expect(info.inheritanceChain).toBeDefined();
    });
  });
  
  describe('Lifecycle', () => {
    it('should destroy MetaHandle cleanly', () => {
      metaHandle.destroy();
      
      expect(metaHandle.isDestroyed()).toBe(true);
      
      // Should throw error when using destroyed handle
      expect(() => {
        metaHandle.query({ type: 'methods' });
      }).toThrow('Handle has been destroyed');
    });
    
    it('should be safe to destroy multiple times', () => {
      metaHandle.destroy();
      metaHandle.destroy(); // Should not throw
      
      expect(metaHandle.isDestroyed()).toBe(true);
    });
  });
});