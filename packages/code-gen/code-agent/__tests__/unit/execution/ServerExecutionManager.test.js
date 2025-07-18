/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { ServerExecutionManager } from '../../../src/execution/ServerExecutionManager.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';

describe('ServerExecutionManager', () => {
  let serverManager;
  let mockConfig;

  beforeAll(() => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        maxConcurrentProcesses: 3,
        timeout: 30000,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      }
    });
  });

  beforeEach(() => {
    serverManager = new ServerExecutionManager(mockConfig);
  });

  afterEach(async () => {
    if (serverManager) {
      await serverManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(serverManager.config).toBeDefined();
      expect(serverManager.isInitialized).toBe(false);
      expect(serverManager.runningServers).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await serverManager.initialize();
      
      expect(serverManager.isInitialized).toBe(true);
      expect(serverManager.healthCheckInterval).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await serverManager.initialize();
      
      await expect(serverManager.initialize()).resolves.not.toThrow();
      expect(serverManager.isInitialized).toBe(true);
    });
  });

  describe('Server Management', () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    test('should start server successfully', async () => {
      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['-e', 'console.log("Server started"); process.stdin.resume()'],
        port: 3000,
        workingDirectory: process.cwd(),
        env: { NODE_ENV: 'test' }
      };

      const result = await serverManager.startServer(serverConfig);
      
      expect(result).toBeDefined();
      expect(result.serverId).toBeDefined();
      expect(result.status).toBe('starting');
      expect(result.port).toBe(3000);
      expect(serverManager.runningServers.has(result.serverId)).toBe(true);
    });

    test('should handle server startup errors', async () => {
      const invalidConfig = {
        name: 'invalid-server',
        command: 'nonexistent-command',
        args: [],
        port: 3001
      };

      await expect(serverManager.startServer(invalidConfig)).rejects.toThrow();
    });

    test('should stop server successfully', async () => {
      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['-e', 'console.log("Server started"); process.stdin.resume()'],
        port: 3000
      };

      const startResult = await serverManager.startServer(serverConfig);
      const stopResult = await serverManager.stopServer(startResult.serverId);
      
      expect(stopResult.status).toBe('stopped');
      expect(serverManager.runningServers.has(startResult.serverId)).toBe(false);
    });

    test('should handle stopping non-existent server', async () => {
      await expect(serverManager.stopServer('non-existent-id')).rejects.toThrow();
    });

    test('should restart server successfully', async () => {
      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['-e', 'console.log("Server started"); process.stdin.resume()'],
        port: 3000
      };

      const startResult = await serverManager.startServer(serverConfig);
      const restartResult = await serverManager.restartServer(startResult.serverId);
      
      expect(restartResult.status).toBe('starting');
      expect(restartResult.serverId).toBe(startResult.serverId);
    });

    test('should list running servers', async () => {
      const serverConfig1 = {
        name: 'server-1',
        command: 'node',
        args: ['-e', 'console.log("Server 1"); process.stdin.resume()'],
        port: 3001
      };

      const serverConfig2 = {
        name: 'server-2',
        command: 'node',
        args: ['-e', 'console.log("Server 2"); process.stdin.resume()'],
        port: 3002
      };

      await serverManager.startServer(serverConfig1);
      await serverManager.startServer(serverConfig2);

      const servers = serverManager.listServers();
      
      expect(servers).toHaveLength(2);
      expect(servers.map(s => s.name)).toContain('server-1');
      expect(servers.map(s => s.name)).toContain('server-2');
    });

    test('should get server status', async () => {
      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['-e', 'console.log("Server started"); process.stdin.resume()'],
        port: 3000
      };

      const startResult = await serverManager.startServer(serverConfig);
      const status = await serverManager.getServerStatus(startResult.serverId);
      
      expect(status).toBeDefined();
      expect(status.serverId).toBe(startResult.serverId);
      expect(status.name).toBe('test-server');
      expect(['starting', 'running', 'stopped', 'error']).toContain(status.status);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    test('should perform health checks', async () => {
      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['-e', 'console.log("Server started"); process.stdin.resume()'],
        port: 3000,
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: 1000,
          timeout: 5000
        }
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Wait for health check to run
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const health = await serverManager.getServerHealth(startResult.serverId);
      
      expect(health).toBeDefined();
      expect(health.serverId).toBe(startResult.serverId);
      expect(health.lastCheck).toBeDefined();
      expect(['healthy', 'unhealthy', 'unknown']).toContain(health.status);
    });

    test('should handle health check failures', async () => {
      const serverConfig = {
        name: 'unhealthy-server',
        command: 'node',
        args: ['-e', 'console.log("Starting..."); setTimeout(() => process.exit(1), 200)'], // Server that exits after starting
        port: 3000,
        healthCheck: {
          enabled: true,
          path: '/health',
          interval: 500,
          timeout: 1000
        }
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Wait for health check to detect failure
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const health = await serverManager.getServerHealth(startResult.serverId);
      
      expect(health.status).toBe('unhealthy');
    });

    test('should trigger health check events', async () => {
      const healthCheckSpy = jest.fn();
      serverManager.on('health-check-completed', healthCheckSpy);

      const serverConfig = {
        name: 'test-server',
        command: 'node',
        args: ['-e', 'console.log("Server started"); process.stdin.resume()'],
        port: 3000,
        healthCheck: {
          enabled: true,
          interval: 500
        }
      };

      await serverManager.startServer(serverConfig);
      
      // Wait for health check events
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(healthCheckSpy).toHaveBeenCalled();
    });
  });

  describe('Log Integration', () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    test('should capture server logs', async () => {
      const serverConfig = {
        name: 'logging-server',
        command: 'node',
        args: ['-e', 'console.log("Test log message"); console.error("Test error"); process.stdin.resume()'],
        port: 3000,
        logCapture: {
          enabled: true,
          stdout: true,
          stderr: true
        }
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const logs = await serverManager.getServerLogs(startResult.serverId);
      
      expect(logs).toBeDefined();
      
      // Check if logs is an array (from serverInfo.logs) or an object with logs property
      const logArray = Array.isArray(logs) ? logs : logs.logs;
      expect(logArray).toBeDefined();
      expect(logArray.length).toBeGreaterThan(0);
      expect(logArray.some(log => log.message.includes('Test log message'))).toBe(true);
    });

    test('should stream server logs', async () => {
      const logSpy = jest.fn();
      
      // Subscribe to log events before starting server
      serverManager.on('server-log', logSpy);
      
      const serverConfig = {
        name: 'streaming-server',
        command: 'node',
        args: ['-e', 'console.log("Stream test"); console.log("Another log"); process.stdin.resume()'],
        port: 3000,
        logCapture: {
          enabled: true,
          streaming: true
        }
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Wait for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 800));
      
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    test('should handle server crashes', async () => {
      const crashSpy = jest.fn();
      serverManager.on('server-crashed', crashSpy);

      const serverConfig = {
        name: 'crash-server',
        command: 'node',
        args: ['-e', 'setTimeout(() => process.exit(1), 100)'],
        port: 3000
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Wait for server to crash
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(crashSpy).toHaveBeenCalledWith(expect.objectContaining({
        serverId: startResult.serverId,
        exitCode: 1
      }));
    });

    test('should handle process limits', async () => {
      // Set low process limit for testing
      serverManager.nodeRunnerConfig.maxConcurrentProcesses = 1;

      const serverConfig1 = {
        name: 'server-1',
        command: 'node',
        args: ['-e', 'process.stdin.resume()'],
        port: 3001
      };

      const serverConfig2 = {
        name: 'server-2',
        command: 'node',
        args: ['-e', 'process.stdin.resume()'],
        port: 3002
      };

      await serverManager.startServer(serverConfig1);
      
      await expect(serverManager.startServer(serverConfig2)).rejects.toThrow(/process limit/i);
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    test('should track server performance metrics', async () => {
      const serverConfig = {
        name: 'perf-server',
        command: 'node',
        args: ['-e', 'console.log("Performance test"); process.stdin.resume()'],
        port: 3000,
        monitoring: {
          enabled: true,
          metricsInterval: 500
        }
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Wait for metrics to be collected
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const metrics = await serverManager.getServerMetrics(startResult.serverId);
      
      expect(metrics).toBeDefined();
      expect(metrics.serverId).toBe(startResult.serverId);
      expect(metrics.uptime).toBeGreaterThan(0);
      expect(metrics.memoryUsage).toBeDefined();
      expect(metrics.cpuUsage).toBeDefined();
    });

    test('should provide performance statistics', async () => {
      const stats = await serverManager.getPerformanceStats();
      
      expect(stats).toBeDefined();
      expect(stats.totalServers).toBeDefined();
      expect(stats.runningServers).toBeDefined();
      expect(stats.averageUptime).toBeDefined();
      expect(stats.totalMemoryUsage).toBeDefined();
    });
  });

  describe('Graceful Shutdown', () => {
    beforeEach(async () => {
      await serverManager.initialize();
    });

    test('should perform graceful shutdown', async () => {
      const serverConfig = {
        name: 'graceful-server',
        command: 'node',
        args: ['-e', 'process.on("SIGTERM", () => { console.log("Graceful shutdown"); process.exit(0); }); process.stdin.resume()'],
        port: 3000
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      const shutdownResult = await serverManager.gracefulShutdown(startResult.serverId);
      
      expect(shutdownResult.status).toBe('shutdown');
      expect(shutdownResult.graceful).toBe(true);
    });

    test('should force shutdown if graceful fails', async () => {
      const serverConfig = {
        name: 'stubborn-server',
        command: 'node',
        args: ['-e', 'process.on("SIGTERM", () => {}); process.stdin.resume()'], // Ignores SIGTERM
        port: 3000
      };

      const startResult = await serverManager.startServer(serverConfig);
      
      // Set very short timeout to force kill
      serverManager.nodeRunnerConfig.shutdownTimeout = 50;
      
      const shutdownResult = await serverManager.gracefulShutdown(startResult.serverId);
      
      expect(shutdownResult.status).toBe('shutdown');
      expect(shutdownResult.graceful).toBe(false);
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await serverManager.initialize();
      
      const serverConfig = {
        name: 'cleanup-server',
        command: 'node',
        args: ['-e', 'process.stdin.resume()'],
        port: 3000
      };

      await serverManager.startServer(serverConfig);
      
      expect(serverManager.runningServers.size).toBe(1);
      
      await serverManager.cleanup();
      
      expect(serverManager.runningServers.size).toBe(0);
      expect(serverManager.isInitialized).toBe(false);
    });
  });
});