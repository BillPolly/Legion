/**
 * Unit tests for SelfDescribingPrototypeFactory
 * 
 * Tests factory capabilities:
 * - Prototype creation and registration
 * - MetaHandle wrapping
 * - Factory-as-Handle queries
 * - Subscription to factory events
 * - Meta-circularity
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { SelfDescribingPrototypeFactory } from '../../src/introspection/SelfDescribingPrototypeFactory.js';
import { Handle } from '../../src/Handle.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';

describe('SelfDescribingPrototypeFactory', () => {
  let factory;
  
  // Initialize introspection system once before all tests
  beforeAll(async () => {
    await Handle.initializeIntrospection();
  });
  
  beforeEach(() => {
    factory = new SelfDescribingPrototypeFactory();
  });
  
  describe('Constructor and Initialization', () => {
    it('should create factory with default settings', () => {
      expect(factory).toBeInstanceOf(SelfDescribingPrototypeFactory);
      expect(factory._prototypeRegistry).toBeInstanceOf(Map);
      expect(factory._prototypeRegistry.size).toBe(0);
    });
    
    it('should accept custom base class', () => {
      class CustomBase {}
      const customFactory = new SelfDescribingPrototypeFactory({ 
        baseClass: CustomBase 
      });
      
      expect(customFactory._baseClass).toBe(CustomBase);
    });
    
    it('should default to Handle as base class', () => {
      expect(factory._baseClass).toBe(Handle);
    });
  });
  
  describe('Prototype Creation', () => {
    it('should create prototype and return MetaHandle', () => {
      const metaHandle = factory.createPrototype('User');
      
      expect(metaHandle).toBeInstanceOf(MetaHandle);
      expect(metaHandle.getTypeName()).toBe('User');
    });
    
    it('should register created prototype', () => {
      const metaHandle = factory.createPrototype('User');
      
      expect(factory.hasPrototype('User')).toBe(true);
      expect(factory.getPrototypeHandle('User')).toBe(metaHandle);
    });
    
    it('should throw error for invalid type name', () => {
      expect(() => factory.createPrototype(null)).toThrow();
      expect(() => factory.createPrototype('')).toThrow();
      expect(() => factory.createPrototype(123)).toThrow();
    });
    
    it('should throw error for duplicate type name', () => {
      factory.createPrototype('User');
      
      expect(() => factory.createPrototype('User')).toThrow('already exists');
    });
    
    it('should create prototype with custom base class', () => {
      class CustomBase {
        customMethod() {
          return 'custom';
        }
      }
      
      const metaHandle = factory.createPrototype('Custom', CustomBase);
      const instance = metaHandle.createInstance();
      
      expect(instance).toBeInstanceOf(CustomBase);
      expect(instance.customMethod()).toBe('custom');
    });
    
    it('should set prototype class name correctly', () => {
      const metaHandle = factory.createPrototype('Product');
      const PrototypeClass = metaHandle.getWrappedPrototype();
      
      expect(PrototypeClass.name).toBe('Product');
      expect(PrototypeClass.getTypeName()).toBe('Product');
    });
    
    it('should create instances with type identification', () => {
      const metaHandle = factory.createPrototype('Order');
      const instance = metaHandle.createInstance();
      
      expect(instance.getTypeName()).toBe('Order');
      expect(instance._typeName).toBe('Order');
    });
  });
  
  describe('Prototype Registry', () => {
    beforeEach(() => {
      factory.createPrototype('User');
      factory.createPrototype('Product');
      factory.createPrototype('Order');
    });
    
    it('should get prototype handle by name', () => {
      const userHandle = factory.getPrototypeHandle('User');
      
      expect(userHandle).toBeInstanceOf(MetaHandle);
      expect(userHandle.getTypeName()).toBe('User');
    });
    
    it('should return undefined for non-existent prototype', () => {
      const result = factory.getPrototypeHandle('NonExistent');
      
      expect(result).toBeUndefined();
    });
    
    it('should check prototype existence', () => {
      expect(factory.hasPrototype('User')).toBe(true);
      expect(factory.hasPrototype('Product')).toBe(true);
      expect(factory.hasPrototype('NonExistent')).toBe(false);
    });
    
    it('should get all prototype names', () => {
      const names = factory.getPrototypeNames();
      
      expect(Array.isArray(names)).toBe(true);
      expect(names).toHaveLength(3);
      expect(names).toContain('User');
      expect(names).toContain('Product');
      expect(names).toContain('Order');
    });
    
    it('should get all prototype handles', () => {
      const handles = factory.getAllPrototypes();
      
      expect(Array.isArray(handles)).toBe(true);
      expect(handles).toHaveLength(3);
      expect(handles.every(h => h instanceof MetaHandle)).toBe(true);
    });
    
    it('should remove prototype from registry', () => {
      expect(factory.hasPrototype('Product')).toBe(true);
      
      const result = factory.removePrototype('Product');
      
      expect(result).toBe(true);
      expect(factory.hasPrototype('Product')).toBe(false);
      expect(factory.getPrototypeNames()).toHaveLength(2);
    });
    
    it('should return false when removing non-existent prototype', () => {
      const result = factory.removePrototype('NonExistent');
      
      expect(result).toBe(false);
    });
  });
  
  describe('Factory as Handle', () => {
    it('should return Handle when calling asHandle()', () => {
      const factoryHandle = factory.asHandle();
      
      expect(factoryHandle).toBeInstanceOf(Handle);
    });
    
    it('should return same Handle instance on multiple calls', () => {
      const handle1 = factory.asHandle();
      const handle2 = factory.asHandle();
      
      expect(handle1).toBe(handle2);
    });
    
    it('should have correct Handle metadata', () => {
      const factoryHandle = factory.asHandle();
      const metadata = factoryHandle.metadata;
      
      expect(metadata.handleType).toBe('factory');
      expect(metadata.prototypeCount).toBe(0);
    });
    
    it('should provide access to factory through Handle', () => {
      const factoryHandle = factory.asHandle();
      const retrievedFactory = factoryHandle.getFactory();
      
      expect(retrievedFactory).toBe(factory);
    });
  });
  
  describe('Factory Handle Queries', () => {
    beforeEach(() => {
      factory.createPrototype('User');
      factory.createPrototype('Product');
    });
    
    it('should list prototypes through Handle query', () => {
      const factoryHandle = factory.asHandle();
      const names = factoryHandle.query({ type: 'list-prototypes' });
      
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('User');
      expect(names).toContain('Product');
    });
    
    it('should get specific prototype through Handle query', () => {
      const factoryHandle = factory.asHandle();
      const userHandle = factoryHandle.query({ 
        type: 'get-prototype',
        typeName: 'User'
      });
      
      expect(userHandle).toBeInstanceOf(MetaHandle);
      expect(userHandle.getTypeName()).toBe('User');
    });
    
    it('should check prototype existence through Handle query', () => {
      const factoryHandle = factory.asHandle();
      
      const exists = factoryHandle.query({ 
        type: 'has-prototype',
        typeName: 'User'
      });
      
      const notExists = factoryHandle.query({ 
        type: 'has-prototype',
        typeName: 'NonExistent'
      });
      
      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });
    
    it('should get prototype count through Handle query', () => {
      const factoryHandle = factory.asHandle();
      const count = factoryHandle.query({ type: 'prototype-count' });
      
      expect(count).toBe(2);
    });
    
    it('should get all prototypes through Handle query', () => {
      const factoryHandle = factory.asHandle();
      const handles = factoryHandle.query({ type: 'all-prototypes' });
      
      expect(Array.isArray(handles)).toBe(true);
      expect(handles).toHaveLength(2);
      expect(handles.every(h => h instanceof MetaHandle)).toBe(true);
    });
    
    it('should throw error for invalid query type', () => {
      const factoryHandle = factory.asHandle();
      
      expect(() => {
        factoryHandle.query({ type: 'invalid-query' });
      }).toThrow();
    });
    
    it('should throw error for missing required parameters', () => {
      const factoryHandle = factory.asHandle();
      
      expect(() => {
        factoryHandle.query({ type: 'get-prototype' });
      }).toThrow('typeName required');
    });
  });
  
  describe('Factory Handle Updates', () => {
    it('should create prototype through Handle update', () => {
      const factoryHandle = factory.asHandle();
      
      const metaHandle = factoryHandle.dataSource.update({
        type: 'create-prototype',
        typeName: 'Category'
      });
      
      expect(metaHandle).toBeInstanceOf(MetaHandle);
      expect(factory.hasPrototype('Category')).toBe(true);
    });
    
    it('should remove prototype through Handle update', () => {
      factory.createPrototype('ToRemove');
      const factoryHandle = factory.asHandle();
      
      const result = factoryHandle.dataSource.update({
        type: 'remove-prototype',
        typeName: 'ToRemove'
      });
      
      expect(result).toBe(true);
      expect(factory.hasPrototype('ToRemove')).toBe(false);
    });
    
    it('should throw error for invalid update type', () => {
      const factoryHandle = factory.asHandle();
      
      expect(() => {
        factoryHandle.dataSource.update({ type: 'invalid-update' });
      }).toThrow();
    });
    
    it('should throw error for missing required update parameters', () => {
      const factoryHandle = factory.asHandle();
      
      expect(() => {
        factoryHandle.dataSource.update({ type: 'create-prototype' });
      }).toThrow('typeName required');
    });
  });
  
  describe('Factory Subscriptions', () => {
    it('should subscribe to prototype creation events', () => {
      const events = [];
      
      const subscription = factory.subscribe(
        { type: 'prototype-created' },
        (event) => events.push(event)
      );
      
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      subscription.unsubscribe();
    });
    
    it('should receive notifications on prototype creation', () => {
      const events = [];
      
      factory.subscribe(
        { type: 'prototype-created' },
        (event) => events.push(event)
      );
      
      factory.createPrototype('NewType');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('prototype-created');
      expect(events[0].typeName).toBe('NewType');
      expect(events[0].metaHandle).toBeInstanceOf(MetaHandle);
    });
    
    it('should receive notifications on prototype removal', () => {
      const events = [];
      
      factory.createPrototype('ToRemove');
      
      factory.subscribe(
        { type: 'prototype-removed' },
        (event) => events.push(event)
      );
      
      factory.removePrototype('ToRemove');
      
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('prototype-removed');
      expect(events[0].typeName).toBe('ToRemove');
    });
    
    it('should filter events by type', () => {
      const creationEvents = [];
      const removalEvents = [];
      
      factory.subscribe(
        { type: 'prototype-created' },
        (event) => creationEvents.push(event)
      );
      
      factory.subscribe(
        { type: 'prototype-removed' },
        (event) => removalEvents.push(event)
      );
      
      factory.createPrototype('Test');
      factory.removePrototype('Test');
      
      expect(creationEvents).toHaveLength(1);
      expect(removalEvents).toHaveLength(1);
    });
    
    it('should filter events by type name', () => {
      const events = [];
      
      factory.subscribe(
        { typeName: 'User' },
        (event) => events.push(event)
      );
      
      factory.createPrototype('User');
      factory.createPrototype('Product');
      
      expect(events).toHaveLength(1);
      expect(events[0].typeName).toBe('User');
    });
    
    it('should unsubscribe from events', () => {
      const events = [];
      
      const subscription = factory.subscribe(
        { type: 'prototype-created' },
        (event) => events.push(event)
      );
      
      factory.createPrototype('First');
      subscription.unsubscribe();
      factory.createPrototype('Second');
      
      expect(events).toHaveLength(1);
      expect(events[0].typeName).toBe('First');
    });
    
    it('should throw error for invalid subscription parameters', () => {
      expect(() => {
        factory.subscribe(null, () => {});
      }).toThrow('Query specification must be an object');
      
      expect(() => {
        factory.subscribe({}, null);
      }).toThrow('Callback function is required');
    });
  });
  
  describe('Factory Schema', () => {
    it('should provide schema through Handle', () => {
      const factoryHandle = factory.asHandle();
      const schema = factoryHandle.dataSource.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema.version).toBe('1.0.0');
      expect(schema.type).toBe('factory');
    });
    
    it('should describe available operations in schema', () => {
      const factoryHandle = factory.asHandle();
      const schema = factoryHandle.dataSource.getSchema();
      
      expect(schema.operations).toBeDefined();
      expect(schema.operations['list-prototypes']).toBeDefined();
      expect(schema.operations['get-prototype']).toBeDefined();
      expect(schema.operations['create-prototype']).toBeDefined();
    });
  });
  
  describe('Meta-Circularity', () => {
    it('should query factory through its own Handle interface', () => {
      factory.createPrototype('User');
      factory.createPrototype('Product');
      
      const factoryHandle = factory.asHandle();
      const names = factoryHandle.query({ type: 'list-prototypes' });
      
      expect(names).toContain('User');
      expect(names).toContain('Product');
    });
    
    it('should create prototypes through factory Handle', () => {
      const factoryHandle = factory.asHandle();
      
      const metaHandle = factoryHandle.dataSource.update({
        type: 'create-prototype',
        typeName: 'Order'
      });
      
      expect(metaHandle).toBeInstanceOf(MetaHandle);
      
      // Verify through original factory
      expect(factory.hasPrototype('Order')).toBe(true);
    });
    
    it('should demonstrate complete meta-circularity', () => {
      // Factory as Handle
      const factoryHandle = factory.asHandle();
      
      // Create prototype through factory Handle
      const userMetaHandle = factoryHandle.dataSource.update({
        type: 'create-prototype',
        typeName: 'User'
      });
      
      // Create instance from MetaHandle
      const userInstance = userMetaHandle.createInstance();
      
      // Query factory for all prototypes
      const allPrototypes = factoryHandle.query({ type: 'all-prototypes' });
      
      // Verify the cycle
      expect(allPrototypes).toContain(userMetaHandle);
      expect(userInstance.getTypeName()).toBe('User');
      expect(factory.hasPrototype('User')).toBe(true);
    });
  });
  
  describe('Integration with MetaHandle', () => {
    it('should create functional MetaHandles', () => {
      const metaHandle = factory.createPrototype('User');
      
      // MetaHandle should be queryable
      const result = metaHandle.query({ type: 'prototype-members' });
      expect(result).toBeDefined();
      expect(result.methods).toBeDefined();
      expect(Array.isArray(result.methods)).toBe(true);
      expect(result.properties).toBeDefined();
      expect(Array.isArray(result.properties)).toBe(true);
      expect(result.descriptors).toBeDefined();
    });
    
    it('should create instances from factory-created prototypes', () => {
      const metaHandle = factory.createPrototype('Product');
      const instance = metaHandle.createInstance();
      
      expect(instance.getTypeName()).toBe('Product');
    });
    
    it('should track instances created from factory prototypes', () => {
      const metaHandle = factory.createPrototype('Order');
      
      const instance1 = metaHandle.createInstance();
      const instance2 = metaHandle.createInstance();
      
      const instances = metaHandle.query({ type: 'instances' });
      expect(instances).toHaveLength(2);
    });
  });
});