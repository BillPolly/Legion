import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createDataStore, EntityProxy } from '../../index.js';

describe('Multi-Entity Scenarios - End-to-End', () => {
  describe('Complex Entity Relationships', () => {
    it('should handle a complete social media scenario', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/posts': { card: 'many', valueType: 'ref' },
        ':user/profile': { valueType: 'ref' },
        ':post/author': { valueType: 'ref' },
        ':post/likes': { card: 'many', valueType: 'ref' },
        ':post/comments': { card: 'many', valueType: 'ref' },
        ':comment/author': { valueType: 'ref' },
        ':comment/post': { valueType: 'ref' },
        ':profile/user': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create users
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/email': 'alice@example.com' });
      const bob = store.createEntity({ ':user/name': 'Bob', ':user/email': 'bob@example.com' });
      const charlie = store.createEntity({ ':user/name': 'Charlie', ':user/email': 'charlie@example.com' });
      
      // Create profiles
      const aliceProfile = store.createEntity({
        ':profile/bio': 'Software Engineer',
        ':profile/followers': 150,
        ':profile/user': alice.entityId
      });
      
      const bobProfile = store.createEntity({
        ':profile/bio': 'Designer',
        ':profile/followers': 200,
        ':profile/user': bob.entityId
      });
      
      // Link profiles to users
      store.conn.transact([
        ['+', alice.entityId, ':user/profile', aliceProfile.entityId],
        ['+', bob.entityId, ':user/profile', bobProfile.entityId]
      ]);
      
      // Create friendships
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        ['+', bob.entityId, ':user/friends', alice.entityId],
        ['+', charlie.entityId, ':user/friends', alice.entityId]
      ]);
      
      // Create proxies
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Test friendship network
      const aliceFriends = aliceProxy.get(':user/friends');
      assert.strictEqual(aliceFriends.length, 2);
      const aliceFriendNames = aliceFriends.map(f => f.get(':user/name')).sort();
      assert.deepStrictEqual(aliceFriendNames, ['Bob', 'Charlie']);
      
      // Test profile relationships
      const aliceProfileProxy = aliceProxy.get(':user/profile');
      assert.ok(aliceProfileProxy instanceof EntityProxy);
      assert.strictEqual(aliceProfileProxy.get(':profile/bio'), 'Software Engineer');
      assert.strictEqual(aliceProfileProxy.get(':profile/followers'), 150);
      
      // Create posts
      const alicePost = store.createEntity({
        ':post/title': 'Learning DataScript',
        ':post/content': 'DataScript is amazing for reactive data!',
        ':post/author': alice.entityId,
        ':post/published': true
      });
      
      const bobPost = store.createEntity({
        ':post/title': 'Design Principles',
        ':post/content': 'Good design is invisible',
        ':post/author': bob.entityId,
        ':post/published': true
      });
      
      // Link posts to users
      store.conn.transact([
        ['+', alice.entityId, ':user/posts', alicePost.entityId],
        ['+', bob.entityId, ':user/posts', bobPost.entityId]
      ]);
      
      // Test post relationships
      const alicePosts = aliceProxy.get(':user/posts');
      assert.strictEqual(alicePosts.length, 1);
      assert.strictEqual(alicePosts[0].get(':post/title'), 'Learning DataScript');
      
      // Create likes and comments
      const comment = store.createEntity({
        ':comment/content': 'Great post!',
        ':comment/author': bob.entityId,
        ':comment/post': alicePost.entityId
      });
      
      store.conn.transact([
        ['+', alicePost.entityId, ':post/likes', bob.entityId],
        ['+', alicePost.entityId, ':post/likes', charlie.entityId],
        ['+', alicePost.entityId, ':post/comments', comment.entityId]
      ]);
      
      // Query Alice's post likes (without aggregation)
      const engagementQuery = aliceProxy.query({
        find: ['?title', '?liker-name'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?title'],
          ['?post', ':post/likes', '?liker'],
          ['?liker', ':user/name', '?liker-name']
        ]
      });
      
      // Should have engagement data
      assert.strictEqual(engagementQuery.length, 2); // Bob and Charlie liked the post
      const likerNames = engagementQuery.map(e => e[1]).sort();
      assert.deepStrictEqual(likerNames, ['Bob', 'Charlie']);
    });

    it('should handle organizational hierarchy with departments and employees', () => {
      const schema = {
        ':employee/manager': { valueType: 'ref' },
        ':employee/department': { valueType: 'ref' },
        ':employee/reports': { card: 'many', valueType: 'ref' },
        ':department/head': { valueType: 'ref' },
        ':department/employees': { card: 'many', valueType: 'ref' },
        ':company/departments': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create company
      const company = store.createEntity({
        ':company/name': 'Tech Corp',
        ':company/founded': 2010
      });
      
      // Create departments
      const engineering = store.createEntity({
        ':department/name': 'Engineering',
        ':department/budget': 1000000
      });
      
      const design = store.createEntity({
        ':department/name': 'Design', 
        ':department/budget': 500000
      });
      
      // Create employees
      const cto = store.createEntity({
        ':employee/name': 'CTO',
        ':employee/level': 'executive',
        ':employee/salary': 200000
      });
      
      const engineeringManager = store.createEntity({
        ':employee/name': 'Engineering Manager',
        ':employee/level': 'manager',
        ':employee/salary': 150000,
        ':employee/manager': cto.entityId,
        ':employee/department': engineering.entityId
      });
      
      const seniorDev1 = store.createEntity({
        ':employee/name': 'Senior Dev 1',
        ':employee/level': 'senior',
        ':employee/salary': 120000,
        ':employee/manager': engineeringManager.entityId,
        ':employee/department': engineering.entityId
      });
      
      const seniorDev2 = store.createEntity({
        ':employee/name': 'Senior Dev 2',
        ':employee/level': 'senior', 
        ':employee/salary': 125000,
        ':employee/manager': engineeringManager.entityId,
        ':employee/department': engineering.entityId
      });
      
      const juniorDev = store.createEntity({
        ':employee/name': 'Junior Dev',
        ':employee/level': 'junior',
        ':employee/salary': 80000,
        ':employee/manager': seniorDev1.entityId,
        ':employee/department': engineering.entityId
      });
      
      // Set up department relationships
      store.conn.transact([
        ['+', company.entityId, ':company/departments', engineering.entityId],
        ['+', company.entityId, ':company/departments', design.entityId],
        ['+', engineering.entityId, ':department/head', engineeringManager.entityId],
        ['+', engineering.entityId, ':department/employees', engineeringManager.entityId],
        ['+', engineering.entityId, ':department/employees', seniorDev1.entityId],
        ['+', engineering.entityId, ':department/employees', seniorDev2.entityId],
        ['+', engineering.entityId, ':department/employees', juniorDev.entityId],
        
        // Management hierarchy
        ['+', cto.entityId, ':employee/reports', engineeringManager.entityId],
        ['+', engineeringManager.entityId, ':employee/reports', seniorDev1.entityId],
        ['+', engineeringManager.entityId, ':employee/reports', seniorDev2.entityId],
        ['+', seniorDev1.entityId, ':employee/reports', juniorDev.entityId]
      ]);
      
      // Create proxies
      const ctoProxy = new EntityProxy(cto.entityId, store);
      const managerProxy = new EntityProxy(engineeringManager.entityId, store);
      const seniorDev1Proxy = new EntityProxy(seniorDev1.entityId, store);
      const engineeringProxy = new EntityProxy(engineering.entityId, store);
      
      // Test organizational queries through proxies
      
      // CTO's direct reports
      const ctoReports = ctoProxy.query({
        find: ['?name', '?level'],
        where: [
          ['?this', ':employee/reports', '?report'],
          ['?report', ':employee/name', '?name'],
          ['?report', ':employee/level', '?level']
        ]
      });
      assert.strictEqual(ctoReports.length, 1);
      assert.strictEqual(ctoReports[0][0], 'Engineering Manager');
      
      // Engineering manager's team
      const managerTeam = managerProxy.query({
        find: ['?name', '?level'],
        where: [
          ['?this', ':employee/reports', '?report'],
          ['?report', ':employee/name', '?name'],
          ['?report', ':employee/level', '?level']
        ]
      });
      assert.strictEqual(managerTeam.length, 2);
      const teamLevels = managerTeam.map(r => r[1]);
      assert.ok(teamLevels.every(level => level === 'senior'));
      
      // Department employees
      const deptEmployees = engineeringProxy.query({
        find: ['?name', '?salary'],
        where: [
          ['?this', ':department/employees', '?emp'],
          ['?emp', ':employee/name', '?name'],
          ['?emp', ':employee/salary', '?salary']
        ]
      });
      assert.strictEqual(deptEmployees.length, 4);
      
      // Senior dev's mentees
      const mentees = seniorDev1Proxy.query({
        find: ['?name', '?level'],
        where: [
          ['?this', ':employee/reports', '?mentee'],
          ['?mentee', ':employee/name', '?name'],
          ['?mentee', ':employee/level', '?level']
        ]
      });
      assert.strictEqual(mentees.length, 1);
      assert.strictEqual(mentees[0][0], 'Junior Dev');
      assert.strictEqual(mentees[0][1], 'junior');
    });

    it('should handle e-commerce scenario with orders and products', () => {
      const schema = {
        ':user/orders': { card: 'many', valueType: 'ref' },
        ':order/customer': { valueType: 'ref' },
        ':order/items': { card: 'many', valueType: 'ref' },
        ':order-item/product': { valueType: 'ref' },
        ':order-item/order': { valueType: 'ref' },
        ':product/category': { valueType: 'ref' },
        ':category/products': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create categories
      const electronics = store.createEntity({
        ':category/name': 'Electronics',
        ':category/description': 'Electronic devices and gadgets'
      });
      
      const books = store.createEntity({
        ':category/name': 'Books',
        ':category/description': 'Books and educational materials'
      });
      
      // Create products
      const laptop = store.createEntity({
        ':product/name': 'Gaming Laptop',
        ':product/price': 1299.99,
        ':product/stock': 10,
        ':product/category': electronics.entityId
      });
      
      const mouse = store.createEntity({
        ':product/name': 'Wireless Mouse',
        ':product/price': 29.99,
        ':product/stock': 50,
        ':product/category': electronics.entityId
      });
      
      const jsBook = store.createEntity({
        ':product/name': 'JavaScript Guide',
        ':product/price': 49.99,
        ':product/stock': 25,
        ':product/category': books.entityId
      });
      
      // Create customers
      const customer = store.createEntity({
        ':user/name': 'Customer',
        ':user/email': 'customer@example.com',
        ':user/memberSince': 2023
      });
      
      // Create order
      const order = store.createEntity({
        ':order/id': 'ORD-001',
        ':order/date': '2023-12-01',
        ':order/status': 'completed',
        ':order/total': 1379.97,
        ':order/customer': customer.entityId
      });
      
      // Create order items
      const orderItem1 = store.createEntity({
        ':order-item/product': laptop.entityId,
        ':order-item/quantity': 1,
        ':order-item/price': 1299.99,
        ':order-item/order': order.entityId
      });
      
      const orderItem2 = store.createEntity({
        ':order-item/product': mouse.entityId,
        ':order-item/quantity': 2,
        ':order-item/price': 59.98,
        ':order-item/order': order.entityId
      });
      
      const orderItem3 = store.createEntity({
        ':order-item/product': jsBook.entityId,
        ':order-item/quantity': 1,
        ':order-item/price': 49.99,
        ':order-item/order': order.entityId
      });
      
      // Link relationships
      store.conn.transact([
        ['+', customer.entityId, ':user/orders', order.entityId],
        ['+', order.entityId, ':order/items', orderItem1.entityId],
        ['+', order.entityId, ':order/items', orderItem2.entityId],
        ['+', order.entityId, ':order/items', orderItem3.entityId],
        ['+', electronics.entityId, ':category/products', laptop.entityId],
        ['+', electronics.entityId, ':category/products', mouse.entityId],
        ['+', books.entityId, ':category/products', jsBook.entityId]
      ]);
      
      // Create proxies for testing
      const customerProxy = new EntityProxy(customer.entityId, store);
      const orderProxy = new EntityProxy(order.entityId, store);
      const electronicsProxy = new EntityProxy(electronics.entityId, store);
      
      // Test customer order history
      const customerOrders = customerProxy.query({
        find: ['?order-id', '?total', '?status'],
        where: [
          ['?this', ':user/orders', '?order'],
          ['?order', ':order/id', '?order-id'],
          ['?order', ':order/total', '?total'],
          ['?order', ':order/status', '?status']
        ]
      });
      
      assert.strictEqual(customerOrders.length, 1);
      assert.strictEqual(customerOrders[0][0], 'ORD-001');
      assert.strictEqual(customerOrders[0][1], 1379.97);
      assert.strictEqual(customerOrders[0][2], 'completed');
      
      // Test order items through order proxy
      const orderItems = orderProxy.query({
        find: ['?product-name', '?quantity', '?price'],
        where: [
          ['?this', ':order/items', '?item'],
          ['?item', ':order-item/product', '?product'],
          ['?product', ':product/name', '?product-name'],
          ['?item', ':order-item/quantity', '?quantity'],
          ['?item', ':order-item/price', '?price']
        ]
      });
      
      assert.strictEqual(orderItems.length, 3);
      
      // Test category products
      const electronicsProducts = electronicsProxy.query({
        find: ['?product-name', '?price'],
        where: [
          ['?this', ':category/products', '?product'],
          ['?product', ':product/name', '?product-name'],
          ['?product', ':product/price', '?price']
        ]
      });
      
      assert.strictEqual(electronicsProducts.length, 2);
      const productNames = electronicsProducts.map(p => p[0]).sort();
      assert.deepStrictEqual(productNames, ['Gaming Laptop', 'Wireless Mouse']);
    });

    it('should handle blog platform with nested comments', () => {
      const schema = {
        ':user/posts': { card: 'many', valueType: 'ref' },
        ':post/author': { valueType: 'ref' },
        ':post/comments': { card: 'many', valueType: 'ref' },
        ':comment/author': { valueType: 'ref' },
        ':comment/post': { valueType: 'ref' },
        ':comment/parent': { valueType: 'ref' },
        ':comment/replies': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create users
      const author = store.createEntity({ ':user/name': 'Author', ':user/role': 'writer' });
      const commenter1 = store.createEntity({ ':user/name': 'Commenter1', ':user/role': 'reader' });
      const commenter2 = store.createEntity({ ':user/name': 'Commenter2', ':user/role': 'reader' });
      
      // Create blog post
      const blogPost = store.createEntity({
        ':post/title': 'Getting Started with DataScript',
        ':post/content': 'DataScript provides immutable databases...',
        ':post/author': author.entityId,
        ':post/published': true,
        ':post/views': 1000
      });
      
      // Create top-level comments
      const comment1 = store.createEntity({
        ':comment/content': 'Great introduction!',
        ':comment/author': commenter1.entityId,
        ':comment/post': blogPost.entityId,
        ':comment/timestamp': '2023-12-01T10:00:00Z'
      });
      
      const comment2 = store.createEntity({
        ':comment/content': 'Very helpful, thanks!',
        ':comment/author': commenter2.entityId,
        ':comment/post': blogPost.entityId,
        ':comment/timestamp': '2023-12-01T11:00:00Z'
      });
      
      // Create nested replies
      const reply1 = store.createEntity({
        ':comment/content': 'Glad you found it useful!',
        ':comment/author': author.entityId,
        ':comment/post': blogPost.entityId,
        ':comment/parent': comment1.entityId,
        ':comment/timestamp': '2023-12-01T10:30:00Z'
      });
      
      const reply2 = store.createEntity({
        ':comment/content': 'Agreed, excellent work!',
        ':comment/author': commenter2.entityId,
        ':comment/post': blogPost.entityId,
        ':comment/parent': comment1.entityId,
        ':comment/timestamp': '2023-12-01T10:45:00Z'
      });
      
      // Link relationships
      store.conn.transact([
        ['+', author.entityId, ':user/posts', blogPost.entityId],
        ['+', blogPost.entityId, ':post/comments', comment1.entityId],
        ['+', blogPost.entityId, ':post/comments', comment2.entityId],
        ['+', blogPost.entityId, ':post/comments', reply1.entityId],
        ['+', blogPost.entityId, ':post/comments', reply2.entityId],
        ['+', comment1.entityId, ':comment/replies', reply1.entityId],
        ['+', comment1.entityId, ':comment/replies', reply2.entityId]
      ]);
      
      // Create proxies
      const authorProxy = new EntityProxy(author.entityId, store);
      const blogPostProxy = new EntityProxy(blogPost.entityId, store);
      const comment1Proxy = new EntityProxy(comment1.entityId, store);
      
      // Test author's posts
      const authorPosts = authorProxy.query({
        find: ['?title', '?views'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?title'],
          ['?post', ':post/views', '?views']
        ]
      });
      
      assert.strictEqual(authorPosts.length, 1);
      assert.strictEqual(authorPosts[0][0], 'Getting Started with DataScript');
      assert.strictEqual(authorPosts[0][1], 1000);
      
      // Test post comments
      const postComments = blogPostProxy.query({
        find: ['?content', '?author-name'],
        where: [
          ['?this', ':post/comments', '?comment'],
          ['?comment', ':comment/content', '?content'],
          ['?comment', ':comment/author', '?author'],
          ['?author', ':user/name', '?author-name']
        ]
      });
      
      assert.strictEqual(postComments.length, 4); // 2 top-level + 2 replies
      
      // Test comment replies
      const commentReplies = comment1Proxy.query({
        find: ['?reply-content', '?author-name'],
        where: [
          ['?this', ':comment/replies', '?reply'],
          ['?reply', ':comment/content', '?reply-content'],
          ['?reply', ':comment/author', '?author'],
          ['?author', ':user/name', '?author-name']
        ]
      });
      
      assert.strictEqual(commentReplies.length, 2);
      const replyAuthors = commentReplies.map(r => r[1]).sort();
      assert.deepStrictEqual(replyAuthors, ['Author', 'Commenter2']);
    });

    it('should handle subscription and reactivity across entity network', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/posts': { card: 'many', valueType: 'ref' },
        ':post/author': { valueType: 'ref' },
        ':post/likes': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create social network
      const alice = store.createEntity({ ':user/name': 'Alice', ':user/influence': 0 });
      const bob = store.createEntity({ ':user/name': 'Bob', ':user/influence': 0 });
      const charlie = store.createEntity({ ':user/name': 'Charlie', ':user/influence': 0 });
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Set up friendships
      aliceProxy.addRelation(':user/friends', bobProxy);
      aliceProxy.addRelation(':user/friends', charlieProxy);
      bobProxy.addRelation(':user/friends', aliceProxy);
      
      // Set up computed properties for influence
      aliceProxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      bobProxy.computed('friendCount', {
        find: ['?friend'],
        where: [['?this', ':user/friends', '?friend']]
      }, (results) => results.length);
      
      // Set up subscriptions for activity monitoring
      let aliceActivityLog = [];
      let bobActivityLog = [];
      
      const unsubAlice = aliceProxy.subscribe({
        find: ['?friend-name'],
        where: [
          ['?this', ':user/friends', '?friend'],
          ['?friend', ':user/name', '?friend-name']
        ]
      }, (results) => {
        aliceActivityLog.push({ type: 'friends-changed', count: results.length });
      });
      
      const unsubBob = bobProxy.subscribe({
        find: ['?post-title'],
        where: [
          ['?this', ':user/posts', '?post'],
          ['?post', ':post/title', '?post-title']
        ]
      }, (results) => {
        bobActivityLog.push({ type: 'posts-changed', count: results.length });
      });
      
      // Test initial state
      assert.strictEqual(aliceProxy.friendCount, 2);
      assert.strictEqual(bobProxy.friendCount, 1);
      
      // Create posts
      const alicePost = store.createEntity({
        ':post/title': 'My First Post',
        ':post/content': 'Hello world!',
        ':post/author': alice.entityId
      });
      
      const bobPost = store.createEntity({
        ':post/title': 'Bob\'s Thoughts',
        ':post/content': 'Thinking about reactive data...',
        ':post/author': bob.entityId
      });
      
      // Link posts to users
      aliceProxy.addRelation(':user/posts', alicePost.entityId);
      bobProxy.addRelation(':user/posts', bobPost.entityId);
      
      // Test post relationships
      const alicePosts = aliceProxy.get(':user/posts');
      assert.strictEqual(alicePosts.length, 1);
      assert.strictEqual(alicePosts[0].get(':post/title'), 'My First Post');
      
      // Add more complex interactions
      charlieProxy.addRelation(':user/friends', bobProxy);
      
      // Note: Computed properties only update on entity's own changes
      // Charlie adding Bob as friend doesn't invalidate Bob's computed properties
      // This is expected behavior - only changes to Bob's own entity invalidate Bob's cache
      
      // Test friend counts - Bob's count won't change because Charlie added the relationship
      assert.strictEqual(aliceProxy.friendCount, 2);
      assert.strictEqual(bobProxy.friendCount, 1); // Bob's own friends, Charlie's addition doesn't affect this
      
      // Clean up
      unsubAlice();
      unsubBob();
    });

    it('should handle concurrent operations across multiple entities', () => {
      const schema = {
        ':user/team': { valueType: 'ref' },
        ':team/members': { card: 'many', valueType: 'ref' },
        ':team/projects': { card: 'many', valueType: 'ref' },
        ':project/assignees': { card: 'many', valueType: 'ref' },
        ':project/team': { valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create teams
      const teamA = store.createEntity({ ':team/name': 'Team Alpha', ':team/budget': 100000 });
      const teamB = store.createEntity({ ':team/name': 'Team Beta', ':team/budget': 150000 });
      
      // Create users and assign to teams
      const users = [];
      const proxies = [];
      
      for (let i = 0; i < 10; i++) {
        const user = store.createEntity({
          ':user/name': `User${i}`,
          ':user/id': `user-${i}`,
          ':user/team': i < 5 ? teamA.entityId : teamB.entityId
        });
        
        const proxy = new EntityProxy(user.entityId, store);
        users.push(user);
        proxies.push(proxy);
        
        // Add user to appropriate team
        const teamId = i < 5 ? teamA.entityId : teamB.entityId;
        store.conn.transact([
          ['+', teamId, ':team/members', user.entityId]
        ]);
      }
      
      // Create projects
      const project1 = store.createEntity({
        ':project/name': 'Project X',
        ':project/deadline': '2024-01-01',
        ':project/team': teamA.entityId
      });
      
      const project2 = store.createEntity({
        ':project/name': 'Project Y',
        ':project/deadline': '2024-02-01',
        ':project/team': teamB.entityId
      });
      
      // Assign projects to teams and users
      store.conn.transact([
        ['+', teamA.entityId, ':team/projects', project1.entityId],
        ['+', teamB.entityId, ':team/projects', project2.entityId],
        ['+', project1.entityId, ':project/assignees', users[0].entityId],
        ['+', project1.entityId, ':project/assignees', users[1].entityId],
        ['+', project1.entityId, ':project/assignees', users[2].entityId],
        ['+', project2.entityId, ':project/assignees', users[5].entityId],
        ['+', project2.entityId, ':project/assignees', users[6].entityId],
        ['+', project2.entityId, ':project/assignees', users[7].entityId]
      ]);
      
      const teamAProxy = new EntityProxy(teamA.entityId, store);
      const project1Proxy = new EntityProxy(project1.entityId, store);
      
      // Test team membership
      const teamAMembers = teamAProxy.query({
        find: ['?member-name', '?member-id'],
        where: [
          ['?this', ':team/members', '?member'],
          ['?member', ':user/name', '?member-name'],
          ['?member', ':user/id', '?member-id']
        ]
      });
      
      assert.strictEqual(teamAMembers.length, 5);
      
      // Test project assignees
      const projectAssignees = project1Proxy.query({
        find: ['?assignee-name'],
        where: [
          ['?this', ':project/assignees', '?assignee'],
          ['?assignee', ':user/name', '?assignee-name']
        ]
      });
      
      assert.strictEqual(projectAssignees.length, 3);
      
      // Test team projects
      const teamProjects = teamAProxy.query({
        find: ['?project-name', '?deadline'],
        where: [
          ['?this', ':team/projects', '?project'],
          ['?project', ':project/name', '?project-name'],
          ['?project', ':project/deadline', '?deadline']
        ]
      });
      
      assert.strictEqual(teamProjects.length, 1);
      assert.strictEqual(teamProjects[0][0], 'Project X');
      assert.strictEqual(teamProjects[0][1], '2024-01-01');
      
      // Test concurrent operations
      // Update multiple entities simultaneously
      proxies.forEach((proxy, index) => {
        proxy.update({ ':user/lastActive': `2023-12-${String(index + 1).padStart(2, '0')}` });
      });
      
      // Verify all updates worked
      proxies.forEach((proxy, index) => {
        const lastActive = proxy.get(':user/lastActive');
        assert.strictEqual(lastActive, `2023-12-${String(index + 1).padStart(2, '0')}`);
      });
    });

    it('should handle entity deletion with relationships', () => {
      const schema = {
        ':user/friends': { card: 'many', valueType: 'ref' },
        ':user/posts': { card: 'many', valueType: 'ref' }
      };
      
      const store = createDataStore({ schema });
      
      // Create simple entity network
      const alice = store.createEntity({ ':user/name': 'Alice' });
      const bob = store.createEntity({ ':user/name': 'Bob' });
      const charlie = store.createEntity({ ':user/name': 'Charlie' });
      
      // Create relationships
      store.conn.transact([
        ['+', alice.entityId, ':user/friends', bob.entityId],
        ['+', alice.entityId, ':user/friends', charlie.entityId],
        ['+', bob.entityId, ':user/friends', alice.entityId],
        ['+', charlie.entityId, ':user/friends', alice.entityId]
      ]);
      
      const aliceProxy = new EntityProxy(alice.entityId, store);
      const bobProxy = new EntityProxy(bob.entityId, store);
      const charlieProxy = new EntityProxy(charlie.entityId, store);
      
      // Verify initial relationships
      assert.strictEqual(aliceProxy.get(':user/friends').length, 2);
      assert.strictEqual(bobProxy.get(':user/friends').length, 1);
      assert.strictEqual(charlieProxy.get(':user/friends').length, 1);
      
      // All should be valid initially
      assert.ok(aliceProxy.isValid());
      assert.ok(bobProxy.isValid());
      assert.ok(charlieProxy.isValid());
      
      // Delete Alice
      aliceProxy.delete();
      
      // Alice should become invalid
      assert.ok(!aliceProxy.isValid());
      assert.strictEqual(aliceProxy.get(':user/friends'), undefined);
      
      // Bob and Charlie should still be valid
      assert.ok(bobProxy.isValid());
      assert.ok(charlieProxy.isValid());
      
      // Note: DataScript retractEntity only removes Alice's own attributes, not references to Alice
      // Bob and Charlie will still have references to Alice (but as invalid proxies)
      const bobFriends = bobProxy.get(':user/friends');
      const charlieFriends = charlieProxy.get(':user/friends');
      
      // These should be arrays 
      assert.ok(Array.isArray(bobFriends));
      assert.ok(Array.isArray(charlieFriends));
      
      // References to Alice will still exist but as invalid proxies
      const aliceRefInBob = bobFriends.find(f => f.entityId === alice.entityId);
      const aliceRefInCharlie = charlieFriends.find(f => f.entityId === alice.entityId);
      
      if (aliceRefInBob) {
        assert.ok(!aliceRefInBob.isValid()); // Alice proxy should be invalid
      }
      if (aliceRefInCharlie) {
        assert.ok(!aliceRefInCharlie.isValid()); // Alice proxy should be invalid
      }
    });
  });
});