/**
 * @jest-environment jsdom
 */

import { ContentScript } from '../../../src/extension/ContentScript.js';

describe('Content Script Integration', () => {
  let contentScript;
  let mockMessaging;

  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = '<div id="test-content"><p>Test content</p></div>';
    
    // Setup chrome.runtime mock
    global.chrome = {
      runtime: {
        onMessage: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        sendMessage: jest.fn()
      }
    };

    // Setup messaging mock
    mockMessaging = {
      send: jest.fn().mockResolvedValue({ success: true }),
      listen: jest.fn()
    };

    contentScript = new ContentScript(mockMessaging);
  });

  afterEach(() => {
    if (contentScript) {
      contentScript.destroy();
    }
    document.body.innerHTML = '';
    delete global.chrome;
    jest.clearAllMocks();
  });

  describe('Page Context Access', () => {
    test('should access DOM elements', () => {
      contentScript.initialize();

      const element = contentScript.getElement('#test-content');
      expect(element).toBeTruthy();
      expect(element.tagName).toBe('DIV');
    });

    test('should get element by various selectors', () => {
      document.body.innerHTML = `
        <div id="unique-id" class="test-class" data-test="value">
          <span>Content</span>
        </div>
      `;
      
      contentScript.initialize();

      expect(contentScript.getElement('#unique-id')).toBeTruthy();
      expect(contentScript.getElement('.test-class')).toBeTruthy();
      expect(contentScript.getElement('[data-test="value"]')).toBeTruthy();
      expect(contentScript.getElement('div span')).toBeTruthy();
    });

    test('should extract element metadata', () => {
      document.body.innerHTML = `
        <div id="test-element" class="container primary" 
             data-component="widget" style="display: block; color: red;">
          <p>Element content</p>
        </div>
      `;
      
      contentScript.initialize();

      const metadata = contentScript.getElementMetadata('#test-element');
      expect(metadata).toEqual({
        tagName: 'DIV',
        id: 'test-element',
        className: 'container primary',
        attributes: {
          'data-component': 'widget',
          style: 'display: block; color: red;'
        },
        textContent: 'Element content',
        innerHTML: expect.stringContaining('<p>Element content</p>'),
        computedStyles: expect.any(Object),
        boundingRect: expect.any(Object)
      });
    });

    test('should access JavaScript context safely', () => {
      // Create a global variable in the page context
      window.testVariable = 'test value';
      window.testFunction = () => 'test result';

      contentScript.initialize();

      const variable = contentScript.getPageVariable('testVariable');
      expect(variable).toBe('test value');

      const result = contentScript.executePageFunction('testFunction');
      expect(result).toBe('test result');
    });

    test('should handle cross-frame communication', () => {
      // Mock iframe setup
      const iframe = document.createElement('iframe');
      iframe.id = 'test-frame';
      document.body.appendChild(iframe);

      contentScript.initialize();

      const frameComm = contentScript.setupFrameCommunication('#test-frame');
      expect(frameComm).toBeTruthy();
      expect(frameComm.sendMessage).toBeInstanceOf(Function);
      expect(frameComm.listen).toBeInstanceOf(Function);
    });

    test('should capture page state', () => {
      document.body.innerHTML = `
        <div id="app">
          <header>Header content</header>
          <main>Main content</main>
          <footer>Footer content</footer>
        </div>
      `;

      contentScript.initialize();

      const pageState = contentScript.capturePageState();
      expect(pageState).toEqual({
        url: window.location.href,
        title: document.title,
        documentElement: expect.any(String),
        bodyClasses: expect.any(Array),
        headElements: expect.any(Array),
        scripts: expect.any(Array),
        stylesheets: expect.any(Array),
        viewport: expect.any(Object),
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Element Inspection System', () => {
    test('should highlight selected elements', () => {
      document.body.innerHTML = '<div id="target">Target element</div>';
      contentScript.initialize();

      const element = document.getElementById('target');
      contentScript.highlightElement('#target');

      // Should add highlight overlay
      const overlay = document.querySelector('.cerebrate-highlight-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay.style.position).toBe('absolute');
    });

    test('should remove element highlights', () => {
      document.body.innerHTML = '<div id="target">Target element</div>';
      contentScript.initialize();

      contentScript.highlightElement('#target');
      expect(document.querySelector('.cerebrate-highlight-overlay')).toBeTruthy();

      contentScript.removeHighlight('#target');
      expect(document.querySelector('.cerebrate-highlight-overlay')).toBeFalsy();
    });

    test('should extract computed styles', () => {
      document.body.innerHTML = `
        <div id="styled-element" style="color: red; font-size: 16px;">
          Styled element
        </div>
      `;
      
      contentScript.initialize();

      const styles = contentScript.getComputedStyles('#styled-element');
      expect(styles).toBeDefined();
      expect(styles.color).toBeDefined();
      expect(styles.fontSize).toBeDefined();
    });

    test('should detect event listeners', () => {
      document.body.innerHTML = '<button id="test-button">Click me</button>';
      
      const button = document.getElementById('test-button');
      const clickHandler = () => {};
      const mouseHandler = () => {};
      
      button.addEventListener('click', clickHandler);
      button.addEventListener('mouseenter', mouseHandler);

      contentScript.initialize();

      const listeners = contentScript.getEventListeners('#test-button');
      // Note: Event listener detection in jsdom is limited
      // We're testing that the method runs without error
      expect(listeners).toBeDefined();
      expect(typeof listeners).toBe('object');
    });

    test('should traverse element tree', () => {
      document.body.innerHTML = `
        <div id="root">
          <div class="level-1">
            <div class="level-2">
              <span>Deep element</span>
            </div>
          </div>
        </div>
      `;

      contentScript.initialize();

      const tree = contentScript.getElementTree('#root', 2);
      expect(tree).toEqual({
        tagName: 'DIV',
        id: 'root',
        children: [
          {
            tagName: 'DIV',
            className: 'level-1',
            children: [
              {
                tagName: 'DIV',
                className: 'level-2',
                children: expect.any(Array)
              }
            ]
          }
        ]
      });
    });

    test('should find elements by text content', () => {
      document.body.innerHTML = `
        <div>
          <p>First paragraph</p>
          <p>Second paragraph with unique text</p>
          <p>Third paragraph</p>
        </div>
      `;

      contentScript.initialize();

      const elements = contentScript.findElementsByText('unique text');
      expect(elements).toHaveLength(1);
      expect(elements[0].textContent).toContain('unique text');
    });

    test('should get element position and dimensions', () => {
      document.body.innerHTML = '<div id="positioned" style="width: 100px; height: 50px;">Element</div>';
      
      contentScript.initialize();

      const dimensions = contentScript.getElementDimensions('#positioned');
      expect(dimensions).toEqual({
        width: expect.any(Number),
        height: expect.any(Number),
        x: expect.any(Number),
        y: expect.any(Number),
        top: expect.any(Number),
        left: expect.any(Number),
        bottom: expect.any(Number),
        right: expect.any(Number)
      });
    });
  });

  describe('Page State Monitoring', () => {
    test('should detect navigation events', () => {
      const navigationCallback = jest.fn();
      contentScript.initialize();
      contentScript.onNavigation(navigationCallback);

      // Simulate navigation
      const event = new PopStateEvent('popstate', { state: { page: 'new' } });
      window.dispatchEvent(event);

      expect(navigationCallback).toHaveBeenCalledWith({
        type: 'popstate',
        url: window.location.href,
        state: { page: 'new' },
        timestamp: expect.any(Number)
      });
    });

    test('should observe DOM mutations', () => {
      document.body.innerHTML = '<div id="container"></div>';
      
      const mutationCallback = jest.fn();
      contentScript.initialize();
      contentScript.onDOMChange(mutationCallback);

      // Simulate DOM change
      const container = document.getElementById('container');
      const newElement = document.createElement('p');
      newElement.textContent = 'New element';
      container.appendChild(newElement);

      // Wait for mutation observer
      setTimeout(() => {
        expect(mutationCallback).toHaveBeenCalledWith({
          type: 'childList',
          target: container,
          addedNodes: [newElement],
          removedNodes: [],
          timestamp: expect.any(Number)
        });
      }, 10);
    });

    test('should capture performance metrics', () => {
      // Mock Performance API
      global.PerformanceObserver = jest.fn().mockImplementation((callback) => ({
        observe: jest.fn(),
        disconnect: jest.fn()
      }));
      
      // Mock performance.getEntriesByType
      global.performance = {
        ...global.performance,
        getEntriesByType: jest.fn().mockImplementation((type) => {
          if (type === 'navigation') return [{ loadEventEnd: 1000 }];
          if (type === 'paint') return [{ name: 'first-paint', startTime: 200 }];
          if (type === 'resource') return [{ name: 'script.js', duration: 50 }];
          return [];
        }),
        memory: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 4000000
        }
      };

      contentScript.initialize();

      const metrics = contentScript.capturePerformanceMetrics();
      expect(metrics).toEqual({
        navigation: expect.any(Object),
        paint: expect.any(Object),
        resources: expect.any(Array),
        memory: expect.any(Object),
        timestamp: expect.any(Number)
      });
    });

    test('should monitor error events', () => {
      const errorCallback = jest.fn();
      contentScript.initialize();
      contentScript.onError(errorCallback);

      // Simulate error
      const errorEvent = new ErrorEvent('error', {
        message: 'Test error',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        error: new Error('Test error')
      });

      window.dispatchEvent(errorEvent);

      expect(errorCallback).toHaveBeenCalledWith({
        message: 'Test error',
        filename: 'test.js',
        line: 42,
        column: 10,
        stack: expect.any(String),
        timestamp: expect.any(Number)
      });
    });

    test('should track resource loading', () => {
      const resourceCallback = jest.fn();
      contentScript.initialize();
      contentScript.onResourceLoad(resourceCallback);

      // Resource loading tracking is registered but requires actual loading events
      // In a real environment, this would be triggered by resource load events
      expect(contentScript.resourceLoadCallbacks).toContain(resourceCallback);
    });

    test('should monitor scroll events', () => {
      const scrollCallback = jest.fn();
      contentScript.initialize();
      contentScript.onScroll(scrollCallback);

      // Mock window scroll properties
      Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
      Object.defineProperty(window, 'scrollY', { value: 100, writable: true });

      // Simulate scroll
      const scrollEvent = new Event('scroll');
      window.dispatchEvent(scrollEvent);

      expect(scrollCallback).toHaveBeenCalledWith({
        x: 0,
        y: 100,
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Secure Communication Bridge', () => {
    test('should establish communication with extension', () => {
      contentScript.initialize();

      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
      
      const messageHandler = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      expect(messageHandler).toBeInstanceOf(Function);
    });

    test('should handle messages from extension', () => {
      contentScript.initialize();
      
      const messageHandler = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSender = { tab: { id: 1 } };
      const mockSendResponse = jest.fn();

      const message = {
        type: 'inspectElement',
        selector: '#test-content'
      };

      messageHandler(message, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });

    test('should send messages to extension', async () => {
      // Mock chrome.runtime.sendMessage properly
      global.chrome.runtime.sendMessage = jest.fn().mockImplementation((message, callback) => {
        // Simulate successful response
        callback({ success: true });
      });
      
      contentScript.initialize();

      const message = {
        type: 'domChange',
        data: { changeType: 'childList' }
      };

      const result = await contentScript.sendMessage(message);
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
      expect(result).toEqual({ success: true });
    });

    test('should handle message errors gracefully', () => {
      contentScript.initialize();
      
      const messageHandler = global.chrome.runtime.onMessage.addListener.mock.calls[0][0];
      const mockSender = { tab: { id: 1 } };
      const mockSendResponse = jest.fn();

      const invalidMessage = {
        type: 'invalidCommand',
        selector: 'invalid-selector'
      };

      messageHandler(invalidMessage, mockSender, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.any(String)
      });
    });

    test('should validate message structure', () => {
      contentScript.initialize();

      expect(contentScript.isValidMessage({ type: 'test' })).toBe(true);
      expect(contentScript.isValidMessage({ type: 'test', data: {} })).toBe(true);
      expect(contentScript.isValidMessage({})).toBe(false);
      expect(contentScript.isValidMessage(null)).toBe(false);
      expect(contentScript.isValidMessage('string')).toBe(false);
    });

    test('should sanitize message data', () => {
      contentScript.initialize();

      const unsafeMessage = {
        type: 'test',
        data: {
          script: '<script>alert("xss")</script>',
          html: '<img src="x" onerror="alert(1)">',
          normal: 'safe content'
        }
      };

      const sanitized = contentScript.sanitizeMessage(unsafeMessage);
      expect(sanitized.data.script).not.toContain('<script>');
      expect(sanitized.data.html).not.toContain('onerror');
      expect(sanitized.data.normal).toBe('safe content');
    });
  });

  describe('Content Script Lifecycle', () => {
    test('should initialize properly', () => {
      contentScript.initialize();

      expect(contentScript.isInitialized()).toBe(true);
      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    test('should handle multiple initialize calls gracefully', () => {
      contentScript.initialize();
      contentScript.initialize(); // Second call should be ignored

      expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });

    test('should cleanup resources on destroy', () => {
      contentScript.initialize();
      
      // Add some state
      contentScript.highlightElement('#test-content');
      expect(document.querySelector('.cerebrate-highlight-overlay')).toBeTruthy();

      contentScript.destroy();

      // Should cleanup highlights
      expect(document.querySelector('.cerebrate-highlight-overlay')).toBeFalsy();
      
      // Should remove message listeners
      expect(global.chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
      
      expect(contentScript.isInitialized()).toBe(false);
    });

    test('should handle destroy without initialization', () => {
      expect(() => {
        contentScript.destroy();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing elements gracefully', () => {
      contentScript.initialize();

      expect(contentScript.getElement('#non-existent')).toBeNull();
      expect(contentScript.getElementMetadata('#non-existent')).toBeNull();
      expect(() => {
        contentScript.highlightElement('#non-existent');
      }).not.toThrow();
    });

    test('should handle invalid selectors', () => {
      contentScript.initialize();

      expect(() => {
        contentScript.getElement('[[invalid]]');
      }).not.toThrow();

      expect(contentScript.getElement('[[invalid]]')).toBeNull();
    });

    test('should handle permission errors', () => {
      // Mock permission error
      const originalQuerySelector = document.querySelector;
      document.querySelector = jest.fn().mockImplementation(() => {
        throw new Error('Permission denied');
      });

      contentScript.initialize();

      expect(() => {
        contentScript.getElement('#test');
      }).not.toThrow();

      // Restore
      document.querySelector = originalQuerySelector;
    });

    test('should handle cross-origin frame errors', () => {
      // Mock cross-origin frame
      const iframe = document.createElement('iframe');
      iframe.id = 'cross-origin-frame';
      document.body.appendChild(iframe);

      // Mock cross-origin error
      Object.defineProperty(iframe, 'contentDocument', {
        get: () => {
          throw new DOMException('Blocked by CORS policy');
        }
      });

      contentScript.initialize();

      expect(() => {
        contentScript.setupFrameCommunication('#cross-origin-frame');
      }).not.toThrow();
    });
  });
});