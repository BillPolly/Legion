import { KGEngine } from '../../src/KGEngine.js';

describe('Multi-Property Query Test', () => {
  test('multi-property pattern queries', () => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':entity/name': { card: 'one' },
      ':entity/age': { card: 'one' },
      ':entity/city': { card: 'one' }
    };
    const engine = new KGEngine(schema);
    
    // Add test data
    const person1 = { type: 'person', name: 'Alice', age: 30, city: 'NYC' };
    const person2 = { type: 'person', name: 'Bob', age: 25, city: 'LA' };
    const person3 = { type: 'person', name: 'Alice', age: 35, city: 'SF' };
    const company = { type: 'company', name: 'TechCorp', city: 'NYC' };
    
    engine.add(person1);
    engine.add(person2);
    engine.add(person3);
    engine.add(company);
    
    console.log('Testing multi-property queries...');
    
    // Test 1: Query by type and name
    const aliceQuery = { type: 'person', name: 'Alice' };
    console.log('Query:', aliceQuery);
    
    const aliceResults = engine.queryPattern(aliceQuery);
    console.log('Alice results:', aliceResults);
    expect(aliceResults.length).toBe(2);
    expect(aliceResults.every(r => r.name === 'Alice' && r.type === 'person')).toBe(true);
    
    // Test 2: Query by type, name and age
    const specificAliceQuery = { type: 'person', name: 'Alice', age: 30 };
    console.log('\nQuery:', specificAliceQuery);
    
    const specificAliceResults = engine.queryPattern(specificAliceQuery);
    console.log('Specific Alice results:', specificAliceResults);
    expect(specificAliceResults.length).toBe(1);
    expect(specificAliceResults[0].name).toBe('Alice');
    expect(specificAliceResults[0].age).toBe(30);
    expect(specificAliceResults[0].city).toBe('NYC');
    
    // Test 3: Query by city
    const nycQuery = { city: 'NYC' };
    console.log('\nQuery:', nycQuery);
    
    const nycResults = engine.queryPattern(nycQuery);
    console.log('NYC results:', nycResults);
    expect(nycResults.length).toBe(2); // Alice (person) and TechCorp (company)
    expect(nycResults.every(r => r.city === 'NYC')).toBe(true);
    
    // Test 4: find method with multi-property
    console.log('\nTesting find with multiple properties...');
    const foundBob = engine.find({ type: 'person', name: 'Bob' });
    console.log('Found Bob:', foundBob);
    expect(foundBob).toBeDefined();
    expect(foundBob.name).toBe('Bob');
    expect(foundBob.age).toBe(25);
    expect(foundBob.city).toBe('LA');
    
    console.log('\nAll multi-property queries working!');
  });
});