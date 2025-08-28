/**
 * PerformanceMonitor Tests
 */

import { jest } from '@jest/globals';
import { PerformanceMonitor } from '../../../src/monitoring/PerformanceMonitor.js';

describe('PerformanceMonitor', () => {
  let monitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      sampleInterval: 100, // Faster for tests
      reportInterval: 500
    });
  });

  afterEach(() => {
    if (monitor.isMonitoring) {
      monitor.stop();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      expect(monitor.config.sampleInterval).toBe(100);
      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.metrics.size).toBeGreaterThan(0);
    });

    test('should initialize default metrics', () => {
      expect(monitor.metrics.has('cpu')).toBe(true);
      expect(monitor.metrics.has('memory')).toBe(true);
      expect(monitor.metrics.has('heapUsed')).toBe(true);
      expect(monitor.metrics.has('eventLoop')).toBe(true);
    });

    test('should initialize default alert rules', () => {
      expect(monitor.alertRules.length).toBeGreaterThan(0);
      
      const cpuRule = monitor.alertRules.find(r => r.metric === 'cpu');
      expect(cpuRule).toBeDefined();
      expect(cpuRule.threshold).toBe(80);
    });
  });

  describe('Monitoring', () => {
    test('should start and stop monitoring', (done) => {
      const startListener = jest.fn();
      const stopListener = jest.fn();
      
      monitor.on('started', startListener);
      monitor.on('stopped', stopListener);
      
      monitor.start();
      expect(monitor.isMonitoring).toBe(true);
      expect(startListener).toHaveBeenCalled();
      
      setTimeout(() => {
        monitor.stop();
        expect(monitor.isMonitoring).toBe(false);
        expect(stopListener).toHaveBeenCalled();
        done();
      }, 200);
    });

    test('should collect metrics', (done) => {
      const metricListener = jest.fn();
      monitor.on('metric', metricListener);
      
      monitor.start();
      
      setTimeout(() => {
        monitor.stop();
        expect(metricListener).toHaveBeenCalled();
        
        const cpuMetric = metricListener.mock.calls.find(
          call => call[0].name === 'cpu'
        );
        expect(cpuMetric).toBeDefined();
        expect(cpuMetric[0].value).toBeGreaterThanOrEqual(0);
        
        done();
      }, 300);
    });

    test('should track metric history', (done) => {
      monitor.start();
      
      setTimeout(() => {
        const cpuStats = monitor.getMetricStats('cpu');
        expect(cpuStats).toBeDefined();
        expect(cpuStats.count).toBeGreaterThan(0);
        expect(cpuStats.min).toBeLessThanOrEqual(cpuStats.max);
        expect(cpuStats.avg).toBeGreaterThanOrEqual(0);
        
        monitor.stop();
        done();
      }, 300);
    });
  });

  describe('Custom Metrics', () => {
    test('should add and record custom metrics', () => {
      monitor.addCustomMetric('api_requests');
      monitor.recordCustomMetric('api_requests', 100);
      monitor.recordCustomMetric('api_requests', 150);
      monitor.recordCustomMetric('api_requests', 200);
      
      const stats = monitor.getMetricStats('api_requests');
      expect(stats).toBeDefined();
      expect(stats.count).toBe(3);
      expect(stats.avg).toBe(150);
      expect(stats.min).toBe(100);
      expect(stats.max).toBe(200);
    });

    test('should handle metric trends', () => {
      monitor.addCustomMetric('trending_metric');
      
      // Add increasing values
      for (let i = 0; i < 20; i++) {
        monitor.recordCustomMetric('trending_metric', i * 10);
      }
      
      const metric = monitor.customMetrics.get('trending_metric');
      const trend = metric.getTrend();
      expect(trend).toBe('increasing');
    });
  });

  describe('Alerts', () => {
    test('should trigger alerts when threshold exceeded', (done) => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);
      
      // Add a custom alert rule with low threshold
      monitor.addAlertRule({
        name: 'Test Alert',
        metric: 'test_metric',
        condition: 'gt',
        threshold: 50,
        duration: 0,
        severity: 'warning'
      });
      
      monitor.addCustomMetric('test_metric');
      monitor.recordCustomMetric('test_metric', 60);
      
      monitor.start();
      
      setTimeout(() => {
        monitor.stop();
        expect(alertListener).toHaveBeenCalledWith(
          expect.objectContaining({
            rule: 'Test Alert',
            metric: 'test_metric',
            severity: 'warning'
          })
        );
        done();
      }, 200);
    });

    test('should respect alert cooldown', (done) => {
      const alertListener = jest.fn();
      monitor.on('alert', alertListener);
      
      monitor.addAlertRule({
        name: 'Cooldown Test',
        metric: 'cooldown_metric',
        condition: 'gt',
        threshold: 50,
        duration: 0,
        cooldown: 1000
      });
      
      monitor.addCustomMetric('cooldown_metric');
      monitor.start();
      
      // Trigger multiple times
      monitor.recordCustomMetric('cooldown_metric', 60);
      setTimeout(() => monitor.recordCustomMetric('cooldown_metric', 70), 100);
      setTimeout(() => monitor.recordCustomMetric('cooldown_metric', 80), 200);
      
      setTimeout(() => {
        monitor.stop();
        // Should only alert once due to cooldown
        expect(alertListener).toHaveBeenCalledTimes(1);
        done();
      }, 500);
    });
  });

  describe('Performance Marks and Measures', () => {
    test('should mark and measure performance', () => {
      monitor.mark('start');
      
      // Simulate some work
      const arr = new Array(1000000).fill(0).map((_, i) => i * 2);
      
      monitor.mark('end');
      const duration = monitor.measure('operation', 'start', 'end');
      
      expect(duration).toBeGreaterThan(0);
      
      const stats = monitor.getMetricStats('measure_operation');
      expect(stats).toBeDefined();
      expect(stats.count).toBe(1);
    });

    test('should handle missing marks', () => {
      const duration = monitor.measure('invalid', 'non-existent');
      expect(duration).toBeNull();
    });
  });

  describe('Anomaly Detection', () => {
    test('should detect anomalies', (done) => {
      const anomalyListener = jest.fn();
      monitor.on('anomaly', anomalyListener);
      
      monitor.addCustomMetric('anomaly_test');
      
      // Add normal values
      for (let i = 0; i < 20; i++) {
        monitor.recordCustomMetric('anomaly_test', 10 + Math.random() * 5);
      }
      
      // Add anomaly
      monitor.recordCustomMetric('anomaly_test', 100);
      
      monitor.start();
      
      setTimeout(() => {
        monitor.stop();
        expect(anomalyListener).toHaveBeenCalled();
        done();
      }, 200);
    });
  });

  describe('Reporting', () => {
    test('should generate performance report', (done) => {
      monitor.start();
      
      // Add some custom metrics
      monitor.addCustomMetric('requests');
      monitor.recordCustomMetric('requests', 100);
      monitor.recordCustomMetric('requests', 200);
      
      setTimeout(() => {
        const report = monitor.generateReport();
        
        expect(report.timestamp).toBeDefined();
        expect(report.system).toBeDefined();
        expect(report.system.cpu).toBeDefined();
        expect(report.system.memory).toBeDefined();
        expect(report.custom.requests).toBeDefined();
        expect(report.health).toBeGreaterThanOrEqual(0);
        expect(report.health).toBeLessThanOrEqual(100);
        
        monitor.stop();
        done();
      }, 200);
    });

    test('should calculate health score', () => {
      // Simulate high CPU usage
      monitor.metrics.get('cpu').add(85);
      monitor.metrics.get('cpu').add(90);
      monitor.metrics.get('cpu').add(88);
      
      const score = monitor.calculateHealthScore();
      expect(score).toBeLessThan(100);
    });

    test('should export metrics data', () => {
      monitor.recordMetric('cpu', 50);
      monitor.recordMetric('memory', 60);
      
      const data = monitor.exportMetrics();
      
      expect(data.timestamp).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.metrics.cpu).toBeDefined();
      expect(data.metrics.memory).toBeDefined();
    });
  });

  describe('Events', () => {
    test('should emit report events', (done) => {
      const reportListener = jest.fn();
      
      monitor = new PerformanceMonitor({
        sampleInterval: 100,
        reportInterval: 200,
        enableAutoReporting: true
      });
      
      monitor.on('report', reportListener);
      monitor.start();
      
      setTimeout(() => {
        monitor.stop();
        expect(reportListener).toHaveBeenCalled();
        done();
      }, 300);
    });

    test('should emit error events', (done) => {
      const errorListener = jest.fn();
      monitor.on('error', errorListener);
      
      // Force an error by mocking a method
      monitor.getCPUUsage = jest.fn().mockRejectedValue(new Error('CPU error'));
      
      monitor.start();
      
      setTimeout(() => {
        monitor.stop();
        expect(errorListener).toHaveBeenCalled();
        done();
      }, 200);
    });
  });
});