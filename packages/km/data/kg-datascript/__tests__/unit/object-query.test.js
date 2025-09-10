import { KGEngine } from '../../src/KGEngine.js';

describe('Object Query Test', () => {
  test('query with object format', () => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };
    const engine = new KGEngine(schema);
    
    // Add test data
    const person1 = { type: 'person', name: 'Alice', age: 30 };
    const result1 = engine.add(person1);
    console.log('Add result:', result1);
    
    // Try object-based query
    const query1 = {
      find: ['?e', '?id'],
      where: [
        ['?e', ':entity/id', '?id']
      ]
    };
    
    const results1 = engine.core.q(query1);
    console.log('Query 1 (find all entities):', results1);
    
    // Query for specific ID
    const query2 = {
      find: ['?e'],
      where: [
        ['?e', ':entity/id', 1]
      ]
    };
    
    const results2 = engine.core.q(query2);
    console.log('Query 2 (find entity with ID 1):', results2);
    
    // Query for type
    const query3 = {
      find: ['?e', '?type'],
      where: [
        ['?e', ':entity/type', '?type']
      ]
    };
    
    const results3 = engine.core.q(query3);
    console.log('Query 3 (find all types):', results3);
    
    // Check database datoms directly
    const db = engine.core.db();
    const datoms = db.datoms('eavt');
    console.log('All datoms:', datoms);
    
    expect(results1.length).toBeGreaterThan(0);
  });
});