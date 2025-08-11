/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { ResourceManager } from '../../../tools/src/ResourceManager.js';
import { StorageProvider } from '../../../storage/src/StorageProvider.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

class BackendTestManager {
  constructor() {
    this.monitors = [];
    this.processes = [];
    this.testServers = [];
    this.resourceManager = null;
    this.testDataDir = path.join(__dirname, '../testdata');
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

  async createTestServerScript(port, options = {}) {
    await this.ensureTestDataDir();
    
    const {
      delayMs = 0,
      errorRate = 0,
      logMessages = true,
      correlationId = null
    } = options;

    const scriptContent = `
const http = require('http');

console.log('Starting test server on port ${port}');

const server = http.createServer((req, res) => {
  const correlationId = '${correlationId || `correlation-${Date.now()}`}';
  
  if (${logMessages}) {
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url} [correlation-\${correlationId}]\`);
  }
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }
  
  // Simulate delay if requested
  const delay = ${delayMs};
  if (delay > 0) {
    console.log(\`Delaying response by \${delay}ms [correlation-\${correlationId}]\`);
  }
  
  setTimeout(() => {
    // Simulate random errors if errorRate > 0
    if (Math.random() < ${errorRate}) {
      console.error(\`Simulated error for \${req.url} [correlation-\${correlationId}]\`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Simulated backend error',
        correlationId: correlationId,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy',
        correlationId: correlationId,
        timestamp: new Date().toISOString(),
        port: ${port}
      }));
    } else if (req.url === '/api/data') {
      if (${logMessages}) {
        console.log(\`Processing data request [correlation-\${correlationId}]\`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: 'Data processed successfully',
        correlationId: correlationId,
        data: { id: 1, value: 'test' },
        timestamp: new Date().toISOString()
      }));
    } else if (req.url === '/api/slow') {
      if (${logMessages}) {
        console.log(\`Processing slow request [correlation-\${correlationId}]\`);
      }
      // Additional delay for slow endpoint
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'Slow operation completed',
          correlationId: correlationId,
          duration: 1000 + delay,
          timestamp: new Date().toISOString()
        }));
      }, 1000);
      return; // Exit early to prevent double response
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Not found',
        correlationId: correlationId,
        path: req.url
      }));
    }
  }, delay);
});

server.listen(${port}, () => {
  console.log(\`Test server listening on port ${port}\`);
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

    const scriptPath = path.join(this.testDataDir, `test-server-${port}.js`);
    await fs.writeFile(scriptPath, scriptContent);
    return scriptPath;
  }

  async startTestServer(port, options = {}) {
    const scriptPath = await this.createTestServerScript(port, options);
    
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (data.toString().includes('Server ready for connections')) {
          resolve({
            process: serverProcess,
            port,
            scriptPath,
            output: () => output,
            errorOutput: () => errorOutput
          });
        }
      });

      serverProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      serverProcess.on('error', reject);
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill();
          reject(new Error(`Server failed to start within timeout on port ${port}`));
        }
      }, 10000);
      
      this.processes.push(serverProcess);
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
    
    // Wait for processes to exit
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
        files.filter(f => f.startsWith('test-server-'))
              .map(f => fs.unlink(path.join(this.testDataDir, f)).catch(() => {}))
      );
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

describe('Backend Monitoring Integration Tests', () => {
  let testManager;

  beforeAll(() => {
    testManager = new BackendTestManager();
  });

  afterAll(async () => {
    await testManager.cleanup();
  }, 30000);

  describe('Backend Process Monitoring', () => {
    it('should monitor backend process startup and readiness', async () => {
      const monitor = await testManager.createMonitor();
      const testServer = await testManager.startTestServer(3002);

      const result = await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'readiness-test-backend',
          port: 3002,
          timeout: 10000
        },
        frontend: {
          url: `http://localhost:3002/health`
        }
      });

      expect(result.backend).toBeDefined();
      expect(result.backend.name).toBe('readiness-test-backend');
      expect(result.backend.script).toBe(testServer.scriptPath);
      expect(monitor.activeBackends.has('readiness-test-backend')).toBe(true);

      // Verify port detection worked
      expect(monitor.activeBrowsers.size).toBe(1);
    }, 20000);

    it('should handle backend startup timeout', async () => {
      const monitor = await testManager.createMonitor();
      
      // Use a port that won't be available
      await expect(monitor.monitorFullStackApp({
        backend: {
          script: 'nonexistent-script.js',
          name: 'timeout-test-backend', 
          port: 65000, // Unlikely to be available
          timeout: 1000 // Short timeout
        },
        frontend: {
          url: 'http://localhost:65000'
        }
      })).rejects.toThrow('Backend failed to start on port 65000');
    }, 10000);

    it('should track backend logs with correlation IDs', async () => {
      const monitor = await testManager.createMonitor();
      const correlationListener = jest.fn();
      const backendLogListener = jest.fn();
      
      monitor.on('correlation-detected', correlationListener);
      monitor.on('backend-log', backendLogListener);

      const testServer = await testManager.startTestServer(3003, {
        logMessages: true,
        correlationId: 'backend-test-123'
      });

      await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'correlation-backend',
          port: 3003
        },
        frontend: {
          url: `http://localhost:3003/health`
        }
      });

      // Wait a bit for logs to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate some backend log entries
      monitor.logManager.emit('log', {
        level: 'info',
        message: 'Processing request [correlation-backend-test-123]',
        processId: 12345,
        timestamp: new Date()
      });

      expect(correlationListener).toHaveBeenCalled();
      const correlationCall = correlationListener.mock.calls.find(call =>
        call[0].correlationId === 'correlation-backend-test-123'
      );
      expect(correlationCall).toBeDefined();
    }, 15000);
  });

  describe('Full-Stack Application Monitoring Workflows', () => {
    it('should complete full backend + frontend monitoring workflow', async () => {
      const monitor = await testManager.createMonitor();
      const testServer = await testManager.startTestServer(3004, {
        logMessages: true,
        correlationId: 'fullstack-workflow'
      });

      const appMonitoredListener = jest.fn();
      monitor.on('app-monitored', appMonitoredListener);

      const result = await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'fullstack-backend',
          port: 3004
        },
        frontend: {
          url: `http://localhost:3004/api/data`,
          browserOptions: { headless: true }
        }
      });

      expect(result.backend).toBeDefined();
      expect(result.browser).toBeDefined();
      expect(result.session).toBeDefined();

      expect(appMonitoredListener).toHaveBeenCalledWith({
        backend: expect.objectContaining({ name: 'fullstack-backend' }),
        frontend: expect.objectContaining({ url: `http://localhost:3004/api/data` }),
        sessionId: result.session.id
      });

      // Verify both systems are active
      expect(monitor.activeBackends.size).toBe(1);
      expect(monitor.activeBrowsers.size).toBe(1);
    }, 20000);

    it('should handle backend errors during monitoring', async () => {
      const monitor = await testManager.createMonitor();
      const testServer = await testManager.startTestServer(3005, {
        errorRate: 0.5, // 50% error rate
        logMessages: true
      });

      await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'error-prone-backend',
          port: 3005
        },
        frontend: {
          url: `http://localhost:3005/health`,
          browserOptions: { headless: true }
        }
      });

      // Execute scenario that might trigger errors
      const scenario = [
        { action: 'navigate', url: `http://localhost:3005/api/data` },
        { action: 'navigate', url: `http://localhost:3005/api/data` },
        { action: 'navigate', url: `http://localhost:3005/api/data` }
      ];

      const results = await monitor.debugScenario(scenario);

      // Some requests might succeed, some might fail due to error rate
      expect(results).toHaveLength(3);
      expect(results.every(r => typeof r.success === 'boolean')).toBe(true);
    }, 15000);

    it('should track performance metrics across backend and frontend', async () => {
      const monitor = await testManager.createMonitor();
      const testServer = await testManager.startTestServer(3006, {
        delayMs: 500, // Add delay to all responses
        logMessages: true
      });

      await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'performance-backend',
          port: 3006
        },
        frontend: {
          url: `http://localhost:3006/api/slow`,
          browserOptions: { headless: true }
        }
      });

      // Execute performance test scenario
      const startTime = Date.now();
      const scenario = [
        { action: 'navigate', url: `http://localhost:3006/api/slow` },
        { action: 'screenshot' }
      ];

      const results = await monitor.debugScenario(scenario);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(2);
      expect(results.every(r => r.success === true)).toBe(true);
      expect(duration).toBeGreaterThan(1000); // Should take at least 1 second due to delays

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(1);
      expect(stats.totalStepsExecuted).toBe(2);
    }, 20000);
  });

  describe('Correlation Tracking Across Components', () => {
    it('should correlate frontend requests with backend logs', async () => {
      const monitor = await testManager.createMonitor();
      const correlationId = 'correlation-integration-test';
      
      const testServer = await testManager.startTestServer(3007, {
        correlationId,
        logMessages: true
      });

      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'correlation-backend',
          port: 3007
        },
        frontend: {
          url: `http://localhost:3007/health`,
          browserOptions: { headless: true }
        }
      });

      // Simulate frontend making request
      monitor.browserMonitor.emit('network-request', {
        correlationId: `correlation-${correlationId}`,
        url: '/api/data',
        method: 'GET',
        timestamp: new Date()
      });

      // Simulate backend processing request
      monitor.logManager.emit('log', {
        level: 'info',
        message: `Request processed [correlation-${correlationId}]`,
        processId: 3007,
        timestamp: new Date()
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      expect(correlationListener).toHaveBeenCalledTimes(2);
      
      const correlation = monitor.getCorrelation(`correlation-${correlationId}`);
      expect(correlation).toBeDefined();
      expect(correlation.frontend).toBeDefined();
      expect(correlation.backend).toBeDefined();
      expect(correlation.backend).toBeInstanceOf(Array);
    }, 15000);

    it('should provide correlated log search functionality', async () => {
      const monitor = await testManager.createMonitor();
      const testServer = await testManager.startTestServer(3008);

      await monitor.monitorFullStackApp({
        backend: {
          script: testServer.scriptPath,
          name: 'log-search-backend',
          port: 3008
        },
        frontend: {
          url: `http://localhost:3008/health`
        }
      });

      const correlationId = 'correlation-search-test';
      
      // Add some test log data
      monitor.logManager.logs = [
        { message: `Start processing [${correlationId}]`, level: 'info' },
        { message: `Middle step [${correlationId}]`, level: 'debug' },
        { message: `Completed [${correlationId}]`, level: 'info' },
        { message: 'Unrelated log message', level: 'info' }
      ];

      monitor.browserMonitor.consoleLogs = [
        { text: `Frontend processing [${correlationId}]`, type: 'info' },
        { text: 'Unrelated console log', type: 'info' }
      ];

      const correlatedLogs = await monitor.getCorrelatedLogs(correlationId);

      expect(correlatedLogs).toBeDefined();
      expect(correlatedLogs.backend).toHaveLength(3); // 3 matching backend logs
      expect(correlatedLogs.frontend).toHaveLength(1); // 1 matching frontend log
      expect(correlatedLogs.network).toBeDefined();
    }, 10000);
  });

  describe('Multiple Session Management', () => {
    it('should handle multiple concurrent backend monitoring sessions', async () => {
      const monitor1 = await testManager.createMonitor();
      const monitor2 = await testManager.createMonitor();

      const server1 = await testManager.startTestServer(3009);
      const server2 = await testManager.startTestServer(3010);

      const [result1, result2] = await Promise.all([
        monitor1.monitorFullStackApp({
          backend: {
            script: server1.scriptPath,
            name: 'multi-backend-1',
            port: 3009
          },
          frontend: {
            url: `http://localhost:3009/health`
          }
        }),
        monitor2.monitorFullStackApp({
          backend: {
            script: server2.scriptPath,
            name: 'multi-backend-2', 
            port: 3010
          },
          frontend: {
            url: `http://localhost:3010/health`
          }
        })
      ]);

      expect(result1.backend.name).toBe('multi-backend-1');
      expect(result2.backend.name).toBe('multi-backend-2');
      expect(result1.session.id).not.toBe(result2.session.id);

      expect(monitor1.activeBackends.size).toBe(1);
      expect(monitor2.activeBackends.size).toBe(1);
    }, 25000);
  });
});