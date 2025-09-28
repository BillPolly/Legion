/**
 * PlainObjectDataSource - Example DataSource backed by plain JavaScript objects
 * 
 * Demonstrates how a simple DataSource with in-memory JavaScript objects/arrays
 * can use the DefaultQueryBuilder for query operations. This is perfect for:
 * - Mock/test scenarios
 * - Simple in-memory data stores
 * - API responses cached as objects
 * - Any scenario without a specialized query engine
 */

import { DefaultQueryBuilder } from '../src/DefaultQueryBuilder.js';
import { CollectionProxy } from '../src/CollectionProxy.js';
import { EntityProxy } from '../src/EntityProxy.js';

export class PlainObjectDataSource {
  constructor(data = {}) {
    // Store data as plain JavaScript objects
    // Could be arrays, objects, or any structure
    this.data = data;
    this._subscriptions = new Map();
  }
  
  // Required DataSource interface methods
  
  query(querySpec) {
    // Simple query implementation for plain objects
    // This just returns data based on the query spec
    
    if (querySpec.collection) {
      // Return a named collection
      return this.data[querySpec.collection] || [];
    }
    
    if (querySpec.find && querySpec.where) {
      // Simple where clause matching
      // This is a basic implementation - real one would parse where clauses
      const collectionName = this._extractCollectionFromWhere(querySpec.where);
      const collection = this.data[collectionName] || [];
      
      // For simplicity, just return the collection
      // A real implementation would filter based on where clauses
      return collection;
    }
    
    // Return all data if no specific query
    return Object.values(this.data).flat();
  }
  
  subscribe(querySpec, callback) {
    // Simple subscription tracking
    const subscription = {
      id: Date.now() + Math.random(),
      querySpec,
      callback,
      unsubscribe: () => {
        this._subscriptions.delete(subscription.id);
      }
    };
    
    this._subscriptions.set(subscription.id, subscription);
    return subscription;
  }
  
  getSchema() {
    // Return a simple schema for the data
    // Could be more sophisticated in a real implementation
    return {
      collections: Object.keys(this.data),
      version: '1.0.0'
    };
  }
  
  /**
   * Query builder implementation - returns DefaultQueryBuilder
   * This is the key method that enables query combinator support
   */
  queryBuilder(sourceHandle) {
    return new DefaultQueryBuilder(this, sourceHandle);
  }
  
  // Optional helper methods
  
  update(updateSpec) {
    // Simple update implementation
    if (updateSpec.collection && updateSpec.id) {
      const collection = this.data[updateSpec.collection];
      if (Array.isArray(collection)) {
        const index = collection.findIndex(item => item.id === updateSpec.id);
        if (index !== -1) {
          collection[index] = { ...collection[index], ...updateSpec.data };
          return { success: true };
        }
      }
    }
    return { success: false, error: 'Update failed' };
  }
  
  validate(data) {
    // Simple validation - always passes
    return true;
  }
  
  getMetadata() {
    return {
      dataSourceType: 'PlainObject',
      subscriptionCount: this._subscriptions.size,
      collectionCount: Object.keys(this.data).length,
      capabilities: {
        query: true,
        subscribe: true,
        update: true,
        validate: true,
        queryBuilder: true
      }
    };
  }
  
  // Helper method to create entity proxies
  createEntityProxy(entityId) {
    // Find the entity in our data
    for (const collectionName of Object.keys(this.data)) {
      const collection = this.data[collectionName];
      if (Array.isArray(collection)) {
        const entity = collection.find(item => item.id === entityId);
        if (entity) {
          // Return an EntityProxy for this entity
          return new EntityProxy(this, entityId);
        }
      }
    }
    return null;
  }
  
  // Private helper methods
  
  _extractCollectionFromWhere(whereClause) {
    // Simple extraction - look for entity type patterns
    if (Array.isArray(whereClause)) {
      for (const clause of whereClause) {
        if (Array.isArray(clause) && clause[1] === ':entity/type') {
          return clause[2] + 's'; // Pluralize for collection name
        }
      }
    }
    return 'default';
  }
}

/**
 * Example usage demonstrating query combinators with plain objects
 */
export function exampleUsage() {
  // Create a DataSource with plain JavaScript data
  const dataSource = new PlainObjectDataSource({
    users: [
      { id: 1, name: 'Alice', age: 30, active: true, department: 'Engineering' },
      { id: 2, name: 'Bob', age: 25, active: true, department: 'Design' },
      { id: 3, name: 'Carol', age: 35, active: false, department: 'Engineering' },
      { id: 4, name: 'Dave', age: 28, active: true, department: 'Sales' },
      { id: 5, name: 'Eve', age: 22, active: true, department: 'Engineering' }
    ],
    projects: [
      { id: 101, name: 'Project Alpha', ownerId: 1, status: 'active' },
      { id: 102, name: 'Project Beta', ownerId: 2, status: 'completed' },
      { id: 103, name: 'Project Gamma', ownerId: 1, status: 'planning' }
    ]
  });
  
  // Create a CollectionProxy for users
  const users = new CollectionProxy(dataSource, {
    collection: 'users'
  });
  
  // Now we can use query combinators!
  // The Handle delegates to DataSource.queryBuilder()
  // which returns our DefaultQueryBuilder
  
  // Example 1: Filter and transform
  const activeEngineers = users
    .where(user => user.active === true)
    .where(user => user.department === 'Engineering')
    .select(user => ({ name: user.name, age: user.age }))
    .toArray();
  
  console.log('Active engineers:', activeEngineers);
  // Output: [{ name: 'Alice', age: 30 }, { name: 'Eve', age: 22 }]
  
  // Example 2: Ordering and limiting
  const topUsers = users
    .where(user => user.active === true)
    .orderBy('age', 'desc')
    .limit(3)
    .toArray();
  
  console.log('Top 3 active users by age:', topUsers);
  
  // Example 3: Aggregation
  const avgAge = users
    .where(user => user.department === 'Engineering')
    .aggregate('avg', 'age');
  
  console.log('Average age in Engineering:', avgAge);
  
  // Example 4: First/Last
  const firstUser = users
    .orderBy('name', 'asc')
    .first();
  
  console.log('First user alphabetically:', firstUser);
  
  // Example 5: Count
  const activeCount = users
    .where(user => user.active === true)
    .count();
  
  console.log('Active user count:', activeCount);
}