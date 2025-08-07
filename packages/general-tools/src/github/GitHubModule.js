import { Module } from '@legion/tool-system';
import GitHub from './index.js';
import PolyRepoManager from './PolyRepoManager.js';

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
    const token = dependencies['GITHUB_PAT'];
    const org = dependencies['GITHUB_ORG'];
    const user = dependencies['GITHUB_USER'];
    const apiBase = 'api.github.com';

    // Store configuration for tools
    const config = { token, org, user, apiBase };

    // Create and register tools using the parent class method
    this.registerTool('github', new GitHub(config));
    this.registerTool('polyrepo', new PolyRepoManager(config));
  }

}

export default GitHubModule;