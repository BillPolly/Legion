#!/usr/bin/env node
/**
 * Stop screen recording
 * Connects to the recording WebSocket server and sends stop command
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:9999';

console.log('🛑 Stopping screen recording...');
console.log(`🔌 Connecting to ${WS_URL}...`);

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ Connected to recording server');
  console.log('📤 Sending stop command...');
  ws.send('stop');
});

ws.on('message', (data) => {
  const message = data.toString();

  if (message === 'done') {
    console.log('✅ Recording stopped successfully!');
    console.log('📁 Video saved to: demo-recording.mp4');
    ws.close();
    process.exit(0);
  }
});

ws.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  console.error('   Make sure start-recording.js is running');
  process.exit(1);
});

ws.on('close', () => {
  // Only exit with error if we didn't get the 'done' message
  setTimeout(() => {
    console.error('❌ Connection closed without confirmation');
    process.exit(1);
  }, 100);
});
