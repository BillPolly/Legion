import { Module } from '@legion/tools-registry';
import GitHubTool from './GitHubTool.js';

/**
 * GitHubModule - Module that provides GitHub-related tools
 */
class GitHubModule extends Module {
  constructor() {
    super();
    this.name = 'github';
    this.description = 'GitHub tools for repository management and operations';
    this.version = '1.0.0';
  }

  /**
   * Static async factory method following the standard interface
   */
  static async create(resourceManager) {
    const module = new GitHubModule();
    module.resourceManager = resourceManager;
    await module.initialize();
    return module;
  }

  /**
   * Initialize the module
   */
  async initialize() {
    await super.initialize();
    
    // Get GitHub configuration from ResourceManager
    const token = this.resourceManager.get('env.GITHUB_PAT');
    const org = this.resourceManager.get('env.GITHUB_ORG');
    const user = this.resourceManager.get('env.GITHUB_USER');
    const apiBase = 'api.github.com';

    // Store configuration for tools
    this.config = { token, org, user, apiBase };
    
    // Create and register GitHub tool
    const githubTool = new GitHubTool(this.config);
    this.registerTool(githubTool.name, githubTool);
  }

}

export default GitHubModule;