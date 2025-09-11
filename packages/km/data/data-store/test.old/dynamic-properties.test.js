import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EntityProxy } from '../src/proxy.js';
import { DataStore } from '../src/store.js';

describe('EntityProxy - Dynamic Properties', () => {
  it('should create dynamic properties based on schema', () => {
    // Define a custom schema
    const schema = {
      ':person/firstName': {},
      ':person/lastName': {},
      ':person/birthDate': {},
      ':company/name': {},
      ':company/employees': { valueType: 'ref', card: 'many' }
    };
    
    const store = new DataStore(schema);
    
    // Create an entity
    const result = store.createEntity({
      ':person/firstName': 'John',
      ':person/lastName': 'Doe',
      ':person/birthDate': new Date('1990-01-01')
    });
    
    // Create proxy
    const proxy = new EntityProxy(result.entityId, store);
    
    // Test that dynamic properties exist and work
    assert.strictEqual(proxy.firstName, 'John');
    assert.strictEqual(proxy.lastName, 'Doe');
    assert.ok(proxy.birthDate instanceof Date);
    
    // Test that many-cardinality refs return empty array when not set
    assert.deepStrictEqual(proxy.employees, []);
  });
  
  it('should handle different namespaces in schema', () => {
    const schema = {
      ':user/name': {},
      ':user/email': {},
      ':post/title': {},
      ':post/content': {},
      ':post/author': { valueType: 'ref' }
    };
    
    const store = new DataStore(schema);
    
    // Create a user entity
    const userResult = store.createEntity({
      ':user/name': 'Alice',
      ':user/email': 'alice@example.com'
    });
    
    // Create a post entity
    const postResult = store.createEntity({
      ':post/title': 'My First Post',
      ':post/content': 'Hello World',
      ':post/author': userResult.entityId
    });
    
    // Create proxies
    const userProxy = new EntityProxy(userResult.entityId, store);
    const postProxy = new EntityProxy(postResult.entityId, store);
    
    // Test user proxy has user properties
    assert.strictEqual(userProxy.name, 'Alice');
    assert.strictEqual(userProxy.email, 'alice@example.com');
    
    // Test post proxy has post properties
    assert.strictEqual(postProxy.title, 'My First Post');
    assert.strictEqual(postProxy.content, 'Hello World');
    
    // Test that ref attributes return proxies
    const authorProxy = postProxy.author;
    assert.ok(authorProxy instanceof EntityProxy);
    assert.strictEqual(authorProxy.name, 'Alice');
  });
  
  it('should not override existing methods with dynamic properties', () => {
    const schema = {
      ':entity/get': {},  // This would conflict with the get() method
      ':entity/update': {},  // This would conflict with the update() method
      ':entity/query': {}  // This would conflict with the query() method
    };
    
    const store = new DataStore(schema);
    
    const result = store.createEntity({
      ':entity/get': 'should not override',
      ':entity/update': 'should not override',
      ':entity/query': 'should not override'
    });
    
    const proxy = new EntityProxy(result.entityId, store);
    
    // Verify that methods are not overridden
    assert.strictEqual(typeof proxy.get, 'function');
    assert.strictEqual(typeof proxy.update, 'function');
    assert.strictEqual(typeof proxy.query, 'function');
    
    // Can still access via get() method
    assert.strictEqual(proxy.get(':entity/get'), 'should not override');
    assert.strictEqual(proxy.get(':entity/update'), 'should not override');
    assert.strictEqual(proxy.get(':entity/query'), 'should not override');
  });
  
  it('should handle schema without namespace separator gracefully', () => {
    // Schema validation will reject malformed attributes, so only use valid ones
    const schema = {
      ':alsomalformed': {},  // No namespace separator - valid attribute but won't create property
      ':proper/attribute': {}
    };
    
    const store = new DataStore(schema);
    
    const result = store.createEntity({
      ':proper/attribute': 'works',
      ':alsomalformed': 'noProperty'
    });
    
    const proxy = new EntityProxy(result.entityId, store);
    
    // Only properly formed attributes with namespace separator create properties
    assert.strictEqual(proxy.attribute, 'works');
    
    // Attribute without namespace separator doesn't create property
    assert.strictEqual(proxy.alsomalformed, undefined);
    
    // But can still access via get()
    assert.strictEqual(proxy.get(':alsomalformed'), 'noProperty');
  });
});