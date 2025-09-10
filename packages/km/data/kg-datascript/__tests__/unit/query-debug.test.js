import { KGEngine } from '../../src/KGEngine.js';

describe('Query Debug Test', () => {
  test('debug query execution with hydration', () => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };
    const engine = new KGEngine(schema);
    
    // Add test data
    const person1 = { type: 'person', name: 'Alice', age: 30 };
    const person2 = { type: 'person', name: 'Bob', age: 25 };
    const company = { type: 'company', name: 'TechCorp' };
    
    engine.add(person1);
    engine.add(person2);
    engine.add(company);
    
    console.log('Added objects:');
    console.log('  person1:', person1);
    console.log('  person2:', person2);
    console.log('  company:', company);
    
    // Try EDN query
    const ednQuery = '[:find ?e :where [?e :entity/type "person"]]';
    console.log('\nRunning EDN query:', ednQuery);
    
    const results = engine.query(ednQuery);
    console.log('Results:', results);
    console.log('Results type:', typeof results);
    console.log('Results isArray:', Array.isArray(results));
    console.log('Results length:', results.length);
    
    if (results.length > 0) {
      console.log('First result:', results[0]);
      console.log('First result type:', typeof results[0]);
      if (typeof results[0] === 'object') {
        console.log('First result keys:', Object.keys(results[0]));
        console.log('First result.type:', results[0].type);
      }
    }
    
    // Check if results are actually the objects
    console.log('\nChecking object identity:');
    console.log('results[0] === person1:', results[0] === person1);
    console.log('results[0] === person2:', results[0] === person2);
    console.log('results[1] === person1:', results[1] === person1);
    console.log('results[1] === person2:', results[1] === person2);
    
    // Try object query
    const objQuery = {
      find: ['?e'],
      where: [
        ['?e', ':entity/type', 'person']
      ]
    };
    console.log('\nRunning object query:', JSON.stringify(objQuery));
    
    const objResults = engine.query(objQuery);
    console.log('Object query results:', objResults);
    
    expect(results.length).toBe(2);
    expect(results.every(r => r.type === 'person')).toBe(true);
  });
});