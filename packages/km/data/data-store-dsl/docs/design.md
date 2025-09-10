# Data-Store DSL Design Document

## Overview

Data-Store DSL is a template literal Domain-Specific Language that provides an intuitive, readable syntax for defining schemas, writing queries, and performing updates in the data-store reactive system. Built using JavaScript's tagged template literals, it offers a natural language-like interface while maintaining full compatibility with the underlying DataScript engine and data-store proxy system.

### Core Problem

The current data-store API, while powerful, uses verbose object syntax that can be cumbersome for common operations:

```javascript
// Current verbose syntax
const friends = userProxy.query({
  find: ['?friend-name', '?friend-age'],
  where: [
    ['?this', ':user/friends', '?friend'],
    ['?friend', ':user/name', '?friend-name'],
    ['?friend', ':user/age', '?friend-age'],
    [(age) => age >= 25, '?friend-age']
  ]
});

userProxy.update({
  ':user/name': 'Alice Smith',
  ':user/age': 31,
  ':user/active': true
});
```

### Solution: Template Literal DSL

Transform this into readable, natural language syntax:

```javascript
// Natural DSL syntax
const friends = userProxy.query`
  find ?friend-name ?friend-age
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/age ?friend-age
        ?friend-age >= 25
`;

userProxy.update`
  user/name = "Alice Smith"
  user/age = 31
  user/active = true
`;
```

## Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Template Literal  │───→│    DSL Parser       │───→│   Data-Store API    │
│   DSL Syntax        │    │                     │    │   (Existing)        │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                           │                          │
         │                           ▼                          │
         │                  ┌─────────────────────┐             │
         │                  │   Tagged Template   │             │
         │                  │   Literal Functions │             │
         │                  └─────────────────────┘             │
         │                           │                          │
         └───────────────────────────┼──────────────────────────┘
                                     ▼
                            ┌─────────────────────┐
                            │   DataScript JS     │
                            │   (Immutable DB)    │
                            └─────────────────────┘
```

### Components

1. **DSL Parser**: Converts template literals to data-store object format
2. **Schema DSL**: Natural schema definition language
3. **Query DSL**: Readable Datalog query syntax
4. **Update DSL**: Intuitive update and relationship management
5. **Integration Layer**: Seamless connection with data-store proxy objects

## Schema DSL

### Schema Definition Syntax

```javascript
const schema = defineSchema`
  // Basic attributes with types
  user/name: string
  user/age: number  
  user/active: boolean
  user/joinDate: instant
  
  // Unique constraints
  user/email: unique value string
  user/id: unique identity string
  
  // References to other entities
  user/manager: ref -> user
  user/profile: ref -> profile
  
  // Many-cardinality attributes
  user/tags: many string
  user/friends: many ref -> user
  user/posts: many ref -> post
  
  // Component relationships (cascade delete)
  user/profile: ref component -> profile
  organization/departments: many ref component -> department
  
  // Multiple entity definitions in one schema
  profile/bio: string
  profile/skills: many string
  profile/experience: number
  
  post/title: string
  post/content: string
  post/published: boolean
  post/author: ref -> user
  post/tags: many string
`;
```

### Schema Grammar

**Basic Attribute Definition:**
```
entity/attribute: [constraints] type [-> reference-target]
```

**Constraint Keywords:**
- `unique value` - Unique constraint on attribute value
- `unique identity` - Unique identity constraint for entity lookup
- `many` - Cardinality many (default is one)
- `component` - Component relationship with cascade operations

**Type Keywords:**
- `string` - String values
- `number` - Numeric values
- `boolean` - Boolean values
- `instant` - Date/time values
- `ref` - Reference to another entity (requires `-> target`)

**Reference Syntax:**
- `-> target` - Specifies reference target entity type
- Required when using `ref` type
- Target can be same entity type for self-references

### Schema Processing Example

```javascript
// DSL Input
defineSchema`
  user/email: unique value string
  user/friends: many ref -> user
`

// Converts to DataScript Schema
{
  ':user/email': { unique: 'value', valueType: 'string' },
  ':user/friends': { card: 'many', valueType: 'ref' }
}
```

## Query DSL

### Query Syntax

```javascript
// Basic entity-rooted queries
const userInfo = userProxy.query`
  find ?name ?age ?email
  where ?this user/name ?name
        ?this user/age ?age  
        ?this user/email ?email
`;

// Relationship traversal
const friendNames = userProxy.query`
  find ?friend-name
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
`;

// Multi-hop relationship queries
const colleagueInfo = userProxy.query`
  find ?colleague-name ?department-name
  where ?this user/department ?dept
        ?dept department/employees ?colleague
        ?colleague user/name ?colleague-name
        ?dept department/name ?department-name
        ?colleague != ?this
`;

// Queries with predicates and filters
const adultFriends = userProxy.query`
  find ?friend-name ?friend-age
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/age ?friend-age
        ?friend-age >= 21
        ?friend user/active true
`;

// Complex joins with multiple conditions
const activeFriendsWithPosts = userProxy.query`
  find ?friend-name ?post-title ?post-likes
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/active true
        ?friend user/posts ?post
        ?post post/title ?post-title
        ?post post/published true
        ?post post/likes ?post-likes
        ?post-likes > 10
`;
```

### Query Grammar

**Find Clause:**
```
find ?variable1 ?variable2 [(aggregation ?var) as alias]
```

**Where Clause:**
```
where ?entity attribute ?value
      ?entity attribute literal-value
      ?variable operator value-or-expression
      ?variable != ?other-variable
```

**Supported Operators:**
- `=` - Equality (default, can be omitted)
- `!=` - Not equal  
- `>`, `>=`, `<`, `<=` - Numeric comparisons
- `contains` - String/collection contains check
- `startsWith`, `endsWith` - String operations
- `matches` - Regular expression matching

**Aggregation Functions:**
- `(count ?var)` - Count matching entities
- `(sum ?var)` - Sum numeric values
- `(avg ?var)` - Average of numeric values
- `(min ?var)`, `(max ?var)` - Minimum/maximum values
- `(distinct ?var)` - Distinct values only

### Advanced Query Features

```javascript
// Aggregations with grouping
const departmentStats = companyProxy.query`
  find ?dept-name (count ?employee) (avg ?salary)
  where ?this company/departments ?dept
        ?dept department/name ?dept-name
        ?dept department/employees ?employee
        ?employee employee/salary ?salary
`;

// Subqueries and exists checks
const managersWithReports = userProxy.query`
  find ?manager-name
  where ?this user/department ?dept
        ?dept department/employees ?manager
        ?manager user/name ?manager-name
        exists(?report user/manager ?manager)
`;

// Conditional logic
const eligibleForPromotion = userProxy.query`
  find ?employee-name ?performance
  where ?this user/department ?dept
        ?dept department/employees ?employee
        ?employee user/name ?employee-name
        ?employee user/performance ?performance
        ?employee user/tenure ?tenure
        ?performance >= 4.5
        ?tenure >= 2
`;
```

### Query Processing

The query DSL automatically:
1. **Parses natural language syntax** into DataScript query objects
2. **Injects ?this variable** for entity-rooted queries  
3. **Handles namespace conversion** (user/name → :user/name)
4. **Processes operators** into DataScript predicate functions
5. **Validates syntax** and provides helpful error messages

## Update DSL

### Update Syntax

```javascript
// Simple attribute assignments
userProxy.update`
  user/name = "Alice Johnson"
  user/age = 30
  user/bio = "Senior Software Engineer"
  user/active = true
`;

// Different value types
userProxy.update`
  user/score = 95.5
  user/level = 3
  user/tags = ["developer", "javascript", "react"]
  user/lastLogin = ${new Date()}
  user/preferences = ${userPreferences}
`;

// Reference assignments with entities
userProxy.update`
  user/manager = ${managerProxy}
  user/profile = ${profileEntity.entityId}
  user/department = ${departmentId}
`;

// Relationship operations for many-cardinality attributes  
userProxy.update`
  +user/friends = ${newFriendProxy}      // Add to friends collection
  -user/friends = ${formerFriendProxy}   // Remove from friends collection
  +user/skills = "TypeScript"           // Add skill
  -user/skills = "PHP"                  // Remove skill
  user/team = ${newTeamProxy}           // Replace team reference
`;

// Batch relationship updates
userProxy.update`
  user/friends = [${bob}, ${charlie}, ${diana}]  // Replace entire collection
  +user/tags = ["expert", "mentor", "speaker"]   // Add multiple tags
  -user/tags = ["beginner", "learning"]          // Remove multiple tags
`;

// Expression evaluation
userProxy.update`
  user/loginCount = ${currentCount + 1}
  user/fullName = user/firstName + " " + user/lastName
  user/lastUpdate = ${Date.now()}
`;
```

### Update Grammar

**Assignment Syntax:**
```
attribute = value
attribute = ${javascript-expression}
attribute = [value1, value2, ...]
```

**Relationship Operations:**
```
+attribute = entity     // Add to many-cardinality collection
-attribute = entity     // Remove from many-cardinality collection
attribute = entity      // Set/replace (works for one and many cardinality)
```

**Value Types:**
- **String literals**: `"text"`, `'text'`
- **Numbers**: `42`, `3.14`, `-10`
- **Booleans**: `true`, `false`
- **Arrays**: `["item1", "item2"]`, `[1, 2, 3]`
- **JavaScript expressions**: `${variable}`, `${entity.entityId}`, `${calculateValue()}`

### Update Processing

The update DSL:
1. **Parses assignment statements** into key-value pairs
2. **Handles relationship operators** (+/-) for collection operations  
3. **Evaluates JavaScript expressions** within `${}`
4. **Converts to transaction format** compatible with data-store
5. **Validates against schema** constraints and types

## Advanced DSL Features

### Subscription DSL

```javascript
// Reactive subscriptions with natural syntax
const unsubscribe = userProxy.subscribe`
  find ?post-title ?post-likes ?comment-count
  where ?this user/posts ?post
        ?post post/title ?post-title
        ?post post/published true
        ?post post/likes ?post-likes
        (count ?post post/comments) ?comment-count
` |> (results, changes) => {
  console.log('User posts updated:', results);
  updateDashboard(results);
};

// Subscription with filters
const friendActivitySub = userProxy.subscribe`
  find ?friend-name ?activity-type ?activity-time
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/activities ?activity
        ?activity activity/type ?activity-type
        ?activity activity/timestamp ?activity-time
        ?activity-time >= ${startOfToday}
` |> handleFriendActivity;
```

### Computed Property DSL

```javascript
// Computed properties with query DSL
userProxy.computed('socialScore', query`
  find (count ?like) (count ?follower)
  where ?this user/posts ?post
        ?post post/likes ?like
        ?this user/followers ?follower
`, ([totalLikes, followerCount]) => totalLikes + followerCount * 5);

// Alternative computed property syntax
userProxy.computed`
  influenceScore = (count ?like) * 2 + (count ?follower) * 5
  where ?this user/posts ?post, ?post post/likes ?like
        ?this user/followers ?follower
`;

// Computed properties with complex logic
userProxy.computed('recommendation', query`
  find ?friend-name ?mutual-count
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        (count ?friend user/friends ?mutual, ?this user/friends ?mutual) ?mutual-count
        ?mutual-count >= 3
`, recommendations => recommendations[0] || 'No recommendations');
```

### Relationship Traversal DSL

```javascript
// Shorthand for common relationship patterns
const friendPosts = userProxy.friends.posts.where`published = true`;
const managerEmail = userProxy.manager.profile.email;
const teamMembers = userProxy.department.employees.where`active = true`;

// Equivalent to full query syntax
const friendPosts = userProxy.query`
  find ?post
  where ?this user/friends ?friend
        ?friend user/posts ?post
        ?post post/published true
`;
```

## Integration with Data-Store

### Seamless API Integration

The DSL integrates seamlessly with existing data-store functionality:

```javascript
import { createDataStore, EntityProxy } from 'data-store';
import { defineSchema, query, update } from 'data-store-dsl';

// Create store with DSL schema
const store = createDataStore({ 
  schema: defineSchema`
    user/name: string
    user/email: unique value string
    user/friends: many ref -> user
    user/posts: many ref -> post
    
    post/title: string
    post/author: ref -> user
    post/published: boolean
  `
});

// Create entities (existing API)
const alice = store.createEntity({ ':user/name': 'Alice' });
const aliceProxy = new EntityProxy(alice.entityId, store);

// Mix DSL and object syntax freely
aliceProxy.update`user/email = "alice@example.com"`;

aliceProxy.update({
  ':user/bio': 'Complex bio with special characters'
});

// Query with DSL
const friends = aliceProxy.query`
  find ?friend-name
  where ?this user/friends ?friend, ?friend user/name ?friend-name
`;

// Subscribe with DSL
const unsubscribe = aliceProxy.subscribe`
  find ?post-title
  where ?this user/posts ?post, ?post post/title ?post-title
` |> (results) => updateUI(results);
```

### Backward Compatibility

All existing data-store code continues to work unchanged:

```javascript
// Existing object syntax still works
const existingQuery = userProxy.query({
  find: ['?name'],
  where: [['?this', ':user/name', '?name']]
});

// Can be mixed with DSL syntax
userProxy.computed('info', query`
  find ?name ?age  
  where ?this user/name ?name, ?this user/age ?age
`, results => `${results[0][0]} (${results[0][1]})`);
```

## Detailed Feature Specifications

### Schema DSL Features

**Entity Namespacing:**
```javascript
// Automatic entity grouping
defineSchema`
  user/name: string
  user/age: number
  
  post/title: string
  post/author: ref -> user
  
  comment/content: string
  comment/post: ref -> post
`;
```

**Constraint Combinations:**
```javascript
defineSchema`
  user/email: unique value string
  organization/departments: many ref component -> department
  employee/manager: ref -> employee
  product/categories: many ref -> category
`;
```

**Type Validation:**
```javascript
defineSchema`
  // Numeric constraints
  user/age: number min(0) max(150)
  product/price: number precision(2)
  
  // String constraints
  user/username: string minLength(3) maxLength(20)
  user/email: string format(email)
  
  // Collection constraints  
  user/tags: many string maxItems(10)
`;
```

### Query DSL Features

**Variable Binding:**
```javascript
// Automatic variable inference
userProxy.query`
  find ?name ?age
  where ?this user/name ?name, ?this user/age ?age
`;

// Explicit variable binding
userProxy.query`
  find ?friend as friendName, ?age as friendAge  
  where ?this user/friends ?friend
        ?friend user/name ?friendName
        ?friend user/age ?friendAge
`;
```

**Predicate Expressions:**
```javascript
// Natural comparison operators
userProxy.query`
  find ?friend-name
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/age >= 21
        ?friend user/active = true
        ?friend user/bio contains "engineer"
`;

// Complex predicate logic
userProxy.query`
  find ?friend-name ?friend-score
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/score ?friend-score
        (?friend-score >= 80 and ?friend-score <= 100)
        ?friend user/department in ["Engineering", "Product"]
`;
```

**Aggregation and Grouping:**
```javascript
// Aggregation with grouping
const departmentStats = companyProxy.query`
  find ?dept-name (count ?employee) as headcount (avg ?salary) as avgSalary
  where ?this company/departments ?dept
        ?dept department/name ?dept-name
        ?dept department/employees ?employee
        ?employee employee/salary ?salary
  groupBy ?dept-name
`;

// Complex aggregations
const userEngagement = userProxy.query`
  find (sum ?likes) as totalLikes 
       (count ?post) as postCount
       (avg ?views) as avgViews
  where ?this user/posts ?post
        ?post post/likes ?likes
        ?post post/views ?views
        ?post post/published true
`;
```

### Update DSL Features

**Atomic Updates:**
```javascript
// Single transaction with multiple updates
userProxy.update`
  user/name = "Alice Smith"
  user/age = 31
  user/lastLogin = ${new Date()}
  user/loginCount = ${currentCount + 1}
  +user/tags = "senior"
  -user/tags = "junior"
`;
```

**Conditional Updates:**
```javascript
// Conditional assignment
userProxy.update`
  user/status = ${user.age >= 18 ? "adult" : "minor"}
  user/tier = ${user.score > 90 ? "premium" : "standard"}
  user/notifications = ${user.preferences.notifications || false}
`;
```

**Bulk Relationship Operations:**
```javascript
// Multiple relationship operations
userProxy.update`
  user/friends = [${alice}, ${bob}, ${charlie}]        // Replace all friends
  +user/skills = ["TypeScript", "GraphQL", "Docker"]   // Add multiple skills  
  -user/oldRoles = ["intern", "junior"]                // Remove multiple roles
  user/manager = ${newManagerProxy}                     // Update manager
  user/team = null                                      // Clear team assignment
`;
```

## Error Handling

### Syntax Error Reporting

The DSL provides detailed error messages with line and column information:

```javascript
// Schema syntax errors
defineSchema`
  user/age: invalid-type string
`;
// Error: "Unknown type 'invalid-type' at line 1, column 11. Valid types: string, number, boolean, ref, instant"

// Query syntax errors
userProxy.query`
  find ?name
  where ?this user/nonexistent ?name
`;
// Error: "Unknown attribute 'user/nonexistent' at line 2, column 15. Available attributes: user/name, user/age, user/email"

// Update syntax errors
userProxy.update`
  user/age = 
`;
// Error: "Missing value for assignment at line 1, column 12. Expected: number, string, boolean, array, or ${expression}"
```

### Runtime Validation

```javascript
// Type validation
userProxy.update`
  user/age = "thirty"  // Warning: Type mismatch - expected number, got string
`;

// Reference validation  
userProxy.update`
  user/manager = ${invalidEntity}  // Error: Invalid entity reference
`;

// Schema constraint validation
userProxy.update`
  user/email = "duplicate@example.com"  // Error: Unique constraint violation
`;
```

### Parser Error Recovery

```javascript
// Partial parsing with error isolation
userProxy.update`
  user/name = "Alice"        // ✅ Valid - will be processed
  user/invalid syntax here   // ❌ Error - will be reported but not block other updates  
  user/age = 30             // ✅ Valid - will be processed
`;
```

## Usage Examples

### Complete Social Media Application

```javascript
import { createDataStore, EntityProxy } from 'data-store';
import { defineSchema } from 'data-store-dsl';

// Define comprehensive social schema
const socialSchema = defineSchema`
  // User entity with full profile
  user/email: unique value string
  user/username: unique identity string  
  user/name: string
  user/bio: string
  user/avatar: string
  user/joinDate: instant
  user/lastActive: instant
  user/verified: boolean
  user/followerCount: number
  
  // User relationships
  user/friends: many ref -> user
  user/followers: many ref -> user
  user/following: many ref -> user
  user/blocked: many ref -> user
  user/posts: many ref -> post
  user/profile: ref component -> profile
  
  // Profile entity (component of user)
  profile/location: string
  profile/website: string
  profile/skills: many string
  profile/interests: many string
  profile/experience: number
  
  // Post entity
  post/title: string
  post/content: string
  post/published: boolean
  post/publishDate: instant
  post/author: ref -> user
  post/tags: many string
  post/visibility: string
  
  // Post engagement
  post/likes: many ref -> user
  post/shares: many ref -> user
  post/comments: many ref -> comment
  post/views: number
  
  // Comment entity
  comment/content: string
  comment/author: ref -> user
  comment/post: ref -> post
  comment/timestamp: instant
  comment/parent: ref -> comment
  comment/replies: many ref -> comment
`;

// Create social media store
const store = createDataStore({ schema: socialSchema });

// Create users
const alice = store.createEntity({ ':user/username': 'alice_dev' });
const bob = store.createEntity({ ':user/username': 'bob_design' });
const charlie = store.createEntity({ ':user/username': 'charlie_pm' });

const aliceProxy = new EntityProxy(alice.entityId, store);
const bobProxy = new EntityProxy(bob.entityId, store);
const charlieProxy = new EntityProxy(charlie.entityId, store);

// Set up user profiles with DSL
aliceProxy.update`
  user/name = "Alice Johnson"
  user/email = "alice@techcorp.com"
  user/bio = "Full-stack developer passionate about reactive programming and functional design"
  user/verified = true
  user/joinDate = ${new Date('2023-01-15')}
  user/followerCount = 150
`;

bobProxy.update`
  user/name = "Bob Chen" 
  user/email = "bob@designstudio.com"
  user/bio = "UX Designer crafting delightful user experiences"
  user/verified = true
  user/joinDate = ${new Date('2023-02-20')}
  user/followerCount = 200
`;

charlieProxy.update`
  user/name = "Charlie Rodriguez"
  user/email = "charlie@startup.io"
  user/bio = "Product Manager building the future of collaborative tools"
  user/verified = false
  user/joinDate = ${new Date('2023-03-10')}
  user/followerCount = 75
`;

// Create social connections
aliceProxy.update`
  +user/friends = ${bobProxy}
  +user/friends = ${charlieProxy}
  +user/following = ${bobProxy}
`;

bobProxy.update`
  +user/friends = ${aliceProxy}
  +user/followers = ${aliceProxy}
  +user/following = ${charlieProxy}
`;

// Create and link posts
const alicePost = store.createEntity({
  ':post/title': 'Building Reactive UIs with DataScript',
  ':post/author': alice.entityId
});

aliceProxy.update`
  +user/posts = ${alicePost.entityId}
`;

const postProxy = new EntityProxy(alicePost.entityId, store);

postProxy.update`
  post/content = "Exploring how DataScript's immutable database can power reactive user interfaces..."
  post/published = true
  post/publishDate = ${new Date()}
  post/tags = ["javascript", "react", "datascript", "reactive"]
  post/visibility = "public"
`;

// Add engagement
postProxy.update`
  +post/likes = ${bobProxy}
  +post/likes = ${charlieProxy}
  post/views = 1247
`;

// Create comments
const comment = store.createEntity({
  ':comment/author': bob.entityId,
  ':comment/post': alicePost.entityId
});

const commentProxy = new EntityProxy(comment.entityId, store);

commentProxy.update`
  comment/content = "Excellent insights! This approach could revolutionize how we handle state in complex applications."
  comment/timestamp = ${new Date()}
`;

postProxy.update`
  +post/comments = ${comment.entityId}
`;

// Query social network with DSL
const friendActivity = aliceProxy.query`
  find ?friend-name ?post-title ?like-count ?comment-count
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/posts ?post
        ?post post/title ?post-title
        ?post post/published true
        (count ?post post/likes) ?like-count
        (count ?post post/comments) ?comment-count
        ?post post/publishDate >= ${oneWeekAgo}
`;

// Find mutual connections
const mutualFriends = aliceProxy.query`
  find ?mutual-name ?mutual-bio
  where ?this user/friends ?friend
        ?friend user/friends ?mutual
        ?this user/friends ?mutual
        ?mutual user/name ?mutual-name
        ?mutual user/bio ?mutual-bio
        ?mutual != ?this
`;

// Discover content recommendations
const recommendedPosts = aliceProxy.query`
  find ?post-title ?author-name ?like-count
  where ?this user/following ?author
        ?author user/name ?author-name
        ?author user/posts ?post
        ?post post/title ?post-title
        ?post post/published true
        (count ?post post/likes) ?like-count
        ?like-count >= 5
        not(?this user/liked ?post)
  orderBy ?like-count desc
`;

// Set up reactive subscriptions
const friendPostsSub = aliceProxy.subscribe`
  find ?friend-name ?post-title ?publish-date
  where ?this user/friends ?friend
        ?friend user/name ?friend-name
        ?friend user/posts ?post
        ?post post/title ?post-title  
        ?post post/published true
        ?post post/publishDate ?publish-date
        ?publish-date >= ${todayStart}
` |> (results, changes) => {
  console.log(`${results.length} new posts from friends today`);
  updateFeedUI(results);
};

// Define computed social metrics
aliceProxy.computed('socialInfluence', query`
  find (count ?like) (count ?follower) (count ?share)
  where ?this user/posts ?post, ?post post/likes ?like
        ?this user/followers ?follower  
        ?this user/posts ?post, ?post post/shares ?share
`, ([likes, followers, shares]) => {
  return (likes * 1) + (followers * 5) + (shares * 10);
});

aliceProxy.computed('engagementRate', query`
  find (avg ?likes) ?followerCount
  where ?this user/posts ?post, (count ?post post/likes) ?likes
        ?this user/followers ?followerCount
`, ([avgLikes, followers]) => {
  return followers > 0 ? (avgLikes / followers * 100) : 0;
});

// Access computed properties
console.log(`Alice's influence score: ${aliceProxy.socialInfluence}`);
console.log(`Alice's engagement rate: ${aliceProxy.engagementRate}%`);
```

### E-Commerce Platform Example

```javascript
const ecommerceSchema = defineSchema`
  // Customer entity
  customer/email: unique value string
  customer/name: string
  customer/address: ref component -> address
  customer/orders: many ref -> order
  customer/wishlist: many ref -> product
  
  // Product entity
  product/sku: unique identity string
  product/name: string
  product/description: string
  product/price: number
  product/category: ref -> category
  product/inStock: boolean
  product/inventory: number
  
  // Order entity
  order/id: unique identity string
  order/customer: ref -> customer
  order/items: many ref -> orderItem
  order/status: string
  order/total: number
  order/date: instant
  
  // Order item entity
  orderItem/product: ref -> product
  orderItem/quantity: number
  orderItem/price: number
  
  // Category entity
  category/name: string
  category/products: many ref -> product
  category/parent: ref -> category
  category/subcategories: many ref -> category
  
  // Address entity (component)
  address/street: string
  address/city: string
  address/state: string
  address/zipCode: string
  address/country: string
`;

const store = createDataStore({ schema: ecommerceSchema });

// Create customer and address
const customer = store.createEntity({ ':customer/email': 'customer@example.com' });
const customerProxy = new EntityProxy(customer.entityId, store);

customerProxy.update`
  customer/name = "John Smith"
  customer/email = "john.smith@email.com"
`;

// Create address as component
const address = store.createEntity({
  ':address/street': '123 Main St',
  ':address/city': 'San Francisco'
});

customerProxy.update`
  customer/address = ${address.entityId}
`;

// Query customer order history
const orderHistory = customerProxy.query`
  find ?order-id ?order-date ?order-total ?order-status
  where ?this customer/orders ?order
        ?order order/id ?order-id
        ?order order/date ?order-date
        ?order order/total ?order-total
        ?order order/status ?order-status
  orderBy ?order-date desc
`;

// Find recommended products
const recommendations = customerProxy.query`
  find ?product-name ?product-price ?category-name
  where ?this customer/orders ?order
        ?order order/items ?item
        ?item orderItem/product ?purchased
        ?purchased product/category ?category
        ?category category/products ?product
        ?product product/name ?product-name
        ?product product/price ?product-price
        ?category category/name ?category-name
        ?product product/inStock true
        not(?this customer/orders ?otherOrder, 
            ?otherOrder order/items ?otherItem,
            ?otherItem orderItem/product ?product)
`;
```

## Key Design Decisions

### Why Template Literals?

**Benefits:**
- **Familiar**: Uses standard JavaScript syntax developers already know
- **Readable**: Natural language-like expressions improve code clarity
- **Flexible**: String interpolation with `${}` for dynamic values
- **Toolable**: Potential for IDE syntax highlighting and validation
- **Parseable**: Can be statically analyzed for optimization
- **Gradual**: Can be adopted incrementally alongside object syntax

**Alternative Approaches Considered:**
- **String-based**: Would lack syntax validation and IDE support
- **Builder Pattern**: More verbose than template literals
- **Proxy-based**: Would hide the actual operations being performed
- **Function Chains**: Less readable for complex operations

### Namespace Design

**Simplified Namespacing:**
```javascript
// DSL: Natural entity/attribute format
user/name, post/title, comment/author

// DataScript: Colon-prefixed keywords  
:user/name, :post/title, :comment/author
```

The DSL handles namespace conversion automatically, making the syntax more approachable while maintaining DataScript compatibility.

### Expression Integration

**JavaScript Expression Support:**
```javascript
userProxy.update`
  user/lastLogin = ${new Date()}
  user/score = ${calculateUserScore(user)}
  user/friends = ${friendArray.map(f => f.entityId)}
`;
```

The `${}` syntax allows seamless integration of JavaScript expressions within the DSL, providing full programmatic flexibility.

### Error Handling Philosophy

**Fail Fast with Context:**
- Parse-time validation prevents runtime errors
- Detailed error messages with line/column information
- Helpful suggestions for common mistakes
- Graceful degradation when possible

**Development-Friendly:**
- Clear error messages during development
- Syntax validation before execution
- Type checking against schema definitions
- Performance warnings for complex queries

## Performance Characteristics

### Parsing Performance

**Template Literal Caching:**
- Identical template literals are parsed once and cached
- Expression evaluation happens at runtime
- Minimal parsing overhead for repeated operations

**Parse Time Optimization:**
- Efficient tokenization with single-pass parsing
- Lazy evaluation for conditional expressions
- Pre-compiled common query patterns

### Runtime Performance

**Zero Overhead Principle:**
- DSL compiles to identical data-store object calls
- No performance penalty compared to object syntax
- Direct DataScript integration without intermediary layers

**Memory Efficiency:**
- Minimal object allocation during parsing
- Cached AST structures for repeated operations
- Garbage collection friendly implementation

## Integration API

### DSL Function Signatures

```javascript
// Schema definition
function defineSchema(strings: TemplateStringsArray, ...expressions: any[]): SchemaObject

// Query execution  
function query(strings: TemplateStringsArray, ...expressions: any[]): QueryObject

// Update operations
function update(strings: TemplateStringsArray, ...expressions: any[]): UpdateData

// Parser utilities
class DSLParser {
  static parseSchema(dslText: string, expressions: any[]): SchemaObject
  static parseQuery(dslText: string, expressions: any[]): QueryObject  
  static parseUpdate(dslText: string, expressions: any[]): UpdateData
}
```

### Entity Proxy Extensions

The DSL integrates directly with EntityProxy methods:

```javascript
// Query method accepts both object and template literal
userProxy.query`find ?name where ?this user/name ?name`;
userProxy.query({ find: ['?name'], where: [['?this', ':user/name', '?name']] });

// Update method accepts both formats
userProxy.update`user/age = 31`;
userProxy.update({ ':user/age': 31 });

// Subscribe method supports template literals
userProxy.subscribe`find ?name where ?this user/name ?name` |> callback;
```

### Store Integration

```javascript
// Schema can be defined with DSL
const store = createDataStore({
  schema: defineSchema`
    user/name: string
    user/friends: many ref -> user
  `
});

// Or mixed with object schema
const mixedSchema = {
  ...defineSchema`user/name: string`,
  ':complex/attribute': { /* complex DataScript definition */ }
};
```

## Conclusion

The Data-Store DSL transforms the powerful data-store reactive system into an intuitive, natural language interface using JavaScript template literals. It maintains full backward compatibility while dramatically improving developer experience through readable syntax for schema definition, queries, and updates.

The DSL is designed as an optional enhancement layer - developers can use it where it adds clarity and fall back to the object-based API for complex operations. This approach provides maximum flexibility while significantly lowering the learning curve for new users.

By leveraging template literals, the DSL feels native to JavaScript while providing the expressiveness needed for complex data operations. The result is a more approachable reactive data management system that doesn't sacrifice any of the underlying power of DataScript and data-store.