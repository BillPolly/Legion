#!/usr/bin/env node

/**
 * Test runner for TaskOrchestrator tests
 * 
 * This script runs the TaskOrchestrator test suite with proper ES module support
 * and environment configuration.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const runTests = () => {
  console.log('🧪 Running TaskOrchestrator Test Suite...\n');
  
  const jestConfig = join(__dirname, 'jest.config.js');
  const testDir = __dirname;
  
  const jest = spawn('npx', [
    'jest',
    '--config', jestConfig,
    '--testPathPattern', testDir,
    '--verbose',
    '--forceExit',
    '--detectOpenHandles'
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--experimental-vm-modules'
    }
  });
  
  jest.on('close', (code) => {
    console.log(`\n🏁 Tests completed with exit code: ${code}`);
    process.exit(code);
  });
  
  jest.on('error', (error) => {
    console.error('❌ Failed to run tests:', error);
    process.exit(1);
  });
};

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted');
  process.exit(130);
});

runTests();