/**
 * GitHub API Integration Tests
 * Phase 6.2: GitHub API operations and repository management
 * 
 * Tests the GitHub API integration including repository creation,
 * management, pull requests, and organization operations.
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import GitHubOperations from '../../src/integration/GitHubOperations.js';
import GitHubAuthentication from '../../src/integration/GitHubAuthentication.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';

describe('GitHub API Integration Tests', () => {
  let resourceManager;
  let githubAuth;
  let githubOps;
  let testRepoName;
  let githubUser;
  let githubPat;
  let githubOrg;

  beforeAll(async () => {
    // Check for GitHub credentials
    githubUser = process.env.GITHUB_USER;
    githubPat = process.env.GITHUB_PAT;
    githubOrg = process.env.GITHUB_AGENT_ORG || 'AgentResults';

    if (!githubUser || !githubPat) {
      console.warn('⚠️ Skipping GitHub API tests - missing GITHUB_USER or GITHUB_PAT environment variables');
      return;
    }

    // Initialize resource manager
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    resourceManager.register('GITHUB_USER', githubUser);
    resourceManager.register('GITHUB_PAT', githubPat);
    resourceManager.register('GITHUB_AGENT_ORG', githubOrg);

    // Initialize GitHub authentication
    githubAuth = new GitHubAuthentication(resourceManager);
    await githubAuth.initialize();

    // Verify authentication
    const isValid = await githubAuth.validateCredentials();
    if (!isValid) {
      throw new Error('Invalid GitHub credentials provided');
    }

    console.log(`✅ GitHub API testing enabled for user: ${githubUser}, org: ${githubOrg}`);
  });

  beforeEach(async () => {
    if (!githubUser || !githubPat) {
      return;
    }

    testRepoName = `api-test-${Date.now()}`;
    
    const config = GitConfigValidator.getDefaultConfig();
    githubOps = new GitHubOperations(githubAuth, config);
    await githubOps.initialize();

    console.log(`🧪 API Test setup: ${testRepoName}`);
  });

  afterEach(async () => {
    if (!githubUser || !githubPat || !testRepoName) {
      return;
    }

    try {
      // Cleanup test repository
      await githubOps.deleteRepository(testRepoName);
      console.log(`🗑️ Cleaned up repository: ${testRepoName}`);
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }
  });

  test('should authenticate with GitHub API', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Test authentication
    const isValid = await githubAuth.validateCredentials();
    expect(isValid).toBe(true);

    // Get user info
    const userInfo = await githubAuth.getUserInfo();
    expect(userInfo).toHaveProperty('login');
    expect(userInfo.login).toBe(githubUser);

    // Test organization access
    const hasOrgAccess = await githubAuth.hasOrganizationAccess(githubOrg);
    expect(hasOrgAccess).toBe(true);

    console.log('✅ GitHub API authentication working');
  });

  test('should create and manage GitHub repositories', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Create repository
    const repoData = {
      name: testRepoName,
      description: 'Test repository created by Code Agent API integration test',
      private: true,
      auto_init: true
    };

    const createResult = await githubOps.createRepository(repoData);
    expect(createResult.success).toBe(true);
    expect(createResult.repository).toHaveProperty('name', testRepoName);
    expect(createResult.repository).toHaveProperty('clone_url');

    // Get repository info
    const repoInfo = await githubOps.getRepositoryInfo(testRepoName);
    expect(repoInfo).toHaveProperty('name', testRepoName);
    expect(repoInfo).toHaveProperty('description', repoData.description);

    // Update repository
    const updateData = {
      description: 'Updated description for API integration test'
    };

    const updateResult = await githubOps.updateRepository(testRepoName, updateData);
    expect(updateResult.success).toBe(true);

    // Verify update
    const updatedInfo = await githubOps.getRepositoryInfo(testRepoName);
    expect(updatedInfo.description).toBe(updateData.description);

    console.log('✅ GitHub repository creation and management working');
  });

  test('should handle repository branches and operations', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Create repository with initial branch
    const repoData = {
      name: testRepoName,
      description: 'Branch test repository',
      private: true,
      auto_init: true
    };

    await githubOps.createRepository(repoData);

    // List branches
    const branches = await githubOps.listBranches(testRepoName);
    expect(branches).toBeInstanceOf(Array);
    expect(branches.length).toBeGreaterThan(0);

    // Check default branch exists
    const defaultBranch = branches.find(b => b.name === 'main' || b.name === 'master');
    expect(defaultBranch).toBeDefined();

    // Create new branch
    const newBranchName = 'feature/api-test';
    const branchResult = await githubOps.createBranch(testRepoName, newBranchName, defaultBranch.commit.sha);
    expect(branchResult.success).toBe(true);

    // Verify branch was created
    const updatedBranches = await githubOps.listBranches(testRepoName);
    const newBranch = updatedBranches.find(b => b.name === newBranchName);
    expect(newBranch).toBeDefined();

    console.log('✅ GitHub branch operations working');
  });

  test('should handle file operations in repository', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Create repository
    const repoData = {
      name: testRepoName,
      description: 'File operations test repository',
      private: true,
      auto_init: true
    };

    await githubOps.createRepository(repoData);

    // Create a file
    const fileName = 'test-file.md';
    const fileContent = '# Test File\n\nThis file was created by API integration test.';
    const commitMessage = 'Add test file via API';

    const createFileResult = await githubOps.createFile(
      testRepoName,
      fileName,
      fileContent,
      commitMessage
    );
    expect(createFileResult.success).toBe(true);

    // Get file content
    const fileInfo = await githubOps.getFileContent(testRepoName, fileName);
    expect(fileInfo).toHaveProperty('content');
    expect(Buffer.from(fileInfo.content, 'base64').toString()).toBe(fileContent);

    // Update file
    const updatedContent = '# Updated Test File\n\nThis file was updated by API integration test.';
    const updateMessage = 'Update test file via API';

    const updateFileResult = await githubOps.updateFile(
      testRepoName,
      fileName,
      updatedContent,
      updateMessage,
      fileInfo.sha
    );
    expect(updateFileResult.success).toBe(true);

    // Verify update
    const updatedFileInfo = await githubOps.getFileContent(testRepoName, fileName);
    expect(Buffer.from(updatedFileInfo.content, 'base64').toString()).toBe(updatedContent);

    console.log('✅ GitHub file operations working');
  });

  test('should handle pull request operations', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Create repository
    const repoData = {
      name: testRepoName,
      description: 'Pull request test repository',
      private: true,
      auto_init: true
    };

    await githubOps.createRepository(repoData);

    // Get default branch
    const branches = await githubOps.listBranches(testRepoName);
    const defaultBranch = branches.find(b => b.name === 'main' || b.name === 'master');

    // Create feature branch
    const featureBranch = 'feature/pr-test';
    await githubOps.createBranch(testRepoName, featureBranch, defaultBranch.commit.sha);

    // Create file on feature branch
    const fileName = 'feature.md';
    const fileContent = '# Feature\n\nNew feature implementation.';
    await githubOps.createFile(testRepoName, fileName, fileContent, 'Add feature file', featureBranch);

    // Create pull request
    const prData = {
      title: 'Add new feature',
      body: 'This PR adds a new feature for testing purposes.',
      head: featureBranch,
      base: defaultBranch.name
    };

    const prResult = await githubOps.createPullRequest(testRepoName, prData);
    expect(prResult.success).toBe(true);
    expect(prResult.pullRequest).toHaveProperty('number');
    expect(prResult.pullRequest).toHaveProperty('title', prData.title);

    // List pull requests
    const pullRequests = await githubOps.listPullRequests(testRepoName);
    expect(pullRequests).toBeInstanceOf(Array);
    expect(pullRequests.length).toBeGreaterThan(0);

    const createdPR = pullRequests.find(pr => pr.number === prResult.pullRequest.number);
    expect(createdPR).toBeDefined();
    expect(createdPR.title).toBe(prData.title);

    console.log('✅ GitHub pull request operations working');
  });

  test('should handle organization and team operations', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Get organization info
    const orgInfo = await githubOps.getOrganizationInfo(githubOrg);
    expect(orgInfo).toHaveProperty('login', githubOrg);
    expect(orgInfo).toHaveProperty('type', 'Organization');

    // List organization repositories
    const orgRepos = await githubOps.listOrganizationRepositories(githubOrg);
    expect(orgRepos).toBeInstanceOf(Array);

    // Get organization members (if accessible)
    try {
      const members = await githubOps.listOrganizationMembers(githubOrg);
      expect(members).toBeInstanceOf(Array);
    } catch (error) {
      // Organization member visibility might be restricted
      console.log('ℹ️ Organization members list not accessible (privacy settings)');
    }

    console.log('✅ GitHub organization operations working');
  });

  test('should handle rate limiting and errors gracefully', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Test rate limit info
    const rateLimitInfo = await githubOps.getRateLimitInfo();
    expect(rateLimitInfo).toHaveProperty('limit');
    expect(rateLimitInfo).toHaveProperty('remaining');
    expect(rateLimitInfo).toHaveProperty('reset');

    console.log(`ℹ️ Rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit} remaining`);

    // Test error handling with invalid repository
    const invalidRepoName = 'this-repo-definitely-does-not-exist-12345';
    
    try {
      await githubOps.getRepositoryInfo(invalidRepoName);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('404');
    }

    // Test error handling with invalid branch
    await githubOps.createRepository({
      name: testRepoName,
      description: 'Error test repository',
      private: true,
      auto_init: true
    });

    try {
      await githubOps.createBranch(testRepoName, 'new-branch', 'invalid-sha');
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    console.log('✅ GitHub rate limiting and error handling working');
  });

  test('should handle webhook and automation setup', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    // Create repository
    const repoData = {
      name: testRepoName,
      description: 'Webhook test repository',
      private: true,
      auto_init: true
    };

    await githubOps.createRepository(repoData);

    // Create webhook (using a test URL)
    const webhookData = {
      url: 'https://httpbin.org/post',
      content_type: 'json',
      events: ['push', 'pull_request']
    };

    const webhookResult = await githubOps.createWebhook(testRepoName, webhookData);
    expect(webhookResult.success).toBe(true);
    expect(webhookResult.webhook).toHaveProperty('id');

    // List webhooks
    const webhooks = await githubOps.listWebhooks(testRepoName);
    expect(webhooks).toBeInstanceOf(Array);
    expect(webhooks.length).toBeGreaterThan(0);

    const createdWebhook = webhooks.find(w => w.id === webhookResult.webhook.id);
    expect(createdWebhook).toBeDefined();
    expect(createdWebhook.config.url).toBe(webhookData.url);

    // Delete webhook
    const deleteResult = await githubOps.deleteWebhook(testRepoName, webhookResult.webhook.id);
    expect(deleteResult.success).toBe(true);

    console.log('✅ GitHub webhook and automation setup working');
  });
});