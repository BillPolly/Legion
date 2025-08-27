/**
 * Simple Browser Integration Test
 * Tests that BrowserTestingPhase works with @legion/playwright integration
 */

import { CodeAgent } from '../../../src/agent/CodeAgent.js';
import fs from 'fs/promises';
import path from 'path';

describe('Browser Integration', () => {
  let codeAgent;
  let testWorkingDir;

  beforeAll(async () => {
    // Create temporary test directory
    testWorkingDir = path.join(process.cwd(), 'temp', 'browser-test-' + Date.now());
    await fs.mkdir(testWorkingDir, { recursive: true });
  });

  beforeEach(async () => {
    // Create CodeAgent instance with browser config and minimal LLM config
    codeAgent = new CodeAgent({
      workingDirectory: testWorkingDir,
      browser: {
        browserType: 'chromium',
        headless: true,
        timeout: 10000,
        retries: 1
      },
      llmConfig: {
        provider: 'mock',
        apiKey: 'test-key'
      },
      enableConsoleOutput: false
    });

    await codeAgent.initialize();
  });

  afterEach(async () => {
    // Cleanup browser resources
    if (codeAgent && codeAgent.browserTestingPhase) {
      await codeAgent.browserTestingPhase.cleanup();
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rm(testWorkingDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Could not clean up test directory:', error.message);
    }
  });

  test('should initialize browser testing phase', () => {
    expect(codeAgent.browserTestingPhase).toBeDefined();
    expect(codeAgent.browserTestingPhase.constructor.name).toBe('BrowserTestingPhase');
    expect(codeAgent.browserTestingPhase.browser).toBeDefined();
  });

  test('should start browser testing session', async () => {
    await codeAgent.browserTestingPhase.startSession();
    
    expect(codeAgent.browserTestingPhase.sessionStarted).toBeDefined();
    expect(codeAgent.browserTestingPhase.sessionStarted).toBeInstanceOf(Date);
  });

  test('should navigate to a webpage and validate', async () => {
    await codeAgent.browserTestingPhase.startSession();
    
    const result = await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
    expect(result.url).toContain('example.com');
    expect(result.title).toBeTruthy();
    expect(result.pageInfo).toBeDefined();
    expect(result.timestamp).toBeTruthy();
  }, 20000);

  test('should execute JavaScript in browser', async () => {
    await codeAgent.browserTestingPhase.startSession();
    await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    
    const result = await codeAgent.browserTestingPhase.executeJavaScript(() => {
      return {
        title: document.title,
        url: window.location.href,
        hasH1: document.querySelector('h1') !== null,
        bodyText: document.body.textContent.substring(0, 50)
      };
    });
    
    expect(result.success).toBe(true);
    const parsedResult = JSON.parse(result.result);
    expect(parsedResult.title).toBeTruthy();
    expect(parsedResult.url).toContain('example.com');
    expect(parsedResult.hasH1).toBe(true);
    expect(parsedResult.bodyText).toBeTruthy();
  }, 20000);

  test('should take screenshots', async () => {
    await codeAgent.browserTestingPhase.startSession();
    await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    
    const result = await codeAgent.browserTestingPhase.captureScreenshot({ 
      fullPage: true,
      format: 'png'
    });
    
    expect(result.success).toBe(true);
    expect(result.screenshot).toBeTruthy();
    expect(result.format).toBe('png');
    expect(result.timestamp).toBeTruthy();
    
    // Check that screenshot metadata was stored
    const screenshots = codeAgent.browserTestingPhase.getScreenshots();
    expect(screenshots).toHaveLength(1);
    expect(screenshots[0].format).toBe('png');
    expect(screenshots[0].size).toBeGreaterThan(0);
  }, 20000);

  test('should extract page data', async () => {
    await codeAgent.browserTestingPhase.startSession();
    await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    
    const selectors = {
      title: 'title',
      heading: 'h1',
      paragraph: 'p'
    };
    
    const result = await codeAgent.browserTestingPhase.extractPageData(selectors);
    
    expect(result.success).toBe(true);
    expect(result.data.title.text).toBeTruthy();
    expect(result.data.heading.text).toBeTruthy();
    expect(result.data.paragraph.text).toBeTruthy();
    expect(result.url).toContain('example.com');
    
    // Check that extracted data was stored
    const extractedData = codeAgent.browserTestingPhase.getExtractedData();
    expect(extractedData).toHaveLength(1);
  }, 20000);

  test('should run comprehensive page test suite', async () => {
    await codeAgent.browserTestingPhase.startSession();
    
    const testConfig = {
      takeScreenshot: true,
      extractData: true,
      runAccessibilityTests: true,
      runPerformanceTests: true,
      customTests: [
        {
          name: 'check-title',
          script: () => document.title.length > 0
        }
      ]
    };
    
    const result = await codeAgent.browserTestingPhase.runPageTestSuite('https://example.com', testConfig);
    
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://example.com');
    expect(result.tests.navigation.success).toBe(true);
    expect(result.tests.screenshot.success).toBe(true);
    expect(result.tests.dataExtraction.success).toBe(true);
    expect(result.tests.accessibility.success).toBe(true);
    expect(result.tests.performance.success).toBe(true);
    expect(result.tests['check-title'].success).toBe(true);
    expect(result.duration).toBeGreaterThan(0);
    expect(result.endTime).toBeDefined();
  }, 30000);

  test('should wait for elements', async () => {
    await codeAgent.browserTestingPhase.startSession();
    await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    
    const result = await codeAgent.browserTestingPhase.waitForElement('h1', { 
      timeout: 5000 
    });
    
    expect(result.success).toBe(true);
    expect(result.selector).toBe('h1');
    expect(result.isVisible).toBe(true);
    expect(result.text).toBeTruthy();
  }, 20000);

  test('should generate comprehensive testing report', async () => {
    await codeAgent.browserTestingPhase.startSession();
    
    // Run a simple test
    await codeAgent.browserTestingPhase.runPageTestSuite('https://example.com', {
      takeScreenshot: true,
      extractData: false,
      runAccessibilityTests: false,
      runPerformanceTests: false
    });
    
    const report = codeAgent.browserTestingPhase.generateTestingReport();
    
    expect(report.summary.totalTests).toBe(1);
    expect(report.summary.passedTests).toBe(1);
    expect(report.summary.failedTests).toBe(0);
    expect(report.summary.successRate).toBe('100.00%');
    expect(report.summary.screenshotsTaken).toBeGreaterThan(0);
    expect(report.testResults).toHaveLength(1);
    expect(report.generatedAt).toBeTruthy();
  }, 30000);

  test('should handle navigation errors gracefully', async () => {
    await codeAgent.browserTestingPhase.startSession();
    
    const result = await codeAgent.browserTestingPhase.navigateAndValidate('http://invalid-domain-that-does-not-exist.com');
    
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.timestamp).toBeTruthy();
    
    // Check that error was logged
    const logs = codeAgent.browserTestingPhase.getBrowserLogs();
    const errorLogs = logs.filter(log => log.success === false);
    expect(errorLogs.length).toBeGreaterThan(0);
  }, 20000);

  test('should handle script execution errors gracefully', async () => {
    await codeAgent.browserTestingPhase.startSession();
    await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    
    const result = await codeAgent.browserTestingPhase.executeJavaScript(() => {
      throw new Error('Test error from script');
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Test error from script');
  }, 20000);

  test('should collect browser operation logs', async () => {
    await codeAgent.browserTestingPhase.startSession();
    await codeAgent.browserTestingPhase.navigateAndValidate('https://example.com');
    await codeAgent.browserTestingPhase.executeJavaScript(() => 'test');
    
    const logs = codeAgent.browserTestingPhase.getBrowserLogs();
    
    expect(logs.length).toBeGreaterThan(0);
    
    const navigationLogs = logs.filter(log => log.type === 'navigation');
    const javascriptLogs = logs.filter(log => log.type === 'javascript');
    
    expect(navigationLogs.length).toBeGreaterThan(0);
    expect(javascriptLogs.length).toBeGreaterThan(0);
    
    // Check log structure
    expect(logs[0]).toHaveProperty('type');
    expect(logs[0]).toHaveProperty('action');
    expect(logs[0]).toHaveProperty('timestamp');
    expect(logs[0]).toHaveProperty('success');
  }, 20000);
});