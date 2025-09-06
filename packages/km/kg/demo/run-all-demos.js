#!/usr/bin/env node

/**
 * Demo Runner Script
 * 
 * Runs all Knowledge Graph system demos in sequence with proper
 * spacing and error handling.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Knowledge Graph System - Demo Runner\n');
console.log('This script will run all available demos in sequence.\n');

const demos = [
  {
    name: 'Basic Knowledge Graph Demo',
    script: 'basic-kg-demo.js',
    description: 'Core functionality: object serialization, querying, reconstruction'
  },
  {
    name: 'Query System Demo',
    script: 'query-system-demo.js',
    description: 'Advanced querying: patterns, traversal, logical composition, aggregation'
  },
  {
    name: 'Storage System Demo',
    script: 'storage-demo.js',
    description: 'Storage backends: memory, file, configuration, performance'
  }
];

async function runDemo(demo, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Demo ${index + 1}/${demos.length}: ${demo.name}`);
  console.log(`📝 ${demo.description}`);
  console.log(`${'='.repeat(60)}\n`);

  return new Promise((resolve, reject) => {
    const scriptPath = join(__dirname, demo.script);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✅ ${demo.name} completed successfully`);
        resolve();
      } else {
        console.log(`\n❌ ${demo.name} failed with exit code ${code}`);
        reject(new Error(`Demo failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      console.log(`\n❌ ${demo.name} failed to start: ${error.message}`);
      reject(error);
    });
  });
}

async function runAllDemos() {
  const startTime = Date.now();
  let successCount = 0;
  let failureCount = 0;

  console.log('Starting demo sequence...\n');

  for (let i = 0; i < demos.length; i++) {
    try {
      await runDemo(demos[i], i);
      successCount++;
      
      // Add a pause between demos for readability
      if (i < demos.length - 1) {
        console.log('\n⏳ Pausing for 2 seconds before next demo...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      failureCount++;
      console.log(`\n⚠️  Continuing with remaining demos...\n`);
    }
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(1);

  console.log(`\n${'='.repeat(60)}`);
  console.log('🏁 Demo Runner Summary');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Successful demos: ${successCount}/${demos.length}`);
  console.log(`❌ Failed demos: ${failureCount}/${demos.length}`);
  console.log(`⏱️  Total execution time: ${totalTime} seconds`);

  if (successCount === demos.length) {
    console.log('\n🎉 All demos completed successfully!');
    console.log('\nThe Knowledge Graph system is working correctly.');
    console.log('You can now:');
    console.log('• Explore the source code in src/');
    console.log('• Run the test suite with: npm test');
    console.log('• Build your own applications using the KG system');
  } else {
    console.log('\n⚠️  Some demos failed. Please check the output above for details.');
    console.log('Common issues:');
    console.log('• Missing dependencies: run npm install');
    console.log('• File permissions: ensure write access to demo directory');
    console.log('• Node.js version: requires Node.js 16+');
  }

  console.log(`\n${'='.repeat(60)}\n`);
}

// Handle process interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Demo runner interrupted by user');
  console.log('Exiting gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Demo runner terminated');
  process.exit(0);
});

// Run all demos
runAllDemos().catch((error) => {
  console.error('\n❌ Demo runner failed:', error.message);
  process.exit(1);
});
