/**
 * @fileoverview Simple process test for debugging
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ProcessManager } from '../../src/managers/ProcessManager.js';
import { SessionManager } from '../../src/managers/SessionManager.js';
import { LogStorage } from '../../src/storage/LogStorage.js';
import { MockStorageProvider } from '../utils/MockStorageProvider.js';
import fs from 'fs/promises';
import path from 'path';

describe('Simple Process Test', () => {
  let processManager;
  let sessionManager;
  let logStorage;
  let testProjectPath;

  beforeEach(async () => {
    // Create test project directory
    testProjectPath = path.join(process.cwd(), 'scratch', `simple-test-${Date.now()}`);
    await fs.mkdir(testProjectPath, { recursive: true });
    
    // Create a very simple test script
    const testScript = `console.log('Hello World');`;
    await fs.writeFile(path.join(testProjectPath, 'hello.js'), testScript);
    
    // Initialize components
    const mockStorage = new MockStorageProvider();
    logStorage = new LogStorage(mockStorage);
    sessionManager = new SessionManager(mockStorage);
    processManager = new ProcessManager(logStorage, sessionManager);
  });

  afterEach(async () => {
    // Clean up
    const activeProcesses = processManager.getRunningProcesses();
    for (const procId of activeProcesses) {
      await processManager.kill(procId);
    }
    
    if (testProjectPath) {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    }
  });

  it('should run a simple process and capture logs', async () => {
    // Create session
    const session = await sessionManager.createSession({
      projectPath: testProjectPath,
      command: 'node hello.js'
    });
    
    expect(session.sessionId).toBeTruthy();
    console.log('Created session:', session.sessionId);
    
    // Start process
    const result = await processManager.start({
      command: 'node',
      args: ['hello.js'],
      workingDir: testProjectPath,
      sessionId: session.sessionId
    });
    
    expect(result.processId).toBeTruthy();
    console.log('Started process:', result.processId);
    
    // Wait for process to complete and logs to be stored
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if process completed
    const processInfo = processManager.getProcessInfo(result.processId);
    console.log('Process info:', processInfo);
    
    // Get logs
    console.log('[DEBUG] Querying logs for session:', session.sessionId);
    const logs = await logStorage.getLogsBySession(session.sessionId);
    console.log('[DEBUG] Raw query result:', JSON.stringify(logs, null, 2));
    console.log('Captured logs:', logs.length);
    logs.forEach(log => {
      console.log(`  [${log.source}] ${log.message}`);
    });
    
    expect(logs.length).toBeGreaterThan(0);
    
    // Look for the specific output
    const helloLogs = logs.filter(log => log.message.includes('Hello World'));
    expect(helloLogs.length).toBeGreaterThan(0);
  }, 10000);
});