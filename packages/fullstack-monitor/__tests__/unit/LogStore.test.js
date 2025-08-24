/**
 * Unit tests for LogStore
 */

import { jest } from '@jest/globals';
import { LogStore } from '../../src/log-store/LogStore.js';
import { ResourceManager } from '@legion/resource-manager';

describe('LogStore', () => {
  let logStore;
  let resourceManager;

  beforeEach(async () => {
    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    logStore = await LogStore.create(resourceManager);
  });

  describe('Constructor and Creation', () => {
    test('should create instance with async factory pattern', async () => {
      const store = await LogStore.create(resourceManager);
      expect(store).toBeInstanceOf(LogStore);
      expect(store.logs).toEqual([]);
      expect(store.session).toBeNull();
      expect(store.processes).toBeInstanceOf(Map);
    });

    test('should work without ResourceManager (stub implementation)', async () => {
      const store = await LogStore.create(null);
      expect(store).toBeInstanceOf(LogStore);
    });
  });

  describe('Session Management', () => {
    test('should create a session', async () => {
      const session = await logStore.createSession('test-session', {
        type: 'test',
        metadata: { foo: 'bar' }
      });

      expect(session).toBeDefined();
      expect(session.id).toBe('test-session');
      expect(session.status).toBe('active');
      expect(session.type).toBe('test');
      expect(session.metadata).toEqual({ foo: 'bar' });
    });

    test('should get current session', () => {
      logStore.session = { id: 'current', status: 'active' };
      const session = logStore.getCurrentSession();
      expect(session).toEqual({ id: 'current', status: 'active' });
    });
  });

  describe('Log Storage', () => {
    test('should add log with timestamp', () => {
      logStore.addLog({
        level: 'info',
        message: 'Test message'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0]).toHaveProperty('timestamp');
      expect(logStore.logs[0].level).toBe('info');
      expect(logStore.logs[0].message).toBe('Test message');
    });

    test('should handle Sidewinder console messages', () => {
      logStore.logSidewinderMessage({
        type: 'console',
        method: 'log',
        args: ['Test', 'message'],
        sessionId: 'test-session',
        pid: 12345
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].agentType).toBe('sidewinder');
      expect(logStore.logs[0].level).toBe('log');
      expect(logStore.logs[0].message).toBe('Test message');
      expect(logStore.logs[0].pid).toBe(12345);
    });

    test('should handle Sidewinder log messages', () => {
      logStore.logSidewinderMessage({
        type: 'log',
        level: 'error',
        message: 'Error occurred',
        sessionId: 'test-session',
        pid: 12345
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].agentType).toBe('sidewinder');
      expect(logStore.logs[0].level).toBe('error');
      expect(logStore.logs[0].message).toBe('Error occurred');
    });

    test('should handle Browser console messages', () => {
      logStore.logBrowserMessage({
        type: 'console',
        level: 'warn',
        text: 'Browser warning',
        sessionId: 'test-session',
        pageId: 'page-123'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].agentType).toBe('browser');
      expect(logStore.logs[0].level).toBe('warn');
      expect(logStore.logs[0].message).toBe('Browser warning');
      expect(logStore.logs[0].pageId).toBe('page-123');
    });

    test('should handle Browser fetch messages', () => {
      logStore.logBrowserMessage({
        type: 'fetch',
        url: 'https://example.com',
        method: 'GET',
        sessionId: 'test-session',
        pageId: 'page-123'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].agentType).toBe('browser');
      expect(logStore.logs[0].level).toBe('info');
      expect(logStore.logs[0].message).toContain('fetch');
    });

    test('should handle Browser error messages', () => {
      logStore.logBrowserMessage({
        type: 'error',
        message: 'Page error',
        sessionId: 'test-session',
        pageId: 'page-123'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].agentType).toBe('browser');
      expect(logStore.logs[0].level).toBe('error');
      expect(logStore.logs[0].message).toBe('Page error');
    });
  });

  describe('Log Retrieval', () => {
    beforeEach(() => {
      // Add some test logs
      for (let i = 0; i < 30; i++) {
        logStore.addLog({
          agentType: i % 2 === 0 ? 'sidewinder' : 'browser',
          level: 'info',
          message: `Message ${i}`
        });
      }
    });

    test('should get recent Sidewinder logs', async () => {
      const logs = await logStore.getRecentAgentLogs('sidewinder', 10);
      
      expect(logs).toHaveLength(10);
      expect(logs.every(log => log.agentType === 'sidewinder')).toBe(true);
      // Should be the most recent ones
      expect(logs[logs.length - 1].message).toBe('Message 28');
    });

    test('should get recent Browser logs', async () => {
      const logs = await logStore.getRecentAgentLogs('browser', 10);
      
      expect(logs).toHaveLength(10);
      expect(logs.every(log => log.agentType === 'browser')).toBe(true);
      // Should be the most recent ones
      expect(logs[logs.length - 1].message).toBe('Message 29');
    });

    test('should respect limit parameter', async () => {
      const logs = await logStore.getRecentAgentLogs('sidewinder', 5);
      expect(logs).toHaveLength(5);
    });

    test('should return empty array for unknown agent type', async () => {
      const logs = await logStore.getRecentAgentLogs('unknown', 10);
      expect(logs).toEqual([]);
    });
  });

  describe('Process Management', () => {
    test('should add process to session', () => {
      logStore.session = { id: 'test-session' };
      
      logStore.addProcessToSession({
        id: 'process-1',
        name: 'test-process',
        pid: 12345
      });

      const processes = logStore.getSessionProcesses();
      expect(processes).toHaveLength(1);
      expect(processes[0].name).toBe('test-process');
    });

    test('should track process', () => {
      logStore.session = { id: 'test-session' };
      
      logStore.trackProcess({
        id: 'process-2',
        name: 'tracked-process',
        pid: 54321
      });

      const processes = logStore.getSessionProcesses();
      expect(processes).toHaveLength(1);
      expect(processes[0].name).toBe('tracked-process');
    });

    test('should use name as fallback for process ID', () => {
      logStore.session = { id: 'test-session' };
      
      logStore.addProcessToSession({
        name: 'no-id-process',
        pid: 11111
      });

      expect(logStore.processes.has('no-id-process')).toBe(true);
    });

    test('should not add process without session', () => {
      logStore.session = null;
      
      logStore.addProcessToSession({
        id: 'process-3',
        name: 'orphan-process'
      });

      const processes = logStore.getSessionProcesses();
      expect(processes).toEqual([]);
    });

    test('should get all session processes', () => {
      logStore.session = { id: 'test-session' };
      
      logStore.addProcessToSession({ id: '1', name: 'process-1' });
      logStore.addProcessToSession({ id: '2', name: 'process-2' });
      logStore.addProcessToSession({ id: '3', name: 'process-3' });

      const processes = logStore.getSessionProcesses();
      expect(processes).toHaveLength(3);
      expect(processes.map(p => p.name)).toEqual([
        'process-1',
        'process-2',
        'process-3'
      ]);
    });
  });

  describe('Edge Cases', () => {
    test('should handle messages without args', () => {
      logStore.logSidewinderMessage({
        type: 'console',
        method: 'log',
        sessionId: 'test-session'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].message).toBe('');
    });

    test('should handle messages with content instead of message', () => {
      logStore.logSidewinderMessage({
        type: 'log',
        content: 'Content text',
        sessionId: 'test-session'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].message).toBe('Content text');
    });

    test('should handle browser messages without text', () => {
      logStore.logBrowserMessage({
        type: 'console',
        message: 'Fallback message',
        sessionId: 'test-session'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].message).toBe('Fallback message');
    });

    test('should create JSON string for complex browser messages', () => {
      logStore.logBrowserMessage({
        type: 'interaction',
        target: 'button',
        action: 'click',
        sessionId: 'test-session'
      });

      expect(logStore.logs).toHaveLength(1);
      expect(logStore.logs[0].message).toContain('interaction');
      expect(logStore.logs[0].message).toContain('button');
    });
  });
});