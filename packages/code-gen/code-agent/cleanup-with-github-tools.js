#!/usr/bin/env node

/**
 * Cleanup AgentResults using GitHub Tools
 * 
 * This script uses the jsEnvoy GitHub tools to list and delete repositories
 * in the AgentResults organization.
 */

import { ResourceManager } from '@legion/module-loader';
import GitHub from '../../general-tools/src/github/index.js';
import readline from 'readline';
import https from 'https';

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

// Helper function to make GitHub API requests
async function makeGitHubRequest(path, method = 'GET', data = null, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'jsEnvoy-Cleanup',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {};
            resolve({ success: true, data: parsed });
          } catch (error) {
            resolve({ success: true, data: responseData });
          }
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${responseData}`));
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function main() {
  console.log('🧹 AgentResults Cleanup with GitHub Tools');
  console.log('=========================================\n');
  
  console.log('⚠️  WARNING: This will DELETE ALL repositories in AgentResults!');
  console.log('⚠️  This action cannot be undone!\n');
  
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Get GitHub token
    let githubToken;
    try {
      githubToken = resourceManager.get('GITHUB_PAT');
    } catch {
      githubToken = process.env.GITHUB_PAT;
    }
    
    if (!githubToken) {
      throw new Error('No GitHub PAT found');
    }
    
    console.log(`✅ GitHub PAT: ${githubToken.substring(0, 10)}...`);
    
    // Create GitHub tool instance
    const githubTool = new GitHub({
      token: githubToken,
      org: ALLOWED_ORGANIZATION,
      apiBase: 'api.github.com'
    });
    
    // Verify organization
    console.log('\n🔍 Verifying organization...');
    const orgResult = await makeGitHubRequest(`/orgs/${ALLOWED_ORGANIZATION}`, 'GET', null, githubToken);
    
    if (!orgResult.success) {
      throw new Error('Failed to get organization info');
    }
    
    const orgInfo = orgResult.data;
    console.log(`📊 Organization: ${orgInfo.login}`);
    console.log(`📝 Description: ${orgInfo.description || 'No description'}`);
    
    // SAFETY CHECK
    if (orgInfo.login !== ALLOWED_ORGANIZATION) {
      throw new Error(`Organization mismatch! Expected ${ALLOWED_ORGANIZATION}, got ${orgInfo.login}`);
    }
    
    // List repositories
    console.log('\n📋 Fetching repositories...');
    const reposResult = await makeGitHubRequest(
      `/orgs/${ALLOWED_ORGANIZATION}/repos?per_page=100`, 
      'GET', 
      null, 
      githubToken
    );
    
    if (!reposResult.success) {
      throw new Error('Failed to list repositories');
    }
    
    const repos = reposResult.data;
    
    if (repos.length === 0) {
      console.log('✅ No repositories found.');
      return;
    }
    
    console.log(`\n📦 Found ${repos.length} repositories:`);
    repos.forEach((repo, index) => {
      const createdDate = new Date(repo.created_at).toLocaleDateString();
      console.log(`  ${index + 1}. ${repo.name} - Created: ${createdDate}`);
    });
    
    // Auto-delete without confirmation when --force is used
    console.log(`\n⚠️  Deleting ${repos.length} repositories (--force flag detected)`);
    
    // Delete repositories
    console.log('\n🗑️  Deleting repositories...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    // Use the GitHub tool's delete functionality
    for (const repo of repos) {
      process.stdout.write(`Deleting ${repo.name}... `);
      
      try {
        // Call the GitHub API directly to delete
        await makeGitHubRequest(
          `/repos/${ALLOWED_ORGANIZATION}/${repo.name}`,
          'DELETE',
          null,
          githubToken
        );
        
        console.log('✅ Deleted');
        successCount++;
        
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        failCount++;
      }
      
      // Rate limit delay
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Deleted: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    console.log('\n🎉 Done!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Safety check
if (process.argv.includes('--force')) {
  console.log('🚨 Running with --force\n');
  main().catch(console.error);
} else {
  console.log('⚠️  This script requires --force flag');
  console.log('Usage: node cleanup-with-github-tools.js --force');
  process.exit(1);
}