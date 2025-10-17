#!/usr/bin/env node

/**
 * Open a URL in VSCode webview
 *
 * Usage: node open-url.js <url> [column]
 * Example: node open-url.js "https://example.com" 2
 */

import WebSocket from 'ws';

const PORT = 17892;
const URL = `ws://localhost:${PORT}`;

// Get arguments
const url = process.argv[2];
const column = parseInt(process.argv[3]) || 2;

if (!url) {
  console.error('Usage: node open-url.js <url> [column]');
  console.error('Example: node open-url.js "https://example.com" 2');
  process.exit(1);
}

console.log(`\n🔌 Connecting to VSCode Orchestrator at ${URL}...`);

const ws = new WebSocket(URL);

ws.on('open', () => {
  console.log('✅ Connected!\n');

  console.log(`📤 Opening URL: ${url} in column ${column}`);
  ws.send(JSON.stringify({
    cmd: 'openUrl',
    args: { url, column }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log('📨 Response:', JSON.stringify(response, null, 2));

  if (response.ok) {
    console.log('\n✅ Success! URL opened in VSCode webview.');
  } else {
    console.error('\n❌ Error:', response.error);
  }

  ws.close();
  process.exit(response.ok ? 0 : 1);
});

ws.on('error', (error) => {
  console.error('\n❌ Connection error:', error.message);
  console.error('Make sure VSCode is running with the Orchestrator extension active.');
  process.exit(1);
});
