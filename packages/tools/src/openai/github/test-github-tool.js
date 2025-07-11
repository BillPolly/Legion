/**
 * Test script for GitHub tool
 */

const GitHubOpenAI = require('./index');

async function testGitHubTool() {
  console.log('=== GitHub Tool Test ===\n');
  
  const githubTool = new GitHubOpenAI();
  
  // Test 1: Tool descriptions
  console.log('1. Testing tool descriptions...');
  try {
    const descriptions = githubTool.getAllToolDescriptions();
    console.log(`✓ Found ${descriptions.length} functions:`);
    descriptions.forEach(desc => {
      console.log(`  - ${desc.function.name}`);
    });
  } catch (error) {
    console.error('✗ Failed to get descriptions:', error.message);
  }
  
  // Test 2: Credentials check
  console.log('\n2. Testing credentials...');
  try {
    const creds = await githubTool.getCredentials();
    console.log('✓ GitHub PAT found');
    
    // Test getting username
    const username = await githubTool.getGitHubUsername(creds.token);
    console.log(`✓ GitHub username: ${username}`);
  } catch (error) {
    console.error('✗ Credentials error:', error.message);
  }
  
  // Test 3: Git repository check
  console.log('\n3. Testing git repository...');
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  
  try {
    const { stdout } = await execAsync('git rev-parse --show-toplevel');
    console.log(`✓ Git repository found at: ${stdout.trim()}`);
    
    const { stdout: branch } = await execAsync('git branch --show-current');
    console.log(`✓ Current branch: ${branch.trim()}`);
    
    const { stdout: status } = await execAsync('git status --porcelain');
    if (status.trim()) {
      console.log('⚠ Warning: You have uncommitted changes');
    } else {
      console.log('✓ Working directory is clean');
    }
  } catch (error) {
    console.error('✗ Git error:', error.message);
  }
  
  console.log('\n✅ GitHub tool is ready to use!');
  console.log('\nTo create and push this repository to GitHub, run:');
  console.log('  node demo/github-tool-demo.js');
}

// Run tests
if (require.main === module) {
  testGitHubTool().catch(console.error);
}

module.exports = { testGitHubTool };