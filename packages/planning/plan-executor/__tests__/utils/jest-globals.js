/**
 * Setup Jest global functions
 */

// Jest globals should be automatically available in the test environment
// This file exists to ensure globals are properly configured

// Ensure all Jest globals are available
if (typeof jest === 'undefined') {
  console.warn('Jest globals are not available. This may indicate a configuration issue.');
}

// Set NODE_OPTIONS for ES modules
process.env.NODE_OPTIONS = '--experimental-vm-modules';