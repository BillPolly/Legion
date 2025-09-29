import { QueryEngine } from '../../src/QueryEngine.js';
import { KGDataScriptCore } from '../../src/KGDataScriptCore.js';
import { ObjectIdentityManager } from '../../src/ObjectIdentityManager.js';
import { LiveStore } from '../../src/LiveStore.js';

describe('Object Hydration Integration', () => {
  let core;
  let identityManager;
  let store;
  let queryEngine;

  beforeEach(() => {
    const schema = {
      ':entity/id': { unique: 'identity' },
      ':entity/type': { card: 'one' },
      ':entity/data': { card: 'one' },
      ':person/name': { card: 'one' },
      ':person/age': { card: 'one' },
      ':person/employer': { card: 'one', valueType: 'ref' },
      ':company/name': { card: 'one' },
      ':company/employees': { card: 'many', valueType: 'ref' }
    };

    core = new KGDataScriptCore(schema);
    identityManager = new ObjectIdentityManager();
    store = new LiveStore(core, identityManager);
    queryEngine = new QueryEngine(core, store, identityManager);
  });

  afterEach(() => {
    core = null;
    identityManager = null;
    store = null;
    queryEngine = null;
  });

  describe('Complex Query Object Graphs', () => {
    test('should handle nested object references in complex queries', () => {
      // Create relational test data
      const company = {
        type: 'company',
        name: 'TechCorp',
        founded: 2010,
        location: 'San Francisco'
      };

      const employees = [
        {
          type: 'person',
          name: 'Alice Johnson',
          age: 30,
          role: 'Senior Engineer',
          department: 'Engineering'
        },
        {
          type: 'person',
          name: 'Bob Smith',
          age: 25,
          role: 'Product Manager',
          department: 'Product'
        },
        {
          type: 'person',
          name: 'Carol Davis',
          age: 28,
          role: 'Designer',
          department: 'Design'
        }
      ];

      // Add all objects to store
      store.add(company);
      employees.forEach(emp => store.add(emp));

      // Complex query: Find all people and their details
      const peopleQuery = {
        find: ['?personId'],
        where: [
          ['?e', ':entity/type', 'person'],
          ['?e', ':entity/id', '?personId']
        ]
      };

      const peopleResults = queryEngine.queryWithObjects(peopleQuery);

      expect(peopleResults).toBeDefined();
      expect(peopleResults.length).toBe(3);

      // Verify all people are returned as complete objects
      peopleResults.forEach(person => {
        expect(typeof person).toBe('object');
        expect(person.type).toBe('person');
        expect(person.name).toBeDefined();
        expect(person.age).toBeDefined();
        expect(person.role).toBeDefined();
        expect(person.department).toBeDefined();
      });

      // Find company
      const companyQuery = {
        find: ['?companyId'],
        where: [
          ['?e', ':entity/type', 'company'],
          ['?e', ':entity/id', '?companyId']
        ]
      };

      const companyResults = queryEngine.queryWithObjects(companyQuery);

      expect(companyResults).toBeDefined();
      expect(companyResults.length).toBe(1);

      const foundCompany = companyResults[0];
      expect(foundCompany).toBe(company); // Same object reference
      expect(foundCompany.name).toBe('TechCorp');
      expect(foundCompany.founded).toBe(2010);
    });

    test('should handle large object collections with complex attributes', () => {
      // Create a larger dataset
      const products = [];
      const categories = ['Electronics', 'Clothing', 'Home', 'Sports', 'Books'];
      
      for (let i = 1; i <= 50; i++) {
        products.push({
          type: 'product',
          id: `product-${i}`,
          name: `Product ${i}`,
          price: Math.round((Math.random() * 100 + 10) * 100) / 100,
          category: categories[i % categories.length],
          inStock: i % 3 !== 0, // 2/3 of products in stock
          rating: Math.round((Math.random() * 4 + 1) * 10) / 10,
          description: `This is product ${i} with various features and benefits.`,
          tags: [`tag${i % 5}`, `tag${(i + 1) % 5}`, `tag${(i + 2) % 5}`],
          metadata: {
            created: new Date(`2023-${(i % 12) + 1}-01`),
            lastModified: new Date(),
            views: Math.floor(Math.random() * 1000),
            featured: i % 10 === 0
          }
        });
      }

      // Add all products to store
      products.forEach(product => store.add(product));

      // Query for all products
      const allProductsQuery = {
        find: ['?productId'],
        where: [
          ['?e', ':entity/type', 'product'],
          ['?e', ':entity/id', '?productId']
        ]
      };

      const allResults = queryEngine.queryWithObjects(allProductsQuery);

      expect(allResults.length).toBe(50);

      // Verify all products are complete objects
      allResults.forEach(product => {
        expect(typeof product).toBe('object');
        expect(product.type).toBe('product');
        expect(product.name).toBeDefined();
        expect(typeof product.price).toBe('number');
        expect(categories).toContain(product.category);
        expect(typeof product.inStock).toBe('boolean');
        expect(Array.isArray(product.tags)).toBe(true);
        expect(typeof product.metadata).toBe('object');
        expect(product.metadata.created instanceof Date).toBe(true);
      });

      // Test filtering on complex attributes (done in application logic)
      const electronicsProducts = allResults.filter(p => p.category === 'Electronics');
      expect(electronicsProducts.length).toBe(10); // Every 5th product starting from index 0

      const inStockProducts = allResults.filter(p => p.inStock === true);
      // Items are in stock when i % 3 !== 0, so out of 50 items (1-50), 
      // items 3,6,9,12,...,48 are out of stock (16 items), leaving 34 in stock
      expect(inStockProducts.length).toBe(34); // 50 - 16 = 34

      const featuredProducts = allResults.filter(p => p.metadata.featured === true);
      expect(featuredProducts.length).toBe(5); // Every 10th product
    });

    test('should preserve object mutations during query operations', () => {
      const mutableObject = {
        type: 'mutable',
        name: 'Test Object',
        counter: 0,
        history: []
      };

      store.add(mutableObject);

      // Query for the object
      const query = {
        find: ['?objId'],
        where: [
          ['?e', ':entity/type', 'mutable'],
          ['?e', ':entity/id', '?objId']
        ]
      };

      const results1 = queryEngine.queryWithObjects(query);
      expect(results1.length).toBe(1);
      const foundObject1 = results1[0];

      // Verify it's the same reference
      expect(foundObject1).toBe(mutableObject);

      // Mutate the original object
      mutableObject.counter = 5;
      mutableObject.history.push('increment');
      mutableObject.newProperty = 'dynamically added';

      // Query again
      const results2 = queryEngine.queryWithObjects(query);
      expect(results2.length).toBe(1);
      const foundObject2 = results2[0];

      // Should still be the same reference with mutations preserved
      expect(foundObject2).toBe(mutableObject);
      expect(foundObject2.counter).toBe(5);
      expect(foundObject2.history).toEqual(['increment']);
      expect(foundObject2.newProperty).toBe('dynamically added');

      // Both query results should reflect the same mutations
      expect(foundObject1.counter).toBe(5); // Same reference!
      expect(foundObject2.counter).toBe(5);
    });

    test('should handle concurrent queries on same objects', () => {
      const sharedObjects = [
        { type: 'shared', name: 'Object A', value: 100 },
        { type: 'shared', name: 'Object B', value: 200 },
        { type: 'shared', name: 'Object C', value: 300 }
      ];

      sharedObjects.forEach(obj => store.add(obj));

      const query1 = {
        find: ['?objId'],
        where: [
          ['?e', ':entity/type', 'shared'],
          ['?e', ':entity/id', '?objId']
        ]
      };

      const query2 = {
        find: ['?e', '?objId'],  // Different variable order
        where: [
          ['?e', ':entity/type', 'shared'],
          ['?e', ':entity/id', '?objId']
        ]
      };

      // Execute queries concurrently (synchronously but conceptually concurrent)
      const results1 = queryEngine.queryWithObjects(query1);
      const results2 = queryEngine.queryWithObjects(query2);

      expect(results1.length).toBe(3);
      expect(results2.length).toBe(3);

      // Results1 should be flat array of objects
      results1.forEach(obj => {
        expect(typeof obj).toBe('object');
        expect(obj.type).toBe('shared');
        expect(obj.name).toBeDefined();
        expect(typeof obj.value).toBe('number');
      });

      // Results2 should be array of [entityId, object] pairs
      results2.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);
        const [entityId, obj] = result;
        expect(typeof entityId).toBe('number');
        expect(typeof obj).toBe('object');
        expect(obj.type).toBe('shared');
      });

      // Objects in results1 and results2 should be the same references
      const objects1 = results1.sort((a, b) => a.name.localeCompare(b.name));
      const objects2 = results2.map(r => r[1]).sort((a, b) => a.name.localeCompare(b.name));

      for (let i = 0; i < objects1.length; i++) {
        expect(objects1[i]).toBe(objects2[i]); // Same references
      }
    });
  });


  describe('Edge Cases and Error Conditions', () => {
    test('should handle objects with circular references', () => {
      const objA = { type: 'circular', name: 'A' };
      const objB = { type: 'circular', name: 'B' };

      // Create circular reference
      objA.ref = objB;
      objB.ref = objA;

      store.add(objA);
      store.add(objB);

      const query = {
        find: ['?objId'],
        where: [
          ['?e', ':entity/type', 'circular'],
          ['?e', ':entity/id', '?objId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);

      expect(results.length).toBe(2);
      
      // Verify circular references are preserved
      const foundA = results.find(obj => obj.name === 'A');
      const foundB = results.find(obj => obj.name === 'B');

      expect(foundA).toBe(objA);
      expect(foundB).toBe(objB);
      expect(foundA.ref).toBe(foundB);
      expect(foundB.ref).toBe(foundA);
    });

    test('should handle null and undefined properties in objects', () => {
      const objectWithNulls = {
        type: 'nullable',
        name: 'Test Object',
        nullValue: null,
        undefinedValue: undefined,
        emptyString: '',
        falseValue: false,
        zeroValue: 0
      };

      store.add(objectWithNulls);

      const query = {
        find: ['?objId'],
        where: [
          ['?e', ':entity/type', 'nullable'],
          ['?e', ':entity/id', '?objId']
        ]
      };

      const results = queryEngine.queryWithObjects(query);

      expect(results.length).toBe(1);
      const result = results[0];

      expect(result).toBe(objectWithNulls);
      expect(result.nullValue).toBe(null);
      expect(result.undefinedValue).toBe(undefined);
      expect(result.emptyString).toBe('');
      expect(result.falseValue).toBe(false);
      expect(result.zeroValue).toBe(0);
    });

    test('should handle queries when objects are removed from store', () => {
      const temporaryObject = {
        type: 'temporary',
        name: 'Will be removed',
        data: 'test data'
      };

      store.add(temporaryObject);

      // Verify object exists
      const query = {
        find: ['?objId'],
        where: [
          ['?e', ':entity/type', 'temporary'],
          ['?e', ':entity/id', '?objId']
        ]
      };

      const results1 = queryEngine.queryWithObjects(query);
      expect(results1.length).toBe(1);
      expect(results1[0]).toBe(temporaryObject);

      // Remove object from store
      store.remove(temporaryObject);

      // Query again - should return empty results
      const results2 = queryEngine.queryWithObjects(query);
      expect(results2.length).toBe(0);
    });
  });
});