#!/usr/bin/env node

/**
 * Install JSDOM for testing
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDir = path.join(__dirname, '../../packages/frontend/storage-browser');
const nodeModulesDir = path.join(targetDir, 'node_modules');

// Ensure node_modules exists
if (!existsSync(nodeModulesDir)) {
  mkdirSync(nodeModulesDir, { recursive: true });
}

// Install JSDOM directly
console.log('Installing JSDOM...');
try {
  execSync('npm install jsdom', {
    cwd: targetDir,
    stdio: 'inherit'
  });
  console.log('JSDOM installed successfully');
} catch (error) {
  console.error('Failed to install JSDOM:', error.message);
  process.exit(1);
}