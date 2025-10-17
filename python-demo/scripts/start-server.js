#!/usr/bin/env node
/**
 * Start the Python web_app.py server
 * Kills any existing processes on ports 8000 and 8765 first
 */

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PYTHON_DEMO_DIR = join(__dirname, '..');

console.log('🛑 Checking for existing servers on ports 8000 and 8765...');

try {
  execSync('lsof -ti:8000,8765 | xargs kill -9', { stdio: 'ignore' });
  console.log('✅ Killed existing processes');
} catch (e) {
  console.log('✅ No existing processes found');
}

console.log('\n🐍 Starting Python web server...');
console.log(`📁 Directory: ${PYTHON_DEMO_DIR}\n`);

const pythonProcess = spawn('python3', ['web_app.py'], {
  cwd: PYTHON_DEMO_DIR,
  detached: true,
  stdio: 'ignore'
});

pythonProcess.unref();

console.log(`✅ Server started (PID: ${pythonProcess.pid})`);
console.log('🌐 HTTP server: http://localhost:8000');
console.log('🔌 WebSocket server: ws://localhost:8765');
console.log('\n💡 To stop the server:');
console.log('   lsof -ti:8000,8765 | xargs kill -9');
