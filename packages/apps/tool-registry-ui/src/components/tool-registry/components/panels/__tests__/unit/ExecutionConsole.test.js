/**
 * ExecutionConsole Unit Tests
 * Tests execution console display and log management functionality
 */

import { jest } from '@jest/globals';
import { ExecutionConsole } from '../../ExecutionConsole.js';

describe('ExecutionConsole Unit Tests', () => {
  let component;
  let mockUmbilical;
  let dom;

  beforeEach(async () => {
    // Create DOM container
    dom = document.createElement('div');
    dom.style.width = '800px';
    dom.style.height = '600px';
    document.body.appendChild(dom);

    // Create mock umbilical
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

  describe('Model Tests', () => {
    test('should initialize with empty console state', () => {
      expect(component.model.getState('logs')).toEqual([]);
      expect(component.model.getState('maxLogEntries')).toBe(1000);
      expect(component.model.getState('autoScroll')).toBe(true);
      expect(component.model.getState('logLevel')).toBe('info');
      expect(component.model.getState('isConsoleEnabled')).toBe(true);
    });

    test('should add log entries with proper formatting', () => {
      const logEntry = {
        level: 'info',
        message: 'Test log message',
        timestamp: new Date().toISOString(),
        source: 'test',
        data: { key: 'value' }
      };

      component.model.addLogEntry(logEntry);
      
      const logs = component.model.getState('logs');
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(expect.objectContaining(logEntry));
      expect(logs[0].id).toBeDefined();
    });

    test('should enforce maximum log entry limit', () => {
      component.model.updateState('maxLogEntries', 5);

      // Add 10 log entries
      for (let i = 0; i < 10; i++) {
        component.model.addLogEntry({
          level: 'info',
          message: `Log entry ${i}`,
          timestamp: new Date().toISOString()
        });
      }

      const logs = component.model.getState('logs');
      expect(logs).toHaveLength(5);
      expect(logs[0].message).toBe('Log entry 5'); // Should keep the most recent 5
      expect(logs[4].message).toBe('Log entry 9');
    });

    test('should filter logs by level', () => {
      const logs = [
        { level: 'debug', message: 'Debug message' },
        { level: 'info', message: 'Info message' },
        { level: 'warn', message: 'Warning message' },
        { level: 'error', message: 'Error message' }
      ];

      logs.forEach(log => component.model.addLogEntry(log));

      component.model.setLogLevel('warn');
      const filteredLogs = component.model.getFilteredLogs();
      
      expect(filteredLogs).toHaveLength(2); // warn and error
      expect(filteredLogs[0].level).toBe('warn');
      expect(filteredLogs[1].level).toBe('error');
    });

    test('should search logs by content', () => {
      const logs = [
        { level: 'info', message: 'Processing user data' },
        { level: 'info', message: 'Database connection established' },
        { level: 'error', message: 'User authentication failed' }
      ];

      logs.forEach(log => component.model.addLogEntry(log));

      component.model.setSearchQuery('user');
      const searchResults = component.model.getFilteredLogs();
      
      expect(searchResults).toHaveLength(2);
      expect(searchResults[0].message).toContain('user');
      expect(searchResults[1].message).toContain('User');
    });

    test('should maintain execution context', () => {
      const context = {
        executionId: 'exec-123',
        taskId: 'task-456',
        planId: 'plan-789'
      };

      component.model.setExecutionContext(context);
      expect(component.model.getState('executionContext')).toEqual(context);

      // Add log with context
      component.model.addLogEntry({
        level: 'info',
        message: 'Task started',
        context: context
      });

      const contextLogs = component.model.getLogsByContext('exec-123');
      expect(contextLogs).toHaveLength(1);
      expect(contextLogs[0].context.executionId).toBe('exec-123');
    });
  });

  describe('View Tests', () => {
    test('should render console interface', () => {
      const consolePanel = component.view.container.querySelector('.execution-console-panel');
      expect(consolePanel).toBeTruthy();

      const logDisplay = component.view.container.querySelector('.console-log-display');
      expect(logDisplay).toBeTruthy();

      const controls = component.view.container.querySelector('.console-controls');
      expect(controls).toBeTruthy();

      const commandInput = component.view.container.querySelector('.console-command-input');
      expect(commandInput).toBeTruthy();
    });

    test('should display log entries with proper formatting', () => {
      const logs = [
        {
          id: 'log-1',
          level: 'info',
          message: 'Information message',
          timestamp: '2023-08-17T10:00:00.000Z',
          source: 'system'
        },
        {
          id: 'log-2',
          level: 'error',
          message: 'Error occurred',
          timestamp: '2023-08-17T10:01:00.000Z',
          source: 'task'
        }
      ];

      component.view.updateLogDisplay(logs);

      const logEntries = component.view.container.querySelectorAll('.log-entry');
      expect(logEntries).toHaveLength(2);

      expect(logEntries[0].classList.contains('log-level-info')).toBe(true);
      expect(logEntries[0].textContent).toContain('Information message');

      expect(logEntries[1].classList.contains('log-level-error')).toBe(true);
      expect(logEntries[1].textContent).toContain('Error occurred');
    });

    test('should handle different log levels with appropriate styling', () => {
      const logs = [
        { id: '1', level: 'debug', message: 'Debug info' },
        { id: '2', level: 'info', message: 'General info' },
        { id: '3', level: 'warn', message: 'Warning message' },
        { id: '4', level: 'error', message: 'Error message' }
      ];

      component.view.updateLogDisplay(logs);

      const debugEntry = component.view.container.querySelector('.log-level-debug');
      const infoEntry = component.view.container.querySelector('.log-level-info');
      const warnEntry = component.view.container.querySelector('.log-level-warn');
      const errorEntry = component.view.container.querySelector('.log-level-error');

      expect(debugEntry).toBeTruthy();
      expect(infoEntry).toBeTruthy();
      expect(warnEntry).toBeTruthy();
      expect(errorEntry).toBeTruthy();
    });

    test('should auto-scroll to bottom when enabled', () => {
      // Mock scrollIntoView
      const mockScrollIntoView = jest.fn();
      Element.prototype.scrollIntoView = mockScrollIntoView;

      component.model.updateState('autoScroll', true);
      
      const logs = [
        { id: '1', level: 'info', message: 'First message' },
        { id: '2', level: 'info', message: 'Second message' }
      ];

      component.view.updateLogDisplay(logs);

      // Should scroll to the last entry
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    test('should handle empty log state', () => {
      component.view.updateLogDisplay([]);

      const emptyState = component.view.container.querySelector('.console-empty-state');
      expect(emptyState).toBeTruthy();
      expect(emptyState.style.display).not.toBe('none');

      const logEntries = component.view.container.querySelectorAll('.log-entry');
      expect(logEntries).toHaveLength(0);
    });

    test('should update statistics display', () => {
      const stats = {
        totalLogs: 150,
        errorCount: 5,
        warningCount: 12,
        sessionDuration: 300000 // 5 minutes
      };

      component.view.updateStatsDisplay(stats);

      const statsPanel = component.view.container.querySelector('.console-stats');
      expect(statsPanel.textContent).toContain('150');
      expect(statsPanel.textContent).toContain('5');
      expect(statsPanel.textContent).toContain('12');
    });
  });

  describe('ViewModel Tests', () => {
    test('should add log entries through API', () => {
      const logEntry = {
        level: 'info',
        message: 'API test message',
        source: 'api-test'
      };

      const result = component.api.addLogEntry(logEntry);
      expect(result.success).toBe(true);

      const logs = component.api.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('API test message');
    });

    test('should clear logs', () => {
      // Add some logs first
      component.api.addLogEntry({ level: 'info', message: 'Test 1' });
      component.api.addLogEntry({ level: 'info', message: 'Test 2' });
      
      expect(component.api.getLogs()).toHaveLength(2);

      const clearResult = component.api.clearLogs();
      expect(clearResult.success).toBe(true);
      expect(component.api.getLogs()).toHaveLength(0);
    });

    test('should execute console commands', () => {
      const command = 'clear';
      const executeResult = component.api.executeCommand(command);
      
      expect(executeResult.success).toBe(true);
      expect(mockUmbilical.onConsoleCommand).toHaveBeenCalledWith({
        command,
        timestamp: expect.any(String)
      });
    });

    test('should filter logs by level', () => {
      const logs = [
        { level: 'debug', message: 'Debug' },
        { level: 'info', message: 'Info' },
        { level: 'warn', message: 'Warning' },
        { level: 'error', message: 'Error' }
      ];

      logs.forEach(log => component.api.addLogEntry(log));

      component.api.setLogLevel('warn');
      const filteredLogs = component.api.getFilteredLogs();
      
      expect(filteredLogs).toHaveLength(2); // warn and error
    });

    test('should search logs', () => {
      const logs = [
        { level: 'info', message: 'User login successful' },
        { level: 'info', message: 'Data processing complete' },
        { level: 'error', message: 'User authentication failed' }
      ];

      logs.forEach(log => component.api.addLogEntry(log));

      const searchResult = component.api.searchLogs('user');
      expect(searchResult.success).toBe(true);
      expect(searchResult.data).toHaveLength(2);
    });

    test('should export logs', () => {
      const logs = [
        { level: 'info', message: 'Export test 1' },
        { level: 'error', message: 'Export test 2' }
      ];

      logs.forEach(log => component.api.addLogEntry(log));

      // Mock export functionality
      global.URL = { createObjectURL: jest.fn(() => 'mock-url'), revokeObjectURL: jest.fn() };
      const mockLink = { click: jest.fn(), download: '', href: '' };
      jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') return mockLink;
        return document.createElement(tagName);
      });

      const exportResult = component.api.exportLogs();
      expect(exportResult.success).toBe(true);
      expect(mockLink.click).toHaveBeenCalled();

      // Cleanup
      document.createElement.mockRestore();
    });

    test('should validate log entries', () => {
      const validLog = {
        level: 'info',
        message: 'Valid log entry'
      };

      const invalidLog = {
        level: 'invalid',
        message: ''
      };

      const validResult = component.api.addLogEntry(validLog);
      expect(validResult.success).toBe(true);

      const invalidResult = component.api.addLogEntry(invalidLog);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toContain('Invalid log entry');
    });

    test('should manage console settings', () => {
      // Test auto-scroll setting
      component.api.setAutoScroll(false);
      expect(component.api.getAutoScroll()).toBe(false);

      // Test max entries setting
      component.api.setMaxLogEntries(500);
      expect(component.api.getMaxLogEntries()).toBe(500);

      // Test console enable/disable
      component.api.setConsoleEnabled(false);
      expect(component.api.isConsoleEnabled()).toBe(false);
    });

    test('should get execution statistics', () => {
      const logs = [
        { level: 'info', message: 'Info 1' },
        { level: 'info', message: 'Info 2' },
        { level: 'warn', message: 'Warning' },
        { level: 'error', message: 'Error 1' },
        { level: 'error', message: 'Error 2' }
      ];

      logs.forEach(log => component.api.addLogEntry(log));

      const stats = component.api.getExecutionStatistics();
      expect(stats.totalLogs).toBe(5);
      expect(stats.errorCount).toBe(2);
      expect(stats.warningCount).toBe(1);
      expect(stats.infoCount).toBe(2);
    });
  });

  describe('Integration Tests', () => {
    test('should handle log streaming updates', () => {
      const logStream = [
        { level: 'info', message: 'Stream message 1' },
        { level: 'debug', message: 'Stream message 2' },
        { level: 'warn', message: 'Stream message 3' }
      ];

      logStream.forEach(log => {
        component.api.addLogEntry(log);
      });

      expect(component.api.getLogs()).toHaveLength(3);
      expect(mockUmbilical.onLogUpdate).toHaveBeenCalledTimes(3);
    });

    test('should maintain context consistency', () => {
      const context = {
        executionId: 'exec-consistency-test',
        taskId: 'task-consistency-test'
      };

      component.api.setExecutionContext(context);

      const logEntry = {
        level: 'info',
        message: 'Context test message'
      };

      component.api.addLogEntry(logEntry);

      const contextLogsResult = component.api.getLogsByContext('exec-consistency-test');
      expect(contextLogsResult.success).toBe(true);
      const contextLogs = contextLogsResult.data;
      expect(contextLogs).toHaveLength(1);
      expect(contextLogs[0].context.executionId).toBe('exec-consistency-test');
    });

    test('should handle console reset', () => {
      // Add logs and set configurations
      component.api.addLogEntry({ level: 'info', message: 'Test' });
      component.api.setLogLevel('debug');
      component.api.setSearchQuery('test');

      expect(component.api.getLogs()).toHaveLength(1);

      const resetResult = component.api.reset();
      expect(resetResult.success).toBe(true);

      // Verify reset state
      expect(component.api.getLogs()).toHaveLength(0);
      expect(component.api.getLogLevel()).toBe('info');
      expect(component.api.getSearchQuery()).toBe('');
    });

    test('should handle umbilical callbacks for log operations', () => {
      const logEntry = {
        level: 'info',
        message: 'Callback test'
      };

      component.api.addLogEntry(logEntry);
      
      expect(mockUmbilical.onLogUpdate).toHaveBeenCalledWith({
        action: 'add',
        logEntry: expect.objectContaining({ message: 'Callback test' })
      });

      component.api.clearLogs();
      
      expect(mockUmbilical.onLogUpdate).toHaveBeenCalledWith({
        action: 'clear'
      });
    });
  });
});