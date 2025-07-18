/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { EnhancedPerformanceAnalyzer } from '../../../src/logging/EnhancedPerformanceAnalyzer.js';
import { LogEntry } from '../../../src/logging/TestLogManager.js';

describe('EnhancedPerformanceAnalyzer', () => {
  let performanceAnalyzer;
  let mockConfig;
  let sampleLogs;

  beforeAll(() => {
    mockConfig = {
      criticalThreshold: 5000,
      warningThreshold: 2000,
      targetThreshold: 500,
      trendAnalysisWindow: 100,
      regressionThreshold: 0.2,
      correlationThreshold: 0.7,
      enablePredictiveAnalysis: true,
      enableDetailedMetrics: true,
      enableResourceTracking: true
    };

    // Create sample logs with performance data
    sampleLogs = [
      new LogEntry({
        timestamp: Date.now() - 10000,
        level: 'info',
        source: 'api',
        message: 'Request took 1200ms to complete',
        correlationId: 'perf-1'
      }),
      new LogEntry({
        timestamp: Date.now() - 9000,
        level: 'info',
        source: 'database',
        message: 'Query duration: 800ms',
        correlationId: 'perf-2'
      }),
      new LogEntry({
        timestamp: Date.now() - 8000,
        level: 'info',
        source: 'api',
        message: 'Response time: 2500ms',
        correlationId: 'perf-3'
      }),
      new LogEntry({
        timestamp: Date.now() - 7000,
        level: 'info',
        source: 'cache',
        message: 'Cache hit took 50ms',
        correlationId: 'perf-4'
      }),
      new LogEntry({
        timestamp: Date.now() - 6000,
        level: 'info',
        source: 'api',
        message: 'Request elapsed: 6000ms',
        correlationId: 'perf-5'
      })
    ];
  });

  beforeEach(() => {
    performanceAnalyzer = new EnhancedPerformanceAnalyzer(mockConfig);
  });

  afterEach(async () => {
    if (performanceAnalyzer) {
      await performanceAnalyzer.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultAnalyzer = new EnhancedPerformanceAnalyzer();
      
      expect(defaultAnalyzer.config).toBeDefined();
      expect(defaultAnalyzer.config.criticalThreshold).toBe(5000);
      expect(defaultAnalyzer.config.warningThreshold).toBe(2000);
      expect(defaultAnalyzer.config.enablePredictiveAnalysis).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      expect(performanceAnalyzer.config.criticalThreshold).toBe(5000);
      expect(performanceAnalyzer.config.regressionThreshold).toBe(0.2);
      expect(performanceAnalyzer.config.enableDetailedMetrics).toBe(true);
    });

    test('should initialize performance categories', () => {
      expect(performanceAnalyzer.performanceCategories).toBeDefined();
      expect(performanceAnalyzer.performanceCategories.response_time).toBeDefined();
      expect(performanceAnalyzer.performanceCategories.database_query).toBeDefined();
    });

    test('should initialize internal state', () => {
      expect(performanceAnalyzer.performanceHistory).toEqual([]);
      expect(performanceAnalyzer.performanceBaseline).toBeInstanceOf(Map);
      expect(performanceAnalyzer.resourceMetrics).toBeInstanceOf(Map);
      expect(performanceAnalyzer.metrics).toBeDefined();
    });
  });

  describe('Performance Analysis', () => {
    test('should perform comprehensive performance analysis', async () => {
      const results = await performanceAnalyzer.analyzePerformance(sampleLogs);
      
      expect(results).toBeDefined();
      expect(results.metrics).toBeDefined();
      expect(results.trends).toBeDefined();
      expect(results.regressions).toBeDefined();
      expect(results.resourceAnalysis).toBeDefined();
      expect(results.correlations).toBeDefined();
      expect(results.insights).toBeDefined();
      expect(results.summary).toBeDefined();
    });

    test('should emit performance analysis events', async () => {
      const startSpy = jest.fn();
      const completeSpy = jest.fn();
      
      performanceAnalyzer.on('performance-analysis-started', startSpy);
      performanceAnalyzer.on('performance-analysis-completed', completeSpy);
      
      await performanceAnalyzer.analyzePerformance(sampleLogs);
      
      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
        logCount: 5,
        timestamp: expect.any(Number)
      }));
      expect(completeSpy).toHaveBeenCalledWith(expect.objectContaining({
        results: expect.any(Object),
        timestamp: expect.any(Number)
      }));
    });

    test('should handle analysis errors', async () => {
      const errorSpy = jest.fn();
      performanceAnalyzer.on('performance-analysis-failed', errorSpy);
      
      // Mock a method to throw an error
      performanceAnalyzer.extractPerformanceMetrics = jest.fn().mockImplementation(() => {
        throw new Error('Analysis failed');
      });
      
      await expect(performanceAnalyzer.analyzePerformance(sampleLogs))
        .rejects.toThrow('Analysis failed');
      
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Analysis failed',
        timestamp: expect.any(Number)
      }));
    });
  });

  describe('Performance Metrics Extraction', () => {
    test('should extract performance metrics from logs', () => {
      const metrics = performanceAnalyzer.extractPerformanceMetrics(sampleLogs);
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeGreaterThan(0);
      
      // Check metric structure
      const metric = metrics[0];
      expect(metric.id).toBeDefined();
      expect(metric.timestamp).toBeDefined();
      expect(metric.source).toBeDefined();
      expect(metric.category).toBeDefined();
      expect(metric.value).toBeDefined();
      expect(metric.unit).toBeDefined();
      expect(metric.severity).toBeDefined();
    });

    test('should extract performance data from log messages', () => {
      const testLog = {
        id: 'test-1',
        message: 'Request took 1500ms to complete',
        source: 'api',
        correlationId: 'test'
      };
      
      const performanceData = performanceAnalyzer.extractPerformanceData(testLog);
      
      expect(performanceData).toBeDefined();
      expect(performanceData.value).toBe(1500);
      expect(performanceData.unit).toBe('ms');
      expect(performanceData.operation).toBeDefined();
    });

    test('should handle logs without performance data', () => {
      const testLog = {
        id: 'test-1',
        message: 'User logged in successfully',
        source: 'auth',
        correlationId: 'test'
      };
      
      const performanceData = performanceAnalyzer.extractPerformanceData(testLog);
      
      expect(performanceData).toBeNull();
    });

    test('should categorize performance metrics correctly', () => {
      const responseTimeCategory = performanceAnalyzer.categorizePerformanceMetric(
        'Response time: 1000ms'
      );
      const databaseCategory = performanceAnalyzer.categorizePerformanceMetric(
        'Database query took 500ms'
      );
      const generalCategory = performanceAnalyzer.categorizePerformanceMetric(
        'Some other message'
      );
      
      expect(responseTimeCategory).toBe('response_time');
      expect(databaseCategory).toBe('database_query');
      expect(generalCategory).toBe('general');
    });

    test('should calculate severity correctly', () => {
      expect(performanceAnalyzer.calculateSeverity(100)).toBe('excellent');
      expect(performanceAnalyzer.calculateSeverity(1000)).toBe('normal');
      expect(performanceAnalyzer.calculateSeverity(3000)).toBe('warning');
      expect(performanceAnalyzer.calculateSeverity(6000)).toBe('critical');
    });
  });

  describe('Trend Analysis', () => {
    test('should analyze performance trends', async () => {
      const metrics = performanceAnalyzer.extractPerformanceMetrics(sampleLogs);
      const trends = await performanceAnalyzer.analyzeTrends(metrics);
      
      expect(trends).toBeDefined();
      expect(typeof trends).toBe('object');
      
      // Check trend structure
      const trendKeys = Object.keys(trends);
      if (trendKeys.length > 0) {
        const trend = trends[trendKeys[0]];
        expect(trend.direction).toBeDefined();
        expect(trend.slope).toBeDefined();
        expect(trend.correlation).toBeDefined();
        expect(trend.confidence).toBeDefined();
      }
    });

    test('should calculate trend for metric series', async () => {
      const testMetrics = [
        { timestamp: 1000, value: 100 },
        { timestamp: 2000, value: 150 },
        { timestamp: 3000, value: 200 },
        { timestamp: 4000, value: 250 }
      ];
      
      const trend = await performanceAnalyzer.calculateTrend(testMetrics);
      
      expect(trend).toBeDefined();
      expect(trend.direction).toBe('increasing');
      expect(trend.slope).toBeGreaterThan(0);
      expect(trend.samples).toBe(4);
      expect(trend.averageValue).toBe(175);
    });

    test('should handle insufficient data for trend analysis', async () => {
      const singleMetric = [{ timestamp: 1000, value: 100 }];
      const trend = await performanceAnalyzer.calculateTrend(singleMetric);
      
      expect(trend).toBeDefined();
      expect(trend.samples).toBe(1);
      expect(trend.averageValue).toBe(100);
    });
  });

  describe('Regression Detection', () => {
    test('should detect performance regressions', async () => {
      // Create metrics with a regression pattern
      const regressionMetrics = [
        // Baseline - good performance
        { timestamp: 1000, value: 100, category: 'api', source: 'test' },
        { timestamp: 2000, value: 110, category: 'api', source: 'test' },
        { timestamp: 3000, value: 105, category: 'api', source: 'test' },
        { timestamp: 4000, value: 115, category: 'api', source: 'test' },
        { timestamp: 5000, value: 108, category: 'api', source: 'test' },
        // Regression - worse performance
        { timestamp: 6000, value: 200, category: 'api', source: 'test' },
        { timestamp: 7000, value: 220, category: 'api', source: 'test' },
        { timestamp: 8000, value: 210, category: 'api', source: 'test' },
        { timestamp: 9000, value: 230, category: 'api', source: 'test' },
        { timestamp: 10000, value: 225, category: 'api', source: 'test' }
      ];
      
      const regressions = await performanceAnalyzer.detectRegressions(regressionMetrics);
      
      expect(Array.isArray(regressions)).toBe(true);
      
      if (regressions.length > 0) {
        const regression = regressions[0];
        expect(regression.type).toBe('performance_regression');
        expect(regression.regressionRatio).toBeGreaterThan(0);
        expect(regression.severity).toBeDefined();
        expect(regression.confidence).toBeDefined();
      }
    });

    test('should not detect regression with stable performance', async () => {
      const stableMetrics = [
        { timestamp: 1000, value: 100, category: 'api', source: 'test' },
        { timestamp: 2000, value: 105, category: 'api', source: 'test' },
        { timestamp: 3000, value: 98, category: 'api', source: 'test' },
        { timestamp: 4000, value: 102, category: 'api', source: 'test' },
        { timestamp: 5000, value: 101, category: 'api', source: 'test' }
      ];
      
      const regressions = await performanceAnalyzer.detectRegressions(stableMetrics);
      
      expect(regressions).toEqual([]);
    });

    test('should handle insufficient data for regression detection', async () => {
      const insufficientMetrics = [
        { timestamp: 1000, value: 100, category: 'api', source: 'test' },
        { timestamp: 2000, value: 110, category: 'api', source: 'test' }
      ];
      
      const regressions = await performanceAnalyzer.detectRegressions(insufficientMetrics);
      
      expect(regressions).toEqual([]);
    });
  });

  describe('Performance Insights', () => {
    test('should generate performance insights', async () => {
      const metrics = performanceAnalyzer.extractPerformanceMetrics(sampleLogs);
      const trends = await performanceAnalyzer.analyzeTrends(metrics);
      const regressions = await performanceAnalyzer.detectRegressions(metrics);
      
      const insights = await performanceAnalyzer.generatePerformanceInsights(
        metrics, trends, regressions
      );
      
      expect(Array.isArray(insights)).toBe(true);
      
      if (insights.length > 0) {
        const insight = insights[0];
        expect(insight.type).toBeDefined();
        expect(insight.severity).toBeDefined();
        expect(insight.message).toBeDefined();
        expect(insight.recommendations).toBeDefined();
      }
    });

    test('should identify performance bottlenecks', () => {
      const metrics = [
        { category: 'api', source: 'server', value: 6000, severity: 'critical' },
        { category: 'database', source: 'postgres', value: 1000, severity: 'normal' },
        { category: 'cache', source: 'redis', value: 8000, severity: 'critical' }
      ];
      
      const bottlenecks = performanceAnalyzer.identifyBottlenecks(metrics);
      
      expect(bottlenecks).toHaveLength(2);
      expect(bottlenecks[0].severity).toBe('critical');
      expect(bottlenecks[1].severity).toBe('critical');
    });
  });

  describe('Resource Analysis', () => {
    test('should analyze resource utilization', async () => {
      const resourceAnalysis = await performanceAnalyzer.analyzeResourceUtilization(sampleLogs);
      
      expect(resourceAnalysis).toBeDefined();
      expect(typeof resourceAnalysis).toBe('object');
    });

    test('should handle logs without resource data', async () => {
      const logsWithoutResources = [
        new LogEntry({
          timestamp: Date.now(),
          level: 'info',
          source: 'app',
          message: 'Application started',
          correlationId: 'app-1'
        })
      ];
      
      const resourceAnalysis = await performanceAnalyzer.analyzeResourceUtilization(
        logsWithoutResources
      );
      
      expect(resourceAnalysis).toBeDefined();
    });
  });

  describe('Correlation Analysis', () => {
    test('should analyze performance correlations', async () => {
      const metrics = performanceAnalyzer.extractPerformanceMetrics(sampleLogs);
      const correlations = await performanceAnalyzer.analyzePerformanceCorrelations(metrics);
      
      expect(Array.isArray(correlations)).toBe(true);
    });

    test('should filter correlations by threshold', async () => {
      const metrics = performanceAnalyzer.extractPerformanceMetrics(sampleLogs);
      const correlations = await performanceAnalyzer.analyzePerformanceCorrelations(metrics);
      
      // All returned correlations should meet the threshold
      for (const correlation of correlations) {
        expect(correlation.strength).toBeGreaterThan(
          performanceAnalyzer.config.correlationThreshold
        );
      }
    });
  });

  describe('Utility Methods', () => {
    test('should normalize values correctly', () => {
      expect(performanceAnalyzer.normalizeValue(1, 'ms')).toBe(1);
      expect(performanceAnalyzer.normalizeValue(1, 's')).toBe(1000);
      expect(performanceAnalyzer.normalizeValue(1, 'm')).toBe(60000);
    });

    test('should normalize units correctly', () => {
      expect(performanceAnalyzer.normalizeUnit('ms')).toBe('ms');
      expect(performanceAnalyzer.normalizeUnit('seconds')).toBe('ms');
      expect(performanceAnalyzer.normalizeUnit('minutes')).toBe('ms');
      expect(performanceAnalyzer.normalizeUnit('%')).toBe('%');
    });

    test('should extract operation names', () => {
      expect(performanceAnalyzer.extractOperationName('Request took 1000ms')).toBe('request');
      expect(performanceAnalyzer.extractOperationName('Query duration: 500ms')).toBe('query');
      expect(performanceAnalyzer.extractOperationName('Unknown message')).toBe('unknown');
    });

    test('should group metrics by category', () => {
      const metrics = [
        { category: 'api', value: 100 },
        { category: 'database', value: 200 },
        { category: 'api', value: 150 }
      ];
      
      const groups = performanceAnalyzer.groupMetricsByCategory(metrics);
      
      expect(groups.api).toHaveLength(2);
      expect(groups.database).toHaveLength(1);
    });

    test('should calculate linear regression', () => {
      const x = [1, 2, 3, 4, 5];
      const y = [2, 4, 6, 8, 10];
      
      const regression = performanceAnalyzer.calculateLinearRegression(x, y);
      
      expect(regression.slope).toBeCloseTo(2, 1);
      expect(regression.intercept).toBeCloseTo(0, 1);
      expect(regression.correlation).toBeCloseTo(1, 1);
    });

    test('should calculate volatility', () => {
      const values = [100, 110, 90, 105, 95];
      const volatility = performanceAnalyzer.calculateVolatility(values);
      
      expect(volatility).toBeGreaterThan(0);
      expect(typeof volatility).toBe('number');
    });
  });

  describe('Performance Summary', () => {
    test('should generate performance summary', () => {
      const metrics = performanceAnalyzer.extractPerformanceMetrics(sampleLogs);
      const trends = {};
      const regressions = [];
      
      const summary = performanceAnalyzer.generatePerformanceSummary(
        metrics, trends, regressions
      );
      
      expect(summary).toBeDefined();
      expect(summary.totalMetrics).toBe(metrics.length);
      expect(summary.averagePerformance).toBeDefined();
      expect(summary.performanceDistribution).toBeDefined();
      expect(summary.trendsAnalyzed).toBe(0);
      expect(summary.regressionsDetected).toBe(0);
    });

    test('should calculate performance distribution', () => {
      const metrics = [
        { severity: 'excellent' },
        { severity: 'normal' },
        { severity: 'warning' },
        { severity: 'critical' },
        { severity: 'normal' }
      ];
      
      const distribution = performanceAnalyzer.calculatePerformanceDistribution(metrics);
      
      expect(distribution.excellent).toBe(1);
      expect(distribution.normal).toBe(2);
      expect(distribution.warning).toBe(1);
      expect(distribution.critical).toBe(1);
    });
  });

  describe('Baseline Management', () => {
    test('should update performance baseline', () => {
      const metrics = [
        { category: 'api', source: 'server', value: 100 },
        { category: 'database', source: 'postgres', value: 200 }
      ];
      
      performanceAnalyzer.updatePerformanceBaseline(metrics);
      
      expect(performanceAnalyzer.performanceBaseline.size).toBe(2);
      expect(performanceAnalyzer.performanceBaseline.has('api-server')).toBe(true);
      expect(performanceAnalyzer.performanceBaseline.has('database-postgres')).toBe(true);
    });

    test('should limit baseline size', () => {
      const metrics = Array.from({ length: 150 }, (_, i) => ({
        category: 'api',
        source: 'server',
        value: i
      }));
      
      performanceAnalyzer.updatePerformanceBaseline(metrics);
      
      const baseline = performanceAnalyzer.performanceBaseline.get('api-server');
      expect(baseline.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Metrics and Performance', () => {
    test('should track analysis metrics', async () => {
      const initialMetrics = performanceAnalyzer.getMetrics();
      
      await performanceAnalyzer.analyzePerformance(sampleLogs);
      
      const finalMetrics = performanceAnalyzer.getMetrics();
      
      expect(finalMetrics.totalMetrics).toBeGreaterThan(initialMetrics.totalMetrics);
      expect(finalMetrics.analysisTime).toBeGreaterThan(initialMetrics.analysisTime);
    });

    test('should provide comprehensive metrics', () => {
      const metrics = performanceAnalyzer.getMetrics();
      
      expect(metrics.totalMetrics).toBeDefined();
      expect(metrics.performanceIssues).toBeDefined();
      expect(metrics.regressionsDetected).toBeDefined();
      expect(metrics.baselineUpdates).toBeDefined();
      expect(metrics.analysisTime).toBeDefined();
      expect(metrics.baselineSize).toBeDefined();
      expect(metrics.historySize).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources properly', async () => {
      // Add some data to internal structures
      performanceAnalyzer.performanceHistory.push({ test: 'data' });
      performanceAnalyzer.performanceBaseline.set('test', []);
      performanceAnalyzer.resourceMetrics.set('test', {});
      
      const cleanupSpy = jest.fn();
      performanceAnalyzer.on('cleanup-complete', cleanupSpy);
      
      await performanceAnalyzer.cleanup();
      
      expect(performanceAnalyzer.performanceHistory).toEqual([]);
      expect(performanceAnalyzer.performanceBaseline.size).toBe(0);
      expect(performanceAnalyzer.resourceMetrics.size).toBe(0);
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty metrics array', async () => {
      const results = await performanceAnalyzer.analyzePerformance([]);
      
      expect(results).toBeDefined();
      expect(results.metrics).toEqual([]);
      expect(results.summary.totalMetrics).toBe(0);
    });

    test('should handle malformed log entries', async () => {
      const malformedLogs = [
        { timestamp: 'invalid', message: 'Test message' },
        { message: 'Response time: 1000ms' }
      ];
      
      await expect(performanceAnalyzer.analyzePerformance(malformedLogs))
        .resolves.not.toThrow();
    });

    test('should handle predictive analysis when disabled', async () => {
      performanceAnalyzer.config.enablePredictiveAnalysis = false;
      
      const results = await performanceAnalyzer.analyzePerformance(sampleLogs);
      
      expect(results.predictions).toBeNull();
    });
  });
});