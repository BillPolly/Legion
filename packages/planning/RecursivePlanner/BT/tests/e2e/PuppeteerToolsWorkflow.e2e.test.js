/**
 * End-to-end test for PuppeteerTools workflow
 * Tests browser automation, screenshots, interactions, and performance testing
 */

import { PuppeteerTools } from '../../tools/puppeteer-tools.js';
import fs from 'fs/promises';
import path from 'path';

describe('PuppeteerTools E2E Workflow', () => {
  let puppeteerTools;
  const testDir = './test-puppeteer-output';

  beforeAll(async () => {
    puppeteerTools = new PuppeteerTools(testDir);
    
    // Clean up any existing test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  afterAll(async () => {
    // Clean up browsers
    await puppeteerTools.closeAllBrowsers();
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  test('should demonstrate complete browser automation workflow', async () => {
    // Step 1: Launch browser
    const browserManager = puppeteerTools.createBrowserManager();
    const launchResult = await browserManager.execute({
      action: 'launch',
      browserName: 'test-browser',
      headless: true,
      viewport: { width: 1280, height: 720 }
    });

    expect(launchResult.success).toBe(true);
    expect(launchResult.data.browserName).toBe('test-browser');
    expect(launchResult.data.viewport).toEqual({ width: 1280, height: 720 });

    // Step 2: Take screenshot of a simple webpage
    const screenshotTool = puppeteerTools.createScreenshotCapture();
    const screenshotResult = await screenshotTool.execute({
      url: 'https://example.com',
      browserName: 'test-browser',
      type: 'fullPage',
      fileName: 'example-homepage.png'
    });

    if (!screenshotResult.success) {
      console.log('Screenshot failed:', screenshotResult.data);
    }
    expect(screenshotResult.success).toBe(true);
    expect(screenshotResult.data.fileName).toBe('example-homepage.png');
    expect(screenshotResult.data.type).toBe('fullPage');
    
    // Verify screenshot file exists
    const screenshotExists = await fs.access(screenshotResult.data.path)
      .then(() => true)
      .catch(() => false);
    expect(screenshotExists).toBe(true);

    // Step 3: Test interactions (if the site supports it)
    const interactionTool = puppeteerTools.createInteractionTester();
    const interactionResult = await interactionTool.execute({
      url: 'https://example.com',
      browserName: 'test-browser',
      interactions: [
        { type: 'wait', timeout: 1000 },
        { type: 'scroll', x: 0, y: 100 },
        { type: 'wait', timeout: 500 }
      ],
      screenshotAfterEach: false
    });

    if (!interactionResult.success) {
      console.log('Interaction failed:', interactionResult.data);
    }
    expect(interactionResult.success).toBe(true);
    expect(interactionResult.data.totalSteps).toBe(3);
    expect(interactionResult.data.successfulSteps).toBe(3);
    expect(interactionResult.data.failedSteps).toBe(0);

    // Step 4: Test performance metrics
    const performanceTool = puppeteerTools.createPerformanceTester();
    const performanceResult = await performanceTool.execute({
      url: 'https://example.com',
      browserName: 'test-browser',
      runs: 1,
      waitTime: 1000
    });

    expect(performanceResult.success).toBe(true);
    expect(performanceResult.data.runs).toHaveLength(1);
    expect(performanceResult.data.runs[0].metrics).toBeDefined();
    expect(performanceResult.data.summary.totalRuns).toBe(1);

    // Step 5: Test visual regression (generate baseline)
    const visualTool = puppeteerTools.createVisualRegressionTester();
    const baselineResult = await visualTool.execute({
      url: 'https://example.com',
      browserName: 'test-browser',
      generateBaseline: true
    });

    expect(baselineResult.success).toBe(true);
    expect(baselineResult.data.action).toBe('baseline_created');
    expect(baselineResult.data.baselineImage).toBeDefined();
    
    // Verify baseline file exists
    const baselineExists = await fs.access(baselineResult.data.path)
      .then(() => true)
      .catch(() => false);
    expect(baselineExists).toBe(true);

    // Step 6: Test visual regression (compare with baseline)
    const comparisonResult = await visualTool.execute({
      url: 'https://example.com',
      browserName: 'test-browser',
      baselineImage: baselineResult.data.baselineImage,
      threshold: 0.1
    });

    expect(comparisonResult.success).toBe(true);
    expect(comparisonResult.data.baselineImage).toBe(baselineResult.data.baselineImage);
    expect(comparisonResult.data.currentImage).toBeDefined();
    expect(comparisonResult.data.differences).toBeDefined();

    // Step 7: List browsers
    const listResult = await browserManager.execute({
      action: 'list'
    });

    expect(listResult.success).toBe(true);
    expect(listResult.data.browsers).toHaveLength(1);
    expect(listResult.data.browsers[0].name).toBe('test-browser');
    expect(listResult.data.browsers[0].screenshotCount).toBeGreaterThan(0);

    // Step 8: Close browser
    const closeResult = await browserManager.execute({
      action: 'close',
      browserName: 'test-browser'
    });

    expect(closeResult.success).toBe(true);
    expect(closeResult.data.browserName).toBe('test-browser');
  }, 60000); // 60 second timeout for this comprehensive test

  test('should handle browser errors gracefully', async () => {
    const browserManager = puppeteerTools.createBrowserManager();
    
    // Try to close a non-existent browser
    const closeResult = await browserManager.execute({
      action: 'close',
      browserName: 'non-existent-browser'
    });

    expect(closeResult.success).toBe(false);
    expect(closeResult.data.error).toContain('not found');

    // Try to take screenshot without browser
    const screenshotTool = puppeteerTools.createScreenshotCapture();
    const screenshotResult = await screenshotTool.execute({
      url: 'https://example.com',
      browserName: 'non-existent-browser'
    });

    expect(screenshotResult.success).toBe(false);
    expect(screenshotResult.data.error).toContain('not found');
  });

  test('should track screenshot and performance history', async () => {
    // Clear previous history
    puppeteerTools.clearAllData();
    
    // Launch browser for history test
    const browserManager = puppeteerTools.createBrowserManager();
    await browserManager.execute({
      action: 'launch',
      browserName: 'history-browser',
      headless: true
    });

    // Take multiple screenshots
    const screenshotTool = puppeteerTools.createScreenshotCapture();
    
    await screenshotTool.execute({
      url: 'https://example.com',
      browserName: 'history-browser',
      fileName: 'history-1.png'
    });

    await screenshotTool.execute({
      url: 'https://example.com',
      browserName: 'history-browser',
      fileName: 'history-2.png'
    });

    // Check screenshot history
    const screenshotHistory = puppeteerTools.getAllScreenshots();
    expect(screenshotHistory['https://example.com']).toBeDefined();
    expect(screenshotHistory['https://example.com'].length).toBe(2);

    // Test performance metrics
    const performanceTool = puppeteerTools.createPerformanceTester();
    await performanceTool.execute({
      url: 'https://example.com',
      browserName: 'history-browser',
      runs: 1
    });

    // Check performance history
    const performanceHistory = puppeteerTools.getAllPerformanceMetrics();
    expect(performanceHistory['https://example.com']).toBeDefined();
    expect(performanceHistory['https://example.com'].length).toBe(1);

    // Check running browsers
    const runningBrowsers = puppeteerTools.getRunningBrowsers();
    expect(runningBrowsers['history-browser']).toBeDefined();
    expect(runningBrowsers['history-browser'].screenshotCount).toBeGreaterThan(0);

    // Clean up
    await browserManager.execute({
      action: 'close',
      browserName: 'history-browser'
    });
  }, 30000);

  test('should validate tool metadata', async () => {
    const browserManager = puppeteerTools.createBrowserManager();
    const screenshotTool = puppeteerTools.createScreenshotCapture();
    const interactionTool = puppeteerTools.createInteractionTester();
    const performanceTool = puppeteerTools.createPerformanceTester();
    const visualTool = puppeteerTools.createVisualRegressionTester();

    // Validate metadata for all tools
    const browserMetadata = browserManager.getMetadata();
    expect(browserMetadata.name).toBe('browserManager');
    expect(browserMetadata.description).toContain('browser instances');
    expect(browserMetadata.input.action.required).toBe(true);

    const screenshotMetadata = screenshotTool.getMetadata();
    expect(screenshotMetadata.name).toBe('screenshotCapture');
    expect(screenshotMetadata.input.url.required).toBe(true);

    const interactionMetadata = interactionTool.getMetadata();
    expect(interactionMetadata.name).toBe('interactionTester');
    expect(interactionMetadata.input.interactions.required).toBe(true);

    const performanceMetadata = performanceTool.getMetadata();
    expect(performanceMetadata.name).toBe('performanceTester');
    expect(performanceMetadata.output.summary).toBeDefined();

    const visualMetadata = visualTool.getMetadata();
    expect(visualMetadata.name).toBe('visualRegressionTester');
    expect(visualMetadata.output.status).toBeDefined();
  });

  test('should handle multiple interaction types', async () => {
    // Launch browser for interaction test
    const browserManager = puppeteerTools.createBrowserManager();
    await browserManager.execute({
      action: 'launch',
      browserName: 'interaction-browser',
      headless: true
    });

    const interactionTool = puppeteerTools.createInteractionTester();
    
    // Test various interaction types on a simple page
    const result = await interactionTool.execute({
      url: 'data:text/html,<html><body><h1 id="title">Test Page</h1><input id="input" type="text"><button id="btn">Click Me</button></body></html>',
      browserName: 'interaction-browser',
      interactions: [
        { type: 'wait', timeout: 100 },
        { type: 'type', selector: '#input', text: 'Hello World' },
        { type: 'click', selector: '#btn' },
        { type: 'scroll', x: 0, y: 50 },
        { type: 'evaluate', code: 'document.title = "Modified"; return document.title;' }
      ]
    });

    if (!result.success) {
      console.log('Multiple interactions failed:', result.data);
    }
    expect(result.success).toBe(true);
    expect(result.data.totalSteps).toBe(5);
    expect(result.data.successfulSteps).toBe(5);
    expect(result.data.results[4].result).toBe('Modified'); // evaluate result

    // Clean up
    await browserManager.execute({
      action: 'close',
      browserName: 'interaction-browser'
    });
  }, 20000);
});