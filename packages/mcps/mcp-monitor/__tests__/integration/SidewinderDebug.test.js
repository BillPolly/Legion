/**
 * Debug test for Sidewinder integration issues
 * Focuses on identifying why Sidewinder isn't connecting in the full stack monitor
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import { SessionManager } from '../../handlers/SessionManager.js';
import { EnhancedServerStarter } from '../../tools/EnhancedServerStarter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Sidewinder Integration Debug', () => {
  let sessionManager;
  let simplifiedTools;
  let enhancedStarter;
  let activeProcesses = [];
  let testServersDir;

  beforeEach(async () => {
    // Create test directory
    testServersDir = path.join(__dirname, 'sidewinder-debug-test');
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

  it('should debug Sidewinder server initialization', async () => {
    const sessionId = 'sidewinder-init-debug';
    
    console.log('[DEBUG] Testing Sidewinder server initialization...');
    
    try {
      // Try to initialize Sidewinder server directly
      const sidewinderServer = await sessionManager.initializeSidewinderServer();
      
      console.log('[DEBUG] Sidewinder server initialized successfully:', {
        port: sidewinderServer.port,
        hasServer: !!sidewinderServer.server
      });
      
      expect(sidewinderServer).toBeDefined();
      expect(sidewinderServer.port).toBeGreaterThan(0);
      
      // Test WebSocket server is actually listening
      const WebSocket = await import('ws');
      const ws = new WebSocket.default(`ws://localhost:${sidewinderServer.port}`);
      
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
        
        ws.once('open', () => {
          clearTimeout(timeout);
          console.log('[DEBUG] WebSocket connection successful');
          resolve();
        });
        
        ws.once('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      
      ws.close();
      
    } catch (error) {
      console.error('[DEBUG] Sidewinder initialization failed:', error);
      throw error;
    }
  });

  it('should debug Sidewinder injection process', async () => {
    const sessionId = 'sidewinder-injection-debug';
    const serverPort = 16000;
    
    // Create very simple test server
    const serverPath = path.join(testServersDir, 'debug-server.js');
    const serverCode = `
console.log('[DEBUG] Script starting...');

setTimeout(() => {
  console.log('[DEBUG] Creating HTTP server...');
  const http = require('http');
  
  const server = http.createServer((req, res) => {
    res.end('Debug server');
  });
  
  server.listen(${serverPort}, () => {
    console.log('[DEBUG] Server listening on ${serverPort}');
  });
}, 1000);
`;
    fs.writeFileSync(serverPath, serverCode);

    console.log('[DEBUG] Testing enhanced server starter...');
    
    // Don't mock anything - test real flow
    try {
      const startResult = await enhancedStarter.startServer({
        script: serverPath,
        wait_for_port: serverPort,
        session_id: sessionId,
        log_level: 'debug'  // More verbose logging
      });
      
      console.log('[DEBUG] Enhanced starter result:', {
        hasProcess: !!startResult.process,
        port: startResult.port,
        pid: startResult.process?.pid,
        sidewinderPort: startResult.sidewinderPort
      });
      
      expect(startResult).toBeDefined();
      activeProcesses.push(startResult.process);
      
      // Monitor process output directly
      let stdout = '';
      let stderr = '';
      
      startResult.process.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log('[DEBUG] Process stdout:', output.trim());
      });
      
      startResult.process.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.log('[DEBUG] Process stderr:', output.trim());
      });
      
      // Wait for process to run for a bit
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('[DEBUG] Accumulated stdout:', stdout);
      console.log('[DEBUG] Accumulated stderr:', stderr);
      
      // Check that the process actually ran (we should see our debug output)
      expect(stdout).toContain('[DEBUG] Script starting...');
      expect(stdout).toContain('[DEBUG] Creating HTTP server...');
      
      // Verify that Sidewinder injection was configured (check the enhanced command contained --require)
      expect(startResult.enhancedCommand.args.some(arg => arg === '--require')).toBe(true);
      expect(startResult.enhancedCommand.args.some(arg => arg.includes('sidewinder'))).toBe(true);
      
    } catch (error) {
      console.error('[DEBUG] Enhanced starter failed:', error);
      throw error;
    }
  });

  it('should test log capture setup independently', async () => {
    const sessionId = 'log-capture-debug';
    
    console.log('[DEBUG] Testing log capture setup...');
    
    // Create a simple process that outputs logs
    const { spawn } = await import('child_process');
    const proc = spawn('node', ['-e', `
      console.log('[TEST] Info message');
      console.error('[TEST] Error message');
      setTimeout(() => console.log('[TEST] Delayed message'), 500);
      setTimeout(() => process.exit(0), 1000);
    `]);
    
    activeProcesses.push(proc);
    
    // Set up basic monitor structure
    const capturedLogs = [];
    const mockLogManagerActor = {
      receive: jest.fn(async (msg) => {
        capturedLogs.push(msg);
        console.log('[DEBUG] Mock actor received:', msg.type, msg.data?.message || '');
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
    
    // Test log capture setup
    await simplifiedTools.setupLogCapture(proc, sessionId, mockMonitor);
    
    // Wait for process to complete and logs to be captured
    await new Promise((resolve) => {
      proc.on('exit', () => {
        setTimeout(resolve, 500); // Give time for final log processing
      });
    });
    
    console.log('[DEBUG] Total captured logs:', capturedLogs.length);
    capturedLogs.forEach((log, i) => {
      console.log(`[DEBUG] Log ${i}:`, log);
    });
    
    // Verify logs were captured
    expect(capturedLogs.length).toBeGreaterThan(0);
    expect(mockLogManagerActor.receive).toHaveBeenCalled();
  });

  it('should test waitForServerReady with basic port detection', async () => {
    const sessionId = 'port-detection-debug';
    const serverPort = 16001;
    
    console.log('[DEBUG] Testing basic port detection...');
    
    // Create simple server without Sidewinder
    const { spawn } = await import('child_process');
    const proc = spawn('node', ['-e', `
      const http = require('http');
      const server = http.createServer((req, res) => res.end('OK'));
      server.listen(${serverPort}, () => {
        console.log('Server listening on ${serverPort}');
      });
    `]);
    
    activeProcesses.push(proc);
    
    // Set up minimal monitor
    const mockMonitor = {
      logManager: {},
      getState: jest.fn().mockReturnValue('running'),
      setState: jest.fn()
    };
    
    sessionManager.monitors = new Map();
    sessionManager.monitors.set(sessionId, mockMonitor);
    
    jest.spyOn(sessionManager, 'getCurrentMonitor').mockReturnValue(mockMonitor);
    
    console.log('[DEBUG] Starting waitForServerReady...');
    
    // Test waitForServerReady with reasonable timeout
    const serverReady = await simplifiedTools.waitForServerReady(
      proc,
      serverPort,
      sessionId,
      10000  // 10 second timeout
    );
    
    console.log('[DEBUG] Server ready result:', serverReady);
    
    // Should succeed with port detection even without Sidewinder
    expect(serverReady).toBe(true);
  });
}, 30000); // 30 second timeout for the whole describe block