/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { EnhancedCorrelationEngine } from '../../../src/logging/EnhancedCorrelationEngine.js';
import { LogEntry } from '../../../src/logging/TestLogManager.js';

describe('EnhancedCorrelationEngine', () => {
  let correlationEngine;
  let mockConfig;
  let sampleLogs;

  beforeAll(() => {
    mockConfig = {
      shortTermWindow: 5000,
      mediumTermWindow: 30000,
      longTermWindow: 300000,
      correlationThreshold: 0.7,
      causalityThreshold: 0.8,
      anomalyThreshold: 0.9,
      maxCorrelationDepth: 5,
      minEventCount: 3,
      enableStatisticalAnalysis: true,
      enableAnomalyDetection: true,
      enableCausalityDetection: true
    };

    // Create sample logs for testing
    sampleLogs = [
      new LogEntry({
        timestamp: Date.now() - 10000,
        level: 'error',
        source: 'database',
        message: 'Connection pool exhausted',
        correlationId: 'chain-start',
        category: 'database'
      }),
      new LogEntry({
        timestamp: Date.now() - 8000,
        level: 'error',
        source: 'api',
        message: 'Database query timeout',
        correlationId: 'chain-middle',
        category: 'connection'
      }),
      new LogEntry({
        timestamp: Date.now() - 6000,
        level: 'error',
        source: 'frontend',
        message: 'API request failed',
        correlationId: 'chain-end',
        category: 'connection'
      }),
      new LogEntry({
        timestamp: Date.now() - 4000,
        level: 'error',
        source: 'database',
        message: 'Connection pool exhausted',
        correlationId: 'repeat-1',
        category: 'database'
      }),
      new LogEntry({
        timestamp: Date.now() - 2000,
        level: 'error',
        source: 'database',
        message: 'Connection pool exhausted',
        correlationId: 'repeat-2',
        category: 'database'
      })
    ];
  });

  beforeEach(() => {
    correlationEngine = new EnhancedCorrelationEngine(mockConfig);
  });

  afterEach(async () => {
    if (correlationEngine) {
      await correlationEngine.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultEngine = new EnhancedCorrelationEngine();
      
      expect(defaultEngine.config).toBeDefined();
      expect(defaultEngine.config.shortTermWindow).toBe(5000);
      expect(defaultEngine.config.correlationThreshold).toBe(0.7);
      expect(defaultEngine.config.enableStatisticalAnalysis).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      expect(correlationEngine.config.shortTermWindow).toBe(5000);
      expect(correlationEngine.config.correlationThreshold).toBe(0.7);
      expect(correlationEngine.config.enableCausalityDetection).toBe(true);
    });

    test('should initialize internal state', () => {
      expect(correlationEngine.correlationHistory).toBeInstanceOf(Map);
      expect(correlationEngine.causalityGraph).toBeInstanceOf(Map);
      expect(correlationEngine.anomalyBaseline).toBeInstanceOf(Map);
      expect(correlationEngine.metrics).toBeDefined();
    });
  });

  describe('Correlation Analysis', () => {
    test('should perform comprehensive correlation analysis', async () => {
      const results = await correlationEngine.performCorrelationAnalysis(sampleLogs);
      
      expect(results).toBeDefined();
      expect(results.temporalCorrelations).toBeDefined();
      expect(results.causalChains).toBeDefined();
      expect(results.anomalies).toBeDefined();
      expect(results.statisticalCorrelations).toBeDefined();
      expect(results.impactAssessment).toBeDefined();
      expect(results.rootCauses).toBeDefined();
    });

    test('should emit correlation analysis events', async () => {
      const startSpy = jest.fn();
      const completeSpy = jest.fn();
      
      correlationEngine.on('correlation-analysis-started', startSpy);
      correlationEngine.on('correlation-analysis-completed', completeSpy);
      
      await correlationEngine.performCorrelationAnalysis(sampleLogs);
      
      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
        logCount: 5,
        timestamp: expect.any(Number)
      }));
      expect(completeSpy).toHaveBeenCalledWith(expect.objectContaining({
        results: expect.any(Object),
        timestamp: expect.any(Number)
      }));
    });

    test('should handle correlation analysis errors', async () => {
      const errorSpy = jest.fn();
      correlationEngine.on('correlation-analysis-failed', errorSpy);
      
      // Mock a method to throw an error
      correlationEngine.analyzeTemporalCorrelations = jest.fn().mockRejectedValue(
        new Error('Analysis failed')
      );
      
      await expect(correlationEngine.performCorrelationAnalysis(sampleLogs))
        .rejects.toThrow('Analysis failed');
      
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Analysis failed',
        timestamp: expect.any(Number)
      }));
    });
  });

  describe('Temporal Correlation Analysis', () => {
    test('should analyze temporal correlations', async () => {
      const correlations = await correlationEngine.analyzeTemporalCorrelations(sampleLogs);
      
      expect(correlations).toBeDefined();
      expect(Array.isArray(correlations)).toBe(true);
      
      // Should find correlations within time windows
      if (correlations.length > 0) {
        const correlation = correlations[0];
        expect(correlation.type).toBe('temporal');
        expect(correlation.strength).toBeDefined();
        expect(correlation.confidence).toBeDefined();
        expect(correlation.metadata).toBeDefined();
      }
    });

    test('should analyze window correlations', async () => {
      const windowCorrelations = await correlationEngine.analyzeWindowCorrelations(
        sampleLogs, 
        5000, 
        'short'
      );
      
      expect(Array.isArray(windowCorrelations)).toBe(true);
      
      if (windowCorrelations.length > 0) {
        const correlation = windowCorrelations[0];
        expect(correlation.window).toBe('short');
        expect(correlation.duration).toBe(5000);
        expect(correlation.events).toBeDefined();
      }
    });

    test('should group logs by time windows', () => {
      const groups = correlationEngine.groupByTimeWindows(sampleLogs, 5000);
      
      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);
      
      // Each group should contain logs within the time window
      for (const group of groups) {
        expect(group.length).toBeGreaterThan(0);
        const timespan = group[group.length - 1].timestamp - group[0].timestamp;
        expect(timespan).toBeLessThanOrEqual(5000);
      }
    });
  });

  describe('Causal Chain Detection', () => {
    test('should detect causal chains', async () => {
      const chains = await correlationEngine.detectCausalChains(sampleLogs);
      
      expect(Array.isArray(chains)).toBe(true);
      
      if (chains.length > 0) {
        const chain = chains[0];
        expect(chain.type).toBe('causal');
        expect(chain.rootCause).toBeDefined();
        expect(chain.steps).toBeDefined();
        expect(chain.confidence).toBeDefined();
        expect(chain.metadata).toBeDefined();
      }
    });

    test('should build causality graph', async () => {
      const errorLogs = sampleLogs.filter(log => correlationEngine.isErrorLog(log));
      const graph = await correlationEngine.buildCausalityGraph(errorLogs);
      
      expect(graph).toBeInstanceOf(Map);
      expect(graph.size).toBe(errorLogs.length);
      
      // Each node should have the required structure
      for (const [id, node] of graph) {
        expect(node.log).toBeDefined();
        expect(node.predecessors).toBeInstanceOf(Set);
        expect(node.successors).toBeInstanceOf(Set);
        expect(node.causalityScore).toBeDefined();
      }
    });

    test('should calculate causality scores', async () => {
      const logA = sampleLogs[0];
      const logB = sampleLogs[1];
      
      const score = await correlationEngine.calculateCausalityScore(logA, logB);
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should not assign causality to events in wrong order', async () => {
      const laterLog = sampleLogs[1];  // has earlier timestamp
      const earlierLog = sampleLogs[0]; // has later timestamp
      
      const score = await correlationEngine.calculateCausalityScore(laterLog, earlierLog);
      
      expect(score).toBe(0);
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect anomalies when enabled', async () => {
      correlationEngine.config.enableAnomalyDetection = true;
      
      const anomalies = await correlationEngine.detectAnomalies(sampleLogs);
      
      expect(Array.isArray(anomalies)).toBe(true);
      
      if (anomalies.length > 0) {
        const anomaly = anomalies[0];
        expect(anomaly.severity).toBeDefined();
        expect(typeof anomaly.severity).toBe('number');
      }
    });

    test('should skip anomaly detection when disabled', async () => {
      correlationEngine.config.enableAnomalyDetection = false;
      
      const anomalies = await correlationEngine.detectAnomalies(sampleLogs);
      
      expect(anomalies).toEqual([]);
    });
  });

  describe('Statistical Analysis', () => {
    test('should perform statistical analysis when enabled', async () => {
      correlationEngine.config.enableStatisticalAnalysis = true;
      
      const correlations = await correlationEngine.performStatisticalAnalysis(sampleLogs);
      
      expect(Array.isArray(correlations)).toBe(true);
    });

    test('should skip statistical analysis when disabled', async () => {
      correlationEngine.config.enableStatisticalAnalysis = false;
      
      const correlations = await correlationEngine.performStatisticalAnalysis(sampleLogs);
      
      expect(correlations).toEqual([]);
    });
  });

  describe('Impact Assessment', () => {
    test('should assess impact of correlated events', async () => {
      const impacts = await correlationEngine.assessImpact(sampleLogs);
      
      expect(Array.isArray(impacts)).toBe(true);
      
      // Should filter out null impacts
      for (const impact of impacts) {
        expect(impact).not.toBeNull();
      }
    });
  });

  describe('Root Cause Analysis', () => {
    test('should identify root causes', async () => {
      const rootCauses = await correlationEngine.identifyRootCauses(sampleLogs);
      
      expect(Array.isArray(rootCauses)).toBe(true);
      
      if (rootCauses.length > 0) {
        const rootCause = rootCauses[0];
        expect(rootCause.confidence).toBeDefined();
        expect(rootCause.impact).toBeDefined();
        
        // Should be sorted by confidence * impact
        if (rootCauses.length > 1) {
          const firstScore = rootCauses[0].confidence * rootCauses[0].impact;
          const secondScore = rootCauses[1].confidence * rootCauses[1].impact;
          expect(firstScore).toBeGreaterThanOrEqual(secondScore);
        }
      }
    });
  });

  describe('Pattern Analysis', () => {
    test('should analyze group patterns', async () => {
      const group = sampleLogs.slice(0, 3);
      const patterns = await correlationEngine.analyzeGroupPatterns(group);
      
      expect(Array.isArray(patterns)).toBe(true);
      
      if (patterns.length > 0) {
        const pattern = patterns[0];
        expect(pattern.pattern).toBeDefined();
        expect(pattern.strength).toBeDefined();
        expect(pattern.confidence).toBeDefined();
      }
    });

    test('should analyze source patterns', async () => {
      const repeatedSourceLogs = [
        sampleLogs[0],
        sampleLogs[3],
        sampleLogs[4]
      ]; // All database logs
      
      const pattern = await correlationEngine.analyzeSourcePattern(repeatedSourceLogs);
      
      if (pattern) {
        expect(pattern.pattern).toBe('source_dominance');
        expect(pattern.strength).toBeGreaterThan(0.6);
        expect(pattern.events.length).toBe(3);
      }
    });

    test('should analyze message patterns', async () => {
      const repeatedMessageLogs = [
        sampleLogs[0],
        sampleLogs[3],
        sampleLogs[4]
      ]; // All "Connection pool exhausted" messages
      
      const pattern = await correlationEngine.analyzeMessagePattern(repeatedMessageLogs);
      
      if (pattern) {
        expect(pattern.pattern).toBe('message_repetition');
        expect(pattern.strength).toBeGreaterThan(0.4);
        expect(pattern.events.length).toBe(3);
      }
    });

    test('should normalize messages correctly', () => {
      const message = 'Error 123: Connection failed at 192.168.1.1 on 2023-12-01 at 14:30:00';
      const normalized = correlationEngine.normalizeMessage(message);
      
      expect(normalized).toBe('error #: connection failed at #IP# on #DATE# at #TIME#');
    });
  });

  describe('Utility Methods', () => {
    test('should identify error logs correctly', () => {
      const errorLog = { level: 'error', message: 'Something failed' };
      const infoLog = { level: 'info', message: 'Everything is fine' };
      const warningWithError = { level: 'warn', message: 'Exception occurred' };
      
      expect(correlationEngine.isErrorLog(errorLog)).toBe(true);
      expect(correlationEngine.isErrorLog(infoLog)).toBe(false);
      expect(correlationEngine.isErrorLog(warningWithError)).toBe(true);
    });

    test('should rank correlations by score', () => {
      const correlations = [
        { strength: 0.5, confidence: 0.8 },
        { strength: 0.9, confidence: 0.6 },
        { strength: 0.7, confidence: 0.9 }
      ];
      
      const ranked = correlationEngine.rankCorrelations(correlations);
      
      expect(ranked[0].strength * ranked[0].confidence).toBeGreaterThanOrEqual(
        ranked[1].strength * ranked[1].confidence
      );
    });

    test('should rank root causes by impact score', () => {
      const rootCauses = [
        { confidence: 0.5, impact: 0.8 },
        { confidence: 0.9, impact: 0.6 },
        { confidence: 0.7, impact: 0.9 }
      ];
      
      const ranked = correlationEngine.rankRootCauses(rootCauses);
      
      expect(ranked[0].confidence * ranked[0].impact).toBeGreaterThanOrEqual(
        ranked[1].confidence * ranked[1].impact
      );
    });
  });

  describe('Metrics and Performance', () => {
    test('should track performance metrics', async () => {
      const initialMetrics = correlationEngine.getMetrics();
      
      await correlationEngine.performCorrelationAnalysis(sampleLogs);
      
      const finalMetrics = correlationEngine.getMetrics();
      
      expect(finalMetrics.processingTime).toBeGreaterThan(initialMetrics.processingTime);
      expect(finalMetrics.correlationsFound).toBeGreaterThanOrEqual(
        initialMetrics.correlationsFound
      );
    });

    test('should provide comprehensive metrics', () => {
      const metrics = correlationEngine.getMetrics();
      
      expect(metrics.correlationsFound).toBeDefined();
      expect(metrics.causalChainsDetected).toBeDefined();
      expect(metrics.anomaliesDetected).toBeDefined();
      expect(metrics.processingTime).toBeDefined();
      expect(metrics.accuracyScore).toBeDefined();
      expect(metrics.correlationHistorySize).toBeDefined();
      expect(metrics.causalityGraphSize).toBeDefined();
      expect(metrics.anomalyBaselineSize).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources properly', async () => {
      // Add some data to internal structures
      correlationEngine.correlationHistory.set('test', {});
      correlationEngine.causalityGraph.set('test', {});
      correlationEngine.anomalyBaseline.set('test', {});
      
      const cleanupSpy = jest.fn();
      correlationEngine.on('cleanup-complete', cleanupSpy);
      
      await correlationEngine.cleanup();
      
      expect(correlationEngine.correlationHistory.size).toBe(0);
      expect(correlationEngine.causalityGraph.size).toBe(0);
      expect(correlationEngine.anomalyBaseline.size).toBe(0);
      expect(cleanupSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle empty log arrays', async () => {
      const results = await correlationEngine.performCorrelationAnalysis([]);
      
      expect(results).toBeDefined();
      expect(results.temporalCorrelations).toBeDefined();
      expect(results.causalChains).toBeDefined();
      expect(results.anomalies).toBeDefined();
    });

    test('should handle logs with missing properties', async () => {
      const incompleteLogs = [
        { timestamp: Date.now(), message: 'Test log' },
        { level: 'error', message: 'Another test log' }
      ];
      
      await expect(correlationEngine.performCorrelationAnalysis(incompleteLogs))
        .resolves.not.toThrow();
    });
  });
});