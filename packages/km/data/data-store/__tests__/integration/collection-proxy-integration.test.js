/**
 * CollectionProxy Integration Tests
 * Phase 1, Step 1.2: Test CollectionProxy with real DataStore instances
 * 
 * Integration tests demonstrate:
 * - Real DataStore and DataScript integration
 * - End-to-end query execution with CollectionProxy
 * - Reactive subscriptions with actual data changes
 * - Query chaining and context binding with collections
 * - Array-like interface with real data
 * 
 * NO MOCKS - Using real DataStore and DataScript instances as per project rules
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CollectionProxy } from '../../src/collection-proxy.js';
import { DataStore } from '../../src/store.js';

describe('CollectionProxy Integration Tests', () => {
  let store;
  let schema;
  let testData;
  
  beforeEach(() => {
    // Real DataStore instance with comprehensive schema
    schema = {
      ':user/id': { valueType: 'string', unique: 'identity' },
      ':user/name': { valueType: 'string' },
      ':user/age': { valueType: 'number' },
      ':user/email': { valueType: 'string', unique: 'value' },
      ':user/verified': { valueType: 'boolean' },
      ':user/friends': { valueType: 'ref', card: 'many' },
      ':post/id': { valueType: 'string', unique: 'identity' },
      ':post/title': { valueType: 'string' },
      ':post/content': { valueType: 'string' },
      ':post/author': { valueType: 'ref' },
      ':post/likes': { valueType: 'number' },
      ':tag/name': { valueType: 'string', unique: 'identity' },
      ':post/tags': { valueType: 'ref', card: 'many' }
    };
    
    store = new DataStore(schema);
    
    // Create comprehensive test dataset
    const usersResult = store.createEntities([
      { 
        ':user/id': 'user-alice', 
        ':user/name': 'Alice', 
        ':user/age': 30, 
        ':user/email': 'alice@example.com', 
        ':user/verified': true 
      },
      { 
        ':user/id': 'user-bob', 
        ':user/name': 'Bob', 
        ':user/age': 25, 
        ':user/email': 'bob@example.com', 
        ':user/verified': false 
      },
      { 
        ':user/id': 'user-charlie', 
        ':user/name': 'Charlie', 
        ':user/age': 35, 
        ':user/email': 'charlie@example.com', 
        ':user/verified': true 
      },
      { 
        ':user/id': 'user-david', 
        ':user/name': 'David', 
        ':user/age': 28, 
        ':user/email': 'david@example.com', 
        ':user/verified': false 
      }
    ]);
    
    const aliceId = usersResult.entityIds[0];
    const bobId = usersResult.entityIds[1];
    const charlieId = usersResult.entityIds[2];
    const davidId = usersResult.entityIds[3];
    
    // Add friendship relationships using entity map format
    store.conn.transact([
      { ':db/id': aliceId, ':user/friends': [bobId, charlieId] },
      { ':db/id': bobId, ':user/friends': [charlieId, davidId] },
      { ':db/id': charlieId, ':user/friends': [davidId] }
    ]);
    
    // Create tags
    const tagsResult = store.createEntities([
      { ':tag/name': 'javascript' },
      { ':tag/name': 'react' },
      { ':tag/name': 'datascript' },
      { ':tag/name': 'node' }
    ]);
    
    // Create posts with relationships
    const postsResult = store.createEntities([
      { 
        ':post/id': 'post-1', 
        ':post/title': 'Hello DataScript', 
        ':post/content': 'Learning DataScript is fun!',
        ':post/author': aliceId,
        ':post/likes': 5,
        ':post/tags': [tagsResult.entityIds[0], tagsResult.entityIds[2]] // javascript, datascript
      },
      { 
        ':post/id': 'post-2', 
        ':post/title': 'React Components', 
        ':post/content': 'Building reusable components',
        ':post/author': bobId,
        ':post/likes': 12,
        ':post/tags': [tagsResult.entityIds[0], tagsResult.entityIds[1]] // javascript, react
      },
      { 
        ':post/id': 'post-3', 
        ':post/title': 'Advanced Patterns', 
        ':post/content': 'Deep dive into patterns',
        ':post/author': charlieId,
        ':post/likes': 8,
        ':post/tags': [tagsResult.entityIds[1]] // react
      },
      { 
        ':post/id': 'post-4', 
        ':post/title': 'Node.js Basics', 
        ':post/content': 'Server-side JavaScript',
        ':post/author': davidId,
        ':post/likes': 3,
        ':post/tags': [tagsResult.entityIds[0], tagsResult.entityIds[3]] // javascript, node
      }
    ]);
    
    testData = {
      users: { alice: aliceId, bob: bobId, charlie: charlieId, david: davidId },
      tags: tagsResult.entityIds,
      posts: postsResult.entityIds
    };
  });
  
  afterEach(() => {
    store = null;
    testData = null;
  });

  describe('Real Query Execution with Collections', () => {
    test('should execute query for all user names and provide array-like access', () => {
      const allNamesQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      // Execute query directly first to verify it works
      const directResults = store.query(allNamesQuery);
      expect(directResults.length).toBe(4);
      const sortedNames = directResults.map(r => r[0]).sort();
      expect(sortedNames).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
      
      // Create CollectionProxy with the query results
      const collectionProxy = new CollectionProxy(store, sortedNames, allNamesQuery);
      
      // Test array-like interface
      expect(collectionProxy.length).toBe(4);
      expect(collectionProxy[0]).toBe('Alice');
      expect(collectionProxy[1]).toBe('Bob');
      expect(collectionProxy[2]).toBe('Charlie');
      expect(collectionProxy[3]).toBe('David');
      
      // Test iteration
      const iteratedNames = [];
      for (const name of collectionProxy) {
        iteratedNames.push(name);
      }
      expect(iteratedNames).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
    });
    
    test('should execute query for verified users only', () => {
      const verifiedUsersQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/verified', true]]
      };
      
      const directResults = store.query(verifiedUsersQuery);
      expect(directResults.length).toBe(2);
      const verifiedNames = directResults.map(r => r[0]).sort();
      expect(verifiedNames).toEqual(['Alice', 'Charlie']);
      
      const collectionProxy = new CollectionProxy(store, verifiedNames, verifiedUsersQuery);
      expect(collectionProxy.length).toBe(2);
      expect(collectionProxy.value()).toEqual(['Alice', 'Charlie']);
    });
    
    test('should handle age range queries', () => {
      const olderUsersQuery = {
        find: ['?name', '?age'],
        where: [
          ['?e', ':user/name', '?name'], 
          ['?e', ':user/age', '?age']
        ]
      };
      
      // Execute query and filter in JavaScript (DataScript aggregate functions can be limited)
      const directResults = store.query(olderUsersQuery);
      const olderUsers = directResults.filter(([name, age]) => age >= 28);
      expect(olderUsers.length).toBe(3); // Alice (30), Charlie (35), David (28)
      
      const names = olderUsers.map(r => r[0]).sort();
      const collectionProxy = new CollectionProxy(store, names, olderUsersQuery);
      
      expect(collectionProxy.length).toBe(3);
      expect(collectionProxy.includes('Alice')).toBe(true);
      expect(collectionProxy.includes('Charlie')).toBe(true); 
      expect(collectionProxy.includes('David')).toBe(true);
      expect(collectionProxy.includes('Bob')).toBe(false); // Only 25
    });
    
    test('should execute relationship queries for collections', () => {
      const postsWithAuthorsQuery = {
        find: ['?title', '?author-name'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/author', '?author'],
          ['?author', ':user/name', '?author-name']
        ]
      };
      
      const directResults = store.query(postsWithAuthorsQuery);
      expect(directResults.length).toBe(4);
      
      // Extract just titles for CollectionProxy
      const titles = directResults.map(r => r[0]);
      const collectionProxy = new CollectionProxy(store, titles, postsWithAuthorsQuery);
      
      expect(collectionProxy.length).toBe(4);
      expect(collectionProxy.includes('Hello DataScript')).toBe(true);
      expect(collectionProxy.includes('React Components')).toBe(true);
    });
  });

  describe('Functional Array Methods with Real Data', () => {
    test('should filter collection and return new CollectionProxy', () => {
      const allAgesQuery = {
        find: ['?age'],
        where: [['?e', ':user/age', '?age']]
      };
      
      const directResults = store.query(allAgesQuery);
      const ages = directResults.map(r => r[0]); // [30, 25, 35, 28]
      
      const agesProxy = new CollectionProxy(store, ages, allAgesQuery);
      
      // Filter for ages >= 30
      const adultAges = agesProxy.filter(age => age >= 30);
      
      expect(adultAges).toBeInstanceOf(CollectionProxy);
      expect(adultAges.length).toBe(2); // 30, 35
      expect(adultAges.value().sort()).toEqual([30, 35]);
    });
    
    test('should map collection and return new CollectionProxy', () => {
      const userNamesQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const directResults = store.query(userNamesQuery);
      const names = directResults.map(r => r[0]).sort(); // ['Alice', 'Bob', 'Charlie', 'David']
      
      const namesProxy = new CollectionProxy(store, names, userNamesQuery);
      
      // Map to uppercase
      const upperNames = namesProxy.map(name => name.toUpperCase());
      
      expect(upperNames).toBeInstanceOf(CollectionProxy);
      expect(upperNames.length).toBe(4);
      expect(upperNames.value()).toEqual(['ALICE', 'BOB', 'CHARLIE', 'DAVID']);
    });
    
    test('should reduce collection to single value', () => {
      const allLikesQuery = {
        find: ['?likes'],
        where: [['?e', ':post/likes', '?likes']]
      };
      
      const directResults = store.query(allLikesQuery);
      const likes = directResults.map(r => r[0]); // [5, 12, 8, 3]
      
      const likesProxy = new CollectionProxy(store, likes, allLikesQuery);
      
      // Sum all likes
      const totalLikes = likesProxy.reduce((sum, likes) => sum + likes, 0);
      
      expect(totalLikes).toBe(28); // 5 + 12 + 8 + 3
    });
    
    test('should slice collection and return new CollectionProxy', () => {
      const postTitlesQuery = {
        find: ['?title'],
        where: [['?e', ':post/title', '?title']]
      };
      
      const directResults = store.query(postTitlesQuery);
      const titles = directResults.map(r => r[0]);
      
      const titlesProxy = new CollectionProxy(store, titles, postTitlesQuery);
      
      // Get first 2 posts
      const firstTwoPosts = titlesProxy.slice(0, 2);
      
      expect(firstTwoPosts).toBeInstanceOf(CollectionProxy);
      expect(firstTwoPosts.length).toBe(2);
      expect(firstTwoPosts.value()).toEqual(titles.slice(0, 2));
    });
    
    test('should find specific item in collection', () => {
      const emailsQuery = {
        find: ['?email'],
        where: [['?e', ':user/email', '?email']]
      };
      
      const directResults = store.query(emailsQuery);
      const emails = directResults.map(r => r[0]);
      
      const emailsProxy = new CollectionProxy(store, emails, emailsQuery);
      
      // Find email with 'charlie' in it
      const charlieEmail = emailsProxy.find(email => email.includes('charlie'));
      
      expect(charlieEmail).toBe('charlie@example.com');
    });
  });

  describe('Query Chaining with Collections', () => {
    test('should chain from collection to aggregate query', () => {
      const userNamesQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const directResults = store.query(userNamesQuery);
      const names = directResults.map(r => r[0]);
      
      const namesProxy = new CollectionProxy(store, names, userNamesQuery);
      
      // Chain to count query (aggregate)
      const countQuery = {
        find: [['(count ?e)']],
        where: [['?e', ':user/name', '?collection-item']]
      };
      
      const countProxy = namesProxy.query(countQuery);
      
      // Should return a proxy (type determined by query analysis)
      expect(countProxy).toBeDefined();
      expect(typeof countProxy.value).toBe('function');
    });
    
    test('should chain from user collection to their posts', () => {
      const verifiedUsersQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/verified', true]]
      };
      
      const directResults = store.query(verifiedUsersQuery);
      const verifiedNames = directResults.map(r => r[0]);
      
      const verifiedUsersProxy = new CollectionProxy(store, verifiedNames, verifiedUsersQuery);
      
      // Chain to get posts by these verified users
      const postsByVerifiedQuery = {
        find: ['?title'],
        where: [
          ['?author', ':user/name', '?collection-item'],
          ['?post', ':post/author', '?author'],
          ['?post', ':post/title', '?title']
        ]
      };
      
      const postsProxy = verifiedUsersProxy.query(postsByVerifiedQuery);
      
      expect(postsProxy).toBeDefined();
      expect(typeof postsProxy.value).toBe('function');
    });
  });

  describe('Subscription and Reactive Updates with Real Data', () => {
    test('should support subscription callbacks', () => {
      const userNamesQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const names = ['Alice', 'Bob', 'Charlie'];
      const collectionProxy = new CollectionProxy(store, names, userNamesQuery);
      
      let callbackCount = 0;
      let lastCollection = null;
      
      const unsubscribe = collectionProxy.subscribe((newCollection) => {
        callbackCount++;
        lastCollection = newCollection;
      });
      
      expect(typeof unsubscribe).toBe('function');
      expect(callbackCount).toBe(0); // Should not call immediately
      
      // Simulate collection change notification (what reactive system would do)
      collectionProxy._notifySubscribers(['Alice', 'Bob', 'Charlie', 'David']);
      
      expect(callbackCount).toBe(1);
      expect(lastCollection).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
      
      unsubscribe();
    });
    
    test('should handle multiple subscribers correctly', () => {
      const agesQuery = {
        find: ['?age'],
        where: [['?e', ':user/age', '?age']]
      };
      
      const ages = [30, 25, 35];
      const agesProxy = new CollectionProxy(store, ages, agesQuery);
      
      const callbacks = [];
      const callbackStates = [
        { count: 0, collection: null },
        { count: 0, collection: null },
        { count: 0, collection: null }
      ];
      
      // Create multiple subscribers
      for (let i = 0; i < 3; i++) {
        const callback = (newCollection) => {
          callbackStates[i].count++;
          callbackStates[i].collection = [...newCollection];
        };
        callbacks.push(agesProxy.subscribe(callback));
      }
      
      // Notify all subscribers
      agesProxy._notifySubscribers([30, 25, 35, 28]);
      
      // All should have received the update
      callbackStates.forEach(state => {
        expect(state.count).toBe(1);
        expect(state.collection).toEqual([30, 25, 35, 28]);
      });
      
      // Cleanup
      callbacks.forEach(unsubscribe => unsubscribe());
    });
    
    test('should detect collection changes correctly', () => {
      const likesQuery = {
        find: ['?likes'],
        where: [['?e', ':post/likes', '?likes']]
      };
      
      const likes = [5, 12, 8];
      const likesProxy = new CollectionProxy(store, likes, likesQuery);
      
      // Test change detection methods
      expect(likesProxy._hasCollectionChanged([5, 12, 8], [5, 12, 8])).toBe(false);
      expect(likesProxy._hasCollectionChanged([5, 12, 8], [5, 12, 8, 3])).toBe(true);
      expect(likesProxy._hasCollectionChanged([5, 12, 8], [5, 12, 10])).toBe(true);
      expect(likesProxy._hasCollectionChanged([5, 12, 8], [5, 12])).toBe(true);
    });
  });

  describe('Collection Operations with Relationships', () => {
    test('should handle many-to-many relationships in collections', () => {
      const postsWithTagsQuery = {
        find: ['?title', '?tag-name'],
        where: [
          ['?post', ':post/title', '?title'],
          ['?post', ':post/tags', '?tag'],
          ['?tag', ':tag/name', '?tag-name']
        ]
      };
      
      const directResults = store.query(postsWithTagsQuery);
      expect(directResults.length).toBeGreaterThan(4); // Multiple tags per post
      
      // Extract unique post titles
      const uniqueTitles = [...new Set(directResults.map(r => r[0]))];
      const titlesProxy = new CollectionProxy(store, uniqueTitles, postsWithTagsQuery);
      
      expect(titlesProxy.length).toBe(4); // 4 posts
      expect(titlesProxy.includes('Hello DataScript')).toBe(true);
      expect(titlesProxy.includes('React Components')).toBe(true);
    });
    
    test('should handle friend relationships in user collections', () => {
      const usersWithFriendsQuery = {
        find: ['?name'],
        where: [
          ['?user', ':user/name', '?name'],
          ['?user', ':user/friends', '?friend']
        ]
      };
      
      const directResults = store.query(usersWithFriendsQuery);
      const usersWithFriends = directResults.map(r => r[0]);
      
      const socialUsersProxy = new CollectionProxy(store, usersWithFriends, usersWithFriendsQuery);
      
      // Users with friends: Alice, Bob, Charlie (David has no friends in our data)
      expect(socialUsersProxy.length).toBeGreaterThan(0);
      expect(socialUsersProxy.includes('Alice')).toBe(true);
      expect(socialUsersProxy.includes('Bob')).toBe(true);
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle cleanup when destroyed', () => {
      const namesQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const names = ['Alice', 'Bob'];
      const collectionProxy = new CollectionProxy(store, names, namesQuery);
      
      const callback = () => {};
      collectionProxy.subscribe(callback);
      
      expect(collectionProxy._subscribers.size).toBe(1);
      
      collectionProxy.destroy();
      
      expect(collectionProxy._subscribers.size).toBe(0);
    });
    
    test('should handle large collections efficiently', () => {
      // Create additional test data
      const largeDataset = [];
      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          ':user/id': `bulk-user-${i}`,
          ':user/name': `User ${i}`,
          ':user/age': 20 + (i % 50),
          ':user/verified': i % 2 === 0
        });
      }
      
      const bulkResult = store.createEntities(largeDataset);
      expect(bulkResult.entityIds.length).toBe(100);
      
      // Query for all names (including original 4 + 100 bulk = 104 total)
      const allNamesQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const directResults = store.query(allNamesQuery);
      const allNames = directResults.map(r => r[0]);
      
      expect(allNames.length).toBe(104);
      
      const largeCollectionProxy = new CollectionProxy(store, allNames, allNamesQuery);
      
      // Should handle large collections efficiently
      expect(largeCollectionProxy.length).toBe(104);
      expect(largeCollectionProxy.first()).toBeDefined();
      expect(largeCollectionProxy.last()).toBeDefined();
      
      // Array methods should work with large collections
      const filteredProxy = largeCollectionProxy.filter(name => name.startsWith('User'));
      expect(filteredProxy.length).toBe(100); // All bulk users
    });
    
    test('should maintain consistent state during concurrent operations', () => {
      const agesQuery = {
        find: ['?age'],
        where: [['?e', ':user/age', '?age']]
      };
      
      const ages = [30, 25, 35, 28];
      const agesProxy = new CollectionProxy(store, ages, agesQuery);
      
      // Multiple operations should not interfere with each other
      const doubled = agesProxy.map(age => age * 2);
      const adults = agesProxy.filter(age => age >= 30);
      const sum = agesProxy.reduce((total, age) => total + age, 0);
      const sliced = agesProxy.slice(1, 3);
      
      // All operations should return correct results
      expect(doubled.value()).toEqual([60, 50, 70, 56]);
      expect(adults.value()).toEqual([30, 35]);
      expect(sum).toBe(118);
      expect(sliced.value()).toEqual([25, 35]);
      
      // Original proxy should be unchanged
      expect(agesProxy.value()).toEqual([30, 25, 35, 28]);
    });
  });

  describe('Error Handling with Real DataStore', () => {
    test('should handle queries that return no results', () => {
      const noResultsQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', 100]] // No 100-year-olds
      };
      
      // Verify query returns empty results
      const directResults = store.query(noResultsQuery);
      expect(directResults).toEqual([]);
      
      const emptyCollectionProxy = new CollectionProxy(store, [], noResultsQuery);
      
      expect(emptyCollectionProxy.length).toBe(0);
      expect(emptyCollectionProxy.value()).toEqual([]);
      expect(emptyCollectionProxy.isEmpty()).toBe(true);
      expect(emptyCollectionProxy.first()).toBeUndefined();
      expect(emptyCollectionProxy.last()).toBeUndefined();
    });
    
    test('should handle invalid query structures gracefully', () => {
      const validQuery = {
        find: ['?name'],
        where: [['?e', ':user/name', '?name']]
      };
      
      const names = ['Alice'];
      const collectionProxy = new CollectionProxy(store, names, validQuery);
      
      // Invalid queries should throw descriptive errors
      expect(() => collectionProxy.query()).toThrow('Query spec is required');
      expect(() => collectionProxy.query({})).toThrow('Query spec must have find clause');
      expect(() => collectionProxy.query({ find: [] })).toThrow('Query spec find clause cannot be empty');
    });
    
    test('should maintain collection integrity during complex operations', () => {
      const userDataQuery = {
        find: ['?name', '?age'],
        where: [['?e', ':user/name', '?name'], ['?e', ':user/age', '?age']]
      };
      
      const directResults = store.query(userDataQuery);
      const names = directResults.map(r => r[0]);
      
      const namesProxy = new CollectionProxy(store, names, userDataQuery);
      
      // Multiple operations should not corrupt internal state
      expect(namesProxy.length).toBe(4);
      
      const upperNames = namesProxy.map(name => name.toUpperCase());
      expect(upperNames.length).toBe(4);
      expect(namesProxy.length).toBe(4); // Original unchanged
      
      const longNames = namesProxy.filter(name => name.length > 4);
      expect(longNames.includes('Alice')).toBe(true);
      expect(longNames.includes('Charlie')).toBe(true);
      expect(namesProxy.length).toBe(4); // Still unchanged
      
      // Value consistency
      const originalValue = namesProxy.value();
      const secondValue = namesProxy.value();
      expect(originalValue).toEqual(secondValue);
      expect(originalValue).not.toBe(secondValue); // But different instances (immutable)
    });
  });
});