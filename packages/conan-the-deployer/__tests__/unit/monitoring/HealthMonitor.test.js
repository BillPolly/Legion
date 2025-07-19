import { jest } from '@jest/globals';

// Import after mocking
const HealthMonitor = (await import('../../../src/monitoring/HealthMonitor.js')).default;

describe('HealthMonitor', () => {
  let healthMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    healthMonitor = new HealthMonitor();
    
    // Reset global fetch mock
    global.fetch = jest.fn();
  });

  afterEach(() => {
    // Clean up any running intervals
    healthMonitor.stopAllChecks();
  });

  describe('Health Check Registration', () => {
    test('should register HTTP health check', () => {
      const config = {
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health',
        interval: 30000
      };

      healthMonitor.addHealthCheck(config);

      const checks = healthMonitor.getHealthChecks('deploy-123');
      expect(checks).toHaveLength(1);
      expect(checks[0].type).toBe('http');
      expect(checks[0].url).toBe('http://localhost:3000/health');
    });

    test('should register custom health check', () => {
      const customCheck = jest.fn().mockResolvedValue({ healthy: true });
      const config = {
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database-connection',
        check: customCheck,
        interval: 15000
      };

      healthMonitor.addHealthCheck(config);

      const checks = healthMonitor.getHealthChecks('deploy-123');
      expect(checks).toHaveLength(1);
      expect(checks[0].type).toBe('custom');
      expect(checks[0].name).toBe('database-connection');
    });

    test('should register multiple health checks for deployment', () => {
      const httpConfig = {
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      };

      const customConfig = {
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'redis-connection',
        check: jest.fn()
      };

      healthMonitor.addHealthCheck(httpConfig);
      healthMonitor.addHealthCheck(customConfig);

      const checks = healthMonitor.getHealthChecks('deploy-123');
      expect(checks).toHaveLength(2);
    });
  });

  describe('HTTP Health Checks', () => {
    test('should perform successful HTTP health check', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ status: 'healthy' })
      });

      const result = await healthMonitor.performHttpCheck({
        url: 'http://localhost:3000/health',
        timeout: 5000
      });

      expect(result.healthy).toBe(true);
      expect(result.status).toBe(200);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );
    });

    test('should handle HTTP health check failure', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

      const result = await healthMonitor.performHttpCheck({
        url: 'http://localhost:3000/health',
        timeout: 5000
      });

      expect(result.healthy).toBe(false);
      expect(result.status).toBe(503);
      expect(result.error).toBe('Service Unavailable');
    });

    test('should handle HTTP timeout', async () => {
      global.fetch.mockRejectedValue(new Error('The operation was aborted'));

      const result = await healthMonitor.performHttpCheck({
        url: 'http://localhost:3000/health',
        timeout: 100
      });

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('aborted');
    });

    test('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await healthMonitor.performHttpCheck({
        url: 'http://localhost:3000/health',
        timeout: 5000
      });

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
  });

  describe('Custom Health Checks', () => {
    test('should perform successful custom health check', async () => {
      const customCheck = jest.fn().mockResolvedValue({
        healthy: true,
        details: { connections: 10, latency: 5 }
      });

      const result = await healthMonitor.performCustomCheck({
        name: 'database',
        check: customCheck
      });

      expect(result.healthy).toBe(true);
      expect(result.details).toEqual({ connections: 10, latency: 5 });
      expect(customCheck).toHaveBeenCalled();
    });

    test('should handle custom health check failure', async () => {
      const customCheck = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const result = await healthMonitor.performCustomCheck({
        name: 'database',
        check: customCheck
      });

      expect(result.healthy).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });

    test('should handle custom check returning false', async () => {
      const customCheck = jest.fn().mockResolvedValue({
        healthy: false,
        reason: 'Too many connections'
      });

      const result = await healthMonitor.performCustomCheck({
        name: 'database',
        check: customCheck
      });

      expect(result.healthy).toBe(false);
      expect(result.reason).toBe('Too many connections');
    });
  });

  describe('Health Check Execution', () => {
    test('should execute all health checks for deployment', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const customCheck = jest.fn().mockResolvedValue({ healthy: true });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database',
        check: customCheck
      });

      const results = await healthMonitor.checkHealth('deploy-123');

      expect(results.overall).toBe('healthy');
      expect(results.checks).toHaveLength(2);
      expect(results.checks[0].type).toBe('http');
      expect(results.checks[1].type).toBe('custom');
      expect(customCheck).toHaveBeenCalled();
    });

    test('should report unhealthy when any check fails', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const failingCheck = jest.fn().mockResolvedValue({ healthy: false });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database',
        check: failingCheck
      });

      const results = await healthMonitor.checkHealth('deploy-123');

      expect(results.overall).toBe('unhealthy');
      expect(results.checks[0].healthy).toBe(true);
      expect(results.checks[1].healthy).toBe(false);
    });

    test('should handle deployment with no health checks', async () => {
      const results = await healthMonitor.checkHealth('nonexistent-deployment');

      expect(results.overall).toBe('unknown');
      expect(results.checks).toHaveLength(0);
    });
  });

  describe('Scheduled Health Checks', () => {
    test('should start scheduled health checks', async () => {
      jest.useFakeTimers();

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      const onHealthChange = jest.fn();
      healthMonitor.on('health:change', onHealthChange);

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health',
        interval: 1000
      });

      healthMonitor.startScheduledChecks('deploy-123');

      // Fast-forward time
      await jest.advanceTimersByTimeAsync(1000);

      expect(global.fetch).toHaveBeenCalled();
      
      jest.useRealTimers();
    });

    test('should emit health change events', async () => {
      const onHealthChange = jest.fn();
      healthMonitor.on('health:change', onHealthChange);

      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })   // healthy
        .mockResolvedValueOnce({ ok: false, status: 503 }); // unhealthy

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      // First check - healthy
      await healthMonitor.checkHealth('deploy-123');
      
      // Second check - unhealthy
      await healthMonitor.checkHealth('deploy-123');

      expect(onHealthChange).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        previousStatus: 'unknown',
        currentStatus: 'healthy',
        timestamp: expect.any(Date)
      });

      expect(onHealthChange).toHaveBeenCalledWith({
        deploymentId: 'deploy-123',
        previousStatus: 'healthy',
        currentStatus: 'unhealthy',
        timestamp: expect.any(Date)
      });
    });

    test('should stop scheduled health checks', () => {
      jest.useFakeTimers();

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health',
        interval: 1000
      });

      healthMonitor.startScheduledChecks('deploy-123');
      expect(healthMonitor.scheduledChecks.has('deploy-123')).toBe(true);

      healthMonitor.stopScheduledChecks('deploy-123');
      expect(healthMonitor.scheduledChecks.has('deploy-123')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Health Status History', () => {
    test('should maintain health status history', async () => {
      global.fetch
        .mockResolvedValueOnce({ ok: true, status: 200 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      await healthMonitor.checkHealth('deploy-123');
      await healthMonitor.checkHealth('deploy-123');
      await healthMonitor.checkHealth('deploy-123');

      const history = healthMonitor.getHealthHistory('deploy-123');

      expect(history).toHaveLength(3);
      expect(history[0].status).toBe('healthy');
      expect(history[1].status).toBe('unhealthy');
      expect(history[2].status).toBe('healthy');
    });

    test('should limit health history size', async () => {
      healthMonitor.maxHistorySize = 3;

      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      // Perform 5 health checks
      for (let i = 0; i < 5; i++) {
        await healthMonitor.checkHealth('deploy-123');
      }

      const history = healthMonitor.getHealthHistory('deploy-123');
      expect(history).toHaveLength(3); // Should be limited to maxHistorySize
    });
  });

  describe('Health Check Configuration', () => {
    test('should update health check configuration', () => {
      const initialConfig = {
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health',
        interval: 30000
      };

      healthMonitor.addHealthCheck(initialConfig);

      const updatedConfig = {
        url: 'http://localhost:3000/api/health',
        interval: 15000,
        timeout: 3000
      };

      healthMonitor.updateHealthCheck('deploy-123', 0, updatedConfig);

      const checks = healthMonitor.getHealthChecks('deploy-123');
      expect(checks[0].url).toBe('http://localhost:3000/api/health');
      expect(checks[0].interval).toBe(15000);
      expect(checks[0].timeout).toBe(3000);
    });

    test('should remove health check', () => {
      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database',
        check: jest.fn()
      });

      expect(healthMonitor.getHealthChecks('deploy-123')).toHaveLength(2);

      healthMonitor.removeHealthCheck('deploy-123', 0);

      expect(healthMonitor.getHealthChecks('deploy-123')).toHaveLength(1);
      expect(healthMonitor.getHealthChecks('deploy-123')[0].type).toBe('custom');
    });

    test('should remove all health checks for deployment', () => {
      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-456',
        type: 'http',
        url: 'http://localhost:3001/health'
      });

      healthMonitor.removeAllHealthChecks('deploy-123');

      expect(healthMonitor.getHealthChecks('deploy-123')).toHaveLength(0);
      expect(healthMonitor.getHealthChecks('deploy-456')).toHaveLength(1);
    });
  });

  describe('Health Aggregation', () => {
    test('should get overall health status', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200 });

      // Add deployments with different health statuses
      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/health'
      });

      healthMonitor.addHealthCheck({
        deploymentId: 'deploy-456',
        type: 'custom',
        name: 'failing-service',
        check: jest.fn().mockResolvedValue({ healthy: false })
      });

      await healthMonitor.checkHealth('deploy-123');
      await healthMonitor.checkHealth('deploy-456');

      const overallStatus = healthMonitor.getOverallHealthStatus();

      expect(overallStatus.status).toBe('unhealthy');
      expect(overallStatus.totalDeployments).toBe(2);
      expect(overallStatus.healthyDeployments).toBe(1);
      expect(overallStatus.unhealthyDeployments).toBe(1);
    });

    test('should get health summary', () => {
      // Add some health history
      healthMonitor.healthHistory.set('deploy-123', [
        { status: 'healthy', timestamp: new Date() },
        { status: 'unhealthy', timestamp: new Date() },
        { status: 'healthy', timestamp: new Date() }
      ]);

      healthMonitor.healthHistory.set('deploy-456', [
        { status: 'healthy', timestamp: new Date() }
      ]);

      // Add current status for deployments (this is what getHealthSummary uses for totalDeployments)
      healthMonitor.currentStatus.set('deploy-123', 'healthy');
      healthMonitor.currentStatus.set('deploy-456', 'healthy');

      const summary = healthMonitor.getHealthSummary();

      expect(summary.totalDeployments).toBe(2);
      expect(summary.deploymentsWithHistory).toBe(2);
      expect(Object.keys(summary.deploymentStatuses)).toContain('deploy-123');
      expect(Object.keys(summary.deploymentStatuses)).toContain('deploy-456');
    });
  });
});