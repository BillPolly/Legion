#!/usr/bin/env node

/**
 * Check Status Script
 * 
 * Shows the current status of the 3-collection perspective system
 * Displays statistics, coverage, and sample data
 * 
 * Usage:
 *   node scripts/check-status.js           # Show basic status
 *   node scripts/check-status.js --verbose # Show detailed status with samples
 */

import { ToolRegistry } from '../src/index.js';

async function checkStatus(options = {}) {
  const { verbose = false } = options;
  
  try {
    // Get ToolRegistry singleton
    const toolRegistry = await ToolRegistry.getInstance();
    
    // Get system status through the singleton - it handles everything
    await toolRegistry.getSystemStatus({ verbose });
    
  } catch (error) {
    console.error('❌ Error checking status:', error.message);
    if (verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--verbose' || args[i] === '-v') {
    options.verbose = true;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Check Status Script

Usage:
  node scripts/check-status.js [options]

Options:
  --verbose, -v    Show detailed output with samples
  --help, -h       Show this help message

Examples:
  node scripts/check-status.js
  node scripts/check-status.js --verbose
    `);
    process.exit(0);
  }
}

// Run the script
checkStatus(options).catch(console.error);