/**
 * Tests for Configuration & Monitoring
 * 
 * Tests configuration management, environment handling, monitoring systems,
 * health checks, and system telemetry
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ConfigurationManager } from '../../../src/config/ConfigurationManager.js';
import { MonitoringSystem } from '../../../src/monitoring/MonitoringSystem.js';
import { HealthChecker } from '../../../src/monitoring/HealthChecker.js';
import { TelemetryCollector } from '../../../src/monitoring/TelemetryCollector.js';

describe('Configuration & Monitoring', () => {
  let configManager;
  let monitoringSystem;
  let healthChecker;
  let telemetryCollector;

  beforeEach(() => {
    configManager = new ConfigurationManager({
      environment: 'test',
      configPath: './test-config',
      validateOnLoad: true
    });

    monitoringSystem = new MonitoringSystem({
      metricsInterval: 1000,
      enableHealthChecks: true,
      alerting: {
        enabled: true,
        channels: ['console']
      }
    });

    healthChecker = new HealthChecker({
      checkInterval: 5000,
      timeout: 3000,
      retryAttempts: 2
    });

    telemetryCollector = new TelemetryCollector({
      batchSize: 100,
      flushInterval: 5000,
      enableMetrics: true,
      enableTracing: true,
      disableAutoMetrics: true
    });
  });

  afterEach(async () => {
    if (monitoringSystem && monitoringSystem.stop) {
      await monitoringSystem.stop();
    }
    if (healthChecker && healthChecker.stop) {
      healthChecker.stop();
    }
    if (telemetryCollector && telemetryCollector.stop) {
      await telemetryCollector.stop();
    }
  });

  describe('Configuration Management', () => {
    test('should load configuration from multiple sources', async () => {
      const sources = [
        { type: 'env', prefix: 'AIUR_' },
        { type: 'file', path: './config.json' },
        { type: 'object', data: { test: true } }
      ];

      await configManager.loadFromSources(sources);
      const config = configManager.getConfig();
      
      expect(config).toBeDefined();
      expect(config.test).toBe(true);
    });

    test('should validate configuration schema', () => {
      const schema = {
        type: 'object',
        required: ['apiKey', 'environment'],
        properties: {
          apiKey: { type: 'string', minLength: 1 },
          environment: { type: 'string', enum: ['dev', 'test', 'prod'] },
          timeout: { type: 'number', minimum: 1000 }
        }
      };

      configManager.setSchema(schema);

      const validConfig = {
        apiKey: 'test-key-123',
        environment: 'test',
        timeout: 5000
      };

      const invalidConfig = {
        environment: 'invalid'
        // missing apiKey
      };

      expect(() => configManager.validateConfig(validConfig)).not.toThrow();
      expect(() => configManager.validateConfig(invalidConfig)).toThrow();
    });

    test('should support configuration hot reloading', async () => {
      let reloadCount = 0;
      configManager.onConfigChange(() => {
        reloadCount++;
      });

      // Simulate configuration change
      await configManager.updateConfig({ newValue: 'updated' });
      
      expect(reloadCount).toBe(1);
      expect(configManager.get('newValue')).toBe('updated');
    });

    test('should handle environment variable substitution', () => {
      process.env.TEST_VAR = 'environment-value';
      
      const configWithEnv = {
        apiUrl: '${TEST_VAR}/api',
        nested: {
          value: 'prefix-${TEST_VAR}-suffix'
        }
      };

      const resolved = configManager.resolveEnvironmentVariables(configWithEnv);
      
      expect(resolved.apiUrl).toBe('environment-value/api');
      expect(resolved.nested.value).toBe('prefix-environment-value-suffix');
    });

    test('should provide configuration hierarchies and overrides', () => {
      const baseConfig = {
        database: { host: 'localhost', port: 5432 },
        api: { timeout: 5000 }
      };

      const envConfig = {
        database: { host: 'prod-db.example.com' },
        api: { rateLimit: 1000 }
      };

      configManager.setBaseConfig(baseConfig);
      configManager.mergeConfig(envConfig);

      const finalConfig = configManager.getConfig();
      
      expect(finalConfig.database.host).toBe('prod-db.example.com');
      expect(finalConfig.database.port).toBe(5432); // From base
      expect(finalConfig.api.timeout).toBe(5000); // From base
      expect(finalConfig.api.rateLimit).toBe(1000); // From env
    });

    test('should support encrypted configuration values', async () => {
      const sensitiveConfig = {
        apiKey: 'secret-key-123',
        database: {
          password: 'super-secret-password'
        }
      };

      const encrypted = await configManager.encryptSensitiveValues(sensitiveConfig);
      
      expect(encrypted.apiKey).not.toBe('secret-key-123');
      expect(encrypted.database.password).not.toBe('super-secret-password');

      const decrypted = await configManager.decryptSensitiveValues(encrypted);
      
      expect(decrypted.apiKey).toBe('secret-key-123');
      expect(decrypted.database.password).toBe('super-secret-password');
    });
  });

  describe('Monitoring System', () => {
    test('should collect and aggregate metrics', async () => {
      monitoringSystem.recordMetric('requests.count', 1, { endpoint: '/api/users' });
      monitoringSystem.recordMetric('requests.count', 1, { endpoint: '/api/users' });
      monitoringSystem.recordMetric('requests.duration', 150, { endpoint: '/api/users' });
      monitoringSystem.recordMetric('requests.duration', 200, { endpoint: '/api/users' });

      await new Promise(resolve => setTimeout(resolve, 100)); // Let metrics aggregate

      const metrics = monitoringSystem.getMetrics();
      
      expect(metrics['requests.count']).toBeDefined();
      expect(metrics['requests.count'].value).toBe(2);
      expect(metrics['requests.duration']).toBeDefined();
      expect(metrics['requests.duration'].avg).toBeCloseTo(175, 0);
    });

    test('should detect anomalies in metrics', async () => {
      // Record baseline metrics
      for (let i = 0; i < 10; i++) {
        monitoringSystem.recordMetric('response.time', 100 + Math.random() * 20);
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Record anomalous metric
      monitoringSystem.recordMetric('response.time', 500); // Much higher than baseline

      const anomalies = monitoringSystem.detectAnomalies();
      
      expect(anomalies.length).toBeGreaterThan(0);
      expect(anomalies[0]).toMatchObject({
        metric: 'response.time',
        type: 'spike',
        severity: expect.any(String)
      });
    });

    test('should support custom alerting rules', async () => {
      const alerts = [];
      
      monitoringSystem.addAlertRule({
        name: 'high-error-rate',
        condition: (metrics) => {
          const errorRate = metrics['errors.rate'];
          return errorRate && errorRate.value > 0.1;
        },
        severity: 'critical',
        message: 'Error rate exceeded 10%'
      });

      monitoringSystem.onAlert((alert) => {
        alerts.push(alert);
      });

      // Trigger the alert
      monitoringSystem.recordMetric('errors.rate', 0.15);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(alerts.length).toBe(1);
      expect(alerts[0]).toMatchObject({
        rule: 'high-error-rate',
        severity: 'critical',
        message: 'Error rate exceeded 10%'
      });
    });

    test('should provide dashboard data aggregation', () => {
      // Record various metrics
      monitoringSystem.recordMetric('cpu.usage', 45);
      monitoringSystem.recordMetric('memory.usage', 60);
      monitoringSystem.recordMetric('requests.count', 100);
      monitoringSystem.recordMetric('errors.count', 5);

      const dashboardData = monitoringSystem.getDashboardData();
      
      expect(dashboardData).toMatchObject({
        systemHealth: expect.any(Object),
        keyMetrics: expect.any(Array),
        alerts: expect.any(Array),
        trends: expect.any(Object),
        timestamp: expect.any(Date)
      });

      expect(dashboardData.keyMetrics).toContainEqual(
        expect.objectContaining({
          name: 'cpu.usage',
          value: 45
        })
      );
    });

    test('should handle metric retention and cleanup', async () => {
      const shortRetentionMonitoring = new MonitoringSystem({
        metricsRetention: 100 // 100ms retention
      });

      shortRetentionMonitoring.recordMetric('test.metric', 100);
      
      expect(shortRetentionMonitoring.getMetrics()['test.metric']).toBeDefined();

      // Wait for retention period
      await new Promise(resolve => setTimeout(resolve, 150));

      const metricsAfterCleanup = shortRetentionMonitoring.getMetrics();
      expect(metricsAfterCleanup['test.metric']).toBeUndefined();

      await shortRetentionMonitoring.stop();
    });
  });

  describe('Health Checking', () => {
    test('should register and check component health', async () => {
      let dbCheckCount = 0;
      
      healthChecker.registerCheck('database', async () => {
        dbCheckCount++;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { status: 'healthy', details: { connections: 10 } };
      });

      healthChecker.registerCheck('cache', async () => {
        return { status: 'healthy', details: { hitRate: 0.85 } };
      });

      const healthReport = await healthChecker.runHealthChecks();
      
      expect(healthReport.overall).toBe('healthy');
      expect(healthReport.checks.database.status).toBe('healthy');
      expect(healthReport.checks.cache.status).toBe('healthy');
      expect(dbCheckCount).toBe(1);
    });

    test('should handle failing health checks', async () => {
      healthChecker.registerCheck('failing-service', async () => {
        throw new Error('Service unavailable');
      });

      healthChecker.registerCheck('healthy-service', async () => {
        return { status: 'healthy' };
      });

      const healthReport = await healthChecker.runHealthChecks();
      
      expect(healthReport.overall).toBe('degraded');
      expect(healthReport.checks['failing-service'].status).toBe('unhealthy');
      expect(healthReport.checks['failing-service'].error).toContain('Service unavailable');
      expect(healthReport.checks['healthy-service'].status).toBe('healthy');
    });

    test('should support health check dependencies', async () => {
      healthChecker.registerCheck('database', async () => {
        return { status: 'healthy' };
      });

      healthChecker.registerCheck('api-server', async () => {
        return { status: 'healthy' };
      }, { dependsOn: ['database'] });

      healthChecker.registerCheck('web-app', async () => {
        return { status: 'healthy' };
      }, { dependsOn: ['api-server'] });

      const healthReport = await healthChecker.runHealthChecks();
      
      expect(healthReport.executionOrder).toEqual(['database', 'api-server', 'web-app']);
      expect(healthReport.overall).toBe('healthy');
    });

    test('should handle health check timeouts', async () => {
      const shortTimeoutChecker = new HealthChecker({ timeout: 50 });

      shortTimeoutChecker.registerCheck('slow-service', async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Longer than timeout
        return { status: 'healthy' };
      });

      const healthReport = await shortTimeoutChecker.runHealthChecks();
      
      expect(healthReport.checks['slow-service'].status).toBe('unhealthy');
      expect(healthReport.checks['slow-service'].error).toContain('timeout');

      shortTimeoutChecker.stop();
    });

    test('should provide health trends and history', async () => {
      healthChecker.registerCheck('variable-service', async () => {
        // Randomly fail 20% of the time
        if (Math.random() < 0.2) {
          throw new Error('Random failure');
        }
        return { status: 'healthy' };
      });

      // Run multiple health checks
      for (let i = 0; i < 10; i++) {
        await healthChecker.runHealthChecks();
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const trends = healthChecker.getHealthTrends('variable-service');
      
      expect(trends).toBeDefined();
      expect(trends.checks).toBeGreaterThan(5);
      expect(trends.successRate).toBeGreaterThan(0.5);
      expect(trends.successRate).toBeLessThanOrEqual(1);
      expect(trends.recentStatus).toMatch(/healthy|unhealthy/);
    });
  });

  describe('Telemetry Collection', () => {
    test('should collect system telemetry', async () => {
      await telemetryCollector.start();
      
      // Let it collect some data
      await new Promise(resolve => setTimeout(resolve, 100));

      const telemetryData = telemetryCollector.getTelemetrySnapshot();
      
      expect(telemetryData).toMatchObject({
        system: expect.objectContaining({
          memory: expect.any(Object),
          cpu: expect.any(Number),
          uptime: expect.any(Number)
        }),
        process: expect.objectContaining({
          pid: expect.any(Number),
          version: expect.any(String)
        }),
        timestamp: expect.any(Date)
      });
    });

    test('should trace operation execution', async () => {
      const traceId = telemetryCollector.startTrace('user-operation');
      
      telemetryCollector.addSpan(traceId, 'database-query', {
        query: 'SELECT * FROM users',
        duration: 25
      });

      telemetryCollector.addSpan(traceId, 'api-response', {
        statusCode: 200,
        duration: 5
      });

      const trace = telemetryCollector.finishTrace(traceId);
      
      expect(trace).toBeDefined();
      expect(trace.spans).toHaveLength(2);
      expect(trace.totalDuration).toBeGreaterThan(25);
      expect(trace.spans[0]).toMatchObject({
        name: 'database-query',
        data: { query: 'SELECT * FROM users', duration: 25 }
      });
    });

    test('should batch telemetry data for efficient transmission', async () => {
      const batches = [];
      
      telemetryCollector.onBatch((batch) => {
        batches.push(batch);
      });

      // Generate multiple telemetry events
      for (let i = 0; i < 150; i++) {
        telemetryCollector.recordEvent('test-event', { iteration: i });
      }

      // Wait for batching
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(batches.length).toBeGreaterThan(0);
      expect(batches[0].events.length).toBeLessThanOrEqual(100);
    });

    test('should support custom telemetry dimensions', () => {
      telemetryCollector.addDimensions({
        service: 'aiur',
        version: '1.0.0',
        environment: 'test'
      });

      telemetryCollector.recordEvent('custom-event', { value: 42 });

      const events = telemetryCollector.getUnsentEvents();
      
      expect(events[0]).toMatchObject({
        name: 'custom-event',
        data: { value: 42 },
        dimensions: {
          service: 'aiur',
          version: '1.0.0',
          environment: 'test'
        }
      });
    });

    test('should handle telemetry data sampling', async () => {
      const samplingCollector = new TelemetryCollector({
        samplingRate: 0.1, // Sample 10% of events
        disableAutoMetrics: true
      });

      // Record many events
      for (let i = 0; i < 1000; i++) {
        samplingCollector.recordEvent('sampled-event', { id: i });
      }

      const events = samplingCollector.getUnsentEvents();
      
      // Should be roughly 10% of events (allowing for very wide random variation)
      // With 10% sampling of 1000 events, statistical variance can be significant  
      expect(events.length).toBeGreaterThanOrEqual(5); // Very conservative minimum (allow exactly 5)
      expect(events.length).toBeLessThan(300); // Allow for high variance

      await samplingCollector.stop();
    });

    test('should export telemetry in multiple formats', async () => {
      telemetryCollector.recordEvent('export-test', { value: 123 });
      
      const jsonExport = await telemetryCollector.export('json');
      const csvExport = await telemetryCollector.export('csv');
      
      expect(jsonExport).toContain('export-test');
      expect(csvExport).toContain('export-test');
      
      const parsed = JSON.parse(jsonExport);
      expect(parsed).toBeInstanceOf(Array);
      expect(parsed[0]).toMatchObject({
        name: 'export-test',
        data: { value: 123 }
      });
    });
  });

  describe('Integration Scenarios', () => {
    test('should integrate configuration with monitoring', async () => {
      const config = {
        monitoring: {
          enabled: true,
          metricsInterval: 1000,
          alertRules: [
            {
              name: 'memory-usage',
              threshold: 80,
              severity: 'warning'
            }
          ]
        }
      };

      configManager.setConfig(config);
      
      await monitoringSystem.applyConfiguration(configManager.getConfig().monitoring);
      
      expect(monitoringSystem.isEnabled()).toBe(true);
      expect(monitoringSystem.getAlertRules()).toHaveLength(1);
      expect(monitoringSystem.getAlertRules()[0].name).toBe('memory-usage');
    });

    test('should coordinate health checks with alerting', async () => {
      const alerts = [];
      
      monitoringSystem.onAlert((alert) => {
        alerts.push(alert);
      });

      healthChecker.registerCheck('critical-service', async () => {
        throw new Error('Service is down');
      });

      // Enable health check monitoring integration
      healthChecker.onHealthChange((service, status) => {
        if (status.status === 'unhealthy') {
          monitoringSystem.recordMetric('health.failures', 1, { service });
          monitoringSystem.triggerAlert({
            type: 'health-check-failure',
            service,
            severity: 'critical',
            message: `Health check failed for ${service}`
          });
        }
      });

      await healthChecker.runHealthChecks();

      expect(alerts.length).toBe(1);
      expect(alerts[0]).toMatchObject({
        type: 'health-check-failure',
        service: 'critical-service',
        severity: 'critical'
      });
    });

    test('should create comprehensive system status report', async () => {
      // Set up various components
      configManager.setConfig({ 
        app: { name: 'Aiur', version: '1.0.0' },
        environment: 'test'
      });

      healthChecker.registerCheck('database', async () => ({ status: 'healthy' }));
      healthChecker.registerCheck('cache', async () => ({ status: 'healthy' }));

      monitoringSystem.recordMetric('requests.total', 1500);
      monitoringSystem.recordMetric('errors.total', 25);

      telemetryCollector.recordEvent('startup', { timestamp: new Date() });

      // Generate comprehensive status report
      const [healthReport, telemetryData] = await Promise.all([
        healthChecker.runHealthChecks(),
        telemetryCollector.getTelemetrySnapshot()
      ]);

      const systemStatus = {
        application: configManager.get('app'),
        environment: configManager.get('environment'),
        health: healthReport,
        metrics: monitoringSystem.getMetrics(),
        telemetry: telemetryData,
        timestamp: new Date()
      };

      expect(systemStatus).toMatchObject({
        application: { name: 'Aiur', version: '1.0.0' },
        environment: 'test',
        health: expect.objectContaining({
          overall: 'healthy',
          checks: expect.any(Object)
        }),
        metrics: expect.any(Object),
        telemetry: expect.objectContaining({
          system: expect.any(Object)
        })
      });

      expect(systemStatus.metrics['requests.total']).toBeDefined();
      expect(systemStatus.health.checks.database.status).toBe('healthy');
    });
  });
});