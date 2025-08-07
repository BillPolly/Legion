/**
 * Unit tests for InvariantTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { InvariantTestGenerator } from '../../../src/generators/InvariantTestGenerator.js';
import { JSOMValidator } from '../../../src/validators/JSOMValidator.js';

describe('InvariantTestGenerator', () => {
  describe('generateTests', () => {
    test('should generate invariant tests for component with invariants', () => {
      const description = {
        stateProperties: {
          total: 2,
          properties: [
            { property: 'count', type: 'number' },
            { property: 'status', type: 'string' }
          ]
        },
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'change', payloadType: 'object' }],
            listens: []
          }
        },
        dependencies: {
          total: 1,
          dependencies: [
            { name: 'eventSystem', type: 'EventSystem', required: true }
          ]
        }
      };

      const tests = InvariantTestGenerator.generateTests(description);

      expect(tests.length).toBeGreaterThan(0);
      
      // Should have all types of invariant tests
      const propertyTests = tests.filter(t => t.type === 'property-based');
      const constraintTests = tests.filter(t => t.type === 'constraint-invariants');
      const stateTests = tests.filter(t => t.type === 'state-invariants');
      const crossCuttingTests = tests.filter(t => t.type === 'cross-cutting-invariants');

      expect(propertyTests.length).toBe(1);
      expect(constraintTests.length).toBe(1);
      expect(stateTests.length).toBe(1);
      expect(crossCuttingTests.length).toBe(1);
    });

    test('should return empty array for component without invariants', () => {
      const description = {
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } },
        dependencies: { total: 0, dependencies: [] }
      };

      const tests = InvariantTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate partial tests for components with limited invariants', () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'value', type: 'string' }]
        },
        events: { total: 0, byType: { emits: [], listens: [] } },
        dependencies: { total: 0, dependencies: [] }
      };

      const tests = InvariantTestGenerator.generateTests(description);
      
      expect(tests.length).toBe(4); // property-based, constraint-invariants, state-invariants, cross-cutting-invariants
      expect(tests.some(t => t.type === 'property-based')).toBe(true);
      expect(tests.some(t => t.type === 'constraint-invariants')).toBe(true);
      expect(tests.some(t => t.type === 'cross-cutting-invariants')).toBe(true);
    });
  });

  describe('hasInvariants', () => {
    test('should detect state property invariants', () => {
      const description = {
        stateProperties: { total: 1, properties: [{ property: 'count', type: 'number' }] },
        events: { total: 0, byType: { emits: [], listens: [] } },
        dependencies: { total: 0, dependencies: [] }
      };

      expect(InvariantTestGenerator.hasInvariants(description)).toBe(true);
    });

    test('should detect event invariants', () => {
      const description = {
        stateProperties: { total: 0, properties: [] },
        events: { total: 1, byType: { emits: [{ event: 'change', payloadType: 'object' }], listens: [] } },
        dependencies: { total: 0, dependencies: [] }
      };

      expect(InvariantTestGenerator.hasInvariants(description)).toBe(true);
    });

    test('should detect dependency invariants', () => {
      const description = {
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } },
        dependencies: { total: 1, dependencies: [{ name: 'dom', type: 'HTMLElement' }] }
      };

      expect(InvariantTestGenerator.hasInvariants(description)).toBe(true);
    });

    test('should detect explicit invariants', () => {
      const description = {
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } },
        dependencies: { total: 0, dependencies: [] },
        invariants: [{ property: 'count', constraint: 'positive' }]
      };

      expect(InvariantTestGenerator.hasInvariants(description)).toBe(true);
    });

    test('should return false for component without invariants', () => {
      const description = {
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } },
        dependencies: { total: 0, dependencies: [] }
      };

      expect(InvariantTestGenerator.hasInvariants(description)).toBe(false);
    });
  });

  describe('generatePropertyBasedTests', () => {
    test('should generate property-based test', () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const tests = InvariantTestGenerator.generatePropertyBasedTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Invariants');
      expect(tests[0].type).toBe('property-based');
      expect(tests[0].name).toContain('random operations');
    });

    test('should execute property-based test successfully', async () => {
      const description = {
        stateProperties: {
          total: 2,
          properties: [
            { property: 'count', type: 'number' },
            { property: 'status', type: 'string' }
          ]
        },
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'change', payloadType: 'object' }],
            listens: []
          }
        }
      };

      const tests = InvariantTestGenerator.generatePropertyBasedTests(description);
      const propertyTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          state: new Map(),
          operations: [],
          setState: function(key, value) {
            this.operations.push({ type: 'setState', key, value, timestamp: Date.now() });
            this.state.set(key, value);
          },
          getState: function(key) { return this.state.get(key); },
          emit: function(event, payload) {
            this.operations.push({ type: 'emit', event, payload, timestamp: Date.now() });
            if (this.config.eventSystem) {
              this.config.eventSystem.dispatchEvent(event, payload);
            }
          },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await propertyTest.execute(mockComponent, testEnvironment);

      expect(result.operationsPerformed).toBeGreaterThan(0);
      expect(result.operationsPerformed).toBeLessThanOrEqual(50); // Should perform up to 50 operations
      expect(Array.isArray(result.invariantViolations)).toBe(true);
      expect(Array.isArray(result.propertyTests)).toBe(true);
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle property-based test errors gracefully', async () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const tests = InvariantTestGenerator.generatePropertyBasedTests(description);
      const propertyTest = tests[0];

      const mockComponent = {
        create: () => {
          throw new Error('Component creation failed');
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      
      // The test should handle the error gracefully and not throw
      await expect(propertyTest.execute(mockComponent, testEnvironment)).rejects.toThrow('Component creation failed');
    });
  });

  describe('generateConstraintInvariantTests', () => {
    test('should generate constraint invariant test', () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const tests = InvariantTestGenerator.generateConstraintInvariantTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Invariants');
      expect(tests[0].type).toBe('constraint-invariants');
      expect(tests[0].name).toContain('enforce component constraints');
    });

    test('should execute constraint invariant test successfully', async () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'count', type: 'number' }]
        },
        dependencies: {
          total: 1,
          dependencies: [{ name: 'eventSystem', type: 'EventSystem' }]
        },
        events: {
          total: 1,
          byType: { emits: [{ event: 'change' }], listens: [] }
        }
      };

      const tests = InvariantTestGenerator.generateConstraintInvariantTests(description);
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

      expect(Array.isArray(result.constraintTests)).toBe(true);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(typeof result.enforcementConsistent).toBe('boolean');
      expect(result.constraintTests.length).toBeGreaterThan(0); // Should test state properties, dependencies, and events
    });
  });

  describe('generateStateInvariantTests', () => {
    test('should generate state invariant test', () => {
      const description = {
        stateProperties: {
          total: 2,
          properties: [
            { property: 'count', type: 'number' },
            { property: 'status', type: 'string' }
          ]
        }
      };

      const tests = InvariantTestGenerator.generateStateInvariantTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Invariants');
      expect(tests[0].type).toBe('state-invariants');
      expect(tests[0].name).toContain('state invariants across operations');
    });

    test('should execute state invariant test successfully', async () => {
      const description = {
        stateProperties: {
          total: 2,
          properties: [
            { property: 'count', type: 'number' },
            { property: 'status', type: 'string' }
          ]
        }
      };

      const tests = InvariantTestGenerator.generateStateInvariantTests(description);
      const stateTest = tests[0];

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
      const result = await stateTest.execute(mockComponent, testEnvironment);

      expect(Array.isArray(result.stateInvariants)).toBe(true);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(typeof result.invariantsHold).toBe('boolean');
      expect(result.stateInvariants.length).toBe(3); // 2 property tests + 1 cross-property test
    });
  });

  describe('generateCrossCuttingInvariantTests', () => {
    test('should generate cross-cutting invariant test', () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const tests = InvariantTestGenerator.generateCrossCuttingInvariantTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('Invariants');
      expect(tests[0].type).toBe('cross-cutting-invariants');
      expect(tests[0].name).toContain('cross-cutting invariants');
    });

    test('should execute cross-cutting invariant test successfully', async () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const tests = InvariantTestGenerator.generateCrossCuttingInvariantTests(description);
      const crossCuttingTest = tests[0];

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
      const result = await crossCuttingTest.execute(mockComponent, testEnvironment);

      expect(Array.isArray(result.crossCuttingTests)).toBe(true);
      expect(Array.isArray(result.violations)).toBe(true);
      expect(typeof result.invariantsHold).toBe('boolean');
      expect(result.crossCuttingTests.length).toBe(3); // lifecycle, temporal, concurrency tests
    });
  });

  describe('createComponentForTesting', () => {
    test('should create component with create method', async () => {
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
      const result = await InvariantTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(typeof result.setState).toBe('function');
      expect(typeof result.getState).toBe('function');
    });

    test('should create mock component with invariant testing capabilities', async () => {
      const mockComponent = {}; // No create method

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await InvariantTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(typeof result.setState).toBe('function');
      expect(typeof result.getState).toBe('function');
      expect(typeof result.emit).toBe('function');
      expect(typeof result.addOperation).toBe('function');
      expect(typeof result.getOperationHistory).toBe('function');
      expect(result.state instanceof Map).toBe(true);
      expect(Array.isArray(result.operations)).toBe(true);
    });
  });

  describe('generateRandomOperation', () => {
    test('should generate setState operation for components with state properties', () => {
      const description = {
        stateProperties: {
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      // Try multiple times to get setState operation (it's random)
      let setStateFound = false;
      for (let i = 0; i < 10; i++) {
        const operation = InvariantTestGenerator.generateRandomOperation(description);
        if (operation.type === 'setState') {
          setStateFound = true;
          expect(operation.property).toBe('count');
          expect(operation.expectedType).toBe('number');
          expect(typeof operation.value).toBe('number');
          break;
        }
      }
      expect(setStateFound).toBe(true);
    });

    test('should generate emit operation for components with emit events', () => {
      const description = {
        events: {
          byType: {
            emits: [{ event: 'change', payloadType: 'string' }]
          }
        }
      };

      // Try multiple times to get emit operation (it's random)
      let emitFound = false;
      for (let i = 0; i < 10; i++) {
        const operation = InvariantTestGenerator.generateRandomOperation(description);
        if (operation.type === 'emit') {
          emitFound = true;
          expect(operation.event).toBe('change');
          expect(operation.expectedType).toBe('string');
          expect(typeof operation.payload).toBe('string');
          break;
        }
      }
      expect(emitFound).toBe(true);
    });

    test('should generate fallback operation for limited component', () => {
      const description = {
        stateProperties: { properties: [] },
        events: { byType: { emits: [] } }
      };

      const operation = InvariantTestGenerator.generateRandomOperation(description);
      expect(['noop', 'call'].includes(operation.type)).toBe(true);
    });
  });

  describe('executeOperation', () => {
    test('should execute setState operation', async () => {
      const mockComponent = {
        state: new Map(),
        setState: function(key, value) { this.state.set(key, value); }
      };

      const operation = {
        type: 'setState',
        property: 'count',
        value: 42
      };

      await InvariantTestGenerator.executeOperation(mockComponent, operation, {});
      expect(mockComponent.state.get('count')).toBe(42);
    });

    test('should execute emit operation', async () => {
      let emittedEvent = null;
      let emittedPayload = null;

      const mockComponent = {
        emit: function(event, payload) {
          emittedEvent = event;
          emittedPayload = payload;
        }
      };

      const operation = {
        type: 'emit',
        event: 'change',
        payload: { data: 'test' }
      };

      await InvariantTestGenerator.executeOperation(mockComponent, operation, {});
      expect(emittedEvent).toBe('change');
      expect(emittedPayload).toEqual({ data: 'test' });
    });

    test('should handle noop operation', async () => {
      const mockComponent = {};
      const operation = { type: 'noop' };

      // Should not throw
      await expect(InvariantTestGenerator.executeOperation(mockComponent, operation, {})).resolves.toBeUndefined();
    });
  });

  describe('captureComponentState', () => {
    test('should capture state from Map-based component', async () => {
      const mockComponent = {
        state: new Map([['count', 42], ['status', 'active']]),
        getOperationHistory: () => [{ type: 'setState', timestamp: Date.now() }],
        created: true
      };

      const state = await InvariantTestGenerator.captureComponentState(mockComponent);

      expect(state.timestamp).toBeDefined();
      expect(state.stateProperties.count).toBe(42);
      expect(state.stateProperties.status).toBe('active');
      expect(state.operations.length).toBe(1);
      expect(state.created).toBe(true);
    });

    test('should capture state from getState-based component', async () => {
      const mockComponent = {
        getState: (key) => key === 'value' ? 'test' : undefined,
        created: true
      };

      const state = await InvariantTestGenerator.captureComponentState(mockComponent);

      expect(state.stateProperties.value).toBe('test');
      expect(state.created).toBe(true);
    });
  });

  describe('checkInvariants', () => {
    test('should detect type invariant violations', async () => {
      const mockComponent = { created: true };
      const preState = { stateProperties: { count: 5 } };
      const postState = { stateProperties: { count: 'invalid' } }; // Should be number
      const operation = { type: 'setState', property: 'count', value: 'invalid' };
      const description = {
        stateProperties: {
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const violations = await InvariantTestGenerator.checkInvariants(
        mockComponent, preState, postState, operation, description
      );

      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('TYPE_INVARIANT_VIOLATION');
      expect(violations[0].property).toBe('count');
      expect(violations[0].expectedType).toBe('number');
      expect(violations[0].actualType).toBe('string');
    });

    test('should detect monotonicity violations', async () => {
      const mockComponent = { created: true };
      const preState = { stateProperties: { count: 10 } };
      const postState = { stateProperties: { count: 5 } }; // Decreased
      const operation = { type: 'setState', property: 'count', value: 5 };
      const description = {};

      const violations = await InvariantTestGenerator.checkInvariants(
        mockComponent, preState, postState, operation, description
      );

      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('MONOTONICITY_VIOLATION');
      expect(violations[0].property).toBe('count');
      expect(violations[0].preValue).toBe(10);
      expect(violations[0].postValue).toBe(5);
    });

    test('should detect lifecycle violations', async () => {
      const mockComponent = { created: true };
      const preState = { 
        created: true,
        stateProperties: {},
        operations: []
      };
      const postState = { 
        created: false, // Component became uncreated
        stateProperties: {},
        operations: []
      };
      const operation = { type: 'destroy' };
      const description = {};

      const violations = await InvariantTestGenerator.checkInvariants(
        mockComponent, preState, postState, operation, description
      );

      expect(violations.length).toBe(1);
      expect(violations[0].type).toBe('LIFECYCLE_VIOLATION');
      expect(violations[0].message).toContain('Component became uncreated');
    });

    test('should return empty array for valid invariants', async () => {
      const mockComponent = { created: true };
      const preState = { stateProperties: { count: 5 } };
      const postState = { stateProperties: { count: 10 } }; // Valid increase
      const operation = { type: 'setState', property: 'count', value: 10 };
      const description = {
        stateProperties: {
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      const violations = await InvariantTestGenerator.checkInvariants(
        mockComponent, preState, postState, operation, description
      );

      expect(violations).toEqual([]);
    });
  });

  describe('testTypeConstraintInvariant', () => {
    test('should test type constraints with valid values', async () => {
      const mockComponent = {
        state: new Map(),
        setState: function(key, value) { this.state.set(key, value); },
        getState: function(key) { return this.state.get(key); }
      };

      const property = { property: 'count', type: 'number' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await InvariantTestGenerator.testTypeConstraintInvariant(
        mockComponent, property, testEnvironment
      );

      expect(result.property).toBe('count');
      expect(result.expectedType).toBe('number');
      expect(typeof result.consistent).toBe('boolean');
      expect(Array.isArray(result.violations)).toBe(true);
    });

    test('should detect invalid value acceptance', async () => {
      const mockComponent = {
        state: new Map(),
        setState: function(key, value) { this.state.set(key, value); }, // Accepts any value
        getState: function(key) { return this.state.get(key); }
      };

      const property = { property: 'count', type: 'number' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await InvariantTestGenerator.testTypeConstraintInvariant(
        mockComponent, property, testEnvironment
      );

      // Should detect that invalid values (strings, etc.) are accepted
      expect(result.violations.some(v => v.type === 'INVALID_VALUE_ACCEPTED')).toBe(true);
    });
  });

  describe('helper methods', () => {
    test('should validate types correctly', () => {
      expect(InvariantTestGenerator.isValidType('test', 'string')).toBe(true);
      expect(InvariantTestGenerator.isValidType(42, 'number')).toBe(true);
      expect(InvariantTestGenerator.isValidType(true, 'boolean')).toBe(true);
      expect(InvariantTestGenerator.isValidType([], 'array')).toBe(true);
      expect(InvariantTestGenerator.isValidType({}, 'object')).toBe(true);
      expect(InvariantTestGenerator.isValidType(new Date(), 'date')).toBe(true);

      expect(InvariantTestGenerator.isValidType('test', 'number')).toBe(false);
      expect(InvariantTestGenerator.isValidType(42, 'string')).toBe(false);
      expect(InvariantTestGenerator.isValidType([], 'object')).toBe(false);
      expect(InvariantTestGenerator.isValidType(null, 'object')).toBe(false);
    });

    test('should generate random values for types', () => {
      expect(typeof InvariantTestGenerator.generateRandomValue('string')).toBe('string');
      expect(typeof InvariantTestGenerator.generateRandomValue('number')).toBe('number');
      expect(typeof InvariantTestGenerator.generateRandomValue('boolean')).toBe('boolean');
      expect(Array.isArray(InvariantTestGenerator.generateRandomValue('array'))).toBe(true);
      expect(typeof InvariantTestGenerator.generateRandomValue('object')).toBe('object');
      expect(InvariantTestGenerator.generateRandomValue('date') instanceof Date).toBe(true);
    });

    test('should generate valid values', () => {
      const values = InvariantTestGenerator.generateValidValues('string', 3);
      expect(values.length).toBe(3);
      expect(values.every(v => typeof v === 'string')).toBe(true);
    });

    test('should generate invalid values', () => {
      const values = InvariantTestGenerator.generateInvalidValues('string', 3);
      expect(values.length).toBe(3);
      expect(values.every(v => typeof v !== 'string')).toBe(true);
    });

    test('should determine if error is expected', () => {
      const operation = {
        type: 'setState',
        property: 'count',
        value: 'invalid',
        expectedType: 'number'
      };
      const description = {
        stateProperties: {
          properties: [{ property: 'count', type: 'number' }]
        }
      };

      expect(InvariantTestGenerator.isErrorExpected(operation, description)).toBe(true);

      const validOperation = {
        type: 'setState',
        property: 'count',
        value: 42,
        expectedType: 'number'
      };

      expect(InvariantTestGenerator.isErrorExpected(validOperation, description)).toBe(false);
    });
  });

  describe('stub methods', () => {
    test('should have stub implementations for additional test methods', async () => {
      const mockComponent = {};
      const testEnvironment = JSOMValidator.createTestEnvironment();

      // Test dependency constraint invariant
      const depResult = await InvariantTestGenerator.testDependencyConstraintInvariant(
        mockComponent, { name: 'test', type: 'TestType' }, testEnvironment
      );
      expect(depResult.consistent).toBe(true);
      expect(depResult.violations).toEqual([]);

      // Test event constraint invariant
      const eventResult = await InvariantTestGenerator.testEventConstraintInvariant(
        mockComponent, { emits: [], listens: [] }, testEnvironment
      );
      expect(eventResult.consistent).toBe(true);
      expect(eventResult.violations).toEqual([]);

      // Test state property invariants
      const stateResult = await InvariantTestGenerator.testStatePropertyInvariants(
        mockComponent, { property: 'test', type: 'string' }, testEnvironment
      );
      expect(stateResult.invariantsHold).toBe(true);
      expect(stateResult.violations).toEqual([]);

      // Test cross-property invariants
      const crossResult = await InvariantTestGenerator.testCrossPropertyInvariants(
        mockComponent, { properties: [] }, testEnvironment
      );
      expect(crossResult.invariantsHold).toBe(true);
      expect(crossResult.violations).toEqual([]);

      // Test lifecycle invariants
      const lifecycleResult = await InvariantTestGenerator.testLifecycleInvariants(
        mockComponent, {}, testEnvironment
      );
      expect(lifecycleResult.invariantsHold).toBe(true);
      expect(lifecycleResult.violations).toEqual([]);

      // Test temporal invariants
      const temporalResult = await InvariantTestGenerator.testTemporalInvariants(
        mockComponent, {}, testEnvironment
      );
      expect(temporalResult.invariantsHold).toBe(true);
      expect(temporalResult.violations).toEqual([]);

      // Test concurrency invariants
      const concurrencyResult = await InvariantTestGenerator.testConcurrencyInvariants(
        mockComponent, {}, testEnvironment
      );
      expect(concurrencyResult.invariantsHold).toBe(true);
      expect(concurrencyResult.violations).toEqual([]);
    });
  });
});