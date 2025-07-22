/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// Create manual mock for spawn BEFORE imports
const mockSpawn = jest.fn();
jest.unstable_mockModule('child_process', () => ({
  spawn: mockSpawn,
  default: { spawn: mockSpawn }
}));

// Mock tree-kill
const mockTreeKill = jest.fn((pid, signal, callback) => {
  // Simulate successful kill
  if (callback) callback(null);
});
jest.unstable_mockModule('tree-kill', () => ({
  default: mockTreeKill
}));

// Mock execa
jest.unstable_mockModule('execa', () => ({
  execa: jest.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })
}));

// Import modules AFTER mock setup
const NodeRunner = (await import('../../src/NodeRunner.js')).default;
const LogManager = (await import('@legion/log-manager')).default;

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

describe('Simple NodeRunner and LogManager Integration', () => {
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
    try {
      await nodeRunner.cleanup();
      await logManager.cleanup();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }, 10000);
  
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
});