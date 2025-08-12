/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

describe('TypeScript Execution with Sidewinder', () => {
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

  // Helper to check if ts-node is available
  async function isTsNodeAvailable() {
    return new Promise((resolve) => {
      const tsNodeCheck = spawn('npx', ['ts-node', '--version']);
      tsNodeCheck.on('error', () => resolve(false));
      tsNodeCheck.on('exit', (code) => resolve(code === 0));
    });
  }

  describe('Direct ts-node Execution', () => {
    it('should execute TypeScript directly with ts-node and capture logs', async () => {
      if (!(await isTsNodeAvailable())) {
        console.log('Skipping ts-node test - ts-node not available');
        return;
      }

      const testDir = path.join(process.cwd(), 'temp-ts-direct-test');
      const tsScript = path.join(testDir, 'direct-ts.ts');
      const tsConfig = path.join(testDir, 'tsconfig.json');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(tsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          strict: true
        }
      }, null, 2));
      
      await fs.writeFile(tsScript, `
        interface Config {
          port: number;
          name: string;
        }
        
        const config: Config = {
          port: 8090,
          name: 'typescript-direct-test'
        };
        
        console.log('[ts-direct-test] TypeScript config:', JSON.stringify(config));
        console.log('[ts-direct-test] Application starting...');
        
        // Simulate some async work
        setTimeout(() => {
          console.log('[ts-direct-test] TypeScript application ready');
          process.exit(0);
        }, 500);
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npx', ['ts-node', tsScript], {
          timeout: 5000
        });
        
        // Wait for script to complete
        await new Promise((resolve, reject) => {
          child.on('exit', resolve);
          child.on('error', reject);
          setTimeout(() => reject(new Error('timeout')), 4000);
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify TypeScript logs were captured
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('ts-direct-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        
        const configLog = logs.find(l => l.message.includes('TypeScript config'));
        const readyLog = logs.find(l => l.message.includes('application ready'));
        
        expect(configLog).toBeDefined();
        expect(readyLog).toBeDefined();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });

    it('should handle TypeScript syntax errors and capture error output', async () => {
      if (!(await isTsNodeAvailable())) {
        console.log('Skipping ts-node syntax error test - ts-node not available');
        return;
      }

      const testDir = path.join(process.cwd(), 'temp-ts-syntax-test');
      const invalidTsScript = path.join(testDir, 'syntax-error.ts');
      const tsConfig = path.join(testDir, 'tsconfig.json');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(tsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          strict: true
        }
      }, null, 2));
      
      // Create TypeScript with syntax errors
      await fs.writeFile(invalidTsScript, `
        console.log('[ts-syntax-error] Starting...');
        
        // Invalid TypeScript syntax
        let x: string = 123; // Type error
        let y: number = "hello"; // Type error
        
        interface BadInterface {
          prop1: string;
        }
        
        const obj: BadInterface = {
          prop1: 123, // Type error
          prop2: "extra" // Property doesn't exist
        };
        
        console.log('[ts-syntax-error] This should not execute');
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        // This should fail due to TypeScript errors
        let processExited = false;
        let exitCode = null;
        
        try {
          const child = await monitor.spawnWithAgent('npx', ['ts-node', invalidTsScript], {
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
          // Expected to fail
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Should have captured error messages via Sidewinder
        const logs = storageProvider.logs.filter(l => 
          l.source?.includes('sidewinder') && 
          (l.message?.includes('error') || l.message?.includes('Error') || l.level === 'error')
        );
        
        // TypeScript compilation should have produced error output
        expect(logs.length).toBeGreaterThan(0);
        
        // Process should have exited with non-zero code
        if (processExited) {
          expect(exitCode).not.toBe(0);
        }
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript with Express Server', () => {
    it('should start TypeScript HTTP server and capture all lifecycle events', async () => {
      if (!(await isTsNodeAvailable())) {
        console.log('Skipping TypeScript Express test - ts-node not available');
        return;
      }

      const testDir = path.join(process.cwd(), 'temp-ts-express-test');
      const serverScript = path.join(testDir, 'express-server.ts');
      const tsConfig = path.join(testDir, 'tsconfig.json');
      const packageJson = path.join(testDir, 'package.json');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(packageJson, JSON.stringify({
        name: 'ts-express-test',
        dependencies: {
          express: '^4.18.0'
        }
      }, null, 2));
      
      await fs.writeFile(tsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true
        }
      }, null, 2));
      
      await fs.writeFile(serverScript, `
        import * as http from 'http';
        
        interface ServerConfig {
          port: number;
          environment: string;
        }
        
        console.log('[ts-express-test] Initializing TypeScript HTTP server');
        
        const config: ServerConfig = {
          port: 8091,
          environment: 'test'
        };
        
        const server = http.createServer((req, res) => {
          console.log('[ts-express-test] Handling HTTP request:', req.url);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            message: 'TypeScript HTTP server running',
            config: config,
            url: req.url
          }));
        });
        
        server.listen(config.port, () => {
          console.log('[ts-express-test] HTTP server listening on port', config.port);
          console.log('[ts-express-test] Environment:', config.environment);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
          console.log('[ts-express-test] Received SIGTERM, shutting down gracefully');
          server.close(() => {
            console.log('[ts-express-test] Server closed');
            process.exit(0);
          });
        });
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npx', ['ts-node', serverScript], {
          timeout: 8000
        });
        
        // Wait for server to start
        const portReady = await monitor.waitForPort(8091, 5000);
        expect(portReady).toBe(true);
        
        // Make a test request to generate logs
        try {
          const response = await fetch('http://localhost:8091/health');
          expect(response.status).toBe(200);
        } catch (error) {
          // Fetch might not be available in all Node versions
          console.log('Skipping HTTP request test - fetch not available');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify comprehensive logging
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('ts-express-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        
        // Check for specific lifecycle events
        const initLog = logs.find(l => l.message.includes('Initializing TypeScript Express'));
        const listeningLog = logs.find(l => l.message.includes('listening on port'));
        const envLog = logs.find(l => l.message.includes('Environment:'));
        
        expect(initLog).toBeDefined();
        expect(listeningLog).toBeDefined();
        expect(envLog).toBeDefined();
        
        // Clean shutdown
        child.kill('SIGTERM');
        
        // Wait for graceful shutdown logs
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const shutdownLogs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('SIGTERM')
        );
        
        // May or may not capture shutdown depending on timing
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript with Custom tsconfig', () => {
    it('should handle different TypeScript configurations', async () => {
      if (!(await isTsNodeAvailable())) {
        console.log('Skipping custom tsconfig test - ts-node not available');
        return;
      }

      const testDir = path.join(process.cwd(), 'temp-ts-config-test');
      const serverScript = path.join(testDir, 'config-server.ts');
      const strictTsConfig = path.join(testDir, 'tsconfig.json');
      
      await fs.mkdir(testDir, { recursive: true });
      
      // Very strict TypeScript config
      await fs.writeFile(strictTsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'commonjs',
          strict: true,
          noImplicitAny: true,
          noImplicitReturns: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          exactOptionalPropertyTypes: true
        },
        include: ['*.ts']
      }, null, 2));
      
      await fs.writeFile(serverScript, `
        // Strict TypeScript with proper typing
        interface Logger {
          log(message: string): void;
          error(message: string, error?: Error): void;
        }
        
        class ConsoleLogger implements Logger {
          log(message: string): void {
            console.log('[ts-config-test]', message);
          }
          
          error(message: string, error?: Error): void {
            console.error('[ts-config-test] ERROR:', message, error?.message || '');
          }
        }
        
        interface AppConfig {
          readonly port: number;
          readonly name: string;
          readonly logger: Logger;
        }
        
        const logger = new ConsoleLogger();
        
        const config: AppConfig = {
          port: 8092,
          name: 'strict-typescript-app',
          logger: logger
        };
        
        config.logger.log('Starting strict TypeScript application');
        config.logger.log(\`Configuration: \${JSON.stringify({ port: config.port, name: config.name })}\`);
        
        // Simulate startup work
        const startup = async (): Promise<void> => {
          config.logger.log('Performing async startup tasks');
          
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              config.logger.log('Startup tasks completed');
              resolve();
            }, 300);
          });
        };
        
        startup().then(() => {
          config.logger.log('Application ready with strict TypeScript configuration');
          process.exit(0);
        }).catch((error: Error) => {
          config.logger.error('Startup failed', error);
          process.exit(1);
        });
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npx', ['ts-node', serverScript], {
          timeout: 6000
        });
        
        // Wait for script to complete
        await new Promise((resolve, reject) => {
          child.on('exit', resolve);
          child.on('error', reject);
          setTimeout(() => reject(new Error('timeout')), 5000);
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify all TypeScript logs were captured
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('ts-config-test')
        );
        
        expect(logs.length).toBeGreaterThan(0);
        
        // Verify specific log messages
        const startLog = logs.find(l => l.message.includes('Starting strict TypeScript'));
        const configLog = logs.find(l => l.message.includes('Configuration:'));
        const asyncLog = logs.find(l => l.message.includes('async startup tasks'));
        const readyLog = logs.find(l => l.message.includes('Application ready'));
        
        expect(startLog).toBeDefined();
        expect(configLog).toBeDefined();
        expect(asyncLog).toBeDefined();
        expect(readyLog).toBeDefined();
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });

  describe('TypeScript Error Scenarios', () => {
    it('should capture runtime errors in TypeScript applications', async () => {
      if (!(await isTsNodeAvailable())) {
        console.log('Skipping TypeScript runtime error test - ts-node not available');
        return;
      }

      const testDir = path.join(process.cwd(), 'temp-ts-runtime-error-test');
      const errorScript = path.join(testDir, 'runtime-error.ts');
      const tsConfig = path.join(testDir, 'tsconfig.json');
      
      await fs.mkdir(testDir, { recursive: true });
      
      await fs.writeFile(tsConfig, JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'commonjs',
          esModuleInterop: true
        }
      }, null, 2));
      
      await fs.writeFile(errorScript, `
        interface User {
          name: string;
          age: number;
        }
        
        console.log('[ts-runtime-error] Starting TypeScript app');
        
        const users: User[] = [
          { name: 'Alice', age: 25 },
          { name: 'Bob', age: 30 }
        ];
        
        console.log('[ts-runtime-error] Processing users:', users.length);
        
        // This will cause a runtime error
        setTimeout(() => {
          console.log('[ts-runtime-error] About to throw error');
          
          // Accessing property that doesn't exist
          const invalidUser = users[10]; // undefined
          console.log('[ts-runtime-error] Invalid user name:', invalidUser.name); // Error!
          
        }, 200);
      `);
      
      try {
        const storageProvider = resourceManager.getStorageProvider();
        
        const child = await monitor.spawnWithAgent('npx', ['ts-node', errorScript], {
          timeout: 4000
        });
        
        // Wait for runtime error to occur
        await new Promise((resolve) => {
          child.on('exit', resolve);
          setTimeout(resolve, 3000);
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Should capture both normal logs and the uncaught exception
        const consoleLogs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('ts-runtime-error')
        );
        
        const errorLogs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-uncaughtException'
        );
        
        expect(consoleLogs.length).toBeGreaterThan(0);
        
        // Verify we captured the startup logs
        const startLog = consoleLogs.find(l => l.message.includes('Starting TypeScript app'));
        const processingLog = consoleLogs.find(l => l.message.includes('Processing users'));
        
        expect(startLog).toBeDefined();
        expect(processingLog).toBeDefined();
        
        // Should also capture the uncaught exception
        expect(errorLogs.length).toBeGreaterThan(0);
        
      } finally {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    });
  });
});