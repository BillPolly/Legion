#!/usr/bin/env node

import { execSync } from 'child_process';
import { discoverSubtrees } from './discover-subtrees.js';
import ora from 'ora';

/**
 * Push all subtrees to their respective remotes
 */
async function pushAllSubtrees() {
  console.log('🚀 Push All Subtrees\n');
  
  const spinner = ora('Discovering subtrees...').start();
  
  try {
    const subtrees = await discoverSubtrees();
    
    if (subtrees.length === 0) {
      spinner.fail('No subtrees found in this repository.');
      return;
    }
    
    spinner.succeed(`Found ${subtrees.length} subtrees`);
    
    // First, commit any pending changes
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('\n⚠️  You have uncommitted changes. Please commit them first.');
        process.exit(1);
      }
    } catch (e) {
      console.error('Error checking git status:', e.message);
      process.exit(1);
    }
    
    console.log('\nPushing subtrees...\n');
    
    const results = [];
    
    for (const { prefix, remote, branch } of subtrees) {
      const subtreeSpinner = ora(`Pushing ${prefix}...`).start();
      
      try {
        // Extract the auth token from the remote URL if present
        let remoteUrl = remote;
        const authMatch = remote.match(/https:\/\/([^@]+)@/);
        if (authMatch) {
          // Remote already has auth
        } else if (process.env.GITHUB_PAT) {
          // Add auth if we have a PAT
          remoteUrl = remote.replace('https://', `https://${process.env.GITHUB_PAT}@`);
        }
        
        // Push the subtree
        const command = `git subtree push --prefix=${prefix} ${remoteUrl} ${branch}`;
        execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe' 
        });
        
        subtreeSpinner.succeed(`Pushed ${prefix} to ${branch}`);
        results.push({ prefix, status: 'success' });
      } catch (error) {
        subtreeSpinner.fail(`Failed to push ${prefix}`);
        console.error(`  Error: ${error.message}`);
        results.push({ prefix, status: 'failed', error: error.message });
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('===========');
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\nFailed subtrees:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.prefix}: ${r.error}`);
      });
      process.exit(1);
    }
    
  } catch (error) {
    spinner.fail('Error during push operation');
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  pushAllSubtrees();
}