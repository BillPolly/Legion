/**
 * Single test to debug issue
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RunNodeTool } from '../../src/tools/RunNodeTool.js';

describe('DEBUG SINGLE TEST', () => {
  let runNodeTool;
  let mockModule;

  beforeEach(() => {
    mockModule = {
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
    
    console.log('Creating RunNodeTool...');
    runNodeTool = new RunNodeTool(mockModule);
    console.log('RunNodeTool created, name:', runNodeTool.name);
  });

  it('should work with valid input', async () => {
    const validInput = {
      projectPath: process.cwd(),
      command: 'npm start'
    };

    console.log('\n=== TEST START ===');
    console.log('1. Input:', JSON.stringify(validInput, null, 2));
    console.log('2. Current directory:', process.cwd());
    
    // Check if tool was created properly
    console.log('3. Tool check:');
    console.log('   - Tool exists:', !!runNodeTool);
    console.log('   - Tool.execute type:', typeof runNodeTool.execute);
    console.log('   - Tool._execute type:', typeof runNodeTool._execute);
    console.log('   - Tool.validator exists:', !!runNodeTool.validator);
    
    let result;
    try {
      console.log('4. Calling execute...');
      result = await runNodeTool.execute(validInput);
      console.log('5. Execute returned successfully');
    } catch (error) {
      console.log('5. Execute THREW ERROR:');
      console.log('   - Error message:', error.message);
      console.log('   - Error name:', error.name);
      console.log('   - Error stack:', error.stack);
      throw error;
    }
    
    console.log('6. Result analysis:');
    console.log('   - Result is null:', result === null);
    console.log('   - Result is undefined:', result === undefined);
    console.log('   - Result type:', typeof result);
    
    if (result !== null && result !== undefined) {
      console.log('   - Result keys:', Object.keys(result));
      console.log('   - Result.success exists:', 'success' in result);
      console.log('   - Result.success value:', result.success);
      console.log('   - Result.success type:', typeof result.success);
      console.log('   - Result.error exists:', 'error' in result);
      console.log('   - Result.error value:', result.error);
      console.log('   - Result.data exists:', 'data' in result);
      console.log('   - Result.data value:', result.data);
      console.log('   - Result.data type:', typeof result.data);
      
      console.log('7. Full result object:');
      console.log(JSON.stringify(result, null, 2));
    }
    
    console.log('8. Running assertions...');
    
    // Now do the actual test
    console.log('   - Asserting result is defined...');
    expect(result).toBeDefined();
    
    console.log('   - Asserting result.success is true...');
    console.log('     Actual value:', result.success);
    console.log('     Expected value: true');
    expect(result.success).toBe(true);
    
    console.log('   - Asserting result.data is defined...');
    expect(result.data).toBeDefined();
    
    console.log('=== TEST COMPLETE ===\n');
  });
});