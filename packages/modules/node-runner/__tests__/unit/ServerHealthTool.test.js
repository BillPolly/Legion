/**
 * @fileoverview Unit tests for ServerHealthTool - System health monitoring
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServerHealthTool } from '../../src/tools/ServerHealthTool.js';

describe('ServerHealthTool', () => {
  let serverHealthTool;
  let mockModule;

  beforeEach(() => {
    mockModule = {
      processManager: {
        getRunningProcesses: jest.fn().mockReturnValue(['process-123', 'process-456']),
        getProcessInfo: jest.fn().mockImplementation((processId) => ({
          processId,
          sessionId: 'session-123',
          command: 'npm start',
          status: 'running',
          pid: 12345,
          cpuUsage: 12.5,
          memoryUsage: 256000000, // 256MB in bytes
          startTime: new Date('2024-01-01T10:00:00Z')
        }))
      },
      sessionManager: {
        listSessions: jest.fn().mockResolvedValue([
          { sessionId: 'session-123', status: 'active' },
          { sessionId: 'session-456', status: 'completed' }
        ]),
        getActiveSessions: jest.fn().mockResolvedValue([
          { sessionId: 'session-123', status: 'active' }
        ])
      },
      logStorage: {
        getStorageStats: jest.fn().mockResolvedValue({
          totalLogs: 10000,
          totalSize: 52428800, // 50MB in bytes
          oldestLog: new Date('2024-01-01T08:00:00Z'),
          newestLog: new Date('2024-01-01T12:00:00Z')
        })
      },
      serverManager: {
        getRunningServers: jest.fn().mockReturnValue([
          {
            serverId: 'server-123',
            port: 3000,
            status: 'running',
            healthCheck: { status: 'healthy', lastCheck: new Date() }
          }
        ])
      },
      webSocketServer: {
        isRunning: jest.fn().mockReturnValue(true),
        getPort: jest.fn().mockReturnValue(8080),
        getConnectedClients: jest.fn().mockReturnValue(2)
      }
    };
    serverHealthTool = new ServerHealthTool(mockModule);
  });

  describe('Tool Definition', () => {
    it('should have correct tool name', () => {
      expect(serverHealthTool.name).toBe('server_health');
    });

    it('should have comprehensive description', () => {
      expect(serverHealthTool.description).toBeTruthy();
      expect(serverHealthTool.description).toContain('health');
      expect(serverHealthTool.description).toContain('status');
    });

    it('should have complete JSON Schema for input validation', () => {
      expect(serverHealthTool.inputSchema).toBeDefined();
      expect(serverHealthTool.inputSchema.type).toBe('object');
      expect(serverHealthTool.inputSchema.properties).toBeDefined();
    });

    it('should define expected parameters', () => {
      const properties = serverHealthTool.inputSchema.properties;
      
      expect(properties.includeProcesses).toBeDefined();
      expect(properties.includeSessions).toBeDefined();
      expect(properties.includeStorage).toBeDefined();
      expect(properties.includeServers).toBeDefined();
      expect(properties.includeWebSocket).toBeDefined();
      expect(properties.includeSystemResources).toBeDefined();
    });

    it('should have proper parameter defaults', () => {
      const properties = serverHealthTool.inputSchema.properties;
      
      expect(properties.includeProcesses.default).toBe(true);
      expect(properties.includeSessions.default).toBe(true);
      expect(properties.includeStorage.default).toBe(true);
      expect(properties.includeServers.default).toBe(true);
      expect(properties.includeWebSocket.default).toBe(true);
      expect(properties.includeSystemResources.default).toBe(false);
    });
  });

  describe('Health Reporting', () => {
    it('should return overall health status', async () => {
      const result = await serverHealthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.overallStatus).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.overallStatus);
    });

    it('should include timestamp in response', async () => {
      const result = await serverHealthTool.execute({});

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should calculate uptime correctly', async () => {
      const result = await serverHealthTool.execute({});

      expect(result.uptime).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Process Health', () => {
    it('should include process information when requested', async () => {
      const input = {
        includeProcesses: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.processes).toBeDefined();
      expect(result.processes.running).toBe(2);
      expect(result.processes.details).toHaveLength(2);
    });

    it('should include process resource usage', async () => {
      const input = {
        includeProcesses: true
      };

      const result = await serverHealthTool.execute(input);

      const processDetail = result.processes.details[0];
      expect(processDetail).toHaveProperty('cpuUsage');
      expect(processDetail).toHaveProperty('memoryUsage');
      expect(processDetail).toHaveProperty('pid');
    });

    it('should skip process information when not requested', async () => {
      const input = {
        includeProcesses: false
      };

      const result = await serverHealthTool.execute(input);

      expect(result.processes).toBeUndefined();
    });
  });

  describe('Session Health', () => {
    it('should include session information when requested', async () => {
      const input = {
        includeSessions: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.sessions).toBeDefined();
      expect(result.sessions.total).toBe(2);
      expect(result.sessions.active).toBe(1);
      expect(result.sessions.completed).toBe(1);
    });

    it('should categorize sessions by status', async () => {
      const input = {
        includeSessions: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.sessions.byStatus).toBeDefined();
      expect(result.sessions.byStatus.active).toBe(1);
      expect(result.sessions.byStatus.completed).toBe(1);
    });
  });

  describe('Storage Health', () => {
    it('should include storage statistics when requested', async () => {
      const input = {
        includeStorage: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.storage).toBeDefined();
      expect(result.storage.totalLogs).toBe(10000);
      expect(result.storage.totalSize).toBe(52428800);
      expect(result.storage.formattedSize).toBe('50.00 MB');
    });

    it('should include log time range', async () => {
      const input = {
        includeStorage: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.storage.oldestLog).toBeDefined();
      expect(result.storage.newestLog).toBeDefined();
    });
  });

  describe('Server Health', () => {
    it('should include server information when requested', async () => {
      const input = {
        includeServers: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.servers).toBeDefined();
      expect(result.servers.running).toBe(1);
      expect(result.servers.details).toHaveLength(1);
    });

    it('should include health check status', async () => {
      const input = {
        includeServers: true
      };

      const result = await serverHealthTool.execute(input);

      const serverDetail = result.servers.details[0];
      expect(serverDetail.healthCheck).toBeDefined();
      expect(serverDetail.healthCheck.status).toBe('healthy');
    });

    it('should handle no running servers', async () => {
      mockModule.serverManager.getRunningServers.mockReturnValueOnce([]);

      const input = {
        includeServers: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.servers.running).toBe(0);
      expect(result.servers.details).toHaveLength(0);
    });
  });

  describe('WebSocket Health', () => {
    it('should include WebSocket status when requested', async () => {
      const input = {
        includeWebSocket: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.webSocket).toBeDefined();
      expect(result.webSocket.running).toBe(true);
      expect(result.webSocket.port).toBe(8080);
      expect(result.webSocket.connectedClients).toBe(2);
    });

    it('should handle WebSocket not running', async () => {
      mockModule.webSocketServer.isRunning.mockReturnValueOnce(false);

      const input = {
        includeWebSocket: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.webSocket.running).toBe(false);
      expect(result.webSocket.connectedClients).toBe(0);
    });
  });

  describe('System Resources', () => {
    it('should include system resources when requested', async () => {
      const input = {
        includeSystemResources: true
      };

      const result = await serverHealthTool.execute(input);

      expect(result.systemResources).toBeDefined();
      expect(result.systemResources).toHaveProperty('totalMemory');
      expect(result.systemResources).toHaveProperty('freeMemory');
      expect(result.systemResources).toHaveProperty('usedMemory');
      expect(result.systemResources).toHaveProperty('memoryUsagePercent');
    });

    it('should not include system resources by default', async () => {
      const input = {};

      const result = await serverHealthTool.execute(input);

      expect(result.systemResources).toBeUndefined();
    });
  });

  describe('Health Status Calculation', () => {
    it('should report healthy when all components are running', async () => {
      const result = await serverHealthTool.execute({});

      expect(result.overallStatus).toBe('healthy');
      expect(result.issues).toHaveLength(0);
    });

    it('should report degraded when some components have issues', async () => {
      // Simulate high memory usage
      mockModule.processManager.getProcessInfo.mockReturnValueOnce({
        processId: 'process-123',
        memoryUsage: 2000000000 // 2GB - high usage
      });

      const result = await serverHealthTool.execute({});

      expect(result.overallStatus).toBe('degraded');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should report unhealthy when critical components fail', async () => {
      // Simulate no running processes
      mockModule.processManager.getRunningProcesses.mockReturnValueOnce([]);

      const result = await serverHealthTool.execute({});

      expect(result.overallStatus).toBe('unhealthy');
      expect(result.issues).toContain('No processes running');
    });
  });

  describe('Error Handling', () => {
    it('should handle component check failures gracefully', async () => {
      mockModule.processManager.getRunningProcesses.mockImplementationOnce(() => {
        throw new Error('Process check failed');
      });

      const result = await serverHealthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.overallStatus).toBe('degraded');
      expect(result.issues).toContain('Failed to check processes: Process check failed');
    });

    it('should continue checking other components on failure', async () => {
      mockModule.sessionManager.listSessions.mockRejectedValueOnce(new Error('Session error'));

      const result = await serverHealthTool.execute({});

      expect(result.success).toBe(true);
      expect(result.processes).toBeDefined(); // Other checks should still run
      expect(result.storage).toBeDefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit progress events during health check', async () => {
      const progressEvents = [];
      serverHealthTool.on('progress', (data) => progressEvents.push(data));

      await serverHealthTool.execute({});

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toEqual(
        expect.objectContaining({
          percentage: expect.any(Number),
          status: expect.any(String)
        })
      );
    });

    it('should emit warning events for issues', async () => {
      const warningEvents = [];
      serverHealthTool.on('warning', (data) => warningEvents.push(data));

      // Simulate an issue
      mockModule.processManager.getProcessInfo.mockReturnValueOnce({
        processId: 'process-123',
        memoryUsage: 2000000000 // High memory usage
      });

      await serverHealthTool.execute({});

      expect(warningEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Result Format', () => {
    it('should return comprehensive health report', async () => {
      const result = await serverHealthTool.execute({});

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          overallStatus: expect.any(String),
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          issues: expect.any(Array)
        })
      );
    });

    it('should format memory sizes in human-readable format', async () => {
      const input = {
        includeSystemResources: true
      };

      const result = await serverHealthTool.execute(input);

      if (result.systemResources) {
        expect(result.systemResources.formattedTotalMemory).toMatch(/^\d+\.\d{2} [KMGT]B$/);
        expect(result.systemResources.formattedFreeMemory).toMatch(/^\d+\.\d{2} [KMGT]B$/);
      }
    });
  });
});