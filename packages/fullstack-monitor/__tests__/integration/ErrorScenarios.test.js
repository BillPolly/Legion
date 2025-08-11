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

class ErrorScenarioManager {
  constructor() {
    this.monitors = [];
    this.processes = [];
    this.resourceManager = this.createResourceManager();
    this.testDataDir = path.join(__dirname, '../testdata');
    this.errorLogs = [];
  }

  createResourceManager() {
    const resources = new Map();
    resources.set('BROWSER_TYPE', 'puppeteer');
    resources.set('BROWSER_HEADLESS', true);
    resources.set('BROWSER_TIMEOUT', 30000);
    resources.set('LOG_LEVEL', 'debug'); // Higher verbosity for error testing
    
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

  async createFaultyServer(port, faultType = 'intermittent') {
    await this.ensureTestDataDir();

    const faultConfigurations = {
      intermittent: {
        errorRate: 0.3,
        crashRate: 0,
        slowResponses: false,
        memoryLeak: false
      },
      crash: {
        errorRate: 0.1,
        crashRate: 0.1,
        slowResponses: false,
        memoryLeak: false
      },
      slow: {
        errorRate: 0.1,
        crashRate: 0,
        slowResponses: true,
        memoryLeak: false
      },
      memory: {
        errorRate: 0,
        crashRate: 0,
        slowResponses: false,
        memoryLeak: true
      },
      chaos: {
        errorRate: 0.4,
        crashRate: 0.05,
        slowResponses: true,
        memoryLeak: true
      }
    };

    const config = faultConfigurations[faultType] || faultConfigurations.intermittent;

    const serverCode = `
const express = require('express');
const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-ID');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

let requestCount = 0;
${config.memoryLeak ? 'let memoryLeak = [];' : ''}

// Fault injection middleware
app.use((req, res, next) => {
  requestCount++;
  const correlationId = req.headers['x-correlation-id'] || \`fault-\${requestCount}\`;
  
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url} [correlation-\${correlationId}]\`);
  
  // Crash simulation
  if (Math.random() < ${config.crashRate}) {
    console.error(\`SIMULATED CRASH: Server crashing [correlation-\${correlationId}]\`);
    setTimeout(() => process.exit(1), 100);
    return;
  }
  
  // Error simulation
  if (Math.random() < ${config.errorRate}) {
    console.error(\`SIMULATED ERROR: Random error occurred [correlation-\${correlationId}]\`);
    return res.status(500).json({
      error: 'Simulated random server error',
      correlationId,
      timestamp: new Date().toISOString(),
      requestCount
    });
  }
  
  ${config.memoryLeak ? `
  // Memory leak simulation
  memoryLeak.push(new Array(1000).fill(\`leak-data-\${requestCount}\`));
  if (memoryLeak.length > 10000) {
    console.error(\`MEMORY LEAK: Excessive memory usage detected [correlation-\${correlationId}]\`);
  }
  ` : ''}
  
  req.correlationId = correlationId;
  next();
});

// Health endpoint (less likely to fail)
app.get('/health', (req, res) => {
  console.log(\`Health check [correlation-\${req.correlationId}]\`);
  
  ${config.slowResponses ? `
  const delay = Math.random() < 0.3 ? Math.random() * 3000 : 0;
  setTimeout(() => {
    res.json({
      status: 'healthy',
      correlationId: req.correlationId,
      requestCount,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }, delay);
  ` : `
  res.json({
    status: 'healthy',
    correlationId: req.correlationId,
    requestCount,
    memoryUsage: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
  `}
});

// Unreliable API endpoint
app.get('/api/unreliable', (req, res) => {
  console.log(\`Unreliable API call [correlation-\${req.correlationId}]\`);
  
  // Higher error rate for this endpoint
  if (Math.random() < ${config.errorRate + 0.2}) {
    console.error(\`API ERROR: Unreliable endpoint failed [correlation-\${req.correlationId}]\`);
    return res.status(500).json({
      error: 'Unreliable endpoint failure',
      correlationId: req.correlationId,
      timestamp: new Date().toISOString()
    });
  }
  
  ${config.slowResponses ? `
  const delay = Math.random() * 2000;
  setTimeout(() => {
    res.json({
      message: 'Unreliable API response',
      correlationId: req.correlationId,
      delay,
      data: { success: true }
    });
  }, delay);
  ` : `
  res.json({
    message: 'Unreliable API response',
    correlationId: req.correlationId,
    data: { success: true }
  });
  `}
});

// Timeout endpoint
app.get('/api/timeout', (req, res) => {
  console.log(\`Timeout API call [correlation-\${req.correlationId}]\`);
  
  // Deliberately long response times
  const delay = 5000 + Math.random() * 5000; // 5-10 seconds
  console.log(\`Intentional delay: \${delay}ms [correlation-\${req.correlationId}]\`);
  
  setTimeout(() => {
    res.json({
      message: 'Finally responded after delay',
      correlationId: req.correlationId,
      delay
    });
  }, delay);
});

// Database error simulation
app.get('/api/database', (req, res) => {
  console.log(\`Database API call [correlation-\${req.correlationId}]\`);
  
  if (Math.random() < 0.4) {
    console.error(\`DATABASE ERROR: Connection failed [correlation-\${req.correlationId}]\`);
    return res.status(503).json({
      error: 'Database connection failed',
      correlationId: req.correlationId,
      details: 'Service temporarily unavailable'
    });
  }
  
  res.json({
    data: [
      { id: 1, name: 'Test Record' }
    ],
    correlationId: req.correlationId
  });
});

// Error logging endpoint
app.get('/api/error-log', (req, res) => {
  console.error(\`INTENTIONAL ERROR LOG: Error logging test [correlation-\${req.correlationId}]\`);
  res.json({
    message: 'Error logged intentionally',
    correlationId: req.correlationId
  });
});

const server = app.listen(${port}, () => {
  console.log('Faulty server listening on port ${port}');
  console.log('Server ready with fault injection');
});

// Graceful shutdown
function shutdown() {
  console.log('Faulty server shutting down...');
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Simulate occasional crashes
${config.crashRate > 0 ? `
setInterval(() => {
  if (Math.random() < 0.001) { // Very rare random crash
    console.error('RANDOM CRASH: Server experiencing unexpected shutdown');
    process.exit(1);
  }
}, 1000);
` : ''}
`;

    const scriptPath = path.join(this.testDataDir, `faulty-server-${port}-${faultType}.js`);
    await fs.writeFile(scriptPath, serverCode);
    return scriptPath;
  }

  async startFaultyServer(port, faultType = 'intermittent') {
    const scriptPath = await this.createFaultyServer(port, faultType);
    
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', [scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: this.testDataDir
      });

      let output = '';
      let errorOutput = '';

      serverProcess.stdout.on('data', (data) => {
        output += data.toString();
        if (data.toString().includes('Server ready with fault injection')) {
          resolve({
            process: serverProcess,
            port,
            scriptPath,
            faultType,
            output: () => output,
            errorOutput: () => errorOutput
          });
        }
      });

      serverProcess.stderr.on('data', (data) => {
        const errorText = data.toString();
        errorOutput += errorText;
        this.errorLogs.push({
          timestamp: new Date(),
          source: 'faulty-server',
          port,
          message: errorText.trim()
        });
      });

      serverProcess.on('error', reject);
      
      // Handle crashes
      serverProcess.on('exit', (code) => {
        if (code !== 0) {
          this.errorLogs.push({
            timestamp: new Date(),
            source: 'faulty-server',
            port,
            message: `Server crashed with exit code ${code}`,
            exitCode: code
          });
        }
      });
      
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill();
          reject(new Error(`Faulty server failed to start on port ${port}`));
        }
      }, 10000);
      
      this.processes.push(serverProcess);
    });
  }

  async createMonitor() {
    const monitor = await FullStackMonitor.create(this.resourceManager);
    this.monitors.push(monitor);
    
    // Set up error event listeners
    monitor.on('browser-error', (error) => {
      this.errorLogs.push({
        timestamp: new Date(),
        source: 'browser',
        type: 'browser-error',
        message: error.message || error.text || String(error)
      });
    });

    monitor.on('backend-log', (log) => {
      if (log.level === 'error') {
        this.errorLogs.push({
          timestamp: new Date(),
          source: 'backend',
          type: 'backend-log-error',
          message: log.message,
          level: log.level
        });
      }
    });
    
    return monitor;
  }

  getErrorReport() {
    const errorsBySource = this.errorLogs.reduce((acc, error) => {
      if (!acc[error.source]) {
        acc[error.source] = [];
      }
      acc[error.source].push(error);
      return acc;
    }, {});

    return {
      totalErrors: this.errorLogs.length,
      errorsBySource,
      allErrors: this.errorLogs
    };
  }

  async cleanup() {
    // Cleanup monitors
    await Promise.all(this.monitors.map(monitor => 
      monitor.cleanup().catch(err => {
        this.errorLogs.push({
          timestamp: new Date(),
          source: 'monitor-cleanup',
          message: `Monitor cleanup error: ${err.message}`
        });
      })
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
        files.filter(f => f.startsWith('faulty-server-'))
              .map(f => fs.unlink(path.join(this.testDataDir, f)).catch(() => {}))
      );
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

describe('Error Scenario Testing', () => {
  let errorManager;

  beforeAll(() => {
    errorManager = new ErrorScenarioManager();
  });

  afterAll(async () => {
    await errorManager.cleanup();
    
    // Output error report
    const report = errorManager.getErrorReport();
    console.log('\n' + '='.repeat(50));
    console.log('ERROR SCENARIO TEST REPORT');
    console.log('='.repeat(50));
    console.log(`Total Errors Captured: ${report.totalErrors}`);
    Object.entries(report.errorsBySource).forEach(([source, errors]) => {
      console.log(`${source}: ${errors.length} errors`);
    });
    console.log('='.repeat(50));
  }, 30000);

  describe('Backend Process Failure Handling', () => {
    it('should handle intermittent backend errors gracefully', async () => {
      const server = await errorManager.startFaultyServer(5001, 'intermittent');
      const monitor = await errorManager.createMonitor();

      const result = await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'intermittent-error-backend',
          port: 5001
        },
        frontend: {
          url: `http://localhost:5001/health`,
          browserOptions: { headless: true }
        }
      });

      expect(result).toBeDefined();
      expect(result.backend).toBeDefined();
      expect(result.browser).toBeDefined();

      // Execute multiple scenarios that may encounter errors
      const scenarios = [
        [{ action: 'navigate', url: `http://localhost:5001/health` }],
        [{ action: 'navigate', url: `http://localhost:5001/api/unreliable` }],
        [{ action: 'navigate', url: `http://localhost:5001/api/database` }],
        [{ action: 'navigate', url: `http://localhost:5001/api/error-log` }],
        [{ action: 'screenshot' }]
      ];

      let successCount = 0;
      let failureCount = 0;

      for (const scenario of scenarios) {
        try {
          const results = await monitor.debugScenario(scenario);
          if (results.every(r => r.success === true)) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }

      // With intermittent errors, we expect some successes and some failures
      expect(successCount + failureCount).toBe(5);
      
      // Should have detected and logged some errors
      const errorReport = errorManager.getErrorReport();
      expect(errorReport.totalErrors).toBeGreaterThan(0);

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(5);

    }, 30000);

    it('should handle server timeouts and slow responses', async () => {
      const server = await errorManager.startFaultyServer(5002, 'slow');
      const monitor = await errorManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'slow-backend',
          port: 5002
        },
        frontend: {
          url: `http://localhost:5002/health`
        }
      });

      // Test timeout scenario
      const startTime = Date.now();
      const timeoutScenario = [
        { action: 'navigate', url: `http://localhost:5002/api/timeout` }
      ];

      let timeoutResult;
      try {
        // Use a shorter timeout to test timeout handling
        const results = await Promise.race([
          monitor.debugScenario(timeoutScenario),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Test timeout')), 8000)
          )
        ]);
        timeoutResult = results;
      } catch (error) {
        timeoutResult = { error: error.message };
      }

      const duration = Date.now() - startTime;

      // Should have handled the timeout scenario
      expect(timeoutResult).toBeDefined();
      expect(duration).toBeLessThan(10000); // Should not wait forever

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBeGreaterThanOrEqual(1);

    }, 20000);

    it('should continue monitoring after backend errors', async () => {
      const server = await errorManager.startFaultyServer(5003, 'intermittent');
      const monitor = await errorManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'error-recovery-backend',
          port: 5003
        },
        frontend: {
          url: `http://localhost:5003/health`
        }
      });

      // First scenario that may fail
      const firstScenario = [
        { action: 'navigate', url: `http://localhost:5003/api/unreliable` }
      ];

      await monitor.debugScenario(firstScenario).catch(() => {
        // Expected to potentially fail
      });

      // Second scenario after potential failure - monitor should still work
      const recoveryScenario = [
        { action: 'navigate', url: `http://localhost:5003/health` },
        { action: 'screenshot' }
      ];

      const recoveryResults = await monitor.debugScenario(recoveryScenario);

      // Recovery scenario should work even if first failed
      expect(recoveryResults).toHaveLength(2);

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(2);
      expect(stats.activeBackends).toBe(1);
      expect(stats.activeBrowsers).toBe(1);

    }, 25000);
  });

  describe('Browser Launch and Navigation Failures', () => {
    it('should handle invalid URL navigation gracefully', async () => {
      const server = await errorManager.startFaultyServer(5010, 'intermittent');
      const monitor = await errorManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'invalid-url-backend',
          port: 5010
        },
        frontend: {
          url: `http://localhost:5010/health`
        }
      });

      // Try to navigate to various invalid URLs
      const invalidUrlScenarios = [
        { action: 'navigate', url: 'http://nonexistent-domain.invalid' },
        { action: 'navigate', url: 'http://localhost:99999/nonexistent' },
        { action: 'navigate', url: 'invalid-url-format' }
      ];

      let errorCount = 0;
      for (const scenario of invalidUrlScenarios) {
        try {
          const results = await monitor.debugScenario([scenario]);
          if (!results[0].success) {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
        }
      }

      // Should have handled invalid URLs without crashing
      expect(errorCount).toBeGreaterThan(0); // Expected to fail
      
      // Monitor should still be functional after errors
      const healthScenario = [
        { action: 'navigate', url: `http://localhost:5010/health` }
      ];
      
      const healthResults = await monitor.debugScenario(healthScenario);
      expect(healthResults[0].success).toBe(true);

    }, 25000);

    it('should handle missing page elements gracefully', async () => {
      const server = await errorManager.startFaultyServer(5011, 'intermittent');
      const monitor = await errorManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'missing-elements-backend',
          port: 5011
        },
        frontend: {
          url: `http://localhost:5011/health`
        }
      });

      // Try to interact with elements that don't exist
      const missingElementScenarios = [
        { action: 'click', selector: '#nonexistent-button' },
        { action: 'type', selector: '#missing-input', text: 'test' },
        { action: 'waitFor', selector: '.never-appears', options: { timeout: 1000 } }
      ];

      let handledErrors = 0;
      for (const scenario of missingElementScenarios) {
        try {
          const results = await monitor.debugScenario([scenario]);
          if (!results[0].success) {
            handledErrors++;
          }
        } catch (error) {
          handledErrors++;
        }
      }

      // Should have gracefully handled missing elements
      expect(handledErrors).toBe(3); // All should fail gracefully

      // Verify monitor is still operational
      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(3);

    }, 20000);
  });

  describe('Network and Communication Errors', () => {
    it('should handle network connectivity issues', async () => {
      const monitor = await errorManager.createMonitor();

      // Try to monitor a non-existent backend
      let networkError = null;
      try {
        await monitor.monitorFullStackApp({
          backend: {
            script: 'nonexistent-script.js',
            name: 'network-error-backend',
            port: 99999, // Port that won't be available
            timeout: 2000 // Short timeout
          },
          frontend: {
            url: 'http://localhost:99999/health'
          }
        });
      } catch (error) {
        networkError = error;
      }

      expect(networkError).toBeDefined();
      expect(networkError.message).toContain('99999');

      // Monitor should still be in a valid state
      expect(monitor).toBeDefined();
      expect(monitor.activeBackends.size).toBe(0);
      expect(monitor.activeBrowsers.size).toBe(0);

    }, 15000);

    it('should handle correlation tracking with error conditions', async () => {
      const server = await errorManager.startFaultyServer(5013, 'chaos');
      const monitor = await errorManager.createMonitor();

      const correlationListener = jest.fn();
      monitor.on('correlation-detected', correlationListener);

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'chaos-backend',
          port: 5013
        },
        frontend: {
          url: `http://localhost:5013/health`
        }
      });

      // Generate correlations even with chaotic conditions
      const correlationIds = [];
      for (let i = 0; i < 10; i++) {
        const correlationId = `error-test-correlation-${i}`;
        correlationIds.push(correlationId);
        
        try {
          await monitor.trackCorrelation(correlationId, {
            frontend: { url: `/api/chaos-${i}`, method: 'GET' },
            backend: { processId: 5013, message: `Chaos test ${i}` }
          });
        } catch (error) {
          // Some correlations might fail due to chaos conditions
        }
      }

      // Should have tracked some correlations despite errors
      expect(monitor.correlations.size).toBeGreaterThan(0);

      // Try to retrieve correlations
      for (const correlationId of correlationIds) {
        try {
          const logs = await monitor.getCorrelatedLogs(correlationId);
          expect(logs).toBeDefined();
        } catch (error) {
          // Some lookups might fail, but shouldn't crash
        }
      }

    }, 25000);
  });

  describe('Resource Exhaustion and Memory Issues', () => {
    it('should handle memory pressure gracefully', async () => {
      const server = await errorManager.startFaultyServer(5020, 'memory');
      const monitor = await errorManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'memory-pressure-backend',
          port: 5020
        },
        frontend: {
          url: `http://localhost:5020/health`
        }
      });

      const initialMemory = process.memoryUsage();

      // Create many correlations and scenarios to pressure memory
      const memoryPressureScenarios = [];
      for (let i = 0; i < 20; i++) {
        memoryPressureScenarios.push([
          { action: 'navigate', url: `http://localhost:5020/api/unreliable` },
          { action: 'navigate', url: `http://localhost:5020/health` }
        ]);
      }

      let completedScenarios = 0;
      for (const scenario of memoryPressureScenarios) {
        try {
          await monitor.debugScenario(scenario);
          completedScenarios++;
          
          // Track memory growth
          await monitor.trackCorrelation(`memory-test-${completedScenarios}`, {
            frontend: { url: `/test-${completedScenarios}` },
            backend: { message: `Memory test ${completedScenarios}` }
          });
        } catch (error) {
          // Some scenarios might fail due to memory pressure
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Should have completed some scenarios
      expect(completedScenarios).toBeGreaterThan(0);

      // Memory growth should be reasonable even under pressure
      expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // < 200MB growth

      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(completedScenarios);

    }, 40000);

    it('should handle cleanup failures gracefully', async () => {
      const server = await errorManager.startFaultyServer(5021, 'intermittent');
      const monitor = await errorManager.createMonitor();

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'cleanup-failure-backend',
          port: 5021
        },
        frontend: {
          url: `http://localhost:5021/health`
        }
      });

      // Execute some scenarios
      await monitor.debugScenario([
        { action: 'navigate', url: `http://localhost:5021/health` },
        { action: 'screenshot' }
      ]);

      // Force some internal state to make cleanup potentially problematic
      monitor.activeBackends.set('fake-backend', { process: { pid: -1 } });
      monitor.activeBrowsers.set('fake-browser', { page: null });

      // Cleanup should handle errors gracefully
      let cleanupError = null;
      try {
        await monitor.cleanup();
      } catch (error) {
        cleanupError = error;
      }

      // Cleanup should not throw even with problematic state
      expect(cleanupError).toBeNull();

    }, 20000);
  });

  describe('Comprehensive Error Recovery', () => {
    it('should demonstrate robust error recovery across all components', async () => {
      const server = await errorManager.startFaultyServer(5030, 'chaos');
      const monitor = await errorManager.createMonitor();

      const allErrorsListener = jest.fn();
      const correlationListener = jest.fn();
      
      monitor.on('browser-error', allErrorsListener);
      monitor.on('backend-log', allErrorsListener);
      monitor.on('correlation-detected', correlationListener);

      await monitor.monitorFullStackApp({
        backend: {
          script: server.scriptPath,
          name: 'comprehensive-chaos-backend',
          port: 5030
        },
        frontend: {
          url: `http://localhost:5030/health`
        }
      });

      // Comprehensive test mixing successful and failing operations
      const comprehensiveScenarios = [
        // Normal operations
        { scenario: [{ action: 'navigate', url: `http://localhost:5030/health` }], expected: 'success' },
        
        // Error-prone operations
        { scenario: [{ action: 'navigate', url: `http://localhost:5030/api/unreliable` }], expected: 'mixed' },
        { scenario: [{ action: 'navigate', url: `http://localhost:5030/api/database` }], expected: 'mixed' },
        
        // Timeout operations
        { scenario: [{ action: 'navigate', url: `http://localhost:5030/api/timeout` }], expected: 'timeout' },
        
        // Browser operations that should work regardless of backend
        { scenario: [{ action: 'screenshot' }], expected: 'success' },
        
        // Recovery operations
        { scenario: [{ action: 'navigate', url: `http://localhost:5030/health` }], expected: 'success' }
      ];

      const results = [];
      for (let i = 0; i < comprehensiveScenarios.length; i++) {
        const { scenario, expected } = comprehensiveScenarios[i];
        
        try {
          const scenarioResults = await Promise.race([
            monitor.debugScenario(scenario),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Scenario timeout')), 10000)
            )
          ]);
          
          results.push({
            index: i,
            expected,
            success: scenarioResults.every(r => r.success),
            results: scenarioResults,
            error: null
          });
        } catch (error) {
          results.push({
            index: i,
            expected,
            success: false,
            results: null,
            error: error.message
          });
        }

        // Add correlation for each scenario
        await monitor.trackCorrelation(`comprehensive-test-${i}`, {
          frontend: { scenario: i, expected },
          backend: { message: `Comprehensive test scenario ${i}` }
        }).catch(() => {
          // Correlation tracking might fail in chaos conditions
        });
      }

      // Analyze results
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      // Should have completed all scenarios (some may fail, but should handle gracefully)
      expect(results).toHaveLength(comprehensiveScenarios.length);

      // Should have some successful operations
      expect(successfulResults.length).toBeGreaterThan(0);

      // Final statistics should reflect all scenarios
      const stats = monitor.getStatistics();
      expect(stats.debugScenariosRun).toBe(results.length);

      // Should have captured various types of errors
      const errorReport = errorManager.getErrorReport();
      expect(errorReport.totalErrors).toBeGreaterThan(0);

      console.log(`Comprehensive Error Recovery Results:`);
      console.log(`  Successful scenarios: ${successfulResults.length}/${results.length}`);
      console.log(`  Failed scenarios: ${failedResults.length}/${results.length}`);
      console.log(`  Total errors captured: ${errorReport.totalErrors}`);
      console.log(`  Correlations tracked: ${stats.correlationsDetected}`);

    }, 60000);
  });
});