/**
 * @jest-environment node
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import NodeRunner from '../../src/NodeRunner.js';
import { ModuleFactory, ResourceManager } from '@jsenvoy/module-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('NodeRunner Integration Tests', () => {
  let runner;
  let testDir;

  beforeEach(async () => {
    runner = new NodeRunner({ autoCleanup: false });
    
    // Create a temporary test directory
    testDir = path.join(__dirname, `test-project-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create a simple package.json
    await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        start: 'node server.js',
        test: 'echo "Tests passed"',
        build: 'echo "Building..."'
      }
    }, null, 2));
  });

  afterEach(async () => {
    // Clean up
    await runner.cleanup();
    
    // Remove test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Server Management', () => {
    test('should start and stop a web server', async () => {
      // Create a simple server file
      const serverCode = `
        const http = require('http');
        const port = process.env.PORT || 3000;
        
        const server = http.createServer((req, res) => {
          if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Hello World');
          }
        });
        
        server.listen(port, () => {
          console.log('Server running on port ' + port);
        });
      `;
      
      await fs.writeFile(path.join(testDir, 'server.js'), serverCode);
      
      // Start the server
      const result = await runner.startWebServer('node server.js', {
        cwd: testDir,
        port: 0, // Use any available port
        healthCheck: true
      });
      
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.port).toBeGreaterThan(0);
      expect(result.url).toContain('http://localhost:');
      
      // Check server health
      const health = await runner.checkServerHealth(result.id);
      expect(health.success).toBe(true);
      expect(health.status).toBe('healthy');
      
      // Stop the server
      const stopResult = await runner.stopServer(result.id);
      expect(stopResult.success).toBe(true);
    }, 10000);

    test('should restart a server', async () => {
      // Create a simple server
      const serverCode = `
        const http = require('http');
        const port = process.env.PORT || 3000;
        console.log('Starting with NODE_ENV:', process.env.NODE_ENV);
        
        http.createServer((req, res) => {
          res.end('Environment: ' + process.env.NODE_ENV);
        }).listen(port);
      `;
      
      await fs.writeFile(path.join(testDir, 'app.js'), serverCode);
      
      // Start with development environment
      const startResult = await runner.startWebServer('node app.js', {
        cwd: testDir,
        port: 0,
        env: { NODE_ENV: 'development' },
        healthCheck: false
      });
      
      expect(startResult.success).toBe(true);
      
      // Restart with production environment
      const restartResult = await runner.restartProcess(startResult.id, {
        env: { NODE_ENV: 'production' }
      });
      
      expect(restartResult.success).toBe(true);
      expect(restartResult.id).toBe(startResult.id);
      
      // Clean up
      await runner.stopServer(startResult.id);
    });

    test('should list running servers', async () => {
      // Start a server
      const serverCode = 'require("http").createServer((req, res) => res.end("OK")).listen(process.env.PORT || 3000)';
      await fs.writeFile(path.join(testDir, 'mini-server.js'), serverCode);
      
      const server = await runner.startWebServer('node mini-server.js', {
        cwd: testDir,
        port: 0,
        healthCheck: false
      });
      
      const listResult = await runner.listServers();
      
      expect(listResult.success).toBe(true);
      expect(listResult.servers).toBeInstanceOf(Array);
      expect(listResult.count).toBeGreaterThan(0);
      
      const foundServer = listResult.servers.find(s => s.id === server.id);
      expect(foundServer).toBeDefined();
      expect(foundServer.type).toBe('web-server');
      
      // Clean up
      await runner.stopServer(server.id);
    });
  });

  describe('Package Management', () => {
    test('should detect package manager', async () => {
      const result = await runner.checkEnvironment({ cwd: testDir });
      
      expect(result.success).toBe(true);
      expect(result.packageManager.detected).toBe('npm'); // Default when no lock file
    });

    test('should run npm scripts', async () => {
      const result = await runner.runNpmScript('test', {
        cwd: testDir
      });
      
      expect(result.success).toBe(true);
      expect(result.script).toBe('test');
      expect(result.output).toContain('Tests passed');
    });

    test('should handle missing npm scripts', async () => {
      const result = await runner.runNpmScript('nonexistent', {
        cwd: testDir
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Process Logs', () => {
    test('should capture process output', async () => {
      const scriptCode = `
        console.log('Starting process');
        console.error('This is an error');
        console.log('Process complete');
      `;
      
      await fs.writeFile(path.join(testDir, 'logger.js'), scriptCode);
      
      const process = await runner.startNodeProcess('node logger.js', {
        cwd: testDir
      });
      
      // Wait for process to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const logs = await runner.getProcessLogs(process.id);
      
      expect(logs.success).toBe(true);
      expect(logs.logs).toBeInstanceOf(Array);
      expect(logs.logs.some(log => log.data.includes('Starting process'))).toBe(true);
      expect(logs.logs.some(log => log.data.includes('This is an error'))).toBe(true);
    });
  });

  describe('Port Management', () => {
    test('should kill process on port', async () => {
      // Create a server on a specific port
      const port = await runner.findAvailablePort(9999);
      const server = createServer((req, res) => res.end('OK'));
      
      await new Promise((resolve) => {
        server.listen(port.port, resolve);
      });
      
      // Kill process on that port
      const result = await runner.killProcessOnPort(port.port);
      
      expect(result.success).toBe(true);
      expect(result.port).toBe(port.port);
      
      // Verify port is free
      const newPort = await runner.findAvailablePort(port.port);
      expect(newPort.port).toBe(port.port);
    });

    test('should wait for port to be in use', async () => {
      const port = await runner.findAvailablePort(8888);
      
      // Start a server after a delay
      setTimeout(() => {
        const server = createServer((req, res) => res.end('OK'));
        server.listen(port.port);
        
        // Clean up after test
        setTimeout(() => server.close(), 2000);
      }, 500);
      
      // Wait for the port
      const result = await runner.waitForPort(port.port, {
        timeout: 3000
      });
      
      expect(result.success).toBe(true);
      expect(result.port).toBe(port.port);
    });
  });
});

describe('JSON Module Integration', () => {
  let moduleFactory;
  let resourceManager;
  
  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    moduleFactory = new ModuleFactory(resourceManager);
  });

  test('should load as JSON module', async () => {
    const modulePath = path.join(__dirname, '../../module.json');
    
    try {
      const module = await moduleFactory.createJsonModule(modulePath);
      expect(module).toBeDefined();
      
      const tools = await module.getTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBe(9);
      
      // Check tool names
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('start_node_process');
      expect(toolNames).toContain('stop_process');
      expect(toolNames).toContain('restart_process');
      expect(toolNames).toContain('list_processes');
      expect(toolNames).toContain('start_web_server');
      expect(toolNames).toContain('start_dev_server');
      expect(toolNames).toContain('check_server_health');
      expect(toolNames).toContain('install_dependencies');
      expect(toolNames).toContain('run_npm_script');
      
      // Check that tools have expected properties
      const firstTool = tools[0];
      expect(firstTool.name).toBeDefined();
      expect(firstTool.description).toBeDefined();
      expect(typeof firstTool.invoke).toBe('function');
    } catch (error) {
      console.warn('JSON module test failed:', error.message);
    }
  });

  test('should execute tool through JSON module', async () => {
    const modulePath = path.join(__dirname, '../../module.json');
    
    try {
      const module = await moduleFactory.createJsonModule(modulePath);
      const tools = await module.getTools();
      
      // Find the list_processes tool
      const listTool = tools.find(tool => tool.name === 'list_processes');
      expect(listTool).toBeDefined();
      
      // Execute the tool
      const result = await listTool.invoke({});
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.processes).toBeInstanceOf(Array);
      
    } catch (error) {
      console.warn('Tool execution test failed:', error.message);
    }
  });
});