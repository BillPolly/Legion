/**
 * Kill any process using a specific port
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function killPort(port) {
  try {
    // Try to find and kill process on the port
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // macOS/Linux: Use lsof to find process
      try {
        const { stdout } = await execAsync(`lsof -ti:${port}`);
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`);
            console.log(`Killed process ${pid} on port ${port}`);
          } catch (e) {
            // Process might have already exited
          }
        }
      } catch (error) {
        // No process found on port, that's fine
        if (!error.message.includes('No such process')) {
          // lsof returns error when no process found, ignore it
        }
      }
    } else if (process.platform === 'win32') {
      // Windows: Use netstat and taskkill
      try {
        const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0') {
            pids.add(pid);
          }
        });
        
        for (const pid of pids) {
          try {
            await execAsync(`taskkill /F /PID ${pid}`);
            console.log(`Killed process ${pid} on port ${port}`);
          } catch (e) {
            // Process might have already exited
          }
        }
      } catch (error) {
        // No process found on port, that's fine
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not kill process on port ${port}:`, error.message);
  }
}

// Also export a function to ensure port is free
export async function ensurePortFree(port, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    await killPort(port);
    
    // Wait a bit for port to be released
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if port is free by trying to create a server
    const net = await import('net');
    const isPortFree = await new Promise(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
    
    if (isPortFree) {
      return true;
    }
    
    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  throw new Error(`Could not free port ${port} after ${maxAttempts} attempts`);
}