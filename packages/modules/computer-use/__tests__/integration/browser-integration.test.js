/**
 * Integration tests for browser functionality
 * Tests real Playwright browser with actual DOM interactions
 */

import { jest } from '@jest/globals';
import { ResourceManager } from '@legion/resource-manager';
import { BrowserManager } from '../../src/BrowserManager.js';
import { ActionExecutor } from '../../src/actions/ActionExecutor.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Browser Integration Tests', () => {
  let browserManager;
  let actionExecutor;
  let mockLogger;
  const testOutDir = path.join(__dirname, '../tmp/browser-integration');

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
    };
  });

  afterEach(async () => {
    if (browserManager) {
      await browserManager.cleanup();
      browserManager = null;
    }
  });

  test('should launch browser and navigate to URL', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        width: 1024,
        height: 768,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const page = browserManager.getPage();
    const url = page.url();

    expect(url).toContain('example.com');
  }, 30000);

  test('should take screenshot', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const screenshot = await browserManager.screenshot('test');

    expect(screenshot).toBeInstanceOf(Buffer);
    expect(screenshot.length).toBeGreaterThan(0);
  }, 30000);

  test('should get state snapshot with real page', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const snapshot = await browserManager.getStateSnapshot();

    expect(snapshot.url).toContain('example.com');
    expect(snapshot.viewport).toEqual({ width: 1440, height: 900 });
    expect(snapshot.ax).toBeDefined();
    expect(snapshot.dom).toBeDefined();
    expect(Array.isArray(snapshot.ax)).toBe(true);
  }, 30000);

  test('should execute action on real page', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const page = browserManager.getPage();
    actionExecutor = new ActionExecutor(page, mockLogger, {
      width: 1440,
      height: 900,
    });

    // Execute navigate action
    await actionExecutor.execute('navigate', { url: 'https://example.com' });

    const url = page.url();
    expect(url).toContain('example.com');
  }, 30000);

  test('should handle scroll actions', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const page = browserManager.getPage();
    actionExecutor = new ActionExecutor(page, mockLogger);

    // Execute scroll action
    await expect(
      actionExecutor.execute('scroll_document', { direction: 'down' })
    ).resolves.not.toThrow();
  }, 30000);

  test('should handle wait action', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const page = browserManager.getPage();
    actionExecutor = new ActionExecutor(page, mockLogger);

    const start = Date.now();
    await actionExecutor.execute('wait_5_seconds', {});
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(4900); // Allow some margin
  }, 35000);

  test('should handle navigation history actions', async () => {
    browserManager = new BrowserManager(
      {
        headless: true,
        startUrl: 'https://example.com',
        outDir: testOutDir,
      },
      mockLogger
    );

    await browserManager.initialize();

    const page = browserManager.getPage();
    actionExecutor = new ActionExecutor(page, mockLogger);

    // Navigate to another page
    await actionExecutor.execute('navigate', { url: 'https://www.iana.org' });

    // Go back
    await expect(actionExecutor.execute('go_back', {})).resolves.not.toThrow();

    const url = page.url();
    expect(url).toContain('example.com');
  }, 30000);
});
