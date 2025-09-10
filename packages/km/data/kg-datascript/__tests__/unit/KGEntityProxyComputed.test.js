import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('KGEntityProxy Computed Properties', () => {
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

  describe('Computed Property Definition', () => {
    test('should define computed properties with getter functions', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      // Define a computed property for full name
      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      expect(proxy.fullName).toBe('Alice Johnson');
    });

    test('should support multiple computed properties on same object', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson',
        birthYear: 1990
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      proxy.defineComputed('age', function() {
        const currentYear = new Date().getFullYear();
        return currentYear - this.birthYear;
      });

      expect(proxy.fullName).toBe('Alice Johnson');
      expect(proxy.age).toBe(2025 - 1990);
    });

    test('should throw error for invalid computed property definitions', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(() => {
        proxy.defineComputed(null, function() { return 'test'; });
      }).toThrow('Property name must be a string');

      expect(() => {
        proxy.defineComputed('', function() { return 'test'; });
      }).toThrow('Property name cannot be empty');

      expect(() => {
        proxy.defineComputed('test', null);
      }).toThrow('Computed property must have a getter function');

      expect(() => {
        proxy.defineComputed('test', 'not a function');
      }).toThrow('Computed property must have a getter function');
    });

    test('should not allow computed property names to conflict with existing properties', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(() => {
        proxy.defineComputed('firstName', function() { return 'computed'; });
      }).toThrow('Cannot define computed property: firstName already exists');
    });

    test('should not allow computed property names to conflict with proxy methods', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(() => {
        proxy.defineComputed('query', function() { return 'computed'; });
      }).toThrow('Cannot define computed property: query is a reserved method');

      expect(() => {
        proxy.defineComputed('onChange', function() { return 'computed'; });
      }).toThrow('Cannot define computed property: onChange is a reserved method');

      expect(() => {
        proxy.defineComputed('getTarget', function() { return 'computed'; });
      }).toThrow('Cannot define computed property: getTarget is a reserved method');
    });

    test('should support computed properties with dependencies on other computed properties', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson',
        title: 'Dr.'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      proxy.defineComputed('formalName', function() {
        return `${this.title} ${this.fullName}`;
      });

      expect(proxy.formalName).toBe('Dr. Alice Johnson');
    });
  });

  describe('Automatic Recalculation', () => {
    test('should automatically recalculate when dependencies change', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      expect(proxy.fullName).toBe('Alice Johnson');

      // Change a dependency
      proxy.firstName = 'Alice Marie';
      expect(proxy.fullName).toBe('Alice Marie Johnson');

      // Change another dependency
      proxy.lastName = 'Smith';
      expect(proxy.fullName).toBe('Alice Marie Smith');
    });

    test('should trigger change notifications for computed property updates', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      const computedChanges = [];
      proxy.onPropertyChange('fullName', (change) => {
        computedChanges.push(change);
      });

      // Initial value
      expect(proxy.fullName).toBe('Alice Johnson');

      // Change dependency - should trigger computed property change
      proxy.firstName = 'Alice Marie';
      
      expect(computedChanges.length).toBe(1);
      expect(computedChanges[0]).toMatchObject({
        type: 'computed-changed',
        property: 'fullName',
        oldValue: 'Alice Johnson',
        newValue: 'Alice Marie Johnson'
      });
    });

    test('should handle complex dependency chains', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        middleName: 'Marie',
        lastName: 'Johnson',
        title: 'Dr.'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.middleName} ${this.lastName}`;
      });

      proxy.defineComputed('displayName', function() {
        return `${this.title} ${this.fullName}`;
      });

      proxy.defineComputed('signature', function() {
        return `Sincerely, ${this.displayName}`;
      });

      expect(proxy.signature).toBe('Sincerely, Dr. Alice Marie Johnson');

      // Change first name - should cascade through all computed properties
      proxy.firstName = 'Alicia';
      expect(proxy.signature).toBe('Sincerely, Dr. Alicia Marie Johnson');
    });

    test('should detect circular dependencies and throw error', () => {
      const obj = {
        type: 'test',
        value: 10
      };

      store.add(obj);
      const proxy = new KGEntityProxy(obj, store, identityManager);

      proxy.defineComputed('prop1', function() {
        return this.prop2 + 1;
      });

      expect(() => {
        proxy.defineComputed('prop2', function() {
          return this.prop1 + 1;
        });
      }).toThrow('Circular dependency detected in computed property: prop2');
    });

    test('should handle self-referencing computed properties', () => {
      const counter = {
        type: 'counter',
        value: 0,
        increment: 1
      };

      store.add(counter);
      const proxy = new KGEntityProxy(counter, store, identityManager);

      proxy.defineComputed('nextValue', function() {
        return this.value + this.increment;
      });

      expect(proxy.nextValue).toBe(1);

      proxy.value = 5;
      expect(proxy.nextValue).toBe(6);

      proxy.increment = 2;
      expect(proxy.nextValue).toBe(7);
    });
  });

  describe('Computed Property Caching', () => {
    test('should cache computed property values until dependencies change', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      let computationCount = 0;
      proxy.defineComputed('fullName', function() {
        computationCount++;
        return `${this.firstName} ${this.lastName}`;
      });

      // First access should compute
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(computationCount).toBe(1);

      // Subsequent accesses should use cache
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(computationCount).toBe(1);

      // Change dependency should invalidate cache
      proxy.firstName = 'Alice Marie';
      expect(proxy.fullName).toBe('Alice Marie Johnson');
      expect(computationCount).toBe(2);

      // Cache should work again
      expect(proxy.fullName).toBe('Alice Marie Johnson');
      expect(computationCount).toBe(2);
    });

    test('should handle computed properties that return objects', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('profile', function() {
        return {
          name: `${this.firstName} ${this.lastName}`,
          age: this.age,
          isAdult: this.age >= 18
        };
      });

      const profile1 = proxy.profile;
      expect(profile1).toMatchObject({
        name: 'Alice Johnson',
        age: 30,
        isAdult: true
      });

      // Should return same object reference when cached
      const profile2 = proxy.profile;
      expect(profile2).toBe(profile1);

      // Should create new object when dependency changes
      proxy.age = 17;
      const profile3 = proxy.profile;
      expect(profile3).not.toBe(profile1);
      expect(profile3.isAdult).toBe(false);
    });

    test('should handle async computed properties', async () => {
      const user = {
        type: 'user',
        userId: 123,
        name: 'Alice'
      };

      store.add(user);
      const proxy = new KGEntityProxy(user, store, identityManager);

      proxy.defineComputed('userProfile', async function() {
        // Simulate async data fetching
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          id: this.userId,
          displayName: `User: ${this.name}`,
          lastAccessed: new Date().toISOString()
        };
      });

      const profile = await proxy.userProfile;
      expect(profile.displayName).toBe('User: Alice');
      expect(profile.id).toBe(123);
    });

    test('should support clearing computed property cache manually', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      let computationCount = 0;
      proxy.defineComputed('fullName', function() {
        computationCount++;
        return `${this.firstName} ${this.lastName}`;
      });

      // Access to cache value
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(computationCount).toBe(1);

      // Clear cache manually
      proxy.clearComputedCache('fullName');

      // Next access should recompute
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(computationCount).toBe(2);
    });

    test('should clear all computed property caches', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      let nameComputations = 0;
      let statusComputations = 0;

      proxy.defineComputed('fullName', function() {
        nameComputations++;
        return `${this.firstName} ${this.lastName}`;
      });

      proxy.defineComputed('status', function() {
        statusComputations++;
        return this.age >= 18 ? 'adult' : 'minor';
      });

      // Cache both properties
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(proxy.status).toBe('adult');
      expect(nameComputations).toBe(1);
      expect(statusComputations).toBe(1);

      // Clear all caches
      proxy.clearAllComputedCache();

      // Next accesses should recompute
      expect(proxy.fullName).toBe('Alice Johnson');
      expect(proxy.status).toBe('adult');
      expect(nameComputations).toBe(2);
      expect(statusComputations).toBe(2);
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in computed property functions gracefully', () => {
      const obj = {
        type: 'test',
        value: 10
      };

      store.add(obj);
      const proxy = new KGEntityProxy(obj, store, identityManager);

      proxy.defineComputed('errorProp', function() {
        throw new Error('Computed property error');
      });

      expect(() => {
        const result = proxy.errorProp;
      }).toThrow('Computed property error');
    });

    test('should handle computed properties with undefined dependencies', () => {
      const obj = {
        type: 'test',
        value: 10
      };

      store.add(obj);
      const proxy = new KGEntityProxy(obj, store, identityManager);

      proxy.defineComputed('dependsOnUndefined', function() {
        return `Value: ${this.undefinedProperty || 'default'}`;
      });

      expect(proxy.dependsOnUndefined).toBe('Value: default');
    });

    test('should handle removal of computed properties', () => {
      const person = {
        type: 'person',
        firstName: 'Alice',
        lastName: 'Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      proxy.defineComputed('fullName', function() {
        return `${this.firstName} ${this.lastName}`;
      });

      expect(proxy.fullName).toBe('Alice Johnson');

      // Remove computed property
      proxy.removeComputed('fullName');

      // Should no longer exist
      expect(proxy.fullName).toBeUndefined();
      expect('fullName' in proxy).toBe(false);
    });

    test('should handle computed property name validation edge cases', () => {
      const obj = {
        type: 'test'
      };

      store.add(obj);
      const proxy = new KGEntityProxy(obj, store, identityManager);

      // Reserved internal properties
      expect(() => {
        proxy.defineComputed('_target', function() { return 'test'; });
      }).toThrow('Cannot define computed property: _target is a reserved property');

      expect(() => {
        proxy.defineComputed('_store', function() { return 'test'; });
      }).toThrow('Cannot define computed property: _store is a reserved property');

      // Special JavaScript properties
      expect(() => {
        proxy.defineComputed('constructor', function() { return 'test'; });
      }).toThrow('Cannot define computed property: constructor is a reserved property');

      expect(() => {
        proxy.defineComputed('prototype', function() { return 'test'; });
      }).toThrow('Cannot define computed property: prototype is a reserved property');
    });
  });
});