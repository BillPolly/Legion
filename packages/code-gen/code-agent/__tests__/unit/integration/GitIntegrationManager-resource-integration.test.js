/**
 * Test GitIntegrationManager Resource Integration
 * Phase 1.2.2: Integration with existing CodeAgent ResourceManager
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/tool-system';
import GitIntegrationManager from '../../../src/integration/GitIntegrationManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GitIntegrationManager Resource Integration', () => {
  let resourceManager;
  let tempDir;
  let gitIntegrationManager;

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
    if (resourceManager.has('env.GITHUB_USER')) {
      resourceManager.register('GITHUB_USER', resourceManager.env.GITHUB_USER);
    }
    
    // Register CodeAgent-like resources
    resourceManager.register('llmClient', {
      generateResponse: async (prompt) => `Generated response for: ${prompt}`,
      sendAndReceiveResponse: async (messages) => 'Mock LLM response'
    });
    
    resourceManager.register('fileOperations', {
      readFile: async (path) => 'file content',
      writeFile: async (path, content) => true,
      listFiles: async (dir) => ['file1.js', 'file2.js']
    });
    
    resourceManager.register('moduleLoader', {
      loadModule: async (name) => ({ name, loaded: true })
    });
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-resource-test-'));
  });

  afterEach(async () => {
    if (gitIntegrationManager) {
      await gitIntegrationManager.cleanup();
      gitIntegrationManager = null;
    }
    
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    }
  });

  test('should access ResourceManager dependency injection', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    expect(gitIntegrationManager.resourceManager).toBe(resourceManager);
    
    // Test access to registered resources
    const llmClient = gitIntegrationManager.resourceManager.llmClient;
    expect(llmClient).toBeDefined();
    expect(typeof llmClient.generateResponse).toBe('function');
    
    const fileOps = gitIntegrationManager.resourceManager.fileOperations;
    expect(fileOps).toBeDefined();
    expect(typeof fileOps.readFile).toBe('function');
    
    console.log('✅ ResourceManager dependency injection working');
  });

  test('should integrate with existing LLMClient for commit messages', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    const commitOrchestrator = gitIntegrationManager.getCommitOrchestrator();
    expect(commitOrchestrator).toBeDefined();
    expect(commitOrchestrator.llmClient).toBeDefined();
    
    // Test LLM integration for commit message generation
    const message = await commitOrchestrator.generatePhaseMessage('planning', {
      files: ['plan.md', 'structure.json'],
      summary: 'Project planning completed'
    });
    
    expect(message).toBeDefined();
    expect(typeof message).toBe('string');
    console.log('✅ LLM integration for commit messages working');
  });

  test('should access existing file operations tools', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    // Test that components can access file operations
    const fileOps = gitIntegrationManager.resourceManager.fileOperations;
    
    const content = await fileOps.readFile('test.js');
    expect(content).toBe('file content');
    
    const writeResult = await fileOps.writeFile('test.js', 'new content');
    expect(writeResult).toBe(true);
    
    console.log('✅ File operations integration working');
  });

  test('should access GitHub module integration', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    const githubAuth = gitIntegrationManager.getGitHubAuth();
    expect(githubAuth).toBeDefined();
    expect(githubAuth.token).toBeDefined();
    
    // Test GitHub authentication
    expect(githubAuth.isInitialized()).toBe(true);
    
    console.log('✅ GitHub module integration working');
  });

  test('should handle resource dependencies gracefully', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    // Create minimal resource manager
    const minimalResourceManager = new ResourceManager();
    await minimalResourceManager.initialize();
    
    // Only register GitHub credentials
    minimalResourceManager.register('GITHUB_PAT', resourceManager.GITHUB_PAT);
    minimalResourceManager.register('llmClient', resourceManager.llmClient);
    
    gitIntegrationManager = new GitIntegrationManager(minimalResourceManager, config);
    
    // Should initialize successfully with minimal dependencies
    await gitIntegrationManager.initialize(tempDir);
    expect(gitIntegrationManager.initialized).toBe(true);
    
    console.log('✅ Minimal resource dependencies working');
  });

  test('should provide resource access to all components', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    // All components should have access to the same ResourceManager
    const repoManager = gitIntegrationManager.getRepositoryManager();
    const commitOrchestrator = gitIntegrationManager.getCommitOrchestrator();
    const branchManager = gitIntegrationManager.getBranchManager();
    
    // Test that components are initialized and accessible
    expect(repoManager.initialized).toBe(true);
    expect(commitOrchestrator.initialized).toBe(true);
    expect(branchManager.initialized).toBe(true);
    
    console.log('✅ Component resource access verified');
  });

  test('should handle missing optional resources gracefully', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    // Create resource manager without optional resources
    const limitedResourceManager = new ResourceManager();
    await limitedResourceManager.initialize();
    
    // Register only required resources
    limitedResourceManager.register('GITHUB_PAT', resourceManager.GITHUB_PAT);
    limitedResourceManager.register('llmClient', resourceManager.llmClient);
    
    gitIntegrationManager = new GitIntegrationManager(limitedResourceManager, config);
    
    // Should still initialize successfully
    await gitIntegrationManager.initialize(tempDir);
    expect(gitIntegrationManager.initialized).toBe(true);
    
    console.log('✅ Optional resource handling working');
  });

  test('should expose ResourceManager for component access', () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    // Components should be able to access ResourceManager
    expect(gitIntegrationManager.resourceManager).toBe(resourceManager);
    
    // Test direct resource access
    const githubPat = gitIntegrationManager.resourceManager.GITHUB_PAT;
    expect(githubPat).toBeDefined();
    
    const llmClient = gitIntegrationManager.resourceManager.llmClient;
    expect(llmClient).toBeDefined();
    
    console.log('✅ ResourceManager exposure working');
  });

  test('should maintain resource consistency across components', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    // All components should access the same resource instances
    const githubAuth1 = gitIntegrationManager.getGitHubAuth();
    const githubAuth2 = gitIntegrationManager.getGitHubAuth();
    
    expect(githubAuth1).toBe(githubAuth2);
    
    // Test that token is consistent
    expect(githubAuth1.token).toBe(githubAuth2.token);
    
    console.log('✅ Resource consistency verified');
  });

  test('should integrate with CodeAgent-style configuration patterns', async () => {
    // Test configuration patterns similar to CodeAgent
    const config = {
      enabled: true,
      repositoryStrategy: 'new',
      branchStrategy: 'feature',
      commitStrategy: 'phase',
      pushStrategy: 'validation',
      organization: 'AgentResults'
    };
    
    const mergedConfig = GitConfigValidator.mergeWithDefaults(config);
    gitIntegrationManager = new GitIntegrationManager(resourceManager, mergedConfig);
    
    await gitIntegrationManager.initialize(tempDir);
    
    const status = gitIntegrationManager.getStatus();
    expect(status.config.organization).toBe('AgentResults');
    expect(status.config.branchStrategy).toBe('feature');
    
    console.log('✅ CodeAgent-style configuration patterns working');
  });
});