/**
 * Unit tests for ComponentIntrospector
 */
import { describe, test, expect } from '@jest/globals';
import { ComponentIntrospector } from '../../../src/core/ComponentIntrospector.js';
import { ComponentDescriptor } from '../../../src/core/ComponentDescriptor.js';

describe('ComponentIntrospector', () => {
  describe('introspect', () => {
    test('should introspect component class with static describe method', () => {
      class TestComponent {
        static describe(descriptor) {
          descriptor
            .requires('dom', 'HTMLElement')
            .creates('.test-component')
            .manages('value', 'string')
            .emits('change', 'string');
        }
      }

      const description = ComponentIntrospector.introspect(TestComponent);
      
      expect(description.dependencies.total).toBe(1);
      expect(description.domStructure.total).toBe(1);
      expect(description.stateProperties.total).toBe(1);
      expect(description.events.total).toBe(1);
    });

    test('should introspect component object with describe method', () => {
      const testComponent = {
        describe: (descriptor) => {
          descriptor
            .requires('actorSpace', 'ActorSpace')
            .creates('input[type=text]')
            .handles('typing', () => true);
        }
      };

      const description = ComponentIntrospector.introspect(testComponent);
      
      expect(description.dependencies.total).toBe(1);
      expect(description.domStructure.total).toBe(1);
      expect(description.userInteractions.total).toBe(1);
    });

    test('should throw error for component without describe method', () => {
      class InvalidComponent {}

      expect(() => {
        ComponentIntrospector.introspect(InvalidComponent);
      }).toThrow('Component must have a static describe method');
    });

    test('should throw error for invalid component description', () => {
      class InvalidComponent {
        static describe(descriptor) {
          descriptor.invariant('bad-invariant', 'not-a-function');
        }
      }

      expect(() => {
        ComponentIntrospector.introspect(InvalidComponent);
      }).toThrow('Invalid component description');
    });
  });

  describe('parseDescription', () => {
    let descriptor;

    beforeEach(() => {
      descriptor = new ComponentDescriptor();
    });

    test('should parse complete component description', () => {
      descriptor
        .requires('dom', 'HTMLElement')
        .optional('config', 'Object', { default: {} })
        .creates('.terminal')
        .creates('input[type=text]')
        .manages('currentCommand', 'string', { default: '' })
        .manages('history', 'Array<string>', { default: [] })
        .emits('command', 'string')
        .listens('output', 'OutputLine')
        .handles('typing', () => true)
        .sendsToActor('command-actor', 'execute', { command: 'string' })
        .receivesFromActor('ui-actor', 'output', { content: 'string' })
        .flow('type-and-execute', [{ type: 'user-input', action: 'type' }])
        .invariant('input-sync', () => true)
        .implements('TerminalContract');

      const parsed = ComponentIntrospector.parseDescription(descriptor);

      expect(parsed.metadata.hasDepedencies).toBe(true);
      expect(parsed.metadata.hasDOMStructure).toBe(true);
      expect(parsed.metadata.hasState).toBe(true);
      expect(parsed.metadata.hasEvents).toBe(true);
      expect(parsed.metadata.hasUserInteractions).toBe(true);
      expect(parsed.metadata.hasActorCommunication).toBe(true);
      expect(parsed.metadata.hasUserFlows).toBe(true);
      expect(parsed.metadata.hasInvariants).toBe(true);
      expect(parsed.metadata.hasContracts).toBe(true);
      expect(parsed.metadata.complexity).toBeGreaterThan(0);
    });
  });

  describe('extractMetadata', () => {
    test('should extract correct metadata', () => {
      const description = {
        dependencies: [{ name: 'dom', type: 'HTMLElement' }],
        domStructure: [{ type: 'creates', selector: '.test' }],
        stateProperties: [{ property: 'value', type: 'string' }],
        events: [{ type: 'emits', event: 'change', payloadType: 'string' }],
        userInteractions: [{ interaction: 'typing', validator: () => true }],
        actorCommunication: [{ type: 'sends', actorId: 'test', messageType: 'msg' }],
        userFlows: [{ name: 'flow1', steps: [{ type: 'input' }, { type: 'verify' }] }],
        invariants: [{ name: 'test', checker: () => true }],
        contracts: [{ type: 'interface', name: 'TestContract' }]
      };

      const metadata = ComponentIntrospector.extractMetadata(description);

      expect(metadata.hasDepedencies).toBe(true);
      expect(metadata.hasDOMStructure).toBe(true);
      expect(metadata.hasState).toBe(true);
      expect(metadata.hasEvents).toBe(true);
      expect(metadata.hasUserInteractions).toBe(true);
      expect(metadata.hasActorCommunication).toBe(true);
      expect(metadata.hasUserFlows).toBe(true);
      expect(metadata.hasInvariants).toBe(true);
      expect(metadata.hasContracts).toBe(true);
      expect(metadata.complexity).toBe(9); // 7 base + 2 flow steps
    });

    test('should handle empty description', () => {
      const description = {
        dependencies: [],
        domStructure: [],
        stateProperties: [],
        events: [],
        userInteractions: [],
        actorCommunication: [],
        userFlows: [],
        invariants: [],
        contracts: []
      };

      const metadata = ComponentIntrospector.extractMetadata(description);

      expect(metadata.hasDepedencies).toBe(false);
      expect(metadata.hasDOMStructure).toBe(false);
      expect(metadata.hasState).toBe(false);
      expect(metadata.hasEvents).toBe(false);
      expect(metadata.hasUserInteractions).toBe(false);
      expect(metadata.hasActorCommunication).toBe(false);
      expect(metadata.hasUserFlows).toBe(false);
      expect(metadata.hasInvariants).toBe(false);
      expect(metadata.hasContracts).toBe(false);
      expect(metadata.complexity).toBe(0);
    });
  });

  describe('analyzeDependencies', () => {
    test('should analyze dependencies correctly', () => {
      const dependencies = [
        { name: 'dom', type: 'HTMLElement', required: true },
        { name: 'config', type: 'Object', required: false, default: {} },
        { name: 'actorSpace', type: 'ActorSpace', required: true }
      ];

      const analysis = ComponentIntrospector.analyzeDependencies(dependencies);

      expect(analysis.total).toBe(3);
      expect(analysis.required).toBe(2);
      expect(analysis.optional).toBe(1);
      expect(analysis.types).toEqual(['HTMLElement', 'Object', 'ActorSpace']);
      expect(analysis.hasDefaults).toBe(1);
      expect(analysis.dependencies).toHaveLength(3);
      expect(analysis.dependencies[0].required).toBe(true);
      expect(analysis.dependencies[1].hasDefault).toBe(true);
    });

    test('should handle empty dependencies', () => {
      const analysis = ComponentIntrospector.analyzeDependencies([]);

      expect(analysis.total).toBe(0);
      expect(analysis.required).toBe(0);
      expect(analysis.optional).toBe(0);
      expect(analysis.types).toEqual([]);
      expect(analysis.hasDefaults).toBe(0);
    });
  });

  describe('analyzeDOMStructure', () => {
    test('should analyze DOM structure correctly', () => {
      const domStructure = [
        { type: 'creates', selector: '.container', attributes: { id: 'main' } },
        { type: 'creates', selector: 'input[type=text]', within: '.container' },
        { type: 'contains', selector: '.output' }
      ];

      const analysis = ComponentIntrospector.analyzeDOMStructure(domStructure);

      expect(analysis.total).toBe(3);
      expect(analysis.creates).toBe(2);
      expect(analysis.contains).toBe(1);
      expect(analysis.selectors).toEqual(['.container', 'input[type=text]', '.output']);
      expect(analysis.hasAttributes).toBe(1);
      expect(analysis.hasHierarchy).toBe(1);
      expect(analysis.elements).toHaveLength(3);
    });

    test('should handle empty DOM structure', () => {
      const analysis = ComponentIntrospector.analyzeDOMStructure([]);

      expect(analysis.total).toBe(0);
      expect(analysis.creates).toBe(0);
      expect(analysis.contains).toBe(0);
      expect(analysis.selectors).toEqual([]);
      expect(analysis.hasAttributes).toBe(0);
      expect(analysis.hasHierarchy).toBe(0);
    });
  });

  describe('analyzeStateProperties', () => {
    test('should analyze state properties correctly', () => {
      const stateProperties = [
        { property: 'value', type: 'string', default: '' },
        { property: 'items', type: 'Array<Item>', constraints: { maxLength: 100 } },
        { property: 'loading', type: 'boolean' }
      ];

      const analysis = ComponentIntrospector.analyzeStateProperties(stateProperties);

      expect(analysis.total).toBe(3);
      expect(analysis.types).toEqual(['string', 'Array<Item>', 'boolean']);
      expect(analysis.hasDefaults).toBe(1);
      expect(analysis.hasConstraints).toBe(1);
      expect(analysis.properties).toHaveLength(3);
      expect(analysis.properties[0].hasDefault).toBe(true);
      expect(analysis.properties[1].hasConstraints).toBe(true);
    });
  });

  describe('analyzeEvents', () => {
    test('should analyze events correctly', () => {
      const events = [
        { type: 'emits', event: 'change', payloadType: 'string' },
        { type: 'emits', event: 'submit', payloadType: 'FormData' },
        { type: 'listens', event: 'update', payloadType: 'Object' }
      ];

      const analysis = ComponentIntrospector.analyzeEvents(events);

      expect(analysis.total).toBe(3);
      expect(analysis.emits).toBe(2);
      expect(analysis.listens).toBe(1);
      expect(analysis.payloadTypes).toEqual(['string', 'FormData', 'Object']);
      expect(analysis.eventNames).toEqual(['change', 'submit', 'update']);
      expect(analysis.byType.emits).toHaveLength(2);
      expect(analysis.byType.listens).toHaveLength(1);
    });
  });

  describe('analyzeUserInteractions', () => {
    test('should analyze user interactions correctly', () => {
      const userInteractions = [
        { interaction: 'typing', validator: (input) => typeof input === 'string' },
        { interaction: 'clicking', validator: null }
      ];

      const analysis = ComponentIntrospector.analyzeUserInteractions(userInteractions);

      expect(analysis.total).toBe(2);
      expect(analysis.interactions).toEqual(['typing', 'clicking']);
      expect(analysis.hasValidators).toBe(1);
      expect(analysis.details[0].hasValidator).toBe(true);
      expect(analysis.details[1].hasValidator).toBe(false);
    });
  });

  describe('analyzeActorCommunication', () => {
    test('should analyze actor communication correctly', () => {
      const actorCommunication = [
        { type: 'sends', actorId: 'command-actor', messageType: 'execute' },
        { type: 'receives', actorId: 'command-actor', messageType: 'response' },
        { type: 'sends', actorId: 'ui-actor', messageType: 'update' }
      ];

      const analysis = ComponentIntrospector.analyzeActorCommunication(actorCommunication);

      expect(analysis.total).toBe(3);
      expect(analysis.sends).toBe(2);
      expect(analysis.receives).toBe(1);
      expect(analysis.actors).toEqual(['command-actor', 'ui-actor']);
      expect(analysis.messageTypes).toEqual(['execute', 'response', 'update']);
      expect(analysis.byType.sends).toHaveLength(2);
      expect(analysis.byType.receives).toHaveLength(1);
    });
  });

  describe('analyzeUserFlows', () => {
    test('should analyze user flows correctly', () => {
      const userFlows = [
        { 
          name: 'typing-flow', 
          steps: [
            { type: 'user-input' }, 
            { type: 'verify' }, 
            { type: 'user-input' }
          ] 
        },
        { 
          name: 'click-flow', 
          steps: [
            { type: 'user-input' }, 
            { type: 'actor-message' }
          ] 
        }
      ];

      const analysis = ComponentIntrospector.analyzeUserFlows(userFlows);

      expect(analysis.total).toBe(2);
      expect(analysis.totalSteps).toBe(5);
      expect(analysis.averageSteps).toBe(3); // Rounded from 2.5
      expect(analysis.stepTypes).toEqual(['user-input', 'verify', 'actor-message']);
      expect(analysis.flows[0].stepCount).toBe(3);
      expect(analysis.flows[1].stepCount).toBe(2);
    });

    test('should handle empty user flows', () => {
      const analysis = ComponentIntrospector.analyzeUserFlows([]);

      expect(analysis.total).toBe(0);
      expect(analysis.totalSteps).toBe(0);
      expect(analysis.averageSteps).toBe(0);
      expect(analysis.stepTypes).toEqual([]);
    });
  });

  describe('analyzeInvariants', () => {
    test('should analyze invariants correctly', () => {
      const invariants = [
        { name: 'valid-state', checker: () => true },
        { name: 'sync-check', checker: () => false },
        { name: 'no-checker' } // Missing checker
      ];

      const analysis = ComponentIntrospector.analyzeInvariants(invariants);

      expect(analysis.total).toBe(3);
      expect(analysis.hasCheckers).toBe(2);
      expect(analysis.names).toEqual(['valid-state', 'sync-check', 'no-checker']);
      expect(analysis.details[0].hasChecker).toBe(true);
      expect(analysis.details[2].hasChecker).toBe(false);
    });
  });

  describe('analyzeContracts', () => {
    test('should analyze contracts correctly', () => {
      const contracts = [
        { type: 'interface', name: 'TerminalContract' },
        { type: 'interface', name: 'EventEmitterContract' }
      ];

      const analysis = ComponentIntrospector.analyzeContracts(contracts);

      expect(analysis.total).toBe(2);
      expect(analysis.interfaces).toEqual(['TerminalContract', 'EventEmitterContract']);
      expect(analysis.byType.interface).toHaveLength(2);
    });
  });

  describe('validateComponent', () => {
    test('should validate MVVM pattern compliance', () => {
      const description = {
        metadata: { hasState: true, hasEvents: false, hasActorCommunication: false, hasDOMStructure: false, hasUserInteractions: false },
        dependencies: { dependencies: [] }
      };

      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Component has state but no events - may violate MVVM pattern');
    });

    test('should validate actor communication dependencies', () => {
      const description = {
        metadata: { hasState: false, hasEvents: false, hasActorCommunication: true, hasDOMStructure: false, hasUserInteractions: false },
        dependencies: { dependencies: [{ type: 'HTMLElement' }] }
      };

      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Component communicates with actors but does not require ActorSpace');
    });

    test('should recommend DOM dependencies', () => {
      const description = {
        metadata: { hasState: false, hasEvents: false, hasActorCommunication: false, hasDOMStructure: true, hasUserInteractions: false },
        dependencies: { dependencies: [] }
      };

      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(true);
      expect(validation.recommendations).toContain('Component creates DOM elements - consider requiring HTMLElement dependency');
    });

    test('should recommend events for user interactions', () => {
      const description = {
        metadata: { hasState: false, hasEvents: false, hasActorCommunication: false, hasDOMStructure: false, hasUserInteractions: true },
        dependencies: { dependencies: [] }
      };

      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(true);
      expect(validation.recommendations).toContain('Component handles user interactions but emits no events');
    });

    test('should validate well-formed component', () => {
      const description = {
        metadata: { hasState: true, hasEvents: true, hasActorCommunication: true, hasDOMStructure: true, hasUserInteractions: true },
        dependencies: { dependencies: [{ type: 'HTMLElement' }, { type: 'ActorSpace' }] }
      };

      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
      expect(validation.recommendations).toHaveLength(0);
    });
  });

  describe('groupBy', () => {
    test('should group array by property', () => {
      const array = [
        { type: 'A', name: 'item1' },
        { type: 'B', name: 'item2' },
        { type: 'A', name: 'item3' }
      ];

      const grouped = ComponentIntrospector.groupBy(array, 'type');

      expect(grouped.A).toHaveLength(2);
      expect(grouped.B).toHaveLength(1);
      expect(grouped.A[0].name).toBe('item1');
      expect(grouped.A[1].name).toBe('item3');
    });

    test('should handle empty array', () => {
      const grouped = ComponentIntrospector.groupBy([], 'type');
      expect(grouped).toEqual({});
    });
  });
});