/**
 * ExecutionConsole Integration Tests
 * Tests console log streaming and command execution with live execution data
 */

import { jest } from '@jest/globals';
import { ExecutionConsole } from '../../src/components/tool-registry/components/panels/ExecutionConsole.js';

describe('ExecutionConsole Integration Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '1000px';
    dom.style.height = '700px';
    document.body.appendChild(dom);

    // Create mock umbilical with console event handlers
    mockUmbilical = {
      dom,
      onMount: jest.fn(),
      onLogUpdate: jest.fn(),
      onConsoleCommand: jest.fn(),
      onDestroy: jest.fn()
    };

    // Initialize component
    component = await ExecutionConsole.create(mockUmbilical);
  });

  afterEach(() => {
    if (component && component.destroy) {
      component.destroy();
    }
    if (dom.parentNode) {
      dom.parentNode.removeChild(dom);
    }
  });

  describe('Real-time Log Streaming', () => {
    test('should handle live log streaming during execution', () => {
      const executionContext = {
        executionId: 'live-stream-123',
        taskId: 'streaming-task',
        planId: 'plan-456'
      };

      // Set execution context
      const setContextResult = component.api.setExecutionContext(executionContext);
      expect(setContextResult.success).toBe(true);

      // Simulate real-time log streaming
      const logStream = [
        {
          level: 'info',
          message: 'Execution started',
          source: 'execution-engine',
          timestamp: new Date().toISOString()
        },
        {
          level: 'debug',
          message: 'Loading task configuration',
          source: 'task-loader',
          data: { taskId: 'streaming-task', config: { timeout: 30000 } }
        },
        {
          level: 'info',
          message: 'Task processing initiated',
          source: 'task-processor'
        },
        {
          level: 'warn',
          message: 'High memory usage detected',
          source: 'monitoring',
          data: { memoryUsage: '85%', threshold: '80%' }
        },
        {
          level: 'error',
          message: 'Network timeout occurred',
          source: 'network-client',
          data: { url: 'https://api.example.com', timeout: 5000 }
        },
        {
          level: 'info',
          message: 'Retrying with exponential backoff',
          source: 'retry-handler'
        },
        {
          level: 'info',
          message: 'Task completed successfully',
          source: 'task-processor'
        }
      ];

      // Stream logs one by one with timing
      logStream.forEach((log, index) => {
        const addResult = component.api.addLogEntry(log);
        expect(addResult.success).toBe(true);
        
        // Verify log has context
        const logs = component.api.getLogs();
        const addedLog = logs[logs.length - 1];
        expect(addedLog.context.executionId).toBe('live-stream-123');
        expect(addedLog.context.taskId).toBe('streaming-task');
      });

      // Verify streaming statistics
      const stats = component.api.getExecutionStatistics();
      expect(stats.totalLogs).toBe(7);
      expect(stats.errorCount).toBe(1);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(4);
      expect(stats.debugCount).toBe(1);

      // Verify umbilical callbacks were triggered
      expect(mockUmbilical.onLogUpdate).toHaveBeenCalledTimes(7);
    });

    test('should handle high-volume log streaming efficiently', () => {
      const startTime = Date.now();
      const logCount = 500;

      // Generate high volume of logs
      for (let i = 0; i < logCount; i++) {
        const logEntry = {
          level: i % 4 === 0 ? 'debug' : i % 4 === 1 ? 'info' : i % 4 === 2 ? 'warn' : 'error',
          message: `High volume log entry ${i}`,
          source: `source-${i % 10}`,
          data: { 
            iteration: i, 
            batch: Math.floor(i / 100),
            processingTime: Math.random() * 1000
          }
        };

        const result = component.api.addLogEntry(logEntry);
        expect(result.success).toBe(true);
      }

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(15000); // Should process 500 logs in under 15 seconds

      // Verify log management and limits
      const logs = component.api.getLogs();
      expect(logs.length).toBeLessThanOrEqual(component.api.getMaxLogEntries());

      // Verify statistics are correctly maintained
      const stats = component.api.getExecutionStatistics();
      expect(stats.totalLogs).toBeGreaterThan(0);
    });

    test('should track logs across multiple execution contexts', () => {
      const contexts = [
        { executionId: 'exec-1', taskId: 'task-1', planId: 'plan-A' },
        { executionId: 'exec-1', taskId: 'task-2', planId: 'plan-A' },
        { executionId: 'exec-2', taskId: 'task-1', planId: 'plan-B' }
      ];

      contexts.forEach((context, contextIndex) => {
        component.api.setExecutionContext(context);

        // Add logs for each context
        for (let i = 0; i < 3; i++) {
          component.api.addLogEntry({
            level: 'info',
            message: `Context ${contextIndex} log ${i}`,
            source: `context-${contextIndex}`
          });
        }
      });

      // Verify context-based filtering
      const exec1Logs = component.api.getLogsByContext('exec-1');
      expect(exec1Logs.success).toBe(true);
      expect(exec1Logs.data).toHaveLength(6); // 3 logs from task-1 + 3 from task-2

      const exec1Task1Logs = component.api.getLogsByContext('exec-1', 'task-1');
      expect(exec1Task1Logs.success).toBe(true);
      expect(exec1Task1Logs.data).toHaveLength(3);

      const exec2Logs = component.api.getLogsByContext('exec-2');
      expect(exec2Logs.success).toBe(true);
      expect(exec2Logs.data).toHaveLength(3);
    });
  });

  describe('Advanced Filtering and Search', () => {
    test('should support complex log filtering scenarios', () => {
      const complexLogs = [
        {
          level: 'debug',
          message: 'Database connection pool initialized',
          source: 'database',
          data: { poolSize: 10, maxConnections: 50 }
        },
        {
          level: 'info',
          message: 'User authentication successful',
          source: 'auth-service',
          data: { userId: 'user123', role: 'admin' }
        },
        {
          level: 'warn',
          message: 'Database connection pool near capacity',
          source: 'database',
          data: { activeConnections: 45, maxConnections: 50 }
        },
        {
          level: 'error',
          message: 'Failed to authenticate user credentials',
          source: 'auth-service',
          data: { userId: 'user456', reason: 'invalid_password' }
        },
        {
          level: 'info',
          message: 'Database query executed successfully',
          source: 'database',
          data: { query: 'SELECT * FROM users', executionTime: 23 }
        }
      ];

      complexLogs.forEach(log => component.api.addLogEntry(log));

      // Test level filtering
      component.api.setLogLevel('warn');
      let filteredLogs = component.api.getFilteredLogs();
      expect(filteredLogs).toHaveLength(2); // warn and error

      component.api.setLogLevel('debug');
      filteredLogs = component.api.getFilteredLogs();
      expect(filteredLogs).toHaveLength(5); // all logs

      // Test search functionality
      const searchResult = component.api.searchLogs('database');
      expect(searchResult.success).toBe(true);
      expect(searchResult.data).toHaveLength(3); // 3 database-related logs

      const authSearchResult = component.api.searchLogs('auth');
      expect(authSearchResult.success).toBe(true);
      expect(authSearchResult.data).toHaveLength(2); // 2 auth-related logs

      // Test search in data
      const poolSearchResult = component.api.searchLogs('pool');
      expect(poolSearchResult.success).toBe(true);
      expect(poolSearchResult.data).toHaveLength(2); // logs containing 'pool' in data
    });

    test('should handle case-insensitive search', () => {
      const searchLogs = [
        { level: 'info', message: 'USER LOGIN SUCCESS', source: 'auth' },
        { level: 'info', message: 'user logout complete', source: 'auth' },
        { level: 'info', message: 'User Profile Updated', source: 'profile' }
      ];

      searchLogs.forEach(log => component.api.addLogEntry(log));

      // Test case-insensitive search
      const upperResult = component.api.searchLogs('USER');
      expect(upperResult.success).toBe(true);
      expect(upperResult.data).toHaveLength(3);

      const lowerResult = component.api.searchLogs('user');
      expect(lowerResult.success).toBe(true);
      expect(lowerResult.data).toHaveLength(3);

      const mixedResult = component.api.searchLogs('User');
      expect(mixedResult.success).toBe(true);
      expect(mixedResult.data).toHaveLength(3);
    });

    test('should combine filtering and searching effectively', () => {
      const combinedLogs = [
        { level: 'debug', message: 'Debug: Processing user request', source: 'api' },
        { level: 'info', message: 'Info: User request completed', source: 'api' },
        { level: 'warn', message: 'Warning: User session timeout', source: 'session' },
        { level: 'error', message: 'Error: User authentication failed', source: 'auth' },
        { level: 'debug', message: 'Debug: System health check', source: 'health' },
        { level: 'info', message: 'Info: System backup completed', source: 'backup' }
      ];

      combinedLogs.forEach(log => component.api.addLogEntry(log));

      // Set level filter to warn and above
      component.api.setLogLevel('warn');
      
      // Search for 'user'
      component.api.setSearchQuery('user');
      
      const filteredAndSearched = component.api.getFilteredLogs();
      expect(filteredAndSearched).toHaveLength(2); // warn and error logs containing 'user'
    });
  });

  describe('Command Execution Integration', () => {
    test('should execute built-in console commands', () => {
      // Add some logs first
      const testLogs = [
        { level: 'info', message: 'Test log 1' },
        { level: 'warn', message: 'Test warning' },
        { level: 'error', message: 'Test error' }
      ];

      testLogs.forEach(log => component.api.addLogEntry(log));
      expect(component.api.getLogs()).toHaveLength(3);

      // Test clear command
      const clearResult = component.api.executeCommand('clear');
      expect(clearResult.success).toBe(true);
      expect(component.api.getLogs()).toHaveLength(0);

      // Add logs again for other commands
      testLogs.forEach(log => component.api.addLogEntry(log));

      // Test level command
      const levelResult = component.api.executeCommand('level error');
      expect(levelResult.success).toBe(true);
      expect(component.api.getLogLevel()).toBe('error');

      // Test search command
      const searchResult = component.api.executeCommand('search warning');
      expect(searchResult.success).toBe(true);
      expect(component.api.getSearchQuery()).toBe('warning');

      // Verify command callbacks (export doesn't trigger console command callback)
      expect(mockUmbilical.onConsoleCommand).toHaveBeenCalledTimes(3);
    });

    test('should handle custom commands and logging', () => {
      const customCommands = [
        'restart-service api',
        'deploy-to staging',
        'scale-up database 3',
        'backup-data --force'
      ];

      customCommands.forEach(command => {
        const result = component.api.executeCommand(command);
        expect(result.success).toBe(true);
        expect(result.data.command).toBe(command);
      });

      // Verify commands were logged
      const logs = component.api.getLogs();
      const commandLogs = logs.filter(log => log.message.includes('Executed command'));
      expect(commandLogs).toHaveLength(4);

      // Verify umbilical callbacks
      expect(mockUmbilical.onConsoleCommand).toHaveBeenCalledTimes(4);
    });
  });

  describe('Export and Import Operations', () => {
    test('should export comprehensive log data', () => {
      const exportLogs = [
        {
          level: 'info',
          message: 'Export test log 1',
          source: 'export-test',
          data: { key: 'value1' }
        },
        {
          level: 'error',
          message: 'Export test error',
          source: 'export-test',
          data: { error: 'test_error', code: 500 }
        }
      ];

      // Set execution context
      component.api.setExecutionContext({
        executionId: 'export-exec-123',
        taskId: 'export-task',
        planId: 'export-plan'
      });

      exportLogs.forEach(log => component.api.addLogEntry(log));

      // Mock export functionality
      global.URL = {
        createObjectURL: jest.fn(() => 'mock-export-url'),
        revokeObjectURL: jest.fn()
      };

      const mockLink = {
        click: jest.fn(),
        download: '',
        href: ''
      };

      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return document.createElement(tagName);
      });

      const exportResult = component.api.exportLogs();
      expect(exportResult.success).toBe(true);
      expect(exportResult.data.exported).toBe(2);
      expect(mockLink.click).toHaveBeenCalled();
      expect(global.URL.createObjectURL).toHaveBeenCalled();

      // Cleanup
      document.createElement.mockRestore();
    });
  });

  describe('Performance and Memory Management', () => {
    test('should handle memory management with log rotation', () => {
      // Set a small max log limit
      component.api.setMaxLogEntries(100);
      expect(component.api.getMaxLogEntries()).toBe(100);

      // Add 150 logs
      for (let i = 0; i < 150; i++) {
        component.api.addLogEntry({
          level: 'info',
          message: `Memory test log ${i}`,
          source: 'memory-test',
          data: { iteration: i, timestamp: Date.now() }
        });
      }

      // Should only keep the most recent 100 logs
      const logs = component.api.getLogs();
      expect(logs).toHaveLength(100);
      expect(logs[0].message).toBe('Memory test log 50'); // Should start from log 50
      expect(logs[99].message).toBe('Memory test log 149'); // Should end with log 149

      // Verify statistics are still accurate
      const stats = component.api.getExecutionStatistics();
      expect(stats.totalLogs).toBe(100);
    });

    test('should maintain performance with concurrent operations', () => {
      const startTime = Date.now();
      
      // Simulate concurrent operations
      const operations = [];

      // Add logs concurrently
      for (let i = 0; i < 50; i++) {
        operations.push(() => {
          component.api.addLogEntry({
            level: 'info',
            message: `Concurrent log ${i}`,
            source: 'concurrent-test'
          });
        });
      }

      // Filter operations
      operations.push(() => {
        component.api.setLogLevel('debug');
        component.api.getFilteredLogs();
      });

      // Search operations
      operations.push(() => {
        component.api.searchLogs('concurrent');
      });

      // Execute all operations
      operations.forEach(op => op());

      const operationTime = Date.now() - startTime;
      expect(operationTime).toBeLessThan(1000); // Should complete in under 1 second

      // Verify final state
      const logs = component.api.getLogs();
      expect(logs).toHaveLength(50);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle invalid log entries gracefully', () => {
      const invalidLogs = [
        { message: 'Missing level' }, // No level
        { level: 'info' }, // No message
        { level: 'invalid', message: 'Invalid level' }, // Invalid level
        null, // Null entry
        undefined // Undefined entry
      ];

      invalidLogs.forEach((log, index) => {
        const result = component.api.addLogEntry(log);
        expect(result.success).toBe(false);
        if (index === 2) {
          expect(result.error).toContain('Invalid log level');
        } else {
          expect(result.error).toContain('Invalid log entry');
        }
      });

      // Verify no invalid logs were added
      expect(component.api.getLogs()).toHaveLength(0);
    });

    test('should recover from component reset', () => {
      // Add logs and set configuration
      component.api.addLogEntry({ level: 'info', message: 'Pre-reset log 1' });
      component.api.addLogEntry({ level: 'warn', message: 'Pre-reset log 2' });
      component.api.setLogLevel('debug');
      component.api.setSearchQuery('pre-reset');
      component.api.setAutoScroll(false);

      expect(component.api.getLogs()).toHaveLength(2);

      // Reset component
      const resetResult = component.api.reset();
      expect(resetResult.success).toBe(true);

      // Verify reset state
      expect(component.api.getLogs()).toHaveLength(0);
      expect(component.api.getLogLevel()).toBe('info');
      expect(component.api.getSearchQuery()).toBe('');
      expect(component.api.getAutoScroll()).toBe(true);

      // Verify component can continue operating
      const newLogResult = component.api.addLogEntry({ 
        level: 'info', 
        message: 'Post-reset log' 
      });
      expect(newLogResult.success).toBe(true);
      expect(component.api.getLogs()).toHaveLength(1);
    });

    test('should handle configuration validation', () => {
      // Test invalid max log entries
      const invalidMaxResult = component.api.setMaxLogEntries(-1);
      expect(invalidMaxResult.success).toBe(false);
      expect(invalidMaxResult.error).toContain('between 1 and 10000');

      const tooLargeMaxResult = component.api.setMaxLogEntries(20000);
      expect(tooLargeMaxResult.success).toBe(false);
      expect(tooLargeMaxResult.error).toContain('between 1 and 10000');

      // Test invalid log level
      const invalidLevelResult = component.api.setLogLevel('invalid');
      expect(invalidLevelResult.success).toBe(false);
      expect(invalidLevelResult.error).toContain('Invalid log level');
    });
  });

  describe('Real-time UI Updates', () => {
    test('should update UI in real-time during log streaming', () => {
      // Set execution context
      component.api.setExecutionContext({
        executionId: 'ui-update-test',
        taskId: 'ui-task'
      });
      
      // Set log level to debug to show all logs
      component.api.setLogLevel('debug');

      const streamLogs = [
        { level: 'info', message: 'UI Test: Task started' },
        { level: 'debug', message: 'UI Test: Loading resources' },
        { level: 'warn', message: 'UI Test: High CPU usage' },
        { level: 'error', message: 'UI Test: Connection failed' },
        { level: 'info', message: 'UI Test: Retrying connection' },
        { level: 'info', message: 'UI Test: Task completed' }
      ];

      // Stream logs  
      streamLogs.forEach(log => {
        component.api.addLogEntry(log);
      });
      
      // Manually trigger view update since we're not using real event loop
      const filteredLogs = component.api.getFilteredLogs();
      component.view.updateLogDisplay(filteredLogs);
      
      // Check that all log entries are displayed
      const logEntries = component.view.container.querySelectorAll('.log-entry');
      expect(logEntries).toHaveLength(streamLogs.length);
      
      // Check that entries have correct styling and content
      streamLogs.forEach((log, index) => {
        const entry = logEntries[index];
        expect(entry.classList.contains(`log-level-${log.level}`)).toBe(true);
        expect(entry.textContent).toContain(log.message);
      });

      // Verify statistics are updated
      const statsElements = {
        total: component.view.container.querySelector('.total-logs'),
        errors: component.view.container.querySelector('.error-count'),
        warnings: component.view.container.querySelector('.warning-count')
      };

      expect(statsElements.total.textContent).toBe('6');
      expect(statsElements.errors.textContent).toBe('1');
      expect(statsElements.warnings.textContent).toBe('1');
    });
  });

  describe('Callback Integration', () => {
    test('should trigger umbilical callbacks for all log operations', () => {
      const testLog = {
        level: 'info',
        message: 'Callback test log',
        source: 'callback-test'
      };

      // Test add callback
      component.api.addLogEntry(testLog);
      expect(mockUmbilical.onLogUpdate).toHaveBeenCalledWith({
        action: 'add',
        logEntry: expect.objectContaining({ message: 'Callback test log' })
      });

      // Test clear callback
      component.api.clearLogs();
      expect(mockUmbilical.onLogUpdate).toHaveBeenCalledWith({
        action: 'clear'
      });

      // Test command callback
      component.api.executeCommand('test-command');
      expect(mockUmbilical.onConsoleCommand).toHaveBeenCalledWith({
        command: 'test-command',
        timestamp: expect.any(String)
      });
    });
  });
});