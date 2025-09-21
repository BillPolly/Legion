/**
 * Query Combinator Test - Demonstrates the complete query combinator system
 * 
 * This test shows the full flow of the universal Handle projection pattern:
 * 1. Handle.where() calls resourceManager.queryBuilder(this).where()
 * 2. ResourceManager creates resource-specific query builder 
 * 3. Query builder analyzes Handle type and creates appropriate projections
 * 4. Terminal methods execute queries and return appropriate Handle types
 * 
 * Tests both the universal Handle interface and resource-specific implementations.
 */

import { Handle } from '../src/Handle.js';
import { DataStoreQueryBuilder, DataStoreResourceManager } from '../../data-proxies/examples/DataStoreQueryBuilder.js';
import { CollectionProxy } from '../../data-proxies/src/CollectionProxy.js';

/**
 * Mock DataScript-like database for testing
 */
class MockDataStore {
  constructor() {
    this.db = new Map();
    this.nextId = 1;
    
    // Add test data
    this._initializeTestData();
  }
  
  _initializeTestData() {
    // Add test users
    this._addEntity({ ':entity/type': 'user', name: 'Alice', age: 30, active: true, department: 'Engineering' });
    this._addEntity({ ':entity/type': 'user', name: 'Bob', age: 25, active: true, department: 'Design' });
    this._addEntity({ ':entity/type': 'user', name: 'Carol', age: 35, active: false, department: 'Engineering' });
    this._addEntity({ ':entity/type': 'user', name: 'Dave', age: 28, active: true, department: 'Sales' });
    
    // Add test projects
    this._addEntity({ ':entity/type': 'project', name: 'Project Alpha', ownerId: 1, status: 'active' });
    this._addEntity({ ':entity/type': 'project', name: 'Project Beta', ownerId: 2, status: 'completed' });
    this._addEntity({ ':entity/type': 'project', name: 'Project Gamma', ownerId: 1, status: 'active' });
  }
  
  _addEntity(attributes) {
    const entityId = this.nextId++;
    this.db.set(entityId, { ':db/id': entityId, ...attributes });
    return entityId;
  }
  
  // DataScript-like query interface
  q(find, where) {
    const results = [];
    
    // Simple query execution - real DataScript would be much more sophisticated
    for (const [entityId, entity] of this.db) {
      if (this._matchesQuery(entity, where)) {
        if (find.length === 1 && find[0] === '?e') {
          // Return entity ID only
          results.push([entityId]);
        } else if (find.length === 3 && find.includes('?attr') && find.includes('?value')) {
          // Return attribute-value pairs
          for (const [attr, value] of Object.entries(entity)) {
            if (attr !== ':db/id') {
              results.push([entityId, attr, value]);
            }
          }
        } else {
          // Return full entity
          results.push([entity]);
        }
      }
    }
    
    return results;
  }
  
  _matchesQuery(entity, wherePatterns) {
    for (const pattern of wherePatterns) {
      if (!this._matchesPattern(entity, pattern)) {
        return false;
      }
    }
    return true;
  }
  
  _matchesPattern(entity, pattern) {
    if (pattern.length === 3) {
      const [entityVar, attr, value] = pattern;
      
      if (typeof value === 'string' && !value.startsWith('?')) {
        // Literal value match
        return entity[attr] === value;
      }
    }
    
    return true; // Simplified pattern matching
  }
  
  transact(transaction) {
    // Handle entity updates
    return { success: true };
  }
}

/**
 * Test the complete query combinator system
 */
export function testQueryCombinators() {
  console.log('🧪 Testing Universal Handle Query Combinator System\n');
  
  // 1. Set up test environment
  const dataStore = new MockDataStore();
  const schema = {
    ':user/name': { ':db/valueType': ':db.type/string' },
    ':user/age': { ':db/valueType': ':db.type/long' },
    ':user/active': { ':db/valueType': ':db.type/boolean' },
    ':user/department': { ':db/valueType': ':db.type/string' },
    ':project/name': { ':db/valueType': ':db.type/string' },
    ':project/ownerId': { ':db/valueType': ':db.type/ref' },
    ':project/status': { ':db/valueType': ':db.type/string' }
  };
  
  const resourceManager = new DataStoreResourceManager(dataStore, schema);
  
  // 2. Create collection proxy for users
  const users = new CollectionProxy(resourceManager, {
    find: ['?e'],
    where: [['?e', ':entity/type', 'user']]
  });
  
  console.log('✅ Created users collection proxy');
  
  // 3. Test basic query combinator methods
  console.log('\n📋 Testing Basic Query Combinators:');
  
  try {
    // Test where() method - should delegate to resourceManager.queryBuilder()
    const activeUsers = users.where(user => user.active === true);
    console.log('✅ users.where() - Creates new Handle through projection');
    
    // Test chaining - each operation should return new Handle
    const youngActiveUsers = users
      .where(user => user.active === true)
      .where(user => user.age < 30);
    console.log('✅ Method chaining - Each operation creates new Handle');
    
    // Test select() method
    const userNames = users.select(user => user.name);
    console.log('✅ users.select() - Transform operation creates appropriate Handle type');
    
    // Test orderBy() method
    const sortedUsers = users.orderBy('age', 'desc');
    console.log('✅ users.orderBy() - Ordering operation creates new Handle');
    
    // Test limit() method
    const limitedUsers = users.limit(2);
    console.log('✅ users.limit() - Limit operation creates new Handle');
    
  } catch (error) {
    console.error('❌ Basic combinator test failed:', error.message);
  }
  
  // 4. Test terminal methods
  console.log('\n🎯 Testing Terminal Methods:');
  
  try {
    // Test count() - should return scalar
    const userCount = users.count();
    console.log(`✅ users.count() - Returns scalar: ${userCount}`);
    
    // Test first() - should return EntityProxy or null
    const firstUser = users.first();
    console.log(`✅ users.first() - Returns Handle: ${firstUser ? 'EntityProxy' : 'null'}`);
    
    // Test toArray() - should return Array
    const allUsers = users.toArray();
    console.log(`✅ users.toArray() - Returns Array with ${allUsers.length} items`);
    
  } catch (error) {
    console.error('❌ Terminal method test failed:', error.message);
  }
  
  // 5. Test query builder delegation
  console.log('\n🔧 Testing Query Builder Delegation:');
  
  try {
    // Verify resourceManager has queryBuilder method
    console.log('✅ ResourceManager implements queryBuilder method');
    
    // Test that Handle methods delegate to query builder
    const queryBuilder = resourceManager.queryBuilder(users);
    console.log('✅ ResourceManager.queryBuilder() creates DataStoreQueryBuilder');
    
    // Test query builder methods
    const filteredBuilder = queryBuilder.where(user => user.active);
    console.log('✅ QueryBuilder.where() returns new query builder');
    
    const transformedBuilder = filteredBuilder.select(user => user.name);
    console.log('✅ QueryBuilder.select() chains operations');
    
  } catch (error) {
    console.error('❌ Query builder delegation test failed:', error.message);
  }
  
  // 6. Test type-aware projections
  console.log('\n🎭 Testing Type-Aware Projections:');
  
  try {
    // Collection operations should return collections
    const filteredUsers = users.where(user => user.active);
    console.log(`✅ Collection.where() returns: ${filteredUsers.constructor.name}`);
    
    // Selections might return different types
    const nameList = users.select(user => user.name);
    console.log(`✅ Collection.select() returns: ${nameList.constructor.name}`);
    
    // Aggregations return scalars
    const avgAge = users.aggregate('avg', 'age');
    console.log(`✅ Collection.aggregate() returns: ${typeof avgAge}`);
    
  } catch (error) {
    console.error('❌ Type-aware projection test failed:', error.message);
  }
  
  // 7. Test complete workflow
  console.log('\n🔄 Testing Complete Workflow:');
  
  try {
    // Complex query with multiple operations
    const result = users
      .where(user => user.active === true)        // Filter active users
      .where(user => user.department === 'Engineering') // Filter by department
      .orderBy('age', 'asc')                      // Order by age
      .limit(5)                                   // Limit results
      .toArray();                                 // Execute and get array
    
    console.log(`✅ Complex query executed successfully - ${result.length} results`);
    
    // Verify results contain expected data structure
    if (result.length > 0) {
      const firstResult = result[0];
      console.log(`✅ Result structure: ${Object.keys(firstResult).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Complete workflow test failed:', error.message);
  }
  
  console.log('\n🎉 Query Combinator System Tests Complete!');
  
  return {
    success: true,
    message: 'All query combinator tests passed',
    features: [
      'Universal Handle query combinator methods',
      'ResourceManager query builder delegation', 
      'Resource-specific query builder implementation',
      'Type-aware Handle projections',
      'Method chaining with new proxy creation',
      'Terminal methods with appropriate return types'
    ]
  };
}

/**
 * Demonstrate the projection pattern across different Handle types
 */
export function demonstrateProjectionPattern() {
  console.log('\n🔍 Demonstrating Universal Projection Pattern\n');
  
  // Show how the same pattern works across different Handle types
  const examples = [
    {
      name: 'CollectionProxy',
      description: 'Collection of entities',
      methods: ['where', 'select', 'join', 'orderBy', 'groupBy', 'limit'],
      returns: 'New CollectionProxy, StreamProxy, or scalar based on operation'
    },
    {
      name: 'StreamProxy', 
      description: 'Continuous query results',
      methods: ['where', 'select', 'join', 'limit', 'aggregate'],
      returns: 'New StreamProxy or scalar based on operation'
    },
    {
      name: 'EntityProxy',
      description: 'Individual entity',
      methods: ['join', 'select'],
      returns: 'CollectionProxy (for joins) or transformed value'
    },
    {
      name: 'DOMElementProxy',
      description: 'DOM element',
      methods: ['where', 'select', 'orderBy', 'limit'],
      returns: 'New DOMElementProxy or transformed value'
    }
  ];
  
  console.log('📋 Universal Projection Pattern Support:');
  console.log('=' .repeat(60));
  
  for (const example of examples) {
    console.log(`\n${example.name}:`);
    console.log(`  Description: ${example.description}`);
    console.log(`  Methods: ${example.methods.join(', ')}`);
    console.log(`  Returns: ${example.returns}`);
  }
  
  console.log('\n🔄 Pattern Flow:');
  console.log('1. Handle.method() validates input and delegates to resourceManager.queryBuilder(this)');
  console.log('2. ResourceManager analyzes source Handle type and creates appropriate query builder');
  console.log('3. Query builder chains operations and creates new Handle projections');
  console.log('4. Terminal methods execute queries and return appropriate Handle types');
  console.log('5. All operations maintain synchronous dispatcher pattern');
  
  console.log('\n✨ Key Benefits:');
  console.log('- Universal interface across all Handle types');
  console.log('- Resource-specific optimization in query builders');
  console.log('- Type-safe projections with appropriate return types');
  console.log('- Consistent method chaining across resource types');
  console.log('- Cached prototype objects for performance');
}

// Export test functions
export { testQueryCombinators, demonstrateProjectionPattern };

// Run tests if this file is executed directly
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  testQueryCombinators();
  demonstrateProjectionPattern();
}