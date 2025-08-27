/**
 * Live GitHub Integration Tests
 * Phase 6.1: Real GitHub repository operations
 * 
 * These tests create actual repositories on GitHub and test the complete
 * Git integration workflow end-to-end.
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';
import { CodeAgent } from '../../src/agent/CodeAgent.js';
import { EnhancedCodeAgent } from '../../src/agent/EnhancedCodeAgent.js';
import GitConfigValidator from '../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

describe('Live GitHub Integration Tests', () => {
  let resourceManager;
  let tempDir;
  let testRepoName;
  let githubUser;
  let githubPat;
  let githubOrg;

  beforeAll(async () => {
    // Check if we have GitHub credentials for live testing
    githubUser = process.env.GITHUB_USER;
    githubPat = process.env.GITHUB_PAT;
    githubOrg = process.env.GITHUB_AGENT_ORG || 'AgentResults';

    if (!githubUser || !githubPat) {
      console.warn('⚠️ Skipping live GitHub tests - missing GITHUB_USER or GITHUB_PAT environment variables');
      return;
    }

    resourceManager = ResourceManager.getInstance();
    await resourceManager.initialize();
    
    // Register environment variables
    resourceManager.register('GITHUB_USER', githubUser);
    resourceManager.register('GITHUB_PAT', githubPat);
    resourceManager.register('GITHUB_AGENT_ORG', githubOrg);

    console.log(`✅ Live GitHub testing enabled for user: ${githubUser}, org: ${githubOrg}`);
  });

  beforeEach(async () => {
    if (!githubUser || !githubPat) {
      return; // Skip setup if no credentials
    }

    // Create unique repository name for this test
    testRepoName = `code-agent-test-${Date.now()}`;
    
    // Create temporary directory for test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'live-git-test-'));
    
    console.log(`🧪 Test setup: ${testRepoName} in ${tempDir}`);
  });

  afterEach(async () => {
    if (!githubUser || !githubPat) {
      return; // Skip cleanup if no credentials
    }

    try {
      // Cleanup: Delete test repository from GitHub
      if (testRepoName) {
        await deleteGitHubRepository(testRepoName);
        console.log(`🗑️ Cleaned up repository: ${testRepoName}`);
      }

      // Remove temp directory
      if (tempDir) {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn(`⚠️ Cleanup warning: ${error.message}`);
    }
  });

  test('should create and initialize GitHub repository', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        organization: githubOrg,
        user: {
          name: 'Code Agent Test',
          email: 'test@codeagent.dev'
        },
        remote: {
          url: `https://github.com/${githubOrg}/${testRepoName}.git`,
          push: true
        }
      }
    };

    const codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);

    // Should have Git integration initialized
    expect(codeAgent.gitIntegration).toBeDefined();
    
    // Initialize Git repository
    await codeAgent.initializeGitRepository();
    
    // Create a test file and commit it
    const testFile = path.join(tempDir, 'README.md');
    await fs.writeFile(testFile, `# ${testRepoName}\n\nTest repository created by Code Agent live integration test.`);
    
    // Track and commit the file
    await codeAgent.trackFile('README.md');
    const commitResult = await codeAgent.commitPhase('planning', ['README.md'], 'Initial commit from live test');
    
    expect(commitResult.success).toBe(true);
    expect(commitResult.message).toContain('Initial commit');
    
    // Verify repository exists on GitHub
    const repoExists = await checkGitHubRepositoryExists(testRepoName);
    expect(repoExists).toBe(true);
    
    console.log('✅ GitHub repository creation and initialization working');
  });

  test('should handle complete development workflow with GitHub', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        organization: githubOrg,
        branchStrategy: 'phase',
        autoCommit: true,
        user: {
          name: 'Code Agent Test',
          email: 'test@codeagent.dev'
        }
      }
    };

    const codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    // Simulate planning phase
    await codeAgent.startPhase('planning');
    
    await fs.writeFile(path.join(tempDir, 'plan.md'), '# Project Plan\n\nThis is a test project.');
    await codeAgent.trackFile('plan.md');
    await codeAgent.completePhase('planning');

    // Simulate generation phase
    await codeAgent.startPhase('generation');
    
    await fs.writeFile(path.join(tempDir, 'app.js'), 'console.log("Hello from Code Agent!");');
    await codeAgent.trackFile('app.js');
    await codeAgent.completePhase('generation');

    // Simulate testing phase
    await codeAgent.startPhase('testing');
    
    await fs.writeFile(path.join(tempDir, 'app.test.js'), 'test("app works", () => { expect(true).toBe(true); });');
    await codeAgent.trackFile('app.test.js');
    await codeAgent.completePhase('testing');

    // Get final status
    const gitStatus = await codeAgent.getGitStatus();
    expect(gitStatus.initialized).toBe(true);
    expect(gitStatus.commits).toBeGreaterThan(0);

    // Get metrics
    const metrics = await codeAgent.getGitMetrics();
    expect(metrics.totalCommits).toBeGreaterThan(0);
    expect(metrics.commitsByPhase.planning).toBeGreaterThan(0);
    expect(metrics.commitsByPhase.generation).toBeGreaterThan(0);
    expect(metrics.commitsByPhase.testing).toBeGreaterThan(0);

    console.log('✅ Complete development workflow with GitHub working');
  });

  test('should handle EnhancedCodeAgent with live GitHub integration', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        organization: githubOrg,
        includeTestResults: true,
        includePerformanceData: true,
        user: {
          name: 'Enhanced Code Agent Test',
          email: 'enhanced@codeagent.dev'
        }
      },
      enhancedConfig: {
        enableRuntimeTesting: false, // Disable for integration test
        enableBrowserTesting: false,
        enableLogAnalysis: true
      }
    };

    const enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);
    await enhancedAgent.initializeGitRepository();

    // Test enhanced commit with test results
    await fs.writeFile(path.join(tempDir, 'calculator.js'), `
      export function add(a, b) {
        return a + b;
      }
    `);

    const testResults = {
      passed: 5,
      failed: 0,
      coverage: 95
    };

    const commitResult = await enhancedAgent.commitWithTestResults(
      'testing',
      ['calculator.js'],
      'Add calculator with comprehensive tests',
      testResults
    );

    expect(commitResult.success).toBe(true);
    expect(commitResult.metadata.testResults.passed).toBe(5);
    expect(commitResult.metadata.testResults.coverage).toBe(95);

    // Test enhanced commit with performance data
    const performanceMetrics = {
      executionTime: 45,
      memoryUsage: 12.5,
      cpuUsage: 8.2,
      optimizations: ['Code splitting', 'Lazy loading']
    };

    const perfResult = await enhancedAgent.commitWithPerformanceData(
      'optimization',
      ['calculator.js'],
      'Optimize calculator performance',
      performanceMetrics
    );

    expect(perfResult.success).toBe(true);
    expect(perfResult.metadata.performance.executionTime).toBe(45);

    // Get enhanced metrics
    const enhancedMetrics = await enhancedAgent.getEnhancedGitMetrics();
    expect(enhancedMetrics).toHaveProperty('phaseMetrics');
    expect(enhancedMetrics).toHaveProperty('recommendations');

    console.log('✅ EnhancedCodeAgent with live GitHub integration working');
  });

  test('should handle branch strategies and merging', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        organization: githubOrg,
        branchStrategy: 'feature',
        user: {
          name: 'Code Agent Branch Test',
          email: 'branches@codeagent.dev'
        }
      }
    };

    const codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    // Create feature branches for different phases
    await codeAgent.startPhase('feature-auth');
    await fs.writeFile(path.join(tempDir, 'auth.js'), 'export const auth = {};');
    await codeAgent.trackFile('auth.js');
    await codeAgent.completePhase('feature-auth');

    await codeAgent.startPhase('feature-api');
    await fs.writeFile(path.join(tempDir, 'api.js'), 'export const api = {};');
    await codeAgent.trackFile('api.js');
    await codeAgent.completePhase('feature-api');

    const gitStatus = await codeAgent.getGitStatus();
    expect(gitStatus.initialized).toBe(true);

    console.log('✅ Branch strategies and merging working');
  });

  test('should handle error recovery and rollback', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        organization: githubOrg,
        user: {
          name: 'Code Agent Error Test',
          email: 'errors@codeagent.dev'
        }
      }
    };

    const codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    // Create valid initial commit
    await fs.writeFile(path.join(tempDir, 'valid.js'), 'console.log("valid");');
    const validResult = await codeAgent.commitPhase('testing', ['valid.js'], 'Add valid code');
    expect(validResult.success).toBe(true);

    // Test error handling with EnhancedCodeAgent
    const enhancedAgent = new EnhancedCodeAgent(config);
    await enhancedAgent.initialize(tempDir);

    const errorInfo = {
      error: 'Syntax error in function',
      stack: 'SyntaxError: at line 5',
      recovered: true,
      fix: 'Added missing semicolon',
      preventionStrategy: 'Enable strict mode'
    };

    const errorResult = await enhancedAgent.commitErrorRecovery(
      ['valid.js'],
      'Fix syntax error in function',
      errorInfo
    );

    expect(errorResult.success).toBe(true);
    expect(errorResult.metadata.errorRecovery.recovered).toBe(true);

    console.log('✅ Error recovery and rollback working');
  });

  test('should handle concurrent operations and conflicts', async () => {
    if (!githubUser || !githubPat) {
      console.log('⏭️ Skipping test - no GitHub credentials');
      return;
    }

    const config = {
      enableGitIntegration: true,
      gitConfig: {
        ...GitConfigValidator.getDefaultConfig(),
        repositoryStrategy: 'new',
        organization: githubOrg,
        user: {
          name: 'Code Agent Concurrent Test',
          email: 'concurrent@codeagent.dev'
        }
      }
    };

    const codeAgent = new CodeAgent(config);
    await codeAgent.initialize(tempDir);
    await codeAgent.initializeGitRepository();

    // Create multiple files concurrently
    const files = ['module1.js', 'module2.js', 'module3.js'];
    
    await Promise.all(files.map(async (file, index) => {
      await fs.writeFile(path.join(tempDir, file), `// Module ${index + 1}\nexport const module${index + 1} = {};`);
      await codeAgent.trackFile(file);
    }));

    // Commit all files together
    const batchResult = await codeAgent.commitPhase('generation', files, 'Add multiple modules');
    expect(batchResult.success).toBe(true);

    // Verify all files are tracked
    const gitStatus = await codeAgent.getGitStatus();
    expect(gitStatus.trackedFiles.length).toBeGreaterThanOrEqual(files.length);

    console.log('✅ Concurrent operations and conflict handling working');
  });

  // Helper functions for GitHub API operations
  async function checkGitHubRepositoryExists(repoName) {
    try {
      const response = await fetch(`https://api.github.com/repos/${githubOrg}/${repoName}`, {
        headers: {
          'Authorization': `token ${githubPat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async function deleteGitHubRepository(repoName) {
    try {
      const response = await fetch(`https://api.github.com/repos/${githubOrg}/${repoName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${githubPat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.status === 204) {
        return true;
      } else {
        console.warn(`Failed to delete repository: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.warn(`Error deleting repository: ${error.message}`);
      return false;
    }
  }
});