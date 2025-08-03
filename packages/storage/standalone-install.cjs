#!/usr/bin/env node

// Standalone MongoDB installer to bypass workspace issues
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const tempDir = path.join(__dirname, 'temp-mongo-install');
const targetDir = path.join(__dirname, 'node_modules');

console.log('Installing MongoDB package standalone...');

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
      mongodb: '^6.10.0'
    }
  };
  
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  
  // Install in temp directory
  console.log('Installing in temp directory...');
  execSync('npm install', { 
    cwd: tempDir,
    stdio: 'inherit'
  });
  
  // Create target node_modules if needed
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // Copy MongoDB and its dependencies
  const tempModules = path.join(tempDir, 'node_modules');
  if (fs.existsSync(tempModules)) {
    console.log('Copying MongoDB to storage package...');
    execSync(`cp -r ${tempModules}/* ${targetDir}/`, { stdio: 'inherit' });
    console.log('✓ MongoDB installed successfully!');
  }
  
  // Clean up
  execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' });
  
} catch (error) {
  console.error('Installation failed:', error.message);
  process.exit(1);
}