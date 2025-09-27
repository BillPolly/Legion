/**
 * Synchronous wrapper utilities for MongoDB async operations
 * 
 * NOTE: This is a simplified MVP implementation using deasync.
 * For production, this would need to use worker threads or a different architecture.
 * 
 * This implementation uses deasync for MVP testing only.
 * NOT suitable for production use with high concurrency!
 */

import { createRequire } from 'module';

// Create require function for loading CommonJS modules
const require = createRequire(import.meta.url);

// Lazy-load deasync
let deasync = null;
let deasyncLoaded = false;

function loadDeasync() {
  if (!deasyncLoaded) {
    try {
      // Use require for synchronous loading of CommonJS deasync module
      deasync = require('deasync');
    } catch (err) {
      // deasync not available
      deasync = null;
    }
    deasyncLoaded = true;
  }
  return deasync;
}

/**
 * Make an async MongoDB operation synchronous
 * WARNING: This blocks the event loop - MVP only!
 * 
 * @param {Function} asyncOperation - Async function to execute
 * @returns {*} Result of the operation
 */
export function makeSyncOperation(asyncOperation) {
  // Load deasync on first use
  const deasyncLib = loadDeasync();
  
  let result;
  let error;
  let done = false;
  
  // Start the async operation
  asyncOperation()
    .then(res => {
      result = res;
      done = true;
    })
    .catch(err => {
      error = err;
      done = true;
    });
  
  if (deasyncLib) {
    // Use deasync's loopWhile which properly processes the event loop
    deasyncLib.loopWhile(() => !done);
  } else {
    // Fallback: Basic polling with setImmediate to allow event loop processing
    // For MVP testing only - requires deasync in production
    throw new Error('deasync library is required for synchronous MongoDB operations. Install with: npm install deasync');
  }
  
  if (error) {
    throw error;
  }
  
  return result;
}