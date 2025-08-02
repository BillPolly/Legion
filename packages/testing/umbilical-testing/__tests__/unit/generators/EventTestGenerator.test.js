/**
 * Unit tests for EventTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { EventTestGenerator } from '../../../src/generators/EventTestGenerator.js';

describe('EventTestGenerator', () => {
  describe('generateTests', () => {
    test('should return empty array for component with no events', () => {
      const description = {
        events: {
          total: 0,
          byType: { emits: [], listens: [] }
        }
      };

      const tests = EventTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate tests for emitted events', () => {
      const description = {
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'change', payloadType: 'string' }],
            listens: []
          }
        }
      };

      const tests = EventTestGenerator.generateTests(description);
      
      expect(tests.length).toBeGreaterThan(0);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain("should emit 'change' event with string payload");
      expect(testNames).toContain("should emit 'change' with correct payload type");
    });

    test('should generate tests for listened events', () => {
      const description = {
        events: {
          total: 1,
          byType: {
            emits: [],
            listens: [{ event: 'update', payloadType: 'Object' }]
          }
        }
      };

      const tests = EventTestGenerator.generateTests(description);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain("should listen for 'update' event");
      expect(testNames).toContain("should handle 'update' event payload correctly");
    });

    test('should generate integration tests for mixed events', () => {
      const description = {
        events: {
          total: 2,
          byType: {
            emits: [{ event: 'change', payloadType: 'string' }],
            listens: [{ event: 'update', payloadType: 'Object' }]
          }
        }
      };

      const tests = EventTestGenerator.generateTests(description);
      
      const testNames = tests.map(t => t.name);
      expect(testNames).toContain('should maintain event system integrity');
    });
  });

  describe('generateEmissionTests', () => {
    test('should generate emission tests', () => {
      const event = { event: 'test-event', payloadType: 'string' };
      
      const tests = EventTestGenerator.generateEmissionTests(event);
      
      expect(tests).toHaveLength(2);
      expect(tests[0].type).toBe('event-emits');
      expect(tests[1].type).toBe('event-payload-type');
    });
  });

  describe('generateListeningTests', () => {
    test('should generate listening tests', () => {
      const event = { event: 'test-event', payloadType: 'string' };
      
      const tests = EventTestGenerator.generateListeningTests(event);
      
      expect(tests).toHaveLength(2);
      expect(tests[0].type).toBe('event-listens');
      expect(tests[1].type).toBe('event-handler');
    });
  });

  describe('event system utilities', () => {
    describe('createEventCapture', () => {
      test('should create event capture system', () => {
        const capture = EventTestGenerator.createEventCapture();
        
        expect(typeof capture.on).toBe('function');
        expect(typeof capture.emit).toBe('function');
        expect(typeof capture.getEvents).toBe('function');
        expect(typeof capture.clear).toBe('function');
      });

      test('should capture events', () => {
        const capture = EventTestGenerator.createEventCapture();
        
        capture.on('test-event', null);
        capture.emit('test-event', 'test-payload');
        
        const events = capture.getEvents('test-event');
        expect(events).toHaveLength(1);
        expect(events[0].payload).toBe('test-payload');
        expect(events[0].timestamp).toBeDefined();
      });
    });

    describe('createEventEmitter', () => {
      test('should create event emitter', () => {
        const emitter = EventTestGenerator.createEventEmitter();
        
        expect(typeof emitter.on).toBe('function');
        expect(typeof emitter.emit).toBe('function');
        expect(typeof emitter.removeListener).toBe('function');
        expect(typeof emitter.getListeners).toBe('function');
      });

      test('should emit events to listeners', () => {
        const emitter = EventTestGenerator.createEventEmitter();
        let received = null;
        
        emitter.on('test-event', (payload) => { received = payload; });
        emitter.emit('test-event', 'test-payload');
        
        expect(received).toBe('test-payload');
      });
    });
  });

  describe('payload validation', () => {
    describe('createValidPayload', () => {
      test('should create valid payloads for different types', () => {
        expect(typeof EventTestGenerator.createValidPayload('string')).toBe('string');
        expect(typeof EventTestGenerator.createValidPayload('number')).toBe('number');
        expect(typeof EventTestGenerator.createValidPayload('boolean')).toBe('boolean');
        expect(typeof EventTestGenerator.createValidPayload('Object')).toBe('object');
        expect(Array.isArray(EventTestGenerator.createValidPayload('Array'))).toBe(true);
      });
    });

    describe('validatePayloadType', () => {
      test('should validate string payloads', () => {
        expect(EventTestGenerator.validatePayloadType('test', 'string')).toBe(true);
        expect(EventTestGenerator.validatePayloadType(42, 'string')).toBe(false);
      });

      test('should validate number payloads', () => {
        expect(EventTestGenerator.validatePayloadType(42, 'number')).toBe(true);
        expect(EventTestGenerator.validatePayloadType('test', 'number')).toBe(false);
      });

      test('should validate object payloads', () => {
        expect(EventTestGenerator.validatePayloadType({}, 'Object')).toBe(true);
        expect(EventTestGenerator.validatePayloadType([], 'Object')).toBe(false);
        expect(EventTestGenerator.validatePayloadType(null, 'Object')).toBe(false);
      });

      test('should validate array payloads', () => {
        expect(EventTestGenerator.validatePayloadType([], 'Array')).toBe(true);
        expect(EventTestGenerator.validatePayloadType(['test'], 'Array<string>')).toBe(true);
        expect(EventTestGenerator.validatePayloadType({}, 'Array')).toBe(false);
      });
    });

    describe('getPayloadType', () => {
      test('should return correct type strings', () => {
        expect(EventTestGenerator.getPayloadType('test')).toBe('string');
        expect(EventTestGenerator.getPayloadType(42)).toBe('number');
        expect(EventTestGenerator.getPayloadType(true)).toBe('boolean');
        expect(EventTestGenerator.getPayloadType({})).toBe('object');
        expect(EventTestGenerator.getPayloadType([])).toBe('Array');
        expect(EventTestGenerator.getPayloadType(null)).toBe('null');
        expect(EventTestGenerator.getPayloadType(undefined)).toBe('undefined');
      });
    });
  });

  describe('test execution', () => {
    const mockComponent = {
      describe: (d) => d.emits('test-event', 'string'),
      create: (deps) => ({
        dependencies: deps,
        created: true,
        emit: deps.eventSystem?.emit || (() => {}),
        on: deps.eventSystem?.on || (() => {})
      })
    };

    test('should execute emission test', async () => {
      const event = { event: 'test-event', payloadType: 'string' };
      
      const tests = EventTestGenerator.generateEmissionTests(event);
      const emissionTest = tests.find(t => t.type === 'event-emits');
      
      const result = await emissionTest.execute(mockComponent, {});
      
      expect(result.eventName).toBe('test-event');
      expect(result.expectedPayloadType).toBe('string');
      expect(result.eventsEmitted).toBeDefined();
      expect(result.events).toBeDefined();
    });

    test('should execute payload type test', async () => {
      const event = { event: 'test-event', payloadType: 'string' };
      
      const tests = EventTestGenerator.generateEmissionTests(event);
      const typeTest = tests.find(t => t.type === 'event-payload-type');
      
      const result = await typeTest.execute(mockComponent, {});
      
      expect(result.eventName).toBe('test-event');
      expect(result.expectedPayloadType).toBe('string');
      expect(result.scenarios).toBeDefined();
      expect(result.allTypesValid).toBeDefined();
    });

    test('should execute listening test', async () => {
      const event = { event: 'input-event', payloadType: 'string' };
      
      const tests = EventTestGenerator.generateListeningTests(event);
      const listeningTest = tests.find(t => t.type === 'event-listens');
      
      const result = await listeningTest.execute(mockComponent, {});
      
      expect(result.eventName).toBe('input-event');
      expect(result.payloadType).toBe('string');
      expect(result.hasListener).toBeDefined();
      expect(result.respondsToEvent).toBeDefined();
    });

    test('should execute integration test', async () => {
      const events = {
        total: 2,
        byType: {
          emits: [{ event: 'output', payloadType: 'string' }],
          listens: [{ event: 'input', payloadType: 'string' }]
        }
      };
      
      const tests = EventTestGenerator.generateIntegrationTests(events);
      const integrationTest = tests[0];
      
      const result = await integrationTest.execute(mockComponent, {});
      
      expect(result.emittedEvents).toBeDefined();
      expect(result.listenedEvents).toBeDefined();
      expect(result.eventFlows).toBeDefined();
    });
  });
});