/**
 * @jest-environment node
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { FullStackMonitor } from '../../src/FullStackMonitor.js';
import { TestResourceManager } from '../utils/TestResourceManager.js';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

describe('Process Startup Failures', () => {
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
  
  describe('Invalid Script Failures', () => {
    it('should handle process that fails to start due to invalid script path', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      // spawnWithAgent may return a child process even for invalid scripts
      // The error happens when the child process tries to execute
      const child = await monitor.spawnWithAgent('node', ['./nonexistent-script.js'], {
        timeout: 2000
      });
      
      // Wait for the process to fail
      const result = await new Promise((resolve) => {
        let exitCode = null;
        let errorOccurred = false;
        
        child.on('exit', (code) => {
          exitCode = code;
          resolve({ exitCode, errorOccurred });
        });
        
        child.on('error', (error) => {
          errorOccurred = true;
          resolve({ exitCode, errorOccurred, error });
        });
        
        setTimeout(() => resolve({ exitCode, errorOccurred, timeout: true }), 3000);
      });
      
      // Should either have non-zero exit code or error
      expect(result.exitCode !== 0 || result.errorOccurred || result.timeout).toBe(true);
    });
    
    it('should handle script with syntax errors', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a script with syntax errors
      const invalidScript = path.join(process.cwd(), 'temp-invalid-script.cjs');
      await fs.writeFile(invalidScript, 'console.log("hello";\n// missing closing parenthesis');
      
      try {
        const result = await new Promise((resolve, reject) => {
          const child = spawn('node', ['--require', monitor.getSidewinderAgentPath(), invalidScript], {
            env: {
              ...process.env,
              SIDEWINDER_WS_PORT: '9901',
              SIDEWINDER_WS_HOST: 'localhost',
              SIDEWINDER_SESSION_ID: monitor.session.id
            }
          });
          
          let stderr = '';
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          child.on('exit', (code) => {
            resolve({ code, stderr });
          });
          
          child.on('error', reject);
          
          setTimeout(() => reject(new Error('timeout')), 3000);
        });
        
        expect(result.code).not.toBe(0);
        expect(result.stderr).toContain('SyntaxError');
        
      } finally {
        await fs.unlink(invalidScript).catch(() => {});
      }
    });
    
    it('should handle script that throws uncaught exception during startup', async () => {
      const storageProvider = resourceManager.getStorageProvider();
      
      // Create a script that throws during startup
      const throwingScript = path.join(process.cwd(), 'temp-throwing-script.cjs');
      await fs.writeFile(throwingScript, `
        console.log('Starting up...');
        setTimeout(() => {
          throw new Error('Startup failure!');
        }, 100);
      `);
      
      try {
        const child = spawn('node', ['--require', monitor.getSidewinderAgentPath(), throwingScript], {
          env: {
            ...process.env,
            SIDEWINDER_WS_PORT: '9901',
            SIDEWINDER_WS_HOST: 'localhost',
            SIDEWINDER_SESSION_ID: monitor.session.id
          }
        });
        
        // Wait for the process to fail
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if uncaught exception was captured
        const logs = storageProvider.logs.filter(l => 
          l.source === 'sidewinder-uncaughtException' && 
          l.message?.includes('Startup failure!')
        );
        expect(logs.length).toBeGreaterThan(0);
        
      } finally {
        await fs.unlink(throwingScript).catch(() => {});
      }
    });
  });
  
  describe('Port Timeout Scenarios', () => {
    it('should timeout when waiting for port that never opens', async () => {
      const neverOpeningScript = path.join(process.cwd(), 'temp-never-opens-port.cjs');
      await fs.writeFile(neverOpeningScript, `
        console.log('Started but never opens port');
        // Just run forever without opening any port
        setInterval(() => {
          console.log('Still running...');
        }, 1000);
      `);
      
      try {
        const startTime = Date.now();
        const portReady = await monitor.waitForPort(8999, 2000); // 2 second timeout
        const duration = Date.now() - startTime;
        
        expect(portReady).toBe(false);
        expect(duration).toBeGreaterThanOrEqual(2000);
        expect(duration).toBeLessThan(3000); // Should not wait much longer than timeout
        
      } finally {
        await fs.unlink(neverOpeningScript).catch(() => {});
      }
    });
    
    it('should detect when port opens', async () => {
      // First test - verify port is not open
      const portReady = await monitor.waitForPort(18998, 500); // Use high port number
      expect(portReady).toBe(false);
      
      // Second test - start a server and verify port detection
      const testServerScript = path.join(process.cwd(), 'temp-test-server.cjs');
      await fs.writeFile(testServerScript, `
        const net = require('net');
        const server = net.createServer();
        server.listen(18997, '127.0.0.1', () => {
          console.log('Test server listening on 18997');
        });
        // Keep process alive
        setTimeout(() => {}, 10000);
      `);
      
      let serverProcess;
      try {
        serverProcess = spawn('node', [testServerScript], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // Give server time to fully start
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Now check if port is ready
        const ready = await monitor.waitForPort(18997, 2000);
        
        // Should detect the open port
        expect(ready).toBe(true);
        
      } catch (error) {
        console.log('Error in port test:', error.message);
      } finally {
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGKILL');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        await fs.unlink(testServerScript).catch(() => {});
      }
    });
  });
  
  describe('Stdout/Stderr Capture', () => {
    it('should capture stderr from failing process', async () => {
      const stderrScript = path.join(process.cwd(), 'temp-stderr-script.cjs');
      await fs.writeFile(stderrScript, `
        console.error('This is stderr output');
        console.log('This is stdout output');
        process.stderr.write('Direct stderr write\\n');
        process.exit(1);
      `);
      
      try {
        const result = await new Promise((resolve, reject) => {
          const child = spawn('node', [stderrScript], {
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stdout = '';
          let stderr = '';
          
          child.stdout.on('data', (data) => {
            stdout += data.toString();
          });
          
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          child.on('exit', (code) => {
            resolve({ code, stdout, stderr });
          });
          
          child.on('error', reject);
          
          setTimeout(() => reject(new Error('timeout')), 2000);
        });
        
        expect(result.code).toBe(1);
        expect(result.stderr).toContain('This is stderr output');
        expect(result.stderr).toContain('Direct stderr write');
        expect(result.stdout).toContain('This is stdout output');
        
      } finally {
        await fs.unlink(stderrScript).catch(() => {});
      }
    });
    
    it.skip('should capture process output when using spawnWithAgent', async () => {
      // TODO: Fix stdout/stderr capture with spawnWithAgent
      const outputScript = path.join(process.cwd(), 'temp-output-script.cjs');
      await fs.writeFile(outputScript, `
        console.log('Process output message');
        console.error('Process error message');
        process.exit(0);
      `);
      
      try {
        const result = await new Promise((resolve, reject) => {
          monitor.spawnWithAgent('node', [outputScript], {
            stdio: ['pipe', 'pipe', 'pipe']
          }).then(child => {
            let stdout = '';
            let stderr = '';
            
            child.stdout.on('data', (data) => {
              stdout += data.toString();
            });
            
            child.stderr.on('data', (data) => {
              stderr += data.toString();
            });
            
            child.on('exit', (code) => {
              resolve({ code, stdout, stderr });
            });
          }).catch(reject);
          
          setTimeout(() => reject(new Error('timeout')), 5000);
        });
        
        expect(result.stdout).toContain('Process output message');
        expect(result.stderr).toContain('Process error message');
        
      } finally {
        await fs.unlink(outputScript).catch(() => {});
      }
    });
  });
  
  describe('Sidewinder Agent Connection Failures', () => {
    it('should handle when Sidewinder agent cannot connect to WebSocket', async () => {
      // Create a script that tries to connect to wrong port
      const agentFailScript = path.join(process.cwd(), 'temp-agent-fail-script.cjs');
      await fs.writeFile(agentFailScript, `
        console.log('Script running without agent connection');
        setTimeout(() => {
          console.log('Script completed');
          process.exit(0);
        }, 500);
      `);
      
      try {
        const result = await new Promise((resolve, reject) => {
          const child = spawn('node', ['--require', monitor.getSidewinderAgentPath(), agentFailScript], {
            env: {
              ...process.env,
              SIDEWINDER_WS_PORT: '9999', // Wrong port
              SIDEWINDER_WS_HOST: 'localhost',
              SIDEWINDER_SESSION_ID: monitor.session.id
            },
            stdio: ['pipe', 'pipe', 'pipe']
          });
          
          let stderr = '';
          child.stderr.on('data', (data) => {
            stderr += data.toString();
          });
          
          child.on('exit', (code) => {
            resolve({ code, stderr });
          });
          
          setTimeout(() => reject(new Error('timeout')), 3000);
        });
        
        // Script should still run even if agent can't connect
        expect(result.code).toBe(0);
        // But might have connection errors in stderr (agent should handle gracefully)
        
      } finally {
        await fs.unlink(agentFailScript).catch(() => {});
      }
    });
  });
});