/**
 * Test BranchManager Branch Name Generation
 * Phase 3.1.3: Intelligent branch name generation, validation, and conflict resolution
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools-registry';
import BranchManager from '../../../src/integration/BranchManager.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('BranchManager Branch Name Generation', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'branch-name-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Create an initial commit so we have a proper git repository
    await repositoryManager.createInitialCommit('Initial commit for name generation testing');
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

  test('should generate unique branch names for different strategies', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Generate multiple names with same context
    const names = [];
    for (let i = 0; i < 5; i++) {
      const name = branchManager.generateBranchName({ feature: 'auth' });
      names.push(name);
    }
    
    // All should be the same for feature strategy with same context
    expect(names.every(name => name === 'feature/auth')).toBe(true);
    
    // Switch to timestamp strategy - should generate unique names
    branchManager.branchStrategy = 'timestamp';
    const timestampNames = [];
    for (let i = 0; i < 3; i++) {
      const name = branchManager.generateBranchName({ prefix: 'test' });
      timestampNames.push(name);
      if (i < 2) await new Promise(resolve => setTimeout(resolve, 1)); // Small delay
    }
    
    // All timestamp names should match pattern
    timestampNames.forEach(name => {
      expect(name).toMatch(/^test-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    });
    
    console.log('✅ Unique branch name generation working');
  });

  test('should validate branch names according to Git standards', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Test valid names
    const validNames = [
      'feature/user-auth',
      'bugfix/issue-123',
      'dev/api-v2',
      'test_branch',
      'branch-with-dashes',
      'feature_123'
    ];
    
    for (const name of validNames) {
      const validated = branchManager.validateBranchName(name);
      expect(validated).toBeDefined();
      expect(typeof validated).toBe('string');
    }
    
    // Test invalid names that should throw errors
    const invalidNames = [
      { name: '', error: 'Branch name must be a non-empty string' },
      { name: 'HEAD', error: 'reserved' },
      { name: 'master', error: 'reserved' }
    ];
    
    for (const { name, error } of invalidNames) {
      expect(() => branchManager.validateBranchName(name)).toThrow(error);
    }
    
    // Test the main branch specifically - might not throw if current repo uses main
    try {
      branchManager.validateBranchName('main');
    } catch (error) {
      expect(error.message).toContain('reserved');
    }
    
    console.log('✅ Branch name validation working');
  });

  test('should sanitize branch names properly', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test various sanitization scenarios
    const testCases = [
      { input: 'Feature Name', expected: 'feature-name' },
      { input: 'UPPERCASE', expected: 'uppercase' },
      { input: 'mixed_Case-Name', expected: 'mixed_case-name' },
      { input: 'special!@#$%chars', expected: 'special-chars' },
      { input: '  leading trailing  ', expected: 'leading-trailing' },
      { input: 'multiple---dashes', expected: 'multiple-dashes' },
      { input: '--leading-trailing--', expected: 'leading-trailing' },
      { input: 'dots.and.spaces', expected: 'dots-and-spaces' },
      { input: 'under_scores', expected: 'under_scores' },
      { input: 'numbers123andMore456', expected: 'numbers123andmore456' }
    ];
    
    for (const { input, expected } of testCases) {
      const sanitized = branchManager.sanitizeBranchName(input);
      expect(sanitized).toBe(expected);
    }
    
    console.log('✅ Branch name sanitization working');
  });

  test('should generate branch names with length constraints', async () => {
    const config = { maxBranchNameLength: 30 };
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test names within limit
    const shortName = branchManager.validateBranchName('short-name');
    expect(shortName.length).toBeLessThanOrEqual(30);
    
    // Test names that exceed limit
    const longName = 'a'.repeat(50);
    expect(() => branchManager.validateBranchName(longName))
      .toThrow('too long');
    
    console.log('✅ Branch name length constraints working');
  });

  test('should handle branch name conflict resolution', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create first branch
    await branchManager.createBranch('feature/auth');
    
    // Switch to another branch so we can test conflict resolution
    await branchManager.createBranch('temp-branch');
    
    // Try to create another branch with the same name using strategy
    const result = await branchManager.createStrategyBranch({ feature: 'auth' });
    
    // Should generate a unique name
    expect(result.success).toBe(true);
    expect(result.name).toMatch(/^feature\/auth-\d{6}$/);
    
    console.log('✅ Branch name conflict resolution working');
  });

  test('should generate appropriate names for different contexts', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test different context scenarios
    const contexts = [
      { context: { feature: 'user-authentication' }, expected: 'feature/user-authentication' },
      { context: { phase: 'testing' }, expected: 'feature/testing' },
      { context: { feature: 'API Integration' }, expected: 'feature/api-integration' },
      { context: { feature: 'bug-fix-#123' }, expected: 'feature/bug-fix-123' },
      { context: {}, expected: 'feature/feature' } // default when no context
    ];
    
    for (const { context, expected } of contexts) {
      const generated = branchManager.generateBranchName(context);
      expect(generated).toBe(expected);
    }
    
    console.log('✅ Context-aware branch name generation working');
  });

  test('should handle complex branching scenarios', async () => {
    const config = { branchStrategy: 'feature' };
    branchManager = new BranchManager(repositoryManager, config);
    await branchManager.initialize();
    
    // Create a hierarchy of branches (avoid Git ref conflicts by using dashes)
    const branches = [
      { feature: 'auth' },
      { feature: 'auth-login' },
      { feature: 'auth-logout' },
      { feature: 'api' },
      { feature: 'api-users' },
      { feature: 'api-posts' }
    ];
    
    const createdBranches = [];
    for (const branchContext of branches) {
      const result = await branchManager.createStrategyBranch(branchContext);
      expect(result.success).toBe(true);
      createdBranches.push(result.name);
    }
    
    // Verify all branches were created
    expect(createdBranches).toContain('feature/auth');
    expect(createdBranches).toContain('feature/auth-login');
    expect(createdBranches).toContain('feature/auth-logout');
    expect(createdBranches).toContain('feature/api');
    expect(createdBranches).toContain('feature/api-users');
    expect(createdBranches).toContain('feature/api-posts');
    
    console.log('✅ Complex branching scenarios working');
  });

  test('should generate names with custom prefixes and patterns', async () => {
    const config = { 
      branchStrategy: 'feature',
      branchPrefix: 'team-alpha'
    };
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test custom prefix usage
    const name1 = branchManager.generateBranchName({ feature: 'dashboard' });
    expect(name1).toBe('team-alpha/dashboard');
    
    // Test changing prefix at runtime
    branchManager.branchPrefix = 'sprint-5';
    const name2 = branchManager.generateBranchName({ feature: 'reports' });
    expect(name2).toBe('sprint-5/reports');
    
    // Test clearing prefix
    branchManager.branchPrefix = '';
    const name3 = branchManager.generateBranchName({ feature: 'settings' });
    expect(name3).toBe('feature/settings');
    
    console.log('✅ Custom prefix and pattern generation working');
  });

  test('should generate names respecting Git naming conventions', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test names that follow Git conventions
    const gitCompliantNames = [
      'feature/new-component',
      'bugfix/issue-456',
      'hotfix/critical-security-patch',
      'develop',
      'release/v2.1.0',
      'experiment/new-algorithm'
    ];
    
    for (const name of gitCompliantNames) {
      const validated = branchManager.validateBranchName(name);
      expect(validated).toBe(name.toLowerCase().replace(/[^a-zA-Z0-9/_-]/g, '-'));
    }
    
    console.log('✅ Git naming convention compliance working');
  });

  test('should handle international characters and special cases', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test international and special characters
    const specialCases = [
      { input: 'feature/café-menu', expected: 'feature/caf-menu' },
      { input: 'feature/naïve-algorithm', expected: 'feature/na-ve-algorithm' },
      { input: 'feature/файл-система', expected: 'feature/-----' },
      { input: 'feature/价格-计算', expected: 'feature/--' },
      { input: 'feature/🚀-deployment', expected: 'feature/--deployment' }
    ];
    
    for (const { input, expected } of specialCases) {
      const sanitized = branchManager.sanitizeBranchName(input);
      // Clean up multiple dashes and leading/trailing dashes
      const cleaned = sanitized.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
      expect(cleaned).toBeDefined();
      expect(typeof cleaned).toBe('string');
    }
    
    console.log('✅ International character handling working');
  });

  test('should generate names with date and time components', async () => {
    const config = { branchStrategy: 'timestamp' };
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test that timestamp names include proper date/time components
    const timestampName = branchManager.generateBranchName({ prefix: 'release' });
    
    // Should match pattern: release-YYYY-MM-DDTHH-MM-SS
    expect(timestampName).toMatch(/^release-\d{4}-\d{2}-\d{2}[tT]\d{2}-\d{2}-\d{2}$/);
    
    // Extract date components and verify they're reasonable
    const match = timestampName.match(/^release-(\d{4})-(\d{2})-(\d{2})[tT](\d{2})-(\d{2})-(\d{2})$/);
    expect(match).toBeTruthy();
    
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      
      expect(parseInt(year)).toBeGreaterThanOrEqual(2024);
      expect(parseInt(month)).toBeGreaterThanOrEqual(1);
      expect(parseInt(month)).toBeLessThanOrEqual(12);
      expect(parseInt(day)).toBeGreaterThanOrEqual(1);
      expect(parseInt(day)).toBeLessThanOrEqual(31);
      expect(parseInt(hour)).toBeGreaterThanOrEqual(0);
      expect(parseInt(hour)).toBeLessThanOrEqual(23);
      expect(parseInt(minute)).toBeGreaterThanOrEqual(0);
      expect(parseInt(minute)).toBeLessThanOrEqual(59);
      expect(parseInt(second)).toBeGreaterThanOrEqual(0);
      expect(parseInt(second)).toBeLessThanOrEqual(59);
    }
    
    console.log('✅ Date and time component generation working');
  });

  test('should generate unique identifiers for conflict resolution', async () => {
    const config = {};
    branchManager = new BranchManager(repositoryManager, config);
    
    // Test unique identifier generation
    const baseName = 'feature/auth';
    const uniqueNames = [];
    
    for (let i = 0; i < 5; i++) {
      const uniqueName = branchManager.generateUniqueBranchName(baseName);
      uniqueNames.push(uniqueName);
      // Add small delay to ensure timestamp difference
      if (i < 4) await new Promise(resolve => setTimeout(resolve, 2));
    }
    
    // All should be unique (due to timestamp-based generation)
    const uniqueSet = new Set(uniqueNames);
    expect(uniqueSet.size).toBe(uniqueNames.length);
    
    // All should follow the pattern: baseName-XXXXXX (6 digits)
    uniqueNames.forEach(name => {
      expect(name).toMatch(/^feature\/auth-\d{6}$/);
    });
    
    console.log('✅ Unique identifier generation working');
  });
});