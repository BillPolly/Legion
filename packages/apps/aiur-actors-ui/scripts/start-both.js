#!/usr/bin/env node

/**
 * Start both Aiur server and UI server
 * First kills any existing processes on required ports
 */

import { spawn, execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEGION_ROOT = join(__dirname, '../../../..');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Kill processes on specific ports
 */
function killPortProcesses() {
  console.log(`${colors.yellow}🔍 Checking for existing processes...${colors.reset}`);
  
  const ports = [
    { port: 8080, name: 'Aiur server' },
    { port: 3002, name: 'UI server' }
  ];
  
  let killedAny = false;
  
  for (const { port, name } of ports) {
    try {
      // Get process IDs using the port
      const pids = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(pid => pid);
      
      if (pids.length > 0) {
        console.log(`${colors.yellow}  Killing ${name} on port ${port} (PIDs: ${pids.join(', ')})${colors.reset}`);
        
        // Kill each process
        pids.forEach(pid => {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (e) {
            // Process might already be dead
          }
        });
        
        killedAny = true;
      }
    } catch (error) {
      // No process found on this port (lsof returns error when no process found)
    }
  }
  
  if (killedAny) {
    console.log(`${colors.green}✓ Cleaned up existing processes${colors.reset}`);
    // Wait a moment for processes to fully terminate
    execSync('sleep 1');
  } else {
    console.log(`${colors.green}✓ No existing processes found${colors.reset}`);
  }
  
  console.log('');
}

// Kill existing processes first
killPortProcesses();

console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.cyan}     Starting Aiur Server and UI${colors.reset}`);
console.log(`${colors.cyan}═══════════════════════════════════════════════${colors.reset}\n`);

// Start Aiur server
console.log(`${colors.blue}🚀 Starting Aiur server on port 8080...${colors.reset}`);
const aiurProcess = spawn('npm', ['start'], {
  cwd: join(LEGION_ROOT, 'packages/aiur'),
  stdio: 'inherit',
  shell: true
});

let uiProcess = null;

// Give Aiur a moment to start
setTimeout(() => {
  console.log(`\n${colors.blue}🌐 Starting UI server on port 3002...${colors.reset}`);
  
  // Start UI server
  uiProcess = spawn('npm', ['start'], {
    cwd: join(LEGION_ROOT, 'packages/apps/aiur-actors-ui'),
    stdio: 'inherit',
    shell: true
  });
  
  // Handle UI process exit
  uiProcess.on('exit', (code) => {
    console.log(`${colors.red}UI server exited with code ${code}${colors.reset}`);
    aiurProcess.kill();
    process.exit(code);
  });
  
  // After both servers start, show success message
  setTimeout(() => {
    console.log(`\n${colors.green}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}     ✅ Both servers are running!${colors.reset}`);
    console.log(`${colors.green}═══════════════════════════════════════════════${colors.reset}`);
    console.log(`\n  🚀 Aiur Server:   ${colors.cyan}ws://localhost:8080/actors${colors.reset}`);
    console.log(`  🌐 UI Application: ${colors.cyan}http://localhost:3002${colors.reset}`);
    console.log(`\n  ${colors.yellow}Press Ctrl+C to stop both servers${colors.reset}\n`);
  }, 2000);
}, 2000);

// Handle Aiur process exit
aiurProcess.on('exit', (code) => {
  console.log(`${colors.red}Aiur server exited with code ${code}${colors.reset}`);
  if (uiProcess) {
    uiProcess.kill();
  }
  process.exit(code);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Shutting down servers...${colors.reset}`);
  
  if (aiurProcess) {
    aiurProcess.kill();
  }
  if (uiProcess) {
    uiProcess.kill();
  }
  
  setTimeout(() => {
    console.log(`${colors.green}✓ Servers stopped${colors.reset}`);
    process.exit(0);
  }, 500);
});

// Handle other termination signals
process.on('SIGTERM', () => {
  if (aiurProcess) aiurProcess.kill();
  if (uiProcess) uiProcess.kill();
  process.exit(0);
});