/**
 * Test Atomic Commit Operations
 * Phase 4.2.2: Atomic commit operations with rollback
 */

import { describe, test, expect, beforeAll, afterEach, beforeEach, jest } from '@jest/globals';
import { ResourceManager } from '@legion/tools';
import CommitOrchestrator from '../../../src/integration/CommitOrchestrator.js';
import RepositoryManager from '../../../src/integration/RepositoryManager.js';
import GitConfigValidator from '../../../src/config/GitConfigValidator.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Atomic Commit Operations', () => {
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
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-commit-test-'));
    
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

  test('should perform successful atomic commits', async () => {
    const config = {
      messageFormat: 'simple' // Don't enforce conventional format
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage files
    await fs.writeFile(path.join(tempDir, 'atomic1.js'), 'const atomic1 = true;');
    await fs.writeFile(path.join(tempDir, 'atomic2.js'), 'const atomic2 = true;');
    await commitOrchestrator.stageFiles(['atomic1.js', 'atomic2.js']);
    
    // Get initial commit count
    const initialHistory = await commitOrchestrator.getCommitHistory({ limit: 10 });
    const initialCount = initialHistory.length;
    
    // Perform atomic commit
    const result = await commitOrchestrator.createCommit('Atomic commit test');
    
    expect(result.success).toBe(true);
    expect(result.hash).toBeTruthy();
    expect(result.filesChanged).toBe(2);
    
    // Verify commit was created
    const newHistory = await commitOrchestrator.getCommitHistory({ limit: 10 });
    expect(newHistory.length).toBe(initialCount + 1);
    expect(newHistory[0].subject).toBe('Atomic commit test');
    
    console.log('✅ Successful atomic commit working');
  });

  test('should handle commit rollback on failure', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create a scenario that will fail
    // Mock the git commit command to fail
    const originalExecuteGitCommand = commitOrchestrator.executeGitCommand;
    let commitAttempted = false;
    
    commitOrchestrator.executeGitCommand = jest.fn().mockImplementation(async (args) => {
      if (args[0] === 'commit') {
        commitAttempted = true;
        throw new Error('Simulated commit failure');
      }
      return originalExecuteGitCommand.call(commitOrchestrator, args);
    });
    
    // Create and stage files
    await fs.writeFile(path.join(tempDir, 'fail.js'), 'const fail = true;');
    await commitOrchestrator.stageFiles(['fail.js']);
    
    // Attempt commit
    await expect(commitOrchestrator.createCommit('Should fail'))
      .rejects.toThrow('Failed to create commit: Simulated commit failure');
    
    expect(commitAttempted).toBe(true);
    expect(commitOrchestrator.commitStats.failedCommits).toBe(1);
    
    // Files should still be staged for retry
    expect(commitOrchestrator.stagedFiles.has('fail.js')).toBe(true);
    
    console.log('✅ Commit rollback on failure working');
  });

  test('should handle partial commit scenarios', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create multiple files, some will fail to stage
    await fs.writeFile(path.join(tempDir, 'valid1.js'), 'const valid1 = true;');
    await fs.writeFile(path.join(tempDir, 'valid2.js'), 'const valid2 = true;');
    
    // Stage files including non-existent ones
    const stageResult = await commitOrchestrator.stageFiles([
      'valid1.js',
      'valid2.js',
      'invalid1.js',
      'invalid2.js'
    ]);
    
    expect(stageResult.staged).toHaveLength(2);
    expect(stageResult.failed).toHaveLength(2);
    
    // Should be able to commit the successfully staged files
    const commitResult = await commitOrchestrator.createCommit('Partial staging commit');
    
    expect(commitResult.success).toBe(true);
    expect(commitResult.filesChanged).toBe(2);
    
    console.log('✅ Partial commit handling working');
  });

  test('should maintain commit atomicity with multiple operations', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create initial files
    await fs.writeFile(path.join(tempDir, 'base.js'), 'const base = true;');
    await commitOrchestrator.stageFiles(['base.js']);
    await commitOrchestrator.createCommit('Base commit');
    
    // Perform multiple operations
    await fs.writeFile(path.join(tempDir, 'feature1.js'), 'const feature1 = true;');
    await fs.writeFile(path.join(tempDir, 'feature2.js'), 'const feature2 = true;');
    await fs.appendFile(path.join(tempDir, 'base.js'), '\nconst updated = true;');
    
    // Stage all changes
    await commitOrchestrator.stageFiles(['feature1.js', 'feature2.js', 'base.js']);
    
    // Create atomic commit
    const result = await commitOrchestrator.createCommit('Multi-file atomic commit');
    
    expect(result.success).toBe(true);
    expect(result.filesChanged).toBe(3);
    expect(result.insertions).toBeGreaterThan(0);
    
    // Verify all changes were committed atomically
    const history = await commitOrchestrator.getCommitHistory({ limit: 1 });
    expect(history[0].subject).toBe('Multi-file atomic commit');
    
    console.log('✅ Multi-operation atomic commit working');
  });

  test('should support commit amendments', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create initial commit
    await fs.writeFile(path.join(tempDir, 'amend.js'), 'const original = true;');
    await commitOrchestrator.stageFiles(['amend.js']);
    await commitOrchestrator.createCommit('Original commit message');
    
    // Modify file and stage
    await fs.writeFile(path.join(tempDir, 'amend.js'), 'const amended = true;');
    await commitOrchestrator.stageFiles(['amend.js']);
    
    // Amend commit
    const amendResult = await commitOrchestrator.amendCommit('Amended commit message');
    
    expect(amendResult.success).toBe(true);
    
    // Check that the last commit was amended
    const history = await commitOrchestrator.getCommitHistory({ limit: 1 });
    expect(history[0].subject).toBe('Amended commit message');
    
    console.log('✅ Commit amendment working');
  });

  test('should handle commit with no-verify option', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create and stage file
    await fs.writeFile(path.join(tempDir, 'noverify.js'), 'const noverify = true;');
    await commitOrchestrator.stageFiles(['noverify.js']);
    
    // Create commit with no-verify
    const result = await commitOrchestrator.createCommit('Skip hooks commit', {
      noVerify: true
    });
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Skip hooks commit');
    
    console.log('✅ Commit with no-verify option working');
  });

  test('should parse commit results correctly', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Test parseCommitResult method
    const sampleOutput = `[main abc1234] Test commit
 2 files changed, 10 insertions(+), 3 deletions(-)`;
    
    const parsed = commitOrchestrator.parseCommitResult(sampleOutput);
    
    expect(parsed.hash).toBe('abc1234');
    expect(parsed.filesChanged).toBe(2);
    expect(parsed.insertions).toBe(10);
    expect(parsed.deletions).toBe(3);
    expect(parsed.timestamp).toBeInstanceOf(Date);
    
    console.log('✅ Commit result parsing working');
  });

  test('should track commit history properly', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Create multiple commits
    for (let i = 1; i <= 3; i++) {
      await fs.writeFile(path.join(tempDir, `file${i}.js`), `const file${i} = true;`);
      await commitOrchestrator.stageFiles([`file${i}.js`]);
      await commitOrchestrator.createCommit(`Commit ${i}`);
    }
    
    // Get commit history
    const history = await commitOrchestrator.getCommitHistory({ limit: 5 });
    
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history[0].subject).toBe('Commit 3');
    expect(history[1].subject).toBe('Commit 2');
    expect(history[2].subject).toBe('Commit 1');
    
    // Test oneline format
    const onelineHistory = await commitOrchestrator.getCommitHistory({ 
      limit: 3, 
      oneline: true 
    });
    
    expect(onelineHistory.length).toBe(3);
    expect(onelineHistory[0]).toContain('Commit 3');
    
    console.log('✅ Commit history tracking working');
  });

  test('should handle signed commits when configured', async () => {
    const config = {
      signCommits: true,
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    // Mock executeGitCommand to track if -S flag is used
    const originalExecuteGitCommand = commitOrchestrator.executeGitCommand;
    let signFlagUsed = false;
    
    commitOrchestrator.executeGitCommand = jest.fn().mockImplementation(async (args) => {
      if (args[0] === 'commit' && args.includes('-S')) {
        signFlagUsed = true;
      }
      // Skip actual signing since it requires GPG setup
      const filteredArgs = args.filter(arg => arg !== '-S');
      return originalExecuteGitCommand.call(commitOrchestrator, filteredArgs);
    });
    
    // Create and stage file
    await fs.writeFile(path.join(tempDir, 'signed.js'), 'const signed = true;');
    await commitOrchestrator.stageFiles(['signed.js']);
    
    // Create signed commit
    await commitOrchestrator.createCommit('Signed commit');
    
    expect(signFlagUsed).toBe(true);
    
    console.log('✅ Signed commit configuration working');
  });

  test('should emit proper events for atomic operations', async () => {
    const config = {
      messageFormat: 'simple'
    };
    commitOrchestrator = new CommitOrchestrator(repositoryManager, config);
    await commitOrchestrator.initialize();
    
    const events = [];
    commitOrchestrator.on('commitCreated', (data) => events.push(['commitCreated', data]));
    commitOrchestrator.on('commitFailed', (data) => events.push(['commitFailed', data]));
    commitOrchestrator.on('commitAmended', (data) => events.push(['commitAmended', data]));
    
    // Create successful commit
    await fs.writeFile(path.join(tempDir, 'event.js'), 'const event = true;');
    await commitOrchestrator.stageFiles(['event.js']);
    await commitOrchestrator.createCommit('Event test commit');
    
    // Amend commit
    await fs.appendFile(path.join(tempDir, 'event.js'), '\nconst updated = true;');
    await commitOrchestrator.stageFiles(['event.js']);
    await commitOrchestrator.amendCommit('Amended event commit');
    
    const eventTypes = events.map(e => e[0]);
    expect(eventTypes).toContain('commitCreated');
    expect(eventTypes).toContain('commitAmended');
    
    console.log('✅ Atomic operation event emission working');
  });
});