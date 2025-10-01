/**
 * JSDOM Environment Helper
 *
 * Provides easy setup and teardown of JSDOM environment for testing browser-side actors.
 * Automatically configures global objects and cleans up after tests.
 */

import { JSDOM } from 'jsdom';

export class JSDOMEnvironment {
  constructor(options = {}) {
    this.options = {
      html: options.html || `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Test Environment</title>
          </head>
          <body>
            <div id="app"></div>
          </body>
        </html>
      `,
      url: options.url || 'http://localhost:3000',
      runScripts: options.runScripts || 'dangerously',
      resources: options.resources || 'usable',
      pretendToBeVisual: options.pretendToBeVisual ?? true,
      ...options
    };

    this.dom = null;
    this.savedGlobals = {};
  }

  /**
   * Setup the JSDOM environment
   */
  setup() {
    // Create JSDOM instance
    this.dom = new JSDOM(this.options.html, {
      url: this.options.url,
      runScripts: this.options.runScripts,
      resources: this.options.resources,
      pretendToBeVisual: this.options.pretendToBeVisual
    });

    // Save existing globals
    const globalsToSet = [
      'window',
      'document',
      'navigator',
      'Element',
      'HTMLElement',
      'Node',
      'NodeList',
      'Event',
      'CustomEvent',
      'MouseEvent',
      'KeyboardEvent',
      'FocusEvent',
      'InputEvent',
      'EventTarget',
      'DOMParser',
      'XMLSerializer',
      'FormData',
      'Blob',
      'File',
      'FileReader',
      'URL',
      'URLSearchParams',
      'localStorage',
      'sessionStorage',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval'
    ];

    globalsToSet.forEach(key => {
      if (key in global) {
        this.savedGlobals[key] = global[key];
      }
    });

    // Set globals from JSDOM
    global.window = this.dom.window;
    global.document = this.dom.window.document;
    global.navigator = this.dom.window.navigator;

    // Copy common browser APIs
    Object.getOwnPropertyNames(this.dom.window).forEach(property => {
      if (typeof global[property] === 'undefined' && property !== 'undefined') {
        global[property] = this.dom.window[property];
      }
    });

    // Mock additional APIs if needed
    this.mockAdditionalAPIs();
  }

  /**
   * Mock additional browser APIs that JSDOM doesn't provide
   */
  mockAdditionalAPIs() {
    // Mock ResizeObserver
    if (!global.ResizeObserver) {
      global.ResizeObserver = class ResizeObserver {
        constructor(callback) {
          this.callback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    // Mock IntersectionObserver
    if (!global.IntersectionObserver) {
      global.IntersectionObserver = class IntersectionObserver {
        constructor(callback) {
          this.callback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      };
    }

    // Mock matchMedia
    if (!global.matchMedia) {
      global.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true
      });
    }

    // Mock requestAnimationFrame/cancelAnimationFrame
    if (!global.requestAnimationFrame) {
      let lastTime = 0;
      global.requestAnimationFrame = (callback) => {
        const currTime = Date.now();
        const timeToCall = Math.max(0, 16 - (currTime - lastTime));
        const id = setTimeout(() => callback(currTime + timeToCall), timeToCall);
        lastTime = currTime + timeToCall;
        return id;
      };
    }

    if (!global.cancelAnimationFrame) {
      global.cancelAnimationFrame = (id) => clearTimeout(id);
    }
  }

  /**
   * Get the JSDOM document
   */
  getDocument() {
    if (!this.dom) {
      throw new Error('JSDOM not initialized. Call setup() first.');
    }
    return this.dom.window.document;
  }

  /**
   * Get the JSDOM window
   */
  getWindow() {
    if (!this.dom) {
      throw new Error('JSDOM not initialized. Call setup() first.');
    }
    return this.dom.window;
  }

  /**
   * Create an element
   */
  createElement(tagName, attributes = {}) {
    const element = this.getDocument().createElement(tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'textContent') {
        element.textContent = value;
      } else if (key === 'innerHTML') {
        element.innerHTML = value;
      } else {
        element.setAttribute(key, value);
      }
    });
    return element;
  }

  /**
   * Query selector
   */
  querySelector(selector) {
    return this.getDocument().querySelector(selector);
  }

  /**
   * Query all
   */
  querySelectorAll(selector) {
    return this.getDocument().querySelectorAll(selector);
  }

  /**
   * Get element by ID
   */
  getElementById(id) {
    return this.getDocument().getElementById(id);
  }

  /**
   * Simulate event on element
   */
  simulateEvent(element, eventType, eventInit = {}) {
    const event = new this.dom.window.Event(eventType, {
      bubbles: true,
      cancelable: true,
      ...eventInit
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate click on element
   */
  simulateClick(element) {
    const event = new this.dom.window.MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: this.dom.window
    });
    element.dispatchEvent(event);
  }

  /**
   * Simulate input on element
   */
  simulateInput(element, value) {
    element.value = value;
    const event = new this.dom.window.Event('input', {
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  }

  /**
   * Teardown and restore globals
   */
  teardown() {
    if (!this.dom) {
      return;
    }

    // Close JSDOM
    this.dom.window.close();

    // Restore saved globals
    Object.keys(this.savedGlobals).forEach(key => {
      global[key] = this.savedGlobals[key];
    });

    // Remove globals that didn't exist before
    const globalsToRemove = ['window', 'document', 'navigator'];
    globalsToRemove.forEach(key => {
      if (!(key in this.savedGlobals)) {
        delete global[key];
      }
    });

    this.dom = null;
    this.savedGlobals = {};
  }
}
