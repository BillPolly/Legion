/**
 * Integration tests for Core Infrastructure
 * Tests the interaction between ComponentDescriptor, ComponentIntrospector, and SelfTestingFramework
 */
import { describe, test, expect } from '@jest/globals';
import { ComponentDescriptor } from '../../../src/core/ComponentDescriptor.js';
import { ComponentIntrospector } from '../../../src/core/ComponentIntrospector.js';
import { SelfTestingFramework } from '../../../src/core/SelfTestingFramework.js';

describe('Core Infrastructure Integration', () => {
  describe('ComponentDescriptor → ComponentIntrospector flow', () => {
    test('should introspect complete component description', () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement', { description: 'Container element' })
            .optional('config', 'Object', { default: {}, description: 'Configuration' })
            .creates('.terminal', { attributes: { 'data-testid': 'terminal' } })
            .creates('input[type=text]', { within: '.terminal' })
            .manages('currentCommand', 'string', { default: '' })
            .manages('commandHistory', 'Array<string>', { default: [] })
            .emits('command', 'string', { description: 'User command' })
            .listens('output', 'OutputLine', { from: 'ui-actor' })
            .handles('typing', (input) => typeof input === 'string')
            .sendsToActor('command-actor', 'execute', { command: 'string' })
            .receivesFromActor('ui-actor', 'output', { content: 'string' })
            .flow('type-and-execute', [
              { type: 'user-input', action: 'type', value: 'help' },
              { type: 'user-input', action: 'press-enter' },
              { type: 'verify-event', event: 'command', payload: 'help' }
            ])
            .invariant('input-state-sync', (c) => c.view.inputElement.value === c.model.currentCommand)
            .implements('TerminalContract');
        }
      };

      const description = ComponentIntrospector.introspect(component);

      // Verify all aspects were captured
      expect(description.dependencies.total).toBe(2);
      expect(description.dependencies.required).toBe(1);
      expect(description.dependencies.optional).toBe(1);

      expect(description.domStructure.total).toBe(2);
      expect(description.domStructure.creates).toBe(2);
      expect(description.domStructure.hasAttributes).toBe(1);
      expect(description.domStructure.hasHierarchy).toBe(1);

      expect(description.stateProperties.total).toBe(2);
      expect(description.stateProperties.hasDefaults).toBe(2);

      expect(description.events.total).toBe(2);
      expect(description.events.emits).toBe(1);
      expect(description.events.listens).toBe(1);

      expect(description.userInteractions.total).toBe(1);
      expect(description.userInteractions.hasValidators).toBe(1);

      expect(description.actorCommunication.total).toBe(2);
      expect(description.actorCommunication.sends).toBe(1);
      expect(description.actorCommunication.receives).toBe(1);

      expect(description.userFlows.total).toBe(1);
      expect(description.userFlows.totalSteps).toBe(3);

      expect(description.invariants.total).toBe(1);
      expect(description.invariants.hasCheckers).toBe(1);

      expect(description.contracts.total).toBe(1);
      expect(description.contracts.interfaces).toContain('TerminalContract');
    });

    test('should validate component patterns', () => {
      const wellFormedComponent = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .requires('actorSpace', 'ActorSpace')
            .creates('.component')
            .manages('value', 'string')
            .emits('change', 'string')
            .sendsToActor('data-actor', 'update', { value: 'string' });
        }
      };

      const description = ComponentIntrospector.introspect(wellFormedComponent);
      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should detect MVVM pattern violations', () => {
      const badComponent = {
        describe: (d) => {
          d.manages('value', 'string')  // Has state
            .sendsToActor('data-actor', 'update', { value: 'string' }); // Communicates with actors
          // Missing: HTMLElement dependency, ActorSpace dependency, events
        }
      };

      const description = ComponentIntrospector.introspect(badComponent);
      const validation = ComponentIntrospector.validateComponent(description);

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContain('Component has state but no events - may violate MVVM pattern');
      expect(validation.issues).toContain('Component communicates with actors but does not require ActorSpace');
    });
  });

  describe('ComponentIntrospector → SelfTestingFramework flow', () => {
    test('should generate comprehensive test suite', () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .creates('.test-component')
            .manages('value', 'string', { default: '' })
            .emits('change', 'string')
            .sendsToActor('data-actor', 'save', { value: 'string' })
            .flow('update-flow', [
              { type: 'user-input', action: 'type', value: 'test' },
              { type: 'verify-event', event: 'change', payload: 'test' }
            ])
            .invariant('value-not-empty', (c) => c.model.value.length >= 0);
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);

      // Should generate all test categories
      const categories = testSuite.getCategoryNames();
      expect(categories).toContain('Dependency Requirements');
      expect(categories).toContain('DOM Structure');
      expect(categories).toContain('State Management');
      expect(categories).toContain('Event System');
      expect(categories).toContain('Actor Communication');
      expect(categories).toContain('User Flows');
      expect(categories).toContain('Invariants');
      expect(categories).toContain('Integration');

      // Verify test counts
      expect(testSuite.getTestsByCategory('Dependency Requirements').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('DOM Structure').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('State Management').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('Event System').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('Actor Communication').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('User Flows').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('Invariants').length).toBeGreaterThan(0);
      expect(testSuite.getTestsByCategory('Integration').length).toBeGreaterThan(0);
    });

    test('should generate specific test implementations', async () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .emits('test-event', 'string');
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);
      const dependencyTests = testSuite.getTestsByCategory('Dependency Requirements');
      const eventTests = testSuite.getTestsByCategory('Event System');

      // Execute a dependency test
      const domRequiredTest = dependencyTests.find(t => t.name.includes('should require dom parameter'));
      expect(domRequiredTest).toBeDefined();
      
      const result = await domRequiredTest.fn();
      expect(result.type).toBe('dependency-required');
      expect(result.dependency.name).toBe('dom');
      expect(result.dependency.type).toBe('HTMLElement');

      // Execute an event test
      const eventEmitTest = eventTests.find(t => t.name.includes("should emit 'test-event' event"));
      expect(eventEmitTest).toBeDefined();
      
      const eventResult = await eventEmitTest.fn();
      expect(eventResult.type).toBe('event-emits');
      expect(eventResult.event.event).toBe('test-event');
      expect(eventResult.event.payloadType).toBe('string');
    });

    test('should execute full test suite', async () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .creates('.simple-component')
            .emits('ready', 'boolean');
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);
      const results = await testSuite.execute();

      expect(results.suiteName).toBe('Component');
      expect(results.totalTests).toBeGreaterThan(0);
      expect(results.passed).toBe(results.totalTests); // All tests should pass
      expect(results.failed).toBe(0);
      expect(results.duration).toBeGreaterThanOrEqual(0);

      // Check category results
      expect(results.categories['Dependency Requirements']).toBeDefined();
      expect(results.categories['DOM Structure']).toBeDefined();
      expect(results.categories['Event System']).toBeDefined();
      expect(results.categories['Integration']).toBeDefined();
    });
  });

  describe('End-to-end integration', () => {
    test('should handle terminal component example', () => {
      class TerminalComponent {
        static describe(descriptor) {
          descriptor
            .requires('dom', 'HTMLElement', { description: 'Container element for terminal' })
            .requires('actorSpace', 'ActorSpace', { description: 'Actor communication system' })
            .optional('config', 'Object', { default: {}, description: 'Terminal configuration' })
            
            .creates('.terminal', { 
              description: 'Main terminal container',
              attributes: { 'data-testid': 'terminal', 'class': 'terminal' }
            })
            .creates('.terminal-input[type=text]', { 
              within: '.terminal',
              description: 'Command input field',
              attributes: { placeholder: 'Enter command...' }
            })
            .creates('.terminal-output', { 
              within: '.terminal',
              description: 'Command output area'
            })
            
            .manages('currentCommand', 'string', { 
              description: 'Currently typed command',
              default: '',
              constraints: { maxLength: 1000 }
            })
            .manages('commandHistory', 'Array<string>', { 
              description: 'Previous commands',
              default: [],
              constraints: { maxLength: 100 }
            })
            .manages('executing', 'boolean', { 
              description: 'Whether a command is executing',
              default: false
            })
            
            .emits('command', 'string', { 
              description: 'Fired when user executes a command',
              when: 'User presses Enter with non-empty input'
            })
            .emits('input', 'string', { 
              description: 'Fired when user types',
              when: 'User types in input field'
            })
            .listens('output', 'OutputLine', { 
              description: 'Displays command output',
              from: 'ui-actor'
            })
            
            .handles('typing', (input) => typeof input === 'string' && input.length <= 1000)
            .handles('enter-key', function() { return this.currentCommand.trim().length > 0; })
            .handles('tab-key', function() { return this.autocompleteAvailable; })
            
            .sendsToActor('command-actor', 'execute', {
              command: 'string',
              requestId: 'string'
            })
            .receivesFromActor('command-actor', 'response', {
              requestId: 'string',
              result: 'any',
              error: 'string?'
            })
            
            .flow('type-and-execute', [
              {
                type: 'user-input',
                action: 'type',
                value: 'help',
                expect: { state: { currentCommand: 'help' } }
              },
              {
                type: 'user-input', 
                action: 'press-enter',
                expect: { 
                  event: { name: 'command', payload: 'help' },
                  state: { currentCommand: '', executing: true }
                }
              },
              {
                type: 'actor-message',
                from: 'command-actor',
                message: { type: 'response', result: 'Help text' },
                expect: { state: { executing: false } }
              }
            ])
            
            .invariant('input-state-sync', (component) => 
              component.view.inputElement.value === component.model.currentCommand
            )
            .invariant('executing-disables-input', (component) => {
              if (component.model.executing) {
                return component.view.inputElement.disabled === true;
              }
              return true;
            })
            .invariant('history-size-limit', (component) => 
              component.model.commandHistory.length <= 100
            )
            
            .implements('TerminalContract');
        }
      }

      // Test full introspection
      const description = ComponentIntrospector.introspect(TerminalComponent);
      
      expect(description.metadata.complexity).toBeGreaterThan(10); // Complex component
      expect(description.dependencies.total).toBe(3);
      expect(description.domStructure.total).toBe(3);
      expect(description.stateProperties.total).toBe(3);
      expect(description.events.total).toBe(3);
      expect(description.userInteractions.total).toBe(3);
      expect(description.actorCommunication.total).toBe(2);
      expect(description.userFlows.total).toBe(1);
      expect(description.userFlows.totalSteps).toBe(3);
      expect(description.invariants.total).toBe(3);
      expect(description.contracts.total).toBe(1);

      // Test validation
      const validation = ComponentIntrospector.validateComponent(description);
      expect(validation.valid).toBe(true);

      // Test comprehensive test generation
      const testSuite = SelfTestingFramework.generateTests(TerminalComponent);
      expect(testSuite.name).toBe('TerminalComponent');
      expect(testSuite.getAllTests().length).toBeGreaterThan(20); // Many tests generated

      // Check all expected categories are present
      const categories = testSuite.getCategoryNames();
      expect(categories).toContain('Dependency Requirements');
      expect(categories).toContain('DOM Structure');
      expect(categories).toContain('State Management');
      expect(categories).toContain('Event System');
      expect(categories).toContain('Actor Communication');
      expect(categories).toContain('User Flows');
      expect(categories).toContain('Invariants');
      expect(categories).toContain('Integration');
    });

    test('should detect coordination bugs in test specs', async () => {
      const component = {
        describe: (d) => {
          d.emits('input', 'string')  // Declares string payload
            .manages('currentValue', 'string');
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);
      const eventTests = testSuite.getTestsByCategory('Event System');
      
      const payloadTypeTest = eventTests.find(t => 
        t.name.includes("should emit 'input' with correct payload type")
      );
      
      const result = await payloadTypeTest.fn();
      expect(result.type).toBe('event-payload-type');
      expect(result.event.payloadType).toBe('string');

      // This test spec would later be used by actual test generators
      // to verify that when the component emits 'input', the payload is actually a string
      // and not something like '[object InputEvent]'
    });

    test('should provide Jest code generation', async () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .emits('test', 'string');
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);
      const jestCode = await testSuite.generateJestCode();

      expect(jestCode).toContain("describe('Component', () => {");
      expect(jestCode).toContain("describe('Dependency Requirements', () => {");
      expect(jestCode).toContain("test('should require dom parameter of type HTMLElement', async () => {");
      expect(jestCode).toContain("describe('Event System', () => {");
      expect(jestCode).toContain("test('should emit 'test' event with string payload', async () => {");
      expect(jestCode).toContain('expect(testSpec).toBeDefined();');
    });
  });
});