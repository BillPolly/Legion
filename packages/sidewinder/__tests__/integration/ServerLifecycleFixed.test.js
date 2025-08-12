/**
 * Fixed server lifecycle tests that properly wait for events
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

describe('Fixed Server Lifecycle Tracking', () => {
  let testServer;
  let testDir;
  let portCounter = 14000;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'temp-fixed-test');
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

  it('should capture server lifecycle events properly', async () => {
    const serverPort = portCounter++;
    const scriptPath = path.join(testDir, 'lifecycle-server.js');
    
    // Create a server script that waits a bit before creating server
    const serverCode = `
// Wait a moment to ensure WebSocket connection is stable
setTimeout(() => {
  console.log('Starting server creation...');
  
  const http = require('http');
  
  console.log('About to create HTTP server');
  const server = http.createServer((req, res) => {
    res.end('Hello from test server');
  });
  
  console.log('Server created, about to listen');
  server.listen(${serverPort}, () => {
    console.log('Server is now listening on port ${serverPort}');
    
    // Keep server running for a moment, then exit
    setTimeout(() => {
      console.log('Server shutting down');
      process.exit(0);
    }, 2000);
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err.message);
    process.exit(1);
  });
}, 1000); // Wait 1 second for WebSocket to stabilize
`;
    
    fs.writeFileSync(scriptPath, serverCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'fixed-lifecycle-test',
      profile: 'standard',
      debug: false  // Reduce noise
    });

    // Collect all events
    const allEvents = [];
    testServer.on('message', (data) => {
      allEvents.push(data.message);
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

    try {
      // Wait for client to connect first
      const clientInfo = await testServer.waitForClient(5000);
      expect(clientInfo.sessionId).toBe('fixed-lifecycle-test');

      // Use the waitForEvent utility to wait for specific server lifecycle events
      const serverCreatedPromise = testServer.waitForEvent('server-lifecycle', 8000);
      
      // Also wait for the process to complete
      const processCompletePromise = new Promise((resolve) => {
        proc.on('exit', resolve);
      });

      // Wait for either the server lifecycle event or process completion
      const serverCreatedEvent = await Promise.race([
        serverCreatedPromise,
        processCompletePromise.then(() => null) // Return null if process completes first
      ]);

      // Wait for process to fully complete
      await processCompletePromise;

      // Give a moment for final events to arrive
      await new Promise(resolve => setTimeout(resolve, 500));

      // Now check all the events we received
      console.log('All events received:', allEvents.map(e => ({ 
        type: e.type, 
        event: e.event,
        timestamp: e.timestamp 
      })));

      // Filter for server lifecycle events
      const serverLifecycleEvents = allEvents.filter(e => e.type === 'server-lifecycle');
      
      console.log('Server lifecycle events:', serverLifecycleEvents.map(e => ({
        event: e.event,
        port: e.port,
        timestamp: e.timestamp
      })));

      // We should have received server lifecycle events
      expect(serverLifecycleEvents.length).toBeGreaterThan(0);
      
      // Check for specific events
      const serverCreated = serverLifecycleEvents.find(e => e.event === 'http-server-created');
      const serverListening = serverLifecycleEvents.find(e => e.event === 'server-listening');
      
      expect(serverCreated).toBeDefined();
      expect(serverListening).toBeDefined();
      expect(serverListening.port).toBe(serverPort);

    } catch (error) {
      console.log('Test failed, here are all events we got:', allEvents.map(e => ({ 
        type: e.type, 
        event: e.event 
      })));
      throw error;
    }
  });

  it('should queue and flush server lifecycle events during WebSocket reconnection', async () => {
    const serverPort = portCounter++;
    const scriptPath = path.join(testDir, 'reconnect-server.js');
    
    // Create a server that creates the HTTP server very early (potentially before WebSocket connects)
    const serverCode = `
const http = require('http');

// Create server immediately - this should get queued if WebSocket isn't ready
console.log('Creating server immediately...');
const server = http.createServer((req, res) => {
  res.end('Immediate server');
});

server.listen(${serverPort}, () => {
  console.log('Immediate server listening on ${serverPort}');
  setTimeout(() => process.exit(0), 1500);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
`;
    
    fs.writeFileSync(scriptPath, serverCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'reconnect-test',
      profile: 'standard',
      debug: false
    });

    // Collect all events
    const allEvents = [];
    testServer.on('message', (data) => {
      allEvents.push(data.message);
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

    try {
      // Wait for client to connect (may take a moment due to reconnection)
      const clientInfo = await testServer.waitForClient(8000);
      expect(clientInfo.sessionId).toBe('reconnect-test');

      // Wait for process to complete
      await new Promise((resolve) => {
        proc.on('exit', resolve);
      });

      // Give extra time for any queued messages to be flushed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check the events
      console.log('Reconnect test events:', allEvents.map(e => ({ 
        type: e.type, 
        event: e.event 
      })));

      const serverLifecycleEvents = allEvents.filter(e => e.type === 'server-lifecycle');
      
      // Even with reconnection, we should eventually get the lifecycle events
      expect(serverLifecycleEvents.length).toBeGreaterThan(0);
      
      const serverCreated = serverLifecycleEvents.find(e => e.event === 'http-server-created');
      const serverListening = serverLifecycleEvents.find(e => e.event === 'server-listening');
      
      expect(serverCreated).toBeDefined();
      expect(serverListening).toBeDefined();
      expect(serverListening.port).toBe(serverPort);

    } catch (error) {
      console.log('Reconnect test failed, events received:', allEvents.map(e => ({ 
        type: e.type, 
        event: e.event 
      })));
      throw error;
    }
  });
}, 25000); // 25 second timeout for the whole describe block