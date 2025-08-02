/**
 * Unit tests for StateTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { StateTestGenerator } from '../../../src/generators/StateTestGenerator.js';
import { JSOMValidator } from '../../../src/validators/JSOMValidator.js';

describe('StateTestGenerator', () => {
  describe('generateTests', () => {
    test('should generate tests for state properties', () => {
      const description = {
        stateProperties: {
          total: 2,
          properties: [
            { property: 'value', type: 'string', hasDefault: true, default: '' },
            { property: 'count', type: 'number', hasDefault: false }
          ]
        },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const tests = StateTestGenerator.generateTests(description);

      expect(tests.length).toBeGreaterThan(0);
      
      // Should have property tests
      const propertyTests = tests.filter(t => t.type === 'state-property');
      expect(propertyTests.length).toBe(2);
      
      // Should have default value tests
      const defaultTests = tests.filter(t => t.type === 'state-default');
      expect(defaultTests.length).toBe(1); // Only one property has default
      
      // Should have synchronization tests
      const syncTests = tests.filter(t => t.type === 'state-synchronization');
      expect(syncTests.length).toBe(1);
      
      // Should have constraint tests
      const constraintTests = tests.filter(t => t.type === 'state-constraints');
      expect(constraintTests.length).toBe(1);
    });

    test('should return empty array for no state properties', () => {
      const description = {
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const tests = StateTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate MVVM tests when events are present', () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [
            { property: 'value', type: 'string', hasDefault: true, default: '' }
          ]
        },
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'valueChange', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const tests = StateTestGenerator.generateTests(description);
      
      const mvvmTests = tests.filter(t => t.type === 'mvvm-pattern');
      expect(mvvmTests.length).toBe(1);
    });

    test('should handle undefined state properties', () => {
      const description = {
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const tests = StateTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });
  });

  describe('generatePropertyTests', () => {
    test('should generate basic property test', () => {
      const property = { property: 'value', type: 'string', hasDefault: false };
      const tests = StateTestGenerator.generatePropertyTests(property);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('State Management');
      expect(tests[0].name).toContain('value');
      expect(tests[0].type).toBe('state-property');
    });

    test('should generate default value test when hasDefault is true', () => {
      const property = { property: 'count', type: 'number', hasDefault: true, default: 0 };
      const tests = StateTestGenerator.generatePropertyTests(property);

      expect(tests.length).toBe(2); // property + default
      const defaultTest = tests.find(t => t.type === 'state-default');
      expect(defaultTest).toBeDefined();
      expect(defaultTest.expectedDefault).toBe(0);
    });

    test('should generate immutability test when property is immutable', () => {
      const property = { property: 'id', type: 'string', immutable: true };
      const tests = StateTestGenerator.generatePropertyTests(property);

      expect(tests.length).toBe(2); // property + immutable
      const immutableTest = tests.find(t => t.type === 'state-immutable');
      expect(immutableTest).toBeDefined();
    });

    test('should execute property test successfully', async () => {
      const property = { property: 'value', type: 'string', hasDefault: false };
      const tests = StateTestGenerator.generatePropertyTests(property);
      const propertyTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          state: new Map(),
          setState: function(key, value) { this.state.set(key, value); },
          getState: function(key) { return this.state.get(key); },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await propertyTest.execute(mockComponent, testEnvironment);

      expect(result.property).toBe('value');
      expect(result.expectedType).toBe('string');
      expect(result.canSet).toBe(true);
      expect(result.canGet).toBe(true);
      expect(result.typeMatches).toBe(true);
    });
  });

  describe('generateSynchronizationTests', () => {
    test('should generate synchronization test', () => {
      const stateProperties = {
        properties: [
          { property: 'value', type: 'string' },
          { property: 'count', type: 'number' }
        ]
      };

      const tests = StateTestGenerator.generateSynchronizationTests(stateProperties);

      expect(tests.length).toBe(1);
      expect(tests[0].type).toBe('state-synchronization');
      expect(tests[0].category).toBe('State Management');
    });

    test('should execute synchronization test successfully', async () => {
      const stateProperties = {
        properties: [
          { property: 'value', type: 'string' },
          { property: 'count', type: 'number' }
        ]
      };

      const tests = StateTestGenerator.generateSynchronizationTests(stateProperties);
      const syncTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          state: new Map(),
          setState: function(key, value) { this.state.set(key, value); },
          getState: function(key) { return this.state.get(key); },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await syncTest.execute(mockComponent, testEnvironment);

      expect(result.properties.length).toBe(2);
      expect(result.overallSynchronized).toBe(true);
      expect(result.synchronizationIssues).toEqual([]);
    });
  });

  describe('generateMVVMTests', () => {
    test('should generate MVVM pattern test', () => {
      const description = {
        stateProperties: {
          properties: [{ property: 'value', type: 'string' }]
        },
        events: {
          byType: {
            emits: [{ event: 'valueChange', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const tests = StateTestGenerator.generateMVVMTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].type).toBe('mvvm-pattern');
      expect(tests[0].category).toBe('State Management');
    });

    test('should execute MVVM test successfully', async () => {
      const description = {
        stateProperties: {
          properties: [{ property: 'value', type: 'string' }]
        },
        events: {
          byType: {
            emits: [{ event: 'valueChange', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const tests = StateTestGenerator.generateMVVMTests(description);
      const mvvmTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          state: new Map(),
          setState: function(key, value) {
            this.state.set(key, value);
            // Emit state change event
            if (deps.eventSystem) {
              deps.eventSystem.dispatchEvent('valueChange', value);
            }
          },
          getState: function(key) { return this.state.get(key); },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await mvvmTest.execute(mockComponent, testEnvironment);

      expect(result.stateEventBindings.length).toBe(1);
      expect(result.mvvmCompliance).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('generateConstraintTests', () => {
    test('should generate constraint test', () => {
      const stateProperties = {
        properties: [
          { property: 'value', type: 'string' },
          { property: 'count', type: 'number', constraints: [{ type: 'range', max: 100 }] }
        ]
      };

      const tests = StateTestGenerator.generateConstraintTests(stateProperties);

      expect(tests.length).toBe(1);
      expect(tests[0].type).toBe('state-constraints');
      expect(tests[0].category).toBe('State Management');
    });

    test('should execute constraint test successfully', async () => {
      const stateProperties = {
        properties: [
          { property: 'value', type: 'string' },
          { property: 'count', type: 'number' }
        ]
      };

      const tests = StateTestGenerator.generateConstraintTests(stateProperties);
      const constraintTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          state: new Map(),
          setState: function(key, value) { this.state.set(key, value); },
          getState: function(key) { return this.state.get(key); },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await constraintTest.execute(mockComponent, testEnvironment);

      expect(result.constraintTests.length).toBe(2);
      expect(result.constraintsEnforced).toBeDefined();
    });
  });

  describe('createComponentForTesting', () => {
    test('should create component with create method', async () => {
      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          setState: (key, value) => {},
          getState: (key) => undefined,
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await StateTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(typeof result.setState).toBe('function');
      expect(typeof result.getState).toBe('function');
    });

    test('should create component with static create method', async () => {
      const MockComponent = function() {};
      MockComponent.create = (deps) => ({
        dependencies: deps,
        created: true
      });

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await StateTestGenerator.createComponentForTesting(MockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
    });

    test('should create mock component with state management', async () => {
      const mockComponent = {}; // No create method

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await StateTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(typeof result.setState).toBe('function');
      expect(typeof result.getState).toBe('function');
      expect(result.state instanceof Map).toBe(true);
    });
  });

  describe('setComponentState', () => {
    test('should set state using setState method', async () => {
      const mockComponent = {
        state: new Map(),
        setState: function(key, value) { this.state.set(key, value); },
        getState: function(key) { return this.state.get(key); }
      };

      await StateTestGenerator.setComponentState(mockComponent, 'testProp', 'testValue');
      const value = mockComponent.getState('testProp');
      expect(value).toBe('testValue');
    });

    test('should set state using direct property assignment', async () => {
      const mockComponent = {
        testProp: undefined
      };

      await StateTestGenerator.setComponentState(mockComponent, 'testProp', 'testValue');
      expect(mockComponent.testProp).toBe('testValue');
    });

    test('should throw error when cannot set state', async () => {
      const mockComponent = {}; // No setState and no property

      await expect(
        StateTestGenerator.setComponentState(mockComponent, 'testProp', 'testValue')
      ).rejects.toThrow("Cannot set state property 'testProp' on component");
    });
  });

  describe('getComponentState', () => {
    test('should get state using getState method', async () => {
      const mockComponent = {
        state: new Map([['testProp', 'testValue']]),
        getState: function(key) { return this.state.get(key); }
      };

      const value = await StateTestGenerator.getComponentState(mockComponent, 'testProp');
      expect(value).toBe('testValue');
    });

    test('should get state using direct property access', async () => {
      const mockComponent = {
        testProp: 'testValue'
      };

      const value = await StateTestGenerator.getComponentState(mockComponent, 'testProp');
      expect(value).toBe('testValue');
    });

    test('should return undefined for non-existent property', async () => {
      const mockComponent = {};

      const value = await StateTestGenerator.getComponentState(mockComponent, 'nonExistent');
      expect(value).toBeUndefined();
    });
  });

  describe('generateValueForType', () => {
    test('should generate appropriate values for types', () => {
      expect(typeof StateTestGenerator.generateValueForType('string')).toBe('string');
      expect(typeof StateTestGenerator.generateValueForType('number')).toBe('number');
      expect(typeof StateTestGenerator.generateValueForType('boolean')).toBe('boolean');
      expect(Array.isArray(StateTestGenerator.generateValueForType('array'))).toBe(true);
      expect(typeof StateTestGenerator.generateValueForType('object')).toBe('object');
      expect(StateTestGenerator.generateValueForType('date') instanceof Date).toBe(true);
      expect(typeof StateTestGenerator.generateValueForType('function')).toBe('function');
    });

    test('should handle array types', () => {
      expect(Array.isArray(StateTestGenerator.generateValueForType('Array<string>'))).toBe(true);
    });

    test('should handle unknown types', () => {
      const result = StateTestGenerator.generateValueForType('UnknownType');
      expect(result).toBe('test-value');
    });
  });

  describe('generateValueOfWrongType', () => {
    test('should generate wrong type values', () => {
      expect(typeof StateTestGenerator.generateValueOfWrongType('string')).toBe('number');
      expect(typeof StateTestGenerator.generateValueOfWrongType('number')).toBe('string');
      expect(typeof StateTestGenerator.generateValueOfWrongType('boolean')).toBe('string');
      expect(typeof StateTestGenerator.generateValueOfWrongType('array')).toBe('string');
      expect(typeof StateTestGenerator.generateValueOfWrongType('object')).toBe('string');
    });

    test('should return null for unknown types', () => {
      expect(StateTestGenerator.generateValueOfWrongType('unknown')).toBeNull();
    });
  });

  describe('generateConstraintViolatingValue', () => {
    test('should generate range violating values', () => {
      const constraint = { type: 'range', max: 100 };
      const value = StateTestGenerator.generateConstraintViolatingValue(constraint);
      expect(value).toBeGreaterThan(100);
    });

    test('should generate length violating values', () => {
      const constraint = { type: 'length', max: 5 };
      const value = StateTestGenerator.generateConstraintViolatingValue(constraint);
      expect(value.length).toBeGreaterThan(5);
    });

    test('should generate pattern violating values', () => {
      const constraint = { type: 'pattern', pattern: /^[a-z]+$/ };
      const value = StateTestGenerator.generateConstraintViolatingValue(constraint);
      expect(value).toBe('invalid-pattern-value');
    });

    test('should handle unknown constraint types', () => {
      const constraint = { type: 'unknown' };
      const value = StateTestGenerator.generateConstraintViolatingValue(constraint);
      expect(value).toBe('constraint-violating-value');
    });
  });

  describe('getActualType', () => {
    test('should identify primitive types', () => {
      expect(StateTestGenerator.getActualType('string')).toBe('string');
      expect(StateTestGenerator.getActualType(42)).toBe('number');
      expect(StateTestGenerator.getActualType(true)).toBe('boolean');
      expect(StateTestGenerator.getActualType(null)).toBe('null');
      expect(StateTestGenerator.getActualType(undefined)).toBe('undefined');
    });

    test('should identify complex types', () => {
      expect(StateTestGenerator.getActualType([])).toBe('Array');
      expect(StateTestGenerator.getActualType(new Date())).toBe('Date');
      expect(StateTestGenerator.getActualType(/regex/)).toBe('RegExp');
      expect(StateTestGenerator.getActualType({})).toBe('Object');
    });

    test('should handle constructor names', () => {
      class CustomClass {}
      const instance = new CustomClass();
      expect(StateTestGenerator.getActualType(instance)).toBe('CustomClass');
    });
  });

  describe('isTypeCompatible', () => {
    test('should match exact types', () => {
      expect(StateTestGenerator.isTypeCompatible('string', 'string')).toBe(true);
      expect(StateTestGenerator.isTypeCompatible('number', 'number')).toBe(true);
    });

    test('should handle case variations', () => {
      expect(StateTestGenerator.isTypeCompatible('String', 'string')).toBe(true);
      expect(StateTestGenerator.isTypeCompatible('NUMBER', 'number')).toBe(true);
    });

    test('should handle generic array types', () => {
      expect(StateTestGenerator.isTypeCompatible('Array', 'Array<string>')).toBe(true);
      expect(StateTestGenerator.isTypeCompatible('Array', 'Array')).toBe(true);
    });

    test('should handle object types', () => {
      expect(StateTestGenerator.isTypeCompatible('object', 'Object')).toBe(true);
      expect(StateTestGenerator.isTypeCompatible('Object', 'object')).toBe(true);
      expect(StateTestGenerator.isTypeCompatible('function', 'Function')).toBe(true);
      expect(StateTestGenerator.isTypeCompatible('Function', 'function')).toBe(true);
    });

    test('should reject incompatible types', () => {
      expect(StateTestGenerator.isTypeCompatible('string', 'number')).toBe(false);
      expect(StateTestGenerator.isTypeCompatible('Array', 'string')).toBe(false);
    });
  });
});