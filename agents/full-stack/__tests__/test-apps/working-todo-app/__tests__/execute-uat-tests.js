/**
 * UAT Test Execution Script
 * Executes the first 5 critical test scenarios using Computer Use Agent
 */

import { ComputerUseAgent } from '@legion/computer-use';
import { ResourceManager } from '@legion/resource-manager';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const APP_URL = 'http://localhost:3002';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshots directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Copy screenshots from agent output to test screenshots directory
async function copyScreenshots(agentOutDir, scenarioId) {
  const scenarioDir = path.join(SCREENSHOTS_DIR, `scenario-${scenarioId}`);
  ensureDir(scenarioDir);

  if (!fs.existsSync(agentOutDir)) {
    console.log(`Warning: Agent output directory ${agentOutDir} does not exist`);
    return [];
  }

  const files = fs.readdirSync(agentOutDir);
  const screenshots = [];

  for (const file of files) {
    if (file.endsWith('.png')) {
      const srcPath = path.join(agentOutDir, file);
      const destPath = path.join(scenarioDir, file);
      fs.copyFileSync(srcPath, destPath);
      screenshots.push(destPath);
    }
  }

  console.log(`✓ Copied ${screenshots.length} screenshots to scenario-${scenarioId}/`);
  return screenshots;
}

// Test results storage
const testResults = [];

// Test Scenario 1: User Registration - Valid Registration
async function testScenario001(agent) {
  console.log('\n=== Test Scenario UAT-001: User Registration - Valid Registration ===\n');

  const result = {
    id: 'UAT-001',
    name: 'User Registration - Valid Registration',
    status: 'RUNNING',
    steps: [],
    screenshots: [],
    errors: []
  };

  try {
    const testEmail = `testuser${Date.now()}@example.com`;
    const task = `
Navigate to ${APP_URL} and perform these steps:
1. Wait for the page to load
2. Click the "Register" tab
3. Fill in the registration form:
   - Name: "Test User"
   - Email: "${testEmail}"
   - Password: "password123"
4. Click the "Register" button
5. Wait for the dashboard to load
6. Verify that the welcome message appears with "Welcome, Test User!"
7. Take a final screenshot of the empty todo list
`;

    console.log('Executing registration task...');
    const taskResult = await agent.executeTask(task);

    if (taskResult.ok) {
      result.status = 'PASS';
      result.steps.push({ step: 1, status: 'PASS', description: 'Registration completed successfully' });
      console.log('✓ Registration Result:', taskResult.resultText);
    } else {
      throw new Error(taskResult.error || 'Task did not complete successfully');
    }

    // Copy screenshots
    result.screenshots = await copyScreenshots(taskResult.outDir, '001');

    console.log('✓ Scenario UAT-001 PASSED\n');
  } catch (error) {
    result.status = 'FAIL';
    result.errors.push(error.message);
    console.error('✗ Scenario UAT-001 FAILED:', error.message, '\n');
  }

  testResults.push(result);
  return result;
}

// Test Scenario 2: Duplicate Email Handling
async function testScenario002(agent) {
  console.log('\n=== Test Scenario UAT-002: Duplicate Email Handling ===\n');

  const result = {
    id: 'UAT-002',
    name: 'Duplicate Email Handling',
    status: 'RUNNING',
    steps: [],
    screenshots: [],
    errors: []
  };

  try {
    const task = `
You are currently on the todo app dashboard. Perform these steps:
1. Click the "Logout" button in the header
2. Wait for the login page to load
3. Click the "Register" tab
4. Try to register with a duplicate email:
   - Name: "Duplicate User"
   - Email: "testuser@example.com" (this email should already exist)
   - Password: "password456"
5. Click the "Register" button
6. Verify that an error message appears saying "User already exists"
7. Take a screenshot showing the error message
`;

    console.log('Executing duplicate email test...');
    const taskResult = await agent.executeTask(task);

    if (taskResult.ok) {
      result.status = 'PASS';
      result.steps.push({ step: 1, status: 'PASS', description: 'Duplicate email error displayed correctly' });
      console.log('✓ Duplicate Email Result:', taskResult.resultText);
    } else {
      throw new Error(taskResult.error || 'Task did not complete successfully');
    }

    result.screenshots = await copyScreenshots(taskResult.outDir, '002');
    console.log('✓ Scenario UAT-002 PASSED\n');
  } catch (error) {
    result.status = 'FAIL';
    result.errors.push(error.message);
    console.error('✗ Scenario UAT-002 FAILED:', error.message, '\n');
  }

  testResults.push(result);
  return result;
}

// Test Scenario 6: User Login - Valid Credentials
async function testScenario006(agent) {
  console.log('\n=== Test Scenario UAT-006: User Login - Valid Credentials ===\n');

  const result = {
    id: 'UAT-006',
    name: 'User Login - Valid Credentials',
    status: 'RUNNING',
    steps: [],
    screenshots: [],
    errors: []
  };

  try {
    const task = `
Navigate to ${APP_URL} and perform these steps:
1. Ensure you are on the login page (if not, click the "Login" tab)
2. Enter credentials:
   - Email: "testuser@example.com"
   - Password: "password123"
3. Click the "Login" button
4. Wait for the dashboard to load
5. Verify that the welcome message appears
6. Verify that the user's todos are displayed (or empty state if no todos)
7. Take a final screenshot of the logged-in dashboard
`;

    console.log('Executing login test...');
    const taskResult = await agent.executeTask(task);

    if (taskResult.ok) {
      result.status = 'PASS';
      result.steps.push({ step: 1, status: 'PASS', description: 'Login successful' });
      console.log('✓ Login Result:', taskResult.resultText);
    } else {
      throw new Error(taskResult.error || 'Task did not complete successfully');
    }

    result.screenshots = await copyScreenshots(taskResult.outDir, '006');
    console.log('✓ Scenario UAT-006 PASSED\n');
  } catch (error) {
    result.status = 'FAIL';
    result.errors.push(error.message);
    console.error('✗ Scenario UAT-006 FAILED:', error.message, '\n');
  }

  testResults.push(result);
  return result;
}

// Test Scenario 11: Create Todo - Button Click
async function testScenario011(agent) {
  console.log('\n=== Test Scenario UAT-011: Create Todo - Button Click ===\n');

  const result = {
    id: 'UAT-011',
    name: 'Create Todo - Button Click',
    status: 'RUNNING',
    steps: [],
    screenshots: [],
    errors: []
  };

  try {
    const task = `
You are on the todo app dashboard. Perform these steps:
1. Locate the todo input field at the top (placeholder: "What needs to be done?")
2. Click into the input field
3. Type "Buy groceries"
4. Click the "Add Todo" button
5. Verify that the todo "Buy groceries" appears in the list below
6. Verify that the input field is now empty
7. Now test pressing Enter: type "Call dentist" and press Enter key
8. Verify that "Call dentist" also appears in the list
9. Take a final screenshot showing both todos
`;

    console.log('Executing create todo test...');
    const taskResult = await agent.executeTask(task);

    if (taskResult.ok) {
      result.status = 'PASS';
      result.steps.push({ step: 1, status: 'PASS', description: 'Todos created successfully' });
      console.log('✓ Create Todo Result:', taskResult.resultText);
    } else {
      throw new Error(taskResult.error || 'Task did not complete successfully');
    }

    result.screenshots = await copyScreenshots(taskResult.outDir, '011');
    console.log('✓ Scenario UAT-011 PASSED\n');
  } catch (error) {
    result.status = 'FAIL';
    result.errors.push(error.message);
    console.error('✗ Scenario UAT-011 FAILED:', error.message, '\n');
  }

  testResults.push(result);
  return result;
}

// Test Scenario 15: Toggle Todo Completion
async function testScenario015(agent) {
  console.log('\n=== Test Scenario UAT-015: Toggle Todo Completion ===\n');

  const result = {
    id: 'UAT-015',
    name: 'Toggle Todo Completion',
    status: 'RUNNING',
    steps: [],
    screenshots: [],
    errors: []
  };

  try {
    const task = `
You are viewing the todo list with at least one todo. Perform these steps:
1. Locate the todo "Buy groceries" in the list
2. Click the checkbox next to "Buy groceries" to mark it as completed
3. Verify that the todo text now has a strikethrough style
4. Verify that the todo appears lighter in color (completed state)
5. Click the checkbox again to mark it as uncompleted
6. Verify that the strikethrough is removed
7. Take a final screenshot showing the toggled state
`;

    console.log('Executing toggle todo test...');
    const taskResult = await agent.executeTask(task);

    if (taskResult.ok) {
      result.status = 'PASS';
      result.steps.push({ step: 1, status: 'PASS', description: 'Todo toggled successfully' });
      console.log('✓ Toggle Todo Result:', taskResult.resultText);
    } else {
      throw new Error(taskResult.error || 'Task did not complete successfully');
    }

    result.screenshots = await copyScreenshots(taskResult.outDir, '015');
    console.log('✓ Scenario UAT-015 PASSED\n');
  } catch (error) {
    result.status = 'FAIL';
    result.errors.push(error.message);
    console.error('✗ Scenario UAT-015 FAILED:', error.message, '\n');
  }

  testResults.push(result);
  return result;
}

// Generate markdown report
function generateReport() {
  console.log('\n=== Generating Test Execution Report ===\n');

  const reportPath = path.join(__dirname, 'UAT-EXECUTION-REPORT.md');

  let markdown = '# UAT Test Execution Report\n\n';
  markdown += `**Date:** ${new Date().toISOString()}\n`;
  markdown += `**Application:** Todo App\n`;
  markdown += `**Test Environment:** ${APP_URL}\n`;
  markdown += `**Automation:** Google Gemini Computer Use API via @legion/computer-use\n\n`;

  markdown += '---\n\n';
  markdown += '## Executive Summary\n\n';

  const passCount = testResults.filter(r => r.status === 'PASS').length;
  const failCount = testResults.filter(r => r.status === 'FAIL').length;
  const totalCount = testResults.length;
  const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

  markdown += `- **Total Scenarios Executed:** ${totalCount}\n`;
  markdown += `- **Passed:** ${passCount} ✅\n`;
  markdown += `- **Failed:** ${failCount} ❌\n`;
  markdown += `- **Pass Rate:** ${passRate}%\n\n`;

  markdown += '**Scenarios Tested:**\n\n';
  markdown += '1. UAT-001: User Registration - Valid Registration\n';
  markdown += '2. UAT-002: Duplicate Email Handling\n';
  markdown += '3. UAT-006: User Login - Valid Credentials\n';
  markdown += '4. UAT-011: Create Todo - Button Click\n';
  markdown += '5. UAT-015: Toggle Todo Completion\n\n';

  markdown += '---\n\n';
  markdown += '## Test Results\n\n';

  testResults.forEach(result => {
    markdown += `### ${result.id}: ${result.name}\n\n`;
    markdown += `**Status:** ${result.status === 'PASS' ? '✅ PASS' : '❌ FAIL'}\n\n`;

    if (result.steps.length > 0) {
      markdown += '**Steps:**\n\n';
      result.steps.forEach(step => {
        markdown += `- Step ${step.step}: ${step.description} - ${step.status}\n`;
      });
      markdown += '\n';
    }

    if (result.screenshots.length > 0) {
      markdown += '**Screenshots:**\n\n';
      result.screenshots.forEach((screenshot, idx) => {
        const relPath = path.relative(path.dirname(reportPath), screenshot);
        const filename = path.basename(screenshot);
        markdown += `![${filename}](${relPath})\n\n`;
      });
    }

    if (result.errors.length > 0) {
      markdown += '**Errors:**\n\n';
      result.errors.forEach(error => {
        markdown += `\`\`\`\n${error}\n\`\`\`\n\n`;
      });
    }

    markdown += '---\n\n';
  });

  markdown += '## Conclusion\n\n';
  if (failCount === 0) {
    markdown += '✅ **All test scenarios passed successfully!**\n\n';
    markdown += 'The application meets the acceptance criteria for the tested scenarios:\n';
    markdown += '- User registration works correctly with validation\n';
    markdown += '- Duplicate email handling prevents duplicate accounts\n';
    markdown += '- User login authenticates successfully\n';
    markdown += '- Todo creation works via button and Enter key\n';
    markdown += '- Todo completion toggle updates UI correctly\n\n';
  } else {
    markdown += `⚠️ **${failCount} scenario(s) failed.**\n\n`;
    markdown += 'Please review the errors above and address the issues before proceeding.\n\n';
  }

  markdown += '## Testing Methodology\n\n';
  markdown += 'These tests were executed using the **@legion/computer-use** package, which leverages Google Gemini\'s Computer Use API for autonomous browser automation. ';
  markdown += 'The agent receives natural language task descriptions and performs real browser interactions to complete them.\n\n';
  markdown += '**Benefits of Computer Use Agent:**\n';
  markdown += '- Natural language test descriptions\n';
  markdown += '- Real browser interactions (not mocked)\n';
  markdown += '- Autonomous decision-making for complex UI flows\n';
  markdown += '- Full observability with screenshots and traces\n\n';

  markdown += '---\n\n';
  markdown += '**End of Report**\n';

  fs.writeFileSync(reportPath, markdown);
  console.log(`✓ Report generated: ${reportPath}\n`);

  return reportPath;
}

// Main execution
async function main() {
  console.log('='.repeat(80));
  console.log('UAT TEST EXECUTION - FIRST 5 CRITICAL SCENARIOS');
  console.log('Computer Use Agent: Google Gemini 2.5 Preview');
  console.log('='.repeat(80));
  console.log(`\nApplication URL: ${APP_URL}`);
  console.log(`Screenshots Directory: ${SCREENSHOTS_DIR}\n`);
  console.log('='.repeat(80));

  let agent;

  try {
    // Initialize Resource Manager and Computer Use Agent
    console.log('\n📦 Initializing Resource Manager...');
    const resourceManager = await ResourceManager.getInstance();

    console.log('🤖 Initializing Computer Use Agent...');
    agent = new ComputerUseAgent(resourceManager, {
      headless: false,  // Show browser for debugging
      startUrl: APP_URL,
      maxTurns: 30,
      stepTimeBudgetMs: 120000,  // 2 minutes per turn
      totalTimeBudgetMs: 600000  // 10 minutes total
    });

    await agent.initialize();
    console.log('✓ Computer Use Agent initialized\n');

    // Execute test scenarios
    await testScenario001(agent);

    // Re-initialize agent for each scenario to start fresh
    console.log('\n🔄 Re-initializing agent for next scenario...');
    await agent.cleanup();
    agent = new ComputerUseAgent(resourceManager, {
      headless: false,
      startUrl: APP_URL,
      maxTurns: 30,
      stepTimeBudgetMs: 120000,
      totalTimeBudgetMs: 600000
    });
    await agent.initialize();

    await testScenario002(agent);

    console.log('\n🔄 Re-initializing agent for next scenario...');
    await agent.cleanup();
    agent = new ComputerUseAgent(resourceManager, {
      headless: false,
      startUrl: APP_URL,
      maxTurns: 30,
      stepTimeBudgetMs: 120000,
      totalTimeBudgetMs: 600000
    });
    await agent.initialize();

    await testScenario006(agent);

    console.log('\n🔄 Re-initializing agent for next scenario...');
    await agent.cleanup();
    agent = new ComputerUseAgent(resourceManager, {
      headless: false,
      startUrl: APP_URL,
      maxTurns: 30,
      stepTimeBudgetMs: 120000,
      totalTimeBudgetMs: 600000
    });
    await agent.initialize();

    await testScenario011(agent);

    console.log('\n🔄 Re-initializing agent for next scenario...');
    await agent.cleanup();
    agent = new ComputerUseAgent(resourceManager, {
      headless: false,
      startUrl: APP_URL,
      maxTurns: 30,
      stepTimeBudgetMs: 120000,
      totalTimeBudgetMs: 600000
    });
    await agent.initialize();

    await testScenario015(agent);

    // Generate report
    const reportPath = generateReport();

    console.log('='.repeat(80));
    console.log('TEST EXECUTION COMPLETE');
    console.log('='.repeat(80));
    console.log(`\n📊 Results Summary:`);
    console.log(`   Passed: ${testResults.filter(r => r.status === 'PASS').length}/${testResults.length}`);
    console.log(`   Failed: ${testResults.filter(r => r.status === 'FAIL').length}/${testResults.length}`);
    console.log(`\n📄 Report: ${reportPath}`);
    console.log(`📁 Screenshots: ${SCREENSHOTS_DIR}`);
    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
    throw error;
  } finally {
    // Cleanup
    if (agent) {
      console.log('\n🧹 Cleaning up agent...');
      await agent.cleanup();
      console.log('✓ Cleanup complete\n');
    }
  }
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
