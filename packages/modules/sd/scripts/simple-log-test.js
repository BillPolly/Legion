#!/usr/bin/env node

/**
 * Simple test to verify basic log capture without the full LiveTestingAgent wrapper
 */

import { spawn } from 'child_process';
import { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';

async function simpleLogTest() {
  console.log('🔍 Simple Log Capture Test\n');
  
  const projectPath = `/tmp/simple-log-test-${Date.now()}`;
  const port = 5555;
  const logPort = 6555;
  
  // Create test app
  console.log('Creating test app...');
  await fs.mkdir(projectPath, { recursive: true });
  
  // Simple Express app with logging
  const appCode = `
const express = require('express');
const app = express();

console.log('[START] Server starting...');

app.use((req, res, next) => {
  console.log(\`[REQUEST] \${req.method} \${req.path}\`);
  next();
});

app.get('/', (req, res) => {
  console.log('[HANDLER] Serving homepage');
  res.send('Hello World');
});

app.listen(${port}, () => {
  console.log('[READY] Server listening on port ${port}');
});

// Also start a WebSocket server for log streaming
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ port: ${logPort} });
const logs = [];

// Override console to capture logs
const originalConsole = { log: console.log, error: console.error };
console.log = (...args) => {
  const message = args.join(' ');
  logs.push({ type: 'log', message, timestamp: Date.now() });
  originalConsole.log(...args);
};
console.error = (...args) => {
  const message = args.join(' ');
  logs.push({ type: 'error', message, timestamp: Date.now() });
  originalConsole.error(...args);
};

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  // Send buffered logs
  ws.send(JSON.stringify({ type: 'logs', data: logs }));
  
  // Send new logs periodically
  const interval = setInterval(() => {
    if (logs.length > 0) {
      ws.send(JSON.stringify({ type: 'logs', data: logs.splice(0) }));
    }
  }, 100);
  
  ws.on('close', () => {
    clearInterval(interval);
    console.log('[WS] Client disconnected');
  });
});

console.log('[WS] Log WebSocket server on port ${logPort}');
`;

  await fs.writeFile(`${projectPath}/app.js`, appCode);
  
  // Write package.json
  await fs.writeFile(`${projectPath}/package.json`, JSON.stringify({
    name: 'simple-log-test',
    dependencies: {
      express: '^4.18.0',
      ws: '^8.0.0'
    }
  }));
  
  // Install dependencies
  console.log('Installing dependencies...');
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    await execAsync('npm install', { cwd: projectPath });
    console.log('✅ Dependencies installed\n');
  } catch (error) {
    console.log('⚠️  Could not install dependencies\n');
  }
  
  // Start the app directly
  console.log('Starting app...');
  const appProcess = spawn('node', ['app.js'], {
    cwd: projectPath,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Capture output
  appProcess.stdout.on('data', (data) => {
    console.log(`[APP OUT] ${data.toString().trim()}`);
  });
  
  appProcess.stderr.on('data', (data) => {
    console.log(`[APP ERR] ${data.toString().trim()}`);
  });
  
  // Wait for app to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Connect to log WebSocket
  console.log('\nConnecting to log WebSocket...');
  const capturedLogs = [];
  
  try {
    const ws = new WebSocket(`ws://localhost:${logPort}`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Connected to log stream\n');
        resolve();
      });
      
      ws.on('message', (data) => {
        const logData = JSON.parse(data.toString());
        if (logData.type === 'logs' && logData.data) {
          logData.data.forEach(log => {
            capturedLogs.push(log);
            console.log(`  [CAPTURED] ${log.type}: ${log.message}`);
          });
        }
      });
      
      ws.on('error', reject);
      
      setTimeout(resolve, 2000);
    });
    
    // Test the API
    console.log('\nTesting API...');
    const response = await fetch(`http://localhost:${port}/`);
    console.log(`Response status: ${response.status}`);
    const text = await response.text();
    console.log(`Response body: ${text}`);
    
    // Wait for logs
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    ws.close();
  } catch (error) {
    console.error('WebSocket error:', error.message);
  }
  
  // Results
  console.log('\n📊 Results:');
  console.log(`  Logs captured: ${capturedLogs.length}`);
  console.log(`  Log types: ${JSON.stringify(
    capturedLogs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {})
  )}`);
  
  // Check for specific logs
  const hasStartLog = capturedLogs.some(l => l.message.includes('[START]'));
  const hasReadyLog = capturedLogs.some(l => l.message.includes('[READY]'));
  const hasRequestLog = capturedLogs.some(l => l.message.includes('[REQUEST]'));
  
  console.log(`\n  Start log: ${hasStartLog ? '✅' : '❌'}`);
  console.log(`  Ready log: ${hasReadyLog ? '✅' : '❌'}`);
  console.log(`  Request log: ${hasRequestLog ? '✅' : '❌'}`);
  
  // Kill the app
  appProcess.kill();
  
  console.log('\n✅ Test complete');
}

simpleLogTest().catch(console.error);