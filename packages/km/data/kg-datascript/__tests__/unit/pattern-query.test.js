import { KGEngine } from '../../src/KGEngine.js';

describe('Pattern Query Test', () => {
  test('pattern query with simple filter', () => {
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
    
    console.log('Testing pattern query...');
    
    // Test queryPattern with simple filter
    const pattern = { type: 'person' };
    console.log('Pattern:', pattern);
    
    try {
      const results = engine.queryPattern(pattern);
      console.log('Pattern query results:', results);
      console.log('Results length:', results.length);
      
      if (results.length > 0) {
        console.log('First result:', results[0]);
        console.log('First result type:', results[0]?.type);
      }
      
      expect(results.length).toBe(2);
      expect(results.every(r => r.type === 'person')).toBe(true);
    } catch (error) {
      console.error('Pattern query error:', error.message);
      console.error('Stack:', error.stack);
      throw error;
    }
    
    // Test find
    console.log('\nTesting find...');
    const findPattern = { type: 'person', name: 'Alice' };
    const found = engine.find(findPattern);
    console.log('Find result:', found);
    expect(found).toBeDefined();
    expect(found.name).toBe('Alice');
    
    // Test findAll
    console.log('\nTesting findAll...');
    const allPersons = engine.findAll({ type: 'person' });
    console.log('FindAll results:', allPersons);
    expect(allPersons.length).toBe(2);
  });
});