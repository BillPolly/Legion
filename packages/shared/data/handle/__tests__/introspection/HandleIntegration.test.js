/**
 * Integration tests for Handle.getPrototype() method
 * 
 * Tests the integration of introspection system with base Handle class:
 * - Handle.getPrototype() returns MetaHandle
 * - MetaHandle can be queried for Handle structure
 * - Works seamlessly with existing Handle instances
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { Handle } from '../../src/Handle.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { IntrospectionHandle } from '../../src/introspection/IntrospectionHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';

describe('Handle Integration with Introspection System', () => {
  let dataSource;
  let testHandle;
  
  // Initialize introspection system once before all tests
  beforeAll(async () => {
    await Handle.initializeIntrospection();
  });
  
  beforeEach(() => {
    // Create a test Handle instance
    dataSource = new SimpleObjectDataSource([
      { id: 1, name: 'Test', type: 'entity' }
    ]);
    testHandle = new Handle(dataSource);
  });
  
  describe('Handle.getPrototype()', () => {
    it('should return MetaHandle for Handle instance', () => {
      const prototypeHandle = testHandle.getPrototype();
      
      expect(prototypeHandle).toBeDefined();
      expect(prototypeHandle).toBeInstanceOf(MetaHandle);
      expect(prototypeHandle).toBeInstanceOf(Handle);
    });
    
    it('should return MetaHandle wrapping Handle constructor', () => {
      const prototypeHandle = testHandle.getPrototype();
      
      const wrappedPrototype = prototypeHandle.value();
      expect(wrappedPrototype).toBe(Handle);
    });
    
    it('should return queryable MetaHandle', () => {
      const prototypeHandle = testHandle.getPrototype();
      
      const methods = prototypeHandle.query({ type: 'methods' });
      
      expect(Array.isArray(methods)).toBe(true);
      expect(methods.length).toBeGreaterThan(0);
      
      // Should include Handle methods
      const methodNames = methods.map(m => m.name);
      expect(methodNames).toContain('value');
      expect(methodNames).toContain('query');
      expect(methodNames).toContain('subscribe');
      expect(methodNames).toContain('getPrototype');
    });
    
    it('should return MetaHandle that can query inheritance chain', () => {
      const prototypeHandle = testHandle.getPrototype();
      
      const chain = prototypeHandle.query({ type: 'inheritance-chain' });
      
      expect(Array.isArray(chain)).toBe(true);
      expect(chain.length).toBeGreaterThan(0);
      
      // First should be Handle
      expect(chain[0].name).toBe('Handle');
      
      // Should include Actor (Handle extends Actor)
      const actorInChain = chain.find(c => c.name === 'Actor');
      expect(actorInChain).toBeDefined();
    });
    
    it('should work for Handle subclasses', () => {
      // Create a Handle subclass
      class TestSubHandle extends Handle {
        testMethod() {
          return 'test';
        }
      }
      
      const subDataSource = new SimpleObjectDataSource([]);
      const subHandle = new TestSubHandle(subDataSource);
      
      const prototypeHandle = subHandle.getPrototype();
      
      expect(prototypeHandle).toBeInstanceOf(MetaHandle);
      expect(prototypeHandle.value()).toBe(TestSubHandle);
      
      // Should find subclass-specific method
      const methods = prototypeHandle.query({ type: 'methods' });
      const methodNames = methods.map(m => m.name);
      expect(methodNames).toContain('testMethod');
    });
    
    it('should throw error if Handle is destroyed', () => {
      testHandle.destroy();
      
      expect(() => {
        testHandle.getPrototype();
      }).toThrow('Handle has been destroyed');
    });
  });
  
  describe('Integration with IntrospectionHandle', () => {
    it('should work with IntrospectionHandle.query({ type: "prototype" })', () => {
      const introspectionHandle = new IntrospectionHandle(testHandle);
      const prototypeViaIntrospection = introspectionHandle.query({ type: 'prototype' });
      
      const prototypeDirect = testHandle.getPrototype();
      
      // Both should wrap the same constructor
      expect(prototypeViaIntrospection.value()).toBe(prototypeDirect.value());
      expect(prototypeViaIntrospection.value()).toBe(Handle);
    });
    
    it('should enable complete introspection workflow', () => {
      // Get prototype from Handle
      const prototypeHandle = testHandle.getPrototype();
      
      // Query prototype structure
      const members = prototypeHandle.query({ type: 'prototype-members' });
      
      expect(members.methods).toBeDefined();
      expect(members.properties).toBeDefined();
      expect(members.descriptors).toBeDefined();
      
      // Verify core Handle methods are present
      expect(members.methods.length).toBeGreaterThan(5);
    });
  });
  
  describe('Meta-Circularity', () => {
    it('should enable Handle to introspect itself', () => {
      // Handle instance can get its own prototype
      const prototypeHandle = testHandle.getPrototype();
      
      // Prototype handle can be queried
      const methods = prototypeHandle.query({ type: 'methods' });
      
      // Methods include getPrototype itself
      const methodNames = methods.map(m => m.name);
      expect(methodNames).toContain('getPrototype');
    });
    
    it('should enable MetaHandle to introspect MetaHandle', () => {
      const prototypeHandle = testHandle.getPrototype();
      
      // MetaHandle can get its own prototype
      const metaPrototypeHandle = prototypeHandle.getPrototype();
      
      expect(metaPrototypeHandle).toBeInstanceOf(MetaHandle);
      expect(metaPrototypeHandle.value()).toBe(MetaHandle);
      
      // Can query MetaHandle methods
      const metaMethods = metaPrototypeHandle.query({ type: 'methods' });
      const metaMethodNames = metaMethods.map(m => m.name);
      
      // Should include MetaHandle-specific methods
      expect(metaMethodNames).toContain('createInstance');
      expect(metaMethodNames).toContain('getIntrospectionInfo');
    });
  });
  
  describe('Performance and Caching', () => {
    it('should create new MetaHandle instances on each call', () => {
      // According to implementation, getPrototype() creates new MetaHandle each time
      const proto1 = testHandle.getPrototype();
      const proto2 = testHandle.getPrototype();
      
      // Different MetaHandle instances
      expect(proto1).not.toBe(proto2);
      
      // But wrap same constructor
      expect(proto1.value()).toBe(proto2.value());
      expect(proto1.value()).toBe(Handle);
    });
  });
});