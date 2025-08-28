#!/usr/bin/env node

/**
 * Script to verify jester is properly installed and configured
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying Jester Installation...\n');

async function verifyJesterInstallation() {
  const results = {
    packageJsonCorrect: false,
    jesterPackageExists: false,
    importsCorrect: false,
    testsExist: false,
    errors: []
  };

  try {
    // 1. Check package.json
    console.log('1️⃣ Checking package.json...');
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
    
    if (packageJson.dependencies && packageJson.dependencies['@legion/jester']) {
      results.packageJsonCorrect = true;
      console.log('   ✅ @legion/jester dependency found in package.json');
      console.log(`   📍 Path: ${packageJson.dependencies['@legion/jester']}`);
    } else {
      results.errors.push('❌ @legion/jester not found in dependencies');
    }

    // 2. Check if jester package directory exists
    console.log('\n2️⃣ Checking jester package directory...');
    const jesterPath = path.join(__dirname, '..', '..', 'jester');
    try {
      const stats = await fs.stat(jesterPath);
      if (stats.isDirectory()) {
        results.jesterPackageExists = true;
        console.log('   ✅ Jester package directory exists');
        
        // Check for key files
        const keyFiles = ['package.json', 'src/index.js'];
        for (const file of keyFiles) {
          const filePath = path.join(jesterPath, file);
          try {
            await fs.access(filePath);
            console.log(`   ✅ ${file} exists`);
          } catch {
            results.errors.push(`❌ Missing file: ${file}`);
          }
        }
      }
    } catch {
      results.errors.push('❌ Jester package directory not found');
    }

    // 3. Check imports in source files
    console.log('\n3️⃣ Checking import statements...');
    const filesToCheck = [
      'src/integration/JesterIntegration.js',
      'src/reporter/JesterReporter.js',
      'src/config/JestConfigManager.js'
    ];
    
    let allImportsCorrect = true;
    for (const file of filesToCheck) {
      const filePath = path.join(__dirname, '..', file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        if (content.includes('@legion/jester')) {
          console.log(`   ✅ ${file} uses @legion/jester`);
        } else if (content.includes('@asmodeus/jester')) {
          console.log(`   ❌ ${file} still uses old @asmodeus/jester import`);
          allImportsCorrect = false;
          results.errors.push(`${file} needs import update`);
        }
      } catch (error) {
        console.log(`   ⚠️ Could not check ${file}: ${error.message}`);
      }
    }
    results.importsCorrect = allImportsCorrect;

    // 4. Check if tests exist
    console.log('\n4️⃣ Checking test files...');
    const testFiles = [
      '__tests__/unit/integration/JesterIntegration.test.js',
      '__tests__/unit/reporter/JesterReporter.test.js',
      '__tests__/integration/RealJestExecutor.test.js',
      '__tests__/integration/TestExecutionEngine.test.js',
      '__tests__/integration/jester-e2e.test.js'
    ];
    
    let allTestsExist = true;
    for (const testFile of testFiles) {
      const testPath = path.join(__dirname, '..', testFile);
      try {
        await fs.access(testPath);
        console.log(`   ✅ ${testFile} exists`);
      } catch {
        console.log(`   ❌ ${testFile} not found`);
        allTestsExist = false;
        results.errors.push(`Missing test: ${testFile}`);
      }
    }
    results.testsExist = allTestsExist;

    // Summary
    console.log('\n📊 Summary:');
    console.log('─'.repeat(50));
    console.log(`Package.json configured: ${results.packageJsonCorrect ? '✅' : '❌'}`);
    console.log(`Jester package exists:   ${results.jesterPackageExists ? '✅' : '❌'}`);
    console.log(`Imports are correct:     ${results.importsCorrect ? '✅' : '❌'}`);
    console.log(`Tests exist:             ${results.testsExist ? '✅' : '❌'}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️ Issues found:');
      results.errors.forEach(error => console.log(`   ${error}`));
      
      console.log('\n💡 To fix:');
      console.log('   1. Run "npm install" from the monorepo root');
      console.log('   2. Or link jester manually: npm link ../jester');
      console.log('   3. Update any incorrect imports');
      
      return false;
    } else {
      console.log('\n✅ Jester integration is properly configured!');
      return true;
    }

  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    return false;
  }
}

// Run verification
verifyJesterInstallation().then(success => {
  process.exit(success ? 0 : 1);
});