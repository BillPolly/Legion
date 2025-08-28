import { describe, it, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BackgroundService } from '../../../src/extension/background.js';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onInstalled: {
      addListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn()
    },
    onConnect: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn(),
    id: 'test-extension-id'
  },
  tabs: {
    sendMessage: jest.fn(),
    query: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    onChanged: {
      addListener: jest.fn()
    }
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    },
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  }
};

describe('Background Service Worker', () => {
  let backgroundService;

  beforeEach(() => {
    jest.clearAllMocks();
    backgroundService = new BackgroundService();
  });

  afterEach(() => {
    backgroundService.destroy();
  });

  describe('Service Worker Registration', () => {
    test('should register service worker on initialization', () => {
      backgroundService.initialize();

      expect(chrome.runtime.onInstalled.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(chrome.runtime.onConnect.addListener).toHaveBeenCalled();
    });

    test('should handle installation event', () => {
      let installCallback;
      chrome.runtime.onInstalled.addListener.mockImplementation(cb => {
        installCallback = cb;
      });

      backgroundService.initialize();

      // Simulate fresh install
      installCallback({ reason: 'install' });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        installedAt: expect.any(Number),
        version: '1.0.0'
      });
    });

    test('should handle update event', () => {
      let installCallback;
      chrome.runtime.onInstalled.addListener.mockImplementation(cb => {
        installCallback = cb;
      });

      backgroundService.initialize();

      // Simulate update
      installCallback({ reason: 'update', previousVersion: '0.9.0' });

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        updatedAt: expect.any(Number),
        previousVersion: '0.9.0',
        version: '1.0.0'
      });
    });
  });

  describe('Extension Lifecycle Events', () => {
    test('should track extension state', () => {
      expect(backgroundService.getState()).toBe('idle');

      backgroundService.initialize();
      expect(backgroundService.getState()).toBe('ready');
    });

    test('should handle browser action clicks', () => {
      let actionCallback;
      chrome.action.onClicked.addListener.mockImplementation(cb => {
        actionCallback = cb;
      });

      backgroundService.initialize();

      const mockTab = { id: 123, url: 'https://example.com' };
      actionCallback(mockTab);

      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { action: 'toggle-devtools' }
      );
    });

    test('should monitor tab lifecycle', () => {
      backgroundService.initialize();

      expect(chrome.tabs.onUpdated.addListener).toHaveBeenCalled();
      expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalled();
    });

    test('should cleanup on tab removal', () => {
      let removeCallback;
      chrome.tabs.onRemoved.addListener.mockImplementation(cb => {
        removeCallback = cb;
      });

      backgroundService.initialize();

      // Track a connection
      backgroundService.trackConnection(123, { status: 'connected' });
      expect(backgroundService.getConnection(123)).toBeDefined();

      // Simulate tab removal
      removeCallback(123);

      expect(backgroundService.getConnection(123)).toBeNull();
    });
  });

  describe('Background Message Handling', () => {
    test('should handle messages from content scripts', async () => {
      let messageCallback;
      chrome.runtime.onMessage.addListener.mockImplementation(cb => {
        messageCallback = cb;
      });

      backgroundService.initialize();

      const message = { command: 'connect', data: { url: 'ws://localhost:9222' } };
      const sender = { tab: { id: 123 } };
      const sendResponse = jest.fn();

      const result = await messageCallback(message, sender, sendResponse);

      expect(result).toBe(true); // Indicates async response
    });

    test('should route commands appropriately', async () => {
      let messageCallback;
      chrome.runtime.onMessage.addListener.mockImplementation(cb => {
        messageCallback = cb;
      });

      backgroundService.initialize();

      // Test connect command
      const connectMessage = { command: 'connect', data: { url: 'ws://localhost:9222' } };
      const sender = { tab: { id: 123 } };
      
      await messageCallback(connectMessage, sender, () => {});
      
      expect(backgroundService.getConnection(123)).toEqual(
        expect.objectContaining({
          status: 'connecting',
          url: 'ws://localhost:9222',
          tabId: 123
        })
      );
    });

    test('should handle unknown commands', async () => {
      let messageCallback;
      chrome.runtime.onMessage.addListener.mockImplementation(cb => {
        messageCallback = cb;
      });

      backgroundService.initialize();

      const message = { command: 'unknown' };
      const sender = { tab: { id: 123 } };
      const sendResponse = jest.fn();

      await messageCallback(message, sender, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'Unknown command: unknown'
      });
    });
  });

  describe('Background Worker Persistence and Cleanup', () => {
    test('should manage persistent connections', () => {
      backgroundService.initialize();

      // Track multiple connections
      backgroundService.trackConnection(123, { status: 'connected' });
      backgroundService.trackConnection(456, { status: 'connected' });

      expect(backgroundService.getActiveConnections()).toHaveLength(2);
    });

    test('should cleanup stale connections', () => {
      backgroundService.initialize();

      const now = Date.now();
      
      // Track connection with old lastActivity
      backgroundService.trackConnection(123, { 
        status: 'connecting',
        lastActivity: now - 70000 // 70 seconds ago
      });

      // Run cleanup
      backgroundService.cleanupStaleConnections();

      expect(backgroundService.getConnection(123)).toBeNull();
      
      // Cleanup mock
      jest.restoreAllMocks();
    });

    test('should persist state across service worker restarts', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          connections: {
            123: { status: 'connected', url: 'ws://localhost:9222' }
          }
        });
      });

      await backgroundService.restoreState();

      expect(backgroundService.getConnection(123)).toEqual({
        status: 'connected',
        url: 'ws://localhost:9222'
      });
    });

    test('should handle storage errors gracefully', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(undefined); // Simulate error
      });

      await expect(backgroundService.restoreState()).resolves.not.toThrow();
    });
  });

  describe('Port Communication', () => {
    test('should handle port connections', () => {
      let connectCallback;
      chrome.runtime.onConnect.addListener.mockImplementation(cb => {
        connectCallback = cb;
      });

      backgroundService.initialize();

      const mockPort = {
        name: 'devtools',
        sender: { tab: { id: 123 } },
        onMessage: { addListener: jest.fn() },
        onDisconnect: { addListener: jest.fn() },
        postMessage: jest.fn()
      };

      connectCallback(mockPort);

      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      expect(mockPort.onDisconnect.addListener).toHaveBeenCalled();
    });

    test('should handle port messages', () => {
      let connectCallback, messageCallback;
      chrome.runtime.onConnect.addListener.mockImplementation(cb => {
        connectCallback = cb;
      });

      backgroundService.initialize();

      // First track a connection
      backgroundService.trackConnection(123, {
        status: 'connecting',
        url: 'ws://localhost:9222'
      });

      const mockPort = {
        name: 'devtools',
        sender: { tab: { id: 123 } },
        onMessage: { 
          addListener: jest.fn(cb => { messageCallback = cb; })
        },
        onDisconnect: { addListener: jest.fn() },
        postMessage: jest.fn()
      };

      connectCallback(mockPort);

      // Send message through port
      const message = { type: 'status', data: { connected: true } };
      messageCallback(message);

      expect(backgroundService.getConnection(123)).toEqual(
        expect.objectContaining({
          status: 'connected',
          port: mockPort
        })
      );
    });
  });

  describe('Badge Management', () => {
    test('should update badge for active connections', () => {
      backgroundService.initialize();

      backgroundService.updateBadge(123, 'connected');

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        text: '●',
        tabId: 123
      });
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#00FF00',
        tabId: 123
      });
    });

    test('should clear badge on disconnect', () => {
      backgroundService.initialize();

      backgroundService.updateBadge(123, 'disconnected');

      expect(chrome.action.setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 123
      });
    });
  });
});