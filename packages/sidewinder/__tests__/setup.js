/**
 * Jest setup for Sidewinder tests
 */

import { jest } from '@jest/globals';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
global.waitForCondition = async (condition, timeout = 5000, interval = 100) => {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
};

// Cleanup helper
global.cleanupProcesses = [];
afterEach(() => {
  // Kill any leftover processes
  global.cleanupProcesses.forEach(proc => {
    try {
      proc.kill('SIGTERM');
    } catch (e) {
      // Process may already be dead
    }
  });
  global.cleanupProcesses = [];
});