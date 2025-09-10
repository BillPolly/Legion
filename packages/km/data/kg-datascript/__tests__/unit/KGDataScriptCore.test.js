import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';

describe('KGDataScriptCore', () => {
  let core;

  beforeEach(() => {
    core = new KGDataScriptCore();
  });

  describe('Core initialization and basic operations', () => {
    test('should create instance with DataScript connection', () => {
      expect(core).toBeDefined();
      expect(core.conn).toBeDefined();
      expect(typeof core.conn.db).toBe('function');
    });

    test('should have DataScript methods', () => {
      // Should have DataScript methods
      expect(typeof core.transact).toBe('function');
      expect(typeof core.q).toBe('function');
      expect(typeof core.pull).toBe('function');
    });

    test('should initialize with optional schema', () => {
      const schema = {
        ':person/name': { unique: 'identity' },
        ':person/friends': { 
          card: 'many',
          valueType: 'ref'
        }
      };
      
      const coreWithSchema = new KGDataScriptCore(schema);
      expect(coreWithSchema.schema).toEqual(schema);
    });

    test('should initialize without schema', () => {
      const coreNoSchema = new KGDataScriptCore();
      expect(coreNoSchema.schema).toEqual({});
    });
  });

  describe('Transaction handling', () => {
    test('should execute transactions', () => {
      const tx = [
        { ':db/id': -1, ':person/name': 'Alice', ':person/age': 30 }
      ];
      
      const result = core.transact(tx);
      expect(result).toBeDefined();
      expect(result.tempids).toBeDefined();
      expect(result.dbAfter).toBeDefined();
    });

    test('should handle entity maps in transactions', () => {
      const tx = [
        { ':db/id': -1, ':person/name': 'Bob', ':person/age': 25 }
      ];
      
      const result = core.transact(tx);
      expect(result).toBeDefined();
      expect(result.tempids).toBeDefined();
      expect(result.tempids.get(-1)).toBeDefined();
    });

    test('should query after transaction', () => {
      // Add data
      core.transact([
        { ':db/id': -1, ':person/name': 'Charlie', ':person/age': 35 }
      ]);
      
      // Query
      const results = core.q({
        find: ['?name'],
        where: [
          ['?e', ':person/name', '?name'],
          ['?e', ':person/age', 35]
        ]
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0][0]).toBe('Charlie');
    });

    test('should support retract operations', () => {
      // Add data
      const result1 = core.transact([
        { ':db/id': -1, ':person/name': 'David', ':person/age': 40 }
      ]);
      const entityId = result1.tempids.get(-1);
      
      // Retract
      core.transact([
        ['-', entityId, ':person/age', 40]
      ]);
      
      // Query to verify retraction
      const results = core.q({
        find: ['?age'],
        where: [
          [entityId, ':person/age', '?age']
        ]
      });
      
      expect(results.length).toBe(0);
    });
  });

  describe('DataScript method exposure', () => {
    test('should expose db method', () => {
      const db = core.db();
      expect(db).toBeDefined();
      expect(db.idx).toBeDefined(); // DataScript index
    });

    test('should expose pull API', () => {
      // Add entity
      const result = core.transact([
        { ':db/id': -1, ':person/name': 'Eve', ':person/age': 28 }
      ]);
      const entityId = result.tempids.get(-1);
      
      // Pull
      const entity = core.pull([':person/name', ':person/age'], entityId);
      expect(entity[':person/name']).toBe('Eve');
      expect(entity[':person/age']).toBe(28);
    });

    test('should expose entity API', () => {
      // Add entity
      const result = core.transact([
        { ':db/id': -1, ':person/name': 'Frank', ':person/age': 45 }
      ]);
      const entityId = result.tempids.get(-1);
      
      // Get entity
      const entity = core.entity(entityId);
      expect(entity[':person/name']).toBe('Frank');
      expect(entity[':person/age']).toBe(45);
    });
  });
});