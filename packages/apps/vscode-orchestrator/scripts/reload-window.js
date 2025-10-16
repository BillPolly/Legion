#!/usr/bin/env node
/**
 * Reload VSCode window via orchestrator
 */

import WebSocket from 'ws';

const PORT = 17892;

async function reloadWindow() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to VSCode Orchestrator at ws://localhost:${PORT}...`);

    const ws = new WebSocket(`ws://localhost:${PORT}`);

    ws.on('open', () => {
      console.log('✅ Connected!');

      const message = {
        id: Date.now(),
        cmd: 'executeCommand',
        args: {
          command: 'workbench.action.reloadWindow'
        }
      };

      console.log('📤 Sending reload command...');
      ws.send(JSON.stringify(message));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      console.log('📨 Response:', JSON.stringify(response, null, 2));
      ws.close();
      resolve(response);
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 Connection closed');
    });
  });
}

reloadWindow()
  .then(() => {
    console.log('✅ Reload command sent successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to reload window:', error);
    process.exit(1);
  });
