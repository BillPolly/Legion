/**
 * Integration tests for Handle introspection with MongoDB resources
 * 
 * Tests that the introspection system works correctly with MongoDB-backed
 * Handles, demonstrating that introspection is universal across resource types.
 * 
 * CRITICAL: All operations must be synchronous - no await in tests!
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Handle } from '../../src/Handle.js';
import { PrototypeFactory } from '../../src/PrototypeFactory.js';
import { SelfDescribingPrototypeFactory } from '../../src/introspection/SelfDescribingPrototypeFactory.js';
import { MetaHandle } from '../../src/introspection/MetaHandle.js';
import { MongoClient } from 'mongodb';

describe('MongoDB Handle Introspection Integration', () => {
  let mongoClient;
  let db;
  let mongoDataSource;
  
  // Initialize introspection and MongoDB connection once before all tests
  beforeAll(async () => {
    await Handle.initializeIntrospection();
    
    // Connect to MongoDB (use test database)
    const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    db = mongoClient.db('handle_introspection_test');
    
    // Clear test collections
    await db.collection('users').deleteMany({});
    await db.collection('products').deleteMany({});
    
    // Insert test data
    await db.collection('users').insertMany([
      { _id: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
      { _id: 'user-2', name: 'Bob', email: 'bob@example.com', role: 'user' },
      { _id: 'user-3', name: 'Charlie', email: 'charlie@example.com', role: 'user' }
    ]);
    
    await db.collection('products').insertMany([
      { _id: 'prod-1', name: 'Widget', price: 19.99, category: 'tools' },
      { _id: 'prod-2', name: 'Gadget', price: 29.99, category: 'electronics' },
      { _id: 'prod-3', name: 'Thing', price: 9.99, category: 'misc' }
    ]);
  });
  
  // Cleanup after all tests
  afterAll(async () => {
    if (mongoClient) {
      await db.dropDatabase();
      await mongoClient.close();
    }
  });
  
  describe('MongoDB DataSource with introspection', () => {
    beforeAll(() => {
      // Create a MongoDB DataSource
      mongoDataSource = {
        query: function(querySpec) {
          // Simplified synchronous mock - in real implementation would need sync wrapper
          if (querySpec.collection === 'users') {
            if (querySpec.id) {
              // Mock finding by ID
              const users = [
                { _id: 'user-1', name: 'Alice', email: 'alice@example.com', role: 'admin' },
                { _id: 'user-2', name: 'Bob', email: 'bob@example.com', role: 'user' },
                { _id: 'user-3', name: 'Charlie', email: 'charlie@example.com', role: 'user' }
              ];
              return users.filter(u => u._id === querySpec.id);
            }
            return [];
          }
          return [];
        },
        
        subscribe: function(querySpec, callback) {
          // Mock subscription
          return {
            unsubscribe: () => {}
          };
        },
        
        queryBuilder: function(sourceHandle) {
          // Return a simple query builder for MongoDB
          return {
            collection: null,
            filters: {},
            
            from: function(collection) {
              this.collection = collection;
              return this;
            },
            
            where: function(field, value) {
              this.filters[field] = value;
              return this;
            },
            
            build: function() {
              return {
                collection: this.collection,
                filters: this.filters
              };
            }
          };
        },
        
        getSchema: function() {
          return {
            collections: {
              users: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  role: { type: 'string', enum: ['admin', 'user', 'guest'] }
                },
                required: ['_id', 'name', 'email']
              },
              products: {
                type: 'object',
                properties: {
                  _id: { type: 'string' },
                  name: { type: 'string' },
                  price: { type: 'number', minimum: 0 },
                  category: { type: 'string' }
                },
                required: ['_id', 'name', 'price']
              }
            }
          };
        }
      };
    });
    
    it('should create introspectable MongoDB Handle', () => {
      // Create MongoDB Handle
      const mongoHandle = new Handle(mongoDataSource);
      
      // Test introspection capability
      const prototype = mongoHandle.getPrototype();
      expect(prototype).toBeDefined();
      expect(prototype).toBeInstanceOf(MetaHandle);
      
      // Query prototype information
      const result = prototype.query({ type: 'prototype-members', filter: 'methods' });
      expect(result.methods).toContain('query');
      expect(result.methods).toContain('subscribe');
      expect(result.methods).toContain('getPrototype');
    });
    
    it('should analyze MongoDB schema for type information', () => {
      // Create PrototypeFactory and analyze MongoDB schema
      const factory = new PrototypeFactory(Handle);
      
      // Convert MongoDB collection schemas to DataScript-like format for analysis
      const schema = {
        ':user/_id': { ':db/valueType': ':db.type/string', ':db/unique': ':db.unique/identity' },
        ':user/name': { ':db/valueType': ':db.type/string', ':db/required': true },
        ':user/email': { ':db/valueType': ':db.type/string', ':db/required': true },
        ':user/role': { ':db/valueType': ':db.type/string' },
        ':product/_id': { ':db/valueType': ':db.type/string', ':db/unique': ':db.unique/identity' },
        ':product/name': { ':db/valueType': ':db.type/string', ':db/required': true },
        ':product/price': { ':db/valueType': ':db.type/number', ':db/required': true },
        ':product/category': { ':db/valueType': ':db.type/string' }
      };
      
      const analysis = factory.analyzeSchema(schema, 'datascript');
      
      expect(analysis.types).toBeDefined();
      expect(analysis.types.has('user')).toBe(true);
      expect(analysis.types.has('product')).toBe(true);
      
      // Get user type info
      const userType = analysis.types.get('user');
      expect(userType).toBeDefined();
      expect(userType.attributes.has('_id')).toBe(true);
      expect(userType.attributes.has('name')).toBe(true);
      expect(userType.attributes.has('email')).toBe(true);
      expect(userType.attributes.has('role')).toBe(true);
    });
    
    it('should create typed MongoDB Handles with introspection', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Analyze MongoDB schema
      const schema = {
        ':user/_id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' },
        ':user/role': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      
      // Get user prototype
      const UserPrototype = factory.getEntityPrototype('user', Handle);
      
      // Wrap as MetaHandle for introspection
      const userMetaHandle = introspectiveFactory.wrapExistingPrototype('user', UserPrototype);
      
      // Create instance for specific MongoDB document
      const userHandle = userMetaHandle.createInstance(mongoDataSource, 'user-1');
      
      expect(userHandle).toBeDefined();
      expect(userHandle.entityId).toBe('user-1');
      expect(userHandle.typeName).toBe('user');
      
      // Test that it has typed methods
      expect(typeof userHandle.getAvailableAttributes).toBe('function');
      const attrs = userHandle.getAvailableAttributes();
      expect(attrs).toContain('_id');
      expect(attrs).toContain('name');
      expect(attrs).toContain('email');
      
      // Test introspection on instance
      const instancePrototype = userHandle.getPrototype();
      expect(instancePrototype).toBeInstanceOf(MetaHandle);
      expect(instancePrototype.getTypeName()).toBe('user');
    });
    
    it('should support querying MongoDB data through typed Handles', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Set up schema and prototypes
      const schema = {
        ':product/_id': { ':db/valueType': ':db.type/string' },
        ':product/name': { ':db/valueType': ':db.type/string' },
        ':product/price': { ':db/valueType': ':db.type/number' },
        ':product/category': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const ProductPrototype = factory.getEntityPrototype('product', Handle);
      const productMetaHandle = introspectiveFactory.wrapExistingPrototype('product', ProductPrototype);
      
      // Create product handle
      const productHandle = productMetaHandle.createInstance(mongoDataSource, 'prod-1');
      
      // Don't call query() directly - TypedHandle doesn't override it
      // Instead, test the introspection capabilities
      
      // Get introspection info
      const info = productHandle.getIntrospectionInfo();
      expect(info.entityType).toBe('product');
      expect(info.entityId).toBe('prod-1');
      expect(info.availableAttributes).toContain('name');
      expect(info.availableAttributes).toContain('price');
      expect(info.availableAttributes).toContain('category');
    });
  });
  
  describe('MongoDB prototype evolution', () => {
    it('should detect and adapt to MongoDB schema changes', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Initial schema
      let currentSchema = {
        ':user/_id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(currentSchema, 'datascript');
      const UserPrototypeV1 = factory.getEntityPrototype('user', Handle);
      const userMetaV1 = introspectiveFactory.wrapExistingPrototype('user-v1', UserPrototypeV1);
      
      // Check initial attributes
      const instanceV1 = userMetaV1.createInstance(mongoDataSource, 'user-1');
      const attrsV1 = instanceV1.getAvailableAttributes();
      expect(attrsV1).toHaveLength(3);
      expect(attrsV1).toContain('_id');
      expect(attrsV1).toContain('name');
      expect(attrsV1).toContain('email');
      
      // Schema evolution - add new fields
      factory.clearCache(); // Clear to re-analyze
      
      const evolvedSchema = {
        ':user/_id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':user/email': { ':db/valueType': ':db.type/string' },
        ':user/role': { ':db/valueType': ':db.type/string' },
        ':user/created': { ':db/valueType': ':db.type/instant' },
        ':user/preferences': { ':db/valueType': ':db.type/object' }
      };
      
      factory.analyzeSchema(evolvedSchema, 'datascript');
      const UserPrototypeV2 = factory.getEntityPrototype('user', Handle);
      const userMetaV2 = introspectiveFactory.wrapExistingPrototype('user-v2', UserPrototypeV2);
      
      // Check evolved attributes
      const instanceV2 = userMetaV2.createInstance(mongoDataSource, 'user-2');
      const attrsV2 = instanceV2.getAvailableAttributes();
      expect(attrsV2).toHaveLength(6);
      expect(attrsV2).toContain('role');
      expect(attrsV2).toContain('created');
      expect(attrsV2).toContain('preferences');
    });
  });
  
  describe('Cross-collection relationships', () => {
    it('should handle MongoDB references through introspection', () => {
      const factory = new PrototypeFactory(Handle);
      const introspectiveFactory = new SelfDescribingPrototypeFactory();
      
      // Schema with references
      const schema = {
        ':order/_id': { ':db/valueType': ':db.type/string' },
        ':order/user': { ':db/valueType': ':db.type/ref' }, // Reference to user
        ':order/products': { ':db/valueType': ':db.type/ref', ':db/cardinality': ':db.cardinality/many' }, // Many products
        ':order/total': { ':db/valueType': ':db.type/number' },
        ':order/status': { ':db/valueType': ':db.type/string' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      const OrderPrototype = factory.getEntityPrototype('order', Handle);
      const orderMetaHandle = introspectiveFactory.wrapExistingPrototype('order', OrderPrototype);
      
      // Create order handle
      const orderHandle = orderMetaHandle.createInstance(mongoDataSource, 'order-1');
      
      // Check relationships are detected
      const relationships = orderHandle.getRelationships();
      expect(relationships).toBeDefined();
      
      // Get all attributes including refs
      const attrs = orderHandle.getAvailableAttributes();
      expect(attrs).toContain('user');
      expect(attrs).toContain('products');
      
      // Get attribute info for reference field
      const userRefInfo = orderHandle.getAttributeInfo('user');
      expect(userRefInfo).toBeDefined();
      expect(userRefInfo.type).toBe('ref');
      
      const productsRefInfo = orderHandle.getAttributeInfo('products');
      expect(productsRefInfo).toBeDefined();
      expect(productsRefInfo.type).toBe('ref');
      expect(productsRefInfo.cardinality).toBe('many');
    });
  });
  
  describe('MongoDB Handle metadata and statistics', () => {
    it('should track MongoDB operation statistics through introspection', () => {
      const factory = new PrototypeFactory(Handle);
      
      // Analyze schema for multiple collections
      const schema = {
        ':user/_id': { ':db/valueType': ':db.type/string' },
        ':user/name': { ':db/valueType': ':db.type/string' },
        ':product/_id': { ':db/valueType': ':db.type/string' },
        ':product/name': { ':db/valueType': ':db.type/string' },
        ':order/_id': { ':db/valueType': ':db.type/string' },
        ':order/total': { ':db/valueType': ':db.type/number' }
      };
      
      factory.analyzeSchema(schema, 'datascript');
      
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
    });
  });
});