/**
 * Unit tests for SelfTestingFramework
 */
import { describe, test, expect } from '@jest/globals';
import { SelfTestingFramework } from '../../../src/core/SelfTestingFramework.js';

describe('SelfTestingFramework', () => {
  // Mock component for testing
  const createMockComponent = (descriptionFn) => {
    return {
      describe: descriptionFn
    };
  };

  describe('generateTests', () => {
    test('should generate tests for component with dependencies', () => {
      const component = createMockComponent((d) => {
        d.requires('dom', 'HTMLElement')
          .optional('config', 'Object', { default: {} });
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.name).toBe('Component');
      expect(testSuite.getCategoryNames()).toContain('Dependency Requirements');
      
      const dependencyTests = testSuite.getTestsByCategory('Dependency Requirements');
      expect(dependencyTests.length).toBeGreaterThan(0);
      
      // Should have tests for required and optional dependencies
      const testNames = dependencyTests.map(t => t.name);
      expect(testNames.some(name => name.includes('should require dom parameter'))).toBe(true);
      expect(testNames.some(name => name.includes('should accept optional config parameter'))).toBe(true);
    });

    test('should generate tests for component with DOM structure', () => {
      const component = createMockComponent((d) => {
        d.creates('.terminal')
          .creates('input[type=text]', { attributes: { placeholder: 'Enter command' } })
          .contains('.output-area');
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('DOM Structure');
      
      const domTests = testSuite.getTestsByCategory('DOM Structure');
      expect(domTests.length).toBeGreaterThan(0);
      
      const testNames = domTests.map(t => t.name);
      expect(testNames.some(name => name.includes("should create element matching selector '.terminal'"))).toBe(true);
      expect(testNames.some(name => name.includes("should set correct attributes on 'input[type=text]'"))).toBe(true);
      expect(testNames.some(name => name.includes("should contain element matching selector '.output-area'"))).toBe(true);
    });

    test('should generate tests for component with state management', () => {
      const component = createMockComponent((d) => {
        d.manages('currentCommand', 'string', { default: '' })
          .manages('history', 'Array<string>', { constraints: { maxLength: 100 } });
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('State Management');
      
      const stateTests = testSuite.getTestsByCategory('State Management');
      expect(stateTests.length).toBeGreaterThan(0);
      
      const testNames = stateTests.map(t => t.name);
      expect(testNames.some(name => name.includes('should manage currentCommand property'))).toBe(true);
      expect(testNames.some(name => name.includes('should initialize currentCommand with default value'))).toBe(true);
      expect(testNames.some(name => name.includes('should enforce constraints on history'))).toBe(true);
    });

    test('should generate tests for component with events', () => {
      const component = createMockComponent((d) => {
        d.emits('command', 'string')
          .emits('input', 'string')
          .listens('output', 'OutputLine');
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('Event System');
      
      const eventTests = testSuite.getTestsByCategory('Event System');
      expect(eventTests.length).toBeGreaterThan(0);
      
      const testNames = eventTests.map(t => t.name);
      expect(testNames.some(name => name.includes("should emit 'command' event"))).toBe(true);
      expect(testNames.some(name => name.includes("should listen for 'output' event"))).toBe(true);
    });

    test('should generate tests for component with actor communication', () => {
      const component = createMockComponent((d) => {
        d.sendsToActor('command-actor', 'execute', { command: 'string' })
          .receivesFromActor('ui-actor', 'output', { content: 'string' });
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('Actor Communication');
      
      const actorTests = testSuite.getTestsByCategory('Actor Communication');
      expect(actorTests.length).toBeGreaterThan(0);
      
      const testNames = actorTests.map(t => t.name);
      expect(testNames.some(name => name.includes("should send 'execute' messages to command-actor"))).toBe(true);
      expect(testNames.some(name => name.includes("should receive 'output' messages from ui-actor"))).toBe(true);
    });

    test('should generate tests for component with user flows', () => {
      const component = createMockComponent((d) => {
        d.flow('type-and-execute', [
          { type: 'user-input', action: 'type', value: 'help' },
          { type: 'user-input', action: 'press-enter' },
          { type: 'verify-event', event: 'command', payload: 'help' }
        ]);
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('User Flows');
      
      const flowTests = testSuite.getTestsByCategory('User Flows');
      expect(flowTests.length).toBeGreaterThan(0);
      
      const testNames = flowTests.map(t => t.name);
      expect(testNames.some(name => name.includes("should handle 'type-and-execute' user flow"))).toBe(true);
    });

    test('should generate tests for component with invariants', () => {
      const component = createMockComponent((d) => {
        d.invariant('input-state-sync', (c) => c.view.inputElement.value === c.model.currentCommand)
          .invariant('valid-history', (c) => c.model.history.length <= 100);
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('Invariants');
      
      const invariantTests = testSuite.getTestsByCategory('Invariants');
      expect(invariantTests.length).toBeGreaterThan(0);
      
      const testNames = invariantTests.map(t => t.name);
      expect(testNames.some(name => name.includes('should maintain invariant: input-state-sync'))).toBe(true);
      expect(testNames.some(name => name.includes('should maintain invariant: valid-history'))).toBe(true);
    });

    test('should always generate integration tests', () => {
      const component = createMockComponent((d) => {
        d.requires('dom', 'HTMLElement')
          .creates('.test')
          .manages('value', 'string');
      });

      const testSuite = SelfTestingFramework.generateTests(component);
      
      expect(testSuite.getCategoryNames()).toContain('Integration');
      
      const integrationTests = testSuite.getTestsByCategory('Integration');
      expect(integrationTests.length).toBeGreaterThan(0);
      
      const testNames = integrationTests.map(t => t.name);
      expect(testNames.some(name => name.includes('should create component with all dependencies'))).toBe(true);
      expect(testNames.some(name => name.includes('should handle complete component lifecycle'))).toBe(true);
    });

    test('should skip test categories based on options', () => {
      const component = createMockComponent((d) => {
        d.requires('dom', 'HTMLElement')
          .creates('.test')
          .manages('value', 'string')
          .emits('change', 'string');
      });

      const testSuite = SelfTestingFramework.generateTests(component, {
        generateDependencyTests: false,
        generateEventTests: false
      });
      
      expect(testSuite.getCategoryNames()).not.toContain('Dependency Requirements');
      expect(testSuite.getCategoryNames()).not.toContain('Event System');
      expect(testSuite.getCategoryNames()).toContain('DOM Structure');
      expect(testSuite.getCategoryNames()).toContain('State Management');
    });

    test('should handle component class with name', () => {
      class TerminalComponent {
        static describe(d) {
          d.requires('dom', 'HTMLElement');
        }
      }

      const testSuite = SelfTestingFramework.generateTests(TerminalComponent);
      expect(testSuite.name).toBe('TerminalComponent');
    });
  });

  describe('constructor and options', () => {
    test('should create framework with default options', () => {
      const framework = new SelfTestingFramework();
      
      expect(framework.options.generateDependencyTests).toBe(true);
      expect(framework.options.generateDOMTests).toBe(true);
      expect(framework.options.generateEventTests).toBe(true);
      expect(framework.options.generateStateTests).toBe(true);
      expect(framework.options.generateFlowTests).toBe(true);
      expect(framework.options.generateActorTests).toBe(true);
      expect(framework.options.generateInvariantTests).toBe(true);
      expect(framework.options.includeIntegrationTests).toBe(true);
    });

    test('should create framework with custom options', () => {
      const framework = new SelfTestingFramework({
        generateDependencyTests: false,
        generateEventTests: false,
        customOption: true
      });
      
      expect(framework.options.generateDependencyTests).toBe(false);
      expect(framework.options.generateEventTests).toBe(false);
      expect(framework.options.generateDOMTests).toBe(true); // default
      expect(framework.options.customOption).toBe(true);
    });
  });

  describe('test generator and validator registration', () => {
    test('should register and retrieve test generators', () => {
      const framework = new SelfTestingFramework();
      const mockGenerator = () => {};
      
      framework.registerTestGenerator('custom-test', mockGenerator);
      
      expect(framework.getTestGenerator('custom-test')).toBe(mockGenerator);
      expect(framework.getTestGenerator('non-existent')).toBeUndefined();
    });

    test('should register and retrieve validators', () => {
      const framework = new SelfTestingFramework();
      const mockValidator = () => {};
      
      framework.registerValidator('custom-validator', mockValidator);
      
      expect(framework.getValidator('custom-validator')).toBe(mockValidator);
      expect(framework.getValidator('non-existent')).toBeUndefined();
    });
  });

  describe('error handling', () => {
    test('should throw error for invalid component', () => {
      const invalidComponent = {};

      expect(() => {
        SelfTestingFramework.generateTests(invalidComponent);
      }).toThrow('Failed to generate tests');
    });

    test('should throw error for component with invalid description', () => {
      const invalidComponent = {
        describe: (d) => {
          d.invariant('bad-invariant', 'not-a-function');
        }
      };

      expect(() => {
        SelfTestingFramework.generateTests(invalidComponent);
      }).toThrow('Failed to generate tests');
    });
  });

  describe('component name extraction', () => {
    test('should extract name from component class', () => {
      class TestComponent {}
      const framework = new SelfTestingFramework();
      
      expect(framework.getComponentName(TestComponent)).toBe('TestComponent');
    });

    test('should handle anonymous function', () => {
      const framework = new SelfTestingFramework();
      
      expect(framework.getComponentName(() => {})).toBe('Anonymous Component');
    });

    test('should handle component object', () => {
      const component = {};
      const framework = new SelfTestingFramework();
      
      expect(framework.getComponentName(component)).toBe('Component');
    });
  });

  describe('test execution', () => {
    test('should execute test suite', async () => {
      const component = createMockComponent((d) => {
        d.requires('dom', 'HTMLElement');
      });

      const framework = new SelfTestingFramework();
      const testSuite = framework.generateTests(component);
      
      const results = await framework.executeTestSuite(testSuite);
      
      expect(results).toBeDefined();
      expect(results.suiteName).toBe('Component');
      expect(results.totalTests).toBeGreaterThan(0);
    });
  });
});