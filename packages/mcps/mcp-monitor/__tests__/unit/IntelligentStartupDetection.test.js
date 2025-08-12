/**
 * Unit tests for Intelligent Server Startup Detection
 * Tests the multi-signal detection system directly without MCP
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SimplifiedTools } from '../../tools/SimplifiedTools.js';
import { SessionManager } from '../../handlers/SessionManager.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { portManager } from '../../utils/PortManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Intelligent Startup Detection', () => {
  let sessionManager;
  let simplifiedTools;
  let mockProcess;
  
  beforeEach(() => {
    sessionManager = new SessionManager();
    simplifiedTools = new SimplifiedTools(sessionManager);
    
    // Create a mock process
    mockProcess = new EventEmitter();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = jest.fn();
    mockProcess.pid = 12345;
    
    // Create a mock monitor for the session
    const mockMonitor = {
      logManager: {
        capture: jest.fn(),
        query: jest.fn().mockResolvedValue([])
      },
      getState: jest.fn().mockReturnValue('idle'),
      setState: jest.fn(),
      process: mockProcess
    };
    sessionManager.monitors = new Map();
    sessionManager.monitors.set('test-session', mockMonitor);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  
  describe('waitForServerReady', () => {
    it('should detect successful server startup via stdout pattern', async () => {
      // Mock the portManager.isPortListening to simulate port becoming available
      let callCount = 0;
      jest.spyOn(portManager, 'isPortListening').mockImplementation(() => {
        callCount++;
        // Return false for first call, then true
        return Promise.resolve(callCount > 1);
      });
      
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        5000
      );
      
      // Emit server output to trigger detection
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Server listening on port 3000\n'));
      }, 100);
      
      const result = await promise;
      expect(result).toBe(true);
      
      // Restore mock
      portManager.isPortListening.mockRestore();
    });
    
    it('should detect immediate process exit', async () => {
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        5000
      );
      
      // Simulate process exit
      setTimeout(() => {
        mockProcess.emit('exit', 1);
      }, 100);
      
      const result = await promise;
      expect(result).toBe(false);
    });
    
    it('should detect port binding errors', async () => {
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        5000
      );
      
      // Simulate EADDRINUSE error
      setTimeout(() => {
        mockProcess.stderr.emit('data', Buffer.from('Error: EADDRINUSE - address already in use\n'));
      }, 100);
      
      const result = await promise;
      expect(result).toBe(false);
    });
    
    it('should detect module not found errors', async () => {
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        5000
      );
      
      // Simulate module error
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('Error: Cannot find module "express"\n'));
      }, 100);
      
      const result = await promise;
      expect(result).toBe(false);
    });
    
    it('should detect syntax errors', async () => {
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        5000
      );
      
      // Simulate syntax error
      setTimeout(() => {
        mockProcess.stdout.emit('data', Buffer.from('SyntaxError: Unexpected token\n'));
      }, 100);
      
      const result = await promise;
      expect(result).toBe(false);
    });
    
    it('should handle process errors', async () => {
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        5000
      );
      
      // Simulate process error
      setTimeout(() => {
        mockProcess.emit('error', new Error('Failed to spawn process'));
      }, 100);
      
      const result = await promise;
      expect(result).toBe(false);
    });
    
    it('should timeout if server never starts', async () => {
      const promise = simplifiedTools.waitForServerReady(
        mockProcess,
        3000,
        'test-session',
        1000 // Short timeout for test
      );
      
      // Don't emit any success signals
      const result = await promise;
      expect(result).toBe(false);
    });
  });
  
  describe('containsStartupError', () => {
    it('should detect various error patterns', () => {
      const errorOutputs = [
        'Error: Something went wrong',
        'Cannot find module "express"',
        'SyntaxError: Unexpected token',
        'ReferenceError: x is not defined',
        'TypeError: Cannot read property at startup',
        'ENOENT: no such file or directory',
        'Error: MODULE_NOT_FOUND',
        'Failed to start server',
        'Startup failed!',
        'Unable to start application'
      ];
      
      errorOutputs.forEach(output => {
        expect(simplifiedTools.containsStartupError(output)).toBe(true);
      });
    });
    
    it('should not detect false positives', () => {
      const normalOutputs = [
        'Server starting...',
        'Loading configuration',
        'Connecting to database',
        'Initializing routes'
      ];
      
      normalOutputs.forEach(output => {
        expect(simplifiedTools.containsStartupError(output)).toBe(false);
      });
    });
  });
  
  describe('generateStartupDiagnostic', () => {
    it('should generate helpful diagnostics', () => {
      const state = {
        processRunning: false,
        sidewinderConnected: false,
        serverCreated: false,
        serverListening: false,
        portVerified: false,
        hasError: true,
        errorMessage: 'Port already in use'
      };
      
      const diagnostic = simplifiedTools.generateStartupDiagnostic(
        state,
        'Server output here',
        'Error output here'
      );
      
      expect(diagnostic).toContain('Process exited early');
      expect(diagnostic).toContain('Port already in use');
      expect(diagnostic).toContain('Server output here');
    });
  });
  
  describe('handleSidewinderLifecycleEvent', () => {
    it('should handle server lifecycle events', () => {
      const state = {
        processRunning: true,
        sidewinderConnected: false,
        serverCreated: false,
        serverListening: false,
        portVerified: false,
        hasError: false,
        errorMessage: null
      };
      
      const resolveWith = jest.fn();
      
      // Test processStart event
      simplifiedTools.handleSidewinderLifecycleEvent(
        { type: 'processStart' },
        state,
        3000,
        resolveWith
      );
      expect(state.sidewinderConnected).toBe(true);
      
      // Test server creation
      simplifiedTools.handleSidewinderLifecycleEvent(
        { type: 'server-lifecycle', event: 'http-server-created' },
        state,
        3000,
        resolveWith
      );
      expect(state.serverCreated).toBe(true);
      
      // Test server listening
      simplifiedTools.handleSidewinderLifecycleEvent(
        { type: 'server-lifecycle', event: 'server-listening', port: 3000 },
        state,
        3000,
        resolveWith
      );
      expect(state.serverListening).toBe(true);
      
      // Test server error
      simplifiedTools.handleSidewinderLifecycleEvent(
        { 
          type: 'server-lifecycle', 
          event: 'server-error',
          error: { message: 'Binding failed' }
        },
        state,
        3000,
        resolveWith
      );
      expect(state.hasError).toBe(true);
      expect(resolveWith).toHaveBeenCalledWith(false, expect.stringContaining('Binding failed'));
    });
  });
  
  describe('checkFinalReadiness', () => {
    it('should confirm readiness with Sidewinder signals', () => {
      const state = {
        sidewinderConnected: true,
        serverListening: true,
        portVerified: false
      };
      
      const resolveWith = jest.fn();
      
      simplifiedTools.checkFinalReadiness(state, 3000, resolveWith);
      
      expect(resolveWith).toHaveBeenCalledWith(
        true,
        'Server confirmed ready via Sidewinder lifecycle events'
      );
    });
    
    it('should confirm readiness with port verification', () => {
      const state = {
        sidewinderConnected: false,
        serverListening: false,
        portVerified: true
      };
      
      const resolveWith = jest.fn();
      
      simplifiedTools.checkFinalReadiness(state, 3000, resolveWith);
      
      expect(resolveWith).toHaveBeenCalledWith(
        true,
        'Port 3000 verified listening'
      );
    });
    
    it('should not confirm if conditions not met', () => {
      const state = {
        sidewinderConnected: true,
        serverListening: false,
        portVerified: false
      };
      
      const resolveWith = jest.fn();
      
      simplifiedTools.checkFinalReadiness(state, 3000, resolveWith);
      
      expect(resolveWith).not.toHaveBeenCalled();
    });
  });
});

describe('Real Server Startup Tests', () => {
  let sessionManager;
  let simplifiedTools;
  const activeProcesses = [];
  
  beforeEach(async () => {
    sessionManager = new SessionManager();
    // SessionManager doesn't have an initialize method in this context
    simplifiedTools = new SimplifiedTools(sessionManager);
    sessionManager.monitors = new Map();
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
    activeProcesses.length = 0;
    
    // SessionManager doesn't have a cleanup method in this context
    sessionManager.monitors.clear();
  });
  
  it('should detect a real Node.js server starting', async () => {
    // Create a simple test server
    const testServerPath = path.join(__dirname, 'test-real-server.js');
    const serverCode = `
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.end('Test server');
      });
      server.listen(3050, () => {
        console.log('Server listening on port 3050');
      });
      // Keep process alive
      setInterval(() => {}, 1000);
    `;
    fs.writeFileSync(testServerPath, serverCode);
    
    try {
      const proc = spawn('node', [testServerPath]);
      activeProcesses.push(proc);
      
      // Create a mock monitor for this session
      const mockMonitor = {
        logManager: {
          capture: jest.fn(),
          query: jest.fn().mockResolvedValue([])
        },
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn(),
        process: proc
      };
      sessionManager.monitors.set('real-test', mockMonitor);
      
      const result = await simplifiedTools.waitForServerReady(
        proc,
        3050,
        'real-test',
        10000
      );
      
      expect(result).toBe(true);
    } finally {
      if (fs.existsSync(testServerPath)) {
        fs.unlinkSync(testServerPath);
      }
    }
  }, 15000);
  
  it('should detect a server that fails to start', async () => {
    // Create a server with an error
    const errorServerPath = path.join(__dirname, 'test-error-server.js');
    const serverCode = `
      console.log('Starting server...');
      throw new Error('Intentional startup failure');
    `;
    fs.writeFileSync(errorServerPath, serverCode);
    
    try {
      const proc = spawn('node', [errorServerPath]);
      activeProcesses.push(proc);
      
      // Create a mock monitor for this session
      const mockMonitor = {
        logManager: {
          capture: jest.fn(),
          query: jest.fn().mockResolvedValue([])
        },
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn(),
        process: proc
      };
      sessionManager.monitors.set('error-test', mockMonitor);
      
      const result = await simplifiedTools.waitForServerReady(
        proc,
        3051,
        'error-test',
        5000
      );
      
      expect(result).toBe(false);
    } finally {
      if (fs.existsSync(errorServerPath)) {
        fs.unlinkSync(errorServerPath);
      }
    }
  }, 10000);
  
  it('should detect port already in use', async () => {
    // Start first server
    const server1Path = path.join(__dirname, 'test-server1.js');
    const serverCode = `
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.end('Server 1');
      });
      server.listen(3052, () => {
        console.log('Server listening on port 3052');
      });
      // Keep process alive
      setInterval(() => {}, 1000);
    `;
    fs.writeFileSync(server1Path, serverCode);
    
    const server2Path = path.join(__dirname, 'test-server2.js');
    const server2Code = `
      const http = require('http');
      const server = http.createServer((req, res) => {
        res.end('Server 2');
      });
      server.listen(3052, () => {
        console.log('Server 2 listening on port 3052');
      });
      server.on('error', (err) => {
        console.error('Error:', err.message);
        process.exit(1);
      });
    `;
    fs.writeFileSync(server2Path, server2Code);
    
    try {
      // Start first server
      const proc1 = spawn('node', [server1Path]);
      activeProcesses.push(proc1);
      
      // Create mock monitor for first server
      const mockMonitor1 = {
        logManager: {
          capture: jest.fn(),
          query: jest.fn().mockResolvedValue([])
        },
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn(),
        process: proc1
      };
      sessionManager.monitors.set('server1-test', mockMonitor1);
      
      const result1 = await simplifiedTools.waitForServerReady(
        proc1,
        3052,
        'server1-test',
        10000
      );
      expect(result1).toBe(true);
      
      // Wait a bit for first server to fully start
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Try to start second server on same port
      const proc2 = spawn('node', [server2Path]);
      activeProcesses.push(proc2);
      
      // Create mock monitor for second server
      const mockMonitor2 = {
        logManager: {
          capture: jest.fn(),
          query: jest.fn().mockResolvedValue([])
        },
        getState: jest.fn().mockReturnValue('running'),
        setState: jest.fn(),
        process: proc2
      };
      sessionManager.monitors.set('server2-test', mockMonitor2);
      
      const result2 = await simplifiedTools.waitForServerReady(
        proc2,
        3052,
        'server2-test',
        5000
      );
      expect(result2).toBe(false);
      
    } finally {
      if (fs.existsSync(server1Path)) fs.unlinkSync(server1Path);
      if (fs.existsSync(server2Path)) fs.unlinkSync(server2Path);
    }
  }, 20000);
});