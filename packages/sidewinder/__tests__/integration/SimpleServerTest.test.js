/**
 * Simple server lifecycle test to debug issues
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

describe('Simple Server Test', () => {
  let testServer;
  let testDir;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(__dirname, 'temp-simple-test');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Start test WebSocket server
    testServer = new TestServer(0);
    await testServer.start();
    console.log(`Test server listening on port ${testServer.port}`);
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

  it('should capture basic console messages', async () => {
    const scriptPath = path.join(testDir, 'console-test.js');
    
    // Create simple console test script
    const scriptCode = `
console.log('Test message 1');
console.error('Test error message');
console.log('Test message 2');

setTimeout(() => {
  console.log('Final message');
  process.exit(0);
}, 500);
`;
    fs.writeFileSync(scriptPath, scriptCode);

    // Configure Sidewinder
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'console-test',
      profile: 'minimal',
      debug: true
    });

    console.log('Starting process with env:', sidewinder.getEnvironmentVariables());

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

    // Capture stdout/stderr for debugging
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    try {
      // Wait for client to connect with a reasonable timeout
      const clientInfo = await Promise.race([
        testServer.waitForClient(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Client connection timeout')), 5000)
        )
      ]);
      
      console.log('Client connected:', clientInfo);
      expect(clientInfo.sessionId).toBe('console-test');

      // Collect events
      const events = [];
      testServer.on('message', (data) => {
        console.log('Received event:', data.message.type, data.message.subtype || '');
        events.push(data.message);
      });

      // Wait for process to complete
      await new Promise((resolve) => {
        proc.on('exit', (code) => {
          console.log(`Process exited with code: ${code}`);
          resolve();
        });
      });

      console.log('Process stdout:', stdout);
      console.log('Process stderr:', stderr);
      console.log('Received events:', events.map(e => ({ type: e.type, subtype: e.subtype })));

      // Check for console events
      const consoleEvents = events.filter(e => e.type === 'console');
      expect(consoleEvents.length).toBeGreaterThan(0);

    } catch (error) {
      console.log('Process stdout:', stdout);
      console.log('Process stderr:', stderr);
      throw error;
    }
  });

  it('should capture server lifecycle events', async () => {
    const scriptPath = path.join(testDir, 'server-test.js');
    
    // Create simple server test script
    const scriptCode = `
const http = require('http');

console.log('About to create server...');

const server = http.createServer((req, res) => {
  res.end('OK');
});

console.log('Server created, about to listen...');

server.listen(13001, () => {
  console.log('Server listening on port 13001');
  setTimeout(() => {
    console.log('Shutting down...');
    process.exit(0);
  }, 1000);
});

server.on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});
`;
    fs.writeFileSync(scriptPath, scriptCode);

    // Configure Sidewinder with debug
    const sidewinder = new Sidewinder({
      wsPort: testServer.port,
      wsHost: 'localhost',
      sessionId: 'server-test',
      profile: 'standard',
      debug: true
    });

    console.log('Starting server test process...');

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

    // Capture stdout/stderr for debugging
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    try {
      // Wait for client to connect
      const clientInfo = await testServer.waitForClient();
      console.log('Server test client connected:', clientInfo);
      
      // Collect events
      const events = [];
      testServer.on('message', (data) => {
        console.log('Server test received:', data.message.type, data.message.event || data.message.method || '');
        events.push(data.message);
      });

      // Wait for process to complete
      await new Promise((resolve) => {
        proc.on('exit', (code) => {
          console.log(`Server test process exited with code: ${code}`);
          resolve();
        });
      });

      console.log('Server test stdout:', stdout);
      console.log('Server test stderr:', stderr);
      console.log('Server test events:', events.map(e => ({ 
        type: e.type, 
        event: e.event, 
        method: e.method 
      })));

      // Check for server lifecycle events
      const serverLifecycleEvents = events.filter(e => e.type === 'server-lifecycle');
      const serverCreatedEvent = serverLifecycleEvents.find(e => e.event === 'http-server-created');
      const serverListeningEvent = serverLifecycleEvents.find(e => e.event === 'server-listening');
      
      console.log('Found server lifecycle events:', serverLifecycleEvents.length);
      console.log('Server created event:', !!serverCreatedEvent);
      console.log('Server listening event:', !!serverListeningEvent);

      expect(serverCreatedEvent).toBeDefined();
      expect(serverListeningEvent).toBeDefined();
      expect(serverListeningEvent.port).toBe(13001);

    } catch (error) {
      console.log('Server test stdout:', stdout);
      console.log('Server test stderr:', stderr);
      throw error;
    }
  });
}, 20000); // 20 second timeout for this describe block