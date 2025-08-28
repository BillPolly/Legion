/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { TestResultAggregator } from '../../../src/aggregation/TestResultAggregator.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';

describe('TestResultAggregator', () => {
  let aggregator;
  let mockConfig;
  let mockJestResults;
  let mockESLintResults;
  let mockComprehensiveResults;

  beforeEach(() => {
    mockConfig = new RuntimeConfig({
      aggregation: {
        coverageThresholds: {
          excellent: 90,
          good: 80,
          fair: 70,
          poor: 60
        },
        performanceThresholds: {
          responseTime: 1000,
          throughput: 100,
          errorRate: 0.01
        },
        trendAnalysis: {
          enabled: true,
          historySize: 10,
          forecastingEnabled: true
        }
      }
    });

    aggregator = new TestResultAggregator(mockConfig);

    // Mock Jest results
    mockJestResults = {
      type: 'jest',
      results: {
        numTotalTests: 100,
        numPassedTests: 95,
        numFailedTests: 5,
        numPendingTests: 0,
        executionTime: 5000,
        coverage: {
          global: {
            lines: { total: 1000, covered: 850 },
            statements: { total: 1000, covered: 850 },
            functions: { total: 200, covered: 180 },
            branches: { total: 400, covered: 320 }
          }
        },
        testResults: [
          {
            testFilePath: '/src/components/__tests__/Button.test.js',
            numTotalTests: 10,
            numPassingTests: 9,
            numFailingTests: 1,
            testResults: [
              {
                title: 'should render correctly',
                status: 'failed',
                failureMessages: ['Expected button to be visible']
              }
            ]
          }
        ]
      }
    };

    // Mock ESLint results
    mockESLintResults = {
      type: 'eslint',
      results: [
        {
          filePath: '/src/index.js',
          errorCount: 2,
          warningCount: 3,
          fixableErrorCount: 1,
          fixableWarningCount: 2
        }
      ]
    };

    // Mock comprehensive results
    mockComprehensiveResults = {
      type: 'comprehensive',
      results: {
        summary: {
          totalTests: 150,
          passedTests: 140,
          failedTests: 10,
          skippedTests: 0,
          executionTime: 8000
        },
        phases: [
          { type: 'unit', total: 100, passed: 95, failed: 5 },
          { type: 'integration', total: 30, passed: 28, failed: 2 },
          { type: 'e2e', total: 20, passed: 17, failed: 3 }
        ],
        coverage: {
          lines: 85,
          statements: 85,
          functions: 90,
          branches: 80
        },
        performance: {
          avgResponseTime: 850,
          throughput: 120,
          errorRate: 0.008
        }
      }
    };
  });

  afterEach(async () => {
    if (aggregator) {
      await aggregator.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(aggregator.config).toBeDefined();
      expect(aggregator.aggregationConfig).toBeDefined();
      expect(aggregator.aggregatedResults).toBeInstanceOf(Map);
      expect(aggregator.statistics.totalRuns).toBe(0);
    });

    test('should have correct initial state', () => {
      expect(aggregator.coverageHistory).toEqual([]);
      expect(aggregator.performanceHistory).toEqual([]);
      expect(aggregator.failurePatterns).toBeInstanceOf(Map);
    });
  });

  describe('Result Aggregation', () => {
    test('should aggregate results from multiple sources', async () => {
      const sources = [mockJestResults, mockESLintResults, mockComprehensiveResults];
      const aggregated = await aggregator.aggregateResults(sources);
      
      expect(aggregated).toBeDefined();
      expect(aggregated.id).toBeDefined();
      expect(aggregated.summary.totalSources).toBe(3);
      expect(aggregated.summary.totalTests).toBeGreaterThan(0);
    });

    test('should emit aggregation events', async () => {
      const events = [];
      aggregator.on('aggregation-started', (e) => events.push(e));
      aggregator.on('aggregation-completed', (e) => events.push(e));
      
      await aggregator.aggregateResults([mockJestResults]);
      
      expect(events).toHaveLength(2);
      expect(events[0]).toHaveProperty('sources', 1);
      expect(events[1]).toHaveProperty('summary');
    });

    test('should process Jest results correctly', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregated.summary.totalTests).toBe(100);
      expect(aggregated.summary.passedTests).toBe(95);
      expect(aggregated.summary.failedTests).toBe(5);
      expect(aggregated.coverage.lines.total).toBe(1000);
      expect(aggregated.coverage.lines.covered).toBe(850);
    });

    test('should process ESLint results correctly', async () => {
      const aggregated = await aggregator.aggregateResults([mockESLintResults]);
      
      expect(aggregated.quality.codeQualityIssues).toBe(5); // 2 errors + 3 warnings
      expect(aggregated.quality.fixableIssues).toBe(3); // 1 + 2
      expect(aggregated.failures.byFile.size).toBe(1);
    });

    test('should process comprehensive results correctly', async () => {
      const aggregated = await aggregator.aggregateResults([mockComprehensiveResults]);
      
      expect(aggregated.summary.totalTests).toBe(150);
      expect(aggregated.byType.unit.total).toBe(100);
      expect(aggregated.byType.integration.total).toBe(30);
      expect(aggregated.byType.e2e.total).toBe(20);
      expect(aggregated.coverage.overall).toBeGreaterThan(0);
    });
  });

  describe('Coverage Calculation', () => {
    test('should calculate coverage percentages correctly', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregated.coverage.lines.percentage).toBe(85);
      expect(aggregated.coverage.statements.percentage).toBe(85);
      expect(aggregated.coverage.functions.percentage).toBe(90);
      expect(aggregated.coverage.branches.percentage).toBe(80);
    });

    test('should calculate overall coverage', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      const expectedOverall = (85 + 85 + 90 + 80) / 4;
      expect(aggregated.coverage.overall).toBe(expectedOverall);
    });

    test('should merge coverage from multiple sources', async () => {
      const source1 = {
        type: 'jest',
        results: {
          numTotalTests: 50,
          numPassedTests: 50,
          coverage: {
            global: {
              lines: { total: 500, covered: 400 },
              statements: { total: 500, covered: 400 }
            }
          }
        }
      };
      
      const source2 = {
        type: 'jest',
        results: {
          numTotalTests: 50,
          numPassedTests: 50,
          coverage: {
            global: {
              lines: { total: 500, covered: 450 },
              statements: { total: 500, covered: 450 }
            }
          }
        }
      };
      
      const aggregated = await aggregator.aggregateResults([source1, source2]);
      
      expect(aggregated.coverage.lines.total).toBe(1000);
      expect(aggregated.coverage.lines.covered).toBe(850);
      expect(aggregated.coverage.lines.percentage).toBe(85);
    });
  });

  describe('Performance Metrics', () => {
    test('should aggregate performance metrics', async () => {
      const aggregated = await aggregator.aggregateResults([mockComprehensiveResults]);
      
      expect(aggregated.performance.avgResponseTime).toBe(850);
      expect(aggregated.performance.throughput).toBe(120);
      expect(aggregated.performance.errorRate).toBe(0.008);
    });

    test('should calculate performance score', () => {
      const performance = {
        avgResponseTime: 800,
        throughput: 150,
        errorRate: 0.005
      };
      
      const score = aggregator.calculatePerformanceScore(performance);
      expect(score).toBe(100); // All metrics within thresholds
    });

    test('should deduct points for poor performance', () => {
      const performance = {
        avgResponseTime: 1500, // Above threshold
        throughput: 50,        // Below threshold
        errorRate: 0.02        // Above threshold
      };
      
      const score = aggregator.calculatePerformanceScore(performance);
      expect(score).toBe(30); // 100 - 20 - 20 - 30
    });
  });

  describe('Quality Scoring', () => {
    test('should calculate quality score', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregated.quality.score).toBeDefined();
      expect(aggregated.quality.score).toBeGreaterThanOrEqual(0);
      expect(aggregated.quality.score).toBeLessThanOrEqual(100);
    });

    test('should assign quality grades', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregated.quality.grade).toMatch(/[A-F]/);
    });

    test('should calculate grades correctly', () => {
      expect(aggregator.calculateQualityGrade(95)).toBe('A');
      expect(aggregator.calculateQualityGrade(85)).toBe('B');
      expect(aggregator.calculateQualityGrade(75)).toBe('C');
      expect(aggregator.calculateQualityGrade(65)).toBe('D');
      expect(aggregator.calculateQualityGrade(50)).toBe('F');
    });
  });

  describe('Failure Analysis', () => {
    test('should categorize failures correctly', () => {
      expect(aggregator.categorizeFailure(['Timeout exceeded'])).toBe('timeout');
      expect(aggregator.categorizeFailure(['Expected 5 but received 3'])).toBe('assertion');
      expect(aggregator.categorizeFailure(['TypeError: Cannot read property'])).toBe('runtime');
      expect(aggregator.categorizeFailure(['SyntaxError: Unexpected token'])).toBe('syntax');
      expect(aggregator.categorizeFailure(['Promise rejected'])).toBe('async');
      expect(aggregator.categorizeFailure(['Mock not called'])).toBe('mocking');
      expect(aggregator.categorizeFailure(['Random error'])).toBe('other');
      expect(aggregator.categorizeFailure([])).toBe('unknown');
    });

    test('should track failure patterns', async () => {
      const failingResults = {
        type: 'jest',
        results: {
          numTotalTests: 10,
          numFailedTests: 5,
          testResults: [{
            testFilePath: '/test.js',
            numFailingTests: 5,
            testResults: Array(5).fill(null).map((_, i) => ({
              title: `Test ${i}`,
              status: 'failed',
              failureMessages: ['Timeout exceeded']
            }))
          }]
        }
      };
      
      const aggregated = await aggregator.aggregateResults([failingResults]);
      
      expect(aggregated.failures.byType.get('timeout')).toBe(5);
      expect(aggregated.failures.patterns.length).toBeGreaterThan(0);
    });
  });

  describe('Trend Analysis', () => {
    test('should update history for trends', async () => {
      await aggregator.aggregateResults([mockJestResults]);
      await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregator.coverageHistory).toHaveLength(2);
      expect(aggregator.performanceHistory).toHaveLength(2);
    });

    test('should calculate coverage trends', async () => {
      // Generate multiple results to establish trend
      for (let i = 0; i < 5; i++) {
        await aggregator.aggregateResults([mockJestResults]);
      }
      
      expect(aggregator.statistics.coverageTrend).toBeDefined();
      expect(['improving', 'stable', 'degrading']).toContain(aggregator.statistics.coverageTrend);
    });

    test('should limit history size', async () => {
      // Generate more results than history limit
      for (let i = 0; i < 15; i++) {
        await aggregator.aggregateResults([mockJestResults]);
      }
      
      expect(aggregator.coverageHistory.length).toBeLessThanOrEqual(10);
      expect(aggregator.performanceHistory.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Insights Generation', () => {
    test('should generate insights based on results', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregated.insights).toBeDefined();
      expect(aggregated.insights.strengths).toBeInstanceOf(Array);
      expect(aggregated.insights.weaknesses).toBeInstanceOf(Array);
      expect(aggregated.insights.opportunities).toBeInstanceOf(Array);
      expect(aggregated.insights.recommendations).toBeInstanceOf(Array);
    });

    test('should identify strengths correctly', async () => {
      const goodResults = {
        type: 'comprehensive',
        results: {
          summary: { totalTests: 100, passedTests: 96, failedTests: 4 },
          coverage: { lines: 85, statements: 85, functions: 90, branches: 85 },
          performance: { errorRate: 0.005 }
        }
      };
      
      const aggregated = await aggregator.aggregateResults([goodResults]);
      
      expect(aggregated.insights.strengths.length).toBeGreaterThan(0);
      expect(aggregated.insights.strengths.some(s => s.includes('test success rate'))).toBe(true);
    });

    test('should generate recommendations', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregated.quality.recommendations).toBeInstanceOf(Array);
      expect(aggregated.quality.recommendations.length).toBeGreaterThan(0);
      
      const recommendation = aggregated.quality.recommendations[0];
      expect(recommendation).toHaveProperty('priority');
      expect(recommendation).toHaveProperty('category');
      expect(recommendation).toHaveProperty('message');
    });
  });

  describe('Export Functionality', () => {
    test('should export results as JSON', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      const exported = await aggregator.exportResults(aggregated.id, 'json');
      
      expect(() => JSON.parse(exported)).not.toThrow();
      const parsed = JSON.parse(exported);
      expect(parsed.id).toBe(aggregated.id);
    });

    test('should export results as HTML', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      const exported = await aggregator.exportResults(aggregated.id, 'html');
      
      expect(exported).toContain('<!DOCTYPE html>');
      expect(exported).toContain(aggregated.quality.grade);
      expect(exported).toContain('Quality Score');
    });

    test('should export results as Markdown', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      const exported = await aggregator.exportResults(aggregated.id, 'markdown');
      
      expect(exported).toContain('# Aggregated Test Results');
      expect(exported).toContain('## Summary');
      expect(exported).toContain('| Metric | Coverage |');
    });

    test('should throw error for invalid export format', async () => {
      const aggregated = await aggregator.aggregateResults([mockJestResults]);
      
      await expect(aggregator.exportResults(aggregated.id, 'invalid')).rejects.toThrow('Unsupported export format');
    });
  });

  describe('Statistics and History', () => {
    test('should track statistics correctly', async () => {
      await aggregator.aggregateResults([mockJestResults]);
      await aggregator.aggregateResults([mockJestResults]);
      
      const stats = aggregator.getStatistics();
      
      expect(stats.totalRuns).toBe(2);
      expect(stats.averageSuccessRate).toBeGreaterThan(0);
      expect(stats.averageCoverage).toBeGreaterThan(0);
      expect(stats.averageExecutionTime).toBeGreaterThan(0);
    });

    test('should get aggregation history', async () => {
      await aggregator.aggregateResults([mockJestResults]);
      // Add a small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      await aggregator.aggregateResults([mockJestResults]);
      
      const history = aggregator.getHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].timestamp).toBeGreaterThan(history[1].timestamp);
    });

    test('should limit history retrieval', async () => {
      for (let i = 0; i < 5; i++) {
        await aggregator.aggregateResults([mockJestResults]);
      }
      
      const history = aggregator.getHistory(3);
      expect(history).toHaveLength(3);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await aggregator.aggregateResults([mockJestResults]);
      
      expect(aggregator.aggregatedResults.size).toBe(1);
      expect(aggregator.statistics.totalRuns).toBe(1);
      
      await aggregator.cleanup();
      
      expect(aggregator.aggregatedResults.size).toBe(0);
      expect(aggregator.coverageHistory).toEqual([]);
      expect(aggregator.performanceHistory).toEqual([]);
      expect(aggregator.statistics.totalRuns).toBe(0);
    });

    test('should emit cleanup events', async () => {
      const events = [];
      aggregator.on('aggregator-cleanup-started', (e) => events.push(e));
      aggregator.on('aggregator-cleanup-completed', (e) => events.push(e));
      
      await aggregator.cleanup();
      
      expect(events).toHaveLength(2);
    });
  });
});