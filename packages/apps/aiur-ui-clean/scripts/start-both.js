#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}${colors.bright}
═══════════════════════════════════════════════
     Starting Aiur Server and Clean UI
═══════════════════════════════════════════════
${colors.reset}`);

// Kill existing processes
console.log(`${colors.yellow}🔍 Checking for existing processes...${colors.reset}`);

try {
  // Kill processes on port 3003 (UI)
  spawn('lsof', ['-ti:3003'], { stdio: 'pipe' }).on('exit', (code) => {
    if (code === 0) {
      spawn('lsof', ['-ti:3003']).stdout.on('data', (data) => {
        const pids = data.toString().trim().split('\n');
        pids.forEach(pid => {
          if (pid) {
            process.kill(pid, 'SIGTERM');
            console.log(`  Killed UI process ${pid}`);
          }
        });
      });
    }
  });

  // Kill processes on port 8080 (Aiur server)
  spawn('lsof', ['-ti:8080'], { stdio: 'pipe' }).on('exit', (code) => {
    if (code === 0) {
      spawn('lsof', ['-ti:8080']).stdout.on('data', (data) => {
        const pids = data.toString().trim().split('\n');
        pids.forEach(pid => {
          if (pid) {
            process.kill(pid, 'SIGTERM');
            console.log(`  Killed Aiur server process ${pid}`);
          }
        });
      });
    }
  });
} catch (e) {
  // Ignore errors (no processes to kill)
}

// Wait a bit for processes to die
setTimeout(() => {
  console.log(`${colors.green}✓ Cleaned up existing processes${colors.reset}\n`);

  // Start Aiur server
  console.log(`${colors.blue}🚀 Starting Aiur server on port 8080...${colors.reset}`);
  
  const aiurProcess = spawn('node', ['src/server/index.js'], {
    cwd: join(__dirname, '../../../aiur'), // Go to aiur package directly
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });

  aiurProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('AiurServer listening')) {
      console.log(`${colors.green}✓ Aiur server started${colors.reset}`);
    }
    // Prefix Aiur output
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`${colors.magenta}[Aiur]${colors.reset} ${line}`);
      }
    });
  });

  aiurProcess.stderr.on('data', (data) => {
    console.error(`${colors.red}[Aiur Error]${colors.reset} ${data.toString()}`);
  });

  // Start UI server after a short delay
  setTimeout(() => {
    console.log(`\n${colors.blue}🌐 Starting UI server on port 3003...${colors.reset}`);
    
    const uiProcess = spawn('npm', ['run', 'dev'], {
      cwd: join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true
    });

    uiProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Clean Aiur UI server running')) {
        console.log(`${colors.green}✓ UI server started${colors.reset}`);
        
        console.log(`${colors.cyan}${colors.bright}
═══════════════════════════════════════════════
     ✅ Both servers are running!
═══════════════════════════════════════════════

  🚀 Aiur Server:   ws://localhost:8080/ws
  🌐 UI Application: http://localhost:3003

  Press Ctrl+C to stop both servers
${colors.reset}`);
      }
      // Prefix UI output
      output.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(`${colors.cyan}[UI]${colors.reset} ${line}`);
        }
      });
    });

    uiProcess.stderr.on('data', (data) => {
      console.error(`${colors.red}[UI Error]${colors.reset} ${data.toString()}`);
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      console.log(`\n${colors.yellow}Shutting down servers...${colors.reset}`);
      
      aiurProcess.kill('SIGTERM');
      uiProcess.kill('SIGTERM');
      
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    });

  }, 2000);

}, 1000);