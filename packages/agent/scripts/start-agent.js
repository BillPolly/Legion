#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if agent server is already running
 */
async function isServerRunning() {
  try {
    const pidFile = path.join(__dirname, '..', '.agent.pid');
    const data = await readFile(pidFile, 'utf8');
    const pidData = JSON.parse(data);
    
    // Check if process is still running
    try {
      process.kill(pidData.pid, 0);
      return pidData;
    } catch (error) {
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Start the agent server
 */
async function startServer(options = {}) {
  const host = options.host || 'localhost';
  const port = options.port || 3001;
  
  // Check if already running
  const existing = await isServerRunning();
  if (existing) {
    console.log(`Agent server is already running on ${existing.host}:${existing.port} (PID: ${existing.pid})`);
    return existing;
  }

  console.log(`Starting jsEnvoy Agent server on ${host}:${port}...`);

  return new Promise((resolve, reject) => {
    const serverProcess = spawn('node', [
      path.join(__dirname, '..', 'src', 'cli.js'),
      '--server',
      '--port', port.toString(),
      '--host', host
    ], {
      detached: true,
      stdio: 'pipe'
    });

    let startupOutput = '';
    const startupTimeout = setTimeout(() => {
      reject(new Error('Server startup timeout (10 seconds)'));
    }, 10000);

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      startupOutput += output;
      
      if (output.includes('WebSocket server started')) {
        clearTimeout(startupTimeout);
        
        // Detach the process so it can run independently
        serverProcess.unref();
        
        console.log(`✅ Agent server started successfully on ${host}:${port}`);
        console.log(`PID: ${serverProcess.pid}`);
        
        resolve({
          pid: serverProcess.pid,
          host,
          port,
          startTime: new Date().toISOString()
        });
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const errorOutput = data.toString();
      console.error('Server error:', errorOutput);
      
      if (errorOutput.includes('Error') || errorOutput.includes('EADDRINUSE')) {
        clearTimeout(startupTimeout);
        reject(new Error(`Server startup failed: ${errorOutput}`));
      }
    });

    serverProcess.on('error', (error) => {
      clearTimeout(startupTimeout);
      reject(new Error(`Failed to start server process: ${error.message}`));
    });

    serverProcess.on('exit', (code, signal) => {
      clearTimeout(startupTimeout);
      if (code !== 0) {
        reject(new Error(`Server process exited with code ${code}, signal ${signal}`));
      }
    });
  });
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    host: 'localhost',
    port: 3001,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--host':
      case '-h':
        options.host = args[++i] || 'localhost';
        break;
      case '--port':
      case '-p':
        options.port = parseInt(args[++i]) || 3001;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Start jsEnvoy Agent Server

Usage:
  node start-agent.js [options]

Options:
  --host, -h <host>  WebSocket server host (default: localhost)
  --port, -p <port>  WebSocket server port (default: 3001)
  --help             Show this help message

Examples:
  node start-agent.js                # Start on localhost:3001
  node start-agent.js -p 8080        # Start on localhost:8080
  node start-agent.js -h 0.0.0.0     # Start on all interfaces
  `);
}

/**
 * Main function
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  try {
    await startServer(options);
  } catch (error) {
    console.error('❌ Failed to start agent server:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

export { startServer, isServerRunning };