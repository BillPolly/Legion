#!/usr/bin/env node

/**
 * Simple test runner to verify the test suite works
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

console.log(chalk.bold.blue('\n🧪 Running Tools Registry Test Suite\n'));

const tests = [
  { name: 'Unit Tests - Module', pattern: 'unit/modules/Module' },
  { name: 'Unit Tests - Tool', pattern: 'unit/modules/Tool' },
  { name: 'Integration - Singleton', pattern: 'integration/ToolRegistrySingleton' },
  { name: 'Integration - Operations', pattern: 'integration/ToolRegistryOperations' },
  { name: 'Integration - Execution', pattern: 'integration/ToolExecution' },
  { name: 'E2E - Full Pipeline', pattern: 'e2e/FullPipeline' }
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(chalk.yellow(`\nRunning: ${test.name}`));
  console.log(chalk.gray(`Pattern: ${test.pattern}`));
  
  try {
    const result = execSync(
      `NODE_OPTIONS='--experimental-vm-modules' npx jest -c jest.config.simple.js --testPathPattern="${test.pattern}" --silent`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    
    // Parse result
    const lines = result.split('\n');
    const summary = lines.find(l => l.includes('Test Suites:'));
    
    if (summary && summary.includes('passed')) {
      console.log(chalk.green(`✅ ${test.name}: PASSED`));
      if (summary) console.log(chalk.gray(`   ${summary.trim()}`));
      passed++;
    } else {
      console.log(chalk.red(`❌ ${test.name}: FAILED`));
      if (summary) console.log(chalk.gray(`   ${summary.trim()}`));
      failed++;
    }
  } catch (error) {
    console.log(chalk.red(`❌ ${test.name}: FAILED`));
    
    // Try to extract test summary from error output
    const output = error.stdout || error.message;
    const lines = output.split('\n');
    const summary = lines.find(l => l.includes('Test Suites:'));
    if (summary) {
      console.log(chalk.gray(`   ${summary.trim()}`));
    }
    
    // Show first few error lines
    const errorLines = lines.filter(l => l.includes('●') || l.includes('expect'));
    if (errorLines.length > 0) {
      console.log(chalk.gray('   Errors:'));
      errorLines.slice(0, 3).forEach(line => {
        console.log(chalk.gray(`   ${line.trim()}`));
      });
    }
    
    failed++;
  }
}

console.log(chalk.bold('\n📊 Test Summary'));
console.log(chalk.green(`   Passed: ${passed}`));
console.log(chalk.red(`   Failed: ${failed}`));
console.log(chalk.white(`   Total: ${tests.length}`));

if (failed === 0) {
  console.log(chalk.bold.green('\n✅ All tests passed!\n'));
  process.exit(0);
} else {
  console.log(chalk.bold.red(`\n❌ ${failed} test suite(s) failed\n`));
  process.exit(1);
}