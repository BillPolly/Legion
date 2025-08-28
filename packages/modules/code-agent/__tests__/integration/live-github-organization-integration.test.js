/**
 * Test Live GitHub Organization Integration
 * Phase 2.1.2: AgentResults organization operations
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';
import GitHubOperations from '../../src/integration/GitHubOperations.js';
import GitHubAuthentication from '../../src/integration/GitHubAuthentication.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';

describe('Live GitHub Organization Integration', () => {
  let resourceManager;
  let githubAuth;
  let githubOps;
  let testReposCreated = [];

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register GitHub environment variables
    if (resourceManager.has('env.GITHUB_PAT')) {
      resourceManager.set('GITHUB_PAT', resourceManager.env.GITHUB_PAT);
    }
    if (resourceManager.has('env.GITHUB_AGENT_ORG')) {
      resourceManager.set('GITHUB_AGENT_ORG', resourceManager.env.GITHUB_AGENT_ORG);
    }
    
    // Initialize GitHub authentication
    githubAuth = new GitHubAuthentication(resourceManager);
    await githubAuth.initialize();
    
    // Initialize GitHub operations
    const config = GitConfigValidator.getDefaultConfig();
    config.organization = 'AgentResults';
    githubOps = new GitHubOperations(githubAuth, config);
    await githubOps.initialize();
    
    console.log('🏢 Starting live GitHub organization integration tests');
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

  test('should list all repositories in AgentResults organization', async () => {
    const repositories = await githubOps.listOrganizationRepos('AgentResults');
    
    expect(Array.isArray(repositories)).toBe(true);
    expect(repositories.length).toBeGreaterThan(0);
    
    // Verify all repositories belong to AgentResults
    for (const repo of repositories) {
      expect(repo.owner.login).toBe('AgentResults');
      expect(repo.full_name).toMatch(/^AgentResults\//);
    }
    
    // Find specific known repositories or patterns
    const repoNames = repositories.map(repo => repo.name);
    console.log(`📊 Found ${repositories.length} repositories in AgentResults organization`);
    console.log(`📋 Repository names: ${repoNames.slice(0, 5).join(', ')}${repoNames.length > 5 ? '...' : ''}`);
    
    expect(repositories.length).toBeGreaterThanOrEqual(1);
  }, 15000);

  test('should verify organization access permissions', async () => {
    // Test access to AgentResults organization
    const hasAccess = await githubOps.verifyOrganizationAccess('AgentResults');
    expect(hasAccess).toBe(true);
    
    // Test access to a non-existent organization
    const hasAccessToFake = await githubOps.verifyOrganizationAccess('NonExistentOrganization999');
    expect(hasAccessToFake).toBe(false);
    
    // Test access to a known public organization (should work with any token)
    const hasAccessToGitHub = await githubOps.verifyOrganizationAccess('github');
    expect(typeof hasAccessToGitHub).toBe('boolean');
    
    console.log('✅ Organization access verification working correctly');
  }, 10000);

  test('should get detailed organization metadata', async () => {
    const orgInfo = await githubOps.getOrganizationInfo('AgentResults');
    
    expect(orgInfo).toBeDefined();
    expect(orgInfo.login).toBe('AgentResults');
    expect(orgInfo.type).toBe('Organization');
    expect(typeof orgInfo.id).toBe('number');
    expect(typeof orgInfo.public_repos).toBe('number');
    expect(typeof orgInfo.public_gists).toBe('number');
    expect(typeof orgInfo.followers).toBe('number');
    expect(typeof orgInfo.following).toBe('number');
    
    // Test that we have repository creation permissions
    expect(orgInfo.public_repos).toBeGreaterThanOrEqual(0);
    
    console.log(`✅ Organization info: ${orgInfo.login} (${orgInfo.public_repos} public repos, ${orgInfo.followers} followers)`);
    console.log(`📅 Created: ${orgInfo.created_at}`);
  }, 10000);

  test('should handle organization-specific repository creation', async () => {
    const repoName = `test-org-repo-${Date.now()}`;
    const description = 'Test repository for organization-specific operations';
    
    // Use the organization-specific creation method
    const result = await githubOps.createInOrganization(repoName, description, {
      private: false,
      auto_init: true
    });
    
    testReposCreated.push(repoName);
    
    expect(result.success).toBe(true);
    expect(result.name).toBe(repoName);
    expect(result.owner.login).toBe('AgentResults');
    expect(result.description).toBe(description);
    expect(result.private).toBe(false);
    expect(result.full_name).toBe(`AgentResults/${repoName}`);
    
    console.log(`✅ Created organization repository: ${result.html_url}`);
  }, 15000);

  test('should verify default organization configuration', () => {
    const currentOrg = githubOps.getOrganization();
    expect(currentOrg).toBe('AgentResults');
    
    // Test that the organization is correctly configured from the start
    expect(githubOps.organization).toBe('AgentResults');
    
    console.log(`✅ Default organization configuration: ${currentOrg}`);
  });

  test('should handle organization-specific error scenarios', async () => {
    // Test creating repository with invalid organization
    await expect(githubOps.createRepository('test-invalid-org', 'Test description', {
      organization: 'NonExistentOrganization999'
    })).rejects.toThrow();
    
    // Test getting info for non-existent organization
    await expect(githubOps.getOrganizationInfo('NonExistentOrganization999'))
      .rejects.toThrow();
    
    console.log('✅ Organization error handling working correctly');
  }, 15000);

  test('should filter organization repositories by patterns', async () => {
    const allRepos = await githubOps.listOrganizationRepos('AgentResults');
    
    // Filter for test repositories
    const testRepos = allRepos.filter(repo => 
      repo.name.includes('test-') || 
      repo.name.includes('demo-') ||
      repo.name.includes('example-')
    );
    
    // Filter for code agent related repositories
    const codeAgentRepos = allRepos.filter(repo =>
      repo.name.includes('code-agent') ||
      repo.name.includes('jsenvoy') ||
      repo.description?.toLowerCase().includes('agent')
    );
    
    console.log(`📊 Total repositories: ${allRepos.length}`);
    console.log(`🧪 Test repositories: ${testRepos.length}`);
    console.log(`🤖 Code agent repositories: ${codeAgentRepos.length}`);
    
    expect(allRepos.length).toBeGreaterThan(0);
  }, 15000);

  test('should validate organization repository permissions', async () => {
    const repoName = `test-permissions-${Date.now()}`;
    
    // Create a repository to test permissions
    const createResult = await githubOps.createInOrganization(repoName, 'Test repository for permission validation');
    testReposCreated.push(repoName);
    
    expect(createResult.success).toBe(true);
    
    // Test that we can read the repository we just created
    const repoInfo = await githubOps.getRepositoryInfo('AgentResults', repoName);
    expect(repoInfo.name).toBe(repoName);
    expect(repoInfo.owner.login).toBe('AgentResults');
    
    // Test that we can update the repository
    const updateResult = await githubOps.updateRepository('AgentResults', repoName, {
      description: 'Updated description for permission test',
      has_issues: false
    });
    
    expect(updateResult.success).toBe(true);
    expect(updateResult.description).toBe('Updated description for permission test');
    expect(updateResult.has_issues).toBe(false);
    
    console.log(`✅ Organization repository permissions validated for: ${repoName}`);
  }, 20000);

  test('should handle organization repository naming conventions', async () => {
    const timestamp = Date.now();
    const conventionTests = [
      {
        name: `code-agent-test-${timestamp}`,
        description: 'Repository following code-agent naming convention'
      },
      {
        name: `jsenvoy-integration-${timestamp}`,
        description: 'Repository following jsenvoy naming convention'
      },
      {
        name: `agent-results-demo-${timestamp}`,
        description: 'Repository following agent-results naming convention'
      }
    ];
    
    for (const test of conventionTests) {
      const result = await githubOps.createInOrganization(test.name, test.description);
      testReposCreated.push(test.name);
      
      expect(result.success).toBe(true);
      expect(result.name).toBe(test.name);
      expect(result.owner.login).toBe('AgentResults');
      
      console.log(`✅ Created repository with naming convention: ${test.name}`);
    }
  }, 30000);
});