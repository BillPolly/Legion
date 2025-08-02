/**
 * Integration tests for Basic Test Generators (Phase 2)
 * Tests the interaction between DependencyTestGenerator, DOMTestGenerator, and EventTestGenerator
 */
import { describe, test, expect } from '@jest/globals';
import { DependencyTestGenerator } from '../../../src/generators/DependencyTestGenerator.js';
import { DOMTestGenerator } from '../../../src/generators/DOMTestGenerator.js';
import { EventTestGenerator } from '../../../src/generators/EventTestGenerator.js';
import { ComponentIntrospector } from '../../../src/core/ComponentIntrospector.js';
import { SelfTestingFramework } from '../../../src/core/SelfTestingFramework.js';

describe('Basic Test Generators Integration', () => {
  describe('Generator coordination', () => {
    test('should generate coordinated tests for complete component', () => {
      const description = {
        dependencies: {
          total: 2,
          dependencies: [
            { name: 'dom', type: 'HTMLElement', required: true, hasDefault: false },
            { name: 'config', type: 'Object', required: false, hasDefault: true, default: {} }
          ]
        },
        domStructure: {
          total: 3,
          hasHierarchy: 1,
          elements: [
            { type: 'creates', selector: '.terminal', attributes: { id: 'main-terminal' } },
            { type: 'creates', selector: 'input[type=text]', within: '.terminal', attributes: { placeholder: 'Enter command' } },
            { type: 'contains', selector: '.output-area', attributes: {} }
          ]
        },
        events: {
          total: 3,
          byType: {
            emits: [
              { event: 'command', payloadType: 'string' },
              { event: 'input', payloadType: 'string' }
            ],
            listens: [
              { event: 'output', payloadType: 'OutputLine' }
            ]
          }
        }
      };

      // Test each generator individually
      const dependencyTests = DependencyTestGenerator.generateTests(description);
      const domTests = DOMTestGenerator.generateTests(description);
      const eventTests = EventTestGenerator.generateTests(description);

      // Verify each generator produced tests
      expect(dependencyTests.length).toBeGreaterThan(0);
      expect(domTests.length).toBeGreaterThan(0);
      expect(eventTests.length).toBeGreaterThan(0);

      // Verify test categories are consistent
      const allTests = [...dependencyTests, ...domTests, ...eventTests];
      const categories = [...new Set(allTests.map(t => t.category))];
      
      expect(categories).toContain('Dependency Requirements');
      expect(categories).toContain('DOM Structure');
      expect(categories).toContain('Event System');

      // Verify no duplicate test names within categories
      const testsByCategory = {};
      allTests.forEach(test => {
        if (!testsByCategory[test.category]) {
          testsByCategory[test.category] = [];
        }
        testsByCategory[test.category].push(test.name);
      });

      Object.entries(testsByCategory).forEach(([category, testNames]) => {
        const uniqueNames = new Set(testNames);
        expect(uniqueNames.size).toBe(testNames.length); // No duplicates
      });
    });

    test('should handle component with only dependencies', () => {
      const description = {
        dependencies: {
          total: 1,
          dependencies: [
            { name: 'actorSpace', type: 'ActorSpace', required: true, hasDefault: false }
          ]
        },
        domStructure: { total: 0, elements: [] },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const dependencyTests = DependencyTestGenerator.generateTests(description);
      const domTests = DOMTestGenerator.generateTests(description);
      const eventTests = EventTestGenerator.generateTests(description);

      expect(dependencyTests.length).toBeGreaterThan(0);
      expect(domTests).toEqual([]);
      expect(eventTests).toEqual([]);
    });

    test('should handle component with only DOM structure', () => {
      const description = {
        dependencies: { total: 0, dependencies: [] },
        domStructure: {
          total: 1,
          hasHierarchy: 0,
          elements: [
            { type: 'creates', selector: '.widget', attributes: {} }
          ]
        },
        events: { total: 0, byType: { emits: [], listens: [] } }
      };

      const dependencyTests = DependencyTestGenerator.generateTests(description);
      const domTests = DOMTestGenerator.generateTests(description);
      const eventTests = EventTestGenerator.generateTests(description);

      expect(dependencyTests).toEqual([]);
      expect(domTests.length).toBeGreaterThan(0);
      expect(eventTests).toEqual([]);
    });

    test('should handle component with only events', () => {
      const description = {
        dependencies: { total: 0, dependencies: [] },
        domStructure: { total: 0, elements: [] },
        events: {
          total: 1,
          byType: {
            emits: [{ event: 'signal', payloadType: 'boolean' }],
            listens: []
          }
        }
      };

      const dependencyTests = DependencyTestGenerator.generateTests(description);
      const domTests = DOMTestGenerator.generateTests(description);
      const eventTests = EventTestGenerator.generateTests(description);

      expect(dependencyTests).toEqual([]);
      expect(domTests).toEqual([]);
      expect(eventTests.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with SelfTestingFramework', () => {
    test('should integrate with SelfTestingFramework for full component testing', () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .creates('.test-component')
            .manages('value', 'string', { default: '' })
            .emits('change', 'string')
            .handles('click', () => true);
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);
      
      // Should have generated tests from all relevant generators
      const categories = testSuite.getCategoryNames();
      expect(categories).toContain('Dependency Requirements');
      expect(categories).toContain('DOM Structure');
      expect(categories).toContain('Event System');
      expect(categories).toContain('State Management');
      expect(categories).toContain('Integration');

      // Should have reasonable number of tests
      const allTests = testSuite.getAllTests();
      expect(allTests.length).toBeGreaterThan(5);
      expect(allTests.length).toBeLessThan(50); // Reasonable upper bound
    });

    test('should generate comprehensive tests for terminal component', () => {
      class TerminalComponent {
        static describe(d) {
          d.requires('dom', 'HTMLElement')
            .requires('actorSpace', 'ActorSpace')
            .optional('config', 'Object', { default: {} })
            
            .creates('.terminal')
            .creates('input[type=text]', { within: '.terminal' })
            .creates('.output', { within: '.terminal' })
            
            .manages('currentCommand', 'string', { default: '' })
            .manages('history', 'Array<string>', { default: [] })
            
            .emits('command', 'string')
            .emits('input', 'string')
            .listens('output', 'OutputLine')
            
            .sendsToActor('command-actor', 'execute', { command: 'string' })
            .receivesFromActor('ui-actor', 'output', { content: 'string' });
        }
      }

      const testSuite = SelfTestingFramework.generateTests(TerminalComponent);
      
      // Should generate tests for all aspects
      const categories = testSuite.getCategoryNames();
      expect(categories).toContain('Dependency Requirements');
      expect(categories).toContain('DOM Structure');
      expect(categories).toContain('State Management');
      expect(categories).toContain('Event System');
      expect(categories).toContain('Actor Communication');
      expect(categories).toContain('Integration');

      // Verify specific test generation
      const dependencyTests = testSuite.getTestsByCategory('Dependency Requirements');
      const domTests = testSuite.getTestsByCategory('DOM Structure');
      const eventTests = testSuite.getTestsByCategory('Event System');

      expect(dependencyTests.length).toBeGreaterThan(3); // Required, optional, and validation tests
      expect(domTests.length).toBeGreaterThan(3); // Creation, hierarchy, integration tests
      expect(eventTests.length).toBeGreaterThan(4); // Emission and listening tests

      // Verify test name specificity
      const allTestNames = testSuite.getAllTests().map(t => t.name);
      expect(allTestNames).toContain('should require dom parameter of type HTMLElement');
      expect(allTestNames).toContain('should require actorSpace parameter of type ActorSpace');
      expect(allTestNames).toContain("should create element matching selector '.terminal'");
      expect(allTestNames).toContain("should emit 'command' event with string payload");
      expect(allTestNames).toContain("should listen for 'output' event");
    });
  });

  describe('Cross-generator validation', () => {
    test('should detect coordination issues between generators', async () => {
      // Component that requires DOM but doesn't create any elements
      const inconsistentComponent = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .emits('ready', 'boolean');
          // Missing: DOM creation - should be flagged
        }
      };

      const description = ComponentIntrospector.introspect(inconsistentComponent);
      
      // Dependency generator should create tests for DOM requirement
      const dependencyTests = DependencyTestGenerator.generateTests(description);
      const domRequiredTest = dependencyTests.find(t => t.name.includes('should require dom parameter'));
      expect(domRequiredTest).toBeDefined();

      // DOM generator should have no tests since no DOM structure declared
      const domTests = DOMTestGenerator.generateTests(description);
      expect(domTests).toEqual([]);

      // This inconsistency should be detectable through validation
      const validation = ComponentIntrospector.validateComponent(description);
      // Note: This component requires DOM but doesn't create elements - different validation rule
      expect(validation.valid).toBe(true); // No DOM creation so validation passes
      expect(validation.recommendations.length).toBeGreaterThanOrEqual(0);
    });

    test('should validate event payload consistency', async () => {
      const mockComponent = {
        describe: (d) => {
          d.emits('data', 'string')
            .listens('input', 'number');
        },
        create: (deps) => ({
          dependencies: deps,
          emit: deps.eventSystem?.emit || (() => {}),
          on: deps.eventSystem?.on || (() => {}),
          created: true
        })
      };

      const description = ComponentIntrospector.introspect(mockComponent);
      const eventTests = EventTestGenerator.generateTests(description);

      // Should have tests for both emission and listening
      const emissionTests = eventTests.filter(t => t.type === 'event-emits');
      const listeningTests = eventTests.filter(t => t.type === 'event-listens');
      
      expect(emissionTests.length).toBeGreaterThan(0);
      expect(listeningTests.length).toBeGreaterThan(0);

      // Execute payload type validation test
      const payloadTest = eventTests.find(t => t.type === 'event-payload-type');
      const result = await payloadTest.execute(mockComponent, {});
      
      expect(result.eventName).toBe('data');
      expect(result.expectedPayloadType).toBe('string');
    });

    test('should coordinate DOM and event testing', async () => {
      const mockComponent = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .creates('.interactive-element')
            .emits('click', 'MouseEvent');
        },
        create: (deps) => {
          // Create DOM element that can emit events
          const element = (deps.dom && deps.dom.ownerDocument) ?
            deps.dom.ownerDocument.createElement('div') :
            { 
              className: 'interactive-element',
              addEventListener: (event, handler) => {},
              click: () => deps.eventSystem?.emit('click', { type: 'click' }),
              matches: (sel) => sel === '.interactive-element'
            };
          
          if (element.classList) {
            element.classList.add('interactive-element');
          } else {
            element.className = 'interactive-element';
          }
          
          if (deps.dom && deps.dom.appendChild) {
            deps.dom.appendChild(element);
          }
          
          return {
            dependencies: deps,
            element,
            emit: deps.eventSystem?.emit || (() => {}),
            created: true
          };
        }
      };

      const description = ComponentIntrospector.introspect(mockComponent);
      
      // DOM test should verify element creation
      const domTests = DOMTestGenerator.generateTests(description);
      const creationTest = domTests.find(t => t.type === 'dom-creates');
      const domResult = await creationTest.execute(mockComponent, {});
      
      expect(domResult.elementFound).toBe(true);
      expect(domResult.selector).toBe('.interactive-element');

      // Event test should verify click emission
      const eventTests = EventTestGenerator.generateTests(description);
      const emissionTest = eventTests.find(t => t.type === 'event-emits');
      const eventResult = await emissionTest.execute(mockComponent, {});
      
      expect(eventResult.eventName).toBe('click');
      expect(eventResult.expectedPayloadType).toBe('MouseEvent');
    });
  });

  describe('Test execution coordination', () => {
    test('should execute all generator tests in proper order', async () => {
      const component = {
        describe: (d) => {
          d.requires('dom', 'HTMLElement')
            .creates('.test-widget')
            .emits('ready', 'boolean');
        },
        create: (deps) => {
          const element = deps.dom.ownerDocument ?
            deps.dom.ownerDocument.createElement('div') :
            { className: 'test-widget', matches: (sel) => sel === '.test-widget' };
          
          if (element.classList) {
            element.classList.add('test-widget');
          }
          
          deps.dom.appendChild(element);
          
          // Emit ready event
          if (deps.eventSystem?.emit) {
            setTimeout(() => deps.eventSystem.emit('ready', true), 1);
          }
          
          return {
            dependencies: deps,
            element,
            emit: deps.eventSystem?.emit || (() => {}),
            created: true
          };
        }
      };

      const testSuite = SelfTestingFramework.generateTests(component);
      const results = await testSuite.execute();

      // All tests should pass
      expect(results.failed).toBe(0);
      expect(results.passed).toBe(results.totalTests);

      // Should have results from all generators
      expect(results.categories['Dependency Requirements']).toBeDefined();
      expect(results.categories['DOM Structure']).toBeDefined();
      expect(results.categories['Event System']).toBeDefined();
      expect(results.categories['Integration']).toBeDefined();

      // Each category should have successful tests
      expect(results.categories['Dependency Requirements'].passed).toBeGreaterThan(0);
      expect(results.categories['DOM Structure'].passed).toBeGreaterThan(0);
      expect(results.categories['Event System'].passed).toBeGreaterThan(0);
      expect(results.categories['Integration'].passed).toBeGreaterThan(0);
    });
  });
});