import { Module } from '@jsenvoy/module-loader';
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

    // Create tools with configuration
    this.tools = [
      new GitHub(config),
      new PolyRepoManager(config)
    ];
  }

}

export default GitHubModule;