/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { ServerManager } from '../../../src/client/ServerManager.js';
import { ServerDetector } from '../../../src/client/ServerDetector.js';
import { ServerLauncher } from '../../../src/client/ServerLauncher.js';

// Mock the dependencies
jest.mock('../../../src/client/ServerDetector.js');
jest.mock('../../../src/client/ServerLauncher.js');

describe('ServerManager', () => {
  let serverManager;
  let mockDetector;
  let mockLauncher;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock instances
    mockDetector = {
      isServerRunning: jest.fn(),
      waitForServer: jest.fn(),
      isPortInUse: jest.fn(),
      validateConnection: jest.fn()
    };
    
    mockLauncher = {
      launchIndependent: jest.fn(),
      launchChild: jest.fn(),
      stopServer: jest.fn(),
      isProcessRunning: jest.fn(),
      getManagedServerPid: jest.fn()
    };
    
    // Mock constructors
    ServerDetector.mockImplementation(() => mockDetector);
    ServerLauncher.mockImplementation(() => mockLauncher);
    
    serverManager = new ServerManager({
      host: 'localhost',
      port: 8080,
      autoLaunch: true,
      independent: true,
      verbose: false
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      const manager = new ServerManager();
      
      expect(manager.config.host).toBe('localhost');
      expect(manager.config.port).toBe(8080);
      expect(manager.config.autoLaunch).toBe(true);
      expect(manager.config.independent).toBe(true);
      expect(manager.config.verbose).toBe(false);
    });

    test('should create detector and launcher instances', () => {
      expect(ServerDetector).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 8080
      }));
      
      expect(ServerLauncher).toHaveBeenCalledWith(expect.objectContaining({
        host: 'localhost',
        port: 8080,
        independent: true
      }));
    });
  });

  describe('updateConfig', () => {
    test('should update configuration and recreate instances', () => {
      const newConfig = {
        host: '127.0.0.1',
        port: 9000,
        verbose: true
      };
      
      serverManager.updateConfig(newConfig);
      
      expect(serverManager.config).toEqual(expect.objectContaining(newConfig));
      expect(ServerDetector).toHaveBeenCalledTimes(2); // Initial + update
      expect(ServerLauncher).toHaveBeenCalledTimes(2); // Initial + update
    });
  });

  describe('ensureServerRunning', () => {
    test('should return existing server when already running', async () => {
      const existingServerInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        host: 'localhost',
        port: 8080
      };
      
      mockDetector.isServerRunning.mockResolvedValue(existingServerInfo);
      
      const result = await serverManager.ensureServerRunning();
      
      expect(result).toEqual({
        status: 'existing',
        serverInfo: existingServerInfo
      });
      
      expect(mockDetector.isServerRunning).toHaveBeenCalled();
      expect(mockLauncher.launchIndependent).not.toHaveBeenCalled();
    });

    test('should launch server when not running and autoLaunch is true', async () => {
      const launchInfo = {
        pid: 12345,
        independent: true,
        pidFile: '/tmp/aiur-server-8080.pid',
        startedAt: '2025-01-01T00:00:00.000Z'
      };
      
      const serverInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        host: 'localhost',
        port: 8080
      };
      
      mockDetector.isServerRunning.mockResolvedValue(null);
      mockLauncher.launchIndependent.mockResolvedValue(launchInfo);
      mockDetector.waitForServer.mockResolvedValue(serverInfo);
      
      const result = await serverManager.ensureServerRunning();
      
      expect(result).toEqual({
        status: 'launched',
        launchInfo,
        serverInfo
      });
      
      expect(mockDetector.isServerRunning).toHaveBeenCalled();
      expect(mockLauncher.launchIndependent).toHaveBeenCalled();
      expect(mockDetector.waitForServer).toHaveBeenCalledWith(serverManager.config.maxStartupTime);
    });

    test('should throw error when server not running and autoLaunch is false', async () => {
      serverManager.config.autoLaunch = false;
      mockDetector.isServerRunning.mockResolvedValue(null);
      
      await expect(serverManager.ensureServerRunning()).rejects.toThrow(
        'Server is not running and autoLaunch is disabled'
      );
      
      expect(mockLauncher.launchIndependent).not.toHaveBeenCalled();
    });

    test('should launch child process when independent is false', async () => {
      serverManager.config.independent = false;
      
      const launchInfo = {
        pid: 12345,
        independent: false,
        process: {},
        startedAt: '2025-01-01T00:00:00.000Z'
      };
      
      const serverInfo = {
        server: 'PureLegionServer',
        version: '1.0.0'
      };
      
      mockDetector.isServerRunning.mockResolvedValue(null);
      mockLauncher.launchChild.mockResolvedValue(launchInfo);
      mockDetector.waitForServer.mockResolvedValue(serverInfo);
      
      const result = await serverManager.ensureServerRunning();
      
      expect(result).toEqual({
        status: 'launched',
        launchInfo,
        serverInfo
      });
      
      expect(mockLauncher.launchChild).toHaveBeenCalled();
      expect(mockLauncher.launchIndependent).not.toHaveBeenCalled();
    });
  });

  describe('getServerStatus', () => {
    test('should return comprehensive server status', async () => {
      const serverInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        status: 'healthy',
        host: 'localhost',
        port: 8080
      };
      
      mockDetector.isServerRunning.mockResolvedValue(serverInfo);
      mockDetector.isPortInUse.mockResolvedValue(true);
      mockLauncher.getManagedServerPid.mockResolvedValue(12345);
      mockLauncher.isProcessRunning.mockReturnValue(true);
      
      const result = await serverManager.getServerStatus();
      
      expect(result).toEqual({
        summary: {
          running: true,
          healthy: true,
          managed: true,
          pid: 12345
        },
        detection: {
          serverInfo,
          timestamp: expect.any(Date)
        },
        launcher: {
          pid: 12345,
          processRunning: true
        },
        connection: {
          host: 'localhost',
          port: 8080,
          portInUse: true,
          wsEndpoint: 'ws://localhost:8080/ws',
          healthEndpoint: 'http://localhost:8080/health'
        }
      });
    });

    test('should handle server not running', async () => {
      mockDetector.isServerRunning.mockResolvedValue(null);
      mockDetector.isPortInUse.mockResolvedValue(false);
      mockLauncher.getManagedServerPid.mockResolvedValue(null);
      
      const result = await serverManager.getServerStatus();
      
      expect(result.summary.running).toBe(false);
      expect(result.summary.healthy).toBe(false);
      expect(result.summary.managed).toBe(false);
      expect(result.connection.portInUse).toBe(false);
    });
  });

  describe('stopServer', () => {
    test('should stop server successfully', async () => {
      mockLauncher.stopServer.mockResolvedValue(true);
      
      const result = await serverManager.stopServer();
      
      expect(result).toBe(true);
      expect(mockLauncher.stopServer).toHaveBeenCalled();
    });

    test('should return false if stop fails', async () => {
      mockLauncher.stopServer.mockResolvedValue(false);
      
      const result = await serverManager.stopServer();
      
      expect(result).toBe(false);
    });
  });

  describe('restartServer', () => {
    test('should restart server successfully', async () => {
      const launchInfo = {
        pid: 54321,
        independent: true,
        pidFile: '/tmp/aiur-server-8080.pid',
        startedAt: '2025-01-01T00:00:00.000Z'
      };
      
      const serverInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        host: 'localhost',
        port: 8080
      };
      
      mockLauncher.stopServer.mockResolvedValue(true);
      mockLauncher.launchIndependent.mockResolvedValue(launchInfo);
      mockDetector.waitForServer.mockResolvedValue(serverInfo);
      
      const result = await serverManager.restartServer();
      
      expect(result).toEqual({
        stopped: true,
        launchInfo,
        serverInfo
      });
      
      expect(mockLauncher.stopServer).toHaveBeenCalled();
      expect(mockLauncher.launchIndependent).toHaveBeenCalled();
      expect(mockDetector.waitForServer).toHaveBeenCalled();
    });

    test('should handle stop failure during restart', async () => {
      mockLauncher.stopServer.mockResolvedValue(false);
      
      await expect(serverManager.restartServer()).rejects.toThrow(
        'Failed to stop existing server during restart'
      );
    });
  });

  describe('waitForServerReady', () => {
    test('should wait for server to be ready', async () => {
      const serverInfo = {
        server: 'PureLegionServer',
        version: '1.0.0',
        status: 'healthy'
      };
      
      mockDetector.waitForServer.mockResolvedValue(serverInfo);
      
      const result = await serverManager.waitForServerReady();
      
      expect(result).toEqual(serverInfo);
      expect(mockDetector.waitForServer).toHaveBeenCalledWith(serverManager.config.maxStartupTime);
    });

    test('should use custom timeout', async () => {
      const serverInfo = { server: 'PureLegionServer' };
      mockDetector.waitForServer.mockResolvedValue(serverInfo);
      
      const result = await serverManager.waitForServerReady(10000);
      
      expect(result).toEqual(serverInfo);
      expect(mockDetector.waitForServer).toHaveBeenCalledWith(10000);
    });
  });

  describe('validateEnvironment', () => {
    test('should return valid environment', async () => {
      mockDetector.validateConnection.mockResolvedValue({
        valid: true,
        serverInfo: { server: 'PureLegionServer' }
      });
      
      const result = await serverManager.validateEnvironment();
      
      expect(result).toEqual({
        valid: true,
        issues: [],
        warnings: [],
        details: expect.any(Object)
      });
    });

    test('should detect port conflicts', async () => {
      mockDetector.isPortInUse.mockResolvedValue(true);
      mockDetector.isServerRunning.mockResolvedValue(null);
      
      const result = await serverManager.validateEnvironment();
      
      expect(result.valid).toBe(false);
      expect(result.issues).toContain(
        expect.stringContaining('Port 8080 is in use')
      );
    });

    test('should detect missing node executable', async () => {
      // Mock fs.access to simulate missing file
      const fs = await import('fs/promises');
      jest.spyOn(fs, 'access').mockRejectedValue(new Error('ENOENT'));
      
      const result = await serverManager.validateEnvironment();
      
      expect(result.warnings).toContain(
        expect.stringContaining('Node executable may not be accessible')
      );
    });
  });

  describe('_log', () => {
    test('should log when verbose is true', () => {
      serverManager.config.verbose = true;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      serverManager._log('Test message');
      
      expect(consoleSpy).toHaveBeenCalledWith('Test message');
      
      consoleSpy.mockRestore();
    });

    test('should not log when verbose is false', () => {
      serverManager.config.verbose = false;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      serverManager._log('Test message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});