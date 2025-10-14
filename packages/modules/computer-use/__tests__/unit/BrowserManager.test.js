/**
 * Unit tests for BrowserManager (logic only, no browser mocking)
 */

import { jest } from '@jest/globals';
import { BrowserManager } from '../../src/BrowserManager.js';

describe('BrowserManager', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
    };
  });

  describe('Constructor', () => {
    test('should initialize with default options', () => {
      const browserManager = new BrowserManager({}, mockLogger);

      expect(browserManager.headless).toBe(false);
      expect(browserManager.width).toBe(1440);
      expect(browserManager.height).toBe(900);
      expect(browserManager.startUrl).toBe('https://www.google.com');
    });

    test('should initialize with custom options', () => {
      const browserManager = new BrowserManager(
        {
          headless: true,
          width: 1024,
          height: 768,
          startUrl: 'https://example.com',
          outDir: '/tmp/test',
        },
        mockLogger
      );

      expect(browserManager.headless).toBe(true);
      expect(browserManager.width).toBe(1024);
      expect(browserManager.height).toBe(768);
      expect(browserManager.startUrl).toBe('https://example.com');
      expect(browserManager.outDir).toBe('/tmp/test');
    });

    test('should initialize counters', () => {
      const browserManager = new BrowserManager({}, mockLogger);

      expect(browserManager.shotCounter).toBe(0);
      expect(browserManager.recentRequests).toEqual([]);
    });

    test('should store logger', () => {
      const browserManager = new BrowserManager({}, mockLogger);

      expect(browserManager.logger).toBe(mockLogger);
    });
  });

  describe('Options', () => {
    test('should use fallback for null start URL', () => {
      const browserManager = new BrowserManager({ startUrl: null }, mockLogger);

      // Uses ?? operator, so null becomes default
      expect(browserManager.startUrl).toBe('https://www.google.com');
    });

    test('should accept custom output directory', () => {
      const customDir = '/custom/output/path';
      const browserManager = new BrowserManager({ outDir: customDir }, mockLogger);

      expect(browserManager.outDir).toBe(customDir);
    });
  });
});
