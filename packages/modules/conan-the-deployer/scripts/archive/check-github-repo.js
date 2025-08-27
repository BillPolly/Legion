#!/usr/bin/env node

import { ResourceManager, ModuleFactory } from '../../../module-loader/src/index.js';
import GitHubModule from '../../../general-tools/src/github/GitHubModule.js';

// Initialize ResourceManager
const resourceManager = new ResourceManager();
await resourceManager.initialize();

// Register GitHub resources from environment
resourceManager.register('GITHUB_PAT', resourceManager.env.GITHUB_PAT);
resourceManager.register('GITHUB_ORG', resourceManager.env.GITHUB_ORG || 'Bill234');
resourceManager.register('GITHUB_USER', resourceManager.env.GITHUB_USER || 'Bill234');

// Create module using ModuleFactory
const moduleFactory = new ModuleFactory(resourceManager);
const githubModule = moduleFactory.createModule(GitHubModule);

// Get the GitHub tool
const tools = githubModule.getTools();
const githubTool = tools.find(tool => tool.name === 'github');

// The GitHub tool we have only supports create/push operations
// To check if repos exist, we need to use the GitHub API directly

const GITHUB_PAT = resourceManager.env.GITHUB_PAT;

async function checkRepository(owner, repo) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      'Authorization': `token ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (response.ok) {
    return await response.json();
  }
  return null;
}

async function listUserRepos(username) {
  const response = await fetch(`https://api.github.com/users/${username}/repos?sort=created&direction=desc&per_page=30`, {
    headers: {
      'Authorization': `token ${GITHUB_PAT}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (response.ok) {
    return await response.json();
  }
  return [];
}

// Check if the specific repo exists
console.log('Checking for repository: Bill234/test-app-1753012112741\n');

const repo = await checkRepository('Bill234', 'test-app-1753012112741');
if (repo) {
  console.log('✅ Repository exists!');
  console.log(`   URL: ${repo.html_url}`);
  console.log(`   Created: ${repo.created_at}`);
  console.log(`   Default branch: ${repo.default_branch}`);
  console.log(`   Size: ${repo.size} KB`);
} else {
  console.log('❌ Repository not found');
}

// List recent test repos
console.log('\n📋 Recent test repositories:');

const repos = await listUserRepos('Bill234');
const testRepos = repos.filter(repo => repo.name.startsWith('test-app-'));

console.log(`Found ${testRepos.length} test repositories:\n`);
testRepos.forEach(repo => {
  console.log(`   - ${repo.name}`);
  console.log(`     URL: ${repo.html_url}`);
  console.log(`     Created: ${repo.created_at}`);
  console.log('');
});