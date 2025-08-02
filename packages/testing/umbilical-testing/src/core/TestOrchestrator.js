/**
 * TestOrchestrator - Central orchestrator for running all tests across different generators
 * Coordinates test execution, aggregates results, and provides comprehensive reporting
 */
import { DOMTestGenerator } from '../generators/DOMTestGenerator.js';
import { StateTestGenerator } from '../generators/StateTestGenerator.js';
import { EventTestGenerator } from '../generators/EventTestGenerator.js';
import { DependencyTestGenerator } from '../generators/DependencyTestGenerator.js';
import { FlowTestGenerator } from '../generators/FlowTestGenerator.js';
import { ActorTestGenerator } from '../generators/ActorTestGenerator.js';
import { InvariantTestGenerator } from '../generators/InvariantTestGenerator.js';
import { JSOMValidator } from '../validators/JSOMValidator.js';
import { CoordinationBugDetector } from '../validators/CoordinationBugDetector.js';

export class TestOrchestrator {
  constructor(options = {}) {
    this.options = {
      includeIntegrationTests: options.includeIntegrationTests ?? true,
      includeInvariantTests: options.includeInvariantTests ?? true,
      includeFlowTests: options.includeFlowTests ?? true,
      includeActorTests: options.includeActorTests ?? true,
      parallelExecution: options.parallelExecution ?? false,
      timeoutMs: options.timeoutMs ?? 30000,
      verboseLogging: options.verboseLogging ?? false,
      ...options
    };

    this.generators = [
      DOMTestGenerator,
      StateTestGenerator,
      EventTestGenerator,
      DependencyTestGenerator
    ];

    if (this.options.includeFlowTests) {
      this.generators.push(FlowTestGenerator);
    }

    if (this.options.includeActorTests) {
      this.generators.push(ActorTestGenerator);
    }

    if (this.options.includeInvariantTests) {
      this.generators.push(InvariantTestGenerator);
    }

    this.testEnvironment = null;
    this.results = null;
  }

  /**
   * Run comprehensive test suite for a component
   * @param {Object|Function} component - Component to test
   * @param {Object} description - Component description from introspection
   * @returns {Promise<Object>} Complete test results
   */
  async runTests(component, description) {
    this.log('Starting comprehensive test execution...');
    const startTime = Date.now();

    try {
      // Initialize test environment
      this.testEnvironment = JSOMValidator.createTestEnvironment();
      
      // Initialize results structure
      this.results = {
        component: component.name || 'Anonymous',
        description,
        startTime,
        endTime: null,
        totalDuration: 0,
        summary: {
          totalTests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          passRate: 0
        },
        generators: {},
        bugDetection: {
          coordinationBugs: [],
          parameterBugs: [],
          invariantViolations: [],
          typeErrors: []
        },
        performance: {
          slowTests: [],
          averageTestTime: 0,
          totalGenerationTime: 0,
          totalExecutionTime: 0
        },
        coverage: {
          domElements: 0,
          stateProperties: 0,
          events: 0,
          dependencies: 0,
          userFlows: 0,
          invariants: 0
        }
      };

      // Generate and execute tests from all generators
      await this.executeGeneratorTests(component, description);

      // Run bug detection analysis
      await this.runBugDetection(component, description);

      // Calculate final metrics
      this.calculateFinalMetrics();

      this.results.endTime = Date.now();
      this.results.totalDuration = this.results.endTime - startTime;

      this.log(`Test execution completed in ${this.results.totalDuration}ms`);
      return this.results;

    } catch (error) {
      this.log(`Test execution failed: ${error.message}`);
      this.results = this.results || {};
      this.results.error = error.message;
      this.results.endTime = Date.now();
      this.results.totalDuration = (this.results.endTime || Date.now()) - startTime;
      return this.results;
    }
  }

  /**
   * Execute tests from all configured generators
   * @param {Object|Function} component - Component to test
   * @param {Object} description - Component description
   */
  async executeGeneratorTests(component, description) {
    this.log('Executing generator tests...');
    const generationStartTime = Date.now();

    for (const Generator of this.generators) {
      const generatorName = Generator.name;
      this.log(`Running ${generatorName}...`);
      
      const generatorStartTime = Date.now();
      
      try {
        // Generate tests for this generator
        const tests = Generator.generateTests(description);
        
        // Execute the generated tests
        const results = await this.executeTests(tests, component, Generator);
        
        this.results.generators[generatorName] = {
          testsGenerated: tests.length,
          testsExecuted: results.length,
          passed: results.filter(r => r.success !== false && !r.error).length,
          failed: results.filter(r => r.success === false || r.error).length,
          results,
          executionTime: Date.now() - generatorStartTime
        };

        // Update summary counts
        this.results.summary.totalTests += results.length;
        this.results.summary.passed += this.results.generators[generatorName].passed;
        this.results.summary.failed += this.results.generators[generatorName].failed;

        // Update coverage metrics
        this.updateCoverageMetrics(Generator, description, tests);

      } catch (error) {
        this.log(`Error in ${generatorName}: ${error.message}`);
        this.results.generators[generatorName] = {
          testsGenerated: 0,
          testsExecuted: 0,
          passed: 0,
          failed: 1,
          error: error.message,
          executionTime: Date.now() - generatorStartTime
        };
        this.results.summary.failed += 1;
        this.results.summary.totalTests += 1;
      }
    }

    this.results.performance.totalGenerationTime = Date.now() - generationStartTime;
  }

  /**
   * Execute a set of tests from a generator
   * @param {Array} tests - Tests to execute
   * @param {Object|Function} component - Component to test
   * @param {Function} Generator - Generator class for context
   * @returns {Promise<Array>} Test results
   */
  async executeTests(tests, component, Generator) {
    const results = [];
    const executionStartTime = Date.now();

    for (const test of tests) {
      const testStartTime = Date.now();
      
      try {
        this.log(`  Executing: ${test.name}`);
        
        // Execute the test with timeout
        const result = await this.executeWithTimeout(
          () => test.execute(component, this.testEnvironment),
          this.options.timeoutMs
        );

        const testDuration = Date.now() - testStartTime;
        
        results.push({
          name: test.name,
          category: test.category,
          type: test.type,
          success: result.success !== false && !result.error,
          result,
          duration: testDuration,
          generator: Generator.name
        });

        // Track slow tests
        if (testDuration > 1000) { // Tests over 1 second
          this.results.performance.slowTests.push({
            name: test.name,
            generator: Generator.name,
            duration: testDuration
          });
        }

      } catch (error) {
        const testDuration = Date.now() - testStartTime;
        this.log(`  Test failed: ${test.name} - ${error.message}`);
        
        results.push({
          name: test.name,
          category: test.category,
          type: test.type,
          success: false,
          error: error.message,
          duration: testDuration,
          generator: Generator.name
        });
      }
    }

    this.results.performance.totalExecutionTime += Date.now() - executionStartTime;
    return results;
  }

  /**
   * Run bug detection analysis
   * @param {Object|Function} component - Component to test
   * @param {Object} description - Component description
   */
  async runBugDetection(component, description) {
    this.log('Running bug detection analysis...');
    
    try {
      // Create component instance for analysis
      const componentInstance = await this.createComponentInstance(component);
      
      // Run coordination bug detection
      const coordinationResults = await CoordinationBugDetector.detectBugs(
        componentInstance, description, this.testEnvironment
      );
      this.results.bugDetection.coordinationBugs = coordinationResults.bugs || [];

      // Analyze parameter passing bugs from test results
      this.analyzeParameterBugs();

      // Analyze invariant violations from invariant tests
      this.analyzeInvariantViolations();

      // Analyze type errors from all tests
      this.analyzeTypeErrors();

    } catch (error) {
      this.log(`Bug detection failed: ${error.message}`);
      this.results.bugDetection.error = error.message;
    }
  }

  /**
   * Analyze parameter passing bugs from test results
   */
  analyzeParameterBugs() {
    const parameterBugs = [];

    // Look through all test results for signs of parameter bugs
    Object.values(this.results.generators).forEach(generatorResult => {
      if (!generatorResult.results) return;

      generatorResult.results.forEach(testResult => {
        if (testResult.result && testResult.result.issues) {
          testResult.result.issues.forEach(issue => {
            if (typeof issue === 'string' && 
                (issue.includes('[object') || 
                 issue.includes('toString()') ||
                 issue.includes('unexpected object'))) {
              parameterBugs.push({
                test: testResult.name,
                generator: testResult.generator,
                issue,
                severity: 'high',
                type: 'parameter-passing'
              });
            }
          });
        }

        // Check for [object Object] or similar in error messages
        if (testResult.error && typeof testResult.error === 'string') {
          if (testResult.error.includes('[object') || 
              testResult.error.includes('toString()')) {
            parameterBugs.push({
              test: testResult.name,
              generator: testResult.generator,
              error: testResult.error,
              severity: 'high',
              type: 'parameter-passing'
            });
          }
        }
      });
    });

    this.results.bugDetection.parameterBugs = parameterBugs;
  }

  /**
   * Analyze invariant violations from invariant test results
   */
  analyzeInvariantViolations() {
    const violations = [];

    const invariantResults = this.results.generators['InvariantTestGenerator'];
    if (invariantResults && invariantResults.results) {
      invariantResults.results.forEach(testResult => {
        if (testResult.result && testResult.result.invariantViolations) {
          testResult.result.invariantViolations.forEach(violation => {
            violations.push({
              test: testResult.name,
              violation,
              severity: this.assessViolationSeverity(violation),
              type: 'invariant-violation'
            });
          });
        }
      });
    }

    this.results.bugDetection.invariantViolations = violations;
  }

  /**
   * Analyze type errors from all test results
   */
  analyzeTypeErrors() {
    const typeErrors = [];

    Object.values(this.results.generators).forEach(generatorResult => {
      if (!generatorResult.results) return;

      generatorResult.results.forEach(testResult => {
        // Check for type-related errors
        if (testResult.error && this.isTypeError(testResult.error)) {
          typeErrors.push({
            test: testResult.name,
            generator: testResult.generator,
            error: testResult.error,
            severity: 'medium',
            type: 'type-error'
          });
        }

        // Check for type violations in test results
        if (testResult.result && testResult.result.violations) {
          testResult.result.violations.forEach(violation => {
            if (violation.type && violation.type.includes('TYPE')) {
              typeErrors.push({
                test: testResult.name,
                generator: testResult.generator,
                violation,
                severity: 'medium',
                type: 'type-error'
              });
            }
          });
        }
      });
    });

    this.results.bugDetection.typeErrors = typeErrors;
  }

  /**
   * Calculate final metrics and summaries
   */
  calculateFinalMetrics() {
    // Calculate pass rate
    if (this.results.summary.totalTests > 0) {
      this.results.summary.passRate = 
        (this.results.summary.passed / this.results.summary.totalTests) * 100;
    }

    // Calculate average test time
    const allTestDurations = [];
    Object.values(this.results.generators).forEach(generatorResult => {
      if (generatorResult.results) {
        generatorResult.results.forEach(testResult => {
          allTestDurations.push(testResult.duration || 0);
        });
      }
    });

    if (allTestDurations.length > 0) {
      this.results.performance.averageTestTime = 
        allTestDurations.reduce((sum, duration) => sum + duration, 0) / allTestDurations.length;
    }

    // Sort slow tests by duration
    this.results.performance.slowTests.sort((a, b) => b.duration - a.duration);

    // Calculate bug severity summary
    this.results.bugDetection.summary = {
      totalBugs: this.getAllBugs().length,
      highSeverity: this.getAllBugs().filter(b => b.severity === 'high').length,
      mediumSeverity: this.getAllBugs().filter(b => b.severity === 'medium').length,
      lowSeverity: this.getAllBugs().filter(b => b.severity === 'low').length
    };
  }

  /**
   * Update coverage metrics based on generator and tests
   * @param {Function} Generator - Generator class
   * @param {Object} description - Component description
   * @param {Array} tests - Generated tests
   */
  updateCoverageMetrics(Generator, description, tests) {
    switch (Generator.name) {
      case 'DOMTestGenerator':
        this.results.coverage.domElements = description.domStructure?.total || 0;
        break;
      case 'StateTestGenerator':
        this.results.coverage.stateProperties = description.stateProperties?.total || 0;
        break;
      case 'EventTestGenerator':
        this.results.coverage.events = description.events?.total || 0;
        break;
      case 'DependencyTestGenerator':
        this.results.coverage.dependencies = description.dependencies?.total || 0;
        break;
      case 'FlowTestGenerator':
        this.results.coverage.userFlows = tests.length;
        break;
      case 'InvariantTestGenerator':
        this.results.coverage.invariants = tests.length;
        break;
    }
  }

  /**
   * Helper methods
   */

  async createComponentInstance(component) {
    const dependencies = {
      dom: this.testEnvironment.dom,
      eventSystem: this.testEnvironment.eventSystem,
      actorSpace: this.testEnvironment.actorSpace,
      ...this.testEnvironment.dependencies
    };

    if (component && typeof component.create === 'function') {
      return component.create(dependencies);
    } else if (typeof component === 'function' && component.create) {
      return component.create(dependencies);
    }
    
    // Return mock component
    return {
      dependencies,
      created: true,
      mockComponent: true
    };
  }

  async executeWithTimeout(fn, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Test timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      Promise.resolve(fn())
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  assessViolationSeverity(violation) {
    if (!violation.violations || !Array.isArray(violation.violations)) {
      return 'low';
    }

    // Check for high severity violations
    if (violation.violations.some(v => 
        v.includes('TYPE_INVARIANT_VIOLATION') ||
        v.includes('LIFECYCLE_VIOLATION') ||
        v.includes('[object')
    )) {
      return 'high';
    }

    // Check for medium severity violations
    if (violation.violations.some(v => 
        v.includes('MONOTONICITY_VIOLATION') ||
        v.includes('CONSTRAINT_VIOLATION')
    )) {
      return 'medium';
    }

    return 'low';
  }

  isTypeError(error) {
    if (typeof error !== 'string') return false;
    
    return error.includes('TypeError') ||
           error.includes('is not a function') ||
           error.includes('Cannot read prop') ||
           error.includes('undefined') ||
           error.includes('[object') ||
           error.includes('NaN');
  }

  getAllBugs() {
    return [
      ...(this.results.bugDetection.coordinationBugs || []),
      ...(this.results.bugDetection.parameterBugs || []),
      ...(this.results.bugDetection.invariantViolations || []),
      ...(this.results.bugDetection.typeErrors || [])
    ];
  }

  log(message) {
    if (this.options.verboseLogging) {
      console.log(`[TestOrchestrator] ${message}`);
    }
  }

  /**
   * Generate summary report
   * @returns {Object} Summary report
   */
  generateSummaryReport() {
    if (!this.results) {
      return { error: 'No test results available' };
    }

    const allBugs = this.getAllBugs();

    return {
      component: this.results.component,
      duration: this.results.totalDuration,
      summary: this.results.summary,
      coverage: this.results.coverage,
      bugsSummary: this.results.bugDetection.summary,
      criticalIssues: allBugs.filter(b => b.severity === 'high'),
      recommendations: this.generateRecommendations(),
      wouldDetectInputEventBug: this.wouldDetectOriginalBug()
    };
  }

  /**
   * Generate recommendations based on test results
   * @returns {Array} List of recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const allBugs = this.getAllBugs();

    // Parameter passing bugs
    const parameterBugs = allBugs.filter(b => b.type === 'parameter-passing');
    if (parameterBugs.length > 0) {
      recommendations.push({
        category: 'Parameter Passing',
        priority: 'high',
        issue: `Found ${parameterBugs.length} parameter passing bug(s)`,
        solution: 'Add type validation and ensure proper parameter extraction from events'
      });
    }

    // Type errors
    const typeErrors = allBugs.filter(b => b.type === 'type-error');
    if (typeErrors.length > 0) {
      recommendations.push({
        category: 'Type Safety',
        priority: 'medium',
        issue: `Found ${typeErrors.length} type error(s)`,
        solution: 'Implement stronger type checking and validation'
      });
    }

    // Low test coverage
    if (this.results.summary.passRate < 90) {
      recommendations.push({
        category: 'Test Coverage',
        priority: 'medium',
        issue: `Test pass rate is ${this.results.summary.passRate.toFixed(1)}%`,
        solution: 'Investigate failing tests and improve component robustness'
      });
    }

    // Performance issues
    if (this.results.performance.slowTests.length > 0) {
      recommendations.push({
        category: 'Performance',
        priority: 'low',
        issue: `Found ${this.results.performance.slowTests.length} slow test(s)`,
        solution: 'Optimize component performance for better user experience'
      });
    }

    return recommendations;
  }

  /**
   * Check if the framework would detect the original [object InputEvent] bug
   * @returns {boolean} Would detect the bug
   */
  wouldDetectOriginalBug() {
    // Check for parameter passing bugs that match the original issue
    const parameterBugs = this.results.bugDetection.parameterBugs;
    const hasInputEventBug = parameterBugs.some(bug => 
      bug.issue && bug.issue.includes('[object') ||
      bug.error && bug.error.includes('[object')
    );

    // Check for type violations that would catch toString() calls
    const typeErrors = this.results.bugDetection.typeErrors;
    const hasTypeViolation = typeErrors.some(error => 
      error.violation && error.violation.type === 'TYPE_INVARIANT_VIOLATION'
    );

    return hasInputEventBug || hasTypeViolation;
  }
}