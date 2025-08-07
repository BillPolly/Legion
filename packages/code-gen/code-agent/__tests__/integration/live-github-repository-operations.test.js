/**
 * Test Live GitHub Repository Operations
 * Phase 2.1.1: Repository creation in AgentResults organization
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/tools';
import GitHubOperations from '../../src/integration/GitHubOperations.js';
import GitHubAuthentication from '../../src/integration/GitHubAuthentication.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';

describe('Live GitHub Repository Operations', () => {
  let resourceManager;
  let githubAuth;
  let githubOps;
  let testReposCreated = [];

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register GitHub environment variables
    if (resourceManager.has('env.GITHUB_PAT')) {
      resourceManager.register('GITHUB_PAT', resourceManager.env.GITHUB_PAT);
    }
    if (resourceManager.has('env.GITHUB_AGENT_ORG')) {
      resourceManager.register('GITHUB_AGENT_ORG', resourceManager.env.GITHUB_AGENT_ORG);
    }
    
    // Initialize GitHub authentication
    githubAuth = new GitHubAuthentication(resourceManager);
    await githubAuth.initialize();
    
    // Initialize GitHub operations
    const config = GitConfigValidator.getDefaultConfig();
    config.organization = 'AgentResults';
    githubOps = new GitHubOperations(githubAuth, config);
    await githubOps.initialize();
    
    console.log('🚀 Starting live GitHub API tests');
  });

  afterAll(async () => {
    // Cleanup all test repositories created during tests
    console.log(`🧹 Cleaning up ${testReposCreated.length} test repositories`);
    
    for (const repoName of testReposCreated) {
      try {
        await githubOps.deleteRepository('AgentResults', repoName);
        console.log(`✅ Deleted test repository: ${repoName}`);
      } catch (error) {
        console.warn(`⚠️ Failed to delete test repository ${repoName}:`, error.message);
      }
    }
    
    testReposCreated = [];
    console.log('🏁 Cleanup completed');
  });

  test('should create repository in AgentResults organization', async () => {
    const repoName = `test-code-agent-${Date.now()}`;
    const description = 'Test repository created by @legion/code-agent integration tests';
    
    const result = await githubOps.createRepository(repoName, description, {
      private: false,
      organization: 'AgentResults'
    });
    
    // Track for cleanup
    testReposCreated.push(repoName);
    
    expect(result.success).toBe(true);
    expect(result.name).toBe(repoName);
    expect(result.owner.login).toBe('AgentResults');
    expect(result.description).toBe(description);
    expect(result.private).toBe(false);
    expect(result.clone_url).toContain('AgentResults');
    expect(result.html_url).toContain('AgentResults');
    
    console.log(`✅ Created repository: ${result.html_url}`);
  }, 15000);

  test('should get repository information', async () => {
    const repoName = `test-repo-info-${Date.now()}`;
    
    // Create a test repository first
    const createResult = await githubOps.createRepository(repoName, 'Test repo for info retrieval', {
      private: false,
      organization: 'AgentResults'
    });
    testReposCreated.push(repoName);
    
    expect(createResult.success).toBe(true);
    
    // Now get repository information
    const repoInfo = await githubOps.getRepositoryInfo('AgentResults', repoName);
    
    expect(repoInfo).toBeDefined();
    expect(repoInfo.name).toBe(repoName);
    expect(repoInfo.owner.login).toBe('AgentResults');
    expect(repoInfo.description).toBe('Test repo for info retrieval');
    expect(repoInfo.default_branch).toBe('main');
    
    console.log(`✅ Retrieved repository info for: ${repoInfo.full_name}`);
  }, 15000);

  test('should update repository settings', async () => {
    const repoName = `test-repo-update-${Date.now()}`;
    
    // Create a test repository first
    const createResult = await githubOps.createRepository(repoName, 'Initial description', {
      private: false,
      organization: 'AgentResults'
    });
    testReposCreated.push(repoName);
    
    expect(createResult.success).toBe(true);
    
    // Update repository settings
    const updateResult = await githubOps.updateRepository('AgentResults', repoName, {
      description: 'Updated description by code agent test',
      has_issues: true,
      has_projects: false,
      has_wiki: false
    });
    
    expect(updateResult.success).toBe(true);
    expect(updateResult.description).toBe('Updated description by code agent test');
    expect(updateResult.has_issues).toBe(true);
    expect(updateResult.has_projects).toBe(false);
    
    console.log(`✅ Updated repository settings for: ${updateResult.name}`);
  }, 15000);

  test('should list AgentResults organization repositories', async () => {
    const repositories = await githubOps.listOrganizationRepos();
    
    expect(Array.isArray(repositories)).toBe(true);
    expect(repositories.length).toBeGreaterThan(0);
    
    // Check that all repositories belong to AgentResults
    for (const repo of repositories) {
      expect(repo.owner.login).toBe('AgentResults');
    }
    
    // Find our test repositories in the list
    const testRepos = repositories.filter(repo => 
      repo.name.startsWith('test-code-agent-') || 
      repo.name.startsWith('test-repo-')
    );
    
    expect(testRepos.length).toBeGreaterThan(0);
    
    console.log(`✅ Listed ${repositories.length} repositories in AgentResults organization`);
    console.log(`📊 Found ${testRepos.length} test repositories`);
  }, 15000);

  test('should handle repository creation with different options', async () => {
    const repoName = `test-private-repo-${Date.now()}`;
    
    const result = await githubOps.createRepository(repoName, 'Private test repository', {
      private: true,
      auto_init: true,
      organization: 'AgentResults'
    });
    
    testReposCreated.push(repoName);
    
    expect(result.success).toBe(true);
    expect(result.name).toBe(repoName);
    expect(result.private).toBe(true);
    expect(result.owner.login).toBe('AgentResults');
    
    console.log(`✅ Created private repository: ${result.name}`);
  }, 15000);

  test('should handle repository creation errors gracefully', async () => {
    // Try to create a repository with invalid name
    await expect(githubOps.createRepository('', 'Invalid repo name', {
      organization: 'AgentResults'
    })).rejects.toThrow();
    
    // Try to create a repository that already exists
    const repoName = `test-duplicate-${Date.now()}`;
    
    // Create the first one
    const result1 = await githubOps.createRepository(repoName, 'First repo', {
      organization: 'AgentResults'
    });
    testReposCreated.push(repoName);
    expect(result1.success).toBe(true);
    
    // Try to create a duplicate
    await expect(githubOps.createRepository(repoName, 'Duplicate repo', {
      organization: 'AgentResults'
    })).rejects.toThrow();
    
    console.log('✅ Error handling for invalid operations working');
  }, 20000);

  test('should verify organization access permissions', async () => {
    const hasAccess = await githubOps.verifyOrganizationAccess('AgentResults');
    
    expect(hasAccess).toBe(true);
    
    // Test with a non-existent organization
    const hasAccessToFake = await githubOps.verifyOrganizationAccess('NonExistentOrg123456');
    expect(hasAccessToFake).toBe(false);
    
    console.log('✅ Organization access verification working');
  }, 10000);

  test('should get organization metadata', async () => {
    const orgInfo = await githubOps.getOrganizationInfo('AgentResults');
    
    expect(orgInfo).toBeDefined();
    expect(orgInfo.login).toBe('AgentResults');
    expect(orgInfo.type).toBe('Organization');
    expect(typeof orgInfo.public_repos).toBe('number');
    
    console.log(`✅ Retrieved organization info: ${orgInfo.login} (${orgInfo.public_repos} public repos)`);
  }, 10000);

  test('should handle rate limiting appropriately', async () => {
    // Get current rate limit info
    const rateLimitBefore = await githubAuth.getRateLimitInfo();
    
    expect(rateLimitBefore).toBeDefined();
    expect(rateLimitBefore.limit).toBeGreaterThan(0);
    expect(rateLimitBefore.remaining).toBeGreaterThanOrEqual(0);
    
    // Make several API calls and check rate limit after
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(githubOps.getOrganizationInfo('AgentResults'));
    }
    
    await Promise.all(promises);
    
    const rateLimitAfter = await githubAuth.getRateLimitInfo();
    
    expect(rateLimitAfter.remaining).toBeLessThanOrEqual(rateLimitBefore.remaining);
    
    console.log(`✅ Rate limiting: ${rateLimitAfter.remaining}/${rateLimitAfter.limit} remaining`);
  }, 15000);
});