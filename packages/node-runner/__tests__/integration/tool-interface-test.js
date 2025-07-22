/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import { ModuleFactory } from '@legion/module-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import * as childProcess from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock child_process module
jest.mock('child_process');

/**
 * Create a mock child process
 */
class MockChildProcess extends EventEmitter {
  constructor(command, args, options) {
    super();
    this.command = command;
    this.args = args;
    this.options = options;
    this.pid = Math.floor(Math.random() * 10000) + 1000;
    this.killed = false;
    
    this.stdout = new Readable({ read() {} });
    this.stderr = new Readable({ read() {} });
    this.stdin = null;
    
    process.nextTick(() => {
      this.emit('spawn');
    });
  }
  
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

describe('Tool Interface Integration Tests', () => {
  let moduleFactory;
  let nodeRunnerModule;
  let logManagerModule;
  
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Create ModuleFactory instance
    moduleFactory = new ModuleFactory();
    
    // Load both modules
    const nodeRunnerPath = path.join(__dirname, '../../');
    const logManagerPath = path.join(__dirname, '../../../log-manager/');
    
    nodeRunnerModule = await moduleFactory.loadModule(nodeRunnerPath);
    logManagerModule = await moduleFactory.loadModule(logManagerPath);
  });
  
  afterEach(async () => {
    // Cleanup
    if (nodeRunnerModule?.instance?.cleanup) {
      await nodeRunnerModule.instance.cleanup();
    }
    if (logManagerModule?.instance?.cleanup) {
      await logManagerModule.instance.cleanup();
    }
  });
  
  test('should start process and capture logs through tool interface', async () => {
    const mockProcess = new MockChildProcess('node', ['test.js'], { cwd: '/test' });
    childProcess.spawn.mockReturnValue(mockProcess);
    
    // Get the start_node_process tool
    const startProcessTool = nodeRunnerModule.module.getToolByName('start_node_process');
    expect(startProcessTool).toBeDefined();
    
    // Execute the tool
    const result = await startProcessTool.execute({
      command: 'node test.js',
      cwd: '/test'
    });
    
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.pid).toBe(mockProcess.pid);
    
    // Emit some logs
    mockProcess.stdout.push('Application started successfully\n');
    mockProcess.stderr.push('WARNING: Using default configuration\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Use the search_logs tool from LogManager
    const searchTool = logManagerModule.module.getToolByName('search_logs');
    const searchResult = await searchTool.execute({
      pattern: 'Application started'
    });
    
    expect(searchResult.success).toBe(true);
    expect(searchResult.matches.length).toBe(1);
    expect(searchResult.matches[0].message).toContain('Application started successfully');
  });
  
  test('should handle web server lifecycle through tools', async () => {
    const mockServerProcess = new MockChildProcess('node', ['server.js'], {});
    mockSpawn.mockReturnValue(mockServerProcess);
    
    // Start web server
    const startServerTool = nodeRunnerModule.module.getToolByName('start_web_server');
    const serverResult = await startServerTool.execute({
      command: 'node server.js',
      port: 3000,
      healthCheck: false
    });
    
    expect(serverResult.success).toBe(true);
    expect(serverResult.port).toBe(3000);
    
    // Emit server logs
    mockServerProcess.stdout.push(`Server listening on port ${serverResult.port}\n`);
    mockServerProcess.stdout.push('GET /api/users 200 15ms\n');
    mockServerProcess.stderr.push('ERROR: Database connection timeout\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Monitor errors
    const monitorTool = logManagerModule.module.getToolByName('monitor_errors');
    const monitorResult = await monitorTool.execute({
      threshold: 1,
      windowMs: 5000
    });
    
    expect(monitorResult.success).toBe(true);
    
    // List servers
    const listServersTool = nodeRunnerModule.module.getToolByName('list_servers');
    const serverList = await listServersTool.execute({});
    
    expect(serverList).toBeDefined();
    // Note: list_servers doesn't exist in module.json, this would need to be added
  });
  
  test('should aggregate logs from multiple processes', async () => {
    const mockProcess1 = new MockChildProcess('node', ['api.js'], {});
    const mockProcess2 = new MockChildProcess('node', ['worker.js'], {});
    
    childProcess.spawn
      .mockReturnValueOnce(mockProcess1)
      .mockReturnValueOnce(mockProcess2);
    
    // Start multiple processes
    const startTool = nodeRunnerModule.module.getToolByName('start_node_process');
    
    const api = await startTool.execute({ command: 'node api.js' });
    const worker = await startTool.execute({ command: 'node worker.js' });
    
    // Aggregate logs
    const aggregateTool = logManagerModule.module.getToolByName('aggregate_logs');
    const aggResult = await aggregateTool.execute({
      aggregationId: 'multi-service',
      sources: [api.id, worker.id],
      name: 'Multi-Service Logs'
    });
    
    expect(aggResult.success).toBe(true);
    
    // Emit logs
    mockProcess1.stdout.push('[API] Request received\n');
    mockProcess1.stdout.push('[API] Response sent\n');
    mockProcess2.stdout.push('[WORKER] Job started\n');
    mockProcess2.stderr.push('[WORKER] ERROR: Job failed\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Analyze aggregated logs
    const analyzeTool = logManagerModule.module.getToolByName('analyze_logs');
    const analysis = await analyzeTool.execute({
      aggregationId: 'multi-service',
      includeErrors: true
    });
    
    expect(analysis.success).toBe(true);
    expect(analysis.totalLogs).toBe(4);
    expect(analysis.errors.total).toBe(1);
  });
  
  test('should export logs through tool interface', async () => {
    const mockProcess = new MockChildProcess('node', ['export-test.js'], {});
    childProcess.spawn.mockReturnValue(mockProcess);
    
    // Start process
    const startTool = nodeRunnerModule.module.getToolByName('start_node_process');
    const proc = await startTool.execute({ command: 'node export-test.js' });
    
    // Emit logs
    mockProcess.stdout.push('2024-01-15T10:00:00Z INFO: Service started\n');
    mockProcess.stdout.push('2024-01-15T10:00:01Z INFO: Connected to database\n');
    mockProcess.stderr.push('2024-01-15T10:00:02Z ERROR: Failed to load config\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Filter logs
    const filterTool = logManagerModule.module.getToolByName('filter_logs');
    const filtered = await filterTool.execute({
      criteria: {
        level: 'error'
      }
    });
    
    expect(filtered.success).toBe(true);
    expect(filtered.logs.length).toBe(1);
    expect(filtered.logs[0].level).toBe('error');
  });
  
  test('should handle process restart through tools', async () => {
    let callCount = 0;
    const mockProcess1 = new MockChildProcess('node', ['restart.js'], {});
    const mockProcess2 = new MockChildProcess('node', ['restart.js'], {});
    
    childProcess.spawn.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockProcess1 : mockProcess2;
    });
    
    // Start process
    const startTool = nodeRunnerModule.module.getToolByName('start_node_process');
    const proc = await startTool.execute({
      command: 'node restart.js',
      env: { NODE_ENV: 'development' }
    });
    
    // Emit logs from first instance
    mockProcess1.stdout.push('Instance 1: Starting\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Restart process
    const restartTool = nodeRunnerModule.module.getToolByName('restart_process');
    const restartResult = await restartTool.execute({
      processId: proc.id,
      env: { NODE_ENV: 'production' }
    });
    
    expect(restartResult.success).toBe(true);
    
    // Emit logs from second instance
    mockProcess2.stdout.push('Instance 2: Starting with new config\n');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Search for all logs
    const searchTool = logManagerModule.module.getToolByName('search_logs');
    const allLogs = await searchTool.execute({ pattern: 'Instance' });
    
    expect(allLogs.success).toBe(true);
    expect(allLogs.matches.length).toBe(2);
  });
  
  test('should stream logs in real-time through tools', async () => {
    const mockProcess = new MockChildProcess('node', ['stream.js'], {});
    childProcess.spawn.mockReturnValue(mockProcess);
    
    // Set up streaming
    const streamTool = logManagerModule.module.getToolByName('stream_logs');
    const streamResult = await streamTool.execute({
      streamId: 'test-stream',
      levels: ['error', 'warn']
    });
    
    expect(streamResult.success).toBe(true);
    expect(streamResult.stream).toBeDefined();
    
    // Collect streamed logs
    const streamedLogs = [];
    streamResult.stream.on('data', (log) => {
      streamedLogs.push(log);
    });
    
    // Start process
    const startTool = nodeRunnerModule.module.getToolByName('start_node_process');
    await startTool.execute({ command: 'node stream.js' });
    
    // Emit various logs
    mockProcess.stdout.push('INFO: Normal operation\n');
    mockProcess.stderr.push('ERROR: Critical failure\n');
    mockProcess.stderr.push('WARN: High CPU usage\n');
    mockProcess.stdout.push('DEBUG: Verbose output\n');
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should only receive error and warn
    expect(streamedLogs.length).toBe(2);
    expect(streamedLogs.some(log => log.level === 'error')).toBe(true);
    expect(streamedLogs.some(log => log.level === 'warn')).toBe(true);
  });
  
  test('should handle npm script execution with logging', async () => {
    const mockProcess = new MockChildProcess('npm', ['run', 'test'], {});
    childProcess.spawn.mockReturnValue(mockProcess);
    
    // Run npm script
    const npmTool = nodeRunnerModule.module.getToolByName('run_npm_script');
    const npmResult = await npmTool.execute({
      scriptName: 'test',
      cwd: '/project'
    });
    
    // Simulate npm output
    process.nextTick(() => {
      mockProcess.stdout.push('> project@1.0.0 test\n');
      mockProcess.stdout.push('> jest\n');
      mockProcess.stdout.push('PASS  src/test.js\n');
      mockProcess.stdout.push('Test Suites: 1 passed, 1 total\n');
      mockProcess.emit('exit', 0, null);
    });
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 200));
    
    expect(npmResult.success).toBe(true);
    expect(npmResult.script).toBe('test');
    expect(npmResult.exitCode).toBe(0);
    expect(npmResult.output).toContain('Test Suites: 1 passed');
  });
});