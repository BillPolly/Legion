#!/usr/bin/env node

import { readFile, unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get server info from PID file
 */
async function getServerInfo() {
  try {
    const pidFile = path.join(__dirname, '..', '.agent.pid');
    const data = await readFile(pidFile, 'utf8');
    const pidData = JSON.parse(data);
    
    // Check if process is still running
    try {
      process.kill(pidData.pid, 0);
      return { ...pidData, pidFile, running: true };
    } catch (error) {
      return { ...pidData, pidFile, running: false };
    }
  } catch (error) {
    return null;
  }
}

/**
 * Stop the agent server
 */
async function stopServer(options = {}) {
  const force = options.force || false;
  
  const serverInfo = await getServerInfo();
  
  if (!serverInfo) {
    console.log('No agent server PID file found - server may not be running');
    return false;
  }

  if (!serverInfo.running) {
    console.log(`Agent server (PID: ${serverInfo.pid}) is not running`);
    
    // Clean up stale PID file
    try {
      await unlink(serverInfo.pidFile);
      console.log('Removed stale PID file');
    } catch (error) {
      console.warn('Could not remove PID file:', error.message);
    }
    
    return false;
  }

  console.log(`Stopping agent server (PID: ${serverInfo.pid}) on ${serverInfo.host}:${serverInfo.port}...`);

  try {
    // First try graceful shutdown (SIGTERM)
    if (!force) {
      process.kill(serverInfo.pid, 'SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if it's still running
      try {
        process.kill(serverInfo.pid, 0);
        console.log('Server is taking time to shut down, sending SIGKILL...');
        process.kill(serverInfo.pid, 'SIGKILL');
      } catch (error) {
        // Process already stopped
      }
    } else {
      // Force kill immediately
      process.kill(serverInfo.pid, 'SIGKILL');
    }

    // Clean up PID file
    try {
      await unlink(serverInfo.pidFile);
    } catch (error) {
      console.warn('Could not remove PID file:', error.message);
    }

    console.log('✅ Agent server stopped successfully');
    return true;

  } catch (error) {
    if (error.code === 'ESRCH') {
      console.log('Agent server process not found (may have already stopped)');
      
      // Clean up PID file
      try {
        await unlink(serverInfo.pidFile);
      } catch (unlinkError) {
        console.warn('Could not remove PID file:', unlinkError.message);
      }
      
      return false;
    } else if (error.code === 'EPERM') {
      console.error('❌ Permission denied - cannot stop server process');
      console.error('Try running with sudo or as the user who started the server');
      return false;
    } else {
      throw error;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    force: false,
    help: false
  };

  for (const arg of args) {
    switch (arg) {
      case '--force':
      case '-f':
        options.force = true;
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
Stop jsEnvoy Agent Server

Usage:
  node stop-agent.js [options]

Options:
  --force, -f    Force kill the server (SIGKILL instead of SIGTERM)
  --help         Show this help message

Examples:
  node stop-agent.js          # Graceful shutdown
  node stop-agent.js --force  # Force kill
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
    const stopped = await stopServer(options);
    process.exit(stopped ? 0 : 1);
  } catch (error) {
    console.error('❌ Failed to stop agent server:', error.message);
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

export { stopServer, getServerInfo };