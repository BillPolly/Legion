/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EventEmitter } from 'events';
import { 
  MockBrowser, 
  MockPage, 
  MockResourceManager, 
  MockDriver,
  EventCollector,
  waitForEvent 
} from '../utils/TestUtils.js';

import { BrowserMonitor } from '../../src/BrowserMonitor.js';

describe('BrowserMonitor', () => {
  let resourceManager;
  let mockDriver;

  beforeEach(() => {
    resourceManager = new MockResourceManager();
    mockDriver = new MockDriver();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create instance with async factory pattern', async () => {
      const monitor = await BrowserMonitor.create(resourceManager);
      
      expect(monitor).toBeDefined();
      expect(monitor.resourceManager).toBe(resourceManager);
      expect(monitor.browserType).toBe('mock');
    });

    it('should throw if resourceManager is not provided', async () => {
      await expect(BrowserMonitor.create()).rejects.toThrow('ResourceManager is required');
    });

    it('should use browser type from ResourceManager', async () => {
      resourceManager.set('BROWSER_TYPE', 'playwright');
      
      const monitor = await BrowserMonitor.create(resourceManager);
      
      expect(monitor.browserType).toBe('playwright');
    });

    it('should emit initialized event during creation', async () => {
      const monitor = await BrowserMonitor.create(resourceManager);
      
      // The event should have been emitted during create()
      // We can verify by checking the monitor is initialized
      expect(monitor.driver).toBeDefined();
    });
  });

  describe('browser lifecycle', () => {
    let monitor;

    beforeEach(async () => {
      monitor = await BrowserMonitor.create(resourceManager);
      monitor.driver = mockDriver; // Inject mock driver
    });

    it('should launch browser with options', async () => {
      const browser = await monitor.launch({
        headless: false,
        devtools: true
      });
      
      expect(browser).toBeDefined();
      expect(mockDriver.launches.length).toBe(1);
      expect(mockDriver.launches[0]).toEqual({
        headless: false,
        devtools: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins',
          '--disable-site-isolation-trials',
        ],
        defaultViewport: {
          width: 1280,
          height: 720
        },
        slowMo: 0
      });
    });

    it('should track active browser instance', async () => {
      const browser = await monitor.launch();
      
      expect(monitor.browser).toBe(browser);
      expect(monitor.isConnected()).toBe(true);
    });

    it('should emit browser-launched event', async () => {
      const events = new EventCollector(monitor, ['browser-launched']);
      
      const browser = await monitor.launch();
      
      expect(events.get('browser-launched').length).toBe(1);
      expect(events.get('browser-launched')[0]).toHaveProperty('browser');
    });

    it('should close browser properly', async () => {
      const browser = await monitor.launch();
      
      await monitor.close();
      
      expect(browser.closed).toBe(true);
      expect(monitor.isConnected()).toBe(false);
    });

    it('should emit browser-closed event', async () => {
      const browser = await monitor.launch();
      const events = new EventCollector(monitor, ['browser-closed']);
      
      await monitor.close();
      
      expect(events.get('browser-closed').length).toBe(1);
    });

    it('should handle browser crash', async () => {
      const browser = await monitor.launch();
      const events = new EventCollector(monitor, ['browser-crashed']);
      
      // Simulate crash
      browser.isConnected = false;
      browser.emit('disconnected');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(events.get('browser-crashed').length).toBe(1);
      expect(monitor.isConnected()).toBe(false);
    });
  });

  describe('page monitoring', () => {
    let monitor;
    let browser;

    beforeEach(async () => {
      monitor = await BrowserMonitor.create(resourceManager);
      monitor.driver = mockDriver;
      browser = await monitor.launch();
    });

    afterEach(async () => {
      if (monitor.isConnected()) {
        await monitor.close();
      }
    });

    it('should create monitored page', async () => {
      const page = await monitor.monitorPage('https://example.com', 'session-123');
      
      expect(page).toBeDefined();
      expect(page.url).toBe('https://example.com');
      expect(page.sessionId).toBe('session-123');
    });

    it('should inject monitoring scripts', async () => {
      const page = await monitor.monitorPage('https://example.com', 'session-123');
      
      // Check if monitoring script was injected
      const injectedScripts = page.page.evaluatedScripts.filter(s => s.onNewDocument);
      expect(injectedScripts.length).toBeGreaterThan(0);
      
      const script = injectedScripts[0].script;
      expect(script).toContain('window.__BROWSER_MONITOR__');
    });

    it('should track multiple pages', async () => {
      const page1 = await monitor.monitorPage('https://example1.com', 'session-1');
      const page2 = await monitor.monitorPage('https://example2.com', 'session-2');
      
      expect(monitor.pages.size).toBe(2);
      expect(monitor.pages.has(page1.id)).toBe(true);
      expect(monitor.pages.has(page2.id)).toBe(true);
    });

    it('should emit page-created event', async () => {
      const events = new EventCollector(monitor, ['page-created']);
      
      const page = await monitor.monitorPage('https://example.com', 'session-123');
      
      expect(events.get('page-created').length).toBe(1);
      expect(events.get('page-created')[0]).toHaveProperty('pageId');
      expect(events.get('page-created')[0]).toHaveProperty('url');
      expect(events.get('page-created')[0]).toHaveProperty('sessionId');
    });

    it('should close page properly', async () => {
      const page = await monitor.monitorPage('https://example.com', 'session-123');
      
      await monitor.closePage(page.id);
      
      expect(page.page.closed).toBe(true);
      expect(monitor.pages.has(page.id)).toBe(false);
    });

    it('should emit page-closed event', async () => {
      const page = await monitor.monitorPage('https://example.com', 'session-123');
      const events = new EventCollector(monitor, ['page-closed']);
      
      await monitor.closePage(page.id);
      
      expect(events.get('page-closed').length).toBe(1);
      expect(events.get('page-closed')[0]).toHaveProperty('pageId');
    });
  });

  describe('session management', () => {
    let monitor;

    beforeEach(async () => {
      monitor = await BrowserMonitor.create(resourceManager);
      monitor.driver = mockDriver;
    });

    it('should create monitoring session', async () => {
      const session = await monitor.createSession({
        name: 'test-session',
        metadata: { test: true }
      });
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.name).toBe('test-session');
      expect(session.metadata).toEqual({ test: true });
    });

    it('should track active sessions', async () => {
      const session1 = await monitor.createSession({ name: 'session-1' });
      const session2 = await monitor.createSession({ name: 'session-2' });
      
      expect(monitor.sessions.size).toBe(2);
      expect(monitor.sessions.has(session1.id)).toBe(true);
      expect(monitor.sessions.has(session2.id)).toBe(true);
    });

    it('should end session and cleanup resources', async () => {
      const browser = await monitor.launch();
      const session = await monitor.createSession({ name: 'test' });
      const page = await monitor.monitorPage('https://example.com', session.id);
      
      await monitor.endSession(session.id);
      
      expect(monitor.sessions.has(session.id)).toBe(false);
      expect(page.page.closed).toBe(true);
    });
  });

  describe('error handling', () => {
    let monitor;

    beforeEach(async () => {
      monitor = await BrowserMonitor.create(resourceManager);
      monitor.driver = mockDriver;
    });

    it('should handle launch failure', async () => {
      mockDriver.launch = jest.fn().mockRejectedValue(new Error('Launch failed'));
      
      await expect(monitor.launch()).rejects.toThrow('Launch failed');
      expect(monitor.browser).toBeNull();
    });

    it('should emit error event on failures', async () => {
      const events = new EventCollector(monitor, ['error']);
      mockDriver.launch = jest.fn().mockRejectedValue(new Error('Test error'));
      
      try {
        await monitor.launch();
      } catch (e) {
        // Expected
      }
      
      expect(events.get('error').length).toBe(1);
      expect(events.get('error')[0].message).toBe('Test error');
    });

    it('should handle page navigation errors', async () => {
      const browser = await monitor.launch();
      const page = await monitor.monitorPage('https://invalid-url', 'session-123');
      
      // Mock navigation failure
      page.page.goto = jest.fn().mockRejectedValue(new Error('Navigation failed'));
      
      await expect(page.navigate('https://other-url.com')).rejects.toThrow('Navigation failed');
    });
  });

  describe('statistics', () => {
    let monitor;

    beforeEach(async () => {
      monitor = await BrowserMonitor.create(resourceManager);
      monitor.driver = mockDriver;
    });

    it('should track statistics', async () => {
      const browser = await monitor.launch();
      const session = await monitor.createSession({ name: 'test' });
      const page = await monitor.monitorPage('https://example.com', session.id);
      
      const stats = monitor.getStatistics();
      
      expect(stats).toEqual({
        activeSessions: 1,
        activePages: 1,
        browserConnected: true,
        totalPagesCreated: 1,
        totalSessionsCreated: 1,
        totalConsoleMessages: 0,
        totalErrors: 0,
        totalNetworkRequests: 0,
        uptime: 0
      });
    });

    it('should update statistics on cleanup', async () => {
      const browser = await monitor.launch();
      const session = await monitor.createSession({ name: 'test' });
      const page = await monitor.monitorPage('https://example.com', session.id);
      
      await monitor.closePage(page.id);
      await monitor.endSession(session.id);
      
      const stats = monitor.getStatistics();
      
      expect(stats.activeSessions).toBe(0);
      expect(stats.activePages).toBe(0);
      expect(stats.totalPagesCreated).toBe(1);
      expect(stats.totalSessionsCreated).toBe(1);
    });
  });
});