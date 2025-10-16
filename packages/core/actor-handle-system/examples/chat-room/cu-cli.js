#!/usr/bin/env node
/**
 * Computer Use CLI - Client that talks to persistent server
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 9876;
const PID_FILE = '/tmp/cu-server.pid';

function isServerRunning() {
  if (!existsSync(PID_FILE)) return false;

  const pid = parseInt(readFileSync(PID_FILE, 'utf-8'));
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function startServer() {
  console.log('Starting Computer Use Server...');
  const server = spawn('node', ['cu-server.js'], {
    cwd: __dirname,
    detached: true,
    stdio: 'ignore'
  });
  server.unref();

  // Wait for server to start
  return new Promise((resolve) => {
    setTimeout(resolve, 2000);
  });
}

async function sendCommand(command, args = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ command, args });

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const response = JSON.parse(body);
        if (response.ok) {
          resolve(response.result);
        } else {
          reject(new Error(response.error));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command) {
    console.log('Usage: npm run computer-use <command> [args...]');
    console.log('\nCommands:');
    console.log('  init                 - Initialize browser at http://localhost:3001');
    console.log('  screenshot <label>   - Take screenshot');
    console.log('  ask <question>       - Ask Gemini AI about what it sees');
    console.log('  state                - Get page state and console logs');
    console.log('  puppeteer <json>     - Run puppeteer command (JSON)');
    console.log('  cleanup              - Close browser and cleanup');
    console.log('  stop                 - Stop the server');
    process.exit(0);
  }

  try {
    // Check if server is running, start if needed
    if (!isServerRunning() && command !== 'stop') {
      await startServer();
    }

    // Handle commands
    switch (command) {
      case 'init': {
        console.log('🚀 Initializing browser...');
        const result = await sendCommand('init', {
          startUrl: 'http://localhost:3001',
          headless: false,
          width: 1440,
          height: 900,
        });
        console.log('✅ Browser initialized');
        console.log(`Session: ${result.sessionId}`);
        console.log(`Output: ${result.outDir}`);
        break;
      }

      case 'screenshot': {
        const label = args[0] || 'screenshot';
        console.log(`📸 Taking screenshot: ${label}`);
        const result = await sendCommand('screenshot', { label });
        const filename = `/tmp/cu-${label}.png`;
        writeFileSync(filename, Buffer.from(result.screenshot, 'base64'));
        console.log(`✅ Saved: ${filename}`);
        break;
      }

      case 'ask': {
        const question = args.join(' ');
        console.log(`🤔 Asking Gemini: ${question}`);
        const result = await sendCommand('ask', { prompt: question });
        console.log('\n📝 Gemini says:');
        console.log(result.content);
        break;
      }

      case 'state': {
        console.log('📊 Getting page state...');
        const result = await sendCommand('state');
        console.log(`\nURL: ${result.state.url}`);
        console.log(`Title: ${result.state.title}`);
        console.log(`\nConsole logs (${result.state.consoleLogs.length}):`);
        result.state.consoleLogs.forEach(log => {
          if (typeof log === 'object') {
            console.log(`  ${JSON.stringify(log, null, 2)}`);
          } else {
            console.log(`  ${log}`);
          }
        });
        break;
      }

      case 'puppeteer': {
        const cmdJson = args.join(' ');
        console.log(`🎭 Running puppeteer: ${cmdJson}`);
        const cmd = JSON.parse(cmdJson);
        const result = await sendCommand('puppeteer', cmd);
        console.log('✅ Result:', JSON.stringify(result, null, 2));
        break;
      }

      case 'cleanup': {
        console.log('🧹 Cleaning up...');
        await sendCommand('cleanup');
        console.log('✅ Done');
        break;
      }

      case 'stop': {
        if (!isServerRunning()) {
          console.log('Server not running');
          process.exit(0);
        }
        const pid = parseInt(readFileSync(PID_FILE, 'utf-8'));
        console.log(`Stopping server (PID: ${pid})...`);
        process.kill(pid);
        console.log('✅ Server stopped');
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
