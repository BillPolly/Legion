import { IncrementalLFTJ, QueryHandle } from '../../src/IncrementalLFTJ.js';
import { Schema } from '../../src/Schema.js';
import { Tuple } from '../../src/Tuple.js';
import { ID, StringAtom, Integer, Float, BooleanAtom } from '../../src/Atom.js';
import { EnumerableProvider } from '../../src/ComputeProvider.js';

describe('IncrementalLFTJ API', () => {
  let engine;

  beforeEach(() => {
    engine = new IncrementalLFTJ({
      batchSize: 10,
      autoFlush: false
    });
  });

  afterEach(() => {
    engine.reset();
  });

  describe('constructor', () => {
    it('should create engine with default options', () => {
      const defaultEngine = new IncrementalLFTJ();
      expect(defaultEngine).toBeDefined();
      expect(defaultEngine.getStatistics().queries).toBe(0);
      defaultEngine.reset();
    });

    it('should create engine with custom options', () => {
      const customEngine = new IncrementalLFTJ({
        batchSize: 500,
        batchMode: false,
        validateSchemas: false
      });
      expect(customEngine).toBeDefined();
      customEngine.reset();
    });
  });

  describe('relation management', () => {
    it('should define relations with Schema objects', () => {
      const schema = new Schema([
        { name: 'id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      engine.defineRelation('users', schema);
      expect(engine._relations.has('users')).toBe(true);
    });

    it('should define relations with array schema', () => {
      engine.defineRelation('users', [
        { name: 'id', type: 'ID' },
        { name: 'name', type: 'String' }
      ]);

      expect(engine._relations.has('users')).toBe(true);
    });

    it('should define relations with object schema', () => {
      engine.defineRelation('users', {
        id: 'ID',
        name: 'String',
        age: 'Integer'
      });

      expect(engine._relations.has('users')).toBe(true);
    });

    it('should throw error for duplicate relation', () => {
      engine.defineRelation('users', { id: 'ID' });
      
      expect(() => {
        engine.defineRelation('users', { id: 'ID' });
      }).toThrow('Relation \'users\' already defined');
    });
  });

  describe('provider registration', () => {
    it('should register compute providers', () => {
      class TestProvider extends EnumerableProvider {
        enumerate() { return new Set(); }
        deltaSince() { return { adds: new Set(), removes: new Set() }; }
      }

      const provider = new TestProvider('test-provider');
      engine.registerProvider('test', provider);

      expect(engine._providers.has('test')).toBe(true);
    });

    it('should throw error for duplicate provider', () => {
      class TestProvider extends EnumerableProvider {
        enumerate() { return new Set(); }
        deltaSince() { return { adds: new Set(), removes: new Set() }; }
      }

      const provider = new TestProvider('test-provider');
      engine.registerProvider('test', provider);

      expect(() => {
        engine.registerProvider('test', provider);
      }).toThrow('Provider \'test\' already registered');
    });
  });

  describe('query registration', () => {
    beforeEach(() => {
      engine.defineRelation('users', {
        id: 'ID',
        name: 'String'
      });
    });

    it('should register QueryBuilder queries', () => {
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));

      const handle = engine.register(query);

      expect(handle).toBeInstanceOf(QueryHandle);
      expect(handle.id).toBe('test-query');
      expect(handle.isActive).toBe(true);
    });

    it('should auto-generate query ID if not provided', () => {
      const query = engine.query()
        .from('users', engine._relations.get('users'));

      const handle = engine.register(query);

      expect(handle.id).toMatch(/^query_\d+$/);
    });

    it('should throw error for duplicate query ID', () => {
      const query1 = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      const query2 = engine.query('test-query')
        .from('users', engine._relations.get('users'));

      engine.register(query1);

      expect(() => {
        engine.register(query2);
      }).toThrow('Query \'test-query\' already registered');
    });

    it('should perform cold start by default', () => {
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));

      const handle = engine.register(query);
      const results = handle.getResults();

      expect(results).toBeDefined();
    });

    it('should skip cold start when requested', () => {
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));

      const handle = engine.register(query, { coldStart: false });
      
      // Results should still be available (empty)
      const results = handle.getResults();
      expect(results).toBeDefined();
    });
  });

  describe('data manipulation', () => {
    beforeEach(() => {
      engine.defineRelation('users', {
        id: 'ID',
        name: 'String'
      });

      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      engine.register(query);
    });

    it('should insert tuples', () => {
      const results = engine.insert('users', [
        ['u1', 'Alice'],
        ['u2', 'Bob']
      ]);

      expect(results.has('test-query')).toBe(true);
    });

    it('should insert single tuple', () => {
      const results = engine.insert('users', ['u1', 'Alice']);
      expect(results.has('test-query')).toBe(true);
    });

    it('should insert Tuple objects', () => {
      const tuple = new Tuple([new ID('u1'), new StringAtom('Alice')]);
      const results = engine.insert('users', tuple);
      expect(results.has('test-query')).toBe(true);
    });

    it('should insert object tuples', () => {
      const results = engine.insert('users', {
        id: 'u1',
        name: 'Alice'
      });

      expect(results.has('test-query')).toBe(true);
    });

    it('should delete tuples', () => {
      engine.insert('users', ['u1', 'Alice']);
      
      const results = engine.delete('users', ['u1', 'Alice']);
      expect(results.has('test-query')).toBe(true);
    });

    it('should update tuples', () => {
      engine.insert('users', ['u1', 'Alice']);
      
      const results = engine.update('users', 
        ['u1', 'Alice'],
        ['u1', 'Alice Updated']
      );
      
      expect(results.has('test-query')).toBe(true);
    });
  });

  describe('QueryHandle', () => {
    let handle;

    beforeEach(() => {
      engine.defineRelation('users', {
        id: 'ID',
        name: 'String'
      });

      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      handle = engine.register(query);
    });

    it('should subscribe to results', () => {
      let notificationReceived = false;
      let lastNotification = null;

      const unsubscribe = handle.subscribe((notification) => {
        notificationReceived = true;
        lastNotification = notification;
      });

      engine.insert('users', ['u1', 'Alice']);
      engine.flush();

      expect(notificationReceived).toBe(true);
      expect(lastNotification.results).toBeDefined();

      unsubscribe();
    });

    it('should include deltas when requested', () => {
      let lastNotification = null;

      handle.subscribe((notification) => {
        lastNotification = notification;
      }, { includeDeltas: true });

      engine.insert('users', ['u1', 'Alice']);
      engine.flush();

      expect(lastNotification.delta).toBeDefined();
    });

    it('should include stats when requested', () => {
      let lastNotification = null;

      handle.subscribe((notification) => {
        lastNotification = notification;
      }, { includeStats: true });

      engine.insert('users', ['u1', 'Alice']);
      engine.flush();

      expect(lastNotification.stats).toBeDefined();
    });

    it('should get current results', () => {
      engine.insert('users', ['u1', 'Alice']);
      engine.flush();

      const results = handle.getResults();
      expect(results).toBeDefined();
    });

    it('should get statistics', () => {
      const stats = handle.getStatistics();
      expect(stats).toBeDefined();
      expect(stats.graphId).toBe('test-query');
    });

    it('should reset query state', () => {
      engine.insert('users', ['u1', 'Alice']);
      engine.flush();

      handle.reset();

      const stats = handle.getStatistics();
      expect(stats.deltaCount).toBe(0);
    });

    it('should deactivate query', () => {
      handle.deactivate();
      
      expect(handle.isActive).toBe(false);
      expect(() => handle.getResults()).toThrow('Query is not active');
    });
  });

  describe('transactions', () => {
    beforeEach(() => {
      engine.defineRelation('users', {
        id: 'ID',
        name: 'String'
      });

      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      engine.register(query);
    });

    it('should batch updates in transaction', () => {
      engine.beginTransaction();

      engine.insert('users', ['u1', 'Alice']);
      engine.insert('users', ['u2', 'Bob']);
      engine.insert('users', ['u3', 'Carol']);

      engine.endTransaction();

      // All updates should be batched
      const stats = engine.getStatistics();
      expect(stats.batch.totalDeltas).toBe(3);
    });

    it('should execute function in transaction', async () => {
      const result = await engine.transaction(async () => {
        engine.insert('users', ['u1', 'Alice']);
        engine.insert('users', ['u2', 'Bob']);
        return 'success';
      });

      expect(result).toBe('success');
    });
  });

  describe('global subscriptions', () => {
    it('should notify global subscribers', () => {
      let notificationReceived = false;
      let lastNotification = null;

      engine.defineRelation('users', { id: 'ID' });

      const unsubscribe = engine.onUpdate((notification) => {
        notificationReceived = true;
        lastNotification = notification;
      });

      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      engine.register(query);

      engine.insert('users', ['u1']);
      engine.flush();

      expect(notificationReceived).toBe(true);
      expect(lastNotification.relationName).toBe('users');
      expect(lastNotification.affectedQueries).toContain('test-query');

      unsubscribe();
    });
  });

  describe('static helpers', () => {
    it('should create atoms from values', () => {
      expect(IncrementalLFTJ.atom('test')).toBeInstanceOf(StringAtom);
      expect(IncrementalLFTJ.atom(42)).toBeInstanceOf(Integer);
      expect(IncrementalLFTJ.atom(3.14)).toBeInstanceOf(Float);
      expect(IncrementalLFTJ.atom(true)).toBeInstanceOf(BooleanAtom);
      
      expect(IncrementalLFTJ.atom('id1', 'ID')).toBeInstanceOf(ID);
      expect(IncrementalLFTJ.atom('str', 'String')).toBeInstanceOf(StringAtom);
    });

    it('should create tuples from values', () => {
      const tuple = IncrementalLFTJ.tuple(['u1', 'Alice', 25]);
      
      expect(tuple).toBeInstanceOf(Tuple);
      expect(tuple.arity).toBe(3);
      expect(tuple.atoms[0]).toBeInstanceOf(StringAtom);
      expect(tuple.atoms[2]).toBeInstanceOf(Integer);
    });
  });

  describe('query lifecycle', () => {
    it('should list registered queries', () => {
      engine.defineRelation('users', { id: 'ID' });
      
      const query1 = engine.query('query1').from('users', engine._relations.get('users'));
      const query2 = engine.query('query2').from('users', engine._relations.get('users'));
      
      engine.register(query1);
      engine.register(query2);

      const queries = engine.listQueries();
      expect(queries).toContain('query1');
      expect(queries).toContain('query2');
      expect(queries).toHaveLength(2);
    });

    it('should get query by ID', () => {
      engine.defineRelation('users', { id: 'ID' });
      
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      engine.register(query);

      const handle = engine.getQuery('test-query');
      expect(handle).toBeInstanceOf(QueryHandle);
      expect(handle.id).toBe('test-query');
    });

    it('should deactivate query by ID', () => {
      engine.defineRelation('users', { id: 'ID' });
      
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      engine.register(query);

      engine.deactivateQuery('test-query');

      expect(engine.getQuery('test-query')).toBeUndefined();
      expect(engine.listQueries()).not.toContain('test-query');
    });
  });

  describe('statistics', () => {
    it('should provide engine statistics', () => {
      engine.defineRelation('users', { id: 'ID' });
      engine.defineRelation('orders', { id: 'ID' });
      
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      engine.register(query);

      const stats = engine.getStatistics();
      
      expect(stats.queries).toBe(1);
      expect(stats.relations).toBe(2);
      expect(stats.providers).toBe(0);
      expect(stats.batch).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset engine state', () => {
      engine.defineRelation('users', { id: 'ID' });
      
      const query = engine.query('test-query')
        .from('users', engine._relations.get('users'));
      const handle = engine.register(query);

      engine.reset();

      expect(handle.isActive).toBe(false);
      expect(engine.listQueries()).toHaveLength(0);
    });
  });
});