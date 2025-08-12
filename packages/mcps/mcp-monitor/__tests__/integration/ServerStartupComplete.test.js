/**
 * Integration tests for complete server startup flow
 * Tests intelligent detection, log capture, and port management together
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import { SessionManager } from '../../handlers/SessionManager.js';
import { EnhancedServerStarter } from '../../tools/EnhancedServerStarter.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to check if port is in use
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

describe('Complete Server Startup Flow', () => {
  let sessionManager;
  let simplifiedTools;
  let activeProcesses = [];
  let testServersDir;
  
  beforeAll(() => {
    // Create a directory for test servers
    testServersDir = path.join(__dirname, 'test-servers');
    if (!fs.existsSync(testServersDir)) {
      fs.mkdirSync(testServersDir, { recursive: true });
    }
  });
  
  afterAll(() => {
    // Clean up test servers directory
    if (fs.existsSync(testServersDir)) {
      fs.rmSync(testServersDir, { recursive: true, force: true });
    }
  });
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    simplifiedTools = new SimplifiedTools(sessionManager);
  });
  
  afterEach(async () => {
    // Kill all active processes
    for (const proc of activeProcesses) {
      try {
        proc.kill('SIGTERM');
      } catch (e) {
        // Process may already be dead
      }
    }
    activeProcesses = [];
    
    // Clean up sessions
    for (const [sessionId] of sessionManager.monitors || new Map()) {
      await sessionManager.killProcess(sessionId);
    }
  });
  
  describe('Successful Server Startup', () => {
    it('should start a simple HTTP server and capture logs', async () => {
      const sessionId = 'test-http-server';
      const port = 4100;
      
      // Create a test server
      const serverPath = path.join(testServersDir, 'simple-http.js');
      const serverCode = `
        const http = require('http');
        
        console.log('[INFO] Starting HTTP server...');
        
        const server = http.createServer((req, res) => {
          console.log(\`[INFO] Request received: \${req.method} \${req.url}\`);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Hello from test server');
        });
        
        server.listen(${port}, () => {
          console.log(\`[INFO] Server listening on port ${port}\`);
          console.log('[INFO] Server ready to accept connections');
        });
        
        server.on('error', (err) => {
          console.error('[ERROR] Server error:', err.message);
          process.exit(1);
        });
      `;
      fs.writeFileSync(serverPath, serverCode);
      
      // Create mock monitor with real log capture
      const capturedLogs = [];
      const mockLogManagerActor = {
        receive: jest.fn(async (msg) => {
          if (msg.type === 'log') {
            capturedLogs.push(msg.data);
            console.log(`Captured log: ${msg.data.message}`);
          }
          return Promise.resolve();
        })
      };
      
      const mockMonitor = {
        logManager: {},
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };
      
      // Set up session
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: {
          logManager: mockLogManagerActor
        }
      });
      
      // Mock getOrCreateMonitor to return our mock
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
      
      // Use the enhanced starter
      const enhancedStarter = new EnhancedServerStarter(sessionManager);
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: port,
        session_id: sessionId
      });
      
      activeProcesses.push(startResult.process);
      
      // Set up log capture
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);
      
      // Wait for server to be ready
      const isReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        port,
        sessionId,
        10000
      );
      
      expect(isReady).toBe(true);
      
      // Verify port is actually in use
      const portInUse = await isPortInUse(port);
      expect(portInUse).toBe(true);
      
      // Wait a bit for logs to be captured
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify logs were captured
      expect(mockLogManagerActor.receive).toHaveBeenCalled();
      expect(capturedLogs.length).toBeGreaterThan(0);
      
      // Check log content
      const logMessages = capturedLogs.map(log => log.message);
      expect(logMessages.some(msg => msg.includes('Starting HTTP server'))).toBe(true);
      expect(logMessages.some(msg => msg.includes(`Server listening on port ${port}`))).toBe(true);
      expect(logMessages.some(msg => msg.includes('Server ready'))).toBe(true);
      
    }, 15000);
    
    it('should handle server with delayed startup', async () => {
      const sessionId = 'test-delayed-server';
      const port = 4101;
      
      // Create a server that takes time to start
      const serverPath = path.join(testServersDir, 'delayed-server.js');
      const serverCode = `
        const http = require('http');
        
        console.log('[INFO] Initializing server...');
        console.log('[INFO] Loading configuration...');
        
        setTimeout(() => {
          console.log('[INFO] Configuration loaded');
          console.log('[INFO] Connecting to database...');
        }, 500);
        
        setTimeout(() => {
          console.log('[INFO] Database connected');
          console.log('[INFO] Starting HTTP server...');
          
          const server = http.createServer((req, res) => {
            res.end('OK');
          });
          
          server.listen(${port}, () => {
            console.log(\`[INFO] Server listening on port ${port}\`);
          });
        }, 1500);
      `;
      fs.writeFileSync(serverPath, serverCode);
      
      // Set up mocks
      const capturedLogs = [];
      const mockLogManagerActor = {
        receive: jest.fn(async (msg) => {
          if (msg.type === 'log') {
            capturedLogs.push(msg.data);
          }
        })
      };
      
      const mockMonitor = {
        logManager: {},
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };
      
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });
      
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
      
      // Start server
      const enhancedStarter = new EnhancedServerStarter(sessionManager);
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: port,
        session_id: sessionId
      });
      
      activeProcesses.push(startResult.process);
      
      // Set up log capture
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);
      
      // Wait for server - should handle the delay
      const isReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        port,
        sessionId,
        10000
      );
      
      expect(isReady).toBe(true);
      
      // Verify logs show the startup sequence
      const logMessages = capturedLogs.map(log => log.message);
      expect(logMessages.some(msg => msg.includes('Initializing server'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('Configuration loaded'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('Database connected'))).toBe(true);
      expect(logMessages.some(msg => msg.includes(`Server listening on port ${port}`))).toBe(true);
      
    }, 15000);
  });
  
  describe('Failed Server Startup Detection', () => {
    it('should detect and log immediate startup failure', async () => {
      const sessionId = 'test-startup-failure';
      const port = 4102;
      
      // Create a server that fails immediately
      const serverPath = path.join(testServersDir, 'failing-server.js');
      const serverCode = `
        console.log('[INFO] Starting server...');
        console.error('[ERROR] Fatal configuration error: Missing required environment variable');
        throw new Error('Configuration error');
      `;
      fs.writeFileSync(serverPath, serverCode);
      
      // Set up mocks
      const capturedLogs = [];
      const mockLogManagerActor = {
        receive: jest.fn(async (msg) => {
          if (msg.type === 'log') {
            capturedLogs.push(msg.data);
          }
        })
      };
      
      const mockMonitor = {
        logManager: {},
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };
      
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });
      
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
      
      // Start server
      const enhancedStarter = new EnhancedServerStarter(sessionManager);
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: port,
        session_id: sessionId
      });
      
      activeProcesses.push(startResult.process);
      
      // Set up log capture
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);
      
      // Wait for server - should detect failure
      const isReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        port,
        sessionId,
        5000
      );
      
      expect(isReady).toBe(false);
      
      // Wait for logs
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify error was captured in logs
      const logMessages = capturedLogs.map(log => log.message);
      expect(logMessages.some(msg => msg.includes('Starting server'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('Fatal configuration error'))).toBe(true);
      
    }, 10000);
    
    it('should detect port binding errors', async () => {
      const sessionId = 'test-port-error';
      const port = 4103;
      
      // Create a server that will conflict
      const server1Path = path.join(testServersDir, 'server1.js');
      const serverCode = `
        const http = require('http');
        console.log('[INFO] Starting server...');
        const server = http.createServer((req, res) => res.end('Server 1'));
        server.listen(${port}, () => {
          console.log('[INFO] Server 1 listening on port ${port}');
        });
        server.on('error', (err) => {
          console.error('[ERROR] Port binding error:', err.message);
          process.exit(1);
        });
        setInterval(() => {}, 1000); // Keep alive
      `;
      fs.writeFileSync(server1Path, serverCode);
      
      // Start first server to occupy the port
      const proc1 = spawn('node', [server1Path]);
      activeProcesses.push(proc1);
      
      // Wait for first server to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verify port is in use
      const portBusy = await isPortInUse(port);
      expect(portBusy).toBe(true);
      
      // Now try to start second server on same port (with kill_conflicting_ports=false)
      const capturedLogs = [];
      const mockLogManagerActor = {
        receive: jest.fn(async (msg) => {
          if (msg.type === 'log') {
            capturedLogs.push(msg.data);
          }
        })
      };
      
      const mockMonitor = {
        logManager: {},
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };
      
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });
      
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
      
      // Try to start second server without killing the first
      const server2Path = path.join(testServersDir, 'server2.js');
      fs.writeFileSync(server2Path, serverCode.replace('Server 1', 'Server 2'));
      
      const enhancedStarter = new EnhancedServerStarter(sessionManager);
      const startResult = await enhancedStarter.startServer({
        script: server2Path,
        wait_for_port: port,
        session_id: sessionId
      });
      
      activeProcesses.push(startResult.process);
      
      // Set up log capture
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);
      
      // Wait for server - should detect port error
      const isReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        port,
        sessionId,
        5000
      );
      
      expect(isReady).toBe(false);
      
      // Wait for error logs
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify port error was captured
      const errorLogs = capturedLogs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs.some(log => 
        log.message.includes('EADDRINUSE') || 
        log.message.includes('Port binding error')
      )).toBe(true);
      
    }, 15000);
  });
  
  describe('Port Management with Startup', () => {
    it('should kill conflicting process and start successfully', async () => {
      const sessionId = 'test-port-kill';
      const port = 4104;
      
      // Create server code
      const serverCode = `
        const http = require('http');
        console.log('[INFO] Starting server...');
        const server = http.createServer((req, res) => res.end('OK'));
        server.listen(${port}, () => {
          console.log('[INFO] Server listening on port ${port}');
        });
        setInterval(() => {}, 1000);
      `;
      
      // Start first server to block the port
      const blocker = path.join(testServersDir, 'blocker.js');
      fs.writeFileSync(blocker, serverCode);
      const blockProc = spawn('node', [blocker]);
      activeProcesses.push(blockProc);
      
      // Wait for blocker to start
      await new Promise(resolve => setTimeout(resolve, 1000));
      expect(await isPortInUse(port)).toBe(true);
      
      // Set up mocks for main server
      const capturedLogs = [];
      const mockLogManagerActor = {
        receive: jest.fn(async (msg) => {
          if (msg.type === 'log') {
            capturedLogs.push(msg.data);
          }
        })
      };
      
      const mockMonitor = {
        logManager: {},
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };
      
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });
      
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);
      
      // Create main server
      const mainServer = path.join(testServersDir, 'main.js');
      fs.writeFileSync(mainServer, serverCode);
      
      // Kill the conflicting process
      await simplifiedTools.killProcessOnPort(port);
      
      // Wait a bit for port to be released
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now start our server
      const enhancedStarter = new EnhancedServerStarter(sessionManager);
      const startResult = await enhancedStarter.startServer({
        script: mainServer,
        wait_for_port: port,
        session_id: sessionId
      });
      
      activeProcesses.push(startResult.process);
      
      // Set up log capture
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);
      
      // Wait for server
      const isReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        port,
        sessionId,
        10000
      );
      
      expect(isReady).toBe(true);
      
      // Verify our server is now using the port
      expect(await isPortInUse(port)).toBe(true);
      
      // Verify logs
      const logMessages = capturedLogs.map(log => log.message);
      expect(logMessages.some(msg => msg.includes('Starting server'))).toBe(true);
      expect(logMessages.some(msg => msg.includes(`Server listening on port ${port}`))).toBe(true);
      
    }, 20000);
  });
});