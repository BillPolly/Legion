#!/usr/bin/env node

/**
 * ROMA Manager - Simple script to manage server and CLI
 * Automatically starts server if needed, manages lifecycle, and launches CLI
 */

import { spawn, exec } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const pidFile = path.join(rootDir, '.roma-server.pid');

const SERVER_PORT = 4020;
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Check if server is running on port
 */
async function isServerRunning() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.connect(SERVER_PORT, 'localhost');
  });
}

/**
 * Start the ROMA server with auto-shutdown on inactivity
 */
async function startServer() {
  log('🚀 Starting ROMA server...', 'yellow');
  
  const serverScript = path.join(rootDir, 'src', 'server', 'server-with-timeout.js');
  
  // First, create the modified server script with auto-shutdown
  await createServerWithTimeout();
  
  const serverProcess = spawn('node', [serverScript], {
    cwd: rootDir,
    env: { 
      ...process.env, 
      NODE_OPTIONS: '--experimental-vm-modules',
      INACTIVITY_TIMEOUT: INACTIVITY_TIMEOUT.toString()
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Save PID for later management
  fs.writeFileSync(pidFile, serverProcess.pid.toString());
  
  // Show server output for 2 seconds to confirm startup
  let serverReady = false;
  
  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('running on http://localhost:4020')) {
      serverReady = true;
      log('✅ ROMA server is ready!', 'green');
    }
    // Only show startup logs
    if (!serverReady) {
      process.stdout.write(`${colors.dim}[SERVER] ${output}${colors.reset}`);
    }
  });
  
  serverProcess.stderr.on('data', (data) => {
    if (!serverReady) {
      process.stderr.write(`${colors.red}[SERVER ERROR] ${data}${colors.reset}`);
    }
  });
  
  // Wait for server to be ready (max 5 seconds)
  let attempts = 0;
  while (!serverReady && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
    if (await isServerRunning()) {
      serverReady = true;
      break;
    }
  }
  
  if (!serverReady) {
    log('⚠️ Server may not have started properly, but continuing...', 'yellow');
  }
  
  serverProcess.unref();
  
  return serverProcess.pid;
}

/**
 * Create a modified server script with auto-shutdown functionality
 */
async function createServerWithTimeout() {
  const originalServer = path.join(rootDir, 'src', 'server', 'server.js');
  const modifiedServer = path.join(rootDir, 'src', 'server', 'server-with-timeout.js');
  
  // Read original server
  const serverCode = fs.readFileSync(originalServer, 'utf-8');
  
  // Add auto-shutdown logic
  const modifiedCode = serverCode.replace(
    '// Start server',
    `// Auto-shutdown logic
let lastActivity = Date.now();
let activityTimeout;

function resetActivityTimer() {
  lastActivity = Date.now();
  
  if (activityTimeout) {
    clearTimeout(activityTimeout);
  }
  
  activityTimeout = setTimeout(() => {
    const inactivityDuration = Date.now() - lastActivity;
    if (inactivityDuration >= ${INACTIVITY_TIMEOUT}) {
      console.log('⏰ Auto-shutdown: Server idle for 5 minutes');
      process.exit(0);
    }
  }, ${INACTIVITY_TIMEOUT});
}

// Track WebSocket activity
const originalWssOn = wss.on.bind(wss);
wss.on = function(event, handler) {
  if (event === 'connection') {
    return originalWssOn(event, function(ws) {
      resetActivityTimer();
      
      ws.on('message', () => resetActivityTimer());
      ws.on('close', () => resetActivityTimer());
      
      return handler.apply(this, arguments);
    });
  }
  return originalWssOn(event, handler);
};

// Track HTTP activity
app.use((req, res, next) => {
  resetActivityTimer();
  next();
});

// Start activity timer
resetActivityTimer();

console.log('🕐 Auto-shutdown enabled: Server will stop after 5 minutes of inactivity');

// Start server`
  );
  
  fs.writeFileSync(modifiedServer, modifiedCode);
}

/**
 * Stop the ROMA server
 */
async function stopServer() {
  if (fs.existsSync(pidFile)) {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
    
    try {
      process.kill(pid, 'SIGTERM');
      log('🛑 ROMA server stopped', 'yellow');
      fs.unlinkSync(pidFile);
    } catch (error) {
      if (error.code === 'ESRCH') {
        log('Server was not running', 'dim');
        fs.unlinkSync(pidFile);
      } else {
        log(`Error stopping server: ${error.message}`, 'red');
      }
    }
  } else {
    // Try to find and kill by port
    try {
      exec(`lsof -ti:${SERVER_PORT} | xargs kill -9`, (error) => {
        if (!error) {
          log('🛑 ROMA server stopped', 'yellow');
        } else {
          log('No server found to stop', 'dim');
        }
      });
    } catch {
      log('No server found to stop', 'dim');
    }
  }
  
  // Clean up modified server script
  const modifiedServer = path.join(rootDir, 'src', 'server', 'server-with-timeout.js');
  if (fs.existsSync(modifiedServer)) {
    fs.unlinkSync(modifiedServer);
  }
}

/**
 * Start the CLI
 */
function startCLI(mode = 'interactive') {
  const cliDir = path.join(rootDir, 'cli');
  
  if (mode === 'interactive') {
    log('\n🧠 Starting ROMA CLI...', 'cyan');
    log('=' .repeat(50), 'dim');
    
    const cliProcess = spawn('node', ['bin/roma-cli.js'], {
      cwd: cliDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });
    
    cliProcess.on('exit', (code) => {
      log('\n👋 CLI exited', 'dim');
      process.exit(code);
    });
    
    return cliProcess;
  } else {
    // Pass through to discrete command mode
    const args = process.argv.slice(3);
    const cliProcess = spawn('node', ['bin/roma.js', mode, ...args], {
      cwd: cliDir,
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });
    
    cliProcess.on('exit', (code) => {
      process.exit(code);
    });
    
    return cliProcess;
  }
}

/**
 * Main execution
 */
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'stop':
      await stopServer();
      break;
      
    case 'server':
      // Just start the server
      if (await isServerRunning()) {
        log('✅ ROMA server is already running', 'green');
      } else {
        await startServer();
        log(`\n📡 Server running on http://localhost:${SERVER_PORT}`, 'green');
        log('⏰ Will auto-shutdown after 5 minutes of inactivity', 'dim');
      }
      break;
      
    case 'status':
    case 'execute':
    case 'history':
    case 'watch':
      // Discrete commands - ensure server is running then execute
      if (!await isServerRunning()) {
        await startServer();
        // Give server a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      startCLI(command);
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    default:
      // Default: start server if needed and launch interactive CLI
      if (!await isServerRunning()) {
        await startServer();
        // Give server a moment to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        log('✅ ROMA server is already running', 'green');
      }
      
      startCLI('interactive');
      break;
  }
}

function showHelp() {
  console.log(`
${colors.bright}🧠 ROMA - Recursive Objective Management Agent${colors.reset}

${colors.cyan}Usage:${colors.reset}
  roma              Start interactive CLI (auto-starts server)
  roma stop         Stop the ROMA server
  roma server       Start only the server
  roma status       Show agent status
  roma execute      Execute a task
  roma history      Show execution history
  roma watch        Watch an execution
  roma help         Show this help

${colors.cyan}Examples:${colors.reset}
  roma                                    # Start interactive mode
  roma execute "Create a function" --watch  # Execute and watch
  roma status                              # Check status
  roma stop                                # Stop server

${colors.dim}Server auto-stops after 5 minutes of inactivity${colors.reset}
`);
}

// Handle process termination
process.on('SIGINT', async () => {
  log('\n\n🛑 Shutting down...', 'yellow');
  await stopServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopServer();
  process.exit(0);
});

// Run main
main().catch((error) => {
  log(`Error: ${error.message}`, 'red');
  process.exit(1);
});