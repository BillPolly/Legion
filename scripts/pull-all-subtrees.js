#!/usr/bin/env node

import { execSync } from 'child_process';
import { discoverSubtrees } from './discover-subtrees.js';
import ora from 'ora';

/**
 * Pull all subtrees from their respective remotes
 */
async function pullAllSubtrees() {
  console.log('🔄 Pull All Subtrees\n');
  
  const spinner = ora('Discovering subtrees...').start();
  
  try {
    const subtrees = await discoverSubtrees();
    
    if (subtrees.length === 0) {
      spinner.fail('No subtrees found in this repository.');
      return;
    }
    
    spinner.succeed(`Found ${subtrees.length} subtrees`);
    
    // Check for uncommitted changes
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (status.trim()) {
        console.log('\n⚠️  You have uncommitted changes. Please commit or stash them first.');
        process.exit(1);
      }
    } catch (e) {
      console.error('Error checking git status:', e.message);
      process.exit(1);
    }
    
    console.log('\nPulling subtrees...\n');
    
    const results = [];
    
    for (const { prefix, remote, branch } of subtrees) {
      const subtreeSpinner = ora(`Pulling ${prefix}...`).start();
      
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
        
        // Pull the subtree
        const command = `git subtree pull --prefix=${prefix} ${remoteUrl} ${branch} --squash`;
        const output = execSync(command, { 
          encoding: 'utf8',
          stdio: 'pipe' 
        });
        
        if (output.includes('Already up to date')) {
          subtreeSpinner.succeed(`${prefix} is already up to date`);
          results.push({ prefix, status: 'up-to-date' });
        } else {
          subtreeSpinner.succeed(`Pulled updates for ${prefix}`);
          results.push({ prefix, status: 'updated' });
        }
      } catch (error) {
        // Check if it's a merge conflict
        if (error.message.includes('conflict')) {
          subtreeSpinner.fail(`Merge conflict in ${prefix}`);
          console.error(`  Please resolve conflicts and commit before continuing`);
          results.push({ prefix, status: 'conflict', error: 'Merge conflict' });
          process.exit(1);
        } else {
          subtreeSpinner.fail(`Failed to pull ${prefix}`);
          console.error(`  Error: ${error.message}`);
          results.push({ prefix, status: 'failed', error: error.message });
        }
      }
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log('===========');
    const updated = results.filter(r => r.status === 'updated').length;
    const upToDate = results.filter(r => r.status === 'up-to-date').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const conflicts = results.filter(r => r.status === 'conflict').length;
    
    console.log(`🔄 Updated: ${updated}`);
    console.log(`✅ Already up-to-date: ${upToDate}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️  Conflicts: ${conflicts}`);
    
    if (failed > 0) {
      console.log('\nFailed subtrees:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.prefix}: ${r.error}`);
      });
    }
    
    if (updated > 0) {
      console.log('\n💡 Tip: Remember to push these updates to the main repository when ready.');
    }
    
  } catch (error) {
    spinner.fail('Error during pull operation');
    console.error(error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  pullAllSubtrees();
}