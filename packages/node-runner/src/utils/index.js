/**
 * @fileoverview Core utilities for Node Runner
 */

import { randomBytes } from 'crypto';
import { createServer } from 'net';

/**
 * Generate a unique ID for sessions, processes, etc.
 * @returns {string} Unique identifier
 */
export function generateId() {
  const timestamp = Date.now().toString(36);
  const randomPart = randomBytes(6).toString('hex');
  return `${timestamp}-${randomPart}`;
}

/**
 * Check if a port is available for use
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available
 */
export function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve(true);
      });
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Find an available port starting from a preferred port
 * @param {number} preferredPort - Starting port to check (default: 3000)
 * @param {number} maxAttempts - Maximum number of ports to check (default: 100)
 * @returns {Promise<number>} Available port number
 * @throws {Error} If no available port found within range
 */
export async function findAvailablePort(preferredPort = 3000, maxAttempts = 100) {
  let port = preferredPort;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
    attempts++;
    
    // Wrap around if we exceed port range
    if (port >= 65536) {
      port = 1024;
    }
  }
  
  throw new Error(`No available port found after checking ${maxAttempts} ports starting from ${preferredPort}`);
}