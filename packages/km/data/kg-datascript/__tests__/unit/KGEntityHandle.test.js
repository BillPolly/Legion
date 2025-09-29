import { KGEntityHandle } from '../../src/KGEntityHandle.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('KGEntityHandle', () => {
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

  describe('Handle Creation', () => {
    test('should create handle for valid object', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@test.com'
      };

      store.add(person);

      const handle = new KGEntityHandle(person, store, identityManager);

      expect(handle).toBeDefined();
      expect(handle.constructor).toBe(KGEntityHandle);
      expect(handle.handleType).toBe('KGEntity');
    });

    test('should throw error for null object', () => {
      expect(() => {
        new KGEntityHandle(null, store, identityManager);
      }).toThrow('Object cannot be null or undefined');
    });

    test('should throw error for undefined object', () => {
      expect(() => {
        new KGEntityHandle(undefined, store, identityManager);
      }).toThrow('Object cannot be null or undefined');
    });

    test('should throw error for non-object', () => {
      expect(() => {
        new KGEntityHandle('not an object', store, identityManager);
      }).toThrow('Target must be an object');
    });

    test('should throw error without store', () => {
      const person = { type: 'person', name: 'Alice' };

      expect(() => {
        new KGEntityHandle(person, null, identityManager);
      }).toThrow('Store is required');
    });

    test('should throw error without identity manager', () => {
      const person = { type: 'person', name: 'Alice' };

      expect(() => {
        new KGEntityHandle(person, store, null);
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
        new KGEntityHandle(person, store, identityManager);
      }).toThrow('Object must be added to store before creating handle');
    });
  });

  describe('Attribute Access', () => {
    test('should access object properties through handle methods', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@test.com'
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      expect(await handle.get('name')).toBe('Alice Johnson');
      expect(await handle.get('age')).toBe(30);
      expect(await handle.get('type')).toBe('person');
      expect(await handle.get('email')).toBe('alice@test.com');
    });

    test('should return undefined for non-existent properties', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson'
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      expect(await handle.get('nonExistent')).toBeUndefined();
      expect(await handle.get('missingProperty')).toBeUndefined();
    });

    test('should access nested object properties', async () => {
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
      const handle = new KGEntityHandle(person, store, identityManager);

      const contact = await handle.get('contact');
      expect(contact).toBeDefined();
      expect(contact.email).toBe('alice@test.com');
      expect(contact.phone).toBe('555-1234');
      
      const preferences = await handle.get('preferences');
      expect(preferences.theme).toBe('dark');
      expect(preferences.notifications).toBe(true);
    });

    test('should handle array properties', async () => {
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
      const handle = new KGEntityHandle(person, store, identityManager);

      const skills = await handle.get('skills');
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBe(3);
      expect(skills[0]).toBe('JavaScript');
      expect(skills).toEqual(['JavaScript', 'Python', 'React']);
      
      const projects = await handle.get('projects');
      expect(Array.isArray(projects)).toBe(true);
      expect(projects.length).toBe(2);
      expect(projects[0].name).toBe('Project A');
      expect(projects[1].status).toBe('completed');
    });

    test('should handle null and falsy properties', async () => {
      const entity = {
        type: 'test',
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        falseValue: false,
        zeroValue: 0
      };

      store.add(entity);
      const handle = new KGEntityHandle(entity, store, identityManager);

      expect(await handle.get('nullValue')).toBe(null);
      expect(await handle.get('undefinedValue')).toBe(undefined);
      expect(await handle.get('emptyString')).toBe('');
      expect(await handle.get('falseValue')).toBe(false);
      expect(await handle.get('zeroValue')).toBe(0);
    });
  });

  describe('Property Modification', () => {
    test('should allow property modification through handle methods', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Modify through handle
      await handle.set('age', 31);
      await handle.set('location', 'New York');

      // Verify changes are reflected in original object
      expect(person.age).toBe(31);
      expect(person.location).toBe('New York');

      // Verify changes are accessible through handle
      expect(await handle.get('age')).toBe(31);
      expect(await handle.get('location')).toBe('New York');
    });

    test('should handle property deletion through handle methods', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        temporaryField: 'to be deleted'
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      expect(await handle.get('temporaryField')).toBe('to be deleted');
      expect(person.temporaryField).toBe('to be deleted');

      // Delete through handle
      await handle.delete('temporaryField');

      // Verify deletion in both handle and original object
      expect(await handle.get('temporaryField')).toBeUndefined();
      expect(person.temporaryField).toBeUndefined();
      expect('temporaryField' in person).toBe(false);
    });

    test('should handle nested object modification', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        contact: {
          email: 'alice@test.com',
          phone: '555-1234'
        }
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Get nested object and modify it
      const contact = await handle.get('contact');
      contact.email = 'alice.johnson@newdomain.com';
      contact.address = '123 Main St';
      
      // Update the nested object back
      await handle.set('contact', contact);

      // Verify changes
      expect(person.contact.email).toBe('alice.johnson@newdomain.com');
      expect(person.contact.address).toBe('123 Main St');
      
      const updatedContact = await handle.get('contact');
      expect(updatedContact.email).toBe('alice.johnson@newdomain.com');
      expect(updatedContact.address).toBe('123 Main St');
    });

    test('should handle array modification', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        skills: ['JavaScript', 'Python']
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Get array and modify it
      const skills = await handle.get('skills');
      skills.push('React');
      skills[1] = 'TypeScript';
      
      // Update the array back
      await handle.set('skills', skills);
      
      // Verify changes
      expect(person.skills.length).toBe(3);
      expect(person.skills[2]).toBe('React');
      expect(person.skills[1]).toBe('TypeScript');
      
      const updatedSkills = await handle.get('skills');
      expect(updatedSkills.length).toBe(3);
      expect(updatedSkills[2]).toBe('React');
      expect(updatedSkills[1]).toBe('TypeScript');
    });
  });

  describe('Handle Identity and Behavior', () => {
    test('should maintain identity across multiple handle creations', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);

      const handle1 = new KGEntityHandle(person, store, identityManager);
      const handle2 = new KGEntityHandle(person, store, identityManager);

      // Both handles should reference the same underlying object
      await handle1.set('age', 31);
      expect(await handle2.get('age')).toBe(31);

      await handle2.set('location', 'Boston');
      expect(await handle1.get('location')).toBe('Boston');
    });

    test('should support property enumeration', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30,
        email: 'alice@test.com'
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const keys = await handle.keys();
      expect(keys).toContain('type');
      expect(keys).toContain('name');
      expect(keys).toContain('age');
      expect(keys).toContain('email');
      expect(keys.length).toBe(4);
    });

    test('should support hasProperty checks', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      expect(await handle.has('name')).toBe(true);
      expect(await handle.has('age')).toBe(true);
      expect(await handle.has('nonExistent')).toBe(false);
    });
  });

  describe('Object Reference Handling', () => {
    test('should maintain reference to original object', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Changes through handle should affect original
      await handle.set('age', 31);
      expect(person.age).toBe(31);

      // Changes to original should be visible through handle
      person.name = 'Alice Smith';
      expect(await handle.get('name')).toBe('Alice Smith');
    });

    test('should handle object with complex structure', async () => {
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
      const handle = new KGEntityHandle(complex, store, identityManager);

      // Test deep access
      const metadata = await handle.get('metadata');
      expect(metadata.version).toBe(1.2);
      expect(metadata.tags[0]).toBe('important');
      
      const settings = await handle.get('settings');
      expect(settings.config.theme).toBe('dark');
      expect(settings.config.features.beta).toBe(true);

      // Test deep modification
      settings.config.features.advanced = true;
      await handle.set('settings', settings);
      expect(complex.settings.config.features.advanced).toBe(true);

      // Test array operations
      const relationships = await handle.get('relationships');
      relationships.siblings.push('item-4');
      await handle.set('relationships', relationships);
      expect(complex.relationships.siblings.length).toBe(3);
      expect(complex.relationships.siblings[2]).toBe('item-4');
    });

    test('should handle circular references safely', async () => {
      const objA = { type: 'circular', name: 'A' };
      const objB = { type: 'circular', name: 'B' };

      // Create circular reference
      objA.ref = objB;
      objB.ref = objA;

      store.add(objA);
      store.add(objB);

      const handleA = new KGEntityHandle(objA, store, identityManager);
      const handleB = new KGEntityHandle(objB, store, identityManager);

      // Access circular references
      const refA = await handleA.get('ref');
      const refB = await handleB.get('ref');
      expect(refA).toBe(objB);
      expect(refB).toBe(objA);
      expect(refA.ref).toBe(objA);
      expect(refB.ref).toBe(objB);

      // Modify through circular reference - get the object, modify it, set it back
      const refFromA = await handleA.get('ref');
      refFromA.name = 'B Modified';
      await handleA.set('ref', refFromA);
      
      expect(objB.name).toBe('B Modified');
      expect(await handleB.get('name')).toBe('B Modified');
    });
  });

  describe('Handle-specific Methods', () => {
    test('should provide access to underlying components', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      const target = await handle.getTarget();
      expect(target).toBe(person);

      const storeRef = await handle.getStore();
      expect(storeRef).toBe(store);

      const idManager = await handle.getIdentityManager();
      expect(idManager).toBe(identityManager);
    });

    test('should check if object is in store', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      expect(await handle.isInStore()).toBe(true);
    });

    test('should support handle destruction', async () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Add a change listener to verify cleanup
      const listener = () => {};
      handle.onChange(listener);

      await handle.destroy();

      // After destruction, the handle should still exist but listeners should be cleared
      expect(handle._changeListeners.size).toBe(0);
    });
  });

  describe('BaseHandle Integration', () => {
    test('should inherit BaseHandle capabilities', () => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Should have BaseHandle methods
      expect(typeof handle.getAttribute).toBe('function');
      expect(typeof handle.setAttribute).toBe('function');
      expect(typeof handle.callMethod).toBe('function');
      expect(typeof handle.subscribe).toBe('function');

      // Should have handle-specific attributes
      expect(handle.getAttribute('objectId')).toBeDefined();
      expect(handle.getAttribute('entityType')).toBe('person');
    });

    test('should support subscriptions through BaseHandle', (done) => {
      const person = {
        type: 'person',
        name: 'Alice Johnson',
        age: 30
      };

      store.add(person);
      const handle = new KGEntityHandle(person, store, identityManager);

      // Subscribe to property-changed events
      const unsubscribe = handle.subscribe('property-changed', (change) => {
        try {
          expect(change.property).toBe('age');
          expect(change.oldValue).toBe(30);
          expect(change.newValue).toBe(31);
          unsubscribe();
          done();
        } catch (error) {
          done(error);
        }
      });

      // Trigger a change
      handle.set('age', 31);
    });
  });
});