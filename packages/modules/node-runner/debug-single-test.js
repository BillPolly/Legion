#!/usr/bin/env node

// Simple test to debug what's actually happening
import { jest } from '@jest/globals';
import { RunNodeTool } from './src/tools/RunNodeTool.js';

console.log('=== STARTING DEBUG TEST ===\n');

// Create mock module
const mockModule = {
  processManager: {
    start: jest.fn().mockResolvedValue({ processId: 'test-process-123', process: {} }),
    getRunningProcesses: jest.fn().mockReturnValue([]),
    getProcessInfo: jest.fn().mockReturnValue({ status: 'running' })
  },
  sessionManager: {
    createSession: jest.fn().mockResolvedValue({ sessionId: 'test-session-123' }),
    updateSession: jest.fn().mockResolvedValue(true)
  },
  packageManager: {
    installDependencies: jest.fn().mockResolvedValue(true),
    validatePackageJson: jest.fn().mockResolvedValue(true)
  }
};

console.log('1. Creating RunNodeTool instance...');
let runNodeTool;
try {
  runNodeTool = new RunNodeTool(mockModule);
  console.log('✓ RunNodeTool created successfully');
  console.log('  - Tool name:', runNodeTool.name);
  console.log('  - Has execute method:', typeof runNodeTool.execute);
  console.log('  - Has _execute method:', typeof runNodeTool._execute);
  console.log('  - Has inputSchema:', !!runNodeTool.inputSchema);
} catch (error) {
  console.log('✗ Failed to create RunNodeTool:', error.message);
  process.exit(1);
}

console.log('\n2. Testing with valid input...');
const validInput = {
  projectPath: process.cwd(),
  command: 'npm start'
};

console.log('  Input:', JSON.stringify(validInput, null, 2));

try {
  const result = await runNodeTool.execute(validInput);
  console.log('\n✓ Execute completed without throwing');
  console.log('  Result type:', typeof result);
  console.log('  Result is null:', result === null);
  console.log('  Result is undefined:', result === undefined);
  
  if (result) {
    console.log('  Result keys:', Object.keys(result));
    console.log('  Result.success:', result.success);
    console.log('  Result.error:', result.error);
    console.log('  Result.data type:', typeof result.data);
    if (result.data) {
      console.log('  Result.data keys:', Object.keys(result.data));
    }
    console.log('\n  Full result:', JSON.stringify(result, null, 2));
  }
  
} catch (error) {
  console.log('\n✗ Execute threw an error:');
  console.log('  Error message:', error.message);
  console.log('  Error stack:', error.stack);
}

console.log('\n=== END DEBUG TEST ===');