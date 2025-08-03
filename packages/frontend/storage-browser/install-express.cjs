#!/usr/bin/env node

// Standalone Express installer for storage-browser demo
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(__dirname, 'temp-express-install');
const targetDir = path.join(__dirname, 'node_modules');

console.log('Installing Express for storage-browser demo...');

try {
  // Create temp directory
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Create minimal package.json
  const packageJson = {
    name: 'temp-install',
    version: '1.0.0',
    dependencies: {
      express: '^4.18.2'
    }
  };
  
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Install in temp directory
  console.log('Installing Express...');
  execSync('npm install', { 
    cwd: tempDir,
    stdio: 'inherit'
  });
  
  // Create target node_modules if needed
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Copy Express and its dependencies
  const tempModules = path.join(tempDir, 'node_modules');
  if (fs.existsSync(tempModules)) {
    console.log('Copying Express to storage-browser...');
    execSync(`cp -r ${tempModules}/* ${targetDir}/`, { stdio: 'inherit' });
    console.log('✓ Express installed successfully!');
  }
  
  // Clean up
  execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' });
  
} catch (error) {
  console.error('Installation failed:', error.message);
  process.exit(1);
}