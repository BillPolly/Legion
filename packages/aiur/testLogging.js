#!/usr/bin/env node

/**
 * Test script to verify file logging is working
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Testing File Logging System...\n');

// Start the Aiur server
console.log('Starting Aiur MCP server...');
const aiurProcess = spawn('node', ['src/index.js'], {
  cwd: '/Users/maxximus/Documents/max/pocs/Legion/packages/aiur',
  stdio: ['pipe', 'pipe', 'pipe']
});

// Capture output
aiurProcess.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

// Wait for server to start
await new Promise(resolve => setTimeout(resolve, 2000));

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

console.log('\n📋 Running error tests to generate logs...\n');

// Test 1: Call unknown tool
console.log('1. Testing unknown tool error...');
sendMCPCommand('tools/call', {
  name: 'unknown_tool_that_does_not_exist',
  arguments: {}
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Test 2: Invalid parameters
console.log('2. Testing invalid parameters error...');
sendMCPCommand('tools/call', {
  name: 'context_add',
  arguments: {
    // Missing required 'name' parameter
    data: { test: 'data' }
  }
});

await new Promise(resolve => setTimeout(resolve, 1000));

// Test 3: Force a critical error
console.log('3. Testing critical error...');
sendMCPCommand('tools/call', {
  name: 'web_debug_start',
  arguments: {
    port: -1  // Invalid port
  }
});

await new Promise(resolve => setTimeout(resolve, 2000));

// Check if log file was created
console.log('\n📁 Checking log files...\n');

const logDir = path.join(process.cwd(), 'logs');
const today = new Date().toISOString().split('T')[0];
const logFile = path.join(logDir, `aiur-errors-${today}.log`);

try {
  const exists = await fs.access(logFile).then(() => true).catch(() => false);
  
  if (exists) {
    console.log('✅ Log file created:', logFile);
    
    // Read last few lines
    const content = await fs.readFile(logFile, 'utf8');
    const lines = content.trim().split('\n').filter(line => line);
    
    console.log(`\n📄 Log file contains ${lines.length} entries`);
    console.log('\nLast 5 log entries:');
    
    const lastFive = lines.slice(-5);
    for (const line of lastFive) {
      try {
        const log = JSON.parse(line);
        console.log(`  [${log.level}] ${log.timestamp}: ${log.message}`);
      } catch {
        console.log('  [INVALID]', line);
      }
    }
    
    // Now test the log reader tool
    console.log('\n📖 Testing log reader tool...\n');
    
    sendMCPCommand('tools/call', {
      name: 'read_logs',
      arguments: {
        limit: 5,
        level: 'error'
      }
    });
    
    // Capture response
    let responseReceived = false;
    aiurProcess.stdout.on('data', (data) => {
      const response = data.toString();
      if (response.includes('read_logs')) {
        responseReceived = true;
        console.log('✅ Log reader tool response received');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!responseReceived) {
      console.log('⚠️  Log reader tool may not be available');
    }
    
  } else {
    console.log('❌ Log file not found:', logFile);
  }
  
} catch (error) {
  console.error('Error checking logs:', error);
}

// Cleanup
console.log('\n🧹 Cleaning up...');
aiurProcess.kill();

process.exit(0);