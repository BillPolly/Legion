import { KGDataStoreActor } from '../../../src/server/KGDataStoreActor.js';

describe('KGDataStoreActor', () => {
  let dataStoreActor;
  let mockClient;

  beforeEach(() => {
    // Create actor with optional schema
    dataStoreActor = new KGDataStoreActor({
      id: 'test-store',
      schema: {
        ':person/name': { ':db/cardinality': ':db.cardinality/one' },
        ':person/age': { ':db/cardinality': ':db.cardinality/one' }
      }
    });

    // Mock client actor
    mockClient = {
      id: 'test-client-123',
      sendCalls: [],
      send: function(message) {
        this.sendCalls.push(message);
      }
    };
  });

  afterEach(async () => {
    if (dataStoreActor) {
      await dataStoreActor.destroy();
    }
  });

  describe('Actor Creation', () => {
    test('should create data store actor with schema', () => {
      expect(dataStoreActor).toBeDefined();
      expect(dataStoreActor.engine).toBeDefined();
      expect(dataStoreActor.subscriptions).toBeInstanceOf(Map);
      expect(dataStoreActor.id).toBe('test-store');
    });

    test('should have default options', () => {
      expect(dataStoreActor.options.enableChangeNotifications).toBe(true);
    });

    test('should accept custom options', () => {
      const customActor = new KGDataStoreActor({
        id: 'custom-store',
        enableChangeNotifications: false
      });
      
      expect(customActor.options.enableChangeNotifications).toBe(false);
      customActor.destroy();
    });
  });

  describe('Object Operations', () => {
    test('should handle add message', async () => {
      const obj = { name: 'Alice', age: 30 };
      const result = await dataStoreActor.receive({
        type: 'add',
        payload: { object: obj, id: 'alice' }
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.id).toBe('alice');
      expect(result.object).toEqual(obj);
    });

    test('should handle get message', async () => {
      const obj = { name: 'Bob', age: 25 };
      await dataStoreActor.receive({
        type: 'add',
        payload: { object: obj, id: 'bob' }
      }, mockClient);

      const result = await dataStoreActor.receive({
        type: 'get',
        payload: { id: 'bob' }
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.object).toEqual(obj);
    });

    test('should handle update message', async () => {
      const obj = { name: 'Charlie', age: 35 };
      await dataStoreActor.receive({
        type: 'add',
        payload: { object: obj, id: 'charlie' }
      }, mockClient);

      const result = await dataStoreActor.receive({
        type: 'update',
        payload: { object: obj, updates: { age: 36 } }
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.object.age).toBe(36);
    });

    test('should handle remove message', async () => {
      const obj = { name: 'Diana', age: 40 };
      await dataStoreActor.receive({
        type: 'add',
        payload: { object: obj, id: 'diana' }
      }, mockClient);

      const result = await dataStoreActor.receive({
        type: 'remove',
        payload: { id: 'diana' }
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.id).toBe('diana');

      const getResult = await dataStoreActor.receive({
        type: 'get',
        payload: { id: 'diana' }
      }, mockClient);

      expect(getResult.object).toBeNull();
    });
  });

  describe('Query Operations', () => {
    beforeEach(async () => {
      await dataStoreActor.receive({
        type: 'add',
        payload: { object: { name: 'Alice', role: 'Developer' }, id: 'alice' }
      }, mockClient);
      
      await dataStoreActor.receive({
        type: 'add',
        payload: { object: { name: 'Bob', role: 'Designer' }, id: 'bob' }
      }, mockClient);
      
      await dataStoreActor.receive({
        type: 'add',
        payload: { object: { name: 'Charlie', role: 'Developer' }, id: 'charlie' }
      }, mockClient);
    });

    test('should handle find message', async () => {
      const result = await dataStoreActor.receive({
        type: 'find',
        payload: { pattern: { role: 'Developer' } }
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(result.results.map(r => r.name).sort()).toEqual(['Alice', 'Charlie']);
    });

    test('should handle getAll message', async () => {
      const result = await dataStoreActor.receive({
        type: 'getAll',
        payload: {}
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(3);
      expect(result.results.map(r => r.name).sort()).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    test('should handle query message', async () => {
      const result = await dataStoreActor.receive({
        type: 'query',
        payload: { 
          query: '[:find ?id :where [?e :object/id ?id]]'
        }
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    });
  });

  describe('Subscription Management', () => {
    test('should handle subscribe message', async () => {
      const result = await dataStoreActor.receive({
        type: 'subscribe',
        payload: {}
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.subscribed).toBe(true);
      expect(dataStoreActor.subscriptions.has('test-client-123')).toBe(true);
    });

    test('should handle unsubscribe message', async () => {
      await dataStoreActor.receive({
        type: 'subscribe',
        payload: {}
      }, mockClient);

      const result = await dataStoreActor.receive({
        type: 'unsubscribe',
        payload: {}
      }, mockClient);

      expect(result.success).toBe(true);
      expect(result.unsubscribed).toBe(true);
      expect(dataStoreActor.subscriptions.has('test-client-123')).toBe(false);
    });

    test('should propagate changes to subscribers', async () => {
      await dataStoreActor.receive({
        type: 'subscribe',
        payload: {}
      }, mockClient);

      await dataStoreActor.receive({
        type: 'add',
        payload: { object: { name: 'Test' }, id: 'test-1' }
      }, mockClient);

      // Wait for async notification
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockClient.sendCalls.length).toBeGreaterThan(0);
      const call = mockClient.sendCalls[0];
      expect(call.type).toBe('change-notification');
      expect(call.changes).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle unknown message type', async () => {
      const result = await dataStoreActor.receive({
        type: 'unknown',
        payload: {}
      }, mockClient);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown message type');
    });

    test('should handle errors in operations', async () => {
      const result = await dataStoreActor.receive({
        type: 'update',
        payload: { object: { name: 'NonExistent' }, updates: { age: 100 } }
      }, mockClient);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', async () => {
      await dataStoreActor.receive({
        type: 'subscribe',
        payload: {}
      }, mockClient);

      await dataStoreActor.destroy();

      expect(dataStoreActor.subscriptions.size).toBe(0);
    });
  });
});