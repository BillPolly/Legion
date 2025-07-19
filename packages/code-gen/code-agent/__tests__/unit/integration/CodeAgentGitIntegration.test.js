/**
 * Test CodeAgent Git Integration
 * Phase 5.1.1: Git integration in base CodeAgent class
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import { CodeAgent } from '../../../src/agent/CodeAgent.js';
import GitIntegrationManager from '../../../src/integration/GitIntegrationManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('CodeAgent Git Integration', () => {
  let resourceManager;
  let codeAgent;
  let tempDir;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.register('GITHUB_USER', 'TestUser');
    resourceManager.register('GITHUB_PAT', 'ghp_test_token');
    resourceManager.register('GITHUB_AGENT_ORG', 'AgentResults');
  });

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeagent-git-test-'));
  });

  afterEach(async () => {
    if (codeAgent) {
      await codeAgent.cleanup();
      codeAgent = null;
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

  test('should initialize GitIntegrationManager in CodeAgent', async () => {
    // Initialize Git repository first
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const git = spawn('git', ['init'], { cwd: tempDir });
      git.on('close', (code) => code === 0 ? resolve() : reject(new Error('Git init failed')));
    });
    
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig()
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    
    // Check that Git integration was initialized
    expect(codeAgent.gitIntegration).toBeDefined();
    expect(codeAgent.gitIntegration).toBeInstanceOf(GitIntegrationManager);
    expect(codeAgent.gitIntegration.isInitialized()).toBe(true);
    
    console.log('✅ GitIntegrationManager initialization in CodeAgent working');
  });

  test('should handle Git operations during development workflow', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        autoCommit: true,
        commitStrategy: 'phase'
      }
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    
    const events = [];
    codeAgent.on('git-initialized', (data) => events.push(['git-initialized', data]));
    codeAgent.on('git-commit', (data) => events.push(['git-commit', data]));
    codeAgent.on('git-branch', (data) => events.push(['git-branch', data]));
    
    // Simulate a simple workflow
    const requirements = {
      title: 'Test Project',
      description: 'A test project for Git integration',
      features: ['Feature 1', 'Feature 2'],
      technology: 'javascript'
    };
    
    // Should initialize repository during workflow
    await codeAgent.initializeGitRepository();
    
    // Should be able to make commits
    await fs.writeFile(path.join(tempDir, 'test.js'), 'console.log("test");');
    const commitResult = await codeAgent.commitPhase('planning', ['test.js'], 'Initial planning commit');
    
    expect(commitResult.success).toBe(true);
    expect(commitResult.message).toContain('planning');
    
    const eventTypes = events.map(e => e[0]);
    expect(eventTypes).toContain('git-initialized');
    expect(eventTypes).toContain('git-commit');
    
    console.log('✅ Git operations during development workflow working');
  });

  test('should support Git integration enable/disable functionality', async () => {
    // Test with Git disabled
    const configDisabled = {
      enableGitIntegration: false
    };
    
    codeAgent = new CodeAgent(configDisabled);
    await codeAgent.initialize(tempDir);
    
    expect(codeAgent.gitIntegration).toBeNull();
    
    // Test enabling Git after initialization
    await codeAgent.enableGitIntegrationMethod();
    expect(codeAgent.gitIntegration).toBeDefined();
    expect(codeAgent.gitIntegration.isInitialized()).toBe(true);
    
    // Test disabling Git
    await codeAgent.disableGitIntegration();
    expect(codeAgent.gitIntegration).toBeNull();
    
    console.log('✅ Git integration enable/disable functionality working');
  });

  test('should integrate Git operations with phase transitions', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        autoCommit: true,
        branchStrategy: 'phase'
      }
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    
    const gitEvents = [];
    codeAgent.on('git-phase-commit', (data) => gitEvents.push(['git-phase-commit', data]));
    codeAgent.on('git-branch-created', (data) => gitEvents.push(['git-branch-created', data]));
    
    // Initialize repository
    await codeAgent.initializeGitRepository();
    
    // Start planning phase
    await codeAgent.startPhase('planning');
    
    // Create some files
    await fs.writeFile(path.join(tempDir, 'plan.md'), '# Project Plan\n\nTest plan content');
    await codeAgent.trackFile('plan.md');
    
    // Complete planning phase - should auto-commit
    await codeAgent.completePhase('planning');
    
    // Check that phase commit was made
    const eventTypes = gitEvents.map(e => e[0]);
    expect(eventTypes).toContain('git-phase-commit');
    
    const phaseCommit = gitEvents.find(e => e[0] === 'git-phase-commit');
    expect(phaseCommit[1].phase).toBe('planning');
    expect(phaseCommit[1].files).toContain('plan.md');
    
    console.log('✅ Git integration with phase transitions working');
  });

  test('should handle Git configuration through CodeAgent', async () => {
    const customGitConfig = {
      user: {
        name: 'Test Agent',
        email: 'test@codeagent.com'
      },
      commit: {
        messageFormat: 'conventional',
        includeEmoji: true
      },
      branch: {
        strategy: 'feature',
        prefix: 'agent'
      }
    };
    
    const config = {
      enableGitIntegration: true,
      gitConfig: customGitConfig
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    
    // Get Git configuration
    const gitConfig = await codeAgent.getGitConfig();
    
    expect(gitConfig.user.name).toBe('Test Agent');
    expect(gitConfig.user.email).toBe('test@codeagent.com');
    expect(gitConfig.commit.messageFormat).toBe('conventional');
    expect(gitConfig.branch.strategy).toBe('feature');
    
    // Update Git configuration
    await codeAgent.updateGitConfig({
      commit: {
        includeEmoji: false
      }
    });
    
    const updatedConfig = await codeAgent.getGitConfig();
    expect(updatedConfig.commit.includeEmoji).toBe(false);
    
    console.log('✅ Git configuration through CodeAgent working');
  });

  test('should provide Git status information', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig()
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();
    
    // Create and track files
    await fs.writeFile(path.join(tempDir, 'index.js'), 'console.log("Hello");');
    await fs.writeFile(path.join(tempDir, 'test.js'), 'test("works", () => {});');
    
    await codeAgent.trackFile('index.js');
    
    // Get Git status
    const status = await codeAgent.getGitStatus();
    
    expect(status).toHaveProperty('initialized');
    expect(status).toHaveProperty('currentBranch');
    expect(status).toHaveProperty('trackedFiles');
    expect(status).toHaveProperty('untrackedFiles');
    expect(status).toHaveProperty('commits');
    
    expect(status.initialized).toBe(true);
    expect(status.trackedFiles).toContain('index.js');
    expect(status.untrackedFiles).toContain('test.js');
    
    console.log('✅ Git status information working');
  });

  test('should handle errors gracefully when Git is not available', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig()
    };
    
    codeAgent = new CodeAgent(config);
    
    // Mock Git command to fail
    if (codeAgent.gitIntegration) {
      codeAgent.gitIntegration.executeGitCommand = jest.fn()
        .mockRejectedValue(new Error('Git not found'));
    }
    
    const errors = [];
    codeAgent.on('error', (data) => errors.push(data));
    
    // Try to initialize in a directory without Git
    await codeAgent.initialize(tempDir);
    
    // Operations should fail gracefully
    const result = await codeAgent.commitPhase('test', [], 'Test commit');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    
    console.log('✅ Error handling when Git is not available working');
  });

  test('should integrate with existing Git repositories', async () => {
    // Create a Git repository first
    const { spawn } = await import('child_process');
    await new Promise((resolve, reject) => {
      const git = spawn('git', ['init'], { cwd: tempDir });
      git.on('close', (code) => code === 0 ? resolve() : reject(new Error('Git init failed')));
    });
    
    // Add initial commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Existing Project');
    await new Promise((resolve, reject) => {
      const git = spawn('git', ['add', 'README.md'], { cwd: tempDir });
      git.on('close', (code) => code === 0 ? resolve() : reject());
    });
    await new Promise((resolve, reject) => {
      const git = spawn('git', ['commit', '-m', 'Initial commit'], { cwd: tempDir });
      git.on('close', (code) => code === 0 ? resolve() : reject());
    });
    
    // Now initialize CodeAgent
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig()
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    
    // Should detect existing repository
    const status = await codeAgent.getGitStatus();
    expect(status.initialized).toBe(true);
    expect(status.commits).toBeGreaterThan(0);
    
    // Should be able to add new commits
    await fs.writeFile(path.join(tempDir, 'app.js'), 'const app = {};');
    const result = await codeAgent.commitPhase('development', ['app.js'], 'Add app.js');
    
    expect(result.success).toBe(true);
    
    console.log('✅ Integration with existing Git repositories working');
  });

  test('should support custom Git hooks in CodeAgent', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      gitHooks: {
        beforeCommit: async (files, message) => {
          // Custom validation
          if (files.some(f => f.endsWith('.test.js'))) {
            return { allow: true, message: `${message} [tests included]` };
          }
          return { allow: true, message };
        },
        afterCommit: async (commitInfo) => {
          console.log(`Commit created: ${commitInfo.hash}`);
        }
      }
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();
    
    // Create test file
    await fs.writeFile(path.join(tempDir, 'feature.test.js'), 'test("feature", () => {});');
    
    // Commit with hook processing
    const result = await codeAgent.commitPhase('testing', ['feature.test.js'], 'Add tests');
    
    expect(result.success).toBe(true);
    expect(result.message).toContain('[tests included]');
    
    console.log('✅ Custom Git hooks in CodeAgent working');
  });

  test('should track Git metrics and history', async () => {
    const config = {
      enableGitIntegration: true,
      gitConfig: GitConfigValidator.getDefaultConfig(),
      trackGitMetrics: true
    };
    
    codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();
    
    // Make some commits
    for (let i = 1; i <= 3; i++) {
      await fs.writeFile(path.join(tempDir, `file${i}.js`), `// File ${i}`);
      await codeAgent.commitPhase('development', [`file${i}.js`], `Add file ${i}`);
    }
    
    // Get Git metrics
    const metrics = await codeAgent.getGitMetrics();
    
    expect(metrics).toHaveProperty('totalCommits');
    expect(metrics).toHaveProperty('commitsByPhase');
    expect(metrics).toHaveProperty('filesByPhase');
    expect(metrics).toHaveProperty('averageCommitSize');
    
    expect(metrics.totalCommits).toBe(3);
    expect(metrics.commitsByPhase.development).toBe(3);
    
    console.log('✅ Git metrics and history tracking working');
  });
});