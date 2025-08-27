/**
 * GitHubOperations - Extended GitHub API operations beyond existing tools
 * 
 * Provides advanced GitHub repository operations, organization management,
 * and enhanced API functionality for the code agent system.
 */

import https from 'https';

class GitHubOperations {
  constructor(githubAuth, config) {
    this.githubAuth = githubAuth;
    this.config = config;
    this.initialized = false;
    this.organization = config.organization || 'AgentResults';
  }
  
  async initialize() {
    if (!this.githubAuth.isInitialized()) {
      throw new Error('GitHub authentication not initialized');
    }
    this.initialized = true;
  }
  
  /**
   * Create a new GitHub repository
   * @param {string} name - Repository name
   * @param {string} description - Repository description
   * @param {Object} options - Repository options
   * @returns {Object} Repository creation result
   */
  async createRepository(name, description, options = {}) {
    if (!name || name.trim() === '') {
      throw new Error('Repository name is required');
    }
    
    const repoData = {
      name: name.trim(),
      description: description || '',
      private: options.private || false,
      auto_init: options.auto_init || false,
      has_issues: options.has_issues !== false,
      has_projects: options.has_projects !== false,
      has_wiki: options.has_wiki !== false
    };
    
    // Determine API endpoint based on organization
    const endpoint = options.organization 
      ? `/orgs/${options.organization}/repos`
      : '/user/repos';
    
    const response = await this.githubAuth.makeAuthenticatedRequest(
      endpoint,
      'POST',
      repoData
    );
    
    if (response.statusCode === 201) {
      const repo = JSON.parse(response.data);
      return {
        success: true,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        private: repo.private,
        html_url: repo.html_url,
        clone_url: repo.clone_url,
        ssh_url: repo.ssh_url,
        owner: repo.owner,
        default_branch: repo.default_branch
      };
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to create repository: ${error.message || response.data}`);
    }
  }
  
  /**
   * Get repository information
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Object} Repository information
   */
  async getRepositoryInfo(owner, repo) {
    const response = await this.githubAuth.makeAuthenticatedRequest(`/repos/${owner}/${repo}`);
    
    if (response.statusCode === 200) {
      return JSON.parse(response.data);
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to get repository info: ${error.message || response.data}`);
    }
  }
  
  /**
   * Update repository settings
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {Object} updates - Repository updates
   * @returns {Object} Updated repository information
   */
  async updateRepository(owner, repo, updates) {
    const response = await this.githubAuth.makeAuthenticatedRequest(
      `/repos/${owner}/${repo}`,
      'PATCH',
      updates
    );
    
    if (response.statusCode === 200) {
      const updatedRepo = JSON.parse(response.data);
      return {
        success: true,
        name: updatedRepo.name,
        description: updatedRepo.description,
        private: updatedRepo.private,
        has_issues: updatedRepo.has_issues,
        has_projects: updatedRepo.has_projects,
        has_wiki: updatedRepo.has_wiki
      };
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to update repository: ${error.message || response.data}`);
    }
  }
  
  /**
   * Delete a repository
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Object} Deletion result
   */
  async deleteRepository(owner, repo) {
    const response = await this.githubAuth.makeAuthenticatedRequest(
      `/repos/${owner}/${repo}`,
      'DELETE'
    );
    
    if (response.statusCode === 204) {
      return { success: true, deleted: true };
    } else {
      const error = response.data ? JSON.parse(response.data) : { message: 'Unknown error' };
      throw new Error(`Failed to delete repository: ${error.message}`);
    }
  }
  
  /**
   * List organization repositories
   * @param {string} org - Organization name (optional, uses config default)
   * @returns {Array} List of repositories
   */
  async listOrganizationRepos(org = null) {
    const organization = org || this.organization;
    const response = await this.githubAuth.makeAuthenticatedRequest(
      `/orgs/${organization}/repos?per_page=100`
    );
    
    if (response.statusCode === 200) {
      return JSON.parse(response.data);
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to list organization repositories: ${error.message}`);
    }
  }
  
  /**
   * Create repository in organization
   * @param {string} name - Repository name
   * @param {string} description - Repository description
   * @param {Object} options - Additional options
   * @returns {Object} Repository creation result
   */
  async createInOrganization(name, description, options = {}) {
    return await this.createRepository(name, description, {
      ...options,
      organization: this.organization
    });
  }
  
  /**
   * Verify organization access
   * @param {string} org - Organization name
   * @returns {boolean} True if user has access
   */
  async verifyOrganizationAccess(org) {
    try {
      const response = await this.githubAuth.makeAuthenticatedRequest(`/orgs/${org}`);
      return response.statusCode === 200;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get organization information
   * @param {string} org - Organization name
   * @returns {Object} Organization information
   */
  async getOrganizationInfo(org) {
    const response = await this.githubAuth.makeAuthenticatedRequest(`/orgs/${org}`);
    
    if (response.statusCode === 200) {
      return JSON.parse(response.data);
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to get organization info: ${error.message}`);
    }
  }
  
  /**
   * Create a branch on GitHub
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch name
   * @param {string} sha - SHA to branch from
   * @returns {Object} Branch creation result
   */
  async createBranchOnGitHub(owner, repo, branch, sha) {
    const response = await this.githubAuth.makeAuthenticatedRequest(
      `/repos/${owner}/${repo}/git/refs`,
      'POST',
      {
        ref: `refs/heads/${branch}`,
        sha: sha
      }
    );
    
    if (response.statusCode === 201) {
      const result = JSON.parse(response.data);
      return {
        success: true,
        ref: result.ref,
        sha: result.object.sha
      };
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to create branch: ${error.message}`);
    }
  }
  
  /**
   * Get repository branches
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @returns {Array} List of branches
   */
  async getBranches(owner, repo) {
    const response = await this.githubAuth.makeAuthenticatedRequest(
      `/repos/${owner}/${repo}/branches`
    );
    
    if (response.statusCode === 200) {
      return JSON.parse(response.data);
    } else {
      const error = JSON.parse(response.data);
      throw new Error(`Failed to get branches: ${error.message}`);
    }
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    this.initialized = false;
  }
  
  /**
   * Check if operations are initialized
   * @returns {boolean} True if initialized
   */
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Get current organization
   * @returns {string} Organization name
   */
  getOrganization() {
    return this.organization;
  }
}

export default GitHubOperations;