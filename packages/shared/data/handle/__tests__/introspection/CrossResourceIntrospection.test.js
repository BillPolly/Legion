/**
 * Integration tests for cross-resource introspection
 * 
 * Tests that the introspection system works universally across different 
 * resource types, allowing uniform querying of prototypes regardless of 
 * their underlying DataSource implementation.
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { Handle } from '../../src/Handle.js';
import { PrototypeFactory } from '../../src/PrototypeFactory.js';
import { SelfDescribingPrototypeFactory } from '../../src/introspection/SelfDescribingPrototypeFactory.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { SimpleObjectDataSource } from '../../src/SimpleObjectDataSource.js';

describe('Cross-Resource Introspection Integration', () => {
  let factory;
  let introspectiveFactory;
  
  // Different types of DataSources
  let objectDataSource;
  let arrayDataSource;
  let mapDataSource;
  let eventDataSource;
  
  beforeAll(async () => {
    await Handle.initializeIntrospection();
  });
  
  beforeEach(() => {
    factory = new PrototypeFactory(Handle);
    introspectiveFactory = new SelfDescribingPrototypeFactory();
    
    // Create various DataSource implementations
    
    // 1. Object-based DataSource (like MongoDB documents)
    objectDataSource = new SimpleObjectDataSource({
      id: 'obj-123',
      type: 'document',
      title: 'Test Document',
      content: 'This is a test document',
      tags: ['test', 'example'],
      metadata: {
        created: new Date('2024-01-01'),
        modified: new Date('2024-01-15'),
        author: 'Test User'
      }
    });
    
    // 2. Array-based DataSource (like file listings)
    arrayDataSource = {
      _data: [
        { name: 'file1.txt', size: 1024 },
        { name: 'file2.js', size: 2048 },
        { name: 'file3.json', size: 512 }
      ],
      
      query: function(querySpec) {
        if (querySpec.type === 'list') {
          return this._data;
        }
        if (querySpec.type === 'get' && querySpec.index !== undefined) {
          return this._data[querySpec.index];
        }
        if (querySpec.type === 'filter' && querySpec.predicate) {
          return this._data.filter(querySpec.predicate);
        }
        return [];
      },
      
      subscribe: function(querySpec, callback) {
        return { unsubscribe: () => {} };
      },
      
      queryBuilder: function(sourceHandle) {
        return null;
      },
      
      getSchema: function() {
        return {
          type: 'array',
          itemType: 'object',
          itemSchema: {
            name: { type: 'string' },
            size: { type: 'number' }
          }
        };
      }
    };
    
    // 3. Map-based DataSource (like configuration)
    mapDataSource = {
      _config: new Map([
        ['app.name', 'TestApp'],
        ['app.version', '1.0.0'],
        ['server.port', 3000],
        ['server.host', 'localhost'],
        ['features.auth', true],
        ['features.logging', true]
      ]),
      
      query: function(querySpec) {
        if (querySpec.type === 'get' && querySpec.key) {
          return this._config.get(querySpec.key);
        }
        if (querySpec.type === 'keys') {
          return Array.from(this._config.keys());
        }
        if (querySpec.type === 'values') {
          return Array.from(this._config.values());
        }
        if (querySpec.type === 'entries') {
          return Array.from(this._config.entries());
        }
        return null;
      },
      
      subscribe: function(querySpec, callback) {
        return { unsubscribe: () => {} };
      },
      
      queryBuilder: function(sourceHandle) {
        return null;
      },
      
      getSchema: function() {
        return {
          type: 'map',
          keyType: 'string',
          valueType: 'mixed',
          namespace: 'config'
        };
      }
    };
    
    // 4. Event-based DataSource (like message queue)
    eventDataSource = {
      _events: [],
      _listeners: new Set(),
      
      query: function(querySpec) {
        if (querySpec.type === 'recent' && querySpec.count) {
          return this._events.slice(-querySpec.count);
        }
        if (querySpec.type === 'all') {
          return this._events;
        }
        if (querySpec.type === 'stats') {
          return {
            count: this._events.length,
            listeners: this._listeners.size
          };
        }
        return [];
      },
      
      subscribe: function(querySpec, callback) {
        this._listeners.add(callback);
        return { 
          unsubscribe: () => {
            this._listeners.delete(callback);
          }
        };
      },
      
      queryBuilder: function(sourceHandle) {
        return null;
      },
      
      getSchema: function() {
        return {
          type: 'event-stream',
          eventTypes: ['created', 'updated', 'deleted'],
          maxBufferSize: 1000
        };
      },
      
      emit: function(event) {
        this._events.push(event);
        for (const listener of this._listeners) {
          listener(event);
        }
      }
    };
  });
  
  describe('Universal prototype introspection', () => {
    it('should introspect prototypes from different resource types uniformly', () => {
      // Create schemas for different resource types
      const schemas = {
        document: {
          ':document/id': { ':db/valueType': ':db.type/string' },
          ':document/title': { ':db/valueType': ':db.type/string' },
          ':document/content': { ':db/valueType': ':db.type/string' },
          ':document/tags': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/many' }
        },
        fileItem: {
          ':fileItem/name': { ':db/valueType': ':db.type/string' },
          ':fileItem/size': { ':db/valueType': ':db.type/number' }
        },
        config: {
          ':config/key': { ':db/valueType': ':db.type/string' },
          ':config/value': { ':db/valueType': ':db.type/mixed' }
        },
        event: {
          ':event/id': { ':db/valueType': ':db.type/string' },
          ':event/type': { ':db/valueType': ':db.type/string' },
          ':event/timestamp': { ':db/valueType': ':db.type/instant' },
          ':event/data': { ':db/valueType': ':db.type/object' }
        }
      };
      
      // Analyze all schemas
      for (const [type, schema] of Object.entries(schemas)) {
        factory.analyzeSchema(schema, 'datascript');
      }
      
      // Create prototypes for each resource type
      const DocumentPrototype = factory.getEntityPrototype('document', Handle);
      const FileItemPrototype = factory.getEntityPrototype('fileItem', Handle);
      const ConfigPrototype = factory.getEntityPrototype('config', Handle);
      const EventPrototype = factory.getEntityPrototype('event', Handle);
      
      // Wrap all prototypes as MetaHandles
      const documentMeta = introspectiveFactory.wrapExistingPrototype('document', DocumentPrototype);
      const fileItemMeta = introspectiveFactory.wrapExistingPrototype('fileItem', FileItemPrototype);
      const configMeta = introspectiveFactory.wrapExistingPrototype('config', ConfigPrototype);
      const eventMeta = introspectiveFactory.wrapExistingPrototype('event', EventPrototype);
      
      // All MetaHandles should support the same introspection interface
      const metaHandles = [documentMeta, fileItemMeta, configMeta, eventMeta];
      
      for (const metaHandle of metaHandles) {
        // Test that all have the same introspection methods
        expect(typeof metaHandle.query).toBe('function');
        expect(typeof metaHandle.getTypeName).toBe('function');
        expect(typeof metaHandle.createInstance).toBe('function');
        
        // Query prototype members uniformly
        const members = metaHandle.query({ type: 'prototype-members' });
        expect(members).toHaveProperty('methods');
        expect(members).toHaveProperty('properties');
        expect(Array.isArray(members.methods)).toBe(true);
        
        // Get type name
        const typeName = metaHandle.getTypeName();
        expect(typeof typeName).toBe('string');
        expect(typeName.length).toBeGreaterThan(0);
      }
    });
    
    it('should create instances with correct DataSource bindings', () => {
      // Set up prototypes for all resource types
      const schemas = {
        document: {
          ':document/id': { ':db/valueType': ':db.type/string' },
          ':document/title': { ':db/valueType': ':db.type/string' }
        }
      };
      
      factory.analyzeSchema(schemas.document, 'datascript');
      const DocumentPrototype = factory.getEntityPrototype('document', Handle);
      const documentMeta = introspectiveFactory.wrapExistingPrototype('document', DocumentPrototype);
      
      // Create instances with different DataSources
      const objectInstance = documentMeta.createInstance(objectDataSource, 'obj-123');
      const arrayInstance = documentMeta.createInstance(arrayDataSource, 0);
      const mapInstance = documentMeta.createInstance(mapDataSource, 'app.name');
      const eventInstance = documentMeta.createInstance(eventDataSource, 'event-1');
      
      // All instances should have the same type but different DataSources
      expect(objectInstance.typeName).toBe('document');
      expect(arrayInstance.typeName).toBe('document');
      expect(mapInstance.typeName).toBe('document');
      expect(eventInstance.typeName).toBe('document');
      
      // All instances should support introspection
      expect(typeof objectInstance.getPrototype).toBe('function');
      expect(typeof arrayInstance.getPrototype).toBe('function');
      expect(typeof mapInstance.getPrototype).toBe('function');
      expect(typeof eventInstance.getPrototype).toBe('function');
    });
    
    it('should query attributes across different DataSource types', () => {
      // Create a unified schema that works across resource types
      const unifiedSchema = {
        ':resource/id': { ':db/valueType': ':db.type/string' },
        ':resource/type': { ':db/valueType': ':db.type/string' },
        ':resource/data': { ':db/valueType': ':db.type/mixed' }
      };
      
      factory.analyzeSchema(unifiedSchema, 'datascript');
      const ResourcePrototype = factory.getEntityPrototype('resource', Handle);
      const resourceMeta = introspectiveFactory.wrapExistingPrototype('resource', ResourcePrototype);
      
      // Create instances with different DataSources
      const instances = [
        resourceMeta.createInstance(objectDataSource, 'obj-123'),
        resourceMeta.createInstance(arrayDataSource, 0),
        resourceMeta.createInstance(mapDataSource, 'app.name'),
        resourceMeta.createInstance(eventDataSource, 'event-1')
      ];
      
      // All instances should report the same available attributes
      for (const instance of instances) {
        const attrs = instance.getAvailableAttributes();
        expect(attrs).toContain('id');
        expect(attrs).toContain('type');
        expect(attrs).toContain('data');
        
        // Get attribute info uniformly
        const idInfo = instance.getAttributeInfo('id');
        expect(idInfo).toBeDefined();
        expect(idInfo.type).toBe('string');
      }
    });
  });
  
  describe('Cross-resource prototype registry', () => {
    it('should maintain a unified registry of all prototypes', () => {
      // Register prototypes for different resource types
      const prototypes = [
        { name: 'document', baseClass: Handle },
        { name: 'fileItem', baseClass: Handle },
        { name: 'config', baseClass: Handle },
        { name: 'event', baseClass: Handle }
      ];
      
      for (const proto of prototypes) {
        introspectiveFactory.createPrototype(proto.name, proto.baseClass);
      }
      
      // Query the factory for all registered prototypes
      const registeredNames = introspectiveFactory.getPrototypeNames();
      expect(registeredNames).toHaveLength(4);
      expect(registeredNames).toContain('document');
      expect(registeredNames).toContain('fileItem');
      expect(registeredNames).toContain('config');
      expect(registeredNames).toContain('event');
      
      // Get all prototype handles
      const allPrototypes = introspectiveFactory.getAllPrototypes();
      expect(allPrototypes).toHaveLength(4);
      
      // Each should be a MetaHandle
      for (const protoHandle of allPrototypes) {
        expect(protoHandle).toBeInstanceOf(MetaHandle);
      }
    });
    
    it('should query factory as a Handle for meta-circularity', () => {
      // Register some prototypes
      introspectiveFactory.createPrototype('type1', Handle);
      introspectiveFactory.createPrototype('type2', Handle);
      introspectiveFactory.createPrototype('type3', Handle);
      
      // Get factory as a Handle
      const factoryHandle = introspectiveFactory.asHandle();
      expect(factoryHandle).toBeInstanceOf(Handle);
      
      // Query factory through Handle interface
      const prototypeList = factoryHandle.query({ type: 'list-prototypes' });
      expect(prototypeList).toHaveLength(3);
      expect(prototypeList).toContain('type1');
      expect(prototypeList).toContain('type2');
      expect(prototypeList).toContain('type3');
      
      // Query prototype count
      const count = factoryHandle.query({ type: 'prototype-count' });
      expect(count).toBe(3);
      
      // Query specific prototype
      const type1Handle = factoryHandle.query({ 
        type: 'get-prototype', 
        typeName: 'type1' 
      });
      expect(type1Handle).toBeInstanceOf(MetaHandle);
      expect(type1Handle.getTypeName()).toBe('type1');
    });
  });
  
  describe('Dynamic schema evolution across resources', () => {
    it('should adapt prototypes as schemas evolve', () => {
      // Start with a simple schema
      let currentSchema = {
        ':entity/id': { ':db/valueType': ':db.type/string' },
        ':entity/name': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(currentSchema, 'datascript');
      const EntityPrototypeV1 = factory.getEntityPrototype('entity', Handle);
      const entityMetaV1 = introspectiveFactory.wrapExistingPrototype('entity-v1', EntityPrototypeV1);
      
      // Create instances with different DataSources
      const instanceV1Object = entityMetaV1.createInstance(objectDataSource, 'obj-1');
      const instanceV1Array = entityMetaV1.createInstance(arrayDataSource, 0);
      
      // Check initial attributes
      const attrsV1Object = instanceV1Object.getAvailableAttributes();
      const attrsV1Array = instanceV1Array.getAvailableAttributes();
      
      expect(attrsV1Object).toHaveLength(2);
      expect(attrsV1Array).toHaveLength(2);
      
      // Evolve the schema
      factory.clearCache();
      
      const evolvedSchema = {
        ':entity/id': { ':db/valueType': ':db.type/string' },
        ':entity/name': { ':db/valueType': ':db.type/string' },
        ':entity/description': { ':db/valueType': ':db.type/string' },
        ':entity/tags': { ':db/valueType': ':db.type/string', ':db/cardinality': ':db.cardinality/many' },
        ':entity/metadata': { ':db/valueType': ':db.type/object' }
      };
      
      factory.analyzeSchema(evolvedSchema, 'datascript');
      const EntityPrototypeV2 = factory.getEntityPrototype('entity', Handle);
      const entityMetaV2 = introspectiveFactory.wrapExistingPrototype('entity-v2', EntityPrototypeV2);
      
      // Create new instances with evolved schema
      const instanceV2Object = entityMetaV2.createInstance(objectDataSource, 'obj-2');
      const instanceV2Map = entityMetaV2.createInstance(mapDataSource, 'entity.config');
      
      // Check evolved attributes
      const attrsV2Object = instanceV2Object.getAvailableAttributes();
      const attrsV2Map = instanceV2Map.getAvailableAttributes();
      
      expect(attrsV2Object).toHaveLength(5);
      expect(attrsV2Map).toHaveLength(5);
      expect(attrsV2Object).toContain('description');
      expect(attrsV2Object).toContain('tags');
      expect(attrsV2Object).toContain('metadata');
    });
  });
  
  describe('Subscription across resource types', () => {
    it('should subscribe to changes uniformly across DataSource types', () => {
      // Create a prototype that can work with event-based DataSources
      const schema = {
        ':stream/id': { ':db/valueType': ':db.type/string' },
        ':stream/event': { ':db/valueType': ':db.type/object' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const StreamPrototype = factory.getEntityPrototype('stream', Handle);
      const streamMeta = introspectiveFactory.wrapExistingPrototype('stream', StreamPrototype);
      
      // Create instance with event DataSource
      const streamInstance = streamMeta.createInstance(eventDataSource, 'stream-1');
      
      // Subscribe to events
      let receivedEvent = null;
      const subscription = streamInstance.subscribe(
        { type: 'event' },
        (event) => {
          receivedEvent = event;
        }
      );
      
      // Emit an event through the DataSource
      eventDataSource.emit({
        type: 'test-event',
        data: { message: 'Hello from cross-resource test' }
      });
      
      // Check that subscription worked
      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.type).toBe('test-event');
      
      // Unsubscribe
      subscription.unsubscribe();
    });
  });
  
  describe('Factory introspection and statistics', () => {
    it('should track statistics across all resource types', () => {
      // Analyze schemas for multiple resource types
      const schemas = {
        ':user/id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':product/id': { ':db/valueType': ':db.type/string' },
        ':product/price': { ':db/valueType': ':db.type/number' },
        ':order/id': { ':db/valueType': ':db.type/string' },
        ':order/items': { ':db/valueType': ':db.type/ref', ':db/cardinality': ':db.cardinality/many' }
      };
      
      factory.analyzeSchema(schemas, 'datascript');
      
      // Get factory statistics
      const stats = factory.getStats();
      expect(stats.schemaTypes).toBe(3); // user, product, order
      expect(stats.entityPrototypes).toBe(0); // None created yet
      
      // Create prototypes
      factory.getEntityPrototype('user', Handle);
      factory.getEntityPrototype('product', Handle);
      factory.getEntityPrototype('order', Handle);
      
      const statsAfter = factory.getStats();
      expect(statsAfter.entityPrototypes).toBe(3);
      
      // Wrap them as MetaHandles
      const UserPrototype = factory.getEntityPrototype('user', Handle);
      const ProductPrototype = factory.getEntityPrototype('product', Handle);
      const OrderPrototype = factory.getEntityPrototype('order', Handle);
      
      introspectiveFactory.wrapExistingPrototype('user', UserPrototype);
      introspectiveFactory.wrapExistingPrototype('product', ProductPrototype);
      introspectiveFactory.wrapExistingPrototype('order', OrderPrototype);
      
      // Check introspective factory registry
      expect(introspectiveFactory.getPrototypeNames()).toHaveLength(3);
    });
    
    it('should provide unified querying across heterogeneous resources', () => {
      // Create prototypes for different resource types
      const documentProto = introspectiveFactory.createPrototype('document', Handle);
      const configProto = introspectiveFactory.createPrototype('config', Handle);
      const eventProto = introspectiveFactory.createPrototype('event', Handle);
      
      // Create instances with different DataSources
      const docInstance = documentProto.createInstance(objectDataSource, 'doc-1');
      const configInstance = configProto.createInstance(mapDataSource, 'config-1');
      const eventInstance = eventProto.createInstance(eventDataSource, 'event-1');
      
      // All instances should support the same introspection interface
      const instances = [docInstance, configInstance, eventInstance];
      
      for (const instance of instances) {
        // Get prototype from instance
        const proto = instance.getPrototype();
        expect(proto).toBeInstanceOf(MetaHandle);
        
        // Query prototype information uniformly
        const members = proto.query({ type: 'prototype-members' });
        expect(members).toHaveProperty('methods');
        expect(Array.isArray(members.methods)).toBe(true);
        
        // Check that the prototype has some methods defined
        expect(members.methods.length).toBeGreaterThan(0);
        
        // The instances themselves should have query and subscribe methods
        expect(typeof instance.query).toBe('function');
        expect(typeof instance.subscribe).toBe('function');
      }
    });
  });
});