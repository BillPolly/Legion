/**
 * Test GitIntegrationManager Base Structure
 * Phase 1.2.1: GitIntegrationManager initialization and cleanup
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import GitIntegrationManager from '../../../src/integration/GitIntegrationManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('GitIntegrationManager Base Structure', () => {
  let resourceManager;
  let tempDir;
  let gitIntegrationManager;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register GitHub environment variables
    if (resourceManager.has('env.GITHUB_PAT')) {
      resourceManager.register('GITHUB_PAT', resourceManager.get('env.GITHUB_PAT'));
    }
    if (resourceManager.has('env.GITHUB_AGENT_ORG')) {
      resourceManager.register('GITHUB_AGENT_ORG', resourceManager.get('env.GITHUB_AGENT_ORG'));
    }
    if (resourceManager.has('env.GITHUB_USER')) {
      resourceManager.register('GITHUB_USER', resourceManager.get('env.GITHUB_USER'));
    }
    
    // Register a mock LLM client for CommitOrchestrator
    resourceManager.register('llmClient', {
      generateResponse: async (prompt) => 'Mock LLM response'
    });
  });

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-integration-test-'));
  });

  afterEach(async () => {
    // Cleanup
    if (gitIntegrationManager) {
      await gitIntegrationManager.cleanup();
      gitIntegrationManager = null;
    }
    
    // Remove temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to cleanup temp directory:', error.message);
      }
    }
  });

  test('should create GitIntegrationManager with ResourceManager', () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    expect(gitIntegrationManager).toBeDefined();
    expect(gitIntegrationManager.resourceManager).toBe(resourceManager);
    expect(gitIntegrationManager.config).toBeDefined();
    expect(gitIntegrationManager.config.enabled).toBe(true);
    expect(gitIntegrationManager.initialized).toBe(false);
  });

  test('should initialize GitIntegrationManager components', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    await gitIntegrationManager.initialize(tempDir);
    
    expect(gitIntegrationManager.initialized).toBe(true);
    expect(gitIntegrationManager.workingDirectory).toBe(tempDir);
    expect(gitIntegrationManager.githubAuth).toBeDefined();
    expect(gitIntegrationManager.repositoryManager).toBeDefined();
    expect(gitIntegrationManager.commitOrchestrator).toBeDefined();
    expect(gitIntegrationManager.branchManager).toBeDefined();
    
    console.log('✅ GitIntegrationManager initialized successfully');
  });

  test('should handle initialization with invalid directory', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    await expect(gitIntegrationManager.initialize('/non/existent/directory'))
      .rejects.toThrow();
  });

  test('should validate configuration during initialization', async () => {
    const invalidConfig = {
      enabled: true,
      repositoryStrategy: 'invalid',
      branchStrategy: 'invalid'
    };
    
    expect(() => {
      gitIntegrationManager = new GitIntegrationManager(resourceManager, invalidConfig);
    }).toThrow();
  });

  test('should cleanup resources properly', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    expect(gitIntegrationManager.initialized).toBe(true);
    
    await gitIntegrationManager.cleanup();
    
    expect(gitIntegrationManager.initialized).toBe(false);
    console.log('✅ GitIntegrationManager cleanup completed');
  });

  test('should emit events during lifecycle', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    const events = [];
    gitIntegrationManager.on('initialize', (data) => events.push(['initialize', data]));
    gitIntegrationManager.on('cleanup', (data) => events.push(['cleanup', data]));
    
    await gitIntegrationManager.initialize(tempDir);
    await gitIntegrationManager.cleanup();
    
    expect(events).toHaveLength(2);
    expect(events[0][0]).toBe('initialize');
    expect(events[1][0]).toBe('cleanup');
  });

  test('should provide component access methods', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    await gitIntegrationManager.initialize(tempDir);
    
    expect(gitIntegrationManager.getGitHubAuth()).toBeDefined();
    expect(gitIntegrationManager.getRepositoryManager()).toBeDefined();
    expect(gitIntegrationManager.getCommitOrchestrator()).toBeDefined();
    expect(gitIntegrationManager.getBranchManager()).toBeDefined();
  });

  test('should handle multiple initialization calls gracefully', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    await gitIntegrationManager.initialize(tempDir);
    expect(gitIntegrationManager.initialized).toBe(true);
    
    // Second initialization should not fail but should not re-initialize
    await gitIntegrationManager.initialize(tempDir);
    expect(gitIntegrationManager.initialized).toBe(true);
  });

  test('should provide status information', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    gitIntegrationManager = new GitIntegrationManager(resourceManager, config);
    
    let status = gitIntegrationManager.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.workingDirectory).toBe(null);
    
    await gitIntegrationManager.initialize(tempDir);
    
    status = gitIntegrationManager.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.workingDirectory).toBe(tempDir);
    expect(status.config).toBeDefined();
  });

  test('should validate ResourceManager dependencies', async () => {
    const config = GitConfigValidator.getDefaultConfig();
    config.enabled = true;
    
    // Create a ResourceManager without GitHub credentials
    const emptyResourceManager = new ResourceManager();
    await emptyResourceManager.initialize();
    
    gitIntegrationManager = new GitIntegrationManager(emptyResourceManager, config);
    
    await expect(gitIntegrationManager.initialize(tempDir))
      .rejects.toThrow();
  });
});