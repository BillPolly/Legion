#!/usr/bin/env node

/**
 * Create a file and write code to it
 *
 * Usage: node create-file.js <filename> <code>
 * Example: node create-file.js "demo.js" "console.log('hello');"
 */

import WebSocket from 'ws';

const PORT = 17892;
const URL = `ws://localhost:${PORT}`;

// Get arguments
const filename = process.argv[2];
// Convert escaped newlines (\n) to actual newlines
const code = process.argv[3]?.replace(/\\n/g, '\n');

if (!filename || !code) {
  console.error('Usage: node create-file.js <filename> <code>');
  console.error('Example: node create-file.js "demo.js" "console.log(\'hello\');"');
  process.exit(1);
}

console.log(`\n🔌 Connecting to VSCode Orchestrator at ${URL}...`);

const ws = new WebSocket(URL);

let step = 0;

ws.on('open', async () => {
  console.log('✅ Connected!\n');

  // Step 1: Open the file (creates if doesn't exist)
  step = 1;
  console.log(`📝 Step 1: Opening/creating file: ${filename}`);
  ws.send(JSON.stringify({
    cmd: 'open',
    args: { file: filename, column: 1, create: true }
  }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());
  console.log(`📨 Response ${step}:`, JSON.stringify(response, null, 2));

  if (step === 1 && response.ok) {
    // Step 2: Type the code
    step = 2;
    console.log('\n⌨️  Step 2: Writing code...');
    ws.send(JSON.stringify({
      cmd: 'type',
      args: { text: code, cps: 100 }
    }));
  } else if (step === 2 && response.ok) {
    // Step 3: Save the file
    step = 3;
    console.log('\n💾 Step 3: Saving file...');
    ws.send(JSON.stringify({
      cmd: 'save',
      args: {}
    }));
  } else if (step === 3 && response.ok) {
    console.log(`\n✅ Success! File ${filename} created and saved!`);
    ws.close();
    process.exit(0);
  } else if (!response.ok) {
    console.error('\n❌ Error:', response.error);
    ws.close();
    process.exit(1);
  }
});

ws.on('error', (error) => {
  console.error('\n❌ Connection error:', error.message);
  console.error('Make sure VSCode is running with the Orchestrator extension active.');
  process.exit(1);
});

ws.on('close', () => {
  if (step < 3) {
    console.log('\n⚠️  Connection closed unexpectedly');
    process.exit(1);
  }
});
