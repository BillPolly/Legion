/**
 * @fileoverview Unit tests for ProcessManager class
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProcessManager } from '../../src/managers/ProcessManager.js';

describe('ProcessManager', () => {
  let processManager;
  let mockLogStorage;

  beforeEach(() => {
    mockLogStorage = {
      logMessage: jest.fn().mockResolvedValue(true),
      createSession: jest.fn().mockResolvedValue('session-123'),
      endSession: jest.fn().mockResolvedValue(true)
    };
    processManager = new ProcessManager(mockLogStorage);
  });

  afterEach(() => {
    // Clean up any running processes
    processManager.killAll();
  });

  describe('Process Creation', () => {
    it('should create ProcessManager with log storage dependency', () => {
      expect(processManager).toBeInstanceOf(ProcessManager);
      expect(processManager.logStorage).toBe(mockLogStorage);
    });

    it('should start process with command and directory', async () => {
      const result = await processManager.start({
        command: 'node',
        args: ['-v'],
        workingDir: process.cwd(),
        sessionId: 'test-session'
      });

      expect(result).toHaveProperty('processId');
      expect(result).toHaveProperty('process');
      expect(result.processId).toBeTruthy();
      expect(typeof result.processId).toBe('string');
    });

    it('should reject invalid command', async () => {
      await expect(processManager.start({
        command: '',
        args: [],
        workingDir: process.cwd(),
        sessionId: 'test-session'
      })).rejects.toThrow('Command is required');
    });

    it('should reject invalid working directory', async () => {
      await expect(processManager.start({
        command: 'node',
        args: ['-v'],
        workingDir: '/nonexistent/directory',
        sessionId: 'test-session'
      })).rejects.toThrow('Working directory does not exist');
    });
  });

  describe('Process Lifecycle', () => {
    let processId;

    beforeEach(async () => {
      const result = await processManager.start({
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000)'], // Keep alive
        workingDir: process.cwd(),
        sessionId: 'test-session'
      });
      processId = result.processId;
    });

    it('should track running processes', () => {
      const runningProcesses = processManager.getRunningProcesses();
      expect(Array.isArray(runningProcesses)).toBe(true);
      expect(runningProcesses).toContain(processId);
    });

    it('should get process info by ID', () => {
      const processInfo = processManager.getProcessInfo(processId);
      expect(processInfo).toBeTruthy();
      expect(processInfo.processId).toBe(processId);
      expect(processInfo.command).toBe('node');
      expect(processInfo.status).toBe('running');
    });

    it('should kill process by ID', async () => {
      const killed = await processManager.kill(processId);
      expect(killed).toBe(true);

      // Process should no longer be running
      const runningProcesses = processManager.getRunningProcesses();
      expect(runningProcesses).not.toContain(processId);
    });

    it('should handle kill of non-existent process', async () => {
      const killed = await processManager.kill('non-existent-id');
      expect(killed).toBe(false);
    });
  });

  describe('Log Integration', () => {
    it('should log stdout messages', async () => {
      const result = await processManager.start({
        command: 'node',
        args: ['-e', 'console.log("test output")'],
        workingDir: process.cwd(),
        sessionId: 'test-session'
      });

      // Wait a moment for process to execute and log
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogStorage.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          processId: result.processId,
          source: 'stdout',
          message: expect.stringContaining('test output')
        })
      );
    });

    it('should log stderr messages', async () => {
      const result = await processManager.start({
        command: 'node',
        args: ['-e', 'console.error("test error")'],
        workingDir: process.cwd(),
        sessionId: 'test-session'
      });

      // Wait a moment for process to execute and log
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockLogStorage.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          processId: result.processId,
          source: 'stderr',
          message: expect.stringContaining('test error')
        })
      );
    });

    it('should log process lifecycle events', async () => {
      const result = await processManager.start({
        command: 'node',
        args: ['-v'],
        workingDir: process.cwd(),
        sessionId: 'test-session'
      });

      // Wait for process to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should log process start
      expect(mockLogStorage.logMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          processId: result.processId,
          source: 'system',
          message: expect.stringContaining('Process started')
        })
      );
    });
  });

  describe('Process Cleanup', () => {
    it('should kill all processes', async () => {
      // Start multiple processes
      const process1 = await processManager.start({
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000)'],
        workingDir: process.cwd(),
        sessionId: 'test-session-1'
      });

      const process2 = await processManager.start({
        command: 'node',
        args: ['-e', 'setInterval(() => {}, 1000)'],
        workingDir: process.cwd(),
        sessionId: 'test-session-2'
      });

      expect(processManager.getRunningProcesses()).toHaveLength(2);

      await processManager.killAll();

      expect(processManager.getRunningProcesses()).toHaveLength(0);
    });

    it('should handle cleanup of already terminated processes', async () => {
      const result = await processManager.start({
        command: 'node',
        args: ['-v'], // Quick exit
        workingDir: process.cwd(),
        sessionId: 'test-session'
      });

      // Wait for process to complete naturally
      await new Promise(resolve => setTimeout(resolve, 200));

      // killAll should handle already terminated processes gracefully
      await processManager.killAll();
      expect(processManager.getRunningProcesses()).toHaveLength(0);
    });
  });
});