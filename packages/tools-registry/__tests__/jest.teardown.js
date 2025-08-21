/**
 * Jest Global Teardown for tools-registry Tests
 * 
 * This file runs once after all tests to clean up ToolRegistry instances
 * and prevent Jest from hanging due to open handles (setInterval).
 */

import { globalCleanup } from './jest.setup.js';

/**
 * Global teardown function - runs once after all tests
 */
async function globalTeardown() {
  console.log('🧹 TEARDOWN: Cleaning up ToolRegistry instances...');
  
  try {
    await globalCleanup();
    console.log('✅ TEARDOWN: ToolRegistry cleanup completed');
  } catch (error) {
    console.error('❌ TEARDOWN: ToolRegistry cleanup failed:', error.message);
    // Don't fail the teardown - just log the error
  }
}

// Export the teardown function
export default globalTeardown;