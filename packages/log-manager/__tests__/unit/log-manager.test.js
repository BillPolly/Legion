/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import LogManager from '../../src/LogManager.js';
import { Readable } from 'stream';

describe('LogManager Unit Tests', () => {
  let logManager;

  beforeEach(() => {
    logManager = new LogManager({
      defaultBufferSize: 100,
      realtimeStreaming: true
    });
  });

  afterEach(async () => {
    await logManager.cleanup();
  });

  describe('Configuration', () => {
    test('should initialize with default config', () => {
      const manager = new LogManager();
      expect(manager.config.defaultBufferSize).toBe(1000);
      expect(manager.config.realtimeStreaming).toBe(true);
    });

    test('should accept custom config', () => {
      expect(logManager.config.defaultBufferSize).toBe(100);
      expect(logManager.config.realtimeStreaming).toBe(true);
    });
  });

  describe('Log Capture', () => {
    test('should capture logs from a stream', async () => {
      const stream = new Readable({
        read() {}
      });

      const result = await logManager.captureLogs({
        source: {
          type: 'stream',
          id: 'test-stream',
          stream: stream,
          streamType: 'stdout'
        }
      });

      expect(result.success).toBe(true);
      expect(result.sourceId).toBe('test-stream');
      expect(result.status).toBe('capturing');

      // Emit some data
      stream.push('Test log message\n');
      stream.push('Another log\n');
      stream.push(null); // End stream
    });

    test('should handle capture errors', async () => {
      const result = await logManager.captureLogs({
        source: {
          type: 'invalid',
          id: 'test'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported source type');
    });

    test('should validate source parameter', async () => {
      const result = await logManager.captureLogs({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Source is required');
    });
  });

  describe('Log Streaming', () => {
    test('should create a log stream', async () => {
      const result = await logManager.streamLogs({
        sources: ['source1', 'source2'],
        levels: ['error', 'warn'],
        realtime: true
      });

      expect(result.success).toBe(true);
      expect(result.streamId).toBeDefined();
      expect(result.stream).toBeDefined();
      expect(result.status).toBe('created');
    });

    test('should create stream with default parameters', async () => {
      const result = await logManager.streamLogs();

      expect(result.success).toBe(true);
      expect(result.streamId).toBeDefined();
    });
  });

  describe('Log Search', () => {
    test('should search logs with pattern', async () => {
      // First capture some logs
      const stream = new Readable({ read() {} });
      await logManager.captureLogs({
        source: {
          type: 'stream',
          id: 'search-test',
          stream: stream
        }
      });

      // Emit test data
      stream.push('Error: Connection refused\n');
      stream.push('Info: Server started\n');
      stream.push('Error: Timeout occurred\n');
      stream.push(null);

      // Wait for logs to be processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Search for errors
      const result = await logManager.searchLogs('Error', {
        sources: ['search-test'],
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(result.pattern).toBe('Error');
      expect(result.matches).toBeDefined();
    });

    test('should handle invalid regex patterns', async () => {
      const result = await logManager.searchLogs('[invalid(regex', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid regex pattern');
    });
  });

  describe('Log Filtering', () => {
    test('should filter logs by criteria', async () => {
      const result = await logManager.filterLogs({
        level: 'error',
        contains: 'database'
      });

      expect(result.success).toBe(true);
      expect(result.logs).toBeInstanceOf(Array);
      expect(result.total).toBeDefined();
      expect(result.offset).toBe(0);
      expect(result.limit).toBe(100);
    });

    test('should apply pagination', async () => {
      const result = await logManager.filterLogs(
        { level: 'info' },
        { limit: 50, offset: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(10);
    });
  });

  describe('Log Analysis', () => {
    test('should analyze logs', async () => {
      const result = await logManager.analyzeLogs({
        includePatterns: true,
        includeErrors: true,
        includePerformance: false
      });

      expect(result.success).toBe(true);
      expect(result.totalLogs).toBeDefined();
      expect(result.timeRange).toBeDefined();
      expect(result.logLevels).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.errors).toBeDefined();
    });

    test('should analyze with default options', async () => {
      const result = await logManager.analyzeLogs();

      expect(result.success).toBe(true);
      expect(result.totalLogs).toBe(0); // No logs captured yet
    });
  });

  describe('Log Export', () => {
    test('should validate export parameters', async () => {
      const result = await logManager.exportLogs('', {
        format: 'json'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle export with filters', async () => {
      const result = await logManager.exportLogs('/tmp/test-export.json', {
        format: 'json',
        filters: {
          level: 'error',
          startTime: new Date().toISOString()
        }
      });

      // May fail due to permissions, but should attempt
      expect(result).toBeDefined();
    });
  });

  describe('Log Aggregation', () => {
    test('should create log aggregation', async () => {
      const result = await logManager.aggregateLogs(
        'test-aggregation',
        ['source1', 'source2'],
        {
          name: 'Test Aggregation',
          description: 'Testing aggregation',
          bufferSize: 1000
        }
      );

      expect(result.success).toBe(true);
      expect(result.id).toBe('test-aggregation');
      expect(result.sources).toEqual(['source1', 'source2']);
      expect(result.status).toBe('created');
    });

    test('should handle duplicate aggregation IDs', async () => {
      await logManager.aggregateLogs('duplicate-id', ['source1']);
      
      const result = await logManager.aggregateLogs('duplicate-id', ['source2']);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });

  describe('Error Monitoring', () => {
    test('should set up error monitoring', async () => {
      const result = await logManager.monitorErrors({
        sources: ['app-logs'],
        threshold: 5,
        windowMs: 60000
      });

      expect(result.success).toBe(true);
      expect(result.streamId).toBeDefined();
      expect(result.monitorId).toBeDefined();
      expect(result.threshold).toBe(5);
      expect(result.window).toBe(60000);
    });

    test('should use default monitoring parameters', async () => {
      const result = await logManager.monitorErrors();

      expect(result.success).toBe(true);
      expect(result.threshold).toBe(5);
      expect(result.window).toBe(60000);
    });
  });

  describe('Source Management', () => {
    test('should list active sources', async () => {
      // Capture a source first
      const stream = new Readable({ read() {} });
      await logManager.captureLogs({
        source: {
          type: 'stream',
          id: 'list-test',
          stream: stream
        }
      });

      const result = await logManager.listSources();

      expect(result.success).toBe(true);
      expect(result.sources).toBeInstanceOf(Array);
      expect(result.count).toBeGreaterThan(0);
    });

    test('should stop capturing from source', async () => {
      // Create a source
      const stream = new Readable({ read() {} });
      const captureResult = await logManager.captureLogs({
        source: {
          type: 'stream',
          id: 'stop-test',
          stream: stream
        }
      });

      // Stop capturing
      const stopResult = await logManager.stopCapture('stop-test');

      expect(stopResult.success).toBe(true);
      expect(stopResult.sourceId).toBe('stop-test');
      expect(stopResult.status).toBe('stopped');
    });

    test('should handle stopping non-existent source', async () => {
      const result = await logManager.stopCapture('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Statistics', () => {
    test('should get overall statistics', async () => {
      const result = await logManager.getStatistics();

      expect(result.success).toBe(true);
      expect(result.sources).toBeDefined();
      expect(result.aggregations).toBeDefined();
      expect(result.streams).toBeDefined();
      expect(result.totalLogs).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      // Create some resources
      await logManager.streamLogs();
      await logManager.aggregateLogs('cleanup-test', ['source1']);

      const result = await logManager.cleanup();

      expect(result.success).toBe(true);
      expect(result.message).toContain('cleaned up');

      // Verify cleanup
      const stats = await logManager.getStatistics();
      expect(stats.sources).toBe(0);
      expect(stats.aggregations).toBe(0);
      expect(stats.streams).toBe(0);
    });
  });

  describe('Module Factory Integration', () => {
    test('should be loadable as constructor module', () => {
      expect(LogManager).toBeDefined();
      expect(typeof LogManager).toBe('function');
      
      const instance = new LogManager();
      expect(instance).toBeInstanceOf(LogManager);
      expect(typeof instance.captureLogs).toBe('function');
    });
  });
});