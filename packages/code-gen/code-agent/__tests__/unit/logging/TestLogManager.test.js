/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { TestLogManager } from '../../../src/logging/TestLogManager.js';

describe('TestLogManager', () => {
  let logManager;
  let mockConfig;

  beforeAll(() => {
    mockConfig = {
      logLevel: 'debug',
      bufferSize: 1000,
      enableStreaming: true,
      enableAnalysis: true,
      outputFormat: 'structured',
      captureStdout: true,
      captureStderr: true,
      correlationEnabled: true
    };
  });

  beforeEach(() => {
    logManager = new TestLogManager(mockConfig);
  });

  afterEach(async () => {
    if (logManager) {
      await logManager.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultManager = new TestLogManager();
      
      expect(defaultManager.config).toBeDefined();
      expect(defaultManager.config.logLevel).toBe('info');
      expect(defaultManager.config.bufferSize).toBe(1000);
      expect(defaultManager.isInitialized).toBe(false);
    });

    test('should initialize with custom configuration', () => {
      expect(logManager.config.logLevel).toBe('debug');
      expect(logManager.config.bufferSize).toBe(1000);
      expect(logManager.config.enableStreaming).toBe(true);
    });

    test('should validate configuration on initialization', () => {
      const invalidConfigs = [
        { logLevel: 'invalid' },
        { bufferSize: -1 },
        { outputFormat: 'invalid' }
      ];
      
      invalidConfigs.forEach(config => {
        expect(() => new TestLogManager(config)).toThrow();
      });
    });

    test('should initialize log manager successfully', async () => {
      await logManager.initialize();
      
      expect(logManager.isInitialized).toBe(true);
      expect(logManager.logBuffer).toBeDefined();
      expect(logManager.logStreams).toBeDefined();
    });
  });

  describe('Log Capture', () => {
    beforeEach(async () => {
      await logManager.initialize();
    });

    test('should capture logs from process', async () => {
      const mockProcess = {
        pid: 1234,
        stdout: {
          on: jest.fn(),
          pipe: jest.fn()
        },
        stderr: {
          on: jest.fn(),
          pipe: jest.fn()
        }
      };

      const result = await logManager.attachToProcess(mockProcess);
      
      expect(result).toBeDefined();
      expect(result.processId).toBe(1234);
      expect(result.attached).toBe(true);
      expect(mockProcess.stdout.on).toHaveBeenCalledWith('data', expect.any(Function));
      expect(mockProcess.stderr.on).toHaveBeenCalledWith('data', expect.any(Function));
    });

    test('should capture logs from string source', async () => {
      const logSource = 'test-source';
      const logData = 'This is a test log message';
      
      const result = await logManager.captureLogs(logSource, logData);
      
      expect(result).toBeDefined();
      expect(result.source).toBe(logSource);
      expect(result.captured).toBe(true);
      expect(logManager.logBuffer.length).toBeGreaterThan(0);
    });

    test('should handle log capture errors', async () => {
      const mockProcess = {
        pid: 1234,
        stdout: {
          on: jest.fn((event, callback) => {
            if (event === 'data') {
              // Simulate error during capture
              setTimeout(() => callback('test data'), 10);
            }
          }),
          pipe: jest.fn()
        },
        stderr: {
          on: jest.fn(),
          pipe: jest.fn()
        }
      };

      // Mock the capture method to throw error
      const originalProcessLogData = logManager.processLogData;
      logManager.processLogData = jest.fn().mockImplementation(() => {
        throw new Error('Log processing error');
      });

      const result = await logManager.attachToProcess(mockProcess);
      
      expect(result).toBeDefined();
      expect(result.processId).toBe(1234);
      expect(result.attached).toBe(true);
      
      // Restore the original method
      logManager.processLogData = originalProcessLogData;
    });

    test('should filter logs by level', async () => {
      await logManager.captureLogs('test-source', 'DEBUG: Debug message');
      await logManager.captureLogs('test-source', 'INFO: Info message');
      await logManager.captureLogs('test-source', 'ERROR: Error message');
      
      const debugLogs = logManager.getLogsByLevel('debug');
      const infoLogs = logManager.getLogsByLevel('info');
      const errorLogs = logManager.getLogsByLevel('error');
      
      expect(debugLogs.length).toBeGreaterThan(0);
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    test('should categorize logs by source', async () => {
      await logManager.captureLogs('source1', 'Message from source 1');
      await logManager.captureLogs('source2', 'Message from source 2');
      
      const source1Logs = logManager.getLogsBySource('source1');
      const source2Logs = logManager.getLogsBySource('source2');
      
      expect(source1Logs.length).toBe(1);
      expect(source2Logs.length).toBe(1);
      expect(source1Logs[0].source).toBe('source1');
      expect(source2Logs[0].source).toBe('source2');
    });
  });

  describe('Log Streaming', () => {
    beforeEach(async () => {
      await logManager.initialize();
    });

    test('should enable log streaming', async () => {
      const streamCallback = jest.fn();
      
      logManager.enableStreaming(streamCallback);
      await logManager.captureLogs('test-source', 'Streaming test message');
      
      // Give streaming time to process
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(streamCallback).toHaveBeenCalled();
      expect(streamCallback).toHaveBeenCalledWith(expect.objectContaining({
        source: 'test-source',
        message: 'Streaming test message'
      }));
    });

    test('should disable log streaming', async () => {
      const streamCallback = jest.fn();
      
      logManager.enableStreaming(streamCallback);
      logManager.disableStreaming();
      
      await logManager.captureLogs('test-source', 'Should not stream');
      
      // Give time for any potential streaming
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(streamCallback).not.toHaveBeenCalled();
    });

    test('should handle streaming errors', async () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Streaming error');
      });
      
      logManager.enableStreaming(errorCallback);
      
      // Should not throw when callback errors
      await expect(logManager.captureLogs('test-source', 'Test message')).resolves.not.toThrow();
    });
  });

  describe('Log Buffering', () => {
    beforeEach(async () => {
      await logManager.initialize();
    });

    test('should maintain log buffer within size limits', async () => {
      const smallBufferManager = new TestLogManager({
        ...mockConfig,
        bufferSize: 5
      });
      await smallBufferManager.initialize();

      // Add more logs than buffer size
      for (let i = 0; i < 10; i++) {
        await smallBufferManager.captureLogs('test-source', `Message ${i}`);
      }

      expect(smallBufferManager.logBuffer.length).toBe(5);
      expect(smallBufferManager.logBuffer[0].message).toContain('Message 5');
      expect(smallBufferManager.logBuffer[4].message).toContain('Message 9');
      
      await smallBufferManager.cleanup();
    });

    test('should retrieve logs by time range', async () => {
      const startTime = Date.now();
      
      await logManager.captureLogs('test-source', 'Message 1');
      await new Promise(resolve => setTimeout(resolve, 10));
      await logManager.captureLogs('test-source', 'Message 2');
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const endTime = Date.now();
      
      const logs = logManager.getLogsByTimeRange(startTime, endTime);
      
      expect(logs.length).toBe(2);
      expect(logs[0].message).toContain('Message 1');
      expect(logs[1].message).toContain('Message 2');
    });

    test('should clear log buffer', async () => {
      await logManager.captureLogs('test-source', 'Message to clear');
      
      expect(logManager.logBuffer.length).toBe(1);
      
      logManager.clearBuffer();
      
      expect(logManager.logBuffer.length).toBe(0);
    });
  });

  describe('Log Correlation', () => {
    beforeEach(async () => {
      await logManager.initialize();
    });

    test('should correlate logs with correlation ID', async () => {
      const correlationId = 'test-correlation-123';
      
      await logManager.captureLogs('source1', 'First message', { correlationId });
      await logManager.captureLogs('source2', 'Second message', { correlationId });
      
      const correlatedLogs = logManager.getLogsByCorrelationId(correlationId);
      
      expect(correlatedLogs.length).toBe(2);
      expect(correlatedLogs[0].correlationId).toBe(correlationId);
      expect(correlatedLogs[1].correlationId).toBe(correlationId);
    });

    test('should auto-generate correlation ID when not provided', async () => {
      await logManager.captureLogs('test-source', 'Auto-correlation message');
      
      const logs = logManager.getLogsBySource('test-source');
      
      expect(logs.length).toBe(1);
      expect(logs[0].correlationId).toBeDefined();
      expect(logs[0].correlationId).toMatch(/^[a-f0-9-]+$/);
    });

    test('should correlate logs within time window', async () => {
      const timeWindow = 1000; // 1 second
      const baseTime = Date.now();
      
      await logManager.captureLogs('source1', 'Message 1', { timestamp: baseTime });
      await logManager.captureLogs('source2', 'Message 2', { timestamp: baseTime + 500 });
      await logManager.captureLogs('source3', 'Message 3', { timestamp: baseTime + 1500 });
      
      const correlatedLogs = logManager.correlateLogsByTimeWindow(baseTime, timeWindow);
      
      expect(correlatedLogs.length).toBe(2);
      expect(correlatedLogs.some(log => log.source === 'source1')).toBe(true);
      expect(correlatedLogs.some(log => log.source === 'source2')).toBe(true);
      expect(correlatedLogs.some(log => log.source === 'source3')).toBe(false);
    });
  });

  describe('Log Retrieval', () => {
    beforeEach(async () => {
      await logManager.initialize();
      
      // Add test data
      await logManager.captureLogs('process-1', 'Process 1 message');
      await logManager.captureLogs('process-2', 'Process 2 message');
      await logManager.captureLogs('browser-1', 'Browser 1 message');
    });

    test('should retrieve logs by process ID', async () => {
      const processLogs = await logManager.getLogsByProcess(1234);
      
      // Since we don't have real process ID mapping, this tests the interface
      expect(processLogs).toBeDefined();
      expect(processLogs.logs).toBeDefined();
      expect(processLogs.processId).toBe(1234);
    });

    test('should retrieve all logs', () => {
      const allLogs = logManager.getAllLogs();
      
      expect(allLogs.length).toBe(3);
      expect(allLogs.some(log => log.source === 'process-1')).toBe(true);
      expect(allLogs.some(log => log.source === 'process-2')).toBe(true);
      expect(allLogs.some(log => log.source === 'browser-1')).toBe(true);
    });

    test('should export logs in different formats', () => {
      const jsonLogs = logManager.exportLogs('json');
      const textLogs = logManager.exportLogs('text');
      const structuredLogs = logManager.exportLogs('structured');
      
      expect(jsonLogs).toMatch(/^\[\s*\{.*\}\s*\]$/s);
      expect(textLogs).toContain('Process 1 message');
      expect(structuredLogs).toContain('source: process-1');
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await logManager.initialize();
    });

    test('should cleanup resources properly', async () => {
      await logManager.attachToProcess({
        pid: 1234,
        stdout: { on: jest.fn(), pipe: jest.fn() },
        stderr: { on: jest.fn(), pipe: jest.fn() }
      });
      
      await logManager.cleanup();
      
      expect(logManager.isInitialized).toBe(false);
      expect(logManager.logBuffer.length).toBe(0);
      expect(logManager.logStreams.size).toBe(0);
    });

    test('should handle cleanup errors gracefully', async () => {
      // Mock cleanup to throw error
      logManager.cleanupStreams = jest.fn().mockRejectedValue(new Error('Cleanup error'));
      
      await expect(logManager.cleanup()).resolves.not.toThrow();
    });
  });
});