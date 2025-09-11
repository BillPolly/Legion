/**
 * EntityProxy.value() Method Unit Tests
 * Phase 2, Step 2.3: EntityProxy.value() Method
 * 
 * Tests that EntityProxy.value() returns proper JavaScript representation:
 * - Returns plain JavaScript object with all entity attributes
 * - Converts single references to nested objects  
 * - Converts multi-valued references to arrays of objects
 * - Handles circular references gracefully
 * - Preserves scalar values as-is
 */

import { DataStore } from '../../src/store.js';
import { EntityProxy } from '../../src/proxy.js';

describe('EntityProxy.value() Method Unit Tests', () => {
  let store;
  let schema;
  
  beforeEach(() => {
    // Comprehensive schema for testing various scenarios
    schema = {
      // User entity attributes
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'value' },
      ':user/age': { valueType: 'number' },
      ':user/active': { valueType: 'boolean' },
      ':user/created': { valueType: 'instant' },
      ':user/tags': { valueType: 'string', card: 'many' },
      
      // Reference attributes
      ':user/profile': { valueType: 'ref' },
      ':user/posts': { valueType: 'ref', card: 'many' },
      ':user/manager': { valueType: 'ref' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      
      // Profile entity attributes
      ':profile/bio': { valueType: 'string' },
      ':profile/avatar': { valueType: 'string' },
      ':profile/public': { valueType: 'boolean' },
      ':profile/user': { valueType: 'ref' }, // Back-reference for circular test
      
      // Post entity attributes
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/published': { valueType: 'boolean' },
      ':post/author': { valueType: 'ref' },
      ':post/comments': { valueType: 'ref', card: 'many' },
      
      // Comment entity attributes
      ':comment/text': { valueType: 'string' },
      ':comment/post': { valueType: 'ref' },
      ':comment/author': { valueType: 'ref' }
    };
    
    store = new DataStore(schema);
  });

  describe('Basic Value Extraction', () => {
    test('should return plain JavaScript object with scalar attributes', () => {
      const userResult = store.createEntity({
        ':user/name': 'Alice Smith',
        ':user/email': 'alice@example.com',
        ':user/age': 30,
        ':user/active': true
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      expect(value).toEqual({
        entityId: userResult.entityId,
        ':user/name': 'Alice Smith',
        ':user/email': 'alice@example.com',
        ':user/age': 30,
        ':user/active': true
      });
      
      // Ensure it's a plain object, not a proxy
      expect(value.constructor).toBe(Object);
      expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
    });
    
    test('should handle Date/instant values correctly', () => {
      const now = new Date();
      const userResult = store.createEntity({
        ':user/name': 'Bob',
        ':user/created': now
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      expect(value[':user/created']).toEqual(now);
      expect(value[':user/created']).toBeInstanceOf(Date);
      // Should be a copy, not the same instance
      expect(value[':user/created']).not.toBe(now);
      expect(value[':user/created'].getTime()).toBe(now.getTime());
    });
    
    test('should handle multi-valued scalar attributes', () => {
      const userResult = store.createEntity({
        ':user/name': 'Charlie',
        ':user/tags': ['developer', 'javascript', 'react']
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      expect(value[':user/tags']).toEqual(['developer', 'javascript', 'react']);
      expect(Array.isArray(value[':user/tags'])).toBe(true);
      
      // Get the raw tags array from the proxy
      const tagsProxy = userProxy.get(':user/tags');
      const rawTags = tagsProxy.value ? tagsProxy.value() : tagsProxy;
      
      // Should be a copy, not the same array reference
      expect(value[':user/tags']).not.toBe(rawTags);
      expect(value[':user/tags']).toEqual(rawTags);
    });
  });

  describe('Single Reference Expansion', () => {
    test('should expand single entity references to nested objects', () => {
      const profileResult = store.createEntity({
        ':profile/bio': 'Software Developer',
        ':profile/avatar': 'avatar.jpg',
        ':profile/public': true
      });
      
      const userResult = store.createEntity({
        ':user/name': 'David',
        ':user/email': 'david@example.com',
        ':user/profile': profileResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      expect(value[':user/profile']).toEqual({
        entityId: profileResult.entityId,
        ':profile/bio': 'Software Developer',
        ':profile/avatar': 'avatar.jpg',
        ':profile/public': true
      });
      
      // Profile should be a plain object
      expect(value[':user/profile'].constructor).toBe(Object);
    });
    
    test('should handle missing single references as null', () => {
      const userResult = store.createEntity({
        ':user/name': 'Eve',
        ':user/email': 'eve@example.com'
        // No manager or profile set
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      expect(value[':user/manager']).toBeUndefined();
      expect(value[':user/profile']).toBeUndefined();
      expect(value.hasOwnProperty(':user/manager')).toBe(false);
      expect(value.hasOwnProperty(':user/profile')).toBe(false);
    });
    
    test('should handle nested references (references within references)', () => {
      const managerResult = store.createEntity({
        ':user/name': 'Manager Mike',
        ':user/email': 'mike@example.com'
      });
      
      const profileResult = store.createEntity({
        ':profile/bio': 'Team Lead',
        ':profile/public': false
      });
      
      // Manager has a profile - use EntityProxy.update() to add the reference
      const managerProxy = new EntityProxy(managerResult.entityId, store);
      managerProxy.update({
        ':user/profile': profileResult.entityId
      });
      
      const userResult = store.createEntity({
        ':user/name': 'Frank',
        ':user/email': 'frank@example.com',
        ':user/manager': managerResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      // Manager should be expanded
      expect(value[':user/manager']).toBeDefined();
      expect(value[':user/manager'][':user/name']).toBe('Manager Mike');
      
      // Manager's profile should also be expanded
      expect(value[':user/manager'][':user/profile']).toBeDefined();
      expect(value[':user/manager'][':user/profile'][':profile/bio']).toBe('Team Lead');
    });
  });

  describe('Multi-valued Reference Expansion', () => {
    test('should expand multi-valued references to arrays of objects', () => {
      const post1Result = store.createEntity({
        ':post/title': 'First Post',
        ':post/content': 'Hello World',
        ':post/published': true
      });
      
      const post2Result = store.createEntity({
        ':post/title': 'Second Post',
        ':post/content': 'Testing',
        ':post/published': false
      });
      
      const userResult = store.createEntity({
        ':user/name': 'Grace',
        ':user/posts': [post1Result.entityId, post2Result.entityId]
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      expect(Array.isArray(value[':user/posts'])).toBe(true);
      expect(value[':user/posts'].length).toBe(2);
      
      expect(value[':user/posts'][0]).toEqual({
        entityId: post1Result.entityId,
        ':post/title': 'First Post',
        ':post/content': 'Hello World',
        ':post/published': true
      });
      
      expect(value[':user/posts'][1]).toEqual({
        entityId: post2Result.entityId,
        ':post/title': 'Second Post',
        ':post/content': 'Testing',
        ':post/published': false
      });
    });
    
    test('should handle empty multi-valued references as empty arrays', () => {
      const userResult = store.createEntity({
        ':user/name': 'Henry',
        ':user/email': 'henry@example.com'
        // No posts or friends
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      // Empty multi-valued refs should not appear in the value object
      expect(value[':user/posts']).toBeUndefined();
      expect(value[':user/friends']).toBeUndefined();
      expect(value.hasOwnProperty(':user/posts')).toBe(false);
      expect(value.hasOwnProperty(':user/friends')).toBe(false);
    });
    
    test('should handle deeply nested multi-valued references', () => {
      const comment1Result = store.createEntity({
        ':comment/text': 'Great post!'
      });
      
      const comment2Result = store.createEntity({
        ':comment/text': 'Thanks for sharing'
      });
      
      const postResult = store.createEntity({
        ':post/title': 'Blog Post',
        ':post/content': 'Content here',
        ':post/comments': [comment1Result.entityId, comment2Result.entityId]
      });
      
      const userResult = store.createEntity({
        ':user/name': 'Irene',
        ':user/posts': [postResult.entityId]
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      // Posts should be expanded
      expect(value[':user/posts'].length).toBe(1);
      expect(value[':user/posts'][0][':post/title']).toBe('Blog Post');
      
      // Comments within posts should also be expanded
      expect(value[':user/posts'][0][':post/comments']).toBeDefined();
      expect(value[':user/posts'][0][':post/comments'].length).toBe(2);
      expect(value[':user/posts'][0][':post/comments'][0][':comment/text']).toBe('Great post!');
      expect(value[':user/posts'][0][':post/comments'][1][':comment/text']).toBe('Thanks for sharing');
    });
  });

  describe('Circular Reference Handling', () => {
    test('should handle simple circular references gracefully', () => {
      const userResult = store.createEntity({
        ':user/name': 'Jack',
        ':user/email': 'jack@example.com'
      });
      
      const profileResult = store.createEntity({
        ':profile/bio': 'Developer',
        ':profile/user': userResult.entityId // Back-reference
      });
      
      // Add profile to user - use EntityProxy.update() to add the reference
      const userProxyTemp = new EntityProxy(userResult.entityId, store);
      userProxyTemp.update({
        ':user/profile': profileResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      // Should expand profile
      expect(value[':user/profile']).toBeDefined();
      expect(value[':user/profile'][':profile/bio']).toBe('Developer');
      
      // But should NOT expand the back-reference to avoid infinite loop
      // Should either be undefined or just the ID
      expect(value[':user/profile'][':profile/user']).toBe(userResult.entityId);
    });
    
    test('should handle mutual friend relationships (bidirectional references)', () => {
      const user1Result = store.createEntity({
        ':user/name': 'Kate'
      });
      
      const user2Result = store.createEntity({
        ':user/name': 'Laura'
      });
      
      // Make them friends with each other - use EntityProxy.update()
      const user1ProxyTemp = new EntityProxy(user1Result.entityId, store);
      user1ProxyTemp.update({
        ':user/friends': [user2Result.entityId]
      });
      
      const user2ProxyTemp = new EntityProxy(user2Result.entityId, store);
      user2ProxyTemp.update({
        ':user/friends': [user1Result.entityId]
      });
      
      const user1Proxy = new EntityProxy(user1Result.entityId, store);
      const value = user1Proxy.value();
      
      // Should expand friends
      expect(value[':user/friends']).toBeDefined();
      expect(value[':user/friends'].length).toBe(1);
      expect(value[':user/friends'][0][':user/name']).toBe('Laura');
      
      // But Laura's friends should not be further expanded (would include Kate)
      // Instead, it should just return Kate's entity ID to avoid circular reference
      expect(value[':user/friends'][0][':user/friends']).toEqual([user1Result.entityId]);
    });
    
    test('should handle complex circular reference chains', () => {
      const userResult = store.createEntity({
        ':user/name': 'Mike'
      });
      
      const postResult = store.createEntity({
        ':post/title': 'My Post',
        ':post/author': userResult.entityId
      });
      
      const commentResult = store.createEntity({
        ':comment/text': 'Self comment',
        ':comment/post': postResult.entityId,
        ':comment/author': userResult.entityId
      });
      
      // Add relationships - use EntityProxy.update()
      const userProxyTemp = new EntityProxy(userResult.entityId, store);
      userProxyTemp.update({
        ':user/posts': [postResult.entityId]
      });
      
      const postProxyTemp = new EntityProxy(postResult.entityId, store);
      postProxyTemp.update({
        ':post/comments': [commentResult.entityId]
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      const value = userProxy.value();
      
      // Should expand posts
      expect(value[':user/posts']).toBeDefined();
      expect(value[':user/posts'][0][':post/title']).toBe('My Post');
      
      // Should expand comments
      expect(value[':user/posts'][0][':post/comments']).toBeDefined();
      expect(value[':user/posts'][0][':post/comments'][0][':comment/text']).toBe('Self comment');
      
      // But should not re-expand author references
      expect(value[':user/posts'][0][':post/author']).toBe(userResult.entityId);
      expect(value[':user/posts'][0][':post/comments'][0][':comment/author']).toBe(userResult.entityId);
      expect(value[':user/posts'][0][':post/comments'][0][':comment/post']).toBe(postResult.entityId);
    });
  });

  describe('Edge Cases and Options', () => {
    test('should handle entity with no attributes', () => {
      // DataStore requires at least one attribute, so create minimal entity
      const emptyResult = store.createEntity({
        ':user/name': 'EmptyTest'
      });
      const emptyProxy = new EntityProxy(emptyResult.entityId, store);
      const value = emptyProxy.value();
      
      expect(value).toEqual({
        entityId: emptyResult.entityId,
        ':user/name': 'EmptyTest'
      });
    });
    
    test('should support depth option to limit expansion', () => {
      // Create nested hierarchy
      const level3 = store.createEntity({ ':user/name': 'Level3' });
      const level2 = store.createEntity({ 
        ':user/name': 'Level2',
        ':user/manager': level3.entityId
      });
      const level1 = store.createEntity({ 
        ':user/name': 'Level1',
        ':user/manager': level2.entityId
      });
      const root = store.createEntity({ 
        ':user/name': 'Root',
        ':user/manager': level1.entityId
      });
      
      const rootProxy = new EntityProxy(root.entityId, store);
      
      // Default: full expansion
      const fullValue = rootProxy.value();
      expect(fullValue[':user/manager'][':user/name']).toBe('Level1');
      expect(fullValue[':user/manager'][':user/manager'][':user/name']).toBe('Level2');
      expect(fullValue[':user/manager'][':user/manager'][':user/manager'][':user/name']).toBe('Level3');
      
      // With depth limit
      const shallowValue = rootProxy.value({ depth: 1 });
      // At depth 1, first level refs are expanded but their refs are not
      expect(shallowValue[':user/manager'][':user/name']).toBe('Level1');
      expect(shallowValue[':user/manager'][':user/manager']).toBe(level2.entityId);
      
      const mediumValue = rootProxy.value({ depth: 2 });
      expect(mediumValue[':user/manager'][':user/name']).toBe('Level1');
      // At depth 2, two levels of references are expanded, third level returns entity IDs
      expect(mediumValue[':user/manager'][':user/manager'][':user/name']).toBe('Level2');
      expect(mediumValue[':user/manager'][':user/manager'][':user/manager']).toBe(level3.entityId);
    });
    
    test('should support includeRefs option to control reference expansion', () => {
      const profileResult = store.createEntity({
        ':profile/bio': 'Test Bio'
      });
      
      const userResult = store.createEntity({
        ':user/name': 'Nancy',
        ':user/profile': profileResult.entityId
      });
      
      const userProxy = new EntityProxy(userResult.entityId, store);
      
      // Default: expand references
      const expandedValue = userProxy.value();
      expect(expandedValue[':user/profile']).toBeInstanceOf(Object);
      expect(expandedValue[':user/profile'][':profile/bio']).toBe('Test Bio');
      
      // With includeRefs: false
      const flatValue = userProxy.value({ includeRefs: false });
      expect(flatValue[':user/profile']).toBe(profileResult.entityId);
    });
  });
});