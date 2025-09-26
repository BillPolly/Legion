/**
 * DataStore Integration Tests with Handle DSL
 * 
 * Comprehensive integration test for handle-dsl working with real DataStore implementation.
 * Tests the complete workflow: schema definition, entity creation, DSL queries, and DSL updates.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { defineSchema, query, update, EntityProxy, createDSLAwareDataStore } from '../src/index.js';

describe('DataStore Integration with Handle DSL', () => {
  let dataStore;

  beforeEach(() => {
    // Create DataStore with comprehensive schema using DSL
    const schema = defineSchema`
      // User entity with identity and value constraints
      user/id: unique identity string
      user/name: string
      user/email: unique value string
      user/age: number
      user/active: boolean
      user/joinDate: instant
      user/bio: string
      user/score: number
      user/level: string
      
      // User relationships
      user/friends: many ref -> user
      user/posts: many ref -> post
      user/profile: ref component -> profile
      
      // Post entity
      post/id: unique identity string
      post/title: string
      post/content: string
      post/author: ref -> user
      post/published: boolean
      post/tags: many string
      post/createdAt: instant
      
      // Profile entity (component of user)
      profile/id: unique identity string
      profile/avatar: string
      profile/location: string
      profile/skills: many string
      profile/website: string
    `;

    dataStore = createDSLAwareDataStore({ schema });
  });

  describe('Schema Definition with DSL', () => {
    it('should create DataStore with DSL-defined schema', () => {
      expect(dataStore).toBeDefined();
      expect(dataStore.schema).toBeDefined();
      
      // Verify identity constraints
      expect(dataStore.schema[':user/id']).toEqual({
        unique: 'identity',
        valueType: 'string'
      });
      
      // Verify value constraints
      expect(dataStore.schema[':user/email']).toEqual({
        unique: 'value', 
        valueType: 'string'
      });
      
      // Verify cardinality constraints
      expect(dataStore.schema[':user/friends']).toEqual({
        card: 'many',
        valueType: 'ref'
      });
      
      // Verify component relationships
      expect(dataStore.schema[':user/profile']).toEqual({
        valueType: 'ref',
        component: true
      });
    });

    it('should handle all data types correctly', () => {
      // String types
      expect(dataStore.schema[':user/name'].valueType).toBe('string');
      expect(dataStore.schema[':post/title'].valueType).toBe('string');
      
      // Number types
      expect(dataStore.schema[':user/age'].valueType).toBe('number');
      expect(dataStore.schema[':user/score'].valueType).toBe('number');
      
      // Boolean types
      expect(dataStore.schema[':user/active'].valueType).toBe('boolean');
      expect(dataStore.schema[':post/published'].valueType).toBe('boolean');
      
      // Instant types
      expect(dataStore.schema[':user/joinDate'].valueType).toBe('instant');
      expect(dataStore.schema[':post/createdAt'].valueType).toBe('instant');
      
      // Reference types
      expect(dataStore.schema[':post/author'].valueType).toBe('ref');
      expect(dataStore.schema[':user/profile'].valueType).toBe('ref');
    });

    it('should handle complex constraint combinations', () => {
      // Many string attributes
      expect(dataStore.schema[':post/tags']).toEqual({
        card: 'many',
        valueType: 'string'
      });
      
      expect(dataStore.schema[':profile/skills']).toEqual({
        card: 'many',
        valueType: 'string'
      });
      
      // Many ref attributes
      expect(dataStore.schema[':user/friends']).toEqual({
        card: 'many',
        valueType: 'ref'
      });
      
      expect(dataStore.schema[':user/posts']).toEqual({
        card: 'many',
        valueType: 'ref'
      });
    });
  });

  describe('Entity Creation and Basic Operations', () => {
    let aliceId, bobId, charlieId;
    let alicePostId, profileId;

    beforeEach(() => {
      // Create users
      const aliceResult = dataStore.createEntity({
        ':user/id': 'user-alice',
        ':user/name': 'Alice Johnson',
        ':user/email': 'alice@techcorp.com',
        ':user/age': 28,
        ':user/active': true,
        ':user/joinDate': new Date('2023-01-15'),
        ':user/bio': 'Full-stack developer passionate about reactive programming',
        ':user/score': 85,
        ':user/level': 'senior'
      });
      aliceId = aliceResult.entityId;

      const bobResult = dataStore.createEntity({
        ':user/id': 'user-bob',
        ':user/name': 'Bob Chen', 
        ':user/email': 'bob@designstudio.com',
        ':user/age': 32,
        ':user/active': true,
        ':user/bio': 'UX Designer crafting beautiful interfaces'
      });
      bobId = bobResult.entityId;

      const charlieResult = dataStore.createEntity({
        ':user/id': 'user-charlie',
        ':user/name': 'Charlie Rodriguez',
        ':user/email': 'charlie@startup.io', 
        ':user/age': 29,
        ':user/active': true,
        ':user/bio': 'Product Manager building collaborative tools'
      });
      charlieId = charlieResult.entityId;

      // Create profile for Alice
      const profileResult = dataStore.createEntity({
        ':profile/id': 'profile-alice',
        ':profile/avatar': 'https://example.com/avatars/alice.jpg',
        ':profile/location': 'San Francisco, CA',
        ':profile/skills': ['JavaScript', 'React', 'Node.js', 'DataScript'],
        ':profile/website': 'https://alice-dev.com'
      });
      profileId = profileResult.entityId;

      // Link profile to Alice
      dataStore.updateEntity(aliceId, {
        ':user/profile': profileId
      });

      // Create friendships
      dataStore.updateEntity(aliceId, {
        ':user/friends': [bobId, charlieId]
      });

      // Create a post by Alice
      const postResult = dataStore.createEntity({
        ':post/id': 'post-1',
        ':post/title': 'Building Reactive UIs with Template Literals',
        ':post/content': 'Template literals make data operations incredibly readable and maintainable...',
        ':post/author': aliceId,
        ':post/published': true,
        ':post/tags': ['javascript', 'react', 'dsl', 'reactive'],
        ':post/createdAt': new Date()
      });
      alicePostId = postResult.entityId;

      // Link post to Alice
      dataStore.updateEntity(aliceId, {
        ':user/posts': [alicePostId]
      });
    });

    it('should query user data with DSL', () => {
      const userQuery = query`
        find ?name ?email ?age ?bio
        where ?user :user/name ?name
              ?user :user/email ?email  
              ?user :user/age ?age
              ?user :user/bio ?bio
              ?user :user/active true
      `;

      const results = dataStore.query(userQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(3); // All three users are active
      
      // Find Alice's data
      const aliceData = results.find(result => result[0] === 'Alice Johnson');
      expect(aliceData).toBeDefined();
      expect(aliceData[1]).toBe('alice@techcorp.com');
      expect(aliceData[2]).toBe(28);
      expect(aliceData[3]).toBe('Full-stack developer passionate about reactive programming');
    });

    it('should query relationships with DSL', () => {
      const friendsQuery = query`
        find ?friend-name ?friend-email
        where ?user :user/id "user-alice"
              ?user :user/friends ?friend
              ?friend :user/name ?friend-name
              ?friend :user/email ?friend-email
      `;

      const results = dataStore.query(friendsQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(2); // Alice has 2 friends
      
      const friendNames = results.map(result => result[0]).sort();
      expect(friendNames).toEqual(['Bob Chen', 'Charlie Rodriguez']);
      
      const friendEmails = results.map(result => result[1]).sort();
      expect(friendEmails).toEqual(['bob@designstudio.com', 'charlie@startup.io']);
    });

    it('should query component relationships with DSL', () => {
      const profileQuery = query`
        find ?avatar ?location ?skills ?website
        where ?user :user/id "user-alice"
              ?user :user/profile ?profile
              ?profile :profile/avatar ?avatar
              ?profile :profile/location ?location
              ?profile :profile/skills ?skills
              ?profile :profile/website ?website
      `;

      const results = dataStore.query(profileQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(4); // 4 skills in the array
      
      // Check first result (all should have same avatar, location, website)
      const firstResult = results[0];
      expect(firstResult[0]).toBe('https://example.com/avatars/alice.jpg');
      expect(firstResult[1]).toBe('San Francisco, CA');
      expect(firstResult[3]).toBe('https://alice-dev.com');
      
      // Skills should include all the ones we added
      const allSkills = results.map(result => result[2]);
      expect(allSkills).toContain('JavaScript');
      expect(allSkills).toContain('React');
      expect(allSkills).toContain('Node.js');
      expect(allSkills).toContain('DataScript');
    });

    it('should query posts with DSL', () => {
      const postsQuery = query`
        find ?title ?content ?author-name ?tag
        where ?post :post/published true
              ?post :post/title ?title
              ?post :post/content ?content
              ?post :post/author ?author
              ?author :user/name ?author-name
              ?post :post/tags ?tag
      `;

      const results = dataStore.query(postsQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(4); // 4 tags on the post
      
      // All results should be for Alice's post
      const firstResult = results[0];
      expect(firstResult[0]).toBe('Building Reactive UIs with Template Literals');
      expect(firstResult[1]).toContain('Template literals make data operations');
      expect(firstResult[2]).toBe('Alice Johnson');
      
      // Check that all tags are present
      const allTags = results.map(result => result[3]);
      expect(allTags).toContain('javascript');
      expect(allTags).toContain('react');
      expect(allTags).toContain('dsl');
      expect(allTags).toContain('reactive');
    });

    it('should handle complex multi-entity queries with DSL', () => {
      const complexQuery = query`
        find ?user-name ?friend-name ?post-title ?skill
        where ?user :user/name ?user-name
              ?user :user/friends ?friend
              ?friend :user/name ?friend-name
              ?user :user/posts ?post
              ?post :post/title ?post-title
              ?user :user/profile ?profile
              ?profile :profile/skills ?skill
      `;

      const results = dataStore.query(complexQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(8); // 2 friends × 4 skills = 8 combinations
      
      // All results should be for Alice
      results.forEach(result => {
        expect(result[0]).toBe('Alice Johnson');
        expect(['Bob Chen', 'Charlie Rodriguez']).toContain(result[1]);
        expect(result[2]).toBe('Building Reactive UIs with Template Literals');
        expect(['JavaScript', 'React', 'Node.js', 'DataScript']).toContain(result[3]);
      });
    });

    it('should filter with literal values in DSL queries', () => {
      const filteredQuery = query`
        find ?name ?age
        where ?user :user/name ?name
              ?user :user/age ?age
              ?user :user/active true
              ?age >= 30
      `;

      const results = dataStore.query(filteredQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1); // Only Bob is >= 30
      
      const bobResult = results[0];
      expect(bobResult[0]).toBe('Bob Chen');
      expect(bobResult[1]).toBe(32);
    });

    it('should handle aggregations with DSL queries', () => {
      const aggregateQuery = query`
        find ?user-name (count-distinct ?friend) (count-distinct ?post)
        where ?user :user/name ?user-name
              ?user :user/friends ?friend
              ?user :user/posts ?post
      `;

      const results = dataStore.query(aggregateQuery);
      
      expect(results).toBeDefined();
      expect(results.length).toBe(1); // Only Alice has both friends and posts
      
      const aliceResult = results[0];
      expect(aliceResult[0]).toBe('Alice Johnson');
      expect(aliceResult[1]).toBe(2); // 2 distinct friends
      expect(aliceResult[2]).toBe(1); // 1 distinct post
    });
  });

  describe('DSL Updates with DataStore', () => {
    let userId;

    beforeEach(() => {
      const userResult = dataStore.createEntity({
        ':user/id': 'user-test',
        ':user/name': 'Test User',
        ':user/email': 'test@example.com',
        ':user/age': 25,
        ':user/active': true
      });
      userId = userResult.entityId;
    });

    it('should update entities using DSL syntax through EntityProxy', () => {
      // Create EntityProxy for the user
      const userProxy = new EntityProxy(userId, dataStore);
      
      // Update using DSL syntax
      const updateResult = userProxy.update(update`
        user/name = "Updated Test User"
        user/age = 26
        user/bio = "Updated biography"
        user/score = 100
        user/level = "expert"
      `);

      expect(updateResult).toBeDefined();
      expect(updateResult.success).toBe(true);

      // Verify updates by querying
      const verifyQuery = query`
        find ?name ?age ?bio ?score ?level
        where ?user :user/id "user-test"
              ?user :user/name ?name
              ?user :user/age ?age
              ?user :user/bio ?bio
              ?user :user/score ?score
              ?user :user/level ?level
      `;

      const results = dataStore.query(verifyQuery);
      expect(results).toBeDefined();
      expect(results.length).toBe(1);

      const updatedUser = results[0];
      expect(updatedUser[0]).toBe('Updated Test User');
      expect(updatedUser[1]).toBe(26);
      expect(updatedUser[2]).toBe('Updated biography');
      expect(updatedUser[3]).toBe(100);
      expect(updatedUser[4]).toBe('expert');
    });

    it('should handle expression interpolation in DSL updates', () => {
      const userProxy = new EntityProxy(userId, dataStore);
      
      const newAge = 30;
      const scoreBonus = 25;
      const currentDate = new Date();
      
      const updateResult = userProxy.update(update`
        user/age = ${newAge}
        user/score = ${75 + scoreBonus}
        user/level = ${newAge >= 30 ? 'senior' : 'junior'}
        user/lastLogin = ${currentDate}
        user/active = ${true}
      `);

      expect(updateResult.success).toBe(true);

      // Verify expression results
      const verifyQuery = query`
        find ?age ?score ?level ?lastLogin ?active
        where ?user :user/id "user-test"
              ?user :user/age ?age
              ?user :user/score ?score
              ?user :user/level ?level
              ?user :user/lastLogin ?lastLogin
              ?user :user/active ?active
      `;

      const results = dataStore.query(verifyQuery);
      const result = results[0];
      
      expect(result[0]).toBe(30);
      expect(result[1]).toBe(100);
      expect(result[2]).toBe('senior');
      expect(result[3]).toEqual(currentDate);
      expect(result[4]).toBe(true);
    });

    it('should handle boolean and null values in DSL updates', () => {
      const userProxy = new EntityProxy(userId, dataStore);
      
      const updateResult = userProxy.update(update`
        user/active = false
        user/verified = true
        user/bio = null
      `);

      expect(updateResult.success).toBe(true);

      // Verify boolean updates
      const verifyQuery = query`
        find ?active ?verified ?bio
        where ?user :user/id "user-test"
              ?user :user/active ?active
              ?user :user/verified ?verified
      `;

      const results = dataStore.query(verifyQuery);
      expect(results.length).toBe(1);

      const result = results[0];
      expect(result[0]).toBe(false);
      expect(result[1]).toBe(true);
      // Bio should be retracted (null), so may not appear in results
    });

    it('should handle multiple entity types in updates', () => {
      // Create profile
      const profileResult = dataStore.createEntity({
        ':profile/id': 'profile-test',
        ':profile/avatar': 'old-avatar.jpg'
      });
      
      const userProxy = new EntityProxy(userId, dataStore);
      const profileProxy = new EntityProxy(profileResult.entityId, dataStore);

      // Update user
      userProxy.update(update`
        user/profile = ${profileResult.entityId}
        user/name = "User with Profile"
      `);

      // Update profile  
      profileProxy.update(update`
        profile/avatar = "new-avatar.jpg"
        profile/location = "New York, NY"
        profile/skills = ["JavaScript", "Python"]
      `);

      // Verify linked updates
      const linkedQuery = query`
        find ?user-name ?avatar ?location ?skill
        where ?user :user/id "user-test"
              ?user :user/name ?user-name
              ?user :user/profile ?profile
              ?profile :profile/avatar ?avatar
              ?profile :profile/location ?location
              ?profile :profile/skills ?skill
      `;

      const results = dataStore.query(linkedQuery);
      expect(results.length).toBe(2); // 2 skills

      const firstResult = results[0];
      expect(firstResult[0]).toBe('User with Profile');
      expect(firstResult[1]).toBe('new-avatar.jpg');
      expect(firstResult[2]).toBe('New York, NY');
      expect(['JavaScript', 'Python']).toContain(firstResult[3]);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty queries gracefully', () => {
      const emptyQuery = query`
        find ?entity
        where ?entity :nonexistent/attribute ?value
      `;

      const results = dataStore.query(emptyQuery);
      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('should handle invalid attribute names in queries', () => {
      expect(() => {
        query`
          find ?value
          where ?entity :invalid-attribute ?value
        `;
      }).not.toThrow(); // DSL should parse but return no results
    });

    it('should handle complex nested relationships', () => {
      // Create nested data structure
      const user1 = dataStore.createEntity({ ':user/id': 'user-1', ':user/name': 'User 1' });
      const user2 = dataStore.createEntity({ ':user/id': 'user-2', ':user/name': 'User 2' });
      const user3 = dataStore.createEntity({ ':user/id': 'user-3', ':user/name': 'User 3' });

      // Create friendship chain: user1 -> user2 -> user3
      dataStore.updateEntity(user1.entityId, { ':user/friends': [user2.entityId] });
      dataStore.updateEntity(user2.entityId, { ':user/friends': [user3.entityId] });

      // Query friends of friends
      const nestedQuery = query`
        find ?friend-of-friend-name
        where ?user :user/id "user-1"
              ?user :user/friends ?friend
              ?friend :user/friends ?friend-of-friend
              ?friend-of-friend :user/name ?friend-of-friend-name
      `;

      const results = dataStore.query(nestedQuery);
      expect(results).toBeDefined();
      expect(results.length).toBe(1);
      expect(results[0][0]).toBe('User 3');
    });

    it('should handle schema validation errors gracefully', () => {
      // Note: DataStore currently doesn't validate data types against schema
      // This test documents the current behavior - type validation would need
      // to be implemented in DataStore._validateEntityData if desired
      
      // Creating entity with wrong type currently succeeds
      const result = dataStore.createEntity({
        ':user/age': 'not-a-number' // Schema says number, but string is accepted
      });
      
      expect(result.entityId).toBeDefined();
      
      // However, attribute naming validation should still work
      expect(() => {
        dataStore.createEntity({
          'user/age': 25 // Missing ':' prefix should throw
        });
      }).toThrow('Attributes must start with \':\'');
    });

    it('should preserve data integrity during complex operations', () => {
      const userId1 = dataStore.createEntity({ ':user/id': 'integrity-user-1', ':user/name': 'User 1' }).entityId;
      const userId2 = dataStore.createEntity({ ':user/id': 'integrity-user-2', ':user/name': 'User 2' }).entityId;

      const user1Handle = new EntityProxy(userId1, dataStore);
      const user2Handle = new EntityProxy(userId2, dataStore);

      // Create bidirectional friendship
      user1Handle.update(update`user/friends = [${userId2}]`);
      user2Handle.update(update`user/friends = [${userId1}]`);

      // Verify bidirectional relationship
      const friendshipQuery = query`
        find ?user1-name ?user2-name
        where ?user1 :user/id "integrity-user-1"
              ?user1 :user/name ?user1-name
              ?user1 :user/friends ?user2
              ?user2 :user/name ?user2-name
              ?user2 :user/friends ?user1
      `;

      const results = dataStore.query(friendshipQuery);
      expect(results.length).toBe(1);
      expect(results[0][0]).toBe('User 1');
      expect(results[0][1]).toBe('User 2');
    });
  });

  describe('Performance and Scale', () => {
    it('should handle moderate data volumes efficiently', () => {
      const startTime = Date.now();
      
      // Create 100 users
      const userIds = [];
      for (let i = 0; i < 100; i++) {
        const result = dataStore.createEntity({
          ':user/id': `perf-user-${i}`,
          ':user/name': `Performance User ${i}`,
          ':user/age': 20 + (i % 50),
          ':user/active': i % 2 === 0
        });
        userIds.push(result.entityId);
      }

      // Create some friendships
      for (let i = 0; i < 50; i++) {
        const friendIndex = (i + 1) % 100;
        dataStore.updateEntity(userIds[i], {
          ':user/friends': [userIds[friendIndex]]
        });
      }

      const setupTime = Date.now() - startTime;
      console.log(`Setup time for 100 users: ${setupTime}ms`);

      // Query all active users
      const queryStart = Date.now();
      const activeUsersQuery = query`
        find ?name ?age
        where ?user :user/active true
              ?user :user/name ?name
              ?user :user/age ?age
      `;

      const results = dataStore.query(activeUsersQuery);
      const queryTime = Date.now() - queryStart;
      
      console.log(`Query time for active users: ${queryTime}ms`);
      
      expect(results.length).toBe(50); // Half are active
      expect(setupTime).toBeLessThan(5000); // Setup under 5 seconds
      expect(queryTime).toBeLessThan(1000); // Query under 1 second
    });

    it('should handle complex queries efficiently', () => {
      // Setup test data
      const alice = dataStore.createEntity({ ':user/id': 'alice-perf', ':user/name': 'Alice' });
      const bob = dataStore.createEntity({ ':user/id': 'bob-perf', ':user/name': 'Bob' });
      const charlie = dataStore.createEntity({ ':user/id': 'charlie-perf', ':user/name': 'Charlie' });

      // Create posts
      for (let i = 0; i < 20; i++) {
        const post = dataStore.createEntity({
          ':post/id': `post-${i}`,
          ':post/title': `Post ${i}`,
          ':post/author': alice.entityId,
          ':post/published': i % 2 === 0,
          ':post/tags': [`tag-${i % 5}`, `category-${i % 3}`]
        });
        
        dataStore.updateEntity(alice.entityId, {
          ':user/posts': [post.entityId]
        });
      }

      const queryStart = Date.now();
      
      // Complex query with joins and filters
      const complexQuery = query`
        find ?title ?tag ?author-name
        where ?post :post/published true
              ?post :post/title ?title
              ?post :post/author ?author
              ?author :user/name ?author-name
              ?post :post/tags ?tag
      `;

      const results = dataStore.query(complexQuery);
      const queryTime = Date.now() - queryStart;
      
      console.log(`Complex query time: ${queryTime}ms, results: ${results.length}`);
      
      expect(results.length).toBeGreaterThan(0);
      expect(queryTime).toBeLessThan(500); // Complex query under 500ms
    });
  });

  describe('Integration Completeness', () => {
    it('should demonstrate complete end-to-end workflow', () => {
      // 1. Schema Definition
      const blogSchema = defineSchema`
        author/id: unique identity string
        author/name: string
        author/email: unique value string
        author/posts: many ref -> article
        
        article/id: unique identity string
        article/title: string
        article/content: string
        article/author: ref -> author
        article/published: boolean
        article/tags: many string
        article/comments: many ref -> comment
        
        comment/id: unique identity string
        comment/text: string
        comment/author: ref -> author
        comment/article: ref -> article
        comment/timestamp: instant
      `;

      const blogStore = createDSLAwareDataStore({ schema: blogSchema });

      // 2. Entity Creation
      const author = blogStore.createEntity({
        ':author/id': 'john-doe',
        ':author/name': 'John Doe',
        ':author/email': 'john@example.com'
      });

      const article = blogStore.createEntity({
        ':article/id': 'first-post',
        ':article/title': 'My First Blog Post',
        ':article/content': 'Welcome to my blog!',
        ':article/author': author.entityId,
        ':article/published': true,
        ':article/tags': ['intro', 'welcome', 'blog']
      });

      const comment = blogStore.createEntity({
        ':comment/id': 'comment-1',
        ':comment/text': 'Great first post!',
        ':comment/author': author.entityId,
        ':comment/article': article.entityId,
        ':comment/timestamp': new Date()
      });

      // 3. Link relationships using DSL updates
      const authorProxy = new EntityProxy(author.entityId, blogStore);
      authorProxy.update(update`
        author/posts = [${article.entityId}]
      `);

      const articleProxy = new EntityProxy(article.entityId, blogStore);
      articleProxy.update(update`
        article/comments = [${comment.entityId}]
      `);

      // 4. Query complete blog structure with DSL
      const blogQuery = query`
        find ?author-name ?article-title ?comment-text ?tag
        where ?author :author/id "john-doe"
              ?author :author/name ?author-name
              ?author :author/posts ?article
              ?article :article/title ?article-title
              ?article :article/published true
              ?article :article/tags ?tag
              ?article :article/comments ?comment
              ?comment :comment/text ?comment-text
      `;

      const results = blogStore.query(blogQuery);
      
      expect(results.length).toBe(3); // 3 tags
      
      // Verify complete data flow
      results.forEach(result => {
        expect(result[0]).toBe('John Doe');
        expect(result[1]).toBe('My First Blog Post');
        expect(result[2]).toBe('Great first post!');
        expect(['intro', 'welcome', 'blog']).toContain(result[3]);
      });

      console.log('✅ End-to-end workflow completed successfully');
      console.log(`📊 Schema entities: ${Object.keys(blogSchema).filter(k => k.includes('/id')).length}`);
      console.log(`🔍 Query results: ${results.length}`);
      console.log(`📝 Blog structure: Author -> Article -> Comments -> Tags`);
    });

    it('should work seamlessly with both DSL and object syntax', () => {
      const userId = dataStore.createEntity({
        ':user/id': 'dual-syntax-user',
        ':user/name': 'Dual User',
        ':user/age': 25
      }).entityId;

      const userProxy = new EntityProxy(userId, dataStore);

      // Object syntax update
      dataStore.updateEntity(userId, {
        ':user/email': 'dual@example.com',
        ':user/active': true
      });

      // DSL syntax update  
      userProxy.update(update`
        user/bio = "Using both syntaxes"
        user/score = 95
      `);

      // Object syntax query
      const objectResults = dataStore.query({
        find: ['?name', '?email', '?bio', '?score'],
        where: [
          ['?user', ':user/id', 'dual-syntax-user'],
          ['?user', ':user/name', '?name'],
          ['?user', ':user/email', '?email'],
          ['?user', ':user/bio', '?bio'],
          ['?user', ':user/score', '?score']
        ]
      });

      // DSL syntax query
      const dslResults = dataStore.query(query`
        find ?name ?email ?bio ?score
        where ?user :user/id "dual-syntax-user"
              ?user :user/name ?name
              ?user :user/email ?email
              ?user :user/bio ?bio
              ?user :user/score ?score
      `);

      // Both should produce identical results
      expect(objectResults).toEqual(dslResults);
      expect(objectResults.length).toBe(1);
      
      const result = objectResults[0];
      expect(result[0]).toBe('Dual User');
      expect(result[1]).toBe('dual@example.com');
      expect(result[2]).toBe('Using both syntaxes');
      expect(result[3]).toBe(95);

      console.log('✅ Both DSL and object syntax produce identical results');
    });
  });
});