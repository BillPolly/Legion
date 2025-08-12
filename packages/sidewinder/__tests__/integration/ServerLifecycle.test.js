/**
 * Integration tests for server lifecycle tracking
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestServer } from '../utils/TestServer.js';
import { Sidewinder } from '../../src/index.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Server Lifecycle Tracking', () => {
  let testServer;
  let testDir;
  let portCounter = 12000;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'temp-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Start test WebSocket server
    testServer = new TestServer(0);
    await testServer.start();
  });

  afterEach(async () => {
    // Stop server
    if (testServer) {
      await testServer.stop();
    }

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should track HTTP server creation and listening', async () => {
    const serverPort = portCounter++;
    const scriptPath = path.join(testDir, 'http-server.js');
    
    // Create test server script
    const serverCode = `
const http = require('http');

console.log('Creating HTTP server...');
const server = http.createServer((req, res) => {
  res.end('OK');
});

server.listen(${serverPort}, () => {
  console.log('Server listening on port ${serverPort}');
  // Keep alive for 2 seconds then exit
  setTimeout(() => process.exit(0), 2000);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});
`;
    fs.writeFileSync(scriptPath, serverCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'http-lifecycle-test',
      profile: 'standard'
    });

    // Start process with Sidewinder injection
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      scriptPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables()
      },
      stdio: 'pipe'
    });

    global.cleanupProcesses.push(proc);

    // Wait for client to connect
    const clientInfo = await testServer.waitForClient();
    expect(clientInfo.sessionId).toBe('http-lifecycle-test');

    // Collect events
    const events = [];
    testServer.on('message', (data) => {
      events.push(data.message);
    });

    // Wait for process to complete
    await new Promise((resolve) => {
      proc.on('exit', resolve);
    });

    // Check for server lifecycle events
    const serverCreatedEvent = events.find(e => 
      e.type === 'server-lifecycle' && e.event === 'http-server-created'
    );
    const serverListeningEvent = events.find(e => 
      e.type === 'server-lifecycle' && e.event === 'server-listening'
    );

    expect(serverCreatedEvent).toBeDefined();
    expect(serverListeningEvent).toBeDefined();
    expect(serverListeningEvent.port).toBe(serverPort);
  });

  it('should track HTTPS server creation', async () => {
    const serverPort = portCounter++;
    const scriptPath = path.join(testDir, 'https-server.js');
    
    // Create test HTTPS server script
    const serverCode = `
const https = require('https');
const fs = require('fs');

// Create self-signed cert for testing
const options = {
  key: '-----BEGIN RSA PRIVATE KEY-----\\nMIICXAIBAAKBgQC7H5Hs\\n-----END RSA PRIVATE KEY-----',
  cert: '-----BEGIN CERTIFICATE-----\\nMIICATCCAWoCCQC\\n-----END CERTIFICATE-----'
};

console.log('Creating HTTPS server...');
const server = https.createServer(options, (req, res) => {
  res.end('Secure');
});

server.listen(${serverPort}, () => {
  console.log('HTTPS server listening on port ${serverPort}');
  setTimeout(() => process.exit(0), 2000);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});
`;
    fs.writeFileSync(scriptPath, serverCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'https-lifecycle-test',
      profile: 'standard'
    });

    // Start process with Sidewinder injection
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      scriptPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables()
      },
      stdio: 'pipe'
    });

    global.cleanupProcesses.push(proc);

    // Wait for client to connect
    await testServer.waitForClient();

    // Collect events
    const events = [];
    testServer.on('message', (data) => {
      events.push(data.message);
    });

    // Wait for process to complete
    await new Promise((resolve) => {
      proc.on('exit', resolve);
    });

    // Check for HTTPS server events
    const httpsCreatedEvent = events.find(e => 
      e.type === 'server-lifecycle' && e.event === 'https-server-created'
    );

    expect(httpsCreatedEvent).toBeDefined();
  });

  it('should track server errors', async () => {
    const scriptPath = path.join(testDir, 'failing-server.js');
    
    // Create server that will fail to bind
    const serverCode = `
const http = require('http');

console.log('Creating server that will fail...');
const server = http.createServer((req, res) => {
  res.end('Should not work');
});

// Try to listen on privileged port (will fail without sudo)
server.listen(80, () => {
  console.log('This should not print');
});

server.on('error', (err) => {
  console.error('Expected error:', err.message);
  process.exit(1);
});
`;
    fs.writeFileSync(scriptPath, serverCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'error-test',
      profile: 'standard'
    });

    // Start process with Sidewinder injection
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      scriptPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables()
      },
      stdio: 'pipe'
    });

    global.cleanupProcesses.push(proc);

    // Wait for client to connect
    await testServer.waitForClient();

    // Collect events
    const events = [];
    testServer.on('message', (data) => {
      events.push(data.message);
    });

    // Wait for process to exit
    await new Promise((resolve) => {
      proc.on('exit', resolve);
    });

    // Check for error events
    const serverErrorEvent = events.find(e => 
      e.type === 'server-lifecycle' && 
      (e.event === 'server-error' || e.event === 'server-listen-error')
    );

    expect(serverErrorEvent).toBeDefined();
    if (serverErrorEvent) {
      expect(serverErrorEvent.error).toBeDefined();
      expect(serverErrorEvent.error.message).toMatch(/EACCES|permission/i);
    }
  });

  it('should track multiple servers in same process', async () => {
    const port1 = portCounter++;
    const port2 = portCounter++;
    const scriptPath = path.join(testDir, 'multi-server.js');
    
    // Create script with multiple servers
    const serverCode = `
const http = require('http');

console.log('Creating multiple servers...');

const server1 = http.createServer((req, res) => {
  res.end('Server 1');
});

const server2 = http.createServer((req, res) => {
  res.end('Server 2');
});

server1.listen(${port1}, () => {
  console.log('Server 1 listening on port ${port1}');
});

server2.listen(${port2}, () => {
  console.log('Server 2 listening on port ${port2}');
  // Exit after both are listening
  setTimeout(() => process.exit(0), 1000);
});
`;
    fs.writeFileSync(scriptPath, serverCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'multi-server-test',
      profile: 'standard'
    });

    // Start process with Sidewinder injection
    const proc = spawn('node', [
      '--require', sidewinder.getInjectPath(),
      scriptPath
    ], {
      env: {
        ...process.env,
        ...sidewinder.getEnvironmentVariables()
      },
      stdio: 'pipe'
    });

    global.cleanupProcesses.push(proc);

    // Wait for client to connect
    await testServer.waitForClient();

    // Collect events
    const events = [];
    testServer.on('message', (data) => {
      events.push(data.message);
    });

    // Wait for process to complete
    await new Promise((resolve) => {
      proc.on('exit', resolve);
    });

    // Check for multiple server events
    const serverCreatedEvents = events.filter(e => 
      e.type === 'server-lifecycle' && e.event === 'http-server-created'
    );
    const serverListeningEvents = events.filter(e => 
      e.type === 'server-lifecycle' && e.event === 'server-listening'
    );

    expect(serverCreatedEvents.length).toBe(2);
    expect(serverListeningEvents.length).toBe(2);
    
    // Check both ports are tracked
    const ports = serverListeningEvents.map(e => e.port).sort();
    expect(ports).toEqual([port1, port2]);
  });
});