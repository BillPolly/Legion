/**
 * Runner script for splitting the monorepo
 * This provides a cleaner interface and better error handling
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkPrerequisites() {
  console.log('Checking prerequisites...');
  
  // Check if .env file exists
  const envPath = path.join(__dirname, '..', '.env');
  try {
    await fs.access(envPath);
    console.log('✓ .env file found');
  } catch {
    console.error('✗ .env file not found');
    console.error('  Please create a .env file with GITHUB_PAT and GITHUB_ORG');
    return false;
  }
  
  // Check if .env contains required variables
  const envContent = await fs.readFile(envPath, 'utf8');
  const hasGithubPat = /GITHUB_PAT\s*=\s*.+/.test(envContent);
  const hasGithubOrg = /GITHUB_ORG\s*=\s*.+/.test(envContent);
  
  if (!hasGithubPat) {
    console.error('✗ GITHUB_PAT not found in .env file');
    return false;
  }
  console.log('✓ GITHUB_PAT found');
  
  if (!hasGithubOrg) {
    console.error('✗ GITHUB_ORG not found in .env file');
    return false;
  }
  console.log('✓ GitHub organization found');
  
  // Check if we're in a git repository
  try {
    const { execSync } = await import('child_process');
    execSync('git rev-parse --git-dir', { cwd: path.join(__dirname, '..') });
    console.log('✓ In a git repository');
  } catch {
    console.error('✗ Not in a git repository');
    console.error('  Please initialize a git repository first');
    return false;
  }
  
  return true;
}

async function runSplitScript() {
  const scriptPath = path.join(__dirname, 'split-monorepo.js');
  
  return new Promise((resolve, reject) => {
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      env: { ...process.env }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('jsEnvoy Monorepo Splitter');
  console.log('========================\n');
  
  // Check prerequisites
  const ready = await checkPrerequisites();
  if (!ready) {
    console.log('\nPlease fix the issues above and try again.');
    process.exit(1);
  }
  
  console.log('\nAll prerequisites met!\n');
  console.log('This script will:');
  console.log('1. Create individual git repositories for each package');
  console.log('2. Create GitHub repositories in your organization');
  console.log('3. Push each package to its own repository');
  console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  // Give user time to cancel
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    await runSplitScript();
    console.log('\n✓ Monorepo split completed successfully!');
  } catch (error) {
    console.error('\n✗ Error during split:', error.message);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});