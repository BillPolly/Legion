/**
 * Unit tests for DependencyTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { DependencyTestGenerator } from '../../../src/generators/DependencyTestGenerator.js';

describe('DependencyTestGenerator', () => {
  describe('generateTests', () => {
    test('should return empty array for component with no dependencies', () => {
      const description = {
        dependencies: {
          total: 0,
          dependencies: []
        }
      };

      const tests = DependencyTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate tests for required dependencies', () => {
      const description = {
        dependencies: {
          total: 1,
          dependencies: [
            { name: 'dom', type: 'HTMLElement', required: true, hasDefault: false }
          ]
        }
      };

      const tests = DependencyTestGenerator.generateTests(description);
      
      expect(tests.length).toBeGreaterThan(0);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain('should require dom parameter of type HTMLElement');
      expect(testNames).toContain('should validate dom parameter type');
      expect(testNames).toContain('should create component with all required dependencies');
    });

    test('should generate tests for optional dependencies', () => {
      const description = {
        dependencies: {
          total: 1,
          dependencies: [
            { name: 'config', type: 'Object', required: false, hasDefault: true, default: {} }
          ]
        }
      };

      const tests = DependencyTestGenerator.generateTests(description);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain('should accept optional config parameter of type Object');
      expect(testNames).toContain('should use default value for config when not provided');
    });

    test('should generate tests for mixed dependencies', () => {
      const description = {
        dependencies: {
          total: 3,
          dependencies: [
            { name: 'dom', type: 'HTMLElement', required: true, hasDefault: false },
            { name: 'config', type: 'Object', required: false, hasDefault: true, default: {} },
            { name: 'actorSpace', type: 'ActorSpace', required: true, hasDefault: false }
          ]
        }
      };

      const tests = DependencyTestGenerator.generateTests(description);
      
      expect(tests.length).toBeGreaterThan(0);
      
      // Should have tests for all dependencies
      const testNames = tests.map(t => t.name);
      expect(testNames.some(name => name.includes('dom'))).toBe(true);
      expect(testNames.some(name => name.includes('config'))).toBe(true);
      expect(testNames.some(name => name.includes('actorSpace'))).toBe(true);
      
      // Should have integration test
      expect(testNames).toContain('should create component with all required dependencies');
    });
  });

  describe('generateDependencyTests', () => {
    test('should generate required dependency tests', () => {
      const dependency = { 
        name: 'dom', 
        type: 'HTMLElement', 
        required: true, 
        hasDefault: false 
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      
      expect(tests).toHaveLength(2);
      expect(tests[0].name).toBe('should require dom parameter of type HTMLElement');
      expect(tests[0].type).toBe('dependency-required');
      expect(tests[1].name).toBe('should validate dom parameter type');
      expect(tests[1].type).toBe('dependency-type-validation');
    });

    test('should generate optional dependency tests', () => {
      const dependency = { 
        name: 'config', 
        type: 'Object', 
        required: false, 
        hasDefault: false 
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should accept optional config parameter of type Object');
      expect(tests[0].type).toBe('dependency-optional');
    });

    test('should generate default value tests for optional dependencies', () => {
      const dependency = { 
        name: 'config', 
        type: 'Object', 
        required: false, 
        hasDefault: true,
        default: { theme: 'dark' }
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      
      expect(tests).toHaveLength(2);
      expect(tests[0].name).toBe('should accept optional config parameter of type Object');
      expect(tests[1].name).toBe('should use default value for config when not provided');
      expect(tests[1].type).toBe('dependency-default');
    });
  });

  describe('generateIntegrationTests', () => {
    test('should generate integration test for multiple required dependencies', () => {
      const dependencies = {
        dependencies: [
          { name: 'dom', type: 'HTMLElement', required: true },
          { name: 'actorSpace', type: 'ActorSpace', required: true },
          { name: 'config', type: 'Object', required: false }
        ]
      };

      const tests = DependencyTestGenerator.generateIntegrationTests(dependencies);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('should create component with all required dependencies');
      expect(tests[0].type).toBe('dependency-integration');
    });
  });

  describe('test execution', () => {
    const mockComponent = {
      describe: (d) => d.requires('dom', 'HTMLElement'),
      create: (deps) => {
        if (!deps.dom) {
          throw new Error('dom is required');
        }
        if (typeof deps.dom !== 'object' || !deps.dom.nodeType) {
          throw new Error('dom must be HTMLElement');
        }
        return { dependencies: deps, created: true };
      }
    };

    test('should execute required dependency test', async () => {
      const dependency = { 
        name: 'dom', 
        type: 'HTMLElement', 
        required: true, 
        hasDefault: false 
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      const requiredTest = tests.find(t => t.type === 'dependency-required');
      
      const result = await requiredTest.execute(mockComponent, {});
      
      expect(result.success).toBe(true);
      expect(result.dependency).toBe('dom');
      expect(result.error).toContain('dom is required');
    });

    test('should execute type validation test', async () => {
      const dependency = { 
        name: 'dom', 
        type: 'HTMLElement', 
        required: true, 
        hasDefault: false 
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      const typeTest = tests.find(t => t.type === 'dependency-type-validation');
      
      const result = await typeTest.execute(mockComponent, {});
      
      expect(result.dependency).toBe('dom');
      expect(result.expectedType).toBe('HTMLElement');
      expect(result.validationResults).toBeDefined();
      expect(result.validationResults.length).toBeGreaterThan(0);
      
      // All invalid values should have failed
      result.validationResults.forEach(validationResult => {
        expect(validationResult.shouldHaveFailed).toBe(true);
        expect(validationResult.success).toBe(true);
      });
    });

    test('should execute optional dependency test', async () => {
      const mockOptionalComponent = {
        describe: (d) => d.optional('config', 'Object'),
        create: (deps) => ({ dependencies: deps, created: true })
      };

      const dependency = { 
        name: 'config', 
        type: 'Object', 
        required: false, 
        hasDefault: false 
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      const optionalTest = tests.find(t => t.type === 'dependency-optional');
      
      const result = await optionalTest.execute(mockOptionalComponent, {});
      
      expect(result.dependency).toBe('config');
      expect(result.worksWithout).toBe(true);
      expect(result.worksWith).toBe(true);
    });

    test('should execute default value test', async () => {
      const defaultValue = { theme: 'dark' };
      const mockDefaultComponent = {
        describe: (d) => d.optional('config', 'Object', { default: defaultValue }),
        create: (deps) => ({
          dependencies: deps,
          config: deps.config || defaultValue,
          created: true
        })
      };

      const dependency = { 
        name: 'config', 
        type: 'Object', 
        required: false, 
        hasDefault: true,
        default: defaultValue
      };

      const tests = DependencyTestGenerator.generateDependencyTests(dependency);
      const defaultTest = tests.find(t => t.type === 'dependency-default');
      
      const result = await defaultTest.execute(mockDefaultComponent, {});
      
      expect(result.dependency).toBe('config');
      expect(result.expectedDefault).toEqual(defaultValue);
      expect(result.actualValue).toEqual(defaultValue);
      expect(result.defaultUsed).toBe(true);
    });

    test('should execute integration test', async () => {
      const dependencies = {
        dependencies: [
          { name: 'dom', type: 'HTMLElement', required: true },
          { name: 'actorSpace', type: 'ActorSpace', required: true }
        ]
      };

      const tests = DependencyTestGenerator.generateIntegrationTests(dependencies);
      const integrationTest = tests[0];
      
      const mockDeps = {
        dom: DependencyTestGenerator.getValidValueForType('HTMLElement'),
        actorSpace: DependencyTestGenerator.getValidValueForType('ActorSpace')
      };

      const result = await integrationTest.execute(mockComponent, mockDeps);
      
      expect(result.success).toBe(true);
      expect(result.requiredDependencies).toEqual(['dom', 'actorSpace']);
      expect(result.providedDependencies).toContain('dom');
      expect(result.providedDependencies).toContain('actorSpace');
    });
  });

  describe('utility methods', () => {
    describe('getInvalidValuesForType', () => {
      test('should return invalid values for HTMLElement', () => {
        const invalidValues = DependencyTestGenerator.getInvalidValuesForType('HTMLElement');
        
        expect(invalidValues).toContain(null);
        expect(invalidValues).toContain(undefined);
        expect(invalidValues).toContain('not-element');
        expect(invalidValues).toContain(42);
      });

      test('should return invalid values for string', () => {
        const invalidValues = DependencyTestGenerator.getInvalidValuesForType('string');
        
        expect(invalidValues).toContain(null);
        expect(invalidValues).toContain(undefined);
        expect(invalidValues).toContain(42);
        expect(invalidValues).toContainEqual({});
      });

      test('should return common invalid values for unknown types', () => {
        const invalidValues = DependencyTestGenerator.getInvalidValuesForType('UnknownType');
        
        expect(invalidValues).toContain(null);
        expect(invalidValues).toContain(undefined);
        expect(invalidValues).toContain(42);
        expect(invalidValues).toContain('string');
      });
    });

    describe('getValidValueForType', () => {
      test('should return valid HTMLElement', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('HTMLElement');
        
        expect(validValue).toHaveProperty('nodeType');
        expect(validValue).toHaveProperty('tagName');
      });

      test('should return valid string', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('string');
        expect(typeof validValue).toBe('string');
      });

      test('should return valid number', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('number');
        expect(typeof validValue).toBe('number');
      });

      test('should return valid Object', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('Object');
        expect(typeof validValue).toBe('object');
        expect(validValue).not.toBeNull();
      });

      test('should return valid Array', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('Array');
        expect(Array.isArray(validValue)).toBe(true);
      });

      test('should return valid Function', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('Function');
        expect(typeof validValue).toBe('function');
      });

      test('should return mock object for unknown types', () => {
        const validValue = DependencyTestGenerator.getValidValueForType('UnknownType');
        expect(validValue).toHaveProperty('type', 'UnknownType');
        expect(validValue).toHaveProperty('mock', true);
      });
    });

    describe('deepEqual', () => {
      test('should return true for identical primitives', () => {
        expect(DependencyTestGenerator.deepEqual(42, 42)).toBe(true);
        expect(DependencyTestGenerator.deepEqual('test', 'test')).toBe(true);
        expect(DependencyTestGenerator.deepEqual(true, true)).toBe(true);
        expect(DependencyTestGenerator.deepEqual(null, null)).toBe(true);
        expect(DependencyTestGenerator.deepEqual(undefined, undefined)).toBe(true);
      });

      test('should return false for different primitives', () => {
        expect(DependencyTestGenerator.deepEqual(42, 43)).toBe(false);
        expect(DependencyTestGenerator.deepEqual('test', 'other')).toBe(false);
        expect(DependencyTestGenerator.deepEqual(true, false)).toBe(false);
        expect(DependencyTestGenerator.deepEqual(null, undefined)).toBe(false);
      });

      test('should return true for identical objects', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { a: 1, b: { c: 2 } };
        
        expect(DependencyTestGenerator.deepEqual(obj1, obj2)).toBe(true);
      });

      test('should return false for different objects', () => {
        const obj1 = { a: 1, b: { c: 2 } };
        const obj2 = { a: 1, b: { c: 3 } };
        const obj3 = { a: 1, b: { c: 2 }, d: 4 };
        
        expect(DependencyTestGenerator.deepEqual(obj1, obj2)).toBe(false);
        expect(DependencyTestGenerator.deepEqual(obj1, obj3)).toBe(false);
      });

      test('should handle nested objects', () => {
        const obj1 = { 
          a: 1, 
          b: { 
            c: 2, 
            d: { 
              e: 3 
            } 
          } 
        };
        const obj2 = { 
          a: 1, 
          b: { 
            c: 2, 
            d: { 
              e: 3 
            } 
          } 
        };
        
        expect(DependencyTestGenerator.deepEqual(obj1, obj2)).toBe(true);
      });
    });

    describe('getDependencyValue', () => {
      test('should get value from dependencies object', () => {
        const component = {
          dependencies: { dom: 'test-dom', config: { theme: 'dark' } },
          created: true
        };

        expect(DependencyTestGenerator.getDependencyValue(component, 'dom')).toBe('test-dom');
        expect(DependencyTestGenerator.getDependencyValue(component, 'config')).toEqual({ theme: 'dark' });
      });

      test('should get value from component property', () => {
        const component = {
          dom: 'test-dom',
          config: { theme: 'dark' },
          created: true
        };

        expect(DependencyTestGenerator.getDependencyValue(component, 'dom')).toBe('test-dom');
        expect(DependencyTestGenerator.getDependencyValue(component, 'config')).toEqual({ theme: 'dark' });
      });

      test('should return undefined for missing dependency', () => {
        const component = { created: true };

        expect(DependencyTestGenerator.getDependencyValue(component, 'missing')).toBeUndefined();
      });
    });
  });
});