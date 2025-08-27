/**
 * @fileoverview Unit tests for FrontendInjector - Frontend log capture script generation
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { FrontendInjector } from '../../src/injectors/FrontendInjector.js';

describe('FrontendInjector', () => {
  let frontendInjector;
  let mockWebSocketUrl;

  beforeEach(() => {
    mockWebSocketUrl = 'ws://localhost:8080';
    frontendInjector = new FrontendInjector();
  });

  describe('Constructor', () => {
    it('should create FrontendInjector instance', () => {
      expect(frontendInjector).toBeInstanceOf(FrontendInjector);
    });

    it('should have default configuration', () => {
      expect(frontendInjector.config).toBeDefined();
      expect(frontendInjector.config.captureConsole).toBe(true);
      expect(frontendInjector.config.captureErrors).toBe(true);
      expect(frontendInjector.config.captureNetwork).toBe(true);
      expect(frontendInjector.config.capturePerformance).toBe(false);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        captureConsole: false,
        captureErrors: true,
        captureNetwork: false,
        capturePerformance: true
      };
      
      const customInjector = new FrontendInjector(customConfig);
      
      expect(customInjector.config.captureConsole).toBe(false);
      expect(customInjector.config.capturePerformance).toBe(true);
    });
  });

  describe('Script Generation', () => {
    it('should generate injection script', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toBeTruthy();
      expect(script).toContain('WebSocket');
      expect(script).toContain(mockWebSocketUrl);
    });

    it('should include IIFE wrapper', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toMatch(/^\(function\(\)/);
      expect(script).toMatch(/\}\)\(\);?$/);
    });

    it('should include session ID parameter', () => {
      const sessionId = 'session-123';
      const script = frontendInjector.generateScript(mockWebSocketUrl, { sessionId });
      
      expect(script).toContain(sessionId);
    });

    it('should be valid JavaScript', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      // This will throw if invalid JavaScript
      expect(() => new Function(script)).not.toThrow();
    });
  });

  describe('Console Capture', () => {
    it('should generate console capture code when enabled', () => {
      frontendInjector.config.captureConsole = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('console.log');
      expect(script).toContain('console.error');
      expect(script).toContain('console.warn');
      expect(script).toContain('console.info');
    });

    it('should skip console capture when disabled', () => {
      frontendInjector.config.captureConsole = false;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).not.toContain('originalLog');
    });

    it('should preserve original console methods', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('original');
      expect(script).toContain('apply');
    });

    it('should include stack traces for errors', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('stack');
      expect(script).toContain('Error().stack');
    });
  });

  describe('Error Capture', () => {
    it('should generate error capture code when enabled', () => {
      frontendInjector.config.captureErrors = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('window.addEventListener');
      expect(script).toContain('error');
      expect(script).toContain('unhandledrejection');
    });

    it('should skip error capture when disabled', () => {
      frontendInjector.config.captureErrors = false;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).not.toContain('unhandledrejection');
    });

    it('should capture error details', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('message');
      expect(script).toContain('filename');
      expect(script).toContain('lineno');
      expect(script).toContain('colno');
    });
  });

  describe('Network Capture', () => {
    it('should generate fetch interception when enabled', () => {
      frontendInjector.config.captureNetwork = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('fetch');
      expect(script).toContain('originalFetch');
    });

    it('should generate XMLHttpRequest interception', () => {
      frontendInjector.config.captureNetwork = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('XMLHttpRequest');
      expect(script).toContain('open');
      expect(script).toContain('send');
    });

    it('should skip network capture when disabled', () => {
      frontendInjector.config.captureNetwork = false;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).not.toContain('originalFetch');
      expect(script).not.toContain('XMLHttpRequest.prototype');
    });

    it('should capture request and response details', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('method');
      expect(script).toContain('url');
      expect(script).toContain('status');
      expect(script).toContain('duration');
    });
  });

  describe('Performance Capture', () => {
    it('should generate performance capture when enabled', () => {
      frontendInjector.config.capturePerformance = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('performance');
      expect(script).toContain('PerformanceObserver');
    });

    it('should skip performance capture when disabled', () => {
      frontendInjector.config.capturePerformance = false;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).not.toContain('PerformanceObserver');
    });

    it('should observe multiple entry types', () => {
      frontendInjector.config.capturePerformance = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('navigation');
      expect(script).toContain('resource');
    });
  });

  describe('WebSocket Communication', () => {
    it('should include WebSocket connection logic', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('new WebSocket');
      expect(script).toContain('ws.send');
    });

    it('should handle reconnection', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('reconnect');
      expect(script).toContain('setTimeout');
    });

    it('should batch messages', () => {
      frontendInjector.config.batchSize = 10;
      frontendInjector.config.batchInterval = 1000;
      
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('batch');
      expect(script).toContain('flush');
    });

    it('should queue messages when disconnected', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('queue');
      expect(script).toContain('readyState');
    });
  });

  describe('Script Injection', () => {
    it('should generate HTML script tag', () => {
      const scriptTag = frontendInjector.generateScriptTag(mockWebSocketUrl);
      
      expect(scriptTag).toContain('<script');
      expect(scriptTag).toContain('</script>');
    });

    it('should include data attributes for configuration', () => {
      const options = {
        sessionId: 'session-123',
        debug: true
      };
      
      const scriptTag = frontendInjector.generateScriptTag(mockWebSocketUrl, options);
      
      expect(scriptTag).toContain('data-session-id="session-123"');
      expect(scriptTag).toContain('data-debug="true"');
    });

    it('should generate minified script option', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl, { minify: true });
      
      // Minified script should have no unnecessary whitespace
      expect(script).not.toMatch(/\n\s{2,}/);
    });

    it('should generate inline CSS for debug mode', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl, { debug: true });
      
      expect(script).toContain('position: fixed');
      expect(script).toContain('background');
      expect(script).toContain('z-index');
    });
  });

  describe('Browser Compatibility', () => {
    it('should include polyfills for older browsers', () => {
      frontendInjector.config.includePolyfills = true;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('typeof WebSocket');
      expect(script).toContain('typeof fetch');
    });

    it('should check for WebSocket support', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain("'WebSocket' in window");
    });

    it('should gracefully degrade without WebSocket', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('console.warn');
      expect(script).toContain('WebSocket not supported');
    });
  });

  describe('Security', () => {
    it('should not expose sensitive data', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).not.toContain('password');
      expect(script).not.toContain('token');
      expect(script).not.toContain('secret');
    });

    it('should sanitize user input', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('replace');
      expect(script).toContain('escape');
    });

    it('should respect CORS', () => {
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('credentials');
      expect(script).toContain('same-origin');
    });
  });

  describe('Configuration Options', () => {
    it('should support custom log levels', () => {
      frontendInjector.config.logLevels = ['error', 'warn'];
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('console.error');
      expect(script).toContain('console.warn');
      expect(script).not.toContain('originalLog'); // Check for log interception
      expect(script).not.toContain('originalInfo'); // Check for info interception
    });

    it('should support filtering by URL pattern', () => {
      frontendInjector.config.urlFilter = '^/api/';
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('urlFilter');
      expect(script).toContain('test'); // Using test() method for regex
    });

    it('should support max message size', () => {
      frontendInjector.config.maxMessageSize = 10000;
      const script = frontendInjector.generateScript(mockWebSocketUrl);
      
      expect(script).toContain('10000');
      expect(script).toContain('substring');
    });

    it('should support custom metadata', () => {
      const metadata = {
        appVersion: '1.0.0',
        environment: 'development'
      };
      
      const script = frontendInjector.generateScript(mockWebSocketUrl, { metadata });
      
      expect(script).toContain('appVersion');
      expect(script).toContain('1.0.0');
    });
  });
});