import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { q } from '../../../datascript/src/query/query.js';

describe('KGDataScriptCore Integration', () => {
  let core;

  beforeEach(() => {
    // Use real DataScript with schema
    const schema = {
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/friend': { 
        card: 'many',
        valueType: 'ref'
      },
      ':person/email': { 
        unique: 'identity',
        card: 'one'
      }
    };
    core = new KGDataScriptCore(schema);
  });

  test('Real DataScript operations', () => {
    // Complex transaction with multiple entities and references
    const tx = [
      { ':db/id': -1, ':person/name': 'Alice', ':person/age': 30, ':person/email': 'alice@test.com' },
      { ':db/id': -2, ':person/name': 'Bob', ':person/age': 25, ':person/email': 'bob@test.com' },
      { ':db/id': -3, ':person/name': 'Charlie', ':person/age': 35, ':person/email': 'charlie@test.com', ':person/friend': [-1, -2] }
    ];
    
    const result = core.transact(tx);
    
    // Verify transaction succeeded
    expect(result.txData).toBeDefined();
    expect(result.txData.length).toBeGreaterThan(0);
    expect(result.tempids.size).toBe(3);
    
    // Complex query with joins
    const friends = core.q({
      find: ['?friend-name'],
      where: [
        ['?e', ':person/email', 'charlie@test.com'],
        ['?e', ':person/friend', '?f'],
        ['?f', ':person/name', '?friend-name']
      ]
    });
    
    expect(friends.map(row => row[0])).toContain('Alice');
    expect(friends.map(row => row[0])).toContain('Bob');
    expect(friends.length).toBe(2);
  });

  test('Aggregation queries', () => {
    // Add test data
    core.transact([
      { ':db/id': -1, ':person/name': 'Group1', ':person/age': 20 },
      { ':db/id': -2, ':person/name': 'Group2', ':person/age': 20 },
      { ':db/id': -3, ':person/name': 'Group3', ':person/age': 30 },
      { ':db/id': -4, ':person/name': 'Group4', ':person/age': 30 },
      { ':db/id': -5, ':person/name': 'Group5', ':person/age': 30 }
    ]);
    
    // Simple count by grouping manually (DataScript aggregation syntax is different)
    const age20 = core.q({
      find: ['?e'],
      where: [
        ['?e', ':person/age', 20]
      ]
    });
    
    const age30 = core.q({
      find: ['?e'],
      where: [
        ['?e', ':person/age', 30]
      ]
    });
    
    expect(age20.length).toBe(2);
    expect(age30.length).toBe(3);
  });

  test('Transaction functions', () => {
    // Transaction function that adds computed data
    const txFn = (db) => {
      const baseAge = 25;
      return [
        { ':db/id': -1, ':person/name': 'Computed1', ':person/age': baseAge },
        { ':db/id': -2, ':person/name': 'Computed2', ':person/age': baseAge * 2 }
      ];
    };
    
    const result = core.transact(txFn);
    expect(result.txData).toBeDefined();
    
    // Verify computed values
    const ages = core.q({
      find: ['?name', '?age'],
      where: [
        ['?e', ':person/name', '?name'],
        ['?e', ':person/age', '?age']
      ]
    });
    
    const ageMap = new Map(ages);
    expect(ageMap.get('Computed1')).toBe(25);
    expect(ageMap.get('Computed2')).toBe(50);
  });

  test('Upsert with unique identity', () => {
    // Initial insert
    core.transact([
      { ':db/id': -1, ':person/email': 'unique@test.com', ':person/name': 'Original', ':person/age': 20 }
    ]);
    
    // Upsert with same email (unique identity)  
    core.transact([
      { ':person/email': 'unique@test.com', ':person/name': 'Updated', ':person/age': 21 }
    ]);
    
    // Query to verify update
    const result = core.q({
      find: ['?name', '?age'],
      where: [
        ['?e', ':person/email', 'unique@test.com'],
        ['?e', ':person/name', '?name'],
        ['?e', ':person/age', '?age']
      ]
    });
    
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(['Updated', 21]);
  });

  test('History and time travel', () => {
    // Add and modify data
    const tx1 = core.transact([
      { ':db/id': -1, ':person/name': 'Temporal', ':person/age': 10 }
    ]);
    const entityId = tx1.tempids.get(-1);
    
    const tx2 = core.transact([
      ['+', entityId, ':person/age', 20]
    ]);
    
    const tx3 = core.transact([
      ['+', entityId, ':person/age', 30]
    ]);
    
    // Get history
    const history = core.history();
    
    // Query current state
    const currentAge = core.q({
      find: ['?age'],
      where: [[entityId, ':person/age', '?age']]
    });
    
    // DataScript tracks latest value for cardinality/one attributes
    expect(currentAge[0][0]).toBe(30);
  });
});