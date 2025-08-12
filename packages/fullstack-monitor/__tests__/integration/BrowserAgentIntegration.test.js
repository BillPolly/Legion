/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { MockBrowserAgent } from '../utils/MockBrowserAgent.js';

describe('Browser Agent Integration', () => {
  let resourceManager;
  let monitor;
  let agent;
  
  beforeEach(async () => {
    resourceManager = new TestResourceManager();
    monitor = await FullStackMonitor.create(resourceManager);
    agent = new MockBrowserAgent();
  });
  
  afterEach(async () => {
    if (agent) {
      await agent.disconnect();
    }
    if (monitor) {
      await monitor.cleanup();
    }
  });
  
  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection and receive welcome message', async () => {
      await agent.connect();
      
      const welcomeMessage = await agent.waitForMessage('connected');
      expect(welcomeMessage).toBeDefined();
      expect(welcomeMessage.type).toBe('connected');
      expect(welcomeMessage.clientId).toContain('browser-');
      expect(welcomeMessage.timestamp).toBeDefined();
    });
    
    it('should handle page identification from agent', async () => {
      await agent.connect();
      await agent.identify();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(1);
    });
    
    it('should clean up connection on disconnect', async () => {
      await agent.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(1);
      
      await agent.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(0);
    });
    
    it('should handle multiple browser connections', async () => {
      const agent1 = new MockBrowserAgent();
      const agent2 = new MockBrowserAgent();
      
      await agent1.connect();
      await agent2.connect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(monitor.browserClients.size).toBe(2);
      
      await agent1.disconnect();
      await agent2.disconnect();
    });
  });
  
  describe('Console Message Processing', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should process console messages and store in log manager', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendConsole('log', 'Test browser message', 'arg2');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-console');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].message).toContain('Test browser message arg2');
      expect(logs[0].level).toBe('info');
    });
    
    it('should handle different console levels', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendConsole('error', 'Browser error');
      await agent.sendConsole('warn', 'Browser warning');
      await agent.sendConsole('debug', 'Browser debug');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-console');
      expect(logs.length).toBe(3);
      
      const errorLog = logs.find(l => l.level === 'error');
      const warnLog = logs.find(l => l.level === 'warn');
      const debugLog = logs.find(l => l.level === 'debug');
      
      expect(errorLog).toBeDefined();
      expect(warnLog).toBeDefined();
      expect(debugLog).toBeDefined();
    });
    
    it('should include page context in console messages', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.send({
        type: 'console',
        method: 'log',
        args: ['Context test'],
        sessionId: 'test-session',
        pageId: 'page-123',
        location: 'http://localhost:3000/test',
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-console');
      expect(logs.length).toBe(1);
      expect(logs[0].metadata.location).toBe('http://localhost:3000/test');
      expect(logs[0].metadata.pageId).toBe('page-123');
    });
  });
  
  describe('Network Request Monitoring', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should track network request lifecycle', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      const correlationId = 'network-test-123';
      
      // Send request
      await agent.sendNetwork('request', '/api/data', correlationId, {
        method: 'GET'
      });
      
      // Send response
      await agent.sendNetwork('response', '/api/data', correlationId, {
        status: 200,
        duration: 150
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-network');
      expect(logs.length).toBe(2);
      
      const requestLog = logs.find(l => l.message.includes('request'));
      const responseLog = logs.find(l => l.message.includes('response'));
      
      expect(requestLog).toBeDefined();
      expect(responseLog).toBeDefined();
      expect(responseLog.metadata.status).toBe(200);
    });
    
    it('should handle network errors', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.send({
        type: 'network',
        subtype: 'error',
        url: '/api/data',
        error: 'Network timeout',
        correlationId: 'error-test-456',
        sessionId: 'test-session',
        pageId: 'page-123',
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-network');
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toContain('Network timeout');
    });
  });
  
  describe('Error and Exception Handling', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should capture JavaScript errors', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendError(
        'Uncaught TypeError: Cannot read property',
        'TypeError: Cannot read property\n    at Object.<anonymous> (app.js:10:15)',
        'app.js',
        10,
        15
      );
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-error');
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toBe('Uncaught TypeError: Cannot read property');
      expect(logs[0].metadata.stack).toContain('Object.<anonymous>');
      expect(logs[0].metadata.filename).toBe('app.js');
    });
    
    it('should capture unhandled promise rejections', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      const rejectionError = new Error('Promise rejection error');
      rejectionError.stack = 'Error: Promise rejection\n    at Promise';
      
      await agent.sendUnhandledRejection(rejectionError);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-rejection');
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('error');
      expect(logs[0].message).toContain('Promise rejection error');
    });
    
    it('should handle string-based promise rejections', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendUnhandledRejection('Simple string rejection');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-rejection');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toContain('Simple string rejection');
    });
  });
  
  describe('User Interaction Tracking', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should track user click events', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendUserInteraction('click', {
        tagName: 'BUTTON',
        id: 'submit-btn',
        className: 'btn btn-primary'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-interaction');
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('info');
      expect(logs[0].message).toContain('User click: BUTTON submit-btn');
      expect(logs[0].metadata.target.className).toBe('btn btn-primary');
    });
    
    it('should track different interaction types', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      const interactions = ['click', 'submit', 'focus', 'blur'];
      
      for (const event of interactions) {
        await agent.sendUserInteraction(event, { 
          tagName: 'INPUT', 
          id: `test-${event}` 
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-interaction');
      expect(logs.length).toBe(interactions.length);
      
      for (const event of interactions) {
        const log = logs.find(l => l.message.includes(event));
        expect(log).toBeDefined();
      }
    });
  });
  
  describe('DOM Mutation Tracking', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should track DOM mutations', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendDomMutation({
        additions: 5,
        removals: 2,
        attributes: 3,
        text: 1
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-dom');
      expect(logs.length).toBe(1);
      expect(logs[0].level).toBe('debug');
      expect(logs[0].message).toContain('DOM mutation: +5 -2');
      expect(logs[0].metadata.additions).toBe(5);
      expect(logs[0].metadata.removals).toBe(2);
    });
    
    it('should handle empty mutation summaries', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendDomMutation(undefined);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-dom');
      expect(logs.length).toBe(1);
    });
  });
  
  describe('Page Visibility Tracking', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should track visibility state changes', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.sendVisibility(true, 'hidden');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-visibility');
      expect(logs.length).toBe(1);
      expect(logs[0].message).toContain('visibility');
    });
  });
  
  describe('Correlation Tracking', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should extract correlation IDs from console messages', async () => {
      const correlationId = 'frontend-correlation-789';
      
      await agent.sendConsole('log', `[${correlationId}] Frontend operation started`);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.frontend).toBeDefined();
      expect(correlation.frontend.type).toBe('console');
    });
    
    it('should track network request correlations', async () => {
      const correlationId = 'network-correlation-abc';
      
      await agent.sendNetwork('request', '/api/test', correlationId, {
        method: 'POST'
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation).toBeDefined();
      expect(correlation.frontend).toBeDefined();
      expect(correlation.frontend.type).toBe('network');
    });
  });
  
  describe('Error Resilience', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should handle malformed messages gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Send invalid JSON
      agent.ws.send('invalid json');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process'),
        expect.any(Error)
      );
      
      // Connection should still be active
      expect(monitor.browserClients.size).toBe(1);
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle unknown message types', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      await agent.send({
        type: 'custom-event',
        data: { custom: 'data' },
        sessionId: 'test-session',
        pageId: 'page-123',
        timestamp: Date.now()
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-custom-event');
      expect(logs.length).toBe(1);
      expect(logs[0].metadata.data.custom).toBe('data');
    });
  });
  
  describe('Performance Testing', () => {
    beforeEach(async () => {
      await agent.connect();
    });
    
    it('should handle rapid message bursts from browser', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      const messageCount = 50;
      
      const promises = [];
      for (let i = 0; i < messageCount; i++) {
        promises.push(agent.sendConsole('log', `Browser message ${i}`));
      }
      
      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const logs = storageProvider.logs.filter(l => l.source === 'browser-console');
      expect(logs.length).toBe(messageCount);
    });
    
    it('should maintain stability with mixed message types', async () => {
      // Send various types of messages
      await agent.sendConsole('log', 'Console log');
      await agent.sendNetwork('request', '/api/test', 'test-correlation');
      await agent.sendUserInteraction('click', { tagName: 'BUTTON' });
      await agent.sendDomMutation({ additions: 1 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Connection should remain stable
      expect(monitor.browserClients.size).toBe(1);
      expect(agent.ws.readyState).toBe(agent.ws.OPEN);
    });
  });
});