/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { ResourceManager } from '../../../tools/src/ResourceManager.js';
import { StorageProvider } from '../../../storage/src/StorageProvider.js';
import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EndToEndTestManager {
  constructor() {
    this.monitors = [];
    this.processes = [];
    this.servers = [];
    this.resourceManager = null;
    this.testDataDir = path.join(__dirname, '../testdata');
    this.appCounter = 0;
  }

  async initialize() {
    if (!this.resourceManager) {
      this.resourceManager = new ResourceManager();
      await this.resourceManager.initialize();
      
      // Create and register StorageProvider
      const storageProvider = await StorageProvider.create(this.resourceManager);
      this.resourceManager.set('StorageProvider', storageProvider);
      
      // Set test-specific configuration
      this.resourceManager.set('BROWSER_TYPE', 'puppeteer');
      this.resourceManager.set('BROWSER_HEADLESS', true);
      this.resourceManager.set('BROWSER_TIMEOUT', 30000);
      this.resourceManager.set('LOG_LEVEL', 'info');
    }
  }

  async ensureTestDataDir() {
    try {
      await fs.access(this.testDataDir);
    } catch {
      await fs.mkdir(this.testDataDir, { recursive: true });
    }
  }

  async createFullStackTestApp(options = {}) {
    await this.ensureTestDataDir();
    this.appCounter++;

    const {
      backendPort = 4000 + this.appCounter,
      frontendPort = 5000 + this.appCounter,
      includeDatabase = false,
      errorScenarios = false,
      performanceTest = false
    } = options;

    const appId = `app-${this.appCounter}`;
    const correlationBase = `correlation-${appId}`;

    // Create backend server
    const backendScript = await this.createBackendScript(backendPort, {
      correlationBase,
      includeDatabase,
      errorScenarios,
      performanceTest
    });

    // Create frontend HTML and server
    const frontendFiles = await this.createFrontendApp(frontendPort, backendPort, {
      correlationBase,
      errorScenarios,
      performanceTest
    });

    return {
      appId,
      backendPort,
      frontendPort,
      backendScript,
      frontendFiles,
      correlationBase,
      urls: {
        backend: `http://localhost:${backendPort}`,
        frontend: `http://localhost:${frontendPort}`,
        api: `http://localhost:${backendPort}/api`
      }
    };
  }

  async createBackendScript(port, options) {
    const {
      correlationBase,
      includeDatabase = false,
      errorScenarios = false,
      performanceTest = false
    } = options;

    const backendCode = `
const http = require('http');
const url = require('url');

// In-memory data store
let dataStore = {
  users: [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
  ],
  products: [
    { id: 1, name: 'Widget A', price: 29.99 },
    { id: 2, name: 'Widget B', price: 39.99 }
  ]
};

let requestCount = 0;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-correlation-id');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  requestCount++;
  const correlationId = req.headers['x-correlation-id'] || 
                        \`${correlationBase}-\${Date.now()}-\${requestCount}\`;
  
  res.setHeader('x-correlation-id', correlationId);
  
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url} [correlation-\${correlationId}]\`);
  
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle different routes
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      correlationId: correlationId,
      timestamp: new Date().toISOString()
    }));
  }
  else if (pathname === '/api/users' && req.method === 'GET') {
    console.log(\`Fetching users [correlation-\${correlationId}]\`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      users: dataStore.users,
      correlationId: correlationId,
      count: dataStore.users.length
    }));
  }
  else if (pathname === '/api/products' && req.method === 'GET') {
    console.log(\`Fetching products [correlation-\${correlationId}]\`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      products: dataStore.products,
      correlationId: correlationId,
      count: dataStore.products.length
    }));
  }
  else if (pathname === '/api/slow' && req.method === 'GET') {
    console.log(\`Processing slow request [correlation-\${correlationId}]\`);
    setTimeout(() => {
      console.log(\`Slow request completed [correlation-\${correlationId}]\`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Slow operation completed',
        correlationId: correlationId,
        duration: 2000
      }));
    }, 2000);
  }
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      correlationId: correlationId
    }));
  }
});

server.listen(${port}, () => {
  console.log(\`Backend server listening on port ${port}\`);
  console.log('Server ready for connections');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
`;

    const scriptPath = path.join(this.testDataDir, `backend-${port}.js`);
    await fs.writeFile(scriptPath, backendCode);

    return scriptPath;
  }

  async createFrontendApp(frontendPort, backendPort, options) {
    const {
      correlationBase,
      errorScenarios = false,
      performanceTest = false
    } = options;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Full-Stack Test Application</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            background: #f5f5f5;
        }
        .container { 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        button { 
            background: #007cba; 
            color: white; 
            padding: 10px 20px; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer; 
            margin: 5px;
            transition: background 0.2s;
        }
        button:hover { background: #005a8b; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .status { 
            padding: 10px; 
            border-radius: 4px; 
            margin: 10px 0; 
        }
        .success { background: #d4edda; border-left: 4px solid #28a745; }
        .error { background: #f8d7da; border-left: 4px solid #dc3545; }
        .info { background: #d1ecf1; border-left: 4px solid #17a2b8; }
        .loading { background: #fff3cd; border-left: 4px solid #ffc107; }
        #results { 
            background: #f8f9fa; 
            padding: 15px; 
            border-radius: 4px; 
            margin: 15px 0;
            min-height: 100px;
            font-family: monospace;
            white-space: pre-wrap;
        }
        .form-group {
            margin: 15px 0;
        }
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        input[type="text"], input[type="email"] {
            width: 100%;
            max-width: 300px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .correlation-id {
            font-size: 0.8em;
            color: #666;
            margin-left: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Full-Stack Monitoring Test Application</h1>
        <p>This application demonstrates comprehensive full-stack monitoring with correlation tracking.</p>
        <div class="status info">
            Status: <span id="status">Initializing...</span>
            <span id="correlation-display" class="correlation-id"></span>
        </div>
    </div>

    <div class="container">
        <h2>API Operations</h2>
        <button onclick="checkHealth()" id="health-btn">Check Backend Health</button>
        <button onclick="fetchUsers()" id="users-btn">Fetch Users</button>
        <button onclick="fetchProducts()" id="products-btn">Fetch Products</button>
        ${performanceTest ? '<button onclick="testSlowOperation()" id="slow-btn">Test Slow Operation</button>' : ''}
        ${errorScenarios ? '<button onclick="triggerError()" id="error-btn">Trigger Error</button>' : ''}
    </div>

    <div class="container">
        <h2>User Management</h2>
        <div class="form-group">
            <label for="user-name">Name:</label>
            <input type="text" id="user-name" placeholder="Enter user name">
        </div>
        <div class="form-group">
            <label for="user-email">Email:</label>
            <input type="email" id="user-email" placeholder="Enter user email">
        </div>
        <button onclick="createUser()" id="create-user-btn">Create User</button>
    </div>

    <div class="container">
        <h2>Results</h2>
        <div id="results">Ready for testing...</div>
    </div>

    <script>
        const API_BASE = 'http://localhost:${backendPort}';
        let correlationCounter = 0;

        function generateCorrelationId() {
            correlationCounter++;
            return \`${correlationBase}-frontend-\${Date.now()}-\${correlationCounter}\`;
        }

        function updateStatus(message, type = 'info', correlationId = null) {
            const statusEl = document.getElementById('status');
            const corrEl = document.getElementById('correlation-display');
            
            statusEl.textContent = message;
            statusEl.parentElement.className = 'status ' + type;
            
            if (correlationId) {
                corrEl.textContent = \`[correlation-\${correlationId}]\`;
            } else {
                corrEl.textContent = '';
            }
        }

        function logResult(operation, result, correlationId) {
            const resultsEl = document.getElementById('results');
            const timestamp = new Date().toISOString();
            const logEntry = \`[\${timestamp}] \${operation}\\n\` +
                           \`Correlation: correlation-\${correlationId}\\n\` +
                           \`Result: \${JSON.stringify(result, null, 2)}\\n\` +
                           '\\n' + '-'.repeat(50) + '\\n\\n';
            
            resultsEl.textContent = logEntry + resultsEl.textContent;
            
            // Also log to console for monitoring
            console.log(\`[correlation-\${correlationId}] \${operation}:, result);
        }

        async function apiCall(endpoint, options = {}) {
            const correlationId = generateCorrelationId();
            const url = \`\${API_BASE}\${endpoint}\`;
            
            updateStatus(\`Making request to \${endpoint}...\`, 'loading', correlationId);
            console.log(\`[correlation-\${correlationId}] Starting request to \${endpoint}\`);
            
            const headers = {
                'Content-Type': 'application/json',
                'X-Correlation-ID': correlationId,
                ...options.headers
            };

            try {
                const response = await fetch(url, {
                    ...options,
                    headers
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    updateStatus(\`Request to \${endpoint} completed successfully\`, 'success', correlationId);
                    console.log(\`[correlation-\${correlationId}] Request completed successfully\`);
                    return { success: true, data, correlationId };
                } else {
                    updateStatus(\`Request to \${endpoint} failed: \${response.status}\`, 'error', correlationId);
                    console.error(\`[correlation-\${correlationId}] Request failed:, data);
                    return { success: false, error: data, correlationId };
                }
            } catch (error) {
                updateStatus(\`Network error for \${endpoint}: \${error.message}\`, 'error', correlationId);
                console.error(\`[correlation-\${correlationId}] Network error:, error);
                return { success: false, error: error.message, correlationId };
            }
        }

        async function checkHealth() {
            const result = await apiCall('/health');
            logResult('Health Check', result.data || result.error, result.correlationId);
        }

        async function fetchUsers() {
            const result = await apiCall('/api/users');
            logResult('Fetch Users', result.data || result.error, result.correlationId);
        }

        async function fetchProducts() {
            const result = await apiCall('/api/products');
            logResult('Fetch Products', result.data || result.error, result.correlationId);
        }

        async function createUser() {
            const name = document.getElementById('user-name').value;
            const email = document.getElementById('user-email').value;
            
            if (!name || !email) {
                updateStatus('Please fill in both name and email', 'error');
                return;
            }
            
            const result = await apiCall('/api/users', {
                method: 'POST',
                body: JSON.stringify({ name, email })
            });
            
            logResult('Create User', result.data || result.error, result.correlationId);
            
            if (result.success) {
                document.getElementById('user-name').value = '';
                document.getElementById('user-email').value = '';
            }
        }

        ${performanceTest ? `
        async function testSlowOperation() {
            const result = await apiCall('/api/slow');
            logResult('Slow Operation Test', result.data || result.error, result.correlationId);
        }
        ` : ''}

        ${errorScenarios ? `
        async function triggerError() {
            const result = await apiCall('/api/error');
            logResult('Error Test', result.data || result.error, result.correlationId);
        }
        ` : ''}

        // Initialize the application
        document.addEventListener('DOMContentLoaded', function() {
            console.log('[correlation-page-load] Full-stack test application loaded');
            updateStatus('Application loaded, ready for testing', 'success');
            
            // Automatically check health on load
            setTimeout(checkHealth, 1000);
        });
    </script>
</body>
</html>
    `;

    const htmlPath = path.join(this.testDataDir, `frontend-${frontendPort}.html`);
    await fs.writeFile(htmlPath, htmlContent);

    // Create simple static server for frontend
    const frontendServerScript = `
const express = require('express');
const path = require('path');
const app = express();

app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend-${frontendPort}.html'));
});

const server = app.listen(${frontendPort}, () => {
  console.log('Frontend server listening on port ${frontendPort}');
  console.log('Frontend server ready');
});

process.on('SIGTERM', () => {
  console.log('Frontend server shutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('Frontend server shutting down...');
  server.close(() => process.exit(0));
});
    `;

    const frontendScriptPath = path.join(this.testDataDir, `frontend-server-${frontendPort}.js`);
    await fs.writeFile(frontendScriptPath, frontendServerScript);

    return {
      htmlPath,
      serverScript: frontendScriptPath
    };
  }

  async startProcess(scriptPath, name, expectedOutput = 'ready') {
    return new Promise((resolve, reject) => {
      const process = spawn('node', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.testDataDir
      });

      let output = '';
      let errorOutput = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
        if (data.toString().toLowerCase().includes(expectedOutput)) {
          resolve({
            process,
            scriptPath,
            output: () => output,
            errorOutput: () => errorOutput
          });
        }
      });

      process.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      process.on('error', reject);
      
      setTimeout(() => {
        if (!process.killed) {
          process.kill();
          reject(new Error(`${name} failed to start within timeout`));
        }
      }, 15000);
      
      this.processes.push(process);
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

    // Cleanup processes
    this.processes.forEach(process => {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    });
    
    await Promise.all(this.processes.map(process => new Promise(resolve => {
      if (process.killed) {
        resolve();
      } else {
        process.on('exit', resolve);
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
          resolve();
        }, 3000);
      }
    })));
    
    this.processes = [];

    // Cleanup test files
    try {
      const files = await fs.readdir(this.testDataDir);
      await Promise.all(
        files.filter(f => f.startsWith('backend-') || f.startsWith('frontend-'))
              .map(f => fs.unlink(path.join(this.testDataDir, f)).catch(() => {}))
      );
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

describe('End-to-End Full-Stack Monitoring Tests', () => {
  let testManager;

  beforeAll(async () => {
    testManager = new EndToEndTestManager();
    await testManager.initialize();
  }, 30000);

  afterAll(async () => {
    await testManager.cleanup();
  }, 30000);

  describe('Complete Application Monitoring', () => {
    it('should monitor complete full-stack application lifecycle', async () => {
      const app = await testManager.createFullStackTestApp({
        includeDatabase: false,
        errorScenarios: false,
        performanceTest: false
      });

      // Start backend and frontend servers
      const backend = await testManager.startProcess(
        app.backendScript, 
        'backend', 
        'server ready'
      );
      
      const frontend = await testManager.startProcess(
        app.frontendFiles.serverScript, 
        'frontend', 
        'frontend server ready'
      );

      // Create monitor and start full-stack monitoring
      const monitor = await testManager.createMonitor();
      
      const correlationListener = jest.fn();
      const browserConsoleListener = jest.fn();
      const backendLogListener = jest.fn();
      
      monitor.on('correlation-detected', correlationListener);
      monitor.on('browser-console', browserConsoleListener);
      monitor.on('backend-log', backendLogListener);

      const result = await monitor.monitorFullStackApp({
        backend: {
          script: app.backendScript,
          name: `${app.appId}-backend`,
          port: app.backendPort,
          timeout: 10000
        },
        frontend: {
          url: app.urls.frontend,
          browserOptions: {
            headless: true,
            timeout: 15000
          }
        }
      });

      expect(result).toBeDefined();
      expect(result.backend.name).toBe(`${app.appId}-backend`);
      expect(result.browser.url).toBe(app.urls.frontend);
      expect(result.session).toBeDefined();

      // Wait for page to load and initial correlations
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Execute comprehensive debug scenario
      const scenario = [
        { 
          action: 'waitFor', 
          selector: '#health-btn', 
          options: { timeout: 5000 },
          description: 'Wait for health button'
        },
        { 
          action: 'click', 
          selector: '#health-btn',
          description: 'Check backend health'
        },
        { 
          action: 'waitFor', 
          selector: '#users-btn', 
          options: { timeout: 3000 },
          description: 'Wait for users button'
        },
        { 
          action: 'click', 
          selector: '#users-btn',
          description: 'Fetch users list'
        },
        {
          action: 'type',
          selector: '#user-name',
          text: 'Integration Test User',
          description: 'Enter test user name'
        },
        {
          action: 'type',
          selector: '#user-email', 
          text: 'test@integration.com',
          description: 'Enter test user email'
        },
        {
          action: 'click',
          selector: '#create-user-btn',
          description: 'Create new user'
        },
        {
          action: 'click',
          selector: '#products-btn',
          description: 'Fetch products'
        },
        {
          action: 'screenshot',
          options: { fullPage: true },
          description: 'Capture final state'
        }
      ];

      const scenarioResults = await monitor.debugScenario(scenario);

      // Verify scenario execution
      expect(scenarioResults).toHaveLength(9);
      expect(scenarioResults.every(r => r.success === true)).toBe(true);

      // Verify correlation tracking
      expect(correlationListener).toHaveBeenCalled();
      
      // Verify statistics
      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(1);
      expect(stats.totalStepsExecuted).toBe(9);
      expect(stats.activeBackends).toBe(1);
      expect(stats.activeBrowsers).toBe(1);
      expect(stats.correlationsDetected).toBeGreaterThan(0);

      // Test correlation lookup
      const correlations = Array.from(monitor.correlations.keys());
      if (correlations.length > 0) {
        const correlatedLogs = await monitor.getCorrelatedLogs(correlations[0]);
        expect(correlatedLogs).toBeDefined();
        expect(correlatedLogs).toHaveProperty('backend');
        expect(correlatedLogs).toHaveProperty('frontend');
      }

    }, 45000);

    it('should handle application with error scenarios', async () => {
      const app = await testManager.createFullStackTestApp({
        errorScenarios: true,
        performanceTest: false
      });

      const backend = await testManager.startProcess(app.backendScript, 'error-backend', 'server ready');
      const frontend = await testManager.startProcess(app.frontendFiles.serverScript, 'error-frontend', 'frontend server ready');

      const monitor = await testManager.createMonitor();
      
      const errorListener = jest.fn();
      monitor.on('browser-error', errorListener);

      await monitor.monitorFullStackApp({
        backend: {
          script: app.backendScript,
          name: `${app.appId}-error-backend`,
          port: app.backendPort
        },
        frontend: {
          url: app.urls.frontend,
          browserOptions: { headless: true }
        }
      });

      // Execute error scenario
      const errorScenario = [
        { action: 'waitFor', selector: '#error-btn', options: { timeout: 5000 } },
        { action: 'click', selector: '#error-btn' },
        { action: 'waitFor', selector: '#results', options: { timeout: 3000 } }
      ];

      const results = await monitor.debugScenario(errorScenario);
      
      // Even with backend errors, the browser interactions should succeed
      expect(results.every(r => r.success === true)).toBe(true);
      
      // Check error analysis
      results.forEach(result => {
        if (result.analysis) {
          expect(result.analysis).toHaveProperty('summary');
        }
      });

    }, 35000);

    it('should handle performance testing scenarios', async () => {
      const app = await testManager.createFullStackTestApp({
        performanceTest: true,
        errorScenarios: false
      });

      const backend = await testManager.startProcess(app.backendScript, 'perf-backend', 'server ready');
      const frontend = await testManager.startProcess(app.frontendFiles.serverScript, 'perf-frontend', 'frontend server ready');

      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: app.backendScript,
          name: `${app.appId}-perf-backend`,
          port: app.backendPort
        },
        frontend: {
          url: app.urls.frontend,
          browserOptions: { headless: true }
        }
      });

      // Execute performance test scenario
      const startTime = Date.now();
      const perfScenario = [
        { action: 'waitFor', selector: '#slow-btn', options: { timeout: 5000 } },
        { action: 'click', selector: '#slow-btn' },
        { action: 'waitFor', selector: '#results', options: { timeout: 10000 } }, // Longer timeout for slow operation
        { action: 'screenshot' }
      ];

      const results = await monitor.debugScenario(perfScenario);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success === true)).toBe(true);
      expect(totalTime).toBeGreaterThan(2000); // Should take at least 2 seconds due to slow backend

      // Verify performance insights
      results.forEach(result => {
        if (result.analysis && result.analysis.insights) {
          result.analysis.insights.forEach(insight => {
            if (insight.type === 'slow-request') {
              expect(insight.duration).toBeGreaterThan(1000);
            }
          });
        }
      });

    }, 40000);
  });

  describe('Real-World Application Patterns', () => {
    it('should handle user registration and data flow', async () => {
      const app = await testManager.createFullStackTestApp();

      const backend = await testManager.startProcess(app.backendScript, 'user-backend', 'server ready');
      const frontend = await testManager.startProcess(app.frontendFiles.serverScript, 'user-frontend', 'frontend server ready');

      const monitor = await testManager.createMonitor();
      
      await monitor.monitorFullStackApp({
        backend: {
          script: app.backendScript,
          name: `${app.appId}-user-backend`,
          port: app.backendPort
        },
        frontend: {
          url: app.urls.frontend,
          browserOptions: { headless: true }
        }
      });

      // Simulate complete user registration flow
      const userFlowScenario = [
        // Initial page load and health check
        { action: 'waitFor', selector: '#health-btn', options: { timeout: 5000 } },
        { action: 'click', selector: '#health-btn' },
        
        // Check existing users
        { action: 'click', selector: '#users-btn' },
        
        // Create new user
        { action: 'type', selector: '#user-name', text: 'Alice Johnson' },
        { action: 'type', selector: '#user-email', text: 'alice@example.com' },
        { action: 'click', selector: '#create-user-btn' },
        
        // Verify user was created by fetching users again
        { action: 'click', selector: '#users-btn' },
        
        // Check products
        { action: 'click', selector: '#products-btn' },
        
        // Final screenshot
        { action: 'screenshot', options: { fullPage: true } }
      ];

      const results = await monitor.debugScenario(userFlowScenario);

      expect(results).toHaveLength(9);
      expect(results.every(r => r.success === true)).toBe(true);

      // Verify correlations were tracked throughout the flow
      expect(monitor.correlations.size).toBeGreaterThan(0);

      // Verify statistics reflect the complete workflow
      const stats = monitor.getStatistics();
      expect(stats.totalStepsExecuted).toBe(9);
      expect(stats.correlationsDetected).toBeGreaterThan(5); // Multiple API calls should generate correlations

    }, 40000);

    it('should provide comprehensive monitoring insights', async () => {
      const app = await testManager.createFullStackTestApp({
        errorScenarios: true,
        performanceTest: true
      });

      const backend = await testManager.startProcess(app.backendScript, 'insights-backend', 'server ready');
      const frontend = await testManager.startProcess(app.frontendFiles.serverScript, 'insights-frontend', 'frontend server ready');

      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: app.backendScript,
          name: `${app.appId}-insights-backend`,
          port: app.backendPort
        },
        frontend: {
          url: app.urls.frontend,
          browserOptions: { headless: true }
        }
      });

      // Execute mixed scenario with various operations
      const mixedScenario = [
        { action: 'click', selector: '#health-btn' },          // Health check
        { action: 'click', selector: '#users-btn' },           // Data fetch
        { action: 'click', selector: '#slow-btn' },            // Performance test
        { action: 'click', selector: '#error-btn' },           // Error scenario
        { action: 'click', selector: '#products-btn' },        // Another data fetch
        { action: 'screenshot' }                               // Visual verification
      ];

      const results = await monitor.debugScenario(mixedScenario);

      expect(results).toHaveLength(6);

      // Analyze results for insights
      const analysisResults = results
        .filter(r => r.analysis && r.analysis.insights && r.analysis.insights.length > 0)
        .map(r => r.analysis);

      // Should have detected various types of insights
      const insightTypes = analysisResults
        .flatMap(a => a.insights.map(i => i.type));

      // Verify comprehensive monitoring data
      const finalStats = monitor.getStatistics();
      expect(finalStats).toMatchObject({
        backend: expect.any(Object),
        frontend: expect.any(Object),
        correlations: expect.any(Number),
        correlationsDetected: expect.any(Number),
        debugScenariosRun: 1,
        totalStepsExecuted: 6,
        activeBackends: 1,
        activeBrowsers: 1,
        uptime: expect.any(Number)
      });

      expect(finalStats.correlationsDetected).toBeGreaterThan(0);
      expect(finalStats.uptime).toBeGreaterThan(0);

    }, 45000);
  });
});