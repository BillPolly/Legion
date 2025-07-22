/**
 * Test RemoteSynchronizationManager - Remote synchronization
 * Phase 2.2.2: Remote repository synchronization operations
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/module-loader';
import RemoteSynchronizationManager from '../../../src/integration/RemoteSynchronizationManager.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('RemoteSynchronizationManager Remote Synchronization', () => {
  let resourceManager;
  let repositoryManager;
  let syncManager;
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-manager-test-'));
    
    // Create and initialize repository manager
    const config = GitConfigValidator.getDefaultConfig();
    repositoryManager = new RepositoryManager(resourceManager, config, tempDir);
    await repositoryManager.initialize();
    await repositoryManager.initializeRepository();
    
    // Add a mock remote
    await repositoryManager.addRemote('origin', 'https://github.com/test/repo.git');
  });

  afterEach(async () => {
    if (syncManager) {
      await syncManager.cleanup();
      syncManager = null;
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

  test('should initialize RemoteSynchronizationManager', async () => {
    const config = { conflictResolution: 'manual' };
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    
    expect(syncManager.initialized).toBe(false);
    expect(syncManager.conflictResolutionStrategy).toBe('manual');
    
    await syncManager.initialize();
    
    expect(syncManager.initialized).toBe(true);
    expect(syncManager.isInitialized()).toBe(true);
    
    console.log('✅ RemoteSynchronizationManager initialization working');
  });

  test('should fail initialization without RepositoryManager', async () => {
    const invalidRepoManager = { isInitialized: () => false };
    const config = {};
    syncManager = new RemoteSynchronizationManager(invalidRepoManager, config);
    
    await expect(syncManager.initialize())
      .rejects.toThrow('RepositoryManager must be initialized first');
    
    console.log('✅ Initialization validation working');
  });

  test('should get synchronization status', async () => {
    const config = { conflictResolution: 'auto' };
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    // Mock the Git commands to avoid actual Git operations
    syncManager.executeGitCommand = jest.fn()
      .mockResolvedValueOnce('') // status --porcelain
      .mockRejectedValueOnce(new Error('No upstream')) // rev-list upstream..HEAD
      .mockResolvedValueOnce('') // fetch
      .mockRejectedValueOnce(new Error('No upstream')); // rev-list HEAD..upstream
    
    const status = await syncManager.getSyncStatus();
    
    expect(status).toBeDefined();
    expect(typeof status.hasLocalChanges).toBe('boolean');
    expect(typeof status.hasRemoteChanges).toBe('boolean');
    expect(status.conflictResolutionStrategy).toBe('auto');
    expect(status.stats).toBeDefined();
    expect(typeof status.needsSync).toBe('boolean');
    
    console.log('✅ Synchronization status retrieval working');
  });

  test('should detect local changes', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    // Mock Git commands for different scenarios
    syncManager.executeGitCommand = jest.fn();
    
    // Test case 1: No local changes
    syncManager.executeGitCommand
      .mockResolvedValueOnce('') // status --porcelain (empty)
      .mockResolvedValueOnce('0'); // rev-list --count (0 commits ahead)
    
    let hasChanges = await syncManager.hasLocalChanges();
    expect(hasChanges).toBe(false);
    
    // Test case 2: Has uncommitted changes
    syncManager.executeGitCommand.mockReset();
    syncManager.executeGitCommand
      .mockResolvedValueOnce('M  file.txt\n'); // status --porcelain (modified file)
    
    hasChanges = await syncManager.hasLocalChanges();
    expect(hasChanges).toBe(true);
    
    // Test case 3: Has unpushed commits
    syncManager.executeGitCommand.mockReset();
    syncManager.executeGitCommand
      .mockResolvedValueOnce('') // status --porcelain (empty)
      .mockResolvedValueOnce('2'); // rev-list --count (2 commits ahead)
    
    hasChanges = await syncManager.hasLocalChanges();
    expect(hasChanges).toBe(true);
    
    console.log('✅ Local changes detection working');
  });

  test('should detect remote changes', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    // Mock Git commands
    syncManager.executeGitCommand = jest.fn();
    
    // Test case 1: No remote changes
    syncManager.executeGitCommand
      .mockResolvedValueOnce('') // fetch
      .mockResolvedValueOnce('0'); // rev-list --count HEAD..upstream
    
    let hasChanges = await syncManager.hasRemoteChanges();
    expect(hasChanges).toBe(false);
    
    // Test case 2: Has remote changes
    syncManager.executeGitCommand.mockReset();
    syncManager.executeGitCommand
      .mockResolvedValueOnce('') // fetch
      .mockResolvedValueOnce('3'); // rev-list --count HEAD..upstream
    
    hasChanges = await syncManager.hasRemoteChanges();
    expect(hasChanges).toBe(true);
    
    console.log('✅ Remote changes detection working');
  });

  test('should execute fetch operation', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    // Mock successful fetch
    syncManager.executeGitCommand = jest.fn().mockResolvedValue('Fetching origin\nFrom https://github.com/test/repo');
    
    const events = [];
    syncManager.on('fetchCompleted', (data) => events.push(['fetchCompleted', data]));
    
    const result = await syncManager.fetchFromRemote();
    
    expect(result.success).toBe(true);
    expect(result.output).toContain('Fetching origin');
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(events.length).toBe(1);
    
    console.log('✅ Fetch operation working');
  });

  test('should handle fetch with options', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    syncManager.executeGitCommand = jest.fn().mockResolvedValue('Fetched successfully');
    
    await syncManager.fetchFromRemote({ all: true, prune: true, remote: 'origin' });
    
    expect(syncManager.executeGitCommand).toHaveBeenCalledWith(['fetch', '--all', '--prune', 'origin']);
    
    console.log('✅ Fetch with options working');
  });

  test('should parse conflicts from Git output', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    const gitOutput = `
Auto-merging file1.txt
CONFLICT (content): Merge conflict in file1.txt
Auto-merging file2.js
CONFLICT (add/add): Merge conflict in file2.js
Automatic merge failed; fix conflicts and then commit the result.
    `;
    
    const conflicts = syncManager.parseConflictsFromOutput(gitOutput);
    
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0].file).toBe('file1.txt');
    expect(conflicts[0].type).toBe('merge');
    expect(conflicts[1].file).toBe('file2.js');
    expect(conflicts[1].type).toBe('merge');
    
    console.log('✅ Conflict parsing working');
  });

  test('should parse changed files from Git output', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    const gitOutput = `
 file1.txt           |   5 +++++
 src/components.js   |  12 ++++++------
 tests/unit.test.js  |   3 +--
 3 files changed, 12 insertions(+), 8 deletions(-)
    `;
    
    const files = syncManager.parseChangedFilesFromOutput(gitOutput);
    
    expect(files.length).toBeGreaterThanOrEqual(1);
    expect(files).toContain('file1.txt');
    
    console.log('✅ Changed files parsing working');
  });

  test('should handle synchronization conflicts with different strategies', async () => {
    const config = { conflictResolution: 'ours' };
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    const conflicts = [
      { file: 'file1.txt', type: 'merge' },
      { file: 'file2.js', type: 'merge' }
    ];
    
    // Mock Git commands for "ours" strategy
    syncManager.executeGitCommand = jest.fn().mockResolvedValue('');
    
    const events = [];
    syncManager.on('conflictsDetected', (data) => events.push(['conflictsDetected', data]));
    
    const result = await syncManager.handleSyncConflicts(conflicts);
    
    expect(result.strategy).toBe('ours');
    expect(result.resolved).toBe(2);
    expect(events.length).toBe(1);
    expect(syncManager.syncStats.conflictCount).toBe(2);
    
    console.log('✅ Conflict resolution with "ours" strategy working');
  });

  test('should handle different conflict resolution strategies', async () => {
    const config = { conflictResolution: 'theirs' };
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    const conflicts = [{ file: 'file1.txt', type: 'merge' }];
    
    // Mock Git commands for "theirs" strategy
    syncManager.executeGitCommand = jest.fn().mockResolvedValue('');
    
    const result = await syncManager.handleSyncConflicts(conflicts);
    
    expect(result.strategy).toBe('theirs');
    expect(result.resolved).toBe(1);
    
    console.log('✅ Conflict resolution with "theirs" strategy working');
  });

  test('should handle manual conflict resolution', async () => {
    const config = { conflictResolution: 'manual' };
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    const conflicts = [{ file: 'file1.txt', type: 'merge' }];
    
    const result = await syncManager.handleSyncConflicts(conflicts);
    
    expect(result.strategy).toBe('manual');
    expect(result.conflicts).toEqual(conflicts);
    expect(result.instructions).toContain('resolve conflicts manually');
    
    console.log('✅ Manual conflict resolution working');
  });

  test('should prevent concurrent synchronization operations', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    // Mock a long-running Git operation
    syncManager.executeGitCommand = jest.fn().mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve('success'), 100))
    );
    
    // Start first operation
    const pullPromise = syncManager.pullFromRemote();
    
    // Try to start second operation while first is running
    await expect(syncManager.pushToRemote())
      .rejects.toThrow('Synchronization already in progress');
    
    // Wait for first operation to complete
    await pullPromise;
    
    console.log('✅ Concurrent operation prevention working');
  });

  test('should track synchronization statistics', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    // Mock successful operations
    syncManager.executeGitCommand = jest.fn().mockResolvedValue('Success');
    
    const initialStats = syncManager.getStats();
    expect(initialStats.pullCount).toBe(0);
    expect(initialStats.pushCount).toBe(0);
    
    // Perform operations
    await syncManager.pullFromRemote();
    await syncManager.pushToRemote();
    
    const updatedStats = syncManager.getStats();
    expect(updatedStats.pullCount).toBe(1);
    expect(updatedStats.pushCount).toBe(1);
    expect(updatedStats.lastSuccessfulSync).toBeInstanceOf(Date);
    
    // Reset stats
    syncManager.resetStats();
    
    const resetStats = syncManager.getStats();
    expect(resetStats.pullCount).toBe(0);
    expect(resetStats.pushCount).toBe(0);
    
    console.log('✅ Statistics tracking working');
  });

  test('should emit events during operations', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    const events = [];
    syncManager.on('pullCompleted', (data) => events.push(['pullCompleted', data]));
    syncManager.on('pushCompleted', (data) => events.push(['pushCompleted', data]));
    syncManager.on('pullFailed', (data) => events.push(['pullFailed', data]));
    
    // Mock successful pull
    syncManager.executeGitCommand = jest.fn().mockResolvedValue('Pull successful');
    
    await syncManager.pullFromRemote();
    
    expect(events.length).toBe(1);
    expect(events[0][0]).toBe('pullCompleted');
    
    // Mock failed pull
    syncManager.executeGitCommand = jest.fn().mockRejectedValue(new Error('Pull failed'));
    
    try {
      await syncManager.pullFromRemote();
    } catch (error) {
      // Expected to fail
    }
    
    expect(events.length).toBe(2);
    expect(events[1][0]).toBe('pullFailed');
    
    console.log('✅ Event emission working');
  });

  test('should handle repository without remote', async () => {
    // Create repository manager without remote
    const noRemoteRepoManager = new RepositoryManager(resourceManager, {}, tempDir + '-no-remote');
    await noRemoteRepoManager.initialize();
    await noRemoteRepoManager.initializeRepository();
    
    const config = {};
    const noRemoteSyncManager = new RemoteSynchronizationManager(noRemoteRepoManager, config);
    await noRemoteSyncManager.initialize();
    
    await expect(noRemoteSyncManager.pullFromRemote())
      .rejects.toThrow('No remote repository configured');
    
    await expect(noRemoteSyncManager.pushToRemote())
      .rejects.toThrow('No remote repository configured');
    
    await noRemoteSyncManager.cleanup();
    await noRemoteRepoManager.cleanup();
    
    console.log('✅ No remote repository handling working');
  });

  test('should handle cleanup properly', async () => {
    const config = {};
    syncManager = new RemoteSynchronizationManager(repositoryManager, config);
    await syncManager.initialize();
    
    expect(syncManager.initialized).toBe(true);
    
    await syncManager.cleanup();
    
    expect(syncManager.initialized).toBe(false);
    expect(syncManager.syncInProgress).toBe(false);
    
    console.log('✅ Cleanup working');
  });
});