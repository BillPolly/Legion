#!/usr/bin/env node

import { execSync } from 'child_process';
import { discoverSubtrees } from './discover-subtrees.js';

/**
 * Set up git remotes for all subtrees to help VSCode track them
 */
async function setupSubtreeRemotes() {
  console.log('🔧 Setting up subtree remotes for VSCode...\n');
  
  try {
    const subtrees = await discoverSubtrees();
    
    if (subtrees.length === 0) {
      console.log('No subtrees found.');
      return;
    }
    
    // Get existing remotes
    const existingRemotes = execSync('git remote', { encoding: 'utf8' })
      .split('\n')
      .filter(r => r.trim());
    
    for (const { prefix, remote, branch } of subtrees) {
      const packageName = prefix.split('/').pop();
      const remoteName = `subtree-${packageName}`;
      
      if (existingRemotes.includes(remoteName)) {
        console.log(`✓ Remote ${remoteName} already exists`);
        
        // Update the URL if needed
        const currentUrl = execSync(`git remote get-url ${remoteName}`, { encoding: 'utf8' }).trim();
        if (currentUrl !== remote) {
          execSync(`git remote set-url ${remoteName} ${remote}`);
          console.log(`  Updated URL to: ${remote}`);
        }
      } else {
        // Add new remote
        execSync(`git remote add ${remoteName} ${remote}`);
        console.log(`✅ Added remote ${remoteName} -> ${remote}`);
      }
      
      // Set up branch tracking (helps VSCode)
      try {
        execSync(`git config branch.${remoteName}-${branch}.remote ${remoteName}`);
        execSync(`git config branch.${remoteName}-${branch}.merge refs/heads/${branch}`);
        console.log(`  Configured branch tracking for ${remoteName}/${branch}`);
      } catch (e) {
        // Branch tracking setup is optional
      }
    }
    
    console.log('\n✨ Subtree remotes configured!');
    console.log('\nIn VSCode:');
    console.log('1. Open the jsenvoy.code-workspace file');
    console.log('2. Each package will appear as a separate folder in the Explorer');
    console.log('3. Git changes will still show in the main repo (this is normal for subtrees)');
    console.log('4. Use npm run subtree:push to push changes to individual package repos');
    console.log('5. Use npm run subtree:pull to pull updates from individual package repos');
    
  } catch (error) {
    console.error('Error setting up remotes:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupSubtreeRemotes();
}