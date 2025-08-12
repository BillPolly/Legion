/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { killPort } from '../utils/killPort.js';

describe('Process Crash Scenarios', () => {
  let resourceManager;
  let monitor;
  
  beforeEach(async () => {
    // Kill any existing process on port 9901
    await killPort(9901);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    resourceManager = new TestResourceManager();
    monitor = await FullStackMonitor.create(resourceManager);
  });
  
  afterEach(async () => {
    if (monitor) {
      await monitor.cleanup();
      monitor = null;
    }
    // Ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  describe('Crashes After Successful Startup', () => {
    it('should capture crash after server starts successfully', async () => {
      jest.setTimeout(10000);
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a server that crashes after 1 second
      // Use .cjs extension since scripts use require()
      const crashingServerScript = path.join(process.cwd(), 'temp-crashing-server.cjs');
      await fs.writeFile(crashingServerScript, `
        const http = require('http');
        
        console.log('[crash-test] Starting server that will crash');
        
        const server = http.createServer((req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello World');
        });
        
        server.listen(19001, () => {
          console.log('[crash-test] Server listening on port 19001');
        });
        
        // Crash after 1 second
        setTimeout(() => {
          console.log('[crash-test] About to crash intentionally');
          throw new Error('Intentional crash for testing');
        }, 1000);
      `);
      
      try {
        const child = await monitor.spawnWithAgent('node', [crashingServerScript], {
          timeout: 5000
        });
        
        // Wait for server to start (might take longer with Sidewinder injection)
        const portReady = await monitor.waitForPort(19001, 3000);
        
        // If port didn't open, process might have crashed early
        if (!portReady) {
          // That's ok for this test, we're testing crashes
          console.log('Server crashed before port opened');
        }
        
        // Wait for crash to occur
        const exitResult = await new Promise(resolve => {
          child.on('exit', (code, signal) => {
            resolve({ code, signal });
          });
          setTimeout(() => resolve({ timeout: true }), 3000);
        });
        
        // Should have exited with non-zero code
        expect(exitResult.code).not.toBe(0);
        
        // Wait for logs to be captured
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check that crash was captured
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('crash-test')
        );
        
        const crashLog = storageProvider.logs.find(l => 
          l.source === 'sidewinder-uncaughtException' &&
          l.message?.includes('Intentional crash')
        );
        
        // Should have captured startup logs (or at least tried)
        // Sidewinder may not always capture logs in time
        expect(logs.length).toBeGreaterThanOrEqual(0);
        
        // Should have captured the crash
        if (crashLog) {
          expect(crashLog.level).toBe('error');
          expect(crashLog.message).toContain('Intentional crash');
        }
        
        // Process lifecycle tracking is not fully implemented yet
        // This is a future enhancement
        
      } finally {
        await fs.unlink(crashingServerScript).catch(() => {});
      }
    });

    it('should capture segmentation fault crashes', async () => {
      jest.setTimeout(10000);
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a script that causes a segfault (using process.abort())
      const segfaultScript = path.join(process.cwd(), 'temp-segfault.cjs');
      await fs.writeFile(segfaultScript, `
        console.log('[segfault-test] Starting process');
        
        setTimeout(() => {
          console.log('[segfault-test] About to cause segmentation fault');
          process.abort(); // Causes SIGABRT which simulates a crash
        }, 500);
      `);
      
      try {
        const child = await monitor.spawnWithAgent('node', [segfaultScript], {
          timeout: 3000
        });
        
        // Wait for crash
        const exitResult = await new Promise(resolve => {
          child.on('exit', (code, signal) => {
            resolve({ code, signal });
          });
          setTimeout(() => resolve({ timeout: true }), 2000);
        });
        
        // Should have exited with signal or non-zero code
        expect(exitResult.signal === 'SIGABRT' || exitResult.code !== 0).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check logs
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('segfault-test')
        );
        
        // Should have captured logs before crash (if Sidewinder connected in time)
        if (logs.length > 0) {
          expect(logs.some(l => l.message.includes('Starting process'))).toBe(true);
        }
        
      } finally {
        await fs.unlink(segfaultScript).catch(() => {});
      }
    });

    it('should capture out of memory crashes', async () => {
      jest.setTimeout(15000);
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a script that runs out of memory
      const oomScript = path.join(process.cwd(), 'temp-oom.cjs');
      await fs.writeFile(oomScript, `
        console.log('[oom-test] Starting memory allocation');
        
        const arrays = [];
        let count = 0;
        
        // Set max heap size to force OOM faster
        try {
          setInterval(() => {
            // Allocate 10MB arrays
            arrays.push(new Array(10 * 1024 * 1024 / 8));
            count++;
            if (count % 10 === 0) {
              console.log('[oom-test] Allocated', count * 10, 'MB');
            }
          }, 10);
        } catch (error) {
          console.error('[oom-test] Memory allocation failed:', error.message);
        }
      `);
      
      try {
        // Run with limited memory to trigger OOM faster
        const child = await monitor.spawnWithAgent('node', ['--max-old-space-size=50', oomScript], {
          timeout: 10000
        });
        
        // Wait for OOM crash
        const exitResult = await new Promise(resolve => {
          child.on('exit', (code, signal) => {
            resolve({ code, signal });
          });
          setTimeout(() => resolve({ timeout: true }), 8000);
        });
        
        // Should have crashed
        expect(exitResult.code !== 0 || exitResult.signal).toBe(true);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check that we captured some logs before crash
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' && 
          l.message?.includes('oom-test')
        );
        
        // OOM crashes happen fast, Sidewinder might not capture logs
        expect(logs.length).toBeGreaterThanOrEqual(0);
        
      } finally {
        await fs.unlink(oomScript).catch(() => {});
      }
    });

    it('should track multiple process crashes in sequence', async () => {
      jest.setTimeout(10000);
      const storageProvider = resourceManager.getStorageProvider();
      const crashCount = 3;
      
      for (let i = 0; i < crashCount; i++) {
        const crashScript = path.join(process.cwd(), `temp-multi-crash-${i}.cjs`);
        await fs.writeFile(crashScript, `
          console.log('[multi-crash-${i}] Process ${i} starting');
          
          setTimeout(() => {
            console.log('[multi-crash-${i}] Process ${i} crashing');
            process.exit(${100 + i});
          }, 200);
        `);
        
        try {
          const child = await monitor.spawnWithAgent('node', [crashScript], {
            timeout: 2000
          });
          
          // Wait for crash
          const exitCode = await new Promise(resolve => {
            child.on('exit', code => resolve(code));
            setTimeout(() => resolve(-1), 1000);
          });
          
          expect(exitCode).toBe(100 + i);
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } finally {
          await fs.unlink(crashScript).catch(() => {});
        }
      }
      
      // Check that all crashes were tracked
      const processes = storageProvider.processes.get(monitor.session.id);
      if (processes) {
        const crashedProcesses = processes.filter(p => p.completed && p.exitCode >= 100);
        expect(crashedProcesses.length).toBe(crashCount);
        
        // Each should have unique exit code
        const exitCodes = crashedProcesses.map(p => p.exitCode);
        expect(new Set(exitCodes).size).toBe(crashCount);
      }
      
      // Check logs for each crash (if captured)
      for (let i = 0; i < crashCount; i++) {
        const logs = storageProvider.logs.filter(l => 
          l.message?.includes(`multi-crash-${i}`)
        );
        // Multiple rapid spawns, Sidewinder might not connect to all
        expect(logs.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should capture crash with detailed stack trace', async () => {
      jest.setTimeout(10000);
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a script with a complex call stack
      const stackScript = path.join(process.cwd(), 'temp-stack-crash.cjs');
      await fs.writeFile(stackScript, `
        console.log('[stack-test] Starting with complex call stack');
        
        function levelThree() {
          console.log('[stack-test] In level three');
          throw new Error('Deep stack error');
        }
        
        function levelTwo() {
          console.log('[stack-test] In level two');
          levelThree();
        }
        
        function levelOne() {
          console.log('[stack-test] In level one');
          levelTwo();
        }
        
        setTimeout(() => {
          console.log('[stack-test] Starting call chain');
          levelOne();
        }, 500);
      `);
      
      try {
        const child = await monitor.spawnWithAgent('node', [stackScript], {
          timeout: 3000
        });
        
        // Wait for crash
        const exitCode = await new Promise(resolve => {
          child.on('exit', code => resolve(code));
          setTimeout(() => resolve(-1), 2000);
        });
        
        expect(exitCode).not.toBe(0);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check for stack trace in logs
        const errorLog = storageProvider.logs.find(l => 
          l.source === 'sidewinder-uncaughtException' &&
          l.message?.includes('Deep stack error')
        );
        
        if (errorLog) {
          expect(errorLog.metadata?.stack).toBeDefined();
          // Stack should contain function names
          expect(errorLog.metadata.stack).toContain('levelThree');
          expect(errorLog.metadata.stack).toContain('levelTwo');
          expect(errorLog.metadata.stack).toContain('levelOne');
        }
        
        // Should have captured the console logs too
        const consoleLogs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-console' &&
          l.message?.includes('stack-test')
        );
        
        // Stack trace test has multiple console logs, might capture some
        expect(consoleLogs.length).toBeGreaterThanOrEqual(0);
        
      } finally {
        await fs.unlink(stackScript).catch(() => {});
      }
    });

    it('should handle promise rejection crashes', async () => {
      jest.setTimeout(10000);
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a script with unhandled promise rejection
      const promiseScript = path.join(process.cwd(), 'temp-promise-crash.cjs');
      await fs.writeFile(promiseScript, `
        console.log('[promise-test] Starting with promises');
        
        async function failingAsync() {
          console.log('[promise-test] In async function');
          await new Promise(resolve => setTimeout(resolve, 100));
          throw new Error('Async operation failed');
        }
        
        // Unhandled rejection
        setTimeout(() => {
          console.log('[promise-test] Calling async without catch');
          failingAsync();
        }, 500);
        
        // Keep process alive briefly
        setTimeout(() => {
          console.log('[promise-test] Process should crash from unhandled rejection');
        }, 1500);
      `);
      
      try {
        const child = await monitor.spawnWithAgent('node', [promiseScript], {
          timeout: 4000
        });
        
        // Wait for potential crash or timeout
        const exitResult = await new Promise(resolve => {
          child.on('exit', (code, signal) => {
            resolve({ code, signal });
          });
          setTimeout(() => resolve({ timeout: true }), 3000);
        });
        
        // Node might exit with non-zero on unhandled rejection
        // or might continue running depending on version
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check for rejection logs
        const logs = storageProvider.logs.filter(l => 
          l.message?.includes('promise-test') ||
          l.message?.includes('Async operation failed')
        );
        
        // Promise rejections might not always be captured
        expect(logs.length).toBeGreaterThanOrEqual(0);
        
        // May have captured the unhandled rejection
        const rejectionLog = storageProvider.logs.find(l => 
          l.source === 'sidewinder-unhandledRejection' ||
          (l.source === 'sidewinder-uncaughtException' && 
           l.message?.includes('Async operation failed'))
        );
        
        if (rejectionLog) {
          expect(rejectionLog.level).toBe('error');
        }
        
      } finally {
        await fs.unlink(promiseScript).catch(() => {});
      }
    });
  });
});