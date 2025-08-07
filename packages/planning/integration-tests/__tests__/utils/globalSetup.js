/**
 * Global Jest setup for planning integration tests
 * Runs once before all tests
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export default async function globalSetup() {
  console.log('🚀 Setting up Legion Planning Integration Tests...');

  // Ensure test workspace directory exists
  const workspaceBasePath = '/tmp/legion-integration-tests';
  try {
    await fs.mkdir(workspaceBasePath, { recursive: true });
    console.log(`✅ Created test workspace: ${workspaceBasePath}`);
  } catch (error) {
    console.error(`❌ Failed to create test workspace: ${error.message}`);
    throw error;
  }

  // Verify environment setup
  const requiredEnvVars = ['ANTHROPIC_API_KEY'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.warn('Some tests may be skipped or may fail');
  } else {
    console.log('✅ All required environment variables found');
  }

  // Clean up any existing test artifacts from previous runs
  try {
    const entries = await fs.readdir(workspaceBasePath);
    for (const entry of entries) {
      const fullPath = join(workspaceBasePath, entry);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
    }
    console.log('✅ Cleaned up previous test artifacts');
  } catch (error) {
    // Ignore cleanup errors
    console.log('ℹ️  No previous artifacts to clean up');
  }

  console.log('🎯 Global setup complete - ready for integration testing!');
}