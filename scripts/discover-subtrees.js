#!/usr/bin/env node

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Discovers all git subtrees in the repository by parsing git log
 * Returns an array of subtree configurations
 */
async function discoverSubtrees() {
  try {
    // Get git log with subtree merge commits
    const gitLog = execSync('git log --all --grep="git-subtree-dir:" --pretty=format:"%H %s"', { 
      encoding: 'utf8' 
    });
    
    const subtrees = new Map();
    const lines = gitLog.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Parse git-subtree-dir and git-subtree-split from commit messages
      const dirMatch = line.match(/git-subtree-dir:\s*(\S+)/);
      const splitMatch = line.match(/git-subtree-split:\s*(\S+)/);
      
      if (dirMatch) {
        const dir = dirMatch[1];
        
        // Get the remote URL for this subtree by examining the commit
        const commitHash = line.split(' ')[0];
        try {
          // Look for the remote URL in the commit message
          const fullCommitMsg = execSync(`git log -1 --format=%B ${commitHash}`, { 
            encoding: 'utf8' 
          });
          
          // Try to extract remote URL from various patterns
          let remoteUrl = null;
          
          // Pattern 1: From Add 'prefix' from remote-url
          const addMatch = fullCommitMsg.match(/Add\s+'[^']+'\s+from\s+(\S+)/);
          if (addMatch) {
            remoteUrl = addMatch[1];
          }
          
          // Pattern 2: From Merge commit 'hash' as prefix
          if (!remoteUrl) {
            // Try to find the remote by checking remotes that match the directory name
            const dirName = path.basename(dir);
            try {
              const remotes = execSync('git remote -v', { encoding: 'utf8' });
              const remoteMatch = remotes.match(new RegExp(`(https://[^\\s]+/${dirName}\\.git)`, 'i'));
              if (remoteMatch) {
                remoteUrl = remoteMatch[1];
              }
            } catch (e) {
              // Ignore
            }
          }
          
          // Check if directory still exists
          const dirExists = await fs.access(dir).then(() => true).catch(() => false);
          
          if (dirExists && !subtrees.has(dir)) {
            subtrees.set(dir, {
              prefix: dir,
              remote: remoteUrl || `https://github.com/BillPolly/${path.basename(dir)}.git`,
              branch: 'main'
            });
          }
        } catch (e) {
          console.error(`Error processing commit ${commitHash}:`, e.message);
        }
      }
    }
    
    // Also check for .gitsubtree file if it exists
    try {
      const subtreeConfig = await fs.readFile('.gitsubtree', 'utf8');
      const lines = subtreeConfig.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      
      for (const line of lines) {
        const [prefix, remote, branch = 'main'] = line.split(/\s+/);
        if (prefix && remote) {
          subtrees.set(prefix, { prefix, remote, branch });
        }
      }
    } catch (e) {
      // .gitsubtree file doesn't exist, that's okay
    }
    
    return Array.from(subtrees.values());
  } catch (error) {
    console.error('Error discovering subtrees:', error.message);
    return [];
  }
}

// Export for use in other scripts
export { discoverSubtrees };

// If run directly, output the discovered subtrees
if (import.meta.url === `file://${process.argv[1]}`) {
  discoverSubtrees().then(subtrees => {
    if (subtrees.length === 0) {
      console.log('No subtrees found in this repository.');
    } else {
      console.log('Discovered subtrees:');
      console.log('===================');
      subtrees.forEach(({ prefix, remote, branch }) => {
        console.log(`\nPrefix: ${prefix}`);
        console.log(`Remote: ${remote}`);
        console.log(`Branch: ${branch}`);
      });
      
      // Also output as JSON for easy parsing by other scripts
      console.log('\nJSON output:');
      console.log(JSON.stringify(subtrees, null, 2));
    }
  });
}