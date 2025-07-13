import { ResourceManager, ModuleFactory } from '@jsenvoy/module-loader';
import GitHubModule from '../../packages/general-tools/src/github/GitHubModule.js';

async function main() {
  try {
    // Initialize ResourceManager
    const resourceManager = new ResourceManager();
    await resourceManager.initialize();

    // Register GitHub resources
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
    
    console.log(`Creating repository "Envoy" in organization ${orgName}...`);
    
    // Create the repository
    const result = await polyRepo.invoke({
      function: {
        name: 'polyrepo_create_org_repo',
        arguments: JSON.stringify({
          orgName: orgName,
          repoName: 'Envoy',
          description: 'jsEnvoy - A modular framework for building AI agent tools',
          isPrivate: true
        })
      }
    });

    if (result.success) {
      console.log('✓ Repository created successfully!');
      console.log(`Repository URL: https://github.com/${orgName}/Envoy`);
    } else {
      console.error('✗ Failed to create repository:', result.error);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();