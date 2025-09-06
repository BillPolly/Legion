import { ClassSerializer } from '../../../src/serialization/ClassSerializer.js';
import { KGEngine } from '../../../src/core/KGEngine.js';
import { IDManager } from '../../../src/core/IDManager.js';
import '../../../src/serialization/ObjectExtensions.js';

describe('ClassSerializer', () => {
  let kgEngine, idManager, serializer;

  beforeEach(() => {
    kgEngine = new KGEngine();
    idManager = new IDManager();
    serializer = new ClassSerializer(idManager);
  });

  describe('Constructor', () => {
    test('should initialize with ID manager', () => {
      expect(serializer.idManager).toBe(idManager);
    });
  });

  describe('Class Serialization', () => {
    test('should serialize basic class metadata', () => {
      class TestClass {
        constructor(name) {
          this.name = name;
        }
      }

      const triples = serializer.serializeClass(TestClass);

      expect(triples).toBeDefined();
      expect(Array.isArray(triples)).toBe(true);
      expect(triples.length).toBeGreaterThan(0);
      
      // Check that class metadata triples are generated
      const classTriples = triples.filter(([, p, o]) => p === 'rdf:type' && o === 'kg:EntityClass');
      expect(classTriples).toHaveLength(1);

      const nameTriples = triples.filter(([, p, o]) => p === 'kg:className' && o === 'TestClass');
      expect(nameTriples).toHaveLength(1);
    });

    test('should serialize class with namespace metadata', () => {
      class CustomClass {}

      const metadata = {
        namespace: 'custom'
      };

      const triples = serializer.serializeClass(CustomClass, metadata);
      
      const namespaceTriples = triples.filter(([, p, o]) => p === 'kg:namespace' && o === 'custom');
      expect(namespaceTriples).toHaveLength(1);
    });

    test('should serialize constructor method', () => {
      class ConstructorClass {
        constructor(name) {
          this.name = name;
        }
      }

      const triples = serializer.serializeClass(ConstructorClass);
      
      // Check constructor method exists
      const constructorTriples = triples.filter(([, p]) => p === 'kg:constructorOf');
      expect(constructorTriples).toHaveLength(1);

      const constructorTypeTriples = triples.filter(([, p, o]) => p === 'rdf:type' && o === 'kg:Constructor');
      expect(constructorTypeTriples).toHaveLength(1);
    });

    test('should serialize instance methods', () => {
      class MethodClass {
        greet() {
          return 'hello';
        }

        calculate() {
          return 42;
        }
      }

      const triples = serializer.serializeClass(MethodClass);
      
      // Check instance methods
      const methodTriples = triples.filter(([, p]) => p === 'kg:methodOf');
      expect(methodTriples.length).toBeGreaterThan(0);

      const methodNameTriples = triples.filter(([, p, o]) => p === 'kg:methodName' && (o === 'greet' || o === 'calculate'));
      expect(methodNameTriples).toHaveLength(2);
    });

    test('should serialize static methods', () => {
      class StaticClass {
        static create() {
          return new StaticClass();
        }
      }

      const triples = serializer.serializeClass(StaticClass);
      
      // Check static methods
      const staticTriples = triples.filter(([, p]) => p === 'kg:staticMethodOf');
      expect(staticTriples.length).toBeGreaterThan(0);

      const staticTypeTriples = triples.filter(([, p, o]) => p === 'rdf:type' && o === 'kg:StaticMethod');
      expect(staticTypeTriples).toHaveLength(1);
    });

    test('should include method bodies when requested', () => {
      class BodyClass {
        testMethod() {
          return 'test';
        }
      }

      const metadata = {
        methods: {
          testMethod: {
            includeBody: true
          }
        }
      };

      const triples = serializer.serializeClass(BodyClass, metadata);
      
      const bodyTriples = triples.filter(([, p]) => p === 'kg:methodBody');
      expect(bodyTriples).toHaveLength(1);
      expect(bodyTriples[0][2]).toContain('return \'test\'');
    });

    test('should serialize parameter metadata', () => {
      class ParamClass {
        method(param1, param2) {
          return param1 + param2;
        }
      }

      const metadata = {
        methods: {
          method: {
            parameters: [
              { name: 'param1', type: 'String', required: true },
              { name: 'param2', type: 'Number', defaultValue: 0 }
            ]
          }
        }
      };

      const triples = serializer.serializeClass(ParamClass, metadata);
      
      const paramTriples = triples.filter(([, p]) => p === 'kg:parameterOf');
      expect(paramTriples.length).toBeGreaterThan(0);

      const paramNameTriples = triples.filter(([, p, o]) => p === 'kg:parameterName' && (o === 'param1' || o === 'param2'));
      expect(paramNameTriples).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    test('should handle classes with no methods', () => {
      class EmptyClass {}

      const triples = serializer.serializeClass(EmptyClass);

      expect(triples).toBeDefined();
      expect(triples.length).toBeGreaterThan(0);
      
      const classTriples = triples.filter(([, p, o]) => p === 'rdf:type' && o === 'kg:EntityClass');
      expect(classTriples).toHaveLength(1);
    });

    test('should handle null metadata gracefully', () => {
      class TestClass {
        method() {
          return 'test';
        }
      }

      expect(() => {
        serializer.serializeClass(TestClass, null);
      }).not.toThrow();
    });

    test('should handle undefined metadata gracefully', () => {
      class TestClass {
        method() {
          return 'test';
        }
      }

      expect(() => {
        serializer.serializeClass(TestClass, undefined);
      }).not.toThrow();
    });
  });

  describe('Performance', () => {
    test('should serialize classes efficiently', () => {
      class PerfClass {
        method1() { return 1; }
        method2() { return 2; }
        static staticMethod() { return 'static'; }
      }

      const startTime = performance.now();
      const triples = serializer.serializeClass(PerfClass);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10);
      expect(triples).toBeDefined();
      expect(triples.length).toBeGreaterThan(0);
    });
  });
});
