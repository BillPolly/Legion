/**
 * MetaHandle Integration Tests
 * 
 * Tests the integration of MetaHandle with existing Handle prototypes.
 * Verifies that we can wrap existing Handle classes and query them.
 * 
 * This is the key integration test for Phase 1:
 * - Wrap existing Handle prototype as a MetaHandle
 * - Query its methods, properties, and inheritance chain
 * - Create instances from the MetaHandle
 * - Verify meta-circularity (Handle prototypes are themselves Handles)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { MetaDataSource } from '../../src/introspection/MetaDataSource.js';
import { Handle } from '../../src/Handle.js';

// Mock DataSource for testing Handle creation
class MockDataSource {
  constructor() {
    this._subscriptions = new Map();
  }
  
  query(querySpec) {
    return [];
  }
  
  subscribe(querySpec, callback) {
    const id = Date.now() + Math.random();
    const subscription = {
      id,
      unsubscribe: () => {
        this._subscriptions.delete(id);
      }
    };
    this._subscriptions.set(id, subscription);
    return subscription;
  }
  
  getSchema() {
    return {
      type: 'object',
      properties: {}
    };
  }
  
  queryBuilder(sourceHandle) {
    return {
      where: () => this,
      select: () => this,
      first: () => null,
      last: () => null,
      count: () => 0,
      toArray: () => []
    };
  }
}

// Test Handle subclass
class TestHandle extends Handle {
  constructor(dataSource) {
    super(dataSource);
    this._testValue = 'test';
  }
  
  value() {
    return this._testValue;
  }
  
  query(querySpec) {
    return this.dataSource.query(querySpec);
  }
  
  testMethod() {
    return 'test-result';
  }
}

describe('MetaHandle Integration - Wrapping Existing Handle Prototypes', () => {
  let metaDataSource;
  let handleMetaHandle;
  let mockDataSource;
  
  beforeEach(() => {
    // Wrap the Handle class itself as a MetaHandle
    metaDataSource = new MetaDataSource(Handle);
    handleMetaHandle = new MetaHandle(metaDataSource, Handle);
    mockDataSource = new MockDataSource();
  });
  
  describe('Wrapping Handle Base Class', () => {
    it('should wrap Handle class as MetaHandle', () => {
      expect(handleMetaHandle).toBeDefined();
      expect(handleMetaHandle.value()).toBe(Handle);
    });
    
    it('should query Handle methods', () => {
      const methods = handleMetaHandle.query({ type: 'methods' });
      
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThan(0);
      
      // Should find core Handle methods
      const methodNames = methods.map(m => m.name);
      expect(methodNames).toContain('value');
      expect(methodNames).toContain('query');
      expect(methodNames).toContain('subscribe');
      expect(methodNames).toContain('destroy');
    });
    
    it('should query Handle inheritance chain', () => {
      const chain = handleMetaHandle.query({ type: 'inheritance-chain' });
      
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
      
      // First should be Handle
      expect(chain[0].name).toBe('Handle');
      
      // Second should be Actor (Handle extends Actor)
      expect(chain[1].name).toBe('Actor');
    });
    
    it('should query Handle metadata', () => {
      const metadata = handleMetaHandle.query({ type: 'metadata' });
      
      expect(metadata).toBeDefined();
      expect(metadata.name).toBe('Handle');
      expect(metadata.isClass).toBe(true);
      expect(metadata.isFunction).toBe(true);
      expect(metadata.hasPrototype).toBe(true);
    });
    
    it('should query Handle property descriptors', () => {
      const descriptors = handleMetaHandle.query({ type: 'descriptors' });
      
      expect(descriptors).toBeDefined();
      expect(typeof descriptors).toBe('object');
      
      // Should have descriptors for methods
      expect(descriptors.value).toBeDefined();
      expect(descriptors.query).toBeDefined();
      expect(descriptors.subscribe).toBeDefined();
    });
  });
  
  describe('Wrapping Handle Subclass', () => {
    let testHandleMetaHandle;
    
    beforeEach(() => {
      const testHandleDataSource = new MetaDataSource(TestHandle);
      testHandleMetaHandle = new MetaHandle(testHandleDataSource, TestHandle);
    });
    
    it('should wrap TestHandle subclass as MetaHandle', () => {
      expect(testHandleMetaHandle).toBeDefined();
      expect(testHandleMetaHandle.value()).toBe(TestHandle);
    });
    
    it('should query TestHandle methods including inherited ones', () => {
      const methods = testHandleMetaHandle.query({ type: 'methods' });
      
      const methodNames = methods.map(m => m.name);
      
      // Should have TestHandle-specific methods
      expect(methodNames).toContain('testMethod');
      
      // Should have overridden methods
      expect(methodNames).toContain('value');
      expect(methodNames).toContain('query');
    });
    
    it('should query TestHandle inheritance chain', () => {
      const chain = testHandleMetaHandle.query({ type: 'inheritance-chain' });
      
      expect(chain.length).toBeGreaterThan(0);
      
      // First should be TestHandle
      expect(chain[0].name).toBe('TestHandle');
      
      // Should include Handle in chain
      const handleInChain = chain.find(c => c.name === 'Handle');
      expect(handleInChain).toBeDefined();
    });
    
    it('should create TestHandle instances from MetaHandle', () => {
      const instance = testHandleMetaHandle.createInstance(mockDataSource);
      
      expect(instance).toBeDefined();
      expect(instance instanceof TestHandle).toBe(true);
      expect(instance instanceof Handle).toBe(true);
      expect(instance.testMethod()).toBe('test-result');
    });
    
    it('should create multiple TestHandle instances', () => {
      const instance1 = testHandleMetaHandle.createInstance(mockDataSource);
      const instance2 = testHandleMetaHandle.createInstance(mockDataSource);
      
      expect(instance1).not.toBe(instance2);
      expect(instance1 instanceof TestHandle).toBe(true);
      expect(instance2 instanceof TestHandle).toBe(true);
    });
  });
  
  describe('Meta-Circularity - Handle Prototypes as Handles', () => {
    it('should treat MetaHandle as a Handle instance', () => {
      expect(handleMetaHandle instanceof Handle).toBe(true);
    });
    
    it('should support Handle interface on MetaHandle', () => {
      // MetaHandle should support core Handle methods
      expect(handleMetaHandle.value).toBeDefined();
      expect(handleMetaHandle.query).toBeDefined();
      expect(handleMetaHandle.subscribe).toBeDefined();
      expect(handleMetaHandle.destroy).toBeDefined();
    });
    
    it('should query MetaHandle itself as a prototype', () => {
      // Create MetaHandle wrapping MetaHandle class
      const metaMetaDataSource = new MetaDataSource(MetaHandle);
      const metaMetaHandle = new MetaHandle(metaMetaDataSource, MetaHandle);
      
      expect(metaMetaHandle).toBeDefined();
      
      const methods = metaMetaHandle.query({ type: 'methods' });
      const methodNames = methods.map(m => m.name);
      
      // Should have MetaHandle-specific methods
      expect(methodNames).toContain('createInstance');
      expect(methodNames).toContain('getIntrospectionInfo');
      
      // Should also have Handle methods (inherited)
      expect(methodNames).toContain('value');
      expect(methodNames).toContain('query');
    });
    
    it('should create MetaHandle instances from MetaHandle', () => {
      // This is meta-circular: MetaHandle creating MetaHandles
      const metaMetaDataSource = new MetaDataSource(MetaHandle);
      const metaMetaHandle = new MetaHandle(metaMetaDataSource, MetaHandle);
      
      // Create a new MetaHandle instance
      const testDataSource = new MetaDataSource(TestHandle);
      const newMetaHandle = metaMetaHandle.createInstance(testDataSource, TestHandle);
      
      expect(newMetaHandle).toBeDefined();
      expect(newMetaHandle instanceof MetaHandle).toBe(true);
      expect(newMetaHandle.value()).toBe(TestHandle);
    });
  });
  
  describe('Dynamic Prototype Modification', () => {
    let testHandleMetaHandle;
    
    beforeEach(() => {
      const testHandleDataSource = new MetaDataSource(TestHandle);
      testHandleMetaHandle = new MetaHandle(testHandleDataSource, TestHandle);
    });
    
    it('should add method to Handle prototype at runtime', () => {
      // Add a new method to TestHandle prototype
      const result = testHandleMetaHandle.update({
        type: 'add-method',
        name: 'dynamicMethod',
        method: function() {
          return 'dynamic-result';
        }
      });
      
      expect(result).toBe(true);
      
      // Create instance and verify new method exists
      const instance = testHandleMetaHandle.createInstance(mockDataSource);
      expect(instance.dynamicMethod).toBeDefined();
      expect(instance.dynamicMethod()).toBe('dynamic-result');
    });
    
    it('should modify existing instances when prototype changes', () => {
      // Create instance before modification
      const instance = testHandleMetaHandle.createInstance(mockDataSource);
      expect(instance.dynamicMethod2).toBeUndefined();
      
      // Add method to prototype
      testHandleMetaHandle.update({
        type: 'add-method',
        name: 'dynamicMethod2',
        method: function() {
          return 'dynamic-result-2';
        }
      });
      
      // Existing instance should now have the method
      expect(instance.dynamicMethod2).toBeDefined();
      expect(instance.dynamicMethod2()).toBe('dynamic-result-2');
    });
    
    it('should notify subscribers when prototype changes', () => {
      let notificationReceived = false;
      let changeData = null;
      
      const subscription = testHandleMetaHandle.subscribe(
        { type: 'prototype-members' },
        (change) => {
          notificationReceived = true;
          changeData = change;
        }
      );
      
      // Modify prototype
      testHandleMetaHandle.update({
        type: 'add-method',
        name: 'subscribedMethod',
        method: () => 'test'
      });
      
      // Verify notification
      expect(notificationReceived).toBe(true);
      expect(changeData).toBeDefined();
      expect(changeData.type).toBe('method-added');
      expect(changeData.name).toBe('subscribedMethod');
      
      subscription.unsubscribe();
    });
  });
  
  describe('Handle Introspection via MetaHandle', () => {
    it('should provide complete introspection of Handle prototype', () => {
      const members = handleMetaHandle.query({ type: 'prototype-members' });
      
      expect(members).toBeDefined();
      expect(members.methods).toBeDefined();
      expect(members.properties).toBeDefined();
      expect(members.descriptors).toBeDefined();
      
      // Should have comprehensive method list
      expect(members.methods.length).toBeGreaterThan(10);
      
      // Should include query combinators
      expect(members.methods).toContain('where');
      expect(members.methods).toContain('select');
      expect(members.methods).toContain('join');
      expect(members.methods).toContain('orderBy');
      expect(members.methods).toContain('limit');
      expect(members.methods).toContain('skip');
    });
    
    it('should provide Handle metadata', () => {
      const metadata = handleMetaHandle.query({ type: 'metadata' });
      
      expect(metadata.name).toBe('Handle');
      expect(metadata.prototypeChainLength).toBeGreaterThan(1);
    });
    
    it('should allow querying specific Handle methods', () => {
      const methods = handleMetaHandle.query({ type: 'methods' });
      
      // Find specific methods
      const subscribeMethod = methods.find(m => m.name === 'subscribe');
      expect(subscribeMethod).toBeDefined();
      
      const destroyMethod = methods.find(m => m.name === 'destroy');
      expect(destroyMethod).toBeDefined();
      
      const whereMethod = methods.find(m => m.name === 'where');
      expect(whereMethod).toBeDefined();
    });
  });
});