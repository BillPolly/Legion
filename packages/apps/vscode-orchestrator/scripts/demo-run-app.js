#!/usr/bin/env node
/**
 * Demo: Run and show the Multi-Agent Research System
 * Opens the dashboard and demonstrates it working
 */

import WebSocket from 'ws';

const PORT = 17892;
const URL = `ws://localhost:${PORT}`;

// Helper to send command and wait for response
function sendCommand(ws, cmd, args) {
  return new Promise((resolve, reject) => {
    const id = Date.now() + Math.random();
    const timeout = setTimeout(() => reject(new Error('Command timeout')), 30000);

    const handler = (data) => {
      const response = JSON.parse(data.toString());
      if (response.id === id || !response.id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Command failed'));
        }
      }
    };

    ws.on('message', handler);
    ws.send(JSON.stringify({ id, cmd, args }));
  });
}

// Helper to show flashcard
async function showFlashcard(ws, title, subtitle, duration = 3000) {
  console.log(`\n📌 ${title}`);
  console.log(`   ${subtitle}`);
  await sendCommand(ws, 'showFlashcard', { title, subtitle, column: 3 });
  await new Promise(resolve => setTimeout(resolve, duration));
}

async function runDemo() {
  const ws = new WebSocket(URL);

  await new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });

  console.log('🎬 Starting Application Demo...\n');

  try {
    // Show running the app
    await showFlashcard(ws,
      '🚀 Running the Application',
      'Starting HTTP and WebSocket servers...',
      3000
    );

    // Open the dashboard
    console.log('\n🌐 Opening dashboard in VSCode webview...');
    await sendCommand(ws, 'openUrl', { url: 'http://localhost:8000', column: 2 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show it's ready
    await showFlashcard(ws,
      '✨ Dashboard Ready!',
      'Multi-agent research system is live at http://localhost:8000',
      3000
    );

    await sendCommand(ws, 'closeFlashcard', {});

    console.log('\n✅ Application demo complete!');
    console.log('Dashboard is now open and ready for research queries.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    ws.close();
    process.exit(0);
  }
}

runDemo().catch(console.error);
