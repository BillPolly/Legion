import { PatternTranslator } from '../../src/PatternTranslator.js';
import { QueryEngine } from '../../src/QueryEngine.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('PatternTranslator Integration', () => {
  let translator;
  let queryEngine;
  let core;
  let identityManager;
  let store;

  beforeEach(() => {
    // Create comprehensive schema for testing
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/email': { unique: 'identity' },
      ':person/employer': { card: 'one', valueType: 'ref' },
      ':person/friend': { card: 'many', valueType: 'ref' },
      ':company/name': { card: 'one' },
      ':company/employees': { card: 'many', valueType: 'ref' },
      ':company/founded': { card: 'one' },
      ':project/name': { card: 'one' },
      ':project/lead': { card: 'one', valueType: 'ref' },
      ':task/title': { card: 'one' },
      ':task/assignee': { card: 'one', valueType: 'ref' }
    };
    
    // Create completely fresh instances for each test to ensure isolation
    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    queryEngine = new QueryEngine(core, store, identityManager);
    translator = new PatternTranslator();
  });

  // Clean up after each test to prevent any state leakage
  afterEach(() => {
    // Clear all references to ensure garbage collection
    translator = null;
    queryEngine = null;
    core = null;
    identityManager = null;
    store = null;
  });

  test('Legacy KG API compatibility - pattern queries work with real data', () => {
    // Add test data using the live store
    const alice = {
      type: 'person',
      name: 'Alice Johnson',
      age: 30,
      email: 'alice@techcorp.com'
    };

    const bob = {
      type: 'person',
      name: 'Bob Smith',
      age: 25,
      email: 'bob@techcorp.com'
    };

    const company = {
      type: 'company',
      name: 'TechCorp',
      founded: 2010
    };

    store.add(alice);
    store.add(bob);
    store.add(company);

    // Test pattern that works with the actual storage format
    // Query for entities and their object IDs, then use object mapping
    const entityPattern = ['?entity', 'entity/type', '?type'];
    const translatedQuery = translator.translatePattern(entityPattern);

    // Execute the translated query to get entity types
    const results = queryEngine.query(translatedQuery);

    expect(results).toBeDefined();
    expect(results.length).toBe(3); // alice, bob, company all have types
    
    // Verify we can get the actual objects by querying for all entities
    const allEntitiesQuery = {
      find: ['?entityId'],
      where: [
        ['?e', ':entity/id', '?entityId']
      ]
    };
    const objectResults = queryEngine.queryWithObjects(allEntitiesQuery);
    expect(objectResults.length).toBe(3);
    
    // Find Alice in the results
    const aliceResult = objectResults.find(person => person.name === 'Alice Johnson');
    expect(aliceResult).toBeDefined();
    expect(aliceResult.age).toBe(30);
  });

  test('Pattern translation with type filtering', () => {
    // Add test data
    const people = [
      { type: 'person', name: 'Alice', age: 30 },
      { type: 'person', name: 'Bob', age: 25 },
      { type: 'company', name: 'TechCorp', founded: 2010 }
    ];

    people.forEach(item => store.add(item));

    // Create pattern that filters by type using the actual storage format
    const pattern = {
      subject: '?entity',
      predicate: 'entity/type',
      object: 'person'
    };

    const translatedQuery = translator.translate(pattern);
    
    // This should return entity IDs that have type 'person'
    const entityResults = queryEngine.query(translatedQuery);
    expect(entityResults.length).toBe(2); // Two entities with type 'person'
    
    // Get the actual objects to verify
    const objectResults = queryEngine.queryWithObjects({
      find: ['?entityId'],
      where: [
        ['?e', ':entity/type', 'person'],
        ['?e', ':entity/id', '?entityId']
      ]
    });
    
    expect(objectResults.length).toBe(2); // Only Alice and Bob
    
    objectResults.forEach(person => {
      expect(person.type).toBe('person');
      expect(person.name).toBeDefined();
    });
  });

  test('Complex join patterns across multiple entities', () => {
    // Create complex relational data
    const alice = { type: 'person', name: 'Alice', age: 30, email: 'alice@test.com' };
    const bob = { type: 'person', name: 'Bob', age: 25, email: 'bob@test.com' };
    const techCorp = { type: 'company', name: 'TechCorp', founded: 2010 };
    const project = { type: 'project', name: 'Web Platform' };
    
    store.add(alice);
    store.add(bob);
    store.add(techCorp);
    store.add(project);

    // Pattern to find all people with their entity IDs (using actual storage format)
    const complexPattern = [
      {
        subject: '?entity',
        predicate: 'entity/type',
        object: 'person'
      },
      {
        subject: '?entity',
        predicate: 'entity/id',
        object: '?entityId'
      }
    ];

    const translatedQuery = translator.translate(complexPattern);
    const rawResults = queryEngine.queryWithObjects(translatedQuery);

    expect(rawResults.length).toBe(2);
    
    // Extract objects from array results (query returns [entityId, object] pairs)
    const results = rawResults.map(result => result[1]);
    
    // Verify Alice's data
    const aliceResult = results.find(person => person.name === 'Alice');
    expect(aliceResult).toBeDefined();
    expect(aliceResult.age).toBe(30);
    expect(aliceResult.email).toBe('alice@test.com');

    // Verify Bob's data
    const bobResult = results.find(person => person.name === 'Bob');
    expect(bobResult).toBeDefined();
    expect(bobResult.age).toBe(25);
    expect(bobResult.email).toBe('bob@test.com');
  });

  test('Mixed format pattern translation with real query execution', () => {
    // Add test data
    const inventory = [
      { type: 'product', name: 'Widget A', price: 19.99, category: 'tools' },
      { type: 'product', name: 'Widget B', price: 29.99, category: 'electronics' },
      { type: 'product', name: 'Service X', price: 99.99, category: 'services' }
    ];

    inventory.forEach(item => store.add(item));

    // Mixed format patterns (using actual storage format)
    const mixedPatterns = [
      // Object format - find products
      {
        subject: '?entity',
        predicate: 'entity/type',
        object: 'product'
      },
      // Array format - get entity ID
      ['?entity', 'entity/id', '?entityId']
    ];

    const translatedQuery = translator.translate(mixedPatterns);
    const rawResults = queryEngine.queryWithObjects(translatedQuery);

    expect(rawResults.length).toBe(3);
    
    // Extract objects from array results (query returns [entityId, object] pairs)
    const results = rawResults.map(result => result[1]);
    
    results.forEach(product => {
      expect(product.type).toBe('product');
      expect(product.name).toBeDefined();
      expect(product.price).toBeDefined();
      expect(typeof product.price).toBe('number');
    });

    // Verify specific product
    const widgetA = results.find(p => p.name === 'Widget A');
    expect(widgetA).toBeDefined();
    expect(widgetA.price).toBe(19.99);
    expect(widgetA.category).toBe('tools');
  });

  test('Pattern translation preserves query semantics', () => {
    // Add test data with specific relationships
    const users = [
      { type: 'user', name: 'Alice', status: 'active', role: 'admin' },
      { type: 'user', name: 'Bob', status: 'inactive', role: 'user' },
      { type: 'user', name: 'Carol', status: 'active', role: 'user' }
    ];

    users.forEach(user => store.add(user));

    // Pattern to find user entities and their IDs (using actual storage format)
    const activeUserPattern = [
      {
        subject: '?entity',
        predicate: 'entity/type',
        object: 'user'
      },
      {
        subject: '?entity',
        predicate: 'entity/id',
        object: '?entityId'
      }
    ];

    const translatedQuery = translator.translate(activeUserPattern);
    const rawResults = queryEngine.queryWithObjects(translatedQuery);

    expect(rawResults.length).toBe(3); // All users
    
    // Extract objects from array results (query returns [entityId, object] pairs)
    const results = rawResults.map(result => result[1]);
    
    // Filter for active users in the objects
    const activeUsers = results.filter(user => user.status === 'active');
    expect(activeUsers.length).toBe(2); // Alice and Carol
    
    const names = activeUsers.map(user => user.name).sort();
    expect(names).toEqual(['Alice', 'Carol']);

    activeUsers.forEach(user => {
      expect(user.status).toBe('active');
      expect(user.type).toBe('user');
    });
  });

  test('Large dataset pattern query performance', () => {
    // Create larger dataset for performance testing
    const startTime = Date.now();
    
    const testData = [];
    for (let i = 0; i < 100; i++) {
      testData.push({
        type: 'test-item',
        id: `item-${i}`,
        name: `Test Item ${i}`,
        value: i * 10,
        category: ['A', 'B', 'C'][i % 3],
        active: i % 2 === 0
      });
    }

    // Batch add data
    store.addBatch(testData);
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(2000); // Should load quickly

    // Simple pattern query using actual storage format
    const simplePattern = [
      {
        subject: '?entity',
        predicate: 'entity/type',
        object: 'test-item'
      },
      {
        subject: '?entity',
        predicate: 'entity/id',
        object: '?entityId'
      }
    ];

    const queryStart = Date.now();
    const translatedQuery = translator.translate(simplePattern);
    const rawResults = queryEngine.queryWithObjects(translatedQuery);
    const queryTime = Date.now() - queryStart;

    expect(queryTime).toBeLessThan(1000); // Query should be fast
    expect(rawResults.length).toBe(100); // All test items

    // Extract objects from array results (query returns [entityId, object] pairs)
    const results = rawResults.map(result => result[1]);

    // Filter for active items in the objects
    const activeItems = results.filter(item => item.active === true);
    expect(activeItems.length).toBe(50); // Half should be active

    // Verify results
    activeItems.forEach(item => {
      expect(item.type).toBe('test-item');
      expect(item.active).toBe(true);
      expect(['A', 'B', 'C']).toContain(item.category);
      expect(typeof item.value).toBe('number');
    });

    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(3000); // Complete test should finish quickly
  });

  test('Backward compatibility with different query styles', () => {
    // Add test data
    const documents = [
      { type: 'document', title: 'Report A', author: 'Alice', status: 'published' },
      { type: 'document', title: 'Report B', author: 'Bob', status: 'draft' },
      { type: 'document', title: 'Report C', author: 'Alice', status: 'published' }
    ];

    documents.forEach(doc => store.add(doc));

    // Test different pattern query styles should produce same results (using actual storage format)

    // Style 1: Object format
    const objectStylePattern = [
      { subject: '?entity', predicate: 'entity/type', object: 'document' },
      { subject: '?entity', predicate: 'entity/id', object: '?entityId' }
    ];

    // Style 2: Array format  
    const arrayStylePattern = [
      ['?entity', 'entity/type', 'document'],
      ['?entity', 'entity/id', '?entityId']
    ];

    const objectQuery = translator.translate(objectStylePattern);
    const arrayQuery = translator.translate(arrayStylePattern);

    const rawObjectResults = queryEngine.queryWithObjects(objectQuery);
    const rawArrayResults = queryEngine.queryWithObjects(arrayQuery);

    // Both should return same results
    expect(rawObjectResults.length).toBe(rawArrayResults.length);
    expect(rawObjectResults.length).toBe(3); // All documents

    // Extract objects from array results (query returns [entityId, object] pairs)
    const objectResults = rawObjectResults.map(result => result[1]);
    const arrayResults = rawArrayResults.map(result => result[1]);

    // Filter for Alice's documents in the objects
    const objectAliceDocs = objectResults.filter(doc => doc.author === 'Alice');
    const arrayAliceDocs = arrayResults.filter(doc => doc.author === 'Alice');
    
    expect(objectAliceDocs.length).toBe(2); // Alice has 2 documents
    expect(arrayAliceDocs.length).toBe(2); // Alice has 2 documents

    const objectTitles = objectAliceDocs.map(doc => doc.title).sort();
    const arrayTitles = arrayAliceDocs.map(doc => doc.title).sort();
    
    expect(objectTitles).toEqual(arrayTitles);
    expect(objectTitles).toEqual(['Report A', 'Report C']);
  });
});