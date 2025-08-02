/**
 * JSDOM Setup for Umbilical Testing Framework
 * Provides proper DOM environment for testing UI components
 */

import { JSDOM } from 'jsdom';

/**
 * Initialize JSDOM environment for testing
 * @param {Object} options - Configuration options
 * @returns {Object} JSDOM instance and utilities
 */
export function setupJSDOM(options = {}) {
  const html = options.html || '<!DOCTYPE html><html><body><div id="app"></div></body></html>';
  
  const dom = new JSDOM(html, {
    url: options.url || 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable',
    runScripts: 'dangerously',
    beforeParse(window) {
      // Add any polyfills or mocks here
      window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
    }
  });

  const { window } = dom;
  const { document } = window;

  // Make DOM globals available
  global.window = window;
  global.document = document;
  global.HTMLElement = window.HTMLElement;
  global.Element = window.Element;
  global.Node = window.Node;
  global.NodeList = window.NodeList;
  global.Event = window.Event;
  global.KeyboardEvent = window.KeyboardEvent;
  global.MouseEvent = window.MouseEvent;
  global.InputEvent = window.InputEvent;
  global.CustomEvent = window.CustomEvent;
  global.DOMParser = window.DOMParser;
  global.getComputedStyle = window.getComputedStyle;
  global.requestAnimationFrame = window.requestAnimationFrame;
  global.cancelAnimationFrame = window.cancelAnimationFrame;

  // Add useful testing utilities
  const utils = {
    /**
     * Simulate user typing in an input element
     */
    simulateTyping(element, text) {
      if (!element) return;
      
      // Set the value directly first
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.value = text;
        
        // Create a more realistic input event with proper target
        const inputEvent = new window.Event('input', {
          bubbles: true,
          cancelable: true
        });
        
        // Ensure the event target has the correct value
        Object.defineProperty(inputEvent, 'target', {
          value: element,
          enumerable: true
        });
        
        element.dispatchEvent(inputEvent);
      } else if (element.contentEditable === 'true') {
        element.textContent = text;
        
        const inputEvent = new window.InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: text
        });
        element.dispatchEvent(inputEvent);
      }
      
      // Also dispatch change event for completeness
      const changeEvent = new window.Event('change', {
        bubbles: true,
        cancelable: true
      });
      element.dispatchEvent(changeEvent);
    },

    /**
     * Simulate key press
     */
    simulateKeyPress(element, key, options = {}) {
      if (!element) return;
      
      const keydownEvent = new window.KeyboardEvent('keydown', {
        key: key,
        code: options.code || key,
        keyCode: options.keyCode || key.charCodeAt(0),
        which: options.which || key.charCodeAt(0),
        bubbles: true,
        cancelable: true,
        ...options
      });
      
      const keypressEvent = new window.KeyboardEvent('keypress', {
        key: key,
        code: options.code || key,
        keyCode: options.keyCode || key.charCodeAt(0),
        which: options.which || key.charCodeAt(0),
        bubbles: true,
        cancelable: true,
        ...options
      });
      
      const keyupEvent = new window.KeyboardEvent('keyup', {
        key: key,
        code: options.code || key,
        keyCode: options.keyCode || key.charCodeAt(0),
        which: options.which || key.charCodeAt(0),
        bubbles: true,
        cancelable: true,
        ...options
      });
      
      element.dispatchEvent(keydownEvent);
      if (!keydownEvent.defaultPrevented) {
        element.dispatchEvent(keypressEvent);
      }
      element.dispatchEvent(keyupEvent);
    },

    /**
     * Simulate click
     */
    simulateClick(element, options = {}) {
      if (!element) return;
      
      const clickEvent = new window.MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        ...options
      });
      
      element.dispatchEvent(clickEvent);
    },

    /**
     * Wait for DOM updates
     */
    async waitForDOM(timeout = 0) {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve();
        }, timeout);
      });
    },

    /**
     * Query with retry for async rendering
     */
    async waitForElement(selector, timeout = 1000) {
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const element = document.querySelector(selector);
        if (element) return element;
        await this.waitForDOM(10);
      }
      
      return null;
    },

    /**
     * Get all text content from element
     */
    getTextContent(element) {
      if (!element) return '';
      return element.textContent || element.innerText || '';
    },

    /**
     * Check if element is visible
     */
    isVisible(element) {
      if (!element) return false;
      
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0';
    },

    /**
     * Cleanup JSDOM
     */
    cleanup() {
      dom.window.close();
      delete global.window;
      delete global.document;
      delete global.HTMLElement;
      delete global.Element;
      delete global.Node;
      delete global.NodeList;
      delete global.Event;
      delete global.KeyboardEvent;
      delete global.MouseEvent;
      delete global.InputEvent;
      delete global.CustomEvent;
      delete global.DOMParser;
      delete global.getComputedStyle;
      delete global.requestAnimationFrame;
      delete global.cancelAnimationFrame;
    }
  };

  return {
    dom,
    window,
    document,
    utils
  };
}

/**
 * Create a test container element
 */
export function createTestContainer(document, id = 'test-container') {
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }
  
  const container = document.createElement('div');
  container.id = id;
  document.body.appendChild(container);
  
  return container;
}

/**
 * Mock WebSocket for testing
 */
export class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.listeners = {};
    
    // Simulate connection after a tick
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 0);
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (!this.listeners[event]) return;
    const index = this.listeners[event].indexOf(handler);
    if (index !== -1) {
      this.listeners[event].splice(index, 1);
    }
  }

  dispatchEvent(event) {
    const handlers = this.listeners[event.type] || [];
    handlers.forEach(handler => handler(event));
  }

  send(data) {
    // Store sent data for assertions
    if (!this.sentMessages) {
      this.sentMessages = [];
    }
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event('close'));
  }

  // Simulate receiving a message
  simulateMessage(data) {
    const event = new MessageEvent('message', {
      data: typeof data === 'string' ? data : JSON.stringify(data)
    });
    this.dispatchEvent(event);
  }

  // WebSocket ready states
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
}

// Make MockWebSocket available globally when needed
export function enableMockWebSocket() {
  global.WebSocket = MockWebSocket;
}

export function disableMockWebSocket() {
  delete global.WebSocket;
}