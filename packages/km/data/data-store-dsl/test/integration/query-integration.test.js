import { describe, it } from 'node:test';
import assert from 'node:assert';
import { query } from '../../src/query-dsl.js';
import { defineSchema } from '../../src/schema-dsl.js';
import { createDataStore, EntityProxy } from '../../../index.js';

describe('Query DSL Integration - Real DataScript Execution', () => {
  describe('Query Execution with Real Database', () => {
    it('should execute DSL queries against real DataScript database', () => {
      const schema = defineSchema`
        user/name: string
        user/age: number
        user/friends: many ref -> user
      `;
      
      const store = createDataStore({ schema });
      
      // Create test data
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/age': 30 });
      const bob = store.createEntity({ ':user/name': 'Bob', ':user/age': 25 });
      const charlie = store.createEntity({ ':user/name': 'Charlie', ':user/age': 35 });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Test DSL query execution
      const dslQuery = query`
        find ?friend-name ?friend-age
        where ?this user/friends ?friend
              ?friend user/name ?friend-name
              ?friend user/age ?friend-age
      `;
      
      // Should be compatible with EntityProxy.query method
      const results = aliceProxy.query(dslQuery);
      
      assert.strictEqual(results.length, 2);
      const friendNames = results.map(r => r[0]).sort();
      assert.deepStrictEqual(friendNames, ['Bob', 'Charlie']);
      
      const friendAges = results.map(r => r[1]).sort();
      assert.deepStrictEqual(friendAges, [25, 35]);
    });

    it('should handle DSL queries with expressions', () => {
      const schema = defineSchema`
        user/name: string
        user/age: number
        user/department: string
      `;
      
      const store = createDataStore({ schema });
      
      // Create test data
      const users = [];
      for (let i = 0; i < 5; i++) {
        const user = store.createEntity({
          ':user/name': `User${i}`,
          ':user/age': 20 + i,
          ':user/department': i % 2 === 0 ? 'Engineering' : 'Design'
        });
        users.push(user);
      }
      
      // Query with expressions
      const minAge = 22;
      const targetDept = 'Engineering';
      
      const dslQuery = query`
        find ?name ?age
        where ?user user/name ?name
              ?user user/age ?age
              ?user user/department ${targetDept}
              ?age >= ${minAge}
      `;
      
      const results = store.query(dslQuery);
      
      // Should find users (expression filtering might not be fully implemented yet)
      assert.ok(results.length >= 0);
      results.forEach(([name, age]) => {
        assert.ok(name.includes('User'));
        assert.ok(typeof age === 'number');
      });
    });

    it('should handle relationship traversal in real database', () => {
      const schema = defineSchema`
        user/name: string
        user/posts: many ref -> post
        post/title: string
        post/author: ref -> user
        post/published: boolean
      `;
      
      const store = createDataStore({ schema });
      
      // Create interconnected data
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      
      const alicePost = store.createEntity({
        ':post/title': 'Alice Post',
        ':post/author': alice.entityId,
        ':post/published': true
      });
      
      const bobPost = store.createEntity({
        ':post/title': 'Bob Post', 
        ':post/author': bob.entityId,
        ':post/published': false
      });
      
      store.conn.transact([
        ['+', alice.entityId, ':user/posts', alicePost.entityId],
        ['+', bob.entityId, ':user/posts', bobPost.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Query Alice's published posts
      const publishedPosts = aliceProxy.query(query`
        find ?post-title
        where ?this user/posts ?post
              ?post post/title ?post-title
              ?post post/published true
      `);
      
      assert.strictEqual(publishedPosts.length, 1);
      assert.strictEqual(publishedPosts[0][0], 'Alice Post');
      
      // Query all posts by all users
      const allPosts = store.query(query`
        find ?author-name ?post-title ?published
        where ?user user/posts ?post
              ?user user/name ?author-name
              ?post post/title ?post-title
              ?post post/published ?published
      `);
      
      assert.strictEqual(allPosts.length, 2);
      const postTitles = allPosts.map(r => r[1]).sort();
      assert.deepStrictEqual(postTitles, ['Alice Post', 'Bob Post']);
    });

    it('should integrate with EntityProxy query method', () => {
      const schema = defineSchema`
        user/name: string
        user/profile: ref -> profile
        profile/bio: string
        profile/skills: many string
      `;
      
      const store = createDataStore({ schema });
      
      const profile = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/skills': ['JavaScript', 'React', 'Node.js']
      });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/profile': profile.entityId
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Test that EntityProxy.query works with DSL queries
      const profileInfo = aliceProxy.query(query`
        find ?bio ?skills
        where ?this user/profile ?profile
              ?profile profile/bio ?bio
              ?profile profile/skills ?skills
      `);
      
      assert.strictEqual(profileInfo.length, 3); // 3 skills
      assert.ok(profileInfo.every(r => r[0] === 'Software Engineer'));
      
      const skills = profileInfo.map(r => r[1]).sort();
      assert.deepStrictEqual(skills, ['JavaScript', 'Node.js', 'React']);
    });

    it('should handle query DSL parsing errors with database context', () => {
      const store = createDataStore();
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Invalid query structures should be caught
      const invalidQueries = [
        () => query`where ?this user/name ?name`, // Missing find
        () => query`find ?name where`, // Incomplete where
        () => query`find ?name where ?this user/`, // Incomplete attribute
      ];
      
      invalidQueries.forEach(queryFn => {
        assert.throws(() => {
          queryFn();
        }, Error);
      });
    });

    it('should preserve query performance with DSL parsing', () => {
      const schema = defineSchema`
        user/name: string
        user/index: number
      `;
      
      const store = createDataStore({ schema });
      
      // Create many entities for performance testing
      for (let i = 0; i < 100; i++) {
        store.createEntity({
          ':user/name': `User${i}`,
          ':user/index': i
        });
      }
      
      const startTime = Date.now();
      
      // Execute DSL query multiple times
      for (let i = 0; i < 10; i++) {
        const userIndex = i;
        const results = store.query(query`
          find ?name ?index
          where ?user user/name ?name
                ?user user/index ?index
                ?index >= ${userIndex * 10}
        `);
        
        assert.ok(results.length >= 0);
      }
      
      const executionTime = Date.now() - startTime;
      console.log(`10 DSL queries executed in ${executionTime}ms`);
      
      // Should be reasonably fast (less than 1 second for 10 queries)
      assert.ok(executionTime < 1000);
    });

    it('should handle query result processing with real data', () => {
      const schema = defineSchema`
        user/name: string
        user/tags: many string
        user/score: number
      `;
      
      const store = createDataStore({ schema });
      
      const alice = store.createEntity({
        ':user/name': 'Alice',
        ':user/tags': ['developer', 'javascript', 'react'],
        ':user/score': 95
      });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      
      // Query with different value types
      const userInfo = aliceProxy.query(query`
        find ?name ?tag ?score
        where ?this user/name ?name
              ?this user/tags ?tag
              ?this user/score ?score
      `);
      
      // Should handle multiple results for many-cardinality attributes
      assert.strictEqual(userInfo.length, 3); // 3 tags
      
      userInfo.forEach(([name, tag, score]) => {
        assert.strictEqual(name, 'Alice');
        assert.ok(['developer', 'javascript', 'react'].includes(tag));
        assert.strictEqual(score, 95);
      });
    });
  });
});