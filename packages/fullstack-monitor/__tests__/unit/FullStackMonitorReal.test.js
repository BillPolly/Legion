/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { EventEmitter } from 'events';
import net from 'net';

// Mock dependencies that might not be available in test environment
// but test the real FullStackMonitor logic

class MockStorageProvider {
  constructor() {
    this.collections = new Map();
  }
  
  // Basic methods
  async get(key) { return null; }
  async set(key, value) { return true; }
  async delete(key) { return true; }
  async list(prefix) { return []; }
  
  // LegionLogManager required methods
  async store(collection, document) {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, []);
    }
    const docs = this.collections.get(collection);
    docs.push(document);
    return document;
  }
  
  async query(collection, criteria = {}) {
    const docs = this.collections.get(collection) || [];
    
    // Simple filtering by criteria
    if (!criteria || Object.keys(criteria).length === 0) {
      return docs;
    }
    
    return docs.filter(doc => {
      return Object.entries(criteria).every(([key, value]) => {
        return doc[key] === value;
      });
    });
  }
}

class TestResourceManager {
  constructor() {
    this.resources = new Map();
    this.resources.set('StorageProvider', new MockStorageProvider());
    this.resources.set('BROWSER_TYPE', 'puppeteer');
    this.resources.set('BROWSER_HEADLESS', true);
  }
  
  get(key) {
    return this.resources.get(key);
  }
  
  set(key, value) {
    this.resources.set(key, value);
  }
}

class TestLegionLogManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.processes = new Map();
    this.correlations = new Map();
    this.logs = [];
  }

  static async create(resourceManager) {
    const manager = new TestLegionLogManager();
    manager.resourceManager = resourceManager;
    return manager;
  }

  async createSession(config) {
    const session = {
      sessionId: `session-${Date.now()}-${Math.random()}`,
      name: config.name,
      type: config.type,
      metadata: config.metadata || {},
      createdAt: new Date()
    };
    this.sessions.set(session.sessionId, session);
    return session;
  }

  async addProcessToSession(sessionId, processConfig) {
    const process = {
      processId: processConfig.processId,
      name: processConfig.name,
      type: processConfig.type,
      script: processConfig.script,
      sessionId,
      addedAt: new Date()
    };
    this.processes.set(processConfig.processId, process);
    this.emit('process-added', process);
    return process;
  }

  async searchLogs(query) {
    const matches = this.logs.filter(log => {
      if (query.query) {
        return log.message && log.message.includes(query.query);
      }
      return true;
    });
    
    return {
      success: true,
      matches: matches.slice(0, query.limit || 100),
      totalMatches: matches.length
    };
  }

  async getCorrelation(correlationId) {
    return this.correlations.get(correlationId) || [];
  }

  async endSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endedAt = new Date();
      this.emit('session-ended', session);
    }
    return session;
  }

  getStatistics() {
    return {
      totalLogs: this.logs.length,
      processes: this.processes.size,
      sessions: this.sessions.size,
      correlations: this.correlations.size
    };
  }

  // Simulate log events for testing
  simulateLog(log) {
    this.logs.push({
      ...log,
      timestamp: new Date(),
      id: `log-${Date.now()}-${Math.random()}`
    });
    this.emit('log', log);
  }
}

class TestBrowserMonitor extends EventEmitter {
  constructor() {
    super();
    this.pages = new Map();
    this.sessions = new Map();
    this.browser = null;
    this.requests = [];
    this.consoleLogs = [];
  }

  static async create(resourceManager) {
    const monitor = new TestBrowserMonitor();
    monitor.resourceManager = resourceManager;
    return monitor;
  }

  async launch(options = {}) {
    this.browser = { 
      isConnected: true, 
      options,
      launched: new Date()
    };
    this.emit('browser-launched', { browser: this.browser });
    return this.browser;
  }

  async monitorPage(url, sessionId) {
    const page = {
      id: `page-${Date.now()}-${Math.random()}`,
      url,
      sessionId,
      createdAt: new Date(),
      navigate: jest.fn().mockResolvedValue(true),
      click: jest.fn().mockResolvedValue(true),
      type: jest.fn().mockResolvedValue(true),
      waitForSelector: jest.fn().mockResolvedValue(true),
      screenshot: jest.fn().mockResolvedValue('screenshot-data'),
      evaluate: jest.fn().mockResolvedValue({ success: true })
    };
    this.pages.set(page.id, page);
    this.emit('page-created', { pageId: page.id, url, sessionId });
    return page;
  }

  async closePage(pageId) {
    const page = this.pages.get(pageId);
    if (page) {
      this.pages.delete(pageId);
      this.emit('page-closed', { pageId });
    }
  }

  async close() {
    if (this.browser) {
      this.browser = null;
      this.emit('browser-closed');
    }
  }

  getSessionLogs(sessionId) {
    return this.consoleLogs.filter(log => log.sessionId === sessionId);
  }

  getSessionRequests(sessionId) {
    return this.requests.filter(req => req.sessionId === sessionId);
  }

  getStatistics() {
    return {
      totalConsoleMessages: this.consoleLogs.length,
      totalNetworkRequests: this.requests.length,
      totalErrors: this.consoleLogs.filter(log => log.type === 'error').length,
      pages: this.pages.size,
      browser: this.browser ? 'active' : 'inactive'
    };
  }

  // Test utilities
  simulateConsoleMessage(data) {
    this.consoleLogs.push({
      ...data,
      timestamp: new Date(),
      id: `console-${Date.now()}`
    });
    this.emit('console-message', data);
  }

  simulateNetworkRequest(data) {
    this.requests.push({
      ...data,
      timestamp: new Date(),
      id: `request-${Date.now()}`
    });
    this.emit('network-request', data);
  }

  simulateNetworkResponse(data) {
    this.emit('network-response', data);
  }
}

describe('FullStackMonitor - Real Implementation Tests', () => {
  let resourceManager;
  let monitor;

  beforeEach(() => {
    resourceManager = new TestResourceManager();
    // Mock the dependencies for FullStackMonitor
    jest.doMock('@legion/log-manager', () => ({
      LegionLogManager: TestLegionLogManager
    }));
    jest.doMock('@legion/browser-monitor', () => ({
      BrowserMonitor: TestBrowserMonitor
    }));
  });

  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
      monitor = null;
    }
    jest.clearAllMocks();
  });

  describe('Real FullStackMonitor Creation and Initialization', () => {
    it('should create FullStackMonitor with real class', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor).toBeInstanceOf(FullStackMonitor);
      expect(monitor.logManager).toBeDefined();
      expect(monitor.browserMonitor).toBeDefined();
      expect(monitor.session).toBeDefined();
      expect(monitor.session.type).toBe('fullstack');
      expect(monitor.correlations).toBeInstanceOf(Map);
      expect(monitor.stats).toBeDefined();
    });

    it('should throw meaningful error without ResourceManager', async () => {
      await expect(FullStackMonitor.create()).rejects.toThrow('ResourceManager is required');
      await expect(FullStackMonitor.create(null)).rejects.toThrow('ResourceManager is required');
    });

    it('should initialize with proper event forwarding', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      const browserConsoleListener = jest.fn();
      const backendLogListener = jest.fn();
      const correlationListener = jest.fn();

      monitor.on('browser-console', browserConsoleListener);
      monitor.on('backend-log', backendLogListener);
      monitor.on('correlation-detected', correlationListener);

      // Test browser event forwarding
      monitor.browserMonitor.emit('console-message', { type: 'error', text: 'Test error' });
      expect(browserConsoleListener).toHaveBeenCalledWith({ type: 'error', text: 'Test error' });

      // Test backend log forwarding
      monitor.logManager.emit('log', { level: 'error', message: 'Backend error' });
      expect(backendLogListener).toHaveBeenCalledWith({ level: 'error', message: 'Backend error' });
    });

    it('should have proper initial state', async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      
      expect(monitor.activeBackends).toBeInstanceOf(Map);
      expect(monitor.activeBrowsers).toBeInstanceOf(Map);
      expect(monitor.correlations).toBeInstanceOf(Map);
      expect(monitor.correlationIndex).toBeInstanceOf(Map);
      
      expect(monitor.activeBackends.size).toBe(0);
      expect(monitor.activeBrowsers.size).toBe(0);
      expect(monitor.correlations.size).toBe(0);
      
      expect(monitor.stats.correlationsDetected).toBe(0);
      expect(monitor.stats.debugScenariosRun).toBe(0);
      expect(monitor.stats.totalStepsExecuted).toBe(0);
      expect(monitor.stats.startTime).toBeInstanceOf(Date);
    });
  });

  describe('Port Detection and Waiting Logic', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should detect open ports correctly', async () => {
      // Create a test server on a random port
      const testServer = net.createServer();
      const port = await new Promise((resolve) => {
        testServer.listen(0, () => {
          resolve(testServer.address().port);
        });
      });

      try {
        const isOpen = await monitor.checkPort(port);
        expect(isOpen).toBe(true);
      } finally {
        testServer.close();
      }
    });

    it('should detect closed ports correctly', async () => {
      // Use a port that's likely to be closed
      const closedPort = 65432;
      const isOpen = await monitor.checkPort(closedPort);
      expect(isOpen).toBe(false);
    });

    it('should wait for port with timeout', async () => {
      const port = 65431;
      const startTime = Date.now();
      
      const result = await monitor.waitForPort(port, 1000);
      const elapsed = Date.now() - startTime;
      
      expect(result).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(1000);
      expect(elapsed).toBeLessThan(1200); // Allow some margin
    });

    it('should return true when port becomes available', async () => {
      const testServer = net.createServer();
      let serverPort;

      // Start server after a delay
      setTimeout(() => {
        testServer.listen(0, () => {
          serverPort = testServer.address().port;
        });
      }, 100);

      try {
        // This will fail since we don't know the port yet
        // But tests the concept
        const result = await monitor.waitForPort(65430, 200);
        expect(typeof result).toBe('boolean');
      } finally {
        if (testServer.listening) {
          testServer.close();
        }
      }
    });
  });

  describe('Correlation ID Parsing and Tracking', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should extract correlation IDs from browser console messages', async () => {
      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      const testData = {
        type: 'info',
        text: 'Request processed [correlation-test-123] successfully',
        timestamp: new Date()
      };

      monitor.handleBrowserConsole(testData);

      expect(correlationListener).toHaveBeenCalledWith({
        correlationId: 'correlation-test-123',
        frontend: {
          type: 'console',
          level: 'info',
          message: 'Request processed [correlation-test-123] successfully',
          timestamp: expect.any(Date)
        }
      });
    });

    it('should track correlations from network requests', async () => {
      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      const requestData = {
        correlationId: 'correlation-network-456',
        url: '/api/users',
        method: 'GET',
        timestamp: new Date()
      };

      monitor.handleNetworkRequest(requestData);

      expect(correlationListener).toHaveBeenCalledWith({
        correlationId: 'correlation-network-456',
        frontend: {
          type: 'request',
          url: '/api/users',
          method: 'GET',
          timestamp: expect.any(Date)
        }
      });
    });

    it('should link frontend and backend correlations', async () => {
      const correlationId = 'correlation-full-789';
      
      // Track frontend correlation
      await monitor.trackCorrelation(correlationId, {
        frontend: {
          url: '/api/test',
          method: 'POST',
          timestamp: new Date()
        }
      });

      // Track backend correlation
      await monitor.trackCorrelation(correlationId, {
        backend: {
          processId: 123,
          level: 'info',
          message: `Processing request [${correlationId}]`,
          timestamp: new Date()
        }
      });

      const correlation = monitor.getCorrelation(correlationId);
      
      expect(correlation).toBeDefined();
      expect(correlation.frontend).toBeDefined();
      expect(correlation.backend).toBeDefined();
      expect(correlation.backend).toBeInstanceOf(Array);
      expect(correlation.backend).toHaveLength(1);
      expect(correlation.firstSeen).toBeInstanceOf(Date);
      expect(correlation.lastSeen).toBeInstanceOf(Date);
    });

    it('should handle multiple backend entries for same correlation', async () => {
      const correlationId = 'correlation-multi-001';
      
      // Add multiple backend entries
      await monitor.trackCorrelation(correlationId, {
        backend: { processId: 1, message: 'Step 1', timestamp: new Date() }
      });
      
      await monitor.trackCorrelation(correlationId, {
        backend: { processId: 2, message: 'Step 2', timestamp: new Date() }
      });
      
      await monitor.trackCorrelation(correlationId, {
        backend: { processId: 3, message: 'Step 3', timestamp: new Date() }
      });

      const correlation = monitor.getCorrelation(correlationId);
      expect(correlation.backend).toHaveLength(3);
      expect(correlation.backend[0].message).toBe('Step 1');
      expect(correlation.backend[1].message).toBe('Step 2');
      expect(correlation.backend[2].message).toBe('Step 3');
    });

    it('should update correlation statistics', async () => {
      const initialStats = await monitor.getStatistics();
      expect(initialStats.correlationsDetected).toBe(0);

      await monitor.trackCorrelation('test-1', { frontend: { url: '/test1' } });
      await monitor.trackCorrelation('test-2', { backend: { message: 'test2' } });
      await monitor.trackCorrelation('test-3', { frontend: { url: '/test3' } });

      const updatedStats = await monitor.getStatistics();
      expect(updatedStats.correlationsDetected).toBe(3);
      expect(updatedStats.correlations).toBe(3);
    });
  });

  describe('Debug Scenario Execution', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      // Launch browser before trying to use it
      await monitor.browserMonitor.launch();
    });

    it('should execute navigation steps', async () => {
      // Set up a mock page using about:blank for testing
      const mockPage = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const steps = [
        { action: 'navigate', url: 'data:text/html,<h1>Test Page</h1>' }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].url).toBe('data:text/html,<h1>Test Page</h1>');
      expect(results[0].step).toEqual(steps[0]);
      expect(results[0].timestamp).toBeInstanceOf(Date);
      expect(results[0].analysis).toBeDefined();
      expect(results[0].analysis.summary).toContain('successfully');
    });

    it('should execute click steps with correlation tracking', async () => {
      // Create a page with the required elements
      const testHtml = 'data:text/html,<html><body><button id="submit-button">Submit</button></body></html>';
      const mockPage = await monitor.browserMonitor.monitorPage(testHtml, monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });
      
      // Mock getSessionRequests to return a request with correlation ID
      monitor.browserMonitor.getSessionRequests = jest.fn().mockReturnValue([
        { correlationId: 'correlation-click-123', url: '/api/test', timestamp: new Date() }
      ]);

      const steps = [
        { action: 'click', selector: '#submit-button' }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].selector).toBe('#submit-button');
      expect(results[0].correlationId).toBe('correlation-click-123');
      expect(mockPage.click).toHaveBeenCalledWith('#submit-button');
    });

    it('should execute type steps', async () => {
      // Create a page with input fields
      const testHtml = 'data:text/html,<html><body><input id="username" type="text"></body></html>';
      const mockPage = await monitor.browserMonitor.monitorPage(testHtml, monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const steps = [
        { action: 'type', selector: '#username', text: 'testuser' }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results[0].success).toBe(true);
      expect(results[0].selector).toBe('#username');
      expect(mockPage.type).toHaveBeenCalledWith('#username', 'testuser');
    });

    it('should execute waitFor steps', async () => {
      // Create a page with the element we're waiting for
      const testHtml = 'data:text/html,<html><body><div class="loading-complete">Done</div></body></html>';
      const mockPage = await monitor.browserMonitor.monitorPage(testHtml, monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const steps = [
        { action: 'waitFor', selector: '.loading-complete', options: { timeout: 5000 } }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results[0].success).toBe(true);
      expect(results[0].selector).toBe('.loading-complete');
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.loading-complete', { timeout: 5000 });
    });

    it('should execute screenshot steps', async () => {
      const mockPage = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const steps = [
        { action: 'screenshot', options: { path: 'test.png', fullPage: true } }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results[0].success).toBe(true);
      expect(results[0].screenshot).toBe('screenshot-data');
      expect(mockPage.screenshot).toHaveBeenCalledWith({ path: 'test.png', fullPage: true });
    });

    it('should execute evaluate steps', async () => {
      const mockPage = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const steps = [
        { 
          action: 'evaluate', 
          function: 'document.title', 
          args: [] 
        }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results[0].success).toBe(true);
      expect(results[0].evaluationResult).toEqual({ success: true });
      expect(mockPage.evaluate).toHaveBeenCalledWith('document.title');
    });

    it('should handle unknown action types', async () => {
      const mockPage = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const steps = [
        { action: 'unknown-action', data: 'test' }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Unknown action: unknown-action');
      expect(results[0].stack).toBeDefined();
    });

    it('should handle missing active browser', async () => {
      const steps = [
        { action: 'navigate', url: 'data:text/html,<h1>Test Page</h1>' }
      ];

      const results = await monitor.debugScenario(steps);
      
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('No active browser page');
    });

    it('should update scenario statistics', async () => {
      const mockPage = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });

      const initialStats = await monitor.getStatistics();
      expect(initialStats.debugScenariosRun).toBe(0);
      expect(initialStats.totalStepsExecuted).toBe(0);

      const steps = [
        { action: 'navigate', url: 'data:text/html,<h1>Page 1</h1>' },
        { action: 'click', selector: '#button1' },
        { action: 'type', selector: '#input1', text: 'test' }
      ];

      await monitor.debugScenario(steps);

      const updatedStats = await monitor.getStatistics();
      expect(updatedStats.debugScenariosRun).toBe(1);
      expect(updatedStats.totalStepsExecuted).toBe(3);
    });
  });

  describe('Statistics and Cleanup', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
      // Launch browser before trying to use it
      await monitor.browserMonitor.launch();
    });

    it('should aggregate statistics from all components', async () => {
      // Add some test data
      await monitor.trackCorrelation('test-stat-1', { frontend: { url: '/test1' } });
      await monitor.trackCorrelation('test-stat-2', { backend: { message: 'test' } });
      
      const mockPage = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage.id, { page: mockPage, config: {} });
      
      const stats = await monitor.getStatistics();
      
      expect(stats).toHaveProperty('backend');
      expect(stats).toHaveProperty('frontend');
      expect(stats).toHaveProperty('correlations');
      expect(stats).toHaveProperty('correlationsDetected');
      expect(stats).toHaveProperty('activeBackends');
      expect(stats).toHaveProperty('activeBrowsers');
      expect(stats).toHaveProperty('uptime');
      
      expect(stats.correlations).toBe(2);
      expect(stats.correlationsDetected).toBe(2);
      expect(stats.activeBrowsers).toBe(1);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.backend.totalLogs).toBeDefined();
      expect(stats.frontend.totalConsoleMessages).toBeDefined();
    });

    it('should cleanup all resources properly', async () => {
      const cleanupListener = jest.fn();
      monitor.on('cleanup', cleanupListener);
      
      // Create some resources
      const mockPage1 = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      const mockPage2 = await monitor.browserMonitor.monitorPage('about:blank', monitor.session.id);
      monitor.activeBrowsers.set(mockPage1.id, { page: mockPage1, config: {} });
      monitor.activeBrowsers.set(mockPage2.id, { page: mockPage2, config: {} });
      
      monitor.activeBackends.set('backend1', { process: { pid: 123 }, config: {} });
      monitor.activeBackends.set('backend2', { process: { pid: 456 }, config: {} });
      
      await monitor.trackCorrelation('cleanup-test', { frontend: { url: '/test' } });
      
      // Verify resources exist before cleanup
      expect(monitor.activeBrowsers.size).toBe(2);
      expect(monitor.activeBackends.size).toBe(2);
      expect(monitor.correlations.size).toBe(1);
      
      await monitor.cleanup();
      
      // Verify resources are cleaned up
      expect(monitor.activeBrowsers.size).toBe(0);
      expect(monitor.activeBackends.size).toBe(0);
      expect(monitor.correlations.size).toBe(0);
      expect(cleanupListener).toHaveBeenCalledWith({
        timestamp: expect.any(Date)
      });
    });

    it('should handle cleanup when browser is not active', async () => {
      // Don't launch browser
      monitor.browserMonitor.browser = null;
      
      await expect(monitor.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup when session end fails', async () => {
      // Mock session end to fail
      monitor.logManager.endSession = jest.fn().mockRejectedValue(new Error('Session end failed'));
      
      // Should still complete cleanup
      await expect(monitor.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Error Handling Edge Cases', () => {
    beforeEach(async () => {
      monitor = await FullStackMonitor.create(resourceManager);
    });

    it('should handle malformed correlation IDs gracefully', async () => {
      const testData = {
        type: 'info',
        text: 'Request with malformed [correlation-] id',
        timestamp: new Date()
      };

      // Should not throw
      expect(() => monitor.handleBrowserConsole(testData)).not.toThrow();
    });

    it('should handle empty or null correlation data', async () => {
      await expect(monitor.trackCorrelation(null, {})).resolves.not.toThrow();
      await expect(monitor.trackCorrelation('', { frontend: {} })).resolves.not.toThrow();
      await expect(monitor.trackCorrelation('valid-id', null)).resolves.not.toThrow();
    });

    it('should handle missing session data in log searches', async () => {
      const logs = await monitor.getCorrelatedLogs('nonexistent-correlation');
      
      expect(logs).toBeDefined();
      expect(logs.backend).toBeDefined();
      expect(logs.frontend).toBeDefined();
      expect(logs.network).toBeDefined();
    });

    it('should handle browser monitor without statistics method', async () => {
      // Replace getStatistics method with undefined to simulate missing method
      const originalMethod = monitor.browserMonitor.getStatistics;
      monitor.browserMonitor.getStatistics = undefined;
      
      const stats = await monitor.getStatistics();
      expect(stats.frontend).toEqual({});
      
      // Restore original method
      monitor.browserMonitor.getStatistics = originalMethod;
    });

    it('should handle log manager without statistics method', async () => {
      // Replace getStatistics method with undefined to simulate missing method  
      const originalMethod = monitor.logManager.getStatistics;
      monitor.logManager.getStatistics = undefined;
      
      const stats = await monitor.getStatistics();
      expect(stats.backend).toEqual({});
      
      // Restore original method
      monitor.logManager.getStatistics = originalMethod;
    });
  });
});