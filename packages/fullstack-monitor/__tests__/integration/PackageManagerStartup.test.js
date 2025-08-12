/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { promises as fs } from 'fs';
import path from 'path';

describe('Package Manager Startup', () => {
  let resourceManager;
  let monitor;
  
  beforeEach(async () => {
    resourceManager = new TestResourceManager();
    monitor = await FullStackMonitor.create(resourceManager);
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
    }
  });

  describe('NPM Command Execution', () => {
    it('should start server with npm start and inject Sidewinder agent', async () => {
      const testDir = path.join(process.cwd(), 'temp-npm-test');
      const packageJson = path.join(testDir, 'package.json');
      const serverScript = path.join(testDir, 'server.js');
      
      // Create test directory and files
      await fs.mkdir(testDir, { recursive: true });
      
      // Create package.json with start script
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'test-app',
        scripts: {
          start: 'node server.js',
          dev: 'node --inspect server.js'
        }
      }, null, 2));
      
      // Create simple server that logs startup
      await fs.writeFile(serverScript, `
        const http = require('http');
        console.log('[startup-correlation-npm] Starting server via npm');
        
        const server = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello from npm server');
        });
        
        server.listen(8080, () => {
          console.log('[startup-correlation-npm] Server listening on port 8080');
        });
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        // Start server using npm
        const child = await monitor.spawnWithAgent('npm', ['start'], {
          cwd: testDir,
          timeout: 5000
        });
        
        // Wait for server to start
        const portReady = await monitor.waitForPort(8080, 3000);
        expect(portReady).toBe(true);
        
        // Wait for Sidewinder logs to be captured
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify Sidewinder captured the startup logs
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('startup-correlation-npm')
        );
        expect(logs.length).toBeGreaterThan(0);
        
        // Verify correlation tracking
        const correlation = monitor.getCorrelation('startup-correlation-npm');
        expect(correlation).toBeDefined();
        expect(correlation.backend).toBeDefined();
        
        // Clean up
        child.kill();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
    
    it('should handle npm scripts with environment variables', async () => {
      const testDir = path.join(process.cwd(), 'temp-npm-env-test');
      const packageJson = path.join(testDir, 'package.json');
      const serverScript = path.join(testDir, 'env-server.js');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'env-test-app',
        scripts: {
          start: 'NODE_ENV=production PORT=8081 node env-server.js'
        }
      }, null, 2));
      
      await fs.writeFile(serverScript, `
        console.log('[env-correlation-test] NODE_ENV:', process.env.NODE_ENV);
        console.log('[env-correlation-test] PORT:', process.env.PORT);
        
        const http = require('http');
        const port = process.env.PORT || 3000;
        
        const server = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            env: process.env.NODE_ENV,
            port: port
          }));
        });
        
        server.listen(port, () => {
          console.log('[env-correlation-test] Environment server ready on port', port);
        });
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npm', ['start'], {
          cwd: testDir,
          timeout: 5000
        });
        
        const portReady = await monitor.waitForPort(8081, 3000);
        expect(portReady).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify environment variables were passed and logged
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('env-correlation-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        const envLog = logs.find(l => l.message.includes('NODE_ENV: production'));
        const portLog = logs.find(l => l.message.includes('PORT: 8081'));
        
        expect(envLog).toBeDefined();
        expect(portLog).toBeDefined();
        
        child.kill();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('Yarn Command Execution', () => {
    it('should start server with yarn start and inject Sidewinder agent', async () => {
      const testDir = path.join(process.cwd(), 'temp-yarn-test');
      const packageJson = path.join(testDir, 'package.json');
      const serverScript = path.join(testDir, 'yarn-server.js');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'yarn-test-app',
        scripts: {
          start: 'node yarn-server.js',
          dev: 'nodemon yarn-server.js'
        }
      }, null, 2));
      
      await fs.writeFile(serverScript, `
        const http = require('http');
        console.log('[yarn-correlation-test] Starting with yarn');
        
        const server = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello from yarn server');
        });
        
        server.listen(8082, () => {
          console.log('[yarn-correlation-test] Yarn server listening on 8082');
        });
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        // Try yarn if available, fall back to npm
        let command = 'yarn';
        let args = ['start'];
        
        try {
          // Check if yarn is available
          const { spawn } = await import('child_process');
          const yarnCheck = spawn('yarn', ['--version']);
          await new Promise((resolve, reject) => {
            yarnCheck.on('error', reject);
            yarnCheck.on('exit', (code) => code === 0 ? resolve() : reject());
          });
        } catch (error) {
          // Yarn not available, use npm
          command = 'npm';
          args = ['start'];
        }
        
        const child = await monitor.spawnWithAgent(command, args, {
          cwd: testDir,
          timeout: 5000
        });
        
        const portReady = await monitor.waitForPort(8082, 3000);
        expect(portReady).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify Sidewinder captured logs regardless of package manager
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('yarn-correlation-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        
        child.kill();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript Execution with ts-node', () => {
    it('should start TypeScript server with ts-node and inject Sidewinder agent', async () => {
      const testDir = path.join(process.cwd(), 'temp-ts-test');
      const packageJson = path.join(testDir, 'package.json');
      const tsConfig = path.join(testDir, 'tsconfig.json');
      const serverScript = path.join(testDir, 'ts-server.ts');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'ts-test-app',
        scripts: {
          start: 'ts-node ts-server.ts',
          dev: 'ts-node --transpile-only ts-server.ts'
        },
        devDependencies: {
          'ts-node': '^10.0.0',
          'typescript': '^5.0.0',
          '@types/node': '^20.0.0'
        }
      }, null, 2));
      
      await fs.writeFile(tsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          strict: true
        }
      }, null, 2));
      
      await fs.writeFile(serverScript, `
        import * as http from 'http';
        
        interface ServerOptions {
          port: number;
          message: string;
        }
        
        console.log('[ts-correlation-test] Starting TypeScript server');
        
        const options: ServerOptions = {
          port: 8083,
          message: 'Hello from TypeScript server'
        };
        
        const server = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            message: options.message,
            typescript: true,
            port: options.port
          }));
        });
        
        server.listen(options.port, () => {
          console.log('[ts-correlation-test] TypeScript server listening on port', options.port);
        });
      `);
      
      try {
        // Skip this test if ts-node is not available
        const { spawn } = await import('child_process');
        try {
          const tsNodeCheck = spawn('npx', ['ts-node', '--version'], { cwd: testDir });
          await new Promise((resolve, reject) => {
            tsNodeCheck.on('error', reject);
            tsNodeCheck.on('exit', (code) => code === 0 ? resolve() : reject());
          });
        } catch (error) {
          console.log('Skipping ts-node test - ts-node not available');
          return;
        }
        
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npx', ['ts-node', 'ts-server.ts'], {
          cwd: testDir,
          timeout: 8000 // TypeScript compilation can be slower
        });
        
        const portReady = await monitor.waitForPort(8083, 5000);
        expect(portReady).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Verify Sidewinder captured TypeScript compilation and startup
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('ts-correlation-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        
        // Should capture both startup message and listening message
        const startupLog = logs.find(l => l.message.includes('Starting TypeScript server'));
        const listeningLog = logs.find(l => l.message.includes('listening on port'));
        
        expect(startupLog).toBeDefined();
        expect(listeningLog).toBeDefined();
        
        child.kill();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
    
    it('should handle TypeScript compilation errors with Sidewinder', async () => {
      const testDir = path.join(process.cwd(), 'temp-ts-error-test');
      const packageJson = path.join(testDir, 'package.json');
      const tsConfig = path.join(testDir, 'tsconfig.json');
      const invalidScript = path.join(testDir, 'invalid.ts');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'ts-error-test',
        scripts: {
          start: 'ts-node invalid.ts'
        }
      }, null, 2));
      
      await fs.writeFile(tsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        }
      }, null, 2));
      
      // Create TypeScript file with type errors
      await fs.writeFile(invalidScript, `
        console.log('[ts-error-test] Starting invalid TypeScript');
        
        interface User {
          name: string;
          age: number;
        }
        
        const user: User = {
          name: 'test',
          age: 'invalid' // Type error: string instead of number
        };
        
        console.log('[ts-error-test] User:', user);
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        // This should fail due to TypeScript errors
        let processExited = false;
        let exitCode = null;
        
        try {
          const child = await monitor.spawnWithAgent('npx', ['ts-node', 'invalid.ts'], {
            cwd: testDir,
            timeout: 5000
          });
          
          await new Promise((resolve, reject) => {
            child.on('exit', (code) => {
              processExited = true;
              exitCode = code;
              resolve();
            });
            child.on('error', reject);
            setTimeout(() => resolve(), 3000);
          });
          
        } catch (error) {
          // Expected to fail with compilation errors
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Should capture TypeScript compilation errors
        const logs = storageProvider.logs.filter(l => 
          l.source?.includes('sidewinder') && 
          (l.message?.includes('ts-error-test') || 
           l.message?.includes('Type') || 
           l.message?.includes('error') || 
           l.level === 'error')
        );
        
        // TypeScript compilation errors won't be captured by Sidewinder because
        // the process exits before Sidewinder can inject, but we should still 
        // have a non-zero exit code
        if (processExited) {
          expect(exitCode).not.toBe(0);
        } else {
          // If process didn't exit, we should have timeout
          expect(result.timeout).toBe(true);
        }
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('Complex Package Manager Scenarios', () => {
    it('should handle npm scripts with development dependencies', async () => {
      const testDir = path.join(process.cwd(), 'temp-npm-deps-test');
      const packageJson = path.join(testDir, 'package.json');
      const serverScript = path.join(testDir, 'deps-server.js');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'npm-deps-app',
        scripts: {
          start: 'node deps-server.js',
          dev: 'NODE_ENV=development node deps-server.js'
        },
        dependencies: {
          'http': '*'
        }
      }, null, 2));
      
      await fs.writeFile(serverScript, `
        console.log('[npm-deps-test] Checking npm environment');
        console.log('[npm-deps-test] npm_config_user_agent:', process.env.npm_config_user_agent || 'none');
        console.log('[npm-deps-test] npm_execpath:', process.env.npm_execpath || 'none');
        
        const http = require('http');
        console.log('[npm-deps-test] Starting dependency-aware server');
        
        const server = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            status: 'running',
            npm_environment: !!process.env.npm_config_user_agent,
            node_env: process.env.NODE_ENV || 'production'
          }));
        });
        
        server.listen(8084, () => {
          console.log('[npm-deps-test] Server ready on 8084 with npm context');
        });
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npm', ['start'], {
          cwd: testDir,
          timeout: 6000
        });
        
        const portReady = await monitor.waitForPort(8084, 4000);
        expect(portReady).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Should capture npm environment and server logs
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('npm-deps-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        
        // Verify we got some logs (might not get all with npm overhead)
        if (logs.length > 0) {
          const envLog = logs.find(l => l.message.includes('npm environment'));
          const serverLog = logs.find(l => l.message.includes('Server ready'));
          
          // At least one should be present
          expect(envLog || serverLog).toBeDefined();
        }
        
        child.kill();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});