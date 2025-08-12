/**
 * Jest global setup - runs once before all test suites
 */

import { killPort } from './__tests__/utils/killPort.js';

// Kill any process on port 9901 before tests start
global.beforeAll(async () => {
  console.log('🧹 Cleaning up port 9901 before tests...');
  await killPort(9901);
  // Wait a bit for port to be fully released
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Add global cleanup
global.afterAll(async () => {
  // Give time for any async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});