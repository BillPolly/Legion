/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import NodeRunner from '../../src/NodeRunner.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Simple Live Tests', () => {
  let runner;
  let testDir;

  beforeEach(async () => {
    runner = new NodeRunner({ autoCleanup: false });
    testDir = path.join(__dirname, `test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await runner.cleanup();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('should start and log a simple Node.js process', async () => {
    // Create a simple test script
    const script = `
      console.log('Hello from test process');
      console.error('This is an error');
      console.log('Process PID:', process.pid);
      setTimeout(() => {
        console.log('Exiting after timeout');
        process.exit(0);
      }, 1000);
    `;
    
    await fs.writeFile(path.join(testDir, 'simple.js'), script);

    // Start the process
    const result = await runner.startNodeProcess('node simple.js', {
      cwd: testDir
    });

    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.pid).toBeGreaterThan(0);

    // Wait for process to complete
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Get process logs
    const logs = await runner.getProcessLogs(result.id);
    
    expect(logs.success).toBe(true);
    expect(logs.logs.length).toBeGreaterThan(0);
    
    // Check log content
    const logMessages = logs.logs.map(log => log.data);
    const combinedLogs = logMessages.join(' ');
    
    expect(combinedLogs).toContain('Hello from test process');
    expect(combinedLogs).toContain('This is an error');
    expect(combinedLogs).toContain('Exiting after timeout');
  }, 5000);

  test('should start a simple web server', async () => {
    // Create a minimal server
    const serverScript = `
      const http = require('http');
      const port = process.env.PORT || 3000;
      
      const server = http.createServer((req, res) => {
        console.log('Request received:', req.url);
        if (req.url === '/health') {
          res.writeHead(200);
          res.end('OK');
        } else {
          res.writeHead(200);
          res.end('Hello');
        }
      });
      
      server.listen(port, () => {
        console.log('Server started on port', port);
      });
    `;
    
    await fs.writeFile(path.join(testDir, 'server.js'), serverScript);

    // Start the server
    const result = await runner.startWebServer('node server.js', {
      cwd: testDir,
      port: 0, // Any available port
      healthCheck: true
    });

    expect(result.success).toBe(true);
    expect(result.port).toBeGreaterThan(0);
    expect(result.url).toMatch(/http:\/\/localhost:\d+/);

    // Check health
    const health = await runner.checkServerHealth(result.id);
    expect(health.success).toBe(true);
    expect(health.status).toBe('healthy');

    // Stop the server
    const stopResult = await runner.stopServer(result.id);
    expect(stopResult.success).toBe(true);
  }, 10000);

  test('should run npm scripts', async () => {
    // Create package.json
    const packageJson = {
      name: 'test-app',
      version: '1.0.0',
      scripts: {
        hello: 'echo "Hello from npm script"'
      }
    };
    
    await fs.writeFile(
      path.join(testDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Run the script
    const result = await runner.runNpmScript('hello', {
      cwd: testDir
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hello from npm script');
    expect(result.exitCode).toBe(0);
  });
});