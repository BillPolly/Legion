/**
 * Unit tests for UmbilicalTestingFramework
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { UmbilicalTestingFramework } from '../../src/UmbilicalTestingFramework.js';

describe('UmbilicalTestingFramework', () => {
  let framework;
  let mockComponent;

  beforeEach(() => {
    framework = new UmbilicalTestingFramework({
      verboseLogging: false,
      testTimeout: 5000
    });

    mockComponent = {
      name: 'TestComponent',
      describe: function(descriptor) {
        descriptor.name('TestComponent')
          .description('A test component for framework testing')
          .requires('eventSystem', 'EventSystem')
          .optional('dom', 'DOMElement')
          .manages('value', 'string', { default: '' })
          .manages('count', 'number', { default: 0 })
          .emits('stateChange', 'object')
          .emits('userAction', 'string')
          .listens('input', 'string')
          .listens('click', 'object')
          .creates('input[type=text]', { attributes: { value: 'state.value' } })
          .creates('button');
      },
      create: (deps) => ({
        dependencies: deps,
        state: new Map([['value', ''], ['count', 0]]),
        setState: function(key, value) { 
          this.state.set(key, value);
          if (this.config.eventSystem) {
            this.config.eventSystem.dispatchEvent('stateChange', { property: key, value });
          }
        },
        getState: function(key) { return this.state.get(key); },
        emit: function(event, payload) {
          if (this.config.eventSystem) {
            this.config.eventSystem.dispatchEvent(event, payload);
          }
        },
        render: function() {
          if (this.config.dom) {
            const element = this.config.dom.createElement('div');
            element.innerHTML = `<input type="text" value="${this.getState('value')}"><button>Submit</button>`;
            return element;
          }
        },
        created: true
      })
    };
  });

  describe('constructor', () => {
    test('should create framework with default options', () => {
      const defaultFramework = new UmbilicalTestingFramework();
      
      expect(defaultFramework.options.enableDeepIntrospection).toBe(true);
      expect(defaultFramework.options.includeIntegrationTests).toBe(true);
      expect(defaultFramework.options.includeInvariantTests).toBe(true);
      expect(defaultFramework.options.enableBugDetection).toBe(true);
      expect(defaultFramework.options.generateDetailedReport).toBe(true);
    });

    test('should initialize all core components', () => {
      expect(framework.introspector).toBeDefined();
      expect(framework.orchestrator).toBeDefined();
      expect(framework.selfTester).toBeDefined();
    });

    test('should accept custom options', () => {
      const customFramework = new UmbilicalTestingFramework({
        enableDeepIntrospection: false,
        includeInvariantTests: false,
        verboseLogging: true
      });
      
      expect(customFramework.options.enableDeepIntrospection).toBe(false);
      expect(customFramework.options.includeInvariantTests).toBe(false);
      expect(customFramework.options.verboseLogging).toBe(true);
    });
  });

  describe('testComponent', () => {
    test('should execute complete testing workflow', async () => {
      const results = await framework.testComponent(mockComponent);

      // Check main structure
      expect(results.component).toBe('TestComponent');
      expect(results.description).toBeDefined();
      expect(results.cdl).toBeDefined();
      expect(results.testResults).toBeDefined();
      expect(results.analysis).toBeDefined();
      expect(results.report).toBeDefined();
      expect(results.duration).toBeGreaterThan(0);

      // Check framework metadata
      expect(results.framework.version).toBe('1.0.0');
      expect(results.framework.timestamp).toBeDefined();
      expect(results.framework.options).toBeDefined();

      // Check that all phases completed
      expect(results.description.summary).toBeDefined();
      expect(results.cdl.summary).toBeDefined();
      expect(results.testResults.summary.totalTests).toBeGreaterThan(0);
      expect(results.analysis.bugAnalysis).toBeDefined();
      expect(results.report.executive).toBeDefined();
    }, 15000);

    test('should handle component without name', async () => {
      const anonymousComponent = {
        describe: function(descriptor) {
          descriptor.name('Anonymous')
            .description('Anonymous test component')
            .optional('dom', 'DOMElement');
        },
        create: (deps) => ({ dependencies: deps, created: true })
      };

      const results = await framework.testComponent(anonymousComponent);
      
      expect(results.component).toBe('Anonymous');
      expect(results.report.executive.component).toBe('Anonymous');
    });

    test('should handle errors gracefully', async () => {
      const errorComponent = {
        describe: function(descriptor) {
          descriptor.name('ErrorComponent')
            .description('Component that throws errors')
            .requires('eventSystem', 'EventSystem');
        },
        create: () => { throw new Error('Component creation failed'); }
      };

      const results = await framework.testComponent(errorComponent);
      
      expect(results).toBeDefined();
      expect(results.error || results.testResults?.summary?.failed > 0).toBeTruthy();
      expect(results.duration).toBeGreaterThanOrEqual(0);
      expect(results.framework?.timestamp || results.timestamp).toBeDefined();
    });

    test('should work with minimal component', async () => {
      const minimalComponent = {
        name: 'MinimalComponent',
        describe: function(descriptor) {
          descriptor.name('MinimalComponent')
            .description('Minimal test component');
        }
      };

      const results = await framework.testComponent(minimalComponent);
      
      expect(results.component).toBe('MinimalComponent');
      expect(results.testResults.summary.totalTests).toBeGreaterThanOrEqual(0);
    });
  });

  describe('analyzeResults', () => {
    test('should perform comprehensive analysis', () => {
      const mockTestResults = {
        summary: { totalTests: 10, passed: 8, failed: 2, passRate: 80 },
        bugDetection: {
          coordinationBugs: [],
          parameterBugs: [{ severity: 'high', type: 'parameter-passing' }],
          invariantViolations: [],
          typeErrors: [{ severity: 'medium', type: 'type-error' }]
        },
        coverage: { domElements: 2, stateProperties: 2, events: 2, dependencies: 1 },
        performance: { slowTests: [], averageTestTime: 150, totalGenerationTime: 100, totalExecutionTime: 500 },
        totalDuration: 1000
      };

      const mockDescription = {
        domStructure: { total: 2 },
        stateProperties: { total: 2 },
        events: { total: 2 },
        dependencies: { total: 1 }
      };

      const mockCDL = {
        summary: 'Test CDL',
        stateProperties: { value: 'string', count: 'number' },
        events: { change: 'emits', input: 'listens' }
      };

      const analysis = framework.analyzeResults(mockTestResults, mockDescription, mockCDL);

      expect(analysis.bugAnalysis).toBeDefined();
      expect(analysis.bugAnalysis.totalBugs).toBe(2);
      expect(analysis.bugAnalysis.bugsByType.parameter).toBe(1);
      expect(analysis.bugAnalysis.bugsByType.type).toBe(1);

      expect(analysis.coverageAnalysis).toBeDefined();
      expect(analysis.coverageAnalysis.totalCapabilities).toBe(7);

      expect(analysis.performanceAnalysis).toBeDefined();
      expect(analysis.performanceAnalysis.efficiency.testsPerSecond).toBeGreaterThan(0);

      expect(analysis.qualityMetrics).toBeDefined();
      expect(analysis.qualityMetrics.testReliability).toBe(80);

      expect(analysis.riskAssessment).toBeDefined();
      expect(analysis.riskAssessment.totalRisks).toBeGreaterThan(0);

      expect(analysis.complianceCheck).toBeDefined();
      expect(typeof analysis.complianceCheck.overallCompliance).toBe('number');
    });
  });

  describe('analyzeBugs', () => {
    test('should analyze bug patterns and severity', () => {
      const mockTestResults = {
        bugDetection: {
          coordinationBugs: [{ severity: 'medium' }],
          parameterBugs: [
            { severity: 'high', issue: 'Found [object InputEvent] instead of value' },
            { severity: 'high', type: 'parameter-passing' }
          ],
          invariantViolations: [{ severity: 'low' }],
          typeErrors: [{ severity: 'medium' }]
        }
      };

      const analysis = framework.analyzeBugs(mockTestResults);

      expect(analysis.totalBugs).toBe(5);
      expect(analysis.bugsByType.parameter).toBe(2);
      expect(analysis.bugsBySeverity.high).toBe(2);
      expect(analysis.criticalBugs.length).toBe(2);
      expect(analysis.wouldDetectOriginalBug).toBe(true);
      expect(analysis.patterns).toBeDefined();
    });

    test('should identify bug patterns', () => {
      const bugs = [
        { type: 'parameter-passing', severity: 'high' },
        { type: 'parameter-passing', severity: 'medium' },
        { type: 'type-error', severity: 'medium' }
      ];

      const patterns = framework.identifyBugPatterns(bugs);

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.some(p => p.pattern === 'multiple-parameter-bugs')).toBe(true);
      expect(patterns.some(p => p.pattern === 'type-parameter-correlation')).toBe(true);
    });
  });

  describe('analyzeCoverage', () => {
    test('should calculate coverage metrics', () => {
      const testResults = {
        coverage: { domElements: 2, stateProperties: 2, events: 2, dependencies: 1 }
      };
      const description = {
        domStructure: { total: 3 },
        stateProperties: { total: 2 },
        events: { total: 2 },
        dependencies: { total: 1 }
      };

      const analysis = framework.analyzeCoverage(testResults, description);

      expect(analysis.totalCapabilities).toBe(7);
      expect(analysis.coverageByType.dom.tested).toBe(2);
      expect(analysis.coverageByType.dom.available).toBe(3);
      expect(analysis.overallCoveragePercentage).toBeCloseTo(87.5); // 7/8 * 100
    });
  });

  describe('calculateQualityMetrics', () => {
    test('should calculate comprehensive quality metrics', () => {
      const testResults = {
        summary: { totalTests: 10, passRate: 85 },
        bugDetection: { summary: { totalBugs: 2, highSeverity: 1 } }
      };
      const description = {
        domStructure: { total: 2 },
        stateProperties: { total: 2 },
        events: { total: 2 }
      };

      const metrics = framework.calculateQualityMetrics(testResults, description);

      expect(metrics.overallQualityScore).toBeGreaterThan(0);
      expect(metrics.testReliability).toBe(85);
      expect(metrics.bugDensity).toBe(0.2); // 2 bugs / 10 tests
      expect(metrics.grade).toMatch(/[A-F]/);
      expect(typeof metrics.robustness).toBe('number');
      expect(typeof metrics.maintainability).toBe('number');
    });

    test('should assign correct quality grades', () => {
      expect(framework.assignQualityGrade(95, 0, 0)).toBe('A+');
      expect(framework.assignQualityGrade(90, 1, 0)).toBe('A');
      expect(framework.assignQualityGrade(80, 3, 0)).toBe('B');
      expect(framework.assignQualityGrade(65, 6, 0)).toBe('C');
      expect(framework.assignQualityGrade(45, 12, 0)).toBe('D');
      expect(framework.assignQualityGrade(80, 0, 1)).toBe('F'); // Critical bugs = F
    });
  });

  describe('assessRisks', () => {
    test('should identify and categorize risks', () => {
      const testResults = {
        bugDetection: {
          parameterBugs: [{ severity: 'high' }],
          typeErrors: [{ severity: 'medium' }],
          coordinationBugs: [{ severity: 'medium' }],
          invariantViolations: []
        },
        performance: {
          slowTests: [{ duration: 2000, name: 'slow test' }]
        }
      };

      const assessment = framework.assessRisks(testResults);

      expect(assessment.totalRisks).toBe(4);
      expect(assessment.highPriorityRisks.length).toBe(1);
      expect(assessment.risksByType['parameter-passing']).toBe(1);
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('checkCompliance', () => {
    test('should check architectural compliance', () => {
      const testResults = {
        generators: {
          InvariantTestGenerator: { testsGenerated: 5 }
        },
        bugDetection: { invariantViolations: [] }
      };
      const cdl = {
        stateProperties: { value: 'string' },
        events: { change: 'emits' },
        domStructure: { input: 'creates' }
      };

      const compliance = framework.checkCompliance(testResults, cdl);

      expect(compliance.hasStateManagement).toBe(true);
      expect(compliance.hasEventHandling).toBe(true);
      expect(compliance.hasTypeValidation).toBe(true);
      expect(compliance.hasInvariantProtection).toBe(true);
      expect(compliance.followsArchitecture).toBe(true);
      expect(compliance.overallCompliance).toBeGreaterThan(0);
    });
  });

  describe('generateComprehensiveReport', () => {
    test('should generate detailed report', () => {
      const mockAnalysis = {
        bugAnalysis: { totalBugs: 1, wouldDetectOriginalBug: true },
        coverageAnalysis: { overallCoveragePercentage: 85 },
        performanceAnalysis: { averageTestTime: 100 },
        qualityMetrics: { overallQualityScore: 75, grade: 'B' },
        riskAssessment: { totalRisks: 2 },
        complianceCheck: { overallCompliance: 80 }
      };

      const mockTestResults = {
        summary: { totalTests: 10, passRate: 80 },
        totalDuration: 1000,
        generators: { TestGen: { testsGenerated: 5, passed: 4, failed: 1 } },
        bugDetection: { parameterBugs: [] }
      };

      const mockDescription = {
        summary: 'Test component',
        domStructure: { total: 2 },
        stateProperties: { total: 2 }
      };

      const mockCDL = { summary: 'Test CDL' };

      const report = framework.generateComprehensiveReport(
        mockComponent, mockDescription, mockCDL, mockTestResults, mockAnalysis
      );

      expect(report.executive).toBeDefined();
      expect(report.executive.component).toBe('TestComponent');
      expect(report.executive.overallScore).toBe(75);
      expect(report.executive.grade).toBe('B');
      expect(report.executive.wouldDetectOriginalBug).toBe(true);

      expect(report.testing).toBeDefined();
      expect(report.bugs).toBeDefined();
      expect(report.quality).toBeDefined();
      expect(report.component).toBeDefined();
      expect(report.actionItems).toBeDefined();
      expect(report.appendix).toBeDefined();
    });
  });

  describe('runSelfTests', () => {
    test('should run framework self-tests', async () => {
      const selfTestResults = await framework.runSelfTests();
      
      expect(selfTestResults).toBeDefined();
      expect(selfTestResults.summary).toBeDefined();
      expect(selfTestResults.timestamp).toBeDefined();
    });
  });

  describe('helper methods', () => {
    test('should calculate quality score correctly', () => {
      expect(framework.calculateQualityScore(100, 0, 0)).toBe(70);
      expect(framework.calculateQualityScore(90, 1, 0)).toBe(58); // 90% of 70 minus 5 for bug
      expect(framework.calculateQualityScore(80, 0, 1)).toBe(46); // 80% of 70 minus 10 for critical
      expect(framework.calculateQualityScore(50, 10, 5)).toBe(0); // Capped at 0
    });

    test('should calculate robustness correctly', () => {
      const testResults = { summary: { failed: 2, totalTests: 10 } };
      expect(framework.calculateRobustness(testResults)).toBe(80);
      
      const perfectResults = { summary: { failed: 0, totalTests: 10 } };
      expect(framework.calculateRobustness(perfectResults)).toBe(100);
    });

    test('should calculate maintainability correctly', () => {
      const simpleDescription = {
        domStructure: { total: 1 },
        stateProperties: { total: 1 },
        events: { total: 1 }
      };
      expect(framework.calculateMaintainability(simpleDescription)).toBe(94); // 100 - 3*2

      const complexDescription = {
        domStructure: { total: 10 },
        stateProperties: { total: 10 },
        events: { total: 10 }
      };
      expect(framework.calculateMaintainability(complexDescription)).toBe(40); // 100 - 30*2
    });

    test('should check original bug detection', () => {
      const bugsWithInputEvent = {
        parameterBugs: [{ issue: 'Found [object InputEvent] instead of value' }],
        typeErrors: []
      };
      expect(framework.checkOriginalBugDetection(bugsWithInputEvent)).toBe(true);

      const bugsWithoutInputEvent = {
        parameterBugs: [{ issue: 'Normal parameter error' }],
        typeErrors: []
      };
      expect(framework.checkOriginalBugDetection(bugsWithoutInputEvent)).toBe(false);
    });

    test('should generate action items based on analysis', () => {
      const analysisWithCriticalBugs = {
        bugAnalysis: { bugsBySeverity: { high: 2, medium: 1, low: 0 } },
        coverageAnalysis: { overallCoveragePercentage: 60 },
        performanceAnalysis: { slowTests: [{ name: 'slow test' }] }
      };

      const actionItems = framework.generateActionItems(analysisWithCriticalBugs);

      expect(actionItems.length).toBeGreaterThan(0);
      expect(actionItems.some(item => item.priority === 'CRITICAL')).toBe(true);
      expect(actionItems.some(item => item.category === 'Test Coverage')).toBe(true);
      expect(actionItems.some(item => item.category === 'Performance')).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    test('should detect [object InputEvent] bug pattern', async () => {
      // Create component that exhibits the original bug
      const buggyComponent = {
        name: 'BuggyComponent',
        describe: function(descriptor) {
          descriptor.name('BuggyComponent')
            .description('Component with [object InputEvent] bug')
            .requires('eventSystem', 'EventSystem')
            .manages('value', 'string', { default: '' })
            .listens('input', 'object'); // Note: listens to object but should handle string
        },
        create: (deps) => {
          const component = {
            dependencies: deps,
            state: new Map([['value', '']]),
            handleInput: function(event) {
              // This is the bug - using event object instead of event.target.value
              this.state.set('value', event); // Should be event.target.value
              return event.toString(); // Will return [object InputEvent]
            },
            setState: function(key, value) { 
              // Trigger the bug during setState to ensure it's caught during testing
              const mockEvent = { type: 'input', target: { value: 'test' }, toString: () => '[object InputEvent]' };
              const result = this.handleInput(mockEvent);
              if (result.includes('[object')) {
                throw new Error(`Parameter bug detected: ${result}`);
              }
              this.state.set(key, value); 
            },
            getState: function(key) { return this.state.get(key); },
            created: true
          };
          return component;
        }
      };

      const results = await framework.testComponent(buggyComponent);

      // Should detect the parameter bug pattern
      expect(results.analysis.bugAnalysis.wouldDetectOriginalBug).toBe(true);
      expect(results.report.executive.wouldDetectOriginalBug).toBe(true);
    }, 10000);

    test('should provide comprehensive recommendations for quality improvement', async () => {
      const results = await framework.testComponent(mockComponent);


      expect(results.report.actionItems).toBeDefined();
      expect(Array.isArray(results.report.actionItems)).toBe(true);
      
      if (results.analysis.bugAnalysis.totalBugs > 0) {
        expect(results.report.actionItems.some(item => 
          item.category === 'Bug Fixes'
        )).toBe(true);
      }
    }, 10000);
  });
});