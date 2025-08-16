/**
 * Jest Setup for FullStack Monitor Tests
 * Configures test environment and global cleanup
 */

import { jest } from '@jest/globals';

// Set test timeout for integration tests
jest.setTimeout(30000);

// Track active resources for cleanup
const activeResources = {
  monitors: new Set(),
  processes: new Set(),
  servers: new Set()
};

// Global cleanup handler
global.cleanupResources = async () => {
  // Cleanup monitors
  for (const monitor of activeResources.monitors) {
    try {
      await monitor.cleanup();
    } catch (error) {
      console.warn('Failed to cleanup monitor:', error.message);
    }
  }
  activeResources.monitors.clear();

  // Kill processes
  for (const process of activeResources.processes) {
    try {
      if (!process.killed) {
        process.kill('SIGTERM');
      }
    } catch (error) {
      console.warn('Failed to kill process:', error.message);
    }
  }
  activeResources.processes.clear();

  // Close servers
  for (const server of activeResources.servers) {
    try {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      console.warn('Failed to close server:', error.message);
    }
  }
  activeResources.servers.clear();
};

// Track resources
global.trackMonitor = (monitor) => {
  activeResources.monitors.add(monitor);
};

global.trackProcess = (process) => {
  activeResources.processes.add(process);
};

global.trackServer = (server) => {
  activeResources.servers.add(server);
};

// Cleanup after all tests
afterAll(async () => {
  await global.cleanupResources();
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

// Suppress console output during tests unless DEBUG is set
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error output
    error: console.error
  };
}