/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import LogManager from '../../src/LogManager.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live Log Capture Tests', () => {
  let logManager;
  let testDir;

  beforeEach(async () => {
    logManager = new LogManager();
    testDir = path.join(__dirname, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await logManager.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should capture logs from a real Node.js process', async () => {
    // Create a test script
    const script = `
      console.log('Starting application');
      console.error('ERROR: Test error message');
      console.warn('WARNING: Test warning');
      console.log('INFO: Processing data');
      
      let count = 0;
      const interval = setInterval(() => {
        count++;
        console.log(\`Processing item \${count}\`);
        if (count === 3) {
          console.log('Completed processing');
          clearInterval(interval);
          process.exit(0);
        }
      }, 100);
    `;
    
    await fs.writeFile(path.join(testDir, 'test-app.js'), script);

    // Spawn the process
    const child = spawn('node', ['test-app.js'], {
      cwd: testDir,
      stdio: 'pipe'
    });

    // Capture logs
    const captureResult = await logManager.captureLogs({
      source: {
        type: 'process',
        id: 'test-process',
        pid: child.pid,
        stdout: child.stdout,
        stderr: child.stderr
      }
    });

    expect(captureResult.success).toBe(true);

    // Wait for process to complete
    await new Promise((resolve) => {
      child.on('exit', resolve);
    });

    // Wait a bit for logs to be processed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get all captured logs
    const allLogs = await logManager.filterLogs({}, {
      sources: ['test-process'],
      limit: 100
    });

    expect(allLogs.success).toBe(true);
    expect(allLogs.logs.length).toBeGreaterThan(0);

    // Verify log content
    const logMessages = allLogs.logs.map(log => log.message);
    const combinedLogs = logMessages.join(' ');
    
    expect(combinedLogs).toContain('Starting application');
    expect(combinedLogs).toContain('ERROR: Test error message');
    expect(combinedLogs).toContain('WARNING: Test warning');
    expect(combinedLogs).toContain('Completed processing');

    // Search for errors
    const errorSearch = await logManager.searchLogs('ERROR', {
      sources: ['test-process']
    });

    expect(errorSearch.success).toBe(true);
    expect(errorSearch.matches.length).toBeGreaterThan(0);
    expect(errorSearch.matches[0].message).toContain('ERROR: Test error message');

    // Analyze logs
    const analysis = await logManager.analyzeLogs({
      sources: ['test-process'],
      includeErrors: true
    });

    expect(analysis.success).toBe(true);
    expect(analysis.totalLogs).toBeGreaterThan(0);
    expect(analysis.errors.total).toBeGreaterThan(0);
  }, 10000);

  test('should capture and export logs from file', async () => {
    // Create a log file
    const logContent = `
2024-01-15T10:00:00Z INFO: Application started
2024-01-15T10:00:01Z ERROR: Database connection failed
2024-01-15T10:00:02Z WARN: Retrying connection
2024-01-15T10:00:03Z INFO: Connection established
2024-01-15T10:00:04Z ERROR: Query timeout
2024-01-15T10:00:05Z INFO: Request processed
`;
    
    const logFile = path.join(testDir, 'app.log');
    await fs.writeFile(logFile, logContent.trim());

    // Capture from file
    const captureResult = await logManager.captureLogs({
      source: {
        type: 'file',
        id: 'file-logs',
        path: logFile,
        fromBeginning: true
      },
      follow: false
    });

    expect(captureResult.success).toBe(true);

    // Wait for file to be read
    await new Promise(resolve => setTimeout(resolve, 500));

    // Export logs
    const exportPath = path.join(testDir, 'exported-logs.json');
    const exportResult = await logManager.exportLogs(exportPath, {
      format: 'json',
      sources: ['file-logs']
    });

    expect(exportResult.success).toBe(true);
    expect(exportResult.logCount).toBeGreaterThan(0);

    // Verify exported file
    const exportedData = JSON.parse(await fs.readFile(exportPath, 'utf8'));
    expect(exportedData.logs).toBeInstanceOf(Array);
    expect(exportedData.logs.length).toBe(6);
    
    // Test CSV export
    const csvPath = path.join(testDir, 'exported-logs.csv');
    const csvResult = await logManager.exportLogs(csvPath, {
      format: 'csv',
      sources: ['file-logs']
    });

    expect(csvResult.success).toBe(true);
    
    const csvContent = await fs.readFile(csvPath, 'utf8');
    expect(csvContent).toContain('timestamp,level,sourceId,message');
    expect(csvContent).toContain('Database connection failed');
  }, 10000);

  test('should stream logs in real-time', async () => {
    // Create a stream
    const streamResult = await logManager.streamLogs({
      streamId: 'test-stream',
      levels: ['error', 'warn'],
      realtime: true
    });

    expect(streamResult.success).toBe(true);
    expect(streamResult.stream).toBeDefined();

    // Collect streamed logs
    const streamedLogs = [];
    streamResult.stream.on('data', (log) => {
      streamedLogs.push(log);
    });

    // Create a process that generates logs
    const script = `
      console.log('INFO: This should not be streamed');
      console.error('ERROR: This should be streamed');
      console.warn('WARN: This should also be streamed');
      console.log('Another info log');
      console.error('ERROR: Second error');
    `;
    
    await fs.writeFile(path.join(testDir, 'streaming-test.js'), script);

    const child = spawn('node', ['streaming-test.js'], {
      cwd: testDir,
      stdio: 'pipe'
    });

    // Capture logs
    await logManager.captureLogs({
      source: {
        type: 'process',
        id: 'stream-test',
        pid: child.pid,
        stdout: child.stdout,
        stderr: child.stderr
      }
    });

    // Wait for process to complete
    await new Promise((resolve) => {
      child.on('exit', resolve);
    });

    // Wait for streaming
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify only error and warn logs were streamed
    expect(streamedLogs.length).toBe(3); // 2 errors + 1 warning
    expect(streamedLogs.every(log => ['error', 'warn'].includes(log.level))).toBe(true);
  });

  test('should aggregate logs from multiple sources', async () => {
    // Create aggregation
    const aggResult = await logManager.aggregateLogs(
      'multi-source-agg',
      ['source1', 'source2'],
      {
        name: 'Multi-Source Test',
        bufferSize: 1000
      }
    );

    expect(aggResult.success).toBe(true);

    // Create two processes
    const script1 = 'console.log("Source 1: Message 1"); console.error("Source 1: Error");';
    const script2 = 'console.log("Source 2: Message 1"); console.warn("Source 2: Warning");';
    
    await fs.writeFile(path.join(testDir, 'app1.js'), script1);
    await fs.writeFile(path.join(testDir, 'app2.js'), script2);

    const child1 = spawn('node', ['app1.js'], { cwd: testDir, stdio: 'pipe' });
    const child2 = spawn('node', ['app2.js'], { cwd: testDir, stdio: 'pipe' });

    // Capture from both sources
    await logManager.captureLogs({
      source: {
        type: 'process',
        id: 'source1',
        pid: child1.pid,
        stdout: child1.stdout,
        stderr: child1.stderr
      }
    });

    await logManager.captureLogs({
      source: {
        type: 'process',
        id: 'source2',
        pid: child2.pid,
        stdout: child2.stdout,
        stderr: child2.stderr
      }
    });

    // Wait for processes
    await Promise.all([
      new Promise(resolve => child1.on('exit', resolve)),
      new Promise(resolve => child2.on('exit', resolve))
    ]);

    // Wait for aggregation
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get aggregated logs
    const aggLogs = logManager.aggregator.getAggregatedLogs('multi-source-agg');
    
    expect(aggLogs.logs.length).toBeGreaterThan(0);
    expect(aggLogs.stats.totalLogs).toBeGreaterThan(0);
    
    // Verify logs from both sources
    const sources = new Set(aggLogs.logs.map(log => log.sourceId));
    expect(sources.has('source1')).toBe(true);
    expect(sources.has('source2')).toBe(true);
  });
});