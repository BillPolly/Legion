#!/usr/bin/env node

/**
 * Cleanup AgentResults Organization
 * 
 * This script deletes ALL repositories in the AgentResults organization.
 * 
 * SAFETY: This script will ONLY work on the AgentResults organization
 * and includes multiple safety checks.
 */

import { ResourceManager } from '@legion/tool-system';
import GitIntegrationManager from './src/integration/GitIntegrationManager.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  console.log('🧹 AgentResults Organization Cleanup');
  console.log('====================================\n');
  
  console.log('⚠️  WARNING: This will DELETE ALL repositories in AgentResults!');
  console.log('⚠️  This action cannot be undone!\n');
  
  // Initialize ResourceManager
  const resourceManager = new ResourceManager();
  await resourceManager.initialize();
  
  // Get GitHub PAT
  let githubPat;
  try {
    githubPat = resourceManager.GITHUB_PAT;
    process.env.GITHUB_PAT = githubPat;
  } catch {
    githubPat = process.env.GITHUB_PAT;
  }
  
  if (!githubPat) {
    console.error('❌ No GITHUB_PAT found!');
    process.exit(1);
  }
  
  console.log(`✅ GitHub PAT: ${githubPat.substring(0, 10)}...`);
  
  try {
    // Create resource manager for Git integration
    const gitResourceManager = {
      get: (key) => {
        if (key === 'GITHUB_USER') return process.env.GITHUB_USER;
        if (key === 'GITHUB_PAT') return process.env.GITHUB_PAT;
        if (key === 'GITHUB_AGENT_ORG') return ALLOWED_ORGANIZATION;
        return null;
      }
    };
    
    // Initialize Git integration
    console.log('\n🔧 Initializing GitHub connection...');
    
    const gitConfig = {
      enabled: true,
      organization: ALLOWED_ORGANIZATION
    };
    
    const gitIntegration = new GitIntegrationManager(gitResourceManager, gitConfig);
    const tempDir = join(__dirname, 'tmp', 'cleanup-temp');
    
    // Create temp directory
    const { promises: fs } = await import('fs');
    await fs.mkdir(tempDir, { recursive: true });
    
    await gitIntegration.initialize(tempDir);
    
    const gitHubOps = gitIntegration.gitHubOperations;
    if (!gitHubOps) {
      throw new Error('GitHub operations not initialized');
    }
    
    // SAFETY CHECK: Verify organization
    const orgInfo = await gitHubOps.getOrganizationInfo(ALLOWED_ORGANIZATION);
    console.log(`\n📊 Organization: ${orgInfo.login}`);
    console.log(`📝 Description: ${orgInfo.description || 'No description'}`);
    console.log(`🏢 Company: ${orgInfo.company || 'N/A'}`);
    
    // SAFETY: Double-check organization name
    if (orgInfo.login !== ALLOWED_ORGANIZATION) {
      console.error(`\n❌ SAFETY CHECK FAILED: Organization mismatch!`);
      console.error(`Expected: ${ALLOWED_ORGANIZATION}, Got: ${orgInfo.login}`);
      process.exit(1);
    }
    
    // List all repositories
    console.log('\n📋 Fetching repository list...');
    const repos = await gitHubOps.listOrganizationRepos(ALLOWED_ORGANIZATION);
    
    if (repos.length === 0) {
      console.log('✅ No repositories found in AgentResults organization.');
      return;
    }
    
    console.log(`\n📦 Found ${repos.length} repositories:`);
    repos.forEach((repo, index) => {
      console.log(`  ${index + 1}. ${repo.name} (${repo.size}KB) - Created: ${new Date(repo.created_at).toLocaleDateString()}`);
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
    
    for (const repo of repos) {
      process.stdout.write(`Deleting ${repo.name}... `);
      
      try {
        await gitHubOps.deleteRepository(ALLOWED_ORGANIZATION, repo.name);
        console.log('✅ Deleted');
        successCount++;
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        failCount++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Cleanup Summary:');
    console.log(`✅ Successfully deleted: ${successCount} repositories`);
    if (failCount > 0) {
      console.log(`❌ Failed to delete: ${failCount} repositories`);
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
  console.log('Usage: node cleanup-agent-results.js --force\n');
  console.log('This is to prevent accidental execution.');
  process.exit(1);
}