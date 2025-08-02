/**
 * UmbilicalTestingFramework - Main entry point for the complete testing framework
 * Integrates all components: introspection, test generation, execution, and reporting
 */
import { ComponentIntrospector } from './core/ComponentIntrospector.js';
import { TestOrchestrator } from './core/TestOrchestrator.js';
import { SelfTestingFramework } from './core/SelfTestingFramework.js';
import { ComponentDescriptor } from './core/ComponentDescriptor.js';

export class UmbilicalTestingFramework {
  constructor(options = {}) {
    this.options = {
      // Introspection options
      enableDeepIntrospection: options.enableDeepIntrospection ?? true,
      introspectionTimeout: options.introspectionTimeout ?? 10000,
      
      // Test execution options
      includeIntegrationTests: options.includeIntegrationTests ?? true,
      includeInvariantTests: options.includeInvariantTests ?? true,
      includeFlowTests: options.includeFlowTests ?? true,
      includeActorTests: options.includeActorTests ?? true,
      parallelExecution: options.parallelExecution ?? false,
      testTimeout: options.testTimeout ?? 30000,
      
      // Reporting options
      verboseLogging: options.verboseLogging ?? false,
      generateDetailedReport: options.generateDetailedReport ?? true,
      includeRecommendations: options.includeRecommendations ?? true,
      
      // Bug detection options
      enableBugDetection: options.enableBugDetection ?? true,
      detectParameterBugs: options.detectParameterBugs ?? true,
      detectCoordinationBugs: options.detectCoordinationBugs ?? true,
      
      ...options
    };

    this.introspector = new ComponentIntrospector(this.options);
    this.orchestrator = new TestOrchestrator(this.options);
    this.selfTester = new SelfTestingFramework();
    
    this.results = null;
  }

  /**
   * Test a component with comprehensive analysis
   * @param {Object|Function} component - Component to test
   * @param {Object} options - Additional testing options
   * @returns {Promise<Object>} Complete test results with analysis
   */
  async testComponent(component, options = {}) {
    this.log('=== Starting Umbilical Testing Framework ===');
    const startTime = Date.now();

    try {
      // Phase 1: Component Introspection
      this.log('Phase 1: Component Introspection');
      const description = ComponentIntrospector.introspect(component);
      this.log(`Introspected ${description.summary?.totalCapabilities || 0} capabilities`);

      // Phase 2: Generate Component Description Language (CDL)
      this.log('Phase 2: Generating Component Description Language');
      const cdl = ComponentDescriptor.generateCDL(description);
      this.log(`Generated CDL with ${Object.keys(cdl).length} sections`);

      // Phase 3: Execute Comprehensive Tests
      this.log('Phase 3: Executing Comprehensive Tests');
      const testResults = await this.orchestrator.runTests(component, description);
      this.log(`Executed ${testResults.summary.totalTests} tests`);

      // Phase 4: Analysis and Reporting
      this.log('Phase 4: Analysis and Reporting');
      const analysis = this.analyzeResults(testResults, description, cdl);
      
      // Phase 5: Generate Final Report
      this.log('Phase 5: Generating Final Report');
      const report = this.generateComprehensiveReport(
        component, description, cdl, testResults, analysis
      );

      this.results = {
        component: component.name || 'Anonymous',
        description,
        cdl,
        testResults,
        analysis,
        report,
        duration: Date.now() - startTime,
        framework: {
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          options: this.options
        }
      };

      this.log(`=== Testing completed in ${this.results.duration}ms ===`);
      return this.results;

    } catch (error) {
      this.log(`=== Testing failed: ${error.message} ===`);
      return {
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        component: component.name || 'Anonymous'
      };
    }
  }

  /**
   * Analyze test results for insights and patterns
   * @param {Object} testResults - Results from test orchestrator
   * @param {Object} description - Component description
   * @param {Object} cdl - Component Description Language
   * @returns {Object} Analysis results
   */
  analyzeResults(testResults, description, cdl) {
    this.log('Analyzing test results...');

    const analysis = {
      bugAnalysis: this.analyzeBugs(testResults),
      coverageAnalysis: this.analyzeCoverage(testResults, description),
      performanceAnalysis: this.analyzePerformance(testResults),
      qualityMetrics: this.calculateQualityMetrics(testResults, description),
      riskAssessment: this.assessRisks(testResults),
      complianceCheck: this.checkCompliance(testResults, cdl)
    };

    return analysis;
  }

  /**
   * Analyze bugs found during testing
   * @param {Object} testResults - Test results
   * @returns {Object} Bug analysis
   */
  analyzeBugs(testResults) {
    const bugs = testResults.bugDetection;
    const allBugs = [
      ...bugs.coordinationBugs,
      ...bugs.parameterBugs,
      ...bugs.invariantViolations,
      ...bugs.typeErrors
    ];

    // Normalize severity levels
    const normalizedBugs = allBugs.map(bug => ({
      ...bug,
      severity: this.normalizeSeverity(bug.severity)
    }));

    return {
      totalBugs: normalizedBugs.length,
      bugsByType: {
        coordination: bugs.coordinationBugs.length,
        parameter: bugs.parameterBugs.length,
        invariant: bugs.invariantViolations.length,
        type: bugs.typeErrors.length
      },
      bugsBySeverity: {
        high: normalizedBugs.filter(b => b.severity === 'high').length,
        medium: normalizedBugs.filter(b => b.severity === 'medium').length,
        low: normalizedBugs.filter(b => b.severity === 'low').length
      },
      criticalBugs: normalizedBugs.filter(b => b.severity === 'high'),
      wouldDetectOriginalBug: this.checkOriginalBugDetection(bugs),
      patterns: this.identifyBugPatterns(normalizedBugs)
    };
  }

  /**
   * Analyze test coverage
   * @param {Object} testResults - Test results
   * @param {Object} description - Component description
   * @returns {Object} Coverage analysis
   */
  analyzeCoverage(testResults, description) {
    const coverage = testResults.coverage;
    const total = coverage.domElements + coverage.stateProperties + 
                 coverage.events + coverage.dependencies;

    return {
      totalCapabilities: total,
      coverageByType: {
        dom: { tested: coverage.domElements, available: description.domStructure?.total || 0 },
        state: { tested: coverage.stateProperties, available: description.stateProperties?.total || 0 },
        events: { tested: coverage.events, available: description.events?.total || 0 },
        dependencies: { tested: coverage.dependencies, available: description.dependencies?.total || 0 }
      },
      flowCoverage: coverage.userFlows,
      invariantCoverage: coverage.invariants,
      overallCoveragePercentage: this.calculateOverallCoverage(coverage, description)
    };
  }

  /**
   * Analyze performance metrics
   * @param {Object} testResults - Test results
   * @returns {Object} Performance analysis
   */
  analyzePerformance(testResults) {
    const perf = testResults.performance;
    
    return {
      totalExecutionTime: testResults.totalDuration,
      averageTestTime: perf.averageTestTime,
      slowTests: perf.slowTests,
      generationTime: perf.totalGenerationTime,
      executionTime: perf.totalExecutionTime,
      efficiency: {
        testsPerSecond: testResults.summary.totalTests / (testResults.totalDuration / 1000),
        timePerCapability: testResults.totalDuration / (testResults.coverage.domElements + 
                          testResults.coverage.stateProperties + testResults.coverage.events || 1)
      }
    };
  }

  /**
   * Calculate quality metrics
   * @param {Object} testResults - Test results
   * @param {Object} description - Component description
   * @returns {Object} Quality metrics
   */
  calculateQualityMetrics(testResults, description) {
    const totalBugs = testResults.bugDetection.summary?.totalBugs || 0;
    const criticalBugs = testResults.bugDetection.summary?.highSeverity || 0;
    const passRate = testResults.summary.passRate;

    return {
      overallQualityScore: this.calculateQualityScore(passRate, totalBugs, criticalBugs),
      testReliability: passRate,
      bugDensity: totalBugs / (testResults.summary.totalTests || 1),
      criticalityIndex: criticalBugs / (totalBugs || 1),
      robustness: this.calculateRobustness(testResults),
      maintainability: this.calculateMaintainability(description),
      grade: this.assignQualityGrade(passRate, totalBugs, criticalBugs)
    };
  }

  /**
   * Assess risks based on test results
   * @param {Object} testResults - Test results
   * @returns {Object} Risk assessment
   */
  assessRisks(testResults) {
    const bugs = testResults.bugDetection;
    const risks = [];

    // Parameter passing risks
    if (bugs.parameterBugs.length > 0) {
      risks.push({
        type: 'parameter-passing',
        severity: 'high',
        impact: 'Data corruption, unexpected behavior',
        probability: 'high',
        mitigation: 'Implement strict parameter validation'
      });
    }

    // Type safety risks
    if (bugs.typeErrors.length > 0) {
      risks.push({
        type: 'type-safety',
        severity: 'medium',
        impact: 'Runtime errors, application crashes',
        probability: 'medium',
        mitigation: 'Add comprehensive type checking'
      });
    }

    // Coordination risks
    if (bugs.coordinationBugs.length > 0) {
      risks.push({
        type: 'coordination',
        severity: 'medium',
        impact: 'Race conditions, inconsistent state',
        probability: 'medium',
        mitigation: 'Improve event handling and state coordination'
      });
    }

    // Performance risks
    if (testResults.performance.slowTests.length > 0) {
      risks.push({
        type: 'performance',
        severity: 'low',
        impact: 'Poor user experience',
        probability: 'low',
        mitigation: 'Optimize slow operations'
      });
    }

    return {
      totalRisks: risks.length,
      risksByType: this.groupRisksByType(risks),
      highPriorityRisks: risks.filter(r => r.severity === 'high'),
      recommendations: this.generateRiskMitigation(risks)
    };
  }

  /**
   * Check compliance with best practices
   * @param {Object} testResults - Test results
   * @param {Object} cdl - Component Description Language
   * @returns {Object} Compliance check
   */
  checkCompliance(testResults, cdl) {
    const compliance = {
      hasStateManagement: cdl.stateProperties && Object.keys(cdl.stateProperties).length > 0,
      hasEventHandling: cdl.events && Object.keys(cdl.events).length > 0,
      hasErrorHandling: this.checkErrorHandling(testResults),
      hasTypeValidation: this.checkTypeValidation(testResults),
      hasInvariantProtection: this.checkInvariantProtection(testResults),
      followsArchitecture: this.checkArchitecturalCompliance(cdl)
    };

    const complianceScore = Object.values(compliance).filter(Boolean).length / 
                           Object.keys(compliance).length * 100;

    return {
      ...compliance,
      overallCompliance: complianceScore,
      violations: this.identifyComplianceViolations(compliance),
      recommendations: this.generateComplianceRecommendations(compliance)
    };
  }

  /**
   * Generate comprehensive report
   * @param {Object|Function} component - Original component
   * @param {Object} description - Component description
   * @param {Object} cdl - Component Description Language
   * @param {Object} testResults - Test results
   * @param {Object} analysis - Analysis results
   * @returns {Object} Comprehensive report
   */
  generateComprehensiveReport(component, description, cdl, testResults, analysis) {
    const report = {
      executive: {
        component: component.name || 'Anonymous',
        timestamp: new Date().toISOString(),
        duration: testResults.totalDuration,
        overallScore: analysis.qualityMetrics.overallQualityScore,
        grade: analysis.qualityMetrics.grade,
        wouldDetectOriginalBug: analysis.bugAnalysis.wouldDetectOriginalBug,
        summary: `Executed ${testResults.summary.totalTests} tests with ${testResults.summary.passRate.toFixed(1)}% pass rate. Found ${analysis.bugAnalysis.totalBugs} bugs (${analysis.bugAnalysis.bugsBySeverity?.high || 0} critical).`
      },
      
      testing: {
        summary: testResults.summary,
        generators: Object.keys(testResults.generators).map(name => ({
          name,
          testsGenerated: testResults.generators[name].testsGenerated,
          passed: testResults.generators[name].passed,
          failed: testResults.generators[name].failed
        })),
        coverage: analysis.coverageAnalysis,
        performance: analysis.performanceAnalysis
      },
      
      bugs: {
        summary: analysis.bugAnalysis,
        details: testResults.bugDetection,
        patterns: analysis.bugAnalysis.patterns,
        recommendations: testResults.bugDetection.recommendations || []
      },
      
      quality: {
        metrics: analysis.qualityMetrics,
        risks: analysis.riskAssessment,
        compliance: analysis.complianceCheck
      },
      
      component: {
        description: description.summary,
        cdl: cdl,
        capabilities: {
          dom: description.domStructure?.total || 0,
          state: description.stateProperties?.total || 0,
          events: description.events?.total || 0,
          dependencies: description.dependencies?.total || 0
        }
      },
      
      actionItems: this.generateActionItems(analysis),
      
      appendix: {
        detailedResults: this.options.generateDetailedReport ? testResults : null,
        frameworkVersion: '1.0.0',
        options: this.options
      }
    };

    return report;
  }

  /**
   * Run self-tests on the framework itself
   * @returns {Promise<Object>} Self-test results
   */
  async runSelfTests() {
    this.log('Running framework self-tests...');
    return await this.selfTester.runSelfTests();
  }

  /**
   * Helper methods
   */

  calculateQualityScore(passRate, totalBugs, criticalBugs) {
    // Base score from pass rate (0-70 points)
    let score = (passRate / 100) * 70;
    
    // Deduct points for bugs (0-30 points)
    const bugPenalty = Math.min(totalBugs * 5, 20);
    const criticalPenalty = Math.min(criticalBugs * 10, 20);
    
    score = Math.max(0, score - bugPenalty - criticalPenalty);
    
    return Math.round(score);
  }

  assignQualityGrade(passRate, totalBugs, criticalBugs) {
    if (criticalBugs > 0) return 'F';
    if (passRate < 50 || totalBugs > 10) return 'D';
    if (passRate < 70 || totalBugs > 5) return 'C';
    if (passRate < 85 || totalBugs > 2) return 'B';
    if (passRate < 95 || totalBugs > 0) return 'A';
    return 'A+';
  }

  calculateRobustness(testResults) {
    const failedTests = testResults.summary.failed;
    const totalTests = testResults.summary.totalTests;
    return totalTests > 0 ? ((totalTests - failedTests) / totalTests) * 100 : 0;
  }

  calculateMaintainability(description) {
    const complexity = (description.domStructure?.total || 0) + 
                      (description.stateProperties?.total || 0) + 
                      (description.events?.total || 0);
    return Math.max(0, 100 - complexity * 2); // Simpler components are more maintainable
  }

  calculateOverallCoverage(coverage, description) {
    const total = (description.domStructure?.total || 0) + 
                 (description.stateProperties?.total || 0) + 
                 (description.events?.total || 0) + 
                 (description.dependencies?.total || 0);
    
    const covered = coverage.domElements + coverage.stateProperties + 
                   coverage.events + coverage.dependencies;
    
    return total > 0 ? (covered / total) * 100 : 0;
  }

  checkOriginalBugDetection(bugs) {
    // The original bug was [object InputEvent] instead of the actual value
    return bugs.parameterBugs.some(bug => 
      (bug.issue && bug.issue.includes('[object')) ||
      (bug.error && bug.error.includes('[object'))
    );
  }

  identifyBugPatterns(bugs) {
    const patterns = [];
    
    // Pattern: Multiple parameter bugs suggest systematic issue
    const parameterBugs = bugs.filter(b => b.type === 'parameter-passing');
    if (parameterBugs.length > 1) {
      patterns.push({
        pattern: 'multiple-parameter-bugs',
        description: 'Multiple parameter passing bugs suggest systematic validation issues',
        recommendation: 'Implement centralized parameter validation'
      });
    }
    
    // Pattern: Type errors with parameter bugs
    const typeErrors = bugs.filter(b => b.type === 'type-error');
    if (typeErrors.length > 0 && parameterBugs.length > 0) {
      patterns.push({
        pattern: 'type-parameter-correlation',
        description: 'Type errors correlate with parameter bugs',
        recommendation: 'Add runtime type checking at component boundaries'
      });
    }
    
    return patterns;
  }

  generateActionItems(analysis) {
    const items = [];
    
    // Critical bugs
    if (analysis.bugAnalysis.bugsBySeverity && analysis.bugAnalysis.bugsBySeverity.high > 0) {
      items.push({
        priority: 'CRITICAL',
        category: 'Bug Fixes',
        action: `Fix ${analysis.bugAnalysis.bugsBySeverity.high} critical bug(s)`,
        timeline: 'Immediate'
      });
    }
    
    // Poor test coverage
    if (analysis.coverageAnalysis.overallCoveragePercentage < 80) {
      items.push({
        priority: 'HIGH',
        category: 'Test Coverage',
        action: 'Improve test coverage to at least 80%',
        timeline: 'Short term'
      });
    }
    
    // Performance issues
    if (analysis.performanceAnalysis && analysis.performanceAnalysis.slowTests && analysis.performanceAnalysis.slowTests.length > 0) {
      items.push({
        priority: 'MEDIUM',
        category: 'Performance',
        action: `Optimize ${analysis.performanceAnalysis.slowTests.length} slow test(s)`,
        timeline: 'Medium term'
      });
    }
    
    return items;
  }

  checkErrorHandling(testResults) {
    // Check if any tests specifically tested error conditions
    if (!testResults.generators) return false;
    return Object.values(testResults.generators).some(generator =>
      generator.results && generator.results.some(test =>
        test.name.includes('error') || test.name.includes('exception')
      )
    );
  }

  checkTypeValidation(testResults) {
    if (!testResults.generators) return false;
    const invariantResults = testResults.generators['InvariantTestGenerator'];
    return invariantResults && invariantResults.testsGenerated > 0;
  }

  checkInvariantProtection(testResults) {
    if (!testResults || !testResults.bugDetection) return false;
    return testResults.bugDetection.invariantViolations && testResults.bugDetection.invariantViolations.length === 0;
  }

  checkArchitecturalCompliance(cdl) {
    // Check if component follows MVVM architecture patterns
    return !!(cdl.stateProperties && cdl.events && cdl.domStructure);
  }

  identifyComplianceViolations(compliance) {
    const violations = [];
    Object.entries(compliance).forEach(([key, value]) => {
      if (!value && key !== 'overallCompliance') {
        violations.push(key);
      }
    });
    return violations;
  }

  generateComplianceRecommendations(compliance) {
    const recommendations = [];
    
    if (!compliance.hasStateManagement) {
      recommendations.push('Add proper state management to component');
    }
    if (!compliance.hasEventHandling) {
      recommendations.push('Implement event handling for user interactions');
    }
    if (!compliance.hasErrorHandling) {
      recommendations.push('Add comprehensive error handling');
    }
    
    return recommendations;
  }

  groupRisksByType(risks) {
    return risks.reduce((acc, risk) => {
      acc[risk.type] = (acc[risk.type] || 0) + 1;
      return acc;
    }, {});
  }

  generateRiskMitigation(risks) {
    return risks.map(risk => ({
      risk: risk.type,
      mitigation: risk.mitigation,
      priority: risk.severity
    }));
  }

  /**
   * Normalize severity levels from different sources
   * @param {string} severity - Original severity level
   * @returns {string} Normalized severity (high/medium/low)
   */
  normalizeSeverity(severity) {
    if (!severity) return 'low';
    
    const severityLower = severity.toLowerCase();
    
    // Map CoordinationBugDetector severities
    if (severityLower === 'error') return 'high';
    if (severityLower === 'warning') return 'medium';
    
    // Map standard severities
    if (severityLower === 'high' || severityLower === 'critical') return 'high';
    if (severityLower === 'medium' || severityLower === 'moderate') return 'medium';
    if (severityLower === 'low' || severityLower === 'minor') return 'low';
    
    // Default to medium for unknown severities
    return 'medium';
  }

  log(message) {
    if (this.options.verboseLogging) {
      console.log(`[UmbilicalTesting] ${message}`);
    }
  }
}

// Export main framework class
export default UmbilicalTestingFramework;