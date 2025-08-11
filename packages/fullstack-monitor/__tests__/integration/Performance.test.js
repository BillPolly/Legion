/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceTestManager {
  constructor() {
    this.monitors = [];
    this.processes = [];
    this.resourceManager = this.createResourceManager();
    this.testDataDir = path.join(__dirname, '../testdata');
    this.performanceResults = [];
  }

  createResourceManager() {
    const resources = new Map();
    resources.set('BROWSER_TYPE', 'puppeteer');
    resources.set('BROWSER_HEADLESS', true);
    resources.set('BROWSER_TIMEOUT', 60000);
    resources.set('LOG_LEVEL', 'error'); // Reduce log noise for performance tests
    
    return {
      get: (key) => resources.get(key),
      set: (key, value) => resources.set(key, value),
      resources
    };
  }

  async ensureTestDataDir() {
    try {
      await fs.access(this.testDataDir);
    } catch {
      await fs.mkdir(this.testDataDir, { recursive: true });
    }
  }

  async createLoadTestServer(port, options = {}) {
    await this.ensureTestDataDir();

    const {
      responseDelayMs = 0,
      memoryLeakSimulation = false,
      cpuIntensiveOperations = false
    } = options;

    const serverCode = `
const express = require('express');
const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Performance tracking
let requestCount = 0;
let memoryData = [];
${memoryLeakSimulation ? 'let memoryLeak = [];' : ''}

// Health endpoint
app.get('/health', (req, res) => {
  requestCount++;
  const correlationId = req.headers['x-correlation-id'] || \`perf-health-\${requestCount}\`;
  
  ${responseDelayMs > 0 ? `
  setTimeout(() => {
    res.json({
      status: 'healthy',
      correlationId,
      requestCount,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }, ${responseDelayMs});
  ` : `
  res.json({
    status: 'healthy',
    correlationId,
    requestCount,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
  `}
});

// Load test endpoint
app.get('/api/load-test', (req, res) => {
  requestCount++;
  const correlationId = req.headers['x-correlation-id'] || \`perf-load-\${requestCount}\`;
  
  ${memoryLeakSimulation ? `
  // Simulate memory leak
  memoryLeak.push(new Array(1000).fill('memory-leak-data-' + requestCount));
  ` : ''}
  
  ${cpuIntensiveOperations ? `
  // CPU intensive operation
  const start = Date.now();
  let result = 0;
  for (let i = 0; i < 100000; i++) {
    result += Math.sqrt(i * Math.random());
  }
  const cpuTime = Date.now() - start;
  ` : ''}
  
  const responseData = {
    correlationId,
    requestNumber: requestCount,
    timestamp: new Date().toISOString(),
    ${cpuIntensiveOperations ? 'cpuTime,' : ''}
    data: new Array(100).fill(0).map((_, i) => ({
      id: i,
      value: \`test-data-\${requestCount}-\${i}\`,
      random: Math.random()
    }))
  };
  
  ${responseDelayMs > 0 ? `
  setTimeout(() => res.json(responseData), ${responseDelayMs});
  ` : `
  res.json(responseData);
  `}
});

// Batch operations endpoint
app.post('/api/batch', (req, res) => {
  requestCount++;
  const correlationId = req.headers['x-correlation-id'] || \`perf-batch-\${requestCount}\`;
  const { operations = [] } = req.body;
  
  const results = operations.map((op, index) => {
    ${cpuIntensiveOperations ? `
    // Simulate processing time
    const processStart = Date.now();
    let calc = 0;
    for (let i = 0; i < 10000; i++) {
      calc += Math.sqrt(i);
    }
    const processingTime = Date.now() - processStart;
    ` : ''}
    
    return {
      operationId: op.id || index,
      operation: op.type || 'unknown',
      result: 'processed',
      ${cpuIntensiveOperations ? 'processingTime,' : ''}
      timestamp: new Date().toISOString()
    };
  });
  
  ${responseDelayMs > 0 ? `
  setTimeout(() => {
    res.json({
      correlationId,
      batchId: \`batch-\${requestCount}\`,
      totalOperations: operations.length,
      results,
      timestamp: new Date().toISOString()
    });
  }, ${responseDelayMs});
  ` : `
  res.json({
    correlationId,
    batchId: \`batch-\${requestCount}\`,
    totalOperations: operations.length,
    results,
    timestamp: new Date().toISOString()
  });
  `}
});

// Memory stats endpoint
app.get('/api/memory-stats', (req, res) => {
  const stats = process.memoryUsage();
  res.json({
    ...stats,
    requestCount,
    ${memoryLeakSimulation ? 'leakArrayLength: memoryLeak.length,' : ''}
    timestamp: new Date().toISOString()
  });
});

// Performance metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.json({
    requestCount,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    ${memoryLeakSimulation ? 'memoryLeaks: memoryLeak.length,' : ''}
    timestamp: new Date().toISOString()
  });
});

const server = app.listen(${port}, () => {
  console.log('Load test server listening on port ${port}');
  console.log('Server ready for performance testing');
});

// Graceful shutdown
function shutdown() {
  console.log('Performance test server shutting down...');
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
`;

    const scriptPath = path.join(this.testDataDir, `perf-server-${port}.js`);
    await fs.writeFile(scriptPath, serverCode);
    return scriptPath;
  }

  async startPerformanceServer(port, options = {}) {
    const scriptPath = await this.createLoadTestServer(port, options);
    
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.testDataDir
      });

      let output = '';

      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (data.toString().includes('Server ready for performance testing')) {
          resolve({
            process: serverProcess,
            port,
            scriptPath,
            output: () => output
          });
        }
      });

      serverProcess.stderr.on('data', (data) => {
        console.error('Server error:', data.toString());
      });

      serverProcess.on('error', reject);
      
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill();
          reject(new Error(`Performance server failed to start on port ${port}`));
        }
      }, 10000);
      
      this.processes.push(serverProcess);
    });
  }

  async createMonitor() {
    const monitor = await FullStackMonitor.create(this.resourceManager);
    this.monitors.push(monitor);
    return monitor;
  }

  measurePerformance(operation) {
    return {
      start: () => {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        
        return {
          end: () => {
            const endTime = Date.now();
            const endMemory = process.memoryUsage();
            
            const result = {
              operation,
              duration: endTime - startTime,
              memoryDelta: {
                rss: endMemory.rss - startMemory.rss,
                heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                heapTotal: endMemory.heapTotal - startMemory.heapTotal,
                external: endMemory.external - startMemory.external
              },
              timestamp: new Date().toISOString()
            };
            
            this.performanceResults.push(result);
            return result;
          }
        };
      }
    };
  }

  getPerformanceReport() {
    if (this.performanceResults.length === 0) {
      return { message: 'No performance data collected' };
    }

    const durations = this.performanceResults.map(r => r.duration);
    const memoryUsages = this.performanceResults.map(r => r.memoryDelta.heapUsed);

    return {
      totalTests: this.performanceResults.length,
      duration: {
        min: Math.min(...durations),
        max: Math.max(...durations),
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        median: durations.sort((a, b) => a - b)[Math.floor(durations.length / 2)]
      },
      memory: {
        minDelta: Math.min(...memoryUsages),
        maxDelta: Math.max(...memoryUsages),
        averageDelta: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
      },
      results: this.performanceResults
    };
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
        files.filter(f => f.startsWith('perf-server-'))
              .map(f => fs.unlink(path.join(this.testDataDir, f)).catch(() => {}))
      );
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

describe('Performance and Load Testing', () => {
  let testManager;

  beforeAll(() => {
    testManager = new PerformanceTestManager();
  });

  afterAll(async () => {
    await testManager.cleanup();
    
    // Output performance report
    const report = testManager.getPerformanceReport();
    console.log('\n' + '='.repeat(50));
    console.log('PERFORMANCE TEST REPORT');
    console.log('='.repeat(50));
    console.log(JSON.stringify(report, null, 2));
    console.log('='.repeat(50));
  }, 30000);

  describe('Single Session Performance', () => {
    it('should handle high-frequency debug scenarios efficiently', async () => {
      const perfMeasure = testManager.measurePerformance('high-frequency-scenarios');
      const measurement = perfMeasure.start();

      const server = await testManager.startPerformanceServer(4001, {
        responseDelayMs: 50 // Small delay to simulate real server
      });

      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'perf-backend',
          port: 4001
        },
        frontend: {
          url: `http://localhost:4001/health`,
          browserOptions: { headless: true }
        }
      });

      // Execute multiple rapid scenarios
      const rapidScenarios = [
        [{ action: 'navigate', url: `http://localhost:4001/api/load-test` }],
        [{ action: 'navigate', url: `http://localhost:4001/api/metrics` }],
        [{ action: 'navigate', url: `http://localhost:4001/health` }],
        [{ action: 'navigate', url: `http://localhost:4001/api/memory-stats` }],
        [{ action: 'screenshot' }]
      ];

      const startTime = Date.now();
      const results = [];

      for (const scenario of rapidScenarios) {
        const result = await monitor.debugScenario(scenario);
        results.push(result);
      }

      const totalTime = Date.now() - startTime;
      const perfResult = measurement.end();

      // Verify all scenarios completed successfully
      expect(results.every(scenarioResult => 
        scenarioResult.every(step => step.success === true)
      )).toBe(true);

      // Performance assertions
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(perfResult.duration).toBeLessThan(10000);

      // Memory usage should be reasonable
      expect(perfResult.memoryDelta.heapUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB increase

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(5);
      expect(stats.totalStepsExecuted).toBe(5);

    }, 30000);

    it('should maintain performance under correlation tracking load', async () => {
      const perfMeasure = testManager.measurePerformance('correlation-tracking-load');
      const measurement = perfMeasure.start();

      const server = await testManager.startPerformanceServer(4002);
      const monitor = await testManager.createMonitor();

      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'correlation-perf-backend',
          port: 4002
        },
        frontend: {
          url: `http://localhost:4002/health`
        }
      });

      // Generate many correlations quickly
      const correlationIds = [];
      for (let i = 0; i < 50; i++) {
        const correlationId = `perf-test-correlation-${i}`;
        correlationIds.push(correlationId);
        
        await monitor.trackCorrelation(correlationId, {
          frontend: { url: `/api/test-${i}`, method: 'GET' },
          backend: { processId: 4002, message: `Processing ${i}` }
        });
      }

      const perfResult = measurement.end();

      // Verify all correlations were tracked
      expect(monitor.correlations.size).toBe(50);
      expect(correlationListener).toHaveBeenCalledTimes(50);

      // Performance should still be good with many correlations
      expect(perfResult.duration).toBeLessThan(5000); // < 5 seconds for 50 correlations

      const stats = monitor.getStatistics();
      expect(stats.correlationsDetected).toBe(50);
      expect(stats.correlations).toBe(50);

      // Test correlation lookup performance
      const lookupStart = Date.now();
      const correlatedLogs = await monitor.getCorrelatedLogs(correlationIds[0]);
      const lookupTime = Date.now() - lookupStart;

      expect(lookupTime).toBeLessThan(1000); // Should be fast even with many correlations
      expect(correlatedLogs).toBeDefined();

    }, 20000);

    it('should handle large debug scenarios efficiently', async () => {
      const perfMeasure = testManager.measurePerformance('large-debug-scenarios');
      const measurement = perfMeasure.start();

      const server = await testManager.startPerformanceServer(4003);
      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'large-scenario-backend',
          port: 4003
        },
        frontend: {
          url: `http://localhost:4003/health`
        }
      });

      // Create a large scenario with many steps
      const largeScenario = [
        { action: 'navigate', url: `http://localhost:4003/health` },
        { action: 'navigate', url: `http://localhost:4003/api/load-test` },
        { action: 'navigate', url: `http://localhost:4003/api/metrics` },
        { action: 'navigate', url: `http://localhost:4003/api/memory-stats` },
        { action: 'navigate', url: `http://localhost:4003/health` },
        { action: 'navigate', url: `http://localhost:4003/api/load-test` },
        { action: 'navigate', url: `http://localhost:4003/api/metrics` },
        { action: 'navigate', url: `http://localhost:4003/api/memory-stats` },
        { action: 'navigate', url: `http://localhost:4003/health` },
        { action: 'navigate', url: `http://localhost:4003/api/load-test` },
        { action: 'screenshot', options: { fullPage: true } }
      ];

      const results = await monitor.debugScenario(largeScenario);
      const perfResult = measurement.end();

      expect(results).toHaveLength(11);
      expect(results.every(r => r.success === true)).toBe(true);

      // Should handle large scenarios reasonably quickly
      expect(perfResult.duration).toBeLessThan(20000); // < 20 seconds

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(1);
      expect(stats.totalStepsExecuted).toBe(11);

    }, 30000);
  });

  describe('Multiple Concurrent Sessions', () => {
    it('should handle multiple concurrent monitors efficiently', async () => {
      const perfMeasure = testManager.measurePerformance('concurrent-monitors');
      const measurement = perfMeasure.start();

      const numMonitors = 3;
      const servers = [];
      const monitors = [];

      // Start multiple servers and monitors
      for (let i = 0; i < numMonitors; i++) {
        const port = 4010 + i;
        const server = await testManager.startPerformanceServer(port);
        servers.push(server);

        const monitor = await testManager.createMonitor();
        monitors.push(monitor);

        await monitor.monitorFullStackApp({
          backend: {
            script: server.scriptPath,
            name: `concurrent-backend-${i}`,
            port: port
          },
          frontend: {
            url: `http://localhost:${port}/health`
          }
        });
      }

      // Execute scenarios on all monitors concurrently
      const concurrentScenarios = monitors.map((monitor, index) => {
        const port = 4010 + index;
        return monitor.debugScenario([
          { action: 'navigate', url: `http://localhost:${port}/api/load-test` },
          { action: 'navigate', url: `http://localhost:${port}/api/metrics` },
          { action: 'screenshot' }
        ]);
      });

      const allResults = await Promise.all(concurrentScenarios);
      const perfResult = measurement.end();

      // Verify all concurrent scenarios completed successfully
      allResults.forEach((results, index) => {
        expect(results).toHaveLength(3);
        expect(results.every(r => r.success === true)).toBe(true);
      });

      // Performance should scale reasonably with multiple monitors
      expect(perfResult.duration).toBeLessThan(15000); // < 15 seconds for 3 concurrent monitors

      // Verify each monitor's statistics
      monitors.forEach((monitor, index) => {
        const stats = monitor.getStatistics();
        expect(stats.debugScenariosRun).toBe(1);
        expect(stats.totalStepsExecuted).toBe(3);
        expect(stats.activeBackends).toBe(1);
        expect(stats.activeBrowsers).toBe(1);
      });

    }, 45000);

    it('should handle resource cleanup under load', async () => {
      const perfMeasure = testManager.measurePerformance('resource-cleanup-load');
      const measurement = perfMeasure.start();

      const monitors = [];
      const servers = [];

      // Create and cleanup multiple monitors in sequence
      for (let i = 0; i < 5; i++) {
        const port = 4020 + i;
        const server = await testManager.startPerformanceServer(port);
        servers.push(server);

        const monitor = await testManager.createMonitor();
        
        await monitor.monitorFullStackApp({
          backend: {
            script: server.scriptPath,
            name: `cleanup-test-backend-${i}`,
            port: port
          },
          frontend: {
            url: `http://localhost:${port}/health`
          }
        });

        // Execute a quick scenario
        await monitor.debugScenario([
          { action: 'navigate', url: `http://localhost:${port}/api/load-test` }
        ]);

        // Immediate cleanup
        await monitor.cleanup();
      }

      const perfResult = measurement.end();

      // Resource cleanup should be efficient
      expect(perfResult.duration).toBeLessThan(20000); // < 20 seconds for 5 create/cleanup cycles
      
      // Memory usage should not grow significantly
      expect(perfResult.memoryDelta.heapUsed).toBeLessThan(50 * 1024 * 1024); // < 50MB increase

    }, 60000);
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage over extended operation', async () => {
      const perfMeasure = testManager.measurePerformance('extended-memory-stability');
      const measurement = perfMeasure.start();

      const server = await testManager.startPerformanceServer(4030, {
        memoryLeakSimulation: false // Ensure clean server
      });

      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'memory-stability-backend',
          port: 4030
        },
        frontend: {
          url: `http://localhost:4030/health`
        }
      });

      const initialMemory = process.memoryUsage();
      const memoryCheckpoints = [];

      // Run many small operations and track memory
      for (let i = 0; i < 20; i++) {
        await monitor.debugScenario([
          { action: 'navigate', url: `http://localhost:4030/api/load-test` }
        ]);

        // Track correlation
        await monitor.trackCorrelation(`memory-test-${i}`, {
          frontend: { url: `/test-${i}` },
          backend: { processId: 4030, message: `Test ${i}` }
        });

        if (i % 5 === 0) {
          memoryCheckpoints.push({
            iteration: i,
            memory: process.memoryUsage()
          });
        }
      }

      const finalMemory = process.memoryUsage();
      const perfResult = measurement.end();

      // Memory should not grow excessively
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // < 100MB growth

      // Check that memory growth is not accelerating
      if (memoryCheckpoints.length >= 2) {
        const earlyGrowth = memoryCheckpoints[1].memory.heapUsed - memoryCheckpoints[0].memory.heapUsed;
        const lateGrowth = memoryCheckpoints[memoryCheckpoints.length - 1].memory.heapUsed - 
                          memoryCheckpoints[memoryCheckpoints.length - 2].memory.heapUsed;
        
        // Late growth should not be significantly higher than early growth
        expect(lateGrowth).toBeLessThan(earlyGrowth * 3);
      }

      const stats = monitor.getStatistics();
      expect(stats.correlations).toBe(20);
      expect(stats.debugScenariosRun).toBe(20);

    }, 45000);

    it('should handle correlation map growth efficiently', async () => {
      const perfMeasure = testManager.measurePerformance('correlation-map-growth');
      const measurement = perfMeasure.start();

      const monitor = await testManager.createMonitor();

      // Create many correlations to test map performance
      const numCorrelations = 1000;
      
      for (let i = 0; i < numCorrelations; i++) {
        await monitor.trackCorrelation(`large-map-test-${i}`, {
          frontend: { 
            url: `/api/test-${i}`, 
            method: 'GET',
            timestamp: new Date()
          },
          backend: { 
            processId: 5000 + i, 
            message: `Processing request ${i}`,
            level: 'info',
            timestamp: new Date()
          }
        });
      }

      // Test lookup performance with large map
      const lookupStart = Date.now();
      const correlation = monitor.getCorrelation('large-map-test-500');
      const lookupTime = Date.now() - lookupStart;

      const perfResult = measurement.end();

      expect(monitor.correlations.size).toBe(numCorrelations);
      expect(correlation).toBeDefined();
      expect(lookupTime).toBeLessThan(10); // Should be very fast lookup

      // Creating 1000 correlations should complete in reasonable time
      expect(perfResult.duration).toBeLessThan(10000); // < 10 seconds

      const stats = monitor.getStatistics();
      expect(stats.correlationsDetected).toBe(numCorrelations);

    }, 30000);
  });

  describe('Browser Performance Under Load', () => {
    it('should handle rapid browser operations efficiently', async () => {
      const perfMeasure = testManager.measurePerformance('rapid-browser-operations');
      const measurement = perfMeasure.start();

      const server = await testManager.startPerformanceServer(4040);
      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'browser-perf-backend',
          port: 4040
        },
        frontend: {
          url: `http://localhost:4040/health`
        }
      });

      // Rapid navigation operations
      const urls = [
        `http://localhost:4040/health`,
        `http://localhost:4040/api/load-test`,
        `http://localhost:4040/api/metrics`,
        `http://localhost:4040/api/memory-stats`,
        `http://localhost:4040/health`
      ];

      const rapidNavigations = urls.map(url => ({ action: 'navigate', url }));
      rapidNavigations.push({ action: 'screenshot' });

      const results = await monitor.debugScenario(rapidNavigations);
      const perfResult = measurement.end();

      expect(results).toHaveLength(6);
      expect(results.every(r => r.success === true)).toBe(true);

      // Should handle rapid navigations efficiently
      expect(perfResult.duration).toBeLessThan(15000); // < 15 seconds

    }, 25000);

    it('should maintain browser stability under screenshot load', async () => {
      const perfMeasure = testManager.measurePerformance('screenshot-load-stability');
      const measurement = perfMeasure.start();

      const server = await testManager.startPerformanceServer(4041);
      const monitor = await testManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'screenshot-perf-backend',
          port: 4041
        },
        frontend: {
          url: `http://localhost:4041/health`
        }
      });

      // Take multiple screenshots
      const screenshotScenario = [];
      for (let i = 0; i < 10; i++) {
        screenshotScenario.push({
          action: 'screenshot',
          options: { fullPage: i % 2 === 0 } // Alternate between full page and viewport
        });
      }

      const results = await monitor.debugScenario(screenshotScenario);
      const perfResult = measurement.end();

      expect(results).toHaveLength(10);
      expect(results.every(r => r.success === true)).toBe(true);
      expect(results.every(r => r.screenshot !== undefined)).toBe(true);

      // Screenshot operations should complete in reasonable time
      expect(perfResult.duration).toBeLessThan(20000); // < 20 seconds for 10 screenshots

    }, 30000);
  });
});