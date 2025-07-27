#!/usr/bin/env node

import { execSync } from 'child_process';

const port = process.argv[2];

if (!port) {
  console.error('Usage: node kill-port.js <port>');
  process.exit(1);
}

try {
  // Find process using the port
  const findCommand = process.platform === 'win32'
    ? `netstat -ano | findstr :${port}`
    : `lsof -ti:${port}`;
  
  const pids = execSync(findCommand, { encoding: 'utf8' }).trim().split('\n');
  
  if (pids.length > 0 && pids[0] !== '') {
    console.log(`Found process(es) on port ${port}. Killing...`);
    
    pids.forEach(pid => {
      if (pid) {
        const killCommand = process.platform === 'win32' 
          ? `taskkill /PID ${pid} /F`
          : `kill -9 ${pid}`;
        
        try {
          execSync(killCommand);
          console.log(`Killed process ${pid}`);
        } catch (e) {
          console.error(`Failed to kill process ${pid}:`, e.message);
        }
      }
    });
    
    console.log(`Port ${port} cleared`);
  } else {
    console.log(`No process found on port ${port}`);
  }
} catch (error) {
  if (error.message.includes('No such process') || error.message.includes('ENOENT')) {
    console.log(`No process found on port ${port}`);
  } else {
    console.error(`Error checking port ${port}:`, error.message);
  }
}