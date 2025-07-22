/**
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { DebugTools } from '../../../src/dev/DebugTools.js';

describe('Debug Tools', () => {
  let debugTools;
  
  beforeEach(() => {
    debugTools = new DebugTools();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should create debug tools with default configuration', () => {
      expect(debugTools).toBeDefined();
      expect(debugTools.config).toEqual(
        expect.objectContaining({
          enabled: false,
          logLevel: 'info',
          persistLogs: false
        })
      );
    });

    test('should accept custom configuration', () => {
      const customTools = new DebugTools({
        enabled: true,
        logLevel: 'debug',
        maxLogSize: 1000
      });
      
      expect(customTools.config.enabled).toBe(true);
      expect(customTools.config.logLevel).toBe('debug');
      expect(customTools.config.maxLogSize).toBe(1000);
    });
  });

  describe('Logging System', () => {
    test('should log messages with different levels', () => {
      const tools = new DebugTools({ enabled: true, logLevel: 'debug' });
      const logs = [];
      
      tools.onLog((log) => {
        logs.push(log);
      });
      
      tools.debug('Debug message');
      tools.info('Info message');
      tools.warn('Warning message');
      tools.error('Error message');
      
      expect(logs).toHaveLength(4);
      expect(logs[0]).toMatchObject({ level: 'debug', message: 'Debug message' });
      expect(logs[1]).toMatchObject({ level: 'info', message: 'Info message' });
      expect(logs[2]).toMatchObject({ level: 'warn', message: 'Warning message' });
      expect(logs[3]).toMatchObject({ level: 'error', message: 'Error message' });
    });

    test('should filter logs by level', () => {
      const tools = new DebugTools({ enabled: true, logLevel: 'warn' });
      const logs = [];
      
      tools.onLog((log) => {
        logs.push(log);
      });
      
      tools.debug('Debug message');
      tools.info('Info message');
      tools.warn('Warning message');
      tools.error('Error message');
      
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe('warn');
      expect(logs[1].level).toBe('error');
    });

    test('should not log when disabled', () => {
      const tools = new DebugTools({ enabled: false });
      const logs = [];
      
      tools.onLog((log) => {
        logs.push(log);
      });
      
      tools.debug('Debug message');
      tools.info('Info message');
      
      expect(logs).toHaveLength(0);
    });

    test('should include timestamp and context in logs', () => {
      const tools = new DebugTools({ enabled: true });
      const logs = [];
      
      tools.onLog((log) => {
        logs.push(log);
      });
      
      tools.info('Test message', { component: 'test' });
      
      expect(logs[0]).toMatchObject({
        level: 'info',
        message: 'Test message',
        timestamp: expect.any(String),
        context: { component: 'test' }
      });
    });
  });

  describe('Performance Monitoring', () => {
    test('should measure execution time', async () => {
      const tools = new DebugTools({ enabled: true });
      
      const timer = tools.startTimer('test-operation');
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = timer.end();
      
      expect(result.name).toBe('test-operation');
      expect(result.duration).toBeGreaterThan(45);
      expect(result.duration).toBeLessThan(100);
    });

    test('should track multiple timers', async () => {
      const tools = new DebugTools({ enabled: true });
      
      const timer1 = tools.startTimer('operation1');
      const timer2 = tools.startTimer('operation2');
      
      await new Promise(resolve => setTimeout(resolve, 25));
      const result1 = timer1.end();
      
      await new Promise(resolve => setTimeout(resolve, 25));
      const result2 = timer2.end();
      
      expect(result1.duration).toBeLessThan(result2.duration);
    });

    test('should get performance summary', async () => {
      const tools = new DebugTools({ enabled: true });
      
      const timer1 = tools.startTimer('fast-op');
      await new Promise(resolve => setTimeout(resolve, 10));
      timer1.end();
      
      const timer2 = tools.startTimer('slow-op');
      await new Promise(resolve => setTimeout(resolve, 50));
      timer2.end();
      
      const summary = tools.getPerformanceSummary();
      
      expect(summary.totalOperations).toBe(2);
      expect(summary.operations).toHaveLength(2);
      expect(summary.operations[0].name).toBe('fast-op');
      expect(summary.operations[1].name).toBe('slow-op');
    });
  });

  describe('Memory Monitoring', () => {
    test('should capture memory snapshots', () => {
      const tools = new DebugTools({ enabled: true });
      
      const snapshot = tools.captureMemorySnapshot();
      
      expect(snapshot).toEqual(
        expect.objectContaining({
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          external: expect.any(Number),
          timestamp: expect.any(String)
        })
      );
    });

    test('should track memory usage over time', () => {
      const tools = new DebugTools({ enabled: true });
      
      tools.startMemoryMonitoring(100); // 100ms interval
      
      expect(tools.isMonitoringMemory()).toBe(true);
      
      tools.stopMemoryMonitoring();
      
      expect(tools.isMonitoringMemory()).toBe(false);
    });

    test('should get memory statistics', () => {
      const tools = new DebugTools({ enabled: true });
      
      // Add some mock memory data
      tools.memoryHistory = [
        { heapUsed: 1000, timestamp: '2024-01-01T10:00:00Z' },
        { heapUsed: 1500, timestamp: '2024-01-01T10:01:00Z' },
        { heapUsed: 1200, timestamp: '2024-01-01T10:02:00Z' }
      ];
      
      const stats = tools.getMemoryStatistics();
      
      expect(stats).toEqual(
        expect.objectContaining({
          current: expect.any(Object),
          min: 1000,
          max: 1500,
          average: 1233.33,
          samples: 3
        })
      );
    });
  });

  describe('Extension Debugging', () => {
    test('should capture extension state', () => {
      const tools = new DebugTools({ enabled: true });
      
      const state = tools.captureExtensionState();
      
      expect(state).toEqual(
        expect.objectContaining({
          manifest: expect.any(Object),
          permissions: expect.any(Array),
          background: expect.any(Object),
          contentScripts: expect.any(Array),
          timestamp: expect.any(String)
        })
      );
    });

    test('should monitor Chrome API calls', () => {
      const tools = new DebugTools({ enabled: true });
      const apiCalls = [];
      
      tools.onApiCall((call) => {
        apiCalls.push(call);
      });
      
      tools.logApiCall('chrome.tabs.query', { active: true }, { result: 'success' });
      tools.logApiCall('chrome.storage.local.get', { key: 'data' }, { error: 'not found' });
      
      expect(apiCalls).toHaveLength(2);
      expect(apiCalls[0]).toMatchObject({
        api: 'chrome.tabs.query',
        params: { active: true },
        result: { result: 'success' }
      });
      expect(apiCalls[1]).toMatchObject({
        api: 'chrome.storage.local.get',
        params: { key: 'data' },
        result: { error: 'not found' }
      });
    });

    test('should generate debugging report', () => {
      const tools = new DebugTools({ enabled: true });
      
      // Add some test data
      tools.info('Test info message');
      tools.error('Test error message');
      
      const timer = tools.startTimer('test-op');
      timer.end();
      
      tools.captureMemorySnapshot();
      
      const report = tools.generateReport();
      
      expect(report).toEqual(
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({ level: 'info', message: 'Test info message' }),
            expect.objectContaining({ level: 'error', message: 'Test error message' })
          ]),
          performance: expect.objectContaining({
            totalOperations: 1
          }),
          memory: expect.objectContaining({
            samples: 1
          }),
          extension: expect.any(Object),
          apiCalls: expect.any(Array),
          generatedAt: expect.any(String)
        })
      );
    });
  });

  describe('Error Tracking', () => {
    test('should capture and track errors', () => {
      const tools = new DebugTools({ enabled: true });
      const errors = [];
      
      tools.onError((error) => {
        errors.push(error);
      });
      
      const error1 = new Error('Test error 1');
      const error2 = new Error('Test error 2');
      
      tools.captureError(error1, { component: 'background' });
      tools.captureError(error2, { component: 'content' });
      
      expect(errors).toHaveLength(2);
      expect(errors[0]).toMatchObject({
        message: 'Test error 1',
        stack: expect.any(String),
        context: { component: 'background' }
      });
    });

    test('should get error statistics', () => {
      const tools = new DebugTools({ enabled: true });
      
      // Add some mock errors
      tools.errors = [
        { message: 'Error 1', timestamp: '2024-01-01T10:00:00Z', context: { component: 'bg' } },
        { message: 'Error 2', timestamp: '2024-01-01T10:01:00Z', context: { component: 'content' } },
        { message: 'Error 3', timestamp: '2024-01-01T10:02:00Z', context: { component: 'bg' } }
      ];
      
      const stats = tools.getErrorStatistics();
      
      expect(stats).toEqual(
        expect.objectContaining({
          total: 3,
          byComponent: {
            bg: 2,
            content: 1
          },
          recent: expect.any(Array)
        })
      );
    });
  });

  describe('Log Management', () => {
    test('should limit log size', () => {
      const tools = new DebugTools({ 
        enabled: true, 
        maxLogs: 3 
      });
      
      tools.info('Log 1');
      tools.info('Log 2');
      tools.info('Log 3');
      tools.info('Log 4');
      tools.info('Log 5');
      
      expect(tools.logs).toHaveLength(3);
      expect(tools.logs[0].message).toBe('Log 3');
      expect(tools.logs[2].message).toBe('Log 5');
    });

    test('should clear logs', () => {
      const tools = new DebugTools({ enabled: true });
      
      tools.info('Test log 1');
      tools.info('Test log 2');
      
      expect(tools.logs).toHaveLength(2);
      
      tools.clearLogs();
      
      expect(tools.logs).toHaveLength(0);
    });

    test('should export logs to different formats', () => {
      const tools = new DebugTools({ enabled: true });
      
      tools.info('Test message 1');
      tools.warn('Test message 2');
      
      const jsonExport = tools.exportLogs('json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();
      
      const textExport = tools.exportLogs('text');
      expect(textExport).toContain('Test message 1');
      expect(textExport).toContain('Test message 2');
      
      const csvExport = tools.exportLogs('csv');
      expect(csvExport).toContain('timestamp,level,message');
    });
  });

  describe('Configuration', () => {
    test('should enable/disable debugging', () => {
      const tools = new DebugTools({ enabled: false });
      
      expect(tools.isEnabled()).toBe(false);
      
      tools.enable();
      expect(tools.isEnabled()).toBe(true);
      
      tools.disable();
      expect(tools.isEnabled()).toBe(false);
    });

    test('should change log level', () => {
      const tools = new DebugTools({ enabled: true, logLevel: 'info' });
      const logs = [];
      
      tools.onLog((log) => logs.push(log));
      
      tools.debug('Debug message');
      expect(logs).toHaveLength(0);
      
      tools.setLogLevel('debug');
      tools.debug('Debug message');
      expect(logs).toHaveLength(1);
    });

    test('should validate log level', () => {
      const tools = new DebugTools({ enabled: true });
      
      expect(() => {
        tools.setLogLevel('invalid');
      }).toThrow('Invalid log level: invalid');
      
      expect(() => {
        tools.setLogLevel('debug');
      }).not.toThrow();
    });
  });
});