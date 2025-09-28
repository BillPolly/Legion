#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = '/Users/maxximus/Documents/max-projects/pocs/Legion/packages/node-tasks/__tests__';
const destDir = __dirname;

// Test files to copy and their modifications
const testsToProcess = [
  {
    source: 'unit/core/Task.test.js',
    dest: 'unit/core/Task.test.js',
    replacements: [
      { from: /@legion\/node-tasks/g, to: '@legion/tasks' },
      { from: /import.*ResourceManager.*\n/g, to: '' },
      { from: /import.*GlobalContext.*\n/g, to: '' },
      { from: /await ResourceManager\.getInstance\(\);?/g, to: '// ResourceManager not needed' },
      { from: /const resourceManager = .*\n/g, to: '' },
      { from: /resourceManager\./g, to: '// resourceManager.' },
      { from: /const globalContext = .*\n/g, to: '' },
      { from: /globalContext\./g, to: '// globalContext.' }
    ]
  },
  {
    source: 'unit/core/Task.artifact-flow.test.js',
    dest: 'unit/core/Task.artifact-flow.test.js',
    replacements: [
      { from: /@legion\/node-tasks/g, to: '@legion/tasks' }
    ]
  },
  {
    source: 'integration/ContextHandleDelegation.test.js',
    dest: 'integration/ContextHandleDelegation.test.js',
    replacements: [
      { from: /@legion\/node-tasks/g, to: '@legion/tasks' },
      { from: /@legion\/handle/g, to: '@legion/tasks' },
      { from: /import.*ResourceManager.*\n/g, to: '' }
    ]
  }
];

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

async function processTestFile(testInfo) {
  try {
    const sourcePath = path.join(sourceDir, testInfo.source);
    const destPath = path.join(destDir, testInfo.dest);
    const destDirPath = path.dirname(destPath);
    
    console.log(`Processing ${testInfo.source}...`);
    
    // Ensure destination directory exists
    await ensureDir(destDirPath);
    
    // Read source file
    let content = await fs.readFile(sourcePath, 'utf8');
    
    // Apply replacements
    for (const replacement of testInfo.replacements) {
      content = content.replace(replacement.from, replacement.to);
    }
    
    // Write to destination
    await fs.writeFile(destPath, content, 'utf8');
    console.log(`✅ ${testInfo.dest} created successfully`);
    
  } catch (error) {
    console.error(`❌ Error processing ${testInfo.source}:`, error.message);
  }
}

async function main() {
  console.log('Starting test migration...\n');
  
  // Create test directories
  await ensureDir(path.join(destDir, 'unit/core'));
  await ensureDir(path.join(destDir, 'integration'));
  
  // Process test files
  for (const testInfo of testsToProcess) {
    await processTestFile(testInfo);
  }
  
  console.log('\n✅ Test migration complete!');
}

main().catch(console.error);