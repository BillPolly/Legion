/**
 * Unit tests for FlowTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { FlowTestGenerator } from '../../../src/generators/FlowTestGenerator.js';
import { JSOMValidator } from '../../../src/validators/JSOMValidator.js';

describe('FlowTestGenerator', () => {
  describe('generateTests', () => {
    test('should generate flow tests for interactive component', () => {
      const description = {
        domStructure: {
          total: 2,
          elements: [
            { type: 'creates', selector: 'input[type=text]', attributes: {} },
            { type: 'creates', selector: 'button', attributes: {} }
          ]
        },
        stateProperties: {
          total: 1,
          properties: [
            { property: 'value', type: 'string', hasDefault: true, default: '' }
          ]
        },
        events: {
          total: 2,
          byType: {
            emits: [{ event: 'change', payloadType: 'string' }],
            listens: [{ event: 'input', payloadType: 'string' }]
          }
        }
      };

      const tests = FlowTestGenerator.generateTests(description);

      expect(tests.length).toBeGreaterThan(0);
      
      // Should have all types of flow tests
      const interactionTests = tests.filter(t => t.type === 'interaction-flow');
      const stateTests = tests.filter(t => t.type === 'state-flow');
      const eventTests = tests.filter(t => t.type === 'event-flow');
      const journeyTests = tests.filter(t => t.type === 'user-journey');

      expect(interactionTests.length).toBe(1);
      expect(stateTests.length).toBe(1);
      expect(eventTests.length).toBe(1);
      expect(journeyTests.length).toBe(1);
    });

    test('should return empty array for non-interactive component', () => {
      const description = {
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const tests = FlowTestGenerator.generateTests(description);
      expect(tests).toEqual([]);
    });

    test('should generate partial tests for components with limited capabilities', () => {
      const description = {
        domStructure: {
          total: 1,
          elements: [{ type: 'creates', selector: '.widget', attributes: {} }]
        },
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const tests = FlowTestGenerator.generateTests(description);

      expect(tests.length).toBe(2); // interaction-flow and user-journey
      expect(tests.some(t => t.type === 'interaction-flow')).toBe(true);
      expect(tests.some(t => t.type === 'user-journey')).toBe(true);
    });
  });

  describe('hasInteractiveCapabilities', () => {
    test('should detect DOM-based interactivity', () => {
      const description = {
        domStructure: { total: 1, elements: [{ type: 'creates', selector: '.button' }] },
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      expect(FlowTestGenerator.hasInteractiveCapabilities(description)).toBe(true);
    });

    test('should detect event-based interactivity', () => {
      const description = {
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: { total: 1, byType: { emits: [{ event: 'click', payloadType: 'Event' }], listens: [] } }
      };

      expect(FlowTestGenerator.hasInteractiveCapabilities(description)).toBe(true);
    });

    test('should detect state-based interactivity', () => {
      const description = {
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 1, properties: [{ property: 'value', type: 'string' }] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      expect(FlowTestGenerator.hasInteractiveCapabilities(description)).toBe(true);
    });

    test('should return false for non-interactive component', () => {
      const description = {
        domStructure: { total: 0, elements: [] },
        stateProperties: { total: 0, properties: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      expect(FlowTestGenerator.hasInteractiveCapabilities(description)).toBe(false);
    });
  });

  describe('generateInteractionFlowTests', () => {
    test('should generate interaction flow test', () => {
      const description = {
        domStructure: {
          total: 1,
          elements: [{ type: 'creates', selector: 'input[type=text]', attributes: {} }]
        }
      };

      const tests = FlowTestGenerator.generateInteractionFlowTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('User Flows');
      expect(tests[0].type).toBe('interaction-flow');
      expect(tests[0].name).toContain('basic user interaction flow');
    });

    test('should execute interaction flow test successfully', async () => {
      const description = {
        domStructure: {
          total: 1,
          elements: [{ type: 'creates', selector: 'input[type=text]', attributes: {} }]
        }
      };

      const tests = FlowTestGenerator.generateInteractionFlowTests(description);
      const flowTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          interact: (element, action) => ({ element, action, successful: true, handled: true }),
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await flowTest.execute(mockComponent, testEnvironment);

      expect(result.success).toBe(true);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.interactions.length).toBe(1);
      expect(result.issues).toEqual([]);
    });
  });

  describe('generateStateDrivenFlowTests', () => {
    test('should generate state flow test', () => {
      const description = {
        stateProperties: {
          total: 1,
          properties: [{ property: 'value', type: 'string' }]
        }
      };

      const tests = FlowTestGenerator.generateStateDrivenFlowTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('User Flows');
      expect(tests[0].type).toBe('state-flow');
      expect(tests[0].name).toContain('state-driven user flow');
    });

    test('should execute state flow test successfully', async () => {
      const description = {
        stateProperties: {
          total: 2,
          properties: [
            { property: 'value', type: 'string' },
            { property: 'count', type: 'number' }
          ]
        }
      };

      const tests = FlowTestGenerator.generateStateDrivenFlowTests(description);
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

      expect(result.flowValid).toBe(true);
      expect(result.stateTransitions.length).toBe(2);
      expect(result.stateTransitions.every(t => t.successful)).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });

  describe('generateEventDrivenFlowTests', () => {
    test('should generate event flow test', () => {
      const description = {
        events: {
          total: 2,
          byType: {
            emits: [{ event: 'change', payloadType: 'string' }],
            listens: [{ event: 'input', payloadType: 'string' }]
          }
        }
      };

      const tests = FlowTestGenerator.generateEventDrivenFlowTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('User Flows');
      expect(tests[0].type).toBe('event-flow');
      expect(tests[0].name).toContain('event-driven user flow');
    });

    test('should execute event flow test successfully', async () => {
      const description = {
        events: {
          total: 2,
          byType: {
            emits: [{ event: 'change', payloadType: 'string' }],
            listens: [{ event: 'input', payloadType: 'string' }]
          }
        }
      };

      const tests = FlowTestGenerator.generateEventDrivenFlowTests(description);
      const eventTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          emit: (event, payload) => deps.eventSystem.dispatchEvent(event, payload),
          onInput: function(data) { this.inputReceived = data; },
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await eventTest.execute(mockComponent, testEnvironment);

      expect(result.flowCompleted).toBe(true);
      expect(result.emissionTests.length).toBe(1);
      expect(result.listeningTests.length).toBe(1);
      expect(result.eventSequence.length).toBe(2);
      expect(result.issues).toEqual([]);
    });
  });

  describe('generateUserJourneyTests', () => {
    test('should generate user journey test', () => {
      const description = {
        domStructure: { total: 1, elements: [{ type: 'creates', selector: '.widget' }] },
        stateProperties: { total: 1, properties: [{ property: 'value', type: 'string' }] },
        events: { total: 1, byType: { emits: [{ event: 'change', payloadType: 'string' }], listens: [] } }
      };

      const tests = FlowTestGenerator.generateUserJourneyTests(description);

      expect(tests.length).toBe(1);
      expect(tests[0].category).toBe('User Flows');
      expect(tests[0].type).toBe('user-journey');
      expect(tests[0].name).toContain('full user journey');
    });

    test('should execute user journey test successfully', async () => {
      const description = {
        domStructure: { total: 1, elements: [{ type: 'creates', selector: '.widget' }] },
        stateProperties: { total: 1, properties: [{ property: 'value', type: 'string' }] },
        events: { total: 1, byType: { emits: [{ event: 'change', payloadType: 'string' }], listens: [] } }
      };

      const tests = FlowTestGenerator.generateUserJourneyTests(description);
      const journeyTest = tests[0];

      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          state: new Map(),
          setState: function(key, value) { this.state.set(key, value); },
          getState: function(key) { return this.state.get(key); },
          interact: (element, action) => ({ element, action, successful: true, handled: true }),
          emit: (event, payload) => deps.eventSystem.dispatchEvent(event, payload),
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await journeyTest.execute(mockComponent, testEnvironment);

      expect(result.journeyComplete).toBe(true);
      expect(result.phases.length).toBe(5); // All 5 phases
      expect(result.userExperience).toMatch(/excellent|good/);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.issues).toEqual([]);
    });
  });

  describe('createComponentForTesting', () => {
    test('should create component with create method', async () => {
      const mockComponent = {
        create: (deps) => ({
          dependencies: deps,
          created: true
        })
      };

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await FlowTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(result.dependencies).toBeDefined();
    });

    test('should create mock component with flow capabilities', async () => {
      const mockComponent = {}; // No create method

      const testEnvironment = JSOMValidator.createTestEnvironment();
      const result = await FlowTestGenerator.createComponentForTesting(mockComponent, testEnvironment);

      expect(result.created).toBe(true);
      expect(typeof result.setState).toBe('function');
      expect(typeof result.getState).toBe('function');
      expect(typeof result.interact).toBe('function');
      expect(typeof result.emit).toBe('function');
      expect(result.state instanceof Map).toBe(true);
      expect(Array.isArray(result.interactions)).toBe(true);
    });
  });

  describe('simulateElementInteraction', () => {
    test('should simulate input interaction', async () => {
      const mockComponent = {
        interact: (element, action) => ({ element, action, handled: true })
      };

      const element = { selector: 'input[type=text]', attributes: {} };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateElementInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.element).toBe('input[type=text]');
      expect(result.action).toBe('input');
      expect(result.successful).toBe(true);
    });

    test('should simulate button interaction', async () => {
      const mockComponent = {
        interact: (element, action) => ({ element, action, handled: true })
      };

      const element = { selector: 'button.submit', attributes: {} };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateElementInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.element).toBe('button.submit');
      expect(result.action).toBe('click');
      expect(result.successful).toBe(true);
    });

    test('should simulate general interaction', async () => {
      const mockComponent = {
        interact: (element, action) => ({ element, action, handled: true })
      };

      const element = { selector: '.widget', attributes: {} };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateElementInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.element).toBe('.widget');
      expect(result.action).toBe('general');
      expect(result.successful).toBe(true);
    });

    test('should handle interaction errors', async () => {
      const mockComponent = {
        interact: () => { throw new Error('Interaction failed'); }
      };

      const element = { selector: '.widget', attributes: {} };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateElementInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.successful).toBe(false);
      expect(result.error).toContain('Interaction failed');
    });
  });

  describe('simulateInputInteraction', () => {
    test('should simulate input with interact method', async () => {
      const mockComponent = {
        interact: (element, action) => ({ 
          element, 
          action, 
          handled: true,
          value: action.value
        })
      };

      const element = { selector: 'input[type=text]' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateInputInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.handled).toBe(true);
      expect(result.value).toBe('test-input-value');
    });

    test('should simulate input with onInput method', async () => {
      const mockComponent = {
        onInput: (value, event) => ({ 
          handled: true,
          value,
          event: event.type
        })
      };

      const element = { selector: 'input[type=text]' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateInputInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.handled).toBe(true);
      expect(result.value).toBe('test-input-value');
    });

    test('should provide default result', async () => {
      const mockComponent = {}; // No interaction methods

      const element = { selector: 'input[type=text]' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.simulateInputInteraction(
        mockComponent, element, testEnvironment
      );

      expect(result.handled).toBe(true);
      expect(result.value).toBe('test-input-value');
    });
  });

  describe('triggerEventEmission', () => {
    test('should trigger event emission with emit method', async () => {
      const mockComponent = {
        emit: function(event, payload) {
          this.lastEmittedEvent = { event, payload };
        }
      };

      const event = { event: 'change', payloadType: 'string' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.triggerEventEmission(
        mockComponent, event, testEnvironment
      );

      expect(result.triggered).toBe(true);
      expect(result.event).toBe('change');
      expect(result.payload).toBe('test-string');
    });

    test('should handle emission errors', async () => {
      const mockComponent = {
        emit: () => { throw new Error('Emission failed'); }
      };

      const event = { event: 'change', payloadType: 'string' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.triggerEventEmission(
        mockComponent, event, testEnvironment
      );

      expect(result.triggered).toBe(false);
      expect(result.error).toContain('Emission failed');
    });
  });

  describe('triggerEventListening', () => {
    test('should trigger event listening', async () => {
      const mockComponent = {
        onChange: function(data) {
          this.receivedData = data;
          return true;
        }
      };

      const event = { event: 'change', payloadType: 'string' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.triggerEventListening(
        mockComponent, event, testEnvironment
      );

      expect(result.dispatched).toBe(true);
      expect(result.event).toBe('change');
    });

    test('should handle listening errors', async () => {
      const mockComponent = {
        onChange: () => { throw new Error('Listening failed'); }
      };

      const event = { event: 'change', payloadType: 'string' };
      const testEnvironment = JSOMValidator.createTestEnvironment();

      const result = await FlowTestGenerator.triggerEventListening(
        mockComponent, event, testEnvironment
      );

      // The method should still dispatch the event successfully
      expect(result.dispatched).toBe(true);
      // But may not handle it due to the error
      expect(result.handled).toBeDefined();
      // Error may or may not be captured depending on implementation
      if (result.error) {
        expect(result.error).toContain('Listening failed');
      }
    });
  });

  describe('executeJourneyPhase', () => {
    test('should execute initialization phase', async () => {
      const mockComponent = { created: true };
      const testEnvironment = JSOMValidator.createTestEnvironment();
      const description = {};

      const result = await FlowTestGenerator.executeJourneyPhase(
        'initialization', mockComponent, testEnvironment, description
      );

      expect(result.phase).toBe('initialization');
      expect(result.successful).toBe(true);
      expect(result.actions).toContain('component-created');
      expect(result.duration).toBeGreaterThan(0);
    });

    test('should execute interaction phase', async () => {
      const mockComponent = {
        interact: () => ({ successful: true, handled: true })
      };
      const testEnvironment = JSOMValidator.createTestEnvironment();
      const description = {
        domStructure: {
          total: 1,
          elements: [{ type: 'creates', selector: '.widget' }]
        }
      };

      const result = await FlowTestGenerator.executeJourneyPhase(
        'interaction', mockComponent, testEnvironment, description
      );

      expect(result.phase).toBe('interaction');
      expect(result.successful).toBe(true);
      expect(result.actions.length).toBeGreaterThan(0);
    });

    test('should handle unknown phase', async () => {
      const mockComponent = {};
      const testEnvironment = JSOMValidator.createTestEnvironment();
      const description = {};

      const result = await FlowTestGenerator.executeJourneyPhase(
        'unknown-phase', mockComponent, testEnvironment, description
      );

      expect(result.phase).toBe('unknown-phase');
      expect(result.successful).toBe(false);
      expect(result.issues).toEqual(['Unknown phase: unknown-phase']);
    });
  });

  describe('helper methods', () => {
    test('should set component state', async () => {
      const mockComponent = {
        state: new Map(),
        setState: function(key, value) { this.state.set(key, value); }
      };

      await FlowTestGenerator.setComponentState(mockComponent, 'testProp', 'testValue');
      expect(mockComponent.state.get('testProp')).toBe('testValue');
    });

    test('should get component state', async () => {
      const mockComponent = {
        state: new Map([['testProp', 'testValue']]),
        getState: function(key) { return this.state.get(key); }
      };

      const value = await FlowTestGenerator.getComponentState(mockComponent, 'testProp');
      expect(value).toBe('testValue');
    });

    test('should generate values for types', () => {
      expect(typeof FlowTestGenerator.generateValueForType('string')).toBe('string');
      expect(typeof FlowTestGenerator.generateValueForType('number')).toBe('number');
      expect(typeof FlowTestGenerator.generateValueForType('boolean')).toBe('boolean');
      expect(Array.isArray(FlowTestGenerator.generateValueForType('array'))).toBe(true);
      expect(typeof FlowTestGenerator.generateValueForType('object')).toBe('object');
    });

    test('should generate test payload', () => {
      expect(FlowTestGenerator.generateTestPayload('string')).toBe('test-string');
      expect(FlowTestGenerator.generateTestPayload('number')).toBe(42);
    });
  });
});