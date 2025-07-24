/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { ServerLauncher } from '../../../src/client/ServerLauncher.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Mock child_process
jest.mock('child_process');

// Mock fs/promises
jest.mock('fs/promises');

describe('ServerLauncher', () => {
  let serverLauncher;
  let mockProcess;

  beforeEach(() => {
    jest.clearAllMocks();
    
    serverLauncher = new ServerLauncher({
      host: 'localhost',
      port: 8080,
      nodeExecutable: 'node',
      serverScript: './src/server/index.js',
      independent: true
    });

    // Mock process
    mockProcess = {
      pid: 12345,
      unref: jest.fn(),
      on: jest.fn(),
      kill: jest.fn(),
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      }
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      const launcher = new ServerLauncher();
      
      expect(launcher.config.host).toBe('localhost');
      expect(launcher.config.port).toBe(8080);
      expect(launcher.config.nodeExecutable).toBe('node');
      expect(launcher.config.independent).toBe(true);
    });

    test('should initialize with custom configuration', () => {
      const customConfig = {
        host: '127.0.0.1',
        port: 9000,
        nodeExecutable: '/usr/local/bin/node',
        independent: false
      };
      
      const launcher = new ServerLauncher(customConfig);
      
      expect(launcher.config).toEqual(expect.objectContaining(customConfig));
    });
  });

  describe('_generatePidFilePath', () => {
    test('should generate correct PID file path', () => {
      const expectedPath = path.join(os.tmpdir(), 'aiur-server-8080.pid');
      
      const result = serverLauncher._generatePidFilePath();
      
      expect(result).toBe(expectedPath);
    });

    test('should use custom port in PID file path', () => {
      serverLauncher.config.port = 9000;
      const expectedPath = path.join(os.tmpdir(), 'aiur-server-9000.pid');
      
      const result = serverLauncher._generatePidFilePath();
      
      expect(result).toBe(expectedPath);
    });
  });

  describe('_storePid', () => {
    test('should store PID to file', async () => {
      fs.writeFile.mockResolvedValue();
      
      await serverLauncher._storePid(12345);
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        serverLauncher._generatePidFilePath(),
        '12345',
        'utf8'
      );
    });

    test('should handle write errors', async () => {
      const writeError = new Error('Permission denied');
      fs.writeFile.mockRejectedValue(writeError);
      
      await expect(serverLauncher._storePid(12345)).rejects.toThrow('Permission denied');
    });
  });

  describe('_readPid', () => {
    test('should read PID from file', async () => {
      fs.readFile.mockResolvedValue('12345');
      
      const result = await serverLauncher._readPid();
      
      expect(result).toBe(12345);
      expect(fs.readFile).toHaveBeenCalledWith(
        serverLauncher._generatePidFilePath(),
        'utf8'
      );
    });

    test('should return null if PID file does not exist', async () => {
      const readError = new Error('ENOENT');
      readError.code = 'ENOENT';
      fs.readFile.mockRejectedValue(readError);
      
      const result = await serverLauncher._readPid();
      
      expect(result).toBeNull();
    });

    test('should throw error for other read failures', async () => {
      const readError = new Error('Permission denied');
      readError.code = 'EACCES';
      fs.readFile.mockRejectedValue(readError);
      
      await expect(serverLauncher._readPid()).rejects.toThrow('Permission denied');
    });

    test('should handle invalid PID content', async () => {
      fs.readFile.mockResolvedValue('invalid-pid');
      
      const result = await serverLauncher._readPid();
      
      expect(result).toBeNull();
    });
  });

  describe('_removePidFile', () => {
    test('should remove PID file', async () => {
      fs.unlink.mockResolvedValue();
      
      await serverLauncher._removePidFile();
      
      expect(fs.unlink).toHaveBeenCalledWith(serverLauncher._generatePidFilePath());
    });

    test('should handle file not found error', async () => {
      const unlinkError = new Error('ENOENT');
      unlinkError.code = 'ENOENT';
      fs.unlink.mockRejectedValue(unlinkError);
      
      // Should not throw error
      await expect(serverLauncher._removePidFile()).resolves.toBeUndefined();
    });
  });

  describe('launchIndependent', () => {
    test('should launch server as independent process', async () => {
      spawn.mockReturnValue(mockProcess);
      fs.writeFile.mockResolvedValue();
      
      const result = await serverLauncher.launchIndependent();
      
      expect(spawn).toHaveBeenCalledWith(
        serverLauncher.config.nodeExecutable,
        [serverLauncher.config.serverScript],
        {
          detached: true,
          stdio: 'ignore',
          env: expect.objectContaining({
            AIUR_SERVER_HOST: 'localhost',
            AIUR_SERVER_PORT: '8080'
          })
        }
      );
      
      expect(mockProcess.unref).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
      
      expect(result).toEqual({
        pid: 12345,
        independent: true,
        pidFile: serverLauncher._generatePidFilePath(),
        startedAt: expect.any(String)
      });
    });

    test('should handle spawn errors', async () => {
      const spawnError = new Error('ENOENT');
      mockProcess.on = jest.fn((event, callback) => {
        if (event === 'error') {
          callback(spawnError);
        }
      });
      
      spawn.mockReturnValue(mockProcess);
      
      await expect(serverLauncher.launchIndependent()).rejects.toThrow('ENOENT');
    });

    test('should handle spawn exit with error code', async () => {
      mockProcess.on = jest.fn((event, callback) => {
        if (event === 'exit') {
          callback(1); // Exit with code 1
        }
      });
      
      spawn.mockReturnValue(mockProcess);
      
      await expect(serverLauncher.launchIndependent()).rejects.toThrow('Server process exited with code 1');
    });
  });

  describe('launchChild', () => {
    test('should launch server as child process', async () => {
      spawn.mockReturnValue(mockProcess);
      
      const result = await serverLauncher.launchChild();
      
      expect(spawn).toHaveBeenCalledWith(
        serverLauncher.config.nodeExecutable,
        [serverLauncher.config.serverScript],
        {
          detached: false,
          stdio: 'pipe',
          env: expect.objectContaining({
            AIUR_SERVER_HOST: 'localhost',
            AIUR_SERVER_PORT: '8080'
          })
        }
      );
      
      expect(mockProcess.unref).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        pid: 12345,
        independent: false,
        process: mockProcess,
        startedAt: expect.any(String)
      });
    });
  });

  describe('stopServer', () => {
    test('should stop server by PID', async () => {
      fs.readFile.mockResolvedValue('12345');
      fs.unlink.mockResolvedValue();
      
      // Mock process.kill to not throw
      const originalKill = process.kill;
      process.kill = jest.fn();
      
      const result = await serverLauncher.stopServer();
      
      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(fs.unlink).toHaveBeenCalled();
      expect(result).toBe(true);
      
      // Restore original process.kill
      process.kill = originalKill;
    });

    test('should return false if no PID found', async () => {
      fs.readFile.mockResolvedValue('');
      
      const result = await serverLauncher.stopServer();
      
      expect(result).toBe(false);
    });

    test('should handle process kill errors', async () => {
      fs.readFile.mockResolvedValue('12345');
      
      // Mock process.kill to throw
      const originalKill = process.kill;
      process.kill = jest.fn(() => {
        const error = new Error('ESRCH');
        error.code = 'ESRCH';
        throw error;
      });
      
      const result = await serverLauncher.stopServer();
      
      expect(result).toBe(false);
      
      // Restore original process.kill
      process.kill = originalKill;
    });

    test('should force kill if SIGTERM fails', async () => {
      fs.readFile.mockResolvedValue('12345');
      fs.unlink.mockResolvedValue();
      
      const originalKill = process.kill;
      let killCallCount = 0;
      
      process.kill = jest.fn((pid, signal) => {
        killCallCount++;
        if (killCallCount === 1 && signal === 'SIGTERM') {
          // First call with SIGTERM - simulate process still running
          return;
        }
        if (killCallCount === 2 && signal === 'SIGKILL') {
          // Second call with SIGKILL - simulate successful kill
          return;
        }
      });
      
      // Mock setTimeout to execute immediately
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = (callback, delay) => {
        callback();
        return 1;
      };
      
      const result = await serverLauncher.stopServer(5000, true);
      
      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect(process.kill).toHaveBeenCalledWith(12345, 'SIGKILL');
      expect(result).toBe(true);
      
      // Restore mocks
      process.kill = originalKill;
      global.setTimeout = originalSetTimeout;
    });
  });

  describe('isProcessRunning', () => {
    test('should return true if process is running', () => {
      const originalKill = process.kill;
      process.kill = jest.fn(() => true);
      
      const result = serverLauncher.isProcessRunning(12345);
      
      expect(result).toBe(true);
      expect(process.kill).toHaveBeenCalledWith(12345, 0);
      
      process.kill = originalKill;
    });

    test('should return false if process is not running', () => {
      const originalKill = process.kill;
      process.kill = jest.fn(() => {
        const error = new Error('ESRCH');
        error.code = 'ESRCH';
        throw error;
      });
      
      const result = serverLauncher.isProcessRunning(12345);
      
      expect(result).toBe(false);
      
      process.kill = originalKill;
    });
  });

  describe('getManagedServerPid', () => {
    test('should return PID of managed server', async () => {
      fs.readFile.mockResolvedValue('12345');
      
      const result = await serverLauncher.getManagedServerPid();
      
      expect(result).toBe(12345);
    });

    test('should return null if no managed server', async () => {
      fs.readFile.mockResolvedValue('');
      
      const result = await serverLauncher.getManagedServerPid();
      
      expect(result).toBeNull();
    });
  });
});