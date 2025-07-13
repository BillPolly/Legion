#!/usr/bin/env node

/**
 * Generic script to kill processes running on a specific port
 * Usage: node scripts/kill-port.js <port> [--force]
 * Example: node scripts/kill-port.js 3000
 * Example: node scripts/kill-port.js 3000 --force
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function findProcessesOnPort(port) {
  try {
    // Use lsof to find processes using the port
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout.trim().split('\n').filter(pid => pid);
    return pids;
  } catch (error) {
    // lsof returns non-zero exit code when no processes found
    return [];
  }
}

async function getProcessInfo(pid) {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o pid,ppid,command --no-headers`);
    return stdout.trim();
  } catch (error) {
    return `${pid} - (process info unavailable)`;
  }
}

async function killProcess(pid, force = false) {
  try {
    const signal = force ? 'SIGKILL' : 'SIGTERM';
    await execAsync(`kill ${force ? '-9' : ''} ${pid}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to kill process ${pid}: ${error.message}`);
    return false;
  }
}

async function waitForProcessToExit(pid, maxWaitMs = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    try {
      await execAsync(`ps -p ${pid}`);
      // Process still exists, wait a bit more
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      // Process no longer exists
      return true;
    }
  }
  
  return false; // Timeout
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: node scripts/kill-port.js <port> [--force]');
    console.error('');
    console.error('Examples:');
    console.error('  node scripts/kill-port.js 3000          # Gracefully kill processes on port 3000');
    console.error('  node scripts/kill-port.js 3000 --force  # Force kill processes on port 3000');
    console.error('');
    console.error('Options:');
    console.error('  --force    Use SIGKILL instead of SIGTERM (immediate termination)');
    process.exit(1);
  }

  const port = args[0];
  const force = args.includes('--force');

  // Validate port number
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    console.error(`❌ Invalid port number: ${port}`);
    console.error('   Port must be a number between 1 and 65535');
    process.exit(1);
  }

  console.log(`🔍 Checking for processes on port ${port}...`);

  const pids = await findProcessesOnPort(port);

  if (pids.length === 0) {
    console.log(`✅ No processes found running on port ${port}`);
    process.exit(0);
  }

  console.log(`\n📋 Found ${pids.length} process${pids.length > 1 ? 'es' : ''} on port ${port}:`);
  
  // Show process information
  for (const pid of pids) {
    const info = await getProcessInfo(pid);
    console.log(`   ${info}`);
  }

  console.log(`\n🛑 Terminating processes with ${force ? 'SIGKILL (force)' : 'SIGTERM (graceful)'}...`);

  let killedCount = 0;
  const killPromises = pids.map(async (pid) => {
    const success = await killProcess(pid, force);
    if (success) {
      killedCount++;
      console.log(`  ✅ Sent ${force ? 'SIGKILL' : 'SIGTERM'} to process ${pid}`);
      
      if (!force) {
        // Wait for graceful shutdown
        const exited = await waitForProcessToExit(pid, 5000);
        if (exited) {
          console.log(`  ✅ Process ${pid} exited gracefully`);
        } else {
          console.log(`  ⚠️  Process ${pid} did not exit within 5 seconds, you may need --force`);
        }
      }
    }
    return success;
  });

  await Promise.all(killPromises);

  console.log(`\n📊 Summary:`);
  console.log(`   Processes found: ${pids.length}`);
  console.log(`   Kill signals sent: ${killedCount}`);

  if (killedCount > 0) {
    // Verify port is now free
    setTimeout(async () => {
      const remainingPids = await findProcessesOnPort(port);
      if (remainingPids.length === 0) {
        console.log(`✅ Port ${port} is now free`);
      } else {
        console.log(`⚠️  Port ${port} still has ${remainingPids.length} process${remainingPids.length > 1 ? 'es' : ''}`);
        console.log(`   Try running with --force for immediate termination`);
      }
    }, 1000);
  }
}

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error.message);
  process.exit(1);
});