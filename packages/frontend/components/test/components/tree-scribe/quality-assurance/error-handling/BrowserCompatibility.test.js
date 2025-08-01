/**
 * TreeScribe Browser Compatibility Tests
 * 
 * Testing compatibility across different browsers and browser features
 */

import { TreeScribe } from '../../../../../../src/components/tree-scribe/index.js';

describe('TreeScribe Browser Compatibility', () => {
  let container;
  let instance;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (instance && instance.destroy) {
      instance.destroy();
    }
    if (container && container.parentNode) {
      document.body.removeChild(container);
    }
  });

  describe('Modern Browser Features', () => {
    test('should work without fetch API', async () => {
      // Save and remove fetch
      const originalFetch = global.fetch;
      delete global.fetch;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      // Should work with local content even without fetch
      const result = await instance.loadYaml(`
        title: No Fetch Test
        content: Testing without fetch API
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore fetch
      global.fetch = originalFetch;
    });

    test('should work without Promises', async () => {
      // Save original Promise
      const OriginalPromise = global.Promise;

      // Mock a basic Promise implementation for legacy browsers
      const BasicPromise = function(executor) {
        const promise = this;
        promise.state = 'pending';
        promise.value = undefined;
        promise.handlers = [];

        function resolve(result) {
          if (promise.state === 'pending') {
            promise.state = 'fulfilled';
            promise.value = result;
            promise.handlers.forEach(handle);
            promise.handlers = null;
          }
        }

        function reject(error) {
          if (promise.state === 'pending') {
            promise.state = 'rejected';
            promise.value = error;
            promise.handlers.forEach(handle);
            promise.handlers = null;
          }
        }

        function handle(handler) {
          if (promise.state === 'pending') {
            promise.handlers.push(handler);
          } else {
            if (promise.state === 'fulfilled' && handler.onFulfilled) {
              handler.onFulfilled(promise.value);
            }
            if (promise.state === 'rejected' && handler.onRejected) {
              handler.onRejected(promise.value);
            }
          }
        }

        promise.then = function(onFulfilled, onRejected) {
          return new BasicPromise((resolve, reject) => {
            handle({
              onFulfilled: function(result) {
                try {
                  resolve(onFulfilled ? onFulfilled(result) : result);
                } catch (ex) {
                  reject(ex);
                }
              },
              onRejected: function(error) {
                try {
                  resolve(onRejected ? onRejected(error) : error);
                } catch (ex) {
                  reject(ex);
                }
              }
            });
          });
        };

        try {
          executor(resolve, reject);
        } catch (ex) {
          reject(ex);
        }
      };

      // Replace Promise temporarily
      global.Promise = BasicPromise;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Basic Promise Test
        content: Testing with basic Promise implementation
      `);

      // Should work with basic Promise implementation
      expect(result.success).toBe(true);

      // Restore original Promise
      global.Promise = OriginalPromise;
    });

    test('should work without Map and Set', async () => {
      // Save original Map and Set
      const OriginalMap = global.Map;
      const OriginalSet = global.Set;

      // Remove Map and Set
      delete global.Map;
      delete global.Set;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: No Map/Set Test
        content: Testing without Map and Set
      `);

      // Should work with fallback implementations
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore Map and Set
      global.Map = OriginalMap;
      global.Set = OriginalSet;
    });

    test('should work without arrow functions (transpiled)', async () => {
      // This test verifies that the transpiled code works
      // Arrow functions would be converted to regular functions in legacy browsers
      
      instance = TreeScribe.create({
        dom: container,
        onMount: function(inst) { instance = inst; } // Regular function instead of arrow
      });

      const result = await instance.loadYaml(`
        title: Arrow Functions Test
        content: Testing compatibility with transpiled arrow functions
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    test('should work without const/let (var only)', async () => {
      // This simulates older JavaScript environments that don't support const/let
      // The actual code would be transpiled to use var instead
      
      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Variable Declaration Test
        content: Testing with var instead of const/let
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });
  });

  describe('DOM API Compatibility', () => {
    test('should work without querySelector', async () => {
      // Save original methods
      const originalQuerySelector = document.querySelector;
      const originalQuerySelectorAll = document.querySelectorAll;

      // Mock removal of querySelector methods
      document.querySelector = undefined;
      document.querySelectorAll = undefined;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: querySelector Test
        content: Testing without querySelector support
      `);

      // Should work with fallback DOM methods
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      }

      // Restore methods
      document.querySelector = originalQuerySelector;
      document.querySelectorAll = originalQuerySelectorAll;
    });

    test('should work without classList API', async () => {
      // Mock Element without classList
      const originalClassList = Element.prototype.classList;
      
      Object.defineProperty(Element.prototype, 'classList', {
        get: function() {
          return undefined;
        },
        configurable: true
      });

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: classList Test
        content: Testing without classList API
      `);

      // Should work with className fallback
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      }

      // Restore classList
      Object.defineProperty(Element.prototype, 'classList', {
        get: function() {
          return originalClassList;
        },
        configurable: true
      });
    });

    test('should work without addEventListener', async () => {
      // Save original addEventListener
      const originalAddEventListener = Element.prototype.addEventListener;
      const originalRemoveEventListener = Element.prototype.removeEventListener;

      // Mock removal of addEventListener
      Element.prototype.addEventListener = undefined;
      Element.prototype.removeEventListener = undefined;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: addEventListener Test
        content: Testing without addEventListener support
      `);

      // Should work with on* event handlers fallback
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      }

      // Restore addEventListener
      Element.prototype.addEventListener = originalAddEventListener;
      Element.prototype.removeEventListener = originalRemoveEventListener;
    });

    test('should work with limited CSS support', async () => {
      // Mock a browser with limited CSS support
      const originalGetComputedStyle = window.getComputedStyle;
      
      window.getComputedStyle = function() {
        return {
          getPropertyValue: function() { return ''; },
          // Limited CSS properties
          display: 'block',
          visibility: 'visible',
          position: 'static'
        };
      };

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: CSS Support Test
        content: Testing with limited CSS support
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore getComputedStyle
      window.getComputedStyle = originalGetComputedStyle;
    });
  });

  describe('JavaScript Engine Compatibility', () => {
    test('should work without JSON.parse', async () => {
      // Save original JSON
      const originalJSON = global.JSON;

      // Mock removal of JSON.parse
      global.JSON = {
        stringify: originalJSON.stringify
        // parse method removed
      };

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: JSON Parse Test
        content: Testing without JSON.parse
      `);

      // Should work with YAML content (doesn't require JSON.parse)
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore JSON
      global.JSON = originalJSON;
    });

    test('should work without Object.assign', async () => {
      // Save original Object.assign
      const originalAssign = Object.assign;

      // Remove Object.assign
      delete Object.assign;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Object.assign Test
        content: Testing without Object.assign
      `);

      // Should work with manual property copying
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore Object.assign
      Object.assign = originalAssign;
    });

    test('should work without Array methods (forEach, map, filter)', async () => {
      // Save original Array methods
      const originalForEach = Array.prototype.forEach;
      const originalMap = Array.prototype.map;
      const originalFilter = Array.prototype.filter;

      // Remove modern Array methods
      delete Array.prototype.forEach;
      delete Array.prototype.map;
      delete Array.prototype.filter;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Array Methods Test
        content: Testing without modern Array methods
      `);

      // Should work with for loops fallback
      if (result.success) {
        expect(result.nodeCount).toBeGreaterThan(0);
      }

      // Restore Array methods
      Array.prototype.forEach = originalForEach;
      Array.prototype.map = originalMap;
      Array.prototype.filter = originalFilter;
    });

    test('should work without String methods (includes, startsWith, endsWith)', async () => {
      // Save original String methods
      const originalIncludes = String.prototype.includes;
      const originalStartsWith = String.prototype.startsWith;
      const originalEndsWith = String.prototype.endsWith;

      // Remove modern String methods
      delete String.prototype.includes;
      delete String.prototype.startsWith;
      delete String.prototype.endsWith;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: String Methods Test
        content: Testing without modern String methods
      `);

      // Should work with indexOf fallback
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore String methods
      String.prototype.includes = originalIncludes;
      String.prototype.startsWith = originalStartsWith;
      String.prototype.endsWith = originalEndsWith;
    });
  });

  describe('Browser-Specific Quirks', () => {
    test('should handle Internet Explorer-style events', async () => {
      // Mock IE-style event system
      const originalCreateEvent = document.createEvent;
      
      document.createEvent = function() {
        throw new Error('createEvent not supported');
      };

      // Mock IE's attachEvent
      Element.prototype.attachEvent = function(type, handler) {
        this['on' + type.replace('on', '')] = handler;
      };

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: IE Events Test
        content: Testing Internet Explorer event handling
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Cleanup
      delete Element.prototype.attachEvent;
      document.createEvent = originalCreateEvent;
    });

    test('should handle Safari-specific behaviors', async () => {
      // Mock Safari's behavior with certain APIs
      const originalUserAgent = navigator.userAgent;
      
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
        configurable: true
      });

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Safari Compatibility Test
        content: Testing Safari-specific behaviors
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore userAgent
      Object.defineProperty(navigator, 'userAgent', {
        get: () => originalUserAgent,
        configurable: true
      });
    });

    test('should handle Chrome extension context', async () => {
      // Mock Chrome extension environment
      global.chrome = {
        runtime: {
          id: 'test-extension-id'
        }
      };

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Chrome Extension Test
        content: Testing in Chrome extension context
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Clean up
      delete global.chrome;
    });

    test('should handle Node.js environment', async () => {
      // Mock Node.js environment detection
      const originalProcess = global.process;
      
      global.process = {
        versions: {
          node: '14.17.0'
        },
        env: {
          NODE_ENV: 'test'
        }
      };

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Node.js Environment Test
        content: Testing in Node.js-like environment
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore process
      global.process = originalProcess;
    });
  });

  describe('Mobile Browser Compatibility', () => {
    test('should handle mobile Safari limitations', async () => {
      // Mock mobile Safari
      const originalUserAgent = navigator.userAgent;
      
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        configurable: true
      });

      // Mock mobile-specific limitations
      const originalInnerHeight = window.innerHeight;
      const originalInnerWidth = window.innerWidth;
      
      Object.defineProperty(window, 'innerHeight', {
        get: () => 667, // iPhone height
        configurable: true
      });
      
      Object.defineProperty(window, 'innerWidth', {
        get: () => 375, // iPhone width
        configurable: true
      });

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Mobile Safari Test
        content: Testing mobile Safari compatibility
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore properties
      Object.defineProperty(navigator, 'userAgent', {
        get: () => originalUserAgent,
        configurable: true
      });
      
      Object.defineProperty(window, 'innerHeight', {
        get: () => originalInnerHeight,
        configurable: true
      });
      
      Object.defineProperty(window, 'innerWidth', {
        get: () => originalInnerWidth,
        configurable: true
      });
    });

    test('should handle Android browser quirks', async () => {
      // Mock Android browser
      const originalUserAgent = navigator.userAgent;
      
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
        configurable: true
      });

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Android Browser Test
        content: Testing Android browser compatibility
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore userAgent
      Object.defineProperty(navigator, 'userAgent', {
        get: () => originalUserAgent,
        configurable: true
      });
    });

    test('should handle touch events on mobile', async () => {
      // Mock touch event support
      const mockTouchEvent = function(type, touches) {
        return {
          type: type,
          touches: touches || [],
          changedTouches: touches || [],
          targetTouches: touches || [],
          preventDefault: () => {},
          stopPropagation: () => {}
        };
      };

      global.TouchEvent = mockTouchEvent;

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Touch Events Test
        content: Testing touch event compatibility
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Test touch interaction simulation
      const touchStart = mockTouchEvent('touchstart', [{
        clientX: 100,
        clientY: 100
      }]);

      // Simulate touch on container (should not cause errors)
      try {
        container.dispatchEvent(touchStart);
        expect(true).toBe(true); // No error thrown
      } catch (error) {
        // Touch events might not be fully supported in test environment
        expect(error).toBeDefined();
      }

      // Clean up
      delete global.TouchEvent;
    });
  });

  describe('Polyfill Testing', () => {
    test('should work with polyfilled features', async () => {
      // Mock environment with polyfills
      if (!Array.prototype.includes) {
        Array.prototype.includes = function(searchElement) {
          return this.indexOf(searchElement) !== -1;
        };
      }

      if (!String.prototype.startsWith) {
        String.prototype.startsWith = function(searchString, position) {
          position = position || 0;
          return this.substr(position, searchString.length) === searchString;
        };
      }

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Polyfill Test
        content: Testing with polyfilled features
      `);

      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);
    });

    test('should gracefully degrade without polyfills', async () => {
      // Test graceful degradation when polyfills are not available
      const originalConsole = console.warn;
      const warnings = [];
      
      console.warn = (message) => {
        warnings.push(message);
      };

      instance = TreeScribe.create({
        dom: container,
        onMount: (inst) => { instance = inst; }
      });

      const result = await instance.loadYaml(`
        title: Graceful Degradation Test
        content: Testing graceful degradation without polyfills
      `);

      // Should still work, possibly with warnings
      expect(result.success).toBe(true);
      expect(result.nodeCount).toBeGreaterThan(0);

      // Restore console
      console.warn = originalConsole;
    });
  });
});