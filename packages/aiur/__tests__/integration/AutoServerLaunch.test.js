/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { ServerManager } from '../../src/client/ServerManager.js';
import { ServerDetector } from '../../src/client/ServerDetector.js';
import { ServerLauncher } from '../../src/client/ServerLauncher.js';
import WebSocket from 'ws';
import http from 'http';

// Increase timeout for integration tests
jest.setTimeout(30000);

describe('Auto-Server Launch Integration Tests', () => {
  let serverManager;
  let testPort;

  beforeAll(() => {
    // Use a random port for testing to avoid conflicts
    testPort = 8000 + Math.floor(Math.random() * 1000);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    serverManager = new ServerManager({
      host: 'localhost',
      port: testPort,
      autoLaunch: true,
      independent: true,
      verbose: true,
      maxStartupTime: 10000,
      serverScript: './src/server/test-server.js' // Use test server
    });
  });

  afterEach(async () => {
    // Clean up any running servers
    try {
      await serverManager.stopServer();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Server Detection', () => {
    test('should detect when no server is running', async () => {
      const serverInfo = await serverManager.detector.isServerRunning();
      
      expect(serverInfo).toBeNull();
    });

    test('should detect port availability', async () => {
      const portInUse = await serverManager.detector.isPortInUse(testPort);
      
      expect(portInUse).toBe(false);
    });

    test('should validate connection when no server running', async () => {
      const validation = await serverManager.detector.validateConnection();
      
      expect(validation.valid).toBe(false);
      expect(validation.serverInfo).toBeNull();
      expect(validation.error).toBeDefined();
    });
  });

  describe('Server Lifecycle Management', () => {
    test('should get comprehensive status when no server running', async () => {
      const status = await serverManager.getServerStatus();
      
      expect(status.summary.running).toBe(false);
      expect(status.summary.healthy).toBe(false);
      expect(status.summary.managed).toBe(false);
      expect(status.connection.portInUse).toBe(false);
    });

    test('should validate environment correctly', async () => {
      const validation = await serverManager.validateEnvironment();
      
      expect(validation).toEqual({
        valid: expect.any(Boolean),
        issues: expect.any(Array),
        warnings: expect.any(Array),
        details: expect.any(Object)
      });
      
      // Should detect that server is not running
      expect(validation.details.serverRunning).toBe(false);
      expect(validation.details.portInUse).toBe(false);
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration and recreate components', () => {
      const originalDetector = serverManager.detector;
      const originalLauncher = serverManager.launcher;
      
      serverManager.updateConfig({
        port: testPort + 1,
        verbose: false
      });
      
      expect(serverManager.config.port).toBe(testPort + 1);
      expect(serverManager.config.verbose).toBe(false);
      
      // Components should be recreated
      expect(serverManager.detector).not.toBe(originalDetector);
      expect(serverManager.launcher).not.toBe(originalLauncher);
    });

    test('should handle environment variable overrides', () => {
      const originalHost = process.env.AIUR_SERVER_HOST;
      const originalPort = process.env.AIUR_SERVER_PORT;
      
      process.env.AIUR_SERVER_HOST = '127.0.0.1';
      process.env.AIUR_SERVER_PORT = '9999';
      
      const manager = new ServerManager();
      
      expect(manager.config.host).toBe('127.0.0.1');
      expect(manager.config.port).toBe(9999);
      
      // Restore environment
      if (originalHost !== undefined) {
        process.env.AIUR_SERVER_HOST = originalHost;
      } else {
        delete process.env.AIUR_SERVER_HOST;
      }
      
      if (originalPort !== undefined) {
        process.env.AIUR_SERVER_PORT = originalPort;
      } else {
        delete process.env.AIUR_SERVER_PORT;
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle server launch timeout gracefully', async () => {
      // Configure with very short timeout
      serverManager.config.maxStartupTime = 100;
      serverManager.config.autoLaunch = true;
      
      // Mock launcher to simulate slow launch
      const originalLaunchIndependent = serverManager.launcher.launchIndependent;
      serverManager.launcher.launchIndependent = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200)); // Delay longer than timeout
        return {
          pid: 12345,
          independent: true,
          pidFile: '/tmp/test-pid',
          startedAt: new Date().toISOString()
        };
      });
      
      await expect(serverManager.ensureServerRunning()).rejects.toThrow();
      
      // Restore original method
      serverManager.launcher.launchIndependent = originalLaunchIndependent;
    }, 15000);

    test('should handle launcher errors gracefully', async () => {
      // Mock launcher to throw error
      serverManager.launcher.launchIndependent = jest.fn().mockRejectedValue(
        new Error('Failed to spawn server process')
      );
      
      await expect(serverManager.ensureServerRunning()).rejects.toThrow(
        'Failed to spawn server process'
      );
    });

    test('should handle detector errors gracefully', async () => {
      // Mock detector to throw error
      serverManager.detector.isServerRunning = jest.fn().mockRejectedValue(
        new Error('Network error during detection')
      );
      
      await expect(serverManager.ensureServerRunning()).rejects.toThrow(
        'Network error during detection'
      );
    });
  });

  describe('Auto-Launch Scenarios', () => {
    test('should handle autoLaunch disabled scenario', async () => {
      serverManager.config.autoLaunch = false;
      
      await expect(serverManager.ensureServerRunning()).rejects.toThrow(
        'Server is not running and autoLaunch is disabled'
      );
    });

    test('should handle independent vs child process modes', () => {
      // Test independent mode
      serverManager.config.independent = true;
      expect(serverManager.launcher.config.independent).toBe(true);
      
      // Test child mode
      serverManager.updateConfig({ independent: false });
      expect(serverManager.launcher.config.independent).toBe(false);
    });
  });

  describe('Logging and Verbosity', () => {
    test('should respect verbose configuration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Test verbose mode
      serverManager.config.verbose = true;
      serverManager._log('Test verbose message');
      expect(consoleSpy).toHaveBeenCalledWith('Test verbose message');
      
      consoleSpy.mockClear();
      
      // Test quiet mode
      serverManager.config.verbose = false;
      serverManager._log('Test quiet message');
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('Concurrent Connection Handling', () => {
    test('should handle multiple ServerManager instances', () => {
      const manager1 = new ServerManager({ port: testPort });
      const manager2 = new ServerManager({ port: testPort + 1 });
      const manager3 = new ServerManager({ port: testPort + 2 });
      
      expect(manager1.config.port).toBe(testPort);
      expect(manager2.config.port).toBe(testPort + 1);
      expect(manager3.config.port).toBe(testPort + 2);
      
      // Each should have independent detector/launcher instances
      expect(manager1.detector).not.toBe(manager2.detector);
      expect(manager1.launcher).not.toBe(manager2.launcher);
      expect(manager2.detector).not.toBe(manager3.detector);
      expect(manager2.launcher).not.toBe(manager3.launcher);
    });
  });

  describe('Real Network Operations', () => {
    test('should handle actual port checking', async () => {
      // Start a simple HTTP server on the test port
      const testServer = http.createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Test server');
      });
      
      await new Promise((resolve, reject) => {
        testServer.listen(testPort, 'localhost', (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      try {
        // Port should now be in use
        const portInUse = await serverManager.detector.isPortInUse(testPort);
        expect(portInUse).toBe(true);
        
        // Health check should fail (not our server format)
        const serverInfo = await serverManager.detector.isServerRunning();
        expect(serverInfo).toBeNull();
        
      } finally {
        // Clean up test server
        await new Promise((resolve) => {
          testServer.close(resolve);
        });
      }
    });

    test('should detect actual server health endpoint', async () => {
      // Mock a simple health endpoint
      const healthServer = http.createServer((req, res) => {
        if (req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            server: 'PureLegionServer',
            version: '1.0.0',
            status: 'healthy',
            host: 'localhost',
            port: testPort
          }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      
      await new Promise((resolve, reject) => {
        healthServer.listen(testPort, 'localhost', (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      try {
        // Should detect our mock server
        const serverInfo = await serverManager.detector.isServerRunning();
        expect(serverInfo).toEqual({
          server: 'PureLegionServer',
          version: '1.0.0',
          status: 'healthy',
          host: 'localhost',
          port: testPort
        });
        
        // Connection validation should succeed
        const validation = await serverManager.detector.validateConnection();
        expect(validation.valid).toBe(true);
        expect(validation.serverInfo).toEqual(serverInfo);
        
      } finally {
        await new Promise((resolve) => {
          healthServer.close(resolve);
        });
      }
    });
  });
});