#!/usr/bin/env node

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws';

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
      return { ...pidData, running: true };
    } catch (error) {
      return { ...pidData, running: false };
    }
  } catch (error) {
    return null;
  }
}

/**
 * Test WebSocket connection to server
 */
async function testConnection(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${host}:${port}`);
    const timer = setTimeout(() => {
      ws.close();
      resolve(false);
    }, timeout);

    ws.on('open', () => {
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });

    ws.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Get process memory and CPU info (Unix-like systems)
 */
async function getProcessStats(pid) {
  try {
    // This is a simple implementation - could be enhanced with more detailed stats
    const stats = {
      pid,
      memory: 'N/A',
      cpu: 'N/A',
      uptime: 'N/A'
    };

    // Try to get basic process info on Unix-like systems
    if (process.platform !== 'win32') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        // Get memory usage (RSS) in MB
        const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o rss= 2>/dev/null`);
        if (psOutput.trim()) {
          const rssKB = parseInt(psOutput.trim());
          stats.memory = `${(rssKB / 1024).toFixed(1)} MB`;
        }
      } catch (error) {
        // Ignore ps errors
      }

      try {
        // Get process start time and calculate uptime
        const { stdout: statOutput } = await execAsync(`ps -p ${pid} -o lstart= 2>/dev/null`);
        if (statOutput.trim()) {
          const startTime = new Date(statOutput.trim());
          const uptime = Date.now() - startTime.getTime();
          const uptimeSeconds = Math.floor(uptime / 1000);
          const hours = Math.floor(uptimeSeconds / 3600);
          const minutes = Math.floor((uptimeSeconds % 3600) / 60);
          const seconds = uptimeSeconds % 60;
          stats.uptime = `${hours}h ${minutes}m ${seconds}s`;
        }
      } catch (error) {
        // Ignore ps errors
      }
    }

    return stats;
  } catch (error) {
    return { pid, memory: 'N/A', cpu: 'N/A', uptime: 'N/A' };
  }
}

/**
 * Check agent server status
 */
async function checkStatus(options = {}) {
  const verbose = options.verbose || false;
  const json = options.json || false;
  
  const serverInfo = await getServerInfo();
  
  const status = {
    running: false,
    reachable: false,
    pid: null,
    host: null,
    port: null,
    startTime: null,
    processStats: null
  };

  if (!serverInfo) {
    if (json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log('❌ Agent server is not running (no PID file found)');
    }
    return status;
  }

  status.pid = serverInfo.pid;
  status.host = serverInfo.host;
  status.port = serverInfo.port;
  status.startTime = serverInfo.startTime;
  status.running = serverInfo.running;

  if (!serverInfo.running) {
    if (json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(`❌ Agent server is not running (PID ${serverInfo.pid} not found)`);
      console.log('The PID file exists but the process is not running');
    }
    return status;
  }

  // Test WebSocket connection
  status.reachable = await testConnection(serverInfo.host, serverInfo.port);

  // Get process stats if verbose
  if (verbose) {
    status.processStats = await getProcessStats(serverInfo.pid);
  }

  if (json) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log('✅ Agent server is running');
    console.log(`   PID: ${serverInfo.pid}`);
    console.log(`   Address: ${serverInfo.host}:${serverInfo.port}`);
    console.log(`   Started: ${new Date(serverInfo.startTime).toLocaleString()}`);
    console.log(`   WebSocket: ${status.reachable ? '✅ Reachable' : '❌ Not reachable'}`);
    
    if (verbose && status.processStats) {
      console.log(`   Memory: ${status.processStats.memory}`);
      console.log(`   Uptime: ${status.processStats.uptime}`);
    }
  }

  return status;
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    verbose: false,
    json: false,
    help: false
  };

  for (const arg of args) {
    switch (arg) {
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--json':
      case '-j':
        options.json = true;
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
Check jsEnvoy Agent Server Status

Usage:
  node status-agent.js [options]

Options:
  --verbose, -v    Show detailed process information
  --json, -j       Output status as JSON
  --help           Show this help message

Examples:
  node status-agent.js           # Basic status check
  node status-agent.js -v        # Detailed status
  node status-agent.js --json    # JSON output
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
    const status = await checkStatus(options);
    process.exit(status.running && status.reachable ? 0 : 1);
  } catch (error) {
    if (options.json) {
      console.log(JSON.stringify({ 
        error: error.message,
        running: false 
      }, null, 2));
    } else {
      console.error('❌ Error checking status:', error.message);
    }
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

export { checkStatus, getServerInfo };