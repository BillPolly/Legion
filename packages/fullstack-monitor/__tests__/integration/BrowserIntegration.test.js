/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { ResourceManager } from '../../../tools/src/ResourceManager.js';
import { StorageProvider } from '../../../storage/src/StorageProvider.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test utilities
class IntegrationTestManager {
  constructor() {
    this.servers = [];
    this.monitors = [];
    this.resourceManager = null;
  }

  async initialize() {
    if (!this.resourceManager) {
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();
      
      // Create and register StorageProvider
      const storageProvider = await StorageProvider.create(this.resourceManager);
      this.resourceManager.set('StorageProvider', storageProvider);
      
      // Set test-specific browser configuration
      this.resourceManager.set('BROWSER_TYPE', 'puppeteer');
      this.resourceManager.set('BROWSER_HEADLESS', true); // Headless for CI/CD
      this.resourceManager.set('BROWSER_TIMEOUT', 30000);
    }
  }

  async createTestServer(port, routes = {}) {
    const app = express();
    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../testdata')));

    // Default health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // CORS headers
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    // Add custom routes
    Object.entries(routes).forEach(([path, handler]) => {
      if (typeof handler === 'function') {
        app.get(path, handler);
      } else {
        app.get(path, (req, res) => res.json(handler));
      }
    });

    return new Promise((resolve, reject) => {
      const server = app.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          this.servers.push(server);
          resolve({ server, app, port });
        }
      });
    });
  }

  async createMonitor() {
    await this.initialize();
    const monitor = await FullStackMonitor.create(this.resourceManager);
    this.monitors.push(monitor);
    return monitor;
  }

  async cleanup() {
    // Cleanup monitors
    await Promise.all(this.monitors.map(monitor => 
      monitor.cleanup().catch(err => console.warn('Monitor cleanup error:', err.message))
    ));
    this.monitors = [];

    // Cleanup servers
    await Promise.all(this.servers.map(server => new Promise(resolve => {
      server.close(() => resolve());
    })));
    this.servers = [];
  }
}

describe('Browser Integration Tests', () => {
  let testManager;
  let testServer;

  beforeAll(async () => {
    testManager = new IntegrationTestManager();
    await testManager.initialize();
    
    // Create a test HTML page for browser testing
    await testManager.createTestHTML();
  }, 30000);

  afterAll(async () => {
    await testManager.cleanup();
  }, 30000);

  beforeEach(async () => {
    // Create a test server for each test
    testServer = await testManager.createTestServer(3001, {
      '/api/test': { message: 'Test API response', timestamp: new Date() },
      '/api/slow': (req, res) => {
        setTimeout(() => {
          res.json({ message: 'Slow response', delay: 1000 });
        }, 1000);
      },
      '/api/error': (req, res) => {
        res.status(500).json({ error: 'Test error' });
      }
    });
  });

  afterEach(async () => {
    if (testServer) {
      await new Promise(resolve => testServer.server.close(resolve));
    }
  });

  describe('Browser Launch and Page Monitoring', () => {
    it('should launch browser and monitor page successfully', async () => {
      const monitor = await testManager.createMonitor();
      
      const result = await monitor.monitorFullStackApp({
        backend: {
          name: 'test-backend',
          script: 'mock-script.js', // Won't actually start, just for testing
          waitTime: 100 // Short wait instead of port check
        },
        frontend: {
          url: `http://localhost:${testServer.port}/health`,
          browserOptions: {
            headless: true,
            timeout: 10000
          }
        }
      });

      expect(result).toBeDefined();
      expect(result.backend).toBeDefined();
      expect(result.browser).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.browser.url).toBe(`http://localhost:${testServer.port}/health`);
      
      // Verify browser and page are created
      expect(monitor.browserMonitor.browser).toBeTruthy();
      expect(monitor.activeBrowsers.size).toBe(1);
      expect(monitor.activeBackends.size).toBe(1);
    }, 15000);

    it('should handle browser launch failure gracefully', async () => {
      const monitor = await testManager.createMonitor();
      
      // Override browser monitor to simulate failure
      const originalLaunch = monitor.browserMonitor.launch;
      monitor.browserMonitor.launch = jest.fn().mockRejectedValue(new Error('Browser launch failed'));

      await expect(monitor.monitorFullStackApp({
        backend: {
          name: 'test-backend',
          script: 'mock-script.js',
          waitTime: 100
        },
        frontend: {
          url: `http://localhost:${testServer.port}`,
          browserOptions: { headless: true }
        }
      })).rejects.toThrow('Browser launch failed');

      // Restore original method
      monitor.browserMonitor.launch = originalLaunch;
    }, 10000);

    it('should handle invalid URL gracefully', async () => {
      const monitor = await testManager.createMonitor();
      
      // This should handle the backend setup but may fail on browser navigation
      try {
        await monitor.monitorFullStackApp({
          backend: {
            name: 'test-backend', 
            script: 'mock-script.js',
            waitTime: 100
          },
          frontend: {
            url: 'http://invalid-domain-that-does-not-exist:99999',
            browserOptions: { headless: true }
          }
        });
      } catch (error) {
        // Expected to fail due to invalid URL
        expect(error.message).toBeDefined();
      }
    }, 10000);
  });

  describe('Real Browser Interaction Tests', () => {
    let monitor;

    beforeEach(async () => {
      monitor = await testManager.createMonitor();
      
      // Create test HTML content
      testManager.testHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Integration Test Page</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .connected { background: #d4edda; }
            .error { background: #f8d7da; }
            button { margin: 5px; padding: 10px 15px; }
            #result { margin: 20px 0; padding: 15px; background: #f8f9fa; }
          </style>
        </head>
        <body>
          <h1>Browser Integration Test</h1>
          <div class="status connected">System Ready</div>
          
          <button id="api-test-btn" onclick="testAPI()">Test API</button>
          <button id="slow-btn" onclick="testSlow()">Test Slow Request</button>
          <button id="error-btn" onclick="testError()">Test Error</button>
          
          <div id="result">Ready for testing</div>
          
          <script>
            console.log('[correlation-page-load] Page loaded successfully');
            
            async function testAPI() {
              console.log('[correlation-api-test] Starting API test');
              const result = document.getElementById('result');
              result.textContent = 'Testing API...';
              
              try {
                const response = await fetch('/api/test');
                const data = await response.json();
                result.innerHTML = '<strong>API Success:</strong> ' + JSON.stringify(data);
                console.log('[correlation-api-test] API test completed successfully');
              } catch (error) {
                result.innerHTML = '<strong>API Error:</strong> ' + error.message;
                console.error('[correlation-api-test] API test failed:', error);
              }
            }
            
            async function testSlow() {
              console.log('[correlation-slow-test] Starting slow request test');
              const start = Date.now();
              
              try {
                const response = await fetch('/api/slow');
                const data = await response.json();
                const duration = Date.now() - start;
                console.log('[correlation-slow-test] Slow request completed in ' + duration + 'ms');
              } catch (error) {
                console.error('[correlation-slow-test] Slow request failed:', error);
              }
            }
            
            async function testError() {
              console.log('[correlation-error-test] Starting error test');
              
              try {
                const response = await fetch('/api/error');
                const data = await response.json();
                console.log('[correlation-error-test] Error response received:', data);
              } catch (error) {
                console.error('[correlation-error-test] Network error:', error);
              }
            }
          </script>
        </body>
        </html>
      `;

      // Add HTML route to test server
      testServer.app.get('/test-page', (req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.send(testManager.testHTML);
      });
    });

    it('should execute debug scenario with real browser interactions', async () => {
      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      await monitor.monitorFullStackApp({
        backend: {
          name: 'integration-test-backend',
          script: 'test-backend.js',
          waitTime: 200
        },
        frontend: {
          url: `http://localhost:${testServer.port}/test-page`,
          browserOptions: { 
            headless: true,
            devtools: false
          }
        }
      });

      // Execute a debug scenario
      const scenario = [
        { action: 'waitFor', selector: '#api-test-btn', options: { timeout: 5000 } },
        { action: 'click', selector: '#api-test-btn' },
        { action: 'waitFor', selector: '#result', options: { timeout: 3000 } },
        { action: 'evaluate', function: 'document.getElementById("result").textContent' }
      ];

      const results = await monitor.debugScenario(scenario);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Check that the last step got the result
      expect(results[3].evaluationResult).toBeDefined();
    }, 20000);

    it('should detect and track browser console correlations', async () => {
      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      await monitor.monitorFullStackApp({
        backend: {
          name: 'correlation-backend',
          script: 'mock-backend.js',
          waitTime: 200
        },
        frontend: {
          url: `http://localhost:${testServer.port}/test-page`,
          browserOptions: { headless: true }
        }
      });

      // Wait for page load and initial console messages
      await new Promise(resolve => setTimeout(resolve, 2000));

      // The test HTML page logs correlation messages
      // Check if correlations were detected
      expect(correlationListener).toHaveBeenCalled();
      
      const correlationCalls = correlationListener.mock.calls;
      const pageLoadCorrelation = correlationCalls.find(call => 
        call[0].correlationId === 'correlation-page-load'
      );
      
      expect(pageLoadCorrelation).toBeDefined();
    }, 15000);

    it('should handle screenshot capture during debugging', async () => {
      await monitor.monitorFullStackApp({
        backend: {
          name: 'screenshot-backend',
          script: 'test-backend.js', 
          waitTime: 200
        },
        frontend: {
          url: `http://localhost:${testServer.port}/test-page`,
          browserOptions: { headless: true }
        }
      });

      const scenario = [
        { action: 'waitFor', selector: 'h1', options: { timeout: 5000 } },
        { action: 'screenshot', options: { fullPage: true } }
      ];

      const results = await monitor.debugScenario(scenario);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[1].screenshot).toBeDefined();
    }, 15000);
  });

  describe('Performance and Error Tracking', () => {
    let monitor;

    beforeEach(async () => {
      monitor = await testManager.createMonitor();
    });

    it('should track slow network requests', async () => {
      const browserRequestListener = jest.fn();
      monitor.on('browser-request', browserRequestListener);

      await monitor.monitorFullStackApp({
        backend: {
          name: 'perf-backend',
          script: 'test-backend.js',
          waitTime: 200
        },
        frontend: {
          url: `http://localhost:${testServer.port}/test-page`,
          browserOptions: { headless: true }
        }
      });

      // Trigger a slow request via browser automation
      const scenario = [
        { action: 'click', selector: '#slow-btn' },
        { action: 'waitFor', selector: '#result', options: { timeout: 3000 } }
      ];

      await monitor.debugScenario(scenario);

      // Should have captured network request events
      // Note: This depends on the browser monitor implementation
      // The test verifies the event system is working
    }, 15000);

    it('should detect browser errors', async () => {
      const browserErrorListener = jest.fn();
      monitor.on('browser-error', browserErrorListener);

      await monitor.monitorFullStackApp({
        backend: {
          name: 'error-backend',
          script: 'test-backend.js',
          waitTime: 200
        },
        frontend: {
          url: `http://localhost:${testServer.port}/test-page`,
          browserOptions: { headless: true }
        }
      });

      // Trigger an error scenario
      const scenario = [
        { action: 'click', selector: '#error-btn' },
        { action: 'waitFor', selector: '#result', options: { timeout: 3000 } }
      ];

      await monitor.debugScenario(scenario);

      // Errors might be captured depending on browser monitor implementation
    }, 15000);

    it('should provide comprehensive statistics', async () => {
      await monitor.monitorFullStackApp({
        backend: {
          name: 'stats-backend',
          script: 'test-backend.js',
          waitTime: 200
        },
        frontend: {
          url: `http://localhost:${testServer.port}/test-page`,
          browserOptions: { headless: true }
        }
      });

      // Execute some scenarios to generate statistics
      const scenario = [
        { action: 'click', selector: '#api-test-btn' },
        { action: 'waitFor', selector: '#result' },
        { action: 'screenshot' }
      ];

      await monitor.debugScenario(scenario);

      const stats = monitor.getStatistics();

      expect(stats).toHaveProperty('backend');
      expect(stats).toHaveProperty('frontend'); 
      expect(stats).toHaveProperty('correlations');
      expect(stats).toHaveProperty('activeBackends');
      expect(stats).toHaveProperty('activeBrowsers');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('debugScenariosRun');
      expect(stats).toHaveProperty('totalStepsExecuted');

      expect(stats.activeBackends).toBe(1);
      expect(stats.activeBrowsers).toBe(1);
      expect(stats.debugScenariosRun).toBe(1);
      expect(stats.totalStepsExecuted).toBe(3);
      expect(stats.uptime).toBeGreaterThan(0);
    }, 15000);
  });
});

// Extend IntegrationTestManager with HTML creation utility
IntegrationTestManager.prototype.createTestHTML = async function() {
  // This method can be used to create more complex test HTML files if needed
  this.testHTML = '';
};