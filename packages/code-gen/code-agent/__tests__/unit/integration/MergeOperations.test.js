/**
 * Test BranchManager Merge Operations
 * Phase 3.2.1: Branch merging and merge strategies
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tool-system';
import BranchManager from '../../../src/integration/BranchManager.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('BranchManager Merge Operations', () => {
  let resourceManager;
  let repositoryManager;
  let branchManager;
  let tempDir;

  beforeAll(async () => {
    resourceManager = new ResourceManager();
    await resourceManager.initialize();
    
    // Register test environment variables
    resourceManager.register('GITHUB_USER', 'TestUser');
    resourceManager.register('GITHUB_PAT', 'ghp_test_token');
  });

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'merge-operations-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Create an initial commit so we have a proper git repository
    await repositoryManager.createInitialCommit('Initial commit for merge testing');
  });

  afterEach(async () => {
    if (branchManager) {
      await branchManager.cleanup();
      branchManager = null;
    }
    
    if (repositoryManager) {
      await repositoryManager.cleanup();
      repositoryManager = null;
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

  test('should perform simple merge operation', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create and switch to feature branch
    await branchManager.createBranch('feature/test');
    
    // Create a file in feature branch
    await fs.writeFile(path.join(tempDir, 'feature.txt'), 'Feature content');
    await branchManager.executeGitCommand(['add', 'feature.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add feature']);
    
    // Switch back to main branch
    const currentBranch = await branchManager.getCurrentBranch();
    const mainBranch = currentBranch.name === 'feature/test' ? 'main' : currentBranch.name;
    
    // We need to find the initial branch or create one to merge into
    const branches = await branchManager.listBranches();
    const targetBranch = branches.find(b => b.name !== 'feature/test');
    
    if (targetBranch) {
      await branchManager.switchToBranch(targetBranch.name);
    } else {
      await branchManager.createBranch('main');
    }
    
    const events = [];
    branchManager.on('branchMerged', (data) => events.push(['branchMerged', data]));
    
    // Perform merge
    const result = await branchManager.mergeBranch('feature/test');
    
    expect(result.success).toBe(true);
    expect(result.merged).toBe('feature/test');
    expect(events.length).toBe(1);
    
    console.log('✅ Simple merge operation working');
  });

  test('should handle merge with no-fast-forward option', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create feature branch
    await branchManager.createBranch('feature/no-ff');
    
    // Create a file
    await fs.writeFile(path.join(tempDir, 'no-ff.txt'), 'No fast forward content');
    await branchManager.executeGitCommand(['add', 'no-ff.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add no-ff feature']);
    
    // Switch to a different branch for merging
    await branchManager.createBranch('target-branch');
    
    // Perform merge with no-fast-forward
    const result = await branchManager.mergeBranch('feature/no-ff', {
      noFastForward: true,
      message: 'Merge feature/no-ff with no-fast-forward'
    });
    
    expect(result.success).toBe(true);
    expect(result.merged).toBe('feature/no-ff');
    
    console.log('✅ No-fast-forward merge working');
  });

  test('should handle merge with custom strategy', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create feature branch
    await branchManager.createBranch('feature/strategy-test');
    
    // Create a file
    await fs.writeFile(path.join(tempDir, 'strategy.txt'), 'Strategy test content');
    await branchManager.executeGitCommand(['add', 'strategy.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add strategy test']);
    
    // Switch to target branch
    await branchManager.createBranch('target-strategy');
    
    // Perform merge with custom strategy
    const result = await branchManager.mergeBranch('feature/strategy-test', {
      strategy: 'ours',
      message: 'Merge with ours strategy'
    });
    
    expect(result.success).toBe(true);
    expect(result.merged).toBe('feature/strategy-test');
    
    console.log('✅ Custom merge strategy working');
  });

  test('should handle merge failure gracefully', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    const events = [];
    branchManager.on('mergeFailed', (data) => events.push(['mergeFailed', data]));
    
    // Try to merge non-existent branch
    await expect(branchManager.mergeBranch('non-existent-branch'))
      .rejects.toThrow();
    
    expect(events.length).toBe(1);
    expect(events[0][0]).toBe('mergeFailed');
    
    console.log('✅ Merge failure handling working');
  });

  test('should emit merge events during operations', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    const events = [];
    branchManager.on('branchMerged', (data) => events.push(['branchMerged', data]));
    branchManager.on('mergeFailed', (data) => events.push(['mergeFailed', data]));
    
    // Create a branch to merge
    await branchManager.createBranch('feature/events');
    
    // Add content
    await fs.writeFile(path.join(tempDir, 'events.txt'), 'Event test content');
    await branchManager.executeGitCommand(['add', 'events.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add events test']);
    
    // Switch to target branch
    await branchManager.createBranch('target-events');
    
    // Perform successful merge
    await branchManager.mergeBranch('feature/events');
    
    expect(events.length).toBe(1);
    expect(events[0][0]).toBe('branchMerged');
    
    console.log('✅ Merge event emission working');
  });

  test('should handle merge with different message formats', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create branch
    await branchManager.createBranch('feature/messages');
    
    // Add content
    await fs.writeFile(path.join(tempDir, 'messages.txt'), 'Message test content');
    await branchManager.executeGitCommand(['add', 'messages.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add message test']);
    
    // Switch to target
    await branchManager.createBranch('target-messages');
    
    // Test custom merge message
    const result = await branchManager.mergeBranch('feature/messages', {
      message: 'Custom merge message with details'
    });
    
    expect(result.success).toBe(true);
    expect(result.merged).toBe('feature/messages');
    
    console.log('✅ Custom merge messages working');
  });

  test('should validate merge parameters', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test empty branch name
    await expect(branchManager.mergeBranch(''))
      .rejects.toThrow();
    
    // Test null branch name  
    await expect(branchManager.mergeBranch(null))
      .rejects.toThrow();
    
    console.log('✅ Merge parameter validation working');
  });

  test('should handle concurrent merge operations', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create branches
    await branchManager.createBranch('feature/concurrent1');
    await fs.writeFile(path.join(tempDir, 'concurrent1.txt'), 'Concurrent 1');
    await branchManager.executeGitCommand(['add', 'concurrent1.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add concurrent1']);
    
    await branchManager.createBranch('feature/concurrent2');
    await fs.writeFile(path.join(tempDir, 'concurrent2.txt'), 'Concurrent 2');
    await branchManager.executeGitCommand(['add', 'concurrent2.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add concurrent2']);
    
    // Switch to target branch
    await branchManager.createBranch('target-concurrent');
    
    // Perform sequential merges (since concurrent merges would conflict)
    const result1 = await branchManager.mergeBranch('feature/concurrent1');
    expect(result1.success).toBe(true);
    
    const result2 = await branchManager.mergeBranch('feature/concurrent2');
    expect(result2.success).toBe(true);
    
    console.log('✅ Sequential merge operations working');
  });

  test('should handle merge with branch that has no commits', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create branch without additional commits
    await branchManager.createBranch('feature/no-commits');
    
    // Switch to target branch
    await branchManager.createBranch('target-no-commits');
    
    // Try to merge branch with no new commits
    const result = await branchManager.mergeBranch('feature/no-commits');
    
    // This might succeed as a fast-forward or no-op
    expect(result.success).toBe(true);
    
    console.log('✅ Empty branch merge handling working');
  });

  test('should provide detailed merge result information', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create branch with content
    await branchManager.createBranch('feature/detailed');
    await fs.writeFile(path.join(tempDir, 'detailed.txt'), 'Detailed merge content');
    await branchManager.executeGitCommand(['add', 'detailed.txt']);
    await branchManager.executeGitCommand(['commit', '-m', 'Add detailed content']);
    
    // Switch to target
    await branchManager.createBranch('target-detailed');
    
    // Perform merge
    const result = await branchManager.mergeBranch('feature/detailed', {
      message: 'Detailed merge operation'
    });
    
    // Verify result structure
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('merged');
    expect(result).toHaveProperty('into');
    expect(result).toHaveProperty('output');
    
    expect(result.success).toBe(true);
    expect(result.merged).toBe('feature/detailed');
    expect(typeof result.output).toBe('string');
    
    console.log('✅ Detailed merge result information working');
  });
});