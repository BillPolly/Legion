/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { TestExecutionEngine } from '../../../src/execution/TestExecutionEngine.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TestExecutionEngine', () => {
  let testEngine;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-test-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    testEngine = new TestExecutionEngine(mockConfig);
  });

  afterEach(async () => {
    if (testEngine) {
      await testEngine.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(testEngine.config).toBeDefined();
      expect(testEngine.isInitialized).toBe(false);
      expect(testEngine.activeTests).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await testEngine.initialize();
      
      expect(testEngine.isInitialized).toBe(true);
      expect(testEngine.logManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await testEngine.initialize();
      
      await expect(testEngine.initialize()).resolves.not.toThrow();
      expect(testEngine.isInitialized).toBe(true);
    });
  });

  describe('Jest Integration', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should run Jest tests successfully', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: true,
        coverageReporters: ['text', 'json'],
        verbose: true
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result).toBeDefined();
      expect(result.testRunId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.results).toBeDefined();
      expect(result.results.success).toBe(true);
      expect(result.results.numTotalTests).toBeGreaterThan(0);
      expect(result.results.numPassedTests).toBeGreaterThan(0);
    });

    test('should handle Jest test failures', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false,
        verbose: true
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.results.success).toBe(false);
      expect(result.results.numFailedTests).toBeGreaterThan(0);
    });

    test('should parse Jest test results correctly', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: 'math.test.js', // More specific pattern
        collectCoverage: true,
        verbose: true
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.results.testResults).toBeDefined();
      expect(Array.isArray(result.results.testResults)).toBe(true);
      expect(result.results.testResults.length).toBeGreaterThan(0);
      
      const testResult = result.results.testResults[0];
      expect(testResult.testFilePath).toBeDefined();
      expect(testResult.testResults).toBeDefined();
      expect(Array.isArray(testResult.testResults)).toBe(true);
    });

    test('should collect coverage information', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: 'math.test.js', // More specific pattern
        collectCoverage: true,
        coverageReporters: ['json'],
        verbose: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.results.coverageMap).toBeDefined();
      expect(result.coverage).toBeDefined();
      if (result.coverage) {
        expect(result.coverage.summary).toBeDefined();
        expect(result.coverage.byFile).toBeDefined();
      }
    });

    test('should handle Jest configuration errors', async () => {
      const invalidConfig = {
        projectPath: '/nonexistent/path',
        testPattern: '**/*.test.js'
      };

      const result = await testEngine.runJestTests(invalidConfig);
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    });
  });

  describe('Test Execution Management', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should track active test runs', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      const testPromise = testEngine.runJestTests(testConfig);
      
      // Check that test run is tracked
      expect(testEngine.activeTests.size).toBe(1);
      
      await testPromise;
      
      // Check that test run is removed after completion
      expect(testEngine.activeTests.size).toBe(0);
    });

    test('should handle multiple concurrent test runs', async () => {
      const testConfig1 = {
        projectPath: testProjectPath,
        testPattern: '**/math.test.js',
        collectCoverage: false
      };

      const testConfig2 = {
        projectPath: testProjectPath,
        testPattern: '**/string.test.js',
        collectCoverage: false
      };

      const promise1 = testEngine.runJestTests(testConfig1);
      const promise2 = testEngine.runJestTests(testConfig2);
      
      expect(testEngine.activeTests.size).toBe(2);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.testRunId).toBeDefined();
      expect(result2.testRunId).toBeDefined();
      expect(result1.testRunId).not.toBe(result2.testRunId);
      expect(testEngine.activeTests.size).toBe(0);
    });

    test('should get test run status', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      const testPromise = testEngine.runJestTests(testConfig);
      
      // Get the test run ID
      const testRunId = Array.from(testEngine.activeTests.keys())[0];
      
      const status = await testEngine.getTestRunStatus(testRunId);
      
      expect(status).toBeDefined();
      expect(status.testRunId).toBe(testRunId);
      expect(status.status).toBe('running');
      expect(status.startTime).toBeDefined();
      
      await testPromise;
    });

    test('should stop test run', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        timeout: 5000 // Longer timeout to allow stopping
      };

      const testPromise = testEngine.runJestTests(testConfig);
      
      // Wait a bit to ensure test has started
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Get the test run ID
      const testRunId = Array.from(testEngine.activeTests.keys())[0];
      
      const stopResult = await testEngine.stopTestRun(testRunId);
      
      expect(stopResult.testRunId).toBe(testRunId);
      expect(stopResult.status).toBe('stopped');
      
      const finalResult = await testPromise;
      expect(['stopped', 'completed']).toContain(finalResult.status);
    });
  });

  describe('Test Result Analysis', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should analyze test failures', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: 'failing.test.js', // More specific pattern
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const analysis = await testEngine.analyzeTestFailures(result);
      
      expect(analysis).toBeDefined();
      expect(analysis.failures).toBeDefined();
      expect(Array.isArray(analysis.failures)).toBe(true);
      expect(analysis.failures.length).toBeGreaterThan(0);
      
      const failure = analysis.failures[0];
      expect(failure.testName).toBeDefined();
      expect(failure.error).toBeDefined();
      expect(failure.category).toBeDefined();
      expect(failure.suggestions).toBeDefined();
    });

    test('should categorize test failures', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: 'failing.test.js', // More specific pattern
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const analysis = await testEngine.analyzeTestFailures(result);
      
      const categories = new Set(analysis.failures.map(f => f.category));
      expect(categories.size).toBeGreaterThan(0);
      
      const validCategories = ['assertion', 'timeout', 'error', 'syntax', 'import', 'unknown'];
      for (const category of categories) {
        expect(validCategories).toContain(category);
      }
    });

    test('should generate test suggestions', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const analysis = await testEngine.analyzeTestFailures(result);
      
      expect(analysis.suggestions).toBeDefined();
      expect(Array.isArray(analysis.suggestions)).toBe(true);
      
      for (const suggestion of analysis.suggestions) {
        expect(suggestion.id).toBeDefined();
        expect(suggestion.type).toBeDefined();
        expect(suggestion.description).toBeDefined();
        expect(suggestion.actions).toBeDefined();
        expect(Array.isArray(suggestion.actions)).toBe(true);
      }
    });

    test('should provide detailed failure analysis', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const analysis = await testEngine.analyzeTestFailures(result);
      
      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.totalFailures).toBeGreaterThan(0);
      expect(analysis.summary.categories).toBeDefined();
      expect(analysis.summary.commonPatterns).toBeDefined();
      expect(Array.isArray(analysis.summary.commonPatterns)).toBe(true);
    });

    test('should generate failure root cause analysis', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const rootCauseAnalysis = await testEngine.generateRootCauseAnalysis(result);
      
      expect(rootCauseAnalysis).toBeDefined();
      expect(rootCauseAnalysis.rootCauses).toBeDefined();
      expect(Array.isArray(rootCauseAnalysis.rootCauses)).toBe(true);
      expect(rootCauseAnalysis.impactAnalysis).toBeDefined();
      expect(rootCauseAnalysis.recommendedActions).toBeDefined();
    });

    test('should generate failure impact assessment', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const impactAssessment = await testEngine.generateFailureImpactAssessment(result);
      
      expect(impactAssessment).toBeDefined();
      expect(impactAssessment.severityScore).toBeDefined();
      expect(impactAssessment.affectedAreas).toBeDefined();
      expect(impactAssessment.businessImpact).toBeDefined();
      expect(impactAssessment.technicalImpact).toBeDefined();
    });

    test('should generate automated fix suggestions', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const fixSuggestions = await testEngine.generateAutomatedFixSuggestions(result);
      
      expect(fixSuggestions).toBeDefined();
      expect(Array.isArray(fixSuggestions)).toBe(true);
      
      for (const suggestion of fixSuggestions) {
        expect(suggestion.type).toBeDefined();
        expect(suggestion.description).toBeDefined();
        expect(suggestion.code).toBeDefined();
        expect(suggestion.confidence).toBeDefined();
        expect(suggestion.filePath).toBeDefined();
      }
    });

    test('should analyze test failure trends', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/failing.test.js',
        collectCoverage: false
      };

      // Run tests multiple times to generate trend data
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await testEngine.runJestTests(testConfig);
        results.push(result);
      }

      const trendAnalysis = await testEngine.analyzeFailureTrends(results);
      
      expect(trendAnalysis).toBeDefined();
      expect(trendAnalysis.trends).toBeDefined();
      expect(trendAnalysis.recurringFailures).toBeDefined();
      expect(trendAnalysis.improvementSuggestions).toBeDefined();
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should track test execution performance', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.performance.testSuites).toBeDefined();
      expect(result.performance.averageTestTime).toBeDefined();
    });

    test('should identify slow tests', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const analysis = await testEngine.analyzeTestPerformance(result);
      
      expect(analysis).toBeDefined();
      expect(analysis.slowTests).toBeDefined();
      expect(Array.isArray(analysis.slowTests)).toBe(true);
      expect(analysis.performanceMetrics).toBeDefined();
    });

    test('should provide performance recommendations', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      const analysis = await testEngine.analyzeTestPerformance(result);
      
      expect(analysis.recommendations).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
      
      for (const recommendation of analysis.recommendations) {
        expect(recommendation.type).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.impact).toBeDefined();
      }
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should emit test execution events', async () => {
      const events = [];
      
      testEngine.on('test-run-started', (event) => events.push({ type: 'started', ...event }));
      testEngine.on('test-run-completed', (event) => events.push({ type: 'completed', ...event }));
      testEngine.on('test-run-failed', (event) => events.push({ type: 'failed', ...event }));
      
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      await testEngine.runJestTests(testConfig);
      
      expect(events.length).toBeGreaterThan(0);
      expect(events.some(e => e.type === 'started')).toBe(true);
      expect(events.some(e => e.type === 'completed')).toBe(true);
    });

    test('should emit test progress events', async () => {
      const progressEvents = [];
      
      testEngine.on('test-progress', (event) => progressEvents.push(event));
      
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      await testEngine.runJestTests(testConfig);
      
      expect(progressEvents.length).toBeGreaterThan(0);
      
      for (const event of progressEvents) {
        expect(event.testRunId).toBeDefined();
        expect(event.progress).toBeDefined();
        expect(event.timestamp).toBeDefined();
      }
    });
  });

  describe('Advanced Jest Configuration', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should support Jest config files', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        configFile: 'jest.config.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });

    test('should support environment variables', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        env: {
          NODE_ENV: 'test',
          JEST_WORKER_ID: '1'
        }
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });

    test('should support custom Jest options', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        jestOptions: {
          bail: true,
          detectOpenHandles: true,
          forceExit: true
        }
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });

    test('should support custom reporters', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        reporters: ['default', 'jest-junit']
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });
  });

  describe('Test Filtering and Selection', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should filter tests by name pattern', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testNamePattern: 'add should',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });

    test('should run only changed tests', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        onlyChanged: true,
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      // Should handle case where no changed tests are found
    });

    test('should run tests related to specific files', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        findRelatedTests: ['src/math.js'],
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });

    test('should support test suites selection', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testSuites: ['math.test.js', 'string.test.js'],
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });
  });

  describe('Performance Optimization', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should optimize test execution order', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        optimizeTestOrder: true
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.performance.optimized).toBe(true);
    });

    test('should support test sharding', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        shard: '1/2' // Run first shard of 2
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBeGreaterThan(0);
    });

    test('should cache test results', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        cache: true
      };

      // First run
      const result1 = await testEngine.runJestTests(testConfig);
      expect(result1.status).toBe('completed');
      
      // Second run should be faster due to caching
      const result2 = await testEngine.runJestTests(testConfig);
      expect(result2.status).toBe('completed');
      expect(result2.performance.cached).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should handle Jest process crashes', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/crashing.test.js',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('error');
      expect(result.error).toBeDefined();
    }, 2000);

    test('should handle invalid test patterns', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: 'invalid/**/*.xyz',
        collectCoverage: false
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(result.status).toBe('completed');
      expect(result.results.numTotalTests).toBe(0);
    });

    test('should handle timeout scenarios', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: 'timeout.test.js', // More specific pattern
        collectCoverage: false,
        timeout: 500 // Very short timeout
      };

      const result = await testEngine.runJestTests(testConfig);
      
      expect(['timeout', 'error']).toContain(result.status);
      expect(result.error).toBeDefined();
    }, 2000);
  });

  describe('Enhanced Reporting', () => {
    beforeEach(async () => {
      await testEngine.initialize();
    });

    test('should generate detailed HTML report', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: true,
        reportFormats: ['html']
      };

      const result = await testEngine.runJestTests(testConfig);
      const htmlReport = await testEngine.generateDetailedReport(result, 'html');
      
      expect(htmlReport).toBeDefined();
      expect(htmlReport.format).toBe('html');
      expect(htmlReport.content).toContain('<html>');
      expect(htmlReport.content).toContain('Test Results');
      expect(htmlReport.filePath).toBeDefined();
    });

    test('should generate JSON report', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: true,
        reportFormats: ['json']
      };

      const result = await testEngine.runJestTests(testConfig);
      const jsonReport = await testEngine.generateDetailedReport(result, 'json');
      
      expect(jsonReport).toBeDefined();
      expect(jsonReport.format).toBe('json');
      expect(jsonReport.content).toBeDefined();
      
      const reportData = JSON.parse(jsonReport.content);
      expect(reportData.summary).toBeDefined();
      expect(reportData.testSuites).toBeDefined();
      expect(reportData.performance).toBeDefined();
    });

    test('should generate XML report', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        reportFormats: ['xml']
      };

      const result = await testEngine.runJestTests(testConfig);
      const xmlReport = await testEngine.generateDetailedReport(result, 'xml');
      
      expect(xmlReport).toBeDefined();
      expect(xmlReport.format).toBe('xml');
      expect(xmlReport.content).toContain('<?xml version="1.0"');
      expect(xmlReport.content).toContain('<testsuites');
    });

    test('should generate test trend analysis', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      // Run tests multiple times to generate trend data
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await testEngine.runJestTests(testConfig);
        results.push(result);
      }

      const trendAnalysis = await testEngine.generateTrendAnalysis(results);
      
      expect(trendAnalysis).toBeDefined();
      expect(trendAnalysis.trends).toBeDefined();
      expect(trendAnalysis.trends.performance).toBeDefined();
      expect(trendAnalysis.trends.testCounts).toBeDefined();
      expect(trendAnalysis.summary).toBeDefined();
    });

    test('should generate performance bottleneck report', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false,
        analyzePerformance: true
      };

      const result = await testEngine.runJestTests(testConfig);
      const bottleneckReport = await testEngine.generatePerformanceReport(result);
      
      expect(bottleneckReport).toBeDefined();
      expect(bottleneckReport.bottlenecks).toBeDefined();
      expect(bottleneckReport.recommendations).toBeDefined();
      expect(bottleneckReport.metrics).toBeDefined();
      expect(bottleneckReport.visualization).toBeDefined();
    });

    test('should generate coverage summary report', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: true,
        coverageReporters: ['json', 'html']
      };

      const result = await testEngine.runJestTests(testConfig);
      const coverageReport = await testEngine.generateCoverageReport(result);
      
      expect(coverageReport).toBeDefined();
      expect(coverageReport.summary).toBeDefined();
      expect(coverageReport.fileDetails).toBeDefined();
      expect(coverageReport.uncoveredLines).toBeDefined();
      expect(coverageReport.recommendations).toBeDefined();
    });

    test('should generate consolidated test report', async () => {
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: true,
        reportFormats: ['html', 'json', 'xml']
      };

      const result = await testEngine.runJestTests(testConfig);
      const consolidatedReport = await testEngine.generateConsolidatedReport(result);
      
      expect(consolidatedReport).toBeDefined();
      expect(consolidatedReport.summary).toBeDefined();
      expect(consolidatedReport.testResults).toBeDefined();
      expect(consolidatedReport.performance).toBeDefined();
      expect(consolidatedReport.coverage).toBeDefined();
      expect(consolidatedReport.recommendations).toBeDefined();
      expect(consolidatedReport.exports).toBeDefined();
      expect(consolidatedReport.exports.html).toBeDefined();
      expect(consolidatedReport.exports.json).toBeDefined();
      expect(consolidatedReport.exports.xml).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await testEngine.initialize();
      
      const testConfig = {
        projectPath: testProjectPath,
        testPattern: '**/*.test.js',
        collectCoverage: false
      };

      const testPromise = testEngine.runJestTests(testConfig);
      
      expect(testEngine.activeTests.size).toBe(1);
      
      await testEngine.cleanup();
      
      expect(testEngine.activeTests.size).toBe(0);
      expect(testEngine.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  
  // Create package.json
  const packageJson = {
    name: 'test-project',
    version: '1.0.0',
    scripts: {
      test: 'jest'
    },
    devDependencies: {
      jest: '^29.0.0'
    }
  };
  
  await fs.writeFile(
    path.join(projectPath, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Create src directory
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create source files
  await fs.writeFile(
    path.join(projectPath, 'src', 'math.js'),
    `
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
`
  );
  
  await fs.writeFile(
    path.join(projectPath, 'src', 'string.js'),
    `
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function reverse(str) {
  return str.split('').reverse().join('');
}

export function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}
`
  );
  
  // Create test directory
  await fs.mkdir(path.join(projectPath, '__tests__'), { recursive: true });
  
  // Create test files
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'math.test.js'),
    `
import { add, subtract, multiply, divide } from '../src/math.js';

describe('Math functions', () => {
  test('add should return sum of two numbers', () => {
    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
    expect(add(0, 0)).toBe(0);
  });

  test('subtract should return difference of two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
    expect(subtract(1, 1)).toBe(0);
    expect(subtract(0, 5)).toBe(-5);
  });

  test('multiply should return product of two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
    expect(multiply(-2, 3)).toBe(-6);
    expect(multiply(0, 100)).toBe(0);
  });

  test('divide should return quotient of two numbers', () => {
    expect(divide(10, 2)).toBe(5);
    expect(divide(7, 2)).toBe(3.5);
    expect(divide(0, 1)).toBe(0);
  });

  test('divide should throw error for division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });
});
`
  );
  
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'string.test.js'),
    `
import { capitalize, reverse, isPalindrome } from '../src/string.js';

describe('String functions', () => {
  test('capitalize should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('world')).toBe('World');
    expect(capitalize('a')).toBe('A');
  });

  test('reverse should reverse string', () => {
    expect(reverse('hello')).toBe('olleh');
    expect(reverse('abc')).toBe('cba');
    expect(reverse('a')).toBe('a');
  });

  test('isPalindrome should detect palindromes', () => {
    expect(isPalindrome('racecar')).toBe(true);
    expect(isPalindrome('A man a plan a canal Panama')).toBe(true);
    expect(isPalindrome('race a car')).toBe(false);
    expect(isPalindrome('hello')).toBe(false);
  });
});
`
  );
  
  // Create failing test
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'failing.test.js'),
    `
describe('Failing tests', () => {
  test('should fail with assertion error', () => {
    expect(2 + 2).toBe(5);
  });

  test('should fail with timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 10000));
  }, 1000);

  test('should fail with error', () => {
    throw new Error('Test error');
  });
});
`
  );
  
  // Create timeout test
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'timeout.test.js'),
    `
describe('Timeout tests', () => {
  test('should timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 5000));
  }, 1000);
});
`
  );
  
  // Create crashing test
  await fs.writeFile(
    path.join(projectPath, '__tests__', 'crashing.test.js'),
    `
describe('Crashing tests', () => {
  test('should crash process', () => {
    process.exit(1);
  });
});
`
  );
  
  // Create Jest config
  await fs.writeFile(
    path.join(projectPath, 'jest.config.js'),
    `
export default {
  testEnvironment: 'node',
  transform: {},
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 5000
};
`
  );

  // Install Jest in the test project
  try {
    await fs.writeFile(
      path.join(projectPath, 'node_modules', 'jest', 'bin', 'jest.js'),
      '#!/usr/bin/env node\nconsole.log("Mock Jest for testing");\nprocess.exit(0);'
    );
  } catch (error) {
    // Jest not available, will be handled by the test
  }
}