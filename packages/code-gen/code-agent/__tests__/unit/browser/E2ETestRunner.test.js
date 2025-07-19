/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll, jest } from '@jest/globals';
import { E2ETestRunner } from '../../../src/browser/E2ETestRunner.js';
import { RuntimeConfig } from '../../../src/config/RuntimeConfig.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('E2ETestRunner', () => {
  let e2eRunner;
  let mockConfig;
  let testProjectPath;

  beforeAll(async () => {
    mockConfig = new RuntimeConfig({
      nodeRunner: {
        timeout: 30000,
        maxConcurrentProcesses: 3,
        healthCheckInterval: 1000,
        shutdownTimeout: 5000
      },
      logManager: {
        logLevel: 'info',
        enableStreaming: true,
        captureStdout: true,
        captureStderr: true
      },
      playwright: {
        headless: true,
        timeout: 30000,
        browsers: ['chromium'],
        baseURL: 'http://localhost:3000'
      }
    });

    // Create a temporary test project
    testProjectPath = path.join(__dirname, 'temp-e2e-project');
    await createTestProject(testProjectPath);
  });

  afterAll(async () => {
    // Clean up test project
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    e2eRunner = new E2ETestRunner(mockConfig);
  });

  afterEach(async () => {
    if (e2eRunner) {
      await e2eRunner.cleanup();
    }
  });

  describe('Initialization', () => {
    test('should initialize with configuration', () => {
      expect(e2eRunner.config).toBeDefined();
      expect(e2eRunner.isInitialized).toBe(false);
      expect(e2eRunner.testSessions).toBeInstanceOf(Map);
    });

    test('should initialize successfully', async () => {
      await e2eRunner.initialize();
      
      expect(e2eRunner.isInitialized).toBe(true);
      expect(e2eRunner.logManager).toBeDefined();
      expect(e2eRunner.browserManager).toBeDefined();
    });

    test('should prevent double initialization', async () => {
      await e2eRunner.initialize();
      
      await expect(e2eRunner.initialize()).resolves.not.toThrow();
      expect(e2eRunner.isInitialized).toBe(true);
    });
  });

  describe('Browser Management', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should launch browser', async () => {
      const browser = await e2eRunner.launchBrowser('chromium');
      
      expect(browser).toBeDefined();
      expect(browser.type).toBe('chromium');
      expect(browser.isConnected).toBe(true);
    });

    test('should create browser context', async () => {
      const context = await e2eRunner.createBrowserContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'E2E Test Runner'
      });
      
      expect(context).toBeDefined();
      expect(context.options).toBeDefined();
      expect(context.options.viewport).toEqual({ width: 1280, height: 720 });
    });

    test('should manage multiple browsers', async () => {
      const chromium = await e2eRunner.launchBrowser('chromium');
      const firefox = await e2eRunner.launchBrowser('firefox');
      
      expect(chromium.type).toBe('chromium');
      expect(firefox.type).toBe('firefox');
      
      const browsers = await e2eRunner.getActiveBrowsers();
      expect(browsers.length).toBe(2);
    });
  });

  describe('Test Workflow Execution', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should execute simple workflow', async () => {
      const workflow = {
        name: 'Simple Login Flow',
        steps: [
          { action: 'navigate', url: '/login' },
          { action: 'fill', selector: '#username', value: 'testuser' },
          { action: 'fill', selector: '#password', value: 'password123' },
          { action: 'click', selector: '#submit' },
          { action: 'waitForNavigation', url: '/dashboard' }
        ]
      };

      const result = await e2eRunner.executeWorkflow(workflow);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.duration).toBeDefined();
      expect(result.steps).toHaveLength(5);
    });

    test('should execute complex workflow with assertions', async () => {
      const workflow = {
        name: 'E-commerce Purchase Flow',
        steps: [
          { action: 'navigate', url: '/products' },
          { action: 'click', selector: '.product-card:first-child' },
          { action: 'assert', type: 'visible', selector: '.product-details' },
          { action: 'click', selector: '#add-to-cart' },
          { action: 'assert', type: 'text', selector: '.cart-count', value: '1' },
          { action: 'navigate', url: '/checkout' },
          { action: 'fill', selector: '#email', value: 'test@example.com' },
          { action: 'screenshot', name: 'checkout-form' }
        ]
      };

      const result = await e2eRunner.executeWorkflow(workflow);
      
      expect(result.success).toBe(true);
      expect(result.screenshots).toBeDefined();
      expect(result.screenshots).toHaveLength(1);
    });

    test('should handle workflow errors gracefully', async () => {
      const workflow = {
        name: 'Error Workflow',
        steps: [
          { action: 'navigate', url: '/page' },
          { action: 'click', selector: '#non-existent-element' }
        ]
      };

      const result = await e2eRunner.executeWorkflow(workflow);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.failedStep).toBe(1);
    });
  });

  describe('Page Actions', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should perform navigation actions', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.navigate(page, '/home');
      expect(result.success).toBe(true);
      expect(result.url).toContain('/home');
    });

    test('should perform click actions', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.click(page, 'button#submit');
      expect(result.success).toBe(true);
      expect(result.element).toBe('button#submit');
    });

    test('should perform form fill actions', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.fill(page, 'input#email', 'test@example.com');
      expect(result.success).toBe(true);
      expect(result.value).toBe('test@example.com');
    });

    test('should perform select actions', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.select(page, 'select#country', 'US');
      expect(result.success).toBe(true);
      expect(result.value).toBe('US');
    });

    test('should wait for elements', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.waitForElement(page, '.loading-complete');
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
    });
  });

  describe('Assertions', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should assert element visibility', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.assertVisible(page, '.header');
      expect(result.success).toBe(true);
      expect(result.assertion).toBe('visible');
    });

    test('should assert element text', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.assertText(page, 'h1', 'Welcome');
      expect(result.success).toBe(true);
      expect(result.actual).toBe('Welcome');
    });

    test('should assert element count', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.assertCount(page, '.item', 5);
      expect(result.success).toBe(true);
      expect(result.actual).toBe(5);
    });

    test('should assert URL', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.assertURL(page, '/dashboard');
      expect(result.success).toBe(true);
      expect(result.url).toContain('/dashboard');
    });
  });

  describe('Visual Testing', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should capture screenshots', async () => {
      const page = await e2eRunner.createPage();
      
      const screenshot = await e2eRunner.captureScreenshot(page, 'homepage');
      
      expect(screenshot).toBeDefined();
      expect(screenshot.name).toBe('homepage');
      expect(screenshot.path).toBeDefined();
      expect(screenshot.timestamp).toBeDefined();
    });

    test('should capture full page screenshots', async () => {
      const page = await e2eRunner.createPage();
      
      const screenshot = await e2eRunner.captureFullPageScreenshot(page, 'full-page');
      
      expect(screenshot.fullPage).toBe(true);
      expect(screenshot.size).toBeDefined();
    });

    test('should perform visual comparison', async () => {
      const page = await e2eRunner.createPage();
      
      const comparison = await e2eRunner.compareVisual(page, 'baseline-homepage');
      
      expect(comparison).toBeDefined();
      expect(comparison.match).toBeDefined();
      expect(comparison.diffPercentage).toBeDefined();
    });
  });

  describe('Network Interception', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should intercept API requests', async () => {
      const page = await e2eRunner.createPage();
      
      const interceptor = await e2eRunner.interceptRequests(page, {
        url: '**/api/**',
        handler: (request) => ({
          status: 200,
          body: { message: 'Mocked response' }
        })
      });
      
      expect(interceptor).toBeDefined();
      expect(interceptor.pattern).toBe('**/api/**');
      expect(interceptor.active).toBe(true);
    });

    test('should record network activity', async () => {
      const page = await e2eRunner.createPage();
      
      await e2eRunner.startNetworkRecording(page);
      await e2eRunner.navigate(page, '/api-test');
      const activity = await e2eRunner.stopNetworkRecording(page);
      
      expect(activity).toBeDefined();
      expect(activity.requests).toBeDefined();
      expect(activity.responses).toBeDefined();
    });

    test('should simulate network conditions', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.simulateNetworkConditions(page, {
        offline: false,
        downloadThroughput: 1.5 * 1024 * 1024 / 8, // 1.5 Mbps
        uploadThroughput: 750 * 1024 / 8, // 750 Kbps
        latency: 40 // 40ms
      });
      
      expect(result.success).toBe(true);
      expect(result.conditions).toBeDefined();
    });
  });

  describe('Performance Testing', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should measure page load performance', async () => {
      const page = await e2eRunner.createPage();
      
      const metrics = await e2eRunner.measurePageLoad(page, '/home');
      
      expect(metrics).toBeDefined();
      expect(metrics.loadTime).toBeDefined();
      expect(metrics.domContentLoaded).toBeDefined();
      expect(metrics.firstPaint).toBeDefined();
      expect(metrics.firstContentfulPaint).toBeDefined();
    });

    test('should trace performance', async () => {
      const page = await e2eRunner.createPage();
      
      await e2eRunner.startTracing(page);
      await e2eRunner.navigate(page, '/complex-page');
      const trace = await e2eRunner.stopTracing(page);
      
      expect(trace).toBeDefined();
      expect(trace.events).toBeDefined();
      expect(trace.duration).toBeDefined();
    });

    test('should analyze runtime performance', async () => {
      const page = await e2eRunner.createPage();
      
      const analysis = await e2eRunner.analyzeRuntimePerformance(page);
      
      expect(analysis).toBeDefined();
      expect(analysis.jsHeapSize).toBeDefined();
      expect(analysis.nodes).toBeDefined();
      expect(analysis.listeners).toBeDefined();
    });
  });

  describe('Test Generation', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should generate E2E test from workflow', async () => {
      const workflow = {
        name: 'User Registration',
        steps: [
          { action: 'navigate', url: '/register' },
          { action: 'fill', selector: '#email', value: 'new@example.com' },
          { action: 'fill', selector: '#password', value: 'SecurePass123' },
          { action: 'click', selector: '#register-btn' },
          { action: 'assert', type: 'url', value: '/welcome' }
        ]
      };

      const test = await e2eRunner.generateE2ETest(workflow, 'playwright');
      
      expect(test).toBeDefined();
      expect(test.name).toBe('User Registration');
      expect(test.code).toContain('test(');
      expect(test.code).toContain('page.goto');
      expect(test.code).toContain('page.fill');
    });

    test('should generate test suite', async () => {
      const workflows = [
        { name: 'Login Flow', steps: [] },
        { name: 'Purchase Flow', steps: [] },
        { name: 'Search Flow', steps: [] }
      ];

      const suite = await e2eRunner.generateTestSuite(workflows, 'playwright');
      
      expect(suite).toBeDefined();
      expect(suite.tests).toHaveLength(3);
      expect(suite.setup).toBeDefined();
      expect(suite.teardown).toBeDefined();
    });
  });

  describe('Reporting', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should generate execution report', async () => {
      const workflow = {
        name: 'Test Workflow',
        steps: [
          { action: 'navigate', url: '/test' },
          { action: 'click', selector: 'button' }
        ]
      };

      const result = await e2eRunner.executeWorkflow(workflow);
      const report = await e2eRunner.generateExecutionReport(result);
      
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.steps).toBeDefined();
      expect(report.metrics).toBeDefined();
    });

    test('should generate HTML report', async () => {
      const results = [
        { workflow: 'Test 1', success: true, duration: 5000 },
        { workflow: 'Test 2', success: false, duration: 3000 }
      ];

      const htmlReport = await e2eRunner.generateHTMLReport(results);
      
      expect(htmlReport).toContain('<html');
      expect(htmlReport).toContain('E2E Test Report');
      expect(htmlReport).toContain('Test 1');
      expect(htmlReport).toContain('Test 2');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await e2eRunner.initialize();
    });

    test('should handle browser launch failures', async () => {
      await expect(e2eRunner.launchBrowser('invalid-browser')).rejects.toThrow();
    });

    test('should handle page crash', async () => {
      const page = await e2eRunner.createPage();
      page.crash = true; // Simulate crash
      
      const result = await e2eRunner.navigate(page, '/test');
      expect(result.success).toBe(false);
      expect(result.error).toContain('crash');
    });

    test('should handle timeout errors', async () => {
      const page = await e2eRunner.createPage();
      
      const result = await e2eRunner.waitForElement(page, '#never-appears', { timeout: 100 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all resources', async () => {
      await e2eRunner.initialize();
      
      // Create some resources
      const browser = await e2eRunner.launchBrowser('chromium');
      const page = await e2eRunner.createPage();
      
      expect(e2eRunner.testSessions.size).toBeGreaterThan(0);
      
      await e2eRunner.cleanup();
      
      expect(e2eRunner.testSessions.size).toBe(0);
      expect(e2eRunner.isInitialized).toBe(false);
    });
  });
});

// Helper function to create test project
async function createTestProject(projectPath) {
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
  
  // Create sample HTML pages for testing
  await fs.writeFile(
    path.join(projectPath, 'src', 'index.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>E2E Test App</title>
</head>
<body>
  <header class="header">
    <h1>Welcome</h1>
    <nav>
      <a href="/home">Home</a>
      <a href="/products">Products</a>
      <a href="/login">Login</a>
    </nav>
  </header>
  
  <main>
    <div class="content">
      <p>Test application for E2E testing</p>
    </div>
  </main>
</body>
</html>
`
  );
  
  // Create login page
  await fs.writeFile(
    path.join(projectPath, 'src', 'login.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Login</title>
</head>
<body>
  <form id="login-form">
    <h2>Login</h2>
    <input type="text" id="username" placeholder="Username" />
    <input type="password" id="password" placeholder="Password" />
    <button type="submit" id="submit">Login</button>
  </form>
</body>
</html>
`
  );
  
  // Create products page
  await fs.writeFile(
    path.join(projectPath, 'src', 'products.html'),
    `
<!DOCTYPE html>
<html>
<head>
  <title>Products</title>
</head>
<body>
  <div class="products">
    <div class="product-card">
      <h3>Product 1</h3>
      <button class="add-to-cart">Add to Cart</button>
    </div>
    <div class="product-card">
      <h3>Product 2</h3>
      <button class="add-to-cart">Add to Cart</button>
    </div>
  </div>
  
  <div class="cart">
    <span class="cart-count">0</span>
  </div>
</body>
</html>
`
  );
  
  // Create test config
  await fs.writeFile(
    path.join(projectPath, 'playwright.config.js'),
    `
module.exports = {
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
};
`
  );
}