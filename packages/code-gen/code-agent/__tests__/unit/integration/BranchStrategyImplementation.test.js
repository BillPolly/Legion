/**
 * Test BranchManager Strategy Implementation
 * Phase 3.1.2: Multiple branch strategies (main, feature, timestamp, phase)
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@jsenvoy/module-loader';
import BranchManager from '../../../src/integration/BranchManager.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('BranchManager Strategy Implementation', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-strategy-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Create an initial commit so we have a proper git repository
    await repositoryManager.createInitialCommit('Initial commit for strategy testing');
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

  test('should implement main branch strategy', async () => {
    const config = { branchStrategy: 'main', defaultBranch: 'main' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test main strategy branch name generation
    const branchName = branchManager.generateBranchName();
    expect(branchName).toBe('main');
    
    // Test strategy behavior
    expect(branchManager.branchStrategy).toBe('main');
    expect(branchManager.defaultBranch).toBe('main');
    
    // Create strategy branch should use main
    const result = await branchManager.createStrategyBranch();
    expect(result.success).toBe(true);
    
    // Since we're already on the default branch, this might fail if main already exists
    // but that's fine - we're testing the strategy logic
    
    console.log('✅ Main branch strategy working');
  });

  test('should implement feature branch strategy', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test feature strategy branch name generation
    const branchName1 = branchManager.generateBranchName({ feature: 'user-auth' });
    expect(branchName1).toBe('feature/user-auth');
    
    const branchName2 = branchManager.generateBranchName({ phase: 'testing' });
    expect(branchName2).toBe('feature/testing');
    
    // Default feature name when no context provided
    const branchName3 = branchManager.generateBranchName();
    expect(branchName3).toBe('feature/feature');
    
    // Test with custom prefix
    branchManager.branchPrefix = 'dev';
    const branchName4 = branchManager.generateBranchName({ feature: 'api' });
    expect(branchName4).toBe('dev/api');
    
    // Reset prefix for actual branch creation
    branchManager.branchPrefix = '';
    
    // Create actual branches
    const result1 = await branchManager.createStrategyBranch({ feature: 'login' });
    expect(result1.success).toBe(true);
    expect(result1.name).toBe('feature/login');
    
    const result2 = await branchManager.createStrategyBranch({ phase: 'validation' });
    expect(result2.success).toBe(true);
    expect(result2.name).toBe('feature/validation');
    
    console.log('✅ Feature branch strategy working');
  });

  test('should implement timestamp branch strategy', async () => {
    const config = { branchStrategy: 'timestamp' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test timestamp strategy branch name generation
    const branchName1 = branchManager.generateBranchName({ prefix: 'dev' });
    expect(branchName1).toMatch(/^dev-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    const branchName2 = branchManager.generateBranchName({ prefix: 'feature' });
    expect(branchName2).toMatch(/^feature-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    // Default prefix when no context provided
    const branchName3 = branchManager.generateBranchName();
    expect(branchName3).toMatch(/^branch-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    // Test uniqueness - timestamp should be very precise, but let's test the pattern instead
    const name1 = branchManager.generateBranchName({ prefix: 'test' });
    const name2 = branchManager.generateBranchName({ prefix: 'test' });
    
    // Both should match the pattern
    expect(name1).toMatch(/^test-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    expect(name2).toMatch(/^test-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    // Create actual branches
    const result1 = await branchManager.createStrategyBranch({ prefix: 'experiment' });
    expect(result1.success).toBe(true);
    expect(result1.name).toMatch(/^experiment-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    const result2 = await branchManager.createStrategyBranch({ prefix: 'hotfix' });
    expect(result2.success).toBe(true);
    expect(result2.name).toMatch(/^hotfix-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    console.log('✅ Timestamp branch strategy working');
  });

  test('should implement phase branch strategy', async () => {
    const config = { branchStrategy: 'phase' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test phase strategy branch name generation
    const branchName1 = branchManager.generateBranchName({ phase: 'implementation' });
    expect(branchName1).toMatch(/^implementation-\d{2}-\d{2}(-\d{2})?$/);
    
    const branchName2 = branchManager.generateBranchName({ phase: 'testing' });
    expect(branchName2).toMatch(/^testing-\d{2}-\d{2}(-\d{2})?$/);
    
    // Default phase name when no context provided
    const branchName3 = branchManager.generateBranchName();
    expect(branchName3).toMatch(/^phase-\d{2}-\d{2}(-\d{2})?$/);
    
    // Create actual branches
    const result1 = await branchManager.createStrategyBranch({ phase: 'planning' });
    expect(result1.success).toBe(true);
    expect(result1.name).toMatch(/^planning-\d{2}-\d{2}(-\d{2})?$/);
    
    const result2 = await branchManager.createStrategyBranch({ phase: 'completion' });
    expect(result2.success).toBe(true);
    expect(result2.name).toMatch(/^completion-\d{2}-\d{2}(-\d{2})?$/);
    
    console.log('✅ Phase branch strategy working');
  });

  test('should handle strategy switching at runtime', async () => {
    const config = { branchStrategy: 'main' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Start with main strategy
    expect(branchManager.branchStrategy).toBe('main');
    let branchName = branchManager.generateBranchName();
    expect(branchName).toBe('main');
    
    // Switch to feature strategy
    branchManager.branchStrategy = 'feature';
    branchName = branchManager.generateBranchName({ feature: 'api' });
    expect(branchName).toBe('feature/api');
    
    // Switch to timestamp strategy
    branchManager.branchStrategy = 'timestamp';
    branchName = branchManager.generateBranchName({ prefix: 'dev' });
    expect(branchName).toMatch(/^dev-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    // Switch to phase strategy
    branchManager.branchStrategy = 'phase';
    branchName = branchManager.generateBranchName({ phase: 'testing' });
    expect(branchName).toMatch(/^testing-\d{2}-\d{2}(-\d{2})?$/);
    
    console.log('✅ Runtime strategy switching working');
  });

  test('should handle invalid strategy gracefully', async () => {
    const config = { branchStrategy: 'invalid-strategy' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Should fall back to default strategy (which is timestamp-based)
    const branchName = branchManager.generateBranchName({ prefix: 'test' });
    // The default fallback uses 'branch' prefix when no valid strategy
    expect(branchName).toMatch(/^branch-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    console.log('✅ Invalid strategy fallback working');
  });

  test('should respect branch prefix configuration for strategies', async () => {
    const config = { 
      branchStrategy: 'feature',
      branchPrefix: 'custom-prefix'
    };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Should use custom prefix instead of default 'feature'
    const branchName = branchManager.generateBranchName({ feature: 'auth' });
    expect(branchName).toBe('custom-prefix/auth');
    
    // Test with phase context
    const phaseName = branchManager.generateBranchName({ phase: 'testing' });
    expect(phaseName).toBe('custom-prefix/testing');
    
    console.log('✅ Branch prefix configuration working');
  });

  test('should handle complex feature names with sanitization', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test complex feature names that need sanitization
    const complexNames = [
      { input: 'User Authentication & Authorization', expected: 'feature/user-authentication-authorization' },
      { input: 'API v2.0 Implementation!', expected: 'feature/api-v2-0-implementation' },
      { input: 'Bug Fix: Login Issue #123', expected: 'feature/bug-fix-login-issue-123' },
      { input: '  Multiple   Spaces  ', expected: 'feature/multiple-spaces' }
    ];
    
    for (const { input, expected } of complexNames) {
      const branchName = branchManager.generateBranchName({ feature: input });
      expect(branchName).toBe(expected);
    }
    
    console.log('✅ Complex feature name sanitization working');
  });

  test('should create strategy-specific branch hierarchies', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create multiple feature branches
    const features = ['auth', 'api', 'ui', 'tests', 'docs'];
    const createdBranches = [];
    
    for (const feature of features) {
      const result = await branchManager.createStrategyBranch({ feature });
      expect(result.success).toBe(true);
      expect(result.name).toBe(`feature/${feature}`);
      createdBranches.push(result.name);
    }
    
    // Verify all branches exist
    const branches = await branchManager.listBranches();
    const branchNames = branches.map(b => b.name);
    
    for (const branchName of createdBranches) {
      expect(branchNames).toContain(branchName);
    }
    
    console.log('✅ Strategy-specific branch hierarchies working');
  });

  test('should emit strategy-specific events', async () => {
    const config = { branchStrategy: 'timestamp' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    const events = [];
    branchManager.on('branchCreated', (data) => events.push(['branchCreated', data]));
    branchManager.on('branchSwitched', (data) => events.push(['branchSwitched', data]));
    
    // Create timestamp-based branches
    const result1 = await branchManager.createStrategyBranch({ prefix: 'experiment' });
    expect(result1.success).toBe(true);
    
    const result2 = await branchManager.createStrategyBranch({ prefix: 'hotfix' });
    expect(result2.success).toBe(true);
    
    // Should have emitted creation events
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some(([type]) => type === 'branchCreated')).toBe(true);
    
    console.log('✅ Strategy-specific event emission working');
  });

  test('should handle strategy branch name conflicts', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create first branch
    const result1 = await branchManager.createStrategyBranch({ feature: 'auth' });
    expect(result1.success).toBe(true);
    expect(result1.name).toBe('feature/auth');
    
    // Switch to a different branch so we can create another with the same base name
    await branchManager.createBranch('temp-branch');
    
    // Try to create another branch with the same feature name
    // Should generate a unique name automatically
    const result2 = await branchManager.createStrategyBranch({ feature: 'auth' });
    expect(result2.success).toBe(true);
    expect(result2.name).toMatch(/^feature\/auth-\d{6}$/);
    
    console.log('✅ Strategy branch name conflict handling working');
  });
});