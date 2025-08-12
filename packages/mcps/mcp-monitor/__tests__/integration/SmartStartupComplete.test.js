/**
 * Comprehensive tests for the Smart Server Startup Detection System
 * Tests the complete flow: EnhancedServerStarter → waitForServerReady → Sidewinder integration → log capture
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import { SessionManager } from '../../handlers/SessionManager.js';
import { EnhancedServerStarter } from '../../tools/EnhancedServerStarter.js';
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

// Helper to wait for a condition
async function waitForCondition(condition, timeout = 10000, interval = 100) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

describe('Smart Server Startup Detection System', () => {
  let sessionManager;
  let simplifiedTools;
  let enhancedStarter;
  let activeProcesses = [];
  let testServersDir;
  let portCounter = 15000;

  beforeEach(async () => {
    // Create test directory
    testServersDir = path.join(__dirname, 'smart-startup-test');
    if (!fs.existsSync(testServersDir)) {
      fs.mkdirSync(testServersDir, { recursive: true });
    }

    // Initialize components
    sessionManager = new SessionManager();
    simplifiedTools = new SimplifiedTools(sessionManager);
    enhancedStarter = new EnhancedServerStarter(sessionManager);
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
    if (sessionManager.monitors) {
      for (const [sessionId] of sessionManager.monitors) {
        try {
          await sessionManager.killProcess(sessionId);
        } catch (e) {
          // Session may already be cleaned up
        }
      }
    }

    // Clean up test directory
    if (fs.existsSync(testServersDir)) {
      fs.rmSync(testServersDir, { recursive: true, force: true });
    }
  });

  describe('Complete End-to-End Flow', () => {
    it('should successfully start server with Sidewinder monitoring and capture lifecycle events', async () => {
      const sessionId = 'e2e-lifecycle-test';
      const serverPort = portCounter++;
      
      // Create test server with clear lifecycle events
      const serverPath = path.join(testServersDir, 'lifecycle-server.js');
      const serverCode = `
const http = require('http');

console.log('[STARTUP] Initializing application...');

setTimeout(() => {
  console.log('[STARTUP] Creating HTTP server...');
  
  const server = http.createServer((req, res) => {
    console.log(\`[REQUEST] \${req.method} \${req.url}\`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      message: 'Server is running', 
      timestamp: new Date().toISOString() 
    }));
  });

  console.log('[STARTUP] Starting server on port ${serverPort}...');
  
  server.listen(${serverPort}, () => {
    console.log('[STARTUP] ✅ Server successfully listening on port ${serverPort}');
    console.log('[STARTUP] Server is ready to accept connections');
  });

  server.on('error', (err) => {
    console.error('[ERROR] Server failed to start:', err.message);
    process.exit(1);
  });
  
  // Keep server alive
  setInterval(() => {
    console.log('[HEARTBEAT] Server is healthy');
  }, 5000);
  
}, 500); // Small delay to test startup detection
`;
      fs.writeFileSync(serverPath, serverCode);

      // Mock log capture to verify events are captured
      const capturedLogs = [];
      const mockLogManagerActor = {
        receive: jest.fn(async (msg) => {
          if (msg.type === 'log') {
            capturedLogs.push(msg.data);
            console.log(`[TEST] Captured log: ${msg.data.level} - ${msg.data.message}`);
          }
          if (msg.type === 'sidewinder-event') {
            capturedLogs.push({ type: 'sidewinder', data: msg.data });
            console.log(`[TEST] Captured Sidewinder event: ${msg.data.type}/${msg.data.event}`);
          }
        })
      };

      const mockMonitor = {
        logManager: {},
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };

      // Set up session
      sessionManager.monitors = new Map();
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });

      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getCurrentMonitor').mockReturnValue(mockMonitor);
      jest.spyOn(sessionManager, 'getProcess').mockReturnValue(null);

      // Mock Sidewinder server initialization
      jest.spyOn(sessionManager, 'initializeSidewinderServer').mockResolvedValue({
        port: 9898,
        server: { on: jest.fn() }
      });

      try {
        // Start server using the complete flow
        console.log('[TEST] Starting server with enhanced starter...');
        const startResult = await enhancedStarter.startServer({
          script: serverPath,
          wait_for_port: serverPort,
          session_id: sessionId,
          log_level: 'info'
        });

        expect(startResult).toBeDefined();
        expect(startResult.process).toBeDefined();
        expect(startResult.port).toBe(serverPort);
        
        activeProcesses.push(startResult.process);

        // Set up log capture
        await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);

        console.log('[TEST] Starting intelligent server detection...');
        
        // Use waitForServerReady to test the complete detection system
        const serverReady = await simplifiedTools.waitForServerReady(
          startResult.process, 
          serverPort, 
          sessionId, 
          15000  // 15 second timeout
        );

        console.log(`[TEST] Server ready detection result: ${serverReady}`);
        expect(serverReady).toBe(true);

        // Verify port is actually listening
        const portListening = await isPortInUse(serverPort);
        expect(portListening).toBe(true);

        // Wait for logs to be captured
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify log capture is working
        expect(mockLogManagerActor.receive).toHaveBeenCalled();
        expect(capturedLogs.length).toBeGreaterThan(0);

        // Check for startup sequence in logs
        const logMessages = capturedLogs
          .filter(log => log.message)
          .map(log => log.message);
        
        console.log('[TEST] Captured log messages:', logMessages);

        expect(logMessages.some(msg => msg.includes('Initializing application'))).toBe(true);
        expect(logMessages.some(msg => msg.includes('Creating HTTP server'))).toBe(true);
        expect(logMessages.some(msg => msg.includes('Server successfully listening'))).toBe(true);

        // Test that we can make requests to the server
        const response = await fetch(`http://localhost:${serverPort}/test`);
        expect(response.ok).toBe(true);
        const data = await response.json();
        expect(data.message).toBe('Server is running');

      } catch (error) {
        console.error('[TEST] Test failed:', error);
        console.error('[TEST] Captured logs at failure:', capturedLogs);
        throw error;
      }
    }, 30000);

    it('should handle server startup with delayed port binding', async () => {
      const sessionId = 'delayed-binding-test';
      const serverPort = portCounter++;
      
      // Create server with significant delay before binding
      const serverPath = path.join(testServersDir, 'delayed-server.js');
      const serverCode = `
const http = require('http');

console.log('[INFO] Application starting...');
console.log('[INFO] Loading configuration...');

// Simulate loading time
setTimeout(() => {
  console.log('[INFO] Configuration loaded');
  console.log('[INFO] Initializing database connection...');
  
  setTimeout(() => {
    console.log('[INFO] Database connected');
    console.log('[INFO] Starting HTTP server...');
    
    const server = http.createServer((req, res) => {
      res.end('Delayed server ready');
    });
    
    server.listen(${serverPort}, () => {
      console.log('[INFO] Server listening on port ${serverPort}');
      console.log('[INFO] Application fully initialized');
    });
    
    server.on('error', (err) => {
      console.error('[ERROR]', err.message);
      process.exit(1);
    });
  }, 2000); // 2 second delay for "database"
}, 1000); // 1 second delay for "config"
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

      sessionManager.monitors = new Map();
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });

      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getCurrentMonitor').mockReturnValue(mockMonitor);
      jest.spyOn(sessionManager, 'initializeSidewinderServer').mockResolvedValue({
        port: 9899, server: { on: jest.fn() }
      });

      // Start server
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: serverPort,
        session_id: sessionId,
        log_level: 'info'
      });

      activeProcesses.push(startResult.process);
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);

      // Smart detection should handle the delay
      const serverReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        serverPort,
        sessionId,
        20000  // Longer timeout for delayed startup
      );

      expect(serverReady).toBe(true);

      // Verify the startup sequence was captured
      const logMessages = capturedLogs
        .filter(log => log.message)
        .map(log => log.message);

      expect(logMessages.some(msg => msg.includes('Loading configuration'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('Database connected'))).toBe(true);
      expect(logMessages.some(msg => msg.includes('Application fully initialized'))).toBe(true);
    }, 35000);

    it('should detect and report server startup failures', async () => {
      const sessionId = 'startup-failure-test';
      const serverPort = portCounter++;
      
      // Create server that will fail
      const serverPath = path.join(testServersDir, 'failing-server.js');
      const serverCode = `
const http = require('http');

console.log('[INFO] Starting server...');

setTimeout(() => {
  console.log('[INFO] Creating server...');
  console.error('[ERROR] Fatal configuration error: Missing required environment variable DATABASE_URL');
  console.error('[ERROR] Cannot start server without database configuration');
  
  // Exit with error code
  process.exit(1);
}, 500);
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

      sessionManager.monitors = new Map();
      sessionManager.monitors.set(sessionId, mockMonitor);
      sessionManager.actorSpaces = new Map();
      sessionManager.actorSpaces.set(sessionId, {
        actors: { logManager: mockLogManagerActor }
      });

      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getCurrentMonitor').mockReturnValue(mockMonitor);
      jest.spyOn(sessionManager, 'initializeSidewinderServer').mockResolvedValue({
        port: 9900, server: { on: jest.fn() }
      });

      // Start server
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: serverPort,
        session_id: sessionId,
        log_level: 'info'
      });

      activeProcesses.push(startResult.process);
      await simplifiedTools.setupLogCapture(startResult.process, sessionId, mockMonitor);

      // Detection should identify the failure
      const serverReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        serverPort,
        sessionId,
        10000
      );

      expect(serverReady).toBe(false);

      // Verify error logs were captured
      const errorLogs = capturedLogs.filter(log => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
      
      const errorMessages = errorLogs.map(log => log.message);
      expect(errorMessages.some(msg => msg.includes('Fatal configuration error'))).toBe(true);
    }, 20000);
  });

  describe('Multi-Signal Detection Validation', () => {
    it('should use port verification when Sidewinder is unavailable', async () => {
      const sessionId = 'port-fallback-test';
      const serverPort = portCounter++;
      
      // Create simple server
      const serverPath = path.join(testServersDir, 'simple-server.js');
      const serverCode = `
const http = require('http');
const server = http.createServer((req, res) => res.end('OK'));
server.listen(${serverPort}, () => {
  console.log('Server listening on ${serverPort}');
});
`;
      fs.writeFileSync(serverPath, serverCode);

      // Mock Sidewinder server initialization to fail
      jest.spyOn(sessionManager, 'initializeSidewinderServer').mockRejectedValue(
        new Error('Sidewinder WebSocket server failed to start')
      );

      const mockMonitor = { logManager: {}, getState: jest.fn().mockReturnValue('running') };
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getCurrentMonitor').mockReturnValue(mockMonitor);

      // Start server - this should handle Sidewinder failure gracefully
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: serverPort,
        session_id: sessionId,
        log_level: 'info'
      });

      activeProcesses.push(startResult.process);

      // Should still detect server readiness via port checking
      const serverReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        serverPort,
        sessionId,
        10000
      );

      expect(serverReady).toBe(true);

      // Verify port is actually listening
      const portListening = await isPortInUse(serverPort);
      expect(portListening).toBe(true);
    }, 20000);

    it('should generate detailed diagnostic for timeout scenarios', async () => {
      const sessionId = 'diagnostic-test';
      const serverPort = portCounter++;
      
      // Create server that starts but never binds to the expected port
      const serverPath = path.join(testServersDir, 'wrong-port-server.js');
      const serverCode = `
const http = require('http');

console.log('Starting server...');
const server = http.createServer((req, res) => res.end('Wrong port'));

// Bind to different port than expected
server.listen(${serverPort + 1000}, () => {
  console.log('Server listening on ${serverPort + 1000} (not expected port)');
});

// Keep process alive
setInterval(() => {}, 1000);
`;
      fs.writeFileSync(serverPath, serverCode);

      const mockMonitor = { 
        logManager: {}, 
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn()
      };
      
      jest.spyOn(sessionManager, 'getOrCreateMonitor').mockResolvedValue(mockMonitor);
      jest.spyOn(sessionManager, 'getCurrentMonitor').mockReturnValue(mockMonitor);
      jest.spyOn(sessionManager, 'initializeSidewinderServer').mockResolvedValue({
        port: 9901, server: { on: jest.fn() }
      });

      // Capture console output to check diagnostics
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: serverPort,
        session_id: sessionId,
        log_level: 'info'
      });

      activeProcesses.push(startResult.process);

      // Use short timeout to trigger diagnostic generation
      const serverReady = await simplifiedTools.waitForServerReady(
        startResult.process,
        serverPort,
        sessionId,
        3000  // Short timeout
      );

      expect(serverReady).toBe(false);

      // Check that diagnostic was generated
      const logCalls = consoleLogSpy.mock.calls;
      const diagnosticCall = logCalls.find(call => 
        call[0] && call[0].includes('[SimplifiedTools] Server startup failed')
      );

      expect(diagnosticCall).toBeDefined();
      expect(diagnosticCall[0]).toContain('Timeout after 3000ms');

      consoleLogSpy.mockRestore();
    }, 15000);
  });
});