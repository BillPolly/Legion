/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import NodeRunner from '../../src/NodeRunner.js';
import LogManager from '@jsenvoy/log-manager';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Live Process Integration Tests', () => {
  let nodeRunner;
  let logManager;
  let testAppDir;

  beforeAll(async () => {
    nodeRunner = new NodeRunner({ autoCleanup: false });
    logManager = new LogManager();
    
    // Create test app directory
    testAppDir = path.join(__dirname, 'test-app');
    await fs.mkdir(testAppDir, { recursive: true });
  });

  afterAll(async () => {
    await nodeRunner.cleanup();
    await logManager.cleanup();
    await fs.rm(testAppDir, { recursive: true, force: true });
  });

  describe('Real Node.js Process with Logging', () => {
    test('should start a Node.js process and capture its logs', async () => {
      // Create a test script that outputs various log levels
      const testScript = `
        console.log('Application starting...');
        console.log('INFO: Server initializing');
        console.error('ERROR: Database connection failed');
        console.warn('WARN: Using default configuration');
        
        // Simulate some work
        let count = 0;
        const interval = setInterval(() => {
          count++;
          console.log(\`Processing item \${count}\`);
          
          if (count === 3) {
            console.log('Work completed');
            clearInterval(interval);
            process.exit(0);
          }
        }, 500);
        
        // Keep process alive
        process.on('SIGTERM', () => {
          console.log('Received SIGTERM, shutting down gracefully');
          clearInterval(interval);
          process.exit(0);
        });
      `;
      
      await fs.writeFile(path.join(testAppDir, 'test-app.js'), testScript);

      // Start the process
      const processResult = await nodeRunner.startNodeProcess('node test-app.js', {
        cwd: testAppDir
      });
      
      expect(processResult.success).toBe(true);
      expect(processResult.id).toBeDefined();
      expect(processResult.pid).toBeDefined();
      
      // Get process info from ProcessManager
      const processInfo = nodeRunner.processManager.getProcess(processResult.id);
      
      // Capture logs from the process
      const logResult = await logManager.captureLogs({
        source: {
          type: 'process',
          id: processResult.id,
          pid: processResult.pid,
          stdout: processInfo.process.stdout,
          stderr: processInfo.process.stderr
        }
      });
      
      expect(logResult.success).toBe(true);
      
      // Wait for process to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Search for specific log patterns
      const errorLogs = await logManager.searchLogs('ERROR', {
        sources: [processResult.id],
        limit: 10
      });
      
      expect(errorLogs.success).toBe(true);
      expect(errorLogs.matches.length).toBeGreaterThan(0);
      expect(errorLogs.matches[0].message).toContain('Database connection failed');
      
      // Analyze the logs
      const analysis = await logManager.analyzeLogs({
        sources: [processResult.id],
        includeErrors: true
      });
      
      expect(analysis.success).toBe(true);
      expect(analysis.totalLogs).toBeGreaterThan(0);
      expect(analysis.errors.total).toBeGreaterThan(0);
      
      // List processes to verify it's tracked
      const processList = await nodeRunner.listProcesses();
      expect(processList.success).toBe(true);
      expect(processList.processes.some(p => p.id === processResult.id)).toBe(true);
    }, 10000);

    test('should start a web server and monitor its health', async () => {
      // Create a simple HTTP server
      const serverScript = `
        const http = require('http');
        const port = process.env.PORT || 3000;
        
        let requestCount = 0;
        
        const server = http.createServer((req, res) => {
          requestCount++;
          console.log(\`Request \${requestCount}: \${req.method} \${req.url}\`);
          
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'healthy', uptime: process.uptime() }));
          } else if (req.url === '/error') {
            console.error('ERROR: Simulated error endpoint hit');
            res.writeHead(500);
            res.end('Internal Server Error');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello from test server');
          }
        });
        
        server.listen(port, () => {
          console.log(\`Server running on port \${port}\`);
          console.log('INFO: Server ready to accept connections');
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
          console.log('Server shutting down...');
          server.close(() => {
            console.log('Server closed');
            process.exit(0);
          });
        });
      `;
      
      await fs.writeFile(path.join(testAppDir, 'test-server.js'), serverScript);

      // Start the web server
      const serverResult = await nodeRunner.startWebServer('node test-server.js', {
        cwd: testAppDir,
        port: 0, // Use any available port
        healthCheck: true,
        healthCheckPath: '/health'
      });
      
      expect(serverResult.success).toBe(true);
      expect(serverResult.port).toBeGreaterThan(0);
      expect(serverResult.url).toContain('http://localhost:');
      
      // Get server process info
      const serverInfo = nodeRunner.serverManager.getServer(serverResult.id);
      const processInfo = nodeRunner.processManager.getProcess(serverResult.id);
      
      // Set up log monitoring
      const monitorResult = await logManager.monitorErrors({
        sources: [serverResult.id],
        threshold: 3,
        windowMs: 30000
      });
      
      expect(monitorResult.success).toBe(true);
      
      // Capture server logs
      await logManager.captureLogs({
        source: {
          type: 'process',
          id: serverResult.id,
          pid: serverResult.pid,
          stdout: processInfo.process.stdout,
          stderr: processInfo.process.stderr
        }
      });
      
      // Wait for server to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check server health
      const healthResult = await nodeRunner.checkServerHealth(serverResult.id);
      expect(healthResult.success).toBe(true);
      expect(healthResult.status).toBe('healthy');
      
      // Create a log stream for real-time monitoring
      const streamResult = await logManager.streamLogs({
        sources: [serverResult.id],
        levels: ['error', 'warn', 'info']
      });
      
      expect(streamResult.success).toBe(true);
      
      // Simulate some errors by hitting the error endpoint
      const http = await import('http');
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => {
          http.get(`${serverResult.url}/error`, (res) => {
            res.on('data', () => {});
            res.on('end', resolve);
          });
        });
      }
      
      // Wait for logs to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Export logs to file
      const exportPath = path.join(testAppDir, 'server-logs.json');
      const exportResult = await logManager.exportLogs(exportPath, {
        format: 'json',
        sources: [serverResult.id],
        pretty: true
      });
      
      expect(exportResult.success).toBe(true);
      expect(exportResult.logCount).toBeGreaterThan(0);
      
      // Verify exported file exists
      const exportedContent = await fs.readFile(exportPath, 'utf8');
      const exportedData = JSON.parse(exportedContent);
      expect(exportedData.logs).toBeInstanceOf(Array);
      expect(exportedData.totalLogs).toBeGreaterThan(0);
      
      // Stop the server
      const stopResult = await nodeRunner.stopServer(serverResult.id);
      expect(stopResult.success).toBe(true);
      
      // Verify server is stopped
      const serverList = await nodeRunner.listServers();
      expect(serverList.servers.find(s => s.id === serverResult.id)).toBeUndefined();
    }, 15000);

    test('should handle process crashes and restart', async () => {
      // Create a script that crashes after some time
      const crashingScript = `
        console.log('Unstable app starting...');
        let counter = 0;
        
        const interval = setInterval(() => {
          counter++;
          console.log(\`Counter: \${counter}\`);
          
          if (counter === 3) {
            console.error('ERROR: Fatal error occurred!');
            throw new Error('Simulated crash');
          }
        }, 200);
      `;
      
      await fs.writeFile(path.join(testAppDir, 'crashing-app.js'), crashingScript);

      // Start the process
      const processResult = await nodeRunner.startNodeProcess('node crashing-app.js', {
        cwd: testAppDir
      });
      
      expect(processResult.success).toBe(true);
      
      // Set up log aggregation
      const aggResult = await logManager.aggregateLogs(
        'crash-analysis',
        [processResult.id],
        {
          name: 'Crash Analysis',
          bufferSize: 1000
        }
      );
      
      expect(aggResult.success).toBe(true);
      
      // Wait for crash
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check process status
      const processes = await nodeRunner.listProcesses();
      const crashedProcess = processes.processes.find(p => p.id === processResult.id);
      expect(crashedProcess.status).toBe('exited');
      
      // Analyze aggregated logs
      const aggLogs = await logManager.aggregator.getAggregatedLogs('crash-analysis');
      expect(aggLogs.logs.length).toBeGreaterThan(0);
      expect(aggLogs.stats.errorCount).toBeGreaterThan(0);
      
      // Restart the process with modified script
      const stableScript = `
        console.log('Stable app starting...');
        setInterval(() => {
          console.log('App is running fine');
        }, 1000);
      `;
      
      await fs.writeFile(path.join(testAppDir, 'crashing-app.js'), stableScript);
      
      const restartResult = await nodeRunner.restartProcess(processResult.id);
      expect(restartResult.success).toBe(true);
      expect(restartResult.status).toBe('running');
      
      // Wait and verify it's still running
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const runningProcesses = await nodeRunner.listProcesses();
      const restartedProcess = runningProcesses.processes.find(p => p.id === processResult.id);
      expect(restartedProcess.status).toBe('running');
      
      // Stop the process
      await nodeRunner.stopProcess(processResult.id);
    }, 10000);
  });

  describe('NPM Operations', () => {
    test('should run npm scripts and capture output', async () => {
      // Create package.json with scripts
      const packageJson = {
        name: 'test-npm-app',
        version: '1.0.0',
        scripts: {
          test: 'echo "Running tests..." && echo "All tests passed!"',
          build: 'echo "Building application..." && echo "Build complete"',
          'test:fail': 'echo "Running failing test..." && exit 1'
        }
      };
      
      await fs.writeFile(
        path.join(testAppDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Run successful script
      const testResult = await nodeRunner.runNpmScript('test', {
        cwd: testAppDir
      });
      
      expect(testResult.success).toBe(true);
      expect(testResult.output).toContain('All tests passed');
      
      // Run failing script
      const failResult = await nodeRunner.runNpmScript('test:fail', {
        cwd: testAppDir
      });
      
      expect(failResult.success).toBe(false);
      expect(failResult.exitCode).toBe(1);
      expect(failResult.output).toContain('Running failing test');
    });
  });
});