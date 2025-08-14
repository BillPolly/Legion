import net from 'net';
import { execSync } from 'child_process';

/**
 * Synchronously find an available port
 * Uses a blocking approach suitable for initialization
 */
export function findAvailablePortSync(startPort = 9901, maxAttempts = 100) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (isPortAvailableSync(port)) {
      return port;
    }
  }
  throw new Error(`Could not find available port in range ${startPort}-${startPort + maxAttempts}`);
}

/**
 * Check if a port is available synchronously
 */
function isPortAvailableSync(port) {
  
  try {
    // Check if port is in use using lsof
    if (process.platform === 'darwin' || process.platform === 'linux') {
      try {
        execSync(`lsof -i:${port}`, { stdio: 'ignore' });
        // If lsof succeeds, port is in use
        return false;
      } catch {
        // If lsof fails, port is free
        return true;
      }
    } else {
      // Windows: try netstat
      try {
        const output = execSync(`netstat -an | findstr :${port}`, { encoding: 'utf8' });
        return !output.includes('LISTENING');
      } catch {
        return true;
      }
    }
  } catch (error) {
    console.error(`Error checking port ${port}:`, error.message);
    return false;
  }
}

/**
 * Async version for compatibility
 */
export async function findAvailablePort(startPort = 9901) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use, try next one
        findAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

export default { findAvailablePortSync, findAvailablePort };