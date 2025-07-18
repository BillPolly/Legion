/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { LogAnalysisEngine } from '../../../src/logging/LogAnalysisEngine.js';
import { LogEntry } from '../../../src/logging/TestLogManager.js';

describe('LogAnalysisEngine', () => {
  let analysisEngine;
  let mockConfig;
  let sampleLogs;

  beforeAll(() => {
    mockConfig = {
      errorPatterns: [
        /ERROR:/i,
        /FAILED:/i,
        /exception/i,
        /error/i
      ],
      warningPatterns: [
        /WARN:/i,
        /WARNING:/i,
        /deprecated/i
      ],
      performancePatterns: [
        /took (\d+)ms/i,
        /duration: (\d+)/i,
        /response time: (\d+)/i
      ],
      enableRootCauseAnalysis: true,
      correlationWindowMs: 5000,
      maxSuggestions: 5
    };

    // Create sample logs for testing
    sampleLogs = [
      new LogEntry({
        timestamp: Date.now() - 5000,
        level: 'info',
        source: 'server',
        message: 'Server started on port 3000',
        correlationId: 'server-start'
      }),
      new LogEntry({
        timestamp: Date.now() - 4000,
        level: 'error',
        source: 'database',
        message: 'ERROR: Connection failed to database',
        correlationId: 'db-error'
      }),
      new LogEntry({
        timestamp: Date.now() - 3000,
        level: 'warn',
        source: 'api',
        message: 'WARN: API endpoint deprecated',
        correlationId: 'api-warn'
      }),
      new LogEntry({
        timestamp: Date.now() - 2000,
        level: 'info',
        source: 'server',
        message: 'Request took 1250ms to complete',
        correlationId: 'perf-log'
      }),
      new LogEntry({
        timestamp: Date.now() - 1000,
        level: 'error',
        source: 'app',
        message: 'Unhandled exception in user handler',
        correlationId: 'app-error'
      })
    ];
  });

  beforeEach(() => {
    analysisEngine = new LogAnalysisEngine(mockConfig);
  });

  afterEach(async () => {
    if (analysisEngine) {
      await analysisEngine.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultEngine = new LogAnalysisEngine();
      
      expect(defaultEngine.config).toBeDefined();
      expect(defaultEngine.config.errorPatterns.length).toBeGreaterThan(0);
      expect(defaultEngine.config.warningPatterns.length).toBeGreaterThan(0);
      expect(defaultEngine.config.enableRootCauseAnalysis).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      expect(analysisEngine.config.errorPatterns).toEqual(mockConfig.errorPatterns);
      expect(analysisEngine.config.warningPatterns).toEqual(mockConfig.warningPatterns);
      expect(analysisEngine.config.enableRootCauseAnalysis).toBe(true);
    });

    test('should validate configuration on initialization', () => {
      const invalidConfigs = [
        { errorPatterns: 'invalid' },
        { correlationWindowMs: -1 },
        { maxSuggestions: 0 }
      ];
      
      invalidConfigs.forEach(config => {
        expect(() => new LogAnalysisEngine(config)).toThrow();
      });
    });
  });

  describe('Error Pattern Recognition', () => {
    test('should extract error patterns from logs', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      expect(analysis).toBeDefined();
      expect(analysis.errors).toBeDefined();
      expect(analysis.errors.length).toBe(2); // Two error logs
      
      const errorSources = analysis.errors.map(e => e.source);
      expect(errorSources).toContain('database');
      expect(errorSources).toContain('app');
    });

    test('should categorize errors by type', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      const connectionError = analysis.errors.find(e => e.message.includes('Connection failed'));
      const exceptionError = analysis.errors.find(e => e.message.includes('exception'));
      
      expect(connectionError).toBeDefined();
      expect(connectionError.category).toBe('connection');
      expect(exceptionError).toBeDefined();
      expect(exceptionError.category).toBe('exception');
    });

    test('should extract stack traces from error logs', async () => {
      const errorLogWithStack = new LogEntry({
        timestamp: Date.now(),
        level: 'error',
        source: 'app',
        message: 'Error: Something went wrong',
        stack: 'Error: Something went wrong\n    at handler (app.js:10:5)\n    at server (app.js:20:3)'
      });

      const analysis = await analysisEngine.analyzeTestLogs([errorLogWithStack]);
      
      expect(analysis.errors.length).toBe(1);
      expect(analysis.errors[0].stack).toBeDefined();
      expect(analysis.errors[0].stack).toContain('at handler');
    });

    test('should detect error frequency patterns', async () => {
      const repeatedErrors = Array.from({ length: 5 }, (_, i) => 
        new LogEntry({
          timestamp: Date.now() - (i * 1000),
          level: 'error',
          source: 'api',
          message: 'ERROR: Rate limit exceeded',
          correlationId: `rate-limit-${i}`
        })
      );

      const analysis = await analysisEngine.analyzeTestLogs(repeatedErrors);
      
      expect(analysis.patterns).toBeDefined();
      expect(analysis.patterns.repeatedErrors).toBeDefined();
      expect(analysis.patterns.repeatedErrors.length).toBe(1);
      expect(analysis.patterns.repeatedErrors[0].message).toContain('Rate limit exceeded');
      expect(analysis.patterns.repeatedErrors[0].frequency).toBe(5);
    });
  });

  describe('Warning Analysis', () => {
    test('should extract warning patterns from logs', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      expect(analysis.warnings).toBeDefined();
      expect(analysis.warnings.length).toBe(1);
      expect(analysis.warnings[0].message).toContain('deprecated');
    });

    test('should categorize warnings by severity', async () => {
      const severityLogs = [
        new LogEntry({
          timestamp: Date.now(),
          level: 'warn',
          source: 'security',
          message: 'WARN: Weak password detected',
          correlationId: 'security-warn'
        }),
        new LogEntry({
          timestamp: Date.now(),
          level: 'warn',
          source: 'performance',
          message: 'WARN: High memory usage',
          correlationId: 'perf-warn'
        })
      ];

      const analysis = await analysisEngine.analyzeTestLogs(severityLogs);
      
      expect(analysis.warnings.length).toBe(2);
      
      const securityWarning = analysis.warnings.find(w => w.message.includes('password'));
      const performanceWarning = analysis.warnings.find(w => w.message.includes('memory'));
      
      expect(securityWarning.severity).toBe('high');
      expect(performanceWarning.severity).toBe('medium');
    });
  });

  describe('Performance Analysis', () => {
    test('should analyze performance metrics', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      expect(analysis.performance).toBeDefined();
      expect(analysis.performance.metrics).toBeDefined();
      expect(analysis.performance.metrics.length).toBe(1);
      expect(analysis.performance.metrics[0].value).toBe(1250);
      expect(analysis.performance.metrics[0].unit).toBe('ms');
    });

    test('should include enhanced performance analysis', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      expect(analysis.enhancedPerformance).toBeDefined();
      expect(analysis.enhancedPerformance.metrics).toBeDefined();
      expect(analysis.enhancedPerformance.trends).toBeDefined();
      expect(analysis.enhancedPerformance.regressions).toBeDefined();
      expect(analysis.enhancedPerformance.insights).toBeDefined();
      expect(analysis.enhancedPerformance.summary).toBeDefined();
    });

    test('should detect performance bottlenecks', async () => {
      const slowLogs = [
        new LogEntry({
          timestamp: Date.now() - 3000,
          level: 'info',
          source: 'api',
          message: 'API request took 5000ms',
          correlationId: 'slow-api'
        }),
        new LogEntry({
          timestamp: Date.now() - 2000,
          level: 'info',
          source: 'db',
          message: 'Database query duration: 8000ms',
          correlationId: 'slow-db'
        })
      ];

      const analysis = await analysisEngine.analyzeTestLogs(slowLogs);
      
      expect(analysis.performance.bottlenecks).toBeDefined();
      expect(analysis.performance.bottlenecks.length).toBe(2);
      
      const apiBottleneck = analysis.performance.bottlenecks.find(b => b.source === 'api');
      const dbBottleneck = analysis.performance.bottlenecks.find(b => b.source === 'db');
      
      expect(apiBottleneck.value).toBe(5000);
      expect(dbBottleneck.value).toBe(8000);
    });

    test('should calculate performance trends', async () => {
      const trendLogs = Array.from({ length: 10 }, (_, i) => 
        new LogEntry({
          timestamp: Date.now() - (i * 1000),
          level: 'info',
          source: 'api',
          message: `Request took ${1000 + (i * 100)}ms`,
          correlationId: `trend-${i}`
        })
      );

      const analysis = await analysisEngine.analyzeTestLogs(trendLogs);
      
      expect(analysis.performance.trends).toBeDefined();
      expect(analysis.performance.trends.direction).toBe('increasing');
      expect(analysis.performance.trends.slope).toBeGreaterThan(0);
    });
  });

  describe('Log Correlation', () => {
    test('should include enhanced correlation analysis', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      expect(analysis.enhancedCorrelation).toBeDefined();
      expect(analysis.enhancedCorrelation.temporalCorrelations).toBeDefined();
      expect(analysis.enhancedCorrelation.causalChains).toBeDefined();
      expect(analysis.enhancedCorrelation.anomalies).toBeDefined();
      expect(analysis.enhancedCorrelation.statisticalCorrelations).toBeDefined();
      expect(analysis.enhancedCorrelation.impactAssessment).toBeDefined();
      expect(analysis.enhancedCorrelation.rootCauses).toBeDefined();
    });

    test('should correlate errors across multiple log sources', async () => {
      const correlatedLogs = [
        new LogEntry({
          timestamp: Date.now() - 2000,
          level: 'error',
          source: 'frontend',
          message: 'Failed to load user data',
          correlationId: 'user-error'
        }),
        new LogEntry({
          timestamp: Date.now() - 1500,
          level: 'error',
          source: 'api',
          message: 'User service returned 500',
          correlationId: 'user-error'
        }),
        new LogEntry({
          timestamp: Date.now() - 1000,
          level: 'error',
          source: 'database',
          message: 'User table connection timeout',
          correlationId: 'user-error'
        })
      ];

      const correlatedAnalysis = await analysisEngine.correlateLogs(correlatedLogs);
      
      expect(correlatedAnalysis).toBeDefined();
      expect(correlatedAnalysis.correlations).toBeDefined();
      expect(correlatedAnalysis.correlations.length).toBe(1);
      
      const userErrorCorrelation = correlatedAnalysis.correlations[0];
      expect(userErrorCorrelation.correlationId).toBe('user-error');
      expect(userErrorCorrelation.sources).toContain('frontend');
      expect(userErrorCorrelation.sources).toContain('api');
      expect(userErrorCorrelation.sources).toContain('database');
    });

    test('should identify error propagation chains', async () => {
      const chainLogs = [
        new LogEntry({
          timestamp: Date.now() - 3000,
          level: 'error',
          source: 'database',
          message: 'Connection pool exhausted',
          correlationId: 'chain-start'
        }),
        new LogEntry({
          timestamp: Date.now() - 2000,
          level: 'error',
          source: 'api',
          message: 'Database query failed',
          correlationId: 'chain-middle'
        }),
        new LogEntry({
          timestamp: Date.now() - 1000,
          level: 'error',
          source: 'frontend',
          message: 'API request timeout',
          correlationId: 'chain-end'
        })
      ];

      const analysis = await analysisEngine.analyzeTestLogs(chainLogs);
      
      expect(analysis.chains).toBeDefined();
      expect(analysis.chains.length).toBe(1);
      
      const errorChain = analysis.chains[0];
      expect(errorChain.type).toBe('error_propagation');
      expect(errorChain.steps.length).toBe(3);
      expect(errorChain.steps[0].source).toBe('database');
      expect(errorChain.steps[2].source).toBe('frontend');
    });

    test('should correlate logs within time window', async () => {
      const timeWindowLogs = [
        new LogEntry({
          timestamp: Date.now() - 6000, // Outside window
          level: 'error',
          source: 'app1',
          message: 'Error 1',
          correlationId: 'outside'
        }),
        new LogEntry({
          timestamp: Date.now() - 2000, // Inside window
          level: 'error',
          source: 'app2',
          message: 'Error 2',
          correlationId: 'inside-1'
        }),
        new LogEntry({
          timestamp: Date.now() - 1000, // Inside window
          level: 'error',
          source: 'app3',
          message: 'Error 3',
          correlationId: 'inside-2'
        })
      ];

      const baseTime = Date.now() - 1500;
      const correlatedLogs = await analysisEngine.correlateLogsByTimeWindow(timeWindowLogs, baseTime, 3000);
      
      expect(correlatedLogs).toBeDefined();
      expect(correlatedLogs.length).toBe(2);
      expect(correlatedLogs.some(log => log.source === 'app2')).toBe(true);
      expect(correlatedLogs.some(log => log.source === 'app3')).toBe(true);
      expect(correlatedLogs.some(log => log.source === 'app1')).toBe(false);
    });
  });

  describe('Root Cause Analysis', () => {
    test('should generate actionable insights', async () => {
      const analysis = await analysisEngine.generateInsights(sampleLogs);
      
      expect(analysis).toBeDefined();
      expect(analysis.insights).toBeDefined();
      expect(analysis.insights.length).toBeGreaterThan(0);
      
      const connectionInsight = analysis.insights.find(i => i.category === 'connection');
      expect(connectionInsight).toBeDefined();
      expect(connectionInsight.description).toContain('Connection failed');
      expect(connectionInsight.actionable).toBe(true);
    });

    test('should provide fix suggestions', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      expect(analysis.suggestions).toBeDefined();
      expect(analysis.suggestions.length).toBeGreaterThan(0);
      
      const connectionSuggestion = analysis.suggestions.find(s => s.category === 'connection');
      expect(connectionSuggestion).toBeDefined();
      expect(connectionSuggestion.priority).toBe('high');
      expect(connectionSuggestion.actions).toBeDefined();
      expect(connectionSuggestion.actions.length).toBeGreaterThan(0);
    });

    test('should identify common error patterns', async () => {
      const commonErrors = [
        new LogEntry({
          timestamp: Date.now() - 5000,
          level: 'error',
          source: 'api',
          message: 'TypeError: Cannot read property "id" of undefined',
          correlationId: 'type-error-1'
        }),
        new LogEntry({
          timestamp: Date.now() - 4000,
          level: 'error',
          source: 'worker',
          message: 'TypeError: Cannot read property "name" of undefined',
          correlationId: 'type-error-2'
        }),
        new LogEntry({
          timestamp: Date.now() - 3000,
          level: 'error',
          source: 'service',
          message: 'TypeError: Cannot read property "data" of undefined',
          correlationId: 'type-error-3'
        })
      ];

      const analysis = await analysisEngine.analyzeTestLogs(commonErrors);
      
      expect(analysis.patterns.commonErrors).toBeDefined();
      expect(analysis.patterns.commonErrors.length).toBe(1);
      
      const typeErrorPattern = analysis.patterns.commonErrors[0];
      expect(typeErrorPattern.pattern).toContain('TypeError');
      expect(typeErrorPattern.frequency).toBe(3);
      expect(typeErrorPattern.sources.length).toBe(3);
    });

    test('should prioritize issues by severity', async () => {
      const mixedLogs = [
        new LogEntry({
          timestamp: Date.now() - 3000,
          level: 'error',
          source: 'security',
          message: 'Unauthorized access attempt',
          correlationId: 'security-error'
        }),
        new LogEntry({
          timestamp: Date.now() - 2000,
          level: 'warn',
          source: 'performance',
          message: 'High memory usage',
          correlationId: 'perf-warn'
        }),
        new LogEntry({
          timestamp: Date.now() - 1000,
          level: 'info',
          source: 'app',
          message: 'User logged in',
          correlationId: 'info-log'
        })
      ];

      const analysis = await analysisEngine.analyzeTestLogs(mixedLogs);
      
      expect(analysis.priorities).toBeDefined();
      expect(analysis.priorities.length).toBe(2); // Only error and warning
      
      const highPriority = analysis.priorities.find(p => p.level === 'high');
      const mediumPriority = analysis.priorities.find(p => p.level === 'medium');
      
      expect(highPriority.source).toBe('security');
      expect(mediumPriority.source).toBe('performance');
    });
  });

  describe('Export and Reporting', () => {
    test('should generate comprehensive analysis report', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      const report = analysisEngine.generateReport(analysis);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.totalLogs).toBe(5);
      expect(report.summary.errorCount).toBe(2);
      expect(report.summary.warningCount).toBe(1);
      
      expect(report.sections).toBeDefined();
      expect(report.sections.errors).toBeDefined();
      expect(report.sections.warnings).toBeDefined();
      expect(report.sections.performance).toBeDefined();
    });

    test('should export analysis in different formats', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      
      const jsonReport = analysisEngine.exportAnalysis(analysis, 'json');
      const textReport = analysisEngine.exportAnalysis(analysis, 'text');
      const markdownReport = analysisEngine.exportAnalysis(analysis, 'markdown');
      
      expect(jsonReport).toMatch(/^\{.*\}$/s);
      expect(textReport).toContain('Log Analysis Report');
      expect(markdownReport).toContain('# Log Analysis Report');
    });
  });

  describe('Performance and Optimization', () => {
    test('should handle large log sets efficiently', async () => {
      const largeLogs = Array.from({ length: 1000 }, (_, i) => 
        new LogEntry({
          timestamp: Date.now() - (i * 100),
          level: i % 4 === 0 ? 'error' : 'info',
          source: `source-${i % 10}`,
          message: `Log message ${i}`,
          correlationId: `correlation-${i}`
        })
      );

      const startTime = Date.now();
      const analysis = await analysisEngine.analyzeTestLogs(largeLogs);
      const endTime = Date.now();
      
      expect(analysis).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(analysis.errors.length).toBe(250); // 25% of logs are errors
    });

    test('should provide analysis metrics', async () => {
      const analysis = await analysisEngine.analyzeTestLogs(sampleLogs);
      const metrics = analysisEngine.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.logsProcessed).toBe(5);
      expect(metrics.analysisTime).toBeGreaterThan(0);
      expect(metrics.errorsFound).toBe(2);
      expect(metrics.warningsFound).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup resources properly', async () => {
      await analysisEngine.cleanup();
      
      expect(analysisEngine.isCleanedUp).toBe(true);
    });
  });
});