/**
 * @fileoverview Unit tests for ServerManager - Web server lifecycle management
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServerManager } from '../../src/managers/ServerManager.js';
import { EventEmitter } from 'events';

describe('ServerManager', () => {
  let serverManager;
  let mockProcessManager;
  let mockLogStorage;

  beforeEach(() => {
    mockProcessManager = {
      startProcess: jest.fn().mockResolvedValue({
        processId: 'process-123',
        sessionId: 'session-456',
        pid: 12345
      }),
      kill: jest.fn().mockResolvedValue(true),
      getProcessInfo: jest.fn().mockReturnValue({
        status: 'running',
        pid: 12345
      }),
      on: jest.fn(),
      emit: jest.fn()
    };

    mockLogStorage = {
      storeLog: jest.fn().mockResolvedValue(true)
    };

    serverManager = new ServerManager(mockProcessManager, mockLogStorage);
  });

  describe('Constructor', () => {
    it('should create ServerManager instance', () => {
      expect(serverManager).toBeInstanceOf(ServerManager);
    });

    it('should extend EventEmitter', () => {
      expect(serverManager).toBeInstanceOf(EventEmitter);
    });

    it('should initialize with ProcessManager dependency', () => {
      expect(serverManager.processManager).toBe(mockProcessManager);
    });

    it('should initialize with LogStorage dependency', () => {
      expect(serverManager.logStorage).toBe(mockLogStorage);
    });

    it('should initialize empty servers registry', () => {
      expect(serverManager.servers).toBeInstanceOf(Map);
      expect(serverManager.servers.size).toBe(0);
    });

    it('should initialize port registry', () => {
      expect(serverManager.usedPorts).toBeInstanceOf(Set);
      expect(serverManager.usedPorts.size).toBe(0);
    });
  });

  describe('Server Registration', () => {
    it('should track server metadata', () => {
      const serverId = 'server-123';
      const metadata = {
        port: 3000,
        projectPath: '/test/project',
        command: 'npm start',
        processId: 'process-123'
      };

      serverManager.registerServer(serverId, metadata);

      const server = serverManager.getServer(serverId);
      expect(server).toEqual(expect.objectContaining(metadata));
    });

    it('should track server status', () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      const server = serverManager.getServer(serverId);
      expect(server.status).toBe('starting');
    });

    it('should track server start time', () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      const server = serverManager.getServer(serverId);
      expect(server.startTime).toBeInstanceOf(Date);
    });

    it('should prevent duplicate server registration', () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      expect(() => {
        serverManager.registerServer(serverId, { port: 3001 });
      }).toThrow('Server already registered');
    });

    it('should track port usage', () => {
      serverManager.registerServer('server-1', { port: 3000 });
      serverManager.registerServer('server-2', { port: 3001 });

      expect(serverManager.usedPorts.has(3000)).toBe(true);
      expect(serverManager.usedPorts.has(3001)).toBe(true);
    });
  });

  describe('Port Management', () => {
    it('should find available port', async () => {
      const port = await serverManager.findAvailablePort(3000);
      expect(port).toBeGreaterThanOrEqual(3000);
    });

    it('should skip used ports', async () => {
      serverManager.usedPorts.add(3000);
      serverManager.usedPorts.add(3001);

      const port = await serverManager.findAvailablePort(3000);
      expect(port).toBeGreaterThanOrEqual(3002);
    });

    it('should check if port is available', async () => {
      const available = await serverManager.isPortAvailable(3000);
      expect(typeof available).toBe('boolean');
    });

    it('should handle port conflicts', async () => {
      serverManager.usedPorts.add(3000);

      const available = await serverManager.isPortAvailable(3000);
      expect(available).toBe(false);
    });

    it('should allocate port for server', async () => {
      const port = await serverManager.allocatePort('server-123', 3000);
      
      expect(port).toBeGreaterThanOrEqual(3000);
      expect(serverManager.usedPorts.has(port)).toBe(true);
    });

    it('should release port on server stop', () => {
      serverManager.registerServer('server-123', { port: 3000 });
      serverManager.unregisterServer('server-123');

      expect(serverManager.usedPorts.has(3000)).toBe(false);
    });
  });

  describe('Web Server Startup', () => {
    it('should start web server process', async () => {
      const result = await serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start',
        port: 3000
      });

      expect(mockProcessManager.startProcess).toHaveBeenCalled();
      expect(result.serverId).toBeDefined();
      expect(result.port).toBe(3000);
    });

    it('should inject PORT environment variable', async () => {
      await serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start',
        port: 3000
      });

      const callArgs = mockProcessManager.startProcess.mock.calls[0][0];
      expect(callArgs.env).toHaveProperty('PORT', '3000');
    });

    it('should handle custom environment variables', async () => {
      await serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start',
        port: 3000,
        env: {
          NODE_ENV: 'production',
          API_KEY: 'test-key'
        }
      });

      const callArgs = mockProcessManager.startProcess.mock.calls[0][0];
      expect(callArgs.env).toHaveProperty('NODE_ENV', 'production');
      expect(callArgs.env).toHaveProperty('API_KEY', 'test-key');
      expect(callArgs.env).toHaveProperty('PORT', '3000');
    });

    it('should auto-allocate port if not specified', async () => {
      const result = await serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start'
      });

      expect(result.port).toBeGreaterThanOrEqual(3000);
    });

    it('should emit server start event', async () => {
      const startListener = jest.fn();
      serverManager.on('serverStarted', startListener);

      await serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start',
        port: 3000
      });

      expect(startListener).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: expect.any(String),
          port: 3000
        })
      );
    });
  });

  describe('Server Readiness Detection', () => {
    it('should wait for server to be ready', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      // Simulate server becoming ready after delay
      setTimeout(() => {
        serverManager.updateServerStatus(serverId, 'running');
      }, 100);

      const ready = await serverManager.waitForServerReady(serverId, 5000);
      expect(ready).toBe(true);
    });

    it('should timeout waiting for server', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      // Mock port check to always return false (port not in use)
      jest.spyOn(serverManager, 'isPortInUse').mockResolvedValue(false);

      const ready = await serverManager.waitForServerReady(serverId, 100);
      expect(ready).toBe(false);
    });

    it('should detect server ready via port check', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      // Mock port becoming available
      jest.spyOn(serverManager, 'isPortInUse').mockResolvedValue(true);

      const ready = await serverManager.waitForServerReady(serverId, 5000);
      expect(ready).toBe(true);
    });

    it('should handle server startup failure', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000, processId: 'process-123' });

      // Simulate process exit
      mockProcessManager.getProcessInfo.mockReturnValue({ status: 'exited' });

      const ready = await serverManager.waitForServerReady(serverId, 5000);
      expect(ready).toBe(false);
    });
  });

  describe('Health Monitoring', () => {
    it('should check server health', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { 
        port: 3000,
        healthEndpoint: '/health'
      });

      const health = await serverManager.checkServerHealth(serverId);
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('lastCheck');
    });

    it('should store health check results', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      await serverManager.checkServerHealth(serverId);

      const server = serverManager.getServer(serverId);
      expect(server.healthCheck).toBeDefined();
      expect(server.healthCheck.lastCheck).toBeInstanceOf(Date);
    });

    it('should handle health check failure', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      // Mock health check failure
      jest.spyOn(serverManager, 'performHealthCheck').mockRejectedValue(new Error('Connection refused'));

      const health = await serverManager.checkServerHealth(serverId);
      expect(health.status).toBe('unhealthy');
      expect(health.error).toContain('Connection refused');
    });

    it('should support custom health endpoints', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { 
        port: 3000,
        healthEndpoint: '/api/health-check'
      });

      const performHealthCheck = jest.spyOn(serverManager, 'performHealthCheck').mockResolvedValue({ status: 'ok' });

      await serverManager.checkServerHealth(serverId);

      expect(performHealthCheck).toHaveBeenCalledWith(3000, '/api/health-check');
    });
  });

  describe('Server Lifecycle', () => {
    it('should update server status', () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      serverManager.updateServerStatus(serverId, 'running');

      const server = serverManager.getServer(serverId);
      expect(server.status).toBe('running');
    });

    it('should track status transitions', () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });

      serverManager.updateServerStatus(serverId, 'running');
      serverManager.updateServerStatus(serverId, 'unhealthy');

      const server = serverManager.getServer(serverId);
      expect(server.statusHistory).toHaveLength(3); // starting, running, unhealthy
    });

    it('should emit status change events', () => {
      const statusListener = jest.fn();
      serverManager.on('serverStatusChanged', statusListener);

      const serverId = 'server-123';
      serverManager.registerServer(serverId, { port: 3000 });
      serverManager.updateServerStatus(serverId, 'running');

      expect(statusListener).toHaveBeenCalledWith({
        serverId,
        oldStatus: 'starting',
        newStatus: 'running'
      });
    });

    it('should stop server', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { 
        port: 3000,
        processId: 'process-123'
      });

      const result = await serverManager.stopServer(serverId);

      expect(mockProcessManager.kill).toHaveBeenCalledWith('process-123');
      expect(result.success).toBe(true);
    });

    it('should cleanup server on stop', async () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { 
        port: 3000,
        processId: 'process-123'
      });

      await serverManager.stopServer(serverId);

      expect(serverManager.servers.has(serverId)).toBe(false);
      expect(serverManager.usedPorts.has(3000)).toBe(false);
    });

    it('should handle process exit events', () => {
      const serverId = 'server-123';
      serverManager.registerServer(serverId, { 
        port: 3000,
        processId: 'process-123'
      });

      // Simulate process exit event
      serverManager.handleProcessExit('process-123', 0);

      const server = serverManager.getServer(serverId);
      expect(server).toBeUndefined(); // Server should be cleaned up
    });
  });

  describe('Server Queries', () => {
    it('should list all running servers', () => {
      serverManager.registerServer('server-1', { port: 3000 });
      serverManager.registerServer('server-2', { port: 3001 });
      serverManager.updateServerStatus('server-1', 'running');
      serverManager.updateServerStatus('server-2', 'running');

      const running = serverManager.getRunningServers();
      expect(running).toHaveLength(2);
    });

    it('should find server by port', () => {
      serverManager.registerServer('server-123', { port: 3000 });

      const server = serverManager.findServerByPort(3000);
      expect(server).toBeDefined();
      expect(server.serverId).toBe('server-123');
    });

    it('should find server by process ID', () => {
      serverManager.registerServer('server-123', { 
        port: 3000,
        processId: 'process-456'
      });

      const server = serverManager.findServerByProcessId('process-456');
      expect(server).toBeDefined();
      expect(server.serverId).toBe('server-123');
    });

    it('should get server statistics', () => {
      serverManager.registerServer('server-1', { port: 3000 });
      serverManager.registerServer('server-2', { port: 3001 });
      serverManager.updateServerStatus('server-1', 'running');
      serverManager.updateServerStatus('server-2', 'unhealthy');

      const stats = serverManager.getStatistics();

      expect(stats.total).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.unhealthy).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle server start failure', async () => {
      mockProcessManager.startProcess.mockRejectedValue(new Error('Failed to start'));

      await expect(serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start',
        port: 3000
      })).rejects.toThrow('Failed to start');
    });

    it('should cleanup on server start failure', async () => {
      mockProcessManager.startProcess.mockRejectedValue(new Error('Failed to start'));

      try {
        await serverManager.startWebServer({
          projectPath: '/test/project',
          command: 'npm start',
          port: 3000
        });
      } catch (error) {
        // Expected error
      }

      expect(serverManager.usedPorts.has(3000)).toBe(false);
    });

    it('should handle non-existent server operations', async () => {
      const result = await serverManager.stopServer('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Server not found');
    });

    it('should validate port range', async () => {
      await expect(serverManager.allocatePort('server-123', 70000)).rejects.toThrow('Invalid port');
      await expect(serverManager.allocatePort('server-123', -1)).rejects.toThrow('Invalid port');
    });
  });

  describe('Event Emission', () => {
    it('should emit server lifecycle events', async () => {
      const events = [];
      serverManager.on('serverStarted', (data) => events.push({ type: 'started', data }));
      serverManager.on('serverStopped', (data) => events.push({ type: 'stopped', data }));

      await serverManager.startWebServer({
        projectPath: '/test/project',
        command: 'npm start',
        port: 3000
      });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('started');
    });

    it('should emit error events', async () => {
      const errorListener = jest.fn();
      serverManager.on('error', errorListener);

      mockProcessManager.startProcess.mockRejectedValue(new Error('Start failed'));

      try {
        await serverManager.startWebServer({
          projectPath: '/test/project',
          command: 'npm start'
        });
      } catch (error) {
        // Expected
      }

      expect(errorListener).toHaveBeenCalled();
    });
  });
});