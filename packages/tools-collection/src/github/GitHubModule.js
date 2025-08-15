import { Module } from '@legion/tools-registry';
import GitHubTool from './GitHubTool.js';

/**
 * GitHubModule - Module that provides GitHub-related tools
 */
class GitHubModule extends Module {
  // Declare required dependencies
  static dependencies = ['GITHUB_PAT', 'GITHUB_ORG', 'GITHUB_USER'];

  constructor(dependencies = {}) {
    super();
    this.name = 'github';
    this.description = 'GitHub tools for repository management and operations';
    
    // Extract configuration from resolved dependencies
    // If we have a ResourceManager, use it to get environment variables
    let token, org, user;
    if (dependencies.resourceManager) {
      token = dependencies.resourceManager.get('env.GITHUB_PAT');
      org = dependencies.resourceManager.get('env.GITHUB_ORG');
      user = dependencies.resourceManager.get('env.GITHUB_USER');
    } else {
      // Fallback to dependencies directly passed
      token = dependencies['GITHUB_PAT'];
      org = dependencies['GITHUB_ORG'];
      user = dependencies['GITHUB_USER'];
    }
    
    const apiBase = 'api.github.com';

    // Store configuration for tools
    this.config = { token, org, user, apiBase };
    
    // Initialize tools dictionary
    this.tools = {};
    
    // Create and register GitHub tool
    const githubTool = new GitHubTool(this.config);
    this.registerTool(githubTool.name, githubTool);
  }

}

export default GitHubModule;