/**
 * Global Jest teardown for planning integration tests
 * Runs once after all tests complete
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export default async function globalTeardown() {
  console.log('🧹 Cleaning up Legion Planning Integration Tests...');

  const workspaceBasePath = '/tmp/legion-integration-tests';
  
  try {
    // Clean up test workspace
    const exists = await fs.access(workspaceBasePath).then(() => true).catch(() => false);
    
    if (exists) {
      await fs.rm(workspaceBasePath, { recursive: true, force: true });
      console.log(`✅ Cleaned up test workspace: ${workspaceBasePath}`);
    }
  } catch (error) {
    console.error(`⚠️  Failed to clean up workspace: ${error.message}`);
    // Don't fail teardown on cleanup errors
  }

  // Log final test statistics if available
  if (global.testResults) {
    console.log('📊 Integration Test Summary:');
    console.log(`   LLM Calls: ${global.testResults.llmCalls}`);
    console.log(`   BT Executions: ${global.testResults.btExecutions}`); 
    console.log(`   Files Created: ${global.testResults.filesCreated}`);
    console.log(`   Total Execution Time: ${global.testResults.executionTime}ms`);
  }

  console.log('✅ Global teardown complete');
}