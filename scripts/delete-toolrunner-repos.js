/**
 * Script to delete all repositories prefixed with "toolrunner-" from BillPolly org
 */

import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';
import https from 'https';

async function listOrgRepos(orgName, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/orgs/${orgName}/repos?per_page=100`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'jsEnvoy-Cleanup-Tool',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          const repos = JSON.parse(data);
          resolve(repos);
        } else {
          reject(new Error(`Failed to list repositories: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    // Initialize ResourceManager (it will automatically load .env)
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Register GitHub resources from environment
    resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    resourceManager.register('GITHUB_ORG', resourceManager.get('env.GITHUB_ORG'));
    resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));

    // Create module using ModuleFactory
    const moduleFactory = new ModuleFactory(resourceManager);
    const githubModule = moduleFactory.createModule(GitHubModule);
    
    // Get the PolyRepoManager tool
    const tools = githubModule.getTools();
    const polyRepo = tools.find(tool => tool.name === 'polyrepo');
    
    const orgName = resourceManager.get('GITHUB_ORG');
    const token = resourceManager.get('GITHUB_PAT');
    
    console.log(`Fetching repositories from ${orgName}...`);
    
    // List all repositories
    const repos = await listOrgRepos(orgName, token);
    
    // Filter toolrunner- prefixed repos
    const toolrunnerRepos = repos.filter(repo => repo.name.startsWith('toolrunner-'));
    
    console.log(`\nFound ${toolrunnerRepos.length} repositories with 'toolrunner-' prefix:`);
    toolrunnerRepos.forEach(repo => console.log(`  - ${repo.name}`));
    
    if (toolrunnerRepos.length === 0) {
      console.log('No repositories to delete.');
      return;
    }
    
    console.log('\nDeleting repositories...\n');
    
    // Delete each repository
    for (const repo of toolrunnerRepos) {
      console.log(`Deleting ${repo.name}...`);
      
      const result = await polyRepo.invoke({
        function: {
          name: 'polyrepo_delete_repo',
          arguments: JSON.stringify({
            orgName: orgName,
            repoName: repo.name
          })
        }
      });

      if (result.success) {
        console.log(`✓ Deleted ${repo.name}`);
      } else {
        console.error(`✗ Failed to delete ${repo.name}:`, result.error);
      }
    }
    
    console.log('\nCleanup complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();