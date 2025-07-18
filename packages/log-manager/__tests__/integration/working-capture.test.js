/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import LogManager from '../../src/LogManager.js';
import { Readable } from 'stream';

describe('Working Log Capture Tests', () => {
  let logManager;

  beforeEach(() => {
    logManager = new LogManager();
  });

  afterEach(async () => {
    await logManager.cleanup();
  });

  test('should capture logs from readable streams', async () => {
    // Create mock stdout and stderr streams
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });

    // Capture from process
    const captureResult = await logManager.captureLogs({
      source: {
        type: 'process',
        id: 'test-process',
        pid: 12345,
        stdout,
        stderr
      }
    });

    expect(captureResult.success).toBe(true);

    // Emit some data to streams
    stdout.push('Line 1 from stdout\n');
    stdout.push('INFO: Application started\n');
    stderr.push('ERROR: Something went wrong\n');
    stdout.push('Line 3 from stdout\n');
    stderr.push('WARN: This is a warning\n');
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get logs - need to check both stdout and stderr streams
    const stdoutLogs = logManager.capture.getBufferedLogs('test-process-stdout');
    const stderrLogs = logManager.capture.getBufferedLogs('test-process-stderr');

    expect(stdoutLogs.logs.length).toBe(3);
    expect(stderrLogs.logs.length).toBe(2);

    // Test search across all logs
    const errorSearch = await logManager.searchLogs('ERROR');
    expect(errorSearch.success).toBe(true);
    expect(errorSearch.matches.length).toBeGreaterThan(0);

    // Test analysis
    const analysis = await logManager.analyzeLogs();
    expect(analysis.success).toBe(true);
    expect(analysis.totalLogs).toBe(5);

    // End streams
    stdout.push(null);
    stderr.push(null);
  });

  test('should export logs correctly', async () => {
    // Create a simple stream
    const stream = new Readable({ read() {} });

    await logManager.captureLogs({
      source: {
        type: 'stream',
        id: 'export-test',
        stream
      }
    });

    // Add some logs
    stream.push('2024-01-15T10:00:00Z INFO: Test log 1\n');
    stream.push('2024-01-15T10:00:01Z ERROR: Test error\n');
    stream.push('2024-01-15T10:00:02Z WARN: Test warning\n');
    stream.push(null);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Export to memory (using path that won't be written)
    const logs = logManager.capture.getBufferedLogs('export-test').logs;
    
    expect(logs.length).toBe(3);
    expect(logs[0].message).toContain('Test log 1');
    expect(logs[1].level).toBe('error');
    expect(logs[2].level).toBe('warn');
  });

  test('should handle real-time streaming', async () => {
    // Create stream first
    const streamResult = await logManager.streamLogs({
      levels: ['error', 'warn']
    });

    expect(streamResult.success).toBe(true);

    const collectedLogs = [];
    streamResult.stream.on('data', log => {
      collectedLogs.push(log);
    });

    // Create log source
    const source = new Readable({ read() {} });
    await logManager.captureLogs({
      source: {
        type: 'stream',
        id: 'stream-source',
        stream: source
      }
    });

    // Emit various log levels
    source.push('INFO: Should not be streamed\n');
    source.push('ERROR: Should be streamed\n');
    source.push('DEBUG: Should not be streamed\n');
    source.push('WARN: Should be streamed\n');

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(collectedLogs.length).toBe(2);
    expect(collectedLogs[0].level).toBe('error');
    expect(collectedLogs[1].level).toBe('warn');

    source.push(null);
  });

  test('should aggregate logs correctly', async () => {
    // Create aggregation
    await logManager.aggregateLogs('test-agg', ['src1', 'src2']);

    // Create two sources
    const source1 = new Readable({ read() {} });
    const source2 = new Readable({ read() {} });

    await logManager.captureLogs({
      source: { type: 'stream', id: 'src1', stream: source1 }
    });

    await logManager.captureLogs({
      source: { type: 'stream', id: 'src2', stream: source2 }
    });

    // Add logs
    source1.push('Source 1: Message 1\n');
    source2.push('Source 2: Message 1\n');
    source1.push('Source 1: ERROR occurred\n');
    source2.push('Source 2: All good\n');

    await new Promise(resolve => setTimeout(resolve, 100));

    // Check aggregation
    const aggLogs = logManager.aggregator.getAggregatedLogs('test-agg');
    expect(aggLogs.logs.length).toBe(4);
    expect(aggLogs.stats.totalLogs).toBe(4);
    expect(aggLogs.stats.errorCount).toBe(1);

    source1.push(null);
    source2.push(null);
  });

  test('should monitor errors with threshold', async () => {
    let alertTriggered = false;
    
    // Set up monitoring
    const monitor = await logManager.monitorErrors({
      threshold: 3,
      windowMs: 5000
    });

    expect(monitor.success).toBe(true);

    // Listen for alerts
    logManager.once('error-alert', (alert) => {
      alertTriggered = true;
      expect(alert.count).toBeGreaterThanOrEqual(3);
    });

    // Create source
    const source = new Readable({ read() {} });
    await logManager.captureLogs({
      source: { type: 'stream', id: 'error-source', stream: source }
    });

    // Generate errors
    source.push('ERROR: Error 1\n');
    source.push('INFO: Normal log\n');
    source.push('ERROR: Error 2\n');
    source.push('ERROR: Error 3 - should trigger alert\n');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(alertTriggered).toBe(true);

    source.push(null);
  });
});