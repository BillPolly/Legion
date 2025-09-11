/**
 * DataStoreProxy Integration Tests
 * Phase 3, Step 3.4: DataStoreProxy Integration
 * 
 * Integration tests for DataStoreProxy with real DataStore instances,
 * testing complex scenarios and proxy interactions.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { DataStoreProxy } from '../../src/datastore-proxy.js';
import { DataStore } from '../../src/store.js';
import { StreamProxy } from '../../src/stream-proxy.js';
import { EntityProxy } from '../../src/proxy.js';
import { CollectionProxy } from '../../src/collection-proxy.js';

describe('DataStoreProxy Integration Tests', () => {
  let store;
  let proxyStore;
  
  beforeEach(() => {
    // Complex schema with multiple entity types and relationships
    const schema = {
      // User entity
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/email': { valueType: 'string', unique: 'identity' },
      ':user/age': { valueType: 'number' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':user/posts': { valueType: 'ref', card: 'many' },
      
      // Post entity
      ':post/id': { valueType: 'string', unique: 'identity' },
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/author': { valueType: 'ref' },
      ':post/tags': { valueType: 'string', card: 'many' },
      ':post/comments': { valueType: 'ref', card: 'many' },
      
      // Comment entity
      ':comment/id': { valueType: 'string', unique: 'identity' },
      ':comment/text': { valueType: 'string' },
      ':comment/author': { valueType: 'ref' },
      ':comment/post': { valueType: 'ref' }
    };
    
    store = new DataStore(schema);
    proxyStore = new DataStoreProxy(store);
  });

  describe('Complex Entity Creation and Querying', () => {
    test('should handle complex entity relationships through proxies', () => {
      // Create users
      const users = proxyStore.createEntities([
        { ':user/id': 'u1', ':user/name': 'Alice', ':user/email': 'alice@example.com', ':user/age': 30 },
        { ':user/id': 'u2', ':user/name': 'Bob', ':user/email': 'bob@example.com', ':user/age': 25 },
        { ':user/id': 'u3', ':user/name': 'Charlie', ':user/email': 'charlie@example.com', ':user/age': 35 }
      ]);
      
      const [aliceId, bobId, charlieId] = users.entityIds;
      
      // Create posts with authors
      const posts = proxyStore.createEntities([
        { ':post/id': 'p1', ':post/title': 'First Post', ':post/content': 'Hello world!', ':post/author': aliceId, ':post/tags': ['intro', 'hello'] },
        { ':post/id': 'p2', ':post/title': 'Second Post', ':post/content': 'More content', ':post/author': bobId, ':post/tags': ['tech', 'tutorial'] }
      ]);
      
      const [post1Id, post2Id] = posts.entityIds;
      
      // Query posts by author
      const alicePosts = proxyStore.query({
        find: ['?post'],
        where: [
          ['?post', ':post/author', aliceId]
        ]
      });
      
      expect(alicePosts).toBeInstanceOf(EntityProxy);
      expect(alicePosts.get(':post/title')).toBe('First Post');
      
      // Query all posts with authors
      const allPosts = proxyStore.query({
        find: ['?post', '?title', '?author'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/author', '?author']
        ]
      });
      
      expect(allPosts).toBeInstanceOf(CollectionProxy);
      expect(allPosts.length).toBe(2);
    });
    
    test('should handle multi-hop reference traversal', () => {
      // Create interconnected entities
      const entities = proxyStore.createEntities([
        { ':user/id': 'u1', ':user/name': 'Alice' },
        { ':user/id': 'u2', ':user/name': 'Bob' }
      ]);
      
      const [aliceId, bobId] = entities.entityIds;
      
      // Create post by Alice
      const post = proxyStore.createEntity({
        ':post/id': 'p1',
        ':post/title': 'Alice\'s Post',
        ':post/author': aliceId
      });
      
      // Create comment by Bob on Alice's post
      const comment = proxyStore.createEntity({
        ':comment/id': 'c1',
        ':comment/text': 'Great post!',
        ':comment/author': bobId,
        ':comment/post': post.entityId
      });
      
      // Query: Find all users who commented on posts by Alice
      const commenters = proxyStore.query({
        find: ['?commenter'],
        where: [
          ['?post', ':post/author', aliceId],
          ['?comment', ':comment/post', '?post'],
          ['?comment', ':comment/author', '?commenter']
        ]
      });
      
      expect(commenters).toBeInstanceOf(EntityProxy);
      expect(commenters.entityId).toBe(bobId);
      expect(commenters.get(':user/name')).toBe('Bob');
    });
  });

  describe('Proxy Type Transformations', () => {
    test('should transform between proxy types based on queries', () => {
      // Create test data
      proxyStore.createEntities([
        { ':user/id': 'u1', ':user/name': 'Alice', ':user/age': 30 },
        { ':user/id': 'u2', ':user/name': 'Bob', ':user/age': 25 },
        { ':user/id': 'u3', ':user/name': 'Charlie', ':user/age': 35 }
      ]);
      
      // CollectionProxy for all users
      const allUsers = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(allUsers).toBeInstanceOf(CollectionProxy);
      expect(allUsers.length).toBe(3);
      
      // Direct count query -> StreamProxy (aggregate)
      const userCount = proxyStore.query({
        find: [['count']],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(userCount).toBeInstanceOf(StreamProxy);
      expect(userCount.value()).toBe(3);
      
      // EntityProxy for single user
      const alice = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/id', 'u1']]
      });
      
      expect(alice).toBeInstanceOf(EntityProxy);
      expect(alice.get(':user/name')).toBe('Alice');
      
      // Property extraction -> StreamProxy
      const aliceName = proxyStore.query({
        find: ['?name'],
        where: [
          ['?e', ':user/id', 'u1'],
          ['?e', ':user/name', '?name']
        ]
      });
      
      expect(aliceName).toBeInstanceOf(StreamProxy);
      expect(aliceName.value()).toBe('Alice');
    });
  });

  describe('Reactive Updates Through Proxies', () => {
    test('should maintain consistency across proxy instances', () => {
      // Create initial user
      const user = proxyStore.createEntity({
        ':user/id': 'u1',
        ':user/name': 'Alice',
        ':user/age': 30
      });
      
      // Get multiple EntityProxy instances for the same user
      const userProxy1 = proxyStore.getProxy(user.entityId);
      const userProxy2 = proxyStore.getProxy(user.entityId);
      
      // Should be the same instance (singleton pattern)
      expect(userProxy1).toBe(userProxy2);
      
      // Values should be consistent
      expect(userProxy1.get(':user/name')).toBe('Alice');
      expect(userProxy2.get(':user/name')).toBe('Alice');
      expect(userProxy1.get(':user/age')).toBe(30);
      expect(userProxy2.get(':user/age')).toBe(30);
      
      // Query should also give same results
      const ageQuery = proxyStore.query({
        find: ['?age'],
        where: [
          ['?e', ':user/id', 'u1'],
          ['?e', ':user/age', '?age']
        ]
      });
      
      expect(ageQuery).toBeInstanceOf(StreamProxy);
      expect(ageQuery.value()).toBe(30);
    });
    
    test('should handle collection updates reactively', () => {
      // Create initial users
      proxyStore.createEntities([
        { ':user/id': 'u1', ':user/name': 'Alice', ':user/age': 30 },
        { ':user/id': 'u2', ':user/name': 'Bob', ':user/age': 25 }
      ]);
      
      // Get collection of all users
      const allUsers = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(allUsers).toBeInstanceOf(CollectionProxy);
      expect(allUsers.length).toBe(2);
      
      // Add a new user
      proxyStore.createEntity({
        ':user/id': 'u3',
        ':user/name': 'Charlie',
        ':user/age': 35
      });
      
      // Re-query should show 3 users
      const updatedUsers = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(updatedUsers.length).toBe(3);
    });
  });

  describe('Advanced Query Patterns', () => {
    test('should handle complex join queries', () => {
      // Create users with friendships included in creation
      const users = proxyStore.createEntities([
        { ':user/id': 'u1', ':user/name': 'Alice' },
        { ':user/id': 'u2', ':user/name': 'Bob' },
        { ':user/id': 'u3', ':user/name': 'Charlie' }
      ]);
      
      const [aliceId, bobId, charlieId] = users.entityIds;
      
      // Create additional entities with friend relationships
      proxyStore.createEntities([
        { ':user/id': 'u4', ':user/name': 'David', ':user/friends': [aliceId, bobId] },
        { ':user/id': 'u5', ':user/name': 'Eve', ':user/friends': [aliceId] }
      ]);
      
      // Query: Find all users who have Alice as a friend
      const aliceFans = proxyStore.query({
        find: ['?e'],
        where: [
          ['?alice', ':user/id', 'u1'],
          ['?e', ':user/friends', '?alice']
        ]
      });
      
      expect(aliceFans).toBeInstanceOf(CollectionProxy);
      expect(aliceFans.length).toBe(2); // David and Eve
      
      // Query: Find users with multiple friends
      const socialUsers = proxyStore.query({
        find: ['?e', '?name'],
        where: [
          ['?e', ':user/name', '?name'],
          ['?e', ':user/friends', '?f1'],
          ['?e', ':user/friends', '?f2']
          // Note: This will match users with at least one friend
          // (since ?f1 and ?f2 can be the same)
        ]
      });
      
      expect(socialUsers).toBeInstanceOf(CollectionProxy);
      expect(socialUsers.length).toBeGreaterThan(0);
    });
    
    test('should handle aggregation queries', () => {
      // Create users with ages
      proxyStore.createEntities([
        { ':user/id': 'u1', ':user/name': 'Alice', ':user/age': 30 },
        { ':user/id': 'u2', ':user/name': 'Bob', ':user/age': 25 },
        { ':user/id': 'u3', ':user/name': 'Charlie', ':user/age': 35 },
        { ':user/id': 'u4', ':user/name': 'Diana', ':user/age': 28 }
      ]);
      
      // Count all users
      const userCount = proxyStore.query({
        find: [['count']],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(userCount).toBeInstanceOf(StreamProxy);
      expect(userCount.value()).toBe(4);
      
      // Get all ages
      const ages = proxyStore.query({
        find: ['?age'],
        where: [['?e', ':user/age', '?age']]
      });
      
      expect(ages).toBeInstanceOf(CollectionProxy);
      expect(ages.length).toBe(4);
      
      // Manual aggregation on collection
      const ageValues = ages.value().map(([age]) => age);
      const avgAge = ageValues.reduce((sum, age) => sum + age, 0) / ageValues.length;
      expect(avgAge).toBe(29.5);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle queries on non-existent entities gracefully', () => {
      // Query for non-existent user
      const noUser = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/id', 'nonexistent']]
      });
      
      expect(noUser).toBeInstanceOf(EntityProxy);
      expect(noUser.isValid()).toBe(false);
      expect(noUser.get(':user/name')).toBeUndefined();
    });
    
    test('should handle empty database queries', () => {
      // Query on empty database
      const emptyQuery = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(emptyQuery).toBeInstanceOf(CollectionProxy);
      expect(emptyQuery.length).toBe(0);
      expect(emptyQuery.value()).toEqual([]);
    });
    
    test('should handle invalid attribute queries', () => {
      proxyStore.createEntity({
        ':user/id': 'u1',
        ':user/name': 'Alice'
      });
      
      // Query with non-existent attribute
      const invalidQuery = proxyStore.query({
        find: ['?value'],
        where: [
          ['?e', ':user/id', 'u1'],
          ['?e', ':nonexistent/attribute', '?value']
        ]
      });
      
      expect(invalidQuery).toBeInstanceOf(StreamProxy);
      expect(invalidQuery.value()).toEqual([]);
    });
  });

  describe('Performance and Caching', () => {
    test('should use singleton pattern for EntityProxy instances', () => {
      const user = proxyStore.createEntity({
        ':user/id': 'u1',
        ':user/name': 'Alice'
      });
      
      const proxy1 = proxyStore.getProxy(user.entityId);
      const proxy2 = proxyStore.getProxy(user.entityId);
      
      expect(proxy1).toBe(proxy2); // Same instance
      
      // Also through queries
      const queryProxy1 = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/id', 'u1']]
      });
      
      const queryProxy2 = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/id', 'u1']]
      });
      
      // These should also be the same instance
      expect(queryProxy1).toBe(proxy1);
      expect(queryProxy2).toBe(proxy1);
    });
    
    test('should handle large result sets efficiently', () => {
      // Create many entities
      const entities = [];
      for (let i = 0; i < 100; i++) {
        entities.push({
          ':user/id': `u${i}`,
          ':user/name': `User ${i}`,
          ':user/age': 20 + (i % 40)
        });
      }
      
      proxyStore.createEntities(entities);
      
      // Query all users
      const allUsers = proxyStore.query({
        find: ['?e'],
        where: [['?e', ':user/name', '?name']]
      });
      
      expect(allUsers).toBeInstanceOf(CollectionProxy);
      expect(allUsers.length).toBe(100);
      
      // Filter efficiently - when CollectionProxy contains EntityProxy objects
      const adults = allUsers.filter(item => {
        // Check if it's an EntityProxy
        if (item instanceof EntityProxy) {
          return item.get(':user/age') >= 30;
        }
        // If it's raw data (array), get the entity and check
        if (Array.isArray(item)) {
          const entityId = item[0];
          const proxy = proxyStore.getProxy(entityId);
          return proxy.get(':user/age') >= 30;
        }
        return false;
      });
      
      expect(adults.length).toBe(70); // 70 out of 100 have age >= 30 with the modulo pattern
    });
  });
});