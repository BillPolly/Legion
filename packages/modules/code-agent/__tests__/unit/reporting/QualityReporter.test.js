/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { QualityReporter } from '../../../src/reporting/QualityReporter.js';
import { TestLogManager } from '../../../src/logging/TestLogManager.js';
import { LogAnalysisEngine } from '../../../src/logging/LogAnalysisEngine.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('QualityReporter', () => {
  let qualityReporter;
  let logManager;
  let logAnalyzer;
  let mockConfig;
  let mockESLintResult;
  let mockJestResult;

  beforeAll(() => {
    mockConfig = new RuntimeConfig({
      qualityReporter: {
        thresholds: {
          excellent: 90,
          good: 80,
          fair: 70,
          poor: 60
        }
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });

    // Mock ESLint result
    mockESLintResult = {
      executionId: 'eslint-123',
      correlationId: 'corr-123',
      exitCode: 0,
      results: [
        {
          filePath: '/test/src/index.js',
          messages: [
            {
              ruleId: 'no-unused-vars',
              severity: 2,
              message: "'unused' is assigned a value but never used",
              line: 2,
              column: 7,
              fix: null
            },
            {
              ruleId: 'no-console',
              severity: 1,
              message: 'Unexpected console statement',
              line: 5,
              column: 1,
              fix: { range: [50, 62], text: '' }
            }
          ],
          errorCount: 1,
          warningCount: 1,
          fixableErrorCount: 0,
          fixableWarningCount: 1
        }
      ],
      errorCount: 1,
      warningCount: 1,
      fixableErrorCount: 0,
      fixableWarningCount: 1,
      executionTime: 1500,
      performance: {
        executionTime: 1500,
        memoryUsage: { heapUsed: 50000000 },
        filesProcessed: 1,
        linesProcessed: 10
      },
      logs: {
        stdout: '[]',
        stderr: ''
      },
      timestamp: Date.now()
    };

    // Mock Jest result
    mockJestResult = {
      executionId: 'jest-123',
      correlationId: 'corr-456',
      exitCode: 0,
      testResults: [
        {
          testFilePath: '/test/src/__tests__/index.test.js',
          numFailingTests: 1,
          numPassingTests: 4,
          numPendingTests: 0,
          testResults: [
            {
              title: 'should pass test 1',
              status: 'passed',
              duration: 50,
              failureMessages: []
            },
            {
              title: 'should fail test 2',
              status: 'failed',
              duration: 100,
              failureMessages: ['Expected 3 but received 2']
            }
          ]
        }
      ],
      numTotalTests: 5,
      numPassedTests: 4,
      numFailedTests: 1,
      numPendingTests: 0,
      coverage: {
        global: {
          lines: { total: 100, covered: 85, pct: 85 },
          statements: { total: 95, covered: 80, pct: 84.21 },
          functions: { total: 20, covered: 18, pct: 90 },
          branches: { total: 40, covered: 32, pct: 80 }
        }
      },
      executionTime: 2000,
      performance: {
        executionTime: 2000,
        memoryUsage: { heapUsed: 60000000 },
        testsPerSecond: 2.5
      },
      logs: {
        stdout: 'Jest output',
        stderr: ''
      },
      timestamp: Date.now()
    };
  });

  beforeEach(() => {
    logManager = new TestLogManager(mockConfig.logManager);
    logAnalyzer = new LogAnalysisEngine(mockConfig);
    qualityReporter = new QualityReporter(mockConfig, logManager, logAnalyzer);
  });

  afterEach(async () => {
    if (qualityReporter) {
      await qualityReporter.cleanup();
    }
    if (logManager) {
      await logManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(qualityReporter.config).toBeDefined();
      expect(qualityReporter.logManager).toBeDefined();
      expect(qualityReporter.logAnalyzer).toBeDefined();
      expect(qualityReporter.isInitialized).toBe(false);
    });

    test('should initialize quality reporter', async () => {
      await qualityReporter.initialize();
      
      expect(qualityReporter.isInitialized).toBe(true);
      expect(qualityReporter.reportId).toBeDefined();
    });

    test('should emit initialization events', async () => {
      const events = [];
      qualityReporter.on('initializing', (event) => events.push(event));
      qualityReporter.on('initialized', (event) => events.push(event));
      
      await qualityReporter.initialize();
      
      expect(events).toHaveLength(2);
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[1]).toHaveProperty('reportId');
    });
  });

  describe('Quality Report Generation', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should generate comprehensive quality report', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report).toBeDefined();
      expect(report.reportId).toBeDefined();
      expect(report.correlationId).toBeDefined();
      expect(report.projectPath).toBe('/test/project');
      expect(report.timestamp).toBeDefined();
      expect(report.executionTime).toBeDefined();
    });

    test('should calculate overall quality score', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report.summary.overallScore).toBeDefined();
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
      expect(report.summary.qualityGrade).toMatch(/[A-F]/);
    });

    test('should include ESLint analysis', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report.eslint).toBeDefined();
      expect(report.eslint.summary).toBeDefined();
      expect(report.eslint.score).toBeDefined();
      expect(report.eslint.quality).toBeDefined();
      expect(report.eslint.issues).toBeDefined();
      expect(report.eslint.fixability).toBeDefined();
    });

    test('should include Jest analysis', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report.jest).toBeDefined();
      expect(report.jest.summary).toBeDefined();
      expect(report.jest.score).toBeDefined();
      expect(report.jest.coverage).toBeDefined();
      expect(report.jest.failures).toBeDefined();
    });

    test('should include quality metrics', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report.qualityMetrics).toBeDefined();
      expect(report.qualityMetrics.overallScore).toBeDefined();
      expect(report.qualityMetrics.testCoverage).toBeDefined();
      expect(report.qualityMetrics.codeQuality).toBeDefined();
      expect(report.qualityMetrics.performance).toBeDefined();
      expect(report.qualityMetrics.maintainability).toBeDefined();
      expect(report.qualityMetrics.reliability).toBeDefined();
      expect(report.qualityMetrics.security).toBeDefined();
    });

    test('should include insights', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report.insights).toBeDefined();
      expect(report.insights.strengths).toBeInstanceOf(Array);
      expect(report.insights.weaknesses).toBeInstanceOf(Array);
      expect(report.insights.opportunities).toBeInstanceOf(Array);
      expect(report.insights.risks).toBeInstanceOf(Array);
    });

    test('should include recommendations', async () => {
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report.recommendations).toBeDefined();
      expect(report.recommendations.immediate).toBeInstanceOf(Array);
      expect(report.recommendations.shortTerm).toBeInstanceOf(Array);
      expect(report.recommendations.longTerm).toBeInstanceOf(Array);
      expect(report.recommendations.priority).toBeInstanceOf(Array);
    });

    test('should emit report generation events', async () => {
      const events = [];
      qualityReporter.on('report-generation-started', (event) => events.push(event));
      qualityReporter.on('report-generation-completed', (event) => events.push(event));
      
      await qualityReporter.generateQualityReport(
        mockESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(events).toHaveLength(2);
      expect(events[0].type).toBeUndefined(); // No type property in started event
      expect(events[1]).toHaveProperty('report');
    });
  });

  describe('ESLint Analysis', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should analyze ESLint results correctly', async () => {
      const analysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      
      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.totalFiles).toBe(1);
      expect(analysis.summary.totalErrors).toBe(1);
      expect(analysis.summary.totalWarnings).toBe(1);
      expect(analysis.summary.fixableErrors).toBe(0);
      expect(analysis.summary.fixableWarnings).toBe(1);
    });

    test('should calculate ESLint score', async () => {
      const analysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      
      expect(analysis.score).toBeDefined();
      expect(analysis.score).toBeGreaterThanOrEqual(0);
      expect(analysis.score).toBeLessThanOrEqual(100);
      expect(analysis.quality).toMatch(/[A-F]/);
    });

    test('should categorize issues by rule', async () => {
      const analysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      
      expect(analysis.issues.byRule).toBeDefined();
      expect(analysis.issues.byRule['no-unused-vars']).toBeDefined();
      expect(analysis.issues.byRule['no-console']).toBeDefined();
      expect(analysis.issues.byRule['no-unused-vars'].count).toBe(1);
      expect(analysis.issues.byRule['no-console'].count).toBe(1);
    });

    test('should categorize issues by severity', async () => {
      const analysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      
      expect(analysis.issues.bySeverity).toBeDefined();
      expect(analysis.issues.bySeverity.error).toBe(1);
      expect(analysis.issues.bySeverity.warning).toBe(1);
    });

    test('should identify most common issues', async () => {
      const analysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      
      expect(analysis.issues.mostCommon).toBeInstanceOf(Array);
      expect(analysis.issues.mostCommon.length).toBeGreaterThan(0);
      expect(analysis.issues.mostCommon[0]).toHaveProperty('rule');
      expect(analysis.issues.mostCommon[0]).toHaveProperty('count');
      expect(analysis.issues.mostCommon[0]).toHaveProperty('severity');
    });

    test('should calculate fixability score', async () => {
      const analysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      
      expect(analysis.fixability).toBeDefined();
      expect(analysis.fixability.autoFixable).toBe(1);
      expect(analysis.fixability.manualFixRequired).toBe(1);
      expect(analysis.fixability.fixabilityScore).toBe(50); // 1 fixable out of 2 total
    });
  });

  describe('Jest Analysis', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should analyze Jest results correctly', async () => {
      const analysis = await qualityReporter.analyzeJestResults(mockJestResult);
      
      expect(analysis.summary).toBeDefined();
      expect(analysis.summary.totalTests).toBe(5);
      expect(analysis.summary.passedTests).toBe(4);
      expect(analysis.summary.failedTests).toBe(1);
      expect(analysis.summary.successRate).toBe(80);
    });

    test('should calculate Jest score', async () => {
      const analysis = await qualityReporter.analyzeJestResults(mockJestResult);
      
      expect(analysis.score).toBe(80); // Success rate
      expect(analysis.quality).toMatch(/[A-F]/);
    });

    test('should analyze coverage', async () => {
      const analysis = await qualityReporter.analyzeJestResults(mockJestResult);
      
      expect(analysis.coverage).toBeDefined();
      expect(analysis.coverage.lines).toBeDefined();
      expect(analysis.coverage.statements).toBeDefined();
      expect(analysis.coverage.functions).toBeDefined();
      expect(analysis.coverage.branches).toBeDefined();
      expect(analysis.coverage.score).toBeCloseTo(84.8, 1); // Average of coverage metrics
    });

    test('should categorize test failures', async () => {
      const analysis = await qualityReporter.analyzeJestResults(mockJestResult);
      
      expect(analysis.failures).toBeDefined();
      expect(analysis.failures.byType).toBeDefined();
      expect(analysis.failures.byFile).toBeDefined();
    });

    test('should identify failure patterns', async () => {
      const analysis = await qualityReporter.analyzeJestResults(mockJestResult);
      
      expect(analysis.failures.patterns).toBeInstanceOf(Array);
    });
  });

  describe('Quality Metrics Calculation', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should calculate comprehensive quality metrics', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const metrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      
      expect(metrics.overallScore).toBeDefined();
      expect(metrics.testCoverage).toBeDefined();
      expect(metrics.codeQuality).toBeDefined();
      expect(metrics.performance).toBeDefined();
      expect(metrics.maintainability).toBeDefined();
      expect(metrics.reliability).toBeDefined();
      expect(metrics.security).toBeDefined();
    });

    test('should calculate weighted overall score', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const metrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      
      expect(metrics.overallScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overallScore).toBeLessThanOrEqual(100);
    });

    test('should calculate performance score', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const metrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      
      expect(metrics.performance).toBeDefined();
      expect(metrics.performance).toBeGreaterThanOrEqual(0);
      expect(metrics.performance).toBeLessThanOrEqual(100);
    });

    test('should calculate maintainability score', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const metrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      
      expect(metrics.maintainability).toBeDefined();
      expect(metrics.maintainability).toBeGreaterThanOrEqual(0);
      expect(metrics.maintainability).toBeLessThanOrEqual(100);
    });

    test('should calculate security score', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const metrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      
      expect(metrics.security).toBeDefined();
      expect(metrics.security).toBeGreaterThanOrEqual(0);
      expect(metrics.security).toBeLessThanOrEqual(100);
    });
  });

  describe('Insights Generation', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should generate insights based on quality metrics', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const insights = await qualityReporter.generateInsights(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(insights.strengths).toBeInstanceOf(Array);
      expect(insights.weaknesses).toBeInstanceOf(Array);
      expect(insights.opportunities).toBeInstanceOf(Array);
      expect(insights.risks).toBeInstanceOf(Array);
    });

    test('should identify strengths correctly', async () => {
      // Mock high coverage result
      const highCoverageJestResult = { ...mockJestResult };
      highCoverageJestResult.coverage.global.lines.pct = 95;
      
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(highCoverageJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const insights = await qualityReporter.generateInsights(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(insights.strengths.some(s => s.includes('coverage'))).toBe(true);
    });

    test('should identify weaknesses correctly', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const insights = await qualityReporter.generateInsights(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(insights.weaknesses.some(w => w.includes('Failed tests'))).toBe(true);
    });

    test('should identify opportunities correctly', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const insights = await qualityReporter.generateInsights(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(insights.opportunities.some(o => o.includes('automatically fixed'))).toBe(true);
    });
  });

  describe('Recommendations Generation', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should generate actionable recommendations', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const recommendations = await qualityReporter.generateRecommendations(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(recommendations.immediate).toBeInstanceOf(Array);
      expect(recommendations.shortTerm).toBeInstanceOf(Array);
      expect(recommendations.longTerm).toBeInstanceOf(Array);
      expect(recommendations.priority).toBeInstanceOf(Array);
    });

    test('should prioritize failed tests in immediate actions', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const recommendations = await qualityReporter.generateRecommendations(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(recommendations.immediate.some(r => r.includes('failing tests'))).toBe(true);
    });

    test('should suggest auto-fix for fixable issues', async () => {
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const recommendations = await qualityReporter.generateRecommendations(eslintAnalysis, jestAnalysis, qualityMetrics);
      
      expect(recommendations.immediate.some(r => r.includes('auto-fix'))).toBe(true);
    });
  });

  describe('Trend Analysis', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should analyze trends with historical data', async () => {
      // Generate multiple reports to establish trends
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const trends = await qualityReporter.analyzeTrends(qualityMetrics);
      
      expect(trends.direction).toBeDefined();
      expect(trends.improvement).toBeDefined();
      expect(trends.comparison).toBeDefined();
    });

    test('should track quality trends over time', async () => {
      const report1 = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      const report2 = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      
      const trends = await qualityReporter.getQualityTrends();
      
      expect(trends.totalReports).toBe(2);
      expect(trends.qualityHistory).toHaveLength(2);
      expect(trends.qualityHistory[0]).toHaveProperty('overallScore');
      expect(trends.qualityHistory[0]).toHaveProperty('timestamp');
    });

    test('should forecast future quality scores', async () => {
      // Generate multiple reports to enable forecasting
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      
      const eslintAnalysis = await qualityReporter.analyzeESLintResults(mockESLintResult);
      const jestAnalysis = await qualityReporter.analyzeJestResults(mockJestResult);
      const qualityMetrics = await qualityReporter.calculateQualityMetrics(eslintAnalysis, jestAnalysis);
      const trends = await qualityReporter.analyzeTrends(qualityMetrics);
      
      expect(trends.forecast).toBeDefined();
      expect(trends.forecast.nextScore).toBeDefined();
      expect(trends.forecast.confidence).toBeDefined();
    });
  });

  describe('Report Export', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should export report in JSON format', async () => {
      const report = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      const exported = await qualityReporter.exportReport(report, 'json');
      
      expect(exported.format).toBe('json');
      expect(exported.content).toBeDefined();
      expect(exported.filename).toContain('.json');
      expect(() => JSON.parse(exported.content)).not.toThrow();
    });

    test('should export report in HTML format', async () => {
      const report = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      const exported = await qualityReporter.exportReport(report, 'html');
      
      expect(exported.format).toBe('html');
      expect(exported.content).toBeDefined();
      expect(exported.filename).toContain('.html');
      expect(exported.content).toContain('<!DOCTYPE html>');
    });

    test('should export report in Markdown format', async () => {
      const report = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      const exported = await qualityReporter.exportReport(report, 'markdown');
      
      expect(exported.format).toBe('markdown');
      expect(exported.content).toBeDefined();
      expect(exported.filename).toContain('.md');
      expect(exported.content).toContain('# Quality Report');
    });

    test('should export report in CSV format', async () => {
      const report = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      const exported = await qualityReporter.exportReport(report, 'csv');
      
      expect(exported.format).toBe('csv');
      expect(exported.content).toBeDefined();
      expect(exported.filename).toContain('.csv');
      expect(exported.content).toContain('"Metric","Value","Grade"');
    });

    test('should include export metadata', async () => {
      const report = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      const exported = await qualityReporter.exportReport(report, 'json');
      
      expect(exported.exportId).toBeDefined();
      expect(exported.size).toBeDefined();
      expect(exported.path).toBeDefined();
    });

    test('should handle unsupported export formats', async () => {
      const report = await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      
      await expect(qualityReporter.exportReport(report, 'unsupported')).rejects.toThrow('Unsupported export format');
    });
  });

  describe('Quality Grade Calculation', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should calculate quality grades correctly', () => {
      expect(qualityReporter.calculateQualityGrade(95)).toBe('A');
      expect(qualityReporter.calculateQualityGrade(85)).toBe('B');
      expect(qualityReporter.calculateQualityGrade(75)).toBe('C');
      expect(qualityReporter.calculateQualityGrade(65)).toBe('D');
      expect(qualityReporter.calculateQualityGrade(50)).toBe('F');
    });

    test('should handle edge cases for grade calculation', () => {
      expect(qualityReporter.calculateQualityGrade(90)).toBe('A'); // Exactly at threshold
      expect(qualityReporter.calculateQualityGrade(89.9)).toBe('B'); // Just below threshold
      expect(qualityReporter.calculateQualityGrade(0)).toBe('F'); // Minimum score
      expect(qualityReporter.calculateQualityGrade(100)).toBe('A'); // Maximum score
    });
  });

  describe('Test Failure Categorization', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should categorize test failures correctly', () => {
      expect(qualityReporter.categorizeTestFailure({ failureMessages: ['timeout exceeded'] })).toBe('timeout');
      expect(qualityReporter.categorizeTestFailure({ failureMessages: ['Expected 5 but received 3'] })).toBe('assertion');
      expect(qualityReporter.categorizeTestFailure({ failureMessages: ['mock function not called'] })).toBe('mocking');
      expect(qualityReporter.categorizeTestFailure({ failureMessages: ['async operation failed'] })).toBe('async');
      expect(qualityReporter.categorizeTestFailure({ failureMessages: ['syntax error: parsing failed'] })).toBe('syntax');
      expect(qualityReporter.categorizeTestFailure({ failureMessages: ['TypeError: cannot read property'] })).toBe('runtime');
      expect(qualityReporter.categorizeTestFailure({ failureMessages: [] })).toBe('unknown');
    });
  });

  describe('Report History', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should maintain report history', async () => {
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      
      const history = await qualityReporter.getReportHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0]).toHaveProperty('reportId');
      expect(history[1]).toHaveProperty('reportId');
    });

    test('should limit report history', async () => {
      // Generate more reports than limit
      for (let i = 0; i < 15; i++) {
        await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      }
      
      const history = await qualityReporter.getReportHistory(5);
      
      expect(history).toHaveLength(5); // Should return only last 5
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should handle missing ESLint results gracefully', async () => {
      const emptyESLintResult = { ...mockESLintResult, results: [] };
      
      const report = await qualityReporter.generateQualityReport(
        emptyESLintResult, 
        mockJestResult, 
        '/test/project'
      );
      
      expect(report).toBeDefined();
      expect(report.eslint.summary.totalFiles).toBe(0);
    });

    test('should handle missing Jest results gracefully', async () => {
      const emptyJestResult = { ...mockJestResult, testResults: [], numTotalTests: 0 };
      
      const report = await qualityReporter.generateQualityReport(
        mockESLintResult, 
        emptyJestResult, 
        '/test/project'
      );
      
      expect(report).toBeDefined();
      expect(report.jest.summary.totalTests).toBe(0);
    });

    test('should handle initialization failure', async () => {
      // Mock log manager to fail
      const failingLogManager = {
        initialize: jest.fn().mockRejectedValue(new Error('Log manager failed'))
      };
      
      const reporter = new QualityReporter(mockConfig, failingLogManager, logAnalyzer);
      
      await expect(reporter.initialize()).rejects.toThrow('Log manager failed');
    });
  });

  describe('Event Emissions', () => {
    beforeEach(async () => {
      await qualityReporter.initialize();
    });

    test('should emit cleanup events', async () => {
      const events = [];
      qualityReporter.on('cleanup-started', (event) => events.push(event));
      qualityReporter.on('cleanup-completed', (event) => events.push(event));
      
      await qualityReporter.cleanup();
      
      expect(events).toHaveLength(2);
      expect(events[0]).toHaveProperty('timestamp');
      expect(events[1]).toHaveProperty('timestamp');
    });

    test('should emit error events on failure', async () => {
      const events = [];
      qualityReporter.on('report-generation-failed', (event) => events.push(event));
      
      // Mock a failure by providing invalid data
      const invalidESLintResult = null;
      
      await expect(qualityReporter.generateQualityReport(
        invalidESLintResult, 
        mockJestResult, 
        '/test/project'
      )).rejects.toThrow();
      
      expect(events).toHaveLength(1);
      expect(events[0]).toHaveProperty('error');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await qualityReporter.initialize();
      
      // Generate a report to create resources
      await qualityReporter.generateQualityReport(mockESLintResult, mockJestResult, '/test/project');
      
      expect(qualityReporter.isInitialized).toBe(true);
      expect(qualityReporter.reportHistory.length).toBeGreaterThan(0);
      
      await qualityReporter.cleanup();
      
      expect(qualityReporter.isInitialized).toBe(false);
      expect(qualityReporter.reportId).toBeNull();
      expect(qualityReporter.reportHistory).toHaveLength(0);
    });
  });
});