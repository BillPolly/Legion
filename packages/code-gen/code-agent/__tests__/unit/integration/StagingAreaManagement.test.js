/**
 * Test Staging Area Management
 * Phase 4.2.1: Intelligent file staging and grouping
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tool-system';
import CommitOrchestrator from '../../../src/integration/CommitOrchestrator.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Staging Area Management', () => {
  let resourceManager;
  let repositoryManager;
  let commitOrchestrator;
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'staging-area-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Create an initial commit
    await repositoryManager.createInitialCommit('Initial commit for testing');
  });

  afterEach(async () => {
    if (commitOrchestrator) {
      await commitOrchestrator.cleanup();
      commitOrchestrator = null;
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

  test('should stage files selectively', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create multiple files
    await fs.writeFile(path.join(tempDir, 'file1.js'), 'const file1 = 1;');
    await fs.writeFile(path.join(tempDir, 'file2.js'), 'const file2 = 2;');
    await fs.writeFile(path.join(tempDir, 'file3.js'), 'const file3 = 3;');
    
    // Stage only specific files
    const result = await commitOrchestrator.stageFiles(['file1.js', 'file3.js']);
    
    expect(result.staged).toHaveLength(2);
    expect(result.staged).toContain('file1.js');
    expect(result.staged).toContain('file3.js');
    expect(commitOrchestrator.stagedFiles.has('file1.js')).toBe(true);
    expect(commitOrchestrator.stagedFiles.has('file3.js')).toBe(true);
    expect(commitOrchestrator.stagedFiles.has('file2.js')).toBe(false);
    
    console.log('✅ Selective file staging working');
  });

  test('should manage staging area state correctly', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage files
    await fs.writeFile(path.join(tempDir, 'staged1.js'), 'const staged1 = true;');
    await fs.writeFile(path.join(tempDir, 'staged2.js'), 'const staged2 = true;');
    await commitOrchestrator.stageFiles(['staged1.js', 'staged2.js']);
    
    // Create unstaged file
    await fs.writeFile(path.join(tempDir, 'unstaged.js'), 'const unstaged = true;');
    
    // Modify a staged file
    await fs.writeFile(path.join(tempDir, 'staged1.js'), 'const staged1 = false; // modified');
    
    // Reload staging area state
    await commitOrchestrator.loadStagingAreaState();
    
    // Check state
    expect(commitOrchestrator.stagedFiles.has('staged1.js')).toBe(true);
    expect(commitOrchestrator.stagedFiles.has('staged2.js')).toBe(true);
    expect(commitOrchestrator.pendingChanges.has('staged1.js')).toBe(true); // Has unstaged changes
    expect(commitOrchestrator.pendingChanges.has('unstaged.js')).toBe(true);
    
    console.log('✅ Staging area state management working');
  });

  test('should validate staged changes before commit', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Try to commit without staged files
    await expect(commitOrchestrator.createCommit('Empty commit'))
      .rejects.toThrow('No files staged for commit');
    
    // Stage a file
    await fs.writeFile(path.join(tempDir, 'valid.js'), 'const valid = true;');
    await commitOrchestrator.stageFiles(['valid.js']);
    
    // Now commit should work
    const result = await commitOrchestrator.createCommit('Valid commit');
    expect(result.success).toBe(true);
    
    console.log('✅ Staged changes validation working');
  });

  test('should handle already staged files', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage a file
    await fs.writeFile(path.join(tempDir, 'already.js'), 'const already = true;');
    await commitOrchestrator.stageFiles(['already.js']);
    
    // Try to stage the same file again
    const result = await commitOrchestrator.stageFiles(['already.js']);
    
    expect(result.alreadyStaged).toHaveLength(1);
    expect(result.alreadyStaged).toContain('already.js');
    expect(result.staged).toHaveLength(0);
    
    console.log('✅ Already staged file handling working');
  });

  test('should track auto-staged files separately', async () => {
    const config = {
      autoStage: true
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Stage files
    await fs.writeFile(path.join(tempDir, 'auto1.js'), 'const auto1 = true;');
    await fs.writeFile(path.join(tempDir, 'auto2.js'), 'const auto2 = true;');
    
    const result = await commitOrchestrator.stageFiles(['auto1.js', 'auto2.js']);
    
    expect(result.staged).toHaveLength(2);
    expect(commitOrchestrator.commitStats.autoStagedFiles).toBe(2);
    
    console.log('✅ Auto-staged file tracking working');
  });

  test('should unstage files correctly', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage multiple files
    await fs.writeFile(path.join(tempDir, 'keep1.js'), 'const keep1 = true;');
    await fs.writeFile(path.join(tempDir, 'keep2.js'), 'const keep2 = true;');
    await fs.writeFile(path.join(tempDir, 'remove.js'), 'const remove = true;');
    
    await commitOrchestrator.stageFiles(['keep1.js', 'keep2.js', 'remove.js']);
    expect(commitOrchestrator.stagedFiles.size).toBe(3);
    
    // Unstage one file
    const result = await commitOrchestrator.unstageFiles(['remove.js']);
    
    expect(result.unstaged).toHaveLength(1);
    expect(result.unstaged).toContain('remove.js');
    expect(commitOrchestrator.stagedFiles.size).toBe(2);
    expect(commitOrchestrator.stagedFiles.has('keep1.js')).toBe(true);
    expect(commitOrchestrator.stagedFiles.has('keep2.js')).toBe(true);
    expect(commitOrchestrator.stagedFiles.has('remove.js')).toBe(false);
    
    console.log('✅ File unstaging working');
  });

  test('should handle staging failures gracefully', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Try to stage non-existent files
    const result = await commitOrchestrator.stageFiles([
      'exists.js',
      'does-not-exist.js',
      'also-missing.js'
    ]);
    
    // Create the existing file
    await fs.writeFile(path.join(tempDir, 'exists.js'), 'const exists = true;');
    const retryResult = await commitOrchestrator.stageFiles([
      'exists.js',
      'does-not-exist.js',
      'also-missing.js'
    ]);
    
    expect(retryResult.staged).toHaveLength(1);
    expect(retryResult.staged).toContain('exists.js');
    expect(retryResult.failed).toHaveLength(2);
    expect(retryResult.failed.some(f => f.file === 'does-not-exist.js')).toBe(true);
    expect(retryResult.failed.some(f => f.file === 'also-missing.js')).toBe(true);
    
    console.log('✅ Staging failure handling working');
  });

  test('should parse git status output correctly', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create various file states
    await fs.writeFile(path.join(tempDir, 'modified.js'), 'const original = true;');
    await commitOrchestrator.executeGitCommand(['add', 'modified.js']);
    await commitOrchestrator.executeGitCommand(['commit', '-m', 'Add modified.js']);
    
    // Modify the file
    await fs.writeFile(path.join(tempDir, 'modified.js'), 'const modified = true;');
    
    // Stage a new file
    await fs.writeFile(path.join(tempDir, 'new.js'), 'const new = true;');
    await commitOrchestrator.executeGitCommand(['add', 'new.js']);
    
    // Create untracked file
    await fs.writeFile(path.join(tempDir, 'untracked.js'), 'const untracked = true;');
    
    // Parse status
    const statusOutput = await commitOrchestrator.executeGitCommand(['status', '--porcelain']);
    commitOrchestrator.parseStagingAreaStatus(statusOutput);
    
    expect(commitOrchestrator.stagedFiles.has('new.js')).toBe(true);
    expect(commitOrchestrator.pendingChanges.has('modified.js')).toBe(true);
    expect(commitOrchestrator.pendingChanges.has('untracked.js')).toBe(true);
    
    const untrackedChange = commitOrchestrator.pendingChanges.get('untracked.js');
    expect(untrackedChange.untracked).toBe(true);
    
    console.log('✅ Git status parsing working');
  });

  test('should clear staged files after successful commit', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage files
    await fs.writeFile(path.join(tempDir, 'commit1.js'), 'const commit1 = true;');
    await fs.writeFile(path.join(tempDir, 'commit2.js'), 'const commit2 = true;');
    await commitOrchestrator.stageFiles(['commit1.js', 'commit2.js']);
    
    expect(commitOrchestrator.stagedFiles.size).toBe(2);
    
    // Create commit
    await commitOrchestrator.createCommit('Test commit');
    
    // Staged files should be cleared
    expect(commitOrchestrator.stagedFiles.size).toBe(0);
    
    console.log('✅ Staged files clearing after commit working');
  });

  test('should emit staging events properly', async () => {
    const config = {};
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    const events = [];
    commitOrchestrator.on('stagingAreaLoaded', (data) => events.push(['stagingAreaLoaded', data]));
    commitOrchestrator.on('filesStaged', (data) => events.push(['filesStaged', data]));
    commitOrchestrator.on('filesUnstaged', (data) => events.push(['filesUnstaged', data]));
    
    // Create and stage files
    await fs.writeFile(path.join(tempDir, 'event1.js'), 'const event1 = true;');
    await fs.writeFile(path.join(tempDir, 'event2.js'), 'const event2 = true;');
    
    await commitOrchestrator.stageFiles(['event1.js', 'event2.js']);
    await commitOrchestrator.loadStagingAreaState();
    await commitOrchestrator.unstageFiles(['event1.js']);
    
    const eventTypes = events.map(e => e[0]);
    expect(eventTypes).toContain('filesStaged');
    expect(eventTypes).toContain('stagingAreaLoaded');
    expect(eventTypes).toContain('filesUnstaged');
    
    console.log('✅ Staging event emission working');
  });
});