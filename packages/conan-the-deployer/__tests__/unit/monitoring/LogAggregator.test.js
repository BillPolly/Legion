import { jest } from '@jest/globals';

// Mock fs/promises
jest.unstable_mockModule('fs/promises', () => {
  const mockFunctions = {
    readFile: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    watch: jest.fn()
  };
  return {
    ...mockFunctions,
    default: mockFunctions
  };
});

// Import after mocking
const LogAggregator = (await import('../../../src/monitoring/LogAggregator.js')).default;
const fs = await import('fs/promises');

describe('LogAggregator', () => {
  let logAggregator;

  beforeEach(() => {
    jest.clearAllMocks();
    logAggregator = new LogAggregator();
  });

  afterEach(() => {
    // Clean up any running watchers
    logAggregator.stopAllWatching();
  });

  describe('Log Source Registration', () => {
    test('should register file log source', () => {
      const config = {
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        level: 'info',
        format: 'json'
      };

      logAggregator.addLogSource(config);

      const sources = logAggregator.getLogSources('deploy-123');
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('file');
      expect(sources[0].path).toBe('/app/logs/app.log');
    });

    test('should register stdout log source', () => {
      const config = {
        deploymentId: 'deploy-123',
        type: 'stdout',
        processId: '12345',
        level: 'debug'
      };

      logAggregator.addLogSource(config);

      const sources = logAggregator.getLogSources('deploy-123');
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('stdout');
      expect(sources[0].processId).toBe('12345');
    });

    test('should register HTTP log source', () => {
      const config = {
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/logs',
        interval: 30000
      };

      logAggregator.addLogSource(config);

      const sources = logAggregator.getLogSources('deploy-123');
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('http');
      expect(sources[0].url).toBe('http://localhost:3000/logs');
    });

    test('should register custom log source', () => {
      const customSource = jest.fn();
      const config = {
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database-logs',
        source: customSource
      };

      logAggregator.addLogSource(config);

      const sources = logAggregator.getLogSources('deploy-123');
      expect(sources).toHaveLength(1);
      expect(sources[0].type).toBe('custom');
      expect(sources[0].name).toBe('database-logs');
    });
  });

  describe('File Log Reading', () => {
    test('should read logs from file', async () => {
      const logContent = [
        '{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"App started"}',
        '{"timestamp":"2024-01-01T10:01:00Z","level":"error","message":"Database connection failed"}',
        '{"timestamp":"2024-01-01T10:02:00Z","level":"info","message":"Retrying database connection"}'
      ].join('\n');

      fs.readFile.mockResolvedValue(logContent);
      fs.stat.mockResolvedValue({ size: logContent.length });

      const logs = await logAggregator.readFileLog({
        path: '/app/logs/app.log',
        format: 'json',
        maxLines: 100
      });

      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('App started');
      expect(logs[1].level).toBe('error');
      expect(logs[1].message).toBe('Database connection failed');
    });

    test('should handle plain text log format', async () => {
      const logContent = [
        '2024-01-01 10:00:00 [INFO] App started',
        '2024-01-01 10:01:00 [ERROR] Database connection failed',
        '2024-01-01 10:02:00 [INFO] Retrying database connection'
      ].join('\n');

      fs.readFile.mockResolvedValue(logContent);
      fs.stat.mockResolvedValue({ size: logContent.length });

      const logs = await logAggregator.readFileLog({
        path: '/app/logs/app.log',
        format: 'text',
        maxLines: 100
      });

      expect(logs).toHaveLength(3);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toBe('App started');
      expect(logs[0].raw).toBe('2024-01-01 10:00:00 [INFO] App started');
    });

    test('should limit number of lines read', async () => {
      const logLines = Array.from({ length: 100 }, (_, i) => 
        `{"timestamp":"2024-01-01T10:${i.toString().padStart(2, '0')}:00Z","level":"info","message":"Message ${i}"}`
      );
      const logContent = logLines.join('\n');

      fs.readFile.mockResolvedValue(logContent);
      fs.stat.mockResolvedValue({ size: logContent.length });

      const logs = await logAggregator.readFileLog({
        path: '/app/logs/app.log',
        format: 'json',
        maxLines: 50
      });

      expect(logs).toHaveLength(50);
      // Should return the last 50 lines
      expect(logs[0].message).toBe('Message 50');
      expect(logs[49].message).toBe('Message 99');
    });

    test('should handle file read errors', async () => {
      fs.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await logAggregator.readFileLog({
        path: '/app/logs/app.log',
        format: 'json'
      });

      expect(result).toEqual({
        error: 'Permission denied',
        logs: [],
        timestamp: expect.any(Date)
      });
    });

    test('should handle invalid JSON in log files', async () => {
      const logContent = [
        '{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"Valid JSON"}',
        'Invalid JSON line',
        '{"timestamp":"2024-01-01T10:02:00Z","level":"info","message":"Another valid JSON"}'
      ].join('\n');

      fs.readFile.mockResolvedValue(logContent);
      fs.stat.mockResolvedValue({ size: logContent.length });

      const logs = await logAggregator.readFileLog({
        path: '/app/logs/app.log',
        format: 'json',
        skipInvalidLines: true
      });

      expect(logs).toHaveLength(2);
      expect(logs[0].message).toBe('Valid JSON');
      expect(logs[1].message).toBe('Another valid JSON');
    });
  });

  describe('HTTP Log Collection', () => {
    test('should collect logs from HTTP endpoint', async () => {
      const mockLogs = [
        { timestamp: '2024-01-01T10:00:00Z', level: 'info', message: 'Request received' },
        { timestamp: '2024-01-01T10:01:00Z', level: 'error', message: 'Processing failed' }
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ logs: mockLogs })
      });

      const result = await logAggregator.collectHttpLogs({
        url: 'http://localhost:3000/logs',
        since: '2024-01-01T09:00:00Z'
      });

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.logs[0].message).toBe('Request received');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/logs?since=2024-01-01T09%3A00%3A00Z',
        expect.any(Object)
      );
    });

    test('should handle HTTP log collection failure', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await logAggregator.collectHttpLogs({
        url: 'http://localhost:3000/logs'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(result.logs).toEqual([]);
    });

    test('should handle invalid HTTP response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await logAggregator.collectHttpLogs({
        url: 'http://localhost:3000/logs'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });
  });

  describe('Custom Log Collection', () => {
    test('should execute custom log source', async () => {
      const customLogs = [
        { timestamp: new Date(), level: 'info', message: 'Custom log 1', source: 'database' },
        { timestamp: new Date(), level: 'warn', message: 'Custom log 2', source: 'cache' }
      ];

      const customSource = jest.fn().mockResolvedValue(customLogs);

      const result = await logAggregator.collectCustomLogs({
        name: 'database-logs',
        source: customSource,
        params: { since: '2024-01-01T00:00:00Z' }
      });

      expect(result.success).toBe(true);
      expect(result.logs).toHaveLength(2);
      expect(result.logs[0].source).toBe('database');
      expect(customSource).toHaveBeenCalledWith({ since: '2024-01-01T00:00:00Z' });
    });

    test('should handle custom source errors', async () => {
      const failingSource = jest.fn().mockRejectedValue(new Error('Database unavailable'));

      const result = await logAggregator.collectCustomLogs({
        name: 'database-logs',
        source: failingSource
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database unavailable');
      expect(result.logs).toEqual([]);
    });
  });

  describe('Log Collection Execution', () => {
    test('should collect logs from all sources for deployment', async () => {
      // Mock file source
      fs.readFile.mockResolvedValue('{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"File log"}');
      fs.stat.mockResolvedValue({ size: 100 });

      // Mock HTTP source
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ 
          logs: [{ timestamp: '2024-01-01T10:01:00Z', level: 'error', message: 'HTTP log' }] 
        })
      });

      // Mock custom source
      const customSource = jest.fn().mockResolvedValue([
        { timestamp: new Date(), level: 'warn', message: 'Custom log' }
      ]);

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json'
      });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/logs'
      });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'custom',
        name: 'database',
        source: customSource
      });

      const result = await logAggregator.collectLogs('deploy-123');

      expect(result.deploymentId).toBe('deploy-123');
      expect(result.collections).toHaveLength(3);

      const fileCollection = result.collections.find(c => c.type === 'file');
      const httpCollection = result.collections.find(c => c.type === 'http');
      const customCollection = result.collections.find(c => c.type === 'custom');

      expect(fileCollection.success).toBe(true);
      expect(fileCollection.logs).toHaveLength(1);
      
      expect(httpCollection.success).toBe(true);
      expect(httpCollection.logs).toHaveLength(1);
      
      expect(customCollection.success).toBe(true);
      expect(customCollection.logs).toHaveLength(1);
    });

    test('should handle deployment with no log sources', async () => {
      const result = await logAggregator.collectLogs('nonexistent-deployment');

      expect(result.deploymentId).toBe('nonexistent-deployment');
      expect(result.collections).toHaveLength(0);
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Log Filtering and Searching', () => {
    test('should filter logs by level', async () => {
      const logs = [
        { timestamp: new Date(), level: 'debug', message: 'Debug message' },
        { timestamp: new Date(), level: 'info', message: 'Info message' },
        { timestamp: new Date(), level: 'warn', message: 'Warning message' },
        { timestamp: new Date(), level: 'error', message: 'Error message' }
      ];

      logAggregator.addToHistory('deploy-123', {
        deploymentId: 'deploy-123',
        collections: [{ type: 'test', logs, success: true }],
        timestamp: new Date()
      });

      const errorLogs = logAggregator.searchLogs('deploy-123', {
        level: 'error'
      });

      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].level).toBe('error');
    });

    test('should filter logs by time range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const logs = [
        { timestamp: twoHoursAgo, level: 'info', message: 'Old message' },
        { timestamp: oneHourAgo, level: 'info', message: 'Recent message' },
        { timestamp: now, level: 'info', message: 'Latest message' }
      ];

      logAggregator.addToHistory('deploy-123', {
        deploymentId: 'deploy-123',
        collections: [{ type: 'test', logs, success: true }],
        timestamp: new Date()
      });

      const recentLogs = logAggregator.searchLogs('deploy-123', {
        since: oneHourAgo.toISOString()
      });

      expect(recentLogs).toHaveLength(2);
      expect(recentLogs[0].message).toBe('Latest message'); // Sorted newest first
      expect(recentLogs[1].message).toBe('Recent message');
    });

    test('should search logs by message content', async () => {
      const logs = [
        { timestamp: new Date(), level: 'info', message: 'User login successful' },
        { timestamp: new Date(), level: 'error', message: 'Database connection failed' },
        { timestamp: new Date(), level: 'info', message: 'User logout successful' }
      ];

      logAggregator.addToHistory('deploy-123', {
        deploymentId: 'deploy-123',
        collections: [{ type: 'test', logs, success: true }],
        timestamp: new Date()
      });

      const userLogs = logAggregator.searchLogs('deploy-123', {
        search: 'user'
      });

      expect(userLogs).toHaveLength(2);
      expect(userLogs[0].message).toContain('User login');
      expect(userLogs[1].message).toContain('User logout');
    });

    test('should combine multiple search criteria', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const logs = [
        { timestamp: oneHourAgo, level: 'error', message: 'Old error message' },
        { timestamp: now, level: 'error', message: 'Recent error message' },
        { timestamp: now, level: 'info', message: 'Recent info message' }
      ];

      logAggregator.addToHistory('deploy-123', {
        deploymentId: 'deploy-123',
        collections: [{ type: 'test', logs, success: true }],
        timestamp: new Date()
      });

      const filteredLogs = logAggregator.searchLogs('deploy-123', {
        level: 'error',
        since: oneHourAgo.toISOString(),
        search: 'recent'
      });

      expect(filteredLogs).toHaveLength(1);
      expect(filteredLogs[0].message).toBe('Recent error message');
    });
  });

  describe('Log Streaming and Real-time Updates', () => {
    test('should emit log events for real-time streaming', async () => {
      const onLogReceived = jest.fn();
      logAggregator.on('logs:collected', onLogReceived);

      fs.readFile.mockResolvedValue('{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"Test log"}');
      fs.stat.mockResolvedValue({ size: 100 });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json'
      });

      await logAggregator.collectLogs('deploy-123');

      expect(onLogReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          deploymentId: 'deploy-123',
          collections: expect.any(Array),
          timestamp: expect.any(Date)
        })
      );
    });

    test('should start log streaming for deployment', () => {
      jest.useFakeTimers();

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json',
        interval: 1000
      });

      logAggregator.startLogStreaming('deploy-123');

      expect(logAggregator.logStreams.has('deploy-123')).toBe(true);

      logAggregator.stopLogStreaming('deploy-123');
      expect(logAggregator.logStreams.has('deploy-123')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('Log History and Storage', () => {
    test('should store logs in history', async () => {
      fs.readFile.mockResolvedValue('{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"Test log"}');
      fs.stat.mockResolvedValue({ size: 100 });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json'
      });

      await logAggregator.collectLogs('deploy-123');
      await logAggregator.collectLogs('deploy-123');

      const history = logAggregator.getLogHistory('deploy-123');

      expect(history).toHaveLength(2);
      expect(history[0].deploymentId).toBe('deploy-123');
      expect(history[1].deploymentId).toBe('deploy-123');
    });

    test('should limit log history size', async () => {
      logAggregator.maxHistorySize = 3;

      fs.readFile.mockResolvedValue('{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"Test log"}');
      fs.stat.mockResolvedValue({ size: 100 });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json'
      });

      // Collect 5 times
      for (let i = 0; i < 5; i++) {
        await logAggregator.collectLogs('deploy-123');
      }

      const history = logAggregator.getLogHistory('deploy-123');
      expect(history).toHaveLength(3); // Limited to maxHistorySize
    });

    test('should get latest logs for deployment', async () => {
      fs.readFile.mockResolvedValue('{"timestamp":"2024-01-01T10:00:00Z","level":"info","message":"Latest log"}');
      fs.stat.mockResolvedValue({ size: 100 });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json'
      });

      await logAggregator.collectLogs('deploy-123');
      const latest = logAggregator.getLatestLogs('deploy-123');

      expect(latest).toBeDefined();
      expect(latest.deploymentId).toBe('deploy-123');
      expect(latest.collections[0].logs[0].message).toBe('Latest log');
    });
  });

  describe('Log Aggregation and Statistics', () => {
    test('should get log statistics', () => {
      const logs1 = Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(),
        level: 'info',
        message: `Log ${i}`
      }));

      const logs2 = Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(),
        level: 'error',
        message: `Error ${i}`
      }));

      logAggregator.addToHistory('deploy-123', {
        collections: [{ type: 'file', logs: logs1, success: true }],
        timestamp: new Date()
      });

      logAggregator.addToHistory('deploy-456', {
        collections: [{ type: 'file', logs: logs2, success: true }],
        timestamp: new Date()
      });

      const stats = logAggregator.getLogStatistics();

      expect(stats.totalDeployments).toBe(2);
      expect(stats.totalLogEntries).toBe(150);
      expect(stats.logLevels.info).toBe(100);
      expect(stats.logLevels.error).toBe(50);
    });

    test('should get log summary', () => {
      logAggregator.logHistory.set('deploy-123', [
        { timestamp: new Date(), collections: [{ logs: [{ level: 'info' }] }] },
        { timestamp: new Date(), collections: [{ logs: [{ level: 'error' }] }] }
      ]);

      const summary = logAggregator.getLogSummary();

      expect(summary.totalDeployments).toBe(1);
      expect(summary.deploymentsWithHistory).toBe(1);
      expect(summary.totalHistoryEntries).toBe(2);
      expect(summary.deploymentLogs['deploy-123']).toBeDefined();
    });
  });

  describe('Log Source Configuration', () => {
    test('should update log source configuration', () => {
      const initialConfig = {
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log',
        format: 'json'
      };

      logAggregator.addLogSource(initialConfig);

      const updatedConfig = {
        path: '/app/logs/app-updated.log',
        level: 'error',
        maxLines: 500
      };

      logAggregator.updateLogSource('deploy-123', 0, updatedConfig);

      const sources = logAggregator.getLogSources('deploy-123');
      expect(sources[0].path).toBe('/app/logs/app-updated.log');
      expect(sources[0].level).toBe('error');
      expect(sources[0].maxLines).toBe(500);
    });

    test('should remove log source', () => {
      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log'
      });

      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'http',
        url: 'http://localhost:3000/logs'
      });

      expect(logAggregator.getLogSources('deploy-123')).toHaveLength(2);

      logAggregator.removeLogSource('deploy-123', 0);

      expect(logAggregator.getLogSources('deploy-123')).toHaveLength(1);
      expect(logAggregator.getLogSources('deploy-123')[0].type).toBe('http');
    });

    test('should remove all log sources for deployment', () => {
      logAggregator.addLogSource({
        deploymentId: 'deploy-123',
        type: 'file',
        path: '/app/logs/app.log'
      });

      logAggregator.addLogSource({
        deploymentId: 'deploy-456',
        type: 'file',
        path: '/app/logs/other.log'
      });

      logAggregator.removeAllLogSources('deploy-123');

      expect(logAggregator.getLogSources('deploy-123')).toHaveLength(0);
      expect(logAggregator.getLogSources('deploy-456')).toHaveLength(1);
    });
  });
});