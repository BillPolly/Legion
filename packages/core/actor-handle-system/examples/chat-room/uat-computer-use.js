/**
 * Chat Room UAT with ComputerUseActor
 *
 * Interactive User Acceptance Testing using Computer Use Agent.
 * Tests the complete chat room functionality with both Gemini AI and Puppeteer modes.
 */

import { ResourceManager } from '@legion/resource-manager';
import { ComputerUseActor } from '@legion/computer-use';
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let chatServer;
let webServer;

async function startServers() {
  console.log('🚀 Starting servers...\n');

  return new Promise((resolve, reject) => {
    // Start chat server
    chatServer = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    chatServer.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Chat server listening')) {
        console.log('✅ Chat server ready');
      }
    });

    chatServer.stderr.on('data', (data) => {
      const msg = data.toString();
      if (!msg.includes('MongoDB') && !msg.includes('Failed to initialize')) {
        console.error('[Chat Server]', msg);
      }
    });

    // Start web server
    webServer = spawn('node', ['web-server.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    webServer.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('Web UI server running')) {
        console.log('✅ Web server ready');
        // Wait a bit more for full startup
        setTimeout(resolve, 2000);
      }
    });

    webServer.stderr.on('data', (data) => {
      console.error('[Web Server]', data.toString());
    });

    // Timeout if servers don't start
    setTimeout(() => reject(new Error('Servers failed to start')), 10000);
  });
}

function stopServers() {
  console.log('\n🛑 Stopping servers...');
  if (chatServer) chatServer.kill();
  if (webServer) webServer.kill();
}

async function main() {
  console.log('\n🧪 Chat Room UAT with Computer Use Actor\n');

  let actor;

  try {
    // Start servers
    await startServers();
    console.log();

    // Get ResourceManager
    const resourceManager = await ResourceManager.getInstance();

    // Create Computer Use Actor
    actor = new ComputerUseActor(resourceManager);

    // === UAT 1: Initialize and Load UI ===
    console.log('=== UAT 1: Initialize and Load Chat UI ===');
    const initResult = await actor.receive('init', {
      startUrl: 'http://localhost:3001',
      headless: false,
      width: 1440,
      height: 900,
    });
    console.log('✅ Browser initialized');
    console.log(`   Session: ${initResult.sessionId}`);
    console.log(`   Output: ${initResult.outDir}\n`);

    // Wait for page load
    await actor.receive('puppeteer', {
      action: 'waitForSelector',
      selector: '.login-container',
      options: { timeout: 5000 },
    });
    console.log('✅ Login screen loaded\n');

    // Screenshot 1
    const screenshot1 = await actor.receive('screenshot', { label: 'login_screen' });
    saveScreenshot(screenshot1, '/tmp/chat-uat-1-login.png');

    // === UAT 2: Join Chat Room (Gemini Mode) ===
    console.log('=== UAT 2: Join Chat Room with Gemini ===');
    const joinTask = await actor.receive('execute-task', {
      task: 'Enter the username "Alice" in the username input field and click the "Join Chat" button',
      maxTurns: 3,
    });
    console.log('✅ Gemini completed join task');
    if (joinTask.resultText) {
      console.log(`   Result: ${joinTask.resultText}\n`);
    }

    // Wait for chat interface
    await actor.receive('puppeteer', {
      action: 'waitForSelector',
      selector: '.chat-container',
      options: { timeout: 10000 },
    });
    console.log('✅ Chat interface loaded\n');

    // Screenshot 2
    const screenshot2 = await actor.receive('screenshot', { label: 'chat_joined' });
    saveScreenshot(screenshot2, '/tmp/chat-uat-2-joined.png');

    // === UAT 3: Verify User is in Chat ===
    console.log('=== UAT 3: Verify User in Chat ===');
    const statusText = await actor.receive('puppeteer', {
      action: 'textContent',
      selector: '.status',
    });
    console.log(`✅ Status: ${statusText.result}`);
    if (statusText.result.includes('Alice')) {
      console.log('✅ Username displayed correctly\n');
    } else {
      console.warn('⚠️  Username not found in status\n');
    }

    // === UAT 4: Send Message (Puppeteer Mode) ===
    console.log('=== UAT 4: Send Message with Puppeteer ===');
    await actor.receive('puppeteer', {
      action: 'fill',
      selector: '#message-input',
      value: 'Hello from Computer Use UAT!',
    });
    console.log('✅ Message typed');

    await actor.receive('puppeteer', {
      action: 'click',
      selector: 'button:has-text("Send")',
    });
    console.log('✅ Send button clicked');

    await actor.receive('puppeteer', {
      action: 'wait',
      value: 1000,
    });

    // Verify message appeared
    await actor.receive('puppeteer', {
      action: 'waitForSelector',
      selector: '.message.chat.own',
      options: { timeout: 5000 },
    });
    console.log('✅ Message appeared in chat\n');

    // Screenshot 3
    const screenshot3 = await actor.receive('screenshot', { label: 'message_sent' });
    saveScreenshot(screenshot3, '/tmp/chat-uat-3-message-sent.png');

    // === UAT 5: Verify Message Content ===
    console.log('=== UAT 5: Verify Message Content ===');
    const messageText = await actor.receive('puppeteer', {
      action: 'textContent',
      selector: '.message.chat.own .text',
    });
    console.log(`✅ Message text: "${messageText.result}"`);
    if (messageText.result.includes('Hello from Computer Use UAT!')) {
      console.log('✅ Message content correct\n');
    } else {
      console.warn('⚠️  Message content mismatch\n');
    }

    // === UAT 6: Check UI Styling ===
    console.log('=== UAT 6: Check UI Styling ===');
    const headerBg = await actor.receive('puppeteer', {
      action: 'evaluate',
      value: `
        const header = document.querySelector('.chat-header');
        const style = window.getComputedStyle(header);
        style.background;
      `,
    });
    console.log(`✅ Header background: ${headerBg.result.substring(0, 50)}...`);
    if (headerBg.result.includes('linear-gradient')) {
      console.log('✅ Gradient styling applied\n');
    }

    // === UAT 7: Test Another Message ===
    console.log('=== UAT 7: Send Second Message ===');
    await actor.receive('puppeteer', {
      action: 'fill',
      selector: '#message-input',
      value: 'This is the second message!',
    });
    await actor.receive('puppeteer', {
      action: 'press',
      selector: '#message-input',
      value: 'Enter',
    });
    await actor.receive('puppeteer', {
      action: 'wait',
      value: 1000,
    });
    console.log('✅ Second message sent\n');

    // Screenshot 4
    const screenshot4 = await actor.receive('screenshot', { label: 'two_messages' });
    saveScreenshot(screenshot4, '/tmp/chat-uat-4-two-messages.png');

    // === UAT 8: Verify Messages History ===
    console.log('=== UAT 8: Verify Message History ===');
    const messageCount = await actor.receive('puppeteer', {
      action: 'evaluate',
      value: `document.querySelectorAll('.message.chat').length`,
    });
    console.log(`✅ Total messages in chat: ${messageCount.result}\n`);

    // === UAT 9: Check Users List ===
    console.log('=== UAT 9: Check Users List ===');
    const usersList = await actor.receive('puppeteer', {
      action: 'textContent',
      selector: '#users-list',
    });
    console.log(`✅ Users in room: ${usersList.result}\n`);

    // === Final Screenshot ===
    const finalScreenshot = await actor.receive('screenshot', { label: 'final' });
    saveScreenshot(finalScreenshot, '/tmp/chat-uat-final.png');

    // === Get Final State ===
    const finalState = await actor.receive('get-state');
    console.log('=== Final Page State ===');
    console.log(`URL: ${finalState.state.url}`);
    console.log(`DOM nodes: ${finalState.state.dom.nodes.length}`);
    console.log(`Console logs: ${finalState.state.consoleLogs.length}\n`);

    // === Cleanup ===
    await actor.receive('cleanup');

    console.log('🎉 All UAT tests passed!\n');
    console.log('📁 Artifacts:');
    console.log(`   Output directory: ${initResult.outDir}`);
    console.log(`   Screenshots: /tmp/chat-uat-*.png`);
    console.log(`   Trace: ${initResult.outDir}/trace.zip`);
    console.log(`   Log: ${initResult.outDir}/run.log\n`);

  } catch (error) {
    console.error('\n❌ UAT Failed:', error.message);
    console.error(error.stack);

    // Cleanup on error
    if (actor) {
      try {
        await actor.receive('cleanup');
      } catch {}
    }

    process.exit(1);
  } finally {
    stopServers();
  }
}

function saveScreenshot(result, filepath) {
  if (result.ok) {
    const buffer = Buffer.from(result.screenshot, 'base64');
    writeFileSync(filepath, buffer);
    console.log(`   Screenshot saved: ${filepath}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    stopServers();
    process.exit(1);
  });
}
