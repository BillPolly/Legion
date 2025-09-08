#!/usr/bin/env node

/**
 * Run all unit tests for tool discovery fix
 * Each test is small and focused on one aspect
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tests = [
  {
    name: 'Tool Description Generation',
    file: './unit/test-tool-description-generation.js'
  },
  {
    name: 'Tool Discovery from Descriptions',
    file: './unit/test-tool-discovery.js'
  },
  {
    name: 'Tool Deduplication',
    file: './unit/test-tool-deduplication.js'
  },
  {
    name: 'No Tool Execution During Discovery',
    file: './unit/test-no-tool-execution.js'
  },
  {
    name: 'AgentCreator Integration',
    file: './unit/test-agent-creator-integration.js'
  }
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running: ${test.name}`);
    console.log('-'.repeat(60));
    
    const testPath = path.join(__dirname, test.file);
    const child = spawn('node', [testPath], {
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name}: PASSED`);
        resolve(true);
      } else {
        console.log(`❌ ${test.name}: FAILED`);
        resolve(false);
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ ${test.name}: ERROR - ${error.message}`);
      resolve(false);
    });
  });
}

async function runAllTests() {
  console.log('🚀 Running Tool Discovery Unit Tests');
  console.log('=' + '='.repeat(50));
  console.log('Running', tests.length, 'focused unit tests');
  
  const results = [];
  
  for (const test of tests) {
    const passed = await runTest(test);
    results.push({ test: test.name, passed });
  }
  
  console.log('\n' + '=' + '='.repeat(50));
  console.log('📊 TEST SUMMARY:\n');
  
  let passedCount = 0;
  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.test}`);
    if (r.passed) passedCount++;
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`Total: ${passedCount}/${tests.length} tests passed`);
  
  if (passedCount === tests.length) {
    console.log('\n🎉 ALL UNIT TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('❌ Test runner error:', err);
  process.exit(1);
});