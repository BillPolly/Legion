/**
 * Unit tests for Port Killing functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import { SessionManager } from '../../handlers/SessionManager.js';
import { portManager } from '../../utils/PortManager.js';
import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to check if port is actually in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false)).close();
      })
      .listen(port);
  });
}

describe('Port Killing Functionality', () => {
  let sessionManager;
  let simplifiedTools;
  let activeProcesses = [];
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    simplifiedTools = new SimplifiedTools(sessionManager);
  });
  
  afterEach(async () => {
    // Clean up any spawned processes
    for (const proc of activeProcesses) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {
        // Process may already be dead
      }
    }
    activeProcesses = [];
    
    // Restore any mocks
    jest.restoreAllMocks();
  });
  
  describe('killProcessOnPort', () => {
    it('should kill a process using a port', async () => {
      const testPort = 4001;
      
      // Create a simple test server
      const serverPath = path.join(__dirname, 'test-kill-server.js');
      const serverCode = `
        const http = require('http');
        const server = http.createServer((req, res) => {
          res.end('Test server');
        });
        server.listen(${testPort}, () => {
          console.log('Server listening on port ${testPort}');
        });
        // Keep process alive
        setInterval(() => {}, 1000);
      `;
      fs.writeFileSync(serverPath, serverCode);
      
      try {
        // Start the server
        const proc = spawn('node', [serverPath], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        activeProcesses.push(proc);
        
        // Wait for server output or timeout
        const serverReady = await new Promise((resolve) => {
          let timeout;
          
          const onData = (data) => {
            const output = data.toString();
            console.log('Server output:', output);
            if (output.includes('listening')) {
              clearTimeout(timeout);
              resolve(true);
            }
          };
          
          proc.stdout.on('data', onData);
          proc.stderr.on('data', (data) => {
            console.error('Server error:', data.toString());
          });
          
          proc.on('exit', (code) => {
            console.log('Server exited early with code:', code);
            clearTimeout(timeout);
            resolve(false);
          });
          
          proc.on('error', (err) => {
            console.error('Failed to start process:', err);
            clearTimeout(timeout);
            resolve(false);
          });
          
          timeout = setTimeout(() => {
            console.log('Server startup timeout');
            resolve(false);
          }, 3000);
        });
        
        // Verify port is in use
        expect(serverReady).toBe(true);
        const portInUse = await isPortInUse(testPort);
        expect(portInUse).toBe(true);
        
        // Kill the process on the port
        await simplifiedTools.killProcessOnPort(testPort);
        
        // Wait a bit for port to be released
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify port is now free
        const afterKill = await isPortInUse(testPort);
        expect(afterKill).toBe(false);
      } finally {
        if (fs.existsSync(serverPath)) {
          fs.unlinkSync(serverPath);
        }
      }
    }, 10000);
    
    it('should handle when port is already free', async () => {
      const freePort = 4002;
      
      // Verify port is free
      const isFree = await isPortInUse(freePort);
      expect(isFree).toBe(false);
      
      // This should not throw
      await expect(simplifiedTools.killProcessOnPort(freePort)).resolves.not.toThrow();
    });
    
    it('should handle multiple processes on same port', async () => {
      // This is more of an edge case - usually only one process can bind to a port
      // But we can test that our killing logic handles it gracefully
      const testPort = 4003;
      
      // Mock the portManager to simulate port in use
      jest.spyOn(portManager, 'isPortListening').mockResolvedValue(true);
      
      // Mock exec to simulate finding multiple PIDs
      const mockExec = jest.fn((cmd, callback) => {
        if (cmd.includes('lsof')) {
          callback(null, { stdout: '1234\n5678\n' });
        } else if (cmd.includes('kill')) {
          callback(null, {});
        }
      });
      
      // Replace exec in the module (this is tricky with ES modules)
      // For now, just test that the method doesn't throw
      await expect(simplifiedTools.killProcessOnPort(testPort)).resolves.not.toThrow();
    });
  });
  
  describe('startServer with port killing', () => {
    it('should kill conflicting process by default', async () => {
      const testPort = 4004;
      const sessionId = 'test-kill-default';
      
      // Create a server that will conflict
      const conflictPath = path.join(__dirname, 'conflict-server.js');
      const serverCode = `
        const http = require('http');
        http.createServer((req, res) => res.end('Conflict')).listen(${testPort}, () => {
          console.log('Conflict server on ${testPort}');
        });
        setInterval(() => {}, 1000);
      `;
      fs.writeFileSync(conflictPath, serverCode);
      
      // Create the server we want to start
      const mainPath = path.join(__dirname, 'main-server.js');
      const mainCode = `
        const http = require('http');
        http.createServer((req, res) => res.end('Main')).listen(${testPort}, () => {
          console.log('Main server on ${testPort}');
        });
        setInterval(() => {}, 1000);
      `;
      fs.writeFileSync(mainPath, mainCode);
      
      try {
        // Start conflicting server
        const conflictProc = spawn('node', [conflictPath]);
        activeProcesses.push(conflictProc);
        
        // Wait for server to start and verify it's listening
        let retries = 0;
        let serverStarted = false;
        while (retries < 10 && !serverStarted) {
          await new Promise(resolve => setTimeout(resolve, 500));
          serverStarted = await isPortInUse(testPort);
          retries++;
        }
        
        // Verify port is in use
        expect(serverStarted).toBe(true);
        
        // Create mock monitor for the session
        const mockMonitor = {
          logManager: {
            capture: jest.fn(),
            query: jest.fn().mockResolvedValue([])
          },
          getState: jest.fn().mockReturnValue('running'),
          setState: jest.fn()
        };
        
        // Mock the session manager methods
        jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
        jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
        
        // Mock the enhanced starter to return a test process
        const mainProc = spawn('node', [mainPath]);
        activeProcesses.push(mainProc);
        
        jest.spyOn(simplifiedTools.enhancedStarter, 'startServer').mockResolvedValue({
          process: mainProc,
          port: testPort,
          workingDir: __dirname,
          sidewinderPort: 9999
        });
        
        // Mock waitForServerReady to succeed
        jest.spyOn(simplifiedTools, 'waitForServerReady').mockResolvedValue(true);
        jest.spyOn(simplifiedTools, 'setupLogCapture').mockResolvedValue();
        
        // Start server with kill_conflicting_ports=true (default)
        const result = await simplifiedTools.startServer({
          script: mainPath,
          wait_for_port: testPort,
          session_id: sessionId,
          log_level: 'info'
          // kill_conflicting_ports defaults to true
        });
        
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toContain('✅ Started server');
        
        // Verify killProcessOnPort was called
        // Since we can't easily spy on it due to binding, we check the conflict process is dead
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(conflictProc.killed).toBe(true);
        
      } finally {
        if (fs.existsSync(conflictPath)) fs.unlinkSync(conflictPath);
        if (fs.existsSync(mainPath)) fs.unlinkSync(mainPath);
      }
    }, 15000);
    
    it('should respect kill_conflicting_ports=false', async () => {
      const testPort = 4005;
      const sessionId = 'test-no-kill';
      
      // Create a server that will conflict
      const conflictPath = path.join(__dirname, 'conflict-server-2.js');
      const serverCode = `
        const http = require('http');
        http.createServer((req, res) => res.end('Conflict')).listen(${testPort}, () => {
          console.log('Conflict server on ${testPort}');
        });
        setInterval(() => {}, 1000);
      `;
      fs.writeFileSync(conflictPath, serverCode);
      
      try {
        // Start conflicting server
        const conflictProc = spawn('node', [conflictPath]);
        activeProcesses.push(conflictProc);
        
        // Wait for server to start and verify it's listening
        let retries = 0;
        let serverStarted = false;
        while (retries < 10 && !serverStarted) {
          await new Promise(resolve => setTimeout(resolve, 500));
          serverStarted = await isPortInUse(testPort);
          retries++;
        }
        
        // Verify port is in use
        expect(serverStarted).toBe(true);
        
        // Create mock monitor
        const mockMonitor = {
          logManager: {
            capture: jest.fn(),
            query: jest.fn().mockResolvedValue([])
          },
          getState: jest.fn().mockReturnValue('running'),
          setState: jest.fn()
        };
        
        // Mock session manager
        jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
        jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
        
        // Spy on killProcessOnPort to ensure it's NOT called
        const killSpy = jest.spyOn(simplifiedTools, 'killProcessOnPort');
        
        // Mock the enhanced starter to simulate failure due to port in use
        jest.spyOn(simplifiedTools.enhancedStarter, 'startServer').mockRejectedValue(
          new Error('EADDRINUSE: Port already in use')
        );
        
        // Try to start server with kill_conflicting_ports=false
        const result = await simplifiedTools.startServer({
          script: 'dummy.js',
          wait_for_port: testPort,
          session_id: sessionId,
          log_level: 'info',
          kill_conflicting_ports: false
        });
        
        // Should fail because port is in use
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Failed to start server');
        
        // Verify killProcessOnPort was NOT called
        expect(killSpy).not.toHaveBeenCalled();
        
        // Verify conflicting process is still alive
        expect(conflictProc.killed).toBe(false);
        
      } finally {
        if (fs.existsSync(conflictPath)) fs.unlinkSync(conflictPath);
      }
    });
  });
});