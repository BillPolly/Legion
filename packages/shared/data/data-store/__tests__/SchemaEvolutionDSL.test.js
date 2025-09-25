/**
 * Tests for SchemaEvolutionDSL - Domain-specific language for schema evolution
 */

import { DynamicDataStore, createDynamicDataStore } from '../src/DynamicDataStore.js';
import { SchemaEvolutionDSL, createSchemaEvolutionDSL } from '../src/SchemaEvolutionDSL.js';

describe('SchemaEvolutionDSL', () => {
  let dataStore;
  let dsl;
  
  beforeEach(() => {
    // Create store with minimal initial schema
    dataStore = createDynamicDataStore({
      schema: {
        ':user/id': { unique: 'identity' }
      }
    });
    
    // Create DSL instance
    dsl = createSchemaEvolutionDSL(dataStore);
  });
  
  describe('Entity Definition DSL', () => {
    it('should define entity with fluent syntax', async () => {
      // Define entity using DSL
      await dsl
        .defineEntity('product')
        .withAttribute('name', 'string')
        .withAttribute('price', 'number')
        .withAttribute('sku', { valueType: 'string', unique: 'value' })
        .indexed('name')
        .apply();
      
      // Verify schema was updated
      const schema = dataStore.schema;
      expect(schema[':product/name']).toEqual({ valueType: 'string', index: true });
      expect(schema[':product/price']).toEqual({ valueType: 'number' });
      expect(schema[':product/sku']).toEqual({ valueType: 'string', unique: 'value' });
    });
    
    it('should define entity with multiple attributes at once', async () => {
      await dsl
        .defineEntity('order')
        .withAttributes({
          orderId: { valueType: 'string', unique: 'identity' },
          total: 'number',
          status: 'string',
          date: 'instant'
        })
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':order/orderId']).toEqual({ valueType: 'string', unique: 'identity' });
      expect(schema[':order/total']).toEqual({ valueType: 'number' });
      expect(schema[':order/status']).toEqual({ valueType: 'string' });
      expect(schema[':order/date']).toEqual({ valueType: 'instant' });
    });
    
    it('should add unique constraints fluently', async () => {
      await dsl
        .defineEntity('customer')
        .withAttribute('email', 'string')
        .withAttribute('phone', 'string')
        .unique('email', 'value')
        .unique('phone', 'value')
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':customer/email']).toEqual({ valueType: 'string', unique: 'value' });
      expect(schema[':customer/phone']).toEqual({ valueType: 'string', unique: 'value' });
    });
    
    it('should define relationships with hasOne', async () => {
      // First define the target entity
      await dsl
        .defineEntity('address')
        .withAttribute('street', 'string')
        .withAttribute('city', 'string')
        .apply();
      
      // Reset for next operation
      dsl.reset();
      
      // Define entity with relationship
      await dsl
        .defineEntity('person')
        .withAttribute('name', 'string')
        .hasOne('address', 'address')
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':person/address']).toEqual({ 
        valueType: 'ref',
        refTarget: 'address'
      });
    });
    
    it('should define relationships with hasMany', async () => {
      // Define order entity
      await dsl
        .defineEntity('order')
        .withAttribute('orderId', 'string')
        .apply();
      
      dsl.reset();
      
      // Define customer with many orders
      await dsl
        .defineEntity('customer')
        .withAttribute('name', 'string')
        .hasMany('orders', 'order')
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':customer/orders']).toEqual({
        valueType: 'ref',
        refTarget: 'order',
        cardinality: 'many'
      });
    });
  });
  
  describe('Entity Alteration DSL', () => {
    beforeEach(async () => {
      // Add a product entity to alter
      await dataStore.addEntityType('product', {
        'name': { valueType: 'string' },
        'price': { valueType: 'number' }
      });
    });
    
    it('should add attributes to existing entity', async () => {
      await dsl
        .alterEntity('product')
        .addAttribute('description', 'string')
        .addAttribute('stock', { valueType: 'number', default: 0 })
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':product/description']).toEqual({ valueType: 'string' });
      expect(schema[':product/stock']).toEqual({ valueType: 'number', default: 0 });
    });
    
    it('should remove attributes from existing entity', async () => {
      await dsl
        .alterEntity('product')
        .removeAttribute('price', true)
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':product/price']).toBeUndefined();
      expect(schema[':product/name']).toBeDefined();
    });
    
    it('should rename attributes', async () => {
      await dsl
        .alterEntity('product')
        .renameAttribute('price', 'cost')
        .apply();
      
      // Note: Rename would need implementation in SchemaEvolution
      // This test shows the DSL syntax
      expect(dsl.operations[0].modifications[0]).toEqual({
        type: 'rename',
        oldName: 'price',
        newName: 'cost'
      });
    });
    
    it('should change attribute types', async () => {
      await dsl
        .alterEntity('product')
        .changeType('price', 'string', (value) => value.toString())
        .apply();
      
      // Note: Type change would need implementation in SchemaEvolution
      // This test shows the DSL syntax
      expect(dsl.operations[0].modifications[0]).toEqual({
        type: 'changeType',
        name: 'price',
        newType: 'string',
        transformer: expect.any(Function)
      });
    });
  });
  
  describe('Batch Operations', () => {
    it('should chain multiple entity definitions', async () => {
      const result = await dsl
        .defineEntity('category')
        .withAttribute('name', 'string')
        .withAttribute('parentId', 'ref')
        .defineEntity('tag')
        .withAttribute('label', 'string')
        .unique('label', 'value')
        .apply();
      
      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(2);
      
      const schema = dataStore.schema;
      expect(schema[':category/name']).toBeDefined();
      expect(schema[':tag/label']).toBeDefined();
    });
    
    it('should mix definition and alteration operations', async () => {
      // Add initial entity
      await dataStore.addEntityType('product', {
        ':product/name': { valueType: 'string' }
      });
      
      // Apply mixed operations
      await dsl
        .alterEntity('product')
        .addAttribute('price', 'number')
        .defineEntity('review')
        .withAttribute('rating', 'number')
        .withAttribute('comment', 'string')
        .hasOne('product', 'product')
        .apply();
      
      const schema = dataStore.schema;
      expect(schema[':product/price']).toBeDefined();
      expect(schema[':review/rating']).toBeDefined();
      expect(schema[':review/product']).toBeDefined();
    });
  });
  
  describe('Validation and Preview', () => {
    it('should validate operations before applying', async () => {
      const validation = await dsl
        .defineEntity('item')
        .withAttribute('name', 'string')
        .validate();
      
      expect(validation.valid).toBe(true);
      expect(validation.results).toHaveLength(1);
      expect(validation.results[0].operation).toBe('defineEntity');
    });
    
    it('should detect invalid operations', async () => {
      const validation = await dsl
        .alterEntity('nonexistent')
        .addAttribute('field', 'string')
        .validate();
      
      expect(validation.valid).toBe(false);
      expect(validation.results[0].errors).toContain(
        'Entity type nonexistent does not exist'
      );
    });
    
    it('should preview operations without applying', () => {
      const preview = dsl
        .defineEntity('item')
        .withAttribute('name', 'string')
        .withAttribute('price', 'number')
        .indexed('name')
        .preview();
      
      expect(preview.operations).toHaveLength(1);
      expect(preview.operations[0]).toEqual({
        type: 'defineEntity',
        target: 'item',
        details: {
          attributes: 2,
          relationships: 0
        }
      });
    });
    
    it('should estimate impact of operations', () => {
      const preview = dsl
        .defineEntity('item')
        .withAttribute('name', 'string')
        .withAttribute('price', 'number')
        .preview();
      
      expect(preview.estimatedImpact).toEqual({
        entitiesAffected: 0,
        attributesAdded: 2,
        attributesRemoved: 0
      });
    });
  });
  
  describe('Custom Migrations', () => {
    it('should support custom migration functions', async () => {
      let migrationRan = false;
      
      await dsl
        .migrate('add-timestamps', async (store) => {
          // Custom migration logic
          migrationRan = true;
          return { success: true, message: 'Timestamps added' };
        })
        .apply();
      
      expect(migrationRan).toBe(true);
    });
    
    it('should support data transformation', async () => {
      // Add entity with data
      await dataStore.addEntityType('item', {
        ':item/name': { valueType: 'string' },
        ':item/price': { valueType: 'number' }
      });
      
      // Create some items
      dataStore.createEntity({
        ':item/name': 'Widget',
        ':item/price': 100
      });
      
      // Transform data
      await dsl
        .transformData('item', async (entity) => {
          // Add 10% to all prices
          if (entity[':item/price']) {
            entity[':item/price'] = entity[':item/price'] * 1.1;
          }
          return entity;
        })
        .apply();
      
      // Verify transformation (would need to query)
      expect(dsl.operations[0].type).toBe('dataTransform');
    });
  });
  
  describe('Configuration', () => {
    it('should configure validation behavior', async () => {
      // Disable validation
      dsl.configure({ validateBeforeApply: false });
      
      // This would normally fail validation but should apply
      await dsl
        .defineEntity('test')
        .withAttribute('field', 'string')
        .apply();
      
      expect(dataStore.schema[':test/field']).toBeDefined();
    });
    
    it('should configure rollback behavior', () => {
      dsl.configure({ rollbackOnError: false });
      expect(dsl.options.rollbackOnError).toBe(false);
    });
    
    it('should configure notification behavior', () => {
      dsl.configure({ notifyChanges: false });
      expect(dsl.options.notifyChanges).toBe(false);
    });
  });
  
  describe('Drop Operations', () => {
    it('should drop entity types', async () => {
      // Add entity
      await dataStore.addEntityType('temporary', {
        ':temporary/field': { valueType: 'string' }
      });
      
      // Drop it
      await dsl.dropEntity('temporary', true).apply();
      
      // Verify it's gone
      const schema = dataStore.schema;
      expect(schema[':temporary/field']).toBeUndefined();
    });
    
    it('should warn about cascading drops', async () => {
      // Add entity with data
      await dataStore.addEntityType('important', {
        ':important/data': { valueType: 'string' }
      });
      
      dataStore.createEntity({
        ':important/data': 'valuable'
      });
      
      // Validate drop without cascade
      const validation = await dsl
        .dropEntity('important', false)
        .validate();
      
      // Should have warning about existing data
      expect(validation.results[0].warnings).toBeDefined();
    });
  });
  
  describe('Fluent Chaining', () => {
    it('should reset DSL state', () => {
      dsl
        .defineEntity('test')
        .withAttribute('field', 'string')
        .reset();
      
      expect(dsl.operations).toHaveLength(0);
      expect(dsl.currentOperation).toBeNull();
    });
    
    it('should maintain fluent interface throughout', async () => {
      const result = await dsl
        .configure({ validateBeforeApply: true })
        .defineEntity('fluent')
        .withAttribute('test', 'string')
        .indexed('test')
        .unique('test', 'value')
        .reset()
        .defineEntity('another')
        .withAttribute('field', 'number')
        .apply();
      
      expect(result.success).toBe(true);
      expect(dataStore.schema[':another/field']).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should throw if withAttribute called without defineEntity', () => {
      expect(() => {
        dsl.withAttribute('field', 'string');
      }).toThrow('withAttribute must be called after defineEntity');
    });
    
    it('should throw if unique called without defineEntity', () => {
      expect(() => {
        dsl.unique('field', 'value');
      }).toThrow('unique must be called after defineEntity');
    });
    
    it('should throw if addAttribute called without alterEntity', () => {
      expect(() => {
        dsl.addAttribute('field', 'string');
      }).toThrow('addAttribute must be called after alterEntity');
    });
    
    it('should throw on validation failure when configured', async () => {
      dsl.configure({ validateBeforeApply: true });
      
      await expect(
        dsl
          .alterEntity('nonexistent')
          .addAttribute('field', 'string')
          .apply()
      ).rejects.toThrow('Validation failed');
    });
  });
  
  describe('Complex Schema Evolution Scenario', () => {
    it('should handle complete e-commerce schema evolution', async () => {
      // Phase 1: Initial schema
      await dsl
        .defineEntity('customer')
        .withAttributes({
          email: { valueType: 'string', unique: 'value' },
          name: 'string',
          createdAt: 'instant'
        })
        .defineEntity('item')
        .withAttributes({
          sku: { valueType: 'string', unique: 'value' },
          name: 'string',
          price: 'number',
          stock: 'number'
        })
        .indexed('name')
        .apply();
      
      // Reset for phase 2
      dsl.reset();
      
      // Phase 2: Add order system
      await dsl
        .defineEntity('order')
        .withAttribute('orderId', { valueType: 'string', unique: 'identity' })
        .withAttribute('total', 'number')
        .withAttribute('status', 'string')
        .hasOne('customer', 'customer')
        .defineEntity('orderItem')
        .withAttribute('quantity', 'number')
        .withAttribute('price', 'number')
        .hasOne('order', 'order')
        .hasOne('product', 'item')
        .apply();
      
      // Reset for phase 3
      dsl.reset();
      
      // Phase 3: Add reviews and categories
      await dsl
        .defineEntity('review')
        .withAttribute('rating', 'number')
        .withAttribute('comment', 'string')
        .withAttribute('createdAt', 'instant')
        .hasOne('product', 'item')
        .hasOne('author', 'customer')
        .alterEntity('item')
        .addAttribute('category', 'string')
        .addAttribute('description', 'string')
        .apply();
      
      // Verify complete schema
      const schema = dataStore.schema;
      
      // Customer entity
      expect(schema[':customer/email']).toBeDefined();
      expect(schema[':customer/name']).toBeDefined();
      
      // Item entity with additions
      expect(schema[':item/sku']).toBeDefined();
      expect(schema[':item/category']).toBeDefined();
      expect(schema[':item/description']).toBeDefined();
      
      // Order system
      expect(schema[':order/orderId']).toBeDefined();
      expect(schema[':order/customer']).toBeDefined();
      expect(schema[':orderItem/order']).toBeDefined();
      expect(schema[':orderItem/product']).toBeDefined();
      
      // Review system
      expect(schema[':review/rating']).toBeDefined();
      expect(schema[':review/product']).toBeDefined();
      expect(schema[':review/author']).toBeDefined();
    });
  });
});