import { KGEntityProxy } from '../../src/KGEntityProxy.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('KGEntityProxy', () => {
  let core;
  let identityManager;
  let store;

  beforeEach(() => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/email': { unique: 'identity' },
      ':company/name': { card: 'one' },
      ':company/founded': { card: 'one' }
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

  describe('Proxy Creation', () => {
    test('should create proxy for valid object', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@test.com'
      };

      store.add(person);

      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(proxy).toBeDefined();
      expect(typeof proxy).toBe('object');
      expect(proxy.constructor).toBe(KGEntityProxy);
    });

    test('should throw error for null object', () => {
      expect(() => {
        new KGEntityProxy(null, store, identityManager);
      }).toThrow('Object cannot be null or undefined');
    });

    test('should throw error for undefined object', () => {
      expect(() => {
        new KGEntityProxy(undefined, store, identityManager);
      }).toThrow('Object cannot be null or undefined');
    });

    test('should throw error for non-object', () => {
      expect(() => {
        new KGEntityProxy('not an object', store, identityManager);
      }).toThrow('Target must be an object');
    });

    test('should throw error without store', () => {
      const person = { type: 'person', name: 'Alice' };

      expect(() => {
        new KGEntityProxy(person, null, identityManager);
      }).toThrow('Store is required');
    });

    test('should throw error without identity manager', () => {
      const person = { type: 'person', name: 'Alice' };

      expect(() => {
        new KGEntityProxy(person, store, null);
      }).toThrow('IdentityManager is required');
    });

    test('should throw error for object not in store', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      // Don't add to store - should throw error
      expect(() => {
        new KGEntityProxy(person, store, identityManager);
      }).toThrow('Object must be added to store before creating proxy');
    });
  });

  describe('Attribute Access', () => {
    test('should access object properties through proxy', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@test.com'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(proxy.name).toBe('Alice Johnson');
      expect(proxy.age).toBe(30);
      expect(proxy.type).toBe('person');
      expect(proxy.email).toBe('alice@test.com');
    });

    test('should return undefined for non-existent properties', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(proxy.nonExistent).toBeUndefined();
      expect(proxy.missingProperty).toBeUndefined();
    });

    test('should access nested object properties', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        contact: {
          email: 'alice@test.com',
          phone: '555-1234'
        },
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(proxy.contact).toBeDefined();
      expect(proxy.contact.email).toBe('alice@test.com');
      expect(proxy.contact.phone).toBe('555-1234');
      expect(proxy.preferences.theme).toBe('dark');
      expect(proxy.preferences.notifications).toBe(true);
    });

    test('should handle array properties', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        skills: ['JavaScript', 'Python', 'React'],
        projects: [
          { name: 'Project A', status: 'active' },
          { name: 'Project B', status: 'completed' }
        ]
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(Array.isArray(proxy.skills)).toBe(true);
      expect(proxy.skills.length).toBe(3);
      expect(proxy.skills[0]).toBe('JavaScript');
      expect(proxy.skills).toEqual(['JavaScript', 'Python', 'React']);
      
      expect(Array.isArray(proxy.projects)).toBe(true);
      expect(proxy.projects.length).toBe(2);
      expect(proxy.projects[0].name).toBe('Project A');
      expect(proxy.projects[1].status).toBe('completed');
    });

    test('should handle null and falsy properties', () => {
      const entity = {
        type: 'test',
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        falseValue: false,
        zeroValue: 0
      };

      store.add(entity);
      const proxy = new KGEntityProxy(entity, store, identityManager);

      expect(proxy.nullValue).toBe(null);
      expect(proxy.undefinedValue).toBe(undefined);
      expect(proxy.emptyString).toBe('');
      expect(proxy.falseValue).toBe(false);
      expect(proxy.zeroValue).toBe(0);
    });
  });

  describe('Property Modification', () => {
    test('should allow property modification through proxy', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      // Modify through proxy
      proxy.age = 31;
      proxy.location = 'New York';

      // Verify changes are reflected in original object
      expect(person.age).toBe(31);
      expect(person.location).toBe('New York');

      // Verify changes are accessible through proxy
      expect(proxy.age).toBe(31);
      expect(proxy.location).toBe('New York');
    });

    test('should handle property deletion through proxy', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        temporaryField: 'to be deleted'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect(proxy.temporaryField).toBe('to be deleted');
      expect(person.temporaryField).toBe('to be deleted');

      // Delete through proxy
      delete proxy.temporaryField;

      // Verify deletion in both proxy and original object
      expect(proxy.temporaryField).toBeUndefined();
      expect(person.temporaryField).toBeUndefined();
      expect('temporaryField' in person).toBe(false);
    });

    test('should handle nested object modification', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        contact: {
          email: 'alice@test.com',
          phone: '555-1234'
        }
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      // Modify nested object
      proxy.contact.email = 'alice.johnson@newdomain.com';
      proxy.contact.address = '123 Main St';

      // Verify changes
      expect(person.contact.email).toBe('alice.johnson@newdomain.com');
      expect(person.contact.address).toBe('123 Main St');
      expect(proxy.contact.email).toBe('alice.johnson@newdomain.com');
      expect(proxy.contact.address).toBe('123 Main St');
    });

    test('should handle array modification', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        skills: ['JavaScript', 'Python']
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      // Add to array
      proxy.skills.push('React');
      
      // Verify changes
      expect(person.skills.length).toBe(3);
      expect(person.skills[2]).toBe('React');
      expect(proxy.skills.length).toBe(3);
      expect(proxy.skills[2]).toBe('React');

      // Modify array element
      proxy.skills[1] = 'TypeScript';

      expect(person.skills[1]).toBe('TypeScript');
      expect(proxy.skills[1]).toBe('TypeScript');
    });
  });

  describe('Proxy Identity and Behavior', () => {
    test('should maintain identity across multiple proxy creations', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);

      const proxy1 = new KGEntityProxy(person, store, identityManager);
      const proxy2 = new KGEntityProxy(person, store, identityManager);

      // Both proxies should reference the same underlying object
      proxy1.age = 31;
      expect(proxy2.age).toBe(31);

      proxy2.location = 'Boston';
      expect(proxy1.location).toBe('Boston');
    });

    test('should support property enumeration', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@test.com'
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      const keys = Object.keys(proxy);
      expect(keys).toContain('type');
      expect(keys).toContain('name');
      expect(keys).toContain('age');
      expect(keys).toContain('email');
      expect(keys.length).toBe(4);
    });

    test('should support property descriptor operations', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      const descriptor = Object.getOwnPropertyDescriptor(proxy, 'name');
      expect(descriptor).toBeDefined();
      expect(descriptor.value).toBe('Alice Johnson');
      expect(descriptor.writable).toBe(true);
      expect(descriptor.enumerable).toBe(true);
      expect(descriptor.configurable).toBe(true);
    });

    test('should support hasOwnProperty checks', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      expect('name' in proxy).toBe(true);
      expect('age' in proxy).toBe(true);
      expect('nonExistent' in proxy).toBe(false);
      
      expect(proxy.hasOwnProperty('name')).toBe(true);
      expect(proxy.hasOwnProperty('age')).toBe(true);
      expect(proxy.hasOwnProperty('nonExistent')).toBe(false);
    });
  });

  describe('Object Reference Handling', () => {
    test('should maintain reference to original object', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const proxy = new KGEntityProxy(person, store, identityManager);

      // Changes through proxy should affect original
      proxy.age = 31;
      expect(person.age).toBe(31);

      // Changes to original should be visible through proxy
      person.name = 'Alice Smith';
      expect(proxy.name).toBe('Alice Smith');
    });

    test('should handle object with complex structure', () => {
      const complex = {
        type: 'complex',
        id: 'complex-1',
        metadata: {
          created: new Date('2023-01-01'),
          modified: new Date('2023-06-01'),
          version: 1.2,
          tags: ['important', 'test', 'complex']
        },
        relationships: {
          parent: null,
          children: [],
          siblings: ['item-2', 'item-3']
        },
        settings: {
          enabled: true,
          config: {
            theme: 'dark',
            language: 'en',
            features: {
              advanced: false,
              beta: true
            }
          }
        }
      };

      store.add(complex);
      const proxy = new KGEntityProxy(complex, store, identityManager);

      // Test deep access
      expect(proxy.metadata.version).toBe(1.2);
      expect(proxy.metadata.tags[0]).toBe('important');
      expect(proxy.settings.config.theme).toBe('dark');
      expect(proxy.settings.config.features.beta).toBe(true);

      // Test deep modification
      proxy.settings.config.features.advanced = true;
      expect(complex.settings.config.features.advanced).toBe(true);

      // Test array operations
      proxy.relationships.siblings.push('item-4');
      expect(complex.relationships.siblings.length).toBe(3);
      expect(complex.relationships.siblings[2]).toBe('item-4');
    });

    test('should handle circular references safely', () => {
      const objA = { type: 'circular', name: 'A' };
      const objB = { type: 'circular', name: 'B' };

      // Create circular reference
      objA.ref = objB;
      objB.ref = objA;

      store.add(objA);
      store.add(objB);

      const proxyA = new KGEntityProxy(objA, store, identityManager);
      const proxyB = new KGEntityProxy(objB, store, identityManager);

      // Access circular references
      expect(proxyA.ref).toBe(objB);
      expect(proxyB.ref).toBe(objA);
      expect(proxyA.ref.ref).toBe(objA);
      expect(proxyB.ref.ref).toBe(objB);

      // Modify through circular reference
      proxyA.ref.name = 'B Modified';
      expect(objB.name).toBe('B Modified');
      expect(proxyB.name).toBe('B Modified');
    });
  });
});