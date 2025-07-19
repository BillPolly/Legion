/**
 * GitMonitoring Unit Tests
 * Phase 9.2: Monitoring and observability system tests
 * 
 * Tests metrics collection, performance monitoring, health checks,
 * and operational observability capabilities.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import GitMonitoring from '../../../src/monitoring/GitMonitoring.js';

describe('GitMonitoring', () => {
  let monitoring;

  beforeEach(async () => {
    monitoring = new GitMonitoring({
      enableMetrics: true,
      enablePerformanceTracking: true,
      enableHealthChecks: true,
      enableResourceMonitoring: true,
      healthCheckInterval: 100, // Fast for testing
      performanceThresholds: {
        commitTimeMs: 1000,
        pushTimeMs: 5000,
        branchTimeMs: 500
      },
      alertThresholds: {
        errorRate: 0.2,
        avgResponseTime: 1000,
        memoryUsageMB: 100
      }
    });
    
    await monitoring.initialize();
  });

  afterEach(async () => {
    if (monitoring) {
      await monitoring.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize monitoring system', async () => {
      expect(monitoring.initialized).toBe(true);
      expect(monitoring.healthChecks.size).toBeGreaterThan(0);
    });

    test('should emit initialization event', async () => {
      const events = [];
      const newMonitoring = new GitMonitoring();
      
      newMonitoring.on('monitoring-initialized', (data) => events.push(data));
      await newMonitoring.initialize();
      
      expect(events.length).toBe(1);
      expect(events[0]).toHaveProperty('config');
      
      await newMonitoring.cleanup();
    });

    test('should register default health checks', async () => {
      const expectedChecks = [
        'memory-usage',
        'git-operations',
        'error-rate',
        'response-time',
        'active-operations'
      ];
      
      expectedChecks.forEach(check => {
        expect(monitoring.healthChecks.has(check)).toBe(true);
      });
    });

    test('should start health checking when enabled', async () => {
      expect(monitoring.healthCheckInterval).toBeDefined();
    });
  });

  describe('Operation Tracking', () => {
    test('should start and end operation tracking', async () => {
      const operationId = 'test-op-1';
      const metadata = { files: ['test.js'], phase: 'testing' };
      
      const operation = monitoring.startOperation(operationId, 'commit', metadata);
      
      expect(operation).toBeDefined();
      expect(operation.id).toBe(operationId);
      expect(operation.type).toBe('commit');
      expect(operation.metadata).toEqual(metadata);
      expect(monitoring.activeOperations.has(operationId)).toBe(true);
      
      // Wait a bit to get measurable duration
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = monitoring.endOperation(operationId, { success: true });
      
      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThan(0);
      expect(result.success).toBe(true);
      expect(monitoring.activeOperations.has(operationId)).toBe(false);
      expect(monitoring.metrics.performance.length).toBe(1);
    });

    test('should emit operation events', async () => {
      const events = [];
      monitoring.on('operation-started', (data) => events.push({ type: 'started', data }));
      monitoring.on('operation-completed', (data) => events.push({ type: 'completed', data }));
      
      const operationId = 'event-test';
      monitoring.startOperation(operationId, 'push');
      monitoring.endOperation(operationId, { success: true });
      
      expect(events.length).toBe(2);
      expect(events[0].type).toBe('started');
      expect(events[1].type).toBe('completed');
    });

    test('should track operation resources', async () => {
      const operationId = 'resource-test';
      
      monitoring.startOperation(operationId, 'commit');
      await new Promise(resolve => setTimeout(resolve, 5));
      const result = monitoring.endOperation(operationId, { success: true });
      
      expect(result.resources).toBeDefined();
      expect(result.resources.memoryDelta).toBeDefined();
      expect(result.resources.cpuTime).toBeDefined();
    });

    test('should handle failed operations', async () => {
      const operationId = 'fail-test';
      
      monitoring.startOperation(operationId, 'push');
      const result = monitoring.endOperation(operationId, { 
        success: false, 
        error: 'Network timeout' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    test('should return null for non-existent operation', () => {
      const result = monitoring.endOperation('non-existent');
      expect(result).toBeNull();
    });

    test('should skip tracking when disabled', () => {
      monitoring.config.enablePerformanceTracking = false;
      
      const operation = monitoring.startOperation('disabled-test', 'commit');
      expect(operation).toBeNull();
    });
  });

  describe('Metrics Collection', () => {
    test('should update operation-specific metrics', async () => {
      // Perform multiple operations
      for (let i = 0; i < 3; i++) {
        monitoring.startOperation(`commit-${i}`, 'commit');
        await new Promise(resolve => setTimeout(resolve, 5));
        monitoring.endOperation(`commit-${i}`, { success: i < 2 }); // 2 success, 1 fail
      }
      
      const commitMetrics = monitoring.metrics.operations.get('commit');
      
      expect(commitMetrics.count).toBe(3);
      expect(commitMetrics.successCount).toBe(2);
      expect(commitMetrics.errorCount).toBe(1);
      expect(commitMetrics.avgDuration).toBeGreaterThan(0);
      expect(commitMetrics.recentOperations.length).toBe(3);
    });

    test('should record errors', () => {
      const error = new Error('Test error');
      const context = { operation: 'push', branch: 'main' };
      
      monitoring.recordError(error, context);
      
      expect(monitoring.metrics.errors.length).toBe(1);
      expect(monitoring.metrics.errors[0].type).toBe('Error');
      expect(monitoring.metrics.errors[0].message).toBe('Test error');
      expect(monitoring.metrics.errors[0].context).toEqual(context);
    });

    test('should emit error recorded event', () => {
      const events = [];
      monitoring.on('error-recorded', (data) => events.push(data));
      
      monitoring.recordError(new Error('Test error'), { test: true });
      
      expect(events.length).toBe(1);
      expect(events[0].errorType).toBe('Error');
    });

    test('should get comprehensive metrics', () => {
      // Add some test data
      monitoring.startOperation('test-1', 'commit');
      monitoring.endOperation('test-1', { success: true });
      monitoring.recordError(new Error('Test error'));
      
      const metrics = monitoring.getMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('operations');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('system');
      expect(metrics).toHaveProperty('health');
      
      expect(metrics.operations.commit).toBeDefined();
      expect(metrics.operations.commit.count).toBe(1);
      expect(metrics.operations.commit.successRate).toBe(1);
    });
  });

  describe('Performance Monitoring', () => {
    test('should check performance thresholds', async () => {
      const events = [];
      monitoring.on('performance-threshold-exceeded', (data) => events.push(data));
      
      const operationId = 'slow-op';
      monitoring.startOperation(operationId, 'commit');
      
      // Simulate slow operation by manually setting duration
      await new Promise(resolve => setTimeout(resolve, 10));
      const result = monitoring.endOperation(operationId, { success: true });
      
      // Manually trigger threshold check with high duration
      monitoring.checkPerformanceThresholds({
        id: operationId,
        type: 'commit',
        duration: 2000, // Above threshold
        endTimestamp: new Date()
      });
      
      expect(events.length).toBe(1);
      expect(events[0].operationType).toBe('commit');
      expect(events[0].duration).toBe(2000);
    });

    test('should get performance summary', async () => {
      // Create some operations
      for (let i = 0; i < 5; i++) {
        monitoring.startOperation(`perf-${i}`, 'commit');
        await new Promise(resolve => setTimeout(resolve, 2));
        monitoring.endOperation(`perf-${i}`, { success: i < 4 });
      }
      
      const summary = monitoring.getPerformanceSummary(60000); // 1 minute window
      
      expect(summary.operationCount).toBe(5);
      expect(summary.successRate).toBe(0.8); // 4/5
      expect(summary.avgDuration).toBeGreaterThan(0);
      expect(summary.minDuration).toBeGreaterThan(0);
      expect(summary.maxDuration).toBeGreaterThan(0);
      expect(summary.operationTypes).toEqual({ commit: 5 });
    });

    test('should handle empty performance data', () => {
      const summary = monitoring.getPerformanceSummary();
      
      expect(summary.operationCount).toBe(0);
      expect(summary.message).toContain('No operations');
    });
  });

  describe('Health Checks', () => {
    test('should perform memory usage health check', async () => {
      const result = await monitoring.checkMemoryUsage();
      
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('value');
      expect(result).toHaveProperty('timestamp');
      expect(['healthy', 'warning', 'critical']).toContain(result.status);
    });

    test('should perform git operations health check', async () => {
      // Add some operations
      monitoring.startOperation('health-1', 'commit');
      monitoring.endOperation('health-1', { success: true });
      monitoring.startOperation('health-2', 'push');
      monitoring.endOperation('health-2', { success: false });
      
      const result = await monitoring.checkGitOperationsHealth();
      
      expect(result.status).toBeDefined();
      expect(result.message).toContain('success rate');
      expect(result.recentOperations).toBe(2);
    });

    test('should perform error rate health check', async () => {
      // Add operations and errors
      monitoring.startOperation('error-1', 'commit');
      monitoring.endOperation('error-1', { success: true });
      monitoring.recordError(new Error('Test error'));
      
      const result = await monitoring.checkErrorRate();
      
      expect(result.status).toBeDefined();
      expect(result.message).toContain('Error rate');
    });

    test('should perform response time health check', async () => {
      monitoring.startOperation('response-1', 'commit');
      monitoring.endOperation('response-1', { success: true });
      
      const result = await monitoring.checkResponseTime();
      
      expect(result.status).toBeDefined();
      expect(result.message).toContain('response time');
    });

    test('should perform active operations health check', async () => {
      monitoring.startOperation('active-1', 'commit');
      // Don't end it - leave it active
      
      const result = await monitoring.checkActiveOperations();
      
      expect(result.status).toBeDefined();
      expect(result.activeOperations).toBe(1);
      expect(result.longRunningOperations).toBe(0);
      
      // Clean up
      monitoring.endOperation('active-1', { success: true });
    });

    test('should perform comprehensive health checks', async () => {
      const healthReport = await monitoring.performHealthChecks();
      
      expect(healthReport.overall).toBeDefined();
      expect(healthReport.checks).toBeDefined();
      expect(healthReport.timestamp).toBeDefined();
      
      // Should have all default health checks
      expect(Object.keys(healthReport.checks).length).toBeGreaterThanOrEqual(5);
    });

    test('should emit health check alerts for issues', async () => {
      const events = [];
      monitoring.on('health-check-alert', (data) => events.push(data));
      
      // Force a health check failure by mocking
      const originalCheck = monitoring.checkMemoryUsage;
      monitoring.checkMemoryUsage = jest.fn().mockResolvedValue({
        status: 'critical',
        message: 'Memory usage too high',
        timestamp: new Date()
      });
      
      await monitoring.performHealthChecks();
      
      expect(events.length).toBe(1);
      expect(events[0].overall).toBe('critical');
      
      // Restore original check
      monitoring.checkMemoryUsage = originalCheck;
    });

    test('should register custom health checks', async () => {
      const customCheck = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Custom check passed'
      });
      
      monitoring.registerHealthCheck('custom-test', customCheck);
      
      const healthReport = await monitoring.performHealthChecks();
      
      expect(healthReport.checks['custom-test']).toBeDefined();
      expect(customCheck).toHaveBeenCalled();
    });
  });

  describe('Error Rate Monitoring', () => {
    test('should check error rate thresholds', async () => {
      const events = [];
      monitoring.on('error-rate-threshold-exceeded', (data) => events.push(data));
      
      // Add operations with high error rate
      for (let i = 0; i < 10; i++) {
        monitoring.startOperation(`error-test-${i}`, 'commit');
        monitoring.endOperation(`error-test-${i}`, { success: i < 3 }); // 30% error rate
      }
      
      // Add errors to match failed operations
      for (let i = 0; i < 7; i++) {
        monitoring.recordError(new Error(`Error ${i}`));
      }
      
      // Trigger threshold check
      monitoring.checkErrorRateThresholds();
      
      expect(events.length).toBe(1);
      expect(events[0].errorRate).toBeGreaterThan(monitoring.config.alertThresholds.errorRate);
    });

    test('should not trigger on low error rates', () => {
      const events = [];
      monitoring.on('error-rate-threshold-exceeded', (data) => events.push(data));
      
      // Add operations with low error rate
      for (let i = 0; i < 10; i++) {
        monitoring.startOperation(`low-error-${i}`, 'commit');
        monitoring.endOperation(`low-error-${i}`, { success: i < 9 }); // 10% error rate
      }
      
      monitoring.checkErrorRateThresholds();
      
      expect(events.length).toBe(0);
    });
  });

  describe('Data Management', () => {
    test('should get recent operations', async () => {
      const now = Date.now();
      
      // Add old operation
      monitoring.metrics.performance.push({
        id: 'old-op',
        type: 'commit',
        endTimestamp: new Date(now - 600000), // 10 minutes ago
        success: true
      });
      
      // Add recent operation
      monitoring.startOperation('recent-op', 'commit');
      monitoring.endOperation('recent-op', { success: true });
      
      const recentOps = monitoring.getRecentOperations(300000); // 5 minutes
      
      expect(recentOps.length).toBe(1);
      expect(recentOps[0].id).toBe('recent-op');
    });

    test('should get recent errors', () => {
      const now = Date.now();
      
      // Add old error
      monitoring.metrics.errors.push({
        type: 'Error',
        message: 'Old error',
        timestamp: new Date(now - 600000)
      });
      
      // Add recent error
      monitoring.recordError(new Error('Recent error'));
      
      const recentErrors = monitoring.getRecentErrors(300000); // 5 minutes
      
      expect(recentErrors.length).toBe(1);
      expect(recentErrors[0].message).toBe('Recent error');
    });

    test('should clean up old metrics', async () => {
      const now = Date.now();
      const oldTime = now - (monitoring.config.metricsRetentionPeriod + 1000);
      
      // Add old metrics
      monitoring.metrics.performance.push({
        id: 'old-perf',
        endTimestamp: new Date(oldTime)
      });
      
      monitoring.metrics.errors.push({
        type: 'Error',
        timestamp: new Date(oldTime)
      });
      
      monitoring.metrics.health.push({
        overall: 'healthy',
        timestamp: new Date(oldTime)
      });
      
      // Add recent metrics
      monitoring.startOperation('recent', 'commit');
      monitoring.endOperation('recent', { success: true });
      monitoring.recordError(new Error('Recent'));
      
      monitoring.cleanupOldMetrics();
      
      expect(monitoring.metrics.performance.length).toBe(1);
      expect(monitoring.metrics.errors.length).toBe(1);
      expect(monitoring.metrics.performance[0].id).toBe('recent');
    });
  });

  describe('Reporting', () => {
    test('should generate monitoring report', async () => {
      // Add some test data
      monitoring.startOperation('report-test', 'commit');
      await new Promise(resolve => setTimeout(resolve, 5));
      monitoring.endOperation('report-test', { success: true });
      monitoring.recordError(new Error('Test error'));
      
      const report = monitoring.generateReport();
      
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('timeWindow');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('performance');
      expect(report).toHaveProperty('healthStatus');
      
      expect(report.metrics.operations.commit).toBeDefined();
      expect(report.performance.totalOperations).toBe(1);
    });

    test('should include active operations in report', () => {
      monitoring.startOperation('active-report', 'push');
      
      const report = monitoring.generateReport({ includeLongRunning: true });
      
      expect(report.activeOperations).toBeDefined();
      expect(report.activeOperations.length).toBe(1);
      expect(report.activeOperations[0].id).toBe('active-report');
      
      // Clean up
      monitoring.endOperation('active-report', { success: true });
    });

    test('should generate report with custom time window', () => {
      const customTimeWindow = 1800000; // 30 minutes
      const report = monitoring.generateReport({ timeWindow: customTimeWindow });
      
      expect(report.timeWindow).toBe(customTimeWindow);
      expect(report.performance.period).toBe(customTimeWindow);
    });
  });

  describe('Configuration', () => {
    test('should respect monitoring configuration', () => {
      const customConfig = {
        enableMetrics: false,
        enablePerformanceTracking: false,
        enableHealthChecks: false,
        healthCheckInterval: 5000,
        performanceThresholds: {
          commitTimeMs: 2000
        }
      };
      
      const customMonitoring = new GitMonitoring(customConfig);
      
      expect(customMonitoring.config.enableMetrics).toBe(false);
      expect(customMonitoring.config.enablePerformanceTracking).toBe(false);
      expect(customMonitoring.config.enableHealthChecks).toBe(false);
      expect(customMonitoring.config.healthCheckInterval).toBe(5000);
      expect(customMonitoring.config.performanceThresholds.commitTimeMs).toBe(2000);
    });

    test('should use default configuration values', () => {
      const defaultMonitoring = new GitMonitoring();
      
      expect(defaultMonitoring.config.enableMetrics).toBe(true);
      expect(defaultMonitoring.config.metricsRetentionPeriod).toBe(3600000);
      expect(defaultMonitoring.config.healthCheckInterval).toBe(60000);
    });
  });

  describe('Edge Cases', () => {
    test('should handle operations without performance tracking', () => {
      monitoring.config.enablePerformanceTracking = false;
      
      const operation = monitoring.startOperation('disabled', 'commit');
      expect(operation).toBeNull();
      
      const result = monitoring.endOperation('disabled');
      expect(result).toBeNull();
    });

    test('should handle health checks with errors', async () => {
      // Register a failing health check
      monitoring.registerHealthCheck('failing-check', () => {
        throw new Error('Health check failed');
      });
      
      const healthReport = await monitoring.performHealthChecks();
      
      expect(healthReport.overall).toBe('critical');
      expect(healthReport.checks['failing-check'].status).toBe('error');
    });

    test('should handle empty metrics gracefully', () => {
      const emptyMonitoring = new GitMonitoring();
      
      const metrics = emptyMonitoring.getMetrics();
      expect(metrics.performance.totalOperations).toBe(0);
      expect(metrics.errors.totalErrors).toBe(0);
      
      const summary = emptyMonitoring.getPerformanceSummary();
      expect(summary.operationCount).toBe(0);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup monitoring resources', async () => {
      expect(monitoring.healthCheckInterval).toBeDefined();
      expect(monitoring.metricsCleanupInterval).toBeDefined();
      
      const removeListenersSpy = jest.spyOn(monitoring, 'removeAllListeners');
      
      await monitoring.cleanup();
      
      expect(monitoring.healthCheckInterval).toBeNull();
      expect(monitoring.metricsCleanupInterval).toBeNull();
      expect(removeListenersSpy).toHaveBeenCalled();
    });

    test('should not fail cleanup when not initialized', async () => {
      const uninitializedMonitoring = new GitMonitoring();
      
      await expect(uninitializedMonitoring.cleanup()).resolves.not.toThrow();
    });
  });
});