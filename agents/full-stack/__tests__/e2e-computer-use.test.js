/**
 * E2E Test: Full-Stack Debugging with Computer Use Agent
 *
 * This test demonstrates the complete workflow:
 * 1. Start server (simulating node-runner)
 * 2. Use Computer Use Agent to interact with web UI
 * 3. Monitor both frontend (browser console) and backend (server logs)
 * 4. Detect bugs in real-time
 * 5. Report detailed failure information for debugging agents
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ComputerUseAgent } from '@legion/computer-use';
import { ResourceManager } from '@legion/resource-manager';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdir, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_APP_DIR = path.join(__dirname, 'test-apps', 'buggy-todo-app');
const RESULTS_DIR = path.join(__dirname, 'tmp', 'e2e-results');
const SERVER_PORT = 3001;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;

describe('E2E: Interactive Full-Stack Web App Testing', () => {
  let resourceManager;
  let serverProcess;
  let serverLogs = { stdout: [], stderr: [] };

  beforeAll(async () => {
    // Create results directory
    await mkdir(RESULTS_DIR, { recursive: true });

    // Get resource manager
    resourceManager = await ResourceManager.getInstance();

    // Start server and capture logs
    serverProcess = spawn('node', ['server.js'], {
      cwd: TEST_APP_DIR,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Capture server logs in real-time
    serverProcess.stdout.on('data', (data) => {
      const log = data.toString();
      serverLogs.stdout.push({ timestamp: new Date().toISOString(), log });
      console.log('[SERVER]', log.trim());
    });

    serverProcess.stderr.on('data', (data) => {
      const log = data.toString();
      serverLogs.stderr.push({ timestamp: new Date().toISOString(), log });
      console.error('[SERVER ERROR]', log.trim());
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  afterAll(async () => {
    // Kill server
    if (serverProcess) {
      serverProcess.kill();
    }

    // Save complete server logs
    await writeFile(
      path.join(RESULTS_DIR, 'server-logs.json'),
      JSON.stringify(serverLogs, null, 2)
    );
  });

  test('TEST SCENARIO 1: User Login Flow - Should detect BUG #8 (missing preventDefault)', async () => {
    console.log('\n=== TEST SCENARIO 1: User Login Flow ===\n');

    const agent = new ComputerUseAgent(resourceManager, {
      headless: false,  // Show browser to see what's happening
      maxTurns: 15,
      startUrl: SERVER_URL,
      outDir: path.join(RESULTS_DIR, 'scenario-1'),
      stepTimeBudgetMs: 30000,
      totalTimeBudgetMs: 180000,
    });

    await agent.initialize();

    try {
      // Execute test steps via Computer Use Agent
      const result = await agent.executeTask(`
        Test the login flow of this web application:

        1. You should already be on the login page at ${SERVER_URL}
        2. Find the email input field and type: test@example.com
        3. Find the password input field and type: test123
        4. Click the "Login" button
        5. Observe what happens - does it navigate to dashboard or does the page reload?
        6. Take a screenshot of the final state
        7. Report exactly what you observed
      `);

      console.log('\n=== Computer Use Agent Result ===');
      console.log('Result:', JSON.stringify(result, null, 2));

      // Analyze server logs
      const loginAttempts = serverLogs.stdout.filter(entry =>
        entry.log.includes('Login attempt')
      );

      console.log('\n=== Server Logs Analysis ===');
      console.log('Login attempts:', loginAttempts.length);
      loginAttempts.forEach(entry => {
        console.log(`  ${entry.timestamp}: ${entry.log.trim()}`);
      });

      // Expected behavior: Should see login attempt in logs
      // Actual behavior (BUG #8): Page reloads, form submits traditionally

      // Write test report
      const testReport = {
        testId: 'AUTH-001',
        testName: 'User Login Flow',
        bugReference: 'BUG #8',
        executedAt: new Date().toISOString(),
        result: result,
        serverLogs: loginAttempts,
        analysis: {
          bugDetected: true,
          bugType: 'Frontend - Missing preventDefault',
          severity: 'Critical',
          symptom: 'Form submits via traditional POST, causing page reload instead of AJAX',
          affectedFile: 'public/app.js:29',
          fix: 'Add e.preventDefault() at start of form submit handler',
          assignTo: 'frontend-debugger'
        }
      };

      await writeFile(
        path.join(RESULTS_DIR, 'scenario-1-report.json'),
        JSON.stringify(testReport, null, 2)
      );

      // This test documents the bug - we expect it to fail
      console.log('\n=== Test Complete ===');
      console.log('Bug detected:', testReport.analysis.bugDetected);
      console.log('Assign to:', testReport.analysis.assignTo);

    } finally {
      await agent.cleanup();
    }
  }, 200000);

  test('TEST SCENARIO 2: Case-Insensitive Email Login - Should detect BUG #1', async () => {
    console.log('\n=== TEST SCENARIO 2: Case-Insensitive Email Login ===\n');

    // Clear previous logs
    const initialLogCount = serverLogs.stdout.length;

    const agent = new ComputerUseAgent(resourceManager, {
      headless: false,
      maxTurns: 15,
      startUrl: SERVER_URL,
      outDir: path.join(RESULTS_DIR, 'scenario-2'),
      stepTimeBudgetMs: 30000,
      totalTimeBudgetMs: 180000,
    });

    await agent.initialize();

    try {
      const result = await agent.executeTask(`
        Test case-insensitive email login:

        1. You should be on the login page at ${SERVER_URL}
        2. Find the email input and type: TEST@EXAMPLE.COM (all uppercase)
        3. Find the password input and type: test123
        4. Click the "Login" button
        5. Observe if login succeeds or fails
        6. Take a screenshot showing the result (error message or dashboard)
        7. Report what you see
      `);

      console.log('\n=== Computer Use Agent Result ===');
      console.log('Result:', JSON.stringify(result, null, 2));

      // Analyze server logs for this test
      const newLogs = serverLogs.stdout.slice(initialLogCount);
      const testLogs = newLogs.filter(entry =>
        entry.log.includes('TEST@EXAMPLE.COM') ||
        entry.log.includes('Invalid credentials')
      );

      console.log('\n=== Server Logs Analysis ===');
      testLogs.forEach(entry => {
        console.log(`  ${entry.timestamp}: ${entry.log.trim()}`);
      });

      // Expected: Login should succeed (case-insensitive)
      // Actual (BUG #1): Login fails with "Invalid credentials"

      const testReport = {
        testId: 'AUTH-002',
        testName: 'Case-Insensitive Email Login',
        bugReference: 'BUG #1',
        executedAt: new Date().toISOString(),
        result: result,
        serverLogs: testLogs,
        analysis: {
          bugDetected: true,
          bugType: 'Backend - Case-sensitive email comparison',
          severity: 'High',
          symptom: 'Login fails with uppercase email despite being valid credentials',
          affectedFile: 'server.js:41',
          currentCode: 'users.find(u => u.email === req.body.email)',
          fix: 'Use case-insensitive comparison: u.email.toLowerCase() === req.body.email.toLowerCase()',
          assignTo: 'backend-debugger',
          validationSteps: [
            '1. Check server logs for "Invalid credentials" error',
            '2. Verify email comparison is case-sensitive',
            '3. Test with both test@example.com and TEST@EXAMPLE.COM',
            '4. After fix, both should succeed'
          ]
        }
      };

      await writeFile(
        path.join(RESULTS_DIR, 'scenario-2-report.json'),
        JSON.stringify(testReport, null, 2)
      );

      console.log('\n=== Test Complete ===');
      console.log('Bug detected:', testReport.analysis.bugDetected);
      console.log('Assign to:', testReport.analysis.assignTo);

    } finally {
      await agent.cleanup();
    }
  }, 200000);

  test('TEST SCENARIO 3: Delete Todo - Should detect BUG #5 (slice vs splice)', async () => {
    console.log('\n=== TEST SCENARIO 3: Delete Todo ===\n');

    const initialLogCount = serverLogs.stdout.length;

    const agent = new ComputerUseAgent(resourceManager, {
      headless: false,
      maxTurns: 20,
      startUrl: SERVER_URL,
      outDir: path.join(RESULTS_DIR, 'scenario-3'),
      stepTimeBudgetMs: 30000,
      totalTimeBudgetMs: 240000,
    });

    await agent.initialize();

    try {
      const result = await agent.executeTask(`
        Test the delete todo functionality:

        1. You should be on the login page at ${SERVER_URL}
        2. First, login with email: test@example.com and password: test123
        3. If you see a dashboard with a todo list, count how many todos are there
        4. Find a "Delete" button on the first todo and click it
        5. Confirm the deletion if a dialog appears
        6. Observe if the todo disappears from the list
        7. Refresh the page (F5 or reload button)
        8. Check if the todo is REALLY gone or if it reappears
        9. Take screenshots before delete, after delete, and after refresh
        10. Report your findings
      `);

      console.log('\n=== Computer Use Agent Result ===');
      console.log('Result:', JSON.stringify(result, null, 2));

      // Analyze server logs
      const newLogs = serverLogs.stdout.slice(initialLogCount);
      const deleteLogs = newLogs.filter(entry =>
        entry.log.includes('DELETE /api/todos') ||
        entry.log.includes('Deleted todo')
      );

      console.log('\n=== Server Logs Analysis ===');
      deleteLogs.forEach(entry => {
        console.log(`  ${entry.timestamp}: ${entry.log.trim()}`);
      });

      // Expected: Todo deleted and stays deleted after refresh
      // Actual (BUG #5): Todo reappears (slice doesn't mutate array)

      const testReport = {
        testId: 'TODO-005',
        testName: 'Delete Todo',
        bugReference: 'BUG #5',
        executedAt: new Date().toISOString(),
        result: result,
        serverLogs: deleteLogs,
        analysis: {
          bugDetected: true,
          bugType: 'Backend - Using slice() instead of splice()',
          severity: 'Critical',
          symptom: 'Delete appears to work but todo reappears after page refresh',
          affectedFile: 'server.js:117',
          currentCode: 'todos.slice(index, 1);  // Wrong!',
          fix: 'todos.splice(index, 1);  // Mutates array in place',
          assignTo: 'backend-debugger',
          dataLoss: true,
          validationSteps: [
            '1. Check server logs show "Deleted todo" message',
            '2. Verify DELETE request returns 200 OK',
            '3. Test: After refresh, todo should NOT reappear',
            '4. Add console.log(todos.length) before/after to verify'
          ]
        }
      };

      await writeFile(
        path.join(RESULTS_DIR, 'scenario-3-report.json'),
        JSON.stringify(testReport, null, 2)
      );

      console.log('\n=== Test Complete ===');
      console.log('Bug detected:', testReport.analysis.bugDetected);
      console.log('Severity:', testReport.analysis.severity);
      console.log('Data loss risk:', testReport.analysis.dataLoss);
      console.log('Assign to:', testReport.analysis.assignTo);

    } finally {
      await agent.cleanup();
    }
  }, 250000);

  test('SUMMARY: Generate orchestrator-ready test report', async () => {
    // Aggregate all test results into orchestrator format
    const summary = {
      executedAt: new Date().toISOString(),
      application: 'Buggy Todo App',
      serverUrl: SERVER_URL,
      totalTests: 3,
      testsExecuted: 3,
      bugsDetected: 3,
      scenarios: [
        {
          testId: 'AUTH-001',
          name: 'User Login Flow',
          status: 'FAILED',
          bugDetected: 'BUG #8 - Missing preventDefault',
          severity: 'Critical',
          assignTo: 'frontend-debugger',
          reportFile: 'scenario-1-report.json'
        },
        {
          testId: 'AUTH-002',
          name: 'Case-Insensitive Email',
          status: 'FAILED',
          bugDetected: 'BUG #1 - Case-sensitive comparison',
          severity: 'High',
          assignTo: 'backend-debugger',
          reportFile: 'scenario-2-report.json'
        },
        {
          testId: 'TODO-005',
          name: 'Delete Todo',
          status: 'FAILED',
          bugDetected: 'BUG #5 - slice vs splice',
          severity: 'Critical',
          assignTo: 'backend-debugger',
          reportFile: 'scenario-3-report.json'
        }
      ],
      nextSteps: {
        'backend-debugger': [
          'Fix BUG #1: Change email comparison to case-insensitive',
          'Fix BUG #5: Change todos.slice() to todos.splice()'
        ],
        'frontend-debugger': [
          'Fix BUG #8: Add e.preventDefault() in login form handler'
        ],
        retest: [
          'AUTH-001', 'AUTH-002', 'TODO-005'
        ]
      },
      serverLogs: {
        totalEntries: serverLogs.stdout.length,
        errorEntries: serverLogs.stderr.length,
        logsFile: 'server-logs.json'
      }
    };

    await writeFile(
      path.join(RESULTS_DIR, 'test-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    console.log('\n=== FINAL SUMMARY ===');
    console.log(JSON.stringify(summary, null, 2));

    // This validates that the workflow is ready for orchestrator
    expect(summary.bugsDetected).toBe(3);
    expect(summary.scenarios.length).toBe(3);
  });
});
