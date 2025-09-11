/**
 * EntityProxy Enhanced Property Access Unit Tests
 * Phase 2, Step 2.1: Enhanced Dynamic Property Access
 * 
 * Tests for EntityProxy property getters returning appropriate proxy types:
 * - StreamProxy: For scalar attributes (string, number, boolean, instant)
 * - EntityProxy: For single reference attributes (valueType: 'ref', card: 'one' or missing)
 * - CollectionProxy: For many cardinality attributes (card: 'many') regardless of value type
 * 
 * Tests follow TDD approach - write tests first, implement after.
 * No mocks - use real DataStore, EntityProxy, and DataScript instances.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DataStore } from '../../src/store.js';
import { EntityProxy } from '../../src/proxy.js';
import { StreamProxy } from '../../src/stream-proxy.js';
import { CollectionProxy } from '../../src/collection-proxy.js';

describe('EntityProxy Enhanced Property Access Unit Tests', () => {
  let store;
  let schema;
  let user;
  let userProxy;
  
  beforeEach(async () => {
    // Comprehensive schema for testing all property types
    schema = {
      // User entity - scalar attributes (should return StreamProxy)
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'value' },
      ':user/age': { valueType: 'number' },
      ':user/verified': { valueType: 'boolean' },
      ':user/created-at': { valueType: 'instant' },
      ':user/score': { valueType: 'number' },
      
      // User entity - many scalar attributes (should return CollectionProxy)
      ':user/tags': { valueType: 'string', card: 'many' },
      ':user/interests': { valueType: 'string', card: 'many' },
      
      // User entity - single reference attributes (should return EntityProxy)
      ':user/profile': { valueType: 'ref' },
      ':user/manager': { valueType: 'ref' },
      ':user/address': { valueType: 'ref', component: true },
      
      // User entity - many reference attributes (should return CollectionProxy)
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':user/groups': { valueType: 'ref', card: 'many' },
      ':user/posts': { valueType: 'ref', card: 'many' },
      
      // Profile entity for reference testing
      ':profile/bio': { valueType: 'string' },
      ':profile/website': { valueType: 'string' },
      
      // Post entity for many reference testing
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/author': { valueType: 'ref' },
      
      // Group entity for many reference testing
      ':group/name': { valueType: 'string' },
      ':group/description': { valueType: 'string' }
    };
    
    store = new DataStore(schema);
    
    // Create test user with comprehensive data
    const userData = {
      ':user/name': 'John Doe',
      ':user/email': 'john@example.com',
      ':user/age': 30,
      ':user/verified': true,
      ':user/created-at': new Date('2023-01-01'),
      ':user/score': 85.5,
      ':user/tags': ['developer', 'javascript', 'react'],
      ':user/interests': ['coding', 'reading', 'gaming']
    };
    
    const createResult = store.createEntity(userData);
    user = createResult.entityId;
    userProxy = new EntityProxy(user, store);
  });

  describe('Scalar Attribute Property Access', () => {
    test('should return StreamProxy for string attributes', () => {
      const nameProxy = userProxy.name;
      expect(nameProxy).toBeInstanceOf(StreamProxy);
      expect(nameProxy.value()).toBe('John Doe');
    });
    
    test('should return StreamProxy for unique string attributes', () => {
      const emailProxy = userProxy.email;
      expect(emailProxy).toBeInstanceOf(StreamProxy);
      expect(emailProxy.value()).toBe('john@example.com');
    });
    
    test('should return StreamProxy for number attributes', () => {
      const ageProxy = userProxy.age;
      expect(ageProxy).toBeInstanceOf(StreamProxy);
      expect(ageProxy.value()).toBe(30);
    });
    
    test('should return StreamProxy for float/decimal number attributes', () => {
      const scoreProxy = userProxy.score;
      expect(scoreProxy).toBeInstanceOf(StreamProxy);
      expect(scoreProxy.value()).toBe(85.5);
    });
    
    test('should return StreamProxy for boolean attributes', () => {
      const verifiedProxy = userProxy.verified;
      expect(verifiedProxy).toBeInstanceOf(StreamProxy);
      expect(verifiedProxy.value()).toBe(true);
    });
    
    test('should return StreamProxy for instant (date) attributes', () => {
      const createdAtProxy = userProxy['created-at'];
      expect(createdAtProxy).toBeInstanceOf(StreamProxy);
      expect(createdAtProxy.value()).toEqual(new Date('2023-01-01'));
    });
    
    test('should return StreamProxy for undefined scalar attributes', () => {
      // Create entity without optional scalar attribute
      const minimalUser = store.createEntity({
        ':user/name': 'Jane Doe'
      });
      const minimalProxy = new EntityProxy(minimalUser.entityId, store);
      
      // Access undefined scalar attribute
      const ageProxy = minimalProxy.age;
      expect(ageProxy).toBeInstanceOf(StreamProxy);
      expect(ageProxy.value()).toBeUndefined();
    });
  });

  describe('Many Scalar Attribute Property Access', () => {
    test('should return CollectionProxy for many scalar string attributes', () => {
      const tagsProxy = userProxy.tags;
      expect(tagsProxy).toBeInstanceOf(CollectionProxy);
      
      const tagsValue = tagsProxy.value();
      expect(Array.isArray(tagsValue)).toBe(true);
      expect(tagsValue).toEqual(['developer', 'javascript', 'react']);
    });
    
    test('should return CollectionProxy for many scalar interests', () => {
      const interestsProxy = userProxy.interests;
      expect(interestsProxy).toBeInstanceOf(CollectionProxy);
      
      const interestsValue = interestsProxy.value();
      expect(Array.isArray(interestsValue)).toBe(true);
      expect(interestsValue).toEqual(expect.arrayContaining(['coding', 'reading', 'gaming']));
      expect(interestsValue).toHaveLength(3);
    });
    
    test('should return CollectionProxy for empty many scalar attributes', () => {
      // Create user without many scalar attributes
      const basicUser = store.createEntity({
        ':user/name': 'Basic User'
      });
      const basicProxy = new EntityProxy(basicUser.entityId, store);
      
      // Access undefined many scalar attribute
      const tagsProxy = basicProxy.tags;
      expect(tagsProxy).toBeInstanceOf(CollectionProxy);
      
      const tagsValue = tagsProxy.value();
      expect(Array.isArray(tagsValue)).toBe(true);
      expect(tagsValue).toEqual([]);
    });
  });

  describe('Single Reference Attribute Property Access', () => {
    test('should return EntityProxy for single reference attributes', async () => {
      // Create profile entity first
      const profileData = {
        ':profile/bio': 'Software developer passionate about clean code',
        ':profile/website': 'https://johndoe.dev'
      };
      const profileResult = store.createEntity(profileData);
      
      // Update user to reference the profile
      userProxy.update({
        ':user/profile': profileResult.entityId
      });
      
      // Access profile through property getter
      const profileProxy = userProxy.profile;
      expect(profileProxy).toBeInstanceOf(EntityProxy);
      expect(profileProxy.entityId).toBe(profileResult.entityId);
      
      // Verify we can access profile attributes
      expect(profileProxy.get(':profile/bio')).toBe('Software developer passionate about clean code');
      expect(profileProxy.get(':profile/website')).toBe('https://johndoe.dev');
    });
    
    test('should return EntityProxy for component reference attributes', async () => {
      // Create address entity
      const addressData = {
        ':address/street': '123 Main St',
        ':address/city': 'Anytown',
        ':address/zip': '12345'
      };
      const addressResult = store.createEntity(addressData);
      
      // Update user to reference the address as component
      userProxy.update({
        ':user/address': addressResult.entityId
      });
      
      // Access address through property getter
      const addressProxy = userProxy.address;
      expect(addressProxy).toBeInstanceOf(EntityProxy);
      expect(addressProxy.entityId).toBe(addressResult.entityId);
    });
    
    test('should return StreamProxy with undefined value for missing single references', () => {
      // Access undefined single reference attribute
      const managerProxy = userProxy.manager;
      expect(managerProxy).toBeInstanceOf(StreamProxy);  // Should default to StreamProxy for undefined
      expect(managerProxy.value()).toBeUndefined();
    });
  });

  describe('Many Reference Attribute Property Access', () => {
    test('should return CollectionProxy for many reference attributes', async () => {
      // Create friend entities
      const friend1Data = {
        ':user/name': 'Alice',
        ':user/email': 'alice@example.com'
      };
      const friend2Data = {
        ':user/name': 'Bob', 
        ':user/email': 'bob@example.com'
      };
      
      const friend1Result = store.createEntity(friend1Data);
      const friend2Result = store.createEntity(friend2Data);
      
      // Update user to reference friends
      userProxy.update({
        ':user/friends': [friend1Result.entityId, friend2Result.entityId]
      });
      
      // Access friends through property getter
      const friendsProxy = userProxy.friends;
      expect(friendsProxy).toBeInstanceOf(CollectionProxy);
      
      // Verify collection contents
      const friendsArray = friendsProxy.value();
      expect(Array.isArray(friendsArray)).toBe(true);
      expect(friendsArray.length).toBe(2);
      
      // Each friend should be an EntityProxy
      expect(friendsArray[0]).toBeInstanceOf(EntityProxy);
      expect(friendsArray[1]).toBeInstanceOf(EntityProxy);
      
      // Verify friend entity IDs
      expect(friendsArray[0].entityId).toBe(friend1Result.entityId);
      expect(friendsArray[1].entityId).toBe(friend2Result.entityId);
    });
    
    test('should return CollectionProxy for many reference posts', async () => {
      // Create post entities
      const post1Data = {
        ':post/title': 'First Post',
        ':post/content': 'This is my first post',
        ':post/author': user
      };
      const post2Data = {
        ':post/title': 'Second Post',
        ':post/content': 'This is my second post',
        ':post/author': user
      };
      
      const post1Result = store.createEntity(post1Data);
      const post2Result = store.createEntity(post2Data);
      
      // Update user to reference posts
      userProxy.update({
        ':user/posts': [post1Result.entityId, post2Result.entityId]
      });
      
      // Access posts through property getter
      const postsProxy = userProxy.posts;
      expect(postsProxy).toBeInstanceOf(CollectionProxy);
      
      // Verify collection contents
      const postsArray = postsProxy.value();
      expect(Array.isArray(postsArray)).toBe(true);
      expect(postsArray.length).toBe(2);
      
      // Each post should be an EntityProxy
      expect(postsArray[0]).toBeInstanceOf(EntityProxy);
      expect(postsArray[1]).toBeInstanceOf(EntityProxy);
    });
    
    test('should return CollectionProxy for empty many reference attributes', () => {
      // Access undefined many reference attribute
      const groupsProxy = userProxy.groups;
      expect(groupsProxy).toBeInstanceOf(CollectionProxy);
      
      // Should return empty array
      const groupsArray = groupsProxy.value();
      expect(Array.isArray(groupsArray)).toBe(true);
      expect(groupsArray).toEqual([]);
    });
  });

  describe('PropertyTypeDetector Integration', () => {
    test('should use PropertyTypeDetector to determine correct proxy types', () => {
      // Test that EntityProxy uses PropertyTypeDetector for dynamic properties
      // This is tested by verifying the correct proxy types are returned above
      
      // Scalar attributes should return StreamProxy
      expect(userProxy.name).toBeInstanceOf(StreamProxy);
      expect(userProxy.age).toBeInstanceOf(StreamProxy);
      expect(userProxy.verified).toBeInstanceOf(StreamProxy);
      
      // Many scalar attributes should return CollectionProxy
      expect(userProxy.tags).toBeInstanceOf(CollectionProxy);
      expect(userProxy.interests).toBeInstanceOf(CollectionProxy);
      
      // Many reference attributes should return CollectionProxy
      expect(userProxy.friends).toBeInstanceOf(CollectionProxy);
      expect(userProxy.posts).toBeInstanceOf(CollectionProxy);
      expect(userProxy.groups).toBeInstanceOf(CollectionProxy);
    });
  });

  describe('Proxy Object Behavior', () => {
    test('should support chaining query operations on returned proxies', async () => {
      const nameProxy = userProxy.name;
      expect(nameProxy).toBeInstanceOf(StreamProxy);
      
      // StreamProxy should support query method
      expect(typeof nameProxy.query).toBe('function');
      
      const tagsProxy = userProxy.tags;
      expect(tagsProxy).toBeInstanceOf(CollectionProxy);
      
      // CollectionProxy should support query method
      expect(typeof tagsProxy.query).toBe('function');
    });
    
    test('should support subscriptions on returned proxies', () => {
      const nameProxy = userProxy.name;
      expect(nameProxy).toBeInstanceOf(StreamProxy);
      
      // StreamProxy should support subscribe method
      expect(typeof nameProxy.subscribe).toBe('function');
      
      const tagsProxy = userProxy.tags;
      expect(tagsProxy).toBeInstanceOf(CollectionProxy);
      
      // CollectionProxy should support subscribe method
      expect(typeof tagsProxy.subscribe).toBe('function');
    });
    
    test('should maintain proxy identity for same property access', () => {
      const nameProxy1 = userProxy.name;
      const nameProxy2 = userProxy.name;
      
      // Should get same proxy instance for same property
      expect(nameProxy1).toBe(nameProxy2);
      
      const tagsProxy1 = userProxy.tags;
      const tagsProxy2 = userProxy.tags;
      
      // Should get same proxy instance for same property
      expect(tagsProxy1).toBe(tagsProxy2);
    });
    
    test('should invalidate property proxies when entity data changes', async () => {
      const nameProxy = userProxy.name;
      const originalValue = nameProxy.value();
      expect(originalValue).toBe('John Doe');
      
      // Update entity data
      userProxy.update({
        ':user/name': 'John Smith'
      });
      
      // Proxy should reflect updated value
      expect(nameProxy.value()).toBe('John Smith');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle unknown attributes gracefully', () => {
      // Access property that doesn't exist in schema
      const unknownProxy = userProxy.unknown;
      expect(unknownProxy).toBeInstanceOf(StreamProxy); // Should default to StreamProxy
      expect(unknownProxy.value()).toBeUndefined();
    });
    
    test('should handle invalid entity states gracefully', () => {
      // Delete the entity
      userProxy.delete();
      
      // Property access should still return proxies but with undefined values
      const nameProxy = userProxy.name;
      expect(nameProxy).toBeInstanceOf(StreamProxy);
      expect(nameProxy.value()).toBeUndefined();
    });
    
    test('should preserve existing EntityProxy methods', () => {
      // Ensure core EntityProxy methods still exist and work
      expect(typeof userProxy.get).toBe('function');
      expect(typeof userProxy.update).toBe('function');
      expect(typeof userProxy.delete).toBe('function');
      expect(typeof userProxy.query).toBe('function');
      expect(typeof userProxy.subscribe).toBe('function');
      expect(typeof userProxy.isValid).toBe('function');
      
      // Verify they still work
      expect(userProxy.get(':user/name')).toBe('John Doe');
      expect(userProxy.isValid()).toBe(true);
    });
  });

  describe('Schema-Based Property Generation', () => {
    test('should only create properties for attributes in schema', () => {
      // Properties should exist for all schema attributes
      const schemaAttributes = [
        'name', 'email', 'age', 'verified', 'created-at', 'score',
        'tags', 'interests', 'profile', 'manager', 'address',
        'friends', 'groups', 'posts'
      ];
      
      for (const attr of schemaAttributes) {
        expect(userProxy.hasOwnProperty(attr)).toBe(true);
      }
      
      // Should not create properties for non-schema attributes
      expect(userProxy.hasOwnProperty('nonExistent')).toBe(false);
    });
    
    test('should handle schema attributes with complex names correctly', () => {
      // Attribute with hyphen should become property with hyphen
      const createdAtProxy = userProxy['created-at'];
      expect(createdAtProxy).toBeInstanceOf(StreamProxy);
      expect(createdAtProxy.value()).toEqual(new Date('2023-01-01'));
    });
  });
});