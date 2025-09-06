import { ObjectReconstructor } from '../../../src/reconstruction/ObjectReconstructor.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { NamespaceManager } from '@legion/kg-rdf';
import '../../../src/serialization/ObjectExtensions.js';

describe('ObjectReconstructor', () => {
  let kgEngine, namespaceManager, reconstructor;

  beforeEach(() => {
    kgEngine = new KGEngine();
    namespaceManager = new NamespaceManager();
    reconstructor = new ObjectReconstructor(kgEngine, namespaceManager);
  });

  describe('Constructor', () => {
    test('should initialize with KG engine and namespace manager', () => {
      expect(reconstructor.kg).toBe(kgEngine);
      expect(reconstructor.ns).toBe(namespaceManager);
      expect(reconstructor.objectCache).toBeInstanceOf(Map);
      expect(reconstructor.classCache).toBeInstanceOf(Map);
    });
  });

  describe('Object Reconstruction', () => {
    test('should reconstruct simple objects from triples', () => {
      // Add triples for a simple object
      const objectId = 'test_object_123';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(objectId, 'kg:name', 'John');
      kgEngine.addTriple(objectId, 'kg:age', 30);
      kgEngine.addTriple(objectId, 'kg:active', true);

      const reconstructed = reconstructor.reconstructObject(objectId);

      expect(reconstructed).toBeDefined();
      expect(reconstructed.name).toBe('John');
      expect(reconstructed.age).toBe(30);
      expect(reconstructed.active).toBe(true);
    });

    test('should handle object references', () => {
      // Create referenced object
      const refId = 'ref_object_456';
      kgEngine.addTriple(refId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(refId, 'kg:name', 'Referenced');

      // Create main object with reference
      const mainId = 'main_object_789';
      kgEngine.addTriple(mainId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(mainId, 'kg:name', 'Main');
      kgEngine.addTriple(mainId, 'kg:reference', refId);

      const reconstructed = reconstructor.reconstructObject(mainId);

      expect(reconstructed.name).toBe('Main');
      expect(reconstructed.reference).toBeDefined();
      expect(reconstructed.reference.name).toBe('Referenced');
    });

    test('should handle array properties', () => {
      const objectId = 'array_object_101';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(objectId, 'kg:name', 'ArrayTest');
      
      // Add array items
      kgEngine.addTriple(objectId, 'kg:items', 'item1');
      kgEngine.addTriple(objectId, 'kg:items', 'item2');
      kgEngine.addTriple(objectId, 'kg:items', 'item3');

      const reconstructed = reconstructor.reconstructObject(objectId);

      expect(reconstructed.name).toBe('ArrayTest');
      expect(reconstructed.items).toEqual(['item1', 'item2', 'item3']);
    });

    test('should use cache for repeated reconstructions', () => {
      const objectId = 'cached_object_202';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(objectId, 'kg:name', 'Cached');

      const first = reconstructor.reconstructObject(objectId);
      const second = reconstructor.reconstructObject(objectId);

      expect(first).toBe(second); // Same object reference
      expect(reconstructor.objectCache.has(objectId)).toBe(true);
    });
  });

  describe('Class Reconstruction', () => {
    test('should reconstruct class from metadata', () => {
      const classId = 'TestClass_303';
      
      // Add class metadata
      kgEngine.addTriple(classId, 'rdf:type', 'kg:EntityClass');
      kgEngine.addTriple(classId, 'kg:className', 'TestClass');
      
      // Add constructor
      const constructorId = `${classId}_constructor`;
      kgEngine.addTriple(constructorId, 'rdf:type', 'kg:Constructor');
      kgEngine.addTriple(constructorId, 'kg:methodName', 'constructor');
      kgEngine.addTriple(constructorId, 'kg:constructorOf', classId);
      kgEngine.addTriple(constructorId, 'kg:methodBody', 'function constructor(name) { this.name = name; }');

      const ReconstructedClass = reconstructor.reconstructClass(classId);

      expect(ReconstructedClass).toBeDefined();
      expect(ReconstructedClass.name).toBe('TestClass');
      
      const instance = new ReconstructedClass('test');
      expect(instance.name).toBe('test');
    });

    test('should reconstruct class with methods', () => {
      const classId = 'MethodClass_404';
      
      // Add class metadata
      kgEngine.addTriple(classId, 'rdf:type', 'kg:EntityClass');
      kgEngine.addTriple(classId, 'kg:className', 'MethodClass');
      
      // Add instance method
      const methodId = `${classId}_greet`;
      kgEngine.addTriple(methodId, 'rdf:type', 'kg:InstanceMethod');
      kgEngine.addTriple(methodId, 'kg:methodName', 'greet');
      kgEngine.addTriple(methodId, 'kg:methodOf', classId);
      kgEngine.addTriple(methodId, 'kg:methodBody', 'function greet() { return "Hello " + this.name; }');

      const ReconstructedClass = reconstructor.reconstructClass(classId);
      const instance = new ReconstructedClass();
      instance.name = 'World';

      expect(instance.greet()).toBe('Hello World');
    });

    test('should handle static methods', () => {
      const classId = 'StaticClass_505';
      
      // Add class metadata
      kgEngine.addTriple(classId, 'rdf:type', 'kg:EntityClass');
      kgEngine.addTriple(classId, 'kg:className', 'StaticClass');
      
      // Add static method
      const staticMethodId = `${classId}_create`;
      kgEngine.addTriple(staticMethodId, 'rdf:type', 'kg:StaticMethod');
      kgEngine.addTriple(staticMethodId, 'kg:methodName', 'create');
      kgEngine.addTriple(staticMethodId, 'kg:staticMethodOf', classId);
      kgEngine.addTriple(staticMethodId, 'kg:methodBody', 'function create(name) { return new this(name); }');

      const ReconstructedClass = reconstructor.reconstructClass(classId);

      expect(typeof ReconstructedClass.create).toBe('function');
    });
  });

  describe('Method Reconstruction', () => {
    test('should reconstruct and execute methods', () => {
      const methodId = 'test_method_606';
      kgEngine.addTriple(methodId, 'rdf:type', 'kg:InstanceMethod');
      kgEngine.addTriple(methodId, 'kg:methodName', 'add');
      kgEngine.addTriple(methodId, 'kg:methodBody', 'function add(a, b) { return a + b; }');

      const method = reconstructor.reconstructMethod(methodId);

      expect(typeof method).toBe('function');
      expect(method(2, 3)).toBe(5);
    });

    test('should handle method parameters', () => {
      const methodId = 'param_method_707';
      kgEngine.addTriple(methodId, 'rdf:type', 'kg:InstanceMethod');
      kgEngine.addTriple(methodId, 'kg:methodName', 'multiply');
      kgEngine.addTriple(methodId, 'kg:methodBody', 'function multiply(x, y = 1) { return x * y; }');

      // Add parameter metadata
      const param1Id = `${methodId}_param_x`;
      kgEngine.addTriple(param1Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param1Id, 'kg:parameterName', 'x');
      kgEngine.addTriple(param1Id, 'kg:parameterIndex', 0);
      kgEngine.addTriple(param1Id, 'kg:isRequired', true);

      const param2Id = `${methodId}_param_y`;
      kgEngine.addTriple(param2Id, 'kg:parameterOf', methodId);
      kgEngine.addTriple(param2Id, 'kg:parameterName', 'y');
      kgEngine.addTriple(param2Id, 'kg:parameterIndex', 1);
      kgEngine.addTriple(param2Id, 'kg:defaultValue', 1);

      const method = reconstructor.reconstructMethod(methodId);

      expect(method(5)).toBe(5); // Uses default value
      expect(method(5, 3)).toBe(15);
    });
  });

  describe('Property Restoration', () => {
    test('should restore all object properties', () => {
      const objectId = 'props_object_808';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(objectId, 'kg:stringProp', 'text');
      kgEngine.addTriple(objectId, 'kg:numberProp', 42);
      kgEngine.addTriple(objectId, 'kg:booleanProp', false);
      kgEngine.addTriple(objectId, 'kg:nullProp', null);

      const reconstructed = reconstructor.reconstructObject(objectId);

      expect(reconstructed.stringProp).toBe('text');
      expect(reconstructed.numberProp).toBe(42);
      expect(reconstructed.booleanProp).toBe(false);
      expect(reconstructed.nullProp).toBe(null);
    });

    test('should handle nested object properties', () => {
      // Create nested object
      const nestedId = 'nested_object_909';
      kgEngine.addTriple(nestedId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(nestedId, 'kg:value', 'nested');

      // Create parent object
      const parentId = 'parent_object_010';
      kgEngine.addTriple(parentId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(parentId, 'kg:name', 'parent');
      kgEngine.addTriple(parentId, 'kg:nested', nestedId);

      const reconstructed = reconstructor.reconstructObject(parentId);

      expect(reconstructed.name).toBe('parent');
      expect(reconstructed.nested).toBeDefined();
      expect(reconstructed.nested.value).toBe('nested');
    });
  });

  describe('Circular Reference Handling', () => {
    test('should handle circular references gracefully', () => {
      const obj1Id = 'circular_obj1_111';
      const obj2Id = 'circular_obj2_222';

      // Create circular reference
      kgEngine.addTriple(obj1Id, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(obj1Id, 'kg:name', 'obj1');
      kgEngine.addTriple(obj1Id, 'kg:ref', obj2Id);

      kgEngine.addTriple(obj2Id, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(obj2Id, 'kg:name', 'obj2');
      kgEngine.addTriple(obj2Id, 'kg:ref', obj1Id);

      const obj1 = reconstructor.reconstructObject(obj1Id);

      expect(obj1.name).toBe('obj1');
      expect(obj1.ref).toBeDefined();
      expect(obj1.ref.name).toBe('obj2');
      expect(obj1.ref.ref).toBe(obj1); // Circular reference preserved
    });
  });

  describe('Cache Management', () => {
    test('should clear cache when requested', () => {
      const objectId = 'cache_test_333';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(objectId, 'kg:name', 'cached');

      reconstructor.reconstructObject(objectId);
      expect(reconstructor.objectCache.has(objectId)).toBe(true);

      reconstructor.clearCache();
      expect(reconstructor.objectCache.size).toBe(0);
    });

    test('should handle cache with many entries', () => {
      // Create many objects
      for (let i = 0; i < 100; i++) {
        const objectId = `cache_object_${i}`;
        kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
        kgEngine.addTriple(objectId, 'kg:index', i);
        reconstructor.reconstructObject(objectId);
      }

      expect(reconstructor.objectCache.size).toBe(100);

      // Verify all objects are cached correctly
      for (let i = 0; i < 100; i++) {
        const objectId = `cache_object_${i}`;
        const cached = reconstructor.objectCache.get(objectId);
        expect(cached.index).toBe(i);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent objects gracefully', () => {
      const result = reconstructor.reconstructObject('non_existent_444');
      expect(result).toBeNull();
    });

    test('should handle malformed method bodies', () => {
      const methodId = 'malformed_method_555';
      kgEngine.addTriple(methodId, 'rdf:type', 'kg:InstanceMethod');
      kgEngine.addTriple(methodId, 'kg:methodName', 'broken');
      kgEngine.addTriple(methodId, 'kg:methodBody', 'invalid javascript syntax {{{');

      expect(() => {
        reconstructor.reconstructMethod(methodId);
      }).toThrow();
    });

    test('should handle missing class metadata', () => {
      const classId = 'missing_class_666';
      kgEngine.addTriple(classId, 'rdf:type', 'kg:EntityClass');
      // Missing className

      const result = reconstructor.reconstructClass(classId);
      expect(result).toBeNull();
    });
  });

  describe('Performance', () => {
    test('should reconstruct objects efficiently', () => {
      // Create object with many properties
      const objectId = 'perf_object_777';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      
      for (let i = 0; i < 100; i++) {
        kgEngine.addTriple(objectId, `kg:prop${i}`, `value${i}`);
      }

      const startTime = performance.now();
      const reconstructed = reconstructor.reconstructObject(objectId);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should complete quickly
      expect(Object.keys(reconstructed)).toHaveLength(101); // 100 properties + _kgId
    });

    test('should handle cache access efficiently', () => {
      const objectId = 'cache_perf_888';
      kgEngine.addTriple(objectId, 'rdf:type', 'kg:Object');
      kgEngine.addTriple(objectId, 'kg:name', 'cached');

      // First reconstruction
      reconstructor.reconstructObject(objectId);

      // Cached access should be very fast
      const startTime = performance.now();
      const cached = reconstructor.reconstructObject(objectId);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1); // Should be nearly instantaneous
      expect(cached.name).toBe('cached');
    });
  });
});
