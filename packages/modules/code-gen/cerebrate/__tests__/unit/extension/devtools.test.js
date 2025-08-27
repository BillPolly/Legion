import { DevToolsManager } from '../../../src/extension/devtools.js';

// Mock Chrome DevTools API
global.chrome = {
  devtools: {
    panels: {
      create: jest.fn(),
      elements: {
        onSelectionChanged: {
          addListener: jest.fn()
        }
      }
    },
    inspectedWindow: {
      eval: jest.fn(),
      tabId: 123
    },
    network: {
      onRequestFinished: {
        addListener: jest.fn()
      }
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

describe('DevTools Integration', () => {
  let devToolsManager;

  beforeEach(() => {
    jest.clearAllMocks();
    devToolsManager = new DevToolsManager();
  });

  afterEach(() => {
    devToolsManager.destroy();
  });

  describe('DevTools Panel Registration', () => {
    test('should create DevTools panel on initialization', async () => {
      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        const mockPanel = {
          onShown: { addListener: jest.fn() },
          onHidden: { addListener: jest.fn() }
        };
        callback(mockPanel);
      });

      await devToolsManager.initialize();

      expect(chrome.devtools.panels.create).toHaveBeenCalledWith(
        'Cerebrate',
        'assets/icon-24.png',
        'panel.html',
        expect.any(Function)
      );
    });

    test('should handle panel creation errors', async () => {
      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(null);
      });

      await expect(devToolsManager.initialize()).rejects.toThrow('Failed to create DevTools panel');
    });

    test('should register panel event listeners', async () => {
      const mockPanel = {
        onShown: { addListener: jest.fn() },
        onHidden: { addListener: jest.fn() }
      };

      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      await devToolsManager.initialize();

      expect(mockPanel.onShown.addListener).toHaveBeenCalled();
      expect(mockPanel.onHidden.addListener).toHaveBeenCalled();
    });
  });

  describe('Panel Loading and Initialization', () => {
    test('should track panel visibility state', async () => {
      let shownCallback, hiddenCallback;
      const mockPanel = {
        onShown: { 
          addListener: jest.fn(cb => { shownCallback = cb; })
        },
        onHidden: { 
          addListener: jest.fn(cb => { hiddenCallback = cb; })
        }
      };

      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      await devToolsManager.initialize();

      expect(devToolsManager.isPanelVisible()).toBe(false);

      // Simulate panel shown
      shownCallback();
      expect(devToolsManager.isPanelVisible()).toBe(true);

      // Simulate panel hidden
      hiddenCallback();
      expect(devToolsManager.isPanelVisible()).toBe(false);
    });

    test('should emit events on panel visibility changes', async () => {
      let shownCallback;
      const mockPanel = {
        onShown: { 
          addListener: jest.fn(cb => { shownCallback = cb; })
        },
        onHidden: { 
          addListener: jest.fn()
        }
      };

      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      const visibilityListener = jest.fn();
      devToolsManager.on('visibility-changed', visibilityListener);

      await devToolsManager.initialize();

      shownCallback();

      expect(visibilityListener).toHaveBeenCalledWith({
        visible: true,
        tabId: 123
      });
    });
  });

  describe('DevTools API Integration', () => {
    test('should integrate with Elements panel', async () => {
      await devToolsManager.initialize();

      expect(chrome.devtools.panels.elements.onSelectionChanged.addListener)
        .toHaveBeenCalled();
    });

    test('should handle element selection changes', async () => {
      let selectionCallback;
      chrome.devtools.panels.elements.onSelectionChanged.addListener
        .mockImplementation(cb => { selectionCallback = cb; });

      const selectionListener = jest.fn();
      devToolsManager.on('element-selected', selectionListener);

      await devToolsManager.initialize();

      // Simulate element selection
      chrome.devtools.inspectedWindow.eval.mockImplementation((code, callback) => {
        callback({
          tagName: 'DIV',
          id: 'test-element',
          className: 'test-class'
        });
      });

      await selectionCallback();

      // Wait for async event
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(selectionListener).toHaveBeenCalledWith({
        element: {
          tagName: 'DIV',
          id: 'test-element',
          className: 'test-class'
        }
      });
    });

    test('should integrate with Network panel', async () => {
      await devToolsManager.initialize();

      expect(chrome.devtools.network.onRequestFinished.addListener)
        .toHaveBeenCalled();
    });

    test('should evaluate code in inspected window', async () => {
      await devToolsManager.initialize();

      chrome.devtools.inspectedWindow.eval.mockImplementation((code, callback) => {
        callback('result', false);
      });

      const result = await devToolsManager.evaluateInPage('document.title');

      expect(chrome.devtools.inspectedWindow.eval).toHaveBeenCalledWith(
        'document.title',
        expect.any(Function)
      );
      expect(result).toBe('result');
    });
  });

  describe('Panel Visibility and Lifecycle', () => {
    test('should track initialization state', () => {
      expect(devToolsManager.isInitialized()).toBe(false);
    });

    test('should update initialization state after setup', async () => {
      const mockPanel = {
        onShown: { addListener: jest.fn() },
        onHidden: { addListener: jest.fn() }
      };

      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      await devToolsManager.initialize();

      expect(devToolsManager.isInitialized()).toBe(true);
    });

    test('should handle multiple initialization attempts', async () => {
      const mockPanel = {
        onShown: { addListener: jest.fn() },
        onHidden: { addListener: jest.fn() }
      };

      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      await devToolsManager.initialize();
      await devToolsManager.initialize(); // Second call

      expect(chrome.devtools.panels.create).toHaveBeenCalledTimes(1);
    });

    test('should cleanup on destroy', async () => {
      const mockPanel = {
        onShown: { addListener: jest.fn() },
        onHidden: { addListener: jest.fn() }
      };

      chrome.devtools.panels.create.mockImplementation((title, icon, page, callback) => {
        callback(mockPanel);
      });

      await devToolsManager.initialize();
      
      const listener = jest.fn();
      devToolsManager.on('test', listener);

      devToolsManager.destroy();

      expect(devToolsManager.isInitialized()).toBe(false);
      expect(devToolsManager.listenerCount('test')).toBe(0);
    });
  });

  describe('Message Communication', () => {
    test('should send messages to background script', async () => {
      await devToolsManager.initialize();

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        if (callback) callback();
      });

      const message = { command: 'inspect', data: { selector: '.test' } };
      await devToolsManager.sendToBackground(message);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        message,
        expect.any(Function)
      );
    });

    test('should handle message responses', async () => {
      await devToolsManager.initialize();

      chrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: 'response' });
      });

      const response = await devToolsManager.sendToBackground({ command: 'test' });

      expect(response).toEqual({ success: true, data: 'response' });
    });

    test('should listen for messages from background', async () => {
      let messageListener;
      chrome.runtime.onMessage.addListener.mockImplementation(cb => {
        messageListener = cb;
      });

      const messageHandler = jest.fn();
      devToolsManager.on('background-message', messageHandler);

      await devToolsManager.initialize();

      // Simulate message from background
      const message = { type: 'update', data: { status: 'connected' } };
      messageListener(message, { tab: { id: 123 } }, () => {});

      expect(messageHandler).toHaveBeenCalledWith(message);
    });
  });
});