import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('KGEntityProxy Notification System', () => {
  let core;
  let identityManager;
  let store;

  beforeEach(() => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
  });

  afterEach(() => {
    core = null;
    identityManager = null;
    store = null;
  });

  describe('Change Detection', () => {
    test('should detect property changes on proxy objects', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const changeEvents = [];
      proxy.onChange((change) => {
        changeEvents.push(change);
      });

      // Change a property
      proxy.age = 31;

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        type: 'property-changed',
        property: 'age',
        oldValue: 30,
        newValue: 31,
        target: alice
      });
    });

    test('should detect property additions on proxy objects', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const changeEvents = [];
      proxy.onChange((change) => {
        changeEvents.push(change);
      });

      // Add a new property
      proxy.email = 'alice@example.com';

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        type: 'property-added',
        property: 'email',
        newValue: 'alice@example.com',
        target: alice
      });
    });

    test('should detect property deletions on proxy objects', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@example.com'
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const changeEvents = [];
      proxy.onChange((change) => {
        changeEvents.push(change);
      });

      // Delete a property
      delete proxy.email;

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        type: 'property-deleted',
        property: 'email',
        oldValue: 'alice@example.com',
        target: alice
      });
    });

    test('should not trigger notifications for unchanged values', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const changeEvents = [];
      proxy.onChange((change) => {
        changeEvents.push(change);
      });

      // Set same value
      proxy.age = 30;

      expect(changeEvents.length).toBe(0);
    });

    test('should handle multiple change listeners', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const listener1Events = [];
      const listener2Events = [];

      proxy.onChange((change) => {
        listener1Events.push(change);
      });

      proxy.onChange((change) => {
        listener2Events.push(change);
      });

      // Change a property
      proxy.age = 31;

      expect(listener1Events.length).toBe(1);
      expect(listener2Events.length).toBe(1);
      expect(listener1Events[0].newValue).toBe(31);
      expect(listener2Events[0].newValue).toBe(31);
    });

    test('should support removing change listeners', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const changeEvents = [];
      const listener = (change) => {
        changeEvents.push(change);
      };

      const unsubscribe = proxy.onChange(listener);

      // Change property - should trigger
      proxy.age = 31;
      expect(changeEvents.length).toBe(1);

      // Remove listener
      unsubscribe();

      // Change property - should not trigger
      proxy.name = 'Alice Smith';
      expect(changeEvents.length).toBe(1); // Still 1, not 2
    });
  });

  describe('Subscription Management', () => {
    test('should support property-specific subscriptions', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@example.com'
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const ageChanges = [];
      const nameChanges = [];

      proxy.onPropertyChange('age', (change) => {
        ageChanges.push(change);
      });

      proxy.onPropertyChange('name', (change) => {
        nameChanges.push(change);
      });

      // Change age
      proxy.age = 31;
      expect(ageChanges.length).toBe(1);
      expect(nameChanges.length).toBe(0);

      // Change name
      proxy.name = 'Alice Smith';
      expect(ageChanges.length).toBe(1);
      expect(nameChanges.length).toBe(1);

      // Change email (no listeners)
      proxy.email = 'alice.smith@example.com';
      expect(ageChanges.length).toBe(1);
      expect(nameChanges.length).toBe(1);
    });

    test('should support wildcard property subscriptions', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const allChanges = [];
      proxy.onPropertyChange('*', (change) => {
        allChanges.push(change);
      });

      proxy.age = 31;
      proxy.name = 'Alice Smith';
      proxy.email = 'alice@example.com';

      expect(allChanges.length).toBe(3);
      expect(allChanges[0].property).toBe('age');
      expect(allChanges[1].property).toBe('name');
      expect(allChanges[2].property).toBe('email');
    });

    test('should handle subscription errors gracefully', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const workingChanges = [];

      // Good listener
      proxy.onChange((change) => {
        workingChanges.push(change);
      });

      // Bad listener that throws
      proxy.onChange((change) => {
        throw new Error('Listener error');
      });

      // Spy on console.error to catch error handling
      const originalError = console.error;
      let errorCalled = false;
      console.error = () => { errorCalled = true; };

      // Change property
      proxy.age = 31;

      // Good listener should still work
      expect(workingChanges.length).toBe(1);
      
      // Error should be logged, not thrown
      expect(errorCalled).toBe(true);

      console.error = originalError;
    });

    test('should support async change listeners', async () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      let asyncEventProcessed = false;
      
      proxy.onChange(async (change) => {
        // Simulate async processing
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncEventProcessed = true;
      });

      proxy.age = 31;

      // Give async handler time to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(asyncEventProcessed).toBe(true);
    });
  });

  describe('Notification Delivery', () => {
    test('should deliver notifications synchronously by default', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      let notificationReceived = false;
      proxy.onChange((change) => {
        notificationReceived = true;
      });

      proxy.age = 31;

      // Should be synchronous
      expect(notificationReceived).toBe(true);
    });

    test('should include complete change information', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        department: 'Engineering'
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      let lastChange;
      proxy.onChange((change) => {
        lastChange = change;
      });

      proxy.age = 31;

      expect(lastChange).toMatchObject({
        type: 'property-changed',
        property: 'age',
        oldValue: 30,
        newValue: 31,
        target: alice,
        timestamp: expect.any(Number),
        proxy: expect.any(Object)
      });

      // Should include proxy reference
      expect(lastChange.proxy).toBe(proxy);
    });

    test('should handle batch changes correctly', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const changes = [];
      proxy.onChange((change) => {
        changes.push(change);
      });

      // Make multiple changes
      proxy.age = 31;
      proxy.name = 'Alice Smith';
      proxy.email = 'alice.smith@example.com';

      expect(changes.length).toBe(3);
      expect(changes.map(c => c.property)).toEqual(['age', 'name', 'email']);
    });

    test('should support change filtering', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        lastLogin: new Date()
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const importantChanges = [];
      
      // Filter out lastLogin changes
      proxy.onChange((change) => {
        if (change.property !== 'lastLogin') {
          importantChanges.push(change);
        }
      });

      proxy.age = 31;
      proxy.lastLogin = new Date();
      proxy.name = 'Alice Smith';

      expect(importantChanges.length).toBe(2);
      expect(importantChanges.map(c => c.property)).toEqual(['age', 'name']);
    });
  });

  describe('Store Integration', () => {
    test('should update store when proxy changes', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      let storeUpdated = false;
      proxy.onChange((change) => {
        // Verify store was updated
        const updatedObject = store.getObject(identityManager.getId(alice));
        storeUpdated = (updatedObject.age === 31);
      });

      proxy.age = 31;

      expect(storeUpdated).toBe(true);
      expect(alice.age).toBe(31); // Original object updated
    });

    test('should not conflict with direct store updates', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const proxyChanges = [];
      proxy.onChange((change) => {
        proxyChanges.push(change);
      });

      // Change via proxy
      proxy.age = 31;
      expect(proxyChanges.length).toBe(1);

      // Change directly on object (simulating store update)
      alice.name = 'Alice Smith';
      
      // Proxy should not detect direct changes (that's expected behavior)
      expect(proxyChanges.length).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for invalid change listeners', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      expect(() => {
        proxy.onChange(null);
      }).toThrow('Listener must be a function');

      expect(() => {
        proxy.onChange('not a function');
      }).toThrow('Listener must be a function');

      expect(() => {
        proxy.onPropertyChange('age', null);
      }).toThrow('Listener must be a function');
    });

    test('should throw error for invalid property names in subscriptions', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const proxy = new KGEntityProxy(alice, store, identityManager);

      const validListener = () => {};

      expect(() => {
        proxy.onPropertyChange(null, validListener);
      }).toThrow('Property name must be a string');

      expect(() => {
        proxy.onPropertyChange(123, validListener);
      }).toThrow('Property name must be a string');

      expect(() => {
        proxy.onPropertyChange('', validListener);
      }).toThrow('Property name cannot be empty');
    });

    test('should handle notification system cleanup on proxy destruction', () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      let proxy = new KGEntityProxy(alice, store, identityManager);

      const changes = [];
      const unsubscribe = proxy.onChange((change) => {
        changes.push(change);
      });

      // Change through proxy
      proxy.age = 31;
      expect(changes.length).toBe(1);

      // Destroy proxy reference
      proxy = null;

      // Unsubscribe should still work
      expect(() => unsubscribe()).not.toThrow();
    });
  });
});