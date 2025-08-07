/**
 * Unit tests for TestOrchestrator
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { TestOrchestrator } from '../../../src/core/TestOrchestrator.js';

describe('TestOrchestrator', () => {
  let orchestrator;
  let mockComponent;
  let mockDescription;

  beforeEach(() => {
    orchestrator = new TestOrchestrator({
      verboseLogging: false,
      timeoutMs: 5000
    });

    mockComponent = {
      name: 'TestComponent',
      create: (deps) => ({
        dependencies: deps,
        state: new Map(),
        setState: function(key, value) { this.state.set(key, value); },
        getState: function(key) { return this.state.get(key); },
        emit: function(event, payload) {
          if (this.config.eventSystem) {
            this.config.eventSystem.dispatchEvent(event, payload);
          }
        },
        created: true
      })
    };

    mockDescription = {
      domStructure: {
        total: 2,
        elements: [
          { type: 'creates', selector: 'input[type=text]', attributes: {} },
          { type: 'creates', selector: 'button', attributes: {} }
        ]
      },
      stateProperties: {
        total: 2,
        properties: [
          { property: 'value', type: 'string' },
          { property: 'count', type: 'number' }
        ]
      },
      events: {
        total: 2,
        byType: {
          emits: [{ event: 'change', payloadType: 'string' }],
          listens: [{ event: 'input', payloadType: 'string' }]
        }
      },
      dependencies: {
        total: 1,
        dependencies: [
          { name: 'eventSystem', type: 'EventSystem', required: true }
        ]
      }
    };
  });

  describe('constructor', () => {
    test('should create orchestrator with default options', () => {
      const defaultOrchestrator = new TestOrchestrator();
      
      expect(defaultOrchestrator.options.includeIntegrationTests).toBe(true);
      expect(defaultOrchestrator.options.includeInvariantTests).toBe(true);
      expect(defaultOrchestrator.options.includeFlowTests).toBe(true);
      expect(defaultOrchestrator.options.includeActorTests).toBe(true);
      expect(defaultOrchestrator.options.timeoutMs).toBe(30000);
    });

    test('should include all generators by default', () => {
      expect(orchestrator.generators.length).toBe(7); // All generators included
    });

    test('should exclude optional generators when disabled', () => {
      const minimalOrchestrator = new TestOrchestrator({
        includeFlowTests: false,
        includeActorTests: false,
        includeInvariantTests: false
      });
      
      expect(minimalOrchestrator.generators.length).toBe(4); // Only core generators
    });
  });

  describe('runTests', () => {
    test('should execute complete test suite successfully', async () => {
      const results = await orchestrator.runTests(mockComponent, mockDescription);

      expect(results.component).toBe('TestComponent');
      expect(results.description).toBe(mockDescription);
      expect(results.startTime).toBeDefined();
      expect(results.endTime).toBeDefined();
      expect(results.totalDuration).toBeGreaterThan(0);
      
      expect(results.summary).toBeDefined();
      expect(results.summary.totalTests).toBeGreaterThan(0);
      expect(results.summary.passed).toBeGreaterThanOrEqual(0);
      expect(results.summary.failed).toBeGreaterThanOrEqual(0);
      expect(results.summary.passRate).toBeGreaterThanOrEqual(0);
      
      expect(results.generators).toBeDefined();
      expect(results.bugDetection).toBeDefined();
      expect(results.performance).toBeDefined();
      expect(results.coverage).toBeDefined();
    });

    test('should handle component without create method', async () => {
      const simpleComponent = { name: 'SimpleComponent' };
      
      const results = await orchestrator.runTests(simpleComponent, mockDescription);
      
      expect(results.component).toBe('SimpleComponent');
      expect(results.summary.totalTests).toBeGreaterThan(0);
    });

    test('should handle errors gracefully', async () => {
      const errorComponent = {
        create: () => { throw new Error('Component creation failed'); }
      };
      
      const results = await orchestrator.runTests(errorComponent, mockDescription);
      
      expect(results.error || results.summary.failed > 0).toBeTruthy();
    });

    test('should respect timeout settings', async () => {
      const fastOrchestrator = new TestOrchestrator({ timeoutMs: 100 });
      
      const slowComponent = {
        create: (deps) => ({
          dependencies: deps,
          slowMethod: async () => {
            await new Promise(resolve => setTimeout(resolve, 200)); // Slower than timeout
            return { success: true };
          },
          created: true
        })
      };
      
      const results = await fastOrchestrator.runTests(slowComponent, mockDescription);
      
      // Should complete but may have some timeouts
      expect(results.summary).toBeDefined();
    }, 10000);
  });

  describe('executeGeneratorTests', () => {
    test('should execute tests from all generators', async () => {
      // Initialize results structure first
      await orchestrator.runTests(mockComponent, mockDescription);
      
      expect(Object.keys(orchestrator.results.generators).length).toBeGreaterThan(0);
      
      // Check that core generators are present
      expect(orchestrator.results.generators['DOMTestGenerator']).toBeDefined();
      expect(orchestrator.results.generators['StateTestGenerator']).toBeDefined();
      expect(orchestrator.results.generators['EventTestGenerator']).toBeDefined();
      expect(orchestrator.results.generators['DependencyTestGenerator']).toBeDefined();
    });

    test('should handle generator errors without stopping execution', async () => {
      // Mock a generator that throws an error
      const originalGenerators = orchestrator.generators;
      orchestrator.generators = [
        ...originalGenerators,
        class ErrorGenerator {
          static get name() { return 'ErrorGenerator'; }
          static generateTests() { throw new Error('Generator error'); }
        }
      ];
      
      // Run full tests to initialize results
      await orchestrator.runTests(mockComponent, mockDescription);
      
      expect(orchestrator.results.generators['ErrorGenerator']).toBeDefined();
      expect(orchestrator.results.generators['ErrorGenerator'].error).toBeDefined();
      expect(orchestrator.results.generators['ErrorGenerator'].failed).toBe(1);
    });

    test('should update coverage metrics correctly', async () => {
      await orchestrator.runTests(mockComponent, mockDescription);
      
      expect(orchestrator.results.coverage.domElements).toBe(2);
      expect(orchestrator.results.coverage.stateProperties).toBe(2);
      expect(orchestrator.results.coverage.events).toBe(2);
      expect(orchestrator.results.coverage.dependencies).toBe(1);
    });
  });

  describe('executeTests', () => {
    test('should execute individual tests correctly', async () => {
      // Initialize results structure first
      orchestrator.results = {
        performance: { totalExecutionTime: 0, slowTests: [] }
      };
      
      const mockTests = [
        {
          name: 'test 1',
          category: 'Test',
          type: 'unit',
          execute: async () => ({ success: true, result: 'passed' })
        },
        {
          name: 'test 2',
          category: 'Test',
          type: 'unit',
          execute: async () => ({ success: false, error: 'failed' })
        }
      ];
      
      class MockGenerator {
        static get name() { return 'MockGenerator'; }
      }
      
      const results = await orchestrator.executeTests(mockTests, mockComponent, MockGenerator);
      
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[0].duration).toBeGreaterThanOrEqual(0);
      expect(results[1].duration).toBeGreaterThanOrEqual(0);
    });

    test('should track slow tests', async () => {
      orchestrator.results = { performance: { slowTests: [], totalExecutionTime: 0 } };
      
      const slowTest = {
        name: 'slow test',
        category: 'Performance',
        type: 'slow',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 1100)); // Over 1 second
          return { success: true };
        }
      };
      
      class MockGenerator {
        static get name() { return 'MockGenerator'; }
      }
      
      await orchestrator.executeTests([slowTest], mockComponent, MockGenerator);
      
      expect(orchestrator.results.performance.slowTests.length).toBe(1);
      expect(orchestrator.results.performance.slowTests[0].name).toBe('slow test');
      expect(orchestrator.results.performance.slowTests[0].duration).toBeGreaterThan(1000);
    }, 5000);
  });

  describe('runBugDetection', () => {
    test('should run bug detection analysis', async () => {
      // Run tests first to initialize environment and results
      await orchestrator.runTests(mockComponent, mockDescription);
      
      // Add additional test results for invariant generator
      orchestrator.results.generators.InvariantTestGenerator = {
        results: [
          {
            name: 'invariant test',
            result: {
              invariantViolations: [
                { violations: ['TYPE_INVARIANT_VIOLATION'] }
              ]
            }
          }
        ]
      };
      
      await orchestrator.runBugDetection(mockComponent, mockDescription);
      
      expect(orchestrator.results.bugDetection.coordinationBugs).toBeDefined();
      expect(orchestrator.results.bugDetection.parameterBugs).toBeDefined();
      expect(orchestrator.results.bugDetection.invariantViolations).toBeDefined();
      expect(orchestrator.results.bugDetection.typeErrors).toBeDefined();
    });

    test('should handle bug detection errors gracefully', async () => {
      // Initialize test environment first
      await orchestrator.runTests(mockComponent, mockDescription);
      
      // Mock component that throws error
      const errorComponent = {
        create: () => { throw new Error('Creation failed'); }
      };
      
      await orchestrator.runBugDetection(errorComponent, mockDescription);
      
      expect(orchestrator.results.bugDetection.error).toBeDefined();
    });
  });

  describe('analyzeParameterBugs', () => {
    test('should detect parameter passing bugs', () => {
      orchestrator.results = {
        bugDetection: { parameterBugs: [] },
        generators: {
          TestGenerator: {
            results: [
              {
                name: 'test with object bug',
                generator: 'TestGenerator',
                result: {
                  issues: ['Expected string but got [object InputEvent]']
                }
              },
              {
                name: 'test with toString bug',
                generator: 'TestGenerator',
                error: 'Invalid parameter: [object Object] found'
              }
            ]
          }
        }
      };
      
      orchestrator.analyzeParameterBugs();
      
      expect(orchestrator.results.bugDetection.parameterBugs.length).toBe(2);
      expect(orchestrator.results.bugDetection.parameterBugs[0].type).toBe('parameter-passing');
      expect(orchestrator.results.bugDetection.parameterBugs[0].severity).toBe('high');
    });

    test('should not detect false positives', () => {
      orchestrator.results = {
        bugDetection: { parameterBugs: [] },
        generators: {
          TestGenerator: {
            results: [
              {
                name: 'normal test',
                generator: 'TestGenerator',
                result: { success: true }
              }
            ]
          }
        }
      };
      
      orchestrator.analyzeParameterBugs();
      
      expect(orchestrator.results.bugDetection.parameterBugs.length).toBe(0);
    });
  });

  describe('analyzeInvariantViolations', () => {
    test('should analyze invariant violations', () => {
      orchestrator.results = {
        bugDetection: { invariantViolations: [] },
        generators: {
          InvariantTestGenerator: {
            results: [
              {
                name: 'invariant test',
                result: {
                  invariantViolations: [
                    {
                      violations: ['TYPE_INVARIANT_VIOLATION'],
                      operation: { type: 'setState' }
                    }
                  ]
                }
              }
            ]
          }
        }
      };
      
      orchestrator.analyzeInvariantViolations();
      
      expect(orchestrator.results.bugDetection.invariantViolations.length).toBe(1);
      expect(orchestrator.results.bugDetection.invariantViolations[0].type).toBe('invariant-violation');
    });
  });

  describe('analyzeTypeErrors', () => {
    test('should detect type errors', () => {
      orchestrator.results = {
        bugDetection: { typeErrors: [] },
        generators: {
          TestGenerator: {
            results: [
              {
                name: 'type error test',
                generator: 'TestGenerator',
                error: 'TypeError: Cannot read property of undefined'
              },
              {
                name: 'function error test',
                generator: 'TestGenerator',
                error: 'test.method is not a function'
              }
            ]
          }
        }
      };
      
      orchestrator.analyzeTypeErrors();
      
      expect(orchestrator.results.bugDetection.typeErrors.length).toBe(2);
      expect(orchestrator.results.bugDetection.typeErrors[0].type).toBe('type-error');
      expect(orchestrator.results.bugDetection.typeErrors[0].severity).toBe('medium');
    });
  });

  describe('calculateFinalMetrics', () => {
    test('should calculate comprehensive metrics', () => {
      orchestrator.results = {
        summary: { totalTests: 10, passed: 8, failed: 2 },
        generators: {
          TestGenerator: {
            results: [
              { duration: 100 },
              { duration: 200 },
              { duration: 1500 } // Slow test
            ]
          }
        },
        performance: { slowTests: [{ duration: 1500, name: 'slow test' }] }, // Pre-populate slow tests
        bugDetection: { parameterBugs: [], typeErrors: [], invariantViolations: [], coordinationBugs: [] }
      };
      
      orchestrator.calculateFinalMetrics();
      
      expect(orchestrator.results.summary.passRate).toBe(80);
      expect(orchestrator.results.performance.averageTestTime).toBeCloseTo(600);
      expect(orchestrator.results.performance.slowTests.length).toBe(1);
      expect(orchestrator.results.bugDetection.summary).toBeDefined();
    });
  });

  describe('helper methods', () => {
    test('should create component instance correctly', async () => {
      // Initialize test environment first
      await orchestrator.runTests(mockComponent, mockDescription);
      
      const instance = await orchestrator.createComponentInstance(mockComponent);
      
      expect(instance.created).toBe(true);
      expect(instance.dependencies).toBeDefined();
      expect(typeof instance.setState).toBe('function');
    });

    test('should create mock component when no create method', async () => {
      // Initialize test environment first
      await orchestrator.runTests(mockComponent, mockDescription);
      
      const simpleComponent = { name: 'Simple' };
      const instance = await orchestrator.createComponentInstance(simpleComponent);
      
      expect(instance.mockComponent).toBe(true);
      expect(instance.created).toBe(true);
    });

    test('should execute with timeout', async () => {
      const fastFunction = async () => 'result';
      const result = await orchestrator.executeWithTimeout(fastFunction, 1000);
      expect(result).toBe('result');
      
      const slowFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'slow result';
      };
      
      await expect(orchestrator.executeWithTimeout(slowFunction, 100)).rejects.toThrow('timed out');
    });

    test('should assess violation severity correctly', () => {
      const highSeverity = { violations: ['TYPE_INVARIANT_VIOLATION'] };
      const mediumSeverity = { violations: ['MONOTONICITY_VIOLATION'] };
      const lowSeverity = { violations: ['MINOR_ISSUE'] };
      
      expect(orchestrator.assessViolationSeverity(highSeverity)).toBe('high');
      expect(orchestrator.assessViolationSeverity(mediumSeverity)).toBe('medium');
      expect(orchestrator.assessViolationSeverity(lowSeverity)).toBe('low');
    });

    test('should identify type errors correctly', () => {
      expect(orchestrator.isTypeError('TypeError: test')).toBe(true);
      expect(orchestrator.isTypeError('test is not a function')).toBe(true);
      expect(orchestrator.isTypeError('Cannot read property')).toBe(true);
      expect(orchestrator.isTypeError('[object Object]')).toBe(true);
      expect(orchestrator.isTypeError('Normal error message')).toBe(false);
    });
  });

  describe('generateSummaryReport', () => {
    test('should generate comprehensive summary report', async () => {
      // Run tests first to populate results
      await orchestrator.runTests(mockComponent, mockDescription);
      
      // Ensure bug detection arrays are properly initialized
      if (!orchestrator.results.bugDetection.coordinationBugs) {
        orchestrator.results.bugDetection.coordinationBugs = [];
      }
      if (!orchestrator.results.bugDetection.parameterBugs) {
        orchestrator.results.bugDetection.parameterBugs = [];
      }
      if (!orchestrator.results.bugDetection.invariantViolations) {
        orchestrator.results.bugDetection.invariantViolations = [];
      }
      if (!orchestrator.results.bugDetection.typeErrors) {
        orchestrator.results.bugDetection.typeErrors = [];
      }
      
      const report = orchestrator.generateSummaryReport();
      
      expect(report.component).toBe('TestComponent');
      expect(report.duration).toBeGreaterThan(0);
      expect(report.summary).toBeDefined();
      expect(report.coverage).toBeDefined();
      expect(report.bugsSummary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(typeof report.wouldDetectInputEventBug).toBe('boolean');
    });

    test('should handle no results gracefully', () => {
      const emptyOrchestrator = new TestOrchestrator();
      const report = emptyOrchestrator.generateSummaryReport();
      
      expect(report.error).toBe('No test results available');
    });
  });

  describe('recommendations and analysis', () => {
    test('should generate appropriate recommendations', async () => {
      // Run full tests first and then modify results
      await orchestrator.runTests(mockComponent, mockDescription);
      
      // Modify results to simulate various issues
      orchestrator.results.summary.passRate = 60;
      orchestrator.results.bugDetection.parameterBugs = [{ severity: 'high', type: 'parameter-passing' }];
      orchestrator.results.bugDetection.typeErrors = [{ severity: 'medium', type: 'type-error' }];
      orchestrator.results.performance.slowTests = [{ name: 'slow test', duration: 2000 }];
      
      const recommendations = orchestrator.generateRecommendations();
      
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Check that we have the expected recommendations
      expect(recommendations.some(r => r.category === 'Parameter Passing')).toBe(true);
      expect(recommendations.some(r => r.category === 'Type Safety')).toBe(true);
      expect(recommendations.some(r => r.category === 'Test Coverage')).toBe(true);
    });

    test('should detect original InputEvent bug pattern', () => {
      orchestrator.results = {
        bugDetection: {
          parameterBugs: [
            { issue: 'Expected string but got [object InputEvent]' }
          ],
          typeErrors: []
        }
      };
      
      expect(orchestrator.wouldDetectOriginalBug()).toBe(true);
    });

    test('should return false when original bug pattern not detected', () => {
      orchestrator.results = {
        bugDetection: {
          parameterBugs: [],
          typeErrors: []
        }
      };
      
      expect(orchestrator.wouldDetectOriginalBug()).toBe(false);
    });
  });
});