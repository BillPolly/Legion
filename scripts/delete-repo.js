/**
 * Script to delete a GitHub repository
 */

import { ResourceManager, ModuleFactory } from '@jsenvoy/modules';
import GitHubModule from '../packages/general-tools/src/github/GitHubModule.js';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node scripts/delete-repo.js <orgName> <repoName>');
    process.exit(1);
  }
  
  const [orgName, repoName] = args;
  
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
    
    console.log(`Deleting repository ${orgName}/${repoName}...`);
    
    const result = await polyRepo.invoke({
      function: {
        name: 'polyrepo_delete_repo',
        arguments: JSON.stringify({
          orgName: orgName,
          repoName: repoName
        })
      }
    });

    if (result.success) {
      console.log('✓ Repository deleted successfully');
    } else {
      console.error('✗ Failed to delete repository:', result.error);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();