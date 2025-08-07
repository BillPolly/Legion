/**
 * Test BranchManager - Branch management and strategies
 * Phase 3.1: Branch creation, switching, deletion, and strategy implementation
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools';
import BranchManager from '../../../src/integration/BranchManager.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('BranchManager Branch Management and Strategies', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-manager-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Create an initial commit so we have a proper git repository
    await repositoryManager.createInitialCommit('Initial commit for testing');
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

  test('should initialize BranchManager with default configuration', async () => {
    const config = { branchStrategy: 'main' };
    branchManager = new BranchManager(repositoryManager, config);
    
    expect(branchManager.initialized).toBe(false);
    expect(branchManager.branchStrategy).toBe('main');
    expect(branchManager.defaultBranch).toBe('main');
    
    await branchManager.initialize();
    
    expect(branchManager.initialized).toBe(true);
    expect(branchManager.isInitialized()).toBe(true);
    expect(branchManager.currentBranch).toBeDefined();
    
    console.log('✅ BranchManager initialization working');
  });

  test('should fail initialization without RepositoryManager', async () => {
    const invalidRepoManager = { isInitialized: () => false };
    const config = {};
    branchManager = new BranchManager(invalidRepoManager, config);
    
    await expect(branchManager.initialize())
      .rejects.toThrow('RepositoryManager must be initialized first');
    
    console.log('✅ Initialization validation working');
  });

  test('should get current branch information', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    const currentBranch = await branchManager.getCurrentBranch();
    
    expect(currentBranch).toBeDefined();
    expect(currentBranch.name).toBeDefined();
    expect(typeof currentBranch.detached).toBe('boolean');
    
    // Should be on main branch for new repository
    expect(currentBranch.name).toBe('main');
    expect(currentBranch.detached).toBe(false);
    
    console.log('✅ Current branch detection working');
  });

  test('should create new branch with validation', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    const events = [];
    branchManager.on('branchCreated', (data) => events.push(['branchCreated', data]));
    
    const result = await branchManager.createBranch('feature/test-branch');
    
    expect(result.success).toBe(true);
    expect(result.name).toBe('feature/test-branch');
    expect(result.current).toBe(true);
    expect(events.length).toBe(1);
    
    // Verify we're now on the new branch
    const currentBranch = await branchManager.getCurrentBranch();
    expect(currentBranch.name).toBe('feature/test-branch');
    
    console.log('✅ Branch creation working');
  });

  test('should validate branch names', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test invalid names
    await expect(branchManager.createBranch(''))
      .rejects.toThrow('Branch name must be a non-empty string');
    
    await expect(branchManager.createBranch('main'))
      .rejects.toThrow('reserved');
    
    // The sanitization should convert invalid chars to dashes
    const sanitized = branchManager.validateBranchName('invalid@branch!name');
    expect(sanitized).toBe('invalid-branch-name');
    
    // Test valid name with sanitization
    const result = await branchManager.createBranch('Feature-Test-Branch');
    expect(result.name).toBe('feature-test-branch');
    
    console.log('✅ Branch name validation working');
  });

  test('should switch to existing branch', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create a new branch
    await branchManager.createBranch('test-branch');
    
    // Create another branch to switch to
    await branchManager.createBranch('switch-target');
    
    const events = [];
    branchManager.on('branchSwitched', (data) => events.push(['branchSwitched', data]));
    
    const result = await branchManager.switchToBranch('test-branch');
    
    expect(result.success).toBe(true);
    expect(result.name).toBe('test-branch');
    expect(events.length).toBe(1);
    
    // Verify we're on test-branch
    const currentBranch = await branchManager.getCurrentBranch();
    expect(currentBranch.name).toBe('test-branch');
    
    console.log('✅ Branch switching working');
  });

  test('should delete branch with safety checks', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create and switch to a test branch
    await branchManager.createBranch('to-delete');
    
    // Create a temporary branch to switch to before deleting
    await branchManager.createBranch('temp-branch');
    
    const events = [];
    branchManager.on('branchDeleted', (data) => events.push(['branchDeleted', data]));
    
    // Delete the test branch
    const result = await branchManager.deleteBranch('to-delete');
    
    expect(result.success).toBe(true);
    expect(result.deleted).toBe('to-delete');
    expect(events.length).toBe(1);
    
    console.log('✅ Branch deletion working');
  });

  test('should prevent deleting current branch', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Try to delete current branch
    await expect(branchManager.deleteBranch('main'))
      .rejects.toThrow('Cannot delete current branch');
    
    console.log('✅ Current branch deletion prevention working');
  });

  test('should list local branches', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create additional branches
    await branchManager.createBranch('branch1');
    await branchManager.createBranch('branch2');
    
    const branches = await branchManager.listBranches();
    
    expect(Array.isArray(branches)).toBe(true);
    expect(branches.length).toBeGreaterThanOrEqual(1); // At least the initial branch
    
    const branchNames = branches.map(b => b.name);
    expect(branchNames).toContain('branch1');
    expect(branchNames).toContain('branch2');
    
    // One branch should be marked as current
    const currentBranches = branches.filter(b => b.current);
    expect(currentBranches.length).toBe(1);
    
    console.log('✅ Branch listing working');
  });

  test('should generate branch names based on strategy', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test main strategy
    branchManager.branchStrategy = 'main';
    const mainName = branchManager.generateBranchName();
    expect(mainName).toBe('main');
    
    // Test feature strategy
    branchManager.branchStrategy = 'feature';
    const featureName = branchManager.generateBranchName({ feature: 'user-auth' });
    expect(featureName).toBe('feature/user-auth');
    
    // Test timestamp strategy
    branchManager.branchStrategy = 'timestamp';
    const timestampName = branchManager.generateBranchName({ prefix: 'dev' });
    expect(timestampName).toMatch(/^dev-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/);
    
    // Test phase strategy
    branchManager.branchStrategy = 'phase';
    const phaseName = branchManager.generateBranchName({ phase: 'implementation' });
    expect(phaseName).toMatch(/^implementation-\d{2}-\d{2}(-\d{2})?$/); // Allow for seconds too
    
    console.log('✅ Branch name generation strategies working');
  });

  test('should create strategy-based branches', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    const result = await branchManager.createStrategyBranch({
      phase: 'testing',
      options: {}
    });
    
    expect(result.success).toBe(true);
    expect(result.name).toBe('feature/testing');
    
    console.log('✅ Strategy-based branch creation working');
  });

  test('should handle unique branch name generation', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create first branch
    await branchManager.createStrategyBranch({ phase: 'testing' });
    
    // Switch back to a different branch
    const branches = await branchManager.listBranches();
    const targetBranch = branches.find(b => b.name !== 'testing');
    if (targetBranch) {
      await branchManager.switchToBranch(targetBranch.name);
    } else {
      await branchManager.createBranch('fallback');
    }
    
    // Create second branch with same context (should get unique name)
    const result = await branchManager.createStrategyBranch({ phase: 'testing' });
    
    expect(result.success).toBe(true);
    expect(result.name).toMatch(/^feature\/testing-\d{6}$/);
    
    console.log('✅ Unique branch name generation working');
  });

  test('should check branch existence', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Check existing branch (use current branch as we know it exists)
    const currentBranch = await branchManager.getCurrentBranch();
    const existingBranchExists = await branchManager.branchExists(currentBranch.name);
    expect(existingBranchExists).toBe(true);
    
    // Check non-existing branch
    const fakeExists = await branchManager.branchExists('non-existent-branch');
    expect(fakeExists).toBe(false);
    
    console.log('✅ Branch existence checking working');
  });

  test('should sanitize branch names', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test various sanitization scenarios
    expect(branchManager.sanitizeBranchName('Feature Name')).toBe('feature-name');
    expect(branchManager.sanitizeBranchName('Multiple---Dashes')).toBe('multiple-dashes');
    expect(branchManager.sanitizeBranchName('--Leading-Trailing--')).toBe('leading-trailing');
    expect(branchManager.sanitizeBranchName('UPPERCASE')).toBe('uppercase');
    expect(branchManager.sanitizeBranchName('special!@#chars')).toBe('special-chars');
    
    console.log('✅ Branch name sanitization working');
  });

  test('should get branch status and information', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create some branches
    await branchManager.createBranch('test1');
    await branchManager.createBranch('test2');
    
    const status = await branchManager.getBranchStatus();
    
    expect(status.current).toBeDefined();
    expect(status.branches).toBeDefined();
    expect(status.strategy).toBe('feature');
    expect(status.defaultBranch).toBe('main');
    expect(status.branches.length).toBeGreaterThanOrEqual(1);
    
    console.log('✅ Branch status retrieval working');
  });

  test('should emit events during operations', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    const events = [];
    branchManager.on('initialized', (data) => events.push(['initialized', data]));
    branchManager.on('branchInfoLoaded', (data) => events.push(['branchInfoLoaded', data]));
    branchManager.on('branchCreated', (data) => events.push(['branchCreated', data]));
    
    await branchManager.initialize();
    await branchManager.createBranch('event-test');
    
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(([type]) => type === 'initialized')).toBe(true);
    expect(events.some(([type]) => type === 'branchCreated')).toBe(true);
    
    console.log('✅ Event emission working');
  });

  test('should handle branch creation with options', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Repository already has initial commit, create a simple commit reference
    
    // Create branch with starting point
    const result = await branchManager.createBranch('from-commit', {
      startPoint: 'HEAD~0'
    });
    
    expect(result.success).toBe(true);
    expect(result.name).toBe('from-commit');
    
    console.log('✅ Branch creation with options working');
  });

  test('should handle manager status correctly', async () => {
    const config = { branchStrategy: 'timestamp' };
    branchManager = new BranchManager(repositoryManager, config);
    
    let status = branchManager.getStatus();
    expect(status.initialized).toBe(false);
    expect(status.branchStrategy).toBe('timestamp');
    
    await branchManager.initialize();
    
    status = branchManager.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.currentBranch).toBeDefined();
    expect(typeof status.branchCount).toBe('number');
    
    console.log('✅ Manager status tracking working');
  });

  test('should handle cleanup properly', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    expect(branchManager.initialized).toBe(true);
    
    await branchManager.cleanup();
    
    expect(branchManager.initialized).toBe(false);
    
    console.log('✅ Cleanup working');
  });

  test('should handle Git command errors gracefully', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Try to switch to non-existent branch
    await expect(branchManager.switchToBranch('non-existent-branch'))
      .rejects.toThrow();
    
    // Try to delete non-existent branch
    await expect(branchManager.deleteBranch('non-existent-branch'))
      .rejects.toThrow();
    
    console.log('✅ Git command error handling working');
  });

  test('should configure branch naming limits', async () => {
    const config = {
      maxBranchNameLength: 20
    };
    branchManager = new BranchManager(repositoryManager, config);
    
    expect(branchManager.namingConfig.maxLength).toBe(20);
    
    // Test length validation
    const longName = 'a'.repeat(25);
    expect(() => branchManager.validateBranchName(longName))
      .toThrow('too long');
    
    console.log('✅ Branch naming configuration working');
  });

  test('should handle prefix configuration', async () => {
    const config = {
      branchStrategy: 'feature',
      branchPrefix: 'custom'
    };
    branchManager = new BranchManager(repositoryManager, config);
    
    const branchName = branchManager.generateBranchName({ feature: 'auth' });
    expect(branchName).toBe('custom/auth');
    
    console.log('✅ Branch prefix configuration working');
  });
});