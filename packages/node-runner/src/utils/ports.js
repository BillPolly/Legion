import net from 'net';
import detectPort from 'detect-port';

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