/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import NodeRunner from '../../src/NodeRunner.js';
import LogManager from '@jsenvoy/log-manager';

// Create manual mock for spawn
const mockSpawn = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn
}));

/**
 * Create a mock child process with controllable streams
 */
class MockChildProcess extends EventEmitter {
  constructor(command, args, options) {
    super();
    this.command = command;
    this.args = args;
    this.options = options;
    this.pid = Math.floor(Math.random() * 10000) + 1000;
    this.killed = false;
    
    // Create mock streams
    this.stdout = new Readable({ read() {} });
    this.stderr = new Readable({ read() {} });
    this.stdin = null;
    
    // Simulate process start
    process.nextTick(() => {
      this.emit('spawn');
    });
  }
  
  // Mock kill method
  kill(signal = 'SIGTERM') {
    if (!this.killed) {
      this.killed = true;
      process.nextTick(() => {
        this.stdout.push(null);
        this.stderr.push(null);
        const code = signal === 'SIGKILL' ? 1 : 0;
        this.emit('exit', code, signal);
      });
      return true;
    }
    return false;
  }
}

describe('NodeRunner and LogManager Integration', () => {
  let nodeRunner;
  let logManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create real LogManager instance
    logManager = new LogManager({
      defaultBufferSize: 100,
      realtimeStreaming: true
    });
    
    // Create NodeRunner with the LogManager
    nodeRunner = new NodeRunner({
      logManager,
      autoCleanup: false
    });
  });
  
  afterEach(async () => {
    await nodeRunner.cleanup();
    await logManager.cleanup();
  });
  
  test('should automatically capture logs when starting a process', async () => {
    // Create mock process
    const mockProcess = new MockChildProcess('node', ['test.js'], { cwd: '/test' });
    mockSpawn.mockReturnValue(mockProcess);
    
    // Start the process
    const result = await nodeRunner.startNodeProcess('node test.js', {
      cwd: '/test'
    });
    
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.pid).toBe(mockProcess.pid);
    
    // Emit some logs
    mockProcess.stdout.push('Starting application\n');
    mockProcess.stdout.push('Server listening on port 3000\n');
    mockProcess.stderr.push('WARNING: Development mode\n');
    
    // Wait for logs to be processed
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Search for logs using LogManager
    const searchResult = await logManager.searchLogs('Server listening');
    expect(searchResult.success).toBe(true);
    expect(searchResult.matches.length).toBe(1);
    expect(searchResult.matches[0].message).toContain('Server listening on port 3000');
    
    // Get logs through NodeRunner
    const processLogs = await nodeRunner.getProcessLogs(result.id);
    expect(processLogs.success).toBe(true);
    expect(processLogs.logs.length).toBe(3);
  });
  
  test('should handle multiple processes with log aggregation', async () => {
    // Create multiple mock processes
    const mockProcess1 = new MockChildProcess('node', ['api.js'], {});
    const mockProcess2 = new MockChildProcess('node', ['worker.js'], {});
    
    mockSpawn
      .mockReturnValueOnce(mockProcess1)
      .mockReturnValueOnce(mockProcess2);
    
    // Start both processes
    const api = await nodeRunner.startNodeProcess('node api.js');
    const worker = await nodeRunner.startNodeProcess('node worker.js');
    
    expect(api.success).toBe(true);
    expect(worker.success).toBe(true);
    
    // Create log aggregation
    const aggResult = await logManager.aggregateLogs('microservices', [
      api.id,
      worker.id
    ], {
      name: 'Microservices Logs',
      description: 'Combined logs from API and Worker'
    });
    
    expect(aggResult.success).toBe(true);
    
    // Emit logs from both processes
    mockProcess1.stdout.push('[API] Starting HTTP server\n');
    mockProcess1.stdout.push('[API] Connected to database\n');
    mockProcess2.stdout.push('[WORKER] Starting job processor\n');
    mockProcess2.stderr.push('[WORKER] ERROR: Failed to connect to Redis\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Analyze aggregated logs
    const analysis = await logManager.analyzeLogs({
      aggregationId: 'microservices',
      includeErrors: true
    });
    
    expect(analysis.success).toBe(true);
    expect(analysis.totalLogs).toBe(4);
    expect(analysis.errors.total).toBe(1);
    expect(analysis.errors.messages[0]).toContain('Failed to connect to Redis');
  });
  
  test('should stream logs in real-time', async () => {
    // Create mock process
    const mockProcess = new MockChildProcess('node', ['stream-test.js'], {});
    mockSpawn.mockReturnValue(mockProcess);
    
    // Set up real-time log streaming
    const streamResult = await logManager.streamLogs({
      streamId: 'test-stream',
      levels: ['error', 'warn'],
      realtime: true
    });
    
    expect(streamResult.success).toBe(true);
    
    // Collect streamed logs
    const streamedLogs = [];
    streamResult.stream.on('data', (log) => {
      streamedLogs.push(log);
    });
    
    // Start process
    const proc = await nodeRunner.startNodeProcess('node stream-test.js');
    
    // Emit various log levels
    mockProcess.stdout.push('INFO: Normal operation\n');
    mockProcess.stderr.push('ERROR: Connection failed\n');
    mockProcess.stdout.push('DEBUG: Variable x = 5\n');
    mockProcess.stderr.push('WARN: High memory usage\n');
    mockProcess.stderr.push('ERROR: Timeout occurred\n');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should only receive error and warn logs
    expect(streamedLogs.length).toBe(3);
    expect(streamedLogs[0].level).toBe('error');
    expect(streamedLogs[0].message).toContain('Connection failed');
    expect(streamedLogs[1].level).toBe('warn');
    expect(streamedLogs[2].level).toBe('error');
  });
  
  test('should handle process crashes and preserve logs', async () => {
    const mockProcess = new MockChildProcess('node', ['crash-test.js'], {});
    mockSpawn.mockReturnValue(mockProcess);
    
    // Start process
    const proc = await nodeRunner.startNodeProcess('node crash-test.js');
    
    // Emit logs before crash
    mockProcess.stdout.push('Application starting...\n');
    mockProcess.stdout.push('Loading configuration\n');
    mockProcess.stderr.push('ERROR: Unhandled exception!\n');
    mockProcess.stderr.push('Stack trace: ...\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Simulate crash
    mockProcess.emit('exit', 1, null);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Logs should still be available after crash
    const logsAfterCrash = await nodeRunner.getProcessLogs(proc.id);
    expect(logsAfterCrash.success).toBe(true);
    expect(logsAfterCrash.logs.length).toBe(4);
    
    // Search for error
    const errorSearch = await logManager.searchLogs('Unhandled exception');
    expect(errorSearch.success).toBe(true);
    expect(errorSearch.matches.length).toBe(1);
  });
  
  test('should export logs from multiple processes', async () => {
    // Create mock processes
    const mockProcess1 = new MockChildProcess('node', ['export1.js'], {});
    const mockProcess2 = new MockChildProcess('node', ['export2.js'], {});
    
    mockSpawn
      .mockReturnValueOnce(mockProcess1)
      .mockReturnValueOnce(mockProcess2);
    
    // Start processes
    const proc1 = await nodeRunner.startNodeProcess('node export1.js');
    const proc2 = await nodeRunner.startNodeProcess('node export2.js');
    
    // Emit logs
    mockProcess1.stdout.push('Process 1: Started\n');
    mockProcess1.stdout.push('Process 1: Processing item 1\n');
    mockProcess2.stdout.push('Process 2: Started\n');
    mockProcess2.stderr.push('Process 2: ERROR occurred\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Export logs to memory (we'll check the data structure)
    const allLogs = await logManager.filterLogs({});
    
    expect(allLogs.success).toBe(true);
    expect(allLogs.logs.length).toBe(4);
    
    // Verify logs from both processes are captured
    const process1Logs = allLogs.logs.filter(log => 
      log.message.includes('Process 1'));
    const process2Logs = allLogs.logs.filter(log => 
      log.message.includes('Process 2'));
    
    expect(process1Logs.length).toBe(2);
    expect(process2Logs.length).toBe(2);
  });
  
  test('should monitor errors across processes', async () => {
    const mockProcess = new MockChildProcess('node', ['monitor-test.js'], {});
    mockSpawn.mockReturnValue(mockProcess);
    
    // Set up error monitoring
    const monitorResult = await logManager.monitorErrors({
      threshold: 3,
      windowMs: 5000
    });
    
    expect(monitorResult.success).toBe(true);
    
    // Track alerts
    let alertReceived = false;
    logManager.once('error-alert', (alert) => {
      alertReceived = true;
      expect(alert.count).toBeGreaterThanOrEqual(3);
    });
    
    // Start process
    const proc = await nodeRunner.startNodeProcess('node monitor-test.js');
    
    // Emit errors to trigger alert
    mockProcess.stderr.push('ERROR: Database connection lost\n');
    mockProcess.stdout.push('INFO: Attempting reconnect\n');
    mockProcess.stderr.push('ERROR: Reconnect failed\n');
    mockProcess.stderr.push('ERROR: Service unavailable\n');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(alertReceived).toBe(true);
  });
  
  test('should handle process restart with continuous logging', async () => {
    let callCount = 0;
    const mockProcess1 = new MockChildProcess('node', ['restart.js'], {});
    const mockProcess2 = new MockChildProcess('node', ['restart.js'], {});
    
    // Return different mock processes for restart
    mockSpawn.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockProcess1 : mockProcess2;
    });
    
    // Start process
    const proc = await nodeRunner.startNodeProcess('node restart.js');
    
    // Emit logs from first instance
    mockProcess1.stdout.push('Instance 1: Starting\n');
    mockProcess1.stdout.push('Instance 1: Running\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Restart process
    const restartResult = await nodeRunner.restartProcess(proc.id);
    expect(restartResult.success).toBe(true);
    
    // Emit logs from second instance
    mockProcess2.stdout.push('Instance 2: Starting\n');
    mockProcess2.stdout.push('Instance 2: Running\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // All logs should be available
    const allLogs = await logManager.searchLogs('Instance');
    expect(allLogs.success).toBe(true);
    expect(allLogs.matches.length).toBe(4);
    
    // Verify both instances logged
    const instance1Logs = allLogs.matches.filter(log => 
      log.message.includes('Instance 1'));
    const instance2Logs = allLogs.matches.filter(log => 
      log.message.includes('Instance 2'));
    
    expect(instance1Logs.length).toBe(2);
    expect(instance2Logs.length).toBe(2);
  });
});