/**
 * Tests for Dynamic Schema Evolution
 */

import { DynamicDataStore, createDynamicDataStore } from '../src/DynamicDataStore.js';
import { SchemaManager } from '../src/SchemaManager.js';
import { SchemaEvolution } from '../src/SchemaEvolution.js';

describe('DynamicDataStore - Schema Evolution', () => {
  describe('SchemaManager', () => {
    it('should create SchemaManager with initial schema', () => {
      const initialSchema = {
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' }
      };
      
      const manager = new SchemaManager(initialSchema);
      
      expect(manager.getSchema()).toEqual(initialSchema);
      expect(manager.getVersion()).toBe(1);
    });
    
    it('should add entity type with attributes', () => {
      const manager = new SchemaManager();
      
      manager.addEntityType('product', {
        name: { valueType: 'string' },
        price: { valueType: 'number' },
        inStock: { valueType: 'boolean' }
      });
      
      const schema = manager.getSchema();
      expect(schema[':product/name']).toEqual({ valueType: 'string' });
      expect(schema[':product/price']).toEqual({ valueType: 'number' });
      expect(schema[':product/inStock']).toEqual({ valueType: 'boolean' });
      expect(manager.getVersion()).toBe(2);
    });
    
    it('should remove entity type', () => {
      const manager = new SchemaManager({
        ':user/name': {},
        ':user/email': {},
        ':post/title': {},
        ':post/content': {}
      });
      
      manager.removeEntityType('user');
      
      const schema = manager.getSchema();
      expect(schema[':user/name']).toBeUndefined();
      expect(schema[':user/email']).toBeUndefined();
      expect(schema[':post/title']).toBeDefined();
      expect(schema[':post/content']).toBeDefined();
    });
    
    it('should add single attribute', () => {
      const manager = new SchemaManager({
        ':user/name': {}
      });
      
      manager.addAttribute('user', 'age', { valueType: 'number' });
      
      const schema = manager.getSchema();
      expect(schema[':user/age']).toEqual({ valueType: 'number' });
    });
    
    it('should remove single attribute', () => {
      const manager = new SchemaManager({
        ':user/name': {},
        ':user/email': {},
        ':user/age': { valueType: 'number' }
      });
      
      manager.removeAttribute('user', 'age');
      
      const schema = manager.getSchema();
      expect(schema[':user/age']).toBeUndefined();
      expect(schema[':user/name']).toBeDefined();
      expect(schema[':user/email']).toBeDefined();
    });
    
    it('should add relationship between entities', () => {
      const manager = new SchemaManager({
        ':user/name': {},
        ':post/title': {}
      });
      
      manager.addRelationship('post', 'author', 'user', {
        card: 'one',
        doc: 'Post author'
      });
      
      const schema = manager.getSchema();
      expect(schema[':post/author']).toEqual({
        valueType: 'ref',
        card: 'one',
        doc: 'Reference to user'
      });
    });
    
    it('should add bidirectional relationship', () => {
      const manager = new SchemaManager({
        ':user/name': {},
        ':post/title': {}
      });
      
      manager.addRelationship('post', 'author', 'user', {
        card: 'one',
        reverse: 'posts'
      });
      
      const schema = manager.getSchema();
      expect(schema[':post/author']).toBeDefined();
      expect(schema[':post/author'].valueType).toBe('ref');
      expect(schema[':user/posts']).toBeDefined();
      expect(schema[':user/posts'].valueType).toBe('ref');
      expect(schema[':user/posts'].card).toBe('many');
    });
    
    it('should track schema history', () => {
      const manager = new SchemaManager();
      
      manager.addEntityType('user', { name: {} });
      manager.addAttribute('user', 'email', {});
      manager.removeAttribute('user', 'name');
      
      const history = manager.getHistory();
      expect(history.length).toBe(4); // initial + 3 changes
      expect(history[1].operation).toBe('addEntityType');
      expect(history[2].operation).toBe('addAttribute');
      expect(history[3].operation).toBe('removeAttribute');
    });
    
    it('should notify listeners on schema changes', (done) => {
      const manager = new SchemaManager();
      
      manager.subscribe((change) => {
        expect(change.type).toBe('addEntityType');
        expect(change.entityType).toBe('product');
        expect(change.version).toBe(2);
        done();
      });
      
      manager.addEntityType('product', { name: {} });
    });
    
    it('should validate schema for consistency', () => {
      const manager = new SchemaManager({
        ':user/name': { unique: 'identity' },
        ':user/email': { unique: 'value' },
        ':post/author': { valueType: 'ref' }
      });
      
      const validation = manager.validateSchema();
      expect(validation.valid).toBe(true);
      expect(validation.uniqueConstraints[':user']).toEqual([
        ':user/name',
        ':user/email'
      ]);
    });
  });
  
  describe('DynamicDataStore Integration', () => {
    let store;
    
    beforeEach(() => {
      store = createDynamicDataStore({
        schema: {
          ':user/name': { unique: 'identity' },
          ':user/email': { unique: 'value' }
        }
      });
    });
    
    it('should create DynamicDataStore with initial schema', () => {
      expect(store).toBeInstanceOf(DynamicDataStore);
      expect(store.schema[':user/name']).toBeDefined();
      expect(store.schema[':user/email']).toBeDefined();
    });
    
    it('should add entity type dynamically', async () => {
      const result = await store.addEntityType('product', {
        name: { valueType: 'string' },
        price: { valueType: 'number' }
      });
      
      expect(result.success).toBe(true);
      expect(result.type).toBe('addEntityType');
      
      const schema = store.schema;
      expect(schema[':product/name']).toBeDefined();
      expect(schema[':product/price']).toBeDefined();
    });
    
    it('should create entities with dynamically added schema', async () => {
      // Add product entity type
      await store.addEntityType('product', {
        name: { valueType: 'string' },
        price: { valueType: 'number' },
        inStock: { valueType: 'boolean' }
      });
      
      // Create a product entity
      const result = store.createEntity({
        ':product/name': 'Widget',
        ':product/price': 29.99,
        ':product/inStock': true
      });
      
      expect(result.entityId).toBeDefined();
      
      // Query for the product
      const products = store.query({
        find: ['?e', '?name', '?price'],
        where: [
          ['?e', ':product/name', '?name'],
          ['?e', ':product/price', '?price']
        ]
      });
      
      expect(products.length).toBe(1);
      expect(products[0][1]).toBe('Widget');
      expect(products[0][2]).toBe(29.99);
    });
    
    it('should add attribute to existing entity type', async () => {
      // Create user first
      const userResult = store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      });
      
      // Add age attribute
      await store.addAttribute('user', 'age', { valueType: 'number' });
      
      // Update user with new attribute
      store.updateEntity(userResult.entityId, {
        ':user/age': 30
      });
      
      // Query to verify
      const users = store.query({
        find: ['?name', '?age'],
        where: [
          [userResult.entityId, ':user/name', '?name'],
          [userResult.entityId, ':user/age', '?age']
        ]
      });
      
      expect(users.length).toBe(1);
      expect(users[0][0]).toBe('Alice');
      expect(users[0][1]).toBe(30);
    });
    
    it('should remove attribute with data migration', async () => {
      // Create users with email
      store.createEntity({
        ':user/name': 'Bob',
        ':user/email': 'bob@example.com'
      });
      
      // Remove email attribute (force since data exists)
      const result = await store.removeAttribute('user', 'email', true);
      
      expect(result.success).toBe(true);
      expect(result.entitiesAffected).toBe(1);
      
      // Verify email is gone from schema
      expect(store.schema[':user/email']).toBeUndefined();
      
      // Query should not find email
      const users = store.query({
        find: ['?e', '?name'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(users.length).toBe(1);
      expect(users[0][1]).toBe('Bob');
    });
    
    it('should prevent removing entity type with data unless forced', async () => {
      // Create a user
      store.createEntity({
        ':user/name': 'Charlie',
        ':user/email': 'charlie@example.com'
      });
      
      // Try to remove without force
      await expect(
        store.removeEntityType('user', false)
      ).rejects.toThrow(/Cannot remove entity type/);
      
      // Remove with force
      const result = await store.removeEntityType('user', true);
      expect(result.success).toBe(true);
      expect(result.entitiesRemoved).toBe(1);
      
      // Verify user schema is gone
      expect(store.schema[':user/name']).toBeUndefined();
      expect(store.schema[':user/email']).toBeUndefined();
    });
    
    it('should add relationship between entity types', async () => {
      // Add post entity type
      await store.addEntityType('post', {
        title: { valueType: 'string' },
        content: { valueType: 'string' }
      });
      
      // Add author relationship
      await store.addRelationship('post', 'author', 'user', {
        card: 'one',
        doc: 'Post author'
      });
      
      // Create user and post with relationship
      const userResult = store.createEntity({
        ':user/name': 'Dave',
        ':user/email': 'dave@example.com'
      });
      
      const postResult = store.createEntity({
        ':post/title': 'My Post',
        ':post/content': 'Hello World',
        ':post/author': userResult.entityId
      });
      
      // Query to verify relationship
      const posts = store.query({
        find: ['?title', '?authorName'],
        where: [
          [postResult.entityId, ':post/title', '?title'],
          [postResult.entityId, ':post/author', '?author'],
          ['?author', ':user/name', '?authorName']
        ]
      });
      
      expect(posts.length).toBe(1);
      expect(posts[0][0]).toBe('My Post');
      expect(posts[0][1]).toBe('Dave');
    });
    
    it('should subscribe to schema changes', (done) => {
      let changeCount = 0;
      
      const unsubscribe = store.subscribeToSchemaChanges((change) => {
        changeCount++;
        
        if (changeCount === 1) {
          expect(change.type).toBe('addEntityType');
          expect(change.entityType).toBe('category');
        } else if (changeCount === 2) {
          expect(change.type).toBe('addAttribute');
          expect(change.attributeName).toBe('description');
          unsubscribe();
          done();
        }
      });
      
      // Trigger schema changes
      store.addEntityType('category', { name: {} }).then(() => {
        return store.addAttribute('category', 'description', {});
      });
    });
    
    it('should get schema evolution history', async () => {
      await store.addEntityType('product', { name: {} });
      await store.addAttribute('product', 'price', { valueType: 'number' });
      await store.removeAttribute('product', 'name', true);
      
      const history = store.getSchemaHistory(5);
      expect(history.length).toBe(4); // initial + 3 changes
      expect(history[1].operation).toBe('addEntityType');
      expect(history[2].operation).toBe('addAttribute');
      expect(history[3].operation).toBe('removeAttribute');
    });
  });
  
  describe('SchemaEvolution - Data Migration', () => {
    let store, evolution;
    
    beforeEach(() => {
      store = createDynamicDataStore({
        schema: {
          ':user/name': {},
          ':user/email': {},
          ':post/title': {},
          ':post/content': {},
          ':post/author': { valueType: 'ref' }
        }
      });
      evolution = store.schemaEvolution;
    });
    
    it('should plan migration for entity type removal', () => {
      // Create some data
      const user1 = store.createEntity({
        ':user/name': 'User1',
        ':user/email': 'user1@test.com'
      });
      
      const post1 = store.createEntity({
        ':post/title': 'Post1',
        ':post/content': 'Content1',
        ':post/author': user1.entityId
      });
      
      // Plan migration
      const plan = evolution.planMigration({
        type: 'removeEntityType',
        entityType: 'user'
      });
      
      expect(plan.entitiesAffected).toBe(1);
      expect(plan.steps).toContain('Filter out entities of removed type');
      expect(plan.steps).toContain('Migrate remaining entities');
    });
    
    it('should plan migration for attribute removal', () => {
      // Create data with the attribute
      store.createEntity({
        ':user/name': 'TestUser',
        ':user/email': 'test@example.com'
      });
      
      // Plan migration
      const plan = evolution.planMigration({
        type: 'removeAttribute',
        fullAttribute: ':user/email'
      });
      
      expect(plan.entitiesAffected).toBe(1);
      expect(plan.steps).toContain('Remove attribute from all entities');
      expect(plan.steps).toContain('Migrate cleaned entities');
    });
    
    it('should migrate database to new schema', () => {
      // Create initial data
      store.createEntity({
        ':user/name': 'Alice',
        ':user/email': 'alice@test.com'
      });
      
      store.createEntity({
        ':post/title': 'Test Post',
        ':post/content': 'Test Content'
      });
      
      // Create new schema without email
      const newSchema = {
        ':user/name': {},
        ':post/title': {},
        ':post/content': {},
        ':post/author': { valueType: 'ref' }
      };
      
      // Migrate
      const newConn = evolution.migrateToSchema(newSchema);
      const newDb = newConn.db();
      
      // Query new database
      const users = newDb.datoms('aevt', ':user/name');
      const emails = newDb.datoms('aevt', ':user/email');
      
      expect(Array.from(users).length).toBe(1);
      expect(Array.from(emails).length).toBe(0); // Email attribute removed
    });
  });
  
  describe('Edge Cases and Error Handling', () => {
    let store;
    
    beforeEach(() => {
      store = createDynamicDataStore();
    });
    
    it('should throw error when adding duplicate entity type', async () => {
      await store.addEntityType('product', { name: {} });
      
      await expect(
        store.addEntityType('product', { price: {} })
      ).rejects.toThrow(/already exists/);
    });
    
    it('should throw error when removing non-existent entity type', async () => {
      await expect(
        store.removeEntityType('nonexistent')
      ).rejects.toThrow(/not found/);
    });
    
    it('should throw error when adding duplicate attribute', async () => {
      await store.addEntityType('product', { name: {} });
      
      await expect(
        store.addAttribute('product', 'name', {})
      ).rejects.toThrow(/already exists/);
    });
    
    it('should throw error when removing non-existent attribute', async () => {
      await store.addEntityType('product', {});
      
      await expect(
        store.removeAttribute('product', 'nonexistent')
      ).rejects.toThrow(/not found/);
    });
    
    it('should handle concurrent schema changes gracefully', async () => {
      // Add multiple entity types concurrently
      const results = await Promise.all([
        store.addEntityType('product', { name: {} }),
        store.addEntityType('category', { name: {} }),
        store.addEntityType('order', { total: { valueType: 'number' } })
      ]);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(Object.keys(store.schema).length).toBe(3);
    });
  });
});