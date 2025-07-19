/**
 * Test GitHub Authentication
 * Phase 1.1.3: GitHub token validation and authentication
 */

import { describe, test, expect, beforeAll, afterEach } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import GitHubAuthentication from '../../../src/integration/GitHubAuthentication.js';

describe('GitHub Authentication', () => {
  let resourceManager;
  let authentication;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register GitHub environment variables for testing
    if (resourceManager.has('env.GITHUB_PAT')) {
      resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    }
    if (resourceManager.has('env.GITHUB_USER')) {
      resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));
    }
  });

  afterEach(() => {
    authentication = null;
  });

  test('should create GitHubAuthentication with ResourceManager', () => {
    authentication = new GitHubAuthentication(resourceManager);
    
    expect(authentication).toBeDefined();
    expect(authentication.resourceManager).toBe(resourceManager);
    expect(authentication.token).toBe(null); // Not initialized yet
  });

  test('should initialize and load GitHub token', async () => {
    authentication = new GitHubAuthentication(resourceManager);
    
    await authentication.initialize();
    
    expect(authentication.token).toBeDefined();
    expect(authentication.token).not.toBe('');
    expect(typeof authentication.token).toBe('string');
    expect(authentication.token).toMatch(/^ghp_/);
    
    console.log('✅ GitHub token loaded successfully');
  });

  test('should validate GitHub token with real API call', async () => {
    authentication = new GitHubAuthentication(resourceManager);
    await authentication.initialize();
    
    const isValid = await authentication.validateToken();
    
    expect(isValid).toBe(true);
    console.log('✅ GitHub token validated successfully with API');
  }, 10000); // 10 second timeout for API call

  test('should get user information from GitHub API', async () => {
    authentication = new GitHubAuthentication(resourceManager);
    await authentication.initialize();
    
    const userInfo = await authentication.getUserInfo();
    
    expect(userInfo).toBeDefined();
    expect(userInfo.login).toBeDefined();
    expect(userInfo.id).toBeDefined();
    expect(userInfo.type).toBe('User');
    
    console.log('✅ GitHub user info retrieved:', userInfo.login);
  }, 10000);

  test('should verify organization access', async () => {
    authentication = new GitHubAuthentication(resourceManager);
    await authentication.initialize();
    
    const hasAccess = await authentication.verifyOrganizationAccess('AgentResults');
    
    expect(typeof hasAccess).toBe('boolean');
    console.log('✅ AgentResults organization access:', hasAccess ? 'granted' : 'denied');
  }, 10000);

  test('should provide auth headers for API requests', async () => {
    authentication = new GitHubAuthentication(resourceManager);
    await authentication.initialize();
    
    const headers = authentication.getAuthHeaders();
    
    expect(headers).toBeDefined();
    expect(headers['Authorization']).toMatch(/^token ghp_/);
    expect(headers['User-Agent']).toBe('jsenvoy-code-agent');
    expect(headers['Accept']).toBe('application/vnd.github.v3+json');
  });

  test('should handle missing GitHub token gracefully', async () => {
    // Create a resource manager without GitHub token
    const emptyResourceManager = new ResourceManager();
    await emptyResourceManager.initialize();
    
    authentication = new GitHubAuthentication(emptyResourceManager);
    
    await expect(authentication.initialize()).rejects.toThrow('GitHub PAT not found');
  });

  test('should handle invalid GitHub token', async () => {
    // Create a resource manager with invalid token
    const invalidResourceManager = new ResourceManager();
    await invalidResourceManager.initialize();
    invalidResourceManager.register('GITHUB_PAT', 'ghp_invalid_token_format_1234567890');
    
    authentication = new GitHubAuthentication(invalidResourceManager);
    await authentication.initialize();
    
    const isValid = await authentication.validateToken();
    expect(isValid).toBe(false);
  }, 10000);

  test('should provide rate limit information', async () => {
    authentication = new GitHubAuthentication(resourceManager);
    await authentication.initialize();
    
    const rateLimitInfo = await authentication.getRateLimitInfo();
    
    expect(rateLimitInfo).toBeDefined();
    expect(rateLimitInfo.limit).toBeDefined();
    expect(rateLimitInfo.remaining).toBeDefined();
    expect(rateLimitInfo.reset).toBeDefined();
    
    console.log('✅ Rate limit info:', rateLimitInfo);
  }, 10000);
});