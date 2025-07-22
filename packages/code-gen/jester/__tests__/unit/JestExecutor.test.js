/**
 * JestExecutor unit tests
 * 
 * Following TDD approach - tests written before implementation
 */

import { jest } from '@jest/globals';
import { JestExecutor } from '../../src/JestExecutor.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Manual mock for child_process
jest.unstable_mockModule('child_process', () => ({
  spawn: jest.fn()
}));

const { spawn } = await import('child_process');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PROJECT_PATH = path.join(__dirname, 'test-project');

describe('JestExecutor', () => {
  let executor;

  beforeEach(async () => {
    executor = new JestExecutor();
    
    // Create test project directory
    await fs.mkdir(TEST_PROJECT_PATH, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test project
    await fs.rm(TEST_PROJECT_PATH, { recursive: true, force: true });
    
    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Configuration loading', () => {
    test('should load jest.config.js', async () => {
      // Create jest.config.js
      await fs.writeFile(
        path.join(TEST_PROJECT_PATH, 'jest.config.js'),
        `export default {
          testEnvironment: 'node',
          testMatch: ['**/*.test.js'],
          coverageDirectory: 'coverage'
        };`
      );

      const config = await executor.loadConfig(TEST_PROJECT_PATH);
      
      expect(config.testEnvironment).toBe('node');
      expect(config.testMatch).toEqual(['**/*.test.js']);
      expect(config.coverageDirectory).toBe('coverage');
    });

    test('should load jest.config.json', async () => {
      // Create jest.config.json
      await fs.writeFile(
        path.join(TEST_PROJECT_PATH, 'jest.config.json'),
        JSON.stringify({
          testEnvironment: 'jsdom',
          testMatch: ['**/*.spec.js'],
          bail: true
        })
      );

      const config = await executor.loadConfig(TEST_PROJECT_PATH);
      
      expect(config.testEnvironment).toBe('jsdom');
      expect(config.testMatch).toEqual(['**/*.spec.js']);
      expect(config.bail).toBe(true);
    });

    test('should load package.json jest field', async () => {
      // Create package.json with jest config
      await fs.writeFile(
        path.join(TEST_PROJECT_PATH, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          jest: {
            testEnvironment: 'node',
            verbose: true,
            collectCoverage: true
          }
        })
      );

      const config = await executor.loadConfig(TEST_PROJECT_PATH);
      
      expect(config.testEnvironment).toBe('node');
      expect(config.verbose).toBe(true);
      expect(config.collectCoverage).toBe(true);
    });

    test('should apply defaults for missing config', async () => {
      // No config files present
      const config = await executor.loadConfig(TEST_PROJECT_PATH);
      
      expect(config).toEqual({
        testEnvironment: 'node',
        testMatch: [
          '**/__tests__/**/*.[jt]s?(x)',
          '**/?(*.)+(spec|test).[jt]s?(x)'
        ]
      });
    });
  });

  describe('Configuration merging', () => {
    test('should merge user options with config', async () => {
      const baseConfig = {
        testEnvironment: 'node',
        verbose: false,
        coverage: false
      };

      const userOptions = {
        verbose: true,
        coverage: true,
        maxWorkers: 4
      };

      const merged = executor.mergeConfig(baseConfig, userOptions);

      expect(merged.testEnvironment).toBe('node');
      expect(merged.verbose).toBe(true);
      expect(merged.coverage).toBe(true);
      expect(merged.maxWorkers).toBe(4);
    });

    test('should override reporters', async () => {
      const baseConfig = {
        reporters: ['default', 'jest-junit']
      };

      const jesterConfig = {
        reporters: [['./JesterReporter.js', { runId: '123' }]]
      };

      const merged = executor.mergeConfig(baseConfig, jesterConfig);

      expect(merged.reporters).toEqual([['./JesterReporter.js', { runId: '123' }]]);
    });

    test('should preserve user reporters if requested', async () => {
      const baseConfig = {
        reporters: ['default', 'jest-junit']
      };

      const jesterConfig = {
        reporters: [['./JesterReporter.js', { runId: '123' }]],
        preserveUserReporters: true
      };

      const merged = executor.mergeConfig(baseConfig, jesterConfig);

      expect(merged.reporters).toEqual([
        'default',
        'jest-junit',
        ['./JesterReporter.js', { runId: '123' }]
      ]);
    });

    test('should handle invalid configuration', async () => {
      const baseConfig = null;
      const userOptions = { verbose: true };

      const merged = executor.mergeConfig(baseConfig, userOptions);

      expect(merged).toEqual({ verbose: true });
    });
  });

  describe('Process spawning', () => {
    test('should spawn jest process', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { testMatch: ['*.test.js'] };
      const promise = executor.execute(config);

      // Simulate process completion
      const onCall = mockProcess.on.mock.calls.find(call => call[0] === 'close');
      onCall[1](0);

      const result = await promise;

      expect(spawn).toHaveBeenCalledWith(
        expect.stringContaining('jest'),
        expect.any(Array),
        expect.objectContaining({
          cwd: expect.any(String)
        })
      );
      expect(result.exitCode).toBe(0);
    });

    test('should pass configuration', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = {
        testMatch: ['*.test.js'],
        coverage: true,
        maxWorkers: 4
      };

      executor.execute(config);

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          '--coverage',
          '--maxWorkers=4'
        ]),
        expect.any(Object)
      );
    });

    test('should set environment variables', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { 
        testMatch: ['*.test.js'],
        env: { NODE_ENV: 'test', CUSTOM_VAR: 'value' }
      };

      executor.execute(config);

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          env: expect.objectContaining({
            NODE_ENV: 'test',
            CUSTOM_VAR: 'value'
          })
        })
      );
    });

    test('should capture stdout/stderr', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { testMatch: ['*.test.js'] };
      const promise = executor.execute(config);

      // Simulate stdout data
      const stdoutOnCall = mockProcess.stdout.on.mock.calls.find(call => call[0] === 'data');
      stdoutOnCall[1](Buffer.from('Test output'));

      // Simulate stderr data
      const stderrOnCall = mockProcess.stderr.on.mock.calls.find(call => call[0] === 'data');
      stderrOnCall[1](Buffer.from('Error output'));

      // Complete process
      const onCall = mockProcess.on.mock.calls.find(call => call[0] === 'close');
      onCall[1](0);

      const result = await promise;

      expect(result.stdout).toBe('Test output');
      expect(result.stderr).toBe('Error output');
    });

    test('should handle process errors', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { testMatch: ['*.test.js'] };
      const promise = executor.execute(config);

      // Simulate process error
      const errorCall = mockProcess.on.mock.calls.find(call => call[0] === 'error');
      errorCall[1](new Error('Process failed'));

      await expect(promise).rejects.toThrow('Process failed');
    });
  });

  describe('IPC communication', () => {
    test('should establish IPC channel', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        send: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { 
        testMatch: ['*.test.js'],
        enableIPC: true
      };

      executor.execute(config);

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        })
      );
    });

    test('should receive reporter messages', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        send: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const onMessage = jest.fn();
      const config = { 
        testMatch: ['*.test.js'],
        enableIPC: true,
        onMessage
      };

      const promise = executor.execute(config);

      // Simulate IPC message
      const messageCall = mockProcess.on.mock.calls.find(call => call[0] === 'message');
      messageCall[1]({ type: 'test-result', data: { passed: true } });

      // Complete process
      const closeCall = mockProcess.on.mock.calls.find(call => call[0] === 'close');
      closeCall[1](0);

      await promise;

      expect(onMessage).toHaveBeenCalledWith({ 
        type: 'test-result', 
        data: { passed: true } 
      });
    });

    test('should handle message parsing errors', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        send: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const onMessage = jest.fn();
      const config = { 
        testMatch: ['*.test.js'],
        enableIPC: true,
        onMessage
      };

      const promise = executor.execute(config);

      // Simulate invalid IPC message
      const messageCall = mockProcess.on.mock.calls.find(call => call[0] === 'message');
      messageCall[1]('invalid message');

      // Complete process
      const closeCall = mockProcess.on.mock.calls.find(call => call[0] === 'close');
      closeCall[1](0);

      await promise;

      expect(onMessage).toHaveBeenCalledWith('invalid message');
    });

    test('should timeout on no response', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { 
        testMatch: ['*.test.js'],
        timeout: 100 // 100ms timeout
      };

      const promise = executor.execute(config);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('Process cleanup', () => {
    test('should kill process on timeout', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);
      executor.jestProcess = mockProcess;

      const config = { 
        testMatch: ['*.test.js'],
        timeout: 50
      };

      const promise = executor.execute(config);

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should clean up on SIGINT', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);

      const config = { testMatch: ['*.test.js'] };
      executor.execute(config);

      // Store the current process
      executor.jestProcess = mockProcess;

      // Trigger cleanup
      await executor.cleanup();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should wait for graceful shutdown', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);
      executor.jestProcess = mockProcess;

      const cleanupPromise = executor.cleanup();

      // Simulate process still running
      await new Promise(resolve => setTimeout(resolve, 50));
      mockProcess.killed = true;

      await cleanupPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should force kill if needed', async () => {
      const mockProcess = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn(),
        kill: jest.fn(),
        killed: false,
        pid: 12345
      };
      
      spawn.mockReturnValue(mockProcess);
      executor.jestProcess = mockProcess;
      executor.gracefulShutdownTimeout = 50;

      const cleanupPromise = executor.cleanup();

      // Wait past graceful timeout
      await new Promise(resolve => setTimeout(resolve, 100));

      await cleanupPromise;

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
    });
  });

  describe('Jest binary finding', () => {
    test('should find Jest binary in project', async () => {
      // Create node_modules/.bin/jest
      const binDir = path.join(TEST_PROJECT_PATH, 'node_modules', '.bin');
      await fs.mkdir(binDir, { recursive: true });
      await fs.writeFile(path.join(binDir, 'jest'), '#!/usr/bin/env node\n', { mode: 0o755 });

      const jestPath = await executor.findJestBinary(TEST_PROJECT_PATH);
      
      expect(jestPath).toBe(path.join(binDir, 'jest'));
    });

    test('should throw if Jest not found', async () => {
      await expect(executor.findJestBinary(TEST_PROJECT_PATH))
        .rejects.toThrow('Jest not found');
    });
  });
});