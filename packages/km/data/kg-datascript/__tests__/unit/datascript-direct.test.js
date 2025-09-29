import { createConn } from '../../../datascript/src/core/conn.js';
import { q } from '../../../datascript/src/query/query.js';

describe('Direct DataScript Test', () => {
  test('verify DataScript works with entity maps', () => {
    // Create connection with schema
    const conn = createConn({
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    });
    
    // Transaction 1: Use entity map format
    console.log('=== Test 1: Entity map format ===');
    const tx1 = conn.transact([{
      ':db/id': -1,
      ':entity/id': 100,
      ':entity/type': 'person',
      ':entity/data': 'Alice'
    }]);
    console.log('Tempids:', tx1.tempids);
    
    // Query after transaction
    const result1 = q('[:find ?e ?id :where [?e :entity/id ?id]]', conn.db());
    console.log('Query result:', result1);
    
    // Transaction 2: Use add operation format
    console.log('\n=== Test 2: Add operation format ===');
    const tx2 = conn.transact([
      ['+', -2, ':entity/id', 200],
      ['+', -2, ':entity/type', 'person'],
      ['+', -2, ':entity/data', 'Bob']
    ]);
    console.log('Tempids:', tx2.tempids);
    
    // Query after transaction
    const result2 = q('[:find ?e ?id :where [?e :entity/id ?id]]', conn.db());
    console.log('Query result:', result2);
    
    // Transaction 3: Mixed format
    console.log('\n=== Test 3: Mixed format ===');
    const tx3 = conn.transact([
      { ':entity/id': 300, ':entity/type': 'company', ':entity/data': 'TechCorp' },
      ['+', -3, ':entity/id', 400],
      ['+', -3, ':entity/type', 'company'],
      ['+', -3, ':entity/data', 'DataCorp']
    ]);
    console.log('Tempids:', tx3.tempids);
    
    // Final query
    const finalResult = q('[:find ?e ?id ?type :where [?e :entity/id ?id] [?e :entity/type ?type]]', conn.db());
    console.log('Final query result:', finalResult);
    
    // Query all datoms
    const allDatoms = q('[:find ?e ?a ?v :where [?e ?a ?v]]', conn.db());
    console.log('Total datoms:', allDatoms.length);
    if (allDatoms.length > 0) {
      console.log('First few datoms:', allDatoms.slice(0, 5));
    }
    
    // Check database directly
    const db = conn.db();
    console.log('\n=== Database inspection ===');
    console.log('DB type:', db.constructor.name);
    console.log('DB schema:', db.schema);
    
    // Try using datoms method directly
    const eavtDatoms = db.datoms('eavt');
    console.log('EAVT datoms:', eavtDatoms);
    
    // Check indexes
    console.log('Index keys:', Object.keys(db.idx));
    console.log('EAVT index:', db.idx.eavt);
    
    expect(finalResult.length).toBeGreaterThan(0);
  });
});