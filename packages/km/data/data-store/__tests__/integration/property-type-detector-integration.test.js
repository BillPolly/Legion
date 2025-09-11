/**
 * PropertyTypeDetector Integration Tests
 * Phase 1, Step 1.4: Property Type Detection
 * 
 * Integration tests demonstrating PropertyTypeDetector working with real DataStore
 * schemas and actual entity data to verify property type detection works correctly
 * with real-world schema configurations.
 * 
 * No mocks - using real DataStore, schema configurations, and entity data
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { PropertyTypeDetector } from '../../src/property-type-detector.js';
import { DataStore } from '../../src/store.js';

describe('PropertyTypeDetector Integration Tests', () => {
  let detector;
  let store;
  let schema;
  
  beforeEach(async () => {
    // Real comprehensive schema for integration testing
    schema = {
      // User entity attributes
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/email': { valueType: 'string', unique: 'value' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/verified': { valueType: 'boolean' },
      ':user/created-at': { valueType: 'instant' },
      ':user/score': { valueType: 'number' },
      ':user/tags': { valueType: 'string', card: 'many' },
      ':user/profile': { valueType: 'ref' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':user/address': { valueType: 'ref', component: true },
      
      // Post entity attributes
      ':post/id': { valueType: 'string', unique: 'identity' },
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/published': { valueType: 'boolean' },
      ':post/view-count': { valueType: 'number' },
      ':post/rating': { valueType: 'number' },
      ':post/published-at': { valueType: 'instant' },
      ':post/author': { valueType: 'ref' },
      ':post/tags': { valueType: 'ref', card: 'many' },
      ':post/comments': { valueType: 'ref', card: 'many', component: true },
      
      // Profile entity attributes  
      ':profile/bio': { valueType: 'string' },
      ':profile/website': { valueType: 'string' },
      ':profile/avatar-url': { valueType: 'string' },
      
      // Address entity attributes
      ':address/street': { valueType: 'string' },
      ':address/city': { valueType: 'string' },
      ':address/state': { valueType: 'string' },
      ':address/zip': { valueType: 'string' },
      ':address/country': { valueType: 'string' },
      
      // Tag entity attributes
      ':tag/id': { valueType: 'string', unique: 'identity' },
      ':tag/name': { valueType: 'string', unique: 'value' },
      ':tag/color': { valueType: 'string' },
      ':tag/posts': { valueType: 'ref', card: 'many' }, // Back-reference
      
      // Comment entity attributes
      ':comment/id': { valueType: 'string', unique: 'identity' },
      ':comment/text': { valueType: 'string' },
      ':comment/created-at': { valueType: 'instant' },
      ':comment/author': { valueType: 'ref' },
      ':comment/post': { valueType: 'ref' }
    };
    
    store = new DataStore(schema);
    detector = new PropertyTypeDetector(schema);
  });
  
  afterEach(() => {
    detector = null;
    store = null;
  });

  describe('Real Schema Integration', () => {
    test('should work correctly with DataStore schema', () => {
      expect(detector.schema).toBe(schema);
      expect(store.schema).toEqual(schema); // DataStore might make a copy
      
      // Verify both schemas have the same content
      expect(detector.schema).toEqual(store.schema);
    });
    
    test('should detect proxy types for all user attributes correctly', () => {
      // Scalar attributes -> StreamProxy
      expect(detector.detectProxyType(':user/id')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/email')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/name')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/age')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/verified')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/created-at')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/score')).toBe('StreamProxy');
      
      // Many scalar attributes -> CollectionProxy
      expect(detector.detectProxyType(':user/tags')).toBe('CollectionProxy');
      
      // Single reference -> EntityProxy
      expect(detector.detectProxyType(':user/profile')).toBe('EntityProxy');
      expect(detector.detectProxyType(':user/address')).toBe('EntityProxy');
      
      // Many references -> CollectionProxy
      expect(detector.detectProxyType(':user/friends')).toBe('CollectionProxy');
    });
    
    test('should detect proxy types for all post attributes correctly', () => {
      // Scalar attributes
      expect(detector.detectProxyType(':post/id')).toBe('StreamProxy');
      expect(detector.detectProxyType(':post/title')).toBe('StreamProxy');
      expect(detector.detectProxyType(':post/content')).toBe('StreamProxy');
      expect(detector.detectProxyType(':post/published')).toBe('StreamProxy');
      expect(detector.detectProxyType(':post/view-count')).toBe('StreamProxy');
      expect(detector.detectProxyType(':post/rating')).toBe('StreamProxy');
      expect(detector.detectProxyType(':post/published-at')).toBe('StreamProxy');
      
      // Single reference
      expect(detector.detectProxyType(':post/author')).toBe('EntityProxy');
      
      // Many references
      expect(detector.detectProxyType(':post/tags')).toBe('CollectionProxy');
      expect(detector.detectProxyType(':post/comments')).toBe('CollectionProxy');
    });
  });

  describe('Component Relationship Detection', () => {
    test('should correctly identify component vs non-component references', () => {
      // Component references (owned relationships)
      expect(detector.isComponentAttribute(':user/address')).toBe(true);
      expect(detector.isComponentAttribute(':post/comments')).toBe(true);
      
      // Non-component references (shared relationships)
      expect(detector.isComponentAttribute(':user/profile')).toBe(false);
      expect(detector.isComponentAttribute(':user/friends')).toBe(false);
      expect(detector.isComponentAttribute(':post/author')).toBe(false);
      expect(detector.isComponentAttribute(':post/tags')).toBe(false);
      
      // Both component types still return appropriate proxy types
      expect(detector.detectProxyType(':user/address')).toBe('EntityProxy'); // Single component
      expect(detector.detectProxyType(':post/comments')).toBe('CollectionProxy'); // Many components
    });
  });

  describe('Unique Attribute Handling', () => {
    test('should correctly identify unique vs non-unique attributes', () => {
      // Identity unique attributes
      expect(detector.isUniqueAttribute(':user/id')).toBe(true);
      expect(detector.isUniqueAttribute(':post/id')).toBe(true);
      expect(detector.isUniqueAttribute(':tag/id')).toBe(true);
      expect(detector.isUniqueAttribute(':comment/id')).toBe(true);
      
      // Value unique attributes  
      expect(detector.isUniqueAttribute(':user/email')).toBe(true);
      expect(detector.isUniqueAttribute(':tag/name')).toBe(true);
      
      // Non-unique attributes
      expect(detector.isUniqueAttribute(':user/name')).toBe(false);
      expect(detector.isUniqueAttribute(':post/title')).toBe(false);
      expect(detector.isUniqueAttribute(':user/age')).toBe(false);
      
      // Unique attributes still return StreamProxy (they're scalars)
      expect(detector.detectProxyType(':user/id')).toBe('StreamProxy');
      expect(detector.detectProxyType(':user/email')).toBe('StreamProxy');
      expect(detector.detectProxyType(':tag/name')).toBe('StreamProxy');
    });
  });

  describe('Comprehensive Attribute Analysis', () => {
    test('should provide complete analysis for complex user entity', () => {
      const userAnalysis = {
        name: detector.analyzeAttribute(':user/name'),
        age: detector.analyzeAttribute(':user/age'),
        verified: detector.analyzeAttribute(':user/verified'),
        tags: detector.analyzeAttribute(':user/tags'),
        profile: detector.analyzeAttribute(':user/profile'),
        friends: detector.analyzeAttribute(':user/friends'),
        address: detector.analyzeAttribute(':user/address'),
        id: detector.analyzeAttribute(':user/id'),
        email: detector.analyzeAttribute(':user/email')
      };
      
      // Scalar string attribute
      expect(userAnalysis.name).toEqual({
        attribute: ':user/name',
        valueType: 'string',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
      
      // Scalar number attribute
      expect(userAnalysis.age).toEqual({
        attribute: ':user/age',
        valueType: 'number',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
      
      // Scalar boolean attribute
      expect(userAnalysis.verified).toEqual({
        attribute: ':user/verified',
        valueType: 'boolean',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
      
      // Many scalar attribute
      expect(userAnalysis.tags).toEqual({
        attribute: ':user/tags',
        valueType: 'string',
        cardinality: 'many',
        isReference: false,
        isScalar: true,
        isMany: true,
        isUnique: false,
        isComponent: false,
        proxyType: 'CollectionProxy'
      });
      
      // Single reference attribute
      expect(userAnalysis.profile).toEqual({
        attribute: ':user/profile',
        valueType: 'ref',
        cardinality: 'one',
        isReference: true,
        isScalar: false,
        isMany: false,
        isUnique: false,
        isComponent: false,
        proxyType: 'EntityProxy'
      });
      
      // Many reference attribute
      expect(userAnalysis.friends).toEqual({
        attribute: ':user/friends',
        valueType: 'ref',
        cardinality: 'many',
        isReference: true,
        isScalar: false,
        isMany: true,
        isUnique: false,
        isComponent: false,
        proxyType: 'CollectionProxy'
      });
      
      // Component reference attribute
      expect(userAnalysis.address).toEqual({
        attribute: ':user/address',
        valueType: 'ref',
        cardinality: 'one',
        isReference: true,
        isScalar: false,
        isMany: false,
        isUnique: false,
        isComponent: true,
        proxyType: 'EntityProxy'
      });
      
      // Unique identity attribute
      expect(userAnalysis.id).toEqual({
        attribute: ':user/id',
        valueType: 'string',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: true,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
      
      // Unique value attribute
      expect(userAnalysis.email).toEqual({
        attribute: ':user/email',
        valueType: 'string',
        cardinality: 'one',
        isReference: false,
        isScalar: true,
        isMany: false,
        isUnique: true,
        isComponent: false,
        proxyType: 'StreamProxy'
      });
    });
  });

  describe('Back-Reference Handling', () => {
    test('should handle bidirectional relationships correctly', () => {
      // Forward references
      expect(detector.detectProxyType(':post/tags')).toBe('CollectionProxy');
      expect(detector.detectProxyType(':post/author')).toBe('EntityProxy');
      expect(detector.detectProxyType(':comment/post')).toBe('EntityProxy');
      expect(detector.detectProxyType(':comment/author')).toBe('EntityProxy');
      
      // Back-references  
      expect(detector.detectProxyType(':tag/posts')).toBe('CollectionProxy');
      
      // Both directions should have consistent cardinality analysis
      expect(detector.isManyAttribute(':post/tags')).toBe(true);
      expect(detector.isManyAttribute(':tag/posts')).toBe(true);
      
      expect(detector.isReferenceAttribute(':post/tags')).toBe(true);
      expect(detector.isReferenceAttribute(':tag/posts')).toBe(true);
    });
  });

  describe('DataStore Schema Evolution Integration', () => {
    test('should handle schema updates during runtime', () => {
      const initialSchema = { ':test/attr': { valueType: 'string' } };
      let dynamicDetector = new PropertyTypeDetector(initialSchema);
      
      expect(dynamicDetector.detectProxyType(':test/attr')).toBe('StreamProxy');
      expect(dynamicDetector.detectProxyType(':unknown/attr')).toBe('StreamProxy');
      
      // Simulate schema evolution by creating new detector with expanded schema
      const expandedSchema = {
        ...initialSchema,
        ':test/ref': { valueType: 'ref' },
        ':test/many-refs': { valueType: 'ref', card: 'many' },
        ':test/many-scalars': { valueType: 'string', card: 'many' }
      };
      
      dynamicDetector = new PropertyTypeDetector(expandedSchema);
      
      // Original attribute still works
      expect(dynamicDetector.detectProxyType(':test/attr')).toBe('StreamProxy');
      
      // New attributes work correctly  
      expect(dynamicDetector.detectProxyType(':test/ref')).toBe('EntityProxy');
      expect(dynamicDetector.detectProxyType(':test/many-refs')).toBe('CollectionProxy');
      expect(dynamicDetector.detectProxyType(':test/many-scalars')).toBe('CollectionProxy');
      
      // Unknown attributes still default to StreamProxy
      expect(dynamicDetector.detectProxyType(':unknown/attr')).toBe('StreamProxy');
    });
  });

  describe('Real-World Schema Patterns', () => {
    test('should handle complex e-commerce style schema', () => {
      const ecommerceSchema = {
        // Customer
        ':customer/id': { valueType: 'string', unique: 'identity' },
        ':customer/email': { valueType: 'string', unique: 'value' },
        ':customer/name': { valueType: 'string' },
        ':customer/addresses': { valueType: 'ref', card: 'many', component: true },
        ':customer/orders': { valueType: 'ref', card: 'many' },
        
        // Order
        ':order/id': { valueType: 'string', unique: 'identity' },
        ':order/total': { valueType: 'number' },
        ':order/placed-at': { valueType: 'instant' },
        ':order/customer': { valueType: 'ref' },
        ':order/items': { valueType: 'ref', card: 'many', component: true },
        ':order/status': { valueType: 'string' },
        
        // Product
        ':product/id': { valueType: 'string', unique: 'identity' },
        ':product/name': { valueType: 'string' },
        ':product/price': { valueType: 'number' },
        ':product/in-stock': { valueType: 'boolean' },
        ':product/categories': { valueType: 'ref', card: 'many' },
        
        // Order Item
        ':item/quantity': { valueType: 'number' },
        ':item/unit-price': { valueType: 'number' },
        ':item/product': { valueType: 'ref' }
      };
      
      const ecommerceDetector = new PropertyTypeDetector(ecommerceSchema);
      
      // Customer analysis
      expect(ecommerceDetector.detectProxyType(':customer/id')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':customer/email')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':customer/name')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':customer/addresses')).toBe('CollectionProxy');
      expect(ecommerceDetector.detectProxyType(':customer/orders')).toBe('CollectionProxy');
      
      // Order analysis
      expect(ecommerceDetector.detectProxyType(':order/id')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':order/total')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':order/placed-at')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':order/customer')).toBe('EntityProxy');
      expect(ecommerceDetector.detectProxyType(':order/items')).toBe('CollectionProxy');
      expect(ecommerceDetector.detectProxyType(':order/status')).toBe('StreamProxy');
      
      // Product analysis
      expect(ecommerceDetector.detectProxyType(':product/id')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':product/name')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':product/price')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':product/in-stock')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':product/categories')).toBe('CollectionProxy');
      
      // Order Item analysis
      expect(ecommerceDetector.detectProxyType(':item/quantity')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':item/unit-price')).toBe('StreamProxy');
      expect(ecommerceDetector.detectProxyType(':item/product')).toBe('EntityProxy');
      
      // Component relationship verification
      expect(ecommerceDetector.isComponentAttribute(':customer/addresses')).toBe(true);
      expect(ecommerceDetector.isComponentAttribute(':order/items')).toBe(true);
      expect(ecommerceDetector.isComponentAttribute(':customer/orders')).toBe(false);
      expect(ecommerceDetector.isComponentAttribute(':product/categories')).toBe(false);
    });
    
    test('should handle social media style schema', () => {
      const socialSchema = {
        ':user/handle': { valueType: 'string', unique: 'value' },
        ':user/display-name': { valueType: 'string' },
        ':user/follower-count': { valueType: 'number' },
        ':user/following': { valueType: 'ref', card: 'many' },
        ':user/followers': { valueType: 'ref', card: 'many' },
        ':user/posts': { valueType: 'ref', card: 'many' },
        
        ':post/text': { valueType: 'string' },
        ':post/like-count': { valueType: 'number' },
        ':post/created-at': { valueType: 'instant' },
        ':post/author': { valueType: 'ref' },
        ':post/mentions': { valueType: 'ref', card: 'many' },
        ':post/hashtags': { valueType: 'string', card: 'many' },
        ':post/replies': { valueType: 'ref', card: 'many', component: true }
      };
      
      const socialDetector = new PropertyTypeDetector(socialSchema);
      
      // Many-to-many relationships
      expect(socialDetector.detectProxyType(':user/following')).toBe('CollectionProxy');
      expect(socialDetector.detectProxyType(':user/followers')).toBe('CollectionProxy');
      
      // One-to-many relationships
      expect(socialDetector.detectProxyType(':user/posts')).toBe('CollectionProxy');
      expect(socialDetector.detectProxyType(':post/author')).toBe('EntityProxy');
      
      // Many scalar values
      expect(socialDetector.detectProxyType(':post/hashtags')).toBe('CollectionProxy');
      
      // Component relationships (owned by parent)
      expect(socialDetector.detectProxyType(':post/replies')).toBe('CollectionProxy');
      expect(socialDetector.isComponentAttribute(':post/replies')).toBe(true);
    });
  });

  describe('Performance with Real Schemas', () => {
    test('should handle large schemas efficiently', () => {
      const largeSchema = {};
      
      // Create realistic large schema (500 entity types x 10 attributes = 5000 total)
      for (let entityNum = 0; entityNum < 500; entityNum++) {
        const entityName = `entity${entityNum}`;
        
        largeSchema[`:${entityName}/id`] = { valueType: 'string', unique: 'identity' };
        largeSchema[`:${entityName}/name`] = { valueType: 'string' };
        largeSchema[`:${entityName}/description`] = { valueType: 'string' };
        largeSchema[`:${entityName}/created-at`] = { valueType: 'instant' };
        largeSchema[`:${entityName}/active`] = { valueType: 'boolean' };
        largeSchema[`:${entityName}/tags`] = { valueType: 'string', card: 'many' };
        largeSchema[`:${entityName}/parent`] = { valueType: 'ref' };
        largeSchema[`:${entityName}/children`] = { valueType: 'ref', card: 'many' };
        largeSchema[`:${entityName}/related`] = { valueType: 'ref', card: 'many' };
        largeSchema[`:${entityName}/metadata`] = { valueType: 'ref', component: true };
      }
      
      const largeDetector = new PropertyTypeDetector(largeSchema);
      
      const startTime = Date.now();
      
      // Test detection performance across different entities
      for (let i = 0; i < 100; i++) {
        const entityName = `entity${i}`;
        
        expect(largeDetector.detectProxyType(`:${entityName}/id`)).toBe('StreamProxy');
        expect(largeDetector.detectProxyType(`:${entityName}/name`)).toBe('StreamProxy');
        expect(largeDetector.detectProxyType(`:${entityName}/active`)).toBe('StreamProxy');
        expect(largeDetector.detectProxyType(`:${entityName}/tags`)).toBe('CollectionProxy');
        expect(largeDetector.detectProxyType(`:${entityName}/parent`)).toBe('EntityProxy');
        expect(largeDetector.detectProxyType(`:${entityName}/children`)).toBe('CollectionProxy');
        expect(largeDetector.detectProxyType(`:${entityName}/metadata`)).toBe('EntityProxy');
      }
      
      const endTime = Date.now();
      
      // Should complete quickly even with large schema (< 50ms for 700 detections)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Error Handling in Integration Context', () => {
    test('should gracefully handle schema inconsistencies', () => {
      const inconsistentSchema = {
        ':valid/attr': { valueType: 'string' },
        ':malformed/attr1': null,
        ':malformed/attr2': 'not-an-object',
        ':malformed/attr3': { valueType: 'invalid-type' },
        ':malformed/attr4': { card: 'invalid-card' },
        ':partial/attr': { valueType: 'ref' } // Missing card defaults to 'one'
      };
      
      const inconsistentDetector = new PropertyTypeDetector(inconsistentSchema);
      
      // Should not throw errors, just use defaults
      expect(() => {
        inconsistentDetector.detectProxyType(':valid/attr');
        inconsistentDetector.detectProxyType(':malformed/attr1');
        inconsistentDetector.detectProxyType(':malformed/attr2');
        inconsistentDetector.detectProxyType(':malformed/attr3');
        inconsistentDetector.detectProxyType(':malformed/attr4');
        inconsistentDetector.detectProxyType(':partial/attr');
        inconsistentDetector.detectProxyType(':unknown/attr');
      }).not.toThrow();
      
      // Verify reasonable defaults
      expect(inconsistentDetector.detectProxyType(':valid/attr')).toBe('StreamProxy');
      expect(inconsistentDetector.detectProxyType(':malformed/attr1')).toBe('StreamProxy');
      expect(inconsistentDetector.detectProxyType(':malformed/attr2')).toBe('StreamProxy');
      expect(inconsistentDetector.detectProxyType(':partial/attr')).toBe('EntityProxy');
      expect(inconsistentDetector.detectProxyType(':unknown/attr')).toBe('StreamProxy');
    });
  });
});