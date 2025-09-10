# Data-Store Design Document

## Overview

Data-Store is a reactive data management layer built on top of DataScript JS. It provides **Entity Proxy Objects** that act as reactive handles to entities within an immutable DataScript database, combined with a subscription system for automatic query re-execution when data changes.

### Core Concept

The key innovation is **Entity Proxy Objects** - lightweight JavaScript objects that:
- Represent specific entities within the DataScript database
- Provide reactive property access that reflects current database state
- Forward updates to the database through transactions
- Support entity-rooted queries where the proxy serves as the query root
- Automatically handle cleanup when the underlying entity is deleted

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Entity Proxy  │───→│   DataStore      │───→│ DataScript DB   │
│   Objects       │    │                  │    │ (Immutable)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────────┐
         │              │ Reactive Engine  │
         │              │ & Subscriptions  │
         │              └──────────────────┘
         │                       │
         └───────────────────────┘
```

### Components

1. **DataStore**: Central coordinator managing the DataScript connection and proxy registry
2. **Entity Proxy Objects**: Reactive handles to specific entities with property access and updates
3. **Reactive Engine**: Tracks subscriptions and triggers updates when relevant data changes
4. **Subscription System**: Manages query subscriptions and entity-rooted queries

## Entity Proxy System

### Concept

Entity Proxy Objects are NOT JavaScript Proxy objects, but conceptually similar - they provide a handle to an entity within the immutable DataScript database. The proxy maintains the entity's ID and provides reactive access to its current state.

### Proxy Lifecycle

1. **Creation**: Created via `store.createProxy()` or `store.getProxy(entityId)`
2. **Active**: Provides reactive property access and accepts updates
3. **Deleted**: When underlying entity is removed, proxy becomes invalid and cleans up subscriptions

### Property Access

```javascript
const user = store.getProxy(userId);

// Reactive property access - always reads from current database state
console.log(user.name);     // Equivalent to pull(db, [':user/name'], userId)
console.log(user.email);    // Reactive - reflects current state
console.log(user.friends);  // Returns array of proxy objects for ref attributes
```

**Implementation**: Property getters use the current database state via `pull()` operations, automatically converting ref attributes to proxy objects.

### Updates

```javascript
// Updates forward to database as transactions
user.update({
  ':user/name': 'New Name',
  ':user/age': 30
});

// Convenience methods
user.addFriend(otherUserProxy);
user.removeFriend(someUserProxy);
```

**Implementation**: Update operations create DataScript transactions, maintaining referential integrity and triggering subscriptions.

## Reactive Query Engine

### Change Detection

The reactive engine tracks which subscriptions are affected by database transactions:

1. **Transaction Analysis**: When a transaction occurs, analyze which entities/attributes changed
2. **Subscription Matching**: Determine which active subscriptions might be affected by the changes
3. **Re-execution**: Execute affected queries and notify subscribers of changes
4. **Batching**: Group related notifications to avoid cascade effects

### Entity-Rooted Queries

Proxy objects can execute queries where the proxy's entity serves as an implicit variable:

```javascript
// Query rooted at specific proxy
const userPosts = userProxy.query({
  find: ['?title', '?date'],
  where: [
    ['?this', ':user/posts', '?post'],  // ?this = userProxy's entity ID
    ['?post', ':post/title', '?title'],
    ['?post', ':post/date', '?date']
  ]
});
```

**Implementation**: The query engine automatically binds `?this` to the proxy's entity ID before execution.

### Subscription Types

1. **Query Subscriptions**: Re-execute queries when relevant data changes
2. **Entity Subscriptions**: Notify when specific entity changes  
3. **Proxy Subscriptions**: Notify when proxy's underlying entity changes
4. **Computed Properties**: Cached query results that auto-update

## API Specification

### DataStore Creation

```javascript
import { createDataStore } from 'data-store';

const store = createDataStore({
  schema: {
    ':user/id': { unique: 'identity' },
    ':user/friends': { card: 'many', valueType: 'ref' },
    ':post/author': { valueType: 'ref' }
  },
  options: {
    debounceMs: 10        // Batch update notifications
  }
});
```

### Proxy Creation and Access

```javascript
// Create new entity with proxy
const user = store.createProxy('user', {
  ':user/name': 'Alice',
  ':user/email': 'alice@example.com'
});

// Get proxy for existing entity
const existingUser = store.getProxy(entityId);

// Property access (reactive)
console.log(user.name);           // String
console.log(user.friends);        // Array of proxy objects
console.log(user.isValid());      // Boolean - entity still exists

// Updates
user.update({ ':user/age': 30 });
user.delete();                    // Remove entity from database
```

### Query and Subscription API

```javascript
// Entity-rooted queries
const results = userProxy.query({
  find: ['?friend-name'],
  where: [
    ['?this', ':user/friends', '?friend'],
    ['?friend', ':user/name', '?friend-name']
  ]
});

// Subscriptions
const unsubscribe = userProxy.subscribe({
  find: ['?post-title'],
  where: [
    ['?post', ':post/author', '?this'],
    ['?post', ':post/title', '?post-title']
  ]
}, (results, changes) => {
  console.log('User posts updated:', results);
});

// Computed properties (cached reactive queries)
userProxy.computed('postCount', {
  find: [['(count ?post)']],
  where: [['?post', ':post/author', '?this']]
});

console.log(userProxy.postCount); // Auto-updating cached value
```

### Event Handling

```javascript
// Proxy-level events
userProxy.onChange((changes) => {
  console.log('User properties changed:', changes);
});

userProxy.onDelete(() => {
  console.log('User was deleted');
});

// Store-level events  
store.onTransaction((report) => {
  console.log('Database transaction:', report);
});
```

## Data Flow

### Update Propagation

1. **Update Initiated**: `userProxy.update({ ':user/name': 'New Name' })`
2. **Transaction Created**: Proxy creates DataScript transaction
3. **Database Updated**: Transaction applied to immutable database, new DB returned  
4. **Change Detection**: Reactive engine analyzes transaction for affected subscriptions
5. **Subscriptions Triggered**: Relevant queries re-executed, callbacks invoked
6. **Proxy Invalidation**: If entity deleted, proxy marked as invalid

### Query Execution Flow

1. **Query Request**: `userProxy.query({ find: [...], where: [...] })`
2. **Entity Binding**: `?this` variable bound to proxy's entity ID
3. **DataScript Query**: Standard DataScript query execution
4. **Result Processing**: Convert ref results to proxy objects where applicable
5. **Return Results**: Processed results returned to caller

## Implementation Details

### Proxy Registry

The DataStore maintains a `WeakMap<entityId, ProxyObject>` to ensure:
- One proxy per entity (singleton pattern)
- Automatic garbage collection when proxy no longer referenced
- Efficient proxy lookup and creation

### Change Detection Algorithm

```javascript
// Simplified change detection
function analyzeTransaction(txData) {
  const changedEntities = new Set();
  const changedAttributes = new Set();
  
  for (const datom of txData) {
    changedEntities.add(datom.e);
    changedAttributes.add(datom.a);
  }
  
  return { changedEntities, changedAttributes };
}

function findAffectedSubscriptions(changes, subscriptions) {
  return subscriptions.filter(sub => 
    subscriptionOverlapsWithChanges(sub, changes)
  );
}
```

### Property Access Implementation

```javascript
class EntityProxy {
  get name() {
    const result = pull(this.store.db(), [':user/name'], this.entityId);
    return result?.[':user/name'];
  }
  
  get friends() {
    const result = pull(this.store.db(), [':user/friends'], this.entityId);
    const friendIds = result?.[':user/friends'] || [];
    return friendIds.map(id => this.store.getProxy(id));
  }
}
```

### Subscription Management

```javascript
class Subscription {
  constructor(query, callback, rootEntity = null) {
    this.id = generateId();
    this.query = query;
    this.callback = callback;
    this.rootEntity = rootEntity;  // For entity-rooted queries
    this.lastResults = null;
  }
  
  execute(db) {
    const boundQuery = this.rootEntity 
      ? bindEntityToQuery(this.query, this.rootEntity)
      : this.query;
      
    return q(boundQuery, db);
  }
}
```

## Usage Examples

### Basic Entity Management

```javascript
const store = createDataStore(schema);

// Create user
const alice = store.createProxy('user', {
  ':user/name': 'Alice',
  ':user/email': 'alice@example.com'
});

// Read properties
console.log(`User: ${alice.name} (${alice.email})`);

// Update user
alice.update({ ':user/age': 30 });

// Create relationships
const bob = store.createProxy('user', { ':user/name': 'Bob' });
alice.addFriend(bob);

console.log(`Alice's friends: ${alice.friends.map(f => f.name).join(', ')}`);
```

### Reactive Queries

```javascript
// Subscribe to user's posts
alice.subscribe({
  find: ['?title', '?content'],
  where: [
    ['?post', ':post/author', '?this'],
    ['?post', ':post/title', '?title'],
    ['?post', ':post/content', '?content'],
    ['?post', ':post/published', true]
  ]
}, (posts) => {
  updateUI(`${alice.name} has ${posts.length} published posts`);
});

// Create post - automatically triggers subscription
const post = store.createProxy('post', {
  ':post/title': 'Hello World',
  ':post/content': 'My first post!',
  ':post/author': alice,
  ':post/published': true
});
```

### Advanced Patterns

```javascript
// Computed properties
alice.computed('followerCount', {
  find: [['(count ?follower)']],
  where: [['?follower', ':user/following', '?this']]
});

// Chain queries through relationships
const mutualFriends = alice.query({
  find: ['?mutual'],
  where: [
    ['?this', ':user/friends', '?friend'],
    ['?friend', ':user/friends', '?mutual'],
    ['?this', ':user/friends', '?mutual'],
    [(e1, e2) => e1 !== e2, '?this', '?mutual']  // Exclude self
  ]
});

// Bulk operations still supported
store.update([
  { ':db/id': alice.entityId, ':user/verified': true },
  { ':db/id': bob.entityId, ':user/verified': true }
]);
```

## Key Design Decisions

### Why Not JavaScript Proxy?

While JavaScript Proxy could intercept property access, we chose explicit getters because:
- More predictable performance characteristics
- Clearer debugging and error handling  
- Explicit API makes the reactive nature obvious
- Easier to optimize specific access patterns

### Immutability Preservation

The underlying DataScript database remains immutable:
- Proxy updates create new database versions
- Previous database states remain accessible
- Time-travel debugging and undo/redo possible
- Safe concurrent access patterns

### Entity-Centric Design

Centering the API around entities (via proxies) rather than queries provides:
- More intuitive object-oriented interface
- Natural scoping for subscriptions and updates
- Clear ownership and lifecycle management
- Better alignment with UI component patterns

This design enables building reactive applications with a familiar object-oriented interface while maintaining the power of DataScript's immutable database and Datalog queries.