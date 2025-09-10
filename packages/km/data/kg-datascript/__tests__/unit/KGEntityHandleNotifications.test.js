import { KGEntityHandle } from '../../src/KGEntityHandle.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('KGEntityHandle Notification System', () => {
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
    test('should detect property changes on handle objects', async () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const handle = new KGEntityHandle(alice, store, identityManager);

      const changeEvents = [];
      handle.onChange((change) => {
        changeEvents.push(change);
      });

      // Change a property using handle method
      await handle.set('age', 31);

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        type: 'property-changed',
        property: 'age',
        oldValue: 30,
        newValue: 31,
        target: alice
      });
    });

    test('should detect property additions on handle objects', async () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const handle = new KGEntityHandle(alice, store, identityManager);

      const changeEvents = [];
      handle.onChange((change) => {
        changeEvents.push(change);
      });

      // Add a new property using handle method
      await handle.set('email', 'alice@example.com');

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        type: 'property-added',
        property: 'email',
        newValue: 'alice@example.com',
        target: alice
      });
    });

    test('should detect property deletions on handle objects', async () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@example.com'
      };

      store.add(alice);
      const handle = new KGEntityHandle(alice, store, identityManager);

      const changeEvents = [];
      handle.onChange((change) => {
        changeEvents.push(change);
      });

      // Delete property using handle method
      await handle.delete('email');

      expect(changeEvents.length).toBe(1);
      expect(changeEvents[0]).toMatchObject({
        type: 'property-deleted',
        property: 'email',
        oldValue: 'alice@example.com',
        target: alice
      });
    });

    test('should not trigger change events when setting same value', async () => {
      const alice = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(alice);
      const handle = new KGEntityHandle(alice, store, identityManager);

      const changeEvents = [];
      handle.onChange((change) => {
        changeEvents.push(change);
      });

      // Set the same value
      await handle.set('age', 30);

      expect(changeEvents.length).toBe(0);
    });

    test('should handle multiple rapid changes correctly', async () => {
      const person = {
        type: 'person',
        name: 'John Doe',
        age: 25
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const changeEvents = [];
      handle.onChange((change) => {
        changeEvents.push(change);
      });

      // Make multiple rapid changes
      await handle.set('age', 26);
      await handle.set('location', 'New York');
      await handle.set('age', 27);
      await handle.delete('location');

      expect(changeEvents.length).toBe(4);
      
      expect(changeEvents[0]).toMatchObject({
        type: 'property-changed',
        property: 'age',
        oldValue: 25,
        newValue: 26
      });

      expect(changeEvents[1]).toMatchObject({
        type: 'property-added',
        property: 'location',
        newValue: 'New York'
      });

      expect(changeEvents[2]).toMatchObject({
        type: 'property-changed',
        property: 'age',
        oldValue: 26,
        newValue: 27
      });

      expect(changeEvents[3]).toMatchObject({
        type: 'property-deleted',
        property: 'location',
        oldValue: 'New York'
      });
    });
  });

  describe('Property-Specific Listeners', () => {
    test('should support property-specific change listeners', async () => {
      const person = {
        type: 'person',
        name: 'Jane Smith',
        age: 25,
        email: 'jane@example.com'
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const ageChanges = [];
      const nameChanges = [];

      handle.onPropertyChange('age', (change) => {
        ageChanges.push(change);
      });

      handle.onPropertyChange('name', (change) => {
        nameChanges.push(change);
      });

      // Change age
      await handle.set('age', 26);
      
      // Change name
      await handle.set('name', 'Jane Doe');
      
      // Change email (should not trigger our specific listeners)
      await handle.set('email', 'jane.doe@example.com');

      expect(ageChanges.length).toBe(1);
      expect(ageChanges[0].property).toBe('age');
      expect(ageChanges[0].newValue).toBe(26);

      expect(nameChanges.length).toBe(1);
      expect(nameChanges[0].property).toBe('name');
      expect(nameChanges[0].newValue).toBe('Jane Doe');
    });

    test('should support wildcard property listeners', async () => {
      const person = {
        type: 'person',
        name: 'Bob Wilson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const wildcardChanges = [];
      
      handle.onPropertyChange('*', (change) => {
        wildcardChanges.push(change);
      });

      // Make various changes
      await handle.set('age', 31);
      await handle.set('location', 'Boston');
      await handle.delete('location');

      expect(wildcardChanges.length).toBe(3);
      expect(wildcardChanges[0].property).toBe('age');
      expect(wildcardChanges[1].property).toBe('location');
      expect(wildcardChanges[2].property).toBe('location');
    });

    test('should allow unsubscribing from property listeners', async () => {
      const person = {
        type: 'person',
        name: 'Charlie Brown',
        age: 20
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const changes = [];
      
      const unsubscribe = handle.onPropertyChange('age', (change) => {
        changes.push(change);
      });

      // First change should be captured
      await handle.set('age', 21);
      expect(changes.length).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Second change should not be captured
      await handle.set('age', 22);
      expect(changes.length).toBe(1); // Still 1, not 2
    });
  });

  describe('Multiple Listeners', () => {
    test('should support multiple listeners on same property', async () => {
      const person = {
        type: 'person',
        name: 'David Miller',
        age: 35
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const listener1Events = [];
      const listener2Events = [];
      const listener3Events = [];

      handle.onPropertyChange('age', (change) => {
        listener1Events.push(change);
      });

      handle.onPropertyChange('age', (change) => {
        listener2Events.push(change);
      });

      handle.onChange((change) => {
        listener3Events.push(change);
      });

      await handle.set('age', 36);

      // All three listeners should have received the event
      expect(listener1Events.length).toBe(1);
      expect(listener2Events.length).toBe(1);
      expect(listener3Events.length).toBe(1);

      expect(listener1Events[0].newValue).toBe(36);
      expect(listener2Events[0].newValue).toBe(36);
      expect(listener3Events[0].newValue).toBe(36);
    });

    test('should handle listener errors gracefully', async () => {
      const person = {
        type: 'person',
        name: 'Eva Green',
        age: 28
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const goodChanges = [];
      
      // Add a listener that throws an error
      handle.onChange(() => {
        throw new Error('Listener error');
      });

      // Add a good listener
      handle.onChange((change) => {
        goodChanges.push(change);
      });

      // The error should not prevent the good listener from working
      await handle.set('age', 29);

      expect(goodChanges.length).toBe(1);
      expect(goodChanges[0].newValue).toBe(29);
    });

    test('should handle async listeners properly', async () => {
      const person = {
        type: 'person',
        name: 'Frank Johnson',
        age: 40
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const asyncResults = [];
      
      handle.onChange(async (change) => {
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 10));
        asyncResults.push(`async-${change.newValue}`);
      });

      handle.onChange((change) => {
        asyncResults.push(`sync-${change.newValue}`);
      });

      await handle.set('age', 41);

      // Give async listener time to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(asyncResults.length).toBe(2);
      expect(asyncResults).toContain('sync-41');
      expect(asyncResults).toContain('async-41');
    });
  });

  describe('Listener Cleanup', () => {
    test('should clean up listeners on handle destruction', async () => {
      const person = {
        type: 'person',
        name: 'Grace Wilson',
        age: 33
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const changes = [];
      
      handle.onChange((change) => {
        changes.push(change);
      });

      handle.onPropertyChange('age', (change) => {
        changes.push(change);
      });

      // Verify listeners are working
      await handle.set('age', 34);
      expect(changes.length).toBe(2); // One from each listener

      // Destroy handle
      await handle.destroy();

      // Verify listeners are cleaned up
      expect(handle._changeListeners.size).toBe(0);
      expect(handle._propertyListeners.size).toBe(0);
    });

    test('should properly clean up property listeners when all unsubscribed', async () => {
      const person = {
        type: 'person',
        name: 'Henry Davis',
        age: 45
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const unsubscribe1 = handle.onPropertyChange('age', () => {});
      const unsubscribe2 = handle.onPropertyChange('age', () => {});

      expect(handle._propertyListeners.has('age')).toBe(true);
      expect(handle._propertyListeners.get('age').size).toBe(2);

      // Unsubscribe first listener
      unsubscribe1();
      expect(handle._propertyListeners.has('age')).toBe(true);
      expect(handle._propertyListeners.get('age').size).toBe(1);

      // Unsubscribe second listener
      unsubscribe2();
      expect(handle._propertyListeners.has('age')).toBe(false);
    });
  });

  describe('BaseHandle Integration', () => {
    test('should emit events through BaseHandle subscription system', (done) => {
      const person = {
        type: 'person',
        name: 'Ivy Chen',
        age: 27
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Subscribe through BaseHandle's subscription system
      const unsubscribe = handle.subscribe('property-changed', (change) => {
        try {
          expect(change.property).toBe('age');
          expect(change.newValue).toBe(28);
          unsubscribe();
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger change
      handle.set('age', 28);
    });

    test('should support both BaseHandle and custom notification systems', async () => {
      const person = {
        type: 'person',
        name: 'Jack Brown',
        age: 50
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const customEvents = [];
      const baseHandleEvents = [];

      // Custom notification system
      handle.onChange((change) => {
        customEvents.push(change);
      });

      // BaseHandle subscription system
      handle.subscribe('property-changed', (change) => {
        baseHandleEvents.push(change);
      });

      await handle.set('age', 51);

      // Both systems should receive the event
      expect(customEvents.length).toBe(1);
      expect(baseHandleEvents.length).toBe(1);
      expect(customEvents[0].newValue).toBe(51);
      expect(baseHandleEvents[0].newValue).toBe(51);
    });
  });
});