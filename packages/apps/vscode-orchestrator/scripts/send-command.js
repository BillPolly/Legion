#!/usr/bin/env node

/**
 * Send any command to VSCode Orchestrator
 *
 * Usage: node send-command.js <command> [args-as-json]
 * Example: node send-command.js closeTab '{"column":2}'
 * Example: node send-command.js closeAllTabs
 * Example: node send-command.js openUrl '{"url":"https://example.com","column":2}'
 */

import WebSocket from 'ws';

const PORT = 17892;
const URL = `ws://localhost:${PORT}`;

// Get arguments
const cmd = process.argv[2];
const argsJson = process.argv[3];

if (!cmd) {
  console.error('Usage: node send-command.js <command> [args-as-json]');
  console.error('Example: node send-command.js closeTab \'{"column":2}\'');
  console.error('Example: node send-command.js closeAllTabs');
  process.exit(1);
}

let args = {};
if (argsJson) {
  try {
    args = JSON.parse(argsJson);
  } catch (e) {
    console.error('Error: Invalid JSON for args');
    process.exit(1);
  }
}

console.log(`\n🔌 Connecting to VSCode Orchestrator at ${URL}...`);

const ws = new WebSocket(URL);

ws.on('open', () => {
  console.log('✅ Connected!\n');

  console.log(`📤 Sending command: ${cmd}`);
  console.log(`   Args: ${JSON.stringify(args)}`);
  ws.send(JSON.stringify({ cmd, args }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log('📨 Response:', JSON.stringify(response, null, 2));

  if (response.ok) {
    console.log('\n✅ Success!');
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
