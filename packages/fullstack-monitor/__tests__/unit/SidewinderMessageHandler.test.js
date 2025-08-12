/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';

describe('Sidewinder Message Handler', () => {
  let resourceManager;
  let monitor;
  let storageProvider;
  
  beforeEach(async () => {
    resourceManager = new TestResourceManager();
    storageProvider = resourceManager.getStorageProvider();
    monitor = await FullStackMonitor.create(resourceManager);
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
    }
  });
  
  describe('Message Processing', () => {
    it('should handle "identify" message and log agent connection', async () => {
      const message = {
        type: 'identify',
        sessionId: 'test-session',
        pid: 12345,
        profile: 'standard'
      };
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sidewinder agent identified')
      );
      
      consoleLogSpy.mockRestore();
    });
    
    it('should handle "console" messages with all log levels', async () => {
      const levels = ['log', 'error', 'warn', 'info', 'debug'];
      
      for (const method of levels) {
        const message = {
          type: 'console',
          method,
          args: ['Test message', 'arg2'],
          sessionId: 'test-session',
          pid: 12345,
          timestamp: Date.now()
        };
        
        await monitor.handleSidewinderMessage(message, 'client-123');
      }
      
      // Check that logs were stored
      const logs = storageProvider.logs;
      expect(logs.length).toBeGreaterThanOrEqual(levels.length);
      
      // Verify log levels are mapped correctly
      const errorLog = logs.find(l => l.source === 'sidewinder-console' && l.level === 'error');
      const warnLog = logs.find(l => l.source === 'sidewinder-console' && l.level === 'warn');
      const infoLog = logs.find(l => l.source === 'sidewinder-console' && l.level === 'info');
      
      expect(errorLog).toBeDefined();
      expect(warnLog).toBeDefined();
      expect(infoLog).toBeDefined();
    });
    
    it('should handle "processStart" and add process to session', async () => {
      const message = {
        type: 'processStart',
        pid: 12345,
        argv: ['node', 'app.js'],
        cwd: '/app',
        timestamp: Date.now()
      };
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      // Check that process was added
      const processes = storageProvider.processes.get(monitor.session.id);
      expect(processes).toBeDefined();
      expect(processes.length).toBeGreaterThan(0);
      expect(processes[0].processId).toBe(12345);
    });
    
    it('should handle "uncaughtException" and store as error log', async () => {
      const message = {
        type: 'uncaughtException',
        sessionId: 'test-session',
        pid: 12345,
        error: {
          message: 'Test error',
          stack: 'Error stack trace',
          code: 'ERR_TEST'
        },
        timestamp: Date.now()
      };
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      const errorLog = storageProvider.logs.find(
        l => l.source === 'sidewinder-uncaughtException' && l.level === 'error'
      );
      
      expect(errorLog).toBeDefined();
      expect(errorLog.message).toContain('Test error');
      expect(errorLog.metadata.stack).toContain('Error stack trace');
      expect(errorLog.metadata.code).toBe('ERR_TEST');
    });
    
    it('should handle "unhandledRejection" messages', async () => {
      const message = {
        type: 'unhandledRejection',
        sessionId: 'test-session',
        pid: 12345,
        reason: 'Promise rejection reason',
        timestamp: Date.now()
      };
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      // This message type goes to default handler
      const log = storageProvider.logs.find(
        l => l.source === 'sidewinder-unhandledRejection'
      );
      
      expect(log).toBeDefined();
      expect(log.message).toContain('unhandledRejection');
    });
    
    it('should handle "processExit" and complete process in session', async () => {
      // First add a process
      await monitor.handleSidewinderMessage({
        type: 'processStart',
        pid: 12345,
        argv: ['node', 'app.js'],
        cwd: '/app'
      }, 'client-123');
      
      // Then exit it
      const message = {
        type: 'processExit',
        sessionId: 'test-session',
        pid: 12345,
        code: 0,
        timestamp: Date.now()
      };
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      const processes = storageProvider.processes.get(monitor.session.id);
      const process = processes.find(p => p.processId === 12345);
      
      expect(process).toBeDefined();
      expect(process.exitCode).toBe(0);
      expect(process.completed).toBe(true);
    });
    
    it('should handle "server-lifecycle" events (listening, error)', async () => {
      // Test listening event
      await monitor.handleSidewinderMessage({
        type: 'server-lifecycle',
        event: 'listening',
        port: 3000,
        sessionId: 'test-session',
        pid: 12345
      }, 'client-123');
      
      // Test error event
      await monitor.handleSidewinderMessage({
        type: 'server-lifecycle',
        event: 'error',
        error: { message: 'Port in use' },
        sessionId: 'test-session',
        pid: 12345
      }, 'client-123');
      
      const logs = storageProvider.logs.filter(l => l.source === 'sidewinder-server');
      expect(logs.length).toBe(2);
      
      const listeningLog = logs.find(l => l.message.includes('listening'));
      const errorLog = logs.find(l => l.message.includes('error'));
      
      expect(listeningLog).toBeDefined();
      expect(listeningLog.level).toBe('info');
      
      expect(errorLog).toBeDefined();
      expect(errorLog.level).toBe('error');
    });
    
    it('should extract and track correlation IDs from messages', async () => {
      const correlationId = 'test-correlation-789';
      const message = {
        type: 'console',
        method: 'log',
        args: ['Processing request'],
        correlationId,
        sessionId: 'test-session',
        pid: 12345
      };
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.backend).toBeDefined();
    });
    
    it('should store all messages via direct LogStore calls', async () => {
      const logSpy = jest.spyOn(monitor.logStore, 'logSidewinderMessage');
      
      await monitor.handleSidewinderMessage({
        type: 'console',
        method: 'log',
        args: ['Test'],
        sessionId: 'test-session'
      }, 'client-123');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'console',
          method: 'log'
        }),
        'client-123'
      );
      
      logSpy.mockRestore();
    });
    
    it('should handle unknown message types gracefully', async () => {
      const message = {
        type: 'unknown-type',
        data: 'some data',
        sessionId: 'test-session'
      };
      
      await monitor.handleSidewinderMessage(message, 'client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'sidewinder-unknown-type');
      expect(log).toBeDefined();
      expect(log.message).toContain('unknown-type');
    });
    
    it('should handle malformed console arguments', async () => {
      const circularObj = {};
      circularObj.self = circularObj;
      
      const message = {
        type: 'console',
        method: 'log',
        args: [circularObj, undefined, null, 123, true],
        sessionId: 'test-session'
      };
      
      await expect(
        monitor.handleSidewinderMessage(message, 'client-123')
      ).resolves.not.toThrow();
      
      const log = storageProvider.logs.find(l => l.source === 'sidewinder-console');
      expect(log).toBeDefined();
    });
  });
});