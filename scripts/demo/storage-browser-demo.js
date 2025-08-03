#!/usr/bin/env node

/**
 * Storage Browser Demo Launcher
 * Starts both the storage actor server and the storage browser demo
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '../..');

// Configuration
const STORAGE_SERVER_PORT = process.env.STORAGE_ACTOR_PORT || 3700;
const DEMO_SERVER_PORT = process.env.STORAGE_BROWSER_PORT || 3601;
const STARTUP_DELAY = 2000; // Time to wait for storage server to start

let storageServerProcess;
let demoServerProcess;

function startStorageServer() {
  return new Promise((resolve, reject) => {
    console.log(`Starting Storage Actor Server on port ${STORAGE_SERVER_PORT}...`);
    
    const scriptPath = path.join(rootDir, 'scripts/server/start-storage-server.js');
    storageServerProcess = spawn('node', [scriptPath], {
      cwd: rootDir,
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    storageServerProcess.on('error', (error) => {
      console.error('Failed to start Storage Actor Server:', error);
      reject(error);
    });
    
    // Give the server time to start
    setTimeout(() => {
      console.log('Storage Actor Server should be running');
      resolve();
    }, STARTUP_DELAY);
  });
}

function startDemoServer() {
  return new Promise((resolve, reject) => {
    console.log(`Starting Storage Browser Demo on port ${DEMO_SERVER_PORT}...`);
    
    const demoPath = path.join(rootDir, 'packages/frontend/storage-browser');
    demoServerProcess = spawn('npm', ['start'], {
      cwd: demoPath,
      stdio: 'inherit',
      env: { ...process.env, PORT: DEMO_SERVER_PORT }
    });
    
    demoServerProcess.on('error', (error) => {
      console.error('Failed to start demo server:', error);
      reject(error);
    });
    
    setTimeout(() => {
      console.log(`\n========================================`);
      console.log(`Storage Browser Demo is ready!`);
      console.log(`========================================`);
      console.log(`Demo UI: http://localhost:${DEMO_SERVER_PORT}`);
      console.log(`Storage Server: ws://localhost:${STORAGE_SERVER_PORT}/storage`);
      console.log(`\nPress Ctrl+C to stop both servers`);
      console.log(`========================================\n`);
      resolve();
    }, STARTUP_DELAY);
  });
}

async function startDemo() {
  try {
    // Start storage server first
    await startStorageServer();
    
    // Then start demo server
    await startDemoServer();
    
  } catch (error) {
    console.error('Failed to start demo:', error);
    cleanup();
    process.exit(1);
  }
}

function cleanup() {
  console.log('\nStopping servers...');
  
  if (storageServerProcess) {
    storageServerProcess.kill('SIGTERM');
  }
  
  if (demoServerProcess) {
    demoServerProcess.kill('SIGTERM');
  }
  
  // Force kill after timeout
  setTimeout(() => {
    if (storageServerProcess) {
      storageServerProcess.kill('SIGKILL');
    }
    if (demoServerProcess) {
      demoServerProcess.kill('SIGKILL');
    }
    process.exit(0);
  }, 3000);
}

// Handle shutdown signals
process.on('SIGINT', () => {
  cleanup();
});

process.on('SIGTERM', () => {
  cleanup();
});

// Start the demo
startDemo();