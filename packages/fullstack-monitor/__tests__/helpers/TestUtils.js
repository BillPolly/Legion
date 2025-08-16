/**
 * Test utilities for FullStack Monitor tests
 */

import { EventEmitter } from 'events';
import net from 'net';

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Create a mock WebSocket
 */
export function createMockWebSocket() {
  const ws = new EventEmitter();
  ws.send = jest.fn();
  ws.close = jest.fn();
  ws.terminate = jest.fn();
  ws.removeAllListeners = jest.fn(() => {
    EventEmitter.prototype.removeAllListeners.call(ws);
  });
  ws.readyState = 1; // OPEN
  return ws;
}

/**
 * Create a mock WebSocket server
 */
export function createMockWebSocketServer() {
  const wss = new EventEmitter();
  wss.clients = new Set();
  wss.close = jest.fn((callback) => {
    if (callback) callback();
  });
  return wss;
}

/**
 * Create a mock Puppeteer page
 */
export function createMockPage() {
  return {
    goto: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('screenshot')),
    title: jest.fn().mockResolvedValue('Test Page'),
    url: jest.fn().mockReturnValue('http://test.com'),
    evaluate: jest.fn().mockResolvedValue(undefined),
    evaluateOnNewDocument: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    type: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    removeListener: jest.fn()
  };
}

/**
 * Create a mock Puppeteer browser
 */
export function createMockBrowser() {
  return {
    newPage: jest.fn().mockResolvedValue(createMockPage()),
    close: jest.fn().mockResolvedValue(undefined),
    version: jest.fn().mockResolvedValue('HeadlessChrome/100.0.0'),
    on: jest.fn(),
    pages: jest.fn().mockResolvedValue([])
  };
}

/**
 * Create a mock child process
 */
export function createMockChildProcess(pid = 12345) {
  const process = new EventEmitter();
  process.pid = pid;
  process.killed = false;
  process.kill = jest.fn((signal) => {
    process.killed = true;
    process.emit('exit', 0, signal);
  });
  process.stdin = { write: jest.fn(), end: jest.fn() };
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  return process;
}

/**
 * Check if a port is in use
 */
export function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port
 */
export async function findAvailablePort(startPort = 9900, maxAttempts = 100) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      return port;
    }
  }
  throw new Error(`No available port found between ${startPort} and ${startPort + maxAttempts}`);
}

/**
 * Create a test HTTP server
 */
export function createTestServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = require('http').createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Test Server Response');
    });
    
    server.on('error', reject);
    
    server.listen(port, '127.0.0.1', () => {
      const actualPort = server.address().port;
      resolve({ server, port: actualPort });
    });
  });
}

/**
 * Sleep for a given duration
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a test script file
 */
export function createTestScript(content = 'console.log("test");') {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  const tmpDir = os.tmpdir();
  const scriptPath = path.join(tmpDir, `test-script-${Date.now()}.js`);
  
  fs.writeFileSync(scriptPath, content);
  
  return {
    path: scriptPath,
    cleanup: () => {
      try {
        fs.unlinkSync(scriptPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Capture console output
 */
export class ConsoleCapture {
  constructor() {
    this.logs = [];
    this.originalLog = console.log;
    this.originalError = console.error;
    this.originalWarn = console.warn;
  }
  
  start() {
    console.log = (...args) => {
      this.logs.push({ level: 'log', args });
    };
    console.error = (...args) => {
      this.logs.push({ level: 'error', args });
    };
    console.warn = (...args) => {
      this.logs.push({ level: 'warn', args });
    };
  }
  
  stop() {
    console.log = this.originalLog;
    console.error = this.originalError;
    console.warn = this.originalWarn;
  }
  
  getLogs() {
    return this.logs;
  }
  
  clear() {
    this.logs = [];
  }
}

/**
 * Mock ResourceManager for tests
 */
export function createMockResourceManager() {
  return {
    initialize: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockReturnValue(undefined),
    set: jest.fn(),
    has: jest.fn().mockReturnValue(false),
    delete: jest.fn(),
    clear: jest.fn()
  };
}