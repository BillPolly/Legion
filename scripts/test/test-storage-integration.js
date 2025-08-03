#!/usr/bin/env node

/**
 * Storage Integration Test
 * Tests the connection between storage browser and storage actor server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import WebSocket from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

// Configuration
const STORAGE_SERVER_PORT = process.env.STORAGE_ACTOR_PORT || 3700;
const STORAGE_SERVER_PATH = process.env.STORAGE_ACTOR_PATH || '/storage';
const STARTUP_DELAY = 3000;
const TEST_TIMEOUT = 30000;

let storageServerProcess;

function startStorageServer() {
  return new Promise((resolve, reject) => {
    console.log(`Starting Storage Actor Server on port ${STORAGE_SERVER_PORT}...`);
    
    const scriptPath = path.join(rootDir, 'scripts/server/start-storage-server.js');
    storageServerProcess = spawn('node', [scriptPath], {
      cwd: rootDir,
      stdio: 'pipe',
      env: { ...process.env }
    });
    
    storageServerProcess.stdout.on('data', (data) => {
      console.log(`[Storage Server] ${data.toString()}`);
      if (data.toString().includes('Storage Actor Server running')) {
        resolve();
      }
    });
    
    storageServerProcess.stderr.on('data', (data) => {
      console.error(`[Storage Server Error] ${data.toString()}`);
    });
    
    storageServerProcess.on('error', (error) => {
      console.error('Failed to start Storage Actor Server:', error);
      reject(error);
    });
    
    // Timeout if server doesn't start
    setTimeout(() => {
      reject(new Error('Storage server startup timeout'));
    }, STARTUP_DELAY * 2);
  });
}

function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    console.log('\nTesting WebSocket connection...');
    
    const ws = new WebSocket(`ws://localhost:${STORAGE_SERVER_PORT}${STORAGE_SERVER_PATH}`);
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket connection timeout'));
    }, 5000);
    
    ws.on('open', () => {
      console.log('✓ WebSocket connection established');
      clearTimeout(timeout);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('✓ Received message:', message.type);
      
      if (message.type === 'connected') {
        console.log('✓ Server handshake successful');
        
        // Test a simple request
        ws.send(JSON.stringify({
          type: 'request',
          id: 'test-1',
          actor: 'CollectionActor',
          method: 'listCollections',
          params: { provider: 'memory' }
        }));
      } else if (message.type === 'response') {
        console.log('✓ Received response:', message);
        ws.close();
        resolve();
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

async function runIntegrationTest() {
  console.log('========================================');
  console.log('Storage Integration Test');
  console.log('========================================\n');
  
  let testPassed = false;
  
  try {
    // Start storage server
    await startStorageServer();
    console.log('✓ Storage server started successfully\n');
    
    // Wait a moment for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test WebSocket connection
    await testWebSocketConnection();
    console.log('✓ WebSocket communication test passed\n');
    
    testPassed = true;
    
  } catch (error) {
    console.error('\n✗ Integration test failed:', error.message);
    testPassed = false;
  } finally {
    // Cleanup
    if (storageServerProcess) {
      console.log('\nStopping storage server...');
      storageServerProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise(resolve => {
        storageServerProcess.on('exit', resolve);
        setTimeout(resolve, 2000); // Fallback timeout
      });
    }
    
    console.log('\n========================================');
    if (testPassed) {
      console.log('✓ All integration tests passed!');
      console.log('========================================\n');
      process.exit(0);
    } else {
      console.log('✗ Integration tests failed');
      console.log('========================================\n');
      process.exit(1);
    }
  }
}

// Handle timeout
setTimeout(() => {
  console.error('\n✗ Test timeout exceeded');
  if (storageServerProcess) {
    storageServerProcess.kill('SIGKILL');
  }
  process.exit(1);
}, TEST_TIMEOUT);

// Run the test
runIntegrationTest();