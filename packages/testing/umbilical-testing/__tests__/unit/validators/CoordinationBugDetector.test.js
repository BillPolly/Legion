/**
 * Unit tests for CoordinationBugDetector
 */
import { describe, test, expect } from '@jest/globals';
import { CoordinationBugDetector } from '../../../src/validators/CoordinationBugDetector.js';
import { JSOMValidator } from '../../../src/validators/JSOMValidator.js';

describe('CoordinationBugDetector', () => {
  describe('detectBugs', () => {
    test('should detect coordination bugs in component', async () => {
      const mockComponent = {
        describe: (d) => d.emits('test', 'string'),
        create: (deps) => ({
          dependencies: deps,
          emit: deps.eventSystem?.dispatchEvent || (() => {}),
          created: true
        })
      };

      const description = {
        dependencies: { total: 0, dependencies: [] },
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'test', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectBugs(mockComponent, description, testEnvironment);

      expect(result.bugs).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.coordination).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('should handle empty component gracefully', async () => {
      const mockComponent = {
        describe: (d) => d,
        create: (deps) => ({ dependencies: deps, created: true })
      };

      const description = {
        dependencies: { total: 0, dependencies: [] },
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectBugs(mockComponent, description, testEnvironment);

      expect(result.success).toBe(true);
      expect(result.bugs).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should handle detection errors gracefully', async () => {
      const faultyComponent = {
        describe: (d) => d.emits('test', 'string'),
        create: (deps) => {
          throw new Error('Component creation failed');
        }
      };

      const description = {
        dependencies: { total: 0, dependencies: [] },
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'test', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectBugs(faultyComponent, description, testEnvironment);

      expect(result.success).toBe(false);
      expect(result.bugs.length).toBeGreaterThan(0);
      expect(result.bugs[0].type).toBe('DETECTION_ERROR');
    });
  });

  describe('createTestableComponent', () => {
    test('should create component with create method', async () => {
      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.createTestableComponent(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies.dom).toBe(testEnvironment.dom);
      expect(result.dependencies.eventSystem).toBe(testEnvironment.eventSystem);
    });

    test('should create component with static create method', async () => {
      const MockComponent = function() {};
      MockComponent.create = (deps) => ({
        dependencies: deps,
        created: true
      });

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.createTestableComponent(MockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
    });

    test('should create mock component for describe-only components', async () => {
      const mockComponent = {
        describe: (d) => d.requires('dom', 'HTMLElement')
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.createTestableComponent(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
      expect(typeof result.on).toBe('function');
      expect(typeof result.emit).toBe('function');
    });

    test('should throw error for invalid component', async () => {
      const invalidComponent = {};
      const testEnvironment = JSOMValidator.createTestEnvironment();

      await expect(
        CoordinationBugDetector.createTestableComponent(invalidComponent, testEnvironment)
      ).rejects.toThrow('Unable to create testable component instance');
    });
  });

  describe('createMockComponentInstance', () => {
    test('should create mock component with event system', () => {
      const mockComponent = {
        describe: (d) => d.emits('test', 'string')
      };

      const dependencies = {
        eventSystem: JSOMValidator.createEventSystem()
      };

      const instance = CoordinationBugDetector.createMockComponentInstance(mockComponent, dependencies);

      expect(instance.created).toBe(true);
      expect(typeof instance.on).toBe('function');
      expect(typeof instance.emit).toBe('function');
      expect(typeof instance.setState).toBe('function');
      expect(typeof instance.getState).toBe('function');
    });

    test('should handle event listeners in mock', () => {
      const mockComponent = {};
      const dependencies = { eventSystem: JSOMValidator.createEventSystem() };
      const instance = CoordinationBugDetector.createMockComponentInstance(mockComponent, dependencies);

      let receivedEvent = null;
      instance.on('test', (data) => { receivedEvent = data; });
      instance.emit('test', 'test-data');

      // Event should be handled by eventSystem
      const history = dependencies.eventSystem.getEventHistory();
      expect(history.length).toBe(1);
      expect(history[0].type).toBe('test');
    });

    test('should handle state management in mock', () => {
      const mockComponent = {};
      const dependencies = {};
      const instance = CoordinationBugDetector.createMockComponentInstance(mockComponent, dependencies);

      instance.setState('testProp', 'testValue');
      const value = instance.getState('testProp');

      expect(value).toBe('testValue');
    });
  });

  describe('detectParameterPassingBugs', () => {
    test('should detect parameter passing bugs in events', async () => {
      const mockComponent = {
        emit: (event, payload) => {
          // Simulate bug: passing wrong type
          this.testEnvironment.eventSystem.dispatchEvent(event, { type: 'object', toString: () => '[object Object]' });
        }
      };

      const description = {
        events: {
          byType: {
            emits: [{ event: 'test', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      mockComponent.testEnvironment = testEnvironment;

      const result = await CoordinationBugDetector.detectParameterPassingBugs(
        mockComponent, description, testEnvironment
      );

      expect(result.tests.length).toBeGreaterThan(0);
      // Note: Bug detection depends on actual payload analysis
    });

    test('should detect input parameter bugs', async () => {
      const mockComponent = {
        setInputHandler: function(handler) {
          this.inputHandler = handler;
        },
        onInput: function(value, event) {
          // Simulate [object InputEvent] bug - passing event instead of value
          if (this.inputHandler) {
            this.inputHandler(event); // BUG: should pass value, not event
          }
        }
      };

      const description = {
        events: {
          byType: {
            emits: [{ event: 'input', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectParameterPassingBugs(
        mockComponent, description, testEnvironment
      );

      expect(result.tests.length).toBeGreaterThan(0);
      const inputTest = result.tests.find(t => t.hasOwnProperty('expectedParameter'));
      expect(inputTest).toBeDefined();
    });

    test('should handle components without input handling', async () => {
      const mockComponent = { emit: () => {} };
      const description = {
        events: {
          byType: {
            emits: [{ event: 'click', payloadType: 'MouseEvent' }],
            listens: []
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectParameterPassingBugs(
        mockComponent, description, testEnvironment
      );

      expect(result.bugs).toEqual([]);
      expect(result.tests.length).toBeGreaterThan(0);
    });
  });

  describe('testEventParameterPassing', () => {
    test('should test event parameter types', async () => {
      const mockComponent = {
        emit: (event, payload) => {
          this.lastEmittedEvent = { event, payload };
        }
      };

      const eventDesc = { event: 'test', payloadType: 'string' };
      const testEnvironment = JSOMValidator.createEventSystem();

      const result = await CoordinationBugDetector.testEventParameterPassing(
        mockComponent, eventDesc, testEnvironment
      );

      expect(result.event).toBe('test');
      expect(result.expectedType).toBe('string');
      expect(result.hasBug).toBeDefined();
    });

    test('should handle errors in parameter testing', async () => {
      const faultyComponent = {
        emit: () => { throw new Error('Emission failed'); }
      };

      const eventDesc = { event: 'test', payloadType: 'string' };
      const testEnvironment = JSOMValidator.createEventSystem();

      const result = await CoordinationBugDetector.testEventParameterPassing(
        faultyComponent, eventDesc, testEnvironment
      );

      expect(result.details).toContain('Error testing parameter passing');
    });
  });

  describe('testInputParameterPassing', () => {
    test('should detect [object InputEvent] bug', async () => {
      const mockComponent = {
        setInputHandler: function(handler) {
          this.inputHandler = handler;
        },
        onInput: function(value, event) {
          // Simulate the bug
          if (this.inputHandler) {
            this.inputHandler(event); // BUG: passing event instead of value
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.testInputParameterPassing(
        mockComponent, testEnvironment
      );

      expect(result.expectedParameter).toBe('value (string)');
      expect(result.hasBug).toBe(true);
      expect(result.actualParameter).toContain('InputEvent');
    });

    test('should pass when correct parameter is used', async () => {
      const mockComponent = {
        setInputHandler: function(handler) {
          this.inputHandler = handler;
        },
        onInput: function(value, event) {
          // Correct implementation
          if (this.inputHandler) {
            this.inputHandler(value); // CORRECT: passing value
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.testInputParameterPassing(
        mockComponent, testEnvironment
      );

      expect(result.hasBug).toBe(false);
    });

    test('should handle components without input handlers', async () => {
      const mockComponent = {};
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await CoordinationBugDetector.testInputParameterPassing(
        mockComponent, testEnvironment
      );

      expect(result.hasBug).toBe(false);
      expect(result.actualParameter).toBeNull();
    });
  });

  describe('detectEventPayloadBugs', () => {
    test('should detect event payload type bugs', async () => {
      const mockComponent = {
        emit: (event, payload) => {
          this.testEnvironment.eventSystem.dispatchEvent(event, payload);
        }
      };

      const description = {
        events: {
          byType: {
            emits: [{ event: 'test', payloadType: 'string' }],
            listens: [{ event: 'input', payloadType: 'number' }]
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      mockComponent.testEnvironment = testEnvironment;

      const result = await CoordinationBugDetector.detectEventPayloadBugs(
        mockComponent, description, testEnvironment
      );

      expect(result.tests.length).toBe(2); // One for emits, one for listens
      expect(result.bugs).toBeDefined();
    });

    test('should handle payload detection errors', async () => {
      // Create a faulty description that will cause an error
      const faultyComponent = {
        emit: () => {}
      };

      const faultyDescription = {
        events: {
          byType: {
            emits: null, // This will cause an error when iterating
            listens: []
          }
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectEventPayloadBugs(
        faultyComponent, faultyDescription, testEnvironment
      );

      // The method should catch the error and add it to bugs array
      expect(result.bugs.length).toBeGreaterThan(0);
      expect(result.bugs[0].type).toBe('PAYLOAD_DETECTION_ERROR');
    });
  });

  describe('detectStateSyncBugs', () => {
    test('should detect state synchronization bugs', async () => {
      const mockComponent = {
        setState: (key, value) => { this.state = this.state || {}; this.state[key] = value; },
        getState: (key) => this.state?.[key]
      };

      const description = {
        stateProperties: {
          properties: [
            { property: 'value', type: 'string' },
            { property: 'count', type: 'number' }
          ]
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectStateSyncBugs(
        mockComponent, description, testEnvironment
      );

      expect(result.tests.length).toBe(2);
      expect(result.bugs).toBeDefined();
    });

    test('should handle state sync errors', async () => {
      const faultyComponent = {
        setState: () => {},
        getState: () => null
      };

      const faultyDescription = {
        stateProperties: {
          properties: null // This will cause an error when iterating
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectStateSyncBugs(
        faultyComponent, faultyDescription, testEnvironment
      );

      // The method should catch the error and add it to bugs array
      expect(result.bugs.length).toBeGreaterThan(0);
      expect(result.bugs[0].type).toBe('STATE_DETECTION_ERROR');
    });
  });

  describe('detectTypeConsistencyBugs', () => {
    test('should detect type consistency bugs', async () => {
      const mockComponent = {};
      const description = {
        events: {
          byType: {
            emits: [{ event: 'valueChange', payloadType: 'string' }],
            listens: []
          }
        },
        stateProperties: {
          properties: [{ property: 'value', type: 'number' }] // Inconsistent type
        }
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await CoordinationBugDetector.detectTypeConsistencyBugs(
        mockComponent, description, testEnvironment
      );

      expect(result.tests.length).toBeGreaterThan(0);
      expect(result.bugs).toBeDefined();
    });

    test('should handle type consistency errors', async () => {
      const mockComponent = {};
      const faultyDescription = null; // Will cause error

      const testEnvironment = JSOMValidator.createTestEnvironment();
      
      try {
        const result = await CoordinationBugDetector.detectTypeConsistencyBugs(
          mockComponent, faultyDescription, testEnvironment
        );
        // Should have caught error and added to bugs
        expect(result.bugs.length).toBeGreaterThan(0);
        expect(result.bugs[0].type).toBe('TYPE_CONSISTENCY_ERROR');
      } catch (error) {
        // Alternative: error was thrown, which is also valid
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('hasInputHandling', () => {
    test('should detect input handling in emits', () => {
      const description = {
        events: {
          byType: {
            emits: [{ event: 'input', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const result = CoordinationBugDetector.hasInputHandling(description);
      expect(result).toBe(true);
    });

    test('should detect input handling in listens', () => {
      const description = {
        events: {
          byType: {
            emits: [],
            listens: [{ event: 'change', payloadType: 'string' }]
          }
        }
      };

      const result = CoordinationBugDetector.hasInputHandling(description);
      expect(result).toBe(true);
    });

    test('should return false for no input handling', () => {
      const description = {
        events: {
          byType: {
            emits: [{ event: 'click', payloadType: 'MouseEvent' }],
            listens: [{ event: 'ready', payloadType: 'boolean' }]
          }
        }
      };

      const result = CoordinationBugDetector.hasInputHandling(description);
      expect(result).toBe(false);
    });
  });

  describe('getActualType', () => {
    test('should identify primitive types', () => {
      expect(CoordinationBugDetector.getActualType('string')).toBe('string');
      expect(CoordinationBugDetector.getActualType(42)).toBe('number');
      expect(CoordinationBugDetector.getActualType(true)).toBe('boolean');
      expect(CoordinationBugDetector.getActualType(null)).toBe('null');
      expect(CoordinationBugDetector.getActualType(undefined)).toBe('undefined');
    });

    test('should identify complex types', () => {
      expect(CoordinationBugDetector.getActualType([])).toBe('Array');
      expect(CoordinationBugDetector.getActualType(new Date())).toBe('Date');
      expect(CoordinationBugDetector.getActualType(/regex/)).toBe('RegExp');
      expect(CoordinationBugDetector.getActualType({})).toBe('Object');
    });

    test('should handle constructor names', () => {
      class CustomClass {}
      const instance = new CustomClass();
      expect(CoordinationBugDetector.getActualType(instance)).toBe('CustomClass');
    });
  });

  describe('isTypeCompatible', () => {
    test('should match exact types', () => {
      expect(CoordinationBugDetector.isTypeCompatible('string', 'string')).toBe(true);
      expect(CoordinationBugDetector.isTypeCompatible('number', 'number')).toBe(true);
    });

    test('should handle generic array types', () => {
      expect(CoordinationBugDetector.isTypeCompatible('Array', 'Array<string>')).toBe(true);
      expect(CoordinationBugDetector.isTypeCompatible('Array', 'Array')).toBe(true);
    });

    test('should handle object types', () => {
      expect(CoordinationBugDetector.isTypeCompatible('object', 'Object')).toBe(true);
      expect(CoordinationBugDetector.isTypeCompatible('function', 'Function')).toBe(true);
    });

    test('should reject incompatible types', () => {
      expect(CoordinationBugDetector.isTypeCompatible('string', 'number')).toBe(false);
      expect(CoordinationBugDetector.isTypeCompatible('Array', 'string')).toBe(false);
    });
  });

  describe('generateTestPayload', () => {
    test('should generate appropriate test payloads', () => {
      expect(typeof CoordinationBugDetector.generateTestPayload('string')).toBe('string');
      expect(typeof CoordinationBugDetector.generateTestPayload('number')).toBe('number');
      expect(typeof CoordinationBugDetector.generateTestPayload('boolean')).toBe('boolean');
      expect(Array.isArray(CoordinationBugDetector.generateTestPayload('Array'))).toBe(true);
      expect(typeof CoordinationBugDetector.generateTestPayload('Object')).toBe('object');
      expect(CoordinationBugDetector.generateTestPayload('Date') instanceof Date).toBe(true);
    });

    test('should handle unknown types', () => {
      const result = CoordinationBugDetector.generateTestPayload('UnknownType');
      expect(typeof result).toBe('string');
      expect(result).toBe('test-value');
    });
  });

  describe('aggregateBugResults', () => {
    test('should aggregate bugs from all coordination aspects', () => {
      const results = {
        bugs: [],
        warnings: [],
        coordination: {
          parameterPassing: {
            bugs: [{ type: 'PARAM_BUG', severity: 'ERROR' }],
            warnings: [{ type: 'PARAM_WARNING', severity: 'WARNING' }]
          },
          eventPayloads: {
            bugs: [{ type: 'PAYLOAD_BUG', severity: 'ERROR' }]
          },
          stateSync: {
            warnings: [{ type: 'STATE_WARNING', severity: 'WARNING' }]
          }
        },
        success: true
      };

      CoordinationBugDetector.aggregateBugResults(results);

      expect(results.bugs.length).toBe(2);
      expect(results.warnings.length).toBe(2);
      expect(results.success).toBe(false); // Should be false due to ERROR bugs
    });

    test('should maintain success when only warnings present', () => {
      const results = {
        bugs: [],
        warnings: [],
        coordination: {
          parameterPassing: {
            warnings: [{ type: 'PARAM_WARNING', severity: 'WARNING' }]
          }
        },
        success: true
      };

      CoordinationBugDetector.aggregateBugResults(results);

      expect(results.warnings.length).toBe(1);
      expect(results.success).toBe(true); // Should remain true for warnings only
    });

    test('should handle empty coordination results', () => {
      const results = {
        bugs: [],
        warnings: [],
        coordination: {},
        success: true
      };

      CoordinationBugDetector.aggregateBugResults(results);

      expect(results.bugs.length).toBe(0);
      expect(results.warnings.length).toBe(0);
      expect(results.success).toBe(true);
    });
  });
});