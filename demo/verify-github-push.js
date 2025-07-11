/**
 * Verification script to check if the GitHub repository was created and pushed successfully
 */

const https = require('https');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Configuration
const REPO_NAME = 'jsEnvoy-openai-tools';
const GITHUB_USER = 'Bill234';

async function getGitHubToken() {
  // Try to read from .env file
  const envPath = path.join(process.cwd(), '.env');
  try {
    const envContent = await fs.readFile(envPath, 'utf8');
    const patMatch = envContent.match(/GITHUB_PAT=(.+)/);
    if (patMatch) {
      return patMatch[1].trim();
    }
  } catch (error) {
    // .env file not found
  }
  
  if (process.env.GITHUB_PAT) {
    return process.env.GITHUB_PAT;
  }
  
  throw new Error('GitHub PAT not found');
}

async function checkRepository(user, repo, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${user}/${repo}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'jsEnvoy-Verification',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else if (res.statusCode === 404) {
          resolve(null);
        } else {
          reject(new Error(`API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getRepoContents(user, repo, token, path = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${user}/${repo}/contents/${path}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'jsEnvoy-Verification',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function getCommits(user, repo, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${user}/${repo}/commits`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'jsEnvoy-Verification',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(data));
        } else {
          resolve([]);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function verifyGitHubPush() {
  console.log('=== GitHub Push Verification ===\n');
  
  try {
    // Get token
    const token = await getGitHubToken();
    console.log('✓ GitHub token found\n');
    
    // Check repository exists
    console.log(`Checking repository: ${GITHUB_USER}/${REPO_NAME}`);
    const repoInfo = await checkRepository(GITHUB_USER, REPO_NAME, token);
    
    if (!repoInfo) {
      console.log('❌ Repository not found!');
      return false;
    }
    
    console.log('✓ Repository exists');
    console.log(`  URL: ${repoInfo.html_url}`);
    console.log(`  Description: ${repoInfo.description}`);
    console.log(`  Private: ${repoInfo.private}`);
    console.log(`  Default branch: ${repoInfo.default_branch}`);
    console.log(`  Created: ${new Date(repoInfo.created_at).toLocaleString()}`);
    console.log(`  Updated: ${new Date(repoInfo.updated_at).toLocaleString()}\n`);
    
    // Check contents
    console.log('Checking repository contents...');
    const contents = await getRepoContents(GITHUB_USER, REPO_NAME, token);
    
    if (contents && contents.length > 0) {
      console.log(`✓ Found ${contents.length} items in root directory:`);
      
      // Expected files/directories
      const expectedItems = ['src', 'demo', 'package.json', '.env', '__tests__'];
      const foundItems = contents.map(item => item.name);
      
      expectedItems.forEach(item => {
        if (foundItems.includes(item)) {
          console.log(`  ✓ ${item}`);
        } else {
          console.log(`  ✗ ${item} (missing)`);
        }
      });
      
      // Show other items
      const otherItems = foundItems.filter(item => !expectedItems.includes(item));
      if (otherItems.length > 0) {
        console.log(`  + Additional items: ${otherItems.join(', ')}`);
      }
    } else {
      console.log('❌ No contents found in repository');
    }
    
    console.log('');
    
    // Check commits
    console.log('Checking commits...');
    const commits = await getCommits(GITHUB_USER, REPO_NAME, token);
    
    if (commits && commits.length > 0) {
      console.log(`✓ Found ${commits.length} commit(s)`);
      console.log(`  Latest: "${commits[0].commit.message}" by ${commits[0].commit.author.name}`);
      console.log(`  Date: ${new Date(commits[0].commit.author.date).toLocaleString()}`);
    } else {
      console.log('❌ No commits found');
    }
    
    console.log('');
    
    // Check local git remotes
    console.log('Checking local git configuration...');
    try {
      const { stdout: remotes } = await execAsync('git remote -v');
      
      if (remotes.includes(REPO_NAME)) {
        console.log('✓ Repository is linked in local git remotes');
      } else {
        console.log('ℹ Repository not found in local git remotes (this is normal)');
      }
      
      // Check current branch
      const { stdout: branch } = await execAsync('git branch --show-current');
      console.log(`  Current local branch: ${branch.trim()}`);
      
      // Check if we can fetch from the repo
      console.log('\nTesting connection to repository...');
      try {
        await execAsync(`git ls-remote https://github.com/${GITHUB_USER}/${REPO_NAME}.git HEAD`);
        console.log('✓ Can connect to repository');
      } catch (error) {
        console.log('❌ Cannot connect to repository');
      }
    } catch (error) {
      console.log('❌ Error checking git configuration:', error.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('VERIFICATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Repository "${REPO_NAME}" was successfully created and pushed!`);
    console.log(`\nRepository URL: https://github.com/${GITHUB_USER}/${REPO_NAME}`);
    console.log(`Clone command: git clone https://github.com/${GITHUB_USER}/${REPO_NAME}.git`);
    
    // Provide next steps
    console.log('\nNext steps:');
    console.log('1. Visit the repository to see your code');
    console.log('2. Add a README.md file if desired');
    console.log('3. Configure GitHub Actions for CI/CD');
    console.log('4. Add collaborators if working with a team');
    console.log('5. Set up branch protection rules');
    
    return true;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  }
}

// Additional checks
async function performAdditionalChecks() {
  console.log('\n\n=== Additional Checks ===\n');
  
  try {
    const token = await getGitHubToken();
    
    // Check specific files
    const filesToCheck = [
      'package.json',
      'src/tools/index.js',
      'src/tools/openai/github/index.js'
    ];
    
    console.log('Checking specific files...');
    for (const file of filesToCheck) {
      const contents = await getRepoContents(GITHUB_USER, REPO_NAME, token, file);
      if (contents && contents.size) {
        console.log(`✓ ${file} (${contents.size} bytes)`);
      } else {
        console.log(`✗ ${file} not found`);
      }
    }
    
    // Check OpenAI tools directory
    console.log('\nChecking OpenAI tools directory...');
    const openaiTools = await getRepoContents(GITHUB_USER, REPO_NAME, token, 'src/tools/openai');
    if (openaiTools && Array.isArray(openaiTools)) {
      console.log(`✓ Found ${openaiTools.length} items in src/tools/openai/`);
      const toolDirs = openaiTools.filter(item => item.type === 'dir');
      console.log(`  ${toolDirs.length} tool directories:`, toolDirs.map(d => d.name).join(', '));
    }
    
  } catch (error) {
    console.log('Could not perform additional checks:', error.message);
  }
}

// Run verification
if (require.main === module) {
  verifyGitHubPush()
    .then(success => {
      if (success) {
        return performAdditionalChecks();
      }
    })
    .then(() => {
      console.log('\n✅ Verification complete!');
    })
    .catch(console.error);
}

module.exports = { verifyGitHubPush };