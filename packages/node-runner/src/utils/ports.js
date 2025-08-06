import net from 'net';
import detectPort from 'detect-port';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Port management utilities
 */

/**
 * Check if a port is in use
 */
export async function isPortInUse(port, host = 'localhost') {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    
    server.listen(port, host);
  });
}

/**
 * Find an available port starting from a preferred port
 */
export async function findAvailablePort(preferredPort = 3000, host = 'localhost') {
  try {
    const port = await detectPort(preferredPort);
    return port;
  } catch (error) {
    // Fallback to manual search
    let port = preferredPort;
    while (await isPortInUse(port, host)) {
      port++;
      if (port > 65535) {
        throw new Error('No available ports found');
      }
    }
    return port;
  }
}

/**
 * Get a range of available ports
 */
export async function findAvailablePorts(count = 1, startPort = 3000) {
  const ports = [];
  let currentPort = startPort;
  
  while (ports.length < count) {
    const availablePort = await findAvailablePort(currentPort);
    ports.push(availablePort);
    currentPort = availablePort + 1;
  }
  
  return ports;
}

/**
 * Wait for a port to become available
 */
export async function waitForPort(port, options = {}) {
  const {
    host = 'localhost',
    timeout = 30000,
    interval = 1000
  } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (!await isPortInUse(port, host)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Port ${port} did not become available within ${timeout}ms`);
}

/**
 * Wait for a port to be in use (server started)
 */
export async function waitForPortInUse(port, options = {}) {
  const {
    host = 'localhost',
    timeout = 30000,
    interval = 1000
  } = options;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await isPortInUse(port, host)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Port ${port} was not in use within ${timeout}ms`);
}

/**
 * Parse port from various formats
 */
export function parsePort(input) {
  if (typeof input === 'number') {
    return input;
  }
  
  if (typeof input === 'string') {
    // Try to extract port from URLs like "http://localhost:3000"
    const urlMatch = input.match(/:(\d+)/);
    if (urlMatch) {
      return parseInt(urlMatch[1], 10);
    }
    
    // Try to parse as number
    const port = parseInt(input, 10);
    if (!isNaN(port)) {
      return port;
    }
  }
  
  return null;
}

/**
 * Validate port number
 */
export function isValidPort(port) {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Get commonly used ports for web development
 */
export function getCommonPorts() {
  return {
    http: 80,
    https: 443,
    react: 3000,
    vue: 8080,
    angular: 4200,
    next: 3000,
    nuxt: 3000,
    express: 3000,
    fastify: 3000,
    nestjs: 3000,
    strapi: 1337,
    gatsby: 8000,
    svelte: 5000,
    vite: 5173,
    webpack: 8080,
    parcel: 1234,
    storybook: 6006,
    json_server: 3001,
    graphql: 4000,
    mongodb: 27017,
    postgres: 5432,
    mysql: 3306,
    redis: 6379
  };
}

/**
 * Find processes running on a specific port
 */
export async function findProcessesOnPort(port) {
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

/**
 * Kill a process by PID
 */
async function killProcess(pid, force = false) {
  try {
    await execAsync(`kill ${force ? '-9' : ''} ${pid}`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Wait for a process to exit
 */
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

/**
 * Kill all processes running on a specific port
 * @param {number} port - Port number to clear
 * @param {Object} options - Options for killing processes
 * @param {boolean} options.force - Use SIGKILL instead of SIGTERM
 * @param {boolean} options.silent - Don't log to console
 * @returns {Promise<{killed: number, total: number, success: boolean}>}
 */
export async function killProcessesOnPort(port, options = {}) {
  const { force = false, silent = false } = options;
  
  const pids = await findProcessesOnPort(port);
  
  if (pids.length === 0) {
    return {
      killed: 0,
      total: 0,
      success: true
    };
  }
  
  if (!silent) {
    console.log(`Found ${pids.length} process${pids.length > 1 ? 'es' : ''} on port ${port}`);
  }
  
  let killedCount = 0;
  
  for (const pid of pids) {
    const success = await killProcess(pid, force);
    if (success) {
      killedCount++;
      if (!silent) {
        console.log(`  Killed process ${pid}`);
      }
      
      if (!force) {
        // Wait for graceful shutdown
        await waitForProcessToExit(pid, 5000);
      }
    }
  }
  
  // Verify port is now free
  await new Promise(resolve => setTimeout(resolve, 500));
  const remainingPids = await findProcessesOnPort(port);
  
  return {
    killed: killedCount,
    total: pids.length,
    success: remainingPids.length === 0
  };
}