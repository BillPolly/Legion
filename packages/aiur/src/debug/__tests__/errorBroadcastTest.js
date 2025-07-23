#!/usr/bin/env node

/**
 * Test script to verify error broadcasting works correctly
 * 
 * This script triggers various types of errors to test that they are
 * properly captured and broadcast to the debug interface.
 */

import { spawn } from 'child_process';
import WebSocket from 'ws';

console.log('🧪 Testing Error Broadcasting System...\n');

// Start the Aiur server
console.log('Starting Aiur MCP server...');
const aiurProcess = spawn('node', ['src/index.js'], {
  cwd: '/Users/maxximus/Documents/max/pocs/Legion/packages/aiur',
  stdio: ['pipe', 'pipe', 'pipe']
});

// Wait for server to start
await new Promise(resolve => setTimeout(resolve, 2000));

// Connect to debug interface via WebSocket
console.log('Connecting to debug interface...');
const ws = new WebSocket('ws://localhost:3001/ws');

const errors = [];
let debugStarted = false;

ws.on('open', () => {
  console.log('✅ Connected to debug interface');
  
  // Subscribe to all events
  ws.send(JSON.stringify({
    type: 'subscribe',
    data: { events: ['error', 'tool-executed'] }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'error' || (message.type === 'event' && message.data?.errorType)) {
    console.log('📥 Received error:', message.data);
    errors.push(message);
  }
  
  if (message.type === 'tool-result' && message.data?.success) {
    if (message.data.result?.content?.[0]?.text?.includes('started successfully')) {
      debugStarted = true;
    }
  }
});

// Helper to send MCP commands
function sendMCPCommand(method, params) {
  const command = JSON.stringify({
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  }) + '\n';
  
  aiurProcess.stdin.write(command);
}

// Wait for connection
await new Promise(resolve => setTimeout(resolve, 1000));

console.log('\n📋 Running error tests...\n');

// Test 1: Start debug interface
console.log('1. Starting debug interface...');
sendMCPCommand('tools/call', {
  name: 'web_debug_start',
  arguments: { port: 3001, openBrowser: false }
});

await new Promise(resolve => setTimeout(resolve, 2000));

if (!debugStarted) {
  console.log('⚠️  Debug interface may not have started properly');
}

// Test 2: Call unknown tool
console.log('2. Testing unknown tool error...');
sendMCPCommand('tools/call', {
  name: 'unknown_tool_that_does_not_exist',
  arguments: {}
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Test 3: Invalid parameters
console.log('3. Testing invalid parameters error...');
sendMCPCommand('tools/call', {
  name: 'context_add',
  arguments: {
    // Missing required 'name' parameter
    data: { test: 'data' }
  }
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Test 4: Tool execution error
console.log('4. Testing tool execution error...');
sendMCPCommand('tools/call', {
  name: 'context_get',
  arguments: {
    name: '@nonexistent_handle_reference'
  }
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Test 5: Force uncaught exception (if we can)
console.log('5. Testing system error by invalid MCP message...');
aiurProcess.stdin.write('{ invalid json }\n');

await new Promise(resolve => setTimeout(resolve, 2000));

// Check results
console.log('\n📊 Test Results:\n');
console.log(`Total errors captured: ${errors.length}`);

if (errors.length > 0) {
  console.log('\nError types captured:');
  const errorTypes = new Set(errors.map(e => e.data?.errorType || 'unknown'));
  errorTypes.forEach(type => {
    const count = errors.filter(e => (e.data?.errorType || 'unknown') === type).length;
    console.log(`  - ${type}: ${count}`);
  });
  
  console.log('\n✅ Error broadcasting is working! Errors are being captured and sent to debug clients.');
} else {
  console.log('\n❌ No errors were captured. Error broadcasting may not be working properly.');
}

// Cleanup
console.log('\n🧹 Cleaning up...');
ws.close();
aiurProcess.kill();

process.exit(errors.length > 0 ? 0 : 1);