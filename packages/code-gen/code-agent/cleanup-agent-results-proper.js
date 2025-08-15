#!/usr/bin/env node

/**
 * Cleanup AgentResults Organization - Using jsEnvoy GitHub Tool
 * 
 * This script deletes ALL repositories in the AgentResults organization
 * using the proper GitHub tool from @legion/tools-registry.
 * 
 * SAFETY: This script will ONLY work on the AgentResults organization
 * and includes multiple safety checks.
 */

import { ResourceManager } from '@legion/tools-registry';
import GitHubModule from '../../general-tools/src/github/GitHubModule.js';
import readline from 'readline';

// SAFETY: Hard-coded to only work with AgentResults
const ALLOWED_ORGANIZATION = 'AgentResults';

async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function main() {
  console.log('🧹 AgentResults Organization Cleanup (Using jsEnvoy GitHub Tool)');
  console.log('=================================================================\n');
  
  console.log('⚠️  WARNING: This will DELETE ALL repositories in AgentResults!');
  console.log('⚠️  This action cannot be undone!\n');
  
  try {
    // Initialize ResourceManager
    console.log('🔧 Initializing ResourceManager...');
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Create GitHub module directly
    console.log('📦 Loading GitHub module...');
    const githubModule = new GitHubModule(resourceManager);
    await githubModule.initialize();
    
    // Get the GitHub tools
    const listReposTool = githubModule.getTool('listRepositories');
    const deleteRepoTool = githubModule.getTool('deleteRepository');
    const getOrgTool = githubModule.getTool('getOrganization');
    
    if (!listReposTool || !deleteRepoTool || !getOrgTool) {
      throw new Error('Required GitHub tools not found');
    }
    
    console.log('✅ GitHub tools loaded\n');
    
    // SAFETY CHECK: Verify organization
    console.log('🔍 Verifying organization...');
    const orgResult = await getOrgTool.execute({ org: ALLOWED_ORGANIZATION });
    
    if (!orgResult.success) {
      throw new Error(`Failed to get organization info: ${orgResult.error}`);
    }
    
    const orgInfo = orgResult.data;
    console.log(`📊 Organization: ${orgInfo.login}`);
    console.log(`📝 Description: ${orgInfo.description || 'No description'}`);
    console.log(`🏢 Company: ${orgInfo.company || 'N/A'}`);
    
    // SAFETY: Double-check organization name
    if (orgInfo.login !== ALLOWED_ORGANIZATION) {
      console.error(`\n❌ SAFETY CHECK FAILED: Organization mismatch!`);
      console.error(`Expected: ${ALLOWED_ORGANIZATION}, Got: ${orgInfo.login}`);
      process.exit(1);
    }
    
    // List all repositories in the organization
    console.log('\n📋 Fetching repository list...');
    const listResult = await listReposTool.execute({ 
      org: ALLOWED_ORGANIZATION,
      per_page: 100 // Get up to 100 repos
    });
    
    if (!listResult.success) {
      throw new Error(`Failed to list repositories: ${listResult.error}`);
    }
    
    const repos = listResult.data;
    
    if (repos.length === 0) {
      console.log('✅ No repositories found in AgentResults organization.');
      return;
    }
    
    console.log(`\n📦 Found ${repos.length} repositories:`);
    repos.forEach((repo, index) => {
      const createdDate = new Date(repo.created_at).toLocaleDateString();
      console.log(`  ${index + 1}. ${repo.name} (${repo.size}KB) - Created: ${createdDate}`);
    });
    
    // Ask for confirmation
    console.log(`\n⚠️  This will delete ${repos.length} repositories!`);
    const confirmed = await askConfirmation('Are you sure you want to delete ALL repositories? (yes/no): ');
    
    if (!confirmed) {
      console.log('\n❌ Cleanup cancelled by user.');
      return;
    }
    
    // Second confirmation for safety
    const doubleConfirmed = await askConfirmation(`\n⚠️  FINAL WARNING: Delete all ${repos.length} repositories in AgentResults? (yes/no): `);
    
    if (!doubleConfirmed) {
      console.log('\n❌ Cleanup cancelled by user.');
      return;
    }
    
    // Delete repositories
    console.log('\n🗑️  Starting deletion process...\n');
    
    let successCount = 0;
    let failCount = 0;
    const failedRepos = [];
    
    for (const repo of repos) {
      process.stdout.write(`Deleting ${repo.name}... `);
      
      try {
        const deleteResult = await deleteRepoTool.execute({
          owner: ALLOWED_ORGANIZATION,
          repo: repo.name
        });
        
        if (deleteResult.success) {
          console.log('✅ Deleted');
          successCount++;
        } else {
          console.log(`❌ Failed: ${deleteResult.error}`);
          failCount++;
          failedRepos.push({ name: repo.name, error: deleteResult.error });
        }
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        failCount++;
        failedRepos.push({ name: repo.name, error: error.message });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Successfully deleted: ${successCount} repositories`);
    if (failCount > 0) {
      console.log(`❌ Failed to delete: ${failCount} repositories`);
      console.log('\nFailed repositories:');
      failedRepos.forEach(repo => {
        console.log(`  - ${repo.name}: ${repo.error}`);
      });
    }
    
    console.log('\n🎉 Cleanup completed!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Add safety check for command line argument
if (process.argv.includes('--force')) {
  console.log('🚨 Running with --force flag\n');
  main().catch(console.error);
} else {
  console.log('⚠️  Safety: This script requires the --force flag to run.');
  console.log('Usage: node cleanup-agent-results-proper.js --force\n');
  console.log('This is to prevent accidental execution.');
  process.exit(1);
}