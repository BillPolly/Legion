import { jest } from '@jest/globals';

// Import after mocking
const MetricsCollector = (await import('../../../src/monitoring/MetricsCollector.js')).default;

describe('MetricsCollector', () => {
  let metricsCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    metricsCollector = new MetricsCollector();
  });

  afterEach(() => {
    // Clean up any running intervals
    metricsCollector.stopAllCollection();
  });

  describe('Metric Collection Registration', () => {
    test('should register system metrics collector', () => {
      const config = {
        deploymentId: 'deploy-123',
        type: 'system',
        interval: 5000,
        metrics: ['cpu', 'memory', 'disk']
      };

      metricsCollector.addMetricsCollector(config);

      const collectors = metricsCollector.getMetricsCollectors('deploy-123');
      expect(collectors).toHaveLength(1);
      expect(collectors[0].type).toBe('system');
      expect(collectors[0].metrics).toEqual(['cpu', 'memory', 'disk']);
    });

    test('should register custom metrics collector', () => {
      const customCollector = jest.fn().mockResolvedValue({
        activeConnections: 150,
        requestsPerSecond: 25.5
      });

      const config = {
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database-metrics',
        collector: customCollector,
        interval: 10000
      };

      metricsCollector.addMetricsCollector(config);

      const collectors = metricsCollector.getMetricsCollectors('deploy-123');
      expect(collectors).toHaveLength(1);
      expect(collectors[0].type).toBe('custom');
      expect(collectors[0].name).toBe('database-metrics');
    });

    test('should register HTTP endpoint metrics collector', () => {
      const config = {
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/metrics',
        interval: 15000
      };

      metricsCollector.addMetricsCollector(config);

      const collectors = metricsCollector.getMetricsCollectors('deploy-123');
      expect(collectors).toHaveLength(1);
      expect(collectors[0].type).toBe('http');
      expect(collectors[0].url).toBe('http://localhost:3000/metrics');
    });
  });

  describe('System Metrics Collection', () => {
    test('should collect CPU metrics', async () => {
      const result = await metricsCollector.collectSystemMetrics(['cpu']);

      expect(result.cpu).toBeDefined();
      expect(typeof result.cpu.usage).toBe('number');
      expect(result.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(result.cpu.usage).toBeLessThanOrEqual(100);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should collect memory metrics', async () => {
      const result = await metricsCollector.collectSystemMetrics(['memory']);

      expect(result.memory).toBeDefined();
      expect(typeof result.memory.used).toBe('number');
      expect(typeof result.memory.total).toBe('number');
      expect(typeof result.memory.percentage).toBe('number');
      expect(result.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(result.memory.percentage).toBeLessThanOrEqual(100);
    });

    test('should collect disk metrics', async () => {
      const result = await metricsCollector.collectSystemMetrics(['disk']);

      expect(result.disk).toBeDefined();
      expect(typeof result.disk.used).toBe('number');
      expect(typeof result.disk.total).toBe('number');
      expect(typeof result.disk.percentage).toBe('number');
      expect(result.disk.percentage).toBeGreaterThanOrEqual(0);
      expect(result.disk.percentage).toBeLessThanOrEqual(100);
    });

    test('should collect network metrics', async () => {
      const result = await metricsCollector.collectSystemMetrics(['network']);

      expect(result.network).toBeDefined();
      expect(typeof result.network.bytesIn).toBe('number');
      expect(typeof result.network.bytesOut).toBe('number');
      expect(result.network.bytesIn).toBeGreaterThanOrEqual(0);
      expect(result.network.bytesOut).toBeGreaterThanOrEqual(0);
    });

    test('should collect multiple system metrics', async () => {
      const result = await metricsCollector.collectSystemMetrics(['cpu', 'memory', 'disk']);

      expect(result.cpu).toBeDefined();
      expect(result.memory).toBeDefined();
      expect(result.disk).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('HTTP Metrics Collection', () => {
    test('should collect metrics from HTTP endpoint', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          requests_total: 1250,
          request_duration_ms: 45.2,
          active_connections: 12,
          errors_total: 3
        })
      });

      const result = await metricsCollector.collectHttpMetrics({
        url: 'http://localhost:3000/metrics'
      });

      expect(result.success).toBe(true);
      expect(result.metrics.requests_total).toBe(1250);
      expect(result.metrics.request_duration_ms).toBe(45.2);
      expect(result.metrics.active_connections).toBe(12);
      expect(result.metrics.errors_total).toBe(3);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should handle HTTP metrics collection failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await metricsCollector.collectHttpMetrics({
        url: 'http://localhost:3000/metrics'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should handle invalid JSON response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      const result = await metricsCollector.collectHttpMetrics({
        url: 'http://localhost:3000/metrics'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid JSON');
    });
  });

  describe('Custom Metrics Collection', () => {
    test('should execute custom metrics collector', async () => {
      const customCollector = jest.fn().mockResolvedValue({
        database: {
          connections: 25,
          queryTime: 12.5,
          poolSize: 10
        },
        cache: {
          hitRate: 95.2,
          memoryUsage: 512
        }
      });

      const result = await metricsCollector.collectCustomMetrics({
        name: 'database-metrics',
        collector: customCollector
      });

      expect(result.success).toBe(true);
      expect(result.metrics.database.connections).toBe(25);
      expect(result.metrics.cache.hitRate).toBe(95.2);
      expect(customCollector).toHaveBeenCalled();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    test('should handle custom collector failure', async () => {
      const failingCollector = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const result = await metricsCollector.collectCustomMetrics({
        name: 'database-metrics',
        collector: failingCollector
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Metrics Collection Execution', () => {
    test('should collect all metrics for deployment', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ requests_total: 100 })
      });

      const customCollector = jest.fn().mockResolvedValue({ connections: 50 });

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu', 'memory']
      });

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/metrics'
      });

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database',
        collector: customCollector
      });

      const result = await metricsCollector.collectMetrics('deploy-123');

      expect(result.deploymentId).toBe('deploy-123');
      expect(result.collections).toHaveLength(3);
      
      // Find each type of collection
      const systemCollection = result.collections.find(c => c.type === 'system');
      const httpCollection = result.collections.find(c => c.type === 'http');
      const customCollection = result.collections.find(c => c.type === 'custom');

      expect(systemCollection.success).toBe(true);
      expect(systemCollection.metrics.cpu).toBeDefined();
      expect(systemCollection.metrics.memory).toBeDefined();

      expect(httpCollection.success).toBe(true);
      expect(httpCollection.metrics.requests_total).toBe(100);

      expect(customCollection.success).toBe(true);
      expect(customCollection.metrics.connections).toBe(50);
    });

    test('should handle deployment with no metrics collectors', async () => {
      const result = await metricsCollector.collectMetrics('nonexistent-deployment');

      expect(result.deploymentId).toBe('nonexistent-deployment');
      expect(result.collections).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Scheduled Metrics Collection', () => {
    test('should start scheduled metrics collection', async () => {
      jest.useFakeTimers();

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ requests_total: 100 })
      });

      const onMetricsCollected = jest.fn();
      metricsCollector.on('metrics:collected', onMetricsCollected);

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu'],
        interval: 1000
      });

      metricsCollector.startScheduledCollection('deploy-123');

      // Fast-forward time
      await jest.advanceTimersByTimeAsync(1000);

      expect(onMetricsCollected).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('should emit metrics collected events', async () => {
      const onMetricsCollected = jest.fn();
      metricsCollector.on('metrics:collected', onMetricsCollected);

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu']
      });

      await metricsCollector.collectMetrics('deploy-123');

      expect(onMetricsCollected).toHaveBeenCalledWith(
        expect.objectContaining({
          deploymentId: 'deploy-123',
          collections: expect.any(Array),
          timestamp: expect.any(Date)
        })
      );
    });

    test('should stop scheduled metrics collection', () => {
      jest.useFakeTimers();

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu'],
        interval: 1000
      });

      metricsCollector.startScheduledCollection('deploy-123');
      expect(metricsCollector.scheduledCollections.has('deploy-123')).toBe(true);

      metricsCollector.stopScheduledCollection('deploy-123');
      expect(metricsCollector.scheduledCollections.has('deploy-123')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Metrics History and Storage', () => {
    test('should store metrics in history', async () => {
      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu']
      });

      await metricsCollector.collectMetrics('deploy-123');
      await metricsCollector.collectMetrics('deploy-123');

      const history = metricsCollector.getMetricsHistory('deploy-123');

      expect(history).toHaveLength(2);
      expect(history[0].deploymentId).toBe('deploy-123');
      expect(history[1].deploymentId).toBe('deploy-123');
    });

    test('should limit metrics history size', async () => {
      metricsCollector.maxHistorySize = 3;

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu']
      });

      // Collect 5 times
      for (let i = 0; i < 5; i++) {
        await metricsCollector.collectMetrics('deploy-123');
      }

      const history = metricsCollector.getMetricsHistory('deploy-123');
      expect(history).toHaveLength(3); // Limited to maxHistorySize
    });

    test('should get latest metrics for deployment', async () => {
      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu']
      });

      await metricsCollector.collectMetrics('deploy-123');
      const latest = metricsCollector.getLatestMetrics('deploy-123');

      expect(latest).toBeDefined();
      expect(latest.deploymentId).toBe('deploy-123');
      expect(latest.collections[0].metrics.cpu).toBeDefined();
    });
  });

  describe('Metrics Aggregation', () => {
    test('should aggregate metrics across deployments', async () => {
      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu', 'memory']
      });

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-456',
        type: 'system', 
        metrics: ['cpu', 'memory']
      });

      await metricsCollector.collectMetrics('deploy-123');
      await metricsCollector.collectMetrics('deploy-456');

      const aggregated = metricsCollector.getAggregatedMetrics();

      expect(aggregated.totalDeployments).toBe(2);
      expect(aggregated.totalCollectors).toBe(2);
      expect(aggregated.averageCpuUsage).toBeGreaterThanOrEqual(0);
      expect(aggregated.averageMemoryUsage).toBeGreaterThanOrEqual(0);
      expect(aggregated.timestamp).toBeInstanceOf(Date);
    });

    test('should get metrics summary', () => {
      // Add some metrics history
      metricsCollector.metricsHistory.set('deploy-123', [
        { timestamp: new Date(), collections: [{ type: 'system', metrics: { cpu: { usage: 50 } } }] },
        { timestamp: new Date(), collections: [{ type: 'system', metrics: { cpu: { usage: 60 } } }] }
      ]);

      const summary = metricsCollector.getMetricsSummary();

      expect(summary.totalDeployments).toBe(1);
      expect(summary.deploymentsWithHistory).toBe(1);
      expect(summary.totalHistoryEntries).toBe(2);
      expect(summary.deploymentMetrics['deploy-123']).toBeDefined();
    });
  });

  describe('Metrics Configuration', () => {
    test('should update metrics collector configuration', () => {
      const initialConfig = {
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu'],
        interval: 5000
      };

      metricsCollector.addMetricsCollector(initialConfig);

      const updatedConfig = {
        metrics: ['cpu', 'memory', 'disk'],
        interval: 10000
      };

      metricsCollector.updateMetricsCollector('deploy-123', 0, updatedConfig);

      const collectors = metricsCollector.getMetricsCollectors('deploy-123');
      expect(collectors[0].metrics).toEqual(['cpu', 'memory', 'disk']);
      expect(collectors[0].interval).toBe(10000);
    });

    test('should remove metrics collector', () => {
      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu']
      });

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/metrics'
      });

      expect(metricsCollector.getMetricsCollectors('deploy-123')).toHaveLength(2);

      metricsCollector.removeMetricsCollector('deploy-123', 0);

      expect(metricsCollector.getMetricsCollectors('deploy-123')).toHaveLength(1);
      expect(metricsCollector.getMetricsCollectors('deploy-123')[0].type).toBe('http');
    });

    test('should remove all metrics collectors for deployment', () => {
      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-123',
        type: 'system',
        metrics: ['cpu']
      });

      metricsCollector.addMetricsCollector({
        deploymentId: 'deploy-456',
        type: 'system',
        metrics: ['memory']
      });

      metricsCollector.removeAllMetricsCollectors('deploy-123');

      expect(metricsCollector.getMetricsCollectors('deploy-123')).toHaveLength(0);
      expect(metricsCollector.getMetricsCollectors('deploy-456')).toHaveLength(1);
    });
  });
});