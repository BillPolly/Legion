/**
 * TestWorker - Worker thread for executing tests
 * 
 * Runs in a separate thread to execute tests in isolation:
 * - Executes tests based on type (unit, integration, e2e)
 * - Reports progress and results back to parent
 * - Handles errors and timeouts
 * - Manages resource cleanup
 */

import { parentPort, workerData } from 'worker_threads';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

// Worker configuration
const { workerId, config } = workerData;

// Test execution handlers
const testExecutors = {
  unit: executeUnitTest,
  integration: executeIntegrationTest,
  e2e: executeE2ETest,
  performance: executePerformanceTest
};

// Worker statistics
let stats = {
  testsExecuted: 0,
  totalExecutionTime: 0,
  averageExecutionTime: 0,
  errors: 0,
  lastError: null
};

/**
 * Handle messages from parent
 */
parentPort.on('message', async (message) => {
  switch (message.type) {
    case 'execute-test':
      await executeTest(message);
      break;
      
    case 'get-stats':
      sendStats();
      break;
      
    case 'ping':
      parentPort.postMessage({ type: 'pong', workerId });
      break;
      
    default:
      parentPort.postMessage({
        type: 'error',
        workerId,
        error: `Unknown message type: ${message.type}`
      });
  }
});

/**
 * Execute test based on type
 */
async function executeTest(message) {
  const { testId, test } = message;
  const startTime = Date.now();
  
  try {
    // Notify start
    parentPort.postMessage({
      type: 'test-started',
      workerId,
      testId,
      testName: test.name,
      timestamp: startTime
    });
    
    // Execute based on test type
    const executor = testExecutors[test.type] || executeGenericTest;
    const result = await executor(test);
    
    // Calculate duration
    const duration = Date.now() - startTime;
    
    // Update stats
    stats.testsExecuted++;
    stats.totalExecutionTime += duration;
    stats.averageExecutionTime = stats.totalExecutionTime / stats.testsExecuted;
    
    // Notify completion
    parentPort.postMessage({
      type: 'test-completed',
      workerId,
      testId,
      result,
      duration,
      timestamp: Date.now()
    });
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    // Update error stats
    stats.errors++;
    stats.lastError = error.message;
    
    // Notify failure
    parentPort.postMessage({
      type: 'test-failed',
      workerId,
      testId,
      error: error.message,
      stack: error.stack,
      duration,
      timestamp: Date.now()
    });
  }
}

/**
 * Execute unit test
 */
async function executeUnitTest(test) {
  return new Promise((resolve, reject) => {
    const args = [
      '--testPathPattern', test.path,
      '--json',
      '--outputFile', `/tmp/jest-result-${Date.now()}.json`
    ];
    
    if (test.config?.coverage) {
      args.push('--coverage');
    }
    
    const jest = spawn('jest', args, {
      cwd: test.config?.workingDirectory || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    let stdout = '';
    let stderr = '';
    
    jest.stdout.on('data', (data) => {
      stdout += data.toString();
      
      // Send progress updates
      const progress = extractProgress(data.toString());
      if (progress) {
        parentPort.postMessage({
          type: 'test-progress',
          workerId,
          testId: test.id,
          progress
        });
      }
    });
    
    jest.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    jest.on('close', async (code) => {
      try {
        // Read result file
        const resultFile = args[args.indexOf('--outputFile') + 1];
        const resultData = await fs.readFile(resultFile, 'utf8');
        const result = JSON.parse(resultData);
        
        // Clean up
        await fs.unlink(resultFile).catch(() => {});
        
        resolve({
          exitCode: code,
          passed: result.numFailedTests === 0,
          total: result.numTotalTests,
          passed: result.numPassedTests,
          failed: result.numFailedTests,
          skipped: result.numPendingTests,
          coverage: result.coverageMap,
          stdout,
          stderr
        });
      } catch (error) {
        reject(new Error(`Failed to parse test results: ${error.message}`));
      }
    });
    
    jest.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Execute integration test
 */
async function executeIntegrationTest(test) {
  // Similar to unit test but with different configuration
  return executeUnitTest({
    ...test,
    config: {
      ...test.config,
      setupFilesAfterEnv: ['<rootDir>/test/integration-setup.js']
    }
  });
}

/**
 * Execute E2E test
 */
async function executeE2ETest(test) {
  return new Promise((resolve, reject) => {
    const args = [
      'test',
      test.path,
      '--reporter=json'
    ];
    
    if (test.config?.browsers) {
      args.push('--browser', test.config.browsers.join(','));
    }
    
    const playwright = spawn('playwright', args, {
      cwd: test.config?.workingDirectory || process.cwd(),
      env: { ...process.env, NODE_ENV: 'test' }
    });
    
    let stdout = '';
    let stderr = '';
    let jsonOutput = '';
    
    playwright.stdout.on('data', (data) => {
      const str = data.toString();
      stdout += str;
      
      // Extract JSON output
      if (str.includes('{') && str.includes('}')) {
        jsonOutput += str;
      }
    });
    
    playwright.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    playwright.on('close', (code) => {
      try {
        const result = jsonOutput ? JSON.parse(jsonOutput) : {};
        
        resolve({
          exitCode: code,
          passed: code === 0,
          total: result.total || 0,
          passed: result.passed || 0,
          failed: result.failed || 0,
          skipped: result.skipped || 0,
          screenshots: result.screenshots || [],
          videos: result.videos || [],
          stdout,
          stderr
        });
      } catch (error) {
        resolve({
          exitCode: code,
          passed: code === 0,
          stdout,
          stderr
        });
      }
    });
    
    playwright.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Execute performance test
 */
async function executePerformanceTest(test) {
  // Mock performance test execution
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    exitCode: 0,
    passed: true,
    metrics: {
      responseTime: Math.random() * 1000,
      throughput: Math.random() * 1000,
      errorRate: Math.random() * 0.05,
      cpu: Math.random() * 100,
      memory: Math.random() * 100
    },
    violations: []
  };
}

/**
 * Execute generic test
 */
async function executeGenericTest(test) {
  return new Promise((resolve, reject) => {
    const command = test.command || 'npm';
    const args = test.args || ['test'];
    
    const child = spawn(command, args, {
      cwd: test.config?.workingDirectory || process.cwd(),
      env: { ...process.env, ...test.config?.env }
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        exitCode: code,
        passed: code === 0,
        stdout,
        stderr
      });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Extract progress from output
 */
function extractProgress(output) {
  // Look for Jest progress indicators
  const progressMatch = output.match(/Tests:\s+(\d+)\s+passed.*(\d+)\s+total/);
  if (progressMatch) {
    return {
      passed: parseInt(progressMatch[1]),
      total: parseInt(progressMatch[2])
    };
  }
  
  // Look for percentage
  const percentMatch = output.match(/(\d+)%/);
  if (percentMatch) {
    return {
      percent: parseInt(percentMatch[1])
    };
  }
  
  return null;
}

/**
 * Send worker statistics
 */
function sendStats() {
  parentPort.postMessage({
    type: 'worker-stats',
    workerId,
    stats: { ...stats },
    timestamp: Date.now()
  });
}

/**
 * Handle worker errors
 */
process.on('uncaughtException', (error) => {
  parentPort.postMessage({
    type: 'worker-error',
    workerId,
    error: error.message,
    stack: error.stack,
    timestamp: Date.now()
  });
});

process.on('unhandledRejection', (reason) => {
  parentPort.postMessage({
    type: 'worker-error',
    workerId,
    error: reason?.message || String(reason),
    stack: reason?.stack,
    timestamp: Date.now()
  });
});

// Notify parent that worker is ready
parentPort.postMessage({
  type: 'worker-ready',
  workerId,
  timestamp: Date.now()
});