/**
 * Unit tests for Sidewinder integration
 * Tests lifecycle tracking, server wrapping, and monitoring
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SidewinderServer } from '../../servers/SidewinderServer.js';
import { Sidewinder } from '../../../../sidewinder/src/index.js';
import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to wait for port
function waitForPort(port, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkPort = () => {
      const socket = new net.Socket();
      
      socket.setTimeout(100);
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      
      socket.once('timeout', () => {
        socket.destroy();
        if (Date.now() - startTime > timeout) {
          resolve(false);
        } else {
          setTimeout(checkPort, 100);
        }
      });
      
      socket.once('error', () => {
        if (Date.now() - startTime > timeout) {
          resolve(false);
        } else {
          setTimeout(checkPort, 100);
        }
      });
      
      socket.connect(port, 'localhost');
    };
    
    checkPort();
  });
}

describe('Sidewinder Server', () => {
  let sidewinderServer;
  let wsPort;
  let portCounter = 0;
  
  beforeEach(async () => {
    // Use sequential ports to avoid conflicts
    wsPort = 9000 + (portCounter++);
    sidewinderServer = new SidewinderServer(wsPort);
    await sidewinderServer.start();
  });
  
  afterEach(async () => {
    if (sidewinderServer) {
      await sidewinderServer.stop();
    }
  });
  
  it('should start WebSocket server', async () => {
    expect(sidewinderServer.wss).toBeDefined();
    expect(sidewinderServer.isListening).toBe(true);
    
    // Verify port is actually listening
    const isListening = await waitForPort(wsPort);
    expect(isListening).toBe(true);
  });
  
  it('should accept WebSocket connections', async () => {
    const ws = new WebSocket(`ws://localhost:${wsPort}/sidewinder`);
    
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });
    
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
  });
  
  it('should receive and store client identification', async () => {
    const sessionId = 'test-session-123';
    const ws = new WebSocket(`ws://localhost:${wsPort}/sidewinder`);
    
    await new Promise(resolve => ws.once('open', resolve));
    
    // Send identification
    ws.send(JSON.stringify({
      type: 'identify',
      sessionId: sessionId,
      pid: 12345,
      profile: 'standard'
    }));
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check client is registered
    expect(sidewinderServer.clients.has(sessionId)).toBe(true);
    const client = sidewinderServer.clients.get(sessionId);
    expect(client.pid).toBe(12345);
    expect(client.profile).toBe('standard');
    
    ws.close();
  });
  
  it('should broadcast events to all clients', async () => {
    const clients = [];
    const receivedMessages = [];
    
    // Connect multiple clients
    for (let i = 0; i < 3; i++) {
      const ws = new WebSocket(`ws://localhost:${wsPort}/sidewinder`);
      await new Promise(resolve => ws.once('open', resolve));
      
      // Set up message handler
      ws.on('message', (data) => {
        receivedMessages.push({ client: i, data: JSON.parse(data.toString()) });
      });
      
      // Identify client
      ws.send(JSON.stringify({
        type: 'identify',
        sessionId: `client-${i}`,
        pid: 1000 + i
      }));
      
      clients.push(ws);
    }
    
    // Wait for identifications
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Broadcast an event
    sidewinderServer.broadcast({
      type: 'test-event',
      data: 'Hello all clients'
    });
    
    // Wait for messages
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Filter out the identification responses
    const testMessages = receivedMessages.filter(msg => msg.data.type === 'test-event');
    
    // Each client should receive the broadcast message
    expect(testMessages.length).toBe(3);
    testMessages.forEach(msg => {
      expect(msg.data.type).toBe('test-event');
      expect(msg.data.data).toBe('Hello all clients');
    });
    
    // Clean up
    clients.forEach(ws => ws.close());
  });
});

describe('Sidewinder Lifecycle Tracking', () => {
  let activeProcesses = [];
  let testDir;
  let portCounter = 100;
  
  beforeEach(() => {
    testDir = path.join(__dirname, 'sidewinder-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });
  
  afterEach(() => {
    // Kill all test processes
    activeProcesses.forEach(proc => {
      try {
        proc.kill('SIGTERM');
      } catch (e) {}
    });
    activeProcesses = [];
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });
  
  it('should inject into Node.js process and track lifecycle', async () => {
    // Create a simple server that Sidewinder will monitor
    const serverPath = path.join(testDir, 'lifecycle-server.js');
    const serverCode = `
      const http = require('http');
      
      console.log('Creating server...');
      const server = http.createServer((req, res) => {
        res.end('Test server');
      });
      
      server.listen(4200, () => {
        console.log('Server listening on port 4200');
      });
      
      // Keep process alive
      setTimeout(() => {}, 60000);
    `;
    fs.writeFileSync(serverPath, serverCode);
    
    // Start Sidewinder monitoring server
    const wsPort = 9500 + (portCounter++);
    const sidewinderServer = new SidewinderServer(wsPort);
    await sidewinderServer.start();
    
    // Track received events
    const receivedEvents = [];
    sidewinderServer.on('client-event', (event) => {
      receivedEvents.push(event);
      console.log('Sidewinder client event:', event.type);
    });
    sidewinderServer.on('event', (data) => {
      receivedEvents.push(data.event);
      console.log('Sidewinder event:', data.event.type, data.event.event);
    });
    
    // Create Sidewinder configuration
    const sidewinder = new Sidewinder({
      wsPort: wsPort,
      wsHost: 'localhost',
      sessionId: 'lifecycle-test',
      profile: 'standard',
      debug: false
    });
    
    // Get environment variables for Sidewinder
    const sidewinderEnv = sidewinder.getEnvironmentVariables();
    
    // Start the server with Sidewinder injection
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      serverPath
    ], {
      env: {
        ...process.env,
        ...sidewinderEnv,
        SIDEWINDER_WS_PORT: String(wsPort)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    activeProcesses.push(proc);
    
    // Capture output
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Server stdout:', data.toString().trim());
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('Server stderr:', data.toString().trim());
    });
    
    // Wait for server to start and Sidewinder to connect
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check that we received lifecycle events
    const hasProcessStart = receivedEvents.some(e => e.type === 'processStart');
    const hasIdentify = receivedEvents.some(e => e.type === 'identify');
    const hasServerLifecycle = receivedEvents.some(e => 
      e.type === 'server-lifecycle' && e.event === 'http-server-created'
    );
    const hasServerListening = receivedEvents.some(e => 
      e.type === 'server-lifecycle' && e.event === 'server-listening'
    );
    
    expect(hasProcessStart || hasIdentify).toBe(true);
    expect(hasServerLifecycle).toBe(true);
    expect(hasServerListening).toBe(true);
    
    // Verify server actually started
    expect(stdout).toContain('Server listening on port 4200');
    
    // Clean up
    proc.kill('SIGTERM');
    await sidewinderServer.stop();
  }, 10000);
  
  it('should track server errors and failures', async () => {
    // Create a server that will fail
    const serverPath = path.join(testDir, 'failing-server.js');
    const serverCode = `
      const http = require('http');
      
      console.log('Creating server that will fail...');
      const server = http.createServer((req, res) => {
        res.end('Test');
      });
      
      // Try to listen on a privileged port (will fail without sudo)
      server.listen(80, () => {
        console.log('Server listening on port 80');
      });
      
      server.on('error', (err) => {
        console.error('Server error:', err.message);
        process.exit(1);
      });
    `;
    fs.writeFileSync(serverPath, serverCode);
    
    // Start Sidewinder monitoring
    const wsPort = 9600 + (portCounter++);
    const sidewinderServer = new SidewinderServer(wsPort);
    await sidewinderServer.start();
    
    const receivedEvents = [];
    sidewinderServer.on('client-event', (event) => {
      receivedEvents.push(event);
    });
    sidewinderServer.on('event', (data) => {
      receivedEvents.push(data.event);
    });
    
    // Create Sidewinder config
    const sidewinder = new Sidewinder({
      wsPort: wsPort,
      wsHost: 'localhost',
      sessionId: 'error-test',
      profile: 'standard'
    });
    
    // Start the failing server
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      serverPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables(),
        SIDEWINDER_WS_PORT: String(wsPort)
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    activeProcesses.push(proc);
    
    // Wait for process to exit
    await new Promise((resolve) => {
      proc.on('exit', resolve);
      setTimeout(resolve, 5000); // Timeout after 5s
    });
    
    // Should have received error events
    const hasServerError = receivedEvents.some(e => 
      e.type === 'server-lifecycle' && 
      (e.event === 'server-error' || e.event === 'server-listen-error')
    );
    const hasProcessExit = receivedEvents.some(e => e.type === 'processExit');
    
    expect(hasServerError || hasProcessExit).toBe(true);
    
    await sidewinderServer.stop();
  }, 10000);
  
  it('should wrap console methods for log capture', async () => {
    // Create a server that logs messages
    const serverPath = path.join(testDir, 'logging-server.js');
    const serverCode = `
      console.log('INFO: Starting application');
      console.error('ERROR: Test error message');
      console.warn('WARNING: Test warning');
      console.debug('DEBUG: Debug information');
      
      setTimeout(() => {
        console.log('INFO: Application ready');
        process.exit(0);
      }, 100);
    `;
    fs.writeFileSync(serverPath, serverCode);
    
    // Start Sidewinder monitoring
    const wsPort = 9700 + (portCounter++);
    const sidewinderServer = new SidewinderServer(wsPort);
    await sidewinderServer.start();
    
    const logEvents = [];
    sidewinderServer.on('client-event', (event) => {
      if (event.type === 'log' || event.type === 'console') {
        logEvents.push(event);
      }
    });
    sidewinderServer.on('event', (data) => {
      if (data.event.type === 'log' || data.event.type === 'console') {
        logEvents.push(data.event);
      }
    });
    
    // Start server with console hook enabled
    const sidewinder = new Sidewinder({
      wsPort: wsPort,
      wsHost: 'localhost',
      sessionId: 'console-test',
      hooks: ['console', 'errors']
    });
    
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      serverPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables(),
        SIDEWINDER_WS_PORT: String(wsPort),
        SIDEWINDER_HOOKS: 'console,errors'
      }
    });
    
    activeProcesses.push(proc);
    
    // Wait for process to complete
    await new Promise((resolve) => {
      proc.on('exit', resolve);
      setTimeout(resolve, 2000);
    });
    
    // Should have captured console logs
    const hasInfoLog = logEvents.some(e => 
      e.data && e.data.includes && e.data.includes('Starting application')
    );
    const hasErrorLog = logEvents.some(e => 
      e.data && e.data.includes && e.data.includes('Test error message')
    );
    
    expect(logEvents.length).toBeGreaterThan(0);
    expect(hasInfoLog || hasErrorLog).toBe(true);
    
    await sidewinderServer.stop();
  }, 10000);
});

describe('Sidewinder Error Handling', () => {
  let portCounter = 200;
  
  it('should handle WebSocket connection failures gracefully', async () => {
    // Don't start a WebSocket server, try to connect
    const sidewinder = new Sidewinder({
      wsPort: 9999,  // Port with no server
      wsHost: 'localhost',
      sessionId: 'no-server-test'
    });
    
    const serverPath = path.join(__dirname, 'simple.js');
    fs.writeFileSync(serverPath, 'console.log("Test"); setTimeout(() => {}, 100);');
    
    // Should not crash even without WebSocket server
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      serverPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables(),
        SIDEWINDER_WS_PORT: '9999'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Process should still run and output
    expect(stdout).toContain('Test');
    
    proc.kill('SIGTERM');
    fs.unlinkSync(serverPath);
  });
  
  it('should handle malformed messages gracefully', async () => {
    const wsPort = 9800 + (portCounter++);
    const sidewinderServer = new SidewinderServer(wsPort);
    await sidewinderServer.start();
    
    const ws = new WebSocket(`ws://localhost:${wsPort}/sidewinder`);
    await new Promise(resolve => ws.once('open', resolve));
    
    // Send malformed messages
    ws.send('not json');
    ws.send('{"incomplete": ');
    ws.send(JSON.stringify({ no_type_field: true }));
    
    // Server should not crash
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(sidewinderServer.isListening).toBe(true);
    
    ws.close();
    await sidewinderServer.stop();
  });
});