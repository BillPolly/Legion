/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';

describe('Browser Message Handler', () => {
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
  
  describe('Browser Message Processing', () => {
    it('should handle "identify" message with page URL and user agent', async () => {
      const message = {
        type: 'identify',
        sessionId: 'test-session',
        pageId: 'page-123',
        pageUrl: 'http://localhost:3000',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: Date.now()
      };
      
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Browser agent identified')
      );
      
      const log = storageProvider.logs.find(l => l.source === 'browser-agent');
      expect(log).toBeDefined();
      expect(log.message).toContain('Browser agent connected');
      expect(log.metadata.pageId).toBe('page-123');
      expect(log.metadata.userAgent).toContain('Mozilla');
      
      consoleLogSpy.mockRestore();
    });
    
    it('should handle "console" messages from browser', async () => {
      const message = {
        type: 'console',
        method: 'error',
        args: ['Browser error', 'details'],
        sessionId: 'test-session',
        pageId: 'page-123',
        location: 'http://localhost:3000',
        timestamp: Date.now()
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'browser-console');
      expect(log).toBeDefined();
      expect(log.level).toBe('error');
      expect(log.message).toContain('Browser error details');
      expect(log.metadata.location).toBe('http://localhost:3000');
    });
    
    it('should handle "network" messages with request/response/error subtypes', async () => {
      // Test request
      await monitor.handleBrowserMessage({
        type: 'network',
        subtype: 'request',
        url: '/api/data',
        method: 'GET',
        correlationId: 'corr-123',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      // Test response
      await monitor.handleBrowserMessage({
        type: 'network',
        subtype: 'response',
        url: '/api/data',
        status: 200,
        duration: 150,
        correlationId: 'corr-123',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      // Test error
      await monitor.handleBrowserMessage({
        type: 'network',
        subtype: 'error',
        url: '/api/data',
        error: 'Network error',
        correlationId: 'corr-123',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-network');
      expect(logs.length).toBe(3);
      
      const requestLog = logs.find(l => l.message.includes('request'));
      const responseLog = logs.find(l => l.message.includes('response'));
      const errorLog = logs.find(l => l.level === 'error');
      
      expect(requestLog).toBeDefined();
      expect(responseLog).toBeDefined();
      expect(errorLog).toBeDefined();
    });
    
    it('should handle "error" messages with stack traces', async () => {
      const message = {
        type: 'error',
        message: 'Uncaught TypeError',
        stack: 'at functionName (file.js:10:15)',
        filename: 'app.js',
        lineno: 10,
        colno: 15,
        sessionId: 'test-session',
        pageId: 'page-123'
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'browser-error');
      expect(log).toBeDefined();
      expect(log.level).toBe('error');
      expect(log.message).toBe('Uncaught TypeError');
      expect(log.metadata.stack).toContain('at functionName');
      expect(log.metadata.filename).toBe('app.js');
      expect(log.metadata.lineno).toBe(10);
    });
    
    it('should handle "unhandledrejection" messages', async () => {
      const message = {
        type: 'unhandledrejection',
        reason: {
          message: 'Promise rejection',
          stack: 'Promise stack trace'
        },
        sessionId: 'test-session',
        pageId: 'page-123'
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'browser-rejection');
      expect(log).toBeDefined();
      expect(log.level).toBe('error');
      expect(log.message).toContain('Promise rejection');
      expect(log.metadata.reason.stack).toBe('Promise stack trace');
    });
    
    it('should handle "dom-mutation" summary messages', async () => {
      const message = {
        type: 'dom-mutation',
        summary: {
          additions: 5,
          removals: 2,
          attributes: 3,
          text: 1
        },
        sessionId: 'test-session',
        pageId: 'page-123'
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'browser-dom');
      expect(log).toBeDefined();
      expect(log.level).toBe('debug');
      expect(log.message).toContain('DOM mutation: +5 -2');
      expect(log.metadata.additions).toBe(5);
      expect(log.metadata.removals).toBe(2);
    });
    
    it('should handle "user-interaction" events', async () => {
      const message = {
        type: 'user-interaction',
        event: 'click',
        target: {
          tagName: 'BUTTON',
          id: 'submit-btn',
          className: 'btn btn-primary'
        },
        sessionId: 'test-session',
        pageId: 'page-123'
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'browser-interaction');
      expect(log).toBeDefined();
      expect(log.level).toBe('info');
      expect(log.message).toContain('User click: BUTTON submit-btn');
      expect(log.metadata.event).toBe('click');
      expect(log.metadata.target.id).toBe('submit-btn');
    });
    
    it('should handle "visibility" change events', async () => {
      const message = {
        type: 'visibility',
        hidden: true,
        visibilityState: 'hidden',
        sessionId: 'test-session',
        pageId: 'page-123'
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      // This goes to default handler
      const log = storageProvider.logs.find(l => l.source === 'browser-visibility');
      expect(log).toBeDefined();
      expect(log.message).toContain('visibility');
    });
    
    it('should extract correlation IDs from console and network messages', async () => {
      // Test console with correlation
      await monitor.handleBrowserMessage({
        type: 'console',
        method: 'log',
        args: ['[correlation-abc-123] API call started'],
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      // Test network with correlation
      await monitor.handleBrowserMessage({
        type: 'network',
        subtype: 'request',
        url: '/api/data',
        correlationId: 'correlation-xyz-456',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      const correlation1 = monitor.getCorrelation('correlation-abc-123');
      const correlation2 = monitor.getCorrelation('correlation-xyz-456');
      
      expect(correlation1).toBeDefined();
      expect(correlation1.frontend).toBeDefined();
      expect(correlation1.frontend.type).toBe('console');
      
      expect(correlation2).toBeDefined();
      expect(correlation2.frontend).toBeDefined();
      expect(correlation2.frontend.type).toBe('network');
    });
    
    it('should store all messages via direct LogStore calls', async () => {
      const logSpy = jest.spyOn(monitor.logStore, 'logBrowserMessage');
      
      await monitor.handleBrowserMessage({
        type: 'console',
        method: 'log',
        args: ['Test'],
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'console',
          method: 'log'
        }),
        'browser-client-123'
      );
      
      logSpy.mockRestore();
    });
    
    it('should handle unknown message types', async () => {
      const message = {
        type: 'custom-event',
        data: { custom: 'data' },
        sessionId: 'test-session',
        pageId: 'page-123'
      };
      
      await monitor.handleBrowserMessage(message, 'browser-client-123');
      
      const log = storageProvider.logs.find(l => l.source === 'browser-custom-event');
      expect(log).toBeDefined();
      expect(log.message).toContain('custom-event');
      expect(log.metadata.data.custom).toBe('data');
    });
    
    it('should handle missing or malformed data gracefully', async () => {
      // Missing summary in dom-mutation
      await monitor.handleBrowserMessage({
        type: 'dom-mutation',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      // Missing reason in unhandledrejection
      await monitor.handleBrowserMessage({
        type: 'unhandledrejection',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      // String reason instead of object
      await monitor.handleBrowserMessage({
        type: 'unhandledrejection',
        reason: 'Simple string reason',
        sessionId: 'test-session',
        pageId: 'page-123'
      }, 'browser-client-123');
      
      // All should be handled without throwing
      const logs = storageProvider.logs.filter(
        l => l.source === 'browser-dom' || l.source === 'browser-rejection'
      );
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});