/**
 * Basic usage example for Jester
 * 
 * This demonstrates how to use Jester to run tests and query results
 */

import { JesterRunner } from '@jsenvoy/jester';

async function runExample() {
  // Create a Jester runner instance
  const runner = new JesterRunner({
    projectPath: './my-project',
    databasePath: './test-results.db'
  });

  console.log('Running tests...');
  
  // Run tests with specific pattern
  const runId = await runner.runTests({
    testPattern: '**/*.test.js',
    coverage: true,
    maxWorkers: 4
  });

  console.log(`Test run completed. Run ID: ${runId}`);

  // Get run summary
  const summary = await runner.query.getRunSummary(runId);
  console.log('\nTest Summary:');
  console.log(`Total Tests: ${summary.totalTests}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Duration: ${summary.duration}ms`);

  // Get failing tests
  if (summary.failed > 0) {
    const failures = await runner.query.getFailingTests(runId);
    console.log('\nFailing Tests:');
    failures.forEach(test => {
      console.log(`- ${test.testPath}: ${test.testName}`);
      console.log(`  Error: ${test.errorMessage}`);
    });
  }

  // Find slow tests
  const slowTests = await runner.query.getSlowTests(runId, { threshold: 1000 });
  if (slowTests.length > 0) {
    console.log('\nSlow Tests (>1s):');
    slowTests.forEach(test => {
      console.log(`- ${test.testName}: ${test.duration}ms`);
    });
  }

  // Search console output
  const errorLogs = await runner.query.searchConsole(runId, 'error');
  if (errorLogs.length > 0) {
    console.log('\nConsole Errors:');
    errorLogs.forEach(log => {
      console.log(`- [${log.testName}] ${log.message}`);
    });
  }
}

// Run the example
runExample().catch(console.error);